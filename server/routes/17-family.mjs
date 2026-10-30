// Family sign-in letters (pilot): the class lists hold no parents, so families join by a printed invitation.
// One invite per student: a one-time link (stored only as a hash, 30 days) that up to 2 family members use,
// each making their own parent account; someone already signed in as a parent (or giving that account's
// password) gets the child added to their `children`, so siblings share one account.
//   GET  /api/family/invite/:token → { firstName, homeroom, expiresAt, me?: { kind, name, has } }   (open; nothing more before joining)
//   POST /api/family/join { token, name?, email?, password? } → { mode, user, added }   (open; signs in)
//   GET  /api/advisor/family → { students: [{ id, name, homeroom, year, paused, family: [{ id, name, email }], invite }] }
//   POST /api/advisor/family/letters { studentIds?, onlyNew? } → { school, letters }
//   GET  /api/admin/family?homeroom= → { homerooms: [{ name, year, students, withFamily, paused, waiting }], students? }
//   POST /api/admin/family/letters { homerooms, onlyNew? } → { school, letters }
//   POST /api/family/unlink { studentId, accountId } → { ok, removed }   (their advisor or the admin)
// letters: [{ studentId, firstName, homeroom, year, url, expiresAt }]. A new letter cancels the student's earlier invite.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { send, readJson, clientIp, DATA_DIR, writeAtomic } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import { originOf, requireAdmin } from './10-auth.mjs';
import * as L from '../audit.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const DAYS = 30, USES = 2;
const LETTERS = 30, LOOKS = 200, JOINS = 30; // per 15 minutes: letter batches per account; invite looks and joins per address
const FILE = path.join(DATA_DIR, 'family-invites.json');
let invites = (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } })();
const save = () => writeAtomic(FILE, JSON.stringify(invites, null, 1));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();
const school = () => api.getStore().rosterImport?.school?.name || 'NIST International School';
const first = (s) => String(s.name || '').trim().split(/\s+/)[0];
const byRoom = (x, y) => (x.homeroom || '').localeCompare(y.homeroom || '', 'en', { numeric: true }) || x.name.localeCompare(y.name);
const familyOf = (sid) => A.allAccounts().filter((a) => a.kind === 'parent' && a.children?.includes(sid));
const pausedStudent = (sid) => A.allAccounts().some((a) => a.kind === 'student' && a.studentId === sid && a.paused);
const live = (i) => i && !i.cancelled && i.expiresAt > now() && i.uses.length < USES && api.getStudent(i.studentId);
const openInvite = (sid) => invites.find((i) => i.studentId === sid && live(i));
export const urlOf = (base, t) => `${base}/#/family/${t}`;
const inviteOf = (t) => (typeof t === 'string' && /^[\w-]{16,64}$/.test(t) ? invites.find((i) => i.hash === sha(t)) : null);
const brief = (a) => ({ id: a.id, name: a.name, email: a.email });
const studentRow = (s) => { const i = openInvite(s.id); return { id: s.id, name: s.name, homeroom: s.homeroom || '', year: s.grade + 1, paused: pausedStudent(s.id), family: familyOf(s.id).map(brief), invite: i ? { expiresAt: i.expiresAt, uses: i.uses.length } : null }; };

// New letters for these students (never a paused one): each cancels that student's earlier invite.
function lettersFor(req, students, onlyNew) {
  if (A.bump(`fl:${req.user.id}`) > LETTERS) throw bad(429, 'Too many batches of letters. Wait 15 minutes.');
  const base = originOf(req);
  const todo = students.filter((s) => s && !pausedStudent(s.id) && !(onlyNew && familyOf(s.id).length));
  const ids = new Set(todo.map((s) => s.id));
  invites = invites.filter((i) => !ids.has(i.studentId) && i.expiresAt > now());
  const expiresAt = new Date(Date.now() + DAYS * 864e5).toISOString();
  const letters = todo.map((s) => {
    const t = crypto.randomBytes(16).toString('base64url');
    invites.push({ hash: sha(t), studentId: s.id, by: req.user.id, createdAt: now(), expiresAt, uses: [] });
    return { studentId: s.id, firstName: first(s), homeroom: s.homeroom || '', year: s.grade + 1, url: urlOf(base, t), expiresAt };
  });
  save();
  L.log(req, { action: 'family-letters', target: L.studentsTarget(todo.map((s) => s.id)), detail: { count: letters.length } });
  return { school: school(), letters: letters.sort((x, y) => byRoom({ ...x, name: x.firstName }, { ...y, name: y.firstName })) };
}

