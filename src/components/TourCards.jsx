import { inkOn } from '../format.js';
import { getRollout } from '../api.js';
import { plan, SYSTEMS } from '../screens/Rollout.jsx';
import { PERSONAS, KIND_LABEL } from '../personas.js';
import { QA } from '../tour.js';
import Logo from './Logo.jsx';

const ROLES = ['student', 'advisor', 'teacher', 'counsellor', 'coordinator', 'leadership', 'external'];
const ROLE_LINE = { student: 'adds, reflects, shares', advisor: 'prompts and guides', teacher: 'endorses in one click', counsellor: 'writes from evidence', coordinator: 'tracks requirements', leadership: 'sees the whole school', external: 'reads and verifies' };

// Q1: the tour opens on the problem and the idea, and closes on a decision.
export function TourCard({ kind, ctx }) {
  if (kind === 'open') {
    return (
      <div className="tour-card open" role="region" aria-label="Opening">
        <div className="tc-tri" aria-hidden="true" />
        <Logo className="tc-logo" />
        <p className="tc-kicker">NIST Transit Portfolio</p>
        <h1>Every student’s journey, on one verified map.</h1>
        <div className="tc-cols">
          <section><h2>Today</h2><p>A student’s learning sits in six systems: the SIS, ManageBac, the CAS log, clubs and sports, exam boards and GitHub. No one sees the whole journey, and every year counsellors rebuild it by hand.</p></section>
          <section><h2>The idea</h2><p>One record that each system feeds and the student owns. Teachers verify it. Every audience reads it in the format it needs, and only what the student chooses to share.</p></section>
        </div>
        <ul className="tc-roles">{ROLES.map((k) => { const p = PERSONAS.find((x) => x.kind === k); return <li key={k}><span className="av" style={{ background: p.colour, color: inkOn(p.colour) }}>{p.initials}</span><b>{KIND_LABEL[k] === 'Students' ? 'Student' : KIND_LABEL[k]}</b><small>{ROLE_LINE[k]}</small></li>; })}</ul>
        <p className="tc-hint">Seven roles, one record. Press <kbd>→</kbd> to begin.</p>
      </div>
    );
  }
  const r = getRollout();
  const p = plan(r);
  const yrs = [...r.years].sort((a, b) => a - b);
  const years = yrs.length === 1 ? `Year ${yrs[0]}` : yrs.length === 2 ? `Years ${yrs[0]} and ${yrs[1]}` : `Years ${yrs[0]} to ${yrs.at(-1)}`;
  return (
    <div className="tour-card ask" role="region" aria-label="The ask">
      <div className="tc-tri" aria-hidden="true" />
      <p className="tc-kicker">The ask</p>
      <h1>Approve a pilot for {years}, live in {p.goLabel}.</h1>
      <div className="tc-tiles">
        <div><b>{p.students.toLocaleString()}</b><span>students in {years}</span></div>
        <div><b>{p.chosen.length}</b><span>systems connected: {p.chosen.map((s) => s.name.replace(/ \(.*\)/, '')).join(', ')}</span></div>
        <div><b>{p.buildMonths} months</b><span>to build, {p.adapterWeeks} developer-weeks with {r.devs} developer{r.devs > 1 ? 's' : ''}</span></div>
        <div><b>฿{(p.run / 1000).toLocaleString()}k</b><span>a year to run: hosting, support and licences</span></div>
      </div>
      <ol className="tc-phases">{p.phases.map(([name, what]) => <li key={name}><b>{name}</b><span>{what}</span></li>)}</ol>
      <p className="tc-next"><b>What we need today:</b> a yes to the privacy review and adapter build, and {p.staff} staff to train{SYSTEMS.length > p.chosen.length ? `. Other systems can join later` : ''}.</p>
      <div className="tc-btns">
        <button className="ghost" onClick={() => ctx.go('principal', 'rollout')}>Adjust in the rollout planner</button>
        <span className="tc-mock">Illustrative estimates, not a quote</span>
      </div>
    </div>
  );
}

// Q3: the tour as a small metro line, a station per step, with the time left.
export function TourRoute({ tour, step, onStep }) {
  const n = tour.steps.length;
  const left = tour.steps.slice(step).reduce((t, s) => t + (s.secs || 30), 0);
  const w = Math.max(120, Math.min(260, n * 22));
  const x = (i) => 8 + (i * (w - 16)) / Math.max(1, n - 1);
  return (
    <div className="pr-route">
      <svg width={w} height="22" viewBox={`0 0 ${w} 22`} role="group" aria-label={`Stop ${step + 1} of ${n}`}>
        <line x1={x(0)} x2={x(n - 1)} y1="11" y2="11" className="prr-line" />
        <line x1={x(0)} x2={x(step)} y1="11" y2="11" className="prr-done" />
        {tour.steps.map((s, i) => (
          <g key={i} onClick={() => onStep(i)} className="prr-stop" role="button" aria-label={`${i + 1}. ${s.title}`} tabIndex={-1}>
            <title>{`${i + 1}. ${s.title}`}</title>
            <rect x={x(i) - 8} y="0" width="16" height="22" fill="transparent" />
            {s.card ? <rect x={x(i) - 4} y="7" width="8" height="8" className={`prr-card${i <= step ? ' on' : ''}`} /> : <circle cx={x(i)} cy="11" r={i === step ? 6 : 4} className={i < step ? 'prr-past' : i === step ? 'prr-now' : 'prr-next'} />}
          </g>
        ))}
      </svg>
      <small>{step + 1}/{n} · about {Math.max(1, Math.round(left / 60))} min left</small>
    </div>
  );
}

// Q2: likely board questions, each with a short answer and a screen that proves it.
export function QADrawer({ ctx, onClose }) {
  return (
    <div className="modal-back qa-back" onClick={onClose}>
      <aside className="qa-drawer" role="dialog" aria-label="Questions and answers" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Q&amp;A for the presenter</div>
        <h2>Likely questions</h2>
        <ul>{QA.map((x) => (
          <li key={x.q}>
            <details>
              <summary>{x.q}</summary>
              <p>{x.a}</p>
              <button className="primary small-btn" onClick={() => { onClose(); x.go(ctx); }}>Show me: {x.show}</button>
            </details>
          </li>
        ))}</ul>
        <p className="fineprint">The tour stays where it was. Press Next to carry on from the same stop.</p>
      </aside>
    </div>
  );
}
