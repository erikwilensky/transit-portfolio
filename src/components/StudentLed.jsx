// Student-led conferences (api.saveConfPrep, writeConfNote): "Get ready for my conference" on the student's home (one
// question a screen at Simple, one page at Standard and Full), Conference mode (full screen, one moment a screen, large
// text, keeps working offline once open), the advisor's "Prepared: n of 23" on the round, and the lines everyone adds at
// the end (the family's on the family page, in Thai or English).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addNote, confBookingOf, confNoteOf, conferenceDeck, daysBefore, getConferenceRounds, getLang, getStudent, getStudentMap, getTeacher, myConfPrep,
  prepMoments, prepProgress, saveConfPrep, shortName, SLC_MAX, SLC_PICKS, TODAY, writeConfNote, youngConf } from '../api.js';
import { fmtDate } from '../format.js';
import { confSlotText, errText, slcWords, studentThai } from '../i18n.js';
import { Steps } from '../screens/SimpleHome.jsx';
import { shown } from '../thai.js';
import { Said, SayIt, SpeakButton } from './Voice.jsx';
import './term-reflection.css';
import './student-led.css';

const imageOf = (e) => e.evidence?.find((v) => v.kind === 'image')?.url;
const blank = (p) => ({ picks: p?.picks || [], says: p?.says || {}, proud: p?.proud || '', hard: p?.hard || '', goal: p?.goal || null, step: p?.step || 0 });
const ST = {
  say: ['This shows…', 'I am proud of it because…', 'I learned…'],
  proud: ['I am proud that…', 'I got better at…', 'I am proud of how I…'],
  hard: ['It was hard when…', 'I found it tricky to…', 'I kept going by…'],
  goal: ['Next I want to…', 'I will try to…'],
  line: ['Next I will…', 'I will keep…'],
};
const addStarter = (cur, s) => `${cur ? `${cur.trimEnd()} ` : ''}${shown(s).replace('…', ' ')}`;
const hasPrep = (p) => !!p && (p.picks.length > 0 || !!p.proud);

