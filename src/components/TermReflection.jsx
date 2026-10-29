// Term reflection (api.openReflectionWindow … finishTermReflection): the card and guided flow on a student's home, the
// advisory page's "Reflections: 12 of 23 done", and the whole-Year panel on the school overview.
import { useEffect, useMemo, useState } from 'react';
import { advisoryOf, advisoryReflection, canNudge, closeReflectionWindow, familyViewer, finishTermReflection, getReflectionWindows, getStudentMap,
  getTeacher, lastNudge, myReflection, nextTermEnd, nudgeAge, nudgeStudent, openReflectionWindow, reflectionProgress, saveTermReflection, shortName, snapshot,
  termMoments, termName, TODAY, TR_PICKS, windowOpen } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import { ideasFor, Steps } from '../screens/SimpleHome.jsx';
import './term-reflection.css';

const Q = [['did', 'What did you do?', ['I made…', 'I helped…', 'I took part in…', 'I tried…']], ['learned', 'What did you learn?', ['I learned that…', 'I got better at…', 'It was hard when…']], ['next', 'What next?', ['Next time I will…', 'I want to try…', 'I will keep…']]];
const HINT = { did: 'What you did, in a sentence or two', learned: 'A skill, something about yourself, or something that surprised you', next: 'What you will do differently, or try next' };
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const blank = (rec) => ({ picks: rec?.picks || [], answers: rec?.answers || {}, goal: rec?.goal || null, visibility: rec?.visibility || 'advisor', step: rec?.step || 0 });
const hasText = (a) => !!a && ['did', 'learned', 'next'].some((k) => a[k]?.trim());
const imageOf = (e) => e.evidence?.find((v) => v.kind === 'image')?.url;
const who = (sid, vis) => (vis === 'private' ? 'Only you can see it.' : vis === 'school' ? 'Your teachers and your family can see it.' : familyViewer(sid) === 'advisor' ? 'Your advisor and your family can see it.' : 'Your advisor can see it.');

