import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const routeMocks = vi.hoisted(() => ({
  start: vi.fn(async () => ({ routingSessionId: "phase4-route" })),
  abort: vi.fn(async () => true),
}));

vi.mock("../services/socketService.js", () => ({
  isNodeConnected: () => true,
  getIO: () => ({ to: () => ({ emit: () => {} }) }),
}));
vi.mock("../services/secureTaskRoutingService.js", () => ({
  startAndroidSecureRouting: routeMocks.start,
  abortAndroidSecureRouting: routeMocks.abort,
}));

import NodeDevice from "../models/NodeDevice.js";
import NodeTelemetry from "../models/NodeTelemetry.js";
import TestingTask from "../models/TestingTask.js";
import TaskSession from "../models/TaskSession.js";
import { toMlNode, rankEligibleNodes } from "../services/taskAllocationService.js";
import { processTaskJob } from "../workers/taskWorker.js";

const clientId = new mongoose.Types.ObjectId();
const nodeUserId = new mongoose.Types.ObjectId();
let fastNode;
let slowNode;

const jsonResponse = (nodes) => new Response(JSON.stringify({
  status: "success",
  count: nodes.length,
  rankedNodes: nodes,
}), { status: 200, headers: { "Content-Type": "application/json" } });

const rankFastLast = async (_url, options) => {
  const rows = JSON.parse(options.body).nodes;
  return jsonResponse(rows.map((row) => ({ ...row, nodeScore: row.id === fastNode._id.toString() ? 0.9 : 0.1 })));
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/netshare_db");
  fastNode = await NodeDevice.create({
    userId: nodeUserId,
    deviceName: "test_phase4_fast",
    region: "Pakistan",
    status: "active",
    bandwidthLimitMB: 1000,
    usedBandwidthMB: 100,
    maxConcurrentTasks: 1,
    currentActiveTasks: 0,
    healthScore: 0.9,
    latencyMs: 35,
    reliabilityScore: 97,
    successRate: 96,
    lastSeenAt: new Date(),
  });
  slowNode = await NodeDevice.create({
    userId: nodeUserId,
    deviceName: "test_phase4_slow",
    region: "Pakistan",
    status: "active",
    bandwidthLimitMB: 1000,
    usedBandwidthMB: 900,
    maxConcurrentTasks: 1,
    currentActiveTasks: 0,
    healthScore: 0.8,
    latencyMs: 400,
    reliabilityScore: 70,
    successRate: 75,
    lastSeenAt: new Date(),
  });
});

beforeEach(async () => {
  routeMocks.start.mockClear();
  await NodeDevice.updateMany(
    { deviceName: { $regex: /^test_phase4_/ } },
    { $set: { status: "active", currentActiveTasks: 0, lastSeenAt: new Date() } }
  );
});

afterAll(async () => {
  const ids = [fastNode?._id, slowNode?._id].filter(Boolean);
  await TaskSession.deleteMany({ clientId });
  await TestingTask.deleteMany({ clientId });
  await NodeTelemetry.deleteMany({ nodeId: { $in: ids } });
  await NodeDevice.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});

