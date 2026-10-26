import { useState } from 'react';

// Illustrative planning figures, not a quote. Weeks are developer-weeks for one adapter.
export const SYSTEMS = [
  { id: 'sis', name: 'SIS (PowerSchool)', what: 'Enrolment, classes, grades', weeks: 3, kind: 'API', core: true },
  { id: 'mb', name: 'ManageBac', what: 'Tasks, IA, EE, CAS log', weeks: 4, kind: 'API', core: true },
  { id: 'sports', name: 'Clubs & Sports', what: 'Rosters, fixtures, results', weeks: 2, kind: 'CSV export' },
  { id: 'exams', name: 'Exam boards', what: 'ABRSM, IB results', weeks: 2, kind: 'Manual import' },
  { id: 'gc', name: 'Google Classroom', what: 'Assignments for Years 7–9', weeks: 3, kind: 'API' },
  { id: 'gh', name: 'GitHub', what: 'Student-chosen repositories', weeks: 1, kind: 'OAuth, opt-in' },
];
export const YEARS = [[7, 148], [8, 152], [9, 150], [10, 161], [11, 158], [12, 164], [13, 157]];
const START = [['2027-01', 'January 2027 (Term 2)'], ['2027-04', 'April 2027 (Term 3)'], ['2027-08', 'August 2027 (new year)']];
export const PRESETS = { dp: { years: [12, 13], systems: ['sis', 'mb'] }, upper: { years: [10, 11, 12, 13], systems: ['sis', 'mb', 'sports', 'exams'] }, all: { years: [7, 8, 9, 10, 11, 12, 13], systems: SYSTEMS.map((s) => s.id) } };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const addM = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const label = (ym) => `${MON[+ym.slice(5) - 1]} ${ym.slice(0, 4)}`;

// Shared with the pilot comparison: effort, start and running cost for a scope.
export function estimate(systemIds, years, devs = 2) {
  const chosen = SYSTEMS.filter((s) => systemIds.includes(s.id));
  const students = YEARS.filter(([y]) => years.includes(y)).reduce((n, [, c]) => n + c, 0);
  const weeks = chosen.reduce((n, s) => n + s.weeks, 0) + 4;
  const young = years.some((y) => y <= 9);
  return { chosen, students, weeks, young, staff: Math.ceil(students / 18), run: Math.round((students * 210 + chosen.length * 18000) / 1000) * 1000, months: (young ? 2 : 1) + Math.ceil(weeks / devs / 4.3) + 1 };
}

