import { useMemo, useState } from 'react';
import { answerExampleAsk, clearSubjectPrompts, DEFAULT_PROMPTS, exampleAsksFor, exampleChoices, getClasses, getTeacher, promptsAdmin, promptUses, schoolLines, setSubjectPrompts, snapshot, SP_LIMITS } from '../api.js';
import { fmtDate } from '../format.js';
import './subject-prompts.css';
import { MomentTemplatesScreen, PromptTabs } from './MomentTemplates.jsx';

// Subject prompts (api.setSubjectPrompts, getPromptsFor): what to write on a line. Students: IdeasPanel (the Standard/Full
// add dialog), Examples and promptsFrom (the Simple flow in SimpleHome.jsx), ExampleAsks (yes or no to an example). Teachers:
// ClassPromptsCard (a class page in My classes), PromptEditor; coordinators and leadership: SubjectPromptsScreen (#/…/prompts).
const callName = (n = '') => { const m = /^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+(.+)$/i.exec(n.trim()); return m ? `${m[1]} ${m[2].split(/\s+/).pop()}` : n; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const promptsFrom = (p) => (!p ? '' : p.source === 'class' ? `From ${p.teacher ? callName(p.teacher.name) : 'your teacher'}${p.className ? ` for ${p.className}` : ''}`
  : p.source === 'line' ? `From the ${p.line?.name || 'line’s'} teachers` : 'Ideas for every student');

export function Examples({ examples = [], simple = false }) {
  if (!examples.length) return null;
  return (
    <details className={`sp-examples${simple ? ' big' : ''}`}>
      <summary>{examples.length === 1 ? 'See an example' : `See ${examples.length} examples`}</summary>
      <ul>{examples.map((x) => <li key={x.id}><b>{x.title}</b>{x.text && <p>{x.text}</p>}<small>{x.year ? `A Year ${x.year} student` : 'Written by a teacher'}</small></li>)}</ul>
    </details>
  );
}

// Standard and Full: a collapsible panel under the line choice. Teacher-written prompts start open, built-in ones closed.
export function IdeasPanel({ prompts, onStarter, onOpen }) {
  if (!prompts) return null;
  return (
    <details className="span2 sp-ideas" open={prompts.source !== 'default'} onToggle={(e) => e.currentTarget.open && onOpen?.()}>
      <summary>Ideas for this line <small>{promptsFrom(prompts)}</small></summary>
      {prompts.note && <p className="sp-note">{prompts.note}</p>}
      <ol className="sp-qs">{prompts.questions.map((q) => <li key={q}>{q}</li>)}</ol>
      {prompts.starters.length > 0 && <div className="sp-starters" role="group" aria-label="Sentence starters">{prompts.starters.map((s) => <button type="button" key={s} onClick={() => onStarter(s)}>{s}</button>)}</div>}
      <Examples examples={prompts.examples} />
    </details>
  );
}

// A student is asked whether their moment may be an example (top of the home, every level).
export function ExampleAsks({ studentId, simple = false, toast, version }) {
  const asks = useMemo(() => exampleAsksFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!asks.length) return null;
  const a = asks[0];
  const who = a.teacher ? callName(a.teacher.name) : 'Your teacher';
  const answer = (yes) => { answerExampleAsk(a.promptId, a.exampleId, studentId, yes); toast?.(yes ? `Thank you. “${a.event.title}” can now help other students.` : 'OK, it stays as it was.'); };
  return (
    <section className={`sp-ask${simple ? ' big' : ''}`} aria-label="Can your moment be an example?">
      <div>
        <b>{who} would like to show your moment “{a.event.title}” to other students{a.className ? ` in ${a.className}` : a.line ? ` on ${a.line.name}` : ''} as an example.</b>
        <small>They would see its title, what you wrote about it and your Year, never your name. You can say no.</small>
      </div>
      <div className="sp-ask-acts"><button className="primary" onClick={() => answer(true)}>Yes, show it</button><button className="ghost" onClick={() => answer(false)}>No thanks</button></div>
    </section>
  );
}

// ── Teachers ──
const STATUS = { asked: 'Waiting for the student to say yes', yes: 'The student said yes', no: 'The student said no', teacher: 'Written by you' };
function Shown({ shown }) {
  if (!shown) return null;
  return (
    <div className="sp-shown">
      {shown.note && <p className="sp-note">{shown.note}</p>}
      <ol className="sp-qs">{shown.questions.map((q) => <li key={q}>{q}</li>)}</ol>
      {shown.starters?.length > 0 && <p className="sp-st"><span>Starters:</span> {shown.starters.join(' · ')}</p>}
    </div>
  );
}

export function ClassPromptsCard({ c, teacherId, toast, version }) {
  const a = useMemo(() => promptsAdmin({ classId: c.id }), [c.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(false);
  if (!c.line) return null;
  const clear = () => { const snap = snapshot(); clearSubjectPrompts(a.own.id, teacherId); toast?.(`${c.name} now sees the ${c.line.name} line’s prompts.`, snap); };
  return (
    <section className="sp-card" aria-labelledby={`sp-h-${c.id}`}>
      <header>
        <div>
          <h2 id={`sp-h-${c.id}`}>Prompts for students</h2>
          <small>{a.own ? `Yours for ${c.name}, written ${fmtDate(a.own.at.slice(0, 10))} · ${plural(a.uses, 'moment')} written with them`
            : a.source === 'line' ? `Students see the ${c.line.name} line’s prompts. Write your own for this class.` : `Students see the built-in ${c.line.name} prompts. Write your own for this class.`}</small>
        </div>
        <button className={a.own ? 'ghost' : 'primary'} onClick={() => setEditing(true)}>{a.own ? 'Edit prompts' : 'Write prompts for this class'}</button>
      </header>
      <details className="sp-preview"><summary>What students see when they add a {c.line.name} moment</summary><Shown shown={a.shown} /></details>
      {a.examples.length > 0 && <ul className="sp-exlist">{a.examples.map((x) => <li key={x.id}><b>{x.title}</b>{x.name && <small> · {x.name}</small>}<em className={`sp-st-${x.gone ? 'no' : x.status}`}>{x.gone ? 'No longer publishable, so not shown' : STATUS[x.status]}</em></li>)}</ul>}
      {a.own && <button className="linkish" onClick={clear}>Use the line’s prompts instead</button>}
      {editing && <PromptEditor target={{ classId: c.id }} title={c.name} teacherId={teacherId} toast={toast} onClose={() => setEditing(false)} />}
    </section>
  );
}

// Write or edit a class's or a line's prompts. target: { classId } or { lineId }.
export function PromptEditor({ target, title, teacherId, onClose, toast }) {
  const a = useMemo(() => promptsAdmin(target), [target.classId, target.lineId]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = a.own || a.shown || { note: '', questions: [], starters: [] };
  const pad = (xs, n) => [...xs, ...Array(Math.max(0, n - xs.length)).fill('')];
  const [note, setNote] = useState(base.note || '');
  const [qs, setQs] = useState(pad([...(base.questions || [])], SP_LIMITS.minQuestions));
  const [st, setSt] = useState([...(base.starters || [])]);
  const [ex, setEx] = useState(a.examples.map((x) => (x.eventId ? { keep: x.id, label: x.title, sub: x.name ? `${x.name} · ${STATUS[x.status]}` : STATUS[x.status] } : { title: x.title, text: x.text, label: x.title || 'Your example', sub: STATUS.teacher })));
  const [pick, setPick] = useState('');
  const [own, setOwn] = useState(null); // { title, text } while writing an example
  const [err, setErr] = useState(null);
  const choices = useMemo(() => (a.lineId ? exampleChoices(a.lineId, target.classId || null) : []), [a.lineId, target.classId]);
  const used = new Set(ex.map((x) => x.eventId || a.examples.find((o) => o.id === x.keep)?.eventId).filter(Boolean));
  const full = ex.length >= SP_LIMITS.examples;
  const filled = qs.filter((q) => q.trim()).length;
  const save = () => {
    try {
      const snap = snapshot();
      setSubjectPrompts(target, { note, questions: qs, starters: st, examples: ex.map(({ keep, eventId, title: t, text }) => (keep ? { keep } : eventId ? { eventId } : { title: t, text })) }, teacherId || null);
      toast?.(`Saved. Students see these when they add a ${a.line?.name || ''} moment${target.classId ? ` in ${title}` : ''}.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  const setAt = (list, set, i, v) => set(list.map((x, j) => (j === i ? v : x)));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sp-edit" role="dialog" aria-labelledby="sp-edit-h" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Prompts for students · {a.line?.name}</div>
        <h2 id="sp-edit-h">{title}</h2>
        <label>What makes a good moment here <small>a sentence or two</small>
          <textarea rows={3} value={note} maxLength={SP_LIMITS.note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Say what you set out to find out, what you did and what the results showed." /></label>
        <fieldset>
          <legend>Guiding questions <small>{SP_LIMITS.minQuestions} to {SP_LIMITS.maxQuestions}. At the Simple level students get one per screen.</small></legend>
          {qs.map((q, i) => (
            <div className="sp-row" key={i}>
              <input value={q} maxLength={SP_LIMITS.question} aria-label={`Question ${i + 1}`} onChange={(e) => setAt(qs, setQs, i, e.target.value)} placeholder={i === 0 ? 'e.g. What were you trying to find out?' : ''} />
              {qs.length > SP_LIMITS.minQuestions && <button type="button" className="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => setQs(qs.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          ))}
          {qs.length < SP_LIMITS.maxQuestions && <button type="button" className="ghost sp-add" onClick={() => setQs([...qs, ''])}>Add a question</button>}
        </fieldset>
        <fieldset>
          <legend>Sentence starters <small>optional; Simple students tap one to begin</small></legend>
          {st.map((s, i) => (
            <div className="sp-row" key={i}>
              <input value={s} maxLength={SP_LIMITS.starter} aria-label={`Starter ${i + 1}`} onChange={(e) => setAt(st, setSt, i, e.target.value)} />
              <button type="button" className="ghost" aria-label={`Remove starter ${i + 1}`} onClick={() => setSt(st.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          {st.length < SP_LIMITS.starters && <button type="button" className="ghost sp-add" onClick={() => setSt([...st, ''])}>Add a starter</button>}
        </fieldset>
        <fieldset>
          <legend>Examples <small>optional, up to {SP_LIMITS.examples}. A student’s moment is shown only once they say yes, without their name.</small></legend>
          {ex.length > 0 && <ul className="sp-exlist">{ex.map((x, i) => <li key={x.keep || x.eventId || `own-${i}`}><b>{x.label}</b>{x.sub && <small> · {x.sub}</small>}<button type="button" className="ghost" aria-label={`Remove example ${x.label}`} onClick={() => setEx(ex.filter((_, j) => j !== i))}>Remove</button></li>)}</ul>}
          {!full && !own && <div className="sp-row">
            <label className="sp-pick"><span className="sr-only">A student’s publishable moment</span>
              <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={!choices.length}>
                <option value="">{choices.length ? 'Choose a publishable moment…' : 'No publishable moments on this line yet'}</option>
                {choices.filter((c) => !used.has(c.eventId)).map((c) => <option key={c.eventId} value={c.eventId}>{c.title} · {c.name}, Year {c.year}</option>)}
              </select></label>
            <button type="button" className="ghost" disabled={!pick} onClick={() => { const c = choices.find((x) => x.eventId === pick); setEx([...ex, { eventId: c.eventId, label: c.title, sub: `${c.name} · we will ask them first` }]); setPick(''); }}>Add</button>
            <button type="button" className="ghost" onClick={() => setOwn({ title: '', text: '' })}>Write one</button>
          </div>}
          {own && <div className="sp-own">
            <label>Title<input value={own.title} maxLength={120} onChange={(e) => setOwn({ ...own, title: e.target.value })} placeholder="e.g. Testing which paper towel soaks up most" /></label>
            <label>What a student might write<textarea rows={3} maxLength={1000} value={own.text} onChange={(e) => setOwn({ ...own, text: e.target.value })} /></label>
            <div className="sp-row"><button type="button" className="ghost" onClick={() => setOwn(null)}>Cancel</button><button type="button" className="primary" disabled={!own.title.trim() && !own.text.trim()} onClick={() => { setEx([...ex, { ...own, label: own.title || 'Your example', sub: STATUS.teacher }]); setOwn(null); }}>Add this example</button></div>
          </div>}
        </fieldset>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{filled < SP_LIMITS.minQuestions ? `Write at least ${SP_LIMITS.minQuestions} questions` : `${plural(filled, 'question')}`}</span><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={filled < SP_LIMITS.minQuestions || filled > SP_LIMITS.maxQuestions} onClick={save}>Save prompts</button></div>
      </div>
    </div>
  );
}

// Coordinators (heads of department), leadership and admins: every school line's prompts, and the classes' own.
export default function SubjectPromptsScreen(props) {
  return props.param === 'templates' ? <MomentTemplatesScreen {...props} /> : <LinePrompts {...props} />; // moment templates: a tab beside these
}
function LinePrompts({ persona, toast, version, go }) {
  const lines = useMemo(() => schoolLines(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null);
  const teacherId = persona.teacherId || null;
  return (
    <div className="page sp-page">
      <PromptTabs persona={persona} go={go} at="prompts" />
      <header className="page-head"><div>
        <div className="kicker">Subject prompts</div>
        <h1>What to write on each line</h1>
        <p>Students see these when they add a moment: a note on what makes a good one, a few questions and sentence starters. A class’s teacher can write their own, which their class sees instead.</p>
      </div></header>
      <div className="sp-lines">
        {lines.map((l) => <LineRow key={l.id} l={l} version={version} teacherId={teacherId} toast={toast} onEdit={() => setEditing(l)} />)}
      </div>
      {editing && <PromptEditor target={{ lineId: editing.id }} title={`The ${editing.name} line`} teacherId={teacherId} toast={toast} onClose={() => setEditing(null)} />}
    </div>
  );
}
function LineRow({ l, version, teacherId, toast, onEdit }) {
  const a = useMemo(() => promptsAdmin({ lineId: l.id }), [l.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const classes = useMemo(() => {
    const ids = new Set(getClasses().filter((c) => c.lineId === l.id).map((c) => c.id));
    return getClasses().filter((c) => ids.has(c.id)).map((c) => ({ c, a: promptsAdmin({ classId: c.id }) })).filter((x) => x.a.own);
  }, [l.id, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const defUses = promptUses(a.defaultId);
  const by = a.own?.by && getTeacher(a.own.by);
  const reset = () => { const snap = snapshot(); clearSubjectPrompts(a.own.id, teacherId); toast?.(`The ${l.name} line is back to the built-in prompts.`, snap); };
  return (
    <section className="sp-card" style={{ '--c': l.colour }} aria-labelledby={`sp-l-${l.id}`}>
      <header>
        <div>
          <h2 id={`sp-l-${l.id}`}><i className="sp-dot" aria-hidden="true" />{l.name}</h2>
          <small>{a.own ? `Written by ${by ? by.name : 'the school'}, ${fmtDate(a.own.at.slice(0, 10))} · ${plural(a.uses, 'moment')} written with them` : DEFAULT_PROMPTS[l.id] ? 'Built-in prompts' : 'No prompts yet'}
            {defUses > 0 && ` · built-in prompts used for ${plural(defUses, 'moment')}`}</small>
        </div>
        <button className={a.own ? 'ghost' : 'primary'} onClick={onEdit}>{a.own ? 'Edit' : 'Write the line’s prompts'}</button>
      </header>
      <details className="sp-preview"><summary>What students see</summary><Shown shown={a.shown} /></details>
      {classes.length > 0 && <p className="sp-classes"><span>Classes with their own:</span> {classes.map(({ c, a: x }) => `${c.name} (${plural(x.uses, 'moment')})`).join(' · ')}</p>}
      {a.own && <button className="linkish" onClick={reset}>Go back to the built-in prompts</button>}
    </section>
  );
}
