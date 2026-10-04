import crypto from 'crypto';
import RoutingSession, { VALID_TRANSITIONS } from '../models/RoutingSession.js';
import TestingTask from '../models/TestingTask.js';
import NodeDevice from '../models/NodeDevice.js';
import logger from '../lib/logger.js';

// === Constants ===
const TOKEN_TTL_MS = 5 * 60 * 1000;          // 5 min: token valid for signaling
const SESSION_CREATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 min to reach 'active'
const STALE_CLEANUP_INTERVAL_MS = 60 * 1000;  // Check every 60s
const MAX_ACTIVE_DURATION_MS = 30 * 60 * 1000; // 30 min max active lifetime

let cleanupTimer = null;

// =====================================================================
// Token helpers
// =====================================================================

/**
 * Generate a cryptographically random plain token and its SHA-256 hash.
 * The plain token is returned once to the caller (node/backend).
 * Only the hash is stored in the database.
 */
const generateAuthToken = () => {
  const plain = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, hash };
};

/**
 * Hash a plain token for comparison against stored hash.
 */
const hashToken = (plain) =>
  crypto.createHash('sha256').update(plain).digest('hex');

// =====================================================================
// Session Creation
// =====================================================================

/**
 * Create a new RoutingSession, bound to taskId + nodeId + clientId.
 * Issues a short-lived auth token returned to the caller once.
 *
 * @returns {{ session: RoutingSession, authToken: string }}
 */
export const createRoutingSession = async ({ taskId, nodeId, clientId }) => {
  if (!taskId || !nodeId || !clientId) {
    throw new Error('RoutingSession requires taskId, nodeId, and clientId');
  }

  // Verify task exists and belongs to the client
  const task = await TestingTask.findOne({ _id: taskId, clientId }).lean();
  if (!task) {
    throw new Error('Task not found or does not belong to the specified client');
  }

  // Verify node exists
  const node = await NodeDevice.findById(nodeId).lean();
  if (!node) {
    throw new Error('Node device not found');
  }

  // Fail any existing non-terminal sessions for the same task+node
  await RoutingSession.updateMany(
    {
      taskId,
      nodeId,
      status: { $nin: ['completed', 'failed', 'expired'] },
    },
    {
      $set: {
        status: 'failed',
        endedAt: new Date(),
        closeReason: 'admin_terminated',
        failureDetail: 'Superseded by new session creation',
      },
      $push: {
        stateHistory: {
          from: 'active',
          to: 'failed',
          reason: 'Superseded by new session creation',
          timestamp: new Date(),
        },
      },
    }
  );

  const { plain, hash } = generateAuthToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_CREATION_TIMEOUT_MS);
  const authTokenExpiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  const session = await RoutingSession.create({
    taskId,
    nodeId,
    clientId,
    authTokenHash: hash,
    authTokenExpiresAt,
    authTokenIssuedAt: now,
    status: 'created',
    startedAt: now,
    expiresAt,
    maxActiveDurationMs: MAX_ACTIVE_DURATION_MS,
    stateHistory: [
      { from: 'created', to: 'created', reason: 'Session created', timestamp: now },
    ],
  });

  logger.info(
    { routingSessionId: session._id, taskId, nodeId, clientId },
    'RoutingSession created'
  );

  // Return plain token — only time it's exposed
  return { session, authToken: plain };
};

// =====================================================================
// Authorization
// =====================================================================

/**
 * Authorize a signaling event against the routing session.
 * Checks:
 *  1. Session exists and matches taskId + nodeId + clientId
 *  2. Session is in a state that allows signaling
 *  3. Auth token hash matches stored hash
 *  4. Auth token has not expired
 *
 * @param {string} sessionId
 * @param {string} plainToken
 * @param {{ taskId?, nodeId?, clientId? }} bindings — at least one must match
 * @returns {RoutingSession}
 * @throws on any failure
 */
