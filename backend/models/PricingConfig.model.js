import mongoose from "mongoose";

/**
 * PricingConfig — singleton document holding configurable pickup pricing rates.
 *
 * Only one active config exists at a time. Super admins can update rates;
 * admins and drivers can view them read-only.
 */
const pricingConfigSchema = new mongoose.Schema(
  {
    categoryBase: {
      recyclable: { type: Number, default: 500 },
      nonRecyclable: { type: Number, default: 800 },
      mixed: { type: Number, default: 1000 },
    },

    levelMultiplier: {
      easy: { type: Number, default: 1.0 },
      medium: { type: Number, default: 2.5 },
      hard: { type: Number, default: 5.0 },
    },

    distanceRatePerKm: { type: Number, default: 50 },
    minimumCharge: { type: Number, default: 500 },
    currency: { type: String, default: "NPR" },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const PricingConfig = mongoose.model("PricingConfig", pricingConfigSchema);
export default PricingConfig;
