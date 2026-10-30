import { useEffect, useMemo, useState } from 'react';
import { addGoal, addReflection, addStation, completeGoal, deleteStation, editStation, endorserChoices, getEvent, getStudent, getTeacher, getTeachers, requestFor, setVisibility, snapshot, teachersOf, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { isPilot } from '../auth.js';
import { evidenceFor } from '../upload.js';
import { UploadStatus, useUpload } from '../components/FileAttach.jsx';
import { SUGGEST } from '../components/AddStation.jsx';
import { OpenPrompts } from '../components/ClassPrompts.jsx';
import { SpottedForMe } from '../components/Spotted.jsx';
import { PeerFromClasses, PeerOnMoment } from '../components/PeerFeedback.jsx';
import MomentComments, { NewBadge, useUnread } from '../components/MomentComments.jsx';
import './simple-goals.css';
import { HiddenNotice, ReportButton } from '../components/Report.jsx';
import { Said, SayIt, VoiceNotes, VoiceRecorder } from '../components/Voice.jsx';
import { canRecord } from '../voice.js';
import { photoAlt } from '../a11y.js';

// Simple: the student interface for Years 7 and 8 (and anyone who picks it). Not the full app with parts hidden,
// but its own calmer design: one question per screen, big buttons, plain words, and a map drawn as a few
// friendly tracks. Middle-school students mostly capture and reflect, so presenting is reduced to
// choosing what their family sees.

const PLAIN = { 'school-verified': 'From school', 'teacher-endorsed': 'Checked by a teacher', 'student-added': 'Added by me' };
const STARTERS = ['I learned that…', 'I was proud when…', 'It was hard when…', 'Next time I will…'];
const WARM = ['Nice one!', 'Great work!', 'Added!'];
const PHOTOS = [['stem-club', 'Club'], ['sketchbook', 'Drawing'], ['mural', 'Art'], ['hackathon-1st', 'Event']];
const lineOf = (map, id) => map.lines.find((l) => l.id === id);
// "Ms Hiromi Yamada" → "Ms Yamada": how students say it.
const callName = (n = '') => { const m = /^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+(.+)$/i.exec(n.trim()); return m ? `${m[1]} ${m[2].split(/\s+/).pop()}` : n; };
// The plain badge for a moment: who it is waiting for while a teacher has not checked it yet.
const badgeOf = (e) => {
  const rq = e.verification === 'student-added' && requestFor(e.id);
  const t = rq && getTeacher(rq.teacherId);
  if (t) return rq.status === 'pending' ? { cls: 'v-waiting', text: `Waiting for ${callName(t.name)}` } : { cls: 'v-returned', text: `${callName(t.name)} asked for more` };
  return { cls: `v-${e.verification}`, text: PLAIN[e.verification] };
};
const Badge = ({ e }) => { const b = badgeOf(e); return <em className={`sh-badge ${b.cls}`}>{b.text}</em>; };
// Whom a Simple student can ask to check a moment: the suggested teacher first (the teacher of a class on
// that line), then a few others. Pilot: only their own teachers and advisor. Demo: the demo's own list.
const DEMO_SKIP = ['t-07', 't-09', 't-10'];
function checkers(studentId, lineId) {
  const mine = teachersOf(studentId);
  if (mine.length) return endorserChoices(studentId, [], [lineId]).map((t) => ({ t, why: mine.find((m) => m.teacher.id === t.id && m.lineId === lineId)?.className || mine.find((m) => m.teacher.id === t.id)?.className }));
  if (isPilot()) { const a = getTeacher(getStudent(studentId)?.advisorId); return a ? [{ t: a, why: 'Advisor' }] : []; }
  const all = getTeachers().filter((t) => !DEMO_SKIP.includes(t.id));
  const s = all.find((t) => t.id === SUGGEST[lineId]);
  return (s ? [s, ...all.filter((t) => t !== s)] : all).map((t) => ({ t, why: t.role }));
}

export default function SimpleHome({ map, studentId, toast, version, addRequest, focusId }) {
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (addRequest) setAdding(true); }, [addRequest]); // a nudge's "Add something"
  const [asking, setAsking] = useState(null); // { event, prompt, signal }
  const [open, setOpen] = useState(focusId?.startsWith('ev-') ? focusId : null); // a notification's moment
  const first = map.student.name.split(' ')[0];
  const moments = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection').sort((a, b) => b.date.localeCompare(a.date));
  const signals = map.signals.filter((g) => g.open && g.eventId);
  const latest = moments[0];
  const question = signals[0]
    ? { event: map.events.find((e) => e.id === signals[0].eventId), prompt: signals[0].prompt, signal: signals[0] }
    : moments.find((e) => !e.reflections?.length) ? { event: moments.find((e) => !e.reflections?.length), prompt: `What was the best part of “${moments.find((e) => !e.reflections?.length).title}”?` }
    : latest ? { event: latest, prompt: 'What are you looking forward to next?' } : null;
  const openEvent = map.events.find((e) => e.id === open && e.type !== 'goal');
  const goals = map.events.filter((e) => e.type === 'goal' && !e.requirement).sort((a, b) => a.date.localeCompare(b.date));
  const [planning, setPlanning] = useState(false);
  const [finishing, setFinishing] = useState(null); // a goal just marked done: add a photo and a sentence
  const openGoal = goals.find((e) => e.id === open);
  return (
    <div className="simple">
      <section className="sh-hello">
        <h1>Hi {first}!</h1>
        <p>{moments.length ? `Your journey has ${moments.length} moment${moments.length > 1 ? 's' : ''} so far.` : 'Your journey starts here.'} What have you been up to?</p>
      </section>

      <OpenPrompts studentId={studentId} simple toast={toast} version={version} />
      <SpottedForMe studentId={studentId} simple toast={toast} version={version} />
      <PeerFromClasses studentId={studentId} simple toast={toast} version={version} />

      <div className="sh-actions">
        <button className="sh-card add" onClick={() => setAdding(true)}><span className="sh-ic" aria-hidden="true">＋</span><b>Add something I did</b><small>A club, a project, a match, anything</small></button>
        <button className="sh-card goal" onClick={() => setPlanning(true)}><span className="sh-ic" aria-hidden="true">→</span><b>Something I want to do</b><small>Plan it, and tick it off when it happens</small></button>
        {question && <button className="sh-card ask" onClick={() => setAsking(question)}>
          <span className="sh-ic" aria-hidden="true">?</span><b>{signals.length ? `Your advisor asked you something` : 'Answer a question'}</b>
          <small>{question.prompt}</small>
          {signals.length > 0 && <span className="sh-dot" aria-label="New" />}
        </button>}
      </div>

      <section className="sh-map" aria-label="My journey map">
        <h2>My journey</h2>
        <Tracks map={map} onOpen={setOpen} />
      </section>

      {goals.length > 0 && (
        <section className="sh-coming">
          <h2>Coming up</h2>
          <ul>{goals.map((e) => <li key={e.id}><GoalCard e={e} map={map} toast={toast} onDone={setFinishing} /></li>)}</ul>
        </section>
      )}

      {moments.length > 0 && (
        <section className="sh-feed">
          <h2>My moments</h2>
          <ul>{moments.slice(0, 6).map((e) => { const l = lineOf(map, e.lineIds[0]); return (
            <li key={e.id}><button onClick={() => setOpen(e.id)} style={{ '--c': l?.colour }}>
              {e.evidence.find((v) => v.kind === 'image') ? <img src={e.evidence.find((v) => v.kind === 'image').url} alt="" /> : <span className="sh-ph" aria-hidden="true" />}
              <span><b>{e.title}</b><small>{fmtDate(e.date)} · {l?.name}</small><Badge e={e} /><Unread e={e} /></span>
            </button></li>
          ); })}</ul>
        </section>
      )}

      {planning && <GoalFlow map={map} studentId={studentId} onClose={() => setPlanning(false)} onDone={(e, t) => { setPlanning(false); toast(`“${e.title}” is on your journey as a dashed stop.${t ? ` You asked ${callName(t.name)} to help.` : ''}`); }} />}
      {openGoal && <div className="modal-back" onClick={() => setOpen(null)}><div className="modal sh-flow" role="dialog" aria-label={openGoal.title} onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
        <GoalCard e={openGoal} map={map} toast={toast} onDone={(id) => { setOpen(null); setFinishing(id); }} />
      </div></div>}
      {finishing && <DoneFlow id={finishing} studentId={studentId} toast={toast} onClose={() => setFinishing(null)} />}
      {adding && <QuickAdd map={map} studentId={studentId} toast={toast} onClose={() => setAdding(false)} />}
      {asking && <AskFlow q={asking} studentId={studentId} onClose={() => setAsking(null)} onDone={() => { setAsking(null); toast('Saved. Your advisor can read it.'); }} />}
      {openEvent && <Moment e={openEvent} map={map} toast={toast} onClose={() => setOpen(null)} onReflect={() => { setOpen(null); setAsking({ event: openEvent, prompt: `What did “${openEvent.title}” teach you?` }); }} />}
    </div>
  );
}

