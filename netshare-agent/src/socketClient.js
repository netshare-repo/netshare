import { io } from "socket.io-client";
import EventEmitter from "events";

/**
 * Socket Client wrapper for NetShare Edge Node Agent
 */
export class NodeSocketClient extends EventEmitter {
  constructor(serverUrl, authOptions = {}) {
    super();
    this.serverUrl = serverUrl || "http://localhost:8000";
    this.authOptions = authOptions;
    this.socket = null;
    this.lastLatencyMs = 45;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const { apiKey, token, nodeId } = this.authOptions;

    this.socket = io(this.serverUrl, {
      auth: {
        apiKey,
        nodeApiKey: apiKey,
        token,
        nodeId,
        role: "node",
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.socket.on("connect", () => {
      console.log(`[SocketClient] Connected to NetShare Execution Plane at ${this.serverUrl} (Socket ID: ${this.socket.id})`);
      this.emit("connected", { socketId: this.socket.id });
    });

    this.socket.on("node_connect_ack", (ack) => {
      console.log(`[SocketClient] Node Handshake Acknowledged: ${ack.deviceName || ack.nodeId} (${ack.region || "Global"})`);
      this.emit("handshake_success", ack);
    });

    this.socket.on("connect_error", (err) => {
      console.error(`[SocketClient] Connection error: ${err.message}`);
      this.emit("error", err);
    });

    this.socket.on("disconnect", (reason) => {
      console.warn(`[SocketClient] Disconnected from server. Reason: ${reason}`);
      this.emit("disconnected", reason);
    });

    this.socket.on("heartbeat_ack", (ack) => {
      this.emit("heartbeat_ack", ack);
    });

    this.socket.on("task_assigned", (taskData) => {
      console.log(`[SocketClient] New Task Assigned: ${taskData.taskId} (${taskData.taskType}) -> ${taskData.target}`);
      this.emit("task_assigned", taskData);
    });

    this.socket.on("task_completed_ack", (ack) => {
      console.log(`[SocketClient] Task ${ack.taskId} Settlement Confirmed! Earned: +${ack.rewardEarned} credits`);
      this.emit("task_completed_ack", ack);
    });

    return this.socket;
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  isConnected() {
    return !!(this.socket && this.socket.connected);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default NodeSocketClient;
