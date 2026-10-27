import { useEffect } from 'react';
import { LENSES } from './api.js';

// Printing and "Download PDF". While the print dialog is open the page title becomes the file
// name the browser offers ("Maya Chen – Employer CV.pdf") and dark mode switches to light.
// Both come back afterwards. This runs for our buttons and for Ctrl+P alike.

let wanted = null; // the title of the document on screen now
let saved = null;  // what to put back after printing

function enter() {
  if (saved) return;
  const root = document.documentElement;
  saved = { title: document.title, theme: root.dataset.theme };
  if (wanted) document.title = wanted;
  if (root.dataset.theme === 'dark') root.dataset.theme = 'light';
  // Lazy images further down the page must be in before the page is laid out for paper.
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
}
function leave() {
  if (!saved) return;
  document.title = saved.title;
  if (saved.theme) document.documentElement.dataset.theme = saved.theme;
  saved = null;
}

if (typeof window !== 'undefined' && !window.__tpPrint) {
  window.__tpPrint = true;
  addEventListener('beforeprint', enter);
  addEventListener('afterprint', leave);
  // Print emulation (and some browsers' previews) only change the media query.
  const mq = window.matchMedia?.('print');
  mq?.addEventListener?.('change', (e) => (e.matches ? enter() : leave()));
}

// Name the document on screen, so Ctrl+P saves it under a good name too.
export function usePrintTitle(title) {
  useEffect(() => {
    wanted = title;
    return () => { if (wanted === title) wanted = null; };
  }, [title]);
}

export function printDocument(title) {
  if (title) wanted = title;
  enter();
  window.print(); // Chrome waits here until the dialog closes; afterprint puts everything back.
}

// "Maya Chen – Employer CV"
export const docName = (student, what) => `${student} – ${what}`;

const WHAT = { general: 'Profile', university: 'University narrative', employer: 'Employer CV', scholarship: 'Scholarship impact timeline', custom: 'Portfolio page' };
export function presentationName(student, pres) {
  if (pres.audience === 'specific') return docName(student, `${pres.targetName || 'Course'} statement`);
  return docName(student, WHAT[pres.audience] || LENSES[pres.audience]?.label || 'Portfolio');
}

export const printDate = (d = new Date()) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
