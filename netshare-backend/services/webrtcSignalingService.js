/**
 * webrtcSignalingService.js
 *
 * Handles authenticated WebRTC signaling events forwarded through Socket.IO.
 * Acts as a relay-only signaling server — the backend does NOT participate in
 * the WebRTC data channel (unless explicitly running as a peer via webrtcPeerService).
 *
 * Signaling events (all require valid routingSessionId + authToken):
 *   webrtc:offer           — node → backend → client (SDP offer)
 *   webrtc:answer          — client → backend → node (SDP answer)
 *   webrtc:ice_candidate   — bidirectional (ICE candidate relay)
 *   webrtc:ice_restart     — either peer → backend → other peer (ICE restart request)
 *   webrtc:dc_message      — relay authorized DataChannel control messages
 *   webrtc:close           — either peer → backend (session teardown)
 *
 * Security model:
 *   - Every event carries { routingSessionId, authToken, ... }
 *   - authorizeSignalingEvent validates binding + token + expiry
 *   - A node cannot address another node's session (binding check)
 *   - A client cannot inject into a session they don't own (binding check)
 *   - Replayed tokens are rejected (token rotates on each transition)
 *
 * Token rotation across multi-step signaling:
 *   After each state transition that rotates the token, the new token is
 *   delivered to BOTH parties via webrtc:token_refresh before the event
 *   response is sent. Both peers MUST use the new token for subsequent events.
 *   The old token becomes invalid immediately (timing-safe comparison in auth).
 */

import RoutingSession from '../models/RoutingSession.js';
import {
  authorizeSignalingEvent,
  transitionRoutingSession,
  failRoutingSession,
  attemptRecovery,
} from './routingSessionService.js';
import logger from '../lib/logger.js';

// =====================================================================
// Internal relay helper
// =====================================================================

/**
 * Relay a validated signaling payload to the target room.
 * @param {Server} io
 * @param {string} targetRoom  — Socket.IO room name
 * @param {string} event       — Event name to emit
 * @param {object} payload     — Data to forward
 */
const relay = (io, targetRoom, event, payload) => {
  if (!io) return;
  io.to(targetRoom).emit(event, payload);
};

/**
 * Deliver refreshed auth token to both peers after a state transition.
 * This ensures both sides can send subsequent signaling events.
 * @param {Server} io
 * @param {string} routingSessionId
 * @param {object} session  — RoutingSession document
 * @param {string|null} newAuthToken — new plaintext token
 * @param {Socket} senderSocket — socket that initiated the event
 */
const deliverTokenRefresh = (io, routingSessionId, session, newAuthToken, senderSocket) => {
  if (!newAuthToken) return;

  const refreshPayload = { routingSessionId, newAuthToken };

  // Send to the OTHER peer (relay to their room)
  const nodeRoom = `node_${session.nodeId}`;
  const clientRoom = `client_${session.clientId}`;

  // Determine which room is NOT the sender
  const isNodeSender = !!senderSocket.node;
  relay(io, isNodeSender ? clientRoom : nodeRoom, 'webrtc:token_refresh', refreshPayload);

  // Also send to sender (they need the new token too)
  senderSocket.emit('webrtc:token_refresh', refreshPayload);
};

// =====================================================================
// Event handlers
// =====================================================================

/**
 * Handle webrtc:offer
 * Direction: node → client (node sends the SDP offer)
 *
 * On offer: transitions session created → negotiating and rotates token.
 * Both peers receive the new token before the SDP is relayed.
 *
 * Expected payload:
 *   { routingSessionId, authToken, sdp }
 */
