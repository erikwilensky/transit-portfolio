import { useState } from 'react';
import { endorseClassTask, getClassTasks, getStudent, snapshot } from '../api.js';
import { fmtDate, inkOn } from '../format.js';

const NOTES = ['Met the brief.', 'Independent work.', 'Beyond the syllabus.'];

// N12: one ManageBac task becomes a teacher-endorsed station for every student who submitted it.
// Each one lands in the student's inbox, so the student still decides whether it joins the map.
export default function ClassTask({ teacherId, onClose, toast }) {
  const tasks = getClassTasks(teacherId);
  const [taskId, setTaskId] = useState(tasks.find((t) => !t.done)?.id || tasks[0].id);
  const task = tasks.find((t) => t.id === taskId);
  const [picked, setPicked] = useState(task.submitted);
  const [note, setNote] = useState(NOTES[0]);
  const choose = (id) => { setTaskId(id); setPicked(tasks.find((t) => t.id === id).submitted); };
  const flip = (sid) => setPicked(picked.includes(sid) ? picked.filter((x) => x !== sid) : [...picked, sid]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal class-dlg" role="dialog" aria-label="Endorse a class task" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">One task, the whole class</div>
        <h2>Endorse a ManageBac task for everyone who submitted it</h2>
        <div className="ct-tasks" role="radiogroup" aria-label="Task">
          {tasks.map((t) => (
            <button key={t.id} role="radio" aria-checked={t.id === taskId} className={t.id === taskId ? 'on' : ''} onClick={() => choose(t.id)}>
              <b>{t.title}</b><small>ManageBac · due {fmtDate(t.due)} · {t.submitted.length} submitted{t.done ? ` · endorsed ${fmtDate(t.done.at)}` : ''}</small>
            </button>
          ))}
        </div>
        {task.done ? (
          <p className="ct-done"><span className="status s-ok"><i>✓</i>Done</span> {task.done.count} station{task.done.count === 1 ? '' : 's'} endorsed on {fmtDate(task.done.at)} and sent to students’ inboxes.</p>
        ) : (
          <>
            <ul className="ct-list">
              {task.submitted.map((sid) => { const s = getStudent(sid); return (
                <li key={sid}><label><input type="checkbox" checked={picked.includes(sid)} onChange={() => flip(sid)} /><span className="av" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span><b>{s.name}</b><small>Year {s.grade + 1} · submitted</small></label></li>
              ); })}
              {task.late.map((sid) => { const s = getStudent(sid); return <li key={sid} className="late"><span className="av" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span><b>{s.name}</b><small>not submitted yet, so left out</small></li>; })}
            </ul>
            <div className="ct-notes q-chips"><small>Note on every endorsement</small>{NOTES.map((n) => <button key={n} className={note === n ? 'on' : ''} aria-pressed={note === n} onClick={() => setNote(n)}>{n}</button>)}</div>
            <p className="fineprint">Each student gets the station in their inbox, already endorsed, and chooses whether it joins their map. By hand this is about 3 minutes each.</p>
            <div className="composer-foot">
              <button className="primary" disabled={!picked.length} onClick={() => { const snap = snapshot(); const n = endorseClassTask(task.id, picked, note); toast(`Endorsed for ${n} student${n === 1 ? '' : 's'} in one go, about ${n * 3} minutes saved`, snap); onClose(); }}>Endorse for {picked.length} student{picked.length === 1 ? '' : 's'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
