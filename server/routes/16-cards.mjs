// Printable sign-in cards (pilot): a batch of one-time setup links, one card each, for an advisor's own
// advisees or, for the admin, whole homerooms and staff. Each card's link is a normal 7-day setup link
// (A.newSetup: stored only as a hash, never logged). Also unpausing a paused account.
//   GET  /api/advisor/cards → { students: [{ id, name, homeroom, year, hasAccount, hasPassword }] }
//   POST /api/advisor/cards { studentIds?, includeSignedUp? } → { school, cards }
//   GET  /api/admin/cards → { homerooms: [{ name, year, students, waiting }], staff: { total, waiting } }
//   POST /api/admin/cards { homerooms?, staff?, accountIds?, includeSignedUp? } → { school, cards }
//   POST /api/admin/accounts/:id/pause, /unpause → listBody
// cards: [{ name, homeroom, year, email, setupUrl, expiresAt }]. Paused accounts never get a card.
import { send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import { originOf, setupUrl, requireAdmin, listBody, accountTarget } from './10-auth.mjs';
import * as L from '../audit.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const LIMIT = 30; // card batches per account per 15 minutes
const school = () => api.getStore().rosterImport?.school?.name || 'NIST International School';
const byName = (x, y) => (x.homeroom || '').localeCompare(y.homeroom || '', 'en', { numeric: true }) || x.name.localeCompare(y.name);
const studentAccount = (sid) => A.allAccounts().find((a) => a.kind === 'student' && a.studentId === sid);

function cardsFor(req, accounts, includeSignedUp) {
  if (A.bump(`cards:${req.user.id}`) > LIMIT) throw bad(429, 'Too many card batches. Wait 15 minutes.');
  const base = originOf(req);
  const todo = accounts.filter((a) => a && !a.paused && a.id !== req.user.id && (includeSignedUp || !a.password));
  const cards = A.batchAccounts(() => todo.map((a) => {
    const url = setupUrl(base, A.newSetup(a));
    const s = a.studentId && api.getStudent(a.studentId), t = a.teacherId && api.getTeacher(a.teacherId);
    return { name: a.name, homeroom: s ? s.homeroom || '' : t?.department || (t ? 'Staff' : ''), year: s ? s.grade + 1 : null, email: a.email, setupUrl: url, expiresAt: a.setup.expiresAt };
  }));
  L.log(req, { action: 'setup-link', target: todo.length === 1 ? accountTarget(todo[0]) : { label: `${todo.length} accounts` }, detail: { why: 'sign-in cards', count: todo.length } });
  return { school: school(), cards: cards.sort(byName) };
}

export default (app) => {
  // ── Advisor: their own advisees only (advisorId = their teacherId), student accounts only ──
  const advisees = (req) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const tid = req.user.teacherId;
    const list = A.STAFF.includes(req.user.kind) && tid ? api.getStudents({ includeCohort: true }).filter((s) => s.advisorId === tid) : [];
    if (!list.length) throw bad(403, 'Only an advisor can print sign-in cards for their advisees.');
    return list;
  };
  app.get('/api/advisor/cards', (req, res) => send(res, 200, {
    students: advisees(req).map((s) => { const a = studentAccount(s.id); return { id: s.id, name: s.name, homeroom: s.homeroom || '', year: s.grade + 1, hasAccount: !!a && !a.paused, hasPassword: !!a?.password }; }).sort(byName),
  }));
  app.post('/api/advisor/cards', async (req, res) => {
    const mine = advisees(req);
    const b = await readJson(req);
    const ids = new Set(mine.map((s) => s.id));
    const want = Array.isArray(b.studentIds) ? b.studentIds : [...ids];
    if (want.some((id) => !ids.has(id))) throw bad(403, 'Only their advisor or the pilot admin can do that.');
    send(res, 200, cardsFor(req, want.map(studentAccount), !!b.includeSignedUp));
  });

  // ── Admin: per homeroom, staff, or chosen accounts ──
  app.get('/api/admin/cards', (req, res) => {
    requireAdmin(req);
    const rooms = new Map();
    for (const s of api.getStudents({ includeCohort: true })) {
      const a = studentAccount(s.id); if (!a || a.paused) continue;
      const k = s.homeroom || 'No homeroom';
      const r = rooms.get(k) || rooms.set(k, { name: k, year: s.grade + 1, students: 0, waiting: 0 }).get(k);
      r.students++; if (!a.password) r.waiting++;
    }
    const staff = A.allAccounts().filter((a) => A.STAFF.includes(a.kind) && !a.paused && a.id !== req.user.id);
    send(res, 200, { homerooms: [...rooms.values()].sort((x, y) => x.name.localeCompare(y.name, 'en', { numeric: true })), staff: { total: staff.length, waiting: staff.filter((a) => !a.password).length } });
  });
  app.post('/api/admin/cards', async (req, res) => {
    requireAdmin(req);
    const b = await readJson(req);
    const rooms = new Set(Array.isArray(b.homerooms) ? b.homerooms : []);
    const picked = new Set(Array.isArray(b.accountIds) ? b.accountIds : []);
    const room = (a) => { const s = api.getStudent(a.studentId); return s && rooms.has(s.homeroom || 'No homeroom'); };
    const list = A.allAccounts().filter((a) => !A.isAdmin(a) || picked.has(a.id)).filter((a) => picked.has(a.id) || (a.kind === 'student' && room(a)) || (b.staff && A.STAFF.includes(a.kind)));
    send(res, 200, cardsFor(req, list, !!b.includeSignedUp));
  });

  app.post('/api/admin/accounts/:id/pause', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    if (a.id === req.user.id) throw bad(400, 'You cannot pause your own account.');
    A.pauseAccount(a); L.log(req, { action: 'account-pause', target: accountTarget(a) }); send(res, 200, listBody());
  });
  app.post('/api/admin/accounts/:id/unpause', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    A.unpauseAccount(a); L.log(req, { action: 'account-unpause', target: accountTarget(a) }); send(res, 200, listBody());
  });
};
