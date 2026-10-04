import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import NodeDevice from "../models/NodeDevice.js";
import User from "../models/User.js";
import TestingTask from "../models/TestingTask.js";
import TaskResult from "../models/TaskResult.js";
import TaskSession from "../models/TaskSession.js";
import NodeHeartbeat from "../models/NodeHeartbeat.js";
import NodeTelemetry from "../models/NodeTelemetry.js";
import BandwidthUsage from "../models/BandwidthUsage.js";
import ParticipationSession from "../models/ParticipationSession.js";
import { calculateReward } from "./rewardService.js";
import { addCredits } from "./walletService.js";
import logger from '../lib/logger.js';
import { registerSignalingHandlers } from './webrtcSignalingService.js';
import { startSessionCleanup } from './routingSessionService.js';

// In-memory tracking of active node connections: Map<nodeIdString, { socketId, socket, node, connectedAt, lastHeartbeatAt }>
const connectedNodes = new Map();
// Map<socketId, { type: 'node'|'client'|'admin', id: string, user: Object, node: Object }>
const socketRegistry = new Map();

let ioInstance = null;
let heartbeatCheckInterval = null;

/**
 * Validates handshake credentials for nodes, clients, and admins
 */
export const authenticateSocketHandshake = async (socket, next) => {
  try {
    const auth = socket.handshake.auth || {};
    const query = socket.handshake.query || {};
    const headers = socket.handshake.headers || {};

    const token =
      auth.token ||
      query.token ||
      (headers.authorization?.startsWith("Bearer ") ? headers.authorization.split(" ")[1] : null);

    const apiKey =
      auth.apiKey ||
      auth.nodeApiKey ||
      query.apiKey ||
      query.nodeApiKey ||
      headers["x-node-api-key"] ||
      headers["x-api-key"];

    // 1. Authenticate via Node API Key
    if (apiKey) {
      const node = await NodeDevice.findOne({ apiKey }).populate("userId");
      if (!node) {
        return next(new Error("Invalid Node API Key"));
      }
      socket.socketType = "node";
      socket.node = node;
      socket.user = node.userId;
      return next();
    }

    // 2. Authenticate via JWT Token
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return next(new Error("Authenticated user not found"));
      }

      if (user.status === "blocked") {
        return next(new Error("Account is blocked"));
      }

      socket.user = user;

      // Identify if connection is representing a node
      const requestedNodeId = auth.nodeId || query.nodeId;
      if (requestedNodeId || user.role === "node_participant" || auth.role === "node") {
        const queryFilter = requestedNodeId
          ? { _id: requestedNodeId, userId: user._id }
          : { userId: user._id };
        const node = await NodeDevice.findOne(queryFilter);

        if (node) {
          socket.socketType = "node";
          socket.node = node;
          return next();
        }
      }

      // If user is admin or client
      if (user.role === "admin") {
        socket.socketType = "admin";
      } else {
        socket.socketType = "client";
      }

      return next();
    }

    // Anonymous or unauthenticated connections are denied
    return next(new Error("Authentication required: provide a valid token or node API key"));
  } catch (error) {
    return next(new Error(`Socket authentication failed: ${error.message}`));
  }
};

/**
 * Connect a node and register state
 */
