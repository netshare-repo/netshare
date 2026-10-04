import NodeHeartbeat from '../models/NodeHeartbeat.js';
import TaskResult from '../models/TaskResult.js';
import logger from './logger.js';

/**
 * Deterministic Node Health Model v1
 * 
 * Inputs:
 * - Heartbeat freshness (0.25)
 * - Recent task success rate (0.25)
 * - Request failure rate (0.15)
 * - Latency (0.15)
 * - Bandwidth remaining (0.10)
 * - Task saturation (0.10)
 * 
 * Output: healthScore 0.0 - 1.0
 */

export const HEALTH_CONFIG = Object.freeze({
  VERSION: 1,
  WEIGHTS: {
    heartbeatFreshness: 0.25,
    taskSuccessRate: 0.25,
    failureRate: 0.15,
    latency: 0.15,
    bandwidthRemaining: 0.10,
    taskSaturation: 0.10,
  },
  THRESHOLDS: {
    HEALTHY: 0.6,
    UNHEALTHY: 0.4,
    RECOVERY: 0.5,
    RECOVERY_CONSECUTIVE: 3,
  },
  LIMITS: {
    MAX_HEARTBEAT_AGE_MS: 60000,
    MAX_ACCEPTABLE_LATENCY_MS: 2000,
    MAX_RECENT_FAILURE_RATE: 0.5,
  },
});

/**
 * Normalize heartbeat freshness.
 * @param {Date|null} lastHeartbeatAt
 * @returns {number} 0.0 - 1.0
 */
const normalizeHeartbeatFreshness = (lastHeartbeatAt) => {
  if (!lastHeartbeatAt) return 0.0;
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  if (ageMs < 15000) return 1.0;
  if (ageMs < 30000) return 0.7;
  if (ageMs < 60000) return 0.3;
  return 0.0;
};

/**
 * Normalize latency score.
 * @param {number|null} latencyMs
 * @returns {number} 0.0 - 1.0
 */
const normalizeLatency = (latencyMs) => {
  if (latencyMs == null) return 0.5; // Unknown — neutral
  if (latencyMs < 100) return 1.0;
  if (latencyMs < 300) return 0.7;
  if (latencyMs < 1000) return 0.3;
  return 0.0;
};

/**
 * Calculate health score for a node.
 * @param {Object} node - NodeDevice document
 * @param {Object} [options] - Optional overrides for testing
 * @returns {Promise<{ healthScore: number, healthScoreVersion: number, inputs: Object, isHealthy: boolean }>}
 */
export const calculateHealthScore = async (node, options = {}) => {
  const nodeId = node._id;
  
  // 1. Heartbeat freshness
  const heartbeatFreshness = normalizeHeartbeatFreshness(node.lastSeenAt || node.lastHeartbeatAt);
  
  // 2. Recent task success rate (last 10 tasks)
  let taskSuccessRate = 1.0; // Default if no tasks
  try {
    const recentResults = await TaskResult.find({ nodeId })
      .sort({ completedAt: -1 })
      .limit(10)
      .lean();
    if (recentResults.length > 0) {
      const successes = recentResults.filter(r => r.success).length;
      taskSuccessRate = successes / recentResults.length;
    }
  } catch {
    taskSuccessRate = 0.5; // Error fetching — neutral
  }
  
  // 3. Failure rate (inverse of success)
  const failureRateNorm = 1.0 - (1.0 - taskSuccessRate);
  
  // 4. Latency
  const latencyNorm = normalizeLatency(node.latencyMs);
  
  // 5. Bandwidth remaining
  const limitBytes = (node.bandwidthLimitMB || 2048) * 1048576;
  const usedBytes = (node.totalUsedBytes || (node.usedBandwidthMB || 0) * 1048576);
  const bandwidthRemaining = limitBytes > 0 ? Math.max(0, Math.min(1, (limitBytes - usedBytes) / limitBytes)) : 0;
  
  // 6. Task saturation
  const maxTasks = node.maxConcurrentTasks || 1;
  const activeTasks = node.currentActiveTasks || 0;
  const taskSaturation = 1.0 - Math.min(1, activeTasks / maxTasks);
  
  // Weighted composite
  const w = HEALTH_CONFIG.WEIGHTS;
  const healthScore = parseFloat((
    w.heartbeatFreshness * heartbeatFreshness +
    w.taskSuccessRate * taskSuccessRate +
    w.failureRate * failureRateNorm +
    w.latency * latencyNorm +
    w.bandwidthRemaining * bandwidthRemaining +
    w.taskSaturation * taskSaturation
  ).toFixed(4));
  
  const isHealthy = healthScore >= HEALTH_CONFIG.THRESHOLDS.HEALTHY;
  
  return {
    healthScore,
    healthScoreVersion: HEALTH_CONFIG.VERSION,
    isHealthy,
    inputs: {
      heartbeatFreshness,
      taskSuccessRate,
      failureRateNorm,
      latencyNorm,
      bandwidthRemaining,
      taskSaturation,
    },
  };
};

export default { calculateHealthScore, HEALTH_CONFIG };