// A simpler map: one wide track per line, big dots, no zoom or panning.
function Tracks({ map, onOpen }) {
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const evs = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection');
  const goals = map.events.filter((e) => e.type === 'goal' && !e.requirement);
  const start = evs.length ? evs.map((e) => e.date).sort()[0] : TODAY;
  const end = [TODAY, ...goals.map((e) => e.date)].sort().at(-1);
  const t0 = new Date(start).getTime() - 20 * 86400000, t1 = new Date(end).getTime() + 30 * 86400000;
  const x = (d) => 4 + ((new Date(d).getTime() - t0) / (t1 - t0)) * 92;
  if (!lines.length) return <p className="sh-empty">Your colours appear here once you pick what you are into.</p>;
  return (
    <div className="sh-tracks">
      {lines.map((l) => {
        const on = evs.filter((e) => e.lineIds.includes(l.id));
        const ahead = goals.filter((e) => e.lineIds.includes(l.id));
        return (
          <div key={l.id} className="sh-track" style={{ '--c': l.colour }}>
            <span className="sh-name">{l.name}</span>
            <div className="sh-rail">
              <span className={`sh-bar${on.length ? '' : ' empty'}`} style={{ left: `${on.length ? x(on[0].date) : 4}%`, right: `${100 - x(TODAY)}%` }} />
              {ahead.some((e) => e.date > TODAY) && <span className="sh-bar plan" style={{ left: `${x(TODAY)}%`, right: `${100 - x(ahead.map((e) => e.date).sort().at(-1))}%` }} />}
              {on.map((e) => <button key={e.id} className={`sh-stop v-${e.verification}`} style={{ left: `${x(e.date)}%` }} onClick={() => onOpen(e.id)} aria-label={`${e.title}, ${fmtDate(e.date)}`} title={e.title} />)}
              {ahead.map((e) => <button key={e.id} className="sh-stop goal" style={{ left: `${x(e.date)}%` }} onClick={() => onOpen(e.id)} aria-label={`Planned: ${e.title}, by ${fmtDate(e.date)}`} title={`Planned: ${e.title}`} />)}
              {!on.length && !ahead.length && <span className="sh-wait">Add your first {l.name.toLowerCase()} moment</span>}
            </div>
          </div>
        );
      })}
      <div className="sh-today" style={{ left: `calc(132px + (100% - 132px) * ${x(TODAY) / 100})` }}><span>Today</span></div>
    </div>
  );
}

