import mongoose from "mongoose";

const taskSessionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestingTask",
      required: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NodeDevice",
      required: true,
    },

    sessionToken: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "running", "completed", "failed"],
      default: "created",
    },

    // REMOVED: simulatedSecureChannel was a placeholder for real routing.
    // Phase 2A introduces RoutingSession for real secure session tracking.
    // Field intentionally absent from schema; existing DB records retain it
    // but it is never read or written by application code.

    bandwidthUsedMB: {
      type: Number,
      default: 0,
    },

    latencyMs: {
      type: Number,
      default: 0,
    },

    logs: [
      {
        message: String,
        time: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("TaskSession", taskSessionSchema);