// L3: tick what is in scope and see the build effort, the timeline and the running cost change with it.
export default function Rollout({ version }) {
  const [systems, setSystems] = useState(PRESETS.dp.systems);
  const [years, setYears] = useState(PRESETS.dp.years);
  const [start, setStart] = useState('2027-08');
  const [devs, setDevs] = useState(2);
  const preset = Object.entries(PRESETS).find(([, p]) => p.years.join() === [...years].sort((a, b) => a - b).join() && p.systems.join() === SYSTEMS.filter((s) => systems.includes(s.id)).map((s) => s.id).join())?.[0];
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const chosen = SYSTEMS.filter((s) => systems.includes(s.id));
  const students = YEARS.filter(([y]) => years.includes(y)).reduce((n, [, c]) => n + c, 0);
  const adapterWeeks = chosen.reduce((n, s) => n + s.weeks, 0);
  const buildMonths = Math.ceil((4 + adapterWeeks / devs) / 4.3);
  const young = years.some((y) => y <= 9);
  // Phases, in months from today (Nov 2026): set up and privacy review, adapters, pilot term, school-wide.
  const phases = [
    ['Privacy review and set-up', 'PDPA impact assessment, data map, consent forms' + (young ? ', parental consent for Years 7–9' : ''), 0, young ? 2 : 1, 'var(--b-purple)'],
    ['Build the adapters', `${chosen.length} system${chosen.length === 1 ? '' : 's'}, ${adapterWeeks} developer-weeks with ${devs} developer${devs > 1 ? 's' : ''}`, 1, buildMonths, 'var(--b-sky)'],
    ['Train staff', `${Math.ceil(students / 18)} advisors and teachers, two 45-minute sessions each`, 1 + buildMonths - 1, 2, 'var(--b-gold)'],
  ];
  const now = '2026-11';
  const monthsTo = (ym) => (+ym.slice(0, 4) - 2026) * 12 + +ym.slice(5) - 11;
  const ready = 1 + buildMonths + 1;
  const go = Math.max(monthsTo(start), ready);
  const goYm = addM(now, go);
  phases.push(['Pilot term', `${years.length > 2 ? `Years ${Math.min(...years)} and ${Math.min(...years) + 1} first` : 'All chosen years'}, with weekly check-ins`, go, 3, 'var(--b-green)']);
  if (years.length > 2) phases.push(['Whole rollout', `All ${years.length} year groups`, go + 3, 3, 'var(--navy)']);
  const span = Math.max(...phases.map(([, , s, d]) => s + d)) + 1;
  const late = monthsTo(start) < ready;
  const run = Math.round((students * 210 + chosen.length * 18000) / 1000) * 1000;
  return (
    <div className="page rollout">
      <header className="page-head">
        <div>
          <div className="kicker">Rollout and cost planner</div>
          <h1>What would it take?</h1>
          <p>Choose which systems feed the record and which year groups start. Effort, timeline and running cost update as you go.</p>
        </div>
        <span className="mock-pill">Illustrative estimates, not a quote</span>
      </header>
      <div className="seg small ro-presets" role="group" aria-label="Starting point">
        {[['dp', 'DP pilot'], ['upper', 'Years 10–13'], ['all', 'Whole school from Year 7']].map(([k, l]) => <button key={k} className={preset === k ? 'on' : ''} aria-pressed={preset === k} onClick={() => { setSystems(PRESETS[k].systems); setYears(PRESETS[k].years); }}>{l}</button>)}
      </div>
      <div className="ro-grid">
        <section className="card-sec">
          <h3>Systems in scope</h3>
          {SYSTEMS.map((s) => (
            <label key={s.id} className="ro-sys">
              <input type="checkbox" checked={systems.includes(s.id)} disabled={s.core} onChange={() => toggle(systems, setSystems, s.id)} />
              <span><b>{s.name}</b><small>{s.what} · {s.kind}{s.core ? ' · always needed' : ''}</small></span>
              <em>{s.weeks} wk</em>
            </label>
          ))}
        </section>
        <section className="card-sec">
          <h3>Year groups</h3>
          <div className="ro-years">{YEARS.map(([y, n]) => <label key={y} className={`ro-y${years.includes(y) ? ' on' : ''}`}><input type="checkbox" checked={years.includes(y)} onChange={() => years.length > 1 || !years.includes(y) ? toggle(years, setYears, y) : null} /><b>Year {y}</b><small>{n} students</small></label>)}</div>
          <div className="ro-row">
            <label>Start<select value={start} onChange={(e) => setStart(e.target.value)}>{START.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Developers<select value={devs} onChange={(e) => setDevs(+e.target.value)}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          </div>
          {young && <p className="fineprint ro-note">Years 7–9 need parental consent under PDPA, which adds a month to set-up.</p>}
        </section>
      </div>
      <div className="tiles">
        <div className="tile"><b>{students.toLocaleString()}</b><span>students in scope</span></div>
        <div className="tile"><b>{adapterWeeks + 4}</b><span>developer-weeks to build, including 4 for the core</span></div>
        <div className="tile"><b>{label(goYm)}</b><span>{late ? 'earliest possible start (your choice is too soon)' : 'pilot starts'}</span></div>
        <div className="tile"><b>฿{(run / 1000).toLocaleString()}k</b><span>a year to run: hosting, support and licences</span></div>
      </div>
      <section className="card-sec ro-gantt" aria-label="Timeline">
        <h3>Timeline</h3>
        <div className="ro-months" style={{ '--n': span }}>{Array.from({ length: span }, (_, i) => <span key={i}>{i % 2 ? '' : label(addM(now, i))}</span>)}</div>
        {phases.map(([name, help, s, d, c]) => (
          <div key={name} className="ro-ph" style={{ '--n': span }}>
            <span className="ro-ph-name"><b>{name}</b><small>{help}</small></span>
            <span className="ro-track"><i style={{ left: `${(s / span) * 100}%`, width: `${(d / span) * 100}%`, background: c }} /></span>
          </div>
        ))}
      </section>
      <p className="fineprint">Running cost assumes ฿210 per student a year for hosting and support, plus ฿18,000 per connected system. Adapter estimates come from the roadmap and assume each system offers the access listed.</p>
    </div>
  );
}
