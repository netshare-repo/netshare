import mongoose from "mongoose";

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestingTask",
      default: null,
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      default: "completed",
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CreditTransaction", creditTransactionSchema);