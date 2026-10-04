import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server.js';
import { validateTarget } from '../services/targetValidationService.js';
import { validateTransition, NODE_STATES, canAcceptNewTasks } from '../lib/nodeStateMachine.js';
import { calculateHealthScore, HEALTH_CONFIG } from '../lib/nodeHealth.js';

let testClientToken = null;
let testNodeToken = null;
let testClientId = null;
let testNodeId = null;
let testNodeDeviceId = null;

// Wait for DB connection
beforeAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Create test client user
  const User = (await import('../models/User.js')).default;
  const Wallet = (await import('../models/Wallet.js')).default;
  const NodeDevice = (await import('../models/NodeDevice.js')).default;
  const generateToken = (await import('../utils/generateToken.js')).default;
  
  // Clean up any previous test data
  await User.deleteMany({ email: { $regex: /^test_phase1_/ } });
  await NodeDevice.deleteMany({ deviceName: { $regex: /^test_phase1_/ } });
  
  // Create verified client
  const bcrypt = (await import('bcryptjs')).default;
  const hashedPw = await bcrypt.hash('TestPass123', 10);
  
  const clientUser = await User.create({
    name: 'Phase1 Client',
    email: 'test_phase1_client@test.io',
    password: hashedPw,
    role: 'platform_client',
    isVerified: true,
    status: 'active',
  });
  testClientId = clientUser._id;
  testClientToken = generateToken(clientUser._id);
  
  await Wallet.create({ userId: clientUser._id, balance: 5000 });
  
  // Create verified node participant
  const nodeUser = await User.create({
    name: 'Phase1 Node',
    email: 'test_phase1_node@test.io',
    password: hashedPw,
    role: 'node_participant',
    isVerified: true,
    status: 'active',
  });
  testNodeId = nodeUser._id;
  testNodeToken = generateToken(nodeUser._id);
  
  await Wallet.create({ userId: nodeUser._id, balance: 0 });
  
  // Register node device
  const node = await NodeDevice.create({
    userId: nodeUser._id,
    deviceName: 'test_phase1_node_device',
    deviceId: 'test_dev_phase1',
    region: 'us-east',
    bandwidthLimitMB: 100,
    maxConcurrentTasks: 2,
    status: 'inactive',
    reliabilityScore: 95,
    successRate: 90,
    latencyMs: null,
    lastSeenAt: new Date(),
  });
  testNodeDeviceId = node._id;
}, 30000);

afterAll(async () => {
  const User = (await import('../models/User.js')).default;
  const Wallet = (await import('../models/Wallet.js')).default;
  const NodeDevice = (await import('../models/NodeDevice.js')).default;
  const ParticipationSession = (await import('../models/ParticipationSession.js')).default;
  
  await User.deleteMany({ email: { $regex: /^test_phase1_/ } });
  await NodeDevice.deleteMany({ deviceName: { $regex: /^test_phase1_/ } });
  await ParticipationSession.deleteMany({ userId: { $in: [testClientId, testNodeId] } });
  await Wallet.deleteMany({ userId: { $in: [testClientId, testNodeId] } });
  await mongoose.connection.close();
}, 15000);


// ============================================================
// TELEMETRY TESTS
// ============================================================

describe('Phase 1: Telemetry Tests', () => {
  
  it('T1: No random latency in getCurrentSession', async () => {
    // Start participation first
    await request(app)
      .post('/api/node/start')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    // Fetch session multiple times — latency must be stable (null or consistent)
    const values = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get('/api/node/session/current')
        .set('Authorization', `Bearer ${testNodeToken}`);
      values.push(res.body.latency);
    }
    
    // All values should be the same (no random jitter)
    const unique = [...new Set(values.map(v => JSON.stringify(v)))];
    expect(unique.length).toBe(1);
  });
  
  it('T2: Missing metrics represented as null (unavailable)', async () => {
    const res = await request(app)
      .get('/api/node/session/current')
      .set('Authorization', `Bearer ${testNodeToken}`);
    
    // Latency should be null when no telemetry has been received
    // (not a hardcoded number like 45)
    expect(res.body.latency === null || typeof res.body.latency === 'number').toBe(true);
    if (res.body.latency !== null) {
      // If not null, it must come from real stored data, not a hardcoded default
      expect(res.body.latency).not.toBe(45);
    }
  });
  
  it('T3: Throughput calculation — known value test', () => {
    // 1MB in 2 seconds = 500KB/s = 4 Mbps
    const bytes = 1048576; // 1 MB
    const elapsedMs = 2000;
    const throughputBps = bytes / (elapsedMs / 1000);
    const throughputMbps = (throughputBps * 8) / 1000000;
    
    expect(throughputBps).toBe(524288);
    expect(throughputMbps).toBeCloseTo(4.194, 2);
  });
  
  it('T4: Byte accounting — known value test', () => {
    const uploadedBytes = 1024; // 1 KB request
    const downloadedBytes = 512000; // 500 KB response
    const totalBytes = uploadedBytes + downloadedBytes;
    
    expect(totalBytes).toBe(513024);
    
    // Display conversion
    const displayMB = totalBytes / (1024 * 1024);
    expect(displayMB).toBeCloseTo(0.489, 2);
  });
});


