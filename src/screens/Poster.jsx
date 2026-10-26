import { useEffect, useMemo, useRef, useState } from 'react';
import MetroMap, { VerificationMark } from '../components/MetroMap.jsx';
import Logo from '../components/Logo.jsx';
import Qr from '../components/Qr.jsx';
import { applyLens } from '../api.js';
import { appUrl, lineCode, inkOn } from '../format.js';
import { gradesFor } from '../layout/metroLayout.js';

const W = 1680, H = 1188; // A3 landscape, at screen size

// The map poster: the whole journey on one sheet, to print, frame or hand out at an open day.
export default function Poster({ map, publicMap, drafts = [], toast, alum = false }) {
  const [paper, setPaper] = useState('paper');
  const [scope, setScope] = useState('public');
  const [scale, setScale] = useState(0.5);
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);

  const shown = scope === 'public' ? publicMap : map;
  const s = shown.student;
  const lens = useMemo(() => applyLens(shown, null), [shown]);
  const events = shown.events.filter((e) => e.type !== 'goal');
  const grades = gradesFor(s);
  const firstYear = s.g9StartYear + grades[0] - 9, lastYear = s.g9StartYear + grades.at(-1) - 8;
  const span = alum ? `Year ${grades[0] + 1} to Year 13, and after · ${firstYear}–${lastYear}` : `Year ${grades[0] + 1} to Year 13 · ${firstYear}–${lastYear}`;
  const verified = events.filter((e) => e.verification !== 'student-added').length;
  const reflections = events.reduce((n, e) => n + (e.reflections?.length || 0), 0) + events.filter((e) => e.type === 'reflection').length;
  const counts = Object.fromEntries(shown.lines.map((l) => [l.id, events.filter((e) => e.lineIds.includes(l.id)).length]));
  const quote = useMemo(() => {
    const all = publicMap.events.flatMap((e) => (e.reflections || []).filter((r) => r.visibility === 'publishable' && r.text.length > 60 && r.text.length < 240).map((r) => ({ ...r, title: e.title, date: e.date })));
    return all.at(-1);
  }, [publicMap]);
  const link = drafts.flatMap((p) => p.shareLinks || []).find((l) => !l.revoked && !l.site);
  const qrUrl = link ? appUrl(`s/${link.token}`) : appUrl('v');

  return (
    <div className="poster-screen">
      <div className="poster-head">
        <div>
          <p className="kicker">Map poster</p>
          <h1>Your whole journey on one sheet</h1>
          <p className="lede">Print it at A3 or larger, frame it, or save it as a PDF. {scope === 'public' ? 'It shows only what you have made publishable, so it is safe to pin up anywhere.' : 'This version includes private stations: keep it for yourself.'}</p>
        </div>
        <div className="poster-ctl">
          <div className="seg small" role="group" aria-label="What to include">
            <button className={scope === 'public' ? 'on' : ''} aria-pressed={scope === 'public'} onClick={() => setScope('public')}>Publishable only</button>
            <button className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Everything</button>
          </div>
          <div className="seg small" role="group" aria-label="Paper">
            <button className={paper === 'paper' ? 'on' : ''} aria-pressed={paper === 'paper'} onClick={() => setPaper('paper')}>White</button>
            <button className={paper === 'navy' ? 'on' : ''} aria-pressed={paper === 'navy'} onClick={() => setPaper('navy')}>Navy</button>
          </div>
          <button className="primary" onClick={() => { toast?.('Choose A3 landscape, no margins, and turn on background graphics.'); setTimeout(() => window.print(), 300); }}>Print or save as PDF</button>
        </div>
      </div>

      <div className="poster-wrap" ref={wrapRef} style={{ height: H * scale }}>
        <div className={`poster-sheet ${paper}`} style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <header className="ps-top">
            <Logo className="ps-logo" />
            <div className="ps-title">
              <small>NIST International School · Transit Portfolio</small>
              <h2>{s.name}</h2>
              <p>{span}{alum ? ` · Class of ${lastYear - 2}` : ` · ${s.programme}`}</p>
            </div>
            <dl className="ps-stats">
              <div><dt>Stations</dt><dd>{events.length}</dd></div>
              <div><dt>Lines</dt><dd>{shown.lines.length}</dd></div>
              <div><dt>Verified</dt><dd>{verified}</dd></div>
              <div><dt>Reflections</dt><dd>{reflections}</dd></div>
            </dl>
          </header>
          <div className="ps-map"><MetroMap print aspect={0.47} map={shown} lens={lens} duration={0} showToday={alum} /></div>
          <footer className="ps-foot">
            <ul className="ps-legend">
              {shown.lines.filter((l) => counts[l.id]).map((l) => (
                <li key={l.id}><span className="ps-code" style={l.pattern === 'cased' ? { border: `3px solid ${l.colour}` } : { background: l.colour, color: inkOn(l.colour) }}>{lineCode(l)}</span><span>{l.name}<small>{counts[l.id]} station{counts[l.id] > 1 ? 's' : ''}{l.status === 'ended' ? ' · ended' : ''}</small></span></li>
              ))}
            </ul>
            {quote && <blockquote className="ps-quote">“{quote.text}”<cite>{s.name.split(' ')[0]}, on {quote.title}</cite></blockquote>}
            <div className="ps-qr">
              <Qr text={qrUrl} size={112} />
              <p><b>{link ? 'Scan for the full portfolio' : 'Check any station'}</b>{link ? 'Every station, with its evidence and who verified it.' : 'Each verified station has a code the school can confirm.'}<span className="ps-key"><svg width="14" height="14" aria-hidden="true"><VerificationMark level="school-verified" x={7} y={7} r={5} /></svg>verified by the school <svg width="14" height="14" aria-hidden="true"><VerificationMark level="teacher-endorsed" x={7} y={7} r={5} /></svg>endorsed by a teacher <svg width="14" height="14" aria-hidden="true"><VerificationMark level="student-added" x={7} y={7} r={5} /></svg>added by {s.name.split(' ')[0]}</span></p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
