import { useEffect, useRef, useState } from 'react';
import { admin } from '../auth.js';
import '../auth.css';
import { FeedbackList } from '../components/Feedback.jsx';
import { SchoolProgress } from '../components/SignupProgress.jsx';

const ROLE = { student: 'Students', parent: 'Families', advisor: 'Advisors', teacher: 'Subject teachers', counsellor: 'Counsellors', coordinator: 'Coordinators', leadership: 'Leadership', admin: 'Pilot admin' };
const STATUS = { today: 'Today', week: 'This week', earlier: 'Earlier', never: 'Never' };
const COLS = [['stations', 'Stations added'], ['reflections', 'Reflections written'], ['endorsements', 'Endorsements given'], ['shareOpens', 'Share links opened']];
const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtSeen = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
// Year groups in school order, then families and staff.
const groupOrder = (g) => (g.startsWith('Year ') ? Number(g.slice(5)) : g === 'Families' ? 20 : g === 'Staff' ? 21 : 30);

// Pilot only: who is using the portfolio, and how much. Counts, never content.
export default function Usage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [show, setShow] = useState('all');
  useEffect(() => { admin.usage().then(setData, (x) => setErr(x.message)); }, []);
  if (err) return <div className="acc"><p className="auth-err">{err}</p></div>;
  if (!data) return <div className="acc"><p className="auth-lede">Loading usage…</p></div>;
  const t = data.totals;
  const people = data.people.filter((p) => show === 'all' || p.status === show).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '') || a.name.localeCompare(b.name));
  const years = Object.entries(data.byYear).sort(([a], [b]) => groupOrder(a) - groupOrder(b));
  const roles = Object.entries(data.byRole).sort(([a], [b]) => Object.keys(ROLE).indexOf(a) - Object.keys(ROLE).indexOf(b));
  const csvPeople = () => download(`pilot-usage-people-${data.today}.csv`, toCsv([
    ['Name', 'Role', 'Year group', 'Last here', 'Last change', 'Days active', 'Changes', 'Stations added', 'Reflections written', 'Endorsements given'],
    ...data.people.map((p) => [p.name, ROLE[p.kind] || p.kind, p.group, p.lastSeen ? p.lastSeen.slice(0, 16).replace('T', ' ') : 'never', p.lastChange || '', p.daysActive, p.changes, p.stations, p.reflections, p.endorsements]),
  ]));
  const csvWeeks = () => download(`pilot-usage-weeks-${data.today}.csv`, toCsv([
    ['Week from', 'People active', 'People who made a change', 'Changes', ...COLS.map(([, l]) => l)],
    ...data.weeks.map((w) => [w.start, w.active, w.changed, w.changes, ...COLS.map(([k]) => w[k])]),
  ]));
  return (
    <div className="acc usage">
      <div className="acc-head">
        <div><div className="kicker">Pilot</div><h1>Who is using the pilot</h1>
          <p className="auth-lede">Counted on the server for each account and day: when they were last here and how many changes they made. Apart from the feedback people send, nothing anyone wrote is kept here. Days follow Bangkok time.</p></div>
        <div className="auth-row"><button className="auth-btn" onClick={csvPeople}>Download as CSV</button><button className="ghost" onClick={csvWeeks}>Weeks as CSV</button></div>
      </div>
      <div className="tiles">
        <div className="tile"><b>{t.today}</b><span>of {t.people} people here today</span></div>
        <div className="tile"><b>{t.week}</b><span>here in the last 7 days</span></div>
        <div className="tile"><b>{t.never}</b><span>never signed in</span></div>
        <div className="tile"><b>{t.changes || 0}</b><span>changes since the pilot began</span></div>
      </div>
      <SchoolProgress />
      <FeedbackList />
      <section className="card-sec">
        <h2>People active each week</h2>
        <WeekChart weeks={data.weeks} />
      </section>
      <section className="card-sec us-scroll">
        <h2>Each week</h2>
        <table className="us-table">
          <thead><tr><th>Week from</th><th>People active</th><th>Made a change</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>{[...data.weeks].reverse().map((w) => <tr key={w.start}><td>{fmtDay(w.start)}</td><td>{w.active}</td><td>{w.changed}</td>{COLS.map(([k]) => <td key={k}>{w[k]}</td>)}</tr>)}</tbody>
        </table>
      </section>
      <div className="us-two">
        <Breakdown title="By Year group" rows={years} label={(g) => g} />
        <Breakdown title="By role" rows={roles} label={(k) => ROLE[k] || k} />
      </div>
      <section className="card-sec us-scroll">
        <div className="us-head"><h2>People</h2>
          <label className="us-filter">Show <select value={show} onChange={(e) => setShow(e.target.value)}><option value="all">Everyone</option>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>Last here: {l.toLowerCase()}</option>)}</select></label></div>
        <table className="us-table">
          <thead><tr><th>Name</th><th>Role</th><th>Last here</th><th>Last change</th><th>Days active</th><th>Changes</th></tr></thead>
          <tbody>{people.map((p) => (
            <tr key={p.id}><td><b>{p.name}</b><small>{p.group === 'Staff' || p.group === 'Families' ? '' : p.group}</small></td><td>{ROLE[p.kind] || p.kind}</td>
              <td><span className={`acc-tag ${p.status === 'never' ? 'wait' : p.status === 'today' || p.status === 'week' ? 'ok' : ''}`}>{STATUS[p.status]}</span><small>{fmtSeen(p.lastSeen)}</small></td>
              <td>{p.lastChange ? fmtDay(p.lastChange) : '—'}</td><td>{p.daysActive}</td><td>{p.changes}</td></tr>
          ))}</tbody>
        </table>
        {!people.length && <p className="fineprint">Nobody in this group.</p>}
      </section>
      <p className="fineprint">A station counts when it is added, accepted from the inbox or added with a new line. Share links opened are counted on the student's Year group, as readers have no account. Removing a student also removes their counts.</p>
    </div>
  );
}

