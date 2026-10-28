// Transit Portfolio service worker: the phone app's shell (src/pwa.js registers it; docs/pilot-server.md, "Phone app").
// Caches only the built app (scripts, styles, icons, the offline page). Never /api/*: the record, sign-in and
// uploaded files (/api/files/*) are personal and must not stay on a shared device. Signing out clears every cache.
// VERSION and SHELL are filled in at build time (vite.config.js), so each deploy is a new worker that takes over at once.
const VERSION = 'dev';
const SHELL = [];
const CACHE = `tp-shell-${VERSION}`;
const BASE = new URL('./', self.location).pathname;
const STATIC = ['offline.html', 'icons/icon-192.png', 'manifest.webmanifest'];
const OFFLINE = `${BASE}offline.html`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...STATIC, ...SHELL].map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data === 'clear') e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});

const cacheFirst = async (req) => {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
  return res;
};
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return; // network only, never cached
  if (req.mode === 'navigate') {
    // The page itself always comes from the server (it may have changed); a friendly page when there is none.
    e.respondWith(fetch(req).then((res) => ([502, 503, 504, 530].includes(res.status) ? caches.match(OFFLINE).then((o) => o || res) : res)).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Built files have the content's hash in their name, so a cached copy is always right.
  if (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}icons/`)) e.respondWith(cacheFirst(req));
});