export function Steps({ n, at }) {
  return <div className="sh-steps" role="img" aria-label={`Step ${at + 1} of ${n}`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i <= at ? 'on' : ''} />)}</div>;
}

// Adding a moment, one question at a time. Also the phone app's "Add a moment" and "Take a photo" (#/me/add,
// #/me/snap), for any student at any level: camera starts on the photo, then asks the same questions.
export function QuickAdd({ map, studentId, toast, onClose, camera = false }) {
  return <AddFlow map={map} studentId={studentId} camera={camera} onClose={onClose} onDone={(e, t) => { onClose(); toast(`${WARM[e.title.length % WARM.length]} “${e.title}” is on your journey.${t ? ` You asked ${t.name} to check it.` : ''}`); }} />;
}
function AddFlow({ map, studentId, onClose, onDone, camera }) {
  const [step, setStep] = useState(camera ? -1 : 0);
  const [f, setF] = useState({ title: '', image: null, imageCaption: 'Photo', line: null, reflection: '', voice: null });
  const [recording, setRecording] = useState(false);
  const [more, setMore] = useState(false);
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const photo = useUpload();
  const pickPhoto = (e) => { const file = e.target.files?.[0]; e.target.value = ''; photo.run(file, (r) => set({ image: evidenceFor(r, file.name).url, imageCaption: 'Photo' })); };
  const who = useMemo(() => (f.line ? checkers(studentId, f.line) : []), [studentId, f.line]);
  const save = (teacher) => {
    const snap = snapshot();
    const e = addStation(studentId, { title: f.title.trim(), lineIds: [f.line], type: 'project', image: f.image, imageCaption: f.imageCaption, files: f.voice ? [f.voice] : [], reflection: f.reflection.trim() || null, visibility: 'advisor', via: 'Simple add', requestFrom: teacher?.id || null });
    onDone(e, teacher, snap);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow" role="dialog" aria-label="Add something I did" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <Steps n={(who.length ? 4 : 3) + (camera ? 1 : 0)} at={step + (camera ? 1 : 0)} />
        {step === -1 && <>
          <Said text="Take a photo" />
          <p className="sh-sub">Of something you did, made or took part in. Then say what it was.</p>
          <div className="sh-shoot snap">
            <label className="sh-photo-btn"><span aria-hidden="true">▣</span>Open the camera<input type="file" accept="image/*" capture="environment" onChange={(e) => { pickPhoto(e); setStep(0); }} /></label>
            <label className="sh-photo-btn cam">Choose a photo<input type="file" accept="image/*" onChange={(e) => { pickPhoto(e); setStep(0); }} /></label>
          </div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>No photo, just write it</button></div>
        </>}
        {step === 0 && <>
          <Said text="What did you do?" />
          <input className="sh-input" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Joined the robotics club" aria-label="What did you do?" onKeyDown={(e) => e.key === 'Enter' && f.title.trim() && !photo.busy && setStep(1)} />
          <SayIt value={f.title} onChange={(title) => set({ title })} />
          <p className="sh-sub">Add a photo if you have one</p>
          <PhotoPick f={f} set={set} photo={photo} pickPhoto={pickPhoto} />
          <div className="sh-next"><button className="primary" disabled={!f.title.trim() || photo.busy} onClick={() => setStep(1)}>{photo.busy ? 'Wait for the photo…' : 'Next'}</button></div>
        </>}
        {step === 1 && <>
          <Said text="Which colour does it go with?" />
          <div className="sh-lines">{lines.map((l) => <button key={l.id} style={{ '--c': l.colour }} className={f.line === l.id ? 'on' : ''} onClick={() => { set({ line: l.id }); setMore(false); setStep(2); }}><i />{l.name}</button>)}</div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button></div>
        </>}
        {step === 2 && <>
          <Said text="What did you learn?" />
          <p className="sh-sub">One or two sentences is plenty. You can skip this.</p>
          <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => set({ reflection: `${f.reflection ? `${f.reflection} ` : ''}${s.replace('…', ' ')}` })}>{s}</button>)}</div>
          <textarea className="sh-input" rows={3} value={f.reflection} onChange={(e) => set({ reflection: e.target.value })} aria-label="What did you learn?" />
          <SayIt value={f.reflection} onChange={(reflection) => set({ reflection })} />
          {f.voice ? <div className="sh-voice"><VoiceNotes evidence={[f.voice]} /><button type="button" className="ghost" onClick={() => set({ voice: null })}>Remove voice note</button></div>
            : recording ? <VoiceRecorder onAdded={(voice) => { set({ voice }); setRecording(false); }} onCancel={() => setRecording(false)} />
            : <VoiceStart onClick={() => setRecording(true)} />}
          <div className="sh-next"><button className="ghost" onClick={() => setStep(1)}>Back</button>
            {who.length ? <button className="primary" onClick={() => setStep(3)}>{f.reflection.trim() ? 'Next' : 'Skip'}</button> : <button className="primary" onClick={() => save(null)}>{f.reflection.trim() ? 'Add it' : 'Skip and add it'}</button>}</div>
          {!who.length && <p className="sh-note">Only you and your advisor can see it at first.</p>}
        </>}
        {step === 3 && who.length > 0 && <>
          <Said text="Ask a teacher to check it?" />
          <p className="sh-sub">A teacher can say it really happened. You can skip this.</p>
          <div className="sh-who">
            <button className="sh-ask" onClick={() => save(who[0].t)}><b>Ask {who[0].t.name}</b>{who[0].why && <small>{who[0].why}</small>}</button>
            {who.length > 1 && !more && <button className="sh-ask other" onClick={() => setMore(true)}><b>Someone else</b></button>}
            {more && <div className="sh-others" role="group" aria-label="Other teachers">{who.slice(1, 7).map(({ t, why }) => <button key={t.id} className="sh-ask other" onClick={() => save(t)}><b>{t.name}</b>{why && <small>{why}</small>}</button>)}</div>}
          </div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(2)}>Back</button><button className="ghost sh-notnow" onClick={() => save(null)}>Not now, just add it</button></div>
          <p className="sh-note">Only you, your advisor and the teacher you ask can see it at first.</p>
        </>}
      </div>
    </div>
  );
}

