import { useEffect, useRef, useState } from 'react';
import Logo from '../components/Logo.jsx';
import './kiosk.css';

// An exhibition screen (#/x/<token>; server/routes/45-exhibition.mjs): full screen, no sign-in, no navigation. Slides move
// on by themselves; the list is fetched again every few minutes (the server says how often). With no connection it keeps
// showing the slides it has (in memory, and in this browser's IndexedDB so a reload works too) for up to a day. It never
// loads the record or api.js. Turned off (404): it forgets everything it kept and says so.
const OFFLINE_KEEP_MS = 24 * 3600e3;
const DB = 'tp-exhibit';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('feed'); r.result.createObjectStore('photos'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function idb(store, mode, fn) {
  const db = await open();
  try {
    return await new Promise((res, rej) => {
      const t = db.transaction(store, mode), r = fn(t.objectStore(store));
      t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
}
const safe = (p) => p.catch(() => undefined);
const sameOrigin = (u) => typeof u === 'string' && u.startsWith('/');

export default function Kiosk({ token }) {
  const [feed, setFeed] = useState(null); // { title, seconds, paused, refresh, slides }
  const [state, setState] = useState('loading'); // loading | live | offline | gone | away
  const [i, setI] = useState(0);
  const [blobs, setBlobs] = useState({}); // photo url → object URL
  const [hint, setHint] = useState(true);
  const [idle, setIdle] = useState(false);
  const lastOk = useRef(0), blobRef = useRef({}), cur = useRef(null);

  useEffect(() => { document.title = 'School screen · NIST'; document.documentElement.dataset.theme = 'light'; }, []);

  // Photos as blobs: shown from memory, kept in IndexedDB for a reload without a connection.
  async function keepPhotos(slides) {
    const want = new Set(slides.map((s) => s.photo).filter(sameOrigin));
    const next = {};
    for (const u of want) {
      if (blobRef.current[u]) { next[u] = blobRef.current[u]; continue; }
      let b = null;
      try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) { b = await r.blob(); safe(idb('photos', 'readwrite', (s) => s.put(b, u))); } } catch { /* offline */ }
      if (!b) b = await safe(idb('photos', 'readonly', (s) => s.get(u)));
      if (b) next[u] = URL.createObjectURL(b);
    }
    for (const [u, url] of Object.entries(blobRef.current)) if (!next[u]) { URL.revokeObjectURL(url); safe(idb('photos', 'readwrite', (s) => s.delete(u))); }
    blobRef.current = next; setBlobs(next);
  }
  async function forget() {
    for (const url of Object.values(blobRef.current)) URL.revokeObjectURL(url);
    blobRef.current = {}; setBlobs({});
    await safe(idb('feed', 'readwrite', (s) => s.delete(token)));
    await safe(idb('photos', 'readwrite', (s) => s.clear()));
  }

  async function load() {
    let r;
    try { r = await fetch(`/api/public/exhibition/${encodeURIComponent(token)}`, { credentials: 'omit', cache: 'no-store' }); } catch { r = null; }
    if (r && (r.status === 404 || r.status === 410)) { setFeed(null); setState('gone'); await forget(); return; }
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j) {
      lastOk.current = Date.now();
      setFeed(j); setState('live');
      safe(idb('feed', 'readwrite', (s) => s.put({ at: lastOk.current, feed: j }, token)));
      await keepPhotos(j.paused ? [] : j.slides);
      return;
    }
    // No connection (or the server is away): what this screen already has, for up to a day.
    if (!lastOk.current) {
      const kept = await safe(idb('feed', 'readonly', (s) => s.get(token)));
      if (kept?.feed && Date.now() - kept.at < OFFLINE_KEEP_MS) { lastOk.current = kept.at; setFeed(kept.feed); await keepPhotos(kept.feed.slides); }
    }
    setState(lastOk.current && Date.now() - lastOk.current < OFFLINE_KEEP_MS ? 'offline' : 'away');
  }

  useEffect(() => {
    let stop = false, t;
    const tick = async () => { await load(); if (!stop) t = setTimeout(tick, Math.max(2, feed?.refresh || 300) * 1000); };
    tick();
    return () => { stop = true; clearTimeout(t); };
  }, [token, feed?.refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const slides = state === 'gone' || state === 'away' || feed?.paused ? [] : feed?.slides || [];
  // Keep the slide on screen when the list comes again; one that was removed goes at once.
  useEffect(() => {
    if (!slides.length) return;
    const at = slides.findIndex((s) => s.eventId === cur.current);
    setI(at >= 0 ? at : Math.min(i, slides.length - 1));
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = slides.length, k = n ? i % n : 0;
  cur.current = slides[k]?.eventId || null;
  useEffect(() => {
    if (n < 2) return undefined;
    const t = setTimeout(() => setI((x) => (x + 1) % n), (feed?.seconds || 10) * 1000);
    return () => clearTimeout(t);
  }, [k, n, feed?.seconds]);

  // Full screen on the first tap or key; the pointer hides when still; the screen stays awake where the browser allows.
  useEffect(() => {
    const full = () => { setHint(false); if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
    let t; const move = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 3000); };
    const h = setTimeout(() => setHint(false), 10000);
    let lock = null; const wake = () => { navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    const vis = () => { if (document.visibilityState === 'visible') wake(); };
    wake(); move();
    addEventListener('pointerdown', full); addEventListener('keydown', full); addEventListener('pointermove', move); document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('pointerdown', full); removeEventListener('keydown', full); removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', vis); clearTimeout(t); clearTimeout(h); lock?.release?.().catch(() => {}); };
  }, []);

  const s = slides[k];
  return (
    <div className={`kiosk${idle ? ' idle' : ''}`} data-state={state} data-count={n}>
      <header className="kx-top">
        <Logo className="kx-logo" />
        <span className="kx-title">{feed?.title || 'School screen'}</span>
        {n > 1 && <span className="kx-count" aria-hidden="true">{k + 1} / {n}</span>}
      </header>
      <main className="kx-stage" aria-live="polite">
        {s ? slides.map((x, j) => (
          <article key={x.eventId} className={`kx-slide${j === k ? ' on' : ''}`} data-event={x.eventId} aria-hidden={j !== k} style={{ '--c': x.line?.colour || '#002855' }}>
            <figure className={`kx-photo${x.photo ? '' : ' none'}`}>
              {x.photo ? <img src={blobs[x.photo] || (sameOrigin(x.photo) ? undefined : x.photo)} alt="" /> : <span className="kx-mark" aria-hidden="true" />}
            </figure>
            <div className="kx-text">
              {x.line && <div className="kx-line"><i aria-hidden="true" /><span>{x.line.name}</span></div>}
              <h1>{x.title}</h1>
              {x.quote && <blockquote>“{x.quote}”</blockquote>}
              <p className="kx-who">{x.name} · Year {x.year}</p>
            </div>
          </article>
        )) : (
          <div className="kx-empty">
            <Logo className="kx-logo big" />
            <p>{state === 'gone' ? 'This screen has been turned off.' : state === 'loading' ? 'Loading…' : feed?.paused ? 'Back soon.' : state === 'away' ? 'Waiting for a connection.' : 'New moments will appear here soon.'}</p>
          </div>
        )}
      </main>
      <footer className="kx-foot">
        <span>NIST Transit Portfolio</span>
        {state === 'offline' && <span className="kx-off">Offline · showing saved slides</span>}
        {s && n > 1 && <span className="kx-progress" key={`${k}-${n}`} style={{ '--c': s.line?.colour || '#FFB81C', '--t': `${feed?.seconds || 10}s` }} aria-hidden="true" />}
      </footer>
      {hint && document.fullscreenEnabled && <div className="kx-hint">Tap or press a key for full screen</div>}
    </div>
  );
}
