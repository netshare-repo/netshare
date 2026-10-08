import TestingTask from "../models/TestingTask.js";
import TaskSession from "../models/TaskSession.js";
import TaskResult from "../models/TaskResult.js";
import NodeDevice from "../models/NodeDevice.js";
import ParticipationSession from "../models/ParticipationSession.js";
import Wallet from "../models/Wallet.js";
import User from "../models/User.js";
import AdminLog from "../models/AdminLog.js";
import generateSessionToken from "../utils/generateSessionToken.js";
import { findAvailableNode } from "../services/taskAllocationService.js";
import { deductCredits, addCredits } from "../services/walletService.js";
import { enqueueTask } from "../services/taskQueueService.js";
import { calculateReward } from "../services/rewardService.js";
import BandwidthUsage from "../models/BandwidthUsage.js";
import { estimateTaskPrice } from "../services/pricingService.js";
import { runTransaction } from '../lib/mongoTransaction.js';
import { validateTarget } from '../services/targetValidationService.js';

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const getClientDashboard = async (req, res) => {
  try {
    const activeTasks = await TestingTask.countDocuments({
      clientId: req.user._id,
      status: { $in: ["pending", "assigned", "running"] },
    });

    const completedTasks = await TestingTask.countDocuments({
      clientId: req.user._id,
      status: { $in: ["completed", "settled"] },
    });

    const wallet = await Wallet.findOne({ userId: req.user._id });

    return res.json({
      activeTasks,
      completedTasks,
      availableCredits: wallet?.balance || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch client dashboard",
      error: error.message,
    });
  }
};

export const createTask = async (req, res) => {
  try {
    const { targetUrl, serviceType, targetRegion, executionLimit } = req.body;

    if (!targetUrl || !serviceType || !targetRegion || !executionLimit) {
      return res.status(400).json({
        message:
          "targetUrl, serviceType, targetRegion and executionLimit are required",
      });
    }

    if (!isValidUrl(targetUrl)) {
      return res.status(400).json({ message: "Invalid target URL" });
    }
    const targetCheck = await validateTarget(targetUrl);
    if (!targetCheck.valid) return res.status(400).json({ message: `Target rejected: ${targetCheck.reason}` });

    const pricing = await estimateTaskPrice({
      targetRegion,
      executionLimit: Number(executionLimit),
    });
    const estimatedCost = pricing.quote.totalCredits;

    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet || wallet.balance < estimatedCost) {
      return res.status(400).json({
        message: "Insufficient credits. Please add credits to your wallet.",
      });
    }

    const task = await runTransaction(async session => {
    const [task] = await TestingTask.create([{
      clientId: req.user._id,
      targetUrl,
      serviceType,
      targetRegion,
      executionLimit,
      estimatedCost,
      pricingSnapshot: pricing.quote,
      status: "pending",
    }], { session });
    await deductCredits({
      userId: req.user._id,
      taskId: task._id,
      amount: estimatedCost,
      description: `Task submission cost deducted for ${serviceType}`,
      idempotencyKey: `task-submission:${task._id}`,
      session,
    });
    return task;
    });

    // Enqueue task into Redis/in-memory Task Queue for real-time allocation
    let queueResult;
    try { queueResult = await enqueueTask(task); }
    catch { queueResult = { queueType: 'persistent-pending', jobId: null }; }

    // Log audit record
    try {
      await AdminLog.create({
        adminId: req.user._id,
        action: "CREATE_TASK",
        details: `Task created & queued: ${serviceType} on ${targetUrl} (Cost: ${estimatedCost}, Queue: ${queueResult.queueType})`,
        ipAddress: req.ip || "",
      });
    } catch {
      // Non-blocking log failure
    }

    return res.status(201).json({
      message: "Task submitted and queued for real-time edge node execution",
      task,
      queue: queueResult,
      pricing,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Task creation failed",
      error: error.message,
    });
  }
};