export const authorizeSignalingEvent = async (sessionId, plainToken, bindings = {}) => {
  // Load with authTokenHash (normally select: false)
  const session = await RoutingSession.findById(sessionId).select('+authTokenHash');

  if (!session) {
    throw Object.assign(new Error('RoutingSession not found'), { code: 'SESSION_NOT_FOUND' });
  }

  // Validate identity bindings (at least one must be provided)
  if (bindings.nodeId && session.nodeId.toString() !== bindings.nodeId.toString()) {
    throw Object.assign(new Error('Session node binding mismatch'), { code: 'BINDING_MISMATCH' });
  }
  if (bindings.clientId && session.clientId.toString() !== bindings.clientId.toString()) {
    throw Object.assign(new Error('Session client binding mismatch'), { code: 'BINDING_MISMATCH' });
  }
  if (bindings.taskId && session.taskId.toString() !== bindings.taskId.toString()) {
    throw Object.assign(new Error('Session task binding mismatch'), { code: 'BINDING_MISMATCH' });
  }

  // Terminal states cannot accept signaling
  if (['completed', 'failed', 'expired'].includes(session.status)) {
    throw Object.assign(
      new Error(`RoutingSession is terminal (${session.status})`),
      { code: 'SESSION_TERMINAL' }
    );
  }

  // Token expiry check
  if (new Date() > new Date(session.authTokenExpiresAt)) {
    throw Object.assign(new Error('Session auth token expired'), { code: 'TOKEN_EXPIRED' });
  }

  // Constant-time token comparison (prevents timing attacks)
  const expectedHash = session.authTokenHash;
  const providedHash = hashToken(plainToken);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  const providedBuf = Buffer.from(providedHash, 'hex');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    logger.warn({ sessionId, code: 'TOKEN_INVALID' }, 'Invalid routing session token');
    throw Object.assign(new Error('Invalid session auth token'), { code: 'TOKEN_INVALID' });
  }

  return session;
};

// =====================================================================
// State Transitions
// =====================================================================

/**
 * Transition a RoutingSession to a new state.
 * Rotates the auth token on transition (prevents replay of old token).
 *
 * @returns {{ session: RoutingSession, newAuthToken?: string }}
 */
export const transitionRoutingSession = async (sessionId, toState, { reason = '', rotate = true } = {}) => {
  const session = await RoutingSession.findById(sessionId).select('+authTokenHash');
  if (!session) throw new Error('RoutingSession not found');

  const fromState = session.status;

  if (!VALID_TRANSITIONS[fromState]?.includes(toState)) {
    throw new Error(`Invalid routing session transition: ${fromState} → ${toState}`);
  }

  // Push history entry
  session.stateHistory.push({
    from: fromState,
    to: toState,
    reason,
    timestamp: new Date(),
  });

  session.status = toState;

  // On terminal states, mark endedAt
  if (['completed', 'failed', 'expired'].includes(toState)) {
    session.endedAt = new Date();
  }

  // Rotate auth token unless closing
  let newAuthToken = null;
  if (rotate && !['completed', 'failed', 'expired'].includes(toState)) {
    const { plain, hash } = generateAuthToken();
    session.authTokenHash = hash;
    session.authTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    session.authTokenIssuedAt = new Date();
    newAuthToken = plain;
  }

  await session.save();

  logger.info(
    { routingSessionId: sessionId, from: fromState, to: toState, reason },
    `RoutingSession transition: ${fromState} → ${toState}`
  );

  return { session, newAuthToken };
};

// =====================================================================
// Recovery
// =====================================================================

/**
 * Attempt recovery of a disrupted session.
 * Returns false if max recovery attempts exhausted.
 */
export const attemptRecovery = async (sessionId) => {
  const session = await RoutingSession.findById(sessionId);
  if (!session || session.status !== 'recovering') return false;

  if (session.recoveryAttempts >= session.maxRecoveryAttempts) {
    await transitionRoutingSession(sessionId, 'failed', {
      reason: 'Max recovery attempts exceeded',
      rotate: false,
    });
    return false;
  }

  await RoutingSession.findByIdAndUpdate(sessionId, {
    $inc: { recoveryAttempts: 1, iceRestartCount: 1 },
    $set: { lastRecoveryAt: new Date() },
  });

  return true;
};

// =====================================================================
// DataChannel Diagnostic Recording
// =====================================================================

/**
 * Record that the DataChannel opened (sanitized diagnostic only).
 * Call this from the signaling layer when the DataChannel is confirmed open.
 */
