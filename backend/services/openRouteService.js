import axios from "axios";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const ORS_API_KEY = process.env.ORS_API_KEY;

// ── In-memory cache (5-min TTL) ───────────────────────────────────────────────
const routeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(origin, destination) {
  const round = (n) => Math.round(n * 1000) / 1000; // ~110 m precision
  return `${round(origin.latitude)},${round(origin.longitude)}:${round(destination.latitude)},${round(destination.longitude)}`;
}

function getCached(key) {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.data;
}

// ── Haversine (straight-line) fallback ────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine-based fallback when ORS is unavailable.
 * Applies 1.3× multiplier to approximate road distance and assumes 30 km/h average speed.
 */
export function haversineFallback(origin, destination) {
  const straightKm = haversineKm(
    origin.latitude, origin.longitude,
    destination.latitude, destination.longitude
  );
  const distanceKm = Math.round(straightKm * 1.3 * 100) / 100;
  const durationMinutes = Math.round((distanceKm / 30) * 60 * 10) / 10;
  return {
    distanceKm,
    durationMinutes,
    geometry: null, // no polyline available in fallback
    fallback: true,
  };
}

/**
 * Get driving route between two points via OpenRouteService.
 *
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @returns {Promise<{ distanceKm: number, durationMinutes: number, geometry: Array<[number,number]>|null, fallback?: boolean }>}
 */
export async function getRoute(origin, destination) {
  // Check cache first
  const key = cacheKey(origin, destination);
  const cached = getCached(key);
  if (cached) return cached;

  // If no API key, fall back immediately
  if (!ORS_API_KEY || ORS_API_KEY === "your_key_here") {
    console.warn("[ORS] No API key configured — using Haversine fallback");
    const fb = haversineFallback(origin, destination);
    routeCache.set(key, { data: fb, ts: Date.now() });
    return fb;
  }

  try {
    // ORS uses [longitude, latitude] order (GeoJSON)
    const coordinates = [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ];

    const response = await axios.post(
      `${ORS_BASE_URL}/v2/directions/driving-car/geojson`,
      { coordinates },
      {
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const feature = response.data.features?.[0];
    if (!feature) {
      console.warn("[ORS] No route features returned — using fallback");
      return haversineFallback(origin, destination);
    }

    const summary = feature.properties.summary;
    const result = {
      distanceKm: Math.round((summary.distance / 1000) * 100) / 100,
      durationMinutes: Math.round((summary.duration / 60) * 10) / 10,
      geometry: feature.geometry.coordinates, // [[lng, lat], ...]
      fallback: false,
    };

    routeCache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("[ORS] Route request failed:", err.message);
    const fb = haversineFallback(origin, destination);
    routeCache.set(key, { data: fb, ts: Date.now() });
    return fb;
  }
}
