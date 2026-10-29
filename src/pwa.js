// Phone app (docs/pilot-server.md, "Phone app"): the service worker (public/sw.js), "a new version is ready",
// the install hint's state, and clearing caches on sign-out.
const subs = new Set();
const state = { update: false, prompt: null };
const emit = () => subs.forEach((fn) => fn({ ...state }));
export const onPwa = (fn) => { subs.add(fn); fn({ ...state }); return () => subs.delete(fn); };
export const getPwa = () => ({ ...state });

// Android and desktop Chrome offer their own install button; keep the event so the hint can show it.
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.prompt = e; emit(); });
  addEventListener('appinstalled', () => { state.prompt = null; emit(); });
}
export async function install() {
  const p = state.prompt;
  if (!p) return false;
  state.prompt = null; emit();
  await p.prompt();
  return (await p.userChoice).outcome === 'accepted';
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const had = !!navigator.serviceWorker.controller;
  const ready = () => { state.update = true; emit(); };
  // A new deploy's worker takes over at once (skipWaiting); the page still runs the old code until it reloads.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) ready(); });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ready(); });
    });
    // Look for a new deploy whenever the app comes back to the front (phones keep it open for days).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}

// Offline capture: a signed-in account may open the app with no connection, so the worker keeps the page itself
// (index.html, the same for everyone; never /api). Signing out clears it with the other caches.
export function keepShell() {
  try { navigator.serviceWorker?.ready.then((r) => r.active?.postMessage('shell')); } catch { /* none */ }
}

// Sign-out: nothing personal is ever cached, but a shared device starts clean anyway.
export async function clearCaches() {
  try { navigator.serviceWorker?.controller?.postMessage('clear'); } catch { /* none */ }
  try { if (self.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k))); } catch { /* blocked */ }
}

// Where the install hint is worth showing: a phone or tablet browser, not already the installed app.
export const standalone = () => matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const onPhone = () => matchMedia?.('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
const KEY = 'pwa-install-dismissed'; // not tp-: it is about this device, so it outlasts sign-out
export const hintDismissed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const dismissHint = () => { try { localStorage.setItem(KEY, '1'); } catch { /* blocked */ } };
