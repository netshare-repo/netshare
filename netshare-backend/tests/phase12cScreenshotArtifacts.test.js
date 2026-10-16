import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

vi.mock('../services/targetValidationService.js', () => ({
  validateTarget: vi.fn().mockResolvedValue({ valid: true }),
}));

import config from '../config/env.js';
import taskRoutes from '../routes/taskRoutes.js';
import { errorHandler } from '../middleware/errorMiddleware.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import RoutingSession from '../models/RoutingSession.js';
import TaskResult from '../models/TaskResult.js';
import ScreenshotArtifact from '../models/ScreenshotArtifact.js';
import CreditTransaction from '../models/CreditTransaction.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import {
  LocalPrivateScreenshotStore,
  cleanupScreenshotArtifacts,
  configureScreenshotObjectStore,
  createScreenshotUploadGrant,
  inspectPng,
  storeScreenshotUpload,
} from '../services/screenshotArtifactService.js';
import { settleTaskResult } from '../services/taskSettlementService.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const pngSha = crypto.createHash('sha256').update(png).digest('hex');
const api = express();
api.use(express.json());
api.use('/api/tasks', taskRoutes);
api.use(errorHandler);

let client;
let otherClient;
let contributor;
let node;
let clientToken;
let otherToken;
let nodeToken;
let privateRoot;
const taskIds = [];

const bearer = token => ({ Authorization: `Bearer ${token}` });

const createFixture = async ({ captureScreenshot = true } = {}) => {
  const task = await TestingTask.create({
    clientId: client._id,
    targetUrl: 'https://example.com',
    method: 'GET',
    serviceType: 'BROWSER_PAGE_INSPECT',
    targetRegion: 'P12C',
    executionLimit: 1,
    estimatedCost: 10,
    assignedNodeId: node._id,
    status: 'running',
    browserPageInspect: {
      viewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
      pageLoadTimeoutMs: 15000,
      maxTextBytes: 32768,
      captureScreenshot,
    },
  });
  const now = Date.now();
  const route = await RoutingSession.create({
    taskId: task._id,
    clientId: client._id,
    nodeId: node._id,
    authTokenHash: crypto.randomBytes(32).toString('hex'),
    authTokenExpiresAt: new Date(now + 5 * 60 * 1000),
    authTokenIssuedAt: new Date(now),
    status: 'active',
    startedAt: new Date(now - 1000),
    expiresAt: new Date(now + 5 * 60 * 1000),
  });
  taskIds.push(task._id);
  return { task, route };
};

const requestGrant = async (task, route, token = nodeToken, overrides = {}) => request(api)
  .post(`/api/tasks/${task._id}/browser-artifacts/upload-grant`)
  .set(bearer(token))
  .send({
    nodeId: String(node._id),
    routingSessionId: String(route._id),
    contentType: 'image/png',
    sizeBytes: png.length,
    sha256: pngSha,
    ...overrides,
  });

const upload = async (task, grant, bytes = png, token = nodeToken, contentType = 'image/png') => request(api)
  .put(`/api/tasks/${task._id}/browser-artifacts/${grant.artifact.artifactId}`)
  .set(bearer(token))
  .set('X-NetShare-Artifact-Grant', grant.upload.grantToken)
  .set('Content-Type', contentType)
  .send(bytes);

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([TaskResult.init(), ScreenshotArtifact.init(), CreditTransaction.init()]);
  privateRoot = path.resolve(`.phase12c-private-${process.pid}-${Date.now()}`);
  configureScreenshotObjectStore(new LocalPrivateScreenshotStore(privateRoot));
  const suffix = new mongoose.Types.ObjectId();
  [client, otherClient, contributor] = await User.create([
    { name: 'P12C owner', email: `p12c-owner-${suffix}@test.io`, password: 'fixture', role: 'platform_client', isVerified: true },
    { name: 'P12C other', email: `p12c-other-${suffix}@test.io`, password: 'fixture', role: 'platform_client', isVerified: true },
    { name: 'P12C node', email: `p12c-node-${suffix}@test.io`, password: 'fixture', role: 'node_participant', isVerified: true },
  ]);
  await Wallet.create([{ userId: client._id, balance: 100 }, { userId: contributor._id, balance: 0 }]);
  node = await NodeDevice.create({
    userId: contributor._id,
    deviceName: 'P12C node',
    region: 'P12C',
    status: 'active',
    bandwidthLimitMB: 100,
    usedBandwidthMB: 0,
    maxConcurrentTasks: 20,
    currentActiveTasks: 10,
  });
  clientToken = jwt.sign({ id: client._id }, config.jwt.secret, { expiresIn: '1h' });
  otherToken = jwt.sign({ id: otherClient._id }, config.jwt.secret, { expiresIn: '1h' });
  nodeToken = jwt.sign({ id: contributor._id }, config.jwt.secret, { expiresIn: '1h' });
});

