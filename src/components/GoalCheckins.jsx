import { useMemo, useRef, useState } from 'react';
import { CHECKIN_SNOOZE_DAYS, CHECKIN_STATUS, ENCOURAGE_LINES, checkInGoal, checkinsDue, getTeacher, goalCheckins, sendEncouragement, shortName, snapshot, snoozeCheckins, stuckFlags } from '../api.js';
import { fmtDate } from '../format.js';
import { isPilot } from '../auth.js';
import { MicButton, Said, SayIt } from './Voice.jsx';
import './goal-checkins.css';
import PhraseTools, { phraseBox } from './Phrases.jsx';

// Weekly goal check-ins (api.checkInGoal): once a week, "How is your goal going?" for each open goal. Simple: one card per
// goal and one question per screen. Standard and Full: a compact card. Pilot only. No streaks, no scores.
const CHOICES = [['well', '↑'], ['stuck', '…'], ['none', '○']];
const SNOOZE = `Ask me again in ${CHECKIN_SNOOZE_DAYS / 7} weeks`;

export function GoalCheckins({ studentId, simple, toast, version }) {
  const due = useMemo(() => (isPilot() ? checkinsDue(studentId) : []), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  if (!due.length) return null;
  const saved = (e, status) => { setOpen(null); toast(status === 'stuck' ? `Thanks. Being stuck is normal. Your advisor can see “${e.title}” and can help.` : `Saved your check-in on “${e.title}”.`); };
  const snoozed = (e) => { setOpen(null); snoozeCheckins(e.id); toast(`No more check-ins on “${e.title}” for ${CHECKIN_SNOOZE_DAYS / 7} weeks.`); };
  if (simple) return (
    <section className="gc-simple" aria-label="Goal check-ins">
      {due.map((e) => (
        <button key={e.id} className="gc-big" onClick={() => setOpen(e)}>
          <span className="gc-ic" aria-hidden="true">✓</span>
          <span><b>How is your goal going?</b><small>“{e.title}”</small></span>
        </button>
      ))}
      {open && <CheckinFlow e={open} onClose={() => setOpen(null)} onSaved={saved} onSnooze={snoozed} />}
    </section>
  );
  return (
    <section className="gc-list" aria-label="Goal check-ins">
      {due.map((e) => <CompactCheckin key={e.id} e={e} onSaved={saved} onSnooze={snoozed} />)}
    </section>
  );
}

// Simple: what, then a sentence, then one next step. Each can be skipped but the first.
function CheckinFlow({ e, onClose, onSaved, onSnooze }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ status: null, note: '', next: '' });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = () => { checkInGoal(e.id, f); onSaved(e, f.status); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow gc-flow" role="dialog" aria-modal="true" aria-label={`Check in on ${e.title}`} onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <p className="gc-goal">{e.title}</p>
        {step === 0 && <>
          <Said text="How is your goal going?" />
          <div className="gc-choices big">{CHOICES.map(([k, ic]) => (
            <button key={k} className={`gc-ch c-${k}`} onClick={() => { set({ status: k }); setStep(1); }}><span aria-hidden="true">{ic}</span>{CHECKIN_STATUS[k]}</button>
          ))}</div>
          <div className="sh-next"><button className="ghost" onClick={() => onSnooze(e)}>{SNOOZE}</button></div>
        </>}
        {step === 1 && <>
          <Said text="Want to say a bit more?" />
          <textarea className="sh-input" rows={2} maxLength={300} autoFocus value={f.note} onChange={(ev) => set({ note: ev.target.value })} aria-label="Want to say a bit more?" placeholder={f.status === 'stuck' ? 'e.g. I don’t know where to start' : 'One sentence, if you like'} />
          <SayIt value={f.note} onChange={(note) => set({ note })} />
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button><button className="primary" onClick={() => setStep(2)}>{f.note.trim() ? 'Next' : 'Skip'}</button></div>
        </>}
        {step === 2 && <>
          <Said text="What’s one next step?" />
          <input className="sh-input" maxLength={200} autoFocus value={f.next} onChange={(ev) => set({ next: ev.target.value })} aria-label="What’s one next step?" placeholder="e.g. Ask my coach about a plan" onKeyDown={(ev) => ev.key === 'Enter' && save()} />
          <SayIt value={f.next} onChange={(next) => set({ next })} />
          <div className="sh-next"><button className="ghost" onClick={() => setStep(1)}>Back</button><button className="primary" onClick={save}>Done</button></div>
          <p className="sh-note">Your advisor and teachers can see your check-ins.</p>
        </>}
      </div>
    </div>
  );
}

