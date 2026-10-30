// Kind feedback from classmates (api.givePeerFeedback): pilot only, Year 9 and up. A student opts a school-visible moment
// in from the station panel; classmates in their classes see it under "From your classes" on their home and pick one or
// two set phrases to finish. The owner reads it with the classmate's first name, says thank you, hides or reports it.
// The class's teachers and the advisors read all of it (station panel, class page). Families never get it.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEvent, getReports, getStudent, givePeerFeedback, hasPublicCopy, hidePeerFeedback, PEER_DAY_LIMIT, PEER_MIN_GRADE, PEER_NOTE_MAX, PEER_PHRASES, peerEligible, peerFeedbackOn, peerGivenBy, peerGivenToday, peerMomentsFor, peerQualifies, peerText, peerYearOff, REPORT_REASONS, reportItem, setPeerFeedback, setPeerFeedbackYear, snapshot, thankPeerFeedback, getClasses, getStore } from '../api.js';
import { isPilot } from '../auth.js';
import { personaById } from '../personas.js';
import { fmtDate } from '../format.js';
import './peer-feedback.css';
import './safeguarding.css';

const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
const viewer = () => personaById(location.hash.replace(/^#\/?/, '').split('/')[0]);
const off = () => !isPilot() || hasPublicCopy() || /^#\/?(s|v|p|preview)\//.test(location.hash);
const className = (id) => getClasses().find((c) => c.id === id)?.name || '';
const run = (toast, fn, msg, snap) => { try { fn(); if (msg) toast?.(msg, snap); return true; } catch (e) { toast?.(e.message || 'That did not work.'); return false; } };

// ── A classmate's home: "From your classes" ──
export function PeerFromClasses({ studentId, simple = false, toast, version }) {
  const list = useMemo(() => (off() ? [] : peerMomentsFor(studentId)), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [all, setAll] = useState(false);
  const [giving, setGiving] = useState(null);
  if (!list.length) return null;
  const given = peerGivenBy(studentId), left = PEER_DAY_LIMIT - peerGivenToday(studentId);
  const shown = all ? list : list.slice(0, simple ? 2 : 3);
  return (
    <section className={`pf-classes${simple ? ' big' : ''}`} aria-labelledby="pf-h">
      <div className="pf-head"><h2 id="pf-h">From your classes</h2><small>Classmates asked for kind feedback on these moments.</small></div>
      <ul>{shown.map((m) => {
        const mine = given.filter((f) => f.eventId === m.eventId);
        return (
          <li key={m.eventId} className="pf-moment">
            {m.image ? <img src={m.image} alt="" /> : <span className="pf-ph" aria-hidden="true">★</span>}
            <span className="pf-what"><b>{m.title}</b><small>{m.name} · {m.className}</small>
              {mine.map((f) => <span key={f.id} className="pf-mine">You said: {f.parts.map(peerText).join(' ')}{f.thanked && <em> · {m.name} said thank you</em>}</span>)}</span>
            <button className={mine.length ? 'ghost' : 'primary'} disabled={left <= 0} onClick={() => setGiving(m)}>{mine.length ? 'Give more' : 'Give kind feedback'}</button>
          </li>
        );
      })}</ul>
      {list.length > shown.length && <button className="linkish" onClick={() => setAll(true)}>Show all {list.length}</button>}
      {left <= 0 && <p className="fineprint">You have given {PEER_DAY_LIMIT} pieces of feedback today. You can give more tomorrow.</p>}
      {giving && createPortal(<GiveDialog m={giving} studentId={studentId} simple={simple} toast={toast} onClose={() => setGiving(null)} />, document.body)}
    </section>
  );
}

function GiveDialog({ m, studentId, simple, toast, onClose }) {
  const [parts, setParts] = useState([]); // [{ phrase, text }]
  const [err, setErr] = useState(null);
  const used = parts.reduce((n, p) => n + p.text.trim().length, 0);
  const flip = (k) => setParts((x) => (x.some((p) => p.phrase === k) ? x.filter((p) => p.phrase !== k) : x.length < 2 ? [...x, { phrase: k, text: '' }] : x));
  const write = (k, text) => setParts((x) => x.map((p) => (p.phrase === k ? { ...p, text } : p)));
  const ready = parts.length && parts.every((p) => p.text.trim()) && used <= PEER_NOTE_MAX;
  const send = () => {
    setErr(null);
    try { givePeerFeedback(m.eventId, studentId, parts); toast?.(`Sent to ${m.name}.`); onClose(); } catch (e) { setErr(e.message || 'That did not work.'); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal pf-dialog${simple ? ' big' : ''}`} role="dialog" aria-label={`Kind feedback for ${m.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Kind feedback for {m.name}</div>
        <h2>{m.title}</h2>
        {m.image && <img className="pf-big" src={m.image} alt="" />}
        <p className="fineprint">Pick one or two, and finish the sentence. {m.name} sees your first name. Your teachers can read it too.</p>
        <div className="pf-phrases" role="group" aria-label="Pick one or two">
          {Object.entries(PEER_PHRASES).map(([k, l]) => { const on = parts.some((p) => p.phrase === k); return <button key={k} aria-pressed={on} className={on ? 'on' : ''} disabled={!on && parts.length >= 2} onClick={() => flip(k)}>{l}</button>; })}
        </div>
        {parts.map((p) => (
          <label key={p.phrase} className="pf-finish">{PEER_PHRASES[p.phrase]}
            <input autoFocus value={p.text} maxLength={PEER_NOTE_MAX} onChange={(e) => write(p.phrase, e.target.value)} aria-label={`Finish: ${PEER_PHRASES[p.phrase]}`} />
          </label>
        ))}
        {parts.length > 0 && <small className={`pf-count${used > PEER_NOTE_MAX ? ' over' : ''}`}>{used} of {PEER_NOTE_MAX} characters</small>}
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>Be kind and helpful.</span><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!ready} onClick={send}>Send</button></div>
      </div>
    </div>
  );
}

// ── On a moment (station panel, Simple moment card): the owner's switch and feedback, or what staff read ──
export function PeerOnMoment({ event: shown, simple = false, toast }) {
  const [, bump] = useState(0);
  const event = shown && (getEvent(shown.id) || shown);
  if (!event || event.type === 'goal' || off()) return null;
  const p = viewer();
  const owner = p.kind === 'student' && p.studentId === event.studentId;
  const staff = STAFF.includes(p.kind) || p.kind === 'admin' || !!p.admin;
  if (!owner && !staff) return null;
  const list = peerFeedbackOn(event.id).filter((f) => staff || !f.hidden);
  if (owner) {
    if (!peerEligible(event.studentId) && !list.length) return null;
    const ok = peerQualifies(event);
    const flip = (on) => run(toast, () => setPeerFeedback(event.id, on), on ? 'Classmates in your classes can now give kind feedback on this.' : 'Classmates can no longer give feedback on this.');
    return (
      <section className={`pf-on${simple ? ' big' : ''}`} aria-label="Kind feedback from classmates">
        <h3>Kind feedback from classmates</h3>
        {peerEligible(event.studentId) && <label className="pf-switch"><input type="checkbox" checked={!!event.peerFeedback && ok} disabled={!ok && !event.peerFeedback} onChange={(e) => { flip(e.target.checked); bump((n) => n + 1); }} />
          <span>Let classmates in my classes give kind feedback</span></label>}
        {!ok && <p className="fineprint">Only for moments the school can see. Change who can see it first.</p>}
        <FeedbackList list={list} owner toast={toast} onChange={() => bump((n) => n + 1)} />
      </section>
    );
  }
  if (!list.length) return null;
  return (
    <section className="pf-on" aria-label="Kind feedback from classmates">
      <h3>Kind feedback from classmates</h3>
      <FeedbackList list={list} toast={toast} reporter={p.teacherId ? { key: p.teacherId } : p.kind === 'admin' || p.admin ? { key: 'admin', name: p.name } : null} />
    </section>
  );
}

function FeedbackList({ list, owner = false, reporter, toast, onChange }) {
  const [reporting, setReporting] = useState(null);
  if (!list.length) return owner ? <p className="fineprint">No feedback yet.</p> : null;
  const from = owner ? { key: 'student' } : reporter;
  return (
    <ul className="pf-list">
      {list.map((f) => {
        const reported = from && getReports().some((r) => r.feedbackId === f.id && r.from?.key === from.key && r.status === 'open');
        const who = owner ? f.fromName : `${getStudent(f.fromId)?.name || f.fromName}${f.classId ? ` · ${className(f.classId)}` : ''}`;
        return (
          <li key={f.id}>
            <div className="pf-who"><b>{who}</b><small>{fmtDate(f.at.slice(0, 10))}{!owner && f.thanked ? ' · thanked' : ''}</small></div>
            {f.parts.map((x) => <p key={x.phrase}>{peerText(x)}</p>)}
            {f.hidden && <p className="sg-hidden small" role="status">Hidden by {f.hidden.by === 'student' ? getStudent(f.studentId)?.name.split(' ')[0] || 'the student' : f.hidden.by}.</p>}
            <div className="pf-acts">
              {owner && (f.thanked ? <span className="pf-thanked">You said thank you</span> : <button className="ghost small-btn" onClick={() => { run(toast, () => thankPeerFeedback(f.id), `${f.fromName} will see your thank you.`); onChange?.(); }}>Say thank you</button>)}
              {owner && <button className="linkish" onClick={() => { const snap = snapshot(); run(toast, () => hidePeerFeedback(f.id), 'Hidden. Only your teachers can see it now.', snap); onChange?.(); }}>Hide</button>}
              {from && !f.hidden && (reported ? <span className="sg-sent">Reported. A teacher will look at it.</span> : <button className="linkish sg-report" onClick={() => setReporting(f)}>Report</button>)}
            </div>
          </li>
        );
      })}
      {reporting && createPortal(<PeerReport f={reporting} from={from} onClose={() => setReporting(null)} onSent={() => { setReporting(null); toast?.('Thank you. A teacher will look at it.'); onChange?.(); }} />, document.body)}
    </ul>
  );
}

function PeerReport({ f, from, onClose, onSent }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const send = () => { setErr(null); try { reportItem({ feedbackId: f.id }, reason, note, from); onSent(); } catch (x) { setErr(x.message || 'That did not work.'); } };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sg-dialog" role="dialog" aria-label="Report this feedback" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <h2>Report this feedback</h2>
        <p className="fineprint">“{f.parts.map(peerText).join(' ')}”. A teacher who looks after safety will see it.</p>
        <div className="sg-reasons" role="radiogroup" aria-label="What is wrong">
          {Object.entries(REPORT_REASONS).map(([k, l]) => <button key={k} role="radio" aria-checked={reason === k} className={reason === k ? 'on' : ''} onClick={() => setReason(k)}>{l}</button>)}
        </div>
        <label className="fb-label" htmlFor="pf-note">Anything else? (optional)</label>
        <textarea id="pf-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="sg-foot"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!reason} onClick={send}>Send report</button></div>
      </div>
    </div>
  );
}

// ── A teacher's class page: the feedback given in this class ──
export function PeerClassList({ classId, version }) {
  const list = useMemo(() => (getStore().peerFeedback || []).filter((f) => f.classId === classId).sort((a, b) => b.at.localeCompare(a.at)), [classId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isPilot() || !list.length) return null;
  return (
    <section className="spot-list pf-class" aria-label="Kind feedback in this class">
      <h2>Kind feedback in this class</h2>
      <ul>{list.map((f) => (
        <li key={f.id}>
          <span><b>{getStudent(f.fromId)?.name || f.fromName} → {getStudent(f.studentId)?.name || 'a classmate'}</b><small>{f.parts.map(peerText).join(' ')}</small></span>
          <span className="spot-st">{f.hidden ? 'Hidden' : f.thanked ? 'Thanked' : fmtDate(f.at.slice(0, 10))}</span>
        </li>
      ))}</ul>
    </section>
  );
}

// ── School overview: coordinators turn it off or on for a Year ──
export function PeerYears({ persona, toast, version }) {
  const years = [PEER_MIN_GRADE + 1, 10, 11, 12, 13];
  const n = useMemo(() => (getStore().peerFeedback || []).length, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isPilot()) return null;
  const flip = (y, on) => { const snap = snapshot(); run(toast, () => setPeerFeedbackYear(y, on, persona?.teacherId || null), `Kind feedback is ${on ? 'on' : 'off'} for Year ${y}`, snap); };
  return (
    <section className="card-sec pf-years" aria-labelledby="pf-years-h">
      <h2 id="pf-years-h">Kind feedback from classmates</h2>
      <small className="fineprint">Pilot, Year {PEER_MIN_GRADE + 1} and up. Students choose which moments classmates may give feedback on; set phrases only. Turning a Year off hides it for everyone in that Year at once.{n ? ` ${n} pieces given so far.` : ''}</small>
      <div className="pf-yrs">{years.map((y) => <label key={y} className="pf-switch"><input type="checkbox" checked={!peerYearOff(y)} onChange={(e) => flip(y, e.target.checked)} /><span>Year {y}</span></label>)}</div>
    </section>
  );
}
