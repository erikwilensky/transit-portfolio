import { useMemo } from 'react';
import { profileCoverage } from '../api.js';

// N6: school-wide coverage of the IB learner profile and ATL skills, as counts only.
// Leadership sees how many students show each attribute somewhere on their map, never which stations.
function Bars({ rows, n, label }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="lp-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.k} title={`${r.n} of ${n} students`}>
          <span className="lpb-k">{r.k}</span>
          <span className="lpb-track"><span className={`lpb-bar${r.n === Math.min(...rows.map((x) => x.n)) ? ' low' : ''}`} style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="lpb-n">{Math.round((r.n / n) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function LearnerProfile({ version }) {
  const c = useMemo(() => profileCoverage(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lows = [...c.lp].sort((a, b) => a.n - b.n).slice(0, 2);
  const top = [...c.lp].sort((a, b) => b.n - a.n)[0];
  return (
    <div className="page learner-profile">
      <header className="page-head">
        <div>
          <div className="kicker">Learner profile and ATL</div>
          <h1>Which attributes show up on students’ maps</h1>
          <p>Each station is tagged with IB learner profile attributes and approaches-to-learning skills, suggested from the station and confirmed by the student. This page shows counts only, for an IB evaluation or a staff meeting.</p>
        </div>
        <div className="meter">
          <div><b>{c.n}</b><span>students in the demo data</span></div>
          <div><b>{top.k}</b><span>shown by the most students</span></div>
          <div><b>{lows.map((x) => x.k).join(', ')}</b><span>shown by the fewest</span></div>
        </div>
      </header>
      <div className="lp-grid">
        <section className="card-sec"><h3>Learner profile <small>share of students with at least one station</small></h3><Bars rows={c.lp} n={c.n} label="Learner profile coverage" /></section>
        <section className="card-sec"><h3>Approaches to learning <small>share of students with at least one station</small></h3><Bars rows={c.atl} n={c.n} label="ATL coverage" />
          <p className="fineprint">Fewest students show <b>{lows[0].k}</b> and <b>{lows[1].k}</b>. Advisors could use the signal board to prompt reflections on moments that show them, or departments could look at where these attributes are taught.</p>
        </section>
      </div>
      <p className="fineprint">Illustrative: the demo has {c.n} students. In a pilot this would cover the whole year group, with the same rule: counts only, never a student’s private stations.</p>
    </div>
  );
}