export const estimateTaskCost = async (req, res) => {
  try {
    const { targetRegion, executionLimit } = req.body;
    const limit = Number(executionLimit);

    if (typeof targetRegion !== "string" || !targetRegion.trim() || targetRegion.length > 80) {
      return res.status(400).json({
        message: "Target region must be between 1 and 80 characters",
      });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        message: "Execution limit must be an integer between 1 and 100",
      });
    }

    const pricing = await estimateTaskPrice({
      targetRegion: targetRegion.trim(),
      executionLimit: limit,
    });
    return res.json(pricing);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to estimate task cost",
      error: error.message,
    });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const tasks = await TestingTask.find({ clientId: req.user._id })
      .populate("assignedNodeId", "userId deviceName region status ratingAverage ratingCount")
      .sort({ createdAt: -1 });

    return res.json({ tasks });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const task = await TestingTask.findById(req.params.id)
      .populate("clientId", "name email")
      .populate("assignedNodeId", "userId deviceName region status ratingAverage ratingCount");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isOwner = task.clientId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    const isNode =
      task.assignedNodeId &&
      task.assignedNodeId.userId &&
      task.assignedNodeId.userId.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isNode) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await TaskResult.findOne({ taskId: task._id });

    return res.json({ task, result });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch task",
      error: error.message,
    });
  }
};

