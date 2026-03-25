import PricingConfig from "../models/PricingConfig.model.js";

/**
 * GET /api/pricing-config
 * Returns the current pricing configuration.
 * Accessible by super_admin, admin, and driver roles.
 * Auto-creates a default config if none exists.
 */
export const getPricingConfig = async (req, res) => {
  try {
    let config = await PricingConfig.findOne().populate("updatedBy", "name email").lean();

    if (!config) {
      config = await PricingConfig.create({});
      config = await PricingConfig.findById(config._id).populate("updatedBy", "name email").lean();
    }

    return res.status(200).json({ success: true, data: config });
  } catch (err) {
    console.error("getPricingConfig error:", err);
    return res.status(500).json({ message: "Failed to fetch pricing config", error: err.message });
  }
};

/**
 * PUT /api/pricing-config
 * Updates the pricing configuration. Super admin only.
 * Accepts partial updates — only the fields provided are overwritten.
 */
export const updatePricingConfig = async (req, res) => {
  try {
    const { categoryBase, levelMultiplier, distanceRatePerKm, minimumCharge } = req.body;

    const updates = { updatedBy: req.user._id };

    if (categoryBase) {
      if (categoryBase.recyclable != null) updates["categoryBase.recyclable"] = Number(categoryBase.recyclable);
      if (categoryBase.nonRecyclable != null) updates["categoryBase.nonRecyclable"] = Number(categoryBase.nonRecyclable);
      if (categoryBase.mixed != null) updates["categoryBase.mixed"] = Number(categoryBase.mixed);
    }

    if (levelMultiplier) {
      if (levelMultiplier.easy != null) updates["levelMultiplier.easy"] = Number(levelMultiplier.easy);
      if (levelMultiplier.medium != null) updates["levelMultiplier.medium"] = Number(levelMultiplier.medium);
      if (levelMultiplier.hard != null) updates["levelMultiplier.hard"] = Number(levelMultiplier.hard);
    }

    if (distanceRatePerKm != null) updates.distanceRatePerKm = Number(distanceRatePerKm);
    if (minimumCharge != null) updates.minimumCharge = Number(minimumCharge);

    let config = await PricingConfig.findOne();
    if (!config) {
      config = await PricingConfig.create(updates);
    } else {
      config = await PricingConfig.findByIdAndUpdate(config._id, { $set: updates }, { new: true });
    }

    config = await PricingConfig.findById(config._id).populate("updatedBy", "name email").lean();

    return res.status(200).json({ success: true, message: "Pricing config updated", data: config });
  } catch (err) {
    console.error("updatePricingConfig error:", err);
    return res.status(500).json({ message: "Failed to update pricing config", error: err.message });
  }
};
