import { useEffect, useRef, useState } from 'react';
import { getLang } from '../api.js';
import { evidenceFor } from '../upload.js';
import { UploadStatus, evKind, useUpload } from './FileAttach.jsx';
import { MAX_SECS, canListen, canRecord, canSpeak, clock, hush, joinSpoken, markMicNoteSeen, micNoteSeen, onReadAloud, readAloudOn, recognitionCtor, recordType, setReadAloud, speak, speechLang, transcript, voiceFileName } from '../voice.js';
import './voice.css';
import { shown } from '../thai.js';

// Speak to type: a mic beside a text box. What is said appears as it is said, and stays editable.
export function MicButton({ value = '', onChange, label = 'Say it instead of typing' }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(() => !micNoteSeen());
  const rec = useRef(null), val = useRef(value), out = useRef(null), st = useRef({ base: '', from: 0 });
  val.current = value;
  useEffect(() => () => rec.current?.abort?.(), []);
  if (!canListen()) return null;
  const stop = () => rec.current?.stop();
  const start = () => {
    setErr(null); markMicNoteSeen();
    const R = recognitionCtor();
    let r; try { r = new R(); } catch { setErr('Speaking to type does not work in this browser. You can type instead.'); return; }
    r.lang = speechLang(getLang()); r.interimResults = true; r.continuous = true;
    st.current = { base: val.current, from: 0 }; out.current = val.current;
    r.onresult = (e) => {
      // Typed something while listening: keep it, and carry on from what is said next.
      if (val.current !== out.current) st.current = { base: val.current, from: e.resultIndex };
      const [fin, mid] = transcript(e.results, st.current.from);
      out.current = joinSpoken(st.current.base, [fin, mid].filter(Boolean).join(' '));
      onChange(out.current);
    };
    r.onerror = (e) => setErr(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is not allowed here. You can type instead.' : e.error === 'no-speech' ? 'I did not hear anything. Try again, a bit closer.' : null);
    r.onend = () => { setOn(false); rec.current = null; };
    try { r.start(); rec.current = r; setOn(true); } catch { setErr('The microphone could not start. You can type instead.'); }
  };
  return (
    <span className="vc-mic-wrap">
      <button type="button" className={`vc-mic${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? 'Stop listening' : label} title={on ? 'Stop listening' : label} onClick={on ? stop : start}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span>{on ? 'Listening… tap to stop' : 'Say it'}</span>
      </button>
      {err && <span className="up-error" role="alert">{err}</span>}
      {note && <small className="vc-note">Your browser turns what you say into words. This app does not record or keep your voice. <button type="button" className="linkish" onClick={() => setNote(false)}>OK</button></small>}
    </span>
  );
}

// A text box with the mic under it (Simple flows, class answers, the term reflection).
export function SayIt({ value, onChange }) {
  return canListen() ? <div className="vc-say"><MicButton value={value} onChange={onChange} /></div> : null;
}

// Read aloud: a speaker beside a question. With "Read questions aloud" on, it reads by itself when it opens.
export function SpeakButton({ text, auto = true, label = 'Read this out loud' }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!canSpeak() || !auto || !readAloudOn() || !text) return undefined;
    const u = speak(shown(text)); if (u) { setOn(true); u.onend = () => setOn(false); }
    return () => hush();
  }, [text, auto]);
  const mine = useRef(false); mine.current = on;
  useEffect(() => () => { if (mine.current) hush(); }, []);
  if (!canSpeak() || !text) return null;
  const go = () => { if (on) { hush(); setOn(false); return; } const u = speak(shown(text)); if (u) { setOn(true); u.onend = u.onerror = () => setOn(false); } };
  return (
    <button type="button" className={`vc-speak${on ? ' on' : ''}`} aria-label={on ? 'Stop reading' : label} title={on ? 'Stop reading' : label} aria-pressed={on} onClick={go}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  );
}
// A heading that can be read out.
export const Said = ({ as: H = 'h2', text, children, className = '' }) => <H className={`vc-said ${className}`.trim()}><span>{children ?? text}</span><SpeakButton text={text} /></H>;

// The display menu's "Read questions aloud" (this device only).
export function ReadAloudSetting({ T = (s) => s }) {
  const [on, setOn] = useState(readAloudOn);
  useEffect(() => onReadAloud(setOn), []);
  if (!canSpeak()) return null;
  return <>
    <div className="menu-title">{T('Read questions aloud')}</div>
    <div className="vm-row seg" role="radiogroup" aria-label={T('Read questions aloud')}>{[[false, 'Off'], [true, 'On']].map(([k, l]) => <button key={l} role="radio" aria-checked={on === k} className={on === k ? 'on' : ''} onClick={() => { setReadAloud(k); if (k) speak(T('Questions will be read out loud.')); else hush(); }}>{T(l)}</button>)}</div>
  </>;
}

// A voice note, the Simple way: one big Record, then Stop (or 60 seconds), Play again, Use this or Record again.
// "Use this" uploads it like any file (offline: kept on the phone, src/outbox.js) and hands back an evidence item.
export function VoiceRecorder({ onAdded, onCancel }) {
  const [phase, setPhase] = useState('idle'); // idle | rec | done
  const [secs, setSecs] = useState(0);
  const [clip, setClip] = useState(null); // { file, url }
  const [err, setErr] = useState(null);
  const up = useUpload();
  const r = useRef(null), timer = useRef(null), au = useRef(null);
  useEffect(() => () => { clearInterval(timer.current); if (r.current?.state === 'recording') r.current.stop(); }, []);
  useEffect(() => () => clip && URL.revokeObjectURL(clip.url), [clip]);
  if (!canRecord()) return null;
  const start = async () => {
    setErr(null);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setErr('The microphone could not be used. Check that this page is allowed to use it.'); return; }
    const type = recordType();
    let m; try { m = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch { stream.getTracks().forEach((t) => t.stop()); setErr('Recording does not work in this browser.'); return; }
    const chunks = [], t0 = Date.now();
    m.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    m.onstop = () => {
      clearInterval(timer.current); stream.getTracks().forEach((t) => t.stop());
      const mime = (m.mimeType || type || 'audio/webm').split(';')[0];
      const file = new File(chunks, voiceFileName(mime), { type: mime });
      setClip({ file, url: URL.createObjectURL(file) }); setPhase('done');
    };
    timer.current = setInterval(() => { const s = (Date.now() - t0) / 1000; setSecs(Math.min(MAX_SECS, Math.round(s))); if (s >= MAX_SECS && m.state === 'recording') m.stop(); }, 250);
    m.start(1000); r.current = m; setSecs(0); setPhase('rec');
  };
  const use = () => up.run(clip.file, (res) => onAdded?.(evidenceFor(res, 'Voice note'), res));
  return (
    <div className="vc-rec" role="group" aria-label="Voice note">
      {phase === 'idle' && <button type="button" className="vc-big" onClick={start}><span className="vc-dot" aria-hidden="true" />Record</button>}
      {phase === 'rec' && <>
        <button type="button" className="vc-big stop" onClick={() => r.current?.stop()} autoFocus><span className="vc-sq" aria-hidden="true" />Stop</button>
        <p className="vc-time" role="timer" aria-live="off">{clock(secs)} <small>of {clock(MAX_SECS)}</small></p>
      </>}
      {phase === 'done' && clip && <>
        <audio ref={au} className="vc-play" controls src={clip.url} aria-label="Your voice note" />
        <div className="vc-row">
          <button type="button" className="ghost" disabled={up.busy} onClick={() => { const a = au.current; if (a) { a.currentTime = 0; a.play().catch(() => {}); } }}>Play again</button>
          <button type="button" className="ghost" disabled={up.busy} onClick={() => { setClip(null); setPhase('idle'); }}>Record again</button>
          <button type="button" className="primary vc-use" disabled={up.busy} onClick={use}>{up.busy ? 'Saving…' : 'Use this'}</button>
        </div>
      </>}
      {onCancel && phase !== 'rec' && !up.busy && <button type="button" className="linkish vc-cancel" onClick={onCancel}>No voice note</button>}
      {err ? <p className="up-error" role="alert">{err}</p> : <UploadStatus up={up} />}
    </div>
  );
}

// Voice notes and other recordings on a moment, as players.
export function VoiceNotes({ evidence = [] }) {
  const list = evidence.filter((ev) => ev?.url && evKind(ev) === 'audio');
  if (!list.length) return null;
  return <ul className="vc-notes">{list.map((ev, i) => <li key={ev.url.slice(0, 80) + i}><span aria-hidden="true">♪</span><audio controls preload="metadata" src={ev.url} aria-label={ev.caption || 'Voice note'} /></li>)}</ul>;
}
