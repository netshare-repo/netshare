import NodeDevice from "../models/NodeDevice.js";
import NodeTelemetry from "../models/NodeTelemetry.js";
import NodeHeartbeat from "../models/NodeHeartbeat.js";
import TaskResult from "../models/TaskResult.js";
import { isNodeConnected } from "./socketService.js";

/**
 * Normalizes and calculates a composite suitability score for a node using live telemetry.
 * 
 * Target Formula:
 * Score = (0.40 * Reliability) + (0.25 * LatencyScore) + (0.20 * BandwidthAvailability) + (0.15 * RegionMatch)
 * 
 * Live Telemetry Inputs:
 * - Current latency (from latest telemetry / heartbeat)
 * - Current bandwidth (remaining / total available)
 * - Heartbeat status (connected & last heartbeat recency)
 * - Success history & failure rate (from TaskResult history)
 * - Region match
 */
export const calculateNodeScore = async (node, targetRegion, liveTelemetryMap = null) => {
  const nodeId = node._id.toString();

  // 1. Live Telemetry Data
  let liveLatency = node.latencyMs || 50;
  let liveHeartbeatRecencySec = 0;

  if (liveTelemetryMap && liveTelemetryMap.has(nodeId)) {
    const live = liveTelemetryMap.get(nodeId);
    if (typeof live.latency === "number" && live.latency > 0) {
      liveLatency = live.latency;
    }
  }

  if (node.lastSeenAt) {
    liveHeartbeatRecencySec = Math.max(
      0,
      Math.floor((Date.now() - new Date(node.lastSeenAt).getTime()) / 1000)
    );
  }

  // 2. Reliability Score (0.0 to 1.0)
  // Combines node.reliabilityScore, successRate, and heartbeat freshness
  const baseReliability = (typeof node.reliabilityScore === "number" ? node.reliabilityScore : 100) / 100;
  const successRatio = (typeof node.successRate === "number" ? node.successRate : 100) / 100;
  
  // Heartbeat recency factor: penalize if no heartbeat received recently (>30s)
  let heartbeatFactor = 1.0;
  if (liveHeartbeatRecencySec > 40) {
    heartbeatFactor = 0.5;
  } else if (liveHeartbeatRecencySec > 20) {
    heartbeatFactor = 0.85;
  }

  const reliabilityScore = Math.max(0, Math.min(1, (0.6 * baseReliability + 0.4 * successRatio) * heartbeatFactor));

  // 3. Latency Score (Lower latency is better, normalized over 500ms max baseline)
  const normalizedLatency = Math.min(1, Math.max(0, liveLatency / 500));
  const latencyScore = Math.max(0, 1 - normalizedLatency);

  // 4. Bandwidth Availability Score (Remaining ratio 0.0 to 1.0)
  const limitMB = node.bandwidthLimitMB || 2048;
  const usedMB = node.usedBandwidthMB || 0;
  const availableMB = Math.max(0, limitMB - usedMB);
  const bandwidthAvailability = limitMB > 0 ? Math.min(1, availableMB / limitMB) : 0;

  // 5. Region Match Score (Exact match = 1.0, Global/any = 0.7, mismatch = 0.2)
  let regionMatch = 0.2;
  if (targetRegion && node.region) {
    const nodeReg = node.region.trim().toLowerCase();
    const targetReg = targetRegion.trim().toLowerCase();
    if (nodeReg === targetReg) {
      regionMatch = 1.0;
    } else if (nodeReg === "global" || targetReg === "global") {
      regionMatch = 0.7;
    }
  } else {
    regionMatch = 0.6;
  }

  // Socket Live Boost: Nodes with live Socket.IO connection receive priority
  const socketConnected = isNodeConnected(node._id);
  const connectionMultiplier = socketConnected ? 1.0 : 0.8;

  // Composite Weighted Score
  const rawComposite =
    0.40 * reliabilityScore +
    0.25 * latencyScore +
    0.20 * bandwidthAvailability +
    0.15 * regionMatch;

  const compositeScore = rawComposite * connectionMultiplier;

  return {
    nodeId: node._id,
    node,
    score: parseFloat(compositeScore.toFixed(4)),
    socketConnected,
    metrics: {
      reliabilityScore: parseFloat(reliabilityScore.toFixed(4)),
      latencyScore: parseFloat(latencyScore.toFixed(4)),
      bandwidthAvailability: parseFloat(bandwidthAvailability.toFixed(4)),
      regionMatch: parseFloat(regionMatch.toFixed(4)),
      liveLatency,
      heartbeatRecencySec: liveHeartbeatRecencySec,
    },
  };
};

/**
 * Finds the optimal node device for a task matching region and capacity constraints.
 * Uses live socket connection status and live telemetry.
 */
export const findAvailableNode = async (targetRegion) => {
  // Only active nodes eligible — busy, paused, draining, unhealthy excluded from new assignments
  const candidateNodes = await NodeDevice.find({
    status: 'active',
    $expr: {
      $lt: ["$currentActiveTasks", "$maxConcurrentTasks"],
    },
  });

  if (!candidateNodes || candidateNodes.length === 0) {
    return null;
  }

  // Filter out nodes that have completely exhausted their bandwidth
  const eligibleNodes = candidateNodes.filter((node) => {
    const limit = node.bandwidthLimitMB || 2048;
    const used = node.usedBandwidthMB || 0;
    return used < limit;
  });

  if (eligibleNodes.length === 0) {
    return null;
  }

  // Fetch recent telemetry for eligible candidates in one bulk query
  const nodeIds = eligibleNodes.map((n) => n._id);
  const recentTelemetry = await NodeTelemetry.aggregate([
    { $match: { nodeId: { $in: nodeIds } } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$nodeId",
        latency: { $first: "$latency" },
        packetLoss: { $first: "$packetLoss" },
        cpuUsage: { $first: "$cpuUsage" },
        memoryUsage: { $first: "$memoryUsage" },
      },
    },
  ]);

  const telemetryMap = new Map();
  for (const t of recentTelemetry) {
    telemetryMap.set(t._id.toString(), t);
  }

  // Score all eligible candidates asynchronously
  const scoredNodes = await Promise.all(
    eligibleNodes.map((node) => calculateNodeScore(node, targetRegion, telemetryMap))
  );

  // Prioritize connected nodes, then sort descending by composite score
  scoredNodes.sort((a, b) => {
    if (a.socketConnected && !b.socketConnected) return -1;
    if (!a.socketConnected && b.socketConnected) return 1;
    return b.score - a.score;
  });

  return scoredNodes[0].node;
};

/**
 * Scores and ranks an array of candidate nodes for ML preparation and observability.
 */
export const rankAllNodes = async (nodes, targetRegion) => {
  const scored = await Promise.all(
    nodes.map((node) => calculateNodeScore(node, targetRegion))
  );
  return scored.sort((a, b) => b.score - a.score);
};

export default {
  calculateNodeScore,
  findAvailableNode,
  rankAllNodes,
};