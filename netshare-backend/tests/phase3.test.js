import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";

import { app } from "../server.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import NodeDevice from "../models/NodeDevice.js";
import TestingTask from "../models/TestingTask.js";
import TaskResult from "../models/TaskResult.js";
import CreditTransaction from "../models/CreditTransaction.js";
import generateToken from "../utils/generateToken.js";
import { calculatePrice } from "../services/pricingService.js";

let owner;
let otherClient;
let nodeUser;
let node;
let settledTask;
let pendingTask;
let ownerToken;
let otherToken;

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await User.deleteMany({ email: { $regex: /^test_phase3_/ } });

  owner = await User.create({
    name: "Phase 3 Owner",
    email: "test_phase3_owner@test.io",
    password: "hashed-password",
    role: "platform_client",
    isVerified: true,
  });
  otherClient = await User.create({
    name: "Phase 3 Other",
    email: "test_phase3_other@test.io",
    password: "hashed-password",
    role: "platform_client",
    isVerified: true,
  });
  nodeUser = await User.create({
    name: "Phase 3 Node",
    email: "test_phase3_node@test.io",
    password: "hashed-password",
    role: "node_participant",
    isVerified: true,
  });
  ownerToken = generateToken(owner._id);
  otherToken = generateToken(otherClient._id);

  await Wallet.create({ userId: owner._id, balance: 5000 });
  await Wallet.create({ userId: otherClient._id, balance: 5000 });
  await Wallet.create({ userId: nodeUser._id, balance: 0 });

  node = await NodeDevice.create({
    userId: nodeUser._id,
    deviceName: "test_phase3_node",
    region: "Pakistan",
    status: "active",
    bandwidthLimitMB: 1000,
    usedBandwidthMB: 0,
    maxConcurrentTasks: 2,
    currentActiveTasks: 0,
    reliabilityScore: 90,
    latencyMs: 80,
  });

  settledTask = await TestingTask.create({
    clientId: owner._id,
    targetUrl: "https://example.com",
    serviceType: "accessibility_testing",
    targetRegion: "Pakistan",
    executionLimit: 2,
    estimatedCost: 24,
    pricingSnapshot: { version: "rule-v1" },
    assignedNodeId: node._id,
    status: "settled",
  });
  await TaskResult.create({
    taskId: settledTask._id,
    nodeId: node._id,
    clientId: owner._id,
    nodeUserId: nodeUser._id,
    serviceType: settledTask.serviceType,
    targetUrl: settledTask.targetUrl,
    success: true,
    successRate: 100,
    latencyMs: 80,
    packetLoss: 0,
    bandwidthUsedMB: 1.5,
    statusCode: 200,
  });

  pendingTask = await TestingTask.create({
    clientId: owner._id,
    targetUrl: "https://example.org",
    serviceType: "performance_testing",
    targetRegion: "Pakistan",
    executionLimit: 1,
    estimatedCost: 12,
    assignedNodeId: node._id,
    status: "pending",
  });
});

afterAll(async () => {
  const userIds = [owner?._id, otherClient?._id, nodeUser?._id].filter(Boolean);
  await TaskResult.deleteMany({ clientId: { $in: userIds } });
  await TestingTask.deleteMany({ clientId: { $in: userIds } });
  await CreditTransaction.deleteMany({ userId: { $in: userIds } });
  await NodeDevice.deleteMany({ deviceName: "test_phase3_node" });
  await Wallet.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ email: { $regex: /^test_phase3_/ } });
  await mongoose.connection.close();
});

