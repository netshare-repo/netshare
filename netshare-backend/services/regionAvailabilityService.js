import NodeDevice from "../models/NodeDevice.js";
import { isAllocationEligible } from "./taskAllocationService.js";
import { refreshDailyBudgets } from './trafficPolicyService.js';

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
 * Returns aggregate capacity for nodes that pass the allocator's eligibility
 * checks and the owner authorization check performed when capacity is claimed.
 */
export const getRegionAvailability = async (requestedRegions = []) => {
  await refreshDailyBudgets();
  const candidates = await NodeDevice.find({
    status: "active",
    $expr: { $lt: ["$currentActiveTasks", "$maxConcurrentTasks"] },
  })
    .select(
      "userId status region bandwidthLimitMB usedBandwidthMB maxConcurrentTasks currentActiveTasks latencyMs reliabilityScore ratingCount healthScore lastSeenAt"
    )
    .populate("userId", "status isVerified role")
    .lean();

  const grouped = new Map();
  const now = Date.now();
  const regionNames = requestedRegions.length
    ? requestedRegions
    : [...new Set(candidates.map((node) => node.region).filter(Boolean))];

  for (const region of regionNames) {
    const key = normalizeRegion(region);
    if (!key) continue;
    const eligibleNodes = candidates.filter((node) => {
      const owner = node.userId;
      const ownerCanParticipate = owner && owner.status === "active" &&
        owner.isVerified === true && ["node_participant", "both"].includes(owner.role);
      return ownerCanParticipate && isAllocationEligible(node, region, now);
    });
    if (eligibleNodes.length === 0) continue;

    const current = {
      region: eligibleNodes[0].region.trim(),
      eligibleNodes: eligibleNodes.length,
      availableSlots: 0,
      latencyTotal: 0,
      latencySamples: 0,
      reliabilityTotal: 0,
      reliabilitySamples: 0,
    };

    for (const node of eligibleNodes) {
      current.availableSlots += Number(node.maxConcurrentTasks) - Number(node.currentActiveTasks);
      if (Number.isFinite(node.latencyMs) && node.latencyMs >= 0) {
        current.latencyTotal += node.latencyMs;
        current.latencySamples += 1;
      }
      // The model starts at 100; do not present that default as a measured score.
      if (Number(node.ratingCount) > 0 && Number.isFinite(node.reliabilityScore)) {
        current.reliabilityTotal += node.reliabilityScore;
        current.reliabilitySamples += 1;
      }
    }
    grouped.set(key, current);
  }

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
      averageReliability: current.reliabilitySamples > 0
        ? Number((current.reliabilityTotal / current.reliabilitySamples).toFixed(2))
        : null,
    };
  });
};

export default { DEFAULT_CLIENT_REGIONS, getRegionAvailability, normalizeRegion };
