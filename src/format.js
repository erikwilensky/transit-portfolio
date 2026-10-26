import { termOf } from './layout/metroLayout.js';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
export const fmtTerm = (d, g9) => { const t = termOf(d, g9); return `Grade ${9 + Math.floor(t / 3)}, Term ${(t % 3) + 1}`; };
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
