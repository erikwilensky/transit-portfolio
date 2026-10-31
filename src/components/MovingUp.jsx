// Moving-up summaries (api.openMovingUp … finishMovingUp): "Where I've been, where I'm going", written at the end of
// Year 9 and Year 11 for the next advisor. The student's card and guided flow, the one-page A4 sheet, the advisory and
// whole-Year panels, the "Last year" block for the next advisor and the family's copy (docs/pilot-server.md).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { advisoryMovingUp, advisoryOf, canNudge, closeMovingUp, getLine, getMovingUpWindows, getStudent, getStudentMap, getStudents, getTeacher, lastNudge, latestMovingUp,
  lastYearOf, MU_HOPES, MU_MAX, MU_PICKS, movingUpProblem, movingUpProgress, movingUpSummaries, muStageOf, muTitle, myMovingUp, nudgeAge, nudgeStudent,
  openMovingUp, saveMovingUp, finishMovingUp, setMovingUpFamily, shortName, snapshot, stageMoments, TODAY, windowOpen } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import { dateIn, lineName, muWords } from '../i18n.js';
import { printDocument, usePrintTitle } from '../print.js';
import { Steps } from '../screens/SimpleHome.jsx';
import { shown } from '../thai.js';
import { Said, SayIt, SpeakButton } from './Voice.jsx';
import './term-reflection.css';
import './moving-up.css';

const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const imageOf = (e) => e.evidence?.find((v) => v.kind === 'image')?.url;
const blank = (rec, stage) => ({ picks: rec?.picks || [], who: rec?.who || '', proud: rec?.proud || '', learn: rec?.learn || '', helps: rec?.helps || '', dp: rec?.dp || '', cas: rec?.cas || '',
  hopes: rec?.hopes?.length ? rec.hopes : [{ text: '', goal: false, lineId: null }], family: typeof rec?.family === 'boolean' ? rec.family : stage === 9 ? true : null, step: rec?.step || 0 });
const whoSees = (fam) => (fam ? 'Your advisor, next year’s advisor and your family can see it.' : 'Your advisor and next year’s advisor can see it.');
const looking = (stage) => (stage === 11 ? 'Look back at Years 10 and 11' : 'Look back at Years 7 to 9');
const ASK = {
  who: ['Who are you? What are you like?', ['I am…', 'People say I am…', 'I really like…']],
  proud: ['What are you proud of?', ['I am proud that…', 'I got better at…', 'I kept going with…']],
  learn: ['How do you learn best?', ['I learn best when…', 'I like to…', 'It helps me to see…']],
  helps: ['What helps you when things are hard?', ['It helps when…', 'Please…', 'I work well with…']],
  cas: ['What could you do for CAS?', ['I could start…', 'I would like to help…', 'I want to try…']],
};

