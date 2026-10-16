import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import TaskSession from '../models/TaskSession.js';
import RoutingSession from '../models/RoutingSession.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { createRoutingSession } from '../services/routingSessionService.js';
import { settleTaskResult } from '../services/taskSettlementService.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { deductCredits } from '../services/walletService.js';

let client, contributor, node, task, route;
const payload = () => ({
  contractVersion: 1,
  serviceType: 'BROWSER_PAGE_INSPECT',
  taskId: String(task._id),
  routingSessionId: String(route._id),
  nodeId: String(node._id),
  targetRegion: 'P12A',
  executedAt: new Date().toISOString(),
  success: true,
  successRate: 100,
  statusCode: 200,
  latencyMs: 34,
  bandwidthUsedMB: 0.02,
  uploadBandwidthMB: 0,
  packetLoss: null,
  resultData: {
    schemaVersion: 1,
    finalUrl: 'https://example.com/landing',
    httpStatus: 200,
    pageTitle: 'Example page',
    viewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
    textContent: 'Example text',
    textSizeBytes: 12,
    screenshotArtifact: null,
    resourceCount: 3,
    blockedResourceCount: 1,
    transferredBytes: 2048,
    ttfbMs: 12,
    pageLoadTimeMs: 30,
    totalTimeMs: 34,
    error: null,
  },
});

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const model of [User, Wallet, TaskResult, CreditTransaction]) await model.init();
  const suffix = new mongoose.Types.ObjectId();
  [client, contributor] = await User.create([
    { name: 'Browser inspect client', email: `p12a_client_${suffix}@test.io`, password: 'fixture', role: 'platform_client', isVerified: true },
    { name: 'Browser inspect node', email: `p12a_node_${suffix}@test.io`, password: 'fixture', role: 'node_participant', isVerified: true },
  ]);
  await Wallet.create([{ userId: client._id, balance: 100 }, { userId: contributor._id, balance: 0 }]);
  node = await NodeDevice.create({ userId: contributor._id, deviceName: 'P12A fixture', region: 'P12A',
    status: 'active', bandwidthLimitMB: 100, usedBandwidthMB: 0, maxConcurrentTasks: 1, currentActiveTasks: 1 });
  task = await TestingTask.create({ clientId: client._id, targetUrl: 'https://example.com', method: 'GET',
    serviceType: 'BROWSER_PAGE_INSPECT', targetRegion: 'P12A', executionLimit: 1, estimatedCost: 10,
    status: 'running', assignedNodeId: node._id,
    browserPageInspect: { viewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
      pageLoadTimeoutMs: 15000, maxTextBytes: 32768, captureScreenshot: false } });
  const debit = () => runTransaction(session => deductCredits({ userId: client._id, taskId: task._id,
    amount: task.estimatedCost, description: 'Browser inspection test debit',
    idempotencyKey: `task-submission:${task._id}`, session }));
  await debit();
  await debit();
  route = (await createRoutingSession({ taskId: task._id, clientId: client._id, nodeId: node._id })).session;
  await RoutingSession.updateOne({ _id: route._id }, { status: 'active' });
  await TaskSession.create({ taskId: task._id, clientId: client._id, nodeId: node._id,
    sessionToken: `p12a-${suffix}`, status: 'running' });
});

afterAll(async () => {
  if (task) {
    await TaskResult.deleteMany({ taskId: task._id });
    await TaskSession.deleteMany({ taskId: task._id });
    await RoutingSession.deleteMany({ taskId: task._id });
    await BandwidthUsage.deleteMany({ taskId: task._id });
    await CreditTransaction.deleteMany({ taskId: task._id });
    await TestingTask.deleteOne({ _id: task._id });
  }
  if (node) await NodeDevice.deleteOne({ _id: node._id });
  const userIds = [client?._id, contributor?._id].filter(Boolean);
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await mongoose.disconnect();
});

describe('Phase 12A browser page inspection settlement contract', () => {
  it('persists bounded metadata once and keeps task debit and node reward idempotent', async () => {
    const first = await settleTaskResult(route._id, payload());
    expect(first.settled).toBe(true);
    const duplicate = await settleTaskResult(route._id, payload());
    expect(duplicate.settled).toBe(false);

    const result = await TaskResult.findOne({ taskId: task._id });
    expect(result.browserPageInspect.toObject()).toMatchObject({
      contractVersion: 1,
      finalUrl: 'https://example.com/landing',
      httpStatus: 200,
      pageTitle: 'Example page',
      textContent: 'Example text',
      textSizeBytes: 12,
      screenshotArtifact: null,
      resourceCount: 3,
      sourceNodeId: node._id,
    });
    expect(result.resultData.textContent).toBeUndefined();
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'debit' })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'credit' })).toBe(1);
    expect(await BandwidthUsage.countDocuments({ taskId: task._id })).toBe(1);
  });
});
