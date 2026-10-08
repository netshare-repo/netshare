import mongoose from "mongoose";

const nodeDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deviceName: {
      type: String,
      required: true,
      trim: true,
    },

    deviceId: {
      type: String,
      default: "",
    },

    deviceFingerprint: {
      type: String,
      default: "",
    },

    region: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ['inactive', 'active', 'busy', 'paused', 'draining', 'offline', 'unhealthy'],
      default: 'inactive',
    },

    bandwidthLimitMB: {
      type: Number,
      required: true,
      default: 2048,
    },

    usedBandwidthMB: {
      type: Number,
      default: 0,
    },

    uploadSpeedCapMbps: {
      type: Number,
      default: 5,
    },

    downloadSpeedCapMbps: {
      type: Number,
      default: 10,
    },

    speedCapMbps: {
      type: Number,
      default: 10,
    },

    maxConcurrentTasks: {
      type: Number,
      default: 1,
    },

    currentActiveTasks: {
      type: Number,
      default: 0,
    },

    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },

    successRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },

    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    latencyMs: {
      type: Number,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    apiKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    totalUsedBytes: {
      type: Number,
      default: 0,
    },
    healthScore: {
      type: Number,
      default: 1.0,
    },
    healthScoreVersion: {
      type: Number,
      default: 1,
    },
    consecutiveHealthyChecks: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("NodeDevice", nodeDeviceSchema);
