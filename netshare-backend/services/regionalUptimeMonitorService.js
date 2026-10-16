import mongoose from 'mongoose';
import crypto from 'crypto';
import RegionalUptimeMonitor from '../models/RegionalUptimeMonitor.js';
import RegionalUptimeRun from '../models/RegionalUptimeRun.js';
import TestingTask from '../models/TestingTask.js';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import { addCredits, deductCredits } from './walletService.js';
import { estimateTaskPrice } from './pricingService.js';
import { validateTarget } from './targetValidationService.js';
import { DEFAULT_CLIENT_REGIONS } from './regionAvailabilityService.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import config from '../config/env.js';

export const REGIONAL_UPTIME_MONITOR = 'REGIONAL_UPTIME_MONITOR';
export const UPTIME_MONITOR_LIMITS = Object.freeze({
  minIntervalMinutes: 5,
  maxIntervalMinutes: 1440,
  maxRuns: 500,
  maxBudgetCredits: 50000,
  maxHistory: 500,
});

const fail = (message, status = 400, code = 'INVALID_UPTIME_MONITOR') =>
  Object.assign(new Error(message), { status, code });
const safeError = value => String(value || 'Execution did not complete').slice(0, 1000)
  .replace(/([?&](?:token|api[_-]?key|password|secret|credential|signature|auth)[^=]*=)[^&#\s]+/gi, '$1[redacted]')
  .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]');

export const ensureRegionalUptimeMonitorEnabled = () => {
  if (config.regionalUptimeMonitorEnabled !== true) throw fail('Regional uptime monitoring is unavailable', 404, 'SERVICE_UNAVAILABLE');
};

export const validateRegionalUptimeMonitorSubmission = input => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Invalid monitor request');
  const allowed = new Set(['targetUrl', 'targetRegion', 'expectedStatusCode', 'intervalMinutes', 'maxRuns', 'creditBudget']);
  if (Object.keys(input).some(key => !allowed.has(key))) throw fail('Unknown monitor request fields are not permitted');
  const { targetUrl, targetRegion, expectedStatusCode, intervalMinutes, maxRuns, creditBudget } = input;
  if (typeof targetUrl !== 'string' || !targetUrl.trim() || targetUrl.length > 2048) throw fail('Target URL is required and must not exceed 2048 characters');
  let parsed;
  try { parsed = new URL(targetUrl); } catch { throw fail('Target URL is malformed'); }
  if (parsed.protocol !== 'https:' || (parsed.port && parsed.port !== '443') || parsed.username || parsed.password || parsed.hash) {
    throw fail('Monitor targets must be public HTTPS URLs on port 443 without credentials or fragments');
  }
  if (typeof targetRegion !== 'string' || !targetRegion.trim() || targetRegion.trim().length > 80) throw fail('Target region must be between 1 and 80 characters');
  const region = DEFAULT_CLIENT_REGIONS.find(item => item.toLowerCase() === targetRegion.trim().toLowerCase());
  if (!region) throw fail('Target region is not supported');
  if (!Number.isInteger(expectedStatusCode) || expectedStatusCode < 100 || expectedStatusCode > 599) throw fail('Expected HTTP status must be an integer from 100 to 599');
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < UPTIME_MONITOR_LIMITS.minIntervalMinutes || intervalMinutes > UPTIME_MONITOR_LIMITS.maxIntervalMinutes) {
    throw fail(`Monitoring interval must be between ${UPTIME_MONITOR_LIMITS.minIntervalMinutes} and ${UPTIME_MONITOR_LIMITS.maxIntervalMinutes} minutes`);
  }
  if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > UPTIME_MONITOR_LIMITS.maxRuns) throw fail(`Maximum runs must be between 1 and ${UPTIME_MONITOR_LIMITS.maxRuns}`);
  if (!Number.isInteger(creditBudget) || creditBudget < 1 || creditBudget > UPTIME_MONITOR_LIMITS.maxBudgetCredits) throw fail(`Credit budget must be between 1 and ${UPTIME_MONITOR_LIMITS.maxBudgetCredits}`);
  return { targetUrl: parsed.toString(), targetRegion: region, expectedStatusCode, intervalMinutes, maxRuns, creditBudget };
};

export const validateRegionalUptimeTarget = async targetUrl => {
  const result = await validateTarget(targetUrl, { allowedPorts: [443] });
  if (!result.valid) throw fail(`Target rejected: ${result.reason}`, 400, 'TARGET_REJECTED');
  return result;
};

