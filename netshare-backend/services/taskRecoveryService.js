import TestingTask from '../models/TestingTask.js';
import RoutingSession from '../models/RoutingSession.js';
import { handleTaskFailure } from './secureTaskRoutingService.js';
import { enqueueTask } from './taskQueueService.js';
import logger from '../lib/logger.js';

// Mongo is the durable source of pending work, even when Redis or the process
// disappears. Never replay running HTTP traffic: expired work fails safely.
export const recoverPersistedTasks = async (now = new Date()) => {
  let failed = 0;
  for await (const task of TestingTask.find({ status: { $in: ['assigned', 'running'] } }).cursor()) {
    const route = await RoutingSession.findOne({ taskId: task._id, nodeId: task.assignedNodeId }).sort({ createdAt: -1 });
    const deadline = route ? (route.status === 'active' ?
      new Date(+route.startedAt + route.maxActiveDurationMs) : route.expiresAt) : new Date(+task.updatedAt + 60000);
    if (['failed', 'expired'].includes(route?.status) || deadline <= now) {
      await handleTaskFailure(route?._id, task._id, 'backend_recovery_timeout', 'Persisted task could not resume safely');
      failed++;
    }
  }
  let queued = 0;
  for await (const task of TestingTask.find({ status: 'pending', assignedNodeId: null }).cursor()) {
    await enqueueTask(task);
    queued++;
  }
  return { failed, queued };
};

export const startTaskRecovery = () => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await recoverPersistedTasks(); }
    catch (error) { logger.error({ err: error }, 'Persistent task recovery failed'); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 15000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
};