describe("Phase 4 ML ranking", () => {
  it("sends the exact Python input keys and ranks eligible nodes by ML score", async () => {
    let sent;
    const fetchImpl = async (_url, options) => {
      sent = JSON.parse(options.body).nodes;
      return jsonResponse(sent.map((row) => ({
        ...row,
        nodeScore: row.id === slowNode._id.toString() ? 0.95 : 0.2,
      })));
    };
    const ranked = await rankEligibleNodes("Pakistan", { fetchImpl });
    expect(ranked.source).toBe("ML");
    expect(ranked.nodes[0]._id.toString()).toBe(slowNode._id.toString());
    expect(Object.keys(sent[0])).toEqual(["id", "latency", "bandwidth", "reliability", "successRate"]);
    expect(sent.find((row) => row.id === fastNode._id.toString())).toEqual({
      id: fastNode._id.toString(),
      latency: 35,
      bandwidth: 900,
      reliability: 97,
      successRate: 96,
    });
  });

  it("maps fresh telemetry latency and remaining quota without changing model schema", async () => {
    const mapped = toMlNode(fastNode, { latency: 18 });
    expect(mapped.latency).toBe(18);
    expect(mapped.bandwidth).toBe(900);
    expect(Object.keys(mapped)).toHaveLength(5);
  });

  it("falls back to JS on timeout", async () => {
    const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
    const ranked = await rankEligibleNodes("Pakistan", { fetchImpl });
    expect(ranked.source).toBe("JS fallback");
    expect(ranked.nodes[0]._id.toString()).toBe(fastNode._id.toString());
  });

  it("falls back to JS when ML is unavailable", async () => {
    const ranked = await rankEligibleNodes("Pakistan", {
      fetchImpl: async () => { throw new Error("connection refused"); },
    });
    expect(ranked.source).toBe("JS fallback");
    expect(ranked.nodes[0]._id.toString()).toBe(fastNode._id.toString());
  });

  it("rejects malformed, unknown, duplicate, and nonfinite ML rows", async () => {
    const invalidBodies = [
      { status: "success", count: 1, rankedNodes: [] },
      { status: "success", count: 2, rankedNodes: [
        { id: "unapproved", nodeScore: 1 },
        { id: fastNode._id.toString(), nodeScore: 0.5 },
      ] },
      { status: "success", count: 2, rankedNodes: [
        { id: fastNode._id.toString(), nodeScore: 0.5 },
        { id: fastNode._id.toString(), nodeScore: 0.4 },
      ] },
      { status: "success", count: 2, rankedNodes: [
        { id: fastNode._id.toString(), nodeScore: "NaN" },
        { id: slowNode._id.toString(), nodeScore: 0.4 },
      ] },
    ];
    for (const body of invalidBodies) {
      const ranked = await rankEligibleNodes("Pakistan", {
        fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }),
      });
      expect(ranked.source).toBe("JS fallback");
      expect(ranked.nodes[0]._id.toString()).toBe(fastNode._id.toString());
    }
  });

  it("never sends an ineligible node to ML or selects it during fallback", async () => {
    await NodeDevice.findByIdAndUpdate(slowNode._id, { healthScore: 0.2 });
    let sent;
    const ranked = await rankEligibleNodes("Pakistan", {
      fetchImpl: async (_url, options) => {
        sent = JSON.parse(options.body).nodes;
        return jsonResponse([{ id: slowNode._id.toString(), nodeScore: 1 }]);
      },
    });
    expect(sent.map((row) => row.id)).toEqual([fastNode._id.toString()]);
    expect(ranked.source).toBe("JS fallback");
    expect(ranked.nodes.map((node) => node._id.toString())).toEqual([fastNode._id.toString()]);
    await NodeDevice.findByIdAndUpdate(slowNode._id, { healthScore: 0.8 });
  });

  it("excludes wrong region, stale, full, exhausted, paused, and unhealthy nodes", async () => {
    const cases = [
      { region: "UAE" },
      { lastSeenAt: new Date(Date.now() - 120000) },
      { currentActiveTasks: 1 },
      { usedBandwidthMB: 1000 },
      { status: "paused" },
      { healthScore: 0.2 },
    ];
    for (const update of cases) {
      await NodeDevice.findByIdAndUpdate(slowNode._id, update);
      const ranked = await rankEligibleNodes("Pakistan", { fetchImpl: async (_url, options) => {
        const sent = JSON.parse(options.body).nodes;
        expect(sent.map((row) => row.id)).toEqual([fastNode._id.toString()]);
        return jsonResponse([{ id: fastNode._id.toString(), nodeScore: 0.5 }]);
      } });
      expect(ranked.nodes.map((node) => node._id.toString())).toEqual([fastNode._id.toString()]);
      await NodeDevice.findByIdAndUpdate(slowNode._id, {
        region: "Pakistan", lastSeenAt: new Date(), currentActiveTasks: 0,
        usedBandwidthMB: 900, status: "active", healthScore: 0.8,
      });
    }
  });

  it("claims a pending task once across duplicate worker jobs", async () => {
    const task = await TestingTask.create({
      clientId,
      targetUrl: "https://example.com",
      serviceType: "accessibility_testing",
      targetRegion: "Pakistan",
      executionLimit: 1,
      estimatedCost: 10,
      status: "pending",
    });
    const oldFetch = globalThis.fetch;
    globalThis.fetch = rankFastLast;
    try {
      const job = { data: { taskId: task._id.toString(), targetRegion: "Pakistan" } };
      const outcomes = await Promise.allSettled([processTaskJob(job), processTaskJob(job)]);
      expect(outcomes.some((item) => item.status === "fulfilled" && item.value.dispatched)).toBe(true);
      expect(routeMocks.start).toHaveBeenCalledTimes(1);
      const storedTask = await TestingTask.findById(task._id);
      expect(storedTask.status).toBe("assigned");
      expect((await NodeDevice.findById(fastNode._id)).currentActiveTasks).toBe(1);
      expect(await TaskSession.countDocuments({ taskId: task._id })).toBe(1);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it("does not double assign when ML fails and duplicate jobs use JS fallback", async () => {
    const task = await TestingTask.create({
      clientId,
      targetUrl: "https://example.org",
      serviceType: "accessibility_testing",
      targetRegion: "Pakistan",
      executionLimit: 1,
      estimatedCost: 10,
      status: "pending",
    });
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("ML offline"); };
    try {
      const job = { data: { taskId: task._id.toString(), targetRegion: "Pakistan" } };
      await Promise.allSettled([processTaskJob(job), processTaskJob(job)]);
      expect(routeMocks.start).toHaveBeenCalledTimes(1);
      expect((await TestingTask.findById(task._id)).status).toBe("assigned");
      expect((await NodeDevice.findById(fastNode._id)).currentActiveTasks).toBe(1);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});
