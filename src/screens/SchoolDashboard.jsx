import { getIntegrations, getStore, getStudents } from '../api.js';
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
const HEALTH = {
  sis: ['ok', 'Healthy'], lms: ['ok', 'Healthy'], sports: ['warn', '2 records need a match'], music: ['ok', 'Healthy'], cas: ['ok', 'Healthy'],
};

export default function SchoolDashboard({ go, version }) {
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
        <div className="tile"><b>71%</b><span>of students added a station this term</span></div>
        <div className="tile"><b>{Math.round((100 * (mix[0].value + mix[1].value)) / events.length)}%</b><span>of stations verified by the school or a teacher</span></div>
        <div className="tile"><b>{pending}</b><span>endorsement requests waiting</span></div>
        <div className="tile"><b>3 min</b><span>average teacher time per endorsement</span></div>
      </div>
      <div className="dash-grid">
        <section className="card">
          <h2>Students active this term, by year group</h2>
          <BarChart data={ADOPTION} unit="%" max={100} label="Percentage of students active this term by year group" />
          <p className="fineprint">Year 7 is the new pilot year group. Years 8 and 9 have not been onboarded yet.</p>
        </section>
        <section className="card">
          <h2>Reflections per student, by term</h2>
          <LineChart data={TERMS} label="Average reflections per student per term" />
          <p className="fineprint">Advisor prompts started in T1 2026.</p>
        </section>
        <section className="card">
          <h2>Where the evidence comes from</h2>
          <StackBar parts={[{ label: 'School systems', value: mix[0].value }, { label: 'Teacher endorsed', value: mix[1].value }, { label: 'Student added', value: mix[2].value }]} label="Share of stations by verification level" />
          <p className="fineprint">Live from the demo record: {events.length} stations across {students.length} students.</p>
        </section>
        <section className="card">
          <h2>Integration health</h2>
          <table className="health">
            <thead><tr><th>Source</th><th>Mode</th><th>Items</th><th>Status</th></tr></thead>
            <tbody>
              {ints.map((i) => { const [k, t] = HEALTH[i.id] || ['ok', 'Healthy']; return (
                <tr key={i.id}><td>{i.name}</td><td>{i.mode}</td><td>{i.itemCount?.toLocaleString() ?? '–'}</td><td><span className={`status s-${k}`}><i aria-hidden="true">{k === 'ok' ? '✓' : '!'}</i>{t}</span></td></tr>
              ); })}
            </tbody>
          </table>
        </section>
      </div>
      <div className="dash-foot">
        <span>{signals} open advisor signals across the school</span>
        <button className="ghost" onClick={() => go('principal', 'scan')}>Open the scan-in screen</button>
      </div>
    </div>
  );
}