// The photo part of a flow: preview, or big "take or choose" buttons (a camera button on a phone), and in the demo the sample pictures.
function PhotoPick({ f, set, photo, pickPhoto }) {
  const phone = useMemo(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, []);
  const samples = !isPilot(); // the sample pictures are demo props
  return <>
    {f.image && !photo.busy
      ? <div className="sh-preview"><img src={f.image} alt="Your photo" /><button type="button" className="ghost" onClick={() => set({ image: null })}>Remove photo</button></div>
      : <div className="sh-shoot">
        <label className={`sh-photo-btn${photo.busy ? ' busy' : ''}`}><span aria-hidden="true">▣</span>{photo.busy ? 'Uploading your photo…' : 'Take or choose a photo'}<input type="file" accept="image/*" disabled={photo.busy} onChange={pickPhoto} /></label>
        {phone && !photo.busy && <label className="sh-photo-btn cam">Use the camera<input type="file" accept="image/*" capture="environment" onChange={pickPhoto} /></label>}
      </div>}
    <UploadStatus up={photo} />
    {samples && !photo.busy && <div className="sh-photos">{PHOTOS.map(([n, l]) => <button key={n} className={f.image?.includes(n) ? 'on' : ''} onClick={() => set({ image: f.image?.includes(n) ? null : `evidence/${n}.svg`, imageCaption: l })}><img src={`evidence/${n}.svg`} alt={l} /></button>)}</div>}
  </>;
}

