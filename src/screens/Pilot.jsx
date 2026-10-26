import { useState } from 'react';
import { estimate, PRESETS, SYSTEMS } from './Rollout.jsx';

const OPTIONS = [
  { id: 'dp', name: 'DP pilot', who: 'Years 12–13', ...PRESETS.dp,
    learn: ['Whether counsellors save time on references and applications', 'How teachers cope with endorsement requests in the busiest years'],
    risk: ['Students meet it late, so their maps start in Year 12 with little history', 'Says little about younger students, where consent rules differ'],
    good: 'The fastest proof of value for university applications.' },
  { id: 'all', name: 'Whole school from Year 7', who: 'Years 7–13', ...PRESETS.all,
    learn: ['Whether the map grows with a student over years', 'How parental consent works for Years 7–9 under PDPA'],
    risk: ['Larger training load and more adapters before anyone sees value', 'Year 12–13 benefits arrive at the same pace as everyone else'],
    good: 'Builds the full trajectory the portfolio is for, from the first week.' },
];
const ROWS = [['students', 'Students'], ['systems', 'Systems connected'], ['weeks', 'Developer-weeks to build'], ['staff', 'Staff to train'], ['months', 'Months until the pilot starts'], ['run', 'Running cost a year']];

// L5: the two ways to start, side by side, from the same estimates as the rollout planner.
export default function Pilot({ go, persona }) {
  const [pick, setPick] = useState(null);
  const est = Object.fromEntries(OPTIONS.map((o) => [o.id, estimate(o.systems, o.years)]));
  const val = (id, k) => { const e = est[id]; return k === 'systems' ? e.chosen.length : k === 'run' ? `฿${(e.run / 1000).toLocaleString()}k` : e[k].toLocaleString(); };
  return (
    <div className="page pilot">
      <header className="page-head">
        <div>
          <div className="kicker">Pilot options</div>
          <h1>Which grades start?</h1>
          <p>The same estimates as the rollout planner, for the two ways NIST could begin. A third way, Years 10–13, sits in between.</p>
        </div>
        <span className="mock-pill">Illustrative estimates, not a quote</span>
      </header>
      <div className="pl-grid">
        {OPTIONS.map((o) => (
          <section key={o.id} className={`card-sec pl-col${pick === o.id ? ' on' : ''}`}>
            <div className="kicker">{o.who}</div>
            <h2>{o.name}</h2>
            <p className="pl-good">{o.good}</p>
            <dl className="pl-nums">{ROWS.map(([k, l]) => <div key={k}><dt>{l}</dt><dd>{val(o.id, k)}</dd></div>)}</dl>
            <h3>Includes</h3>
            <p className="pl-sys">{SYSTEMS.filter((s) => o.systems.includes(s.id)).map((s) => s.name).join(', ')}</p>
            <h3>What you learn</h3><ul>{o.learn.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>Watch out for</h3><ul>{o.risk.map((x) => <li key={x}>{x}</li>)}</ul>
            {est[o.id].young && <p className="fineprint">Needs parental consent forms for Years 7–9 before launch.</p>}
            <button className={pick === o.id ? 'primary' : 'ghost'} aria-pressed={pick === o.id} onClick={() => setPick(pick === o.id ? null : o.id)}>{pick === o.id ? '✓ Shortlisted' : 'Shortlist this option'}</button>
          </section>
        ))}
      </div>
      <div className="al-bar">
        <span className="muted">{pick ? `${OPTIONS.find((o) => o.id === pick).name} is shortlisted for the board.` : 'Shortlist one to take to the board.'}</span>
        <span className="spacer" />
        <button className="ghost" onClick={() => go(persona.id, 'rollout')}>Adjust the scope in the planner</button>
      </div>
    </div>
  );
}
