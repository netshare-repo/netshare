import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const mocks = vi.hoisted(() => ({
  enabled: true,
  targetCheck: vi.fn(),
  price: vi.fn(),
}));

vi.mock('../config/env.js', async importOriginal => {
  const actual = await importOriginal();
  const config = { ...actual.default };
  Object.defineProperty(config, 'regionalUptimeMonitorEnabled', { get: () => mocks.enabled });
  return { default: config };
});
vi.mock('../services/targetValidationService.js', () => ({
  validateTarget: mocks.targetCheck,
  validateRedirect: vi.fn(),
  validateTaskExecutionTarget: vi.fn(),
}));
vi.mock('../services/pricingService.js', () => ({
  estimateTaskPrice: mocks.price,
  PRICING_VERSION: 'test',
}));

import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import TaskSession from '../models/TaskSession.js';
import RoutingSession from '../models/RoutingSession.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import CreditTransaction from '../models/CreditTransaction.js';
import RegionalUptimeMonitor from '../models/RegionalUptimeMonitor.js';
import RegionalUptimeRun from '../models/RegionalUptimeRun.js';
import { createRoutingSession } from '../services/routingSessionService.js';
import { settleTaskResult } from '../services/taskSettlementService.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { deductCredits } from '../services/walletService.js';
import {
  cancelRegionalUptimeMonitor, createRegionalUptimeMonitor,
  ensureRegionalUptimeMonitorEnabled, failRegionalUptimeRun, getRegionalUptimeMonitor,
  scheduleNextRegionalUptimeRun, validateRegionalUptimeMonitorSubmission,
  validateRegionalUptimeTarget,
} from '../services/regionalUptimeMonitorService.js';
import { runRegionalUptimeSchedulerTick } from '../services/regionalUptimeScheduler.js';

const input = (overrides = {}) => ({ targetUrl: 'https://example.com/health', targetRegion: 'Pakistan',
  expectedStatusCode: 200, intervalMinutes: 5, maxRuns: 2, creditBudget: 20, ...overrides });
let contexts = [];

const newClient = async () => {
  const suffix = new mongoose.Types.ObjectId();
  const [user] = await User.create([{ name: 'Uptime client', email: `p13a_${suffix}@test.io`,
    password: 'fixture', role: 'platform_client', status: 'active', isVerified: true }]);
  const [wallet] = await Wallet.create([{ userId: user._id, balance: 100 }]);
  const context = { user, wallet, monitors: [], tasks: [], nodes: [], routes: [] };
  contexts.push(context);
  return context;
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const model of [RegionalUptimeMonitor, RegionalUptimeRun, TaskResult, CreditTransaction]) await model.init();
});

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    const taskIds = [...context.tasks.map(item => item._id), ...await TestingTask.find({ clientId: context.user._id }).distinct('_id')];
    await RegionalUptimeRun.deleteMany({ monitorId: { $in: context.monitors.map(item => item._id) } });
    await TaskResult.deleteMany({ taskId: { $in: taskIds } });
    await TaskSession.deleteMany({ taskId: { $in: taskIds } });
    await RoutingSession.deleteMany({ taskId: { $in: taskIds } });
    await BandwidthUsage.deleteMany({ taskId: { $in: taskIds } });
    await TestingTask.deleteMany({ _id: { $in: taskIds } });
    await RegionalUptimeMonitor.deleteMany({ _id: { $in: context.monitors.map(item => item._id) } });
    await CreditTransaction.deleteMany({ userId: { $in: [context.user._id, ...context.nodes.map(node => node.userId)] } });
    await Wallet.deleteMany({ userId: { $in: [context.user._id, ...context.nodes.map(node => node.userId)] } });
    await NodeDevice.deleteMany({ _id: { $in: context.nodes.map(item => item._id) } });
    await User.deleteMany({ _id: { $in: [context.user._id, ...context.nodes.map(node => node.userId)] } });
  }
  mocks.enabled = true;
  mocks.targetCheck.mockReset().mockResolvedValue({ valid: true, resolvedIp: '93.184.216.34' });
  mocks.price.mockReset().mockResolvedValue({ quote: { totalCredits: 10, executionLimit: 1, version: 'test' } });
});

afterAll(async () => { await mongoose.disconnect(); });