// ── Goals, the Simple way: something I want to do, as a dashed stop ahead of Today (api.addGoal). ──
// Friendly examples by the name of a line; a line without any gets the general ones.
const IDEAS = [
  [/scien|chem|bio|phys(?!ical)/i, ['Enter the science fair', 'Grow a plant from seed and track it']],
  [/music|band|choir|sing/i, ['Play a song at the concert', 'Learn a new piece on my instrument']],
  [/theat|drama/i, ['Get a part in the school play', 'Help backstage at a show']],
  [/\bart|draw|paint/i, ['Finish a sketchbook', 'Put a piece in the art show']],
  [/sport|physical|health|football|swim/i, ['Make a school team', 'Run 5 km without stopping']],
  [/design|robot|comput|code|tech/i, ['Build a robot that moves on its own', 'Make a simple game']],
  [/lang|english|thai|chinese|french|spanish|liter/i, ['Read five books this term', 'Write a story for the school magazine']],
  [/math/i, ['Take part in a maths competition', 'Learn my times tables up to 15']],
  [/service|communit|environment|green/i, ['Help at a beach clean-up', 'Start a recycling bin in our classroom']],
];
export const ideasFor = (l) => IDEAS.find(([re]) => re.test(l.name))?.[1] || ['Join a new club', 'Try something I have never done'];
const addDays = (n) => new Date(Date.parse(TODAY) + n * 864e5).toISOString().slice(0, 10);
// Terms end in December, March and June (NIST's calendar, near enough for a target date).
function whens() {
  const y = +TODAY.slice(0, 4) - (+TODAY.slice(5, 7) < 8 ? 1 : 0);
  const term = [`${y}-12-11`, `${y + 1}-03-26`, `${y + 1}-06-11`].find((d) => d > addDays(7)) || `${y + 1}-06-11`;
  return [['In a few weeks', addDays(21)], ['By the end of this term', term], ['This year', `${y + 1}-06-11`]];
}
const callOf = (id) => callName(getTeacher(id)?.name || 'your teacher');
function sponsorLine(e) {
  const sp = e.sponsor; if (!sp) return null;
  const n = callOf(sp.teacherId);
  return sp.status === 'invited' ? `Waiting for ${n} to say yes` : sp.status === 'accepted' ? `${n} is helping you` : sp.status === 'declined' ? `${n} can't help this time` : null;
}

