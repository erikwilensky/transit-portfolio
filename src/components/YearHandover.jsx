// Year handover: the outgoing advisor's handover notes, "New to you" and "Last year" for the new advisor, the student's
// "Carry over or close" for last year's goals, and the Start of year step in Accounts (docs/pilot-server.md).
import { useMemo, useState } from 'react';
import { carryDate, carryOverGoal, closeGoal, getStudents, getHandoverNote, getLine, getStore, goalsToReview, HANDOVER_PROMPT, lastYearOf, newToAdvisor, setHandoverNote, shortName, snapshot } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import './year-handover.css';
import { MovingUpCount, MovingUpForStaff } from './MovingUp.jsx';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const Avatar = ({ s }) => <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials || '?'}</span>;

// My advisory › Write handover notes: one note per advisee for next year's advisor. Staff only.
export function HandoverNotes({ advisorId, version, toast, onClose }) {
  const cohort = useMemo(() => getStudents().filter((s) => s.advisorId === advisorId).sort((a, b) => a.name.localeCompare(b.name)), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const gone = getStore().handedOver || [];
  const done = cohort.filter((s) => getHandoverNote(s.id, advisorId)).length;
  return (
    <section className="card-sec yh-notes" aria-labelledby="yh-notes-h">
      <div className="yh-head">
        <div><h2 id="yh-notes-h">Write handover notes</h2>
          <p className="fineprint">For the advisor who has your students next year. Only staff read these: never the student or their family. {done} of {cohort.length} written.</p><MovingUpCount advisorId={advisorId} version={version} /></div>
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
      <div className="yh-prompt"><b>A few lines each:</b><ul>{HANDOVER_PROMPT.map((p) => <li key={p}>{p}</li>)}</ul></div>
      <ul className="yh-list">{cohort.map((s) => <li key={s.id}><NoteRow s={s} advisorId={advisorId} toast={toast} /></li>)}</ul>
      {gone.length > 0 && <>
        <h3 className="yh-sub">Students you handed over</h3>
        <p className="fineprint">They have a new advisor now. You can still write or finish their note.</p>
        <ul className="yh-list">{gone.map((h) => <li key={h.studentId}><NoteRow s={{ id: h.studentId, name: h.name, grade: h.grade, avatar: null }} sub={`now with ${h.to}`} advisorId={advisorId} toast={toast} /></li>)}</ul>
      </>}
    </section>
  );
}

function NoteRow({ s, sub, advisorId, toast }) {
  const saved = getHandoverNote(s.id, advisorId);
  const [text, setText] = useState(saved?.text || '');
  const [open, setOpen] = useState(false);
  const save = () => { try { setHandoverNote(s.id, text, advisorId); setOpen(false); toast(text.trim() ? `Handover note saved for ${s.name.split(' ')[0]}` : 'Handover note removed'); } catch (x) { toast(x.message); } };
  return (
    <div className={`yh-row${saved ? ' done' : ''}`}>
      <div className="yh-who"><Avatar s={s} /><span><b>{s.name}</b><small>Year {s.grade + 1}{sub ? ` · ${sub}` : ''}{saved ? ` · written ${fmtDate(saved.at.slice(0, 10))}` : ''}</small></span>
        {!open && <button className="ghost" onClick={() => { setText(saved?.text || ''); setOpen(true); }}>{saved ? 'Edit note' : 'Write note'}</button>}</div>
      {!open && saved && <p className="yh-text">{saved.text}</p>}
      {open && <div className="yh-edit">
        <label className="sr-only" htmlFor={`yh-${s.id}`}>Handover note for {s.name}</label>
        <textarea id={`yh-${s.id}`} rows={4} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Strengths: …\nWhat helps: …\nWhat to watch: …'} />
        <div className="yh-foot"><button className="ghost" onClick={() => setOpen(false)}>Cancel</button><button className="primary" onClick={save} disabled={!text.trim() && !saved}>Save note</button></div>
      </div>}
    </div>
  );
}

// My advisory: the students handed over to this advisor at the last import.
export function NewToYou({ advisorId, version, onOpen }) {
  const kids = useMemo(() => newToAdvisor(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!kids.length) return null;
  return (
    <section className="yh-banner" aria-labelledby="yh-new-h">
      <h2 id="yh-new-h">New to you: {plural(kids.length, 'student')}</h2>
      <p>Their whole journey came with them. Open a student to see last year: their previous advisor, the handover note and what they did.</p>
      <ul>{kids.map((s) => <li key={s.id}><button className="linkish" onClick={() => onOpen(s.id)}>{s.name}</button></li>)}</ul>
    </section>
  );
}
export const isNewTo = (advisorId, studentId) => newToAdvisor(advisorId).some((s) => s.id === studentId);

// The advisor's student page: last year, from the handover.
export function LastYear({ studentId, version }) {
  const y = useMemo(() => lastYearOf(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!y) return null;
  const { handover: h, from, note, moments, byLine, carried } = y;
  return (
    <section className="card-sec yh-last" aria-labelledby="yh-last-h">
      <h3 id="yh-last-h">Last year{h.fromYear ? ` (${h.fromYear})` : ''}</h3>
      <p className="yh-from">Advisor: <b>{from?.name || 'not known'}</b><small> · handed over {fmtDate(h.date)}</small></p>
      <div className="yh-note">
        <small>Handover note · staff only</small>
        {note ? <p>{note.text}</p> : <p className="fineprint">{from ? `${shortName(from.name)} has not written one yet.` : 'No note.'}</p>}
      </div>
      <p className="yh-count"><b>{plural(moments, 'moment')}</b> last year</p>
      {byLine.length > 0 && <ul className="yh-lines">{byLine.map(({ line, n }) => <li key={line.id}><i style={{ background: line.colour }} />{line.name}<b>{n}</b></li>)}</ul>}
      {carried.length > 0 && <><p className="yh-count"><b>{plural(carried.length, 'goal')}</b> carried over</p>
        <ul className="yh-goals">{carried.map((e) => <li key={e.id}>{e.title}<small>{fmtDate(e.carriedOver.from)} → {fmtDate(e.date)}</small></li>)}</ul></>}
      <MovingUpForStaff studentId={studentId} version={version} inLastYear />
    </section>
  );
}

// The student's home at the start of a new year: last year's goals whose date has passed.
export function CarryOverGoals({ studentId, version, toast, simple }) {
  const goals = useMemo(() => goalsToReview(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!goals.length) return null;
  const carry = (e) => { const snap = snapshot(); const d = carryDate(e.date); carryOverGoal(e.id, d); toast(`“${e.title}” is now on for ${fmtDate(d)}`, snap); };
  const close = (e) => { const snap = snapshot(); closeGoal(e.id); toast(`Closed “${e.title}”`, snap); };
  return (
    <section className={`yh-carry${simple ? ' simple' : ''}`} aria-labelledby="yh-carry-h">
      <h2 id="yh-carry-h">A new year: carry over or close</h2>
      <p>{goals.length === 1 ? 'This goal' : 'These goals'} from last year {goals.length === 1 ? 'has' : 'have'} passed {goals.length === 1 ? 'its' : 'their'} date. Keep going with it this year, or close it.</p>
      <ul>{goals.map((e) => { const l = getLine(e.lineIds[0]); return (
        <li key={e.id} style={{ '--c': l?.colour || '#002855' }}>
          <span className="yh-g"><b>{e.title}</b><small>{l?.name ? `${l.name} · ` : ''}was for {fmtDate(e.date)}</small></span>
          <span className="yh-do"><button className="primary" onClick={() => carry(e)}>Carry over</button><button className="ghost" onClick={() => close(e)}>Close</button></span>
        </li>); })}</ul>
    </section>
  );
}

// Accounts › Start of year: what importing the new year's class lists does. preview: the dry run's `handover`.
export function StartOfYear({ preview }) {
  return (
    <div className="yh-start">
      <h3>What happens when you import the new year</h3>
      <ul>
        <li>Every student keeps their whole journey: moments, reflections, goals and presentations stay.</li>
        <li>A student with a new advisor appears as <b>New to you</b> on that advisor’s page, with a <b>Last year</b> panel: the previous advisor, their handover note, last year’s moments by line and the goals carried over.</li>
        <li>The previous advisor no longer sees students who are not theirs any more, unless they still teach them. New teachers see the journeys of the students in their classes.</li>
        <li>Class places not in the new file end and stay as history.</li>
        <li>Students see last year’s goals whose date has passed, to carry over or close.</li>
        <li>Before you import, ask advisors to write their handover notes on My advisory.</li>
      </ul>
      {preview && <p className="yh-start-n" role="status">
        {preview.newYear ? `From ${preview.fromYear} to ${preview.year}. ` : preview.year && preview.fromYear === preview.year ? `Same year as the last import (${preview.year}). ` : ''}
        <b>{plural(preview.changes, 'student')}</b> {preview.changes === 1 ? 'changes' : 'change'} advisor{preview.changes ? `; ${preview.notes} of them ${preview.notes === 1 ? 'has' : 'have'} a handover note` : ''}.
      </p>}
      {preview?.groups?.length > 0 && <ul className="yh-groups">{preview.groups.slice(0, 12).map((g) => <li key={`${g.from}|${g.to}`}>{g.from} → {g.to}<b>{g.n}</b></li>)}{preview.groups.length > 12 && <li>and {preview.groups.length - 12} more</li>}</ul>}
    </div>
  );
}
