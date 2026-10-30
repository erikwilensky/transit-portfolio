import { useEffect, useMemo, useRef, useState } from 'react';
import { addSchoolEvent, dismissSchoolEvent, dueWords, editSchoolEvent, getClasses, getSchoolLines, getTeacher, homeroomsOf, importSchoolEvents, parseEventsCsv, remindSchoolEvent, removeSchoolEvent, schoolEventProgress, schoolEventsFor, schoolEventsForStaff, schoolEventStudents, SE_KINDS, snapshot, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { evidenceFor } from '../upload.js';
import { UploadStatus, useUpload } from './FileAttach.jsx';
import './school-events.css';

// School events (api.addSchoolEvent): admins, coordinators and leadership add sports day, a trip, a concert. After it ends,
// each student it was for gets EventCards on their home ("Add something from Sports day", opening the add flow already
// filled); before it, ComingUp (Standard and Full) with "Set a goal". Staff: SchoolEventsScreen (#/<p>/events), the
// counts by homeroom (advisors their advisees, teachers their classes) and the one reminder per event.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const span = (x) => (x.end && x.end !== x.start ? `${fmtDate(x.start)} to ${fmtDate(x.end)}` : fmtDate(x.start));
const forText = (f) => (f.kind === 'years' ? `Year ${f.years.join(', ')}` : f.kind === 'homerooms' ? `Homeroom ${f.homerooms.join(', ')}` : f.kind === 'classes' ? plural(f.classIds.length, 'class', 'classes') : 'Whole school');
const WHOLE = ['leadership', 'coordinator', 'counsellor'];
export const managesEvents = (p) => !!p && (p.admin || p.kind === 'admin' || ((p.kind === 'coordinator' || p.kind === 'leadership') && !!p.teacherId));

// ── Student ──
export function EventCards({ studentId, simple, version, focusId, onAdd, toast }) {
  const { cards } = useMemo(() => schoolEventsFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = useRef(null);
  useEffect(() => { // a reminder's link: #/me/map/se~<id>
    const id = focusId?.startsWith('se~') ? focusId.slice(3) : null, c = id && cards.find((x) => x.id === id);
    if (c && done.current !== id) { done.current = id; onAdd(c.prefill); }
  }, [focusId, cards]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cards.length) return null;
  const notNow = (c) => { const snap = snapshot(); dismissSchoolEvent(c.id, studentId); toast?.(`Hidden. You can still add it any time.`, snap); };
  return (
    <div className={simple ? 'se-cards simple' : 'se-cards'} role="region" aria-label="After school events">
      {cards.slice(0, 3).map((c) => (
        <article key={c.id} className="se-card">
          {c.photo ? <img src={c.photo} alt="" /> : <span className="se-ic" aria-hidden="true">★</span>}
          <span className="se-card-t"><b id={`se-c-${c.id}`}>{`Add something from ${c.title}`}</b><small>{span(c)}</small></span>
          <span className="se-card-acts">
            <button className="primary" onClick={() => onAdd(c.prefill)} aria-describedby={`se-c-${c.id}`}>Add it</button>
            <button className="ghost" onClick={() => notNow(c)} aria-describedby={`se-c-${c.id}`}>Not for me</button>
          </span>
        </article>
      ))}
    </div>
  );
}
export function ComingUp({ studentId, version, onGoal }) {
  const { coming } = useMemo(() => schoolEventsFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!coming.length) return null;
  return (
    <section className="se-coming" aria-labelledby="se-coming-h">
      <h2 id="se-coming-h">Coming up</h2>
      <ul>{coming.slice(0, 6).map((x) => (
        <li key={x.id} style={{ '--c': x.line?.colour || 'var(--navy)' }}>
          <i aria-hidden="true" />
          <span className="se-coming-t"><b id={`se-u-${x.id}`}>{x.title}</b><small>{x.now ? 'On now' : dueWords(x.start) || fmtDate(x.start)}</small></span>
          {!x.now && <button className="ghost" onClick={() => onGoal(x.goal)} aria-describedby={`se-u-${x.id}`}>Set a goal</button>}
        </li>
      ))}</ul>
    </section>
  );
}

// ── Staff ──
export default function SchoolEventsScreen({ persona, version, toast }) {
  const manager = managesEvents(persona), whole = !!persona.admin || persona.kind === 'admin' || WHOLE.includes(persona.kind);
  const by = persona.teacherId ?? null;
  const opts = { teacherId: persona.teacherId || null, whole };
  const list = useMemo(() => schoolEventsForStaff(opts), [version, whole, persona.teacherId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null); // {} new, or an event
  const [importing, setImporting] = useState(false);
  const past = list.filter((x) => x.end < TODAY), next = list.filter((x) => x.end >= TODAY);
  return (
    <div className="se-screen">
      <header className="se-head">
        <div><h1>School events</h1><p className="fineprint">{manager ? 'Sports day, trips, concerts, service days. After each one, the students it was for get a card on their home to add something from it.' : whole ? 'Who added something after each school event.' : 'Who of your advisees and classes added something after each school event.'}</p></div>
        {manager && <div className="se-head-acts"><button className="ghost" onClick={() => setImporting(true)}>Import from CSV</button><button className="primary" onClick={() => setEditing({})}>Add an event</button></div>}
      </header>
      {!list.length && <p className="se-empty">{manager ? 'No events yet. Add one, or import a list.' : 'No school events for your students yet.'}</p>}
      {next.length > 0 && <section aria-labelledby="se-next-h"><h2 id="se-next-h">Coming up</h2>{next.map((x) => <EventRow key={x.id} x={x} opts={opts} manager={manager} by={by} toast={toast} onEdit={() => setEditing(x)} />)}</section>}
      {past.length > 0 && <section aria-labelledby="se-past-h"><h2 id="se-past-h">Done</h2>{past.map((x) => <EventRow key={x.id} x={x} opts={opts} manager={manager} by={by} toast={toast} onEdit={() => setEditing(x)} />)}</section>}
      {editing && <EventDialog x={editing.id ? editing : null} by={by} toast={toast} onClose={() => setEditing(null)} />}
      {importing && <ImportDialog by={by} toast={toast} onClose={() => setImporting(false)} />}
    </div>
  );
}

function EventRow({ x, opts, manager, by, toast, onEdit }) {
  const p = schoolEventProgress(x.id, opts);
  const [open, setOpen] = useState(false);
  if (!p) return null;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const who = x.by ? getTeacher(x.by)?.name : null, line = x.lineId && getSchoolLines().find((l) => l.id === x.lineId);
  const remind = () => { try { const snap = snapshot(); const n = remindSchoolEvent(x.id, by); toast?.(`Reminder sent to ${plural(n, 'student')}.`, snap); } catch (e) { toast?.(e.message); } };
  const remove = () => { if (!confirm(`Remove “${x.title}”? Moments students added from it stay on their maps.`)) return; const snap = snapshot(); removeSchoolEvent(x.id, by); toast?.('Event removed.', snap); };
  return (
    <article className="se-row" aria-labelledby={`se-${x.id}`}>
      <header>
        {x.photo && <img src={x.photo} alt="" />}
        <div className="se-row-t">
          <b id={`se-${x.id}`}>{x.title}</b>
          <small>{`${span(x)} · ${forText(x.for)}${line ? ` · on ${line.name}` : ''}${x.question ? ` · asks: “${x.question}”` : ''}${who ? ` · added by ${who}` : ''}`}</small>
        </div>
        <span className="se-n"><b>{`${p.added} of ${p.total}`}</b><small>{opts.whole ? 'added something' : 'of your students added something'}</small></span>
      </header>
      {p.ended ? <>
        <ul className="se-groups">{p.homerooms.map((g) => (
          <li key={g.homeroom}>
            <span className="se-hr">{g.homeroom}</span>
            <span className="se-bar" role="img" aria-label={`${g.homeroom}: ${g.added} of ${g.total} added something`}><i style={{ width: `${pct(g.added, g.total)}%` }} /></span>
            <span className="se-hn">{`${g.added} of ${g.total}`}</span>
          </li>
        ))}</ul>
        <div className="se-acts">
          <button className="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide names' : 'Show names'}</button>
          {manager && (x.reminded ? <span className="fineprint">{`Reminder sent ${fmtDate(x.reminded.date)} to ${plural(x.reminded.n, 'student')}`}</span>
            : <button className="ghost" disabled={p.added === p.total} onClick={remind}>Send one reminder</button>)}
          {!manager && x.reminded && <span className="fineprint">{`Reminder sent ${fmtDate(x.reminded.date)}`}</span>}
          {manager && <><button className="ghost" onClick={onEdit}>Edit</button><button className="ghost" onClick={remove}>Remove</button></>}
        </div>
        {open && <div className="se-names">{p.homerooms.map((g) => (
          <div key={g.homeroom}><h3>{g.homeroom}</h3><ul>{g.students.map((s) => <li key={s.id} className={s.added ? 'yes' : ''}>{s.name}<small>{s.added ? 'Added something' : s.dismissed ? 'Said not for me' : 'Not yet'}</small></li>)}</ul></div>
        ))}</div>}
      </> : <div className="se-acts"><span className="fineprint">{x.start > TODAY ? `Students see it under Coming up. Their cards appear the day after it ends.` : 'On now. Cards appear tomorrow morning for those it was for.'}</span>
        {manager && <><button className="ghost" onClick={onEdit}>Edit</button><button className="ghost" onClick={remove}>Remove</button></>}</div>}
    </article>
  );
}

function EventDialog({ x, by, toast, onClose }) {
  const lines = getSchoolLines();
  const classes = useMemo(() => getClasses().slice().sort((a, b) => a.name.localeCompare(b.name)), []);
  const rooms = useMemo(() => homeroomsOf(), []);
  const [f, setF] = useState(() => ({ title: x?.title || '', start: x?.start || '', end: x?.end || '', kind: x?.for.kind || 'school', years: x?.for.years || [], homerooms: x?.for.homerooms || [], classIds: x?.for.classIds || [], lineId: x?.lineId || '', photo: x?.photo || null, question: x?.question || '' }));
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);
  const up = useUpload();
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const tog = (k, v) => set({ [k]: f[k].includes(v) ? f[k].filter((y) => y !== v) : [...f[k], v] });
  const forSpec = { kind: f.kind, years: f.years, homerooms: f.homerooms, classIds: f.classIds };
  const n = useMemo(() => schoolEventStudents(forSpec).length, [f.kind, f.years, f.homerooms, f.classIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    try {
      const snap = snapshot(), fields = { title: f.title, start: f.start, end: f.end || f.start, for: forSpec, lineId: f.lineId || null, photo: f.photo, question: f.question };
      if (x) { editSchoolEvent(x.id, fields, by); toast?.('Event saved.', snap); } else { addSchoolEvent(fields, by); toast?.(`Added “${f.title.trim()}” for ${plural(n, 'student')}.`, snap); }
      onClose();
    } catch (e) { setErr(e.message); }
  };
  const pick = (e) => { const file = e.target.files?.[0]; e.target.value = ''; up.run(file, (r) => set({ photo: evidenceFor(r, file.name).url })); };
  const found = q.trim() ? classes.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30) : [];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal se-set" role="dialog" aria-label={x ? `Edit ${x.title}` : 'Add a school event'} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">{x ? 'Edit the event' : 'Add a school event'}</div>
        <label>Name<input autoFocus value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Sports day" /></label>
        <div className="se-two">
          <label>First day<input type="date" value={f.start} onChange={(e) => set({ start: e.target.value, end: f.end && f.end < e.target.value ? e.target.value : f.end })} /></label>
          <label>Last day <small>leave empty for one day</small><input type="date" value={f.end} min={f.start || undefined} onChange={(e) => set({ end: e.target.value })} /></label>
        </div>
        <fieldset className="se-for">
          <legend>Who it is for</legend>
          <div className="se-kinds">{Object.entries(SE_KINDS).map(([k, l]) => <label key={k} className="se-radio"><input type="radio" name="se-kind" checked={f.kind === k} onChange={() => set({ kind: k })} />{l}</label>)}</div>
          {f.kind === 'years' && <div className="se-chips" role="group" aria-label="Years">{[7, 8, 9, 10, 11, 12, 13].map((y) => <label key={y} className="se-chip"><input type="checkbox" checked={f.years.includes(y)} onChange={() => tog('years', y)} />{`Year ${y}`}</label>)}</div>}
          {f.kind === 'homerooms' && <div className="se-chips scroll" role="group" aria-label="Homerooms">{rooms.map((h) => <label key={h} className="se-chip"><input type="checkbox" checked={f.homerooms.includes(h)} onChange={() => tog('homerooms', h)} />{h}</label>)}</div>}
          {f.kind === 'classes' && <div className="se-classes">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a class by name" aria-label="Find a class by name" />
            {f.classIds.length > 0 && <div className="se-chips">{f.classIds.map((id) => <button type="button" key={id} className="se-chip on" onClick={() => tog('classIds', id)} aria-label={`Remove ${classes.find((c) => c.id === id)?.name || id}`}>{`${classes.find((c) => c.id === id)?.name || id} ×`}</button>)}</div>}
            {found.length > 0 && <ul className="se-found">{found.map((c) => <li key={c.id}><label><input type="checkbox" checked={f.classIds.includes(c.id)} onChange={() => tog('classIds', c.id)} />{c.name}</label></li>)}</ul>}
          </div>}
          <p className="fineprint" role="status">{`${plural(n, 'student')}`}</p>
        </fieldset>
        <label>Suggested line <small>where the moment goes on their map</small><select value={f.lineId} onChange={(e) => set({ lineId: e.target.value })}><option value="">No line (they choose)</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>A question to answer <small>optional</small><input value={f.question} maxLength={200} onChange={(e) => set({ question: e.target.value })} placeholder="e.g. What was the best part of your day?" /></label>
        <div className="se-photo">
          {f.photo ? <><img src={f.photo} alt="The event’s photo" /><button type="button" className="ghost" onClick={() => set({ photo: null })}>Remove photo</button></>
            : !up.busy && <label className="ghost se-photo-btn">Add a photo <small>optional</small><input type="file" accept="image/*" onChange={pick} /></label>}
          {up.busy && <span role="status">Uploading…</span>}
          <UploadStatus up={up} />
        </div>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{`${plural(n, 'student')} will get a card after it`}</span><button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={f.title.trim().length < 3 || !f.start || !n || up.busy} onClick={save}>{x ? 'Save' : 'Add the event'}</button></div>
      </div>
    </div>
  );
}

function ImportDialog({ by, toast, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState(null);
  const read = async (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setErr(null); setParsed(parseEventsCsv(await file.text())); };
  const go = () => { try { const snap = snapshot(); const out = importSchoolEvents(parsed.rows, by); toast?.(`Imported ${plural(out.length, 'event')}.`, snap); onClose(); } catch (e2) { setErr(e2.message); } };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal se-set" role="dialog" aria-label="Import school events" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Import school events</div>
        <p className="fineprint">A CSV with a first row of column names: <code>title,start,end,years,line</code>. Dates as 2026-11-20 or 20/11/2026; end empty for one day. Years like 8, 7-9 or 8;9, empty for the whole school. line: a school line’s name, or empty.</p>
        <label className="ghost se-photo-btn">Choose a CSV file<input type="file" accept=".csv,text/csv" onChange={read} /></label>
        {parsed && <>
          {parsed.errors.length > 0 && <div className="se-errs" role="alert"><b>{`${plural(parsed.errors.length, 'row')} to fix first`}</b><ul>{parsed.errors.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {parsed.rows.length > 0 && <table className="se-preview"><caption>{plural(parsed.rows.length, 'event')}</caption><thead><tr><th scope="col">Name</th><th scope="col">When</th><th scope="col">For</th></tr></thead>
            <tbody>{parsed.rows.map((r, i) => <tr key={i}><td>{r.title}</td><td>{span(r)}</td><td>{forText({ years: [], homerooms: [], classIds: [], ...r.for })}</td></tr>)}</tbody></table>}
        </>}
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span /><button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!parsed?.rows.length || parsed.errors.length > 0} onClick={go}>{parsed?.rows.length ? `Import ${plural(parsed.rows.length, 'event')}` : 'Import'}</button></div>
      </div>
    </div>
  );
}