const csvCell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const downloadTaskReport = async (req, res) => {
  try {
    const task = await TestingTask.findById(req.params.id)
      .populate("clientId", "name email")
      .populate("assignedNodeId", "deviceName region ratingAverage ratingCount");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const clientId = task.clientId?._id || task.clientId;
    const isOwner = clientId.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    if (!["completed", "settled"].includes(task.status)) {
      return res.status(409).json({
        message: "Report is available only after task completion",
      });
    }

    const result = await TaskResult.findOne({ taskId: task._id });
    if (!result) {
      return res.status(409).json({ message: "Task result is not report-ready" });
    }

    const headers = [
      "taskId",
      "serviceType",
      "targetUrl",
      "targetRegion",
      "status",
      "executionLimit",
      "creditsConsumed",
      "pricingVersion",
      "nodeId",
      "nodeName",
      "success",
      "successRate",
      "latencyMs",
      "packetLoss",
      "bandwidthUsedMB",
      "statusCode",
      "completedAt",
      "clientRating",
      "ratingComment",
    ];
    const row = [
      task._id,
      task.serviceType,
      task.targetUrl,
      task.targetRegion,
      task.status,
      task.executionLimit,
      task.estimatedCost,
      task.pricingSnapshot?.version || "legacy",
      task.assignedNodeId?._id || "",
      task.assignedNodeId?.deviceName || "",
      result.success,
      result.successRate,
      result.latencyMs,
      result.packetLoss,
      result.bandwidthUsedMB,
      result.statusCode,
      result.completedAt?.toISOString?.() || result.completedAt,
      task.clientRating?.rating || "",
      task.clientRating?.comment || "",
    ];
    const csv = `${headers.map(csvCell).join(",")}\r\n${row
      .map(csvCell)
      .join(",")}\r\n`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="netshare-task-${task._id}.csv"`
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to generate task report",
      error: error.message,
    });
  }
};

export const rateTaskNode = async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be an integer from 1 to 5" });
  }
  if (comment.length > 500) {
    return res.status(400).json({ message: "Rating comment cannot exceed 500 characters" });
  }

  let ratedTask = null;
  try {
    ratedTask = await TestingTask.findOneAndUpdate(
      {
        _id: req.params.id,
        clientId: req.user._id,
        assignedNodeId: { $ne: null },
        status: { $in: ["completed", "settled"] },
        "clientRating.rating": { $exists: false },
      },
      {
        $set: {
          clientRating: { rating, comment, ratedAt: new Date() },
        },
      },
      { new: true }
    );

    if (!ratedTask) {
      const task = await TestingTask.findById(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.clientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Only the owning client can rate this task" });
      }
      if (!["completed", "settled"].includes(task.status)) {
        return res.status(409).json({ message: "Only completed tasks can be rated" });
      }
      if (task.clientRating?.rating) {
        return res.status(409).json({ message: "This task has already been rated" });
      }
      return res.status(409).json({ message: "Task cannot be rated" });
    }

    const node = await NodeDevice.findOneAndUpdate(
      { _id: ratedTask.assignedNodeId },
      [
        {
          $set: {
            ratingTotal: { $add: [{ $ifNull: ["$ratingTotal", 0] }, rating] },
            ratingCount: { $add: [{ $ifNull: ["$ratingCount", 0] }, 1] },
            ratingAverage: {
              $round: [
                {
                  $divide: [
                    { $add: [{ $ifNull: ["$ratingTotal", 0] }, rating] },
                    { $add: [{ $ifNull: ["$ratingCount", 0] }, 1] },
                  ],
                },
                2,
              ],
            },
            reliabilityScore: {
              $round: [
                {
                  $min: [
                    100,
                    {
                      $max: [
                        0,
                        {
                          $add: [
                            { $multiply: [{ $ifNull: ["$reliabilityScore", 100] }, 0.98] },
                            rating * 20 * 0.02,
                          ],
                        },
                      ],
                    },
                  ],
                },
                2,
              ],
            },
          },
        },
      ],
      { new: true }
    );

    if (!node) {
      await TestingTask.updateOne(
        { _id: ratedTask._id, "clientRating.ratedAt": ratedTask.clientRating.ratedAt },
        { $unset: { clientRating: 1 } }
      );
      return res.status(404).json({ message: "Assigned node not found" });
    }

    return res.status(201).json({
      message: "Node rating recorded",
      rating: ratedTask.clientRating,
      nodeRating: {
        average: node.ratingAverage,
        count: node.ratingCount,
        reliabilityScore: node.reliabilityScore,
      },
    });
  } catch (error) {
    if (ratedTask) {
      await TestingTask.updateOne(
        { _id: ratedTask._id, "clientRating.ratedAt": ratedTask.clientRating.ratedAt },
        { $unset: { clientRating: 1 } }
      ).catch(() => {});
    }
    return res.status(500).json({
      message: "Failed to record node rating",
      error: error.message,
    });
  }
};

export const startTask = async (req, res) => {
  try {
    const task = await TestingTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!task.assignedNodeId) {
      return res.status(400).json({ message: "No node assigned to this task" });
    }

    task.status = "running";
    await task.save();

    const session = await TaskSession.findOne({ taskId: task._id });

    if (session) {
      session.status = "running";
      session.logs.push({
        message: "Controlled task execution started.",
      });
      await session.save();
    }

    return res.json({
      message: "Task started successfully",
      task,
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to start task",
      error: error.message,
    });
  }
};

export const completeTask = async (req, res) => {
  let task = null;
  let node = null;
  let nodeUser = null;
  const initialTaskStatus = "running";

  try {
    const {
      bandwidthUsedMB = 50,
      latencyMs = 120,
      packetLoss = 0,
      successRate = 100,
      statusCode = 200,
      resultData = {},
    } = req.body;

    task = await TestingTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!task.assignedNodeId) {
      return res.status(400).json({ message: "No assigned node found" });
    }

    node = await NodeDevice.findById(task.assignedNodeId);

    if (!node) {
      return res.status(404).json({ message: "Assigned node not found" });
    }

    nodeUser = await User.findById(node.userId);

    // 1. Create immutable TaskResult
    const taskResult = await TaskResult.create({
      taskId: task._id,
      nodeId: node._id,
      clientId: task.clientId,
      nodeUserId: node.userId,
      serviceType: task.serviceType,
      targetUrl: task.targetUrl,
      success: true,
      successRate: Number(successRate),
      latencyMs: Number(latencyMs),
      packetLoss: Number(packetLoss),
      bandwidthUsedMB: Number(bandwidthUsedMB),
      statusCode: Number(statusCode),
      resultData: resultData || { message: "Task verified successfully" },
      completedAt: new Date(),
    });

    // 2. Update task state -> completed then settled
    task.status = "completed";
    task.resultSummary = {
      successRate: Number(successRate),
      averageResponseTimeMs: Number(latencyMs),
      bandwidthConsumedMB: Number(bandwidthUsedMB),
      message: "Task completed and verified.",
    };
    await task.save();

    // 3. Dynamic reward calculation (Bandwidth * Quality * Region Factor)
    const rewardCalculation = calculateReward({
      bandwidthUsedMB: Number(bandwidthUsedMB),
      node,
      targetRegion: task.targetRegion,
    });
    const nodeReward = Math.max(1, rewardCalculation.reward);

    await addCredits({
      userId: node.userId,
      taskId: task._id,
      amount: nodeReward,
      description: `Node dynamic reward for task ${task._id} (${bandwidthUsedMB}MB processed)`,
      withdrawable: true,
    });

    // Record BandwidthUsage
    await BandwidthUsage.create({
      nodeId: node._id,
      taskId: task._id,
      uploadBandwidthMB: 0,
      downloadBandwidthMB: Number(bandwidthUsedMB),
      totalBandwidthMB: Number(bandwidthUsedMB),
      networkAvailability: "available",
      timestamp: new Date(),
    });

    // Mark task settled
    task.status = "settled";
    await task.save();

    // 4. Update TaskSession logs and status
    const session = await TaskSession.findOne({ taskId: task._id });
    if (session) {
      session.status = "completed";
      session.bandwidthUsedMB = Number(bandwidthUsedMB);
      session.latencyMs = Number(latencyMs);
      session.logs.push({
        message: `Task completed successfully. Reward settled: ${nodeReward} credits.`,
      });
      await session.save();
    }

    // 5. Update Node Device telemetry & active task counts
    node.usedBandwidthMB = (node.usedBandwidthMB || 0) + Number(bandwidthUsedMB);
    node.currentActiveTasks = Math.max(0, (node.currentActiveTasks || 1) - 1);
    node.latencyMs = Number(latencyMs);
    node.lastSeenAt = new Date();

    if (node.status === "busy") {
      node.status = "active";
    }
    await node.save();

    // 6. Update active ParticipationSession if present
    const activePartSession = await ParticipationSession.findOne({
      deviceId: node._id,
      status: "active",
    }).sort({ createdAt: -1 });

    if (activePartSession) {
      activePartSession.bandwidthUsed =
        (activePartSession.bandwidthUsed || 0) + Number(bandwidthUsedMB);
      activePartSession.bandwidthUsedMB = activePartSession.bandwidthUsed;
      activePartSession.creditsEarned =
        (activePartSession.creditsEarned || 0) + nodeReward;
      activePartSession.activeTasksCount = node.currentActiveTasks;
      await activePartSession.save();
    }

    // 7. Audit log for settlement
    try {
      await AdminLog.create({
        adminId: req.user._id,
        action: "TASK_SETTLEMENT",
        details: `Task ${task._id} settled. Rewarded Node User ${node.userId} with ${nodeReward} credits.`,
        ipAddress: req.ip || "",
      });
    } catch {
      // Non-blocking
    }

    return res.json({
      message: "Task completed and settled successfully",
      task,
      result: taskResult,
      session,
      settlement: {
        nodeParticipantId: nodeUser?._id,
        nodeParticipantName: nodeUser?.name,
        rewardCredits: nodeReward,
        status: "settled",
      },
    });
  } catch (error) {
    // Safe Error & Rollback Handling
    if (task && task.status !== "settled") {
      task.status = initialTaskStatus;
      await task.save().catch(() => {});
    }

    try {
      await AdminLog.create({
        adminId: req.user?._id,
        action: "TASK_SETTLEMENT_ERROR",
        details: `Settlement failed for task ${req.params.id}: ${error.message}`,
        ipAddress: req.ip || "",
      });
    } catch {
      // Non-blocking
    }

    return res.status(500).json({
      message: "Failed to complete and settle task",
      error: error.message,
    });
  }
};

export const failTask = async (req, res) => {
  try {
    const { reason = "Task failed during execution" } = req.body;

    const task = await TestingTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.status = "failed";
    task.resultSummary = {
      successRate: 0,
      averageResponseTimeMs: 0,
      bandwidthConsumedMB: 0,
      message: reason,
    };
    await task.save();

    // Create a failed TaskResult record
    if (task.assignedNodeId) {
      const node = await NodeDevice.findById(task.assignedNodeId);
      if (node) {
        await TaskResult.create({
          taskId: task._id,
          nodeId: node._id,
          clientId: task.clientId,
          nodeUserId: node.userId,
          serviceType: task.serviceType,
          targetUrl: task.targetUrl,
          success: false,
          successRate: 0,
          latencyMs: 0,
          packetLoss: 100,
          bandwidthUsedMB: 0,
          statusCode: 500,
          resultData: { error: reason },
          completedAt: new Date(),
        });

        node.currentActiveTasks = Math.max(0, (node.currentActiveTasks || 1) - 1);
        if (node.status === "busy") node.status = "active";
        await node.save();
      }
    }

    const session = await TaskSession.findOne({ taskId: task._id });
    if (session) {
      session.status = "failed";
      session.logs.push({
        message: `Task failed: ${reason}`,
      });
      await session.save();
    }

    return res.json({
      message: "Task marked as failed",
      task,
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to mark task as failed",
      error: error.message,
    });
  }
};
