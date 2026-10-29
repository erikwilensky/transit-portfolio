import { useMemo, useState } from 'react';
import { answerPrompt, askClass, classPrompts, getStudent, openPromptsFor, remindClass, skipPrompt, snapshot, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { evidenceFor } from '../upload.js';
import { UploadStatus, useUpload } from './FileAttach.jsx';
import './class-prompts.css';

// Class prompts (api.askClass, answerPrompt): a teacher asks a whole class one question; each student answers it
// from the top of their home. Teacher side: AskClassDialog and ClassQuestions (My classes). Student side: OpenPrompts.
const callName = (n = '') => { const m = /^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+(.+)$/i.exec(n.trim()); return m ? `${m[1]} ${m[2].split(/\s+/).pop()}` : n; };
const STARTERS = ['I learned that…', 'I was proud when…', 'It was hard when…', 'Next time I will…'];

// ── Teacher ──
export function AskClassDialog({ c, teacherId, onClose, toast }) {
  const [f, setF] = useState({ question: '', context: '', asMoment: !!c.line, due: '' });
  const [err, setErr] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const n = c.studentIds?.length ?? c.students?.length ?? 0;
  const send = () => {
    try {
      const snap = snapshot();
      askClass(c.id, teacherId, { question: f.question, context: f.context, asMoment: f.asMoment, due: f.due || null });
      toast?.(`Asked ${c.name}. ${n} student${n === 1 ? '' : 's'} will see it at the top of their home.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal cp-ask" role="dialog" aria-label={`Ask ${c.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Ask the class</div>
        <h2>{c.name}</h2>
        <label>The question<textarea rows={3} autoFocus value={f.question} maxLength={300} onChange={(e) => set({ question: e.target.value })} placeholder="e.g. What did you learn from the science fair?" /></label>
        <label>What it is about <small>optional, a few words</small><input value={f.context} maxLength={200} onChange={(e) => set({ context: e.target.value })} placeholder="e.g. Year 8 science fair" /></label>
        <label className="cp-check"><input type="checkbox" checked={f.asMoment} disabled={!c.line} onChange={(e) => set({ asMoment: e.target.checked })} />
          <span>{c.line ? <><span>Add it as a moment on <b>{c.line.name}</b></span><small>Each answer becomes a station on that line and comes to your Endorsements, ready to endorse.</small></>
            : <><span>Add it as a moment</span><small>This class is not on a line yet, so answers are kept as reflections.</small></>}</span></label>
        <label>Answer by <small>optional</small><input type="date" value={f.due} min={TODAY} onChange={(e) => set({ due: e.target.value })} /></label>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{n} student{n === 1 ? '' : 's'} will be asked</span><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={f.question.trim().length < 5 || !n} onClick={send}>Ask the class</button></div>
      </div>
    </div>
  );
}

export function ClassQuestions({ c, teacherId, go, persona, version, toast }) {
  const list = useMemo(() => classPrompts(c.id), [c.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  if (!list.length) return null;
  return (
    <section className="cp-list" aria-label="Questions to the class">
      <h2>Questions to the class</h2>
      {list.map((p) => {
        const m = p.studentIds.length, shown = open === p.id || list.length === 1;
        return (
          <article key={p.id} className="cp-item">
            <header>
              <div><b>{p.question}</b><small>{p.context ? `${p.context} · ` : ''}Asked {fmtDate(p.date)}{p.due ? ` · answer by ${fmtDate(p.due)}` : ''}{p.asMoment ? ' · answers come as moments to endorse' : ''}</small></div>
              <span className="cp-n"><b>{p.answers.length} of {m}</b><small>answered{p.skipped ? `, ${p.skipped} said not for them` : ''}</small></span>
            </header>
            <div className="cp-acts">
              {p.answers.length > 0 && list.length > 1 && <button className="ghost" aria-expanded={shown} onClick={() => setOpen(shown ? null : p.id)}>{shown ? 'Hide answers' : `Read ${p.answers.length} answer${p.answers.length === 1 ? '' : 's'}`}</button>}
              {p.waiting.length > 0 && <button className="ghost" disabled={p.reminded === TODAY} onClick={() => { const k = remindClass(p.id, teacherId); toast?.(k ? `Reminded ${k} student${k === 1 ? '' : 's'}.` : 'Nobody to remind.'); }}>{p.reminded === TODAY ? 'Reminded today' : `Remind the rest (${p.waiting.length})`}</button>}
              {p.asMoment && p.answers.length > 0 && <a className="ghost" href={`#/${persona.id}/queue`} onClick={(e) => { e.preventDefault(); go(persona.id, 'queue'); }}>Open Endorsements</a>}
              {p.answers.length > 0 && <a className="ghost ca-open" href={`#/${persona.id}/classes/${c.id}~answers~${p.id}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'classes', `${c.id}~answers~${p.id}`); }}>Review answers</a>}
            </div>
            {shown && p.answers.length > 0 && (
              <ul className="cp-answers">{p.answers.map((a) => <li key={a.id}><b>{getStudent(a.studentId)?.name || 'A student'}</b><small>{fmtDate(a.date)}</small><p>{a.text}</p></li>)}</ul>
            )}
          </article>
        );
      })}
    </section>
  );
}

// ── Student: open questions at the top of their home, at every level ──
export function OpenPrompts({ studentId, simple, toast, version }) {
  const list = useMemo(() => openPromptsFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [answering, setAnswering] = useState(null);
  const p = list[0];
  const whoOf = (x) => (x.teacher ? callName(x.teacher.name) : 'Your teacher');
  if (!p && !answering) return null;
  const who = p && whoOf(p);
  return (
    <>
      {p && <div className={`cp-open${simple ? ' big' : ''}`} role="region" aria-label="A question from your teacher">
        <button className="cp-card" onClick={() => setAnswering(p)}>
          <span className="cp-ic" aria-hidden="true">?</span>
          <span><small>{who} asked {p.className || 'your class'}{list.length > 1 ? ` · ${list.length} questions` : ''}</small><b>{p.question}</b>{p.due && <small>Answer by {fmtDate(p.due)}</small>}</span>
          <span className="cp-go">Answer</span>
        </button>
      </div>}
      {answering && <AnswerFlow p={answering} who={whoOf(answering)} studentId={studentId} onClose={() => setAnswering(null)}
        onDone={(skipped) => { setAnswering(null); toast?.(skipped ? 'Okay, it is hidden.' : `Sent. ${whoOf(answering)} can read your answer.`); }} />}
    </>
  );
}

function AnswerFlow({ p, who, studentId, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [err, setErr] = useState(null);
  const photo = useUpload();
  const phone = useMemo(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, []);
  const pickPhoto = (e) => { const file = e.target.files?.[0]; e.target.value = ''; photo.run(file, (r) => setImage(evidenceFor(r, file.name).url)); };
  const send = () => { try { answerPrompt(p.id, studentId, { text: text.trim(), image }); setStep(3); } catch (e) { setErr(e.message); } };
  const skip = () => { try { skipPrompt(p.id, studentId); onDone(true); } catch (e) { setErr(e.message); } };
  return (
    <div className="modal-back" onClick={step === 3 ? () => onDone(false) : onClose}>
      <div className="modal sh-flow cp-flow" role="dialog" aria-label="Answer your teacher's question" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={step === 3 ? () => onDone(false) : onClose} aria-label="Close">×</button>
        <div className="sh-steps" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
        {step === 0 && <>
          <p className="sh-sub">{who} asked {p.className || 'your class'}{p.context ? ` · ${p.context}` : ''}</p>
          <div className="cp-big"><h2>{p.question}</h2></div>
          {p.due && <p className="sh-sub">Answer by {fmtDate(p.due)}</p>}
          <div className="sh-next"><button className="ghost" onClick={skip}>Not for me</button><button className="primary" onClick={() => setStep(1)}>Answer it</button></div>
        </>}
        {step === 1 && <>
          <h2>{p.question}</h2>
          <p className="sh-sub">One or two sentences is plenty.</p>
          <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => setText(`${text ? `${text} ` : ''}${s.replace('…', ' ')}`)}>{s}</button>)}</div>
          <textarea className="sh-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button><button className="primary" disabled={text.trim().length < 3} onClick={() => setStep(2)}>Next</button></div>
        </>}
        {step === 2 && <>
          <h2>Add a photo?</h2>
          <p className="sh-sub">You can skip this.</p>
          {image && !photo.busy
            ? <div className="sh-preview"><img src={image} alt="Your photo" /><button type="button" className="ghost" onClick={() => setImage(null)}>Remove photo</button></div>
            : <div className="sh-shoot">
              <label className={`sh-photo-btn${photo.busy ? ' busy' : ''}`}><span aria-hidden="true">▣</span>{photo.busy ? 'Uploading your photo…' : 'Take or choose a photo'}<input type="file" accept="image/*" disabled={photo.busy} onChange={pickPhoto} /></label>
              {phone && !photo.busy && <label className="sh-photo-btn cam">Use the camera<input type="file" accept="image/*" capture="environment" onChange={pickPhoto} /></label>}
            </div>}
          <UploadStatus up={photo} />
          {err && <p className="up-error" role="alert">{err}</p>}
          <div className="sh-next"><button className="ghost" onClick={() => setStep(1)}>Back</button><button className="primary" disabled={photo.busy} onClick={send}>{photo.busy ? 'Wait for the photo…' : image ? 'Send my answer' : 'Skip and send'}</button></div>
        </>}
        {step === 3 && <>
          <h2>Done!</h2>
          <p>{p.asMoment && p.line ? `It is on your ${p.line.name} line now, waiting for ${who} to check it.` : `${who} can read your answer. It is on your journey too.`}</p>
          <div className="sh-next"><button className="primary" autoFocus onClick={() => onDone(false)}>Close</button></div>
        </>}
        {err && step !== 2 && <p className="up-error" role="alert">{err}</p>}
      </div>
    </div>
  );
}
