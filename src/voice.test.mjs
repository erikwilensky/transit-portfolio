import test from 'node:test';
import assert from 'node:assert/strict';
import { canListen, canRecord, canSpeak, clock, joinSpoken, markMicNoteSeen, micNoteSeen, onReadAloud, readAloudOn, recognitionCtor, recordType, setReadAloud, speak, speechLang, transcript, voiceFileName, voiceLangOf } from './voice.js';

test('feature detection: nothing there, nothing offered', () => {
  assert.equal(canListen({}), false);
  assert.equal(canListen({ SpeechRecognition: undefined, webkitSpeechRecognition: undefined }), false);
  function R() {}
  assert.equal(recognitionCtor({ webkitSpeechRecognition: R }), R);
  assert.equal(canListen({ SpeechRecognition: R }), true);
  assert.equal(canSpeak({}), false);
  assert.equal(canSpeak({ speechSynthesis: {}, SpeechSynthesisUtterance: function U() {} }), true);
  assert.equal(canRecord({ navigator: {} }), false);
  assert.equal(canRecord({ navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: function M() {} }), true);
});

test('languages: recognition follows the person, reading follows the words', () => {
  assert.equal(speechLang('th'), 'th-TH');
  assert.equal(speechLang('en'), 'en-GB');
  assert.equal(speechLang(undefined), 'en-GB');
  assert.equal(voiceLangOf('What did you learn?'), 'en-GB');
  assert.equal(voiceLangOf('อ่านคำถามออกเสียง'), 'th-TH');
});

test('joinSpoken adds what was said to what was typed', () => {
  assert.equal(joinSpoken('', 'i joined the robotics club'), 'I joined the robotics club');
  assert.equal(joinSpoken('I learned that', 'robots  need   batteries'), 'I learned that robots need batteries');
  assert.equal(joinSpoken('It was fun.', 'next time i will'), 'It was fun. Next time i will');
  assert.equal(joinSpoken('Typed ', ''), 'Typed ');
});

test('transcript splits final and interim results from an index', () => {
  const r = (t, isFinal) => Object.assign([{ transcript: t }], { isFinal });
  const results = [r('hello', true), r('there', true), r('my fri', false)];
  assert.deepEqual(transcript(results), ['hello there', 'my fri']);
  assert.deepEqual(transcript(results, 2), ['', 'my fri']);
  assert.deepEqual(transcript(undefined), ['', '']);
});

test('voice note files: type and name', () => {
  assert.equal(recordType({ isTypeSupported: (t) => t === 'audio/mp4' }), 'audio/mp4');
  assert.equal(recordType({ isTypeSupported: () => false }), '');
  assert.equal(recordType(undefined), '');
  const at = new Date(2026, 9, 30, 9, 5);
  assert.equal(voiceFileName('audio/webm;codecs=opus', at), 'Voice note 09.05.webm');
  assert.equal(voiceFileName('audio/mp4', at), 'Voice note 09.05.m4a');
  assert.equal(voiceFileName('audio/ogg', at), 'Voice note 09.05.ogg');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(60), '1:00');
  assert.equal(clock(7.6), '0:07');
});

test('settings work with no storage, and with it', () => {
  // Node has no window: reads say off, writes do nothing, and nothing throws.
  assert.equal(readAloudOn(), false);
  assert.equal(micNoteSeen(), false);
  let heard = null;
  const off = onReadAloud((v) => { heard = v; });
  setReadAloud(true); markMicNoteSeen();
  assert.equal(heard, true);
  off();
  const mem = new Map();
  globalThis.window = { localStorage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) } };
  try {
    setReadAloud(true); assert.equal(readAloudOn(), true);
    setReadAloud(false); assert.equal(readAloudOn(), false);
    markMicNoteSeen(); assert.equal(micNoteSeen(), true);
    globalThis.window = { get localStorage() { throw new Error('blocked'); } };
    assert.equal(readAloudOn(), false);
    setReadAloud(true);
  } finally { delete globalThis.window; }
});

test('speak cancels what is playing and picks the voice by the words', () => {
  const said = [];
  let cancelled = 0;
  const w = { speechSynthesis: { cancel: () => cancelled++, speak: (u) => said.push(u) }, SpeechSynthesisUtterance: function U(t) { this.text = t; } };
  const u = speak('What did you do?', w);
  assert.equal(cancelled, 1);
  assert.equal(said[0], u);
  assert.equal(u.lang, 'en-GB');
  assert.equal(speak('', w), null);
  assert.equal(speak('hi', {}), null);
});
