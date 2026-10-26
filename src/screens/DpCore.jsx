import { useState } from 'react';
import { getDpCore, markMilestone, nudgeMilestone, TODAY } from '../api.js';
import { fmtDate } from '../format.js';

const PART = { EE: ['Extended Essay', 'var(--b-purple)'], TOK: ['Theory of Knowledge', 'var(--b-green)'], IA: ['Internal assessment', 'var(--b-orange)'] };
const STATUS = { done: 'Handed in', 'done-late': 'Handed in late', late: 'Overdue', upcoming: 'Coming up' };
const days = (d) => Math.round((new Date(d) - new Date(TODAY)) / 86400000);

// K3: EE, TOK and IA milestones from the LMS, per Diploma student, with late flags and supervisors.
export default function DpCore({ toast, go, version }) {
  const rows = getDpCore();
  const [part, setPart] = useState('all');
  const [sel, setSel] = useState(null);
  const all = rows.flatMap((r) => r.milestones.map((m) => ({ ...m, r })));
  const late = all.filter((m) => m.status === 'late');
  const soon = all.filter((m) => m.status === 'upcoming' && days(m.due) <= 21);
  const show = (m) => part === 'all' || m.part === part;
  const pick = sel && all.find((m) => `${m.r.student.id}:${m.id}` === sel);
  return (
    <div className="page dpcore">
      <header className="page-head">
        <div>
          <div className="kicker">DP core · from ManageBac</div>
          <h1>Extended Essay, TOK and IA milestones</h1>
          <p>Every Diploma student’s core deadlines in one place. Handed-in work becomes a station on the student’s map; a dashed station marks what is still to come.</p>
        </div>
        <div className="meter">
          <div><b>{late.length}</b><span>overdue now</span></div>
          <div><b>{soon.length}</b><span>due in the next 3 weeks</span></div>
          <div><b>{all.filter((m) => m.done).length}</b><span>handed in</span></div>
        </div>
      </header>
      <div className="al-bar">
        <div className="seg small" role="group" aria-label="Component">{['all', 'EE', 'TOK', 'IA'].map((p) => <button key={p} className={part === p ? 'on' : ''} aria-pressed={part === p} onClick={() => setPart(p)}>{p === 'all' ? 'All' : p}</button>)}</div>
        <span className="spacer" />
        <span className="dc-key"><i className="dc-dot done" />Handed in <i className="dc-dot late" />Overdue <i className="dc-dot upcoming" />Coming up</span>
      </div>
      {[12, 11].map((g) => (
        <section key={g} className="card-sec dc-year">
          <h3>Year {g + 1}</h3>
          {rows.filter((r) => r.student.grade === g).map((r) => (
            <div key={r.student.id} className="dc-row">
              <div className="dc-who">
                <span className="pres-avatar sm" style={{ background: r.student.avatar.colour }}>{r.student.avatar.initials}</span>
                <div><b>{r.student.name}</b><small>EE: {r.topic} · supervisor {r.supervisor?.name}</small></div>
              </div>
              <div className="dc-track">
                {r.milestones.filter(show).map((m) => {
                  const k = `${r.student.id}:${m.id}`;
                  return (
                    <button key={m.id} className={`dc-ms ${m.status}${sel === k ? ' sel' : ''}`} style={{ '--c': PART[m.part][1] }} onClick={() => setSel(sel === k ? null : k)} aria-label={`${m.part} ${m.name}, ${STATUS[m.status]}, due ${fmtDate(m.due)}`}>
                      <i className="dc-stop" aria-hidden="true" />
                      <b>{m.part} · {m.name}</b>
                      <small>{m.done ? `handed in ${fmtDate(m.done)}` : `due ${fmtDate(m.due)}`}</small>
                      {m.status === 'late' && <span className="dc-flag">{-days(m.due)} days late</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
      {pick && (
        <div className="card-sec dc-detail" role="region" aria-label="Milestone">
          <div className="xl-top"><b>{pick.r.student.name}: {PART[pick.part][0]}, {pick.name.toLowerCase()}</b><span className={`app-st dc-st-${pick.status}`}>{STATUS[pick.status]}</span></div>
          <small>Due {fmtDate(pick.due)}{pick.done ? ` · handed in ${fmtDate(pick.done)}` : ''} · supervisor {pick.r.supervisor?.name}</small>
          <div className="q-actions">
            {pick.status === 'late' && <button className="primary" disabled={!!pick.nudged} onClick={() => { nudgeMilestone(pick.r.student.id, pick); toast(`Reminded ${pick.r.student.name.split(' ')[0]}`); }}>{pick.nudged ? 'Reminder sent' : 'Send a kind reminder'}</button>}
            {!pick.done && <button className="ghost" onClick={() => { markMilestone(pick.r.student.id, pick.id); toast('Marked as handed in'); }}>Mark handed in</button>}
            {pick.eventId && <button className="ghost" onClick={() => go('whitfield', 'student', pick.r.student.id)}>See it on the map</button>}
          </div>
        </div>
      )}
      <p className="fineprint">Dates and statuses are mock data shaped like a ManageBac export. Reminders go to the student, never to parents.</p>
    </div>
  );
}