function Breakdown({ title, rows, label }) {
  return (
    <section className="card-sec us-scroll">
      <h2>{title}</h2>
      <table className="us-table">
        <thead><tr><th>Group</th><th>People</th><th>Active this week</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
        <tbody>{rows.map(([k, r]) => <tr key={k}><td><b>{label(k)}</b></td><td>{r.people}</td><td>{r.activeWeek}</td>{COLS.map(([c]) => <td key={c}>{r[c]}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}

// One series: people active per week. Hover (or focus) a bar for the week's numbers.
function WeekChart({ weeks }) {
  const [hover, setHover] = useState(null);
  // Drawn at the box's own width, so labels keep their size on a phone.
  const box = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width)))); ro.observe(box.current); return () => ro.disconnect(); }, []);
  const H = 180, pad = { l: 28, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...weeks.map((w) => w.active));
  const step = (W - pad.l - pad.r) / Math.max(weeks.length, 1);
  const bw = Math.max(4, Math.min(48, step - 6));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  const h = hover != null ? weeks[hover] : null;
  return (
    <div className="us-chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`People active each week, ${weeks.length} weeks`}>
        {ticks.map((v) => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="us-grid" /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="us-axis">{v}</text></g>)}
        {weeks.map((w, i) => { const x = pad.l + i * step + (step - bw) / 2; const top = Math.min(y(w.active), H - pad.b - 4); return (
          <g key={w.start} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
            {w.active > 0 && <path className={`us-bar${hover === i ? ' on' : ''}`} d={`M${x},${H - pad.b} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - pad.b} Z`} />}
            {i % Math.ceil(weeks.length / Math.max(1, Math.floor(W / 64))) === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="us-axis">{fmtDay(w.start)}</text>}
          </g>
        ); })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="us-base" />
      </svg>
      <p className="us-tip" aria-live="polite">{h ? <><b>Week from {fmtDay(h.start)}</b>: {h.active} active, {h.changed} made a change, {h.stations} stations, {h.reflections} reflections, {h.endorsements} endorsements, {h.shareOpens} share links opened</> : 'Point at a week for its numbers.'}</p>
    </div>
  );
}
