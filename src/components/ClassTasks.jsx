import { useMemo, useState } from 'react';
import { declineRequest, dueWords, editTask, endorse, extendTask, getSchoolLines, handInTask, setTask, shortName, snapshot, taskGrid, tasksFor, tasksForClass, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { ACCEPT, evidenceFor } from '../upload.js';
import { UploadStatus, useUpload } from './FileAttach.jsx';
import { CHIPS } from '../screens/TeacherQueue.jsx';
import { Said, SayIt } from './Voice.jsx';
import './class-tasks.css';
import PhraseTools from './Phrases.jsx';

// Class tasks (api.setTask, handInTask): a teacher sets a task for a class from My classes; each student hands it in as a
// moment on its line, from the top of their home. Teacher: SetTaskDialog, ClassTaskList (class page), TaskGrid
// (#/<p>/classes/<class>~task~<task>). Student: MyTasks (Simple: big cards; Standard and Full: a "Tasks" list).
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const due = (d) => (d < TODAY ? `was due ${fmtDate(d)}` : `due ${dueWords(d)}`);
const DEFAULT_MORE = 'Could you add a little more, such as a photo or an example?';
const STATUS = { handed: 'Handed in', late: 'Handed in late', none: 'Not yet', overdue: 'Not yet, overdue' };
const CHECK = { waiting: 'To look at', more: 'Asked for more', endorsed: 'Endorsed' };

// ── Teacher ──
export function SetTaskDialog({ c, teacherId, task, onClose, toast }) {
  const lines = getSchoolLines();
  const [f, setF] = useState(() => ({ title: task?.title || '', brief: task?.brief || '', due: task?.due || '', lineId: task?.lineId || c.lineId || '', checklist: task?.checklist?.length ? [...task.checklist] : [], needsFile: !!task?.needsFile }));
  const [err, setErr] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const n = task ? task.studentIds.length : c.studentIds?.length ?? c.students?.length ?? 0;
  const save = () => {
    try {
      const snap = snapshot();
      const fields = { ...f, checklist: f.checklist.filter((x) => x.trim()) };
      if (task) { editTask(task.id, teacherId, fields); toast?.('Task saved.', snap); } else { setTask(c.id, teacherId, fields); toast?.(`Task set for ${c.name}. ${plural(n, 'student')} will see it on their home.`, snap); }
      onClose();
    } catch (e) { setErr(e.message); }
  };
  const item = (i, v) => set({ checklist: f.checklist.map((x, j) => (j === i ? v : x)) });
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal tk-set" role="dialog" aria-label={task ? `Edit the task “${task.title}”` : `Set a task for ${c.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">{task ? 'Edit the task' : 'Set a task'}</div>
        <h2>{c.name}</h2>
        <label>Title<input autoFocus value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Plant cell poster" /></label>
        <label>What to do <small>a short brief</small><textarea rows={3} value={f.brief} maxLength={600} onChange={(e) => set({ brief: e.target.value })} placeholder="e.g. Draw and label a plant cell. Use your notes from Tuesday." /></label>
        <div className="tk-row">
          <label>Due<input type="date" value={f.due} min={task ? undefined : TODAY} onChange={(e) => set({ due: e.target.value })} /></label>
          <label>Hand-ins go on<select value={f.lineId} onChange={(e) => set({ lineId: e.target.value })}>
            {!f.lineId && <option value="">Pick a line</option>}
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === c.lineId ? ' (the class’s line)' : ''}</option>)}
          </select></label>
        </div>
        <fieldset className="tk-checklist">
          <legend>Checklist <small>optional, up to 5 things the student ticks</small></legend>
          {f.checklist.map((x, i) => (
            <div key={i} className="tk-item"><input value={x} maxLength={120} aria-label={`Checklist item ${i + 1}`} onChange={(e) => item(i, e.target.value)} placeholder="e.g. Label the nucleus" />
              <button type="button" className="ghost" aria-label={`Remove item ${i + 1}`} onClick={() => set({ checklist: f.checklist.filter((_, j) => j !== i) })}>Remove</button></div>
          ))}
          {f.checklist.length < 5 && <button type="button" className="ghost tk-add" onClick={() => set({ checklist: [...f.checklist, ''] })}>Add a checklist item</button>}
        </fieldset>
        <label className="cp-check"><input type="checkbox" checked={f.needsFile} onChange={(e) => set({ needsFile: e.target.checked })} /><span><span>Needs a photo or a file</span><small>Students cannot hand in without one.</small></span></label>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{task ? `Set for ${plural(n, 'student')}` : `${plural(n, 'student')} will get it`}</span><button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={f.title.trim().length < 3 || !f.due || !f.lineId || (!task && !n)} onClick={save}>{task ? 'Save' : 'Set the task'}</button></div>
      </div>
    </div>
  );
}