// ── Student: the card on the home, at every level ──
export function TermReflectionCard({ studentId, version, toast, simple, auto }) {
  const cur = useMemo(() => myReflection(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null); // the window being written; stays while the done screen shows
  useEffect(() => { if (auto && cur) setOpen(cur.window); }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = lastNudge(studentId);
  const reminded = cur && n?.about === `reflection:${cur.window.id}` && nudgeAge(n) <= 14;
  return <>
    {cur && !open && (
      <section className={`tr-card${simple ? ' simple' : ''}`} aria-labelledby="tr-card-h">
        <div className="tr-card-text">
          <h2 id="tr-card-h">{cur.window.title}</h2>
          <p>{cur.record ? 'You started this. Carry on where you left off.' : 'Look back on this term: pick what you are proud of, say what you learned, and set one goal.'}</p>
          <small>{reminded ? `${shortName(getTeacher(n.from)?.name || '')} reminded you · ` : ''}Open until {fmtDate(cur.window.closes)}</small>
        </div>
        <button className="primary" onClick={() => setOpen(cur.window)}>{cur.record ? 'Carry on' : 'Start'}</button>
      </section>
    )}
    {open && (simple
      ? <SimpleFlow w={open} studentId={studentId} rec={cur?.window.id === open.id ? cur.record : null} toast={toast} onClose={() => setOpen(null)} />
      : <PageFlow w={open} studentId={studentId} rec={cur?.window.id === open.id ? cur.record : null} toast={toast} onClose={() => setOpen(null)} />)}
  </>;
}

function useDraft(w, studentId, rec, toast) {
  const [f, setF] = useState(() => blank(rec));
  const [dirty, setDirty] = useState(false);
  const set = (p) => { setF((x) => ({ ...x, ...p })); setDirty(true); };
  const save = (patch = {}) => {
    const next = { ...f, ...patch }; setF(next); setDirty(false);
    try { saveTermReflection(w.id, studentId, next); return true; } catch (e) { toast(e.message); return false; }
  };
  const finish = () => { try { finishTermReflection(w.id, studentId, f); return true; } catch (e) { toast(e.message); return false; } };
  return { f, set, save, finish, dirty };
}

function Pick({ e, on, full, onToggle, lines }) {
  const l = lines.find((x) => e.lineIds.includes(x.id));
  return (
    <button className={`tr-pick${on ? ' on' : ''}`} style={{ '--c': l?.colour || '#002855' }} aria-pressed={on} disabled={!on && full} onClick={onToggle}>
      {imageOf(e) ? <img src={imageOf(e)} alt="" /> : <span className="tr-ph" aria-hidden="true" />}
      <span><b>{e.title}</b><small>{fmtDate(e.date)}{l ? ` · ${l.name}` : ''}{e.earlier ? ' · earlier' : ''}</small></span>
      {on && <i className="tr-tick" aria-hidden="true">✓</i>}
    </button>
  );
}

function LookBack({ moments, f, set, lines, simple }) {
  const toggle = (id) => set({ picks: f.picks.includes(id) ? f.picks.filter((x) => x !== id) : [...f.picks, id].slice(0, TR_PICKS) });
  if (!moments.length) return <p className={simple ? 'sh-sub' : 'fineprint'}>Nothing on your journey yet this term. That is fine: you can still write about your term.</p>;
  return <div className="tr-picks">{moments.map((e) => <Pick key={e.id} e={e} lines={lines} on={f.picks.includes(e.id)} full={f.picks.length >= TR_PICKS} onToggle={() => toggle(e.id)} />)}</div>;
}

// ── Simple: one screen at a time, big buttons, sentence starters ──
function SimpleFlow({ w, studentId, rec, toast, onClose }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId]);
  const moments = useMemo(() => termMoments(studentId, w), [studentId, w]);
  const { f, set, save, finish, dirty } = useDraft(w, studentId, rec, toast);
  const [done, setDone] = useState(false);
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const keys = f.picks.length ? f.picks : moments.length ? [] : ['_'];
  const screens = ['look', ...keys, 'goal', 'review'];
  const at = Math.min(f.step, screens.length - 1), cur = screens[at];
  const go = (n) => save({ step: n });
  const close = () => { if (dirty && !done) save(); onClose(); };
  const ans = (k) => f.answers[k] || {};
  const setAns = (k, p) => set({ answers: { ...f.answers, [k]: { ...ans(k), ...p } } });
  const goals = map.events.filter((e) => e.type === 'goal' && !e.requirement && e.date > TODAY);
  const g = f.goal && !f.goal.goalId ? f.goal : null;
  const due = nextTermEnd();
  const ideas = lines.flatMap((l) => ideasFor(l).map((t) => [t, l])).filter(([t], i, a) => a.findIndex(([u]) => u === t) === i).slice(0, 4);
  const ev = (k) => moments.find((e) => e.id === k) || map.events.find((e) => e.id === k);
  const first = map.student.name.split(' ')[0];
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal sh-flow tr-flow" role="dialog" aria-label={w.title} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        {done ? <>
          <h2>Well done, {first}!</h2>
          <p className="sh-sub">Your {w.title} is on your journey{f.goal ? ', and so is your goal' : ''}. {who(studentId, f.visibility)}</p>
          <div className="sh-next"><button className="primary" onClick={onClose}>Close</button></div>
        </> : <>
          <Steps n={screens.length} at={at} />
          {cur === 'look' && <>
            <h2>Look back at this term</h2>
            <p className="sh-sub">Tap up to {TR_PICKS} things you are proud of.</p>
            <LookBack moments={moments} f={f} set={set} lines={lines} simple />
            <div className="sh-next"><button className="primary" disabled={moments.length > 0 && !f.picks.length} onClick={() => go(1)}>Next</button></div>
          </>}
          {keys.includes(cur) && <>
            <h2>{cur === '_' ? 'Your term' : `“${ev(cur)?.title}”`}</h2>
            {Q.map(([k, label, starters]) => (
              <div key={k} className="tr-q">
                <label htmlFor={`tr-${k}`}>{label}</label>
                <div className="sh-starters">{starters.map((s) => <button key={s} onClick={() => setAns(cur, { [k]: `${ans(cur)[k] ? `${ans(cur)[k].trimEnd()} ` : ''}${s.replace('…', ' ')}` })}>{s}</button>)}</div>
                <textarea id={`tr-${k}`} className="sh-input" rows={2} value={ans(cur)[k] || ''} onChange={(e) => setAns(cur, { [k]: e.target.value })} />
              </div>
            ))}
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" disabled={!hasText(ans(cur))} onClick={() => go(at + 1)}>Next</button></div>
          </>}
          {cur === 'goal' && <>
            <h2>One thing to do next term</h2>
            {goals.length > 0 && <div className="sh-who">{goals.slice(0, 3).map((e) => <button key={e.id} className={`sh-ask other${f.goal?.goalId === e.id ? ' on' : ''}`} onClick={() => save({ goal: { goalId: e.id }, step: at + 1 })}><b>Keep going: {e.title}</b><small>By {fmtDate(e.date)}</small></button>)}</div>}
            <p className="sh-sub">{goals.length ? 'Or something new:' : 'What do you want to do?'}</p>
            <input className="sh-input" value={g?.title || ''} onChange={(e) => set({ goal: { ...g, title: e.target.value, date: due } })} placeholder="e.g. Enter the science fair" />
            {ideas.length > 0 && <div className="sh-starters">{ideas.map(([t, l]) => <button key={t} className="sh-idea" style={{ '--c': l.colour }} onClick={() => set({ goal: { title: t, lineId: l.id, date: due } })}>{t}</button>)}</div>}
            <p className="sh-sub">Which colour does it go with?</p>
            <div className="sh-lines">{lines.map((l) => <button key={l.id} style={{ '--c': l.colour }} className={g?.lineId === l.id ? 'on' : ''} onClick={() => set({ goal: { ...g, lineId: l.id, date: due } })}><i />{l.name}</button>)}</div>
            <p className="sh-note">By the end of next term ({fmtDate(due)}).</p>
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="ghost sh-notnow" onClick={() => save({ goal: null, step: at + 1 })}>Skip</button>
              <button className="primary" disabled={!(g?.title?.trim().length >= 3 && g?.lineId)} onClick={() => go(at + 1)}>Next</button></div>
          </>}
          {cur === 'review' && <>
            <h2>Look at what you wrote</h2>
            <ul className="tr-review">{keys.map((k) => <li key={k}><b>{k === '_' ? 'My term' : ev(k)?.title}</b><span>{['did', 'learned', 'next'].map((x) => ans(k)[x]?.trim()).filter(Boolean).join(' ')}</span></li>)}
              {f.goal && <li className="goal"><b>My goal</b><span>{f.goal.goalId ? map.events.find((e) => e.id === f.goal.goalId)?.title : f.goal.title}</span></li>}</ul>
            <p className="sh-note">{who(studentId, f.visibility)}</p>
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary tr-finish" onClick={() => { if (finish()) setDone(true); }}>Finish</button></div>
          </>}
        </>}
      </div>
    </div>
  );
}

