/**
 * secureTaskRoutingService.js
 *
 * Real Controlled Task Routing Coordinator (Phase 2D).
 * Implements the end-to-end secure path:
 *   TestingTask → RoutingSession → WebRTC DataChannel → Node VpnService TUN → Settlement
 *
 * Key guarantees:
 * 1. Strict task authorization: only authorized host, port, method are dispatched.
 * 2. Independent node & backend SSRF filtering (blocks 127.0.0.1, RFC1918, metadata, unsafe redirects).
 * 3. Atomic, idempotent credit settlement and TaskResult persistence (exactly once).
 * 4. Safe timeout, disconnect, and failure teardown (RoutingSession + WebRTC peer resources).
 * 5. Zero simulated / fake VPN channels.
 */

import { URL } from 'url';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import TaskSession from '../models/TaskSession.js';
import RoutingSession from '../models/RoutingSession.js';
import NodeDevice from '../models/NodeDevice.js';
import BandwidthUsage from '../models/BandwidthUsage.js';
import {
  createRoutingSession,
  transitionRoutingSession,
  failRoutingSession,
  authorizeSignalingEvent,
} from './routingSessionService.js';
import {
  createPeer,
  createOffer,
  setRemoteAnswer,
  addRemoteIceCandidate,
  sendMessage,
  closePeer,
} from './webrtcPeerService.js';
import {
  validateTarget,
  validateTaskExecutionTarget,
  validateRedirect,
} from './targetValidationService.js';
import { calculateReward } from './rewardService.js';
import { addCredits } from './walletService.js';
import logger from '../lib/logger.js';
import config from '../config/env.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { settleTaskResult } from './taskSettlementService.js';

// Global settlement lock / set to prevent race conditions during duplicate settlement calls
const androidRouteContexts = new Map();

/**
 * Prepares and validates an authorized task envelope for dispatch.
 * Enforces authorized host, port, method, and SSRF blocks.
 *
 * @param {string} taskId
 * @param {string} clientId
 * @param {string} nodeId
 * @returns {Promise<{ task: object, session: object, authToken: string, taskEnvelope: object }>}
 */
export const prepareAuthorizedTaskSession = async ({ taskId, clientId, nodeId }) => {
  const task = await TestingTask.findById(taskId);
  if (!task) {
    throw Object.assign(new Error(`Task ${taskId} not found`), { code: 'TASK_NOT_FOUND' });
  }

  if (task.clientId.toString() !== clientId.toString()) {
    throw Object.assign(new Error('Task client mismatch'), { code: 'CLIENT_MISMATCH' });
  }

  // 1. Strict target security validation before dispatch
  const validation = await validateTarget(task.targetUrl);
  if (!validation.valid) {
    throw Object.assign(new Error(`Target security validation failed: ${validation.reason}`), {
      code: 'SECURITY_REJECTED',
      reason: validation.reason,
    });
  }

  const parsedUrl = new URL(task.targetUrl);
  const authorizedHost = parsedUrl.hostname.toLowerCase();
  const defaultPort = parsedUrl.protocol === 'https:' ? 443 : 80;
  const authorizedPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort;
  const authorizedMethod = 'GET';

  // 2. Create or bind RoutingSession
  const { session, authToken } = await createRoutingSession({
    taskId: task._id,
    nodeId,
    clientId,
  });

  // 3. Build immutable task authorization envelope
  const taskEnvelope = {
    taskId: task._id.toString(),
    routingSessionId: session._id.toString(),
    targetUrl: task.targetUrl,
    authorizedHost,
    authorizedPort,
    authorizedMethod,
    serviceType: task.serviceType || 'performance_testing',
    executionLimit: task.executionLimit || 1,
    timeoutMs: 25000,
    issuedAt: new Date().toISOString(),
  };

  return { task, session, authToken, taskEnvelope };
};

/**
 * Dispatches an authorized task over an active WebRTC DataChannel.
 *
 * @param {string} routingSessionId
 * @param {object} taskEnvelope
 * @returns {Promise<{ success: boolean, msgId: string }>}
 */
export const dispatchTaskOverDataChannel = async (routingSessionId, taskEnvelope) => {
  const msgId = await sendMessage(routingSessionId, 'task_request', taskEnvelope);
  logger.info({ routingSessionId, taskId: taskEnvelope.taskId, msgId }, 'Task dispatched over WebRTC DataChannel');
  return { success: true, msgId };
};

