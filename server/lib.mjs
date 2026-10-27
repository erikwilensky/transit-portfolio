// Shared helpers for the pilot server and its route modules.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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

// Helpers every route module can use.
export const send = (res, status, body, headers = {}) => {
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(json ? JSON.stringify(body) : body);
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
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
export const contentType = (f) => TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
export function serveStatic(req, res, urlPath) {
  let f = path.normalize(path.join(DIST, decodeURIComponent(urlPath)));
  if (!f.startsWith(DIST)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  if (!fs.existsSync(f)) return send(res, 404, 'Build the app first: npm run build');
  const html = f.endsWith('.html');
  res.writeHead(200, { 'content-type': contentType(f), 'cache-control': html ? 'no-cache' : 'public, max-age=31536000, immutable' });
  fs.createReadStream(f).pipe(res);
}

