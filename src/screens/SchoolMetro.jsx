import { useState } from 'react';
import { getSchoolLines, linePairs, rootLine, schoolEvents, TODAY } from '../api.js';

const TERMS = []; for (let y = 2023; y <= 2026; y++) for (const [t, m] of [[1, '08'], [2, '12'], [3, '04']]) TERMS.push({ y, t, start: t === 3 ? `${y + 1}-${m}-01` : `${y}-${m}-01` });
const peakTerm = (p) => { const c = {}; p.events.forEach((e) => { const i = termIdx(e.date); c[i] = (c[i] || 0) + 1; }); return +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
const termIdx = (d) => { let k = 0; for (let i = 0; i < TERMS.length; i++) if (d >= TERMS[i].start) k = i; return k; };

// L4: the whole school as one metro. Lines thicken with activity; the most common interchanges glow.
export default function SchoolMetro({ version }) {
  const lines = getSchoolLines();
  const evs = schoolEvents();
  const pairs = linePairs().slice(0, 6);
  const [focus, setFocus] = useState(null);
  const n = TERMS.findIndex((t) => t.start > TODAY);
  const terms = TERMS.slice(0, n < 0 ? TERMS.length : n);
  const counts = Object.fromEntries(lines.map((l) => [l.id, terms.map((_, i) => evs.filter((e) => termIdx(e.date) === i && e.lineIds.some((id) => rootLine(id) === l.id)).length)]));
  const max = Math.max(1, ...Object.values(counts).flat());
  const W = 1000, L = 120, R = 60, top = 50, laneH = 56, H = top + lines.length * laneH + 20;
  const tx = (i) => L + (i * (W - L - R)) / (terms.length - 1);
  const ly = Object.fromEntries(lines.map((l, i) => [l.id, top + i * laneH + laneH / 2]));
  const glowMax = Math.max(1, ...pairs.map((p) => p.events.length));
  return (
    <div className="page smetro">
      <header className="page-head">
        <div>
          <div className="kicker">Whole-school metro</div>
          <h1>Where the school's learning runs</h1>
          <p>Every line, all students together. A line is thicker in terms with more activity. Glowing links are the interchanges students make most often.</p>
        </div>
        <span className="mock-pill">Demo cohort of {new Set(evs.map((e) => e.studentId)).size} students</span>
      </header>
      <div className="card-sec sm-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="sm-svg" role="img" aria-label="Whole-school metro map">
          {terms.map((t, i) => t.t === 1 && <g key={i}><line x1={tx(i)} x2={tx(i)} y1={top - 24} y2={H - 10} className="sl-year" /><text x={tx(i) + 4} y={top - 28} className="sl-axis">{t.y}–{String(t.y + 1).slice(2)}</text></g>)}
          {pairs.map((p, k) => {
            const i0 = peakTerm(p);
            // Two interchanges peaking in the same term sit side by side.
            const slot = pairs.slice(0, k).filter((q) => peakTerm(q) === i0).length;
            const px = tx(i0) + slot * 26;
            const op = 0.35 + 0.65 * (p.events.length / glowMax);
            const on = !focus || focus === p.a || focus === p.b;
            return <g key={k} opacity={on ? 1 : 0.15}><line x1={px} x2={px} y1={ly[p.a]} y2={ly[p.b]} className="sm-glow" strokeOpacity={op * 0.5} strokeWidth={8 + 10 * (p.events.length / glowMax)} /><line x1={px} x2={px} y1={ly[p.a]} y2={ly[p.b]} stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 4" /><rect x={px - 7} y={Math.min(ly[p.a], ly[p.b]) - 9} width={14} height={Math.abs(ly[p.a] - ly[p.b]) + 18} rx={7} fill="none" stroke="var(--ink)" strokeWidth="2.5" /><text x={px + 12} y={(ly[p.a] + ly[p.b]) / 2 + 4} className="sm-pair">{p.events.length}</text></g>;
          })}
          {lines.map((l) => {
            const c = counts[l.id]; const on = !focus || focus === l.id || pairs.some((p) => (p.a === focus && p.b === l.id) || (p.b === focus && p.a === l.id));
            return (
              <g key={l.id} opacity={on ? 1 : 0.2} onPointerEnter={() => setFocus(l.id)} onPointerLeave={() => setFocus(null)} className="sm-line">
                <text x={L - 14} y={ly[l.id] + 4} textAnchor="end" className="sl-name">{l.name}</text>
                {c.slice(0, -1).map((v, i) => <line key={i} x1={tx(i)} x2={tx(i + 1)} y1={ly[l.id]} y2={ly[l.id]} stroke={l.colour} strokeLinecap="round" strokeWidth={3 + 16 * (Math.max(v, c[i + 1]) / max)} />)}
                <rect x={L - 6} y={ly[l.id] - 14} width={W - L - R + 12} height={28} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="sm-top">
        <h3>Most common interchanges</h3>
        <ol>{pairs.map((p) => { const a = lines.find((l) => l.id === p.a), b = lines.find((l) => l.id === p.b); return (
          <li key={p.a + p.b} onPointerEnter={() => setFocus(p.a)} onPointerLeave={() => setFocus(null)}><span className="line-chip static" style={{ '--c': a?.colour }}><i className={a?.pattern === 'cased' ? 'cased' : undefined} />{a?.name}</span> meets <span className="line-chip static" style={{ '--c': b?.colour }}><i className={b?.pattern === 'cased' ? 'cased' : undefined} />{b?.name}</span><b>{p.events.length}</b><small>{p.events.slice(0, 2).map((e) => e.title).join(' · ')}</small></li>
        ); })}</ol>
      </div>
    </div>
  );
}
