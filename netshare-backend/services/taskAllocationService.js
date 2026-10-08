import NodeDevice from "../models/NodeDevice.js";
import NodeTelemetry from "../models/NodeTelemetry.js";
import { isNodeConnected } from "./socketService.js";
import { HEALTH_CONFIG } from "../lib/nodeHealth.js";
import logger from "../lib/logger.js";
import config from "../config/env.js";

const MAX_HEARTBEAT_AGE_MS = HEALTH_CONFIG.LIMITS.MAX_HEARTBEAT_AGE_MS;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const normalizedRegion = (value) => String(value || "").trim().toLowerCase();

export const isAllocationEligible = (node, targetRegion, now = Date.now()) => {
  const limit = finiteOr(node.bandwidthLimitMB, 0);
  const used = finiteOr(node.usedBandwidthMB, 0);
  const activeTasks = finiteOr(node.currentActiveTasks, 0);
  const maxTasks = finiteOr(node.maxConcurrentTasks, 1);
  const seenAt = new Date(node.lastSeenAt).getTime();

  return (
    node.status === "active" &&
    normalizedRegion(targetRegion) !== "" &&
    normalizedRegion(node.region) === normalizedRegion(targetRegion) &&
    limit > 0 && used >= 0 && used < limit &&
    maxTasks > 0 && activeTasks >= 0 && activeTasks < maxTasks &&
    finiteOr(node.healthScore, 0) >= HEALTH_CONFIG.THRESHOLDS.HEALTHY &&
    Number.isFinite(seenAt) && seenAt <= now && now - seenAt <= MAX_HEARTBEAT_AGE_MS &&
    isNodeConnected(node._id)
  );
};

/** The Python ranker reads precisely these four numeric features. */
export const toMlNode = (node, telemetry = null) => ({
  id: node._id.toString(),
  latency: clamp(finiteOr(telemetry?.latency, finiteOr(node.latencyMs, 250)), 0, 2000),
  bandwidth: Math.max(0, finiteOr(node.bandwidthLimitMB, 0) - finiteOr(node.usedBandwidthMB, 0)),
  reliability: clamp(finiteOr(node.reliabilityScore, 100), 0, 100),
  successRate: clamp(finiteOr(node.successRate, 100), 0, 100),
});

export const calculateNodeScore = async (node, targetRegion, liveTelemetryMap = null) => {
  const nodeId = node._id.toString();
  const live = liveTelemetryMap?.get(nodeId);
  let liveLatency = node.latencyMs || 50;
  if (typeof live?.latency === "number" && live.latency > 0) liveLatency = live.latency;

  const heartbeatRecencySec = node.lastSeenAt
    ? Math.max(0, Math.floor((Date.now() - new Date(node.lastSeenAt).getTime()) / 1000))
    : 0;
  let heartbeatFactor = 1;
  if (heartbeatRecencySec > 40) heartbeatFactor = 0.5;
  else if (heartbeatRecencySec > 20) heartbeatFactor = 0.85;

  const baseReliability = (typeof node.reliabilityScore === "number" ? node.reliabilityScore : 100) / 100;
  const successRatio = (typeof node.successRate === "number" ? node.successRate : 100) / 100;
  const reliabilityScore = clamp((0.6 * baseReliability + 0.4 * successRatio) * heartbeatFactor, 0, 1);
  const latencyScore = Math.max(0, 1 - clamp(liveLatency / 500, 0, 1));
  const limitMB = node.bandwidthLimitMB || 2048;
  const usedMB = node.usedBandwidthMB || 0;
  const availableMB = Math.max(0, limitMB - usedMB);
  const bandwidthAvailability = limitMB > 0 ? Math.min(1, availableMB / limitMB) : 0;

  let regionMatch = 0.2;
  if (targetRegion && node.region) {
    const nodeRegion = node.region.trim().toLowerCase();
    const requestedRegion = targetRegion.trim().toLowerCase();
    if (nodeRegion === requestedRegion) regionMatch = 1;
    else if (nodeRegion === "global" || requestedRegion === "global") regionMatch = 0.7;
  } else {
    regionMatch = 0.6;
  }

  const socketConnected = isNodeConnected(node._id);
  const connectionMultiplier = socketConnected ? 1 : 0.8;
  const score = (0.4 * reliabilityScore + 0.25 * latencyScore +
    0.2 * bandwidthAvailability + 0.15 * regionMatch) * connectionMultiplier;

  return {
    nodeId: node._id,
    node,
    score: Number(score.toFixed(4)),
    socketConnected,
    metrics: {
      reliabilityScore: Number(reliabilityScore.toFixed(4)),
      latencyScore: Number(latencyScore.toFixed(4)),
      bandwidthAvailability: Number(bandwidthAvailability.toFixed(4)),
      regionMatch: Number(regionMatch.toFixed(4)),
      liveLatency,
      heartbeatRecencySec,
    },
  };
};

