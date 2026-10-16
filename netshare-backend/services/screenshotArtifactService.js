import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import ScreenshotArtifact from '../models/ScreenshotArtifact.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import RoutingSession from '../models/RoutingSession.js';
import NodeDevice from '../models/NodeDevice.js';
import { BROWSER_PAGE_INSPECT, BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES } from './browserPageInspectService.js';

const ACTIVE_STATUSES = ['pending', 'uploading', 'stored', 'registered'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const artifactError = (message, status = 400, code = 'INVALID_SCREENSHOT_ARTIFACT') =>
  Object.assign(new Error(message), { status, statusCode: status, code, isOperational: true });

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const validId = value => mongoose.isValidObjectId(value);
const isArtifactId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export class ScreenshotObjectStore {
  async put(_artifactId, _bytes) { throw artifactError('Screenshot storage is unavailable', 503, 'STORAGE_UNAVAILABLE'); }
  async get(_artifactId) { throw artifactError('Screenshot storage is unavailable', 503, 'STORAGE_UNAVAILABLE'); }
  async delete(_artifactId) { throw artifactError('Screenshot storage is unavailable', 503, 'STORAGE_UNAVAILABLE'); }
  async exists(_artifactId) { return false; }
}

export class LocalPrivateScreenshotStore extends ScreenshotObjectStore {
  constructor(rootDirectory) {
    super();
    this.rootDirectory = path.resolve(rootDirectory);
  }

  objectPath(artifactId) {
    if (!isArtifactId(artifactId)) throw artifactError('Invalid artifact identifier');
    const candidate = path.resolve(this.rootDirectory, artifactId.slice(0, 2), `${artifactId}.png`);
    if (!candidate.startsWith(`${this.rootDirectory}${path.sep}`)) {
      throw artifactError('Invalid artifact storage path', 400, 'PATH_TRAVERSAL_REJECTED');
    }
    return candidate;
  }

  async put(artifactId, bytes) {
    const destination = this.objectPath(artifactId);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    let handle;
    try {
      handle = await fs.open(destination, 'wx', 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      if (error?.code === 'EEXIST') throw artifactError('Artifact object already exists', 409, 'DUPLICATE_ARTIFACT');
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async get(artifactId) { return fs.readFile(this.objectPath(artifactId)); }

  async delete(artifactId) {
    try { await fs.unlink(this.objectPath(artifactId)); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }

  async exists(artifactId) {
    try { await fs.access(this.objectPath(artifactId)); return true; }
    catch { return false; }
  }
}

let objectStore = !config.isProduction && config.screenshotStorage.provider === 'local'
  ? new LocalPrivateScreenshotStore(config.screenshotStorage.localDirectory)
  : null;

export const configureScreenshotObjectStore = store => {
  if (store != null && !(store instanceof ScreenshotObjectStore)) {
    throw artifactError('Screenshot object store must implement ScreenshotObjectStore');
  }
  objectStore = store;
};

const requireStore = () => {
  if (!objectStore) throw artifactError('Private screenshot storage is not configured', 503, 'STORAGE_UNAVAILABLE');
  return objectStore;
};

export const inspectPng = bytes => {
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw artifactError('Screenshot is not a valid PNG', 415, 'INVALID_PNG');
  }
  let offset = 8;
  let width = null;
  let height = null;
  let sawIdat = false;
  let sawIend = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (length > bytes.length || chunkEnd > bytes.length) throw artifactError('PNG contains a truncated chunk', 415, 'INVALID_PNG');
    if (offset === 8) {
      if (type !== 'IHDR' || length !== 13) throw artifactError('PNG must begin with IHDR', 415, 'INVALID_PNG');
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      if (width < 1 || height < 1 || width > 3840 || height > 4320) {
        throw artifactError('PNG dimensions exceed the browser contract', 413, 'PNG_DIMENSIONS_EXCEEDED');
      }
    } else if (type === 'IHDR') {
      throw artifactError('PNG contains duplicate IHDR data', 415, 'INVALID_PNG');
    }
    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') {
      if (length !== 0 || chunkEnd !== bytes.length) throw artifactError('PNG has invalid trailing data', 415, 'INVALID_PNG');
      sawIend = true;
      break;
    }
    offset = chunkEnd;
  }
  if (!width || !height || !sawIdat || !sawIend) throw artifactError('PNG structure is incomplete', 415, 'INVALID_PNG');
  return { width, height };
};

export const createScreenshotUploadGrant = async ({
  taskId, nodeId, routingSessionId, userId, contentType, sizeBytes, sha256, now = new Date(),
}) => {
  requireStore();
  if (![taskId, nodeId, routingSessionId, userId].every(validId) || contentType !== 'image/png' ||
      !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > config.screenshotStorage.maxBytes ||
      typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw artifactError('Invalid screenshot upload authorization request');
  }
  const [task, node, route] = await Promise.all([
    TestingTask.findById(taskId), NodeDevice.findById(nodeId), RoutingSession.findById(routingSessionId),
  ]);
  if (!task || task.serviceType !== BROWSER_PAGE_INSPECT || task.browserPageInspect?.captureScreenshot !== true ||
      !['assigned', 'running'].includes(task.status)) {
    throw artifactError('Task is not authorized for screenshot capture', 409, 'TASK_NOT_AUTHORIZED');
  }
  if (!node || String(node.userId) !== String(userId) || String(task.assignedNodeId) !== String(node._id)) {
    throw artifactError('Node is not authorized for this task', 403, 'NODE_NOT_AUTHORIZED');
  }
  if (!route || route.status !== 'active' || route.expiresAt <= now ||
      String(route.taskId) !== String(task._id) || String(route.nodeId) !== String(node._id) ||
      String(route.clientId) !== String(task.clientId)) {
    throw artifactError('Routing session is not active for this task and node', 403, 'ROUTE_NOT_AUTHORIZED');
  }
  const existing = await ScreenshotArtifact.findOne({ taskId: task._id, status: { $in: ACTIVE_STATUSES } });
  if (existing) throw artifactError('A screenshot artifact already exists for this task', 409, 'DUPLICATE_ARTIFACT');

  const artifactId = crypto.randomBytes(16).toString('hex');
  const grantToken = crypto.randomBytes(32).toString('hex');
  const grantExpiresAt = new Date(Math.min(
    route.expiresAt.getTime(), now.getTime() + config.screenshotStorage.uploadGrantTtlMs,
  ));
  const expiresAt = new Date(now.getTime() + config.screenshotStorage.retentionMs);
  const artifact = await ScreenshotArtifact.create({
    artifactId, taskId: task._id, clientId: task.clientId, nodeId: node._id,
    routingSessionId: route._id, contentType, sizeBytes, sha256,
    storageProvider: config.screenshotStorage.provider, storageKey: artifactId,
    uploadGrantHash: digest(grantToken), uploadGrantExpiresAt: grantExpiresAt, expiresAt,
  });
  return {
    artifact: { artifactId, contentType, sizeBytes, sha256 },
    retentionExpiresAt: expiresAt,
    upload: {
      method: 'PUT',
      path: `/api/tasks/${task._id}/browser-artifacts/${artifactId}`,
      grantToken,
      expiresAt: grantExpiresAt,
    },
  };
};

export const storeScreenshotUpload = async ({
  taskId, artifactId, userId, grantToken, contentType, bytes, now = new Date(),
}) => {
  const store = requireStore();
  if (!validId(taskId) || !validId(userId) || !isArtifactId(artifactId) ||
      typeof grantToken !== 'string' || grantToken.length !== 64 || contentType !== 'image/png' ||
      !Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > config.screenshotStorage.maxBytes) {
    throw artifactError('Invalid screenshot upload', bytes?.length > config.screenshotStorage.maxBytes ? 413 : 400);
  }
  const artifact = await ScreenshotArtifact.findOne({ artifactId, taskId, status: 'pending' })
    .select('+uploadGrantHash +storageKey');
  if (!artifact || artifact.uploadGrantExpiresAt <= now || artifact.expiresAt <= now ||
      artifact.uploadGrantHash !== digest(grantToken)) {
    throw artifactError('Screenshot upload grant is invalid or expired', 403, 'INVALID_UPLOAD_GRANT');
  }
  const node = await NodeDevice.findOne({ _id: artifact.nodeId, userId });
  if (!node) throw artifactError('Node is not authorized for this upload', 403, 'NODE_NOT_AUTHORIZED');
  if (bytes.length !== artifact.sizeBytes || digest(bytes) !== artifact.sha256) {
    throw artifactError('Screenshot size or digest does not match its grant', 422, 'ARTIFACT_INTEGRITY_MISMATCH');
  }
  const dimensions = inspectPng(bytes);
  const claimed = await ScreenshotArtifact.findOneAndUpdate({
    _id: artifact._id, status: 'pending', uploadGrantHash: artifact.uploadGrantHash,
    uploadGrantExpiresAt: { $gt: now }, expiresAt: { $gt: now },
  }, { $set: { status: 'uploading', uploadStartedAt: now } }, { new: true }).select('+storageKey');
  if (!claimed) throw artifactError('Screenshot upload has already been consumed', 409, 'DUPLICATE_UPLOAD');
  try {
    await store.put(artifactId, bytes);
    const stored = await ScreenshotArtifact.findOneAndUpdate(
      { _id: artifact._id, status: 'uploading' },
      { $set: { status: 'stored', uploadedAt: now, width: dimensions.width, height: dimensions.height },
        $unset: { uploadGrantHash: 1 } },
      { new: true },
    );
    if (!stored) throw artifactError('Screenshot upload state changed unexpectedly', 409, 'UPLOAD_STATE_CHANGED');
    return { artifactId, contentType: stored.contentType, sizeBytes: stored.sizeBytes, sha256: stored.sha256 };
  } catch (error) {
    await store.delete(artifactId).catch(() => {});
    await ScreenshotArtifact.updateOne({ _id: artifact._id }, {
      $set: { status: 'failed', deletionReason: 'upload_failed', deletedAt: new Date() },
      $unset: { uploadGrantHash: 1, storageKey: 1 },
    }).catch(() => {});
    throw error;
  }
};

export const verifyScreenshotArtifact = async (reference, expected) => {
  try {
    const store = requireStore();
    const artifact = await ScreenshotArtifact.findOne({
      artifactId: reference.artifactId,
      taskId: expected.taskId,
      nodeId: expected.nodeId,
      routingSessionId: expected.routingSessionId,
      status: { $in: ['stored', 'registered'] },
      contentType: reference.contentType,
      sizeBytes: reference.sizeBytes,
      sha256: reference.sha256,
      expiresAt: { $gt: new Date() },
    });
    return Boolean(artifact && await store.exists(artifact.artifactId));
  } catch { return false; }
};

export const registerScreenshotArtifact = async ({ reference, taskId, nodeId, routingSessionId, taskResultId, session }) => {
  if (!reference) return null;
  const registered = await ScreenshotArtifact.findOneAndUpdate({
    artifactId: reference.artifactId, taskId, nodeId, routingSessionId,
    status: 'stored', contentType: reference.contentType, sizeBytes: reference.sizeBytes,
    sha256: reference.sha256, expiresAt: { $gt: new Date() },
  }, { $set: { status: 'registered', taskResultId, registeredAt: new Date() } }, { new: true, session });
  if (!registered) throw artifactError('Screenshot artifact could not be registered', 409, 'ARTIFACT_REGISTRATION_FAILED');
  return registered;
};

const removeArtifact = async (artifact, reason) => {
  const store = requireStore();
  await store.delete(artifact.artifactId);
  await ScreenshotArtifact.updateOne({ _id: artifact._id, status: { $ne: 'deleted' } }, {
    $set: { status: reason === 'expired' ? 'expired' : 'deleted', deletedAt: new Date(), deletionReason: reason },
    $unset: { uploadGrantHash: 1, storageKey: 1 },
  });
};

export const cleanupScreenshotArtifactsForTask = async (taskId, reason = 'task_terminal', keepArtifactId = null) => {
  if (!validId(taskId)) return 0;
  const artifacts = await ScreenshotArtifact.find({ taskId, status: { $in: ACTIVE_STATUSES },
    ...(keepArtifactId ? { artifactId: { $ne: keepArtifactId } } : {}) });
  let removed = 0;
  for (const artifact of artifacts) {
    await removeArtifact(artifact, reason);
    removed += 1;
  }
  return removed;
};

export const cleanupScreenshotArtifacts = async ({ now = new Date(), limit = 100 } = {}) => {
  if (!objectStore) return { inspected: 0, removed: 0 };
  const staleUpload = new Date(now.getTime() - config.screenshotStorage.abandonedUploadMs);
  const orphanBefore = new Date(now.getTime() - config.screenshotStorage.orphanGraceMs);
  const candidates = await ScreenshotArtifact.find({ status: { $in: ACTIVE_STATUSES } })
    .sort({ createdAt: 1 }).limit(Math.min(Math.max(limit, 1), 500));
  let removed = 0;
  for (const artifact of candidates) {
    let reason = null;
    if (artifact.expiresAt <= now) reason = 'expired';
    else if (artifact.status === 'pending' && artifact.uploadGrantExpiresAt <= now) reason = 'grant_expired';
    else if (artifact.status === 'uploading' && artifact.uploadStartedAt <= staleUpload) reason = 'upload_abandoned';
    const task = reason ? null : await TestingTask.findById(artifact.taskId).select('status');
    if (!reason && (!task || ['failed', 'cancelled'].includes(task.status))) reason = 'task_terminal';
    if (!reason && ['stored', 'registered'].includes(artifact.status) && artifact.createdAt <= orphanBefore) {
      const result = await TaskResult.findOne({ taskId: artifact.taskId,
        'browserPageInspect.screenshotArtifact.artifactId': artifact.artifactId }).select('_id');
      if (!result || artifact.status === 'registered' && String(result._id) !== String(artifact.taskResultId)) reason = 'orphaned';
    }
    if (reason) { await removeArtifact(artifact, reason); removed += 1; }
  }
  return { inspected: candidates.length, removed };
};

export const readScreenshotArtifact = async ({ taskId, artifactId, userId, now = new Date() }) => {
  const store = requireStore();
  if (!validId(taskId) || !validId(userId) || !isArtifactId(artifactId)) {
    throw artifactError('Screenshot artifact was not found', 404, 'ARTIFACT_NOT_FOUND');
  }
  const task = await TestingTask.findById(taskId).select('clientId');
  if (!task) throw artifactError('Screenshot artifact was not found', 404, 'ARTIFACT_NOT_FOUND');
  if (String(task.clientId) !== String(userId)) {
    throw artifactError('Only the task owner may retrieve this screenshot', 403, 'ARTIFACT_ACCESS_DENIED');
  }
  const result = await TaskResult.findOne({ taskId,
    'browserPageInspect.screenshotArtifact.artifactId': artifactId }).select('_id');
  const artifact = result ? await ScreenshotArtifact.findOne({
    artifactId, taskId, taskResultId: result._id, status: 'registered', expiresAt: { $gt: now },
  }).select('+storageKey') : null;
  if (!artifact) throw artifactError('Screenshot artifact was not found', 404, 'ARTIFACT_NOT_FOUND');
  const bytes = await store.get(artifactId).catch(() => null);
  if (!bytes || bytes.length !== artifact.sizeBytes || digest(bytes) !== artifact.sha256) {
    throw artifactError('Screenshot artifact failed integrity verification', 410, 'ARTIFACT_INTEGRITY_FAILURE');
  }
  return { bytes, contentType: artifact.contentType, sizeBytes: artifact.sizeBytes, sha256: artifact.sha256 };
};

let cleanupTimer = null;
export const startScreenshotArtifactCleanup = () => {
  if (cleanupTimer || !objectStore) return cleanupTimer;
  const run = () => cleanupScreenshotArtifacts().catch(error =>
    logger.error({ err: error }, 'Screenshot artifact cleanup failed'));
  void run();
  cleanupTimer = setInterval(run, config.screenshotStorage.cleanupIntervalMs);
  cleanupTimer.unref?.();
  return cleanupTimer;
};

export const stopScreenshotArtifactCleanup = () => {
  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = null;
};