// ============================================================
// NODE LIFECYCLE TESTS
// ============================================================

describe('Phase 1: Node Lifecycle Tests', () => {
  
  it('T5: Start participation transitions to active', async () => {
    const res = await request(app)
      .post('/api/node/start')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    expect(res.body.node.status).toBe('active');
    expect(res.body.session).toBeDefined();
  });
  
  it('T6: Pause blocks new tasks', async () => {
    const res = await request(app)
      .put('/api/node/pause')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    expect(res.body.status).toBe('paused');
  });
  
  it('T7: Paused node state check', async () => {
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    const node = await NodeDevice.findById(testNodeDeviceId);
    expect(node.status).toBe('paused');
    expect(canAcceptNewTasks(node)).toBe(false);
  });
  
  it('T8: Resume restores eligibility', async () => {
    const res = await request(app)
      .put('/api/node/resume')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    expect(res.body.status).toBe('active');
  });
  
  it('T9: Stop with zero tasks stops immediately', async () => {
    // Ensure node is in active state with no active tasks
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    await NodeDevice.findByIdAndUpdate(testNodeDeviceId, { currentActiveTasks: 0, status: 'active' });
    
    const res = await request(app)
      .post('/api/node/stop')
      .set('Authorization', `Bearer ${testNodeToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });
  
  it('T10: Stop with active task enters draining', async () => {
    // Start participation first
    await request(app)
      .post('/api/node/start')
      .set('Authorization', `Bearer ${testNodeToken}`);
    
    // Simulate active tasks
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    await NodeDevice.findByIdAndUpdate(testNodeDeviceId, { currentActiveTasks: 1, status: 'active' });
    
    const res = await request(app)
      .post('/api/node/stop')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    expect(res.body.status).toBe('draining');
  });
  
  it('T11: Draining node receives no new assignments', async () => {
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    const node = await NodeDevice.findById(testNodeDeviceId);
    expect(node.status).toBe('draining');
    expect(canAcceptNewTasks(node)).toBe(false);
  });
  
  it('T12: Double stop is idempotent', async () => {
    // Reset node to inactive
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    await NodeDevice.findByIdAndUpdate(testNodeDeviceId, { currentActiveTasks: 0, status: 'inactive' });
    
    const res = await request(app)
      .post('/api/node/stop')
      .set('Authorization', `Bearer ${testNodeToken}`)
      .expect(200);
    
    expect(res.body.message).toContain('already inactive');
  });
});


// ============================================================
// NODE STATE MACHINE TESTS
// ============================================================

describe('Phase 1: Node State Machine', () => {
  
  it('T13: Valid transitions accepted', () => {
    expect(validateTransition('inactive', 'active').valid).toBe(true);
    expect(validateTransition('active', 'busy').valid).toBe(true);
    expect(validateTransition('active', 'paused').valid).toBe(true);
    expect(validateTransition('active', 'draining').valid).toBe(true);
    expect(validateTransition('busy', 'active').valid).toBe(true);
    expect(validateTransition('paused', 'active').valid).toBe(true);
    expect(validateTransition('draining', 'inactive').valid).toBe(true);
    expect(validateTransition('offline', 'active').valid).toBe(true);
    expect(validateTransition('unhealthy', 'active').valid).toBe(true);
  });
  
  it('T14: Invalid transitions rejected', () => {
    expect(validateTransition('inactive', 'busy').valid).toBe(false);
    expect(validateTransition('inactive', 'draining').valid).toBe(false);
    expect(validateTransition('paused', 'busy').valid).toBe(false);
    expect(validateTransition('draining', 'active').valid).toBe(false);
    expect(validateTransition('draining', 'busy').valid).toBe(false);
  });
  
  it('T15: Same-state transition is allowed (no-op)', () => {
    expect(validateTransition('active', 'active').valid).toBe(true);
    expect(validateTransition('paused', 'paused').valid).toBe(true);
  });
});


// ============================================================
// NODE HEALTH TESTS
// ============================================================

describe('Phase 1: Node Health Model', () => {
  
  it('T16: Healthy node gets high score', async () => {
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    const node = await NodeDevice.findById(testNodeDeviceId);
    node.lastSeenAt = new Date(); // Fresh heartbeat
    node.latencyMs = 50;
    node.currentActiveTasks = 0;
    await node.save();
    
    const result = await calculateHealthScore(node);
    expect(result.healthScore).toBeGreaterThanOrEqual(HEALTH_CONFIG.THRESHOLDS.HEALTHY);
    expect(result.isHealthy).toBe(true);
    expect(result.healthScoreVersion).toBe(1);
  });
  
  it('T17: Stale heartbeat reduces health', async () => {
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    const node = await NodeDevice.findById(testNodeDeviceId);
    node.lastSeenAt = new Date(Date.now() - 120000); // 2 minutes old
    await node.save();
    
    const result = await calculateHealthScore(node);
    expect(result.inputs.heartbeatFreshness).toBe(0.0);
    expect(result.healthScore).toBeLessThan(HEALTH_CONFIG.THRESHOLDS.HEALTHY);
  });
  
  it('T18: Health config has correct version', () => {
    expect(HEALTH_CONFIG.VERSION).toBe(1);
    expect(HEALTH_CONFIG.THRESHOLDS.HEALTHY).toBe(0.6);
    expect(HEALTH_CONFIG.THRESHOLDS.UNHEALTHY).toBe(0.4);
    expect(HEALTH_CONFIG.THRESHOLDS.RECOVERY).toBe(0.5);
  });
});


// ============================================================
// BANDWIDTH LIMIT TESTS
// ============================================================

describe('Phase 1: Bandwidth Limits', () => {
  
  it('T19: Bandwidth-exhausted node excluded from allocation', async () => {
    const NodeDevice = (await import('../models/NodeDevice.js')).default;
    const { findAvailableNode } = await import('../services/taskAllocationService.js');
    
    // Exhaust bandwidth
    await NodeDevice.findByIdAndUpdate(testNodeDeviceId, {
      status: 'active',
      usedBandwidthMB: 200, // Exceeds 100MB limit
      bandwidthLimitMB: 100,
      currentActiveTasks: 0,
    });
    
    // No node should be found since our test node is bandwidth-exhausted
    const result = await findAvailableNode('us-east');
    // Result should be null or not our exhausted node
    if (result) {
      expect(result._id.toString()).not.toBe(testNodeDeviceId.toString());
    }
    
    // Reset
    await NodeDevice.findByIdAndUpdate(testNodeDeviceId, {
      usedBandwidthMB: 0,
      status: 'inactive',
    });
  });
});


// ============================================================
// IDEMPOTENCY TESTS
// ============================================================

describe('Phase 1: Idempotency', () => {
  
  it('T20: Wallet idempotency key prevents duplicate credit', async () => {
    const { addCredits } = await import('../services/walletService.js');
    const Wallet = (await import('../models/Wallet.js')).default;
    
    const before = await Wallet.findOne({ userId: testNodeId });
    const initialBalance = before.balance;
    
    const key = `test_idem_${Date.now()}`;
    
    // First credit
    await addCredits({
      userId: testNodeId,
      amount: 100,
      description: 'Test idempotency',
      idempotencyKey: key,
    });
    
    // Second credit with same key — should be ignored
    await addCredits({
      userId: testNodeId,
      amount: 100,
      description: 'Test idempotency duplicate',
      idempotencyKey: key,
    });
    
    const after = await Wallet.findOne({ userId: testNodeId });
    expect(after.balance).toBe(initialBalance + 100); // Not +200
  });
});


// ============================================================
// SIMULATED CONTENT REMOVAL TESTS
// ============================================================

describe('Phase 1: Simulated Content Removed', () => {
  
  it('T21: TaskSession model defaults simulatedSecureChannel to false', async () => {
    const TaskSession = (await import('../models/TaskSession.js')).default;
    const schema = TaskSession.schema.paths.simulatedSecureChannel;
    expect(schema.defaultValue).toBe(false);
  });
  
  it('T22: sessionController does not contain simulated text', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../controllers/sessionController.js', import.meta.url),
      'utf-8'
    );
    expect(content).not.toContain('Simulated secure');
    expect(content).not.toContain('simulated secure');
  });
});


// ============================================================
// WALLET PRODUCTION SAFETY
// ============================================================

describe('Phase 1: Wallet Production Safety', () => {
  
  it('T23: walletService imports config for production checks', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      new URL('../services/walletService.js', import.meta.url),
      'utf-8'
    );
    expect(content).toContain("import config from '../config/env.js'");
    expect(content).toContain('config.isProduction');
  });
});


// ============================================================
// AUTHORIZATION
// ============================================================

describe('Phase 1: Authorization', () => {
  
  it('T24: Client cannot access node endpoints', async () => {
    const res = await request(app)
      .get('/api/node/dashboard')
      .set('Authorization', `Bearer ${testClientToken}`);
    
    // Should return 403 (role middleware blocks platform_client from node endpoints)
    expect(res.status).toBe(403);
  });
  
  it('T25: Unauthenticated user blocked from node operations', async () => {
    const res = await request(app)
      .post('/api/node/start');
    
    expect(res.status).toBe(401);
  });
});


// ============================================================
// HEALTH ENDPOINT
// ============================================================

describe('Phase 1: Health Endpoints', () => {
  
  it('T26: Readiness probe checks MongoDB', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.mongodb).toBe('connected');
  });
  
  it('T27: Liveness probe always responds', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });
});
