/**
 * Web only: expo-sqlite needs a cross-origin isolated page. If the host didn't send the
 * COOP/COEP headers, install a service worker that adds them and reload once.
 */
const FLAG = 'reptrack.coi-reload';

export function ensureCrossOriginIsolation(): boolean {
  if (typeof window === 'undefined' || window.crossOriginIsolated) return true;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return false;

  navigator.serviceWorker
    .register('/coi-serviceworker.js')
    .then(async (registration) => {
      await navigator.serviceWorker.ready;
      if (sessionStorage.getItem(FLAG)) return; // avoid reload loops
      sessionStorage.setItem(FLAG, '1');
      if (registration.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      } else if (navigator.serviceWorker.controller) {
        window.location.reload();
      }
    })
    .catch((error) => console.warn('[web] could not enable cross-origin isolation', error));
  return false;
}