export const handleOffer = async (io, socket, data) => {
  const { routingSessionId, authToken, sdp } = data || {};

  if (!routingSessionId || !authToken || !sdp) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'offer requires routingSessionId, authToken, sdp' });
    return;
  }

  try {
    const session = await authorizeSignalingEvent(
      routingSessionId,
      authToken,
      { nodeId: socket.node?._id }
    );

    // Transition to negotiating if still in created; rotate token
    let newAuthToken = null;
    if (session.status === 'created') {
      const result = await transitionRoutingSession(routingSessionId, 'negotiating', {
        reason: 'SDP offer received',
        rotate: true,
      });
      newAuthToken = result.newAuthToken;

      // IMPORTANT: deliver new token to both peers BEFORE relaying SDP
      // so they can authorize subsequent signaling events
      deliverTokenRefresh(io, routingSessionId, session, newAuthToken, socket);
    }

    // Persist sanitized diagnostic (not raw SDP)
    await RoutingSession.findByIdAndUpdate(routingSessionId, {
      sdpOffer: '[redacted]', // Only store a marker, not raw SDP
    });

    // Relay SDP to client room
    relay(io, `client_${session.clientId}`, 'webrtc:offer', {
      routingSessionId,
      sdp,
      fromNodeId: session.nodeId.toString(),
    });

    logger.info({ routingSessionId, nodeId: session.nodeId.toString() }, 'WebRTC offer relayed to client');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:offer authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Handle webrtc:answer
 * Direction: client → node (client answers the SDP offer)
 *
 * On answer: transitions negotiating → active and rotates token.
 * Both peers receive the new token before the SDP is relayed.
 * SDP markers are cleared from DB once negotiation completes.
 *
 * Expected payload:
 *   { routingSessionId, authToken, sdp }
 */
export const handleAnswer = async (io, socket, data) => {
  const { routingSessionId, authToken, sdp } = data || {};

  if (!routingSessionId || !authToken || !sdp) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'answer requires routingSessionId, authToken, sdp' });
    return;
  }

  try {
    const session = await authorizeSignalingEvent(
      routingSessionId,
      authToken,
      { clientId: socket.user?._id }
    );

    // Transition to active; rotate token
    let newAuthToken = null;
    if (['created', 'negotiating'].includes(session.status)) {
      const result = await transitionRoutingSession(routingSessionId, 'active', {
        reason: 'SDP answer received — WebRTC negotiation complete',
        rotate: true,
      });
      newAuthToken = result.newAuthToken;

      // Deliver refreshed token to both peers BEFORE relaying SDP
      deliverTokenRefresh(io, routingSessionId, session, newAuthToken, socket);

      // Clear SDP markers from DB — negotiation is complete
      await RoutingSession.findByIdAndUpdate(routingSessionId, {
        sdpOffer: null,
        sdpAnswer: null,
      });
    }

    // Relay answer to node
    relay(io, `node_${session.nodeId}`, 'webrtc:answer', {
      routingSessionId,
      sdp,
      fromClientId: session.clientId.toString(),
    });

    logger.info({ routingSessionId, clientId: session.clientId.toString() }, 'WebRTC answer relayed to node');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:answer authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Handle webrtc:ice_candidate
 * Direction: bidirectional — either peer can send ICE candidates
 *
 * Expected payload:
 *   { routingSessionId, authToken, candidate, mid? }
 */
export const handleIceCandidate = async (io, socket, data) => {
  const { routingSessionId, authToken, candidate, mid } = data || {};

  if (!routingSessionId || !authToken || !candidate) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'ice_candidate requires routingSessionId, authToken, candidate' });
    return;
  }

  const isNode = !!socket.node;
  const binding = isNode
    ? { nodeId: socket.node._id }
    : { clientId: socket.user?._id };

  try {
    const session = await authorizeSignalingEvent(routingSessionId, authToken, binding);

    // Increment ICE candidate counter (sanitized diagnostic only)
    await RoutingSession.findByIdAndUpdate(routingSessionId, {
      $inc: { iceCandidateCount: 1 },
    });

    // Forward to the other peer
    const targetRoom = isNode
      ? `client_${session.clientId}`
      : `node_${session.nodeId}`;

    relay(io, targetRoom, 'webrtc:ice_candidate', {
      routingSessionId,
      candidate,
      mid: mid || '0',
    });

    logger.debug({ routingSessionId, isNode }, 'ICE candidate relayed');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:ice_candidate authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Handle webrtc:ice_restart
 * Either peer may request an ICE restart after ICE failure.
 * The backend transitions the session to 'recovering', rotates the token,
 * and forwards the restart request to the other peer so they can send a new offer.
 *
 * Expected payload:
 *   { routingSessionId, authToken, reason? }
 */
export const handleIceRestart = async (io, socket, data) => {
  const { routingSessionId, authToken, reason } = data || {};

  if (!routingSessionId || !authToken) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'ice_restart requires routingSessionId, authToken' });
    return;
  }

  const isNode = !!socket.node;
  const binding = isNode
    ? { nodeId: socket.node._id }
    : { clientId: socket.user?._id };

  try {
    const session = await authorizeSignalingEvent(routingSessionId, authToken, binding);

    // Only allowed from active or negotiating state
    if (!['active', 'negotiating', 'recovering'].includes(session.status)) {
      socket.emit('webrtc:error', {
        code: 'INVALID_STATE',
        message: `ICE restart not allowed in state: ${session.status}`,
      });
      return;
    }

    // Transition to recovering first (if not already there)
    let recoveryToken = null;
    if (session.status !== 'recovering') {
      const result = await transitionRoutingSession(routingSessionId, 'recovering', {
        reason: reason || 'ICE restart requested',
        rotate: true,
      });
      recoveryToken = result.newAuthToken;
    }

    // Now check if recovery is still allowed (attemptRecovery requires 'recovering' status)
    const recovered = await attemptRecovery(routingSessionId);
    if (!recovered) {
      await failRoutingSession(routingSessionId, 'max_recovery_exceeded', 'Max ICE restart attempts reached');
      socket.emit('webrtc:error', { code: 'MAX_RECOVERY_EXCEEDED', message: 'Maximum ICE restart attempts reached' });
      relay(io, `node_${session.nodeId}`, 'webrtc:closed', { routingSessionId, reason: 'max_recovery_exceeded' });
      relay(io, `client_${session.clientId}`, 'webrtc:closed', { routingSessionId, reason: 'max_recovery_exceeded' });
      return;
    }

    // Deliver new token to both peers (if we just rotated it)
    if (recoveryToken) {
      deliverTokenRefresh(io, routingSessionId, session, recoveryToken, socket);
    }

    // Notify the other peer about the ICE restart request
    const targetRoom = isNode
      ? `client_${session.clientId}`
      : `node_${session.nodeId}`;

    relay(io, targetRoom, 'webrtc:ice_restart', {
      routingSessionId,
      initiator: isNode ? 'node' : 'client',
      reason: reason || 'ICE failure',
    });

    logger.info({ routingSessionId, isNode, reason }, 'ICE restart initiated');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:ice_restart authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Handle webrtc:dc_message
 * Relay an authorized DataChannel control message through the signaling plane.
 * Used when peers need to pass control messages before the DataChannel is open,
 * or as a fallback if the DataChannel is unavailable.
 *
 * Expected payload:
 *   { routingSessionId, authToken, message: { type, msgId, payload, sentAt } }
 */
export const handleDcMessage = async (io, socket, data) => {
  const { routingSessionId, authToken, message } = data || {};

  if (!routingSessionId || !authToken || !message) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'dc_message requires routingSessionId, authToken, message' });
    return;
  }

  if (!message.type || !message.msgId) {
    socket.emit('webrtc:error', { code: 'INVALID_MESSAGE', message: 'dc_message.message must have type and msgId' });
    return;
  }

  const isNode = !!socket.node;
  const binding = isNode
    ? { nodeId: socket.node._id }
    : { clientId: socket.user?._id };

  try {
    const session = await authorizeSignalingEvent(routingSessionId, authToken, binding);

    const targetRoom = isNode
      ? `client_${session.clientId}`
      : `node_${session.nodeId}`;

    relay(io, targetRoom, 'webrtc:dc_message', {
      routingSessionId,
      message,
      from: isNode ? 'node' : 'client',
    });

    logger.debug({ routingSessionId, msgType: message.type }, 'DC message relayed via signaling');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:dc_message authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Handle webrtc:close
 * Either peer may close the session. The session is transitioned to
 * 'completed' or 'failed' depending on the reason.
 *
 * Expected payload:
 *   { routingSessionId, authToken, reason?: string }
 */
export const handleClose = async (io, socket, data) => {
  const { routingSessionId, authToken, reason } = data || {};

  if (!routingSessionId || !authToken) {
    socket.emit('webrtc:error', { code: 'MISSING_FIELDS', message: 'close requires routingSessionId, authToken' });
    return;
  }

  const isNode = !!socket.node;
  const binding = isNode
    ? { nodeId: socket.node._id }
    : { clientId: socket.user?._id };

  try {
    const session = await authorizeSignalingEvent(routingSessionId, authToken, binding);

    const closeReason = isNode ? 'node_disconnected' : 'client_disconnected';
    await failRoutingSession(routingSessionId, closeReason, reason || '');

    // Notify both sides
    relay(io, `node_${session.nodeId}`, 'webrtc:closed', { routingSessionId, reason: closeReason });
    relay(io, `client_${session.clientId}`, 'webrtc:closed', { routingSessionId, reason: closeReason });

    logger.info({ routingSessionId, closeReason, isNode }, 'WebRTC session closed');
  } catch (err) {
    logger.warn({ err, routingSessionId }, 'webrtc:close authorization failed');
    socket.emit('webrtc:error', { code: err.code || 'AUTH_FAILED', message: err.message });
  }
};

/**
 * Register all WebRTC signaling event listeners on a socket.
 * Called once per connected socket (node or client).
 *
 * @param {Server} io  — Socket.IO server instance
 * @param {Socket} socket — Authenticated socket
 */
export const registerSignalingHandlers = (io, socket) => {
  socket.on('webrtc:offer',         (data) => handleOffer(io, socket, data));
  socket.on('webrtc:answer',        (data) => handleAnswer(io, socket, data));
  socket.on('webrtc:ice_candidate', (data) => handleIceCandidate(io, socket, data));
  socket.on('webrtc:ice_restart',   (data) => handleIceRestart(io, socket, data));
  socket.on('webrtc:dc_message',    (data) => handleDcMessage(io, socket, data));
  socket.on('webrtc:close',         (data) => handleClose(io, socket, data));
};

export default {
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  handleIceRestart,
  handleDcMessage,
  handleClose,
  registerSignalingHandlers,
};
