import { useMemo, useState } from 'react';
import { addReflection, addStation, setVisibility, snapshot, TODAY } from '../api.js';
import { fmtDate } from '../format.js';

// Simple: the student interface for Years 7 and 8 (and anyone who picks it). Not the full app with parts hidden,
// but its own calmer design: one question per screen, big buttons, plain words, and a map drawn as a few
// friendly tracks. Middle-school students mostly capture and reflect, so presenting is reduced to
// choosing what their family sees.

const PLAIN = { 'school-verified': 'From school', 'teacher-endorsed': 'Checked by a teacher', 'student-added': 'Added by me' };
const STARTERS = ['I learned that…', 'I was proud when…', 'It was hard when…', 'Next time I will…'];
const WARM = ['Nice one!', 'Great work!', 'Added!'];
const PHOTOS = [['stem-club', 'Club'], ['sketchbook', 'Drawing'], ['mural', 'Art'], ['hackathon-1st', 'Event']];
const lineOf = (map, id) => map.lines.find((l) => l.id === id);

export default function SimpleHome({ map, studentId, toast }) {
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(null); // { event, prompt, signal }
  const [open, setOpen] = useState(null);
  const first = map.student.name.split(' ')[0];
  const moments = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection').sort((a, b) => b.date.localeCompare(a.date));
  const signals = map.signals.filter((g) => g.open && g.eventId);
  const latest = moments[0];
  const question = signals[0]
    ? { event: map.events.find((e) => e.id === signals[0].eventId), prompt: signals[0].prompt, signal: signals[0] }
    : moments.find((e) => !e.reflections?.length) ? { event: moments.find((e) => !e.reflections?.length), prompt: `What was the best part of “${moments.find((e) => !e.reflections?.length).title}”?` }
    : latest ? { event: latest, prompt: 'What are you looking forward to next?' } : null;
  const openEvent = map.events.find((e) => e.id === open);
  return (
    <div className="simple">
      <section className="sh-hello">
        <h1>Hi {first}!</h1>
        <p>{moments.length ? `Your journey has ${moments.length} moment${moments.length > 1 ? 's' : ''} so far.` : 'Your journey starts here.'} What have you been up to?</p>
      </section>

      <div className="sh-actions">
        <button className="sh-card add" onClick={() => setAdding(true)}><span className="sh-ic" aria-hidden="true">＋</span><b>Add something I did</b><small>A club, a project, a match, anything</small></button>
        <button className="sh-card ask" disabled={!question} onClick={() => setAsking(question)}>
          <span className="sh-ic" aria-hidden="true">?</span><b>{signals.length ? `Your advisor asked you something` : 'Answer a question'}</b>
          <small>{question ? question.prompt : 'Nothing to answer right now'}</small>
          {signals.length > 0 && <span className="sh-dot" aria-label="New" />}
        </button>
      </div>

      <section className="sh-map" aria-label="My journey map">
        <h2>My journey</h2>
        <Tracks map={map} onOpen={setOpen} />
      </section>

      {moments.length > 0 && (
        <section className="sh-feed">
          <h2>My moments</h2>
          <ul>{moments.slice(0, 6).map((e) => { const l = lineOf(map, e.lineIds[0]); return (
            <li key={e.id}><button onClick={() => setOpen(e.id)} style={{ '--c': l?.colour }}>
              {e.evidence.find((v) => v.kind === 'image') ? <img src={e.evidence.find((v) => v.kind === 'image').url} alt="" /> : <span className="sh-ph" aria-hidden="true" />}
              <span><b>{e.title}</b><small>{fmtDate(e.date)} · {l?.name}</small><em className={`sh-badge v-${e.verification}`}>{PLAIN[e.verification]}</em></span>
            </button></li>
          ); })}</ul>
        </section>
      )}

      {adding && <AddFlow map={map} studentId={studentId} onClose={() => setAdding(false)} onDone={(e) => { setAdding(false); toast(`${WARM[e.title.length % WARM.length]} “${e.title}” is on your journey.`); }} />}
      {asking && <AskFlow q={asking} studentId={studentId} onClose={() => setAsking(null)} onDone={() => { setAsking(null); toast('Saved. Your advisor can read it.'); }} />}
      {openEvent && <Moment e={openEvent} map={map} onClose={() => setOpen(null)} onReflect={() => { setOpen(null); setAsking({ event: openEvent, prompt: `What did “${openEvent.title}” teach you?` }); }} />}
    </div>
  );
}

