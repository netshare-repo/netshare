import mongoose from "mongoose";

const nodeTelemetrySchema = new mongoose.Schema(
  {
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
      index: true,
    },
    cpuUsage: {
      type: Number,
      default: 0,
    },
    memoryUsage: {
      type: Number,
      default: 0,
    },
    bandwidthUsed: {
      type: Number,
      default: 0, // In MB
    },
    latency: {
      type: Number,
      default: 0, // In ms
    },
    packetLoss: {
      type: Number,
      default: 0, // In %
    },
    onlineStatus: {
      type: String,
      enum: ["online", "active", "busy", "idle", "paused", "offline"],
      default: "online",
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Expire after 14 days
nodeTelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });

export default mongoose.model("NodeTelemetry", nodeTelemetrySchema);
