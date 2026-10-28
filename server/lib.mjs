// Shared helpers for the pilot server and its route modules.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = process.env.DIST_DIR || path.join(ROOT, 'dist');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, '.data');
export const PORT = Number(process.env.PORT || 8787);
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── A tiny router: app.get('/api/x/:id', (req, res, params) => ...) ──
const routes = [];
const add = (method) => (pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
  routes.push({ method, re, keys, handler });
};
export const app = { get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE') };
export { routes };

// ── Compression ──
// 'br', 'gzip' or null, from the request's Accept-Encoding (q=0 means "not this one").
export function pickEncoding(req) {
  const accept = String(req?.headers?.['accept-encoding'] || '').toLowerCase();
  const ok = (name) => accept.split(',').some((part) => {
    const [n, ...params] = part.trim().split(';');
    return (n.trim() === name || n.trim() === '*') && !params.some((p) => /^\s*q=0(\.0*)?\s*$/.test(p));
  });
  return ok('br') ? 'br' : ok('gzip') ? 'gzip' : null;
}
const BR_FAST = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } };
const BR_BEST = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } };

// Helpers every route module can use.
// send() compresses JSON replies of 1 KB or more (the whole record, for instance) when the browser accepts it.
export const send = (res, status, body, headers = {}) => {
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  let data = json ? Buffer.from(JSON.stringify(body)) : body;
  const h = { 'content-type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers };
  const enc = json && data.length >= 1024 && !h['content-encoding'] ? pickEncoding(res.req) : null;
  if (enc) { data = enc === 'br' ? zlib.brotliCompressSync(data, BR_FAST) : zlib.gzipSync(data); h['content-encoding'] = enc; h.vary = 'Accept-Encoding'; }
  res.writeHead(status, h);
  res.end(data);
};
export const readBody = (req, limit = 25 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
export const readJson = async (req) => { const b = await readBody(req, 8 * 1024 * 1024); try { return b.length ? JSON.parse(b) : {}; } catch { throw Object.assign(new Error('Bad JSON'), { status: 400 }); } };
export const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
// Writes a file atomically, so a crash mid-write never leaves half a record.
export const writeAtomic = (file, data) => { const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); };

// Middleware run before every /api route: (req, res) => true to stop (it already replied).
// The sign-in module uses this to attach req.user and guard routes.
export const middleware = [];

// ── Static files from dist/ ──
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json; charset=utf-8' };
export const contentType = (f) => TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';

// Text files worth compressing. Each compressed copy is made once per file version and kept in memory
// (dist/ is small and only changes on a deploy, which restarts the server anyway).
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.webmanifest']);
const packed = new Map(); // `${file}:${mtime}:${enc}` → Promise<Buffer>
const compressed = (file, stat, enc) => {
  const key = `${file}:${stat.mtimeMs}:${enc}`;
  if (!packed.has(key)) {
    const raw = fs.readFileSync(file);
    packed.set(key, new Promise((resolve, reject) => {
      const done = (e, b) => (e ? reject(e) : resolve(b));
      if (enc === 'br') zlib.brotliCompress(raw, BR_BEST, done); else zlib.gzip(raw, { level: 9 }, done);
    }));
  }
  return packed.get(key);
};

export async function serveStatic(req, res, urlPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { allow: 'GET, HEAD' });
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return send(res, 400, 'Bad path'); }
  let f = path.normalize(path.join(DIST, rel));
  if (f !== DIST && !f.startsWith(DIST + path.sep)) return send(res, 403, 'Forbidden');
  let stat = fs.statSync(f, { throwIfNoEntry: false });
  if (!stat || stat.isDirectory()) {
    // A missing asset (a path with a file extension) is a 404; any other path gets the app.
    if (path.extname(rel) && !rel.endsWith('.html')) return send(res, 404, 'Not found');
    f = path.join(DIST, 'index.html');
    stat = fs.statSync(f, { throwIfNoEntry: false });
  }
  if (!stat) return send(res, 404, 'Build the app first: npm run build');
  const ext = path.extname(f).toLowerCase();
  const etag = `W/"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  // The phone app's service worker, manifest and icons keep their address across deploys: always revalidate.
  const fresh = ext === '.html' || ext === '.webmanifest' || f === path.join(DIST, 'sw.js') || f.startsWith(path.join(DIST, 'icons') + path.sep);
  const headers = { 'content-type': contentType(f), 'cache-control': fresh ? 'no-cache' : 'public, max-age=31536000, immutable', etag };
  if (COMPRESSIBLE.has(ext)) headers.vary = 'Accept-Encoding';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  const enc = COMPRESSIBLE.has(ext) && stat.size >= 1024 ? pickEncoding(req) : null;
  if (enc) {
    const body = await compressed(f, stat, enc);
    res.writeHead(200, { ...headers, 'content-encoding': enc, 'content-length': body.length });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(f).on('error', () => res.destroy()).pipe(res);
}

// ── Behind cloudflared ──
// On the Mac, cloudflared forwards https://transit.wilenskycs.online to this server. The server sees
// cloudflared (or Docker's gateway) as the peer; the visitor's address and scheme arrive in
// CF-Connecting-IP, X-Forwarded-For, X-Forwarded-Proto and CF-Visitor. Those headers are believed
// only from a trusted peer, set with TRUST_PROXY:
//   auto (default)     loopback and private addresses (cloudflared on the same machine, Docker's gateway)
//   all / 1 / true     any peer (only when nothing but the proxy can reach the port)
//   none / 0 / false   never: always the socket's own address and scheme
const TRUST = String(process.env.TRUST_PROXY || 'auto').toLowerCase();
const PRIVATE = new net.BlockList();
for (const [a, n] of [['127.0.0.0', 8], ['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['169.254.0.0', 16], ['100.64.0.0', 10]]) PRIVATE.addSubnet(a, n, 'ipv4');
for (const [a, n] of [['::1', 128], ['fc00::', 7], ['fe80::', 10]]) PRIVATE.addSubnet(a, n, 'ipv6');
const bare = (ip = '') => (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip);
function trustedPeer(req) {
  if (['all', '1', 'true', 'yes'].includes(TRUST)) return true;
  if (['none', '0', 'false', 'no'].includes(TRUST)) return false;
  const ip = bare(req.socket?.remoteAddress);
  return net.isIP(ip) ? PRIVATE.check(ip, net.isIPv4(ip) ? 'ipv4' : 'ipv6') : false;
}
// The visitor's IP address. From a trusted proxy: CF-Connecting-IP (set by Cloudflare's edge), else the
// last X-Forwarded-For entry (the one the nearest proxy added; earlier entries can be forged by the
// client). Otherwise the socket's peer address.
export function clientIp(req) {
  const peer = bare(req.socket?.remoteAddress || '');
  if (!trustedPeer(req)) return peer;
  const cf = bare(String(req.headers['cf-connecting-ip'] || '').trim());
  if (net.isIP(cf)) return cf;
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => bare(s.trim())).filter((s) => net.isIP(s));
  return xff.length ? xff[xff.length - 1] : peer;
}
// True when the visitor reached the site over HTTPS: a TLS socket, or a trusted proxy saying so
// (X-Forwarded-Proto: https, or Cloudflare's CF-Visitor {"scheme":"https"}). Use it to mark cookies Secure.
export function isHttps(req) {
  if (req.socket?.encrypted) return true;
  if (!trustedPeer(req)) return false;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto) return proto === 'https';
  try { return JSON.parse(req.headers['cf-visitor'] || '{}').scheme === 'https'; } catch { return false; }
}

// ── Security headers, on every response ──
// The Content Security Policy the app works under:
// - fonts: Switzer from Fontshare (api.fontshare.com CSS, cdn.fontshare.com files) and the theme fonts
//   from Google Fonts (fonts.googleapis.com CSS, fonts.gstatic.com files), see index.html;
// - script-src 'unsafe-inline': a student's own site (Code tier, share links) runs in a sandboxed srcdoc
//   iframe, and srcdoc frames inherit this policy, so their inline <script> needs it. No 'unsafe-eval'
//   and no outside script hosts. The app's own code is all in files under /assets;
// - img-src https:: students' pages and sites may show pictures from the web; data: and blob: are photo
//   uploads resized in the browser and files the app hands out for download.
// TP_CSP replaces the whole policy (an empty TP_CSP sends none).
export const CSP = process.env.TP_CSP ?? [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');
export function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (CSP) res.setHeader('Content-Security-Policy', CSP);
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}

// ── Request log: one line per /api request; never bodies or query strings ──
//   2026-10-27T21:50:57.123Z 203.0.113.9 GET /api/state 200 4.2ms u=<user id, once signed in>
// LOG_REQUESTS=0 turns it off.
export const LOG_REQUESTS = !['0', 'false', 'no', 'off'].includes(String(process.env.LOG_REQUESTS || '').toLowerCase());
export function logRequest(req, res, pathname) {
  if (!LOG_REQUESTS) return;
  // Docker's own HEALTHCHECK (every 30 s, from inside the container) would drown the log.
  if (pathname === '/api/health' && ['127.0.0.1', '::1'].includes(bare(req.socket?.remoteAddress))) return;
  const t0 = process.hrtime.bigint();
  const line = (status) => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const user = req.user?.id || req.user?.username || req.user?.email;
    console.log(`${new Date().toISOString()} ${clientIp(req)} ${req.method} ${pathname} ${status} ${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms${user ? ` u=${user}` : ''}`);
  };
  res.once('finish', () => line(res.statusCode));
  res.once('close', () => { if (!res.writableFinished) line(`${res.statusCode} aborted`); });
}

// ── Shutdown hooks ──
// A route module that keeps anything in memory (a debounced save, a half-written file) registers a
// flush with onShutdown(fn). On SIGTERM or SIGINT the server stops taking connections, ends open event
// streams, lets in-flight requests finish (up to SHUTDOWN_TIMEOUT_MS, default 8000), then awaits each
// hook in order and exits.
export const shutdownHooks = [];
export const onShutdown = (fn) => { shutdownHooks.push(fn); };
