import { useState } from 'react';
import { CONSENT, getIntegrations, getRoster, getStore, getStudents, getTeacher, matchRoster, TERM_START } from '../api.js';
import { fmtDate } from '../format.js';
import { BarChart, LineChart, StackBar } from '../components/Charts.jsx';

// School-wide figures. Adoption and term trends are illustrative pilot numbers; the verification mix is computed live.
const ADOPTION = [
  { label: 'Y7', value: 38, note: 'Pilot year group' }, { label: 'Y8', value: 22 }, { label: 'Y9', value: 27 },
  { label: 'Y10', value: 61 }, { label: 'Y11', value: 74 }, { label: 'Y12', value: 88 }, { label: 'Y13', value: 93 },
];
const TERMS = [
  { label: 'T1 25', value: 0.8 }, { label: 'T2 25', value: 1.1 }, { label: 'T3 25', value: 1.4 },
  { label: 'T1 26', value: 1.9 }, { label: 'T2 26', value: 2.3 }, { label: 'T3 26', value: 2.6 }, { label: 'T1 27', value: 3.1 },
];
const LEVELS = ['school-verified', 'teacher-endorsed', 'student-added'];
const LEVEL_NAME = { 'school-verified': 'School systems', 'teacher-endorsed': 'Teacher endorsed', 'student-added': 'Student added' };

export default function SchoolDashboard({ go, version, persona, toast }) {
  const [drill, setDrill] = useState(null); // { kind, i? }
  const [matching, setMatching] = useState(false);
  const roster = getRoster();
  const unmatched = roster.filter((r) => !r.matched).length;
  const events = getStore().events;
  const mix = ['school-verified', 'teacher-endorsed', 'student-added'].map((k) => ({ k, value: events.filter((e) => e.verification === k).length }));
  const ints = getIntegrations('st-01');
  const students = getStudents({ includeCohort: true });
  const signals = students.reduce((n, s) => n + (s.openSignals || 0), 0);
  const pending = getStore().requests.filter((r) => r.status === 'pending').length;
  return (
    <div className="page dash">
      <header className="page-head">
        <div>
          <div className="kicker">Head of School · whole-school view</div>
          <h1>How the portfolio is being used</h1>
          <p>Counts only. Nobody at this level can open a student’s private stations.</p>
        </div>
        <span className="mock-pill">Illustrative pilot data</span>
      </header>
      <div className="tiles">
        <button className="tile" onClick={() => setDrill({ kind: 'active' })}><b>71%</b><span>of students added a station this term</span><small className="tile-more">Which students?</small></button>
        <button className="tile" onClick={() => setDrill({ kind: 'verified' })}><b>{Math.round((100 * (mix[0].value + mix[1].value)) / events.length)}%</b><span>of stations verified by the school or a teacher</span><small className="tile-more">By source</small></button>
        <button className="tile" onClick={() => setDrill({ kind: 'requests' })}><b>{pending}</b><span>endorsement requests waiting</span><small className="tile-more">By teacher</small></button>
        <button className="tile" onClick={() => setDrill({ kind: 'time' })}><b>3 min</b><span>average teacher time per endorsement</span><small className="tile-more">By teacher</small></button>
      </div>
      <div className="dash-grid">
        <section className="card">
          <h2>Students active this term, by year group</h2>
          <BarChart data={ADOPTION} unit="%" max={100} label="Percentage of students active this term by year group. Select a year group for its detail" onSelect={(i) => setDrill({ kind: 'year', i })} />
          <p className="fineprint">Year 7 is the new pilot year group. Years 8 and 9 have not been onboarded yet.</p>
        </section>
        <section className="card">
          <h2>Reflections per student, by term</h2>
          <LineChart data={TERMS} label="Average reflections per student per term" />
          <p className="fineprint">Advisor prompts started in T1 2026.</p>
        </section>
        <section className="card">
          <h2>Where the evidence comes from</h2>
          <StackBar parts={[{ label: 'School systems', value: mix[0].value }, { label: 'Teacher endorsed', value: mix[1].value }, { label: 'Student added', value: mix[2].value }]} label="Share of stations by verification level" onSelect={(i) => setDrill({ kind: 'level', i })} />
          <p className="fineprint">Live from the demo record: {events.length} stations across {students.length} students.</p>
        </section>
        <section className="card">
          <h2>Integration health</h2>
          <table className="health">
            <thead><tr><th>Source</th><th>Mode</th><th>Items</th><th>Status</th></tr></thead>
            <tbody>
              {ints.map((i) => { const warn = i.id === 'clubs' && unmatched > 0; return (
                <tr key={i.id}><td>{i.name}</td><td>{i.mode}</td><td>{i.itemCount?.toLocaleString() ?? '–'}</td><td>{warn
                  ? <button className="status s-warn as-btn" onClick={() => setMatching(true)}><i aria-hidden="true">!</i>{unmatched} record{unmatched > 1 ? 's' : ''} need{unmatched > 1 ? '' : 's'} a match</button>
                  : <span className="status s-ok"><i aria-hidden="true">✓</i>Healthy</span>}</td></tr>
              ); })}
            </tbody>
          </table>
        </section>
      </div>
      <div className="dash-foot">
        <span>{signals} open advisor signals across the school</span>
        <button className="ghost" onClick={() => go('principal', 'scan')}>Open the scan-in screen</button>
      </div>
      {drill && <Drill drill={drill} events={events} students={students} onClose={() => setDrill(null)} />}
      {matching && <RosterMatch roster={roster} students={students} onClose={() => setMatching(false)} onMatch={(r, sid) => { matchRoster(r.id, sid, persona.name); toast(`Matched. “${r.title}” is now in ${students.find((s) => s.id === sid).name.split(' ')[0]}’s inbox`); }} />}
    </div>
  );
}