// A simpler map: one wide track per line, big dots, no zoom or panning.
function Tracks({ map, onOpen }) {
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const evs = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection');
  const start = evs.length ? evs.map((e) => e.date).sort()[0] : TODAY;
  const t0 = new Date(start).getTime() - 20 * 86400000, t1 = new Date(TODAY).getTime() + 30 * 86400000;
  const x = (d) => 4 + ((new Date(d).getTime() - t0) / (t1 - t0)) * 92;
  if (!lines.length) return <p className="sh-empty">Your colours appear here once you pick what you are into.</p>;
  return (
    <div className="sh-tracks">
      {lines.map((l) => {
        const on = evs.filter((e) => e.lineIds.includes(l.id));
        return (
          <div key={l.id} className="sh-track" style={{ '--c': l.colour }}>
            <span className="sh-name">{l.name}</span>
            <div className="sh-rail">
              <span className={`sh-bar${on.length ? '' : ' empty'}`} style={{ left: `${on.length ? x(on[0].date) : 4}%`, right: `${100 - x(TODAY)}%` }} />
              {on.map((e) => <button key={e.id} className={`sh-stop v-${e.verification}`} style={{ left: `${x(e.date)}%` }} onClick={() => onOpen(e.id)} aria-label={`${e.title}, ${fmtDate(e.date)}`} title={e.title} />)}
              {!on.length && <span className="sh-wait">Add your first {l.name.toLowerCase()} moment</span>}
            </div>
          </div>
        );
      })}
      <div className="sh-today" style={{ left: `calc(132px + (100% - 132px) * ${x(TODAY) / 100})` }}><span>Today</span></div>
    </div>
  );
}

function Steps({ n, at }) {
  return <div className="sh-steps" aria-label={`Step ${at + 1} of ${n}`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i <= at ? 'on' : ''} />)}</div>;
}

// Adding a moment, one question at a time.
function AddFlow({ map, studentId, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ title: '', image: null, line: null, reflection: '' });
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = () => {
    const snap = snapshot();
    const e = addStation(studentId, { title: f.title.trim(), lineIds: [f.line], type: 'project', image: f.image, imageCaption: 'Photo', reflection: f.reflection.trim() || null, visibility: 'advisor', via: 'Simple add' });
    onDone(e, snap);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow" role="dialog" aria-label="Add something I did" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <Steps n={3} at={step} />
        {step === 0 && <>
          <h2>What did you do?</h2>
          <input className="sh-input" autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Joined the robotics club" onKeyDown={(e) => e.key === 'Enter' && f.title.trim() && setStep(1)} />
          <p className="sh-sub">Add a photo if you have one</p>
          <div className="sh-photos">{PHOTOS.map(([n, l]) => <button key={n} className={f.image?.includes(n) ? 'on' : ''} onClick={() => set({ image: f.image?.includes(n) ? null : `evidence/${n}.svg` })}><img src={`evidence/${n}.svg`} alt={l} /></button>)}</div>
          <div className="sh-next"><button className="primary" disabled={!f.title.trim()} onClick={() => setStep(1)}>Next</button></div>
        </>}
        {step === 1 && <>
          <h2>Which colour does it go with?</h2>
          <div className="sh-lines">{lines.map((l) => <button key={l.id} style={{ '--c': l.colour }} className={f.line === l.id ? 'on' : ''} onClick={() => { set({ line: l.id }); setStep(2); }}><i />{l.name}</button>)}</div>
          <div className="sh-next"><button className="ghost" onClick={() => setStep(0)}>Back</button></div>
        </>}
        {step === 2 && <>
          <h2>What did you learn?</h2>
          <p className="sh-sub">One or two sentences is plenty. You can skip this.</p>
          <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => set({ reflection: `${f.reflection ? `${f.reflection} ` : ''}${s.replace('…', ' ')}` })}>{s}</button>)}</div>
          <textarea className="sh-input" rows={3} value={f.reflection} onChange={(e) => set({ reflection: e.target.value })} />
          <div className="sh-next"><button className="ghost" onClick={() => setStep(1)}>Back</button><button className="primary" onClick={save}>{f.reflection.trim() ? 'Add it' : 'Skip and add it'}</button></div>
          <p className="sh-note">Only you and your advisor can see it at first.</p>
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
        <h2>{q.prompt}</h2>
        <div className="sh-starters">{STARTERS.map((s) => <button key={s} onClick={() => setText(`${text ? `${text} ` : ''}${s.replace('…', ' ')}`)}>{s}</button>)}</div>
        <textarea className="sh-input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
        <div className="sh-next"><button className="primary" disabled={text.trim().length < 5} onClick={() => { addReflection({ studentId, eventId: q.event.id, prompt: q.prompt, text: text.trim(), visibility: 'advisor', signal: q.signal }); onDone(); }}>Save my answer</button></div>
      </div>
    </div>
  );
}

function Moment({ e, map, onClose, onReflect }) {
  const img = e.evidence.find((v) => v.kind === 'image');
  const l = lineOf(map, e.lineIds[0]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sh-flow sh-moment" role="dialog" aria-label={e.title} onClick={(ev) => ev.stopPropagation()} style={{ '--c': l?.colour }}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        {img && <img src={img.url} alt={img.caption} />}
        <span className="sh-line">{l?.name}</span>
        <h2>{e.title}</h2>
        <p className="sh-sub">{fmtDate(e.date)} · <em className={`sh-badge v-${e.verification}`}>{PLAIN[e.verification]}</em></p>
        {e.summary && <p>{e.summary}</p>}
        {e.reflections?.map((r) => <blockquote key={r.id}>{r.text}</blockquote>)}
        <div className="sh-next"><button className="primary" onClick={onReflect}>{e.reflections?.length ? 'Add another thought' : 'What did I learn?'}</button></div>
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
