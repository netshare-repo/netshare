import TestingTask from "../models/TestingTask.js";
import {
  getRegionAvailability,
  normalizeRegion,
} from "./regionAvailabilityService.js";

export const PRICING_VERSION = "rule-v1";

export const PRICING_CONFIG = Object.freeze({
  baseCreditsPerExecution: 8,
  regionMultipliers: Object.freeze({
    pakistan: 1,
    india: 0.98,
    uae: 1.15,
    usa: 1.2,
    uk: 1.18,
  }),
  defaultRegionMultiplier: 1.1,
});

const round = (value, digits = 3) => Number(value.toFixed(digits));
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

export const calculatePrice = ({
  executionLimit,
  region,
  availability,
  activeDemand,
}) => {
  const limit = Number(executionLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Execution limit must be an integer between 1 and 100");
  }

  const availableNodes = Number(availability?.eligibleNodes || 0);
  const availableSlots = Number(availability?.availableSlots || 0);
  const averageReliability = clamp(
    Number(availability?.averageReliability ?? 80),
    0,
    100
  );
  const averageLatencyMs = Math.max(
    0,
    Number(availability?.averageLatencyMs ?? 250)
  );

  const availabilityMultiplier =
    availableNodes === 0
      ? 1.5
      : availableNodes === 1
        ? 1.35
        : availableNodes <= 3
          ? 1.2
          : availableNodes <= 7
            ? 1.05
            : 0.95;

  const demandRatio =
    availableSlots > 0
      ? Number(activeDemand || 0) / availableSlots
      : Number(activeDemand || 0) + 1;
  const demandMultiplier = 1 + clamp(demandRatio * 0.25, 0, 0.5);

  // Better, more dependable nodes command a small, bounded quality premium.
  const latencyQuality = 1 - clamp(averageLatencyMs / 1000, 0, 1);
  const qualityMultiplier =
    0.9 + 0.1 * (averageReliability / 100) + 0.1 * latencyQuality;
  const regionMultiplier =
    PRICING_CONFIG.regionMultipliers[normalizeRegion(region)] ??
    PRICING_CONFIG.defaultRegionMultiplier;

  const rawPerExecution =
    PRICING_CONFIG.baseCreditsPerExecution *
    availabilityMultiplier *
    demandMultiplier *
    qualityMultiplier *
    regionMultiplier;
  const totalCredits = Math.max(1, Math.ceil(rawPerExecution * limit));

  return {
    version: PRICING_VERSION,
    currency: "credits",
    totalCredits,
    executionLimit: limit,
    perExecutionCredits: round(totalCredits / limit, 2),
    formula:
      "ceil(base × executions × availability × demand × quality × region)",
    factors: {
      baseCreditsPerExecution: PRICING_CONFIG.baseCreditsPerExecution,
      availabilityMultiplier: round(availabilityMultiplier),
      demandMultiplier: round(demandMultiplier),
      qualityMultiplier: round(qualityMultiplier),
      regionMultiplier: round(regionMultiplier),
      eligibleNodes: availableNodes,
      availableSlots,
      activeDemand: Number(activeDemand || 0),
      averageLatencyMs:
        availability?.averageLatencyMs === null ||
        availability?.averageLatencyMs === undefined
          ? null
          : averageLatencyMs,
      averageReliability:
        availability?.averageReliability === null ||
        availability?.averageReliability === undefined
          ? null
          : averageReliability,
    },
  };
};

export const estimateTaskPrice = async ({ targetRegion, executionLimit }) => {
  const [availability] = await getRegionAvailability([targetRegion]);
  const escapedRegion = String(targetRegion).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const activeDemand = await TestingTask.countDocuments({
    targetRegion: { $regex: `^${escapedRegion}$`, $options: "i" },
    status: { $in: ["pending", "assigned", "running"] },
  });

  return {
    availability,
    quote: calculatePrice({
      executionLimit,
      region: targetRegion,
      availability,
      activeDemand,
    }),
  };
};

export default { calculatePrice, estimateTaskPrice, PRICING_CONFIG, PRICING_VERSION };
