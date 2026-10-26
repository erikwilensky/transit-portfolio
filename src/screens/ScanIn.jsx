import { useEffect, useRef, useState } from 'react';
import { extraViews, getPresentations } from '../api.js';
import { appUrl } from '../format.js';
import Qr from '../components/Qr.jsx';

// For the pitch: the audience scans in and opens Maya's portfolio on their own phones.
export default function ScanIn({ drafts, version }) {
  const links = Object.values(drafts).flat().flatMap((p) => p.shareLinks.map((l) => ({ ...l, title: p.title }))).filter((l) => !l.revoked);
  const [token, setToken] = useState('tp-c7m1');
  const link = links.find((l) => l.token === token) || links[0];
  const [local, setLocal] = useState(0);
  const [sim, setSim] = useState(false);
  const [simCount, setSimCount] = useState(0);
  // P11: a projector mode that fills the screen with the code, the address and the counter.
  const [big, setBig] = useState(false);
  const root = useRef(null);
  const toggleBig = () => {
    if (big) { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setBig(false); return; }
    setBig(true); root.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setBig(false); };
    const onKey = (e) => {
      if (e.target.closest?.('input,select,textarea')) return;
      if (e.key === 'f' || e.key === 'F') toggleBig();
      if (e.key === 'Escape' && big) setBig(false);
    };
    document.addEventListener('fullscreenchange', onFs); window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('fullscreenchange', onFs); window.removeEventListener('keydown', onKey); };
  });
  useEffect(() => {
    let ch; try { ch = new BroadcastChannel('tp-views'); ch.onmessage = (m) => { if (m.data?.token === token) setLocal((n) => n + 1); }; } catch { /* unsupported */ }
    return () => ch?.close();
  }, [token]);
  useEffect(() => {
    if (!sim) return;
    let t; const tick = () => { setSimCount((n) => n + 1 + (Math.random() < 0.3 ? 1 : 0)); t = setTimeout(tick, 900 + Math.random() * 2600); };
    t = setTimeout(tick, 800); return () => clearTimeout(t);
  }, [sim]);
  const url = appUrl(`s/${link.token}`);
  const total = link.views + extraViews(link.token) + local + simCount;
  return (
    <div className={`page scan${big ? ' scan-big' : ''}`} ref={root}>
      <div className="scan-card">
        <div className="tri tri-a" aria-hidden="true" /><div className="tri tri-b" aria-hidden="true" />
        <div className="scan-qr"><Qr text={url} size={big ? 'min(72vh, 46vw)' : 300} /></div>
        <div className="scan-text">
          <div className="kicker">Scan to open on your phone</div>
          <h1>{link.title}</h1>
          <p className="scan-url">{url.replace(/^https?:\/\//, '')}</p>
          <div className="scan-count" aria-live="polite"><b key={total}>{total}</b><span>views of this link{sim ? ' (with simulated audience)' : ''}</span></div>
          <div className="scan-ctl">
            <select value={link.token} onChange={(e) => { setToken(e.target.value); setSimCount(0); setLocal(0); }}>{links.map((l) => <option key={l.token} value={l.token}>{l.title}</option>)}</select>
            <label className="cb-check"><input type="checkbox" checked={sim} onChange={() => setSim(!sim)} /> Simulate audience</label>
            <button className="ghost" onClick={toggleBig}>{big ? 'Exit projector mode' : 'Projector mode'}</button>
          </div>
          {big && <p className="scan-exit">Press <kbd>Esc</kbd> to leave projector mode</p>}
          <p className="fineprint">Views from this browser count live. The demo has no server, so phones in the room count on their own devices; turn on the simulation to show the counter moving.</p>
        </div>
      </div>
    </div>
  );
}