export const recordDcOpen = async (sessionId) => {
  try {
    await RoutingSession.findByIdAndUpdate(sessionId, {
      $set: { dcOpenedAt: new Date() },
    });
  } catch (err) {
    logger.warn({ sessionId, err }, 'Failed to record dcOpenedAt');
  }
};

/**
 * Increment the DataChannel message counter (sanitized diagnostic).
 * @param {string} sessionId
 * @param {number} [count=1] Number of messages to add
 */
export const recordDcMessages = async (sessionId, count = 1) => {
  try {
    await RoutingSession.findByIdAndUpdate(sessionId, {
      $inc: { dcMessageCount: count },
    });
  } catch (err) {
    logger.warn({ sessionId, err }, 'Failed to record dcMessageCount');
  }
};

// =====================================================================
// Stale Session Cleanup
// =====================================================================

/**
 * Find and expire sessions that passed their creation timeout without becoming active.
 * Find and fail sessions that exceeded their max active duration.
 */
export const cleanupStaleSessions = async () => {
  const now = new Date();

  // Expire sessions stuck in created/negotiating past their expiresAt
  const toExpire = await RoutingSession.find({
    status: { $in: ['created', 'negotiating', 'recovering'] },
    expiresAt: { $lt: now },
  });

  let expired = 0;
  let timedOut = 0;

  for (const s of toExpire) {
    try {
      await transitionRoutingSession(s._id.toString(), 'expired', {
        reason: 'Session creation timeout exceeded',
        rotate: false,
      });
      await RoutingSession.findByIdAndUpdate(s._id, {
        closeReason: 'negotiation_timeout',
      });
      expired++;
    } catch (err) {
      logger.error({ err, sessionId: s._id }, 'Failed to expire stale routing session');
    }
  }

  // Fail sessions active longer than maxActiveDurationMs
  const activeSessions = await RoutingSession.find({ status: 'active' });
  for (const s of activeSessions) {
    const activeMs = now.getTime() - new Date(s.startedAt).getTime();
    if (activeMs > s.maxActiveDurationMs) {
      try {
        await transitionRoutingSession(s._id.toString(), 'failed', {
          reason: 'Maximum active session duration exceeded',
          rotate: false,
        });
        await RoutingSession.findByIdAndUpdate(s._id, {
          closeReason: 'session_timeout',
        });
        timedOut++;
      } catch (err) {
        logger.error({ err, sessionId: s._id }, 'Failed to timeout active routing session');
      }
    }
  }

  if (expired > 0 || timedOut > 0) {
    logger.info({ expired, timedOut }, 'RoutingSession cleanup completed');
  }

  return { expired, timedOut };
};

/**
 * Start the periodic stale-session cleanup interval.
 */
export const startSessionCleanup = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupStaleSessions, STALE_CLEANUP_INTERVAL_MS);
  logger.info({ intervalMs: STALE_CLEANUP_INTERVAL_MS }, 'RoutingSession cleanup timer started');
};

/**
 * Stop the cleanup interval (for graceful shutdown / tests).
 */
export const stopSessionCleanup = () => {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
};

// =====================================================================
// Query helpers
// =====================================================================

/**
 * Find the active routing session for a task + node pair.
 */
export const getActiveSession = async (taskId, nodeId) => {
  return RoutingSession.findOne({
    taskId,
    nodeId,
    status: { $in: ['created', 'negotiating', 'active', 'recovering'] },
  });
};

/**
 * Complete a routing session cleanly on task completion.
 */
export const completeRoutingSession = async (sessionId) => {
  return transitionRoutingSession(sessionId, 'completed', {
    reason: 'Task completed successfully',
    rotate: false,
  });
};

/**
 * Fail a routing session with a specific close reason.
 */
export const failRoutingSession = async (sessionId, closeReason, failureDetail = '') => {
  const { session } = await transitionRoutingSession(sessionId, 'failed', {
    reason: closeReason,
    rotate: false,
  });
  await RoutingSession.findByIdAndUpdate(sessionId, { closeReason, failureDetail });
  return session;
};

export default {
  createRoutingSession,
  authorizeSignalingEvent,
  transitionRoutingSession,
  attemptRecovery,
  recordDcOpen,
  recordDcMessages,
  cleanupStaleSessions,
  startSessionCleanup,
  stopSessionCleanup,
  getActiveSession,
  completeRoutingSession,
  failRoutingSession,
};
