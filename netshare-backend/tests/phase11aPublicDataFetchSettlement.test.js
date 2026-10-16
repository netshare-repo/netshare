import { beforeAll, afterAll, describe, expect, it } from 'vitest';
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
import { getTaskById } from '../controllers/taskController.js';

let client, contributor, node, task, route;
const payload = () => ({
  contractVersion: 1, serviceType: 'PUBLIC_DATA_FETCH', taskId: String(task._id),
  routingSessionId: String(route._id), nodeId: String(node._id), executedAt: new Date().toISOString(),
  success: true, successRate: 100, statusCode: 200, latencyMs: 42, bandwidthUsedMB: 0.01,
  uploadBandwidthMB: 0, packetLoss: null,
  resultData: { schemaVersion: 1, finalUrl: 'https://example.com/data',
    contentType: 'application/json; charset=utf-8', content: '{"ok":true}',
    responseSizeBytes: 11, httpStatus: 200, ttfbMs: 10, totalTimeMs: 42 },
});

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const model of [User, Wallet, TaskResult, CreditTransaction]) await model.init();
  const suffix = new mongoose.Types.ObjectId();
  [client, contributor] = await User.create([
    { name: 'Public fetch client', email: `p11a_client_${suffix}@test.io`, password: 'fixture', role: 'platform_client', isVerified: true },
    { name: 'Public fetch node', email: `p11a_node_${suffix}@test.io`, password: 'fixture', role: 'node_participant', isVerified: true },
  ]);
  await Wallet.create([{ userId: client._id, balance: 100 }, { userId: contributor._id, balance: 0 }]);
  node = await NodeDevice.create({ userId: contributor._id, deviceName: 'P11A fixture', region: 'P11A',
    status: 'active', bandwidthLimitMB: 100, usedBandwidthMB: 0, maxConcurrentTasks: 1, currentActiveTasks: 1 });
  task = await TestingTask.create({ clientId: client._id, targetUrl: 'https://example.com/data',
    method: 'GET', serviceType: 'PUBLIC_DATA_FETCH', targetRegion: 'P11A', executionLimit: 1,
    estimatedCost: 10, status: 'running', assignedNodeId: node._id });
  const debit = () => runTransaction(session => deductCredits({
    userId: client._id, taskId: task._id, amount: task.estimatedCost,
    description: 'Public fetch test debit', idempotencyKey: `task-submission:${task._id}`, session,
  }));
  await debit();
  await debit();
  route = (await createRoutingSession({ taskId: task._id, clientId: client._id, nodeId: node._id })).session;
  await RoutingSession.updateOne({ _id: route._id }, { status: 'active' });
  await TaskSession.create({ taskId: task._id, clientId: client._id, nodeId: node._id,
    sessionToken: `p11a-${suffix}`, status: 'running' });
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

describe('Phase 11A transactional result receipt', () => {
  it('rejects forged or oversized node content without settlement, then persists once', async () => {
    const forged = payload(); forged.nodeId = String(new mongoose.Types.ObjectId());
    await expect(settleTaskResult(route._id, forged)).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
    const oversized = payload(); oversized.resultData.content = 'x'.repeat(16385);
    oversized.resultData.responseSizeBytes = 16385;
    oversized.resultData.contentType = 'text/plain';
    await expect(settleTaskResult(route._id, oversized)).rejects.toThrow();
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(0);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'debit' })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'credit' })).toBe(0);

    const first = await settleTaskResult(route._id, payload());
    expect(first.settled).toBe(true);
    const duplicate = await settleTaskResult(route._id, payload());
    expect(duplicate.settled).toBe(false);
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(1);
    expect(await BandwidthUsage.countDocuments({ taskId: task._id })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'debit' })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'credit' })).toBe(1);
    const result = await TaskResult.findOne({ taskId: task._id });
    expect(result.publicFetch).toMatchObject({ contractVersion: 1, content: '{"ok":true}',
      contentType: 'application/json; charset=utf-8', httpStatus: 200, responseSizeBytes: 11 });
    expect(String(result.publicFetch.sourceNodeId)).toBe(String(node._id));
    expect(result.publicFetch.executedAt).toBeInstanceOf(Date);
    expect(result.resultData.content).toBeUndefined();
  });

  it('exposes the persisted public fetch only to its client owner', async () => {
    const invoke = async userId => {
      const response = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await getTaskById({
        params: { id: String(task._id) },
        user: { _id: userId, role: 'platform_client' },
      }, response);
      return response;
    };

    const owner = await invoke(client._id);
    expect(owner.statusCode).toBe(200);
    expect(owner.body.result.publicFetch.content).toBe('{"ok":true}');

    const unrelatedClient = await invoke(new mongoose.Types.ObjectId());
    expect(unrelatedClient.statusCode).toBe(403);
    expect(unrelatedClient.body.result).toBeUndefined();
  });
});
