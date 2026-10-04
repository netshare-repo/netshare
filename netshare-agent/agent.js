import dotenv from "dotenv";
import NodeSocketClient from "./src/socketClient.js";
import HeartbeatManager from "./src/heartbeatManager.js";
import taskReceiver from "./src/taskReceiver.js";
import taskExecutor from "./src/taskExecutor.js";
import metricsCollector from "./src/metricsCollector.js";

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
};

const SERVER_URL = getArg("--url", process.env.NETSHARE_SERVER_URL || "http://localhost:8000");
const API_KEY = getArg("--key", process.env.NODE_API_KEY || "");
const TOKEN = getArg("--token", process.env.NODE_JWT_TOKEN || "");
const NODE_ID = getArg("--nodeId", process.env.NODE_ID || "");

console.log("==================================================");
console.log("      NetShare Edge Node Agent Daemon v1.0        ");
console.log("==================================================");
console.log(`Backend Server: ${SERVER_URL}`);
console.log(`Auth Mode:      ${API_KEY ? "Node API Key" : TOKEN ? "JWT Token" : "None Provided (Warning)"}`);
if (NODE_ID) console.log(`Configured NodeId: ${NODE_ID}`);
console.log("--------------------------------------------------");

const socketClient = new NodeSocketClient(SERVER_URL, {
  apiKey: API_KEY,
  token: TOKEN,
  nodeId: NODE_ID,
});

const heartbeatManager = new HeartbeatManager(socketClient, {
  intervalMs: 10000,
  nodeId: NODE_ID,
});

// Event Listeners
socketClient.on("connected", ({ socketId }) => {
  console.log(`[Agent] Connection initialized (Socket ID: ${socketId}). Waiting for handshake ack...`);
});

socketClient.on("handshake_success", (ack) => {
  console.log(`[Agent] Active node confirmed: ${ack.deviceName || ack.nodeId}`);
  heartbeatManager.setNodeId(ack.nodeId);
  taskReceiver.setNodeConfig({ status: "active", ...ack });
  heartbeatManager.start();
});

socketClient.on("task_assigned", async (task) => {
  console.log(`[Agent] Received task request ${task.taskId}`);

  // 1. Validate task permissions and schema
  const validation = taskReceiver.validateTask(task);
  if (!validation.valid) {
    console.error(`[Agent] Task validation failed: ${validation.error}`);
    socketClient.emit("task_rejected", {
      taskId: task.taskId,
      reason: validation.error,
    });
    return;
  }

  // 2. Notify execution plane that task started
  socketClient.emit("task_started", {
    taskId: task.taskId,
    startedAt: new Date().toISOString(),
  });

  // 3. Execute the task
  try {
    const result = await taskExecutor.executeTask(task);

    console.log(
      `[Agent] Task ${task.taskId} completed! Status: ${result.statusCode}, Latency: ${result.latencyMs}ms, Bandwidth: ${result.bandwidthUsedMB}MB`
    );

    // 4. Return execution metrics and results
    socketClient.emit("task_completed", {
      taskId: task.taskId,
      success: result.success,
      successRate: result.successRate,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      bandwidthUsedMB: result.bandwidthUsedMB,
      downloadBandwidthMB: result.downloadBandwidthMB,
      uploadBandwidthMB: result.uploadBandwidthMB,
      packetLoss: result.packetLoss,
      resultData: result.resultData,
      completedAt: new Date().toISOString(),
    });

    // 5. Send telemetry update
    const sys = metricsCollector.getSystemStatus();
    socketClient.emit("telemetry_update", {
      taskId: task.taskId,
      bandwidthUsedMB: result.bandwidthUsedMB,
      latencyMs: result.latencyMs,
      cpuUsage: sys.cpuUsage,
      memoryUsage: sys.memoryUsage,
      status: "active",
    });
  } catch (error) {
    console.error(`[Agent] Error executing task ${task.taskId}:`, error.message);
    socketClient.emit("task_completed", {
      taskId: task.taskId,
      success: false,
      successRate: 0,
      statusCode: 500,
      latencyMs: 500,
      bandwidthUsedMB: 0.01,
      packetLoss: 100,
      resultData: { error: error.message },
    });
  }
});

socketClient.on("disconnected", (reason) => {
  heartbeatManager.stop();
});

// Connect to real-time execution plane
socketClient.connect();

// Graceful Shutdown
const handleShutdown = () => {
  console.log("\n[Agent] Shutting down NetShare Node Agent...");
  heartbeatManager.stop();
  socketClient.disconnect();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
