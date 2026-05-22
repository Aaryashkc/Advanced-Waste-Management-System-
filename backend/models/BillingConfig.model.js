import mongoose from "mongoose";

/**
 * BillingConfig — configurable monthly fees per organization.
 *
 * Stores separate fees for customers and admins.
 * A record with orgId: null is the global default.
 */
const billingConfigSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    customerMonthlyFee: { type: Number, required: true, min: 0, default: 500 },
    adminMonthlyFee: { type: Number, required: true, min: 0, default: 1000 },
    currency: { type: String, default: "NPR" },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// One config per org (null = global default)
billingConfigSchema.index({ orgId: 1 }, { unique: true });

const BillingConfig = mongoose.model("BillingConfig", billingConfigSchema);
export default BillingConfig;
