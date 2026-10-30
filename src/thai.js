// Thai for students (docs/pilot-server.md, "Thai for students"). Student screens are written in English and shown in
// Thai at display time: every text node and label (aria-label, placeholder, title, alt) whose whole text is a known
// interface string or matches a known pattern (studentThai, src/i18n.js) is swapped for its Thai. Anything else stays.
// People's own words are never touched: text inside translate="no" or a form field, and any text that is word for word
// something in the record (titles, reflections, teachers' notes and questions, line names: recordWords, src/api.js).
// School line names keep their English name, with the Thai beside it where a student picks or reads a line.
import { useEffect } from 'react';
import { lineGloss, studentThai } from './i18n.js';

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const THAI = /[฀-๿]/;
let obs = null, words = () => new Set(), wordsAt = null, own = new Set();
const ownSet = () => { if (wordsAt !== words) { own = words(); wordsAt = words; } return own; };
const texts = new Map(); // text node → [English, Thai]
const attrs = new Map(); // element → { attr: [English, Thai] }
const off = (el) => !el || !!el.closest('[translate="no"], textarea, script, style, code, pre, [contenteditable="true"]');

// The Thai for one piece of interface text, or null. Leading and trailing spaces are kept (JSX splits text around values).
function thaiFor(v) {
  if (!v || !/[A-Za-z]/.test(v) || THAI.test(v)) return null;
  const core = v.trim();
  if (ownSet().has(core)) return null;
  const th = studentThai(core);
  if (th == null || th === core) return null;
  const at = v.indexOf(core);
  return v.slice(0, at) + th + v.slice(at + core.length);
}
// What a reader sees for an English string (read aloud speaks this), the string itself when Thai is off.
export const shown = (s) => (obs && typeof s === 'string' && thaiFor(s)) || s; // '' (a plural ending) reads as itself

// Where a school line's name is picked or labelled, its Thai goes beside it: "Science (วิทยาศาสตร์)". Names stay English.
const GLOSS = '.sh-lines button, .ob-pick small, .sh-name, .sh-line, .line-chip, .tr-line';
function doText(n) {
  if (off(n.parentElement)) return;
  const g = !THAI.test(n.nodeValue) && n.parentElement.closest(GLOSS) && lineGloss(n.nodeValue.trim());
  if (g) { const v = n.nodeValue; n.nodeValue = v.replace(v.trim(), `${v.trim()} (${g})`); texts.set(n, [v, n.nodeValue]); return; }
  const th = thaiFor(n.nodeValue);
  if (th != null) { texts.set(n, [n.nodeValue, th]); n.nodeValue = th; }
}
function doAttr(el, a) {
  const v = el.getAttribute(a);
  if (v == null || el.closest('[translate="no"]')) return;
  const th = thaiFor(v);
  if (th != null) { (attrs.get(el) || attrs.set(el, {}).get(el))[a] = [v, th]; el.setAttribute(a, th); }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  for (const a of ATTRS) if (root.hasAttribute(a)) doAttr(root, a);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === 3) doText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);
  }
}
function prune() {
  if (texts.size > 4000) for (const n of texts.keys()) if (!n.isConnected) texts.delete(n);
  if (attrs.size > 4000) for (const n of attrs.keys()) if (!n.isConnected) attrs.delete(n);
}

function start() {
  if (obs || typeof MutationObserver === 'undefined') return;
  document.documentElement.lang = 'th';
  obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(walk);
    }
    prune();
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  walk(document.body);
}
function stop() {
  if (!obs) return;
  obs.disconnect(); obs = null;
  for (const [n, [en, th]] of texts) if (n.nodeValue === th) n.nodeValue = en;
  for (const [el, m] of attrs) for (const [a, [en, th]] of Object.entries(m)) if (el.getAttribute(a) === th) el.setAttribute(a, en);
  texts.clear(); attrs.clear();
  document.documentElement.lang = 'en';
}

// App.jsx: on while a student's screens are in Thai. `read` (recordWords, src/api.js) is asked again after each render
// with a new record version, before React's changes reach the page.
let seen = null;
export function useStudentThai(on, read, version) {
  if (seen !== version) { seen = version; words = () => read(); }
  useEffect(() => { if (!on) return undefined; start(); return stop; }, [on]);
}