// ── Student: the card on the home, at every level ──
export function MovingUpCard({ studentId, version, toast, simple, auto }) {
  const cur = useMemo(() => myMovingUp(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => latestMovingUp(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  const [view, setView] = useState(false);
  useEffect(() => { if (auto && cur) setOpen(cur); }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = lastNudge(studentId);
  const reminded = cur && n?.about === `movingup:${cur.window.id}` && nudgeAge(n) <= 14;
  const s = getStudent(studentId);
  const keep = mine && !cur && (muStageOf(s) === mine.stage || String(mine.doneAt).slice(0, 10) >= addDays(TODAY, -60));
  return <>
    {cur && !open && (
      <section className={`tr-card mu-card${simple ? ' simple' : ''}`} aria-labelledby="mu-card-h">
        <div className="tr-card-text">
          <h2 id="mu-card-h">Where I’ve been, where I’m going</h2>
          <p>{cur.record ? 'You started this. Carry on where you left off.' : cur.stage === 11 ? 'You are moving up to the IB Diploma. Tell your next advisor about you: a few moments, how you learn best and your hopes.' : 'You are moving up to Year 10. Tell your next advisor about you: a few moments, how you learn best and your hopes.'}</p>
          <small>{reminded ? `${shortName(getTeacher(n.from)?.name || '')} reminded you · ` : ''}{`Open until ${fmtDate(cur.window.closes)}`}</small>
        </div>
        <button className="primary" onClick={() => setOpen(cur)}>{cur.record ? 'Carry on' : 'Start'}</button>
      </section>
    )}
    {keep && !open && (
      <section className={`tr-card mu-card mu-mine${simple ? ' simple' : ''}`} aria-labelledby="mu-mine-h">
        <div className="tr-card-text">
          <h2 id="mu-mine-h">My moving-up summary</h2>
          <p>{whoSees(mine.family)}</p>
          <label className="mu-fam"><input type="checkbox" checked={!!mine.family} onChange={(e) => { try { setMovingUpFamily(studentId, mine.id, e.target.checked); toast(e.target.checked ? 'Your family can see it now.' : 'Your family cannot see it now.'); } catch (x) { toast(x.message); } }} /> {'Let my family see it'}</label>
        </div>
        <button className="ghost" onClick={() => setView(true)}>Open</button>
      </section>
    )}
    {view && mine && <MovingUpSheet records={[mine]} onClose={() => setView(false)} />}
    {open && (simple
      ? <SimpleFlow cur={open} studentId={studentId} toast={toast} onClose={() => setOpen(null)} />
      : <PageFlow cur={open} studentId={studentId} toast={toast} onClose={() => setOpen(null)} />)}
  </>;
}

function useDraft(cur, studentId, toast) {
  const w = cur.window;
  const [f, setF] = useState(() => blank(cur.record, cur.stage));
  const [dirty, setDirty] = useState(false);
  const set = (p) => { setF((x) => ({ ...x, ...p })); setDirty(true); };
  const save = (patch = {}) => {
    const next = { ...f, ...patch }; setF(next); setDirty(false);
    try { saveMovingUp(w.id, studentId, next); return true; } catch (e) { toast(e.message); return false; }
  };
  const finish = () => { try { finishMovingUp(w.id, studentId, f); return true; } catch (e) { toast(e.message); return false; } };
  const setHope = (i, p) => set({ hopes: f.hopes.map((h, j) => (j === i ? { ...h, ...p } : h)) });
  return { f, set, save, finish, dirty, setHope };
}

function Pick({ e, on, full, onToggle, lines }) {
  const l = lines.find((x) => e.lineIds.includes(x.id));
  return (
    <button className={`tr-pick${on ? ' on' : ''}`} style={{ '--c': l?.colour || '#002855' }} aria-pressed={on} disabled={!on && full} onClick={onToggle}>
      {imageOf(e) ? <img src={imageOf(e)} alt="" /> : <span className="tr-ph" aria-hidden="true" />}
      <span><b>{e.title}</b><small>{fmtDate(e.date)}{l ? ` · ${l.name}` : ''}</small></span>
      {on && <i className="tr-tick" aria-hidden="true">✓</i>}
    </button>
  );
}
function LookBack({ moments, f, set, lines, simple }) {
  const toggle = (id) => set({ picks: f.picks.includes(id) ? f.picks.filter((x) => x !== id) : [...f.picks, id].slice(0, MU_PICKS) });
  if (!moments.length) return <p className={simple ? 'sh-sub' : 'fineprint'}>Nothing on your journey to pick yet. That is fine: you can still write your summary.</p>;
  return <div className="tr-picks">{moments.map((e) => <Pick key={e.id} e={e} lines={lines} on={f.picks.includes(e.id)} full={f.picks.length >= MU_PICKS} onToggle={() => toggle(e.id)} />)}</div>;
}
// One question with sentence starters (Simple), or a plain box (Standard and Full).
function Ask({ k, f, set, simple, max = MU_MAX[k] }) {
  const [label, starters] = ASK[k];
  if (!simple) return <><label className="mu-q"><span>{label}</span><textarea rows={2} maxLength={max} value={f[k]} onChange={(e) => set({ [k]: e.target.value })} /></label><SayIt value={f[k]} onChange={(v) => set({ [k]: v })} /></>;
  return (
    <div className="tr-q">
      <div className="vc-said"><label htmlFor={`mu-${k}`}>{label}</label><SpeakButton text={label} auto={false} /></div>
      <div className="sh-starters">{starters.map((s) => <button key={s} onClick={() => set({ [k]: `${f[k] ? `${f[k].trimEnd()} ` : ''}${shown(s).replace('…', ' ')}` })}>{s}</button>)}</div>
      <textarea id={`mu-${k}`} className="sh-input" rows={2} maxLength={max} value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
      <SayIt value={f[k]} onChange={(v) => set({ [k]: v })} />
    </div>
  );
}
function Hopes({ f, set, setHope, lines, simple }) {
  const add = () => set({ hopes: [...f.hopes, { text: '', goal: false, lineId: null }].slice(0, MU_HOPES) });
  return <>
    {f.hopes.map((h, i) => (
      <div key={i} className="mu-hope">
        <label htmlFor={`mu-hope-${i}`} className={simple ? 'mu-hope-l' : ''}>{i ? 'Another hope' : 'A hope for next year'}</label>
        <input id={`mu-hope-${i}`} className={simple ? 'sh-input' : ''} maxLength={MU_MAX.hope} value={h.text} placeholder="e.g. Join the debate club" onChange={(e) => setHope(i, { text: e.target.value })} />
        <SayIt value={h.text} onChange={(text) => setHope(i, { text })} />
        <label className="mu-goal"><input type="checkbox" checked={h.goal} onChange={(e) => setHope(i, { goal: e.target.checked, lineId: h.lineId || lines[0]?.id || null })} /> {'Make it a goal on my journey'}</label>
        {h.goal && (simple
          ? <div className="sh-lines">{lines.map((l) => <button key={l.id} style={{ '--c': l.colour }} className={h.lineId === l.id ? 'on' : ''} aria-pressed={h.lineId === l.id} onClick={() => setHope(i, { lineId: l.id })}><i />{l.name}</button>)}</div>
          : <select aria-label="Line" value={h.lineId || ''} onChange={(e) => setHope(i, { lineId: e.target.value })}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>)}
      </div>
    ))}
    {f.hopes.length < MU_HOPES && <button className="ghost mu-more" onClick={add}>Add a second hope</button>}
  </>;
}
function Family({ f, set, stage, simple }) {
  const yes = 'Yes, my family can see it', no = 'No, only my advisors';
  return <>
    <p className={simple ? 'sh-sub' : 'fineprint'}>{stage === 9 ? 'Your family sees it on their family page. You can change this later.' : 'You choose. Your family sees it on their family page. You can change this later.'}</p>
    <div className="mu-fams" role="radiogroup" aria-label="Can your family see it?">
      {[[true, yes], [false, no]].map(([v, t]) => <button key={t} role="radio" aria-checked={f.family === v} className={`sh-ask other${f.family === v ? ' on' : ''}`} onClick={() => set({ family: v })}><b>{t}</b></button>)}
    </div>
  </>;
}

// ── Simple: one screen at a time, big buttons, sentence starters ──
function SimpleFlow({ cur, studentId, toast, onClose }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId]);
  const stage = cur.stage;
  const moments = useMemo(() => stageMoments(studentId, stage), [studentId, stage]);
  const { f, set, save, finish, dirty, setHope } = useDraft(cur, studentId, toast);
  const [done, setDone] = useState(false);
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const screens = ['look', 'me', 'learn', 'hopes', ...(stage === 11 ? ['dp'] : []), 'family', 'review'];
  const at = Math.min(f.step, screens.length - 1), now = screens[at];
  const go = (n) => save({ step: n });
  const close = () => { if (dirty && !done) save(); onClose(); };
  const hopesOk = f.hopes.some((h) => h.text.trim()) && f.hopes.every((h) => !h.goal || !h.text.trim() || (h.text.trim().length >= 3 && h.lineId));
  const nextOk = { look: true, me: !!(f.who.trim() || f.proud.trim()), learn: !!(f.learn.trim() || f.helps.trim()), hopes: hopesOk, dp: true, family: typeof f.family === 'boolean' }[now];
  const first = map.student.name.split(' ')[0];
  const nav = <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" disabled={!nextOk} onClick={() => go(at + 1)}>Next</button></div>;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal sh-flow tr-flow mu-flow" role="dialog" aria-label="Where I’ve been, where I’m going" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        {done ? <>
          <h2>{`Well done, ${first}!`}</h2>
          <p className="sh-sub">{`Your summary is saved for your next advisor. ${whoSees(f.family)}`}</p>
          <div className="sh-next"><button className="primary" onClick={onClose}>Close</button></div>
        </> : <>
          <Steps n={screens.length} at={at} />
          {now === 'look' && <>
            <Said text={looking(stage)} />
            <p className="sh-sub">{`Tap up to ${MU_PICKS} moments that show who you are.`}</p>
            <LookBack moments={moments} f={f} set={set} lines={lines} simple />
            <div className="sh-next"><button className="primary" onClick={() => go(1)}>Next</button></div>
          </>}
          {now === 'me' && <><Said text="About you" /><Ask k="who" f={f} set={set} simple /><Ask k="proud" f={f} set={set} simple />{nav}</>}
          {now === 'learn' && <><Said text="For your next advisor" /><Ask k="learn" f={f} set={set} simple /><Ask k="helps" f={f} set={set} simple />{nav}</>}
          {now === 'hopes' && <><Said text={stage === 11 ? 'Your hopes for the IB Diploma' : 'Your hopes for Year 10'} /><p className="sh-sub">One or two. A hope can become a goal on your journey.</p><Hopes f={f} set={set} setHope={setHope} lines={lines} simple />{nav}</>}
          {now === 'dp' && <><Said text="The IB Diploma" />
            <p className="sh-sub">In Years 12 and 13 you choose six subjects. You also do CAS: something creative, something active, and helping others.</p>
            <div className="tr-q"><label htmlFor="mu-dp">Which subjects are you thinking about?</label>
              <textarea id="mu-dp" className="sh-input" rows={2} maxLength={MU_MAX.dp} placeholder="e.g. Biology, English, Visual Arts" value={f.dp} onChange={(e) => set({ dp: e.target.value })} /><SayIt value={f.dp} onChange={(dp) => set({ dp })} /></div>
            <Ask k="cas" f={f} set={set} simple />{nav}</>}
          {now === 'family' && <><Said text="Can your family see it?" /><Family f={f} set={set} stage={stage} simple />{nav}</>}
          {now === 'review' && <>
            <h2>Look at what you wrote</h2>
            <Summary r={{ ...f, stage, moments: f.picks.map((id) => moments.find((e) => e.id === id)).filter(Boolean).map((e) => ({ eventId: e.id, title: e.title, date: e.date, lineIds: e.lineIds })) }} lang="en" />
            <p className="sh-note">{whoSees(f.family)}</p>
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary tr-finish" onClick={() => { if (finish()) setDone(true); }}>Finish</button></div>
          </>}
        </>}
      </div>
    </div>
  );
}

// ── Standard and Full: one page, then review ──
function PageFlow({ cur, studentId, toast, onClose }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId]);
  const stage = cur.stage, w = cur.window;
  const moments = useMemo(() => stageMoments(studentId, stage), [studentId, stage]);
  const { f, set, save, finish, dirty, setHope } = useDraft(cur, studentId, toast);
  const [view, setView] = useState('edit');
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const problem = movingUpProblem(stage, { ...f, hopes: f.hopes.filter((h) => h.text.trim()) });
  const close = () => { if (dirty && view !== 'done') save(); onClose(); };
  let n = 0;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal tr-flow tr-page mu-flow" role="dialog" aria-label="Where I’ve been, where I’m going" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        <h2>Where I’ve been, where I’m going</h2>
        {view === 'done' ? <>
          <p>{`Saved for your next advisor. ${whoSees(f.family)}`}</p>
          <div className="tr-foot"><button className="primary" onClick={onClose}>Close</button></div>
        </> : view === 'review' ? <>
          <p className="fineprint">{`Check it over, then finish. ${whoSees(f.family)}`}</p>
          <Summary r={{ ...f, stage, moments: f.picks.map((id) => moments.find((e) => e.id === id)).filter(Boolean).map((e) => ({ eventId: e.id, title: e.title, date: e.date, lineIds: e.lineIds })) }} lang="en" />
          <div className="tr-foot"><button className="ghost" onClick={() => setView('edit')}>Back to edit</button><button className="primary tr-finish" onClick={() => { if (finish()) setView('done'); }}>Finish</button></div>
        </> : <>
          <p className="fineprint">{`For your next advisor. Open until ${fmtDate(w.closes)}. Your progress is kept: save and come back any time.`}</p>
          <section className="tr-sec"><h3>{`${++n}. ${looking(stage)}`}</h3><p className="fineprint">{`Pick up to ${MU_PICKS} moments that show who you are. Private moments are not here.`}</p>
            <LookBack moments={moments} f={f} set={set} lines={lines} /></section>
          <section className="tr-sec"><h3>{`${++n}. About you`}</h3><Ask k="who" f={f} set={set} /><Ask k="proud" f={f} set={set} /></section>
          <section className="tr-sec"><h3>{`${++n}. How you learn`}</h3><Ask k="learn" f={f} set={set} /><Ask k="helps" f={f} set={set} /></section>
          <section className="tr-sec"><h3>{`${++n}. ${stage === 11 ? 'Your hopes for the IB Diploma' : 'Your hopes for Year 10'}`}</h3><Hopes f={f} set={set} setHope={setHope} lines={lines} /></section>
          {stage === 11 && <section className="tr-sec"><h3>{`${++n}. The IB Diploma`}</h3>
            <p className="fineprint">In Years 12 and 13 you choose six subjects. You also do CAS: something creative, something active, and helping others.</p>
            <label className="mu-q"><span>Which subjects are you thinking about?</span><textarea rows={2} maxLength={MU_MAX.dp} placeholder="e.g. Biology, English, Visual Arts" value={f.dp} onChange={(e) => set({ dp: e.target.value })} /></label>
            <Ask k="cas" f={f} set={set} /></section>}
          <section className="tr-sec"><h3>{`${++n}. Can your family see it?`}</h3><Family f={f} set={set} stage={stage} /></section>
          {problem && <p className="fineprint mu-missing">{problem}</p>}
          <div className="tr-foot"><button className="ghost" onClick={() => { if (save()) { toast('Saved. Come back to it any time.'); onClose(); } }}>Save and finish later</button>
            <button className="primary" disabled={!!problem} onClick={() => { save(); setView('review'); }}>Review</button></div>
        </>}
      </div>
    </div>
  );
}

