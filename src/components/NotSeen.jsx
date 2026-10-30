// Not seen lately (docs/pilot-server.md): a subject teacher's students with nothing for a class for a few weeks, with a
// one-tap nudge; the banner a nudged student sees; the count an advisor sees.
import { useMemo, useState } from 'react';
import { classesOf, classNudgeText, nudgeClass, notSeenLately, openClassNudges, snapshot, subjectNudgeCount, NSL_WEEKS, NSL_DEFAULT, NSL_NOTE_MAX, NUDGE_GAP, TODAY } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import './feedback-nudges.css';
import './not-seen.css';

const KEY = 'tp-nsl-weeks';
const SHOW = 8;
const agoDays = (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const readWeeks = () => { try { const w = +localStorage.getItem(KEY); return NSL_WEEKS.includes(w) ? w : NSL_DEFAULT; } catch { return NSL_DEFAULT; } };
function useWeeks() {
  const [w, setW] = useState(readWeeks);
  return [w, (v) => { setW(v); try { localStorage.setItem(KEY, String(v)); } catch { /* blocked */ } }];
}
const first = (s) => s.name.split(' ')[0];

function Weeks({ weeks, setWeeks, id }) {
  return (
    <div className="nsl-weeks" role="group" aria-label="Quiet for">
      {NSL_WEEKS.map((w) => <button key={w} type="button" id={`${id}-${w}`} className={w === weeks ? 'on' : ''} aria-pressed={w === weeks} onClick={() => setWeeks(w)}>{w} weeks</button>)}
    </div>
  );
}

// One class: its quiet students, the 2/4/6 week switch, a nudge each, and "Nudge all N" with a confirm.
export function QuietClass({ classId, teacherId, toast, version, heading = true }) {
  const [weeks, setWeeks] = useWeeks();
  const r = useMemo(() => notSeenLately(classId, weeks), [classId, weeks, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null); // a student id, or 'all'
  const [note, setNote] = useState('');
  const [more, setMore] = useState(false);
  if (!r) return null;
  const id = `nsl-${classId.replace(/[^\w-]/g, '')}`;
  const msg = r.line ? classNudgeText({ from: teacherId, lineId: r.c.lineId }) : '';
  if (r.noLine) return (
    <section className="card-sec nsl" aria-labelledby={heading ? `${id}-h` : undefined}>
      {heading && <h2 id={`${id}-h`}>Not seen lately</h2>}
      <p className="nsl-hint">This class is not on a line yet, so there is nothing to count. Ask your coordinator to put {r.c.subject || 'this subject'} on a line (Lines, “Subjects and lines”).</p>
    </section>
  );
  const ready = r.quiet.filter((q) => q.can);
  const open = (who) => { setNote(''); setEditing(who); };
  const send = () => {
    const to = editing === 'all' ? ready : r.quiet.filter((q) => q.student.id === editing && q.can);
    if (!to.length) return setEditing(null);
    const snap = snapshot();
    try {
      nudgeClass(classId, to.map((q) => q.student.id), teacherId, note.trim() || undefined);
      toast(to.length === 1 ? `Nudge sent to ${first(to[0].student)}` : `Nudges sent to ${to.length} students`, snap);
    } catch (e) { toast(e.message); }
    setEditing(null);
  };
  const editor = (
    <div className="nd-edit nsl-edit">
      {editing === 'all'
        ? <p className="nsl-confirm"><b>{`Nudge all ${ready.length} students?`}</b> <span>{ready.map((q) => first(q.student)).join(', ')}</span></p>
        : null}
      <p className="nsl-msg">{msg}</p>
      <label htmlFor={`${id}-note`}>Add a short line (optional)</label>
      <input id={`${id}-note`} className="nsl-note" maxLength={NSL_NOTE_MAX} value={note} placeholder="e.g. A photo from the lab would be great." onChange={(e) => setNote(e.target.value)} />
      <div className="nd-edit-foot"><small className="fineprint">They see it on their home page and in their notifications. One a week for each class.</small>
        <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
        <button className="primary" onClick={send}>{editing === 'all' ? `Yes, nudge ${ready.length}` : 'Send'}</button></div>
    </div>
  );
  const list = more || r.quiet.length <= SHOW + 2 ? r.quiet : r.quiet.slice(0, SHOW);
  const left = [r.left.isNew && `${r.left.isNew} new to the class`, r.left.paused && `${r.left.paused} paused`].filter(Boolean).join(', ');
  return (
    <section className="card-sec nd-quiet nsl" aria-labelledby={heading ? `${id}-h` : undefined} aria-label={heading ? undefined : `Not seen lately in ${r.c.name}`} data-class={classId}>
      <div className="nd-head">
        <div>
          {heading && <h2 id={`${id}-h`}>Not seen lately</h2>}
          <small className="fineprint">{r.quiet.length ? `${r.quiet.length} ${r.quiet.length === 1 ? 'student has' : 'students have'} added nothing for ${r.line.name} in ${weeks} weeks.` : `Everyone has added something for ${r.line.name} in the last ${weeks} weeks.`}{left ? ` Not counted: ${left}.` : ''}</small>
        </div>
        <Weeks weeks={weeks} setWeeks={setWeeks} id={id} />
      </div>
      {ready.length > 1 && editing !== 'all' && <button className="ghost nsl-all" onClick={() => open('all')}>Nudge all {ready.length}</button>}
      {editing === 'all' && editor}
      {r.quiet.length > 0 && <ul className="nd-list">
        {list.map(({ student: s, last, nudge, can }) => {
          const ago = nudge ? agoDays(Math.max(0, dayDiff(nudge.date, TODAY))) : '';
          return (
            <li key={s.id} data-student={s.id}>
              <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials}</span>
              <span className="nd-who"><b>{s.name}</b><small>{last ? `Last added something ${fmtDate(last)}` : 'Nothing added yet'}{can && nudge ? ` · nudged ${ago}` : ''}</small></span>
              {can ? <button className="ghost nd-btn" aria-label={`Nudge ${s.name}`} onClick={() => open(s.id)} disabled={editing === s.id}>Nudge</button> : <span className="nd-sent" title={`One nudge each ${NUDGE_GAP} days`}>Nudged {ago}</span>}
              {editing === s.id && editor}
            </li>
          );
        })}
      </ul>}
      {r.quiet.length > SHOW + 2 && <button className="linkish nd-more" onClick={() => setMore(!more)}>{more ? 'Show fewer' : `Show all ${r.quiet.length}`}</button>}
    </section>
  );
}

// My classes, under each class: "N not seen lately", opening that class's list.
export function QuietClassRow({ classId, teacherId, toast, version }) {
  const r = useMemo(() => notSeenLately(classId, readWeeks()), [classId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  if (r.noLine) return <p className="nsl-row nsl-hint">Not on a line yet: ask your coordinator to put {r.c.subject || 'this subject'} on one, then quiet students show here.</p>;
  if (!r.quiet.length) return <p className="nsl-row nsl-none">{`Everyone has added something for ${r.line.name} lately.`}</p>;
  return <Opens className="nsl-row" summary={`${r.quiet.length} not seen lately on ${r.line.name}`}><QuietClass classId={classId} teacherId={teacherId} toast={toast} version={version} heading={false} /></Opens>;
}
// A <details> whose list is only made once it is opened (a teacher can have many classes).
function Opens({ className, summary, children }) {
  const [open, setOpen] = useState(false);
  return <details className={className} onToggle={(e) => setOpen(e.currentTarget.open)}><summary>{summary}</summary>{open && children}</details>;
}

// This week: every class with quiet students.
export function NotSeenWeek({ teacherId, toast, version, go, persona }) {
  const rows = useMemo(() => classesOf(teacherId).map((c) => notSeenLately(c.id, readWeeks())).filter((r) => r && !r.noLine && r.quiet.length), [teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return null;
  return (
    <section className="tw-sec nsl-week" aria-labelledby="tw-nsl">
      <h2 id="tw-nsl">Not seen lately</h2>
      <p className="fineprint">Students in your classes who have added nothing for that class in a while. A nudge asks them for one thing.</p>
      {rows.map((r) => (
        <Opens key={r.c.id} className="nsl-row" summary={`${r.c.name}: ${r.quiet.length} not seen lately on ${r.line.name}`}>
          <QuietClass classId={r.c.id} teacherId={teacherId} toast={toast} version={version} heading={false} />
          <a className="linkish" href={`#/${persona.id}/classes/${r.c.id}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'classes', r.c.id); }}>{`Open ${r.c.name} ›`}</a>
        </Opens>
      ))}
    </section>
  );
}

// The student's home: one banner per class that nudged them, until they add something for it (or hide it on this device).
export function ClassNudgeBanner({ studentId, onAdd, simple, version }) {
  const list = useMemo(() => openClassNudges(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hid, setHid] = useState([]);
  const hidden = (n) => { if (hid.includes(n.id)) return true; try { return localStorage.getItem(`tp-cnudge-hidden-${n.id}`) === '1'; } catch { return false; } };
  const shown = list.filter((n) => !hidden(n)).slice(0, 2);
  if (!shown.length) return null;
  const hide = (n) => { try { localStorage.setItem(`tp-cnudge-hidden-${n.id}`, '1'); } catch { /* blocked */ } setHid((h) => [...h, n.id]); };
  return shown.map((n) => (
    <div key={n.id} className={`nd-banner nsl-banner${simple ? ' simple' : ''}`} role="status" style={{ '--c': n.line.colour }}>
      <div className="nd-text"><b>{n.text}</b>{n.note ? <span translate="no">{n.note}</span> : <span>Add one thing you did for this subject.</span>}</div>
      <div className="nd-act"><button className="primary" onClick={() => onAdd(n.lineId)}>Add something</button><button className="ghost" onClick={() => hide(n)}>Not now</button></div>
    </div>
  ));
}

// The advisor's student page: how many subject nudges this advisee got lately (a count only).
export function AdviseeSubjectNudges({ studentId, version }) {
  const n = useMemo(() => subjectNudgeCount(studentId, 30), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!n) return null;
  return <section className="card-sec nsl-adv"><h3>Subject nudges</h3><p>{`Subject teachers nudged them ${n === 1 ? 'once' : `${n} times`} in the last 30 days to add something.`}</p></section>;
}
