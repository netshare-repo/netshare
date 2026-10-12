import { beforeEach, describe, expect, it, vi } from "vitest";

const { findNodes, isConnected, refreshBudgets } = vi.hoisted(() => ({
  findNodes: vi.fn(),
  isConnected: vi.fn(),
  refreshBudgets: vi.fn(),
}));
let selectedFields = "";

vi.mock("../models/NodeDevice.js", () => ({ default: { find: findNodes } }));
vi.mock("../services/socketService.js", () => ({ isNodeConnected: isConnected }));
vi.mock("../services/trafficPolicyService.js", () => ({ refreshDailyBudgets: refreshBudgets }));

import { getRegionAvailability } from "../services/regionAvailabilityService.js";

const eligibleOwner = { status: "active", isVerified: true, role: "node_participant" };
const makeNode = (id, overrides = {}) => ({
  _id: { toString: () => id },
  userId: eligibleOwner,
  region: "Pakistan",
  status: "active",
  bandwidthLimitMB: 100,
  usedBandwidthMB: 25,
  maxConcurrentTasks: 3,
  currentActiveTasks: 1,
  latencyMs: 80,
  reliabilityScore: 94,
  ratingCount: 2,
  healthScore: 0.9,
  lastSeenAt: new Date(),
  ...overrides,
});

const mockCandidateQuery = (nodes) => {
  const query = {
    select: vi.fn((fields) => {
      selectedFields = fields;
      return query;
    }),
    populate: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(nodes),
  };
  findNodes.mockReturnValue(query);
};

describe("region availability allocator eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedFields = "";
    isConnected.mockReturnValue(true);
    refreshBudgets.mockResolvedValue(undefined);
  });

  it("counts only allocator-eligible, authorized, connected capacity", async () => {
    const fresh = makeNode("fresh");
    mockCandidateQuery([
      fresh,
      makeNode("unhealthy", { healthScore: 0.2 }),
      makeNode("stale", { lastSeenAt: new Date(Date.now() - 120_000) }),
      makeNode("future-heartbeat", { lastSeenAt: new Date(Date.now() + 10_000) }),
      makeNode("no-bandwidth", { usedBandwidthMB: 100 }),
      makeNode("at-capacity", { currentActiveTasks: 3 }),
      makeNode("inactive", { status: "inactive" }),
      makeNode("invalid-owner", { userId: { ...eligibleOwner, isVerified: false } }),
      makeNode("not-participating-owner", { userId: { ...eligibleOwner, role: "platform_client" } }),
      makeNode("unmatched-region", { region: "Canada" }),
    ]);
    isConnected.mockImplementation((id) => id.toString() !== "fresh-disconnected");

    const [pakistan, usa] = await getRegionAvailability(["Pakistan", "USA"]);

    expect(selectedFields.split(" ")).toContain("status");

    expect(pakistan).toMatchObject({
      region: "Pakistan",
      available: true,
      eligibleNodes: 1,
      availableSlots: 2,
      averageLatencyMs: 80,
      averageReliability: 94,
    });
    expect(usa).toMatchObject({
      region: "USA",
      available: false,
      eligibleNodes: 0,
      availableSlots: 0,
      averageLatencyMs: null,
      averageReliability: null,
    });
  });

  it("excludes disconnected nodes and does not present default telemetry as measured", async () => {
    mockCandidateQuery([
      makeNode("offline", { latencyMs: null, ratingCount: 0 }),
      makeNode("disconnected", { latencyMs: null }),
    ]);
    isConnected.mockImplementation((id) => id.toString() !== "disconnected");

    const [region] = await getRegionAvailability(["Pakistan"]);
    expect(region.eligibleNodes).toBe(1);
    expect(region.averageLatencyMs).toBeNull();
    expect(region.averageReliability).toBeNull();
  });

  it("surfaces backend query failures for the API error handler", async () => {
    const query = {
      select: vi.fn(() => query),
      populate: vi.fn(() => query),
      lean: vi.fn().mockRejectedValue(new Error("availability query failed")),
    };
    findNodes.mockReturnValue(query);

    await expect(getRegionAvailability(["Pakistan"])).rejects.toThrow("availability query failed");
  });
});
