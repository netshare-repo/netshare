import mongoose from "mongoose";

const nodeHeartbeatSchema = new mongoose.Schema(
  {
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["online", "active", "busy", "idle", "paused", "offline"],
      default: "online",
    },
    cpuUsage: {
      type: Number,
      default: 0,
    },
    memoryUsage: {
      type: Number,
      default: 0,
    },
    networkStatus: {
      latencyMs: { type: Number, default: 0 },
      uploadSpeedMbps: { type: Number, default: 0 },
      downloadSpeedMbps: { type: Number, default: 0 },
      packetLoss: { type: Number, default: 0 },
      ipAddress: { type: String, default: "" },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Expire heartbeats after 7 days to maintain lightweight database
nodeHeartbeatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export default mongoose.model("NodeHeartbeat", nodeHeartbeatSchema);