// ── The summary itself: on screen, in the family view and on paper. Labels in the reader's language (families). ──
export function Summary({ r, lang = 'en', paper }) {
  const w = muWords(lang);
  const hopes = (r.hopes || []).filter((h) => h.text?.trim());
  const ln = (m) => m.lineIds?.map((id) => getLine(id)?.name).filter(Boolean).map((x) => lineName(lang, x))[0];
  const Part = ({ k, label }) => (r[k]?.trim() ? <div className="mu-part"><h4>{label}</h4><p lang="en">{r[k].trim()}</p></div> : null);
  return (
    <div className={`mu-sum${paper ? ' paper' : ''}`}>
      {r.moments?.length > 0 && <div className="mu-part mu-ms"><h4>{w.moments}</h4><ul>{r.moments.map((m) => <li key={m.eventId}><b lang="en">{m.title}</b><small>{dateIn(lang, m.date)}{ln(m) ? ` · ${ln(m)}` : ''}</small></li>)}</ul></div>}
      <div className="mu-cols"><Part k="who" label={w.who} /><Part k="proud" label={w.proud} /></div>
      <div className="mu-cols"><Part k="learn" label={w.learn} /><Part k="helps" label={w.helps} /></div>
      {hopes.length > 0 && <div className="mu-part"><h4>{r.stage === 11 ? w.hopesDp : w.hopes}</h4><ul className="mu-hopes">{hopes.map((h, i) => <li key={i}><span lang="en">{h.text.trim()}</span>{h.goal && <small className="mu-tag">{w.goal}</small>}</li>)}</ul></div>}
      {r.stage === 11 && <div className="mu-cols"><Part k="dp" label={w.dp} /><Part k="cas" label={w.cas} /></div>}
    </div>
  );
}

