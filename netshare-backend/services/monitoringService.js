import { detectAnomalies } from './anomalyService.js';
import { reconcileNotifications } from './notificationService.js';
import logger from '../lib/logger.js';

let running = false;
export const runMonitoring = async () => {
  if (running) return;
  running = true;
  try {
    const results = await Promise.allSettled([reconcileNotifications(), detectAnomalies()]);
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Monitoring pass incomplete; durable sources will be retried');
  }
  finally { running = false; }
};
export const startMonitoring = () => {
  const run = () => runMonitoring().catch(error => logger.error({ error: error.message }, 'Monitoring reconciliation failed; will retry'));
  void run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return timer;
};
