import { API_BASE_URL } from './apiConfig.js';

const ERROR_ENDPOINT = `${API_BASE_URL.replace(/\/$/, '')}/errors/frontend`;

function trim(value, maxLength = 4000) {
  if (!value) return undefined;
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function reportFrontendError(error, meta = {}) {
  const payload = {
    message: trim(error?.message || error || 'Frontend error'),
    stack: trim(error?.stack),
    source: meta.source || 'frontend',
    route: window.location.pathname,
    componentStack: trim(meta.componentStack),
    userAgent: navigator.userAgent,
    ...meta,
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      ERROR_ENDPOINT,
      new Blob([body], { type: 'application/json' })
    );
    if (sent) return;
  }

  fetch(ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Error reporting must never break the user flow.
  });
}

export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    reportFrontendError(event.error || event.message, {
      source: event.filename || 'window.error',
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportFrontendError(event.reason, {
      source: 'unhandledrejection',
    });
  });
}
