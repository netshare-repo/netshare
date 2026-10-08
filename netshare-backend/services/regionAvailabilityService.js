import NodeDevice from "../models/NodeDevice.js";
import { isNodeConnected } from "./socketService.js";

export const DEFAULT_CLIENT_REGIONS = Object.freeze([
  "Pakistan",
  "UAE",
  "USA",
  "UK",
  "India",
]);

export const normalizeRegion = (region) => String(region || "").trim().toLowerCase();

const emptyRegion = (region) => ({
  region,
  available: false,
  eligibleNodes: 0,
  availableSlots: 0,
  averageLatencyMs: null,
  averageReliability: null,
});

/**
 * Returns nodes that can accept a task now. A node must be active, have a free
 * execution slot and remaining bandwidth, and have a live control connection.
 */
export const getRegionAvailability = async (requestedRegions = []) => {
  const candidates = await NodeDevice.find({
    status: "active",
    $expr: { $lt: ["$currentActiveTasks", "$maxConcurrentTasks"] },
  })
    .select(
      "region bandwidthLimitMB usedBandwidthMB maxConcurrentTasks currentActiveTasks latencyMs reliabilityScore"
    )
    .lean();

  const grouped = new Map();

  for (const node of candidates) {
    const bandwidthLimit = Number(node.bandwidthLimitMB || 0);
    const usedBandwidth = Number(node.usedBandwidthMB || 0);
    if (bandwidthLimit <= 0 || usedBandwidth >= bandwidthLimit) continue;
    if (!isNodeConnected(node._id)) continue;

    const key = normalizeRegion(node.region);
    if (!key) continue;

    const current = grouped.get(key) || {
      region: node.region.trim(),
      eligibleNodes: 0,
      availableSlots: 0,
      latencyTotal: 0,
      latencySamples: 0,
      reliabilityTotal: 0,
    };

    current.eligibleNodes += 1;
    current.availableSlots += Math.max(
      0,
      Number(node.maxConcurrentTasks || 1) - Number(node.currentActiveTasks || 0)
    );
    if (Number.isFinite(node.latencyMs) && node.latencyMs >= 0) {
      current.latencyTotal += node.latencyMs;
      current.latencySamples += 1;
    }
    current.reliabilityTotal += Number(node.reliabilityScore ?? 100);
    grouped.set(key, current);
  }

  const regionNames = requestedRegions.length
    ? requestedRegions
    : [...grouped.values()].map((entry) => entry.region);

  return regionNames.map((region) => {
    const current = grouped.get(normalizeRegion(region));
    if (!current) return emptyRegion(region);

    return {
      region: current.region,
      available: current.eligibleNodes > 0 && current.availableSlots > 0,
      eligibleNodes: current.eligibleNodes,
      availableSlots: current.availableSlots,
      averageLatencyMs:
        current.latencySamples > 0
          ? Math.round(current.latencyTotal / current.latencySamples)
          : null,
      averageReliability: Number(
        (current.reliabilityTotal / current.eligibleNodes).toFixed(2)
      ),
    };
  });
};

export default { DEFAULT_CLIENT_REGIONS, getRegionAvailability, normalizeRegion };
