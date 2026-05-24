const LOCAL_API_BASE_URL = 'http://localhost:5001/api';

function normalizeBaseUrl(value) {
  return value?.trim().replace(/\/+$/, '');
}

export function resolveApiBaseUrl() {
  const configuredUrl = normalizeBaseUrl(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  );

  if (configuredUrl) return configuredUrl;
  if (import.meta.env.DEV) return LOCAL_API_BASE_URL;

  throw new Error(
    'Missing VITE_API_BASE_URL. Set it to your Render backend URL ending in /api before building the frontend.'
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
export const ML_API_BASE_URL =
  normalizeBaseUrl(import.meta.env.VITE_ML_API_BASE_URL) || API_BASE_URL;
