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

    method: { type: String, enum: ["GET"], default: "GET" },

    serviceType: {
      type: String,
      enum: [
        "ad_verification",
        "accessibility_testing",
        "localization_testing",
        "performance_testing",
        "PUBLIC_DATA_FETCH",
        "BROWSER_PAGE_INSPECT",
      ],
      required: true,
    },

    targetRegion: {
      type: String,
      required: true,
      trim: true,
    },

    browserPageInspect: {
      contractVersion: { type: Number, default: 1 },
      viewport: {
        width: { type: Number, default: 1365 },
        height: { type: Number, default: 768 },
        deviceScaleFactor: { type: Number, default: 1 },
      },
      pageLoadTimeoutMs: { type: Number, default: 15000 },
      maxTextBytes: { type: Number, default: 32768 },
      captureScreenshot: { type: Boolean, default: true },
    },

    // Internal recurring uptime probe linkage. These tasks use the existing
    // performance_testing GET executor and are created only by the scheduler.
    regionalUptimeMonitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegionalUptimeMonitor",
      default: null,
      index: true,
    },
    regionalUptimeRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegionalUptimeRun",
      default: null,
      index: true,
    },
    regionalUptimeRunCost: { type: Number, min: 0, default: null },

    executionLimit: {
      type: Number,
      required: true,
    },

    estimatedCost: {
      type: Number,
      required: true,
    },

    pricingSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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

    clientRating: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 500, default: "" },
      ratedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export default mongoose.model("TestingTask", testingTaskSchema);
