import NodeDevice from '../models/NodeDevice.js';
export const refreshDailyBudgets = async (nodeId, now = new Date()) => {
  const day = now.toISOString().slice(0, 10);
  // Never reset beneath a running assignment. Old tasks must settle/fail first.
  await NodeDevice.updateMany({ ...(nodeId ? { _id: nodeId } : {}), currentActiveTasks: 0,
    bandwidthDay: { $lt: day } }, { $set: { bandwidthDay: day, usedBandwidthMB: 0 } });
  // Legacy records retain their spent allowance conservatively for migration day.
  await NodeDevice.updateMany({ ...(nodeId ? { _id: nodeId } : {}), bandwidthDay: { $exists: false } }, { $set: { bandwidthDay: day } });
};
export const trafficPolicyFor = node => {
  const values = [node.bandwidthLimitMB, node.usedBandwidthMB, node.uploadSpeedCapMbps, node.downloadSpeedCapMbps];
  if (!values.every(v => typeof v === 'number' && Number.isFinite(v)) || values[0] <= 0 || values[1] < 0 || values[2] <= 0 || values[3] <= 0) {
    throw new Error('Invalid participant traffic limits');
  }
  return { nodeId: String(node._id), utcDay: node.bandwidthDay,
    dailyLimitBytes: Math.floor(node.bandwidthLimitMB * 1024 * 1024),
    settledUsedBytes: Math.ceil(node.usedBandwidthMB * 1024 * 1024),
    uploadMbps: node.uploadSpeedCapMbps, downloadMbps: node.downloadSpeedCapMbps };
};
