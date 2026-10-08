import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: ["bank_transfer", "easypaisa", "jazzcash"], required: true },
  accountDetails: { type: String, required: true, select: false },
  status: { type: String, enum: ["pending", "approved", "rejected", "processed"], default: "pending", index: true },
  adminNote: { type: String, default: "" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  processedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
