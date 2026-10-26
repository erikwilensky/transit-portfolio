import { useState } from 'react';
import { getLine, getSchoolLines, getStudent, rootLine, schoolEvents } from '../api.js';
import { fmtDate, TYPE_LABEL, inkOn } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';

const RANK = { 'student-added': 0, 'teacher-endorsed': 1, 'school-verified': 2 };
const EMPTY = { years: [], line: '', type: '', verified: 0, text: '', cross: false };
const PRESETS = [
  ['Green scholarship', 'Environment line, a teacher-endorsed project', { ...EMPTY, line: 'environment', type: 'project', verified: 1 }],
  ['Service award', 'Service stations in Years 12–13, any level', { ...EMPTY, line: 'service', years: [12, 13] }],
  ['STEM nominations', 'Computing work that meets another subject', { ...EMPTY, line: 'computing', cross: true }],
  ['Competition results', 'School-verified competitions and awards', { ...EMPTY, type: 'competition', verified: 2 }],
];

// C4: the record answering a question across students. Reads school-visible items only.
export default function CohortSearch({ go, persona, toast, version }) {
  const [q, setQ] = useState(PRESETS[0][2]);
  const [saved, setSaved] = useState([]);
  const set = (patch) => setQ({ ...q, ...patch });
  const match = (e) => {
    const s = getStudent(e.studentId), roots = [...new Set(e.lineIds.map(rootLine))];
    return (!q.years.length || q.years.includes(s.grade + 1))
      && (!q.line || roots.includes(q.line))
      && (!q.type || e.type === q.type || (q.type === 'competition' && e.type === 'award'))
      && RANK[e.verification] >= q.verified
      && (!q.cross || roots.length > 1)
      && (!q.text || `${e.title} ${e.summary}`.toLowerCase().includes(q.text.toLowerCase()));
  };
  const hits = schoolEvents().filter((e) => e.type !== 'reflection' && match(e));
  const byStudent = {};
  for (const e of hits) (byStudent[e.studentId] ||= []).push(e);
  const rows = Object.entries(byStudent).map(([sid, evs]) => ({ s: getStudent(sid), evs: evs.sort((a, b) => b.date.localeCompare(a.date)) })).sort((a, b) => b.evs.length - a.evs.length);
  const types = ['project', 'competition', 'service', 'club', 'class', 'assessment', 'sport', 'cas'];
  const summary = [q.years.length ? `Years ${q.years.join(', ')}` : 'All years', q.line && `${getLine(q.line).name} line`, q.type && TYPE_LABEL[q.type].toLowerCase(), q.verified === 1 && 'teacher-endorsed or better', q.verified === 2 && 'school-verified', q.cross && 'meets another subject', q.text && `mentions “${q.text}”`].filter(Boolean).join(' · ');
  return (
    <div className="page cohort">
      <header className="page-head">
        <div>
          <div className="kicker">Cohort search</div>
          <h1>Who fits this nomination?</h1>
          <p>Ask the whole school’s record a question. Only stations students made visible to the school are searched, so nothing private shows up.</p>
        </div>
      </header>
      <div className="cs-presets">{PRESETS.map(([name, help, preset]) => <button key={name} className={`cs-preset${JSON.stringify(q) === JSON.stringify(preset) ? ' on' : ''}`} onClick={() => setQ(preset)}><b>{name}</b><small>{help}</small></button>)}</div>
      <div className="card-sec cs-builder">
        <div className="cs-years" role="group" aria-labelledby="cs-years-l"><span id="cs-years-l">Year</span><div>{[10, 11, 12, 13].map((y) => <label key={y} className="cs-check"><input type="checkbox" checked={q.years.includes(y)} onChange={(e) => set({ years: e.target.checked ? [...q.years, y] : q.years.filter((x) => x !== y) })} />Year {y}</label>)}</div></div>
        <label>Line<select value={q.line} onChange={(e) => set({ line: e.target.value })}><option value="">Any line</option>{getSchoolLines().map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Kind<select value={q.type} onChange={(e) => set({ type: e.target.value })}><option value="">Any kind</option>{types.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
        <label>Evidence<select value={q.verified} onChange={(e) => set({ verified: +e.target.value })}><option value={0}>Any level</option><option value={1}>Teacher-endorsed or better</option><option value={2}>School-verified only</option></select></label>
        <label>Words<input value={q.text} placeholder="e.g. sensor" onChange={(e) => set({ text: e.target.value })} /></label>
        <label className="cs-check"><input type="checkbox" checked={q.cross} onChange={(e) => set({ cross: e.target.checked })} />Meets another subject</label>
        <button className="ghost" onClick={() => setQ(EMPTY)}>Clear</button>
      </div>
      <div className="al-bar">
        <span><b>{rows.length}</b> student{rows.length === 1 ? '' : 's'}, {hits.length} matching station{hits.length === 1 ? '' : 's'}</span>
        <span className="muted">{summary}</span>
        <span className="spacer" />
        <button className="primary" disabled={!rows.length} onClick={() => { setSaved([{ summary, names: rows.map((r) => r.s.name) }, ...saved]); toast(`Saved a nomination list of ${rows.length}`); }}>Save as nomination list</button>
      </div>
      {rows.length ? (
        <div className="cs-results">
          {rows.map(({ s, evs }) => (
            <section key={s.id} className="card-sec cs-row">
              <div className="as-row-head">
                <span className="pres-avatar sm" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>
                <div><h2>{s.name}</h2><small>Year {s.grade + 1} · {s.programme} · {evs.length} match{evs.length === 1 ? '' : 'es'}</small></div>
                <span className="spacer" />
                {s.grade === 12 && <button className="ghost" onClick={() => go(persona.id, 'letter', s.id)}>Reference letter</button>}
              </div>
              <ul className="cs-evs">{evs.map((e) => <li key={e.id}><i style={{ background: getLine(rootLine(e.lineIds[0])).colour }} aria-hidden="true" /><span><b>{e.title}</b><small>{TYPE_LABEL[e.type]} · {fmtDate(e.date)}</small></span><VerifyBadge level={e.verification} /></li>)}</ul>
            </section>
          ))}
        </div>
      ) : <div className="empty-state"><b>No students match.</b> Try fewer filters.</div>}
      {saved.length > 0 && <div className="card-sec cs-saved"><h3>Saved lists</h3>{saved.map((l, i) => <p key={i}><b>{l.summary}</b>: {l.names.join(', ')}</p>)}</div>}
    </div>
  );
}
