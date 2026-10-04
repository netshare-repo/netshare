import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "subscription",
        "digital_tool",
        "voucher",
        "software",
        "other",
      ],
      default: "other",
    },

    requiredCredits: {
      type: Number,
      required: true,
      min: 1,
    },

    imageUrl: {
      type: String,
      default: "",
    },

    stock: {
      type: Number,
      default: 10,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "MarketplaceProduct",
  marketplaceProductSchema
);