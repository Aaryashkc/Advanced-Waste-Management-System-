const DEFAULT_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30_000);
const cache = new Map();

function now() {
  return Date.now();
}

export function getDashboardCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setDashboardCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: now() + ttlMs,
  });
  return value;
}

export function invalidateDashboardCache() {
  cache.clear();
}

export function cacheDashboardResponse(key, builder, ttlMs = DEFAULT_TTL_MS) {
  const cached = getDashboardCache(key);
  if (cached) return cached;

  return Promise.resolve(builder()).then((value) => setDashboardCache(key, value, ttlMs));
}