describe("Phase 3: deterministic pricing and availability", () => {
  it("calculates the same explainable price for identical inputs", () => {
    const input = {
      executionLimit: 10,
      region: "Pakistan",
      availability: {
        eligibleNodes: 2,
        availableSlots: 3,
        averageReliability: 92,
        averageLatencyMs: 70,
      },
      activeDemand: 4,
    };
    const first = calculatePrice(input);
    const second = calculatePrice(input);
    expect(first).toEqual(second);
    expect(first.version).toBe("rule-v1");
    expect(first.factors.availabilityMultiplier).toBeDefined();
    expect(first.factors.demandMultiplier).toBeDefined();
    expect(first.factors.qualityMultiplier).toBeDefined();
    expect(first.factors.regionMultiplier).toBeDefined();
  });

  it("rejects invalid execution limits", () => {
    expect(() =>
      calculatePrice({
        executionLimit: 1.5,
        region: "Pakistan",
        availability: {},
        activeDemand: 0,
      })
    ).toThrow(/integer between 1 and 100/);
  });

  it("returns a server quote and live availability shape to a client", async () => {
    const quote = await request(app)
      .post("/api/tasks/estimate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ targetRegion: "Pakistan", executionLimit: 5 })
      .expect(200);

    expect(quote.body.quote.totalCredits).toBeGreaterThan(0);
    expect(quote.body.quote.formula).toContain("availability");
    expect(quote.body.availability.region).toBe("Pakistan");

    const availability = await request(app)
      .get("/api/node/availability?regions=Pakistan,UAE")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(availability.body.regions).toHaveLength(2);
    expect(availability.body.regions[0]).toHaveProperty("eligibleNodes");
    expect(availability.body.eligibility).toContain("connected");
  });

  it("protects availability and validates estimate input", async () => {
    await request(app).get("/api/node/availability").expect(401);
    await request(app)
      .post("/api/tasks/estimate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ targetRegion: "Pakistan", executionLimit: 101 })
      .expect(400);
  });

  it("validates task protocol, service type, and integer limits", async () => {
    const base = {
      targetUrl: "https://example.net",
      serviceType: "accessibility_testing",
      targetRegion: "Pakistan",
      executionLimit: 2,
    };
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...base, targetUrl: "ftp://example.net" })
      .expect(400);
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...base, serviceType: "open_proxy" })
      .expect(400);
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...base, executionLimit: 1.5 })
      .expect(400);
  });

  it("recalculates and persists the platform quote at submission", async () => {
    const response = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        targetUrl: "https://example.net",
        serviceType: "accessibility_testing",
        targetRegion: "Pakistan",
        executionLimit: 2,
      })
      .expect(201);

    expect(response.body.task.estimatedCost).toBe(
      response.body.pricing.quote.totalCredits
    );
    expect(response.body.task.estimatedCost).not.toBe(20);
    expect(response.body.task.pricingSnapshot.version).toBe("rule-v1");
  });
});

describe("Phase 3: CSV report authorization", () => {
  it("allows the owning client to download a completed report", async () => {
    const response = await request(app)
      .get(`/api/tasks/${settledTask._id}/report.csv`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.text).toContain("pricingVersion");
    expect(response.text).toContain("example.com");
  });

  it("denies reports to non-owners and unfinished tasks", async () => {
    await request(app)
      .get(`/api/tasks/${settledTask._id}/report.csv`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(403);
    await request(app)
      .get(`/api/tasks/${pendingTask._id}/report.csv`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(409);
  });
});

describe("Phase 3: node rating authorization and safety", () => {
  it("rejects invalid, non-owner, and unfinished ratings", async () => {
    await request(app)
      .post(`/api/tasks/${settledTask._id}/rating`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ rating: 6 })
      .expect(400);
    await request(app)
      .post(`/api/tasks/${settledTask._id}/rating`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ rating: 4 })
      .expect(403);
    await request(app)
      .post(`/api/tasks/${pendingTask._id}/rating`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ rating: 4 })
      .expect(409);
  });

  it("records one rating and updates bounded node aggregates", async () => {
    const response = await request(app)
      .post(`/api/tasks/${settledTask._id}/rating`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ rating: 4, comment: "Reliable residential result" })
      .expect(201);
    expect(response.body.nodeRating.average).toBe(4);
    expect(response.body.nodeRating.count).toBe(1);
    expect(response.body.nodeRating.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(response.body.nodeRating.reliabilityScore).toBeLessThanOrEqual(100);

    await request(app)
      .post(`/api/tasks/${settledTask._id}/rating`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ rating: 5 })
      .expect(409);

    const updatedNode = await NodeDevice.findById(node._id);
    expect(updatedNode.ratingCount).toBe(1);
    expect(updatedNode.ratingTotal).toBe(4);
  });
});
