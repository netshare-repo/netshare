import mongoose from 'mongoose';

/**
 * RoutingSession — authorized secure routing session binding a task to a node.
 *
 * Chapter 3 §3.5.1 / §3.5.3:
 *   "routing_sessions — Stores secure session metadata such as taskId, deviceId,
 *    sessionStatus, startedAt, endedAt. Used to track authorized execution sessions."
 *
 * States:
 *   created     → session record exists, authorization token issued, signaling not started
 *   negotiating → WebRTC offer/answer/ICE exchange in progress
 *   active      → both sides confirmed; task execution may proceed
 *   recovering  → transient connection loss; retry window open
 *   completed   → task finished, session closed cleanly
 *   failed      → unrecoverable error or timeout; task must be re-queued
 *   expired     → session exceeded max lifetime before becoming active
 */

const ROUTING_SESSION_STATES = [
  'created',
  'negotiating',
  'active',
  'recovering',
  'completed',
  'failed',
  'expired',
];

// Valid forward transitions only — no state can go backward except recovering→active
const VALID_TRANSITIONS = {
  created:     ['negotiating', 'failed', 'expired'],
  negotiating: ['active', 'failed', 'expired'],
  active:      ['recovering', 'completed', 'failed'],
  recovering:  ['active', 'failed', 'expired'],
  completed:   [],
  failed:      [],
  expired:     [],
};

const routingSessionSchema = new mongoose.Schema(
  {
    // === Identity Binding (required, immutable after creation) ===
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestingTask',
      required: true,
      index: true,
    },
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NodeDevice',
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // === Authorization ===
    /**
     * Short-lived session token for replay-resistant signaling authorization.
     * Generated with crypto.randomBytes(32).toString('hex').
     * Stored as SHA-256 hash; compared on every signaling event.
     * Rotated on each state transition to prevent replay.
     */
    authTokenHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    authTokenExpiresAt: {
      type: Date,
      required: true,
    },
    authTokenIssuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // === State ===
    status: {
      type: String,
      enum: ROUTING_SESSION_STATES,
      default: 'created',
      index: true,
    },

    // === Timing ===
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    /**
     * Hard expiry: session must reach 'active' before this time or be expired.
     * Default: 5 minutes from creation.
     */
    expiresAt: {
      type: Date,
      required: true,
    },
    /**
     * Maximum session lifetime once active. Default: 30 minutes.
     */
    maxActiveDurationMs: {
      type: Number,
      default: 30 * 60 * 1000,
    },

    // === WebRTC Signaling ===
    /**
     * SDP offer from the initiating peer (backend/client).
     * Cleared after negotiation completes to reduce storage.
     */
    sdpOffer: {
      type: String,
      default: null,
    },
    /**
     * SDP answer from the node.
     */
    sdpAnswer: {
      type: String,
      default: null,
    },
    /**
     * ICE candidate count — used to detect stalled negotiation.
     */
    iceCandidateCount: {
      type: Number,
      default: 0,
    },

    // === Recovery ===
    recoveryAttempts: {
      type: Number,
      default: 0,
    },
    maxRecoveryAttempts: {
      type: Number,
      default: 3,
    },
    lastRecoveryAt: {
      type: Date,
      default: null,
    },
    /**
     * Tracks the number of ICE restarts actually initiated via signaling.
     * Sanitized diagnostic — does not store ICE credentials.
     */
    iceRestartCount: {
      type: Number,
      default: 0,
    },

    // === DataChannel Diagnostics (sanitized only) ===
    /**
     * Timestamp when the DataChannel first opened.
     * null until the data channel is established.
     */
    dcOpenedAt: {
      type: Date,
      default: null,
    },
    /**
     * Total number of DataChannel messages exchanged (both directions).
     */
    dcMessageCount: {
      type: Number,
      default: 0,
    },

    // === Audit Trail ===
    stateHistory: [
      {
        from: { type: String, enum: ROUTING_SESSION_STATES },
        to:   { type: String, enum: ROUTING_SESSION_STATES },
        reason: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // === Failure / Completion ===
    closeReason: {
      type: String,
      enum: [
        'task_completed',
        'task_failed',
        'node_disconnected',
        'client_disconnected',
        'negotiation_timeout',
        'session_timeout',
        'unauthorized',
        'max_recovery_exceeded',
        'admin_terminated',
        'ice_failed',
        'ice_restart_timeout',
        'dc_open_timeout',
        'idle_timeout',
        'server_shutdown',
        null,
      ],
      default: null,
    },
    failureDetail: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'routing_sessions',
  }
);

// === Indexes ===
// Compound index for the primary access pattern: find session by task + node
routingSessionSchema.index({ taskId: 1, nodeId: 1 }, { unique: false });
// TTL: expire documents 7 days after endedAt (audit retention)
routingSessionSchema.index({ endedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, sparse: true });

// === Static helpers ===

/**
 * Returns allowed next states from a given state.
 */
routingSessionSchema.statics.allowedTransitions = function (fromState) {
  return VALID_TRANSITIONS[fromState] || [];
};

/**
 * Returns true if the transition from → to is valid.
 */
routingSessionSchema.statics.isValidTransition = function (from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
};

// Export transition map for use in service without re-importing model
export { ROUTING_SESSION_STATES, VALID_TRANSITIONS };

export default mongoose.model('RoutingSession', routingSessionSchema);
