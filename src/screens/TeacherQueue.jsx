import { useState } from 'react';
import { declineRequest, endorse, getRequests, getStore, getTeacher, getLine } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';

const CHIPS = ['Independent work', 'Beyond the syllabus', 'Strong collaboration', 'Real-world impact', 'Clear progress'];

// A subject teacher's home: items waiting for an endorsement, one click each.
export default function TeacherQueue({ teacherId, toast, version }) {
  const t = getTeacher(teacherId);
  const pending = getRequests(teacherId);
  const done = getRequests(teacherId, null).filter((r) => r.status !== 'pending');
  const [picked, setPicked] = useState([]);
  const [notes, setNotes] = useState({});
  const [chips, setChips] = useState({});
  const termEndorsed = 14 + done.filter((r) => r.status === 'endorsed').length;
  const autoShare = (() => { const ev = getStore().events.filter((e) => e.date >= '2026-08-15'); return Math.round(100 * ev.filter((e) => e.verification === 'school-verified').length / Math.max(1, ev.length)); })();
  const noteFor = (r) => [...(chips[r.id] || []), notes[r.id]].filter(Boolean).join('. ') || 'Endorsed.';
  const doEndorse = (ids) => {
    ids.forEach((id) => endorse(id, teacherId, noteFor(pending.find((r) => r.id === id))));
    setPicked([]);
    toast(ids.length > 1 ? `${ids.length} items endorsed. Students were notified.` : 'Endorsed. The badge on the student’s map is now outlined.');
  };

  return (
    <div className="page queue">
      <header className="page-head">
        <div>
          <div className="kicker">Endorsement queue</div>
          <h1>{t.name}</h1>
          <p>{t.role} · items from your students and from ManageBac that need a teacher’s eye</p>
        </div>
        <div className="meter" aria-label="Workload this term">
          <div><b>{pending.length}</b><span>waiting</span></div>
          <div><b>{termEndorsed}</b><span>endorsed this term</span></div>
          <div><b>~3 min</b><span>each, on average</span></div>
          <div><b>{autoShare}%</b><span>of stations verified automatically, no teacher needed</span></div>
        </div>
      </header>

      {pending.length > 1 && (
        <div className="batch-bar">
          <label><input type="checkbox" checked={picked.length === pending.length} onChange={() => setPicked(picked.length === pending.length ? [] : pending.map((r) => r.id))} /> Select all</label>
          <span className="spacer" />
          <button className="primary" disabled={!picked.length} onClick={() => doEndorse(picked)}>Endorse {picked.length || ''} selected</button>
        </div>
      )}
      {!pending.length && <div className="empty-state"><b>All caught up.</b> New requests will appear here and in your notifications.</div>}

      <div className="queue-list">
        {pending.map((r) => {
          const e = r.event;
          const img = e.evidence.find((x) => x.kind === 'image');
          return (
            <article key={r.id} className={`q-card${r.fresh ? ' fresh' : ''}`}>
              <label className="q-pick"><input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])} aria-label={`Select ${e.title}`} /></label>
              {img ? <img src={img.url} alt={img.caption} className="q-img" /> : <div className="q-img none">{TYPE_LABEL[e.type]}</div>}
              <div className="q-body">
                <div className="q-meta">
                  <span className="pres-avatar xs" style={{ background: r.student.avatar.colour }}>{r.student.avatar.initials}</span>
                  <b>{r.student.name}</b><span>Grade {r.student.grade}</span>
                  <span className="q-src">{r.source === 'lms' ? 'From ManageBac' : 'Requested by the student'} · {fmtDate(r.date)}</span>
                  {r.fresh && <span className="new-pill">NEW</span>}
                </div>
                <h3>{e.title}</h3>
                <p>{e.about || e.summary}</p>
                <div className="q-tags">
                  {e.lineIds.map((id) => { const l = getLine(id); return l && <span key={id} className="line-chip static" style={{ '--c': l.colour }}><i />{l.name}</span>; })}
                  <VerifyBadge level={e.verification} />
                  <span className="q-src">{e.source.system}{e.source.ref ? ` · ${e.source.ref}` : ''}</span>
                </div>
                {r.note && <blockquote className="q-note">“{r.note}”</blockquote>}
                <div className="q-chips">{CHIPS.map((c) => { const on = (chips[r.id] || []).includes(c); return <button key={c} className={on ? 'on' : ''} onClick={() => setChips({ ...chips, [r.id]: on ? chips[r.id].filter((x) => x !== c) : [...(chips[r.id] || []), c] })}>{c}</button>; })}</div>
                <div className="q-actions">
                  <input value={notes[r.id] || ''} onChange={(ev) => setNotes({ ...notes, [r.id]: ev.target.value })} placeholder="Optional note for the student’s record" />
                  <button className="ghost" onClick={() => { declineRequest(r.id, 'More evidence please'); toast('Sent back with a request for more evidence.'); }}>Ask for more</button>
                  <button className="primary" onClick={() => doEndorse([r.id])}>Endorse</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {done.length > 0 && (
        <section className="q-done">
          <h2>Done today</h2>
          <ul>{done.map((r) => <li key={r.id}><span className={`st st-${r.status}`}>{r.status === 'endorsed' ? 'Endorsed' : 'Sent back'}</span>{r.event.title} <small>· {r.student.name}</small></li>)}</ul>
        </section>
      )}
    </div>
  );
}