function GoalFlow({ map, studentId, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ title: '', line: null, date: null });
  const [more, setMore] = useState(false);
  const [pick, setPick] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const ideas = lines.flatMap((l) => ideasFor(l).map((t) => [t, l])).filter(([t], i, a) => a.findIndex(([u]) => u === t) === i).slice(0, 6);
  const who = useMemo(() => (f.line ? checkers(studentId, f.line) : []), [studentId, f.line]);
  const save = (t, date = f.date) => onDone(addGoal(studentId, { title: f.title.trim(), date, lineId: f.line, summary: '', checkIn: true, sponsor: t?.id || null, sponsorNote: '' }), t);
  const when = (date) => { set({ date }); if (who.length) setStep(3); else save(null, date); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow" role="dialog" aria-label="Something I want to do" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <Steps n={!f.line || who.length ? 4 : 3} at={step} />
        {step === 0 && <>
          <Said text="What do you want to do?" />
          <input className="sh-input" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Enter the science fair" aria-label="What do you want to do?" onKeyDown={(e) => e.key === 'Enter' && f.title.trim().length > 3 && setStep(1)} />
          <SayIt value={f.title} onChange={(title) => set({ title })} />
          {ideas.length > 0 && <><p className="sh-sub">Some ideas</p>
            <div className="sh-starters">{ideas.map(([t, l]) => <button key={t} className="sh-idea" style={{ '--c': l.colour }} onClick={() => { set({ title: t, line: l.id }); setStep(1); }}>{t}</button>)}</div></>}
          <div className="sh-next"><button className="primary" disabled={f.title.trim().length < 4} onClick={() => setStep(1)}>Next</button></div>
        </>}
        {step === 1 && <>
          <Said text="Which colour does it go with?" />
          <div className="sh-lines">{lines.map((l) => <button key={l.id} style={{ '--c': l.colour }} className={f.line === l.id ? 'on' : ''} onClick={() => { set({ line: l.id }); setMore(false); setStep(2); }}><i />{l.name}</button>)}</div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button></div>
        </>}
        {step === 2 && <>
          <Said text="When do you want to do it by?" />
          <div className="sh-when">{whens().map(([label, d]) => <button key={label} onClick={() => when(d)}><b>{label}</b><small>By {fmtDate(d)}</small></button>)}
            {pick
              ? <label className="sh-date">Pick a date<input type="date" autoFocus min={addDays(1)} value={f.date || ''} onChange={(e) => set({ date: e.target.value })} /></label>
              : <button onClick={() => setPick(true)}><b>Pick a date</b><small>On a calendar</small></button>}</div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(1)}>Back</button>{pick && <button className="primary" disabled={!f.date || f.date <= TODAY} onClick={() => when(f.date)}>Next</button>}</div>
        </>}
        {step === 3 && who.length > 0 && <>
          <Said text="Want a teacher to help you with it?" />
          <p className="sh-sub">They can give you tips along the way, and say it really happened when you do it.</p>
          <div className="sh-who">
            <button className="sh-ask" onClick={() => save(who[0].t)}><b>Ask {who[0].t.name}</b>{who[0].why && <small>{who[0].why}</small>}</button>
            {who.length > 1 && !more && <button className="sh-ask other" onClick={() => setMore(true)}><b>Someone else</b></button>}
            {more && <div className="sh-others" role="group" aria-label="Other teachers">{who.slice(1, 7).map(({ t, why }) => <button key={t.id} className="sh-ask other" onClick={() => save(t)}><b>{t.name}</b>{why && <small>{why}</small>}</button>)}</div>}
          </div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(2)}>Back</button><button className="ghost sh-notnow" onClick={() => save(null)}>Not now</button></div>
          <p className="sh-note">Your advisor can see it too.</p>
        </>}
      </div>
    </div>
  );
}

