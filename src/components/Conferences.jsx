// Conferences (api.addConference, editConference, removeConference): the school arranges its parent-student-advisor
// conferences outside the app; here staff note one (a title, a date or dates, which students) so students can get ready
// (StudentLed.jsx). My advisory lists the advisor's, with who has prepared and Conference mode; the school overview adds one
// for a whole Year. No times, no bookings, nothing for families.
import { useMemo, useState } from 'react';
import { addConference, advisorConferences, advisoryOf, confDates, confLive, editConference, getConferences, getTeacher, removeConference, snapshot, TODAY } from '../api.js';
import { ConferenceMode, ConferencePrep } from './StudentLed.jsx';
import './conferences.css';

const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── The form: a title and a date, or a first and last date ──
function ConfForm({ start, label, onSave, onCancel, children }) {
  const [f, setF] = useState(() => (start ? { title: start.title, from: start.from, to: start.to } : { title: 'Parent conferences', from: addDays(TODAY, 7), to: '' }));
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <form className="cb-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...f, to: f.to || f.from }); }}>
      {children}
      <label>Title<input value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
      <div className="cb-row">
        <label>Date<input type="date" value={f.from} min={start ? undefined : TODAY} onChange={(e) => set({ from: e.target.value })} /></label>
        <label>Last date <small>(if more than one day)</small><input type="date" value={f.to === f.from ? '' : f.to} min={f.from} onChange={(e) => set({ to: e.target.value })} /></label>
      </div>
      <div className="cb-form-foot"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button type="submit" className="primary">{label}</button></div>
    </form>
  );
}
const run = (fn, msg, toast) => { const snap = snapshot(); try { const r = fn(); toast?.(typeof msg === 'function' ? msg(r) : msg, snap); return true; } catch (e) { toast?.(e.message); return false; } };

// ── My advisory: the conferences this advisor's students are in ──
export function AdvisoryConferences({ advisorId, version, toast, focus }) {
  const list = useMemo(() => advisorConferences(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false);
  const group = advisoryOf(advisorId);
  const [, fc] = /^conf~([^~]+)/.exec(focus || '') || [];
  if (!group.size && !list.length) return null;
  const add = (f) => run(() => addConference({ ...f, advisorId }, advisorId), (r) => `Conference added for ${plural(r.studentIds.length, 'student')}. They can get ready for it now.`, toast) && setAdding(false);
  return (
    <section className="card-sec cb-adv" aria-labelledby="cb-adv-h">
      <div className="nd-head"><div><h2 id="cb-adv-h">Conferences</h2>
        <small className="fineprint">Add your advisory’s conference here so students can get ready for it. Times are arranged with families as usual, outside the app.</small></div>
        {!adding && !list.some(confLive) && <button className="ghost" onClick={() => setAdding(true)}>Add a conference</button>}</div>
      {adding && <ConfForm label={`Add for ${plural(group.size, 'student')}`} onSave={add} onCancel={() => setAdding(false)} />}
      {list.map((c) => <AdvisorConference key={c.id} c={c} advisorId={advisorId} version={version} toast={toast} open={c.id === fc} />)}
    </section>
  );
}

function AdvisorConference({ c, advisorId, version, toast, open }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState(null); // a student's Conference mode (StudentLed.jsx)
  const mine = c.advisorId === advisorId || c.by === advisorId;
  const by = c.by && c.by !== advisorId ? getTeacher(c.by)?.name : null;
  return (
    <div className="cb-round">
      <div className="cb-round-head"><h3>{c.title}</h3>
        <small className="fineprint">{confDates(c)}{by ? ` · added by ${by}${c.year ? ` for Year ${c.year}` : ''}` : ''}</small></div>
      {mine && !editing && <div className="cb-actions">
        <button className="ghost" onClick={() => setEditing(true)}>Change</button>
        <button className="linkish" onClick={() => run(() => removeConference(c.id, advisorId), `Removed ${c.title}`, toast)}>Remove</button>
      </div>}
      {editing && <ConfForm start={c} label="Save" onSave={(f) => run(() => editConference(c.id, f, advisorId), 'Conference saved', toast) && setEditing(false)} onCancel={() => setEditing(false)} />}
      <ConferencePrep c={c} advisorId={advisorId} version={version} onMode={setMode} open={open} />
      {mode && <ConferenceMode conferenceId={c.id} studentId={mode} by={advisorId} version={version} onClose={() => setMode(null)} />}
    </div>
  );
}

// ── School overview: a coordinator adds a conference for a whole Year (each student with their own advisor) ──
export function YearConferences({ persona, version, toast }) {
  const list = useMemo(() => getConferences().filter((c) => c.year && c.to >= addDays(TODAY, -30)), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState(7);
  const tid = persona?.teacherId || null;
  const add = (f) => run(() => addConference({ ...f, year }, tid), (r) => `Conference added for ${plural(r.studentIds.length, 'student')} in Year ${year}, with ${plural(r.advisorIds.length, 'advisor')}`, toast) && setAdding(false);
  return (
    <section className="card-sec cb-adv cb-year" aria-labelledby="cb-year-h">
      <div className="nd-head"><div><h2 id="cb-year-h">Conferences</h2>
        <small className="fineprint">Add a whole Year’s conferences so students can get ready and advisors see who has. Students already in one coming up are left out.</small></div>
        {!adding && <button className="ghost" onClick={() => setAdding(true)}>Add for a Year</button>}</div>
      {adding && <ConfForm label="Add it" onSave={add} onCancel={() => setAdding(false)}>
        <label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[7, 8, 9, 10, 11, 12, 13].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
      </ConfForm>}
      {list.length > 0 && <ul className="tr-wins">{list.map((c) => (
        <li key={c.id}><span><b>{c.title}</b><small>Year {c.year} · {plural(c.advisorIds.length, 'advisor')} · {confDates(c)}</small></span>
          <span className="tr-count">{plural(c.studentIds.length, 'student')}</span>
          <button className="linkish" onClick={() => run(() => removeConference(c.id, tid), `Removed ${c.title}`, toast)}>Remove<span className="sr-only"> {c.title}</span></button>
        </li>))}</ul>}
    </section>
  );
}
