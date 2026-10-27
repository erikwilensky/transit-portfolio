// NIST Transit Portfolio pilot server. Plain Node, no dependencies.
// Serves the built app from dist/ and the JSON API under /api.
// Each feature registers its own routes from server/routes/*.mjs (helpers in lib.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, PORT, app, routes, middleware, send, serveStatic } from './lib.mjs';

// ── Load feature modules, then listen ──
for (const f of fs.readdirSync(path.join(ROOT, 'server/routes')).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(`./routes/${f}`);
  await mod.default?.(app);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  req.query = url.searchParams;
  try {
    for (const m of middleware) if (await m(req, res, url)) return;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (m) return await r.handler(req, res, Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])));
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
  }
});
server.listen(PORT, () => console.log(`Transit Portfolio server on :${PORT} (data in ${DATA_DIR})`));
