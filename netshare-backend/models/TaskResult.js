import mongoose from "mongoose";

const taskResultSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestingTask",
      required: true,
      index: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
      index: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    nodeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    serviceType: {
      type: String,
      required: true,
    },

    targetUrl: {
      type: String,
      required: true,
    },

    success: {
      type: Boolean,
      default: true,
    },

    successRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },

    latencyMs: {
      type: Number,
      default: 0,
    },

    packetLoss: {
      type: Number,
      default: null,
    },

    bandwidthUsedMB: {
      type: Number,
      default: 0,
    },

    statusCode: {
      type: Number,
      default: 200,
    },

    resultData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Enforce exactly-once result persistence for a task on its assigned node,
// including duplicate delivery handled by different backend processes.
taskResultSchema.index({ taskId: 1, nodeId: 1 }, { unique: true });

export default mongoose.model("TaskResult", taskResultSchema);