// ── Standard and Full: one richer page, then review ──
function PageFlow({ w, studentId, rec, toast, onClose }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId]);
  const moments = useMemo(() => termMoments(studentId, w), [studentId, w]);
  const { f, set, save, finish, dirty } = useDraft(w, studentId, rec, toast);
  const [view, setView] = useState('edit'); // edit | review | done
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const keys = f.picks.length ? f.picks : moments.length ? [] : ['_'];
  const ans = (k) => f.answers[k] || {};
  const setAns = (k, p) => set({ answers: { ...f.answers, [k]: { ...ans(k), ...p } } });
  const goals = map.events.filter((e) => e.type === 'goal' && !e.requirement && e.date > TODAY);
  const mode = !f.goal ? 'none' : f.goal.goalId ? 'keep' : 'new';
  const g = mode === 'new' ? f.goal : { title: '', lineId: lines[0]?.id || null, date: nextTermEnd() };
  const ev = (k) => map.events.find((e) => e.id === k);
  const ready = keys.length > 0 && keys.some((k) => hasText(ans(k))) && (mode !== 'new' || (g.title?.trim().length >= 3 && g.lineId && g.date > TODAY));
  const close = () => { if (dirty && view !== 'done') save(); onClose(); };
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal tr-flow tr-page" role="dialog" aria-label={w.title} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        <h2>{w.title}</h2>
        {view === 'done' ? <>
          <p>Saved on your journey as a reflection station{f.goal ? ', with your goal for next term' : ''}. {who(studentId, f.visibility)}</p>
          <div className="tr-foot"><button className="primary" onClick={onClose}>Close</button></div>
        </> : view === 'review' ? <>
          <p className="fineprint">Check it over, then finish. {who(studentId, f.visibility)}</p>
          <ul className="tr-review">{keys.map((k) => <li key={k}><b>{k === '_' ? 'This term' : ev(k)?.title}</b>{Q.map(([x, label]) => ans(k)[x]?.trim() && <span key={x}><em>{label}</em> {ans(k)[x].trim()}</span>)}</li>)}
            {f.goal && <li className="goal"><b>Goal for next term</b><span>{mode === 'keep' ? ev(f.goal.goalId)?.title : `${f.goal.title} (by ${fmtDate(f.goal.date)})`}</span></li>}</ul>
          <div className="tr-foot"><button className="ghost" onClick={() => setView('edit')}>Back to edit</button><button className="primary tr-finish" onClick={() => { if (finish()) setView('done'); }}>Finish</button></div>
        </> : <>
          <p className="fineprint">Open until {fmtDate(w.closes)}. Your progress is kept: save and come back any time.</p>
          <section className="tr-sec"><h3>1. Look back</h3><p className="fineprint">Pick up to {TR_PICKS} moments from this term you are proud of.</p>
            <LookBack moments={moments} f={f} set={set} lines={lines} /></section>
          {keys.length > 0 && <section className="tr-sec"><h3>2. What it meant</h3>
            {keys.map((k) => <fieldset key={k} className="tr-moment"><legend>{k === '_' ? 'This term' : ev(k)?.title}</legend>
              {Q.map(([x, label]) => <label key={x}><span>{label}</span><textarea rows={2} value={ans(k)[x] || ''} placeholder={HINT[x]} onChange={(e) => setAns(k, { [x]: e.target.value })} /></label>)}
            </fieldset>)}</section>}
          <section className="tr-sec"><h3>{keys.length ? 3 : 2}. One goal for next term</h3>
            <div className="tr-goal" role="radiogroup" aria-label="Goal for next term">
              {goals.length > 0 && <label><input type="radio" name="tr-g" checked={mode === 'keep'} onChange={() => set({ goal: { goalId: goals[0].id } })} /> Keep going with a goal I have</label>}
              {mode === 'keep' && <select aria-label="Which goal" value={f.goal.goalId} onChange={(e) => set({ goal: { goalId: e.target.value } })}>{goals.map((e) => <option key={e.id} value={e.id}>{e.title} (by {fmtDate(e.date)})</option>)}</select>}
              <label><input type="radio" name="tr-g" checked={mode === 'new'} onChange={() => set({ goal: g })} /> A new goal</label>
              {mode === 'new' && <div className="tr-newgoal">
                <input aria-label="Goal" value={g.title} placeholder="e.g. Lead a club session" onChange={(e) => set({ goal: { ...g, title: e.target.value } })} />
                <select aria-label="Line" value={g.lineId || ''} onChange={(e) => set({ goal: { ...g, lineId: e.target.value } })}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                <input aria-label="By" type="date" min={addDays(TODAY, 1)} value={g.date || ''} onChange={(e) => set({ goal: { ...g, date: e.target.value } })} />
              </div>}
              <label><input type="radio" name="tr-g" checked={mode === 'none'} onChange={() => set({ goal: null })} /> No goal for now</label>
            </div></section>
          <section className="tr-sec"><h3>{keys.length ? 4 : 3}. Who can see it</h3>
            <select aria-label="Who can see it" value={f.visibility} onChange={(e) => set({ visibility: e.target.value })}>
              <option value="advisor">Me and my advisor</option><option value="school">My teachers too</option><option value="private">Only me</option></select>
            <p className="fineprint">{who(studentId, f.visibility)}</p></section>
          <div className="tr-foot"><button className="ghost" onClick={() => { if (save()) { toast('Saved. Come back to it any time.'); onClose(); } }}>Save and finish later</button>
            <button className="primary" disabled={!ready} onClick={() => { save(); setView('review'); }}>Review</button></div>
        </>}
      </div>
    </div>
  );
}

