import Driver from "../models/Driver.model.js";
import Truck from "../models/Truck.model.js";
import Area from "../models/Area.model.js";

// ── Configuration ──────────────────────────────────────────────────────────────
// NOTE: Category-based filtering/scoring has been intentionally disabled.
// Any truck can now take any waste category — the customer's `category`
// selection is still stored on the PickupRequest and surfaced to admins
// and drivers, but it no longer influences which truck gets matched.
// The categoryScore() helper below is preserved so it can be re-enabled
// later by restoring a non-zero `category` weight here.
const WEIGHTS = {
    proximity: 0.5,
    category: 0,   // disabled — kept at 0 to preserve the formula shape
    level: 0.5,
};

const MAX_RADIUS_KM = 30;       // drivers further than this get proximityScore = 0
const MIN_SCORE_THRESHOLD = 0.3; // drivers below this are excluded
const MAX_MATCHED_DRIVERS = 5;   // send to at most N best drivers

// Minimum truck capacity (kg) required for each waste level
const MIN_CAPACITY = {
    easy: 0,
    medium: 1000,
    hard: 3500,
};

// ── Haversine distance (km) ────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring helpers ────────────────────────────────────────────────────────────

/**
 * Proximity score: 1 when at same location, 0 when >= MAX_RADIUS_KM away.
 */
function proximityScore(driverLat, driverLon, pickupLat, pickupLon) {
    if (driverLat == null || driverLon == null) return 0.5; // unknown location → neutral
    const dist = haversineKm(driverLat, driverLon, pickupLat, pickupLon);
    return Math.max(0, 1 - dist / MAX_RADIUS_KM);
}

/**
 * Category compatibility between waste category and truck type.
 *   recyclable   → BIO=1, NON_BIO=0, MIXED=0.8
 *   non-recyclable → NON_BIO=1, BIO=0, MIXED=0.8
 *   both         → MIXED=1, BIO=0.5, NON_BIO=0.5
 *
 * NOTE: Currently NOT used in matching (WEIGHTS.category = 0). Kept here
 * intentionally so the rule set can be restored later without rewriting it.
 */
function categoryScore(wasteCategory, truckType) {
    const matrix = {
        recyclable: { BIO: 1, NON_BIO: 0, MIXED: 0.8 },
        "non-recyclable": { BIO: 0, NON_BIO: 1, MIXED: 0.8 },
        both: { BIO: 0.5, NON_BIO: 0.5, MIXED: 1 },
    };
    return matrix[wasteCategory]?.[truckType] ?? 0.5;
}

/**
 * Level ↔ duty-type compatibility.
 *   easy   (<1000 kg) → light=1, medium=0.7, heavy=0.3
 *   medium (<5000 kg) → medium=1, heavy=0.8, light=0.1
 *   hard   (>5000 kg) → heavy=1, medium=0.2, light=0
 */
function levelScore(wasteLevel, dutyType) {
    const matrix = {
        easy: { "light duty": 1, "medium duty": 0.7, "heavy duty": 0.3 },
        medium: { "light duty": 0.1, "medium duty": 1, "heavy duty": 0.8 },
        hard: { "light duty": 0, "medium duty": 0.2, "heavy duty": 1 },
    };
    return matrix[wasteLevel]?.[dutyType] ?? 0.5;
}

// ── Main matcher ───────────────────────────────────────────────────────────────

/**
 * Find the best-matching available drivers for a pickup request.
 *
 * Filters:
 *  1. Area → Org: only drivers whose truck belongs to the area's organization
 *  2. Capacity: truck must meet minimum capacity for the waste level
 *  (Category compatibility is intentionally NOT enforced — any truck can
 *   handle any waste category. Customer's category selection is preserved
 *   on the PickupRequest for admin/driver visibility only.)
 *
 * @param {Object} pickup - { latitude, longitude, category, level, orgId?, area? }
 * @returns {Promise<Array<{ userId: string, score: number }>>}
 */
export async function findBestDrivers(pickup) {
    const { latitude, longitude, category, level, orgId, area } = pickup;

    // 1. Resolve the target organization from the area
    let targetOrgId = orgId || null;
    if (area) {
        const areaDoc = await Area.findOne({ name: area, isActive: true }).lean();
        if (areaDoc?.orgId) {
            targetOrgId = areaDoc.orgId.toString();
        }
    }

    // 2. Fetch available drivers with their truck details.
    // Prototype note: this intentionally scores available drivers in memory.
    // At scale, add geospatial filtering first, then score only nearby drivers.
    const drivers = await Driver.find({ isAvailable: true }).populate(
        "assignedTruckId",
        "truckType capacity dutyType orgId"
    );

    if (!drivers.length) {
        console.log("[DriverMatcher] No available drivers found");
        return [];
    }

    // 3. Filter and score each driver
    const minCap = MIN_CAPACITY[level] ?? 0;

    const scored = drivers
        .filter((d) => {
            if (!d.assignedTruckId) return false; // must have a truck

            const truck = d.assignedTruckId;

            // Area→Org filter: only allow trucks from the target organization
            if (targetOrgId && truck.orgId?.toString() !== targetOrgId) return false;

            // Capacity hard filter: truck must handle the load
            if (truck.capacity < minCap) return false;

            return true;
        })
        .map((d) => {
            const truck = d.assignedTruckId;

            const pScore = proximityScore(
                d.currentLocation?.latitude,
                d.currentLocation?.longitude,
                latitude,
                longitude
            );
            // Category score still computed for visibility/debugging but
            // not used in the total (WEIGHTS.category = 0).
            const cScore = categoryScore(category, truck.truckType);
            const lScore = levelScore(level, truck.dutyType);

            const total =
                WEIGHTS.proximity * pScore +
                WEIGHTS.category * cScore +
                WEIGHTS.level * lScore;

            return {
                driverId: d._id,
                userId: d.userId,
                score: Math.round(total * 1000) / 1000,
                breakdown: { proximity: pScore, category: cScore, level: lScore },
            };
        });

    // 4. Filter by threshold, sort descending, cap at MAX
    const matched = scored
        .filter((s) => s.score >= MIN_SCORE_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MATCHED_DRIVERS);

    console.log(
        `[DriverMatcher] ${scored.length} eligible drivers scored → ${matched.length} matched (threshold=${MIN_SCORE_THRESHOLD}, targetOrg=${targetOrgId || "any"})`
    );
    matched.forEach((m) =>
        console.log(
            `  driver=${m.userId} score=${m.score} (prox=${m.breakdown.proximity.toFixed(2)} cat=${m.breakdown.category.toFixed(2)} lvl=${m.breakdown.level.toFixed(2)})`
        )
    );

    return matched;
}