// A goal in "Coming up" (and when its dashed stop is tapped): who is helping, "I did it!", or drop it (api.deleteStation).
function GoalCard({ e, map, toast, onDone }) {
  const [drop, setDrop] = useState(false);
  const l = lineOf(map, e.lineIds[0]);
  const sp = sponsorLine(e);
  return (
    <div className="sh-goal" style={{ '--c': l?.colour }}>
      <span className="sh-line">{l?.name}</span>
      <b>{e.title}</b>
      <small>{e.date < TODAY ? `You planned it for ${fmtDate(e.date)}` : `By ${fmtDate(e.date)}`}{sp ? ` · ${sp}` : ''}</small>
      {e.sponsor?.status === 'accepted' && e.sponsor.expectations && <p className="sh-tip">{callOf(e.sponsor.teacherId)}: “{e.sponsor.expectations}”</p>}
      {drop
        ? <div className="sh-goal-do"><span>Take it off your journey?</span><button className="ghost" onClick={() => { deleteStation(e.id); toast(`“${e.title}” is off your journey.`); }}>Yes, take it off</button><button className="ghost" onClick={() => setDrop(false)}>Keep it</button></div>
        : <div className="sh-goal-do"><button className="primary" onClick={() => { completeGoal(e.id); onDone(e.id); }}>I did it!</button><button className="ghost" onClick={() => setDrop(true)}>Not doing this any more</button></div>}
    </div>
  );
}

// After "I did it!" (api.completeGoal: the goal is a moment now, and a sponsor gets it to endorse):
// add a photo, then one sentence. Both can be skipped.
function DoneFlow({ id, studentId, toast, onClose }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ image: null, imageCaption: 'Photo', text: '' });
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const photo = useUpload();
  const pickPhoto = (ev) => { const file = ev.target.files?.[0]; ev.target.value = ''; photo.run(file, (r) => set({ image: evidenceFor(r, file.name).url, imageCaption: 'Photo' })); };
  const [e] = useState(() => getEvent(id));
  if (!e) return null;
  const sp = e.sponsor?.status === 'done' ? callOf(e.sponsor.teacherId) : null;
  const finish = () => {
    if (photo.busy) return;
    if (f.image) editStation(e.id, { evidence: [...(getEvent(e.id)?.evidence || []), { kind: 'image', url: f.image, caption: f.imageCaption }] });
    if (f.text.trim()) addReflection({ studentId, eventId: e.id, prompt: 'How did it go?', text: f.text.trim(), visibility: 'advisor' });
    onClose();
    toast(`${WARM[e.title.length % WARM.length]} “${e.title}” is a real stop on your journey now.${sp ? ` ${sp} can check it.` : ''}`);
  };
  return (
    <div className="modal-back" onClick={finish}>
      <div className="modal sh-flow" role="dialog" aria-label="I did it" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={finish} aria-label="Close">×</button>
        <Steps n={2} at={step} />
        {step === 0 && <>
          <Said text="You did it! Add a photo?" />
          <p className="sh-sub">Of “{e.title}”. You can skip this.</p>
          <PhotoPick f={f} set={set} photo={photo} pickPhoto={pickPhoto} />
          <div className="sh-next"><button className="primary" disabled={photo.busy} onClick={() => setStep(1)}>{photo.busy ? 'Wait for the photo…' : f.image ? 'Next' : 'Skip'}</button></div>
        </>}
        {step === 1 && <>
          <Said text="How did it go?" />
          <p className="sh-sub">One sentence is plenty.</p>
          <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => set({ text: `${f.text ? `${f.text} ` : ''}${s.replace('…', ' ')}` })}>{s}</button>)}</div>
          <textarea className="sh-input" rows={3} autoFocus value={f.text} onChange={(ev) => set({ text: ev.target.value })} aria-label="How did it go?" />
          <SayIt value={f.text} onChange={(text) => set({ text })} />
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button><button className="primary" onClick={finish}>{f.text.trim() ? 'Save' : 'Skip and finish'}</button></div>
          {sp && <p className="sh-note">{sp} helped with this, so it goes to them to check.</p>}
        </>}
      </div>
    </div>
  );
}

