import mongoose from "mongoose";
import Area from "../models/Area.model.js";
import Location from "../models/Location.model.js";
import Organization from "../models/Organization.model.js";
import User from "../models/User.model.js";

const LOCATION_ALIASES = {
  kathmandu: [
    "kathmandu",
    "ktm",
    "kathmandu metropolitan city",
    "kathmandu metro",
  ],
  lalitpur: [
    "lalitpur",
    "patan",
    "lalitpur metropolitan city",
  ],
  bhaktapur: [
    "bhaktapur",
    "bkt",
    "bhaktapur municipality",
  ],
};

const LOCALITY_REGION_HINTS = {
  kathmandu: [
    "kamalpokhari",
    "dhobidhara",
    "thamel",
    "maitidevi",
    "baneshwor",
    "kirtipur",
    "balaju",
    "newroad",
    "new road",
    "kalanki",
    "boudha",
    "bouddha",
    "gaushala",
    "sinamangal",
    "lazimpat",
    "naxal",
    "putalisadak",
  ],
  lalitpur: [
    "jawalakhel",
    "pulchowk",
    "kupandol",
    "sanepa",
    "satdobato",
    "lagankhel",
  ],
  bhaktapur: [
    "suryabinayak",
    "madhyapur",
    "thimi",
    "nagarkot",
  ],
};

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandLocationTokens(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return new Set();

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  for (const [region, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalizeText(alias)))) {
      tokens.add(region);
    }
  }
  return tokens;
}

function detectRegionsFromText(value = "") {
  const normalized = normalizeText(value);
  const regions = new Set();
  if (!normalized) return regions;

  for (const [region, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(normalizeText(alias)))) {
      regions.add(region);
    }
  }
  for (const [region, hints] of Object.entries(LOCALITY_REGION_HINTS)) {
    if (hints.some((hint) => normalized.includes(normalizeText(hint)))) {
      regions.add(region);
    }
  }

  return regions;
}

function addTextSignals(profile, text) {
  const tokens = expandLocationTokens(text);
  tokens.forEach((token) => profile.tokens.add(token));
  detectRegionsFromText(text).forEach((region) => profile.regions.add(region));
}

function addIdentitySignals(profile, text) {
  detectRegionsFromText(text).forEach((region) => profile.identityRegions.add(region));
  addTextSignals(profile, text);
}

function scoreOrgMatch(userSignals, orgProfile) {
  let score = 0;
  for (const region of userSignals.regions) {
    if (orgProfile.regions.has(region)) score += 100;
  }
  for (const token of userSignals.tokens) {
    if (orgProfile.tokens.has(token)) score += token.length <= 3 ? 1 : 2;
  }
  return score;
}

function distanceKm(a, b) {
  const lat1 = Number(a?.latitude);
  const lng1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude);
  const lng2 = Number(b?.longitude);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function buildOrgProfiles() {
  const [orgs, areas, locations] = await Promise.all([
    Organization.find({})
      .select("name location.address location.latitude location.longitude")
      .lean(),
    Area.find({ orgId: { $ne: null }, isActive: true })
      .select("name address coordinates orgId")
      .lean(),
    Location.find({ orgId: { $ne: null } })
      .select("city area address latitude longitude orgId")
      .lean(),
  ]);

  const profiles = new Map();
  for (const org of orgs) {
    const profile = {
      org,
      tokens: new Set(),
      regions: new Set(),
      identityRegions: new Set(),
      coordinates: [],
    };
    addIdentitySignals(profile, `${org.name || ""} ${org.location?.address || ""}`);
    if (org.location?.latitude != null && org.location?.longitude != null) {
      profile.coordinates.push(org.location);
    }
    profiles.set(org._id.toString(), profile);
  }

  for (const area of areas) {
    const profile = profiles.get(area.orgId?.toString());
    if (!profile) continue;
    addTextSignals(profile, `${area.name || ""} ${area.address || ""}`);
    if (area.coordinates?.latitude != null && area.coordinates?.longitude != null) {
      profile.coordinates.push(area.coordinates);
    }
  }

  for (const location of locations) {
    const profile = profiles.get(location.orgId?.toString());
    if (!profile) continue;
    addTextSignals(profile, `${location.city || ""} ${location.area || ""} ${location.address || ""}`);
    profile.coordinates.push(location);
  }

  return [...profiles.values()];
}