function CompactCheckin({ e, onSaved, onSnooze }) {
  const [f, setF] = useState({ status: null, note: '', next: '' });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const id = `gc-${e.id}`;
  return (
    <div className="gc-card">
      <div className="gc-top"><b id={`${id}-q`}>How is “{e.title}” going?</b><small>By {fmtDate(e.date)}</small></div>
      <div className="gc-choices" role="group" aria-labelledby={`${id}-q`}>{CHOICES.map(([k, ic]) => (
        <button key={k} className={`gc-ch c-${k}${f.status === k ? ' on' : ''}`} aria-pressed={f.status === k} onClick={() => set({ status: k })}><span aria-hidden="true">{ic}</span>{CHECKIN_STATUS[k]}</button>
      ))}</div>
      {f.status && <div className="gc-fields">
        <label htmlFor={`${id}-n`}>A sentence about it <small>(optional)</small></label>
        <div className="gc-row"><input id={`${id}-n`} maxLength={300} value={f.note} onChange={(ev) => set({ note: ev.target.value })} /><MicButton value={f.note} onChange={(note) => set({ note })} /></div>
        <label htmlFor={`${id}-x`}>What’s one next step?</label>
        <div className="gc-row"><input id={`${id}-x`} maxLength={200} value={f.next} onChange={(ev) => set({ next: ev.target.value })} /><MicButton value={f.next} onChange={(next) => set({ next })} /></div>
      </div>}
      <div className="gc-foot">
        <small className="fineprint">Your advisor and teachers can see your check-ins.</small>
        <button className="ghost" onClick={() => onSnooze(e)}>{SNOOZE}</button>
        <button className="primary" disabled={!f.status} onClick={() => { checkInGoal(e.id, f); onSaved(e, f.status); }}>Save</button>
      </div>
    </div>
  );
}

// On the goal's station panel (and the Simple goal card): check-ins and encouragement, newest first.
export function CheckinTimeline({ event, me = 'student', limit = 6 }) {
  const items = [...goalCheckins(event).map((c) => ({ ...c, k: 'c' })), ...(event.encouragements || []).map((n) => ({ ...n, k: 'e' }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (!items.length && !event.checkinSnooze) return null;
  return (
    <section className="gc-time" aria-label="Check-ins">
      <h3>Check-ins</h3>
      {items.length > 0 && <ol>{items.map((x) => (x.k === 'c'
        ? <li key={x.id} className={`gc-i c-${x.status}`}><small>{fmtDate(x.date)}</small><span><em className="gc-st">{CHECKIN_STATUS[x.status]}</em>{x.note && <> {x.note}</>}{x.next && <span className="gc-next">Next step: {x.next}</span>}</span></li>
        : <li key={x.id} className="gc-i enc"><small>{fmtDate(x.at.slice(0, 10))}</small><span><b>{shortName(getTeacher(x.by)?.name || 'A teacher')}</b>{me === x.by ? ' (you)' : ''}: {[x.line, x.text].filter(Boolean).join(' ')}</span></li>))}</ol>}
      {event.checkinSnooze && <p className="fineprint">{me === 'student' ? 'No check-ins' : 'Check-ins paused'} until {fmtDate(event.checkinSnooze)}.</p>}
    </section>
  );
}

// For an advisor or a goal's sponsor (My advisory, This week): a goal stuck twice in a row, and kind words to send.
export function StuckFlags({ teacherId, toast, version, onOpen }) {
  const flags = useMemo(() => (isPilot() && teacherId ? stuckFlags(teacherId) : []), [teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  if (!flags.length) return null;
  return (
    <section className="card-sec gc-flags" aria-labelledby="gc-flags-h">
      <h2 id="gc-flags-h">Stuck on a goal</h2>
      <small className="fineprint">Said “Stuck” at their last two weekly check-ins.</small>
      <ul>{flags.map(({ event: e, student: s, last, sent }) => {
        const first = s?.name.split(' ')[0];
        return (
          <li key={e.id}>
            <span className="gc-who">
              <b>{onOpen ? <button className="linkish" onClick={() => onOpen(`${s.id}~${e.id}`)}>{first} is stuck on “{e.title}”</button> : <>{first} is stuck on “{e.title}”</>}</b>
              <small>{fmtDate(last.date)}{last.note ? ` · “${last.note}”` : ''}{last.next ? ` · Next step: ${last.next}` : ''}</small>
            </span>
            {sent ? <span className="nd-sent">Encouragement sent</span> : open !== e.id && <button className="ghost" onClick={() => setOpen(e.id)}>Send encouragement</button>}
            {open === e.id && <Encourage e={e} first={first} teacherId={teacherId} onDone={(ok) => { setOpen(null); if (ok) toast(`Sent to ${first}. They see it in their notifications.`, ok); }} />}
          </li>
        );
      })}</ul>
    </section>
  );
}

function Encourage({ e, first, teacherId, onDone }) {
  const [line, setLine] = useState(ENCOURAGE_LINES[0]);
  const [text, setText] = useState('');
  const box = useRef(null);
  const id = `gc-enc-${e.id}`;
  return (
    <div className="gc-enc">
      <fieldset>
        <legend>A message to {first}</legend>
        {ENCOURAGE_LINES.map((l) => <label key={l} className="gc-line"><input type="radio" name={id} checked={line === l} onChange={() => setLine(l)} />{l}</label>)}
      </fieldset>
      <label htmlFor={`${id}-t`}>Add a sentence <small>(optional)</small></label>
      <input id={`${id}-t`} maxLength={300} value={text} onChange={(ev) => setText(ev.target.value)} {...phraseBox(box)} />
      <PhraseTools value={text} onChange={setText} first={first} kind="praise" box={box} />
      <div className="nd-edit-foot"><small className="fineprint">In the app only. No email.</small>
        <button className="ghost" onClick={() => onDone(null)}>Cancel</button>
        <button className="primary" onClick={() => { const snap = snapshot(); sendEncouragement(e.id, teacherId, line, text); onDone(snap); }}>Send</button></div>
    </div>
  );
}