const validateMlResponse = (body, candidateIds) => {
  if (body?.status !== "success" || !Array.isArray(body.rankedNodes) ||
      body.count !== candidateIds.size || body.rankedNodes.length !== candidateIds.size) {
    throw new Error("ML response has invalid shape or count");
  }

  const seen = new Set();
  for (const row of body.rankedNodes) {
    if (typeof row?.id !== "string" || !candidateIds.has(row.id) || seen.has(row.id) ||
        typeof row.nodeScore !== "number" || !Number.isFinite(row.nodeScore) ||
        row.nodeScore < 0 || row.nodeScore > 1) {
      throw new Error("ML response contains unknown, duplicate, or invalid node score");
    }
    seen.add(row.id);
  }

  return [...body.rankedNodes].sort((a, b) =>
    b.nodeScore - a.nodeScore || a.id.localeCompare(b.id));
};

export const requestMlRanking = async (features, options = {}) => {
  const endpoint = new URL("rank-nodes", `${config.mlServiceUrl.replace(/\/$/, "")}/`);
  const response = await (options.fetchImpl || fetch)(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes: features }),
    signal: AbortSignal.timeout(config.mlTimeoutMs),
  });
  if (!response.ok) throw new Error(`ML service returned HTTP ${response.status}`);
  const body = await response.json();
  return validateMlResponse(body, new Set(features.map((node) => node.id)));
};

export const rankEligibleNodes = async (targetRegion, options = {}) => {
  const candidates = await NodeDevice.find({
    status: "active",
    $expr: { $lt: ["$currentActiveTasks", "$maxConcurrentTasks"] },
  });
  const now = Date.now();
  const eligible = candidates.filter((node) => isAllocationEligible(node, targetRegion, now));
  if (eligible.length === 0) return { nodes: [], source: "none" };

  const telemetry = await NodeTelemetry.aggregate([
    { $match: { nodeId: { $in: eligible.map((node) => node._id) }, timestamp: { $gte: new Date(now - MAX_HEARTBEAT_AGE_MS) } } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: "$nodeId", latency: { $first: "$latency" } } },
  ]);
  const telemetryMap = new Map(telemetry.map((row) => [row._id.toString(), row]));
  const features = eligible.map((node) => toMlNode(node, telemetryMap.get(node._id.toString())));
  const nodesById = new Map(eligible.map((node) => [node._id.toString(), node]));

  try {
    const ranked = await requestMlRanking(features, options);
    logger.info({ source: "ML", candidateCount: eligible.length, targetRegion }, "Node selection ranking used ML");
    return { nodes: ranked.map((row) => nodesById.get(row.id)), source: "ML" };
  } catch (error) {
    logger.warn({ source: "JS fallback", candidateCount: eligible.length, targetRegion, reason: error.message }, "Node selection ranking used JS fallback");
    const scored = await Promise.all(eligible.map((node) => calculateNodeScore(node, targetRegion, telemetryMap)));
    scored.sort((a, b) => b.score - a.score || a.nodeId.toString().localeCompare(b.nodeId.toString()));
    return { nodes: scored.map((entry) => entry.node), source: "JS fallback" };
  }
};

export const findAvailableNode = async (targetRegion, options = {}) => {
  const result = await rankEligibleNodes(targetRegion, options);
  return result.nodes[0] || null;
};

export const rankAllNodes = async (nodes, targetRegion) => {
  const scored = await Promise.all(nodes.map((node) => calculateNodeScore(node, targetRegion)));
  return scored.sort((a, b) => b.score - a.score);
};

export default { calculateNodeScore, findAvailableNode, rankAllNodes, rankEligibleNodes };
