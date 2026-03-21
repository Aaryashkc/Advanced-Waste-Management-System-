import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    hash: { type: String }, // sha256 of OTP (never store plain OTP)
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date } // for resend cooldown
  },
  { _id: false }
);

const twoFactorSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    secret: { type: String } // encrypted TOTP secret (do NOT store raw if possible)
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    emailVerified: { type: Boolean, default: false },

    role: {
      type: String,
      enum: ["customer_admin", "driver", "admin", "super_admin"],
      default: "customer_admin",
      index: true
    },

    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true
    },

    passwordHash: { type: String, default: null },

    loginOtp: { type: otpSchema, default: null },

    twoFactor: { type: twoFactorSchema, default: () => ({}) },

    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    phoneVerified: { type: Boolean, default: false },

    address: { type: String, default: null },

    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null }
    },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

export default mongoose.model("User", userSchema);
