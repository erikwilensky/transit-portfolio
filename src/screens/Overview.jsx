import { useEffect, useRef, useState } from 'react';
import { overview } from '../auth.js';
import '../auth.css';
import './overview.css';
import { YearReflections } from '../components/TermReflection.jsx';
import { YearBooking } from '../components/ConferenceBooking.jsx';
import { PeerYears } from '../components/PeerFeedback.jsx';

// School overview (server/routes/63-overview.mjs): counts by Year and by line, a weekly chart and quiet homerooms.
// The server sends counts only; a group of 1 to 4 students arrives as "fewer than 5".
const SMALL = 'fewer than 5';
const COLS = [['students', 'Students'], ['signedUp', 'Signed up'], ['active', 'Active this week'], ['withMoment', 'At least one moment'], ['perStudent', 'Moments per student'], ['reflections', 'Reflections'], ['endorsements', 'Endorsements given'], ['families', 'Families joined']];
const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const small = (v) => v === SMALL;
const Val = ({ v }) => (small(v) ? <span className="ov-small">fewer than 5</span> : <>{v ?? '—'}</>);

export default function Overview({ persona, version, toast }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [id, setId] = useState('term');
  useEffect(() => { overview.get().then(setData, (x) => setErr(x.message)); }, []);
  if (err) return <div className="acc"><p className="auth-err">{err}</p></div>;
  if (!data) return <div className="acc"><p className="auth-lede">Loading the school overview…</p></div>;
  const r = data.ranges.find((x) => x.id === id) || data.ranges[0];
  const t = r.totals;
  return (
    <div className="acc ov">
      <div className="acc-head">
        <div><div className="kicker">Pilot</div><h1>School overview</h1>
          <p className="auth-lede">Counts for the whole school, never names. Any group of fewer than 5 students shows “fewer than 5” instead of a number. Active this week means signed in or here in the last 7 days.</p></div>
        <a className="auth-btn ov-dl" href={overview.csvUrl(r.id)} download>Download as CSV</a>
      </div>
      <div className="ov-tabs" role="tablist" aria-label="Period">
        {data.ranges.map((x) => <button key={x.id} role="tab" aria-selected={x.id === r.id} className={x.id === r.id ? 'on' : ''} onClick={() => setId(x.id)}>{x.label}</button>)}
        <span className="fineprint">{fmtDay(r.from)} to {fmtDay(r.to)}</span>
      </div>
      <div className="tiles">
        <div className="tile"><b><Val v={t.signedUp} /></b><span>of <Val v={t.students} /> students signed up</span></div>
        <div className="tile"><b><Val v={t.active} /></b><span>active this week</span></div>
        <div className="tile"><b><Val v={t.moments} /></b><span>moments, {r.label.toLowerCase()}</span></div>
        <div className="tile"><b><Val v={t.endorsements} /></b><span>endorsements given</span></div>
      </div>
      <section className="card-sec us-scroll" aria-labelledby="ov-y">
        <h2 id="ov-y">By Year</h2>
        <table className="us-table ov-years">
          <thead><tr><th>Year</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {[...r.years, t].map((y) => <tr key={y.year} className={y.year === 'all' ? 'ov-total' : ''}><td><b>{y.year === 'all' ? 'All Years' : `Year ${y.year}`}</b></td>{COLS.map(([k]) => <td key={k}><Val v={y[k]} /></td>)}</tr>)}
          </tbody>
        </table>
      </section>
      <div className="us-two">
        <section className="card-sec us-scroll" aria-labelledby="ov-l">
          <h2 id="ov-l">By line</h2>
          <table className="us-table ov-lines">
            <thead><tr><th>Line</th><th>Moments</th><th>Endorsed</th></tr></thead>
            <tbody>{r.lines.map((l) => (
              <tr key={l.id}><td><b>{l.name}</b></td><td><Val v={l.moments} /></td>
                <td className="ov-n">{small(l.endorsedPct) ? <Val v={l.endorsedPct} /> : l.endorsedPct == null ? '—' : <><span>{l.endorsedPct}%</span><i className="ov-bar" aria-hidden="true"><i style={{ width: `${l.endorsedPct}%` }} /></i></>}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section className="card-sec" aria-labelledby="ov-q">
          <h2 id="ov-q">Quiet groups</h2>
          <p className="fineprint">Homerooms where fewer than 30% of students were active this week. Homerooms of fewer than 5 are left out.</p>
          {data.quiet.length ? <ul className="ov-quiet">{data.quiet.map((q) => <li key={q.name}><b>{q.name}</b><span>{q.pct}% active</span></li>)}</ul> : <p className="auth-lede">No quiet homerooms this week.</p>}
        </section>
      </div>
      <section className="card-sec" aria-labelledby="ov-w">
        <h2 id="ov-w">Moments each week</h2>
        <WeekBars weeks={r.weeks} />
      </section>
      <YearReflections persona={persona} version={version} toast={toast} />
      <YearBooking persona={persona} version={version} toast={toast} />
      <PeerYears persona={persona} version={version} toast={toast} />
    </div>
  );
}

// One series, NIST navy bars. A week with moments from fewer than 5 students shows no bar, only a note.
function WeekBars({ weeks }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width)))); ro.observe(box.current); return () => ro.disconnect(); }, []);
  const H = 170, pad = { l: 30, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...weeks.map((w) => (small(w.moments) ? 0 : w.moments)));
  const step = (W - pad.l - pad.r) / Math.max(weeks.length, 1);
  const bw = Math.max(4, Math.min(48, step - 6));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  const every = Math.ceil(weeks.length / Math.max(1, Math.floor(W / 64)));
  const h = hover != null ? weeks[hover] : null;
  return (
    <div className="us-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Moments each week, ${weeks.length} weeks`}>
        {ticks.map((v) => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="us-grid" /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="us-axis">{v}</text></g>)}
        {weeks.map((w, i) => { const x = pad.l + i * step + (step - bw) / 2; const v = small(w.moments) ? 0 : w.moments; const top = Math.min(y(v), H - pad.b - 4); return (
          <g key={w.from} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
            {v > 0 && <path className={`us-bar ov-wbar${hover === i ? ' on' : ''}`} d={`M${x},${H - pad.b} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - pad.b} Z`} />}
            {small(w.moments) && <text x={x + bw / 2} y={H - pad.b - 6} textAnchor="middle" className="us-axis">&lt;5</text>}
            {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="us-axis">{fmtDay(w.from)}</text>}
          </g>
        ); })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="us-base" />
      </svg>
      <p className="us-tip" aria-live="polite">{h ? <><b>{fmtDay(h.from)} to {fmtDay(h.to)}</b>: {small(h.moments) ? 'moments from fewer than 5 students' : `${h.moments} moments`}</> : 'Point at a week for its number.'}</p>
    </div>
  );
}
