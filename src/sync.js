// The shared record in the browser. With the pilot server present, the server holds the record:
// each change runs here first (instant), is replayed there (/api/action), and other devices hear
// of it on /api/stream and fetch the new state. Without a server (static hosting, vite preview)
// none of this starts and the record stays in this browser's localStorage, as before.
import { load, setActionHook, snapshot, changeCount } from './api.js';
import { isPublicRoute } from './publicRoute.js';

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
  queue.push(item);
  flush();
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
    setStatus(wait > 1000 ? 'offline' : 'saving');
    try {
      const r = await fetch(queue[0].url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: queue[0].body });
      if (r.status >= 502 && r.status <= 504) throw new Error('unreachable');
      const item = queue.shift(); wait = 1000;
      const j = await r.json().catch(() => ({}));
      // Our change was the only one since our copy: we are at its revision. Otherwise (after an undo, or always in a
      // pilot, where this browser holds only its own part of the record and ran the change on that) fetch.
      if (r.ok && j.prev === rev && !item.undo && !j.scoped) rev = j.rev; else rev = -1;
      item.done?.(r.ok, j);
      if (!r.ok) console.warn('Change refused by the server', r.status, j.error);
    } catch {
      setStatus('offline');
      await new Promise((ok) => setTimeout(ok, wait)); wait = Math.min(wait * 2, 15000);
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
export async function startSync() {
  if (live) return 'server';
  const s = await getState(2500);
  if (!s) return 'local';
  live = true; rev = seen = s.rev;
  load(s.snapshot);
  setActionHook(send);
  globalThis.__tpRecord = () => JSON.parse(snapshot()).store; // for scripts/checks/sync.cjs: this device's copy
  listen();
  // On a public page (an in-app preview of a share link) step aside: it shows only what the link shares.
  // Coming back, reconnect; the server's rev then differs from ours (-1) and the full record is fetched.
  addEventListener('hashchange', () => { if (isPublicRoute()) { es?.close(); es = null; rev = -1; } else listen(); });
  setStatus('saved');
  return 'server';
}
