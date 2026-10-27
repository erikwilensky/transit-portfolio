// NIST Transit Portfolio pilot server. Plain Node, no dependencies.
// Serves the built app from dist/ and the JSON API under /api.
// Each feature registers its own routes from server/routes/*.mjs (helpers in lib.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, PORT, app, routes, middleware, send, serveStatic, securityHeaders, logRequest, shutdownHooks } from './lib.mjs';

// Fail at start, with a clear message, when the data folder cannot be written (a bind mount owned by
// another user, for instance), rather than on the first save.
try {
  const probe = path.join(DATA_DIR, `.write-test-${process.pid}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
} catch (e) {
  console.error(`Cannot write to the data folder ${DATA_DIR} (${e.code || e.message}). In Docker on Linux: sudo chown -R 1000:1000 <data folder>.`);
  process.exit(1);
}

// ── Load feature modules, then listen ──
for (const f of fs.readdirSync(path.join(ROOT, 'server/routes')).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(`./routes/${f}`);
  await mod.default?.(app);
}

const open = new Set(); // responses in flight, so shutdown can end event streams and wait for the rest
let stopping = false;

const server = http.createServer(async (req, res) => {
  open.add(res);
  res.once('close', () => open.delete(res));
  securityHeaders(req, res);
  try {
    const url = new URL(req.url, 'http://x');
    if (stopping) res.setHeader('connection', 'close');
    if (!url.pathname.startsWith('/api/')) return await serveStatic(req, res, url.pathname);
    logRequest(req, res, url.pathname);
    req.query = url.searchParams;
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
    else res.destroy();
  }
});
server.keepAliveTimeout = 65_000; // longer than cloudflared's idle timeout, so it never reuses a closed socket
server.headersTimeout = 66_000;
server.listen(PORT, () => console.log(`Transit Portfolio server on :${PORT} (data in ${DATA_DIR})`));

// ── Graceful shutdown (docker stop sends SIGTERM) ──
// Stop accepting connections, close idle keep-alive sockets, end event streams (browsers reconnect to
// the new server), let other in-flight requests finish, run the flush hooks, exit.
const TIMEOUT = Number(process.env.SHUTDOWN_TIMEOUT_MS || 8000);
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: finishing ${open.size} open request(s), then stopping`);
  const force = setTimeout(() => { console.log('Shutdown timeout: closing remaining connections'); server.closeAllConnections(); }, TIMEOUT);
  force.unref();
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeIdleConnections();
  for (const res of open) if (String(res.getHeader('content-type') || '').startsWith('text/event-stream')) res.end();
  await closed;
  clearTimeout(force);
  let code = 0;
  for (const fn of shutdownHooks) {
    try { await fn(); } catch (e) { console.error('Shutdown hook failed:', e); code = 1; }
  }
  console.log('Stopped cleanly');
  process.exit(code);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
