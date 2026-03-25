import PricingConfig from "../models/PricingConfig.model.js";

// ── In-memory config cache (refreshed every 60 s) ────────────────────────────
let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

const CATEGORY_KEY_MAP = {
  recyclable: "recyclable",
  "non-recyclable": "nonRecyclable",
  both: "mixed",
};

/**
 * Load the singleton PricingConfig (auto-create with defaults if missing).
 */
async function loadConfig() {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let config = await PricingConfig.findOne().lean();
  if (!config) {
    config = await PricingConfig.create({});
    config = await PricingConfig.findById(config._id).lean();
  }

  cachedConfig = config;
  cacheTimestamp = Date.now();
  return config;
}

/**
 * Calculate the estimated pickup price.
 *
 * @param {{ category: string, level: string, distanceKm: number }} params
 * @returns {Promise<{ estimatedPrice: number, priceBreakdown: Object, currency: string }>}
 */
export async function calculatePrice({ category, level, distanceKm }) {
  const config = await loadConfig();

  const catKey = CATEGORY_KEY_MAP[category] || "nonRecyclable";
  const categoryBase = config.categoryBase?.[catKey] ?? 800;
  const lvlMultiplier = config.levelMultiplier?.[level] ?? 1;
  const distanceRate = config.distanceRatePerKm ?? 50;
  const minCharge = config.minimumCharge ?? 500;

  const distanceCharge = Math.round(distanceKm * distanceRate);
  const rawTotal = Math.round(categoryBase * lvlMultiplier + distanceCharge);
  const total = Math.max(minCharge, rawTotal);

  return {
    estimatedPrice: total,
    priceBreakdown: {
      categoryBase,
      levelMultiplier: lvlMultiplier,
      distanceCharge,
      total,
    },
    currency: config.currency || "NPR",
  };
}
