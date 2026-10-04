/**
 * Reward Calculation Engine for NetShare Distributed Nodes
 * 
 * Target Formula:
 * Reward = Bandwidth Used (MB) * Node Quality Score * Region Factor
 * 
 * Example: 500MB * 0.95 quality * 1.2 region factor = 570 credits
 */

export const REGION_FACTORS = {
  "us-east": 1.2,
  "us-west": 1.2,
  "north america": 1.2,
  "europe": 1.15,
  "eu-central": 1.15,
  "asia-pacific": 1.1,
  "asia": 1.1,
  "latam": 1.05,
  "africa": 1.05,
  "global": 1.0,
};

export const getRegionFactor = (region) => {
  if (!region) return 1.0;
  const normalized = region.trim().toLowerCase();
  return REGION_FACTORS[normalized] || 1.0;
};

/**
 * Calculates dynamic quality score (0.5 to 1.5 multiplier, baseline ~1.0)
 * derived from reliability, success rate, and latency.
 */
export const calculateQualityScore = ({ reliabilityScore = 100, successRate = 100, latencyMs = 50 }) => {
  const normReliability = Math.max(0, Math.min(100, reliabilityScore)) / 100;
  const normSuccess = Math.max(0, Math.min(100, successRate)) / 100;

  // Latency penalty: <50ms = 1.0, 50-200ms = 0.95, >200ms = 0.85
  let latencyScore = 1.0;
  if (latencyMs <= 60) {
    latencyScore = 1.05;
  } else if (latencyMs <= 150) {
    latencyScore = 1.0;
  } else if (latencyMs <= 300) {
    latencyScore = 0.9;
  } else {
    latencyScore = 0.75;
  }

  // Composite quality score
  const quality = (0.5 * normReliability + 0.3 * normSuccess + 0.2 * latencyScore);
  // Normalize quality around 0.75 to 1.25 range
  return parseFloat(Math.max(0.1, Math.min(1.5, quality)).toFixed(3));
};

/**
 * Primary reward calculation function
 * @param {Object} params
 * @param {number} params.bandwidthUsedMB - Total bandwidth consumed during execution in MB
 * @param {number} params.nodeQualityScore - Optional override, otherwise calculated from node metrics
 * @param {Object} params.node - Node device document/object
 * @param {string} params.targetRegion - Target region string
 * @param {number} params.baseRate - Base credits per MB (defaults to 1.0)
 * @returns {Object} Calculated reward and breakdown factors
 */
export const calculateReward = ({
  bandwidthUsedMB = 1,
  node = {},
  nodeQualityScore,
  targetRegion,
  baseRate = 1.0,
}) => {
  const safeMB = Math.max(0.1, Number(bandwidthUsedMB) || 1);
  
  const qualityScore =
    typeof nodeQualityScore === "number"
      ? nodeQualityScore
      : calculateQualityScore({
          reliabilityScore: node.reliabilityScore ?? 100,
          successRate: node.successRate ?? 100,
          latencyMs: node.latencyMs ?? 50,
        });

  const region = targetRegion || node.region || "global";
  const regionFactor = getRegionFactor(region);

  const rawReward = safeMB * baseRate * qualityScore * regionFactor;
  const finalReward = Math.max(1, Math.round(rawReward));

  return {
    reward: finalReward,
    breakdown: {
      bandwidthUsedMB: safeMB,
      baseRate,
      qualityScore,
      regionFactor,
      region,
      formula: `${safeMB} MB * ${baseRate} base * ${qualityScore} quality * ${regionFactor} region = ${rawReward.toFixed(2)} -> ${finalReward} credits`,
    },
  };
};

export default {
  calculateReward,
  calculateQualityScore,
  getRegionFactor,
  REGION_FACTORS,
};