const publicMonitor = monitor => {
  const value = monitor.toObject ? monitor.toObject() : { ...monitor };
  delete value.__v;
  delete value.clientId;
  return value;
};

export const createRegionalUptimeMonitor = async ({ clientId, input, idempotencyKey, now = new Date() }) => {
  ensureRegionalUptimeMonitorEnabled();
  const submission = validateRegionalUptimeMonitorSubmission(input);
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey)) {
    throw fail('An Idempotency-Key header with 8 to 100 safe characters is required');
  }
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(submission)).digest('hex');
  await validateRegionalUptimeTarget(submission.targetUrl);
  const pricing = await estimateTaskPrice({ targetRegion: submission.targetRegion, executionLimit: 1 });
  const perRunCredits = pricing.quote.totalCredits;
  if (submission.creditBudget < perRunCredits) throw fail(`Credit budget must cover at least one run (${perRunCredits} credits)`);
  if (submission.creditBudget > perRunCredits * submission.maxRuns) throw fail(`Credit budget cannot exceed the maximum run cost of ${perRunCredits * submission.maxRuns} credits`);
  if (submission.creditBudget > UPTIME_MONITOR_LIMITS.maxBudgetCredits) throw fail('Credit budget exceeds the service limit');
  const monitorId = new mongoose.Types.ObjectId();

  const create = () => runTransaction(async session => {
    const prior = await RegionalUptimeMonitor.findOne({ clientId, clientRequestKey: idempotencyKey }).session(session);
    if (prior) {
      if (prior.requestHash !== requestHash) throw fail('Idempotency-Key was already used for a different monitor request', 409, 'IDEMPOTENCY_CONFLICT');
      return prior;
    }
    const owner = await User.findOne({ _id: clientId, status: 'active', isVerified: true,
      role: { $in: ['platform_client', 'both'] } }).session(session);
    if (!owner) throw fail('Account cannot create monitors', 403, 'ACCOUNT_NOT_AUTHORIZED');
    const wallet = await Wallet.findOne({ userId: clientId }).session(session);
    if (!wallet || wallet.balance < submission.creditBudget) throw fail('Insufficient credits for the approved monitor budget', 400, 'INSUFFICIENT_CREDITS');

    const [created] = await RegionalUptimeMonitor.create([{
      _id: monitorId,
      clientId,
      clientRequestKey: idempotencyKey,
      requestHash,
      ...submission,
      perRunCredits,
      availableCredits: submission.creditBudget,
      inFlightCredits: 0,
      spentCredits: 0,
      refundedCredits: 0,
      scheduledRuns: 0,
      inFlightRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      pricingSnapshot: pricing.quote,
      status: 'active',
      nextRunAt: now,
    }], { session });
    await deductCredits({ userId: clientId, taskId: monitorId, amount: submission.creditBudget,
      description: `Regional uptime monitor budget reserved (${submission.maxRuns} maximum runs)`,
      idempotencyKey: `regional-uptime-reserve:${monitorId}`, session });
    return created;
  });
  let monitor;
  try { monitor = await create(); }
  catch (error) {
    if (error.code === 11000 || error.status === 409) {
      const prior = await RegionalUptimeMonitor.findOne({ clientId, clientRequestKey: idempotencyKey });
      if (prior?.requestHash === requestHash) monitor = prior;
      else if (prior) throw fail('Idempotency-Key was already used for a different monitor request', 409, 'IDEMPOTENCY_CONFLICT');
      else throw error;
    } else throw error;
  }
  return { monitor: publicMonitor(monitor), pricePerRunCredits: monitor.perRunCredits };
};

const refundAvailableCredits = async (monitor, session, { amount = monitor.availableCredits, keySuffix = 'close' } = {}) => {
  if (!Number.isInteger(amount) || amount <= 0) return 0;
  monitor.availableCredits -= amount;
  monitor.refundedCredits += amount;
  await monitor.save({ session });
  await addCredits({ userId: monitor.clientId, taskId: monitor._id, amount,
    description: 'Unused regional uptime monitor credits returned',
    idempotencyKey: `regional-uptime-refund:${monitor._id}:${keySuffix}:${monitor.refundedCredits}`, session });
  return amount;
};

