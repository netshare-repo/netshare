import { Worker } from "bullmq";
import TestingTask from "../models/TestingTask.js";
import TaskSession from "../models/TaskSession.js";
import NodeDevice from "../models/NodeDevice.js";
import generateSessionToken from "../utils/generateSessionToken.js";
import { findAvailableNode } from "../services/taskAllocationService.js";
import {
  sendTaskToNode,
  isNodeConnected,
  getIO,
} from "../services/socketService.js";
import {
  getRedisConnection,
  getIsRedisAvailable,
  getMemoryQueue,
} from "../services/taskQueueService.js";

let bullWorker = null;

/**
 * Core Task Allocation & Dispatch Handler
 */
export const processTaskJob = async (job) => {
  const { taskId, targetUrl, serviceType, targetRegion, executionLimit, clientId } = job.data;

  console.log(`[TaskWorker] Processing task allocation for task ${taskId} (Region: ${targetRegion})...`);

  const task = await TestingTask.findById(taskId);
  if (!task) {
    console.warn(`[TaskWorker] Task ${taskId} not found. Skipping.`);
    return { success: false, reason: "Task not found" };
  }

  // If task has already been completed, cancelled, or running, skip
  if (["completed", "running", "settled", "cancelled"].includes(task.status)) {
    console.log(`[TaskWorker] Task ${taskId} is already in state '${task.status}'.`);
    return { success: true, status: task.status };
  }

  // 1. Find optimal node based on dynamic weighted scoring and live telemetry
  const selectedNode = await findAvailableNode(targetRegion);

  if (!selectedNode) {
    console.warn(`[TaskWorker] No available node found for task ${taskId} in region ${targetRegion}. Job will be retried.`);
    task.status = "pending";
    await task.save();
    throw new Error(`No available active node found in region ${targetRegion}`);
  }

  // 2. Assign node to task in MongoDB
  task.assignedNodeId = selectedNode._id;
  task.status = "assigned";
  await task.save();

  // 3. Create or update TaskSession
  let session = await TaskSession.findOne({ taskId: task._id });
  if (!session) {
    session = await TaskSession.create({
      taskId: task._id,
      clientId: task.clientId,
      nodeId: selectedNode._id,
      sessionToken: generateSessionToken(),
      status: "created",
      logs: [
        {
          message: `Allocated to node ${selectedNode.deviceName} (${selectedNode.region}) via Real-Time Task Queue.`,
        },
      ],
    });
  } else {
    session.nodeId = selectedNode._id;
    session.status = "created";
    session.logs.push({
      message: `Reassigned to node ${selectedNode.deviceName}.`,
    });
    await session.save();
  }

  // Increment active tasks count on node
  selectedNode.currentActiveTasks = (selectedNode.currentActiveTasks || 0) + 1;
  if (selectedNode.currentActiveTasks >= selectedNode.maxConcurrentTasks) {
    selectedNode.status = "busy";
  }
  await selectedNode.save();

  // 4. Dispatch task to node via Socket.IO
  const dispatchResult = await sendTaskToNode(selectedNode._id, {
    taskId: task._id,
    targetUrl: task.targetUrl,
    serviceType: task.serviceType,
    targetRegion: task.targetRegion,
    executionLimit: task.executionLimit,
    clientId: task.clientId,
  });

  console.log(
    `[TaskWorker] Dispatched task ${task._id} to node ${selectedNode.deviceName} (${selectedNode._id}). Socket dispatch: ${
      dispatchResult.success ? "DELIVERED" : "QUEUED/OFFLINE"
    }`
  );

  // 5. Monitor timeout: Check after 15 seconds if node started the task
  setTimeout(async () => {
    try {
      const refreshedTask = await TestingTask.findById(taskId);
      if (refreshedTask && refreshedTask.status === "assigned") {
        console.warn(
          `[TaskWorker] Node ${selectedNode.deviceName} did not begin task ${taskId} within timeout. Initiating reallocation.`
        );

        // Decrement node count
        await NodeDevice.findByIdAndUpdate(selectedNode._id, {
          $inc: { currentActiveTasks: -1 },
          status: "active",
        });

        // Re-queue task
        refreshedTask.status = "pending";
        refreshedTask.assignedNodeId = null;
        await refreshedTask.save();

        const memoryQueue = getMemoryQueue();
        if (memoryQueue) {
          await memoryQueue.add("execute-testing-task", job.data, { attempts: 3 });
        }
      }
    } catch (err) {
      console.error("[TaskWorker] Timeout recovery check error:", err.message);
    }
  }, 15000);

  return {
    success: true,
    taskId: task._id,
    nodeId: selectedNode._id,
    dispatched: dispatchResult.success,
  };
};

/**
 * Initializes and starts the background task worker
 */
export const startTaskWorker = () => {
  const isRedis = getIsRedisAvailable();
  const redisConnection = getRedisConnection();

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
      const memoryQueue = getMemoryQueue();
      memoryQueue.registerHandler(processTaskJob);
    }
  } else {
    console.log("[TaskWorker] Attaching worker to Resilient In-Memory Task Queue.");
    const memoryQueue = getMemoryQueue();
    memoryQueue.registerHandler(processTaskJob);
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
