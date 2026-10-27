// The shared record in the browser. With the pilot server present, the server holds the record:
// each change runs here first (instant), is replayed there (/api/action), and other devices hear
// of it on /api/stream and fetch the new state. Without a server (static hosting, vite preview)
// none of this starts and the record stays in this browser's localStorage, as before.
import { load, setActionHook } from './api.js';

// Public pages (#/s/<token>, #/v/<code>) read /api/public/* and never take the whole record.
export const isPublicRoute = (hash = location.hash) => /^#\/?(s|v)(\/|$)/.test(hash);

let live = false, rev = 0, seen = 0, busy = false, status = 'local';
const queue = []; // changes waiting for the server, in order
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
  if (busy || queue.length) return;
  const s = await getState(10000);
  if (!s) return;
  if (busy || queue.length) { rev = -1; return; }
  seen = Math.max(seen, s.rev);
  if (s.rev !== rev) { rev = s.rev; load(s.snapshot); }
}

// undefined does not survive JSON, and a default argument needs it: mark it.
const encode = (args) => { const a = [...args]; while (a.length && a.at(-1) === undefined) a.pop(); return a.map((x) => (x === undefined ? { $undefined: 1 } : x)); };
function send(fn, args, rec) {
  queue.push(fn === 'resetDemo' ? { url: '/api/reset', body: '{}' } : { url: '/api/action', body: JSON.stringify({ fn, args: encode(args), rec }) });
  flush();
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
      queue.shift(); wait = 1000;
      const j = await r.json().catch(() => ({}));
      // Our change was the only one since our copy: we are at its revision. Otherwise fetch.
      if (r.ok && j.prev === rev) rev = j.rev; else rev = -1;
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

function listen() {
  const es = new EventSource('/api/stream');
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
  listen();
  setStatus('saved');
  return 'server';
}
