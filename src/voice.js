// Voice for younger students: speak to type (the browser's SpeechRecognition), read aloud (speechSynthesis) and short
// voice notes (MediaRecorder, uploaded like any file). Everything is feature-detected: no support, no button.
// Nothing here sends speech anywhere; recognition is the browser's own.

export const MAX_SECS = 60;
const g = () => (typeof window === 'undefined' ? {} : window);

export const recognitionCtor = (w = g()) => w.SpeechRecognition || w.webkitSpeechRecognition || null;
export const canListen = (w = g()) => typeof recognitionCtor(w) === 'function';
export const canSpeak = (w = g()) => !!w.speechSynthesis && typeof w.SpeechSynthesisUtterance === 'function';
export const canRecord = (w = g()) => !!w.navigator?.mediaDevices?.getUserMedia && typeof w.MediaRecorder === 'function';

// Recognition follows the person's language; reading aloud follows the words (prompts are mostly English).
export const speechLang = (lang) => (lang === 'th' ? 'th-TH' : 'en-GB');
export const voiceLangOf = (text = '') => (/[฀-๿]/.test(text) ? 'th-TH' : 'en-GB');

// What was already typed, then what was said: one space between, a capital at the start of a sentence.
export function joinSpoken(base = '', spoken = '') {
  const s = spoken.replace(/\s+/g, ' ').trim();
  if (!s) return base;
  const b = base.replace(/\s+$/, '');
  const cap = !b || /[.!?]$/.test(b);
  const said = cap ? s[0].toUpperCase() + s.slice(1) : s;
  return b ? `${b} ${said}` : said;
}
// SpeechRecognition results from index `from` on: [final text, interim text].
export function transcript(results, from = 0) {
  let fin = '', mid = '';
  for (let i = from; i < (results?.length || 0); i++) {
    const r = results[i]; const t = r?.[0]?.transcript || '';
    if (r.isFinal) fin += `${t} `; else mid += `${t} `;
  }
  return [fin.trim(), mid.trim()];
}

// Voice notes: the first type this browser records, and a file name for it.
export const RECORD_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'];
export const recordType = (MR = g().MediaRecorder) => RECORD_TYPES.find((t) => MR?.isTypeSupported?.(t)) || '';
const EXT = { 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };
export function voiceFileName(mime = 'audio/webm', at = new Date()) {
  const m = mime.split(';')[0].trim();
  const hm = `${String(at.getHours()).padStart(2, '0')}.${String(at.getMinutes()).padStart(2, '0')}`;
  return `Voice note ${hm}.${EXT[m] || 'webm'}`;
}
export const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

// Per device: "Read questions aloud" (reads each question out as it opens) and whether the mic note was seen.
const store = () => { try { return g().localStorage || null; } catch { return null; } };
const get = (k) => { try { return store()?.getItem(k) ?? null; } catch { return null; } };
const put = (k, v) => { try { store()?.setItem(k, v); } catch { /* storage blocked */ } };
const subs = new Set();
export const readAloudOn = () => get('tp-read-aloud') === '1';
export const setReadAloud = (on) => { put('tp-read-aloud', on ? '1' : '0'); subs.forEach((f) => f(!!on)); };
export const onReadAloud = (f) => (subs.add(f), () => subs.delete(f));
export const micNoteSeen = () => get('tp-mic-note') === '1';
export const markMicNoteSeen = () => put('tp-mic-note', '1');

export function speak(text, w = g()) {
  if (!canSpeak(w) || !text) return null;
  w.speechSynthesis.cancel();
  const u = new w.SpeechSynthesisUtterance(text);
  u.lang = voiceLangOf(text);
  u.rate = 0.95;
  w.speechSynthesis.speak(u);
  return u;
}
export const hush = (w = g()) => { if (canSpeak(w)) w.speechSynthesis.cancel(); };