/**
 * Starts the production Android execution path. Socket.IO is used only as the
 * authenticated signaling carrier; task data and results are DataChannel-only.
 */
export const startAndroidSecureRouting = async ({ taskId, clientId, nodeId, emitToNode }) => {
  const prepared = await prepareAuthorizedTaskSession({ taskId, clientId, nodeId });
  const routingSessionId = prepared.session._id.toString();

  const context = {
    taskId: prepared.task._id.toString(),
    nodeId: nodeId.toString(),
    taskEnvelope: prepared.taskEnvelope,
    authToken: prepared.authToken,
    emitToNode,
    completed: false,
  };
  androidRouteContexts.set(routingSessionId, context);

  try {
    createPeer(routingSessionId, {
      onIceCandidate: ({ candidate, mid }) => {
        emitToNode('secure_route:ice_candidate', {
          routingSessionId,
          candidate,
          mid,
        });
      },
      onOpen: async () => {
        try {
          const claimed = await TestingTask.findOneAndUpdate(
            { _id: context.taskId, assignedNodeId: nodeId, status: 'assigned' },
            { status: 'running' }
          );
          if (!claimed) {
            await abortAndroidSecureRouting(routingSessionId, 'task_no_longer_assigned');
            return;
          }
          await TaskSession.findOneAndUpdate(
            { taskId: context.taskId },
            {
              status: 'running',
              $push: { logs: { message: 'Android WebRTC DataChannel opened; secure task dispatched.' } },
            }
          );
          await dispatchTaskOverDataChannel(routingSessionId, context.taskEnvelope);
        } catch (error) {
          await handleTaskFailure(routingSessionId, context.taskId, 'datachannel_dispatch_failed', error.message);
          androidRouteContexts.delete(routingSessionId);
        }
      },
      onMessage: async ({ msg }) => {
        if (msg.type !== 'task_result') return;
        try {
          // Receipt acknowledgement is sent before settlement closes the peer.
          await sendMessage(routingSessionId, 'ack', { receivedMsgId: msg.msgId });
          const outcome = await settleTaskResult(routingSessionId, msg.payload);
          context.completed = true;
          emitToNode('secure_route:settled', {
            routingSessionId,
            taskId: context.taskId,
            settled: outcome.settled,
          });
        } catch (error) {
          await handleTaskFailure(routingSessionId, context.taskId, 'task_result_rejected', error.message);
          emitToNode('secure_route:error', {
            routingSessionId,
            code: error.code || 'SETTLEMENT_FAILED',
            message: error.message,
          });
        } finally {
          androidRouteContexts.delete(routingSessionId);
        }
      },
      onError: async (error) => {
        if (context.completed || !androidRouteContexts.has(routingSessionId)) return;
        await handleTaskFailure(
          routingSessionId,
          context.taskId,
          error.code || 'webrtc_failure',
          error.message || ''
        );
        androidRouteContexts.delete(routingSessionId);
      },
      onClose: async () => {
        if (context.completed || !androidRouteContexts.has(routingSessionId)) return;
        androidRouteContexts.delete(routingSessionId);
        await handleTaskFailure(routingSessionId, context.taskId, 'datachannel_closed');
      },
    });

    await transitionRoutingSession(routingSessionId, 'negotiating', {
      reason: 'Backend offer created for Android secure node',
      rotate: false,
    });
    const sdp = await createOffer(routingSessionId);
    emitToNode('secure_route:offer', {
      routingSessionId,
      authToken: prepared.authToken,
      sdp,
      iceServers: config.webrtc.iceServers,
    });

    return { ...prepared, routingSessionId };
  } catch (error) {
    androidRouteContexts.delete(routingSessionId);
    closePeer(routingSessionId, 'android_route_start_failed');
    await handleTaskFailure(routingSessionId, context.taskId, 'webrtc_start_failed', error.message);
    throw error;
  }
};

export const acceptAndroidSecureAnswer = async ({ routingSessionId, authToken, sdp, nodeId }) => {
  const context = androidRouteContexts.get(routingSessionId);
  if (!context) throw Object.assign(new Error('Android route context not found'), { code: 'ROUTE_NOT_FOUND' });
  await authorizeSignalingEvent(routingSessionId, authToken, { nodeId });
  await setRemoteAnswer(routingSessionId, sdp);
  const session = await RoutingSession.findById(routingSessionId);
  if (session?.status === 'negotiating') {
    await transitionRoutingSession(routingSessionId, 'active', {
      reason: 'Android SDP answer applied',
      rotate: false,
    });
  }
};

