import mongoose from "mongoose";

const topUpRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  paymentMethod: { type: String, enum: ["bank_transfer", "easypaisa", "jazzcash"], required: true },
  referenceNumber: { type: String, required: true, trim: true },
  referenceKey: { type: String, required: true },
  proofMime: { type: String, enum: ["image/jpeg", "image/png", "application/pdf"], required: true },
  proofSize: { type: Number, required: true },
  proofData: { type: Buffer, required: true, select: false },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  adminNote: { type: String, default: "" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

topUpRequestSchema.index({ referenceKey: 1 }, { unique: true });

export default mongoose.model("TopUpRequest", topUpRequestSchema);
