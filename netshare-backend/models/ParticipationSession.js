import mongoose from "mongoose";

const participationSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
    },

    // Retained for backwards compatibility with existing queries
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
    },

    status: {
      type: String,
      enum: ["active", "stopped", "paused"],
      default: "active",
    },
    stopReason: {
      type: String,
      enum: ['user_requested', 'drain_completed', 'drain_timeout', 'disconnect', 'unhealthy', 'bandwidth_exhausted', 'admin'],
      default: null,
    },

    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
      default: null,
    },

    // Retained for backwards compatibility
    startedAt: {
      type: Date,
      default: Date.now,
    },

    stoppedAt: {
      type: Date,
      default: null,
    },

    bandwidthUsed: {
      type: Number,
      default: 0,
    },

    bandwidthUsedMB: {
      type: Number,
      default: 0,
    },

    latency: {
      type: Number,
      default: null,
    },

    packetLoss: {
      type: Number,
      default: 0,
    },

    networkQuality: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      default: "Good",
    },

    activeTasksCount: {
      type: Number,
      default: 0,
    },

    creditsEarned: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to synchronize aliases
participationSessionSchema.pre("save", function (next) {
  if (!this.nodeId && this.deviceId) {
    this.nodeId = this.deviceId;
  }
  if (!this.deviceId && this.nodeId) {
    this.deviceId = this.nodeId;
  }
  if (this.startTime && !this.startedAt) {
    this.startedAt = this.startTime;
  }
  if (this.endTime && !this.stoppedAt) {
    this.stoppedAt = this.endTime;
  }
  if (this.bandwidthUsed !== undefined && !this.bandwidthUsedMB) {
    this.bandwidthUsedMB = this.bandwidthUsed;
  }
  next();
});

export default mongoose.model("ParticipationSession", participationSessionSchema);