// One A4 page each, with Print. lang: the family's language (labels only; the student's words stay as written).
export function MovingUpSheet({ records, onClose, lang = 'en' }) {
  const w = muWords(lang);
  const name = records.length === 1 ? `${getStudent(records[0].studentId)?.name || ''} – ${w.head}` : w.head;
  usePrintTitle(name);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="mu-overlay" role="dialog" aria-modal="true" aria-label={w.head} lang={lang}>
      <div className="mu-bar">
        <div><b>{w.head}</b><small>{w.onePage}</small></div>
        <div className="mu-actions"><button className="primary" onClick={() => printDocument(name)}>{w.print}</button><button className="ghost" onClick={onClose}>{w.close}</button></div>
      </div>
      {records.map((r) => { const s = getStudent(r.studentId); return (
        <article key={r.id} className="mu-sheet">
          <header className="mu-sheet-head">
            <div><h1>{w.head}</h1><p className="mu-who"><b>{s?.name}</b><span>{r.stage === 11 ? w.stage11 : w.stage9}</span></p></div>
            <small>{w.forNext}</small>
          </header>
          <Summary r={r} lang={lang} paper />
          <footer className="mu-sheet-foot">{`${w.written(dateIn(lang, String(r.doneAt || TODAY).slice(0, 10)))} · ${r.family ? w.famYes : w.famNo}`}</footer>
        </article>); })}
    </div>,
    document.body,
  );
}