afterAll(async () => {
  await ScreenshotArtifact.deleteMany({ taskId: { $in: taskIds } });
  await TaskResult.deleteMany({ taskId: { $in: taskIds } });
  await BandwidthUsage.deleteMany({ taskId: { $in: taskIds } });
  await CreditTransaction.deleteMany({ taskId: { $in: taskIds } });
  await RoutingSession.deleteMany({ taskId: { $in: taskIds } });
  await TestingTask.deleteMany({ _id: { $in: taskIds } });
  await NodeDevice.deleteOne({ _id: node?._id });
  const userIds = [client?._id, otherClient?._id, contributor?._id].filter(Boolean);
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  if (privateRoot?.startsWith(path.resolve('.'))) await fs.rm(privateRoot, { recursive: true, force: true });
  await mongoose.disconnect();
});

describe('Phase 12C private screenshot artifact storage', () => {
  it('validates a bounded PNG structure and rejects non-PNG and trailing polyglot data', () => {
    expect(inspectPng(png)).toEqual({ width: 1, height: 1 });
    expect(() => inspectPng(Buffer.from('not a png'))).toThrow(/valid PNG/i);
    expect(() => inspectPng(Buffer.concat([png, Buffer.from('<script>')]))).toThrow(/trailing/i);
  });

  it('requires the authenticated owning node and exact active task/session binding', async () => {
    const { task, route } = await createFixture();
    expect((await requestGrant(task, route, clientToken)).status).toBe(403);
    expect((await requestGrant(task, route, nodeToken, { authorization: 'Bearer injected' })).status).toBe(400);
    expect((await requestGrant(task, route, nodeToken, { nodeId: new mongoose.Types.ObjectId().toString() })).status).toBe(403);
    const other = await createFixture();
    expect((await requestGrant(task, route, nodeToken, { routingSessionId: String(other.route._id) })).status).toBe(403);
    await RoutingSession.updateOne({ _id: route._id }, { expiresAt: new Date(Date.now() - 1) });
    expect((await requestGrant(task, route)).status).toBe(403);
  });

  it('uploads once with an exact digest and rejects duplicate, spoofed and malformed uploads', async () => {
    const { task, route } = await createFixture();
    const grantResponse = await requestGrant(task, route);
    expect(grantResponse.status).toBe(201);
    const grant = grantResponse.body;
    expect((await requestGrant(task, route)).status).toBe(409);
    expect((await upload(task, grant, png, clientToken)).status).toBe(403);
    expect((await upload(task, grant, Buffer.alloc(png.length))).status).toBe(422);
    const stored = await upload(task, grant);
    expect(stored.status).toBe(201);
    expect(stored.body.artifact).toEqual(grant.artifact && {
      artifactId: grant.artifact.artifactId,
      contentType: 'image/png',
      sizeBytes: png.length,
      sha256: pngSha,
    });
    expect((await upload(task, grant)).status).not.toBe(201);
    const metadata = await ScreenshotArtifact.findOne({ taskId: task._id }).select('+storageKey');
    expect(metadata.status).toBe('stored');
    expect(metadata.toObject()).not.toHaveProperty('bytes');
    expect(metadata.storageKey).toBe(grant.artifact.artifactId);
  });

  it('rejects invalid media, signatures and oversized raw request bodies', async () => {
    const invalidBytes = Buffer.alloc(png.length, 1);
    const { task, route } = await createFixture();
    const invalidGrant = await createScreenshotUploadGrant({
      taskId: task._id,
      nodeId: node._id,
      routingSessionId: route._id,
      userId: contributor._id,
      contentType: 'image/png',
      sizeBytes: invalidBytes.length,
      sha256: crypto.createHash('sha256').update(invalidBytes).digest('hex'),
    });
    await expect(storeScreenshotUpload({
      taskId: task._id,
      artifactId: invalidGrant.artifact.artifactId,
      userId: contributor._id,
      grantToken: invalidGrant.upload.grantToken,
      contentType: 'image/png',
      bytes: invalidBytes,
    })).rejects.toMatchObject({ code: 'INVALID_PNG' });

    const huge = Buffer.alloc(config.screenshotStorage.maxBytes + 1);
    const response = await request(api)
      .put(`/api/tasks/${task._id}/browser-artifacts/${invalidGrant.artifact.artifactId}`)
      .set(bearer(nodeToken))
      .set('X-NetShare-Artifact-Grant', invalidGrant.upload.grantToken)
      .set('Content-Type', 'image/png')
      .send(huge);
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('registers only the uploaded opaque reference during exactly-once settlement', async () => {
    const { task, route } = await createFixture();
    const grantResponse = await requestGrant(task, route);
    expect(grantResponse.status).toBe(201);
    expect((await upload(task, grantResponse.body)).status).toBe(201);
    const reference = grantResponse.body.artifact;
    const payload = {
      contractVersion: 1,
      serviceType: 'BROWSER_PAGE_INSPECT',
      taskId: String(task._id),
      routingSessionId: String(route._id),
      nodeId: String(node._id),
      targetRegion: 'P12C',
      executedAt: new Date().toISOString(),
      success: true,
      successRate: 100,
      statusCode: 200,
      latencyMs: 30,
      bandwidthUsedMB: 0.01,
      uploadBandwidthMB: 0,
      packetLoss: null,
      resultData: {
        schemaVersion: 1,
        finalUrl: 'https://example.com/',
        httpStatus: 200,
        pageTitle: 'Example',
        viewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
        textContent: 'Example text',
        textSizeBytes: 12,
        screenshotArtifact: reference,
        resourceCount: 1,
        blockedResourceCount: 0,
        transferredBytes: 1024,
        ttfbMs: 10,
        pageLoadTimeMs: 20,
        totalTimeMs: 30,
        error: null,
      },
    };
    expect((await settleTaskResult(route._id, payload)).settled).toBe(true);
    expect((await settleTaskResult(route._id, payload)).settled).toBe(false);
    const result = await TaskResult.findOne({ taskId: task._id });
    expect(result.browserPageInspect.screenshotArtifact.toObject()).toEqual(reference);
    expect(result.resultData.screenshotArtifactId).toBe(reference.artifactId);
    expect(result.resultData).not.toHaveProperty('screenshotBytes');
    const artifact = await ScreenshotArtifact.findOne({ artifactId: reference.artifactId });
    expect(artifact.status).toBe('registered');
    expect(String(artifact.taskResultId)).toBe(String(result._id));
  });

  it('serves registered screenshots only to the owner with download-only safe headers', async () => {
    const result = await TaskResult.findOne({
      clientId: client._id,
      'browserPageInspect.screenshotArtifact.artifactId': { $exists: true },
    });
    const artifactId = result.browserPageInspect.screenshotArtifact.artifactId;
    expect((await request(api).get(`/api/tasks/${result.taskId}/browser-artifacts/${artifactId}`)).status).toBe(401);
    expect((await request(api).get(`/api/tasks/${result.taskId}/browser-artifacts/${artifactId}`).set(bearer(nodeToken))).status).toBe(403);
    expect((await request(api).get(`/api/tasks/${result.taskId}/browser-artifacts/${artifactId}`).set(bearer(otherToken))).status).toBe(403);
    const owner = await request(api)
      .get(`/api/tasks/${result.taskId}/browser-artifacts/${artifactId}`)
      .set(bearer(clientToken));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toMatch(/^image\/png/);
    expect(owner.headers['content-disposition']).toMatch(/^attachment;/);
    expect(owner.headers['x-content-type-options']).toBe('nosniff');
    expect(owner.headers['cache-control']).toContain('no-store');
    expect(Buffer.compare(owner.body, png)).toBe(0);
  });

  it('cleans expired grants, cancelled tasks and unregistered orphan objects', async () => {
    const expiredFixture = await createFixture();
    const expiredGrant = await createScreenshotUploadGrant({
      taskId: expiredFixture.task._id,
      nodeId: node._id,
      routingSessionId: expiredFixture.route._id,
      userId: contributor._id,
      contentType: 'image/png',
      sizeBytes: png.length,
      sha256: pngSha,
    });
    await cleanupScreenshotArtifacts({
      now: new Date(new Date(expiredGrant.upload.expiresAt).getTime() + 1),
    });
    expect((await ScreenshotArtifact.findOne({ artifactId: expiredGrant.artifact.artifactId })).status).toBe('deleted');

    const cancelledFixture = await createFixture();
    const cancelledGrant = await createScreenshotUploadGrant({
      taskId: cancelledFixture.task._id,
      nodeId: node._id,
      routingSessionId: cancelledFixture.route._id,
      userId: contributor._id,
      contentType: 'image/png',
      sizeBytes: png.length,
      sha256: pngSha,
    });
    await storeScreenshotUpload({
      taskId: cancelledFixture.task._id,
      artifactId: cancelledGrant.artifact.artifactId,
      userId: contributor._id,
      grantToken: cancelledGrant.upload.grantToken,
      contentType: 'image/png',
      bytes: png,
    });
    await TestingTask.updateOne({ _id: cancelledFixture.task._id }, { status: 'cancelled' });
    await cleanupScreenshotArtifacts();
    expect((await ScreenshotArtifact.findOne({ artifactId: cancelledGrant.artifact.artifactId })).status).toBe('deleted');

    const failedFixture = await createFixture();
    const failedGrant = await createScreenshotUploadGrant({
      taskId: failedFixture.task._id,
      nodeId: node._id,
      routingSessionId: failedFixture.route._id,
      userId: contributor._id,
      contentType: 'image/png',
      sizeBytes: png.length,
      sha256: pngSha,
    });
    await storeScreenshotUpload({
      taskId: failedFixture.task._id,
      artifactId: failedGrant.artifact.artifactId,
      userId: contributor._id,
      grantToken: failedGrant.upload.grantToken,
      contentType: 'image/png',
      bytes: png,
    });
    await TestingTask.updateOne({ _id: failedFixture.task._id }, { status: 'failed' });
    await cleanupScreenshotArtifacts();
    expect((await ScreenshotArtifact.findOne({ artifactId: failedGrant.artifact.artifactId })).status).toBe('deleted');

    const orphanFixture = await createFixture();
    const orphanGrant = await createScreenshotUploadGrant({
      taskId: orphanFixture.task._id,
      nodeId: node._id,
      routingSessionId: orphanFixture.route._id,
      userId: contributor._id,
      contentType: 'image/png',
      sizeBytes: png.length,
      sha256: pngSha,
    });
    await storeScreenshotUpload({
      taskId: orphanFixture.task._id,
      artifactId: orphanGrant.artifact.artifactId,
      userId: contributor._id,
      grantToken: orphanGrant.upload.grantToken,
      contentType: 'image/png',
      bytes: png,
    });
    await cleanupScreenshotArtifacts({ now: new Date(Date.now() + config.screenshotStorage.orphanGraceMs + 1000) });
    expect((await ScreenshotArtifact.findOne({ artifactId: orphanGrant.artifact.artifactId })).status).toBe('deleted');
  });

  it('derives local object paths solely from opaque IDs and rejects traversal input', () => {
    const store = new LocalPrivateScreenshotStore(privateRoot);
    expect(store.objectPath('a'.repeat(32)).startsWith(privateRoot + path.sep)).toBe(true);
    expect(() => store.objectPath('../outside')).toThrow(/identifier/i);
  });
});
