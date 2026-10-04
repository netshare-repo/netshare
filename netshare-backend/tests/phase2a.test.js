/**
 * Phase 2A Tests — Secure Routing Foundation
 *
 * Coverage:
 *   T1  — RoutingSession model: valid creation with all required fields
 *   T2  — RoutingSession model: rejects creation without taskId
 *   T3  — RoutingSession model: rejects creation without nodeId
 *   T4  — RoutingSession model: rejects creation without clientId
 *   T5  — State machine: all valid transitions accepted
 *   T6  — State machine: invalid/backward transitions rejected
 *   T7  — State machine: terminal states accept no further transitions
 *   T8  — createRoutingSession: returns opaque auth token (not stored hash)
 *   T9  — createRoutingSession: auth token hashed in DB (SHA-256)
 *   T10 — authorizeSignalingEvent: valid token succeeds
 *   T11 — authorizeSignalingEvent: wrong token rejected (constant-time)
 *   T12 — authorizeSignalingEvent: expired token rejected
 *   T13 — authorizeSignalingEvent: node binding mismatch rejected
 *   T14 — authorizeSignalingEvent: client binding mismatch rejected
 *   T15 — authorizeSignalingEvent: terminal session rejected
 *   T16 — Node cannot access another node's session (cross-node isolation)
 *   T17 — transitionRoutingSession: rotates token on non-terminal transitions
 *   T18 — transitionRoutingSession: does NOT rotate token on terminal transitions
 *   T19 — cleanupStaleSessions: expires sessions past their expiresAt
 *   T20 — cleanupStaleSessions: fails active sessions past maxActiveDurationMs
 *   T21 — simulatedSecureChannel: not present as default in TaskSession
 *   T22 — simulatedSecureChannel: not present in schema (field removed)
 *   T23 — webrtc:offer: missing fields emits webrtc:error
 *   T24 — webrtc:answer: missing fields emits webrtc:error
 *   T25 — webrtc:ice_candidate: missing fields emits webrtc:error
 *   T26 — webrtc:close: missing fields emits webrtc:error
 *   T27 — handleOffer: invalid token rejected, error emitted
 *   T28 — handleAnswer: invalid token rejected, error emitted
 *   T29 — completeRoutingSession: transitions to completed
 *   T30 — failRoutingSession: transitions to failed with reason
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'crypto';

// ------------------------------------------------------------------ setup ---
import app from '../server.js';

let testNodeToken;
let testClientToken;
let testNodeUserId;
let testClientUserId;
let testNodeDeviceId;
let testTaskId;

beforeAll(async () => {
  // Wait for DB connection
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const User = (await import('../models/User.js')).default;
  const Wallet = (await import('../models/Wallet.js')).default;
  const NodeDevice = (await import('../models/NodeDevice.js')).default;
  const TestingTask = (await import('../models/TestingTask.js')).default;
  const generateToken = (await import('../utils/generateToken.js')).default;
  const RoutingSession = (await import('../models/RoutingSession.js')).default;

  // Clean up leftovers
  await User.deleteMany({ email: { $regex: /^test_phase2a_/ } });
  await RoutingSession.deleteMany({});

  // Create node participant user
  const nodeUser = await User.create({
    name: 'Phase2A Node',
    email: 'test_phase2a_node@test.io',
    password: 'hashed_placeholder',
    role: 'node_participant',
    isVerified: true,
  });
  testNodeUserId = nodeUser._id;
  testNodeToken = generateToken(nodeUser._id);
  await Wallet.create({ userId: nodeUser._id, balance: 0 });

  // Create platform client user
  const clientUser = await User.create({
    name: 'Phase2A Client',
    email: 'test_phase2a_client@test.io',
    password: 'hashed_placeholder',
    role: 'platform_client',
    isVerified: true,
  });
  testClientUserId = clientUser._id;
  testClientToken = generateToken(clientUser._id);
  await Wallet.create({ userId: clientUser._id, balance: 1000 });

  // Create a node device
  const node = await NodeDevice.create({
    userId: nodeUser._id,
    deviceName: 'Phase2A Test Node',
    region: 'us-east',
    status: 'active',
    bandwidthLimitMB: 1000,
  });
  testNodeDeviceId = node._id;

  // Create a testing task owned by the client
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
    const User = (await import('../models/User.js')).default;
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await User.deleteMany({ email: { $regex: /^test_phase2a_/ } });
    await RoutingSession.deleteMany({});
  } catch (_) {}
});

// ---------------------------------------------------------------- helpers ---

const getService = async () => (await import('../services/routingSessionService.js'));

// ===========================================================================
// T1–T4: RoutingSession model
// ===========================================================================

describe('Phase 2A: RoutingSession Model', () => {
  it('T1: Valid creation with all required fields', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    const hash = crypto.createHash('sha256').update('test_token').digest('hex');
    const now = new Date();

    const session = await RoutingSession.create({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
      authTokenHash: hash,
      authTokenExpiresAt: new Date(now.getTime() + 60000),
      expiresAt: new Date(now.getTime() + 300000),
      status: 'created',
    });

    expect(session._id).toBeDefined();
    expect(session.taskId.toString()).toBe(testTaskId.toString());
    expect(session.nodeId.toString()).toBe(testNodeDeviceId.toString());
    expect(session.clientId.toString()).toBe(testClientUserId.toString());
    expect(session.status).toBe('created');
    expect(session.stateHistory).toBeDefined();

    await session.deleteOne();
  });

  it('T2: Rejects creation without taskId', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    const hash = crypto.createHash('sha256').update('t').digest('hex');
    const now = new Date();

    await expect(
      RoutingSession.create({
        nodeId: testNodeDeviceId,
        clientId: testClientUserId,
        authTokenHash: hash,
        authTokenExpiresAt: new Date(now.getTime() + 60000),
        expiresAt: new Date(now.getTime() + 300000),
      })
    ).rejects.toThrow();
  });

  it('T3: Rejects creation without nodeId', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    const hash = crypto.createHash('sha256').update('t').digest('hex');
    const now = new Date();

    await expect(
      RoutingSession.create({
        taskId: testTaskId,
        clientId: testClientUserId,
        authTokenHash: hash,
        authTokenExpiresAt: new Date(now.getTime() + 60000),
        expiresAt: new Date(now.getTime() + 300000),
      })
    ).rejects.toThrow();
  });

  it('T4: Rejects creation without clientId', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    const hash = crypto.createHash('sha256').update('t').digest('hex');
    const now = new Date();

    await expect(
      RoutingSession.create({
        taskId: testTaskId,
        nodeId: testNodeDeviceId,
        authTokenHash: hash,
        authTokenExpiresAt: new Date(now.getTime() + 60000),
        expiresAt: new Date(now.getTime() + 300000),
      })
    ).rejects.toThrow();
  });
});

// ===========================================================================
// T5–T7: State machine
// ===========================================================================

describe('Phase 2A: RoutingSession State Machine', () => {
  it('T5: All valid transitions accepted by model statics', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;

    expect(RoutingSession.isValidTransition('created', 'negotiating')).toBe(true);
    expect(RoutingSession.isValidTransition('created', 'failed')).toBe(true);
    expect(RoutingSession.isValidTransition('created', 'expired')).toBe(true);
    expect(RoutingSession.isValidTransition('negotiating', 'active')).toBe(true);
    expect(RoutingSession.isValidTransition('negotiating', 'failed')).toBe(true);
    expect(RoutingSession.isValidTransition('active', 'recovering')).toBe(true);
    expect(RoutingSession.isValidTransition('active', 'completed')).toBe(true);
    expect(RoutingSession.isValidTransition('active', 'failed')).toBe(true);
    expect(RoutingSession.isValidTransition('recovering', 'active')).toBe(true);
    expect(RoutingSession.isValidTransition('recovering', 'failed')).toBe(true);
  });

  it('T6: Invalid/backward transitions rejected', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;

    expect(RoutingSession.isValidTransition('active', 'created')).toBe(false);
    expect(RoutingSession.isValidTransition('active', 'negotiating')).toBe(false);
    expect(RoutingSession.isValidTransition('completed', 'active')).toBe(false);
    expect(RoutingSession.isValidTransition('failed', 'active')).toBe(false);
    expect(RoutingSession.isValidTransition('negotiating', 'created')).toBe(false);
  });

  it('T7: Terminal states accept no further transitions', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;

    expect(RoutingSession.allowedTransitions('completed')).toEqual([]);
    expect(RoutingSession.allowedTransitions('failed')).toEqual([]);
    expect(RoutingSession.allowedTransitions('expired')).toEqual([]);
  });
});

// ===========================================================================
// T8–T18: Authorization and token security
// ===========================================================================

describe('Phase 2A: Session Authorization', () => {
  let sessionId;
  let plainToken;

  beforeEach(async () => {
    // Create a fresh session before each auth test
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session, authToken } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });
    sessionId = session._id.toString();
    plainToken = authToken;
  });

  it('T8: createRoutingSession returns opaque hex auth token', async () => {
    expect(typeof plainToken).toBe('string');
    expect(plainToken).toHaveLength(64); // 32 bytes → 64 hex chars
    expect(/^[0-9a-f]+$/.test(plainToken)).toBe(true);
  });

  it('T9: Auth token stored as SHA-256 hash, not plain text', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    const record = await RoutingSession.findById(sessionId).select('+authTokenHash');
    expect(record.authTokenHash).toBeDefined();
    expect(record.authTokenHash).not.toBe(plainToken); // never stored plain
    // Verify it matches SHA-256 of the plain token
    const expectedHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    expect(record.authTokenHash).toBe(expectedHash);
  });

  it('T10: authorizeSignalingEvent: valid token succeeds', async () => {
    const svc = await getService();
    const session = await svc.authorizeSignalingEvent(
      sessionId,
      plainToken,
      { nodeId: testNodeDeviceId, clientId: testClientUserId }
    );
    expect(session._id.toString()).toBe(sessionId);
  });

  it('T11: authorizeSignalingEvent: wrong token rejected', async () => {
    const svc = await getService();
    const fakeToken = 'a'.repeat(64);
    await expect(
      svc.authorizeSignalingEvent(sessionId, fakeToken, { nodeId: testNodeDeviceId })
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });

  it('T12: authorizeSignalingEvent: expired token rejected', async () => {
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    // Force token to be in the past
    await RoutingSession.findByIdAndUpdate(sessionId, {
      authTokenExpiresAt: new Date(Date.now() - 1000),
    });
    const svc = await getService();
    await expect(
      svc.authorizeSignalingEvent(sessionId, plainToken, { nodeId: testNodeDeviceId })
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('T13: authorizeSignalingEvent: node binding mismatch rejected', async () => {
    const svc = await getService();
    const wrongNodeId = new mongoose.Types.ObjectId();
    await expect(
      svc.authorizeSignalingEvent(sessionId, plainToken, { nodeId: wrongNodeId })
    ).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
  });

  it('T14: authorizeSignalingEvent: client binding mismatch rejected', async () => {
    const svc = await getService();
    const wrongClientId = new mongoose.Types.ObjectId();
    await expect(
      svc.authorizeSignalingEvent(sessionId, plainToken, { clientId: wrongClientId })
    ).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
  });

  it('T15: authorizeSignalingEvent: terminal session rejected', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.findByIdAndUpdate(sessionId, { status: 'completed' });
    await expect(
      svc.authorizeSignalingEvent(sessionId, plainToken, { nodeId: testNodeDeviceId })
    ).rejects.toMatchObject({ code: 'SESSION_TERMINAL' });
  });
});

// ===========================================================================
// T16: Cross-node isolation
// ===========================================================================

describe('Phase 2A: Cross-Node Isolation', () => {
  it('T16: Node cannot access another node\'s session', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    // Session bound to testNodeDeviceId
    const { session, authToken } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    // Different node trying to access this session
    const otherNodeId = new mongoose.Types.ObjectId();

    await expect(
      svc.authorizeSignalingEvent(
        session._id.toString(),
        authToken,
        { nodeId: otherNodeId } // wrong node
      )
    ).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
  });
});

// ===========================================================================
// T17–T18: Token rotation on transitions
// ===========================================================================

describe('Phase 2A: Token Rotation', () => {
  it('T17: transitionRoutingSession rotates token on non-terminal transitions', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session, authToken: originalToken } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    const { newAuthToken } = await svc.transitionRoutingSession(
      session._id.toString(),
      'negotiating',
      { reason: 'test', rotate: true }
    );

    expect(newAuthToken).toBeDefined();
    expect(newAuthToken).toHaveLength(64);
    expect(newAuthToken).not.toBe(originalToken); // token rotated

    // Old token must now be rejected
    await expect(
      svc.authorizeSignalingEvent(
        session._id.toString(),
        originalToken,
        { nodeId: testNodeDeviceId }
      )
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });

  it('T18: transitionRoutingSession does NOT rotate token on terminal transitions', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    const { newAuthToken } = await svc.transitionRoutingSession(
      session._id.toString(),
      'failed',
      { reason: 'test terminal', rotate: false }
    );

    expect(newAuthToken).toBeNull();

    const updated = await RoutingSession.findById(session._id).select('+authTokenHash');
    expect(updated.status).toBe('failed');
    expect(updated.endedAt).toBeDefined();
  });
});

// ===========================================================================
// T19–T20: Stale session cleanup
// ===========================================================================

describe('Phase 2A: Stale Session Cleanup', () => {
  it('T19: cleanupStaleSessions expires sessions past their expiresAt', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;

    const hash = crypto.createHash('sha256').update('x').digest('hex');
    const stale = await RoutingSession.create({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
      authTokenHash: hash,
      authTokenExpiresAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() - 1000), // already expired
      status: 'negotiating',
    });

    const { expired } = await svc.cleanupStaleSessions();
    expect(expired).toBeGreaterThanOrEqual(1);

    const updated = await RoutingSession.findById(stale._id);
    expect(updated.status).toBe('expired');

    await stale.deleteOne();
  });

  it('T20: cleanupStaleSessions fails active sessions past maxActiveDurationMs', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;

    const hash = crypto.createHash('sha256').update('y').digest('hex');
    const overdue = await RoutingSession.create({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
      authTokenHash: hash,
      authTokenExpiresAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 300000),
      status: 'active',
      startedAt: new Date(Date.now() - 31 * 60 * 1000), // 31 min ago
      maxActiveDurationMs: 30 * 60 * 1000,               // 30 min limit
    });

    const { timedOut } = await svc.cleanupStaleSessions();
    expect(timedOut).toBeGreaterThanOrEqual(1);

    const updated = await RoutingSession.findById(overdue._id);
    expect(updated.status).toBe('failed');

    await overdue.deleteOne();
  });
});

// ===========================================================================
// T21–T22: simulatedSecureChannel removed
// ===========================================================================

describe('Phase 2A: Simulated Content Removed', () => {
  it('T21: TaskSession schema does not have simulatedSecureChannel as a default field', async () => {
    const TaskSession = (await import('../models/TaskSession.js')).default;
    const session = new TaskSession({
      taskId: testTaskId,
      clientId: testClientUserId,
      nodeId: testNodeDeviceId,
      sessionToken: 'test_token',
    });
    // simulatedSecureChannel must not exist as a defined schema property
    expect(session.simulatedSecureChannel).toBeUndefined();
  });

  it('T22: simulatedSecureChannel not in TaskSession schema paths', async () => {
    const TaskSession = (await import('../models/TaskSession.js')).default;
    const schemaPaths = Object.keys(TaskSession.schema.paths);
    expect(schemaPaths).not.toContain('simulatedSecureChannel');
  });
});

// ===========================================================================
// T23–T28: WebRTC signaling handler validation
// ===========================================================================

describe('Phase 2A: WebRTC Signaling Security', () => {
  const makeSocket = (overrides = {}) => {
    const emitted = {};
    return {
      node: overrides.node || null,
      user: overrides.user || null,
      emit: (event, data) => { emitted[event] = data; },
      _emitted: emitted,
      ...overrides,
    };
  };

  it('T23: webrtc:offer — missing fields emits webrtc:error', async () => {
    const { handleOffer } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ node: { _id: testNodeDeviceId } });
    await handleOffer(null, socket, {}); // no routingSessionId, authToken, sdp
    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(socket._emitted['webrtc:error'].code).toBe('MISSING_FIELDS');
  });

  it('T24: webrtc:answer — missing fields emits webrtc:error', async () => {
    const { handleAnswer } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ user: { _id: testClientUserId } });
    await handleAnswer(null, socket, {}); // missing required fields
    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(socket._emitted['webrtc:error'].code).toBe('MISSING_FIELDS');
  });

  it('T25: webrtc:ice_candidate — missing fields emits webrtc:error', async () => {
    const { handleIceCandidate } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ node: { _id: testNodeDeviceId } });
    await handleIceCandidate(null, socket, {}); // missing required fields
    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(socket._emitted['webrtc:error'].code).toBe('MISSING_FIELDS');
  });

  it('T26: webrtc:close — missing fields emits webrtc:error', async () => {
    const { handleClose } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ node: { _id: testNodeDeviceId } });
    await handleClose(null, socket, {}); // missing required fields
    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(socket._emitted['webrtc:error'].code).toBe('MISSING_FIELDS');
  });

  it('T27: handleOffer — invalid token emits AUTH_FAILED webrtc:error', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    const { handleOffer } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ node: { _id: testNodeDeviceId } });

    await handleOffer(null, socket, {
      routingSessionId: session._id.toString(),
      authToken: 'invalid_token_that_is_64_chars_long_padded_with_zeros_00000000',
      sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
    });

    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(['TOKEN_INVALID', 'AUTH_FAILED']).toContain(socket._emitted['webrtc:error'].code);
  });

  it('T28: handleAnswer — invalid token emits AUTH_FAILED webrtc:error', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    const { handleAnswer } = await import('../services/webrtcSignalingService.js');
    const socket = makeSocket({ user: { _id: testClientUserId } });

    await handleAnswer(null, socket, {
      routingSessionId: session._id.toString(),
      authToken: 'bad_token_64_chars_long_padded_with_zeros_000000000000000000000000',
      sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
    });

    expect(socket._emitted['webrtc:error']).toBeDefined();
    expect(['TOKEN_INVALID', 'AUTH_FAILED']).toContain(socket._emitted['webrtc:error'].code);
  });
});

// ===========================================================================
// T29–T30: completeRoutingSession / failRoutingSession
// ===========================================================================

describe('Phase 2A: Session Terminal Helpers', () => {
  it('T29: completeRoutingSession transitions session to completed', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    // Must pass through active first
    await svc.transitionRoutingSession(session._id.toString(), 'negotiating', { reason: 'test' });
    await svc.transitionRoutingSession(session._id.toString(), 'active', { reason: 'test' });
    await svc.completeRoutingSession(session._id.toString());

    const updated = await RoutingSession.findById(session._id);
    expect(updated.status).toBe('completed');
    expect(updated.endedAt).toBeDefined();
  });

  it('T30: failRoutingSession transitions to failed with reason', async () => {
    const svc = await getService();
    const RoutingSession = (await import('../models/RoutingSession.js')).default;
    await RoutingSession.deleteMany({ taskId: testTaskId });

    const { session } = await svc.createRoutingSession({
      taskId: testTaskId,
      nodeId: testNodeDeviceId,
      clientId: testClientUserId,
    });

    await svc.failRoutingSession(session._id.toString(), 'node_disconnected', 'Node timed out');

    const updated = await RoutingSession.findById(session._id);
    expect(updated.status).toBe('failed');
    expect(updated.closeReason).toBe('node_disconnected');
    expect(updated.endedAt).toBeDefined();
  });
});