// The invite behind a token, or a plain refusal. Failed looks count against the address.
function usable(req, token) {
  if (A.MODE !== 'pilot') throw bad(404, 'Family letters are for the pilot only.');
  const ip = clientIp(req);
  if (A.failCount(`fi:${ip}`) >= JOINS) throw bad(429, A.BLOCKED);
  const i = inviteOf(token);
  if (!live(i)) { A.bump(`fi:${ip}`); throw bad(404, i && i.uses.length >= USES ? 'This letter has already been used by two family members. Ask your child’s advisor for a new one.' : 'This letter’s link has expired or was replaced by a newer letter. Ask your child’s advisor for a new one.'); }
  if (pausedStudent(i.studentId)) throw bad(403, 'This student’s account is paused. Ask the school.');
  return i;
}
const meOf = (a) => ({ ...A.publicUser(a), record: { children: a.children.map((id) => api.getStudent(id)).filter(Boolean) } });
function addChild(a, i) {
  const added = !a.children.includes(i.studentId);
  if (added) A.updateAccount(a, { children: [...a.children, i.studentId] });
  if (added && !i.uses.includes(a.id)) { i.uses.push(a.id); save(); }
  return added;
}

export default (app) => {
  // ── The family's side: open routes (no sign-in needed) ──
  app.get('/api/family/invite/:token', (req, res, { token }) => {
    if (A.bump(`fg:${clientIp(req)}`) > LOOKS) throw bad(429, A.BLOCKED);
    const i = usable(req, token);
    const s = api.getStudent(i.studentId), u = req.user;
    send(res, 200, { firstName: first(s), homeroom: s.homeroom || '', expiresAt: i.expiresAt, ...(u ? { me: { kind: u.kind, name: u.name, has: !!u.children?.includes(s.id) } } : {}) });
  });
  app.post('/api/family/join', async (req, res) => {
    if (A.bump(`fj:${clientIp(req)}`) > JOINS) throw bad(429, A.BLOCKED);
    const b = await readJson(req);
    const i = usable(req, b.token);
    // Already signed in: a parent adds this child; anyone else signs out first.
    if (req.user) {
      if (req.user.kind !== 'parent') throw bad(403, 'You are signed in with a school account. Sign out first, then open the link again.');
      const added = addChild(req.user, i);
      L.log(req, { action: 'family-join', target: L.studentsTarget([i.studentId]), detail: { added, how: 'signed in' } });
      return send(res, 200, { mode: A.MODE, user: meOf(req.user), added });
    }
    const email = A.normEmail(b.email), ip = clientIp(req);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw bad(400, 'Add a valid email address.');
    let a = A.accountByEmail(email), added = true;
    const existing = !!a;
    if (a) {
      // A parent account already: its password links this child too (throttled like a sign-in).
      const t = A.throttle(email, ip);
      if (t.blocked) throw bad(429, A.BLOCKED);
      if (a.kind !== 'parent') throw bad(409, 'There is already a school account with that email. Use another email for your family account.');
      if (!(await A.checkPassword(a, b.password))) { A.noteFailure(email, ip); throw bad(401, 'There is already a family account with that email, and that is not its password. Sign in first, then open the link again.'); }
      if (a.paused) throw bad(403, A.PAUSED);
      A.noteSuccess(email);
      added = addChild(a, i);
    } else {
      if (!String(b.name || '').trim()) throw bad(400, 'Add your name.');
      const p = A.passwordProblem(b.password); if (p) throw bad(400, p);
      a = A.createAccount({ email, name: String(b.name).trim().slice(0, 120), kind: 'parent', children: [i.studentId] });
      await A.setPassword(a, b.password);
      i.uses.push(a.id); save();
    }
    L.log(req, { action: 'family-join', actor: L.actorOf(a), target: L.studentsTarget([i.studentId]), detail: { added, how: existing ? 'existing account' : 'new account' } });
    const s = A.startSession(a.id);
    send(res, 200, { mode: A.MODE, user: meOf(a), added }, { 'set-cookie': A.cookieHeader(req, s.token, s.maxAge) });
  });

  // ── Advisors: their own advisees only (advisorId = their teacherId) ──
  const advisees = (req) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const tid = req.user.teacherId;
    const list = A.STAFF.includes(req.user.kind) && tid ? api.getStudents({ includeCohort: true }).filter((s) => s.advisorId === tid) : [];
    if (!list.length) throw bad(403, 'Only an advisor can print family letters for their advisees.');
    return list;
  };
  app.get('/api/advisor/family', (req, res) => send(res, 200, { students: advisees(req).map(studentRow).sort(byRoom) }));
  app.post('/api/advisor/family/letters', async (req, res) => {
    const mine = advisees(req);
    const b = await readJson(req);
    const by = new Map(mine.map((s) => [s.id, s]));
    const want = Array.isArray(b.studentIds) ? b.studentIds : [...by.keys()];
    if (want.some((id) => !by.has(id))) throw bad(403, 'Only their advisor or the pilot admin can do that.');
    send(res, 200, lettersFor(req, want.map((id) => by.get(id)), !!b.onlyNew));
  });

  // ── Admin: per homeroom ──
  const room = (s) => s.homeroom || 'No homeroom';
  app.get('/api/admin/family', (req, res) => {
    requireAdmin(req);
    const rooms = new Map();
    const all = api.getStudents({ includeCohort: true });
    for (const s of all) {
      const r = rooms.get(room(s)) || rooms.set(room(s), { name: room(s), year: s.grade + 1, students: 0, withFamily: 0, paused: 0, waiting: 0 }).get(room(s));
      const fam = familyOf(s.id).length, p = pausedStudent(s.id);
      r.students++; if (fam) r.withFamily++; if (p) r.paused++; if (!fam && !p) r.waiting++;
    }
    const h = req.query.get('homeroom');
    send(res, 200, { homerooms: [...rooms.values()].sort((x, y) => x.name.localeCompare(y.name, 'en', { numeric: true })), ...(h ? { students: all.filter((s) => room(s) === h).map(studentRow).sort(byRoom) } : {}) });
  });
  app.post('/api/admin/family/letters', async (req, res) => {
    requireAdmin(req);
    const b = await readJson(req);
    const rooms = new Set(Array.isArray(b.homerooms) ? b.homerooms : []);
    const ids = new Set(Array.isArray(b.studentIds) ? b.studentIds : []);
    send(res, 200, lettersFor(req, api.getStudents({ includeCohort: true }).filter((s) => rooms.has(room(s)) || ids.has(s.id)), !!b.onlyNew));
  });

  // ── Remove a family member: unlinks the child (an account left with no child is removed) ──
  app.post('/api/family/unlink', async (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const { studentId, accountId } = await readJson(req);
    const s = api.getStudent(studentId);
    const mine = A.isAdmin(req.user) || (A.STAFF.includes(req.user.kind) && !!req.user.teacherId && s?.advisorId === req.user.teacherId);
    if (!s || !mine) throw bad(403, 'Only their advisor or the pilot admin can do that.');
    const a = A.accountById(accountId);
    if (!a || a.kind !== 'parent' || !a.children?.includes(studentId)) throw bad(404, 'That family member is not linked to this student.');
    const rest = a.children.filter((c) => c !== studentId);
    L.log(req, { action: 'family-remove', target: { ...L.studentsTarget([studentId]), accountId: a.id }, detail: { accountRemoved: !rest.length } });
    if (rest.length) A.updateAccount(a, { children: rest }); else A.removeAccount(a.id);
    send(res, 200, { ok: true, removed: !rest.length });
  });
};