const maybeFinishMonitor = async (monitor, session) => {
  if (monitor.status === 'active' && monitor.inFlightRuns === 0) {
    if (monitor.scheduledRuns >= monitor.maxRuns) {
      monitor.status = 'completed';
      monitor.nextRunAt = null;
      monitor.terminalAt = new Date();
    } else if (monitor.availableCredits < monitor.perRunCredits) {
      monitor.status = 'budget_exhausted';
      monitor.nextRunAt = null;
      monitor.terminalAt = new Date();
    }
  }
  if (monitor.status !== 'active' && monitor.inFlightRuns === 0 && monitor.availableCredits > 0) {
    await refundAvailableCredits(monitor, session, { keySuffix: monitor.status });
  } else {
    await monitor.save({ session });
  }
};

// Atomically materializes one ordinary authorized GET task per monitor interval.
// The unique monitor/sequence index is a second guard against multi-instance races.
export const scheduleNextRegionalUptimeRun = async (monitorId, now = new Date()) => {
  ensureRegionalUptimeMonitorEnabled();
  const taskId = new mongoose.Types.ObjectId();
  return runTransaction(async session => {
    const candidate = await RegionalUptimeMonitor.findOne({
      _id: monitorId,
      status: 'active',
      nextRunAt: { $lte: now },
      inFlightRuns: 0,
      $expr: { $and: [
        { $lt: ['$scheduledRuns', '$maxRuns'] },
        { $gte: ['$availableCredits', '$perRunCredits'] },
      ] },
    }).session(session);
    if (!candidate) {
      const exhausted = await RegionalUptimeMonitor.findOneAndUpdate({
        _id: monitorId, status: 'active', nextRunAt: { $lte: now }, inFlightRuns: 0,
        $expr: { $and: [
          { $lt: ['$scheduledRuns', '$maxRuns'] },
          { $lt: ['$availableCredits', '$perRunCredits'] },
        ] },
      }, { $set: { status: 'budget_exhausted', nextRunAt: null, terminalAt: now } }, { new: true, session });
      if (exhausted?.availableCredits > 0) {
        await refundAvailableCredits(exhausted, session, { keySuffix: 'budget-exhausted' });
      }
      return null;
    }
    const monitor = await RegionalUptimeMonitor.findOneAndUpdate({
      _id: candidate._id,
      status: 'active',
      scheduledRuns: candidate.scheduledRuns,
      availableCredits: { $gte: candidate.perRunCredits },
      inFlightRuns: 0,
      nextRunAt: { $lte: now },
    }, {
      $inc: {
        scheduledRuns: 1,
        inFlightRuns: 1,
        inFlightCredits: candidate.perRunCredits,
        availableCredits: -candidate.perRunCredits,
      },
      $set: {
        nextRunAt: new Date(+now + candidate.intervalMinutes * 60_000),
        lastRunAt: now,
      },
    }, { new: true, session });
    if (!monitor) return null;

    // The conditional write and transaction ensure a concurrent scheduler
    // cannot claim the same occurrence or oversubscribe its reserved budget.
    const sequence = monitor.scheduledRuns;
    const costCredits = candidate.perRunCredits;
    const [task] = await TestingTask.create([{
      _id: taskId,
      clientId: monitor.clientId,
      targetUrl: monitor.targetUrl,
      method: 'GET',
      serviceType: 'performance_testing',
      targetRegion: monitor.targetRegion,
      executionLimit: 1,
      estimatedCost: costCredits,
      pricingSnapshot: monitor.pricingSnapshot,
      status: 'pending',
      regionalUptimeMonitorId: monitor._id,
      regionalUptimeRunCost: costCredits,
    }], { session });
    const [run] = await RegionalUptimeRun.create([{
      monitorId: monitor._id,
      sequence,
      taskId: task._id,
      region: monitor.targetRegion,
      expectedStatusCode: monitor.expectedStatusCode,
      costCredits,
      scheduledAt: now,
      status: 'queued',
    }], { session });
    task.regionalUptimeRunId = run._id;
    await task.save({ session });
    return { task, run };
  });
};

export const markRegionalUptimeRunStarted = async (task, now = new Date()) => {
  if (!task?.regionalUptimeRunId) return false;
  const result = await RegionalUptimeRun.updateOne({ _id: task.regionalUptimeRunId,
    taskId: task._id, status: 'queued' }, { $set: { status: 'running', startedAt: now } });
  return result.modifiedCount === 1;
};

