// Advisor nudges: the "Quiet for 3 weeks" group on the advisory page, and the banner a nudged student sees on their home.
import { useMemo, useState } from 'react';
import { quietAdvisees, canNudge, nudgeAge, nudgeStudent, openNudge, snapshot, NUDGE_TEXT, QUIET_DAYS, shortName } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import './feedback-nudges.css';

const SHOW = 8;
const agoDays = (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);

export function QuietGroup({ advisorId, toast, version }) {
  const quiet = useMemo(() => quietAdvisees(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null); // a student id, or 'all'
  const [text, setText] = useState(NUDGE_TEXT);
  const [more, setMore] = useState(false);
  if (!quiet.length) return null;
  const ready = quiet.filter((q) => canNudge(q.student.id));
  const open = (who) => { setText(NUDGE_TEXT); setEditing(who); };
  const send = () => {
    const to = editing === 'all' ? ready : quiet.filter((q) => q.student.id === editing && canNudge(q.student.id));
    const snap = snapshot();
    let n = 0;
    for (const q of to) { try { nudgeStudent(q.student.id, advisorId, text.trim() === NUDGE_TEXT ? undefined : text); n++; } catch { /* nudged meanwhile */ } }
    setEditing(null);
    if (n) toast(n === 1 ? `Nudge sent to ${to[0].student.name.split(' ')[0]}` : `Nudges sent to ${n} students`, snap);
  };
  const editor = (
    <div className="nd-edit">
      <label htmlFor="nd-text">{editing === 'all' ? `Message to ${ready.length} student${ready.length === 1 ? '' : 's'}` : `Message to ${quiet.find((q) => q.student.id === editing)?.student.name.split(' ')[0]}`}</label>
      <textarea id="nd-text" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="nd-edit-foot"><small className="fineprint">They see it on their home page and in their notifications.</small>
        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button><button className="primary" onClick={send}>Send</button></div>
    </div>
  );
  return (
    <section className="card-sec nd-quiet" aria-labelledby="nd-title">
      <div className="nd-head">
        <div><h2 id="nd-title">Quiet for 3 weeks</h2><small className="fineprint">{quiet.length} student{quiet.length === 1 ? ' has' : 's have'} added nothing of their own in {QUIET_DAYS} days. One nudge each, at most once a week.</small></div>
        {ready.length > 1 && editing !== 'all' && <button className="ghost" onClick={() => open('all')}>Nudge all {ready.length}</button>}
      </div>
      {editing === 'all' && editor}
      <ul className="nd-list">
        {(more || quiet.length <= SHOW + 2 ? quiet : quiet.slice(0, SHOW)).map(({ student: s, last, nudge }) => {
          const age = nudgeAge(nudge), can = canNudge(s.id);
          return (
            <li key={s.id}>
              <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials}</span>
              <span className="nd-who"><b>{s.name}</b><small>Year {s.grade + 1} · {last ? `last added ${fmtDate(last)}` : 'Not started yet'}{can && nudge ? ` · nudged ${agoDays(age)}` : ''}</small></span>
              {can ? <button className="ghost nd-btn" onClick={() => open(s.id)} disabled={editing === s.id}>Send a nudge</button> : <span className="nd-sent">Nudged {agoDays(age)}</span>}
              {editing === s.id && editor}
            </li>
          );
        })}
      </ul>
      {quiet.length > SHOW + 2 && <button className="linkish nd-more" onClick={() => setMore(!more)}>{more ? 'Show fewer' : `Show all ${quiet.length}`}</button>}
    </section>
  );
}

// The student's home: a friendly banner while a nudge is open (until they add something, or hide it on this device).
export function NudgeBanner({ studentId, onAdd, simple, version }) {
  const n = useMemo(() => openNudge(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = n && `tp-nudge-hidden-${n.id}`;
  const [hid, setHid] = useState(null);
  let stored = false; try { stored = !!key && localStorage.getItem(key) === '1'; } catch { /* blocked */ }
  if (!n || stored || hid === n.id) return null;
  const hide = () => { try { localStorage.setItem(key, '1'); } catch { /* blocked */ } setHid(n.id); };
  return (
    <div className={`nd-banner${simple ? ' simple' : ''}`} role="status">
      <div className="nd-text"><b>{n.fromName ? `${shortName(n.fromName)} says hello` : 'Your advisor says hello'}</b><span>{n.text}</span></div>
      <div className="nd-act"><button className="primary" onClick={onAdd}>Add something</button><button className="ghost" onClick={hide}>Not now</button></div>
    </div>
  );
}