// ── Student: the card on the home, at every level ──
export function StudentLedCard({ studentId, version, toast, simple }) {
  const cur = useMemo(() => myConfPrep(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = useMemo(() => afterConference(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [flow, setFlow] = useState(null); // the round being prepared
  const [mode, setMode] = useState(null); // the round being presented
  const lang = getLang();
  const r = cur?.round, p = cur?.prep, b = cur?.booking;
  const today = b?.date === TODAY;
  return <>
    {cur && !(after && after.round.id === r.id && !today) && (
      <section className={`slc-card${simple ? ' simple' : ''}`} aria-labelledby="slc-card-h">
        <div className="slc-card-text">
          <h2 id="slc-card-h">{today ? 'Today is your conference' : 'Get ready for my conference'}</h2>
          <p>{p?.status === 'ready' ? 'You are ready. You can still change it before the day.' : p ? 'You started this. Carry on where you left off.'
            : youngConf(studentId) ? 'Pick a few things to show your family and say what you are proud of. It takes about 5 minutes.'
            : `Pick up to ${SLC_PICKS} moments to show, say what you are proud of, one thing that was hard and one goal.`}</p>
          <small>{b ? `Your conference: ${confSlotText(lang, b.date, b.time)}` : 'No time booked yet. Your family picks one.'}</small>
        </div>
        <div className="slc-card-btns">
          {p?.status === 'ready'
            ? <><button className="primary" onClick={() => setMode(r)}>Start my conference</button><button className="ghost" onClick={() => setFlow(r)}>Change it</button></>
            : <><button className="primary" onClick={() => setFlow(r)}>{p ? 'Carry on' : 'Get ready'}</button>{hasPrep(p) && <button className="ghost" onClick={() => setMode(r)}>Start my conference</button>}</>}
        </div>
      </section>
    )}
    {after && <StudentNote studentId={studentId} round={after.round} version={version} toast={toast} simple={simple} onShow={after.deck?.prep ? () => setMode(after.round) : null} />}
    {flow && (simple
      ? <SimpleFlow r={flow} studentId={studentId} prep={cur?.round.id === flow.id ? p : null} toast={toast} onClose={() => setFlow(null)} onPresent={() => { setFlow(null); setMode(flow); }} />
      : <PageFlow r={flow} studentId={studentId} prep={cur?.round.id === flow.id ? p : null} toast={toast} onClose={() => setFlow(null)} onPresent={() => { setFlow(null); setMode(flow); }} />)}
    {mode && <ConferenceMode roundId={mode.id} studentId={studentId} by="student" version={version} onClose={() => setMode(null)} />}
  </>;
}
// After the conference (its day has come, or someone wrote on the note), for 30 days after the round's last day.
function afterConference(studentId) {
  const r = getConferenceRounds().filter((x) => x.studentIds.includes(studentId) && x.days.at(-1).date >= daysBefore(30))
    .filter((x) => { const b = confBookingOf(x.id, studentId), n = confNoteOf(x.id, studentId); return (n && (n.family || n.student)) || (b && b.date <= TODAY); })
    .sort((a, b) => b.days[0].date.localeCompare(a.days[0].date))[0];
  return r ? { round: r, deck: conferenceDeck(r.id, studentId, 'student') } : null;
}

function StudentNote({ studentId, round: r, version, toast, simple, onShow }) {
  const n = useMemo(() => confNoteOf(r.id, studentId), [r, studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const mine = n?.student, fam = n?.family;
  const save = () => { try { writeConfNote(r.id, studentId, 'student', text, 'student'); setEdit(false); toast('Saved on your conference note'); } catch (e) { toast(e.message); } };
  const by = (x) => (x && x.by !== 'family' && x.by !== 'student' ? shortName(getTeacher(x.by)?.name || '') : '');
  return (
    <section className={`slc-card slc-note${simple ? ' simple' : ''}`} aria-labelledby="slc-note-h">
      <div className="slc-card-text">
        <h2 id="slc-note-h">My conference note</h2>
        <dl className="slc-lines">
          <div><dt>What we will try at home</dt><dd>{fam ? <><span lang="en">{fam.text}</span>{by(fam) && <small>{`Written by ${by(fam)}`}</small>}</> : <small>Your family adds this on their Family page.</small>}</dd></div>
          <div><dt>What I will do next</dt><dd>{mine && !edit ? <><span lang="en">{mine.text}</span>{by(mine) && <small>{`Written by ${by(mine)}`}</small>}</> : !edit ? <small>Not written yet.</small> : null}</dd></div>
        </dl>
        {edit && <div className="slc-write">
          {simple && <div className="vc-said"><label htmlFor="slc-mine">What will you do next?</label><SpeakButton text="What will you do next?" auto={false} /></div>}
          {!simple && <label htmlFor="slc-mine">What I will do next</label>}
          {simple && <div className="sh-starters">{ST.line.map((s) => <button key={s} onClick={() => setText(addStarter(text, s))}>{s}</button>)}</div>}
          <textarea id="slc-mine" className={simple ? 'sh-input' : ''} rows={2} maxLength={SLC_MAX.line} value={text} onChange={(e) => setText(e.target.value)} />
          <SayIt value={text} onChange={setText} />
          <div className="sh-next"><button className="ghost" onClick={() => setEdit(false)}>Cancel</button><button className="primary" disabled={!text.trim()} onClick={save}>Save</button></div>
        </div>}
      </div>
      {!edit && <div className="slc-card-btns">
        <button className={mine ? 'ghost' : 'primary'} onClick={() => { setText(mine?.text || ''); setEdit(true); }}>{mine ? 'Change my line' : 'Write what I will do next'}</button>
        {onShow && <button className="ghost" onClick={onShow}>Open my conference</button>}
      </div>}
    </section>
  );
}

function useDraft(r, studentId, prep, toast) {
  const [f, setF] = useState(() => blank(prep));
  const [dirty, setDirty] = useState(false);
  const set = (p) => { setF((x) => ({ ...x, ...p })); setDirty(true); };
  const save = (patch = {}, ready = false) => {
    const next = { ...f, ...patch }; setF(next); setDirty(false);
    try { saveConfPrep(r.id, studentId, next, ready); return true; } catch (e) { toast(e.message); return false; }
  };
  return { f, set, save, dirty };
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
function Picks({ moments, f, set, lines, simple }) {
  const toggle = (id) => set({ picks: f.picks.includes(id) ? f.picks.filter((x) => x !== id) : [...f.picks, id].slice(0, SLC_PICKS) });
  if (!moments.length) return <p className={simple ? 'sh-sub' : 'fineprint'}>Nothing on your journey to show yet. That is fine: you can still say what you are proud of.</p>;
  return <div className="tr-picks">{moments.slice(0, 12).map((e) => <Pick key={e.id} e={e} lines={lines} on={f.picks.includes(e.id)} full={f.picks.length >= SLC_PICKS} onToggle={() => toggle(e.id)} />)}</div>;
}
function Goals({ goals, f, set, simple }) {
  if (!goals.length) return null;
  return <div className="sh-who slc-goals">{goals.slice(0, 3).map((e) => <button key={e.id} className={`sh-ask other${f.goal?.goalId === e.id ? ' on' : ''}`} aria-pressed={f.goal?.goalId === e.id} onClick={() => set({ goal: f.goal?.goalId === e.id ? null : { goalId: e.id } })}><b>{e.title}</b><small>{simple ? 'A goal I have' : `A goal I have · ${fmtDate(e.date)}`}</small></button>)}</div>;
}
const useBits = (studentId) => {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId]);
  const moments = useMemo(() => prepMoments(studentId), [studentId]);
  return { map, moments, lines: map.lines.filter((l) => l.status !== 'ended'), goals: map.events.filter((e) => e.type === 'goal' && !e.requirement && e.date > TODAY) };
};

// ── Simple: one question a screen, sentence starters, read aloud and speak to type ──
function SimpleFlow({ r, studentId, prep, toast, onClose, onPresent }) {
  const { map, moments, lines, goals } = useBits(studentId);
  const { f, set, save, dirty } = useDraft(r, studentId, prep, toast);
  const [done, setDone] = useState(false);
  const screens = ['pick', ...f.picks, 'proud', 'hard', 'goal', 'review'];
  const at = Math.min(f.step, screens.length - 1), cur = screens[at];
  const go = (n) => save({ step: n });
  const close = () => { if (dirty && !done) save(); onClose(); };
  const ev = (id) => moments.find((e) => e.id === id);
  const g = f.goal && !f.goal.goalId ? f.goal : null;
  const first = map.student.name.split(' ')[0];
  const box = ({ k, value, onChange, label, starters }) => <>
    <div className="sh-starters">{starters.map((s) => <button key={s} onClick={() => onChange(addStarter(value, s))}>{s}</button>)}</div>
    <textarea id={`slc-${k}`} className="sh-input" rows={2} maxLength={SLC_MAX[k] || SLC_MAX.say} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    <SayIt value={value} onChange={onChange} />
  </>;
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal sh-flow tr-flow slc-flow" role="dialog" aria-label="Get ready for my conference" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        {done ? <>
          <h2>{`Well done, ${first}!`}</h2>
          <p className="sh-sub">You are ready for your conference. On the day, open it and show your family.</p>
          <div className="sh-next"><button className="ghost" onClick={onClose}>Close</button><button className="primary" onClick={onPresent}>Try it now</button></div>
        </> : <>
          <Steps n={screens.length} at={at} />
          {cur === 'pick' && <>
            <Said text="What do you want to show?" />
            <p className="sh-sub">{`Tap up to ${SLC_PICKS} things.`}</p>
            <Picks moments={moments} f={f} set={set} lines={lines} simple />
            <div className="sh-next"><button className="primary" onClick={() => go(1)}>Next</button></div>
          </>}
          {f.picks.includes(cur) && <>
            <Said text="What do you want to say about it?" />
            <p className="slc-about">{ev(cur)?.title}</p>
            {box({ k: 'say', label: 'What do you want to say about it?', value: f.says[cur] || '', onChange: (v) => set({ says: { ...f.says, [cur]: v } }), starters: ST.say })}
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" onClick={() => go(at + 1)}>{f.says[cur]?.trim() ? 'Next' : 'Skip'}</button></div>
          </>}
          {cur === 'proud' && <>
            <Said text="What are you proud of?" />
            {box({ k: 'proud', label: 'What are you proud of?', value: f.proud, onChange: (v) => set({ proud: v }), starters: ST.proud })}
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" disabled={!f.proud.trim() && !f.picks.length} onClick={() => go(at + 1)}>{f.proud.trim() ? 'Next' : 'Skip'}</button></div>
          </>}
          {cur === 'hard' && <>
            <Said text="What was hard?" />
            <p className="sh-sub">One thing is enough.</p>
            {box({ k: 'hard', label: 'What was hard?', value: f.hard, onChange: (v) => set({ hard: v }), starters: ST.hard })}
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" onClick={() => go(at + 1)}>{f.hard.trim() ? 'Next' : 'Skip'}</button></div>
          </>}
          {cur === 'goal' && <>
            <Said text="What is your goal?" />
            <Goals goals={goals} f={f} set={set} simple />
            <p className="sh-sub">{goals.length ? 'Or something new:' : 'One thing you want to do next.'}</p>
            {box({ k: 'goal', label: 'My goal', value: g?.title || '', onChange: (v) => set({ goal: v ? { title: v } : null }), starters: ST.goal })}
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary" onClick={() => go(at + 1)}>{f.goal ? 'Next' : 'Skip'}</button></div>
          </>}
          {cur === 'review' && <>
            <h2>Look at what you wrote</h2>
            <Review f={f} ev={ev} goals={goals} />
            <p className="sh-note">Your advisor can see it. You show it to your family at the conference.</p>
            <div className="sh-next"><button className="ghost" onClick={() => go(at - 1)}>Back</button><button className="primary tr-finish" onClick={() => { if (save({}, true)) setDone(true); }}>I am ready</button></div>
          </>}
        </>}
      </div>
    </div>
  );
}

function Review({ f, ev, goals }) {
  const goal = f.goal?.goalId ? goals.find((e) => e.id === f.goal.goalId)?.title : f.goal?.title;
  return (
    <ul className="tr-review">
      {f.picks.map((id) => <li key={id}><b>{ev(id)?.title}</b>{f.says[id]?.trim() && <span>{f.says[id].trim()}</span>}</li>)}
      {f.proud.trim() && <li><em>I am proud of</em><span>{f.proud.trim()}</span></li>}
      {f.hard.trim() && <li><em>Something that was hard</em><span>{f.hard.trim()}</span></li>}
      {goal && <li className="goal"><em>My goal</em><span>{goal}</span></li>}
    </ul>
  );
}

// ── Standard and Full: one page ──
function PageFlow({ r, studentId, prep, toast, onClose, onPresent }) {
  const { moments, lines, goals } = useBits(studentId);
  const { f, set, save, dirty } = useDraft(r, studentId, prep, toast);
  const [view, setView] = useState('edit'); // edit | done
  const ev = (id) => moments.find((e) => e.id === id);
  const mode = !f.goal ? 'none' : f.goal.goalId ? 'keep' : 'new';
  const ready = f.picks.length > 0 || !!f.proud.trim();
  const close = () => { if (dirty && view !== 'done') save(); onClose(); };
  const young = youngConf(studentId);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal tr-flow tr-page slc-flow" role="dialog" aria-label="Get ready for my conference" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={close} aria-label="Close">×</button>
        <h2>Get ready for my conference</h2>
        {view === 'done' ? <>
          <p>You are ready. On the day, open Conference mode and show it, one screen at a time. You can still change it before then.</p>
          <div className="tr-foot"><button className="ghost" onClick={onClose}>Close</button><button className="primary" onClick={onPresent}>Try Conference mode</button></div>
        </> : <>
          <p className="fineprint">{young ? 'Short is fine: this is a chat with your family, not a speech.' : 'You lead the conference: these are your notes for it.'} Your progress is kept: save and come back any time.</p>
          <section className="tr-sec"><h3>1. What to show</h3><p className="fineprint">{`Pick up to ${SLC_PICKS} moments. Private moments are not here.`}</p>
            <Picks moments={moments} f={f} set={set} lines={lines} /></section>
          {f.picks.length > 0 && <section className="tr-sec"><h3>2. In your words</h3>
            {f.picks.map((id) => <label key={id} className="slc-say"><span>{ev(id)?.title}</span>
              <textarea rows={2} maxLength={SLC_MAX.say} placeholder="What you want to say about it" value={f.says[id] || ''} onChange={(e) => set({ says: { ...f.says, [id]: e.target.value } })} />
              <SayIt value={f.says[id] || ''} onChange={(v) => set({ says: { ...f.says, [id]: v } })} /></label>)}</section>}
          <section className="tr-sec"><h3>{f.picks.length ? '3. Looking back' : '2. Looking back'}</h3>
            <label className="slc-say"><span>What I am proud of</span><textarea rows={2} maxLength={SLC_MAX.proud} value={f.proud} onChange={(e) => set({ proud: e.target.value })} /><SayIt value={f.proud} onChange={(v) => set({ proud: v })} /></label>
            <label className="slc-say"><span>One thing that was hard</span><textarea rows={2} maxLength={SLC_MAX.hard} value={f.hard} onChange={(e) => set({ hard: e.target.value })} /><SayIt value={f.hard} onChange={(v) => set({ hard: v })} /></label></section>
          <section className="tr-sec"><h3>{f.picks.length ? '4. One goal' : '3. One goal'}</h3>
            <div className="tr-goal" role="radiogroup" aria-label="One goal">
              {goals.length > 0 && <label><input type="radio" name="slc-g" checked={mode === 'keep'} onChange={() => set({ goal: { goalId: goals[0].id } })} /> Keep going with a goal I have</label>}
              {mode === 'keep' && <select aria-label="Which goal" value={f.goal.goalId} onChange={(e) => set({ goal: { goalId: e.target.value } })}>{goals.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>}
              <label><input type="radio" name="slc-g" checked={mode === 'new'} onChange={() => set({ goal: { title: '' } })} /> A new goal</label>
              {mode === 'new' && <input aria-label="My goal" maxLength={SLC_MAX.goal} value={f.goal.title} placeholder="e.g. Read five books this term" onChange={(e) => set({ goal: { title: e.target.value } })} />}
              <label><input type="radio" name="slc-g" checked={mode === 'none'} onChange={() => set({ goal: null })} /> No goal for now</label>
            </div></section>
          <p className="fineprint">Your advisor can see it. You show it to your family at the conference.</p>
          <div className="tr-foot"><button className="ghost" onClick={() => { if (save()) { toast('Saved. Come back to it any time.'); onClose(); } }}>Save and finish later</button>
            <button className="primary" disabled={!ready} onClick={() => { if (save({}, true)) setView('done'); }}>I am ready</button></div>
        </>}
      </div>
    </div>
  );
}

// ── Conference mode: full screen, one screen at a time, large text. Opened, it needs no connection: everything it shows is
// in this browser's copy of the record, photos are kept in memory, and the lines written at the end wait in the outbox. ──
function usePhotos(urls) {
  const [blobs, setBlobs] = useState({});
  const key = urls.join('|');
  useEffect(() => {
    let live = true; const made = [];
    (async () => {
      for (const u of urls) {
        try { const r = await fetch(u, { credentials: 'same-origin' }); if (!r.ok) continue; const url = URL.createObjectURL(await r.blob()); made.push(url); if (live) setBlobs((b) => ({ ...b, [u]: url })); } catch { /* offline: the address as it is */ }
      }
    })();
    return () => { live = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return blobs;
}
function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); addEventListener('online', a); addEventListener('offline', b); return () => { removeEventListener('online', a); removeEventListener('offline', b); }; }, []);
  return on;
}

export function ConferenceMode({ roundId, studentId, by, version, onClose }) {
  const staff = by !== 'student';
  const deck = useMemo(() => conferenceDeck(roundId, studentId, staff ? 'advisor' : 'student'), [roundId, studentId, staff, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [th, setTh] = useState(() => getLang() === 'th');
  const online = useOnline();
  const photos = usePhotos(useMemo(() => (deck?.moments || []).map((m) => m.photo).filter(Boolean), [deck?.prep?.savedAt])); // eslint-disable-line react-hooks/exhaustive-deps
  const box = useRef(null);
  const t = (s) => (th && studentThai(s)) || s;
  const slides = deck ? ['hello', ...deck.moments.map((m) => m.id), ...(deck.proud || deck.hard ? ['looking'] : []), ...(deck.goal ? ['goal'] : []), 'next'] : [];
  const at = Math.min(i, Math.max(0, slides.length - 1)), cur = slides[at];
  const len = useRef(0); len.current = slides.length;
  const go = (n) => setI(Math.max(0, Math.min(slides.length - 1, n)));
  useEffect(() => { box.current?.focus(); }, [at]);
  useEffect(() => {
    let lock = null;
    navigator.wakeLock?.request?.('screen').then((l) => { lock = l; }).catch(() => {});
    const k = (e) => {
      if (e.target.closest?.('textarea, input, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setI((n) => Math.min(len.current - 1, n + 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    addEventListener('keydown', k);
    return () => { removeEventListener('keydown', k); lock?.release?.().catch(() => {}); };
  }, [onClose]);
  const close = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); onClose(); };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  if (!deck) return null;
  const m = deck.moments.find((x) => x.id === cur);
  const n = deck.moments.indexOf(m) + 1;
  const name = `${deck.student.name} · ${deck.round.title}`;
  return createPortal(
    <div className={`slc-mode${th ? ' th' : ''}`} role="dialog" aria-modal="true" aria-label={t('Conference mode')} lang={th ? 'th' : 'en'}>
      <header className="slc-bar">
        <span className="slc-who"><b>{t('Conference mode')}</b><small translate="no" lang="en">{name}</small></span>
        {!online && <span className="slc-off" role="status">{t('Offline: this still works. What you write is kept here and sent when you are back online.')}</span>}
        <span className="slc-tools">
          <span className="seg small" role="group" aria-label={t('Language')}><button aria-pressed={!th} className={th ? '' : 'on'} onClick={() => setTh(false)} lang="en">English</button><button aria-pressed={th} className={th ? 'on' : ''} onClick={() => setTh(true)} lang="th">ไทย</button></span>
          <button className="ghost" onClick={full}>{t('Full screen')}</button>
          <button className="ghost" onClick={close}>{t('Close')}</button>
        </span>
      </header>
      <main className="slc-stage" ref={box} tabIndex={-1} aria-live="polite" aria-label={t(`Screen ${at + 1} of ${slides.length}`)}>
        {cur === 'hello' && <div className="slc-slide slc-hello">
          <h1>{deck.young ? t(`Hi, I’m ${deck.first}!`) : t(`${deck.first}’s conference`)}</h1>
          {deck.moments.length > 0 ? <>
            <p className="slc-big">{deck.young ? t('I picked a few things to show you.') : t('What I will show you')}</p>
            {!deck.young && <ol className="slc-list">{deck.moments.map((x) => <li key={x.id} lang="en">{x.title}</li>)}</ol>}
          </> : <p className="slc-big">{deck.prep ? t('Let’s talk about my journey together.') : t('Nothing prepared yet. You can still talk through the journey together.')}</p>}
        </div>}
        {m && <div className={`slc-slide slc-moment${m.photo ? '' : ' nophoto'}`} style={{ '--c': m.line?.colour || '#002855' }}>
          {m.photo ? <img className="slc-photo" src={photos[m.photo] || m.photo} alt="" /> : <span className="slc-photo slc-ph" aria-hidden="true" />}
          <div className="slc-words">
            <small className="slc-kicker">{t(`Moment ${n} of ${deck.moments.length}`)}{m.line ? <span translate="no" lang="en">{` · ${m.line.name}`}</span> : null}</small>
            <h1 lang="en">{m.title}</h1>
            {m.say ? <p className="slc-big" lang="en">{m.say}</p> : m.summary ? <p className="slc-mid" lang="en">{m.summary}</p> : null}
          </div>
        </div>}
        {cur === 'looking' && <div className="slc-slide slc-look">
          {deck.proud && <div><h2>{t('I am proud of')}</h2><p className="slc-big" lang="en">{deck.proud}</p></div>}
          {deck.hard && <div><h2>{t('Something that was hard')}</h2><p className="slc-big" lang="en">{deck.hard}</p></div>}
        </div>}
        {cur === 'goal' && <div className="slc-slide slc-goal">
          <h2>{t('My goal')}</h2>
          <h1 lang="en">{deck.goal.title}</h1>
          {deck.goal.date && <p className="slc-mid">{t(`By ${fmtDate(deck.goal.date)}`)}</p>}
        </div>}
        {cur === 'next' && <NextSteps deck={deck} by={by} t={t} />}
      </main>
      <footer className="slc-foot">
        <button className="ghost slc-nav" disabled={at === 0} onClick={() => go(at - 1)}>{t('Back')}</button>
        <span className="slc-dots" aria-hidden="true">{slides.map((s, k) => <i key={s} className={k === at ? 'on' : k < at ? 'past' : ''} />)}</span>
        {at < slides.length - 1 ? <button className="primary slc-nav" onClick={() => go(at + 1)}>{t('Next')}</button> : <button className="primary slc-nav" onClick={close}>{t('Finish')}</button>}
      </footer>
    </div>,
    document.body,
  );
}

// The last screen: the family's line and the student's, and (staff only) a private note.
function NextSteps({ deck, by, t }) {
  const staff = by !== 'student';
  const n = deck.note, sid = deck.student.id, r = deck.round;
  const [fam, setFam] = useState(n?.family?.text || '');
  const [mine, setMine] = useState(n?.student?.text || '');
  const [note, setNote] = useState('');
  const [said, setSaid] = useState('');
  const run = (fn, msg) => { try { fn(); setSaid(t(msg)); } catch (e) { setSaid(e.message); } };
  const line = ({ who, label, value, set, can }) => (
    <div className="slc-line">
      <label htmlFor={`slc-l-${who}`}>{t(label)}</label>
      {can ? <>
        <textarea id={`slc-l-${who}`} rows={2} maxLength={SLC_MAX.line} value={value} onChange={(e) => set(e.target.value)} />
        <button className="ghost" disabled={!value.trim() || value.trim() === (n?.[who]?.text || '')} onClick={() => run(() => writeConfNote(r.id, sid, who, value, by), 'Saved on the conference note')}>{t('Save')}</button>
      </> : <p id={`slc-l-${who}`} className="slc-mid">{n?.[who]?.text ? <span lang="en">{n[who].text}</span> : t('Your family adds this on their Family page.')}</p>}
    </div>
  );
  return (
    <div className="slc-slide slc-next">
      <h1>{t('Our next steps')}</h1>
      <p className="slc-mid">{t('One line each, to keep on the conference note.')}</p>
      {line({ who: 'family', label: 'What we will try at home', value: fam, set: setFam, can: staff })}
      {line({ who: 'student', label: 'What I will do next', value: mine, set: setMine, can: true })}
      {staff && <div className="slc-line slc-staff">
        <label htmlFor="slc-staff">Private staff note <small>Only staff see it. It goes with your advisor notes and on the advisor copy of the conference sheet, never the family copy.</small></label>
        <textarea id="slc-staff" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="ghost" disabled={!note.trim()} onClick={() => run(() => { addNote(sid, `Conference (${r.title}): ${note.trim()}`); setNote(''); }, 'Saved to your advisor notes')}>Save note</button>
      </div>}
      <p className="slc-said" role="status">{said}</p>
    </div>
  );
}

// ── Advisor: who has prepared, on the round; each student's Conference mode ──
export function RoundPrep({ r, advisorId, version, onMode }) {
  const p = useMemo(() => prepProgress(r.id, advisorId), [r, advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [list, setList] = useState(false);
  if (!p.total) return null;
  return (
    <div className="slc-adv">
      <div className="tr-strip">
        <b className="tr-count">Prepared: {p.ready} of {p.total}</b>
        {p.started > 0 && <span>{p.started} started</span>}
        <span className="tr-meter" aria-hidden="true"><i style={{ width: `${(p.ready / p.total) * 100}%` }} /></span>
        <button className="linkish" aria-expanded={list} onClick={() => setList(!list)}>{list ? 'Hide who has prepared' : 'Who has prepared'}</button>
      </div>
      {list && <ul className="slc-who-list">{p.rows.map(({ student: s, status, note }) => (
        <li key={s.id}><span><b>{s.name}</b><small>{status === 'ready' ? 'Ready' : status === 'started' ? 'Started, not finished' : 'Not started yet'}{note ? ' · conference note written' : ''}</small></span>
          <button className="ghost small-btn" onClick={() => onMode(s.id)}>Conference mode<span className="sr-only"> for {s.name}</span></button></li>
      ))}</ul>}
    </div>
  );
}
export const prepMark = (roundId, studentId) => {
  const p = prepProgress(roundId).rows.find((x) => x.student.id === studentId);
  return p?.status === 'ready' ? 'Prepared' : p?.status === 'started' ? 'Preparing' : 'Not prepared yet';
};

// ── The family: the line at the end ("What we will try at home"), and the student's. Thai or English. ──
export function FamilyConfNotes({ persona, lang, version, toast }) {
  const rows = useMemo(() => persona.children.flatMap((sid) => {
    const s = getStudent(sid); if (!s) return [];
    return getConferenceRounds().filter((r) => r.studentIds.includes(sid) && r.days.at(-1).date >= daysBefore(30)).filter((r) => {
      const b = confBookingOf(r.id, sid), n = confNoteOf(r.id, sid);
      return (n && (n.family || n.student)) || (b && b.date <= TODAY);
    }).map((r) => ({ r, s }));
  }), [persona.children, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return null;
  return rows.map(({ r, s }) => <FamilyNote key={`${r.id}-${s.id}`} r={r} s={s} lang={lang} version={version} toast={toast} />);
}
function FamilyNote({ r, s, lang, version, toast }) {
  const w = slcWords(lang);
  const n = useMemo(() => confNoteOf(r.id, s.id), [r, s, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const f = s.name.split(' ')[0];
  const by = (x) => (x && x.by !== 'family' && x.by !== 'student' ? shortName(getTeacher(x.by)?.name || '') : '');
  const save = () => { try { writeConfNote(r.id, s.id, 'family', text, 'family'); setEdit(false); toast(w.saved); } catch (e) { toast(errText(lang, e.message)); } };
  return (
    <section className="card-sec slc-fam" aria-labelledby={`slc-fam-${r.id}-${s.id}`}>
      <h2 id={`slc-fam-${r.id}-${s.id}`}>{w.head(f)}</h2>
      <p>{w.intro(f)}</p>
      <dl className="slc-lines">
        <div><dt>{w.home}</dt><dd>{n?.family && !edit ? <><span lang="en">{n.family.text}</span>{by(n.family) && <small>{w.by(by(n.family))}</small>}</> : !edit ? <small>{w.none}</small> : null}</dd></div>
        <div><dt>{w.next(f)}</dt><dd>{n?.student ? <><span lang="en">{n.student.text}</span>{by(n.student) && <small>{w.by(by(n.student))}</small>}</> : <small>{w.notYet(f)}</small>}</dd></div>
      </dl>
      {edit ? <div className="slc-write">
        <label htmlFor={`slc-fl-${s.id}`}>{w.home}</label>
        <textarea id={`slc-fl-${s.id}`} rows={2} maxLength={SLC_MAX.line} placeholder={w.ph} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="cb-btns"><button className="ghost" onClick={() => setEdit(false)}>{w.cancel}</button><button className="primary" disabled={!text.trim()} onClick={save}>{w.save}</button></div>
      </div> : <button className={n?.family ? 'ghost' : 'primary'} onClick={() => { setText(n?.family?.text || ''); setEdit(true); }}>{n?.family ? w.change : w.write}</button>}
    </section>
  );
}
