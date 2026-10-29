// The shared record in the browser. With the pilot server present, the server holds the record:
// each change runs here first (instant), is replayed there (/api/action), and other devices hear
// of it on /api/stream and fetch the new state. Without a server (static hosting, vite preview)
// none of this starts and the record stays in this browser's localStorage, as before.
import { load, setActionHook, snapshot, changeCount } from './api.js';
import { isPublicRoute } from './publicRoute.js';
import * as outbox from './outbox.js';

// Public pages (#/s/<token>, #/v/<code>) read /api/public/* and never take the whole record (see publicRoute.js).
export { isPublicRoute };

let live = false, rev = 0, seen = 0, busy = false, status = 'local';
const queue = []; // changes waiting for the server, in order
const revs = new Map(); // change number (api.js changeCount) → Promise of its server rev, or null if refused
const subs = new Set();
// 'local' (no server), 'saving', 'saved' or 'offline' (changes wait here and go when it is back).
export const getSyncStatus = () => status;
export const onSyncStatus = (fn) => (subs.add(fn), () => subs.delete(fn));
export const serverMode = () => live;
const setStatus = (s) => { if (s !== status) { status = s; subs.forEach((fn) => fn(s)); } };
// Offline capture (src/outbox.js): whose changes these are, whether the server has said it is still them since we were
// last cut off, and the real addresses of photos taken offline (placeholder key → api/files/...).
let owner = null, verified = false, waiting = 0;
const real = {};
export const waitingCount = () => waiting;
const recount = () => { const n = queue.filter((i) => !i.upload && !i.undo).length; if (n !== waiting) { waiting = n; subs.forEach((fn) => fn(status)); } };
const hold = (item, row) => { if (owner) item.k = outbox.add(owner, { ...row }); item.uid = owner; };
const release = (item) => item.k?.then((k) => outbox.remove(k));

