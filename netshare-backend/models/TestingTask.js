import mongoose from "mongoose";

const testingTaskSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },

    serviceType: {
      type: String,
      enum: [
        "ad_verification",
        "accessibility_testing",
        "localization_testing",
        "performance_testing",
      ],
      required: true,
    },

    targetRegion: {
      type: String,
      required: true,
      trim: true,
    },

    executionLimit: {
      type: Number,
      required: true,
    },

    estimatedCost: {
      type: Number,
      required: true,
    },

    assignedNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "running",
        "completed",
        "failed",
        "settled",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    resultSummary: {
      successRate: { type: Number, default: 0 },
      averageResponseTimeMs: { type: Number, default: 0 },
      bandwidthConsumedMB: { type: Number, default: 0 },
      message: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("TestingTask", testingTaskSchema);