describe('Phase 13A regional uptime monitoring', () => {
  it('validates public HTTPS configuration, supported regions, intervals, statuses, runs and budgets', () => {
    expect(validateRegionalUptimeMonitorSubmission(input()).targetRegion).toBe('Pakistan');
    for (const invalid of [
      input({ targetUrl: 'http://example.com' }), input({ targetUrl: 'https://example.com:8443' }),
      input({ targetUrl: 'https://user:pass@example.com' }), input({ targetUrl: 'https://example.com/#fragment' }),
      input({ targetRegion: 'Mars' }), input({ expectedStatusCode: 99 }), input({ intervalMinutes: 4 }),
      input({ intervalMinutes: 1441 }), input({ maxRuns: 0 }), input({ maxRuns: 501 }),
      input({ creditBudget: 0 }), input({ extra: 'field' }),
    ]) expect(() => validateRegionalUptimeMonitorSubmission(invalid)).toThrow();
  });

  it('uses existing SSRF validation with HTTPS port 443 and stays disabled when flagged off', async () => {
    await validateRegionalUptimeTarget('https://example.com/health');
    expect(mocks.targetCheck).toHaveBeenCalledWith('https://example.com/health', { allowedPorts: [443] });
    mocks.targetCheck.mockResolvedValueOnce({ valid: false, reason: 'private address' });
    await expect(validateRegionalUptimeTarget('https://example.com/health')).rejects.toMatchObject({ code: 'TARGET_REJECTED' });

    mocks.enabled = false;
    expect(() => ensureRegionalUptimeMonitorEnabled()).toThrow(/unavailable/i);
    expect(await runRegionalUptimeSchedulerTick()).toEqual({ scheduled: 0, enqueued: 0 });
    mocks.enabled = true;
  });

  it('reserves the approved budget once and binds HTTP idempotency keys to request content', async () => {
    const { user, wallet } = await newClient();
    await expect(createRegionalUptimeMonitor({ clientId: user._id,
      input: input({ maxRuns: 1, creditBudget: 20 }), idempotencyKey: 'monitor-request-0001' }))
      .rejects.toThrow(/cannot exceed the maximum run cost/i);
    const created = await createRegionalUptimeMonitor({ clientId: user._id, input: input({ maxRuns: 1, creditBudget: 10 }), idempotencyKey: 'monitor-request-0001' });
    const monitorId = created.monitor._id;
    contexts.at(-1).monitors.push({ _id: monitorId });
    expect(created.pricePerRunCredits).toBe(10);
    expect((await Wallet.findById(wallet._id)).balance).toBe(90);
    const retry = await createRegionalUptimeMonitor({ clientId: user._id, input: input({ maxRuns: 1, creditBudget: 10 }), idempotencyKey: 'monitor-request-0001' });
    expect(String(retry.monitor._id)).toBe(String(monitorId));
    expect(await CreditTransaction.countDocuments({ userId: user._id, type: 'debit', idempotencyKey: `regional-uptime-reserve:${monitorId}` })).toBe(1);
    await expect(createRegionalUptimeMonitor({ clientId: user._id, input: input({ maxRuns: 1, creditBudget: 10, targetRegion: 'UAE' }), idempotencyKey: 'monitor-request-0001' }))
      .rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('creates at most one ordinary authorized GET task for a due monitor and bills an HTTP sample once', async () => {
    const context = await newClient();
    const { user, monitors, tasks, nodes, routes } = context;
    const created = await createRegionalUptimeMonitor({ clientId: user._id, input: input({ maxRuns: 1, creditBudget: 10 }), idempotencyKey: 'single-run-request-01' });
    const monitorId = new mongoose.Types.ObjectId(created.monitor._id);
    monitors.push({ _id: monitorId });
    const scheduledAt = new Date();
    const [first, second] = await Promise.all([
      scheduleNextRegionalUptimeRun(monitorId, scheduledAt),
      scheduleNextRegionalUptimeRun(monitorId, scheduledAt),
    ]);
    const scheduled = [first, second].filter(Boolean);
    expect(scheduled).toHaveLength(1);
    const { task, run } = scheduled[0];
    tasks.push(task);
    expect(task.serviceType).toBe('performance_testing');
    expect(task.method).toBe('GET');
    expect(task.executionLimit).toBe(1);
    expect(String(task.regionalUptimeMonitorId)).toBe(String(monitorId));
    expect(await TestingTask.countDocuments({ regionalUptimeMonitorId: monitorId })).toBe(1);
    expect(await RegionalUptimeRun.countDocuments({ monitorId })).toBe(1);

    const nodeSuffix = new mongoose.Types.ObjectId();
    const [nodeUser] = await User.create([{ name: 'Uptime node', email: `p13a_node_${nodeSuffix}@test.io`,
      password: 'fixture', role: 'node_participant', status: 'active', isVerified: true }]);
    nodes.push({ userId: nodeUser._id });
    await Wallet.create([{ userId: nodeUser._id, balance: 0 }]);
    const [node] = await NodeDevice.create([{ userId: nodeUser._id, deviceName: 'Uptime fixture', region: 'Pakistan',
      status: 'active', bandwidthLimitMB: 100, usedBandwidthMB: 0, maxConcurrentTasks: 1, currentActiveTasks: 1 }]);
    nodes.at(-1)._id = node._id;
    task.status = 'running';
    task.assignedNodeId = node._id;
    await task.save();
    const { session: route } = await createRoutingSession({ taskId: task._id, clientId: user._id, nodeId: node._id });
    routes.push(route);
    route.status = 'active';
    await route.save();
    await TaskSession.create([{ taskId: task._id, clientId: user._id, nodeId: node._id, sessionToken: `p13a-${nodeSuffix}`, status: 'running' }]);
    await RegionalUptimeRun.updateOne({ _id: run._id }, { $set: { status: 'running', startedAt: new Date() } });

    const resultPayload = { taskId: String(task._id), routingSessionId: String(route._id), nodeId: String(node._id),
      targetRegion: 'Pakistan', success: false, successRate: 0, statusCode: 503, latencyMs: 48,
      bandwidthUsedMB: 0.01, uploadBandwidthMB: 0, packetLoss: null, resultData: { error: 'HTTP 503' } };
    const settled = await settleTaskResult(route._id, resultPayload);
    expect(settled.settled).toBe(true);
    const duplicate = await settleTaskResult(route._id, resultPayload);
    expect(duplicate.settled).toBe(false);
    const storedRun = await RegionalUptimeRun.findById(run._id);
    const storedMonitor = await RegionalUptimeMonitor.findById(monitorId);
    expect(storedRun.toObject()).toMatchObject({ status: 'completed', httpStatus: 503, responseLatencyMs: 48, availabilitySuccess: false });
    expect(storedMonitor.toObject()).toMatchObject({ status: 'completed', scheduledRuns: 1, completedRuns: 1, spentCredits: 10, inFlightCredits: 0 });
    expect(await TaskResult.countDocuments({ taskId: task._id })).toBe(1);
    expect(await CreditTransaction.countDocuments({ taskId: task._id, type: 'credit', idempotencyKey: `task-reward:${task._id}` })).toBe(1);
    expect((await Wallet.findOne({ userId: user._id })).balance).toBe(90);
    expect(await scheduleNextRegionalUptimeRun(monitorId, new Date(Date.now() + 60_000))).toBeNull();
    const ownerHistory = await getRegionalUptimeMonitor({ monitorId, clientId: user._id });
    expect(ownerHistory.summary).toMatchObject({ measuredChecks: 1, uptimePercent: 0, averageLatencyMs: 48 });
    expect(await getRegionalUptimeMonitor({ monitorId, clientId: new mongoose.Types.ObjectId() })).toBeNull();
  });

  it('cancels queued work and returns unused budget exactly once', async () => {
    const context = await newClient();
    const { user, wallet, monitors, tasks } = context;
    const created = await createRegionalUptimeMonitor({ clientId: user._id, input: input(), idempotencyKey: 'cancel-monitor-request-1' });
    const monitorId = new mongoose.Types.ObjectId(created.monitor._id);
    monitors.push({ _id: monitorId });
    const scheduled = await scheduleNextRegionalUptimeRun(monitorId, new Date());
    tasks.push(scheduled.task);
    const cancelled = await cancelRegionalUptimeMonitor({ monitorId, clientId: user._id });
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.monitor.status).toBe('cancelled');
    expect((await TestingTask.findById(scheduled.task._id)).status).toBe('cancelled');
    expect((await RegionalUptimeRun.findById(scheduled.run._id)).status).toBe('cancelled');
    expect((await Wallet.findById(wallet._id)).balance).toBe(100);
    await cancelRegionalUptimeMonitor({ monitorId, clientId: user._id });
    expect((await Wallet.findById(wallet._id)).balance).toBe(100);
    expect(await CreditTransaction.countDocuments({ userId: user._id, idempotencyKey: { $regex: `^regional-uptime-refund:${monitorId}:` } })).toBe(1);
  });

  it('counts a no-response execution as downtime and releases its reserved run credits', async () => {
    const context = await newClient();
    const { user, wallet, monitors, tasks } = context;
    const created = await createRegionalUptimeMonitor({ clientId: user._id, input: input(), idempotencyKey: 'failed-probe-request-01' });
    const monitorId = new mongoose.Types.ObjectId(created.monitor._id);
    monitors.push({ _id: monitorId });
    const scheduled = await scheduleNextRegionalUptimeRun(monitorId, new Date());
    tasks.push(scheduled.task);
    await runTransaction(session => failRegionalUptimeRun({ task: scheduled.task, reason: 'VPN unavailable', session }));

    const measured = await getRegionalUptimeMonitor({ monitorId, clientId: user._id });
    expect(measured.summary).toMatchObject({ measuredChecks: 1, failedExecutions: 1, uptimePercent: 0 });
    expect(measured.runs[0]).toMatchObject({ status: 'failed', availabilitySuccess: false, errorReason: 'VPN unavailable' });
    expect(measured.monitor).toMatchObject({ status: 'active', availableCredits: 20, inFlightCredits: 0, spentCredits: 0 });

    await cancelRegionalUptimeMonitor({ monitorId, clientId: user._id });
    expect((await Wallet.findById(wallet._id)).balance).toBe(100);
  });
});
