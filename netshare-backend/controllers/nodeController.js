import crypto from "crypto";
import NodeDevice from "../models/NodeDevice.js";
import ParticipationSession from "../models/ParticipationSession.js";
import TaskSession from "../models/TaskSession.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Wallet from "../models/Wallet.js";
import NodeTelemetry from "../models/NodeTelemetry.js";
import NodeHeartbeat from "../models/NodeHeartbeat.js";
import BandwidthUsage from "../models/BandwidthUsage.js";
import logger from '../lib/logger.js';

const generateSessionId = () =>
  `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

/**
 * Register a new node device for the authenticated user
 */
export const registerNode = async (req, res) => {
  try {
    const {
      deviceName,
      deviceId,
      deviceFingerprint,
      region,
      bandwidthLimitMB = 2048,
      uploadSpeedCapMbps = 5,
      downloadSpeedCapMbps = 10,
      speedCapMbps,
      maxConcurrentTasks = 1,
    } = req.body;

    if (!deviceName || !region) {
      return res.status(400).json({
        message: "deviceName and region are required",
      });
    }

    const existingNode = await NodeDevice.findOne({ userId: req.user._id });

    if (existingNode) {
      return res.status(400).json({
        message: "A node device is already registered for this account",
        node: existingNode,
      });
    }

    const node = await NodeDevice.create({
      userId: req.user._id,
      deviceName,
      deviceId: deviceId || deviceFingerprint || `dev_${Date.now().toString(36)}`,
      deviceFingerprint: deviceFingerprint || deviceId || "",
      region,
      bandwidthLimitMB: Number(bandwidthLimitMB),
      uploadSpeedCapMbps: Number(uploadSpeedCapMbps || speedCapMbps || 5),
      downloadSpeedCapMbps: Number(downloadSpeedCapMbps || speedCapMbps || 10),
      speedCapMbps: Number(downloadSpeedCapMbps || speedCapMbps || 10),
      maxConcurrentTasks: Number(maxConcurrentTasks) || 1,
      status: "inactive",
      reliabilityScore: 100,
      successRate: 100,
      lastSeenAt: new Date(),
    });

    return res.status(201).json({
      message: "Node device registered successfully",
      node,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Node registration failed",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/dashboard
 * Aggregated metrics for node participant dashboard
 */
export const getNodeDashboard = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({
        message: "No node registered for this user",
        isRegistered: false,
      });
    }

    // Update heartbeat
    node.lastSeenAt = new Date();
    await node.save();

    // Calculate credits earned today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTransactions = await CreditTransaction.find({
      userId: req.user._id,
      type: "credit",
      createdAt: { $gte: startOfToday },
    });

    const creditsEarnedToday = todayTransactions.reduce(
      (sum, tx) => sum + (tx.amount || 0),
      0
    );

    // Fetch active session if any
    const activeSession = await ParticipationSession.findOne({
      deviceId: node._id,
      status: "active",
    }).sort({ createdAt: -1 });

    const wallet = await Wallet.findOne({ userId: req.user._id });

    return res.json({
      status: node.status,
      bandwidthUsed: node.usedBandwidthMB || 0,
      bandwidthLimit: node.bandwidthLimitMB || 2048,
      uploadSpeedCap: node.uploadSpeedCapMbps || 5,
      downloadSpeedCap: node.downloadSpeedCapMbps || 10,
      activeTasks: node.currentActiveTasks || 0,
      creditsEarned: creditsEarnedToday,
      lifetimeCredits: wallet?.earnedCredits || wallet?.balance || 0,
      walletBalance: wallet?.balance || 0,
      reliabilityScore: node.reliabilityScore || 100,
      successRate: node.successRate || 100,
      latencyMs: node.latencyMs || null,
      device: {
        id: node._id,
        deviceName: node.deviceName,
        deviceId: node.deviceId,
        deviceFingerprint: node.deviceFingerprint,
        region: node.region,
        maxConcurrentTasks: node.maxConcurrentTasks,
        lastSeenAt: node.lastSeenAt,
      },
      currentSession: activeSession
        ? {
            sessionId: activeSession.sessionId,
            startTime: activeSession.startTime || activeSession.startedAt,
            bandwidthUsed: activeSession.bandwidthUsed || activeSession.bandwidthUsedMB || 0,
            creditsEarned: activeSession.creditsEarned || 0,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch node dashboard data",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/my-node
 */
export const getMyNode = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    return res.json({ node });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch node",
      error: error.message,
    });
  }
};

/**
 * PUT /api/node/settings
 */
export const updateNodeSettings = async (req, res) => {
  try {
    const {
      region,
      bandwidthLimitMB,
      bandwidthLimit,
      uploadSpeedCapMbps,
      downloadSpeedCapMbps,
      speedCapMbps,
      maxConcurrentTasks,
    } = req.body;

    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    if (region !== undefined) node.region = region.trim();
    if (bandwidthLimitMB !== undefined || bandwidthLimit !== undefined) {
      node.bandwidthLimitMB = Number(bandwidthLimitMB || bandwidthLimit);
    }
    if (uploadSpeedCapMbps !== undefined) {
      node.uploadSpeedCapMbps = Number(uploadSpeedCapMbps);
    }
    if (downloadSpeedCapMbps !== undefined) {
      node.downloadSpeedCapMbps = Number(downloadSpeedCapMbps);
      node.speedCapMbps = Number(downloadSpeedCapMbps);
    } else if (speedCapMbps !== undefined) {
      node.speedCapMbps = Number(speedCapMbps);
      node.downloadSpeedCapMbps = Number(speedCapMbps);
    }
    if (maxConcurrentTasks !== undefined) {
      node.maxConcurrentTasks = Math.max(1, Number(maxConcurrentTasks));
    }

    node.lastSeenAt = new Date();
    await node.save();

    return res.json({
      message: "Node settings updated successfully",
      node,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update node settings",
      error: error.message,
    });
  }
};

/**
 * POST or PUT /api/node/start
 * Starts a new participation session
 */
export const startParticipation = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({
        message: "No registered node found. Please register your device first.",
      });
    }

    node.status = "active";
    node.lastSeenAt = new Date();
    await node.save();

    // Close any orphaned previous active sessions
    await ParticipationSession.updateMany(
      { deviceId: node._id, status: "active" },
      { $set: { status: "stopped", endTime: new Date(), stoppedAt: new Date() } }
    );

    const sessionId = generateSessionId();

    const session = await ParticipationSession.create({
      sessionId,
      userId: req.user._id,
      deviceId: node._id,
      nodeId: node._id,
      startTime: new Date(),
      startedAt: new Date(),
      bandwidthUsed: 0,
      bandwidthUsedMB: 0,
      latency: node.latencyMs || null,
      packetLoss: 0,
      networkQuality: "Good",
      activeTasksCount: node.currentActiveTasks || 0,
      creditsEarned: 0,
      status: "active",
    });

    return res.json({
      message: "Participation session started successfully",
      node,
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to start participation",
      error: error.message,
    });
  }
};

/**
 * POST or PUT /api/node/stop
 * Closes current participation session
 */
export const stopParticipation = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    // If already inactive, idempotent response
    if (node.status === 'inactive') {
      return res.json({ message: "Node is already inactive", node });
    }

    const activeTasks = node.currentActiveTasks || 0;

    if (activeTasks > 0) {
      // Enter draining state — no new tasks, wait for active to finish
      node.status = 'draining';
      node.lastSeenAt = new Date();
      await node.save();

      logger.info({
        nodeId: node._id.toString(),
        activeTasks,
        event: 'NODE_DRAINING',
      }, `Node entering draining state with ${activeTasks} active task(s)`);

      return res.json({
        message: `Stop requested. Node is draining ${activeTasks} active task(s). Node will stop after tasks complete or timeout.`,
        status: 'draining',
        activeTasks,
        node,
      });
    }

    // No active tasks — stop immediately
    node.status = 'inactive';
    node.currentActiveTasks = 0;
    node.lastSeenAt = new Date();
    await node.save();

    const session = await ParticipationSession.findOne({
      deviceId: node._id,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (session) {
      session.status = 'stopped';
      session.endTime = new Date();
      session.stoppedAt = new Date();
      session.stopReason = req.body.reason || 'user_requested';
      await session.save();
    }

    logger.info({
      nodeId: node._id.toString(),
      event: 'NODE_STOPPED',
      sessionId: session?.sessionId,
    }, 'Node participation stopped');

    return res.json({
      message: "Participation stopped successfully",
      status: 'inactive',
      node,
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to stop participation",
      error: error.message,
    });
  }
};

/**
 * PUT /api/node/pause
 * Pauses participation — prevents new task assignments but keeps connection and heartbeats
 */
export const pauseParticipation = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    if (!['active', 'busy'].includes(node.status)) {
      return res.status(400).json({
        message: `Cannot pause node in '${node.status}' state. Node must be active or busy.`,
      });
    }

    node.status = 'paused';
    node.lastSeenAt = new Date();
    await node.save();

    logger.info({
      nodeId: node._id.toString(),
      event: 'NODE_PAUSED',
      activeTasks: node.currentActiveTasks,
    }, 'Node participation paused');

    return res.json({
      message: "Participation paused. Node will not receive new tasks. Heartbeats continue.",
      status: 'paused',
      node,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to pause participation",
      error: error.message,
    });
  }
};

/**
 * PUT /api/node/resume
 * Resumes participation after pause
 */
export const resumeParticipation = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    if (node.status !== 'paused') {
      return res.status(400).json({
        message: `Cannot resume node in '${node.status}' state. Node must be paused.`,
      });
    }

    // Check bandwidth limit before resuming
    const limitMB = node.bandwidthLimitMB || 2048;
    const usedMB = node.usedBandwidthMB || 0;
    if (usedMB >= limitMB) {
      return res.status(400).json({
        message: "Cannot resume: bandwidth limit exhausted. Reset or increase limit.",
        usedMB,
        limitMB,
      });
    }

    // Resume to active (or busy if tasks are running)
    node.status = (node.currentActiveTasks || 0) > 0 ? 'busy' : 'active';
    node.lastSeenAt = new Date();
    await node.save();

    logger.info({
      nodeId: node._id.toString(),
      event: 'NODE_RESUMED',
      newStatus: node.status,
    }, 'Node participation resumed');

    return res.json({
      message: "Participation resumed.",
      status: node.status,
      node,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to resume participation",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/session/current
 * Real-time monitoring metrics for the active session
 */
export const getCurrentSession = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    let session = await ParticipationSession.findOne({
      deviceId: node._id,
      status: "active",
    }).sort({ createdAt: -1 });

    // If node is active but no session record exists, create one seamlessly
    if (!session && node.status === "active") {
      session = await ParticipationSession.create({
        sessionId: generateSessionId(),
        userId: req.user._id,
        deviceId: node._id,
        nodeId: node._id,
        startTime: new Date(),
        bandwidthUsed: 0,
        latency: node.latencyMs || null,
        packetLoss: 0,
        networkQuality: "Good",
        activeTasksCount: node.currentActiveTasks || 0,
        creditsEarned: 0,
        status: "active",
      });
    }

    if (!session) {
      return res.json({
        active: false,
        message: "No active participation session running",
        session: null,
      });
    }

    // Calculate duration in seconds
    const start = session.startTime || session.startedAt || session.createdAt;
    const connectedDurationSec = Math.max(
      0,
      Math.floor((Date.now() - new Date(start).getTime()) / 1000)
    );

    // Fetch active task if assigned
    const assignedTaskSession = await TaskSession.findOne({
      nodeId: node._id,
      status: { $in: ["created", "running"] },
    })
      .populate("taskId")
      .populate("clientId", "name email");

    // Use actual stored latency from telemetry — no simulated noise
    const currentLatency = node.latencyMs || null;

    // Assess network quality based on latency & packet loss
    let quality = "Good";
    if (currentLatency < 40) quality = "Excellent";
    else if (currentLatency <= 90) quality = "Good";
    else if (currentLatency <= 140) quality = "Fair";
    else quality = "Poor";

    return res.json({
      active: true,
      sessionId: session.sessionId,
      status: session.status,
      startTime: session.startTime || session.startedAt,
      connectedDurationSec,
      assignedTasksCount: node.currentActiveTasks || 0,
      assignedTask: assignedTaskSession || null,
      bandwidthConsumedMB: session.bandwidthUsed || session.bandwidthUsedMB || 0,
      latency: currentLatency,
      packetLoss: session.packetLoss || 0,
      networkQuality: quality,
      creditsGenerated: session.creditsEarned || 0,
      node: {
        deviceName: node.deviceName,
        region: node.region,
        uploadSpeedCap: node.uploadSpeedCapMbps,
        downloadSpeedCap: node.downloadSpeedCapMbps,
        reliabilityScore: node.reliabilityScore,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch current session",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/transactions
 * Node participant earning history
 */
export const getNodeTransactions = async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const wallet = await Wallet.findOne({ userId: req.user._id });

    return res.json({
      balance: wallet?.balance || 0,
      earnedCredits: wallet?.earnedCredits || 0,
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch node transactions",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/assigned-task
 */
export const getAssignedTask = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });

    if (!node) {
      return res.status(404).json({ message: "Node not found" });
    }

    const session = await TaskSession.findOne({
      nodeId: node._id,
      status: { $in: ["created", "running"] },
    })
      .populate("taskId")
      .populate("clientId", "name email");

    if (!session) {
      return res.json({
        message: "No assigned task found",
        assignedTask: null,
      });
    }

    return res.json({
      assignedTask: session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch assigned task",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/api-key
 * Returns current API key or generates one if not yet created
 */
export const getNodeApiKey = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node device not found" });
    }

    if (!node.apiKey) {
      node.apiKey = `nsk_live_${crypto.randomBytes(24).toString("hex")}`;
      await node.save();
    }

    return res.json({
      nodeId: node._id,
      deviceName: node.deviceName,
      apiKey: node.apiKey,
      message: "Keep this API Key confidential. It is used by netshare-agent and mobile background workers to authenticate.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve node API key",
      error: error.message,
    });
  }
};

/**
 * POST /api/node/api-key/regenerate
 * Rolls a fresh API key for the node device
 */
export const regenerateNodeApiKey = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node device not found" });
    }

    node.apiKey = `nsk_live_${crypto.randomBytes(24).toString("hex")}`;
    await node.save();

    return res.json({
      nodeId: node._id,
      deviceName: node.deviceName,
      apiKey: node.apiKey,
      message: "New Node API Key generated. Previous key has been invalidated.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to regenerate node API key",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/telemetry
 * Fetches recent historical telemetry for graph rendering
 */
export const getNodeTelemetryHistory = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node device not found" });
    }

    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit || "30", 10)));
    const telemetry = await NodeTelemetry.find({ nodeId: node._id })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.json({
      nodeId: node._id,
      count: telemetry.length,
      telemetry: telemetry.reverse(), // Ascending chronological order for charts
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch node telemetry",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/heartbeats
 * Returns recent heartbeats
 */
export const getNodeHeartbeats = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node device not found" });
    }

    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit || "20", 10)));
    const heartbeats = await NodeHeartbeat.find({ nodeId: node._id })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.json({
      nodeId: node._id,
      count: heartbeats.length,
      heartbeats,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch node heartbeats",
      error: error.message,
    });
  }
};

/**
 * GET /api/node/bandwidth-usage
 * Returns bandwidth usage breakdown
 */
export const getNodeBandwidthHistory = async (req, res) => {
  try {
    const node = await NodeDevice.findOne({ userId: req.user._id });
    if (!node) {
      return res.status(404).json({ message: "Node device not found" });
    }

    const usages = await BandwidthUsage.find({ nodeId: node._id })
      .populate("taskId", "serviceType targetUrl estimatedCost")
      .sort({ timestamp: -1 })
      .limit(50);

    return res.json({
      nodeId: node._id,
      totalUsedMB: node.usedBandwidthMB || 0,
      bandwidthLimitMB: node.bandwidthLimitMB || 2048,
      usages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch bandwidth usage",
      error: error.message,
    });
  }
};