export const settleRegionalUptimeRun = async ({ task, node, payload, session }) => {
  if (!task.regionalUptimeRunId) return null;
  const run = await RegionalUptimeRun.findOne({ _id: task.regionalUptimeRunId,
    taskId: task._id, monitorId: task.regionalUptimeMonitorId, status: { $in: ['queued', 'running'] } }).session(session);
  const monitor = await RegionalUptimeMonitor.findOne({ _id: task.regionalUptimeMonitorId,
    clientId: task.clientId }).session(session);
  if (!run || !monitor || monitor.inFlightRuns < 1 || monitor.inFlightCredits < run.costCredits) {
    throw fail('Monitor run binding or reserved budget is invalid', 409, 'MONITOR_RUN_BINDING');
  }
  const status = payload.statusCode;
  const hasHttpResponse = Number.isInteger(status) && status >= 100 && status <= 599;
  const expected = hasHttpResponse && status === run.expectedStatusCode;
  run.status = hasHttpResponse ? 'completed' : 'failed';
  run.httpStatus = hasHttpResponse ? status : null;
  run.responseLatencyMs = Number.isFinite(payload.latencyMs) ? payload.latencyMs : null;
  run.availabilitySuccess = hasHttpResponse ? expected : false;
  run.errorReason = hasHttpResponse
    ? (expected ? null : `Expected HTTP ${run.expectedStatusCode}; received HTTP ${status}`)
    : safeError(payload.resultData?.error || 'No valid HTTP response was received');
  run.nodeRegion = node.region || null;
  run.completedAt = new Date();
  await run.save({ session });

  monitor.inFlightRuns -= 1;
  monitor.inFlightCredits -= run.costCredits;
  if (hasHttpResponse) {
    monitor.completedRuns += 1;
    monitor.spentCredits += run.costCredits;
  } else {
    monitor.failedRuns += 1;
    if (monitor.status === 'active') monitor.availableCredits += run.costCredits;
    else {
      monitor.refundedCredits += run.costCredits;
      await addCredits({ userId: monitor.clientId, taskId: monitor._id, amount: run.costCredits,
        description: 'Unexecuted regional uptime run credits returned',
        idempotencyKey: `regional-uptime-run-refund:${run._id}`, session });
    }
  }
  monitor.lastRunAt = run.completedAt;
  await maybeFinishMonitor(monitor, session);
  return run;
};

export const failRegionalUptimeRun = async ({ task, reason, session }) => {
  if (!task?.regionalUptimeRunId) return false;
  const run = await RegionalUptimeRun.findOne({ _id: task.regionalUptimeRunId,
    taskId: task._id, monitorId: task.regionalUptimeMonitorId, status: { $in: ['queued', 'running'] } }).session(session);
  if (!run) return false;
  const monitor = await RegionalUptimeMonitor.findById(run.monitorId).session(session);
  if (!monitor || monitor.inFlightRuns < 1 || monitor.inFlightCredits < run.costCredits) return false;
  run.status = 'failed';
  run.availabilitySuccess = false;
  run.errorReason = safeError(reason);
  run.completedAt = new Date();
  await run.save({ session });
  monitor.inFlightRuns -= 1;
  monitor.inFlightCredits -= run.costCredits;
  monitor.failedRuns += 1;
  if (monitor.status === 'active') monitor.availableCredits += run.costCredits;
  else {
    monitor.refundedCredits += run.costCredits;
    await addCredits({ userId: monitor.clientId, taskId: monitor._id, amount: run.costCredits,
      description: 'Unexecuted regional uptime run credits returned',
      idempotencyKey: `regional-uptime-run-refund:${run._id}`, session });
  }
  await maybeFinishMonitor(monitor, session);
  return true;
};

