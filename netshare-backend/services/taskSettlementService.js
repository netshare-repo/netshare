import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import TaskSession from '../models/TaskSession.js';
import RoutingSession from '../models/RoutingSession.js';
import NodeDevice from '../models/NodeDevice.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import ParticipationSession from '../models/ParticipationSession.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { addCredits } from './walletService.js';
import { calculateReward } from './rewardService.js';
import { closePeer } from './webrtcPeerService.js';
import config from '../config/env.js';
import { recordAlert } from './anomalyService.js';
import logger from '../lib/logger.js';

const invalid = (message, code = 'INVALID_RESULT') => Object.assign(new Error(message), { code });

// Every persisted effect commits together. A crash cannot leave a result without
// its reward, or a reward without its result. Mongo retries write conflicts.
export const settleTaskResult = async (routingSessionId, payload) => {
  if (!payload?.taskId || !routingSessionId) throw invalid('Task and routing session are required', 'SESSION_REQUIRED');
  if (typeof payload.success !== 'boolean') throw invalid('Explicit success is required');
  const bandwidth = payload.bandwidthUsedMB ?? payload.downloadBandwidthMB;
  const latency = payload.latencyMs;
  const upload = payload.uploadBandwidthMB ?? 0;
  const successRate = payload.successRate ?? (payload.success ? 100 : 0);
  const packetLoss = payload.packetLoss ?? null;
  const statusCode = payload.statusCode;
  for (const [name, value, max] of [['bandwidth', bandwidth, 1024], ['latency', latency, 300000],
    ['upload', upload, 1024], ['successRate', successRate, 100], ['packetLoss', packetLoss, 100],
    ['statusCode', statusCode, 599]]) {
    if (name === 'packetLoss' && value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw invalid(`Invalid ${name}`);
  }
  if (!Number.isInteger(statusCode) || (payload.success && (statusCode < 200 || statusCode >= 400))) {
    throw invalid('Successful result must contain a successful HTTP status');
  }

  let outcome;
  try { outcome = await runTransaction(async transaction => {
    const task = await TestingTask.findById(payload.taskId).session(transaction);
    if (!task) throw invalid('Task not found', 'TASK_NOT_FOUND');
    const route = await RoutingSession.findById(routingSessionId).session(transaction);
    if (!route) throw invalid('RoutingSession not found', 'SESSION_NOT_FOUND');
    if (String(route.taskId) !== String(task._id) || String(route.clientId) !== String(task.clientId) ||
      !task.assignedNodeId || String(route.nodeId) !== String(task.assignedNodeId)) {
      throw invalid('Task result does not match RoutingSession identity bindings', 'BINDING_MISMATCH');
    }
    const existing = await TaskResult.findOne({ taskId: task._id }).session(transaction);
    if (existing) return { taskResult: existing, settled: false };
    if (!['assigned', 'running'].includes(task.status) || ['failed', 'expired', 'completed'].includes(route.status) ||
      route.expiresAt <= new Date() || (config.isProduction && route.status !== 'active')) {
      throw invalid('Task route is not active', 'INACTIVE_ROUTE');
    }
    const node = await NodeDevice.findById(route.nodeId).session(transaction);
    if (!node) throw invalid('Node not found', 'NODE_NOT_FOUND');
    if (bandwidth + upload > Math.max(0, node.bandwidthLimitMB - node.usedBandwidthMB)) throw invalid('Bandwidth limit exceeded');

    const [result] = await TaskResult.create([{
      taskId: task._id, clientId: task.clientId, nodeId: node._id, nodeUserId: node.userId,
      serviceType: task.serviceType, targetUrl: task.targetUrl, success: payload.success,
      successRate, latencyMs: latency, packetLoss, bandwidthUsedMB: bandwidth,
      statusCode, resultData: payload.resultData ?? {}, completedAt: new Date(),
    }], { session: transaction });
    let reward = 0;
    if (payload.success) {
      reward = Math.max(1, calculateReward({ bandwidthUsedMB: bandwidth, node, targetRegion: task.targetRegion }).reward);
      await addCredits({ userId: node.userId, taskId: task._id, amount: reward,
        description: `Secure task reward: ${task._id}`, idempotencyKey: `task-reward:${task._id}`,
        withdrawable: true, session: transaction });
    }
    await BandwidthUsage.create([{ nodeId: node._id, taskId: task._id, sessionId: String(route._id),
      uploadBandwidthMB: upload, downloadBandwidthMB: bandwidth, totalBandwidthMB: upload + bandwidth,
      networkAvailability: 'available', timestamp: new Date() }], { session: transaction });
    task.status = payload.success ? 'settled' : 'failed';
    task.resultSummary = { successRate, averageResponseTimeMs: latency, bandwidthConsumedMB: bandwidth,
      message: payload.success ? `Secure task completed. Reward: ${reward} credits.` : (payload.resultData?.error || 'Secure task failed') };
    await task.save({ session: transaction });
    await TaskSession.updateOne({ taskId: task._id }, { $set: { status: payload.success ? 'completed' : 'failed',
      bandwidthUsedMB: bandwidth, latencyMs: latency }, $push: { logs: { message: task.resultSummary.message } } }, { session: transaction });
    const previousState = route.status;
    route.status = payload.success ? 'completed' : 'failed';
    route.endedAt = new Date();
    route.closeReason = payload.success ? 'task_completed' : 'task_failed';
    route.stateHistory.push({ from: previousState, to: route.status, reason: task.resultSummary.message, timestamp: new Date() });
    await route.save({ session: transaction });
    node.usedBandwidthMB += bandwidth + upload;
    node.currentActiveTasks = Math.max(0, node.currentActiveTasks - 1);
    // Never resurrect a disconnected, disabled or blocked node.
    if (['active', 'busy'].includes(node.status)) node.status = node.currentActiveTasks >= node.maxConcurrentTasks ? 'busy' : 'active';
    await node.save({ session: transaction });
    await ParticipationSession.updateOne({ deviceId: node._id, status: 'active' }, {
      $inc: { bandwidthUsed: bandwidth + upload, bandwidthUsedMB: bandwidth + upload, creditsEarned: reward },
      $set: { latency, packetLoss, activeTasksCount: node.currentActiveTasks },
    }, { session: transaction });
    return { taskResult: result, settled: payload.success };
  }); } catch (error) {
    if (!error.code || error.status === 503 || error.status === 409) {
      await recordAlert({ dedupKey: `settlement-review:${payload.taskId}`, alertType: 'settlement_failure',
        relatedTaskId: payload.taskId, severity: 'high', description: 'Secure task settlement failed; administrative review required.',
        evidence: { taskId: String(payload.taskId), routingSessionId: String(routingSessionId), financialEffects: 'rolled_back' },
      }).catch(alertError => logger.error({ err: alertError, taskId: payload.taskId }, 'Settlement review alert could not be persisted'));
    }
    throw error;
  }
  closePeer(String(routingSessionId), 'task_result_committed');
  return outcome;
};
