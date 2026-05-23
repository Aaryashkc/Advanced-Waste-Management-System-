let deferredInstallPrompt = null;
let initialized = false;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(deferredInstallPrompt));
}

export function initPwaInstallPrompt() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    notify();
  });
}

export function getPwaInstallPrompt() {
  return deferredInstallPrompt;
}

export function clearPwaInstallPrompt() {
  deferredInstallPrompt = null;
  notify();
}

export function subscribeToPwaInstallPrompt(listener) {
  listeners.add(listener);
  listener(deferredInstallPrompt);
  return () => listeners.delete(listener);
}