const uptimeSummary = runs => {
  // A completed HTTP response or a terminal execution failure is an uptime
  // sample. Cancelled-before-dispatch records are administrative events and
  // are excluded from the denominator.
  const samples = runs.filter(run => ['completed', 'failed'].includes(run.status));
  const latency = samples.map(run => run.responseLatencyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const passed = samples.filter(run => run.availabilitySuccess === true).length;
  const bucketMap = new Map();
  for (const run of samples) {
    const date = new Date(run.completedAt || run.scheduledAt);
    const key = date.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key) || { date: key, checks: 0, successes: 0, latencyTotalMs: 0, latencySamples: 0 };
    bucket.checks += 1;
    if (run.availabilitySuccess) bucket.successes += 1;
    if (Number.isFinite(run.responseLatencyMs)) { bucket.latencyTotalMs += run.responseLatencyMs; bucket.latencySamples += 1; }
    bucketMap.set(key, bucket);
  }
  const trends = [...bucketMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map(bucket => ({
    date: bucket.date,
    checks: bucket.checks,
    uptimePercent: Number((bucket.successes / bucket.checks * 100).toFixed(2)),
    averageLatencyMs: bucket.latencySamples ? Number((bucket.latencyTotalMs / bucket.latencySamples).toFixed(2)) : null,
  }));
  return {
    measuredChecks: samples.length,
    failedExecutions: runs.filter(run => run.status === 'failed').length,
    uptimePercent: samples.length ? Number((passed / samples.length * 100).toFixed(2)) : null,
    averageLatencyMs: latency.length ? Number((latency.reduce((sum, item) => sum + item, 0) / latency.length).toFixed(2)) : null,
    p50LatencyMs: latency.length ? latency[Math.floor((latency.length - 1) * 0.5)] : null,
    p95LatencyMs: latency.length ? latency[Math.floor((latency.length - 1) * 0.95)] : null,
    trends,
  };
};

export const getRegionalUptimeMonitor = async ({ monitorId, clientId, historyLimit = 100 }) => {
  ensureRegionalUptimeMonitorEnabled();
  const monitor = await RegionalUptimeMonitor.findOne({ _id: monitorId, clientId });
  if (!monitor) return null;
  const runs = await RegionalUptimeRun.find({ monitorId }).sort({ sequence: -1 }).limit(UPTIME_MONITOR_LIMITS.maxHistory).lean();
  const limit = Math.min(UPTIME_MONITOR_LIMITS.maxHistory, Math.max(1, Number(historyLimit) || 100));
  return { monitor: publicMonitor(monitor), summary: uptimeSummary(runs), runs: runs.slice(0, limit).map(({ __v, taskId, ...run }) => run) };
};

export const listRegionalUptimeMonitors = async ({ clientId, limit = 100 }) => {
  ensureRegionalUptimeMonitorEnabled();
  const monitors = await RegionalUptimeMonitor.find({ clientId }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 100))).lean();
  return monitors.map(monitor => {
    const { __v, clientId: ownerId, ...safe } = monitor;
    return safe;
  });
};

export const cancelRegionalUptimeMonitor = async ({ monitorId, clientId }) => {
  ensureRegionalUptimeMonitorEnabled();
  return runTransaction(async session => {
    const monitor = await RegionalUptimeMonitor.findOne({ _id: monitorId, clientId }).session(session);
    if (!monitor) return null;
    if (monitor.status !== 'active') return { monitor: publicMonitor(monitor), cancelled: false };
    monitor.status = 'cancelled';
    monitor.nextRunAt = null;
    monitor.terminalAt = new Date();

    const queuedRuns = await RegionalUptimeRun.find({ monitorId, status: 'queued' }).session(session);
    for (const run of queuedRuns) {
      const task = await TestingTask.findOne({ _id: run.taskId, status: 'pending' }).session(session);
      if (!task) continue;
      task.status = 'cancelled';
      await task.save({ session });
      run.status = 'cancelled';
      run.errorReason = 'Monitor cancelled before dispatch';
      run.completedAt = new Date();
      await run.save({ session });
      monitor.inFlightRuns = Math.max(0, monitor.inFlightRuns - 1);
      monitor.inFlightCredits = Math.max(0, monitor.inFlightCredits - run.costCredits);
      monitor.availableCredits += run.costCredits;
    }
    if (monitor.inFlightRuns === 0 && monitor.availableCredits > 0) {
      await refundAvailableCredits(monitor, session, { keySuffix: 'cancel' });
    } else await monitor.save({ session });
    return { monitor: publicMonitor(monitor), cancelled: true };
  });
};

export default {
  REGIONAL_UPTIME_MONITOR, ensureRegionalUptimeMonitorEnabled,
  validateRegionalUptimeMonitorSubmission, validateRegionalUptimeTarget,
  createRegionalUptimeMonitor, scheduleNextRegionalUptimeRun, markRegionalUptimeRunStarted,
  settleRegionalUptimeRun, failRegionalUptimeRun, getRegionalUptimeMonitor,
  listRegionalUptimeMonitors, cancelRegionalUptimeMonitor,
};
