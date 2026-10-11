import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
    },
    verificationMethod: { type: String, enum: ['email', 'sms'], default: 'email' },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    role: {
      type: String,
      enum: ["node_participant", "platform_client", "admin", "both"],
      required: true,
    },

    profileImage: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "blocked", "restricted"],
      default: "active",
    },

    authorizationVersion: { type: Number, default: 0 },
    isVerified: {
      type: Boolean,
      default: false,
    },

    signupOtpHash: {
      type: String,
      default: null,
    },

    signupOtpExpires: {
      type: Date,
      default: null,
    },

    resetOtpHash: {
      type: String,
      default: null,
    },

    resetOtpExpires: {
      type: Date,
      default: null,
    },

    otpAttempts: {
      type: Number,
      default: 0,
    },

    otpLockedUntil: {
      type: Date,
      default: null,
    },

    lastOtpSentAt: {
      type: Date,
      default: null,
    },
  },
  // Identity indexes are created explicitly by ensureIdentityIndexes(). This
  // prevents Mongoose auto-indexing from racing the legacy-data preflight at
  // process startup.
  { timestamps: true, autoIndex: false }
);

userSchema.index({ email: 1 }, { name: 'identity_email_unique', unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } });
// A phone is an authentication identity only for accounts which selected SMS.
// Email accounts may retain a shared legacy contact number without preventing
// startup; findIdentity() also deliberately ignores those contact numbers.
userSchema.index({ phone: 1 }, { name: 'identity_phone_unique', unique: true, partialFilterExpression: { verificationMethod: 'sms', phone: { $type: 'string', $gt: '' } } });
export default mongoose.model("User", userSchema);
