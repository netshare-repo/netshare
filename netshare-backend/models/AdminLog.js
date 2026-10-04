import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    action: {
      type: String,
      required: true,
    },

    details: {
      type: String,
      default: "",
    },

    targetType: {
      type: String,
      enum: ["user", "node", "task", "wallet", "system"],
      default: "system",
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AdminLog", adminLogSchema);