// GET /api/state, or null when there is no server (a 404 or an HTML page counts as none).
async function getState(ms) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('/api/state', { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    const j = await r.json();
    return j?.snapshot && typeof j.rev === 'number' ? j : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Take the server's copy, unless a change of ours is still on its way (then try again after it).
async function refresh() {
  if (busy || queue.length || isPublicRoute()) return;
  const s = await getState(10000);
  if (!s) return;
  if (busy || queue.length) { rev = -1; return; }
  seen = Math.max(seen, s.rev);
  if (s.rev !== rev) { rev = s.rev; load(s.snapshot); }
}

// undefined does not survive JSON, and a default argument needs it: mark it.
const encode = (args) => { const a = [...args]; while (a.length && a.at(-1) === undefined) a.pop(); return a.map((x) => (x === undefined ? { $undefined: 1 } : x)); };
function send(fn, args, rec) {
  const item = fn === 'resetDemo' ? { url: '/api/reset', body: '{}' } : { url: '/api/action', body: JSON.stringify({ fn, args: encode(args), rec }) };
  revs.set(changeCount(), new Promise((ok) => { item.done = (good, j) => ok(good && fn !== 'resetDemo' ? j.rev : null); }));
  if (revs.size > 50) revs.delete(revs.keys().next().value);
  if (fn !== 'resetDemo') hold(item, { url: item.url, body: item.body });
  queue.push(item); recount();
  flush();
}
// A photo chosen while the server cannot be reached: kept with the changes, uploaded first when it is back, and shown
// meanwhile from a placeholder address. → the placeholder, or null (no server, or nobody signed in).
export function holdUpload(blob, name, type) {
  if (!live || !owner) return null;
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const item = { upload: { key, name, type }, blob };
  hold(item, { upload: item.upload, blob });
  queue.push(item);
  flush();
  return `${URL.createObjectURL(blob)}#tpq-${key}`;
}
// Signing out (src/auth.js): this account's changes not sent yet, and dropping them.
export const unsent = async (uid) => outbox.waiting(await outbox.list(uid));
export const dropUnsent = (uid) => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].uid === uid) queue.splice(i, 1); recount(); return outbox.clear(uid); };
// Who the server says is signed in now (an account id, or null). Throws when it cannot be reached.
async function whoami() {
  const r = await fetch('/api/auth/me', { cache: 'no-store' });
  if (r.status >= 502 && r.status <= 504) throw new Error('unreachable');
  return (await r.json()).user?.id || null;
}
// This browser is now someone else (signed in again in another tab) or signed out: their changes are not sent under
// this sign-in. They stay on this device under their own account, for when they sign in again.
function foreign(uid) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].uid === uid) queue.splice(i, 1);
  recount();
  globalThis.dispatchEvent?.(new CustomEvent('tp-refused', { detail: { status: 401, kept: true, error: 'this browser is signed in as someone else' } }));
}
const pause = (ms) => new Promise((ok) => { const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); ok(); } addEventListener('online', done); });
async function post(item) {
  if (!item.upload) return fetch(item.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: swap(item.body) });
  return fetch(new URL('api/upload', location.href).href, { method: 'POST', headers: { 'content-type': item.upload.type || 'application/octet-stream', 'x-filename': encodeURIComponent(item.upload.name || 'photo') }, body: item.blob });
}
const swap = (body) => (body && body.includes('#tpq-') ? outbox.swapUrls(body, real) : body);
// A photo is on the server: rewrite the changes still waiting that name it, here and on the device.
function uploaded(key, url) {
  real[key] = url;
  for (const i of queue) if (i.body?.includes(`#tpq-${key}`)) { i.body = swap(i.body); const body = i.body; i.k?.then((k) => outbox.update(k, { body })); }
}
// Undo the changes this page made after `mark` (api.js markOf(snapshot)), up to `upto`: the server takes back just
// those (POST /api/undo) and keeps everyone else's. Waits while they are still queued.
// Resolves {} or { error } / { skipped: n } in plain words for the toast.
export async function undoSince(mark, upto = changeCount()) {
  if (!live || mark === undefined) return { error: 'This change can no longer be undone.' };
  const mine = [...revs].filter(([n]) => n > mark && n <= upto).map(([, p]) => p);
  const want = (await Promise.all(mine)).filter((r) => r != null);
  if (!want.length) return mine.length ? { error: 'Nothing to undo: the server did not take that change.' } : { error: 'This change can no longer be undone.' };
  const j = await new Promise((ok) => { queue.push({ url: '/api/undo', body: JSON.stringify({ revs: want }), undo: true, done: (good, x) => ok(good ? x : { error: x.error || 'Undo did not work. Try again.' }) }); flush(); });
  return j.error ? { error: j.error } : j.skipped?.length ? { skipped: j.skipped.length } : {};
}
async function flush() {
  if (busy) return;
  busy = true;
  let wait = 1000;
  while (queue.length) {
    setStatus(wait > 1000 || globalThis.navigator?.onLine === false ? 'offline' : 'saving');
    try {
      const head = queue[0];
      if (head.uid && !verified) {
        if (await whoami() !== head.uid) { foreign(head.uid); continue; }
        verified = true;
      }
      const r = await post(head);
      if (r.status >= 502 && r.status <= 504) throw new Error('unreachable');
      const item = queue.shift(); wait = 1000;
      release(item); recount();
      const j = await r.json().catch(() => ({}));
      if (item.upload) {
        uploaded(item.upload.key, r.ok && j.url ? j.url.replace(/^\//, '') : '');
        if (!r.ok) globalThis.dispatchEvent?.(new CustomEvent('tp-refused', { detail: { status: r.status, error: j.error || 'a photo could not be uploaded' } }));
        continue;
      }
      // Our change was the only one since our copy: we are at its revision. Otherwise (after an undo, or always in a
      // pilot, where this browser holds only its own part of the record and ran the change on that) fetch.
      if (r.ok && j.prev === rev && !item.undo && !j.scoped) rev = j.rev; else rev = -1;
      item.done?.(r.ok, j);
      if (!r.ok) { console.warn('Change refused by the server', r.status, j.error); globalThis.dispatchEvent?.(new CustomEvent('tp-refused', { detail: { status: r.status, error: j.error } })); }
    } catch {
      verified = false; // cut off: ask who is signed in before sending again
      setStatus('offline');
      await pause(wait); wait = Math.min(wait * 2, 15000);
    }
  }
  busy = false;
  setStatus('saved');
  if (seen !== rev) refresh();
}

let es = null;
function listen() {
  if (es) return;
  es = new EventSource('/api/stream');
  es.onmessage = (m) => { try { seen = JSON.parse(m.data).rev; } catch { return; } if (seen !== rev) refresh(); };
  es.onerror = () => setStatus('offline'); // EventSource reconnects by itself; the server then sends its rev
  es.onopen = () => { if (!busy) setStatus('saved'); };
}

// Connect to the server if there is one. Resolves 'server' or 'local'. Safe to call again
// (for example after sign-in, if the first try was refused).
// user: the signed-in account id (pilot), whose changes not sent yet are taken up again from this device.
// offline: the app started with no connection on a remembered sign-in (src/auth.js): run on this device's copy.
export async function startSync({ user = null, offline = false } = {}) {
  if (live) return 'server';
  const s = await getState(2500);
  if (!s && !(offline && user)) return 'local';
  owner = user; verified = !!s && !offline; // the sign-in was checked just now (loadAuth)
  const held = user ? await outbox.list(user) : [];
  live = true;
  if (s) seen = s.rev;
  if (held.length) resume(held); else if (s) { rev = s.rev; load(s.snapshot); } else rev = -1;
  setActionHook(send);
  globalThis.__tpRecord = () => JSON.parse(snapshot()).store; // for scripts/checks/sync.cjs: this device's copy
  listen();
  // On a public page (an in-app preview of a share link) step aside: it shows only what the link shares.
  // Coming back, reconnect; the server's rev then differs from ours (-1) and the full record is fetched.
  addEventListener('hashchange', () => { if (isPublicRoute()) { es?.close(); es = null; rev = -1; } else listen(); });
  setStatus(s ? 'saved' : 'offline');
  if (held.length) flush();
  return 'server';
}
// Changes left from last time go first, on this device's copy (which already shows them); the server's copy follows.
// Photos get fresh placeholders, since the old ones died with the page.
function resume(held) {
  rev = -1;
  const fresh = {};
  for (const row of held) {
    const item = row.upload ? { upload: row.upload, blob: row.blob } : { url: row.url, body: row.body };
    if (row.upload) fresh[row.upload.key] = `${URL.createObjectURL(row.blob)}#tpq-${row.upload.key}`;
    item.k = Promise.resolve(row.k); item.uid = row.uid;
    queue.push(item);
  }
  recount();
  const snap = snapshot(), next = outbox.swapUrls(snap, fresh);
  if (next !== snap) load(JSON.parse(next));
}
