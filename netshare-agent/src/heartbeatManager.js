import metricsCollector from "./metricsCollector.js";

/**
 * Heartbeat Manager for NetShare Edge Agent
 * Emits heartbeat packet every 10 seconds
 */
export class HeartbeatManager {
  constructor(socketClient, options = {}) {
    this.socketClient = socketClient;
    this.intervalMs = options.intervalMs || 10000;
    this.timer = null;
    this.nodeId = options.nodeId || null;
    this.status = "active";
  }

  setNodeId(nodeId) {
    this.nodeId = nodeId;
  }

  setStatus(status) {
    this.status = status;
  }

  start() {
    this.stop();
    // Send immediate initial heartbeat
    this.sendHeartbeat();
    this.timer = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);
    console.log(`[HeartbeatManager] Heartbeat loop started (Every ${this.intervalMs / 1000}s)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[HeartbeatManager] Heartbeat loop stopped.");
    }
  }

  sendHeartbeat() {
    if (!this.socketClient || !this.socketClient.isConnected()) {
      return;
    }

    const sys = metricsCollector.getSystemStatus();

    const payload = {
      nodeId: this.nodeId,
      status: this.status,
      cpuUsage: sys.cpuUsage,
      memoryUsage: sys.memoryUsage,
      networkStatus: {
        latencyMs: this.socketClient.lastLatencyMs || null,
        uploadSpeedMbps: null, // Measured only during active task execution
        downloadSpeedMbps: null, // Measured only during active task execution
        packetLoss: null, // Derived from recent task success/failure, not heartbeat
      },
      timestamp: new Date().toISOString(),
    };

    this.socketClient.emit("heartbeat", payload);
  }
}

export default HeartbeatManager;
