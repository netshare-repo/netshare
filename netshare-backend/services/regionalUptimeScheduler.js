import RegionalUptimeMonitor from '../models/RegionalUptimeMonitor.js';
import RegionalUptimeRun from '../models/RegionalUptimeRun.js';
import TestingTask from '../models/TestingTask.js';
import config from '../config/env.js';
import logger from '../lib/logger.js';
import { enqueueTask } from './taskQueueService.js';
import { scheduleNextRegionalUptimeRun } from './regionalUptimeMonitorService.js';

const BATCH_SIZE = 25;
const RECONCILE_LIMIT = 100;
let schedulerTimer = null;

export const runRegionalUptimeSchedulerTick = async (now = new Date()) => {
  if (config.regionalUptimeMonitorEnabled !== true) return { scheduled: 0, enqueued: 0 };
  let scheduled = 0;
  let enqueued = 0;
  const enqueuedTaskIds = new Set();
  const due = await RegionalUptimeMonitor.find({ status: 'active', nextRunAt: { $lte: now }, inFlightRuns: 0 })
    .sort({ nextRunAt: 1 }).limit(BATCH_SIZE).select('_id').lean();
  for (const candidate of due) {
    try {
      const claimed = await scheduleNextRegionalUptimeRun(candidate._id, now);
      if (!claimed) continue;
      scheduled += 1;
      await enqueueTask(claimed.task);
      enqueued += 1;
      enqueuedTaskIds.add(String(claimed.task._id));
    } catch (error) {
      logger.error({ err: error, monitorId: String(candidate._id) }, 'Regional uptime run scheduling failed');
    }
  }

  // Mongo is the durable schedule/outbox. If the process exits after the
  // transaction but before queue insertion, the next tick safely re-enqueues
  // the same task ID; allocation claims remain the final execution guard.
  const queuedRuns = await RegionalUptimeRun.find({ status: 'queued' })
    .sort({ scheduledAt: 1 }).limit(RECONCILE_LIMIT).select('taskId').lean();
  for (const run of queuedRuns) {
    if (enqueuedTaskIds.has(String(run.taskId))) continue;
    const task = await TestingTask.findOne({ _id: run.taskId, status: 'pending', assignedNodeId: null });
    if (!task) continue;
    try { await enqueueTask(task); enqueued += 1; }
    catch (error) { logger.warn({ err: error, taskId: String(task._id) }, 'Queued regional uptime run remains pending'); }
  }
  return { scheduled, enqueued };
};

export const startRegionalUptimeScheduler = () => {
  if (config.regionalUptimeMonitorEnabled !== true) {
    logger.info('Regional uptime scheduler remains disabled by feature flag');
    return () => {};
  }
  let running = false;
  const tick = async () => {
    if (running || config.regionalUptimeMonitorEnabled !== true) return;
    running = true;
    try { await runRegionalUptimeSchedulerTick(); }
    catch (error) { logger.error({ err: error }, 'Regional uptime scheduler tick failed'); }
    finally { running = false; }
  };
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = setInterval(tick, config.regionalUptimeMonitorSchedulerIntervalMs);
  schedulerTimer.unref?.();
  void tick();
  return stopRegionalUptimeScheduler;
};

export const stopRegionalUptimeScheduler = () => {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
};

export default { runRegionalUptimeSchedulerTick, startRegionalUptimeScheduler, stopRegionalUptimeScheduler };
