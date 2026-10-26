import { termOf } from './layout/metroLayout.js';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
export const fmtTerm = (d, g9, startGrade = 9) => { const t = termOf(d, g9, startGrade); return `Year ${startGrade + 1 + Math.floor(t / 3)}, Term ${(t % 3) + 1}`; };
export const TYPE_LABEL = { class: 'Class', assessment: 'Assessment', project: 'Project', competition: 'Competition', cas: 'CAS', club: 'Club', sport: 'Sport', service: 'Service', award: 'Award', reflection: 'Reflection', goal: 'Planned goal' };
export const VERIFY_LABEL = { 'school-verified': 'School-verified', 'teacher-endorsed': 'Teacher-endorsed', 'student-added': 'Student-added' };
export const VERIFY_HELP = {
  'school-verified': 'Imported directly from a school system.',
  'teacher-endorsed': 'A teacher has reviewed and endorsed this.',
  'student-added': 'Added by the student; not yet endorsed.',
};
export const VIS_LABEL = { private: 'Private', advisor: 'Advisor only', school: 'School', publishable: 'Publishable' };
export function ago(iso, now = Date.now()) {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
// A short public code for a station's verification record (printed on CVs as text and QR).
export function verifyCode(eventId) {
  let h = 2166136261;
  for (const c of `nist:${eventId}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `NIST-${h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
export const appUrl = (hash) => `${location.origin}${location.pathname}#/${hash}`;

// P12: a short code for each line, so lines that share a colour can be named without it.
export const lineCode = (l) => l.code || (l.name.includes(' ') ? l.name.split(/[\s·]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3) : l.name.slice(0, 3)).toUpperCase();
// Navy or white text, whichever reads on a line colour.
export const inkOn = (hex) => { const n = parseInt(hex.slice(1), 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]; return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#002554' : '#fff'; };
