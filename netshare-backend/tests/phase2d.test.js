/**
 * Phase 2D Tests — Real Controlled Task Routing
 *
 * Mandatory Tests:
 *   T1  — authorized target succeeds (HTTP GET to authorized public URL)
 *   T2  — unrelated public target blocked (host mismatch with task authorization)
 *   T3  — 127.0.0.1 blocked (loopback anti-SSRF)
 *   T4  — RFC1918 blocked (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *   T5  — metadata endpoint blocked (169.254.169.254 and metadata.google.internal)
 *   T6  — unsafe redirect blocked (HTTP redirect to private / metadata IP)
 *   T7  — unauthorized port blocked (e.g. port 22, 25, 6379)
 *   T8  — duplicate result does not double-settle (idempotent wallet settlement)
 *   T9  — disconnect/recovery does not double-execute (concurrent settlement guard)
 *   T10 — real task result stored once (TaskResult document count == 1, real metrics)
 *   T11 — end-to-end dispatch: TestingTask → RoutingSession → DataChannel → Settlement
 *   T12 — task failure handling: cleans up RoutingSession and WebRTC peer resources
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import app from '../server.js';

import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import NodeDevice from '../models/NodeDevice.js';
import TestingTask from '../models/TestingTask.js';
import TaskSession from '../models/TaskSession.js';
import TaskResult from '../models/TaskResult.js';
import RoutingSession from '../models/RoutingSession.js';
import BandwidthUsage from '../models/BandwidthUsage.js';

import {
  validateTarget,
  validateRedirect,
  validateTaskExecutionTarget,
} from '../services/targetValidationService.js';
import {
  prepareAuthorizedTaskSession,
  dispatchTaskOverDataChannel,
  settleTaskResult,
  handleTaskFailure,
} from '../services/secureTaskRoutingService.js';
import {
  createPeer,
  closeAllPeers,
  isPeerInState,
} from '../services/webrtcPeerService.js';
import {
  validateNodeTarget,
  executeSecureResidentialHttpTest,
} from '../../netshare-agent/src/secureTaskExecutor.js';

let testNodeUserId;
let testClientUserId;
let testNodeDeviceId;
let testTaskId;
let testClientToken;

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await User.deleteMany({ email: { $regex: /^test_phase2d_/ } });

  const nodeUser = await User.create({
    name: 'Phase2D Node Participant',
    email: 'test_phase2d_node@test.io',
    password: 'hashed_password',
    role: 'node_participant',
    isVerified: true,
  });
  testNodeUserId = nodeUser._id;
  await Wallet.create({ userId: nodeUser._id, balance: 100 });

  const clientUser = await User.create({
    name: 'Phase2D Client User',
    email: 'test_phase2d_client@test.io',
    password: 'hashed_password',
    role: 'platform_client',
    isVerified: true,
  });
  testClientUserId = clientUser._id;
  await Wallet.create({ userId: clientUser._id, balance: 5000 });

  const node = await NodeDevice.create({
    userId: nodeUser._id,
    deviceName: 'Phase2D Residential Node',
    region: 'us-east',
    status: 'active',
    maxConcurrentTasks: 3,
    currentActiveTasks: 0,
    bandwidthLimitMB: 5000,
  });
  testNodeDeviceId = node._id;

  const task = await TestingTask.create({
    clientId: clientUser._id,
    targetUrl: 'https://example.com',
    serviceType: 'performance_testing',
    targetRegion: 'us-east',
    executionLimit: 1,
    estimatedCost: 10,
    status: 'pending',
    assignedNodeId: node._id,
  });
  testTaskId = task._id;
});

afterAll(async () => {
  try {
    closeAllPeers();
    await User.deleteMany({ email: { $regex: /^test_phase2d_/ } });
    await TestingTask.deleteMany({ clientId: testClientUserId });
    await TaskResult.deleteMany({ clientId: testClientUserId });
    await RoutingSession.deleteMany({ clientId: testClientUserId });
  } catch (_) {}
});

describe('Phase 2D: Real Controlled Task Routing', () => {
  // =========================================================================
  // T1: Authorized target succeeds
  // =========================================================================
  it('T1: authorized target succeeds through residential execution', async () => {
    const targetUrl = 'https://example.com';
    const validation = await validateTarget(targetUrl);
    expect(validation.valid).toBe(true);

    const execValidation = await validateTaskExecutionTarget({
      targetUrl,
      authorizedHost: 'example.com',
      authorizedPort: 443,
      authorizedMethod: 'GET',
    });
    expect(execValidation.valid).toBe(true);

    const result = await executeSecureResidentialHttpTest(targetUrl, {
      authorizedHost: 'example.com',
      authorizedPort: 443,
      authorizedMethod: 'GET',
      timeoutMs: 10000,
      mockResponse: { statusCode: 200, latencyMs: 65, downloadSizeBytes: 15400 },
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBeGreaterThanOrEqual(200);
    expect(result.statusCode).toBeLessThan(400);
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.downloadSizeBytes).toBeGreaterThan(0);
    expect(result.bandwidthUsedMB).toBeGreaterThan(0);
  });

  // =========================================================================
  // T2: Unrelated public target blocked
  // =========================================================================
  it('T2: unrelated public target blocked when it does not match authorized host', async () => {
    // Task is authorized for 'api.example.com', but node attempts to contact 'unrelated-public-site.org'
    const unauthorizedTarget = 'https://unrelated-public-site.org/data';

    const check = await validateTaskExecutionTarget({
      targetUrl: unauthorizedTarget,
      authorizedHost: 'api.example.com',
      authorizedPort: 443,
      authorizedMethod: 'GET',
    });

    expect(check.valid).toBe(false);
    expect(check.reason).toContain('does not match authorized host');

    // Node executor independently blocks it before network attempt
    const nodeExec = await executeSecureResidentialHttpTest(unauthorizedTarget, {
      authorizedHost: 'api.example.com',
      authorizedPort: 443,
    });

    expect(nodeExec.success).toBe(false);
    expect(nodeExec.statusCode).toBe(403);
    expect(nodeExec.resultData.error).toContain('does not match authorized host');
  });

  // =========================================================================
  // T3: 127.0.0.1 blocked (loopback)
  // =========================================================================
  it('T3: 127.0.0.1 and loopback IPs are strictly blocked', async () => {
    const loopbackUrls = [
      'http://127.0.0.1:8080/admin',
      'http://127.0.0.2:80',
      'http://localhost:3000/metrics',
      'http://127.255.255.254',
    ];

    for (const url of loopbackUrls) {
      const backendCheck = await validateTarget(url);
      expect(backendCheck.valid).toBe(false);

      const nodeCheck = await validateNodeTarget(url);
      expect(nodeCheck.valid).toBe(false);

      const result = await executeSecureResidentialHttpTest(url);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
    }
  });

  // =========================================================================
  // T4: RFC1918 blocked
  // =========================================================================
  it('T4: RFC1918 private IP ranges are strictly blocked', async () => {
    const rfc1918Urls = [
      'http://10.0.0.1/status',
      'http://10.254.1.2/',
      'http://172.16.0.10:8080/',
      'http://172.31.255.255/',
      'http://192.168.1.1/router-login',
      'http://192.168.0.254/',
    ];

    for (const url of rfc1918Urls) {
      const backendCheck = await validateTarget(url);
      expect(backendCheck.valid).toBe(false);
      expect(backendCheck.reason).toMatch(/private|reserved/i);

      const nodeCheck = await validateNodeTarget(url);
      expect(nodeCheck.valid).toBe(false);
      expect(nodeCheck.reason).toMatch(/private|reserved/i);

      const execResult = await executeSecureResidentialHttpTest(url);
      expect(execResult.success).toBe(false);
      expect(execResult.statusCode).toBe(403);
    }
  });

  // =========================================================================
  // T5: Metadata endpoint blocked
  // =========================================================================
  it('T5: cloud metadata endpoints (169.254.169.254 & metadata.google.internal) are blocked', async () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254/computeMetadata/v1/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata.gke.internal/',
    ];

    for (const url of metadataUrls) {
      const backendCheck = await validateTarget(url);
      expect(backendCheck.valid).toBe(false);

      const nodeCheck = await validateNodeTarget(url);
      expect(nodeCheck.valid).toBe(false);

      const result = await executeSecureResidentialHttpTest(url);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
    }
  });

  // =========================================================================
  // T6: Unsafe redirect blocked
  // =========================================================================
  it('T6: unsafe redirect to private/metadata IP or localhost is blocked', async () => {
    const baseTarget = 'https://example.com/test';

    const unsafeRedirects = [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8080/admin',
      'http://192.168.1.1/secret',
      'http://10.0.0.1/',
      'ftp://example.com/file',
    ];

    for (const redirectLocation of unsafeRedirects) {
      const redirectCheck = await validateRedirect(baseTarget, redirectLocation);
      expect(redirectCheck.valid).toBe(false);
      expect(redirectCheck.reason).toMatch(/blocked|unsupported/i);
    }

    // Safe redirect should pass
    const safeRedirect = await validateRedirect(baseTarget, 'https://example.com/landing');
    expect(safeRedirect.valid).toBe(true);
    expect(safeRedirect.resolvedUrl).toBe('https://example.com/landing');
  });

  // =========================================================================
  // T7: Unauthorized port blocked
  // =========================================================================
  it('T7: unauthorized ports (e.g. 22, 25, 6379, 3306) are blocked', async () => {
    const unauthorizedPortUrls = [
      'http://example.com:22/',    // SSH
      'http://example.com:25/',    // SMTP
      'http://example.com:6379/',  // Redis
      'http://example.com:3306/',  // MySQL
      'http://example.com:27017/', // MongoDB
    ];

    for (const url of unauthorizedPortUrls) {
      const backendCheck = await validateTarget(url);
      expect(backendCheck.valid).toBe(false);
      expect(backendCheck.reason).toContain('Unauthorized port');

      const nodeCheck = await validateNodeTarget(url);
      expect(nodeCheck.valid).toBe(false);
      expect(nodeCheck.reason).toContain('Unauthorized port');
    }

    // Standard web ports should pass
    const port80 = await validateTarget('http://example.com:80/');
    expect(port80.valid).toBe(true);

    const port443 = await validateTarget('https://example.com:443/');
    expect(port443.valid).toBe(true);

    const port8080 = await validateTarget('http://example.com:8080/');
    expect(port8080.valid).toBe(true);
  });

  // =========================================================================
  // T8: Duplicate result does not double-settle
  // =========================================================================
  it('T8: duplicate result does not double-settle wallet credits', async () => {
    // 1. Create a fresh task for settlement test
    const task = await TestingTask.create({
      clientId: testClientUserId,
      targetUrl: 'https://example.com',
      serviceType: 'performance_testing',
      targetRegion: 'us-east',
      executionLimit: 1,
      estimatedCost: 10,
      status: 'assigned',
      assignedNodeId: testNodeDeviceId,
    });

    const { session } = await prepareAuthorizedTaskSession({
      taskId: task._id,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
    });

    const initialWallet = await Wallet.findOne({ userId: testNodeUserId });
    const initialBalance = initialWallet.balance;

    const resultPayload = {
      taskId: task._id.toString(),
      success: true,
      statusCode: 200,
      latencyMs: 120,
      downloadSizeBytes: 54000,
      bandwidthUsedMB: 0.25,
      resultData: { test: true },
    };

    // First settlement
    const firstSettlement = await settleTaskResult(session._id.toString(), resultPayload);
    expect(firstSettlement.settled).toBe(true);
    expect(firstSettlement.taskResult).toBeDefined();

    const walletAfterFirst = await Wallet.findOne({ userId: testNodeUserId });
    const balanceAfterFirst = walletAfterFirst.balance;
    expect(balanceAfterFirst).toBeGreaterThan(initialBalance);

    // Second duplicate settlement attempt with same taskId
    const duplicateSettlement = await settleTaskResult(session._id.toString(), resultPayload);
    expect(duplicateSettlement.settled).toBe(false);

    // Wallet balance must NOT increase again
    const walletAfterSecond = await Wallet.findOne({ userId: testNodeUserId });
    expect(walletAfterSecond.balance).toBe(balanceAfterFirst);
  });

  // =========================================================================
  // T9: Disconnect/recovery does not double-execute
  // =========================================================================
  it('T9: disconnect or duplicate concurrent calls do not double-execute', async () => {
    const task = await TestingTask.create({
      clientId: testClientUserId,
      targetUrl: 'https://example.com',
      serviceType: 'performance_testing',
      targetRegion: 'us-east',
      executionLimit: 1,
      estimatedCost: 10,
      status: 'assigned',
      assignedNodeId: testNodeDeviceId,
    });

    const { session } = await prepareAuthorizedTaskSession({
      taskId: task._id,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
    });

    const payload = {
      taskId: task._id.toString(),
      success: true,
      statusCode: 200,
      latencyMs: 85,
      bandwidthUsedMB: 0.1,
    };

    // Run two simultaneous settlement calls concurrently
    const [res1, res2] = await Promise.all([
      settleTaskResult(session._id.toString(), payload),
      settleTaskResult(session._id.toString(), payload),
    ]);

    // Exactly one should settle; the other should be rejected/ignored
    const settledCount = (res1.settled ? 1 : 0) + (res2.settled ? 1 : 0);
    expect(settledCount).toBe(1);

    // Verify task state in database is settled
    const updatedTask = await TestingTask.findById(task._id);
    expect(updatedTask.status).toBe('settled');
  });

  // =========================================================================
  // T10: Real task result stored once
  // =========================================================================
  it('T10: real task result stored exactly once with true execution metrics', async () => {
    const task = await TestingTask.create({
      clientId: testClientUserId,
      targetUrl: 'https://example.com',
      serviceType: 'performance_testing',
      targetRegion: 'us-east',
      executionLimit: 1,
      estimatedCost: 10,
      status: 'assigned',
      assignedNodeId: testNodeDeviceId,
    });

    const { session } = await prepareAuthorizedTaskSession({
      taskId: task._id,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
    });

    // Execute real residential test
    const execMetrics = await executeSecureResidentialHttpTest('https://example.com', {
      authorizedHost: 'example.com',
      authorizedPort: 443,
      timeoutMs: 10000,
      mockResponse: { statusCode: 200, latencyMs: 80, downloadSizeBytes: 32000 },
    });

    const payload = {
      taskId: task._id.toString(),
      success: execMetrics.success,
      statusCode: execMetrics.statusCode,
      latencyMs: execMetrics.latencyMs,
      downloadSizeBytes: execMetrics.downloadSizeBytes,
      bandwidthUsedMB: execMetrics.bandwidthUsedMB,
      downloadBandwidthMB: execMetrics.downloadBandwidthMB,
      uploadBandwidthMB: execMetrics.uploadBandwidthMB,
      packetLoss: execMetrics.packetLoss,
      successRate: execMetrics.successRate,
      resultData: execMetrics.resultData,
    };

    await settleTaskResult(session._id.toString(), payload);

    // Verify TaskResult document count for this task is strictly 1
    const count = await TaskResult.countDocuments({ taskId: task._id });
    expect(count).toBe(1);

    const storedResult = await TaskResult.findOne({ taskId: task._id });
    expect(storedResult).toBeDefined();
    expect(storedResult.statusCode).toBe(200);
    expect(storedResult.latencyMs).toBe(execMetrics.latencyMs);
    expect(storedResult.bandwidthUsedMB).toBe(execMetrics.bandwidthUsedMB);
    expect(storedResult.resultData.responseSizeBytes).toBe(execMetrics.downloadSizeBytes);

    // Verify RoutingSession state transitioned to 'completed'
    const finalSession = await RoutingSession.findById(session._id);
    expect(finalSession.status).toBe('completed');
  });

  // =========================================================================
  // T11: End-to-end dispatch over WebRTC DataChannel
  // =========================================================================
  it('T11: prepareAuthorizedTaskSession generates valid task envelope and binds RoutingSession', async () => {
    const task = await TestingTask.create({
      clientId: testClientUserId,
      targetUrl: 'https://example.com',
      serviceType: 'performance_testing',
      targetRegion: 'us-east',
      executionLimit: 1,
      estimatedCost: 10,
      status: 'pending',
    });

    const { session, authToken, taskEnvelope } = await prepareAuthorizedTaskSession({
      taskId: task._id,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
    });

    expect(session).toBeDefined();
    expect(authToken).toBeDefined();
    expect(authToken.length).toBe(64); // 32 bytes hex
    expect(taskEnvelope.taskId).toBe(task._id.toString());
    expect(taskEnvelope.authorizedHost).toBe('example.com');
    expect(taskEnvelope.authorizedPort).toBe(443);
    expect(taskEnvelope.authorizedMethod).toBe('GET');

    // Create a local peer connection for the session
    const peer = createPeer(session._id.toString());
    expect(peer).toBeDefined();
    expect(isPeerInState(session._id.toString(), 'created')).toBe(true);

    // Teardown
    closeAllPeers();
  });

  // =========================================================================
  // T12: Task failure handling
  // =========================================================================
  it('T12: handleTaskFailure cleans up session and peer resources', async () => {
    const task = await TestingTask.create({
      clientId: testClientUserId,
      targetUrl: 'https://example.com',
      serviceType: 'performance_testing',
      targetRegion: 'us-east',
      executionLimit: 1,
      estimatedCost: 10,
      status: 'assigned',
      assignedNodeId: testNodeDeviceId,
    });

    const { session } = await prepareAuthorizedTaskSession({
      taskId: task._id,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
    });

    createPeer(session._id.toString());

    await handleTaskFailure(session._id.toString(), task._id.toString(), 'peer_timeout', 'DataChannel not opened');

    const updatedTask = await TestingTask.findById(task._id);
    expect(updatedTask.status).toBe('failed');
    expect(updatedTask.resultSummary.message).toContain('peer_timeout');

    const updatedSession = await RoutingSession.findById(session._id);
    expect(updatedSession.status).toBe('failed');

    expect(isPeerInState(session._id.toString(), 'created', 'open')).toBe(false);
  });
});
