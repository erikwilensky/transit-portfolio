// Pilot sign-in routes, the sign-in guard and the admin accounts screen's API.
// The account and session logic is in server/auth.mjs (canAct is exported from there and re-exported here).
import { send, readJson, cookies, middleware, PORT } from '../lib.mjs';
import { api, changed } from '../store.mjs';
import * as A from '../auth.mjs';

export { canAct } from '../auth.mjs';

const OPEN = [/^\/api\/health$/, /^\/api\/public\//, /^\/api\/auth\//];
const bad = (status, message) => Object.assign(new Error(message), { status });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const originOf = (req) => process.env.PUBLIC_URL?.replace(/\/$/, '') || `${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`;
export const setupUrl = (base, t) => `${base}/#/setup/${t}`;
// A state-changing request must come from this site's own pages (on top of SameSite=Lax).
const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };

// Mostly what the browser needs to build a persona, plus the linked record (so a browser
// without the live record yet still knows a newly created student or teacher).
function me(a) {
  const user = A.publicUser(a);
  if (!user) return null;
  if (a.studentId) user.record = { student: api.getStudent(a.studentId) || null };
  if (a.teacherId) user.record = { teacher: api.getTeacher(a.teacherId) || null };
  if (a.children) user.record = { children: a.children.map((id) => api.getStudent(id)).filter(Boolean) };
  return user;
}
const signIn = (req, res, a, body = {}) => {
  const s = A.startSession(a.id);
  send(res, 200, { mode: A.MODE, user: me(a), ...body }, { 'set-cookie': A.cookieHeader(req, s.token, s.maxAge) });
};
export const requireAdmin = (req) => { if (!req.user) throw bad(401, 'Sign in first.'); if (!A.isAdmin(req.user)) throw bad(403, 'Only an admin can do that.'); };

// Builds and checks the record link for a new or edited account; creates a new student or teacher when asked.
function resolveLink(b) {
  const kind = b.kind;
  let link = { studentId: b.studentId, teacherId: b.teacherId, children: b.children };
  if (kind === 'student' && b.newStudent) {
    const { name, year, programme } = b.newStudent;
    if (!String(name || '').trim()) throw bad(400, 'Give the new student a name.');
    if (!(Number(year) >= 7 && Number(year) <= 13)) throw bad(400, 'Pick a Year from 7 to 13.');
    const s = api.addStudent({ name: String(name).trim(), year: Number(year), programme: programme || undefined });
    changed({ fn: 'addStudent', args: [{ id: s.id }], by: 'admin' });
    link = { studentId: s.id };
  }
  if (A.STAFF.includes(kind) && b.newTeacher) {
    const { name, role } = b.newTeacher;
    if (!String(name || '').trim()) throw bad(400, 'Give the new staff record a name.');
    const t = api.addTeacher({ name: String(name).trim(), role: String(role || '').trim() || 'Teacher' });
    changed({ fn: 'addTeacher', args: [{ id: t.id }], by: 'admin' });
    link = { teacherId: t.id };
  }
  const problem = A.linkProblem({ kind, ...link });
  if (problem) throw bad(400, problem);
  return A.linkOf({ kind, ...link });
}
export const listBody = () => ({
  accounts: A.allAccounts().map(A.publicUser).map((u) => ({ ...u, setupPending: !u.hasPassword })),
  students: api.getStudents({ includeCohort: true }).map((s) => ({ id: s.id, name: s.name, grade: s.grade, programme: s.programme })),
  teachers: api.getTeachers().map((t) => ({ id: t.id, name: t.name, role: t.role })),
});