export function ClassTaskList({ c, teacherId, go, persona, version, toast }) {
  const list = useMemo(() => tasksForClass(c.id), [c.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null);
  if (!list.length) return null;
  return (
    <section className="tk-list" aria-labelledby="tk-list-h">
      <h2 id="tk-list-h">Tasks</h2>
      {list.map((t) => {
        const m = t.studentIds.length, to = `${c.id}~task~${t.id}`;
        return (
          <article key={t.id} className="cp-item tk-item-card">
            <header>
              <div><b>{t.title}</b><small>Due {fmtDate(t.due)} · on {t.line?.name || 'a line'}{t.checklist.length ? ` · ${plural(t.checklist.length, 'checklist item')}` : ''}{t.needsFile ? ' · needs a photo or file' : ''}</small></div>
              <span className="cp-n"><b>{t.handed + t.late} of {m}</b><small>handed in{t.late ? `, ${t.late} late` : ''}</small></span>
            </header>
            <div className="cp-acts">
              <a className={t.waiting ? 'primary' : 'ghost'} href={`#/${persona.id}/classes/${to}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'classes', to); }}>{t.waiting ? `Look at hand-ins (${t.waiting})` : 'See hand-ins'}</a>
              <button className="ghost" onClick={() => setEditing(t)}>Edit</button>
              {t.overdue > 0 && <span className="tk-late-n">{t.overdue} overdue</span>}
            </div>
          </article>
        );
      })}
      {editing && <SetTaskDialog c={c} task={editing} teacherId={teacherId} toast={toast} onClose={() => setEditing(null)} />}
    </section>
  );
}

// The hand-in grid for one task: every student it was set for, with their moment; endorse, ask for more, or more time.
export function TaskGrid({ taskId, teacherId, back, version, toast }) {
  const g = useMemo(() => taskGrid(taskId), [taskId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [chips, setChips] = useState([]);
  const [note, setNote] = useState('');
  const [more, setMore] = useState({}); // requestId → note ('' while open)
  const [extend, setExtend] = useState({}); // studentId → date ('' while open)
  if (!g) return <div className="page mc">{back}<div className="empty-state"><b>This task is not in the record.</b></div></div>;
  const { task: t, rows } = g;
  const mine = t.teacherId === teacherId;
  const waiting = mine ? rows.filter((r) => r.check === 'waiting') : [];
  const shared = () => [...chips, note.trim()].filter(Boolean).join('. ') || 'Endorsed.';
  const first = (r) => r.student?.name.split(' ')[0] || 'the student';
  const doEndorse = (ids, who) => { if (!ids.length) return; const snap = snapshot(); endorse(ids, teacherId, shared()); toast?.(ids.length > 1 ? `${ids.length} hand-ins endorsed. Students were notified.` : `Endorsed. ${who} was notified.`, snap); };
  const askMore = (r) => { const snap = snapshot(); declineRequest(r.request.id, (more[r.request.id] || '').trim() || DEFAULT_MORE); setMore(({ [r.request.id]: _, ...m }) => m); toast?.(`Sent back to ${first(r)} with your note.`, snap); };
  const giveTime = (r) => { const d = extend[r.studentId]; if (!d) return; const snap = snapshot(); try { extendTask(t.id, r.studentId, d, teacherId); setExtend(({ [r.studentId]: _, ...x }) => x); toast?.(`${first(r)} now has until ${fmtDate(d)}.`, snap); } catch (e) { toast?.(e.message); } };
  const count = (k, v) => rows.filter((r) => r[k] === v).length;
  return (
    <div className="page mc tk">
      {back}
      <header className="page-head">
        <div>
          <div className="kicker">Hand-ins · {t.className}</div>
          <h1>{t.title}</h1>
          <p>Due {fmtDate(t.due)} · on {t.line?.name || 'a line'}{t.teacher && !mine ? ` · set by ${t.teacher.name}` : ''}</p>
        </div>
      </header>
      {t.brief && <p className="tk-brief">{t.brief}</p>}
      <p className="ca-count" aria-label="Hand-ins so far">
        <b>{count('status', 'handed') + count('status', 'late')} of {rows.length}</b> handed in
        {count('status', 'late') > 0 && <span className="tk-st tk-late">{count('status', 'late')} late</span>}
        {count('check', 'waiting') > 0 && <span className="ca-st ca-waiting">{count('check', 'waiting')} to look at</span>}
        {count('check', 'endorsed') > 0 && <span className="ca-st ca-endorsed">{count('check', 'endorsed')} endorsed</span>}
        {count('status', 'none') + count('status', 'overdue') > 0 && <span className="ca-st ca-none">{count('status', 'none') + count('status', 'overdue')} not yet</span>}
      </p>
      {!mine && <p className="ca-info">Hand-ins come to {t.teacher?.name || 'the teacher who set it'} to endorse. You can read them and give a student more time.</p>}
      {waiting.length > 0 && (
        <div className="ca-bar" role="group" aria-label="Endorse hand-ins">
          <div className="ca-bar-row"><input className="ca-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for every hand-in you endorse (optional)" aria-label="Shared note" /></div>
          <PhraseTools value={note} onChange={setNote} kind="praise" />
          <div className="q-chips">{CHIPS.map((x) => { const on = chips.includes(x); return <button key={x} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setChips(on ? chips.filter((y) => y !== x) : [...chips, x])}>{x}</button>; })}</div>
          {waiting.length > 1 && <div className="ca-bar-row"><span className="spacer" /><button className="primary" onClick={() => doEndorse(waiting.map((r) => r.request.id))}>Endorse all to look at ({waiting.length})</button></div>}
        </div>
      )}
      <ul className="tk-grid" aria-label="Hand-ins">
        {rows.map((r) => {
          const rid = r.request?.id, asking = rid && rid in more, extending = r.studentId in extend;
          return (
            <li key={r.studentId} className={`tk-cell tk-${r.status}`} data-student={r.studentId}>
              <div className="tk-who"><b>{r.student?.name || 'A student who has left'}</b>{r.student?.homeroom && <small>{r.student.homeroom}</small>}
                <span className={`tk-st tk-${r.status}`}>{STATUS[r.status]}</span>{r.check && <span className={`ca-st ca-${r.check}`}>{CHECK[r.check]}</span>}
                {r.row?.due && <small>More time: until {fmtDate(r.row.due)}</small>}</div>
              {r.event ? (
                <div className="tk-moment">
                  {r.photo ? <a href={r.photo.url} target="_blank" rel="noreferrer"><img className="ca-img" src={r.photo.url} alt={r.photo.caption || 'Photo'} /></a> : <span className="ca-img none" aria-hidden="true" />}
                  <div><small>Handed in {fmtDate(r.row.date)}{r.row.again ? ', and again after you asked for more' : ''}</small>
                    {r.text && <p>{r.text}</p>}
                    {r.files.length > 0 && <ul className="tk-files">{r.files.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.name || x.caption || 'File'}</a></li>)}</ul>}
                    {t.checklist.length > 0 && <small>Ticked {r.row.ticked?.length || 0} of {t.checklist.length}</small>}
                    {r.check === 'more' && r.request?.reason && <blockquote className="q-note">You asked: “{r.request.reason}”</blockquote>}</div>
                </div>
              ) : <div className="tk-moment none"><small>{r.status === 'overdue' ? `Nothing yet. It was due ${fmtDate(r.due)}.` : `Nothing yet. Due ${fmtDate(r.due)}.`}</small></div>}
              <div className="q-actions">
                {asking ? <>
                  <input value={more[rid]} onChange={(e) => setMore({ ...more, [rid]: e.target.value })} placeholder={DEFAULT_MORE} aria-label={`What you need from ${r.student?.name || 'the student'}`} onKeyDown={(e) => { if (e.key === 'Enter') askMore(r); if (e.key === 'Escape') setMore(({ [rid]: _, ...m }) => m); }} />
                  <button className="ghost" onClick={() => setMore(({ [rid]: _, ...m }) => m)}>Cancel</button><button className="primary" onClick={() => askMore(r)}>Send</button>
                  <PhraseTools value={more[rid]} onChange={(v) => setMore({ ...more, [rid]: v })} first={r.student?.name?.split(' ')[0] || null} kind="next" />
                </> : extending ? <>
                  <label className="tk-until">Until<input type="date" value={extend[r.studentId]} min={TODAY} onChange={(e) => setExtend({ ...extend, [r.studentId]: e.target.value })} /></label>
                  <button className="ghost" onClick={() => setExtend(({ [r.studentId]: _, ...x }) => x)}>Cancel</button><button className="primary" disabled={!extend[r.studentId]} onClick={() => giveTime(r)}>Give more time</button>
                </> : <>
                  {!r.event && <button className="ghost" onClick={() => setExtend({ ...extend, [r.studentId]: '' })} aria-label={`More time for ${r.student?.name || 'this student'}`}>More time</button>}
                  {mine && r.check === 'waiting' && <><button className="ghost" onClick={() => setMore({ ...more, [rid]: '' })} aria-label={`Ask for more from ${r.student?.name || 'this student'}`}>Ask for more</button>
                    <button className="primary" onClick={() => doEndorse([rid], first(r))} aria-label={`Endorse ${r.student?.name || 'this hand-in'}`}>Endorse</button></>}
                </>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Student: tasks at the top of their home ──
export function MyTasks({ studentId, simple, toast, version }) {
  const list = useMemo(() => tasksFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [doing, setDoing] = useState(null);
  const open = list.filter((x) => x.open);
  const who = (x) => (x.teacher ? shortName(x.teacher.name) : 'Your teacher');
  const flow = doing && <HandInFlow t={doing} who={who(doing)} studentId={studentId} onClose={() => setDoing(null)} onDone={() => { setDoing(null); toast?.(`Handed in. ${who(doing)} can see it now.`); }} />;
  if (simple) {
    if (!open.length && !doing) return null;
    return (
      <>
        <div className="tk-simple" role="region" aria-label="Tasks from your teachers">
          {open.slice(0, 3).map((x) => (
            <button key={x.id} className={`tk-card${x.status === 'overdue' ? ' late' : ''}`} onClick={() => setDoing(x)}>
              <span className="tk-ic" aria-hidden="true">✓</span>
              <span><small>{x.check === 'more' ? `${who(x)} asked for more` : `${who(x)} set a task`}</small><b>{x.title}</b>
                <small className={x.status === 'overdue' ? 'tk-due late' : 'tk-due'}>{x.status === 'overdue' ? `Late: ${due(x.due)}` : due(x.due)}</small></span>
              <span className="tk-go">{x.check === 'more' ? 'Add more' : 'Hand it in'}</span>
            </button>
          ))}
          {open.length > 3 && <p className="fineprint">And {plural(open.length - 3, 'more task')}.</p>}
        </div>
        {flow}
      </>
    );
  }
  if (!list.length && !doing) return null;
  return (
    <>
      <section className="tk-mine" aria-labelledby="tk-mine-h">
        <h2 id="tk-mine-h">Tasks</h2>
        <ul>{list.map((x) => (
          <li key={x.id}>
            <span className="tk-mine-t"><b>{x.title}</b><small>{x.className} · {who(x)}</small></span>
            {x.open ? <span className={x.status === 'overdue' ? 'tk-due late' : 'tk-due'}>{x.status === 'overdue' ? <><b>Overdue</b> {due(x.due)}</> : x.check === 'more' ? 'Asked for more' : `Due ${dueWords(x.due)}`}</span>
              : <span className="tk-due done">{x.check === 'endorsed' ? 'Endorsed' : x.status === 'late' ? 'Handed in late' : 'Handed in'}</span>}
            {x.open && <button className="ghost" onClick={() => setDoing(x)} aria-label={`${x.check === 'more' ? 'Add more to' : 'Hand in'} ${x.title}`}>{x.check === 'more' ? 'Add more' : 'Hand in'}</button>}
          </li>
        ))}</ul>
      </section>
      {flow}
    </>
  );
}

function HandInFlow({ t, who, studentId, onClose, onDone }) {
  const steps = ['brief', ...(t.checklist.length ? ['check'] : []), 'words', 'file', 'done'];
  const [i, setI] = useState(0);
  const step = steps[i];
  const [ticked, setTicked] = useState(t.row?.ticked || []);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState(null);
  const up = useUpload();
  const phone = useMemo(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, []);
  const pick = (e) => { const file = e.target.files?.[0]; e.target.value = ''; up.run(file, (r) => { const ev = evidenceFor(r, file.name); if (ev.kind === 'image') setImage(ev.url); else setFiles((f) => [...f, ev]); }); };
  const has = !!image || files.length > 0;
  const send = () => { try { handInTask(t.id, studentId, { text: text.trim(), ticked, image, files }); setErr(null); setI(steps.indexOf('done')); } catch (e) { setErr(e.message); } };
  const close = step === 'done' ? onDone : onClose;
  const more = t.check === 'more';
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal sh-flow tk-flow" role="dialog" aria-label={`Hand in ${t.title}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        <div className="sh-steps" role="img" aria-label={`Step ${i + 1} of ${steps.length}`}>{steps.map((s, j) => <i key={s} className={j <= i ? 'on' : ''} />)}</div>
        {step === 'brief' && <>
          <p className="sh-sub">{who} set a task for {t.className || 'your class'}</p>
          <div className="tk-big"><Said text={t.title} />{t.brief && <p>{t.brief}</p>}</div>
          <p className={`sh-sub${t.status === 'overdue' ? ' tk-due late' : ''}`}>{t.status === 'overdue' ? <><b>Late.</b> It {due(t.due)}.</> : `It is ${due(t.due)}.`}{t.needsFile ? ' You need a photo or a file.' : ''}</p>
          {more && <blockquote className="q-note">{who} asked for more{t.reason ? `: “${t.reason}”` : '.'}</blockquote>}
          <div className="sh-next"><button className="ghost" onClick={onClose}>Not now</button><button className="primary" autoFocus onClick={() => setI(1)}>{more ? 'Add more' : 'Start'}</button></div>
        </>}
        {step === 'check' && <>
          <h2>Tick each one you did</h2>
          <ul className="tk-ticks">{t.checklist.map((x, j) => (
            <li key={j}><label><input type="checkbox" checked={ticked.includes(j)} onChange={(e) => setTicked(e.target.checked ? [...ticked, j] : ticked.filter((k) => k !== j))} /><span>{x}</span></label></li>
          ))}</ul>
          <div className="sh-next"><button className="ghost" onClick={() => setI(i - 1)}>Back</button><button className="primary" onClick={() => setI(i + 1)}>Next</button></div>
        </>}
        {step === 'words' && <>
          <h2>{more ? 'What did you add?' : 'What did you do?'}</h2>
          <p className="sh-sub">One or two sentences is plenty.</p>
          <textarea className="sh-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="What you did" />
          <SayIt value={text} onChange={setText} />
          <div className="sh-next"><button className="ghost" onClick={() => setI(i - 1)}>Back</button><button className="primary" disabled={text.trim().length < 3 && !t.needsFile} onClick={() => setI(i + 1)}>Next</button></div>
        </>}
        {step === 'file' && <>
          <h2>{t.needsFile ? 'Add a photo or a file' : 'Add a photo or a file?'}</h2>
          <p className="sh-sub">{t.needsFile ? `${who} asked for one.` : 'You can skip this.'}</p>
          {image && <div className="sh-preview"><img src={image} alt="Your photo" /><button type="button" className="ghost" onClick={() => setImage(null)}>Remove photo</button></div>}
          {files.length > 0 && <ul className="tk-files">{files.map((x, j) => <li key={j}>{x.name}<button type="button" className="ghost" onClick={() => setFiles(files.filter((_, k) => k !== j))} aria-label={`Remove ${x.name}`}>Remove</button></li>)}</ul>}
          {!up.busy && (!image || files.length < 3) && <div className="sh-shoot">
            <label className="sh-photo-btn"><span aria-hidden="true">▣</span>{image || files.length ? 'Add another' : 'Take or choose a photo'}<input type="file" accept="image/*" onChange={pick} /></label>
            {phone && <label className="sh-photo-btn cam">Use the camera<input type="file" accept="image/*" capture="environment" onChange={pick} /></label>}
            <label className="sh-photo-btn cam">Choose a file<input type="file" accept={ACCEPT} onChange={pick} /></label>
          </div>}
          {up.busy && <p className="sh-sub" role="status">Uploading…</p>}
          <UploadStatus up={up} />
          {err && <p className="up-error" role="alert">{err}</p>}
          <div className="sh-next"><button className="ghost" onClick={() => setI(i - 1)}>Back</button>
            <button className="primary" disabled={up.busy || (t.needsFile && !has) || (!has && text.trim().length < 3)} onClick={send}>{up.busy ? 'Wait for the upload…' : has || t.needsFile ? 'Hand it in' : 'Skip and hand it in'}</button></div>
        </>}
        {step === 'done' && <>
          <h2>Handed in!</h2>
          <p>It is on your {t.line?.name || ''} line now, waiting for {who} to check it.</p>
          <div className="sh-next"><button className="primary" autoFocus onClick={onDone}>Close</button></div>
        </>}
      </div>
    </div>
  );
}