function AskFlow({ q, studentId, onClose, onDone }) {
  const [text, setText] = useState('');
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow" role="dialog" aria-label="Answer a question" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <p className="sh-sub">About “{q.event.title}”</p>
        <Said text={q.prompt} />
        <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => setText(`${text ? `${text} ` : ''}${s.replace('…', ' ')}`)}>{s}</button>)}</div>
        <textarea className="sh-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />
        <SayIt value={text} onChange={setText} />
        <div className="sh-next"><button className="primary" disabled={text.trim().length < 5} onClick={() => { addReflection({ studentId, eventId: q.event.id, prompt: q.prompt, text: text.trim(), visibility: 'advisor', signal: q.signal }); onDone(); }}>Save my answer</button></div>
      </div>
    </div>
  );
}

const Unread = ({ e }) => <NewBadge n={useUnread(e)} />;
// Opens the voice recorder (only where the browser can record).
const VoiceStart = ({ onClick, label = 'Or say it: record a voice note' }) => (canRecord()
  ? <button type="button" className="sh-photo-btn cam sh-voice-btn" onClick={onClick}><span aria-hidden="true">●</span>{label}</button> : null);
function Moment({ e, map, onClose, onReflect, toast }) {
  const [recording, setRecording] = useState(false);
  const img = e.evidence.find((v) => v.kind === 'image');
  const l = lineOf(map, e.lineIds[0]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow sh-moment" role="dialog" aria-label={e.title} onClick={(ev) => ev.stopPropagation()} style={{ '--c': l?.colour }}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        {img && <img src={img.url} alt={photoAlt(img, e.title)} />}
        <span className="sh-line">{l?.name}</span>
        <h2>{e.title}</h2>
        <HiddenNotice item={e} />
        <p className="sh-sub">{fmtDate(e.date)} · <Badge e={e} /></p>
        {e.summary && <p>{e.summary}</p>}
        {e.reflections?.map((r) => <blockquote key={r.id}>{r.text}</blockquote>)}
        <VoiceNotes evidence={e.evidence} />
        {e.verification === 'student-added' && (recording
          ? <VoiceRecorder onAdded={(ev) => { editStation(e.id, { evidence: [...(getEvent(e.id)?.evidence || []), ev] }); setRecording(false); toast('Your voice note is on this moment.'); }} onCancel={() => setRecording(false)} />
          : <VoiceStart onClick={() => setRecording(true)} label="Add a voice note" />)}
        <div className="sh-next"><button className="primary" onClick={onReflect}>{e.reflections?.length ? 'Add another thought' : 'What did I learn?'}</button></div>
        <MomentComments key={`c-${e.id}`} event={e} simple toast={toast} />
        <PeerOnMoment key={`pf-${e.id}`} event={e} simple toast={toast} />
        <ReportButton event={e} simple toast={toast} />
      </div>
    </div>
  );
}

// The only sharing a Simple student needs: which moments their family sees.
export function ShowFamily({ map, toast }) {
  const moments = useMemo(() => map.events.filter((e) => e.type !== 'goal').sort((a, b) => b.date.localeCompare(a.date)), [map]);
  const first = map.student.name.split(' ')[0];
  return (
    <div className="simple">
      <section className="sh-hello">
        <h1>Show my family</h1>
        <p>Your family can see the moments you share with your advisor. Keep anything you like just for you, {first}.</p>
      </section>
      <ul className="sh-fam">{moments.map((e) => { const shared = e.visibility !== 'private'; return (
        <li key={e.id}>
          <span><b>{e.title}</b><small>{fmtDate(e.date)}</small></span>
          <div className="seg" role="radiogroup" aria-label={`Who sees ${e.title}`}>
            <button className={!shared ? 'on' : ''} aria-checked={!shared} role="radio" onClick={() => { if (shared) { const snap = snapshot(); setVisibility(e.id, 'private'); toast('Just for you now', snap); } }}>Just me</button>
            <button className={shared ? 'on' : ''} aria-checked={shared} role="radio" onClick={() => { if (!shared) { const snap = snapshot(); setVisibility(e.id, 'advisor'); toast('Your advisor and family can see it', snap); } }}>My advisor and family</button>
          </div>
        </li>
      ); })}</ul>
      {!moments.length && <p className="sh-empty">When you add moments, you can choose here who sees them.</p>}
    </div>
  );
}