export const connectNode = async (socket, node) => {
  const nodeId = node._id.toString();

  // If node was previously connected via another socket, clean up old socket
  if (connectedNodes.has(nodeId)) {
    const prev = connectedNodes.get(nodeId);
    if (prev.socketId !== socket.id) {
      try {
        prev.socket.disconnect(true);
      } catch (_) {}
    }
  }

  connectedNodes.set(nodeId, {
    socketId: socket.id,
    socket,
    node,
    connectedAt: new Date(),
    lastHeartbeatAt: new Date(),
  });

  socketRegistry.set(socket.id, {
    type: "node",
    id: nodeId,
    user: socket.user,
    node,
  });

  socket.join(`node_${nodeId}`);
  socket.join("nodes_room");

  // Update DB device status
  await NodeDevice.findByIdAndUpdate(nodeId, {
    status: "active",
    lastSeenAt: new Date(),
  });

  broadcastNodeStatus(nodeId, {
    status: "active",
    online: true,
    lastSeenAt: new Date(),
  });

  // Notify the node that connection and handshake succeeded
  socket.emit("node_connect_ack", {
    success: true,
    message: "Node successfully connected to NetShare Real-Time Execution Plane",
    nodeId,
    deviceName: node.deviceName,
    region: node.region,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Disconnect a node and notify observers
 */
export const disconnectNode = async (socket) => {
  const meta = socketRegistry.get(socket.id);
  socketRegistry.delete(socket.id);

  if (meta && meta.type === "node") {
    const nodeId = meta.id;
    const currentEntry = connectedNodes.get(nodeId);

    if (currentEntry && currentEntry.socketId === socket.id) {
      connectedNodes.delete(nodeId);

      await NodeDevice.findByIdAndUpdate(nodeId, {
        status: "inactive",
        lastSeenAt: new Date(),
      });

      broadcastNodeStatus(nodeId, {
        status: "inactive",
        online: false,
        lastSeenAt: new Date(),
      });
    }
  }
};

/**
 * Send task payload to a designated node agent
 */
export const sendTaskToNode = async (nodeId, taskData) => {
  const entry = connectedNodes.get(nodeId.toString());
  if (!entry || !entry.socket.connected) {
    return { success: false, reason: "Node not currently connected to real-time network" };
  }

  const payload = {
    taskId: taskData.taskId || taskData._id,
    target: taskData.targetUrl || taskData.target,
    taskType: taskData.serviceType || taskData.taskType,
    limits: {
      executionLimit: taskData.executionLimit || 1,
      timeoutMs: taskData.timeoutMs || 30000,
    },
    clientId: taskData.clientId,
    assignedAt: new Date().toISOString(),
  };

  entry.socket.emit("task_assigned", payload);

  // Broadcast assignment to admin and client
  if (ioInstance) {
    ioInstance.to("admin_room").emit("task_assigned_event", { nodeId, task: payload });
    if (taskData.clientId) {
      ioInstance.to(`client_${taskData.clientId}`).emit("task_assigned_event", { nodeId, task: payload });
    }
  }

  return { success: true, socketId: entry.socketId };
};

/**
 * Broadcast node status change to rooms
 */
export const broadcastNodeStatus = (nodeId, statusData) => {
  if (!ioInstance) return;

  const payload = {
    nodeId,
    ...statusData,
    timestamp: new Date().toISOString(),
  };

  ioInstance.to("admin_room").emit("node_status_change", payload);
  ioInstance.to(`node_${nodeId}`).emit("node_status_change", payload);
  ioInstance.emit("global_node_status", payload);
};

/**
 * Receive and persist node telemetry and heartbeats
 */
export const receiveNodeTelemetry = async (nodeId, telemetryData) => {
  try {
    const {
      cpuUsage = 0,
      memoryUsage = 0,
      bandwidthUsed = 0,
      bandwidthUsedMB = 0,
      uploadBandwidthMB = 0,
      downloadBandwidthMB = 0,
      latency = null,
      latencyMs = null,
      packetLoss = 0,
      status = "active",
      networkStatus = {},
    } = telemetryData;

    const currentLatency = latencyMs != null ? Number(latencyMs) : (latency != null ? Number(latency) : null);
    const currentBandwidth = Number(bandwidthUsedMB || bandwidthUsed || 0);

    // 1. Create historical telemetry record
    const telemetry = await NodeTelemetry.create({
      nodeId,
      cpuUsage: Number(cpuUsage),
      memoryUsage: Number(memoryUsage),
      bandwidthUsed: currentBandwidth,
      latency: currentLatency,
      packetLoss: Number(packetLoss),
      onlineStatus: status || "online",
      timestamp: new Date(),
    });

    // 2. Record BandwidthUsage ledger if bandwidth was reported
    if (uploadBandwidthMB > 0 || downloadBandwidthMB > 0 || currentBandwidth > 0) {
      await BandwidthUsage.create({
        nodeId,
        sessionId: telemetryData.sessionId || "",
        taskId: telemetryData.taskId || null,
        uploadBandwidthMB: Number(uploadBandwidthMB || 0),
        downloadBandwidthMB: Number(downloadBandwidthMB || currentBandwidth),
        totalBandwidthMB: Number(uploadBandwidthMB || 0) + Number(downloadBandwidthMB || currentBandwidth),
        networkAvailability: "available",
        timestamp: new Date(),
      });
    }

    // 3. Update NodeDevice live properties
    await NodeDevice.findByIdAndUpdate(nodeId, {
      lastSeenAt: new Date(),
      latencyMs: currentLatency,
      status: status === "busy" ? "busy" : "active",
      $inc: { usedBandwidthMB: currentBandwidth },
    });

    // 4. Stream live update to interested rooms
    if (ioInstance) {
      const payload = {
        nodeId,
        cpuUsage,
        memoryUsage,
        bandwidthUsed: currentBandwidth,
        latency: currentLatency,
        packetLoss,
        status,
        timestamp: telemetry.timestamp,
      };

      ioInstance.to("admin_room").emit("telemetry_update", payload);
      ioInstance.to(`node_${nodeId}`).emit("telemetry_update", payload);
    }

    return telemetry;
  } catch (error) {
    logger.error({ nodeId, err: error }, 'Failed to record node telemetry');
    return null;
  }
};

/**
 * Heartbeat monitor loop: checks every 10s for nodes that haven't sent a heartbeat in 30s
 */
const startHeartbeatEvictionMonitor = () => {
  if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);

  heartbeatCheckInterval = setInterval(async () => {
    const now = Date.now();
    const thresholdMs = 35 * 1000; // 35 seconds timeout (missing >3 heartbeats)

    for (const [nodeId, entry] of connectedNodes.entries()) {
      if (now - new Date(entry.lastHeartbeatAt).getTime() > thresholdMs) {
        logger.warn({ nodeId }, 'Node heartbeat timed out. Marking offline.');
        try {
          entry.socket.disconnect(true);
        } catch (_) {}
        connectedNodes.delete(nodeId);

        await NodeDevice.findByIdAndUpdate(nodeId, {
          status: "inactive",
          lastSeenAt: new Date(),
        });

        broadcastNodeStatus(nodeId, {
          status: "inactive",
          online: false,
          reason: "Heartbeat timeout",
        });
      }
    }
  }, 10000);
};

/**
 * Handle incoming task started confirmation from agent
 */
const handleTaskStarted = async (socket, data) => {
  try {
    const { taskId } = data;
    const task = await TestingTask.findById(taskId);
    if (!task) return;

    task.status = "running";
    await task.save();

    await TaskSession.findOneAndUpdate(
      { taskId },
      {
        status: "running",
        $push: { logs: { message: `Task execution started on real node agent at ${new Date().toISOString()}` } },
      }
    );

    if (ioInstance) {
      ioInstance.to("admin_room").emit("task_started_event", { taskId, nodeId: socket.node?._id });
      if (task.clientId) {
        ioInstance.to(`client_${task.clientId}`).emit("task_started_event", { taskId, nodeId: socket.node?._id });
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error handling task_started');
  }
};

/**
 * Handle task completion returned by node agent
 */
const handleTaskCompleted = async (socket, data) => {
  try {
    const {
      taskId,
      bandwidthUsedMB = 0,
      latencyMs = null,
      packetLoss = 0,
      success = true,
      successRate = 100,
      statusCode = 200,
      resultData = {},
      uploadBandwidthMB = 0,
      downloadBandwidthMB = 0,
    } = data;

    const task = await TestingTask.findById(taskId);
    if (!task) return;

    // Idempotency: if task already completed/settled, do not process again
    if (['completed', 'settled', 'failed'].includes(task.status)) {
      logger.warn({ taskId, status: task.status }, 'Duplicate task_completed event — ignoring');
      return;
    }

    const node = await NodeDevice.findById(socket.node?._id || task.assignedNodeId);
    if (!node) return;

    const safeBandwidth = Number(bandwidthUsedMB || downloadBandwidthMB || 5);
    const safeLatency = Number(latencyMs || 50);

    // 1. Create immutable TaskResult
    const taskResult = await TaskResult.create({
      taskId: task._id,
      nodeId: node._id,
      clientId: task.clientId,
      nodeUserId: node.userId,
      serviceType: task.serviceType,
      targetUrl: task.targetUrl,
      success: !!success,
      successRate: Number(successRate || (success ? 100 : 0)),
      latencyMs: safeLatency,
      packetLoss: Number(packetLoss || 0),
      bandwidthUsedMB: safeBandwidth,
      statusCode: Number(statusCode || 200),
      resultData: resultData || {},
      completedAt: new Date(),
    });

    // 2. Calculate dynamic reward using dynamic formula
    const rewardCalculation = calculateReward({
      bandwidthUsedMB: safeBandwidth,
      node,
      targetRegion: task.targetRegion,
    });

    const finalNodeReward = Math.max(1, rewardCalculation.reward);

    // 3. Atomically reward node participant wallet
    await addCredits({
      userId: node.userId,
      taskId: task._id,
      amount: finalNodeReward,
      description: `Reward for task ${task._id} (${safeBandwidth}MB processed, Q=${rewardCalculation.breakdown.qualityScore})`,
    });

    // 4. Record BandwidthUsage
    await BandwidthUsage.create({
      nodeId: node._id,
      taskId: task._id,
      uploadBandwidthMB: Number(uploadBandwidthMB || 0),
      downloadBandwidthMB: safeBandwidth,
      totalBandwidthMB: Number(uploadBandwidthMB || 0) + safeBandwidth,
      networkAvailability: "available",
      timestamp: new Date(),
    });

    // 5. Update task state
    task.status = "completed";
    task.resultSummary = {
      successRate: Number(successRate || 100),
      averageResponseTimeMs: safeLatency,
      bandwidthConsumedMB: safeBandwidth,
      message: `Completed by Node ${node.deviceName}. Reward: ${finalNodeReward} credits.`,
    };
    await task.save();

    // Settle task
    task.status = "settled";
    await task.save();

    // 6. Update TaskSession
    await TaskSession.findOneAndUpdate(
      { taskId: task._id },
      {
        status: "completed",
        bandwidthUsedMB: safeBandwidth,
        latencyMs: safeLatency,
        $push: {
          logs: {
            message: `Real execution completed successfully. Dynamic reward: ${finalNodeReward} credits.`,
          },
        },
      }
    );

    // 7. Update NodeDevice metrics
    node.usedBandwidthMB = (node.usedBandwidthMB || 0) + safeBandwidth;
    node.currentActiveTasks = Math.max(0, (node.currentActiveTasks || 1) - 1);
    node.latencyMs = safeLatency;
    node.lastSeenAt = new Date();
    if (node.status === "busy") node.status = "active";
    await node.save();

    // 8. Update ParticipationSession
    await ParticipationSession.findOneAndUpdate(
      { deviceId: node._id, status: "active" },
      {
        $inc: {
          bandwidthUsed: safeBandwidth,
          bandwidthUsedMB: safeBandwidth,
          creditsEarned: finalNodeReward,
        },
        $set: { activeTasksCount: node.currentActiveTasks },
      }
    );

    // 9. Emit completion events
    socket.emit("task_completed_ack", {
      taskId: task._id,
      rewardEarned: finalNodeReward,
      breakdown: rewardCalculation.breakdown,
    });

    if (ioInstance) {
      const summaryPayload = {
        taskId: task._id,
        nodeId: node._id,
        result: taskResult,
        reward: finalNodeReward,
      };
      ioInstance.to("admin_room").emit("task_completed_event", summaryPayload);
      if (task.clientId) {
        ioInstance.to(`client_${task.clientId}`).emit("task_completed_event", summaryPayload);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error handling task_completed');
  }
};

/**
 * Initialize Socket.IO Server with Express HTTP server
 */
export const initSocketServer = async (httpServer) => {
  // Import config for CORS origins
  const { default: config } = await import('../config/env.js');
  
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, agents, server-to-server)
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Socket.IO CORS rejected'));
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  ioInstance = io;

  // Socket middleware for authentication
  io.use(authenticateSocketHandshake);

  io.on("connection", async (socket) => {
    // 1. Node connection
    if (socket.socketType === "node" && socket.node) {
      await connectNode(socket, socket.node);

      // Heartbeat event from node agent (sent every 10s)
      socket.on("heartbeat", async (data) => {
        const nodeId = socket.node._id.toString();
        const entry = connectedNodes.get(nodeId);
        if (entry) {
          entry.lastHeartbeatAt = new Date();
        }

        const {
          cpuUsage = 0,
          memoryUsage = 0,
          networkStatus = {},
          status = "active",
          timestamp = new Date(),
        } = data || {};

        // Persist NodeHeartbeat
        await NodeHeartbeat.create({
          nodeId: socket.node._id,
          status,
          cpuUsage: Number(cpuUsage),
          memoryUsage: Number(memoryUsage),
          networkStatus: {
            latencyMs: networkStatus.latencyMs != null ? Number(networkStatus.latencyMs) : (networkStatus.latency != null ? Number(networkStatus.latency) : null),
            uploadSpeedMbps: Number(networkStatus.uploadSpeedMbps || 0),
            downloadSpeedMbps: Number(networkStatus.downloadSpeedMbps || 0),
            packetLoss: Number(networkStatus.packetLoss || 0),
            ipAddress: socket.handshake.address || "",
          },
          timestamp: new Date(timestamp),
        });

        // Also record telemetry
        await receiveNodeTelemetry(socket.node._id, {
          cpuUsage,
          memoryUsage,
          latency: networkStatus.latencyMs != null ? networkStatus.latencyMs : null,
          packetLoss: networkStatus.packetLoss || 0,
          status,
        });

        // Acknowledge heartbeat
        socket.emit("heartbeat_ack", {
          received: true,
          nodeId,
          serverTime: new Date().toISOString(),
        });
      });

      // Telemetry update event
      socket.on("telemetry_update", async (data) => {
        await receiveNodeTelemetry(socket.node._id, data);
      });

      // Task progress events from agent
      socket.on("task_started", async (data) => {
        await handleTaskStarted(socket, data);
      });

      socket.on("task_completed", async (data) => {
        await handleTaskCompleted(socket, data);
      });

      // WebRTC signaling events for this node socket
      registerSignalingHandlers(io, socket);
    }

    // 2. Admin connection
    if (socket.socketType === "admin") {
      socket.join("admin_room");
      socketRegistry.set(socket.id, { type: "admin", user: socket.user });

      // Send initial snapshot of connected nodes
      socket.emit("connected_nodes_snapshot", getConnectedNodesList());
    }

    // 3. Client connection
    if (socket.socketType === "client" && socket.user) {
      const clientRoom = `client_${socket.user._id}`;
      socket.join(clientRoom);
      socketRegistry.set(socket.id, { type: "client", id: socket.user._id.toString(), user: socket.user });

      // WebRTC signaling events for this client socket
      registerSignalingHandlers(io, socket);
    }

    // Common disconnect handler
    socket.on("disconnect", async (reason) => {
      await disconnectNode(socket);
    });
  });

  startHeartbeatEvictionMonitor();
  startSessionCleanup();

  return io;
};

/**
 * Returns array of currently connected node IDs and metadata
 */
export const getConnectedNodesList = () => {
  const list = [];
  for (const [nodeId, entry] of connectedNodes.entries()) {
    list.push({
      nodeId,
      deviceName: entry.node.deviceName,
      region: entry.node.region,
      status: entry.node.status,
      connectedAt: entry.connectedAt,
      lastHeartbeatAt: entry.lastHeartbeatAt,
      latencyMs: entry.node.latencyMs,
    });
  }
  return list;
};

/**
 * Helper to check if a specific node is connected
 */
export const isNodeConnected = (nodeId) => {
  return connectedNodes.has(nodeId.toString());
};

export const getIO = () => ioInstance;

export default {
  initSocketServer,
  connectNode,
  disconnectNode,
  sendTaskToNode,
  broadcastNodeStatus,
  receiveNodeTelemetry,
  getConnectedNodesList,
  isNodeConnected,
  getIO,
};