// F15: every number answers "which ones?". Counts and names only, never a station's content.
function Drill({ drill, events, students, onClose }) {
  const requests = getStore().requests.filter((r) => r.status === 'pending');
  let title, body;
  if (drill.kind === 'active' || drill.kind === 'year') {
    const rows = ADOPTION.map((a, i) => { const c = CONSENT[i]; return { ...a, total: c.students, active: Math.round((a.value / 100) * c.students), consent: c.pending }; });
    const pick = drill.kind === 'year' ? [rows[drill.i]] : rows;
    const named = students.filter((s) => drill.kind === 'active' || `Y${s.grade + 1}` === rows[drill.i].label)
      .map((s) => ({ s, n: events.filter((e) => e.studentId === s.id && e.date >= TERM_START && e.type !== 'goal').length }));
    title = drill.kind === 'year' ? `${rows[drill.i].label}: students active this term` : 'Students active this term';
    body = (<>
      <table className="drill-t"><thead><tr><th>Year group</th><th>Active</th><th>Students</th><th>Consent pending</th></tr></thead>
        <tbody>{pick.map((r) => <tr key={r.label}><td>{r.label}{r.note ? <small> · {r.note}</small> : null}</td><td>{r.active} <small>({r.value}%)</small></td><td>{r.total}</td><td>{r.consent || '–'}</td></tr>)}</tbody></table>
      {named.length > 0 && <><h3>In this demo</h3><ul className="drill-l">{named.map(({ s, n }) => <li key={s.id}><span className="pres-avatar xs" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span>{s.name}<small>Y{s.grade + 1}</small><b className={n ? '' : 'zero'}>{n ? `${n} new station${n > 1 ? 's' : ''}` : 'none yet'}</b></li>)}</ul></>}
      {drill.kind === 'year' && !named.length && <p className="fineprint">No demo students in this year group. The counts above are illustrative.</p>}
    </>);
  } else if (drill.kind === 'verified' || drill.kind === 'level') {
    const levels = drill.kind === 'level' ? [LEVELS[drill.i]] : LEVELS;
    title = drill.kind === 'level' ? `${LEVEL_NAME[LEVELS[drill.i]]}: where it comes from` : 'Verified stations by source';
    body = levels.map((lv) => {
      const evs = events.filter((e) => e.verification === lv);
      const by = Object.entries(evs.reduce((m, e) => ({ ...m, [e.source?.system || 'Manual']: (m[e.source?.system || 'Manual'] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
      return <section key={lv}><h3>{LEVEL_NAME[lv]} <small>{evs.length} stations</small></h3><ul className="drill-bars">{by.map(([k, n]) => <li key={k}><span>{k}</span><i style={{ width: `${(100 * n) / evs.length}%` }} /><b>{n}</b></li>)}</ul></section>;
    });
  } else if (drill.kind === 'requests') {
    const by = Object.values(requests.reduce((m, r) => { (m[r.teacherId] ||= { t: getTeacher(r.teacherId), n: 0, oldest: r.date }); m[r.teacherId].n++; if (r.date < m[r.teacherId].oldest) m[r.teacherId].oldest = r.date; return m; }, {})).sort((a, b) => b.n - a.n);
    title = 'Endorsement requests waiting';
    body = <table className="drill-t"><thead><tr><th>Teacher</th><th>Waiting</th><th>Oldest</th></tr></thead><tbody>{by.map((x) => <tr key={x.t.id}><td>{x.t.name}<small> · {x.t.role}</small></td><td>{x.n}</td><td>{fmtDate(x.oldest)}</td></tr>)}</tbody></table>;
  } else {
    const ends = getStore().endorsements;
    const by = Object.values(ends.reduce((m, e) => { (m[e.teacherId] ||= { t: getTeacher(e.teacherId), n: 0, term: 0 }); m[e.teacherId].n++; if (e.date >= TERM_START) m[e.teacherId].term++; return m; }, {})).filter((x) => x.t).sort((a, b) => b.n - a.n);
    title = 'Teacher time on endorsements';
    body = <><table className="drill-t"><thead><tr><th>Teacher</th><th>This term</th><th>All time</th><th>About</th></tr></thead><tbody>{by.map((x) => <tr key={x.t.id}><td>{x.t.name}</td><td>{x.term}</td><td>{x.n}</td><td>{x.n * 3} min</td></tr>)}</tbody></table><p className="fineprint">Minutes are estimated at 3 per endorsement, from pilot timing.</p></>;
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal drill" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close" autoFocus>×</button>
        <div className="modal-kicker">Behind the number</div>
        <h2>{title}</h2>
        {body}
      </div>
    </div>
  );
}

function RosterMatch({ roster, students, onClose, onMatch }) {
  const [pick, setPick] = useState(Object.fromEntries(roster.map((r) => [r.id, r.suggest])));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal drill" role="dialog" aria-label="Match roster records" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close" autoFocus>×</button>
        <div className="modal-kicker">Clubs &amp; Sports · CSV import</div>
        <h2>Match records to students</h2>
        <p className="fineprint">These rows had a name the import could not match exactly. Nothing reaches a student until it is matched, and then it waits in their inbox like any other item.</p>
        <ul className="roster">{roster.map((r) => (
          <li key={r.id} className={r.matched ? 'done' : ''}>
            <div><code>{r.raw}</code><small>{r.file}, row {r.row}</small></div>
            {r.matched ? <span className="status s-ok"><i aria-hidden="true">✓</i>{students.find((s) => s.id === r.matched).name}</span> : (
              <div className="roster-act">
                <select value={pick[r.id]} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })} aria-label="Student">{students.map((s) => <option key={s.id} value={s.id}>{s.name} · Y{s.grade + 1}{s.id === r.suggest ? ' (suggested)' : ''}</option>)}</select>
                <button className="primary small-btn" onClick={() => onMatch(r, pick[r.id])}>Match</button>
              </div>
            )}
          </li>
        ))}</ul>
        {roster.every((r) => r.matched) && <p className="fineprint">All matched. Clubs &amp; Sports is healthy again.</p>}
      </div>
    </div>
  );
}