// ── Staff: open a window, see who has finished, remind the rest, read the summaries ──
function OpenForm({ stage, onOpen, label, children }) {
  const [f, setF] = useState({ title: muTitle(stage), opens: TODAY, closes: addDays(TODAY, 21) });
  useEffect(() => { setF((x) => ({ ...x, title: muTitle(stage) })); }, [stage]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="tr-form">
      <label>Title<input value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
      {children}
      <label>Opens<input type="date" value={f.opens} min={TODAY} onChange={(e) => set({ opens: e.target.value })} /></label>
      <label>Closes<input type="date" value={f.closes} min={f.opens} onChange={(e) => set({ closes: e.target.value })} /></label>
      <button className="primary" disabled={!f.title.trim() || !f.closes || f.closes < f.opens} onClick={() => onOpen(f)}>{label}</button>
    </div>
  );
}
const REMIND = 'Your moving-up summary is waiting: a few moments, how you learn best and your hopes for next year. It takes about 15 minutes.';
const ABOUT = 'Year 9 and Year 11 advisees write “Where I’ve been, where I’m going” for their next advisor: up to 5 moments, who they are, how they learn best and their hopes. It shows in the Last year panel once the class-list import moves them.';

export function AdvisoryMovingUp({ advisorId, version, toast }) {
  const p = useMemo(() => advisoryMovingUp(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const kids = useMemo(() => getStudents().filter((s) => s.advisorId === advisorId && !s.cohortOnly && muStageOf(s)), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const [list, setList] = useState(false);
  const [text, setText] = useState(null);
  const [reading, setReading] = useState(null);
  if (!kids.length && !p) return null;
  const stage = kids.some((s) => muStageOf(s) === 11) && !kids.some((s) => muStageOf(s) === 9) ? 11 : 9;
  const open = (f) => {
    const snap = snapshot();
    try { const w = openMovingUp({ ...f, advisorId }, advisorId); setOpening(false); toast(`${w.title} is open for ${w.studentIds.length} students`, snap); } catch (e) { toast(e.message); }
  };
  const w = p?.window, live = windowOpen(w) || (w && !w.closedOn && w.opens > TODAY);
  const done = p ? p.rows.filter((r) => r.status === 'done').map((r) => r.record) : [];
  const head = <div className="nd-head"><div><h2 id="mu-adv-h">{live ? w.title : 'Moving-up summaries'}</h2>
    <small className="fineprint">{live ? `${w.opens > TODAY ? `Opens ${fmtDate(w.opens)}` : `Open since ${fmtDate(w.opens)}`}, closes ${fmtDate(w.closes)}` : `${p ? `${w.title}: ${p.done} of ${p.total} done. ` : ''}${ABOUT}`}</small></div>
    {!live && !opening && kids.length > 0 && <button className="ghost" onClick={() => setOpening(true)}>Open moving-up summaries</button>}
    {live && (w.advisorId === advisorId || w.by === advisorId) && <button className="ghost" onClick={() => { const snap = snapshot(); closeMovingUp(w.id); toast(`${w.title} is closed`, snap); }}>Close it now</button>}</div>;
  const rest = p ? p.rows.filter((r) => r.status !== 'done') : [];
  const ready = rest.filter((r) => canNudge(r.student.id));
  const remind = () => {
    const snap = snapshot(); let k = 0;
    for (const r of ready) { try { nudgeStudent(r.student.id, advisorId, text, `movingup:${w.id}`); k++; } catch { /* nudged meanwhile */ } }
    setText(null);
    if (k) toast(k === 1 ? `Reminder sent to ${ready[0].student.name.split(' ')[0]}` : `Reminders sent to ${k} students`, snap);
  };
  return (
    <section className="card-sec tr-adv mu-adv" aria-labelledby="mu-adv-h">
      {head}
      {opening && <OpenForm stage={stage} label={`Open for ${kids.length} students`} onOpen={open} />}
      {p && <div className="tr-strip">
        <b className="tr-count mu-count">{`Summaries: ${p.done} of ${p.total} done`}</b>
        {p.started > 0 && <span>{`${p.started} started`}</span>}
        <span className="tr-meter" aria-hidden="true"><i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} /></span>
        {rest.length > 0 && <button className="linkish" onClick={() => setList(!list)}>{list ? 'Hide' : `Who hasn't finished (${rest.length})`}</button>}
        {live && windowOpen(w) && ready.length > 0 && text === null && <button className="ghost mu-remind" onClick={() => setText(REMIND)}>{`Remind the rest (${ready.length})`}</button>}
        {done.length > 0 && <button className="ghost" onClick={() => setReading(done)}>{`Read the summaries (${done.length})`}</button>}
      </div>}
      {text !== null && <div className="nd-edit">
        <label htmlFor="mu-remind">{`Reminder to ${ready.length} student${ready.length === 1 ? '' : 's'}`}</label>
        <textarea id="mu-remind" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="nd-edit-foot"><small className="fineprint">A nudge: on their home and in their notifications. At most one a week each.</small>
          <button className="ghost" onClick={() => setText(null)}>Cancel</button><button className="primary" onClick={remind}>Send</button></div>
      </div>}
      {list && <ul className="nd-list">{rest.map(({ student: s, status }) => { const n = lastNudge(s.id); return (
        <li key={s.id}>
          <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials}</span>
          <span className="nd-who"><b>{s.name}</b><small>{status === 'started' ? 'Started, not finished' : 'Not started'}{!canNudge(s.id) && n ? ` · nudged ${fmtDate(n.date)}` : ''}</small></span>
        </li>); })}</ul>}
      {reading && <MovingUpSheet records={reading} onClose={() => setReading(null)} />}
    </section>
  );
}

// Write handover notes: a line on how many summaries are in.
export function MovingUpCount({ advisorId, version }) {
  const p = useMemo(() => advisoryMovingUp(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  return <p className="fineprint mu-hcount">{`Moving-up summaries: ${p.done} of ${p.total} done. Each one goes with the student to their next advisor.`}</p>;
}

// The advisor's student page: the student's latest summary (inside "Last year" after a handover, on its own before).
export function MovingUpForStaff({ studentId, version, inLastYear }) {
  const r = useMemo(() => latestMovingUp(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const handed = useMemo(() => !!lastYearOf(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [paper, setPaper] = useState(false);
  if (!r || (!inLastYear && handed)) return null;
  const body = <>
    <div className="mu-staff-head"><h4>{`Where I’ve been, where I’m going · Year ${r.stage}`}</h4><button className="ghost small-btn" onClick={() => setPaper(true)}>Print</button></div>
    <small className="fineprint">{`Written by ${getStudent(studentId)?.name.split(' ')[0] || 'the student'} on ${fmtDate(String(r.doneAt).slice(0, 10))}, for their next advisor · ${r.family ? 'their family can see it' : 'not shown to their family'}`}</small>
    <Summary r={r} />
    {paper && <MovingUpSheet records={[r]} onClose={() => setPaper(false)} />}
  </>;
  return inLastYear ? <div className="mu-staff mu-in-ly">{body}</div> : <section className="card-sec mu-staff" aria-label="Moving-up summary">{body}</section>;
}

// The school overview: open for a whole Year (9 or 11) and see each window's count.
export function YearMovingUp({ persona, version, toast }) {
  const wins = useMemo(() => getMovingUpWindows().filter((w) => w.closes >= addDays(TODAY, -60)).sort((a, b) => b.opens.localeCompare(a.opens) || b.at.localeCompare(a.at)), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const [year, setYear] = useState(9);
  const open = (f) => {
    const snap = snapshot();
    try { const w = openMovingUp({ ...f, year }, persona?.teacherId || null); setOpening(false); toast?.(`${w.title} is open for ${w.studentIds.length} students in Year ${year}`, snap); } catch (e) { toast?.(e.message); }
  };
  return (
    <section className="card-sec tr-adv tr-year mu-year" aria-labelledby="mu-year-h">
      <div className="nd-head"><div><h2 id="mu-year-h">Moving-up summaries</h2>
        <small className="fineprint">Open “Where I’ve been, where I’m going” for Year 9 or Year 11. Students already in an open one (their advisor’s) are left out of it.</small></div>
        {!opening && <button className="ghost" onClick={() => setOpening(true)}>Open for a Year</button>}</div>
      {opening && <OpenForm stage={year} label="Open it" onOpen={open}><label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[9, 11].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label></OpenForm>}
      {wins.length > 0 && <ul className="tr-wins">{wins.map((w) => { const p = movingUpProgress(w.id); const live = windowOpen(w); return (
        <li key={w.id}><span><b>{w.title}</b><small>{w.year ? `Year ${w.year}` : w.advisorId ? advisoryOf(w.advisorId).name : ''} · {live ? `closes ${fmtDate(w.closes)}` : w.closedOn ? `closed ${fmtDate(w.closedOn)}` : w.opens > TODAY ? `opens ${fmtDate(w.opens)}` : `closed ${fmtDate(w.closes)}`}</small></span>
          <span className="tr-count">{p.done} of {p.total} done</span>
          {live && <button className="ghost" onClick={() => { const snap = snapshot(); closeMovingUp(w.id); toast?.(`${w.title} is closed`, snap); }}>Close</button>}
        </li>); })}</ul>}
    </section>
  );
}

// The family view: the child's summary, when the student said their family may see it.
export function FamilyMovingUp({ childId, lang, version }) {
  const r = useMemo(() => movingUpSummaries(childId).find((x) => x.family === true) || null, [childId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [paper, setPaper] = useState(false);
  if (!r) return null;
  const w = muWords(lang), f = getStudent(childId)?.name.split(' ')[0] || '';
  return (
    <section className="card-sec mu-fam-card" aria-labelledby="mu-fam-h">
      <div className="mu-staff-head"><h2 id="mu-fam-h">{w.famHead(f)}</h2><button className="ghost small-btn" onClick={() => setPaper(true)}>{w.print}</button></div>
      <p className="fineprint">{w.famIntro(f, r.stage)}</p>
      <Summary r={r} lang={lang} />
      {paper && <MovingUpSheet records={[r]} lang={lang} onClose={() => setPaper(false)} />}
    </section>
  );
}