function buildUserSignals({ address, location } = {}) {
  const text = `${address || ""} ${location?.address || ""}`;
  const signals = {
    tokens: expandLocationTokens(text),
    regions: detectRegionsFromText(text),
    location,
  };
  return signals;
}

function chooseBestOrgProfile(userSignals, orgProfiles) {
  if (userSignals.regions.size > 0) {
    const identityMatches = orgProfiles.filter((profile) =>
      [...userSignals.regions].some((region) => profile.identityRegions.has(region))
    );

    if (identityMatches.length === 1) return identityMatches[0];

    if (identityMatches.length > 1) {
      const bestIdentityMatch = identityMatches
        .map((profile) => ({ profile, score: scoreOrgMatch(userSignals, profile) }))
        .sort((a, b) => b.score - a.score);

      if (bestIdentityMatch[0]?.score > (bestIdentityMatch[1]?.score ?? 0)) {
        return bestIdentityMatch[0].profile;
      }
    }
  }

  const scored = orgProfiles
    .map((profile) => ({ profile, score: scoreOrgMatch(userSignals, profile) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1 || (scored[0] && scored[0].score > scored[1]?.score)) {
    return scored[0].profile;
  }

  if (userSignals.location?.latitude != null && userSignals.location?.longitude != null) {
    const nearestByOrg = new Map();
    for (const profile of orgProfiles) {
      for (const coordinates of profile.coordinates) {
        const km = distanceKm(userSignals.location, coordinates);
        const key = profile.org._id.toString();
        if (km < (nearestByOrg.get(key)?.km ?? Infinity)) {
          nearestByOrg.set(key, { profile, km });
        }
      }
    }

    const nearest = [...nearestByOrg.values()].sort((a, b) => a.km - b.km);

    if (nearest[0]?.km <= 25 && nearest[0].km + 1 < (nearest[1]?.km ?? Infinity)) {
      return nearest[0].profile;
    }
  }

  return null;
}

export async function resolveOrgIdForUserLocation({ address, location } = {}) {
  if (mongoose.connection.readyState !== 1) return null;

  try {
    const profile = chooseBestOrgProfile(
      buildUserSignals({ address, location }),
      await buildOrgProfiles()
    );
    return profile?.org?._id || null;
  } catch (error) {
    console.warn("[UserOrgResolver] Organization lookup failed:", error.message);
    return null;
  }
}

export async function backfillUnassignedUsersForOrg(orgId, { limit = 1000 } = {}) {
  if (mongoose.connection.readyState !== 1 || !orgId) return { matched: 0, checked: 0 };

  let orgProfiles = [];
  try {
    orgProfiles = await buildOrgProfiles();
  } catch (error) {
    console.warn("[UserOrgResolver] Backfill profile lookup failed:", error.message);
    return { matched: 0, checked: 0 };
  }

  const candidates = await User.find({
    orgId: null,
    role: { $ne: "super_admin" },
    $or: [
      { address: { $exists: true, $nin: [null, ""] } },
      { "location.address": { $exists: true, $nin: [null, ""] } },
      {
        "location.latitude": { $exists: true, $ne: null },
        "location.longitude": { $exists: true, $ne: null },
      },
    ],
  })
    .select("_id address location")
    .limit(limit)
    .lean();

  let matched = 0;
  for (const user of candidates) {
    const profile = chooseBestOrgProfile(
      buildUserSignals({ address: user.address, location: user.location }),
      orgProfiles
    );
    const resolvedOrgId = profile?.org?._id || null;

    if (resolvedOrgId?.toString() !== orgId.toString()) continue;

    const result = await User.updateOne(
      { _id: user._id, orgId: null },
      { $set: { orgId: resolvedOrgId } }
    );
    matched += result.modifiedCount || 0;
  }

  return { matched, checked: candidates.length };
}