export default (app) => {
  // ── The guard: attaches req.user; in pilot mode, refuses unsigned requests outside the open routes ──
  middleware.push((req, res, url) => {
    req.user = A.sessionUser(cookies(req)[A.COOKIE]);
    if (req.method !== 'GET' && req.method !== 'HEAD' && !url.pathname.startsWith('/api/public/') && !sameOrigin(req)) { send(res, 403, { error: 'Cross-site request refused.' }); return true; }
    if (A.MODE !== 'pilot') return false;
    const open = OPEN.some((re) => re.test(url.pathname)) || (req.method === 'GET' && url.pathname.startsWith('/api/files/'));
    if (!open && !req.user) { send(res, 401, { error: 'Sign in first.' }); return true; }
    // The whole-record reset is for admins only in a pilot.
    if (url.pathname === '/api/reset' && !A.isAdmin(req.user)) { send(res, 403, { error: 'Only an admin can reset the record.' }); return true; }
    return false;
  });

  // First run: no accounts, so print a one-time admin setup link. There is no default password.
  const first = A.firstRunToken();
  if (first) console.log(`\nNo accounts yet. Create the first admin account here (one-time link, valid until the server restarts):\n  ${setupUrl(process.env.PUBLIC_URL?.replace(/\/$/, '') || `http://localhost:${PORT}`, first)}\n`);

  app.get('/api/auth/me', (req, res) => send(res, 200, { mode: A.MODE, user: me(req.user) }));

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = await readJson(req);
    const e = A.normEmail(email); const ip = A.clientIp(req);
    const t = A.throttle(e, ip);
    if (t.blocked) return send(res, 429, { error: 'Too many tries. Wait 15 minutes, or ask an admin for a new setup link.' }, { 'retry-after': '900' });
    if (t.delay) await sleep(t.delay);
    const a = A.accountByEmail(e);
    if (!(await A.checkPassword(a, password))) { A.noteFailure(e, ip); return send(res, 401, { error: 'That email and password do not match.' }); }
    A.noteSuccess(e);
    signIn(req, res, a);
  });

  app.post('/api/auth/logout', (req, res) => {
    A.endSession(cookies(req)[A.COOKIE]);
    send(res, 200, { ok: true }, { 'set-cookie': A.cookieHeader(req, '', 0) });
  });

  app.post('/api/auth/password', async (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const { current, password } = await readJson(req);
    const ip = A.clientIp(req); const e = req.user.email;
    const t = A.throttle(e, ip);
    if (t.blocked) throw bad(429, 'Too many tries. Wait 15 minutes.');
    if (t.delay) await sleep(t.delay);
    if (!(await A.checkPassword(req.user, current))) { A.noteFailure(e, ip); throw bad(400, 'Your current password is not right.'); }
    const p = A.passwordProblem(password); if (p) throw bad(400, p);
    await A.setPassword(req.user, password);
    A.endSessionsOf(req.user.id, cookies(req)[A.COOKIE]);
    send(res, 200, { ok: true });
  });

  // One-time setup links: the first admin, and every account an admin creates or resets.
  app.get('/api/auth/setup/:token', (req, res, { token }) => {
    if (A.isFirstRunToken(token)) return send(res, 200, { firstRun: true });
    const a = A.accountBySetup(token);
    if (!a) throw bad(404, 'This setup link has expired or was already used. Ask an admin for a new one.');
    send(res, 200, { firstRun: false, email: a.email, name: a.name });
  });
  app.post('/api/auth/setup', async (req, res) => {
    const { token, password, name, email } = await readJson(req);
    const p = A.passwordProblem(password); if (p) throw bad(400, p);
    if (A.isFirstRunToken(token)) {
      if (!String(name || '').trim()) throw bad(400, 'Add your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(A.normEmail(email))) throw bad(400, 'Add a valid email address.');
      const a = A.createAccount({ email, name, kind: 'admin' });
      await A.setPassword(a, password);
      A.clearFirstRun();
      return signIn(req, res, a);
    }
    const a = A.accountBySetup(token);
    if (!a) throw bad(404, 'This setup link has expired or was already used. Ask an admin for a new one.');
    await A.setPassword(a, password);
    signIn(req, res, a);
  });

  // ── Admin: list, create, edit, reset and remove accounts ──
  app.get('/api/admin/accounts', (req, res) => { requireAdmin(req); send(res, 200, listBody()); });
  app.post('/api/admin/accounts', async (req, res) => {
    requireAdmin(req);
    const b = await readJson(req);
    const email = A.normEmail(b.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad(400, 'Add a valid email address.');
    if (A.accountByEmail(email)) throw bad(409, 'There is already an account with that email.');
    if (!A.KINDS.includes(b.kind)) throw bad(400, 'Pick a role.');
    const name = String(b.name || b.newStudent?.name || b.newTeacher?.name || '').trim();
    if (!name) throw bad(400, 'Add a name.');
    const link = resolveLink(b);
    const a = A.createAccount({ email, name, kind: b.kind, admin: !!b.admin, ...link });
    const t = A.newSetup(a);
    send(res, 201, { account: A.publicUser(a), setupUrl: setupUrl(originOf(req), t), ...listBody() });
  });
  app.post('/api/admin/accounts/:id', async (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    const b = await readJson(req);
    const kind = b.kind || a.kind;
    if (!A.KINDS.includes(kind)) throw bad(400, 'Pick a role.');
    const wasAdmin = A.isAdmin(a);
    const link = resolveLink({ ...a, ...b, kind });
    const admin = kind === 'admin' || (kind === 'leadership' && (b.admin ?? a.admin));
    if (wasAdmin && !admin && A.allAccounts().filter(A.isAdmin).length === 1) throw bad(400, 'Keep at least one admin.');
    A.updateAccount(a, { kind, name: String(b.name || a.name).trim(), admin: !!admin, ...link });
    send(res, 200, { account: A.publicUser(a), ...listBody() });
  });
  app.post('/api/admin/accounts/:id/reset', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    if (a.id === req.user.id) throw bad(400, 'Change your own password from your account menu instead.');
    const t = A.newSetup(a);
    send(res, 200, { account: A.publicUser(a), setupUrl: setupUrl(originOf(req), t), ...listBody() });
  });
  app.delete('/api/admin/accounts/:id', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    if (a.id === req.user.id) throw bad(400, 'You cannot remove your own account.');
    A.removeAccount(id);
    send(res, 200, listBody());
  });
};