export const acceptAndroidSecureIceCandidate = async ({
  routingSessionId,
  authToken,
  candidate,
  mid,
  nodeId,
}) => {
  if (!androidRouteContexts.has(routingSessionId)) {
    throw Object.assign(new Error('Android route context not found'), { code: 'ROUTE_NOT_FOUND' });
  }
  await authorizeSignalingEvent(routingSessionId, authToken, { nodeId });
  await addRemoteIceCandidate(routingSessionId, candidate, mid || '0');
};

export const abortAndroidSecureRouting = async (routingSessionId, reason = 'route_aborted') => {
  const context = androidRouteContexts.get(routingSessionId);
  if (!context) return false;
  androidRouteContexts.delete(routingSessionId);
  closePeer(routingSessionId, reason);
  try {
    await failRoutingSession(routingSessionId, reason, 'Secure Android route closed before completion');
  } catch (_) {}
  return true;
};

export const abortAndroidRoutesForNode = async (nodeId, reason = 'node_disconnected') => {
  const matches = [...androidRouteContexts.entries()]
    .filter(([, context]) => context.nodeId === nodeId.toString());
  for (const [routingSessionId, context] of matches) {
    androidRouteContexts.delete(routingSessionId);
    await handleTaskFailure(routingSessionId, context.taskId, reason);
  }
  return matches.length;
};

/**
 * Handles incoming task_result message received via WebRTC DataChannel or signaling.
 * Enforces EXACTLY-ONCE settlement and TaskResult persistence.
 *
 * @param {string} routingSessionId
 * @param {object} resultPayload
 * @returns {Promise<{ taskResult: object, settled: boolean }>}
 */
export { settleTaskResult } from './taskSettlementService.js';

/**
 * Handles task failure cleanly, ensuring resources are freed and status is recorded.
 *
 * @param {string} routingSessionId
 * @param {string} taskId
 * @param {string} reason
 * @param {string} [detail]
 */
export const handleTaskFailure = async (routingSessionId, taskId, reason, detail = '') => {
  try {
    await runTransaction(async transaction => {
      const task = taskId ? await TestingTask.findById(taskId).session(transaction) : null;
      const route = routingSessionId ? await RoutingSession.findById(routingSessionId).session(transaction) : null;
      // Terminal states are immutable; late failure/duplicate events do not
      // release another task's capacity or overwrite a successful settlement.
      if (!task || !['assigned', 'running'].includes(task.status)) return;
      if (route && (String(route.taskId) !== String(task._id) ||
        String(route.nodeId) !== String(task.assignedNodeId))) return;
      task.status = 'failed';
      task.resultSummary = { message: `Task failed: ${reason}. ${detail}` };
      await task.save({ session: transaction });
      await TaskSession.updateOne({ taskId }, { $set: { status: 'failed' },
        $push: { logs: { message: task.resultSummary.message } } }, { session: transaction });
      if (route && !['completed', 'failed', 'expired'].includes(route.status)) {
        const previous = route.status;
        route.status = 'failed';
        route.endedAt = new Date();
        route.closeReason = reason === 'node_disconnected' ? reason : 'task_failed';
        route.failureDetail = reason;
        route.stateHistory.push({ from: previous, to: 'failed', reason, timestamp: new Date() });
        await route.save({ session: transaction });
      }
      const node = await NodeDevice.findById(task.assignedNodeId).session(transaction);
      if (node) {
        node.currentActiveTasks = Math.max(0, node.currentActiveTasks - 1);
        if (['active', 'busy'].includes(node.status)) node.status =
          node.currentActiveTasks >= node.maxConcurrentTasks ? 'busy' : 'active';
        await node.save({ session: transaction });
      }
    });
  } finally {
    if (routingSessionId) closePeer(String(routingSessionId), `task_failure: ${reason}`);
  }
};

export default {
  prepareAuthorizedTaskSession,
  dispatchTaskOverDataChannel,
  startAndroidSecureRouting,
  acceptAndroidSecureAnswer,
  acceptAndroidSecureIceCandidate,
  abortAndroidSecureRouting,
  abortAndroidRoutesForNode,
  settleTaskResult,
  handleTaskFailure,
};
