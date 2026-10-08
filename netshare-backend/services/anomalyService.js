import AnomalyAlert from '../models/AnomalyAlert.js';
import TestingTask from '../models/TestingTask.js';
import NodeDevice from '../models/NodeDevice.js';
import TopUpRequest from '../models/TopUpRequest.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import User from '../models/User.js';
import { notifyOnce } from './notificationService.js';

export const recordAlert = async (alert) => {
  const insert = { ...alert, createdAt: alert.createdAt || new Date(), updatedAt: new Date() };
  let result;
  try {
    result = await AnomalyAlert.findOneAndUpdate({ dedupKey: alert.dedupKey },
      { $setOnInsert: insert }, { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    result = await AnomalyAlert.findOne({ dedupKey: alert.dedupKey });
  }
  if (alert.relatedDeviceId && alert.relatedUserId) {
    await notifyOnce({ userId: alert.relatedUserId, eventKey: `warning:${result._id}`,
      type: 'node_warning', message: alert.description, relatedType: 'node', relatedId: alert.relatedDeviceId,
      createdAt: new Date(), updatedAt: new Date() });
  }
  for await (const admin of User.find({ role: 'admin', status: { $ne: 'blocked' } }).select('_id').lean().cursor()) {
    await notifyOnce({ userId: admin._id, eventKey: `alert:${result._id}`, type: 'admin_alert',
      message: `${alert.severity}: ${alert.description}`, relatedType: 'alert', relatedId: result._id,
      createdAt: new Date(), updatedAt: new Date() });
  }
  return result;
};

// Explicit monitoring rules, not ML predictions. One alert per rule/entity/UTC day.
export const detectAnomalies = async (now = new Date()) => {
  const day = now.toISOString().slice(0, 10);
  const hourAgo = new Date(now.getTime() - 3600_000);
  const tenMinutesAgo = new Date(now.getTime() - 600_000);
  const dayAgo = new Date(now.getTime() - 86400_000);
  const emit = (rule, entity, data) => recordAlert({ ...data, alertType: rule,
    dedupKey: `${rule}:${entity}:${day}`, createdAt: now, updatedAt: now });
  const groups = async (model, match, field, threshold) => model.aggregate([
    { $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { _id: { $ne: null }, count: { $gte: threshold } } },
  ]);
  for (const group of await groups(TestingTask, { status: 'failed', updatedAt: { $gte: hourAgo, $lte: now } }, 'assignedNodeId', 3)) {
    const node = await NodeDevice.findById(group._id);
    await emit('repeated_task_failures', group._id, { relatedDeviceId: group._id, relatedUserId: node?.userId,
      severity: 'high', description: 'Node has at least 3 failed tasks in the last hour.', evidence: { failures: group.count, windowMinutes: 60 } });
  }
  for await (const node of NodeDevice.find({ $or: [
    { $expr: { $gt: ['$usedBandwidthMB', '$bandwidthLimitMB'] } },
    { $expr: { $gt: ['$currentActiveTasks', '$maxConcurrentTasks'] } }, { status: 'unhealthy' },
  ] }).lean().cursor()) {
    await emit('abnormal_node', node._id, { relatedDeviceId: node._id, relatedUserId: node.userId,
      severity: 'high', description: 'Node is unhealthy or exceeds bandwidth/concurrency limits.',
      evidence: { status: node.status, usedBandwidthMB: node.usedBandwidthMB, bandwidthLimitMB: node.bandwidthLimitMB,
        currentActiveTasks: node.currentActiveTasks, maxConcurrentTasks: node.maxConcurrentTasks } });
  }
  for (const group of await groups(TestingTask, { createdAt: { $gte: tenMinutesAgo, $lte: now } }, 'clientId', 20)) {
    await emit('task_burst', group._id, { relatedUserId: group._id, severity: 'warning',
      description: 'Client submitted at least 20 tasks in 10 minutes.', evidence: { count: group.count, windowMinutes: 10 } });
  }
  for (const [name, model] of [['topup', TopUpRequest], ['withdrawal', WithdrawalRequest]]) {
    for (const group of await groups(model, { status: 'rejected', updatedAt: { $gte: dayAgo, $lte: now } }, 'userId', 3)) {
      await emit(`${name}_rejections`, group._id, { relatedUserId: group._id, severity: 'high',
        description: `User has at least 3 rejected ${name} requests in 24 hours.`, evidence: { count: group.count, windowHours: 24 } });
    }
    for (const group of await groups(model, { createdAt: { $gte: tenMinutesAgo, $lte: now } }, 'userId', 10)) {
      await emit(`${name}_burst`, group._id, { relatedUserId: group._id, severity: 'warning',
        description: `User submitted at least 10 ${name} requests in 10 minutes.`, evidence: { count: group.count, windowMinutes: 10 } });
    }
  }
};
