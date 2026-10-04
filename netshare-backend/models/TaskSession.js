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

    // DEPRECATED: Will be removed in Phase 2 when real secure routing is implemented.
    // Kept for backward compatibility with existing records.
    simulatedSecureChannel: {
      type: Boolean,
      default: false,
    },

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