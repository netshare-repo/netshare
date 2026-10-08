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
      default: undefined,
    },
  },
  { timestamps: true }
);

// Only string keys participate, so legacy/null transactions remain valid while
// duplicate financial operations are rejected at the database boundary.
creditTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model("CreditTransaction", creditTransactionSchema);
