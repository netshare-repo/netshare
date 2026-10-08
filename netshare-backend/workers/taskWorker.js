import { Worker } from "bullmq";
import TestingTask from "../models/TestingTask.js";
import TaskSession from "../models/TaskSession.js";
import NodeDevice from "../models/NodeDevice.js";
import generateSessionToken from "../utils/generateSessionToken.js";
import { rankEligibleNodes } from "../services/taskAllocationService.js";
import { getIO } from "../services/socketService.js";
import {
  startAndroidSecureRouting,
  abortAndroidSecureRouting,
} from "../services/secureTaskRoutingService.js";
import {
  getRedisConnection,
  getIsRedisAvailable,
  getMemoryQueue,
  enqueueTask,
} from "../services/taskQueueService.js";
import { isNodeConnected } from "../services/socketService.js";
import { HEALTH_CONFIG } from "../lib/nodeHealth.js";
import { claimTaskOnNode, releaseUnstartedAssignment } from '../services/allocationClaimService.js';
import { handleTaskFailure } from '../services/secureTaskRoutingService.js';

let bullWorker = null;

/**
 * Core Task Allocation & Dispatch Handler
 */
export const processTaskJob = async (job) => {
  const { taskId, targetRegion } = job.data;

  console.log(`[TaskWorker] Processing task allocation for task ${taskId} (Region: ${targetRegion})...`);

  const task = await TestingTask.findById(taskId);
  if (!task) {
    console.warn(`[TaskWorker] Task ${taskId} not found. Skipping.`);
    return { success: false, reason: "Task not found" };
  }

  // If task has already been completed, cancelled, or running, skip
  if (task.status !== "pending") {
    console.log(`[TaskWorker] Task ${taskId} is already in state '${task.status}'.`);
    return { success: true, status: task.status };
  }

  // ML and JS fallback only return nodes that passed the same eligibility gate.
  const ranking = await rankEligibleNodes(task.targetRegion);
  if (ranking.nodes.length === 0) {
    console.warn(`[TaskWorker] No available node found for task ${taskId} in region ${targetRegion}. Job will be retried.`);
    throw new Error(`No available active node found in region ${targetRegion}`);
  }

  const io = getIO();
  if (!io) throw new Error("Socket signaling server is unavailable");

  let selectedNode = null;
  let assignedTask = null;
  for (const candidate of ranking.nodes) {
    if (!isNodeConnected(candidate._id)) continue;
    const claimed = await claimTaskOnNode(taskId, candidate._id, task.targetRegion);
    if (claimed) {
      assignedTask = claimed.task;
      selectedNode = claimed.node;
      break;
    }
    const current = await TestingTask.findById(taskId).select('status');
    if (current?.status !== 'pending') return { success: true, status: 'already_assigned' };
  }

  if (!selectedNode) throw new Error(`No eligible node capacity remained for task ${taskId}`);
  console.log(`[TaskWorker] Selected node ${selectedNode._id} via ${ranking.source}.`);

  // 3. Create or update TaskSession
  let dispatchResult;
  try {
  let session = await TaskSession.findOne({ taskId: assignedTask._id });
  if (!session) {
    session = await TaskSession.create({
      taskId: assignedTask._id,
      clientId: assignedTask.clientId,
      nodeId: selectedNode._id,
      sessionToken: generateSessionToken(),
      status: "created",
      logs: [
        {
          message: `Allocated to node ${selectedNode.deviceName} (${selectedNode.region}) via ${ranking.source}.`,
        },
      ],
    });
  } else {
    session.nodeId = selectedNode._id;
    session.status = "created";
    session.logs.push({
      message: `Reassigned to node ${selectedNode.deviceName} via ${ranking.source}.`,
    });
    await session.save();
  }

  // 4. Create a bound RoutingSession and negotiate a reliable WebRTC
  // DataChannel. Socket.IO carries signaling only; no task payload fallback.
  dispatchResult = await startAndroidSecureRouting({
    taskId: assignedTask._id,
    clientId: assignedTask.clientId,
    nodeId: selectedNode._id,
    emitToNode: (event, payload) => {
      io.to(`node_${selectedNode._id}`).emit(event, payload);
    },
  });
  } catch (error) {
    await handleTaskFailure(null, assignedTask._id, 'allocation_dispatch_failed', error.message);
    throw error;
  }

  console.log(
    `[TaskWorker] Started secure Android route ${dispatchResult.routingSessionId} for task ${assignedTask._id} on node ${selectedNode.deviceName}.`
  );

  // Retry only an assignment that has not started within 45 seconds.
  const assignmentTimer = setTimeout(async () => {
    try {
      const released = await releaseUnstartedAssignment(taskId, selectedNode._id, dispatchResult.routingSessionId);
      if (released) {
        console.warn(
          `[TaskWorker] Node ${selectedNode.deviceName} did not begin task ${taskId} within timeout. Initiating reallocation.`
        );

        await abortAndroidSecureRouting(dispatchResult.routingSessionId, 'datachannel_open_timeout');

        await enqueueTask(released);
      }
    } catch (err) {
      console.error("[TaskWorker] Timeout recovery check error:", err.message);
    }
  }, 45000);
  assignmentTimer.unref?.();

  return {
    success: true,
    taskId: assignedTask._id,
    nodeId: selectedNode._id,
    dispatched: true,
    routingSessionId: dispatchResult.routingSessionId,
    selectionSource: ranking.source,
  };
};

/**
 * Initializes and starts the background task worker
 */
export const startTaskWorker = () => {
  const isRedis = getIsRedisAvailable();
  const redisConnection = getRedisConnection();
  // Available for bounded fallback if Redis drops after startup.
  const memoryQueue = getMemoryQueue();
  if (!memoryQueue.handlers.includes(processTaskJob)) memoryQueue.registerHandler(processTaskJob);

  if (isRedis && redisConnection) {
    try {
      bullWorker = new Worker(
        "task-queue",
        async (job) => {
          return await processTaskJob(job);
        },
        {
          connection: redisConnection,
          concurrency: 5,
        }
      );

      bullWorker.on("completed", (job) => {
        console.log(`[TaskWorker] BullMQ Job ${job.id} completed successfully.`);
      });

      bullWorker.on("failed", (job, err) => {
        console.error(`[TaskWorker] BullMQ Job ${job?.id} failed:`, err.message);
      });

      console.log("[TaskWorker] BullMQ worker initialized and listening on Redis queue.");
    } catch (error) {
      console.error("[TaskWorker] Failed to start BullMQ worker, attaching to in-memory queue:", error.message);
      // Handler already registered on the fallback queue.
    }
  } else {
    console.log("[TaskWorker] Attaching worker to Resilient In-Memory Task Queue.");
    // Handler already registered on the fallback queue.
  }
};

export const stopTaskWorker = async () => {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
  }
};

export default {
  startTaskWorker,
  stopTaskWorker,
  processTaskJob,
};
