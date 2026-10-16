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

    publicFetch: {
      contractVersion: { type: Number },
      content: { type: String, validate: {
        validator: value => value == null || Buffer.byteLength(value, 'utf8') <= 16 * 1024,
        message: 'Public fetch content exceeds 16 KiB',
      } },
      contentType: { type: String, maxlength: 100 },
      httpStatus: { type: Number },
      sourceNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NodeDevice' },
      executedAt: { type: Date },
      responseSizeBytes: { type: Number, min: 0, max: 16 * 1024 },
      ttfbMs: { type: Number, min: 0 },
      totalTimeMs: { type: Number, min: 0 },
      finalUrl: { type: String, maxlength: 2048 },
    },

    browserPageInspect: {
      contractVersion: { type: Number },
      finalUrl: { type: String, maxlength: 2048 },
      httpStatus: { type: Number, min: 0, max: 599 },
      pageTitle: { type: String, maxlength: 512 },
      viewport: {
        width: { type: Number, min: 320, max: 1920 },
        height: { type: Number, min: 320, max: 2160 },
        deviceScaleFactor: { type: Number, enum: [1, 1.5, 2] },
      },
      textContent: { type: String, validate: {
        validator: value => value == null || Buffer.byteLength(value, 'utf8') <= 32 * 1024,
        message: 'Browser extracted text exceeds 32 KiB',
      } },
      textSizeBytes: { type: Number, min: 0, max: 32 * 1024 },
      screenshotArtifact: {
        artifactId: { type: String, match: /^[a-f0-9]{32}$/ },
        contentType: { type: String, enum: ['image/png'] },
        sizeBytes: { type: Number, min: 1, max: 2 * 1024 * 1024 },
        sha256: { type: String, match: /^[a-f0-9]{64}$/ },
      },
      sourceNodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'NodeDevice' },
      executedAt: { type: Date },
      resourceCount: { type: Number, min: 0, max: 64 },
      blockedResourceCount: { type: Number, min: 0, max: 64 },
      transferredBytes: { type: Number, min: 0, max: 8 * 1024 * 1024 },
      ttfbMs: { type: Number, min: 0 },
      pageLoadTimeMs: { type: Number, min: 0, max: 20000 },
      totalTimeMs: { type: Number, min: 0, max: 30000 },
      error: { type: String, maxlength: 500 },
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
