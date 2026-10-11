import TestingTask from '../models/TestingTask.js';
import NodeDevice from '../models/NodeDevice.js';
import RoutingSession from '../models/RoutingSession.js';
import User from '../models/User.js';
import { refreshDailyBudgets } from './trafficPolicyService.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { HEALTH_CONFIG } from '../lib/nodeHealth.js';

// The task claim and capacity reservation must survive/roll back together.
export const claimTaskOnNode = async (taskId, nodeId, region) => {
  await refreshDailyBudgets(nodeId);
  try {
    return await runTransaction(async session => {
      const task = await TestingTask.findOneAndUpdate({ _id: taskId, status: 'pending', assignedNodeId: null },
        { $set: { status: 'assigned', assignedNodeId: nodeId } }, { new: true, session });
      if (!task) return null;
      const node = await NodeDevice.findOneAndUpdate({ _id: nodeId, status: 'active',
        region: { $regex: `^${String(region).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        healthScore: { $gte: HEALTH_CONFIG.THRESHOLDS.HEALTHY },
        lastSeenAt: { $gte: new Date(Date.now() - HEALTH_CONFIG.LIMITS.MAX_HEARTBEAT_AGE_MS), $lte: new Date() },
        $expr: { $and: [ { $lt: ['$currentActiveTasks', '$maxConcurrentTasks'] },
          { $lt: ['$usedBandwidthMB', '$bandwidthLimitMB'] } ] },
      }, [{ $set: { currentActiveTasks: { $add: ['$currentActiveTasks', 1] },
        status: { $cond: [{ $gte: [{ $add: ['$currentActiveTasks', 1] }, '$maxConcurrentTasks'] }, 'busy', 'active'] } } }],
      { new: true, session });
      if (!node) throw Object.assign(new Error('Node capacity unavailable'), { code: 'NO_CAPACITY' });
      const owner = await User.findOneAndUpdate({ _id: node.userId, status: 'active', isVerified: true,
        role: { $in: ['node_participant', 'both'] } }, { $inc: { authorizationVersion: 1 } }, { session });
      if (!owner) throw Object.assign(new Error('Node owner not authorized'), { code: 'NO_CAPACITY' });
      return { task, node };
    });
  } catch (error) {
    if (error.code === 'NO_CAPACITY') return null;
    throw error;
  }
};

// Only an unstarted, identity-bound assignment may be retried. Release the
// task, route and capacity together, so a crash cannot orphan a reservation.
export const releaseUnstartedAssignment = (taskId, nodeId, routeId) => runTransaction(async session => {
  const route = await RoutingSession.findOne({ _id: routeId, taskId, nodeId,
    status: { $in: ['created', 'negotiating'] } }).session(session);
  if (!route) return null;
  const task = await TestingTask.findOneAndUpdate({ _id: taskId, assignedNodeId: nodeId, status: 'assigned' },
    { $set: { status: 'pending', assignedNodeId: null } }, { new: true, session });
  if (!task) return null;
  await RoutingSession.updateOne({ _id: routeId }, { $set: { status: 'failed', endedAt: new Date(),
    closeReason: 'dc_open_timeout', failureDetail: 'Assignment did not start before deadline' },
    $push: { stateHistory: { from: route.status, to: 'failed', reason: 'assignment_timeout', timestamp: new Date() } } }, { session });
  await NodeDevice.updateOne({ _id: nodeId }, [{ $set: {
    currentActiveTasks: { $max: [0, { $subtract: ['$currentActiveTasks', 1] }] },
    status: { $cond: [{ $in: ['$status', ['active', 'busy']] },
      { $cond: [{ $gte: [{ $subtract: ['$currentActiveTasks', 1] }, '$maxConcurrentTasks'] }, 'busy', 'active'] }, '$status'] },
  } }], { session });
  return task;
});
