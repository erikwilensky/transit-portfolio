// Sign-up progress (pilot rollout): per homeroom, how many students have set a password, been here in the
// last 7 days, added a moment, and have a family account; staff by role. Counts from accounts.json, the record
// and usage.json; nothing anyone wrote.
//   GET /api/admin/progress?homeroom= (admin or leadership) → { today, homerooms: [row], totals: row, staff: { rows: [{ kind, total, signedUp, active }], total },
//       students?: [student] }   row = { name, year, students, signedUp, waiting (account, no password), active, moments, families }
//   GET /api/advisor/progress (their own advisees: advisorId = their teacherId) → { total, signedUp, active, families, students: [student] }
// student = { id, name, homeroom, year, hasAccount, signedUp, active, moment, families, lastSignIn }
// Active = signed up and signed in or here (any request) in the last 7 days. Paused accounts (leavers) are left out.
import { send } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import { lastSeenAll, dayOf } from './60-usage.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const later = (a, b) => (!a ? b || null : !b ? a : a > b ? a : b);
const byRoom = (x, y) => x.year - y.year || x.name.localeCompare(y.name, 'en', { numeric: true });
const blank = (name, year) => ({ name, year, students: 0, signedUp: 0, waiting: 0, active: 0, moments: 0, families: 0 });

// One pass over accounts and the record, then a row per student.
function context(now = new Date()) {
  const accounts = A.allAccounts(), seen = lastSeenAll();
  const since = new Date(now.getTime() - 7 * 864e5).toISOString();
  const student = new Map(), families = new Map();
  for (const a of accounts) {
    if (a.kind === 'student' && a.studentId) student.set(a.studentId, a);
    if (a.kind === 'parent') for (const c of a.children || []) families.set(c, (families.get(c) || 0) + 1);
  }
  const moments = new Set(api.getStore().events.filter((e) => e.type !== 'goal').map((e) => e.studentId));
  const last = (a) => later(a.lastSignInAt, seen[a.id]);
  const isActive = (a) => !!a?.password && (last(a) || '') >= since;
  const rowOf = (s) => {
    const a = student.get(s.id);
    return { id: s.id, name: s.name, homeroom: s.homeroom || '', year: s.grade + 1, hasAccount: !!a, signedUp: !!a?.password, active: isActive(a), moment: moments.has(s.id), families: families.get(s.id) || 0, lastSignIn: a ? last(a) : null };
  };
  const students = api.getStudents({ includeCohort: true }).filter((s) => !student.get(s.id)?.paused);
  return { accounts, students, rowOf, isActive };
}
const tally = (r, s) => { r.students++; r.signedUp += +s.signedUp; r.waiting += +(s.hasAccount && !s.signedUp); r.active += +s.active; r.moments += +s.moment; r.families += +(s.families > 0); return r; };

export function adminProgress(homeroom, now = new Date()) {
  const { accounts, students, rowOf, isActive } = context(now);
  const rooms = new Map(), totals = blank('All homerooms', null), list = [];
  for (const s of students) {
    const row = rowOf(s), k = row.homeroom || 'No homeroom';
    const r = rooms.get(k) || rooms.set(k, blank(k, row.year)).get(k);
    r.year = Math.min(r.year, row.year); tally(r, row); tally(totals, row);
    if (homeroom && k === homeroom) list.push(row);
  }
  const staff = new Map();
  for (const a of accounts) if (A.STAFF.includes(a.kind) && !a.paused) {
    const r = staff.get(a.kind) || staff.set(a.kind, { kind: a.kind, total: 0, signedUp: 0, active: 0 }).get(a.kind);
    r.total++; r.signedUp += +!!a.password; r.active += +isActive(a);
  }
  const srows = A.STAFF.map((k) => staff.get(k)).filter(Boolean);
  const stotal = srows.reduce((t, r) => ({ ...t, total: t.total + r.total, signedUp: t.signedUp + r.signedUp, active: t.active + r.active }), { kind: 'all', total: 0, signedUp: 0, active: 0 });
  return { today: dayOf(now), homerooms: [...rooms.values()].sort(byRoom), totals, staff: { rows: srows, total: stotal }, ...(homeroom ? { students: list.sort((x, y) => x.name.localeCompare(y.name)) } : {}) };
}

export function advisorProgress(teacherId, now = new Date()) {
  const { students, rowOf } = context(now);
  const list = students.filter((s) => s.advisorId === teacherId).map(rowOf).sort((x, y) => x.name.localeCompare(y.name));
  const n = (f) => list.filter(f).length;
  return { total: list.length, signedUp: n((s) => s.signedUp), active: n((s) => s.active), families: n((s) => s.families > 0), students: list };
}

export default (app) => {
  app.get('/api/admin/progress', (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    if (!A.isAdmin(req.user) && req.user.kind !== 'leadership') throw bad(403, 'Only leadership and the pilot admin can see sign-up progress.');
    const h = req.query?.get('homeroom');
    send(res, 200, adminProgress(h ? String(h).slice(0, 40) : null));
  });
  app.get('/api/advisor/progress', (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const tid = A.STAFF.includes(req.user.kind) && req.user.teacherId;
    const p = tid ? advisorProgress(tid) : null;
    if (!p?.total) throw bad(403, 'Only an advisor can see their advisees\' sign-up progress.');
    send(res, 200, p);
  });
};
