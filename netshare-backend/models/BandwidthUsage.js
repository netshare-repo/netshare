import mongoose from "mongoose";

const bandwidthUsageSchema = new mongoose.Schema(
  {
    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: "",
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestingTask",
      default: null,
      index: true,
    },
    uploadBandwidthMB: {
      type: Number,
      default: 0,
    },
    downloadBandwidthMB: {
      type: Number,
      default: 0,
    },
    totalBandwidthMB: {
      type: Number,
      default: 0,
    },
    networkAvailability: {
      type: String,
      enum: ["available", "limited", "congested", "offline"],
      default: "available",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("BandwidthUsage", bandwidthUsageSchema);
