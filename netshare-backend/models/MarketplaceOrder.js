import mongoose from "mongoose";

const marketplaceOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceProduct",
      required: true,
    },

    productName: {
      type: String,
      required: true,
    },

    creditsSpent: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "fulfilled", "cancelled", "rejected"],
      default: "pending",
    },

    fulfilmentNote: {
      type: String,
      default: "",
    },

    fulfilledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    fulfilledAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundedCredits: {
      type: Number,
      default: 0,
    },

    refundTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditTransaction",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "MarketplaceOrder",
  marketplaceOrderSchema
);