// ── Staff: open a window, see who has finished, remind the rest ──
function OpenForm({ onOpen, label, children }) {
  const [f, setF] = useState({ title: termName(), opens: TODAY, closes: addDays(TODAY, 14) });
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
const REMIND = (w) => `Your ${w.title} is waiting. Pick the moments you are proud of: it takes about 10 minutes.`;

export function AdvisoryReflection({ advisorId, version, toast }) {
  const p = useMemo(() => advisoryReflection(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const [list, setList] = useState(false);
  const [text, setText] = useState(null);
  const size = advisoryOf(advisorId).size;
  const open = (f) => {
    const snap = snapshot();
    try { const w = openReflectionWindow({ ...f, advisorId }, advisorId); setOpening(false); toast(`${w.title} is open for ${w.studentIds.length} students`, snap); } catch (e) { toast(e.message); }
  };
  if (!size) return null;
  const w = p?.window, live = windowOpen(w) || (w && !w.closedOn && w.opens > TODAY);
  if (!p || !live) return (
    <section className="card-sec tr-adv" aria-labelledby="tr-adv-h">
      <div className="nd-head"><div><h2 id="tr-adv-h">Term reflection</h2>
        <small className="fineprint">{p ? `${w.title}: ${p.done} of ${p.total} done. ` : ''}Your advisees look back on the term: up to {TR_PICKS} moments they are proud of, what they learned, and one goal for next term.</small></div>
        {!opening && <button className="ghost" onClick={() => setOpening(true)}>Open a term reflection</button>}</div>
      {opening && <OpenForm label={`Open for ${size} students`} onOpen={open} />}
    </section>
  );
  const rest = p.rows.filter((r) => r.status !== 'done');
  const ready = rest.filter((r) => canNudge(r.student.id));
  const remind = () => {
    const snap = snapshot(); let n = 0;
    for (const r of ready) { try { nudgeStudent(r.student.id, advisorId, text, `reflection:${w.id}`); n++; } catch { /* nudged meanwhile */ } }
    setText(null);
    if (n) toast(n === 1 ? `Reminder sent to ${ready[0].student.name.split(' ')[0]}` : `Reminders sent to ${n} students`, snap);
  };
  const by = w.by && w.by !== advisorId ? getTeacher(w.by)?.name : null;
  return (
    <section className="card-sec tr-adv" aria-labelledby="tr-adv-h">
      <div className="nd-head">
        <div><h2 id="tr-adv-h">{w.title}</h2>
          <small className="fineprint">{w.opens > TODAY ? `Opens ${fmtDate(w.opens)}` : `Open since ${fmtDate(w.opens)}`}, closes {fmtDate(w.closes)}{by ? ` · opened by ${by}${w.year ? ` for Year ${w.year}` : ''}` : ''}</small></div>
        {(w.advisorId === advisorId || w.by === advisorId) && <button className="ghost" onClick={() => { const snap = snapshot(); closeReflectionWindow(w.id); toast(`${w.title} is closed`, snap); }}>Close it now</button>}
      </div>
      <div className="tr-strip">
        <b className="tr-count">Reflections: {p.done} of {p.total} done</b>
        {p.started > 0 && <span>{p.started} started</span>}
        <span className="tr-meter" aria-hidden="true"><i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} /></span>
        {rest.length > 0 && <button className="linkish" onClick={() => setList(!list)}>{list ? 'Hide' : `Who hasn't finished (${rest.length})`}</button>}
        {ready.length > 0 && text === null && <button className="ghost" onClick={() => setText(REMIND(w))}>Remind the rest ({ready.length})</button>}
      </div>
      {text !== null && <div className="nd-edit">
        <label htmlFor="tr-remind">Reminder to {ready.length} student{ready.length === 1 ? '' : 's'}</label>
        <textarea id="tr-remind" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="nd-edit-foot"><small className="fineprint">A nudge: on their home and in their notifications. At most one a week each.</small>
          <button className="ghost" onClick={() => setText(null)}>Cancel</button><button className="primary" onClick={remind}>Send</button></div>
      </div>}
      {list && <ul className="nd-list">{rest.map(({ student: s, status }) => { const n = lastNudge(s.id); return (
        <li key={s.id}>
          <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials}</span>
          <span className="nd-who"><b>{s.name}</b><small>{status === 'started' ? 'Started, not finished' : 'Not started'}{!canNudge(s.id) && n ? ` · nudged ${fmtDate(n.date)}` : ''}</small></span>
        </li>); })}</ul>}
    </section>
  );
}

// The school overview: a coordinator (or leadership) opens a reflection for a whole Year, and sees each window's count.
export function YearReflections({ persona, version, toast }) {
  const wins = useMemo(() => getReflectionWindows().filter((w) => w.closes >= addDays(TODAY, -60)).sort((a, b) => b.opens.localeCompare(a.opens) || b.at.localeCompare(a.at)), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const [year, setYear] = useState(7);
  const open = (f) => {
    const snap = snapshot();
    try { const w = openReflectionWindow({ ...f, year }, persona?.teacherId || null); setOpening(false); toast?.(`${w.title} is open for ${w.studentIds.length} students in Year ${year}`, snap); } catch (e) { toast?.(e.message); }
  };
  return (
    <section className="card-sec tr-adv tr-year" aria-labelledby="tr-year-h">
      <div className="nd-head"><div><h2 id="tr-year-h">Term reflections</h2>
        <small className="fineprint">Open a guided end-of-term reflection for a whole Year. Students already in an open one (their advisor’s) are left out of it.</small></div>
        {!opening && <button className="ghost" onClick={() => setOpening(true)}>Open for a Year</button>}</div>
      {opening && <OpenForm label="Open it" onOpen={open}><label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[7, 8, 9, 10, 11, 12, 13].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label></OpenForm>}
      {wins.length > 0 && <ul className="tr-wins">{wins.map((w) => { const p = reflectionProgress(w.id); const live = windowOpen(w); return (
        <li key={w.id}><span><b>{w.title}</b><small>{w.year ? `Year ${w.year}` : w.advisorId ? advisoryOf(w.advisorId).name : ''} · {live ? `closes ${fmtDate(w.closes)}` : w.closedOn ? `closed ${fmtDate(w.closedOn)}` : w.opens > TODAY ? `opens ${fmtDate(w.opens)}` : `closed ${fmtDate(w.closes)}`}</small></span>
          <span className="tr-count">{p.done} of {p.total} done</span>
          {live && <button className="ghost" onClick={() => { const snap = snapshot(); closeReflectionWindow(w.id); toast?.(`${w.title} is closed`, snap); }}>Close</button>}
        </li>); })}</ul>}
    </section>
  );
}
