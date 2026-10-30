// Pilot sign-in routes, the sign-in guard and the admin accounts screen's API.
// The account and session logic is in server/auth.mjs (canAct is exported from there and re-exported here).
import { send, readJson, cookies, middleware, PORT, clientIp, isHttps } from '../lib.mjs';
import { mailReady, mailLink } from '../mail.mjs';
import { api, changed } from '../store.mjs';
import * as A from '../auth.mjs';
import * as L from '../audit.mjs';

export { canAct } from '../auth.mjs';

const OPEN = [/^\/api\/health$/, /^\/api\/public\//, /^\/api\/auth\//, /^\/api\/family\/(invite\/[^/]+|join)$/];
const bad = (status, message) => Object.assign(new Error(message), { status });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const originOf = (req) => process.env.PUBLIC_URL?.replace(/\/$/, '') || `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}`;
export const setupUrl = (base, t) => `${base}/#/setup/${t}`;
// A state-changing request must come from this site's own pages (on top of SameSite=Lax).
const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return true; try { return new URL(o).host === req.headers.host; } catch { return false; } };

// Mostly what the browser needs to build a persona, plus the linked record (so a browser
// without the live record yet still knows a newly created student or teacher).
export function me(a) {
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
// A new setup link for an account, emailed when mail is set up. Never logged.
async function makeLink(req, a, kind) {
  L.log(req, { action: 'setup-link', ...(kind === 'forgot' ? { actor: L.actorOf(a) } : {}), target: accountTarget(a), detail: { why: kind } });
  const url = setupUrl(originOf(req), A.newSetup(a, { keepPassword: kind === 'forgot' }));
  return { setupUrl: url, emailed: await mailLink({ to: a.email, name: a.name, url, kind }) };
}
// Activity log (server/audit.mjs): the account an entry is about, by id and name.
export const accountTarget = (a) => ({ accountId: a.id, label: a.name, studentId: a.studentId, teacherId: a.teacherId });
const FORGOT_IP = 100, FORGOT_EMAIL = 3; // per 15 minutes
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
    const e = A.normEmail(email); const ip = clientIp(req);
    const t = A.throttle(e, ip);
    // Activity log: the account tried (an unknown email is noted without the address).
    const tried = (action, status, who = A.accountByEmail(e)) => L.log(req, { action, actor: L.actorOf(who), target: who ? {} : { label: 'Unknown email' }, status });
    if (t.blocked) { tried('sign-in-locked', 429); return send(res, 429, { error: A.BLOCKED }, { 'retry-after': '900' }); }
    if (t.delay) await sleep(t.delay);
    const a = A.accountByEmail(e);
    if (!(await A.checkPassword(a, password))) { A.noteFailure(e, ip); tried(A.failCount(`e:${e}`) >= A.EMAIL_LIMIT ? 'sign-in-locked' : 'sign-in-failed', 401, a); return send(res, 401, { error: 'That email and password do not match.' }); }
    A.noteSuccess(e);
    if (a.paused) { tried('sign-in', 403, a); return send(res, 403, { error: A.PAUSED, paused: true }); }
    tried('sign-in', 200, a);
    signIn(req, res, a);
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.user) L.log(req, { action: 'sign-out' });
    A.endSession(cookies(req)[A.COOKIE]);
    send(res, 200, { ok: true }, { 'set-cookie': A.cookieHeader(req, '', 0) });
  });

  app.post('/api/auth/password', async (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const { current, password } = await readJson(req);
    const ip = clientIp(req); const e = req.user.email;
    const t = A.throttle(e, ip);
    if (t.blocked) { L.log(req, { action: 'password-set', status: 429 }); throw bad(429, A.BLOCKED); }
    if (t.delay) await sleep(t.delay);
    if (!(await A.checkPassword(req.user, current))) { A.noteFailure(e, ip); L.log(req, { action: 'password-set', status: 400 }); throw bad(400, 'Your current password is not right.'); }
    const p = A.passwordProblem(password); if (p) throw bad(400, p);
    await A.setPassword(req.user, password);
    L.log(req, { action: 'password-set', detail: { how: 'change' } });
    A.endSessionsOf(req.user.id, cookies(req)[A.COOKIE]);
    send(res, 200, { ok: true });
  });

  // ── Your own sessions: how many devices, and sign out everywhere (this one too) ──
  app.get('/api/auth/sessions', (req, res) => { if (!req.user) throw bad(401, 'Sign in first.'); send(res, 200, { devices: A.sessionCount(req.user.id) }); });
  app.post('/api/auth/logout-everywhere', (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    A.endSessionsOf(req.user.id);
    send(res, 200, { ok: true }, { 'set-cookie': A.cookieHeader(req, '', 0) });
  });

  // ── Forgot your password? Always the same answer, so it never says whether an account exists. ──
  // With mail set up: emails a new link (the old password works until it is used). Without, or if the
  // email fails: notes the request on the account, for an admin (Accounts) or their advisor to answer.
  app.post('/api/auth/forgot', async (req, res) => {
    const { email } = await readJson(req);
    if (A.bump(`f:${clientIp(req)}`) > FORGOT_IP) return send(res, 429, { error: A.BLOCKED }, { 'retry-after': '900' });
    const e = A.normEmail(email);
    send(res, 200, { ok: true, emailed: mailReady() });
    // After the reply, so its timing says nothing either.
    if (!e || e.length > 254 || A.bump(`fe:${e}`) > FORGOT_EMAIL) return;
    const a = A.accountByEmail(e); if (!a) return;
    const emailed = mailReady() && (await makeLink(req, a, 'forgot')).emailed;
    if (!emailed) A.noteResetRequest(a);
    L.log(req, { action: 'reset-request', actor: L.actorOf(a), detail: { emailed: !!emailed } });
  });

  // One-time setup links: the first admin, and every account an admin creates or resets.
  app.get('/api/auth/setup/:token', (req, res, { token }) => {
    if (A.isFirstRunToken(token)) return send(res, 200, { firstRun: true });
    const a = A.accountBySetup(token);
    if (!a) throw bad(404, 'This setup link has expired or was already used. Ask an admin for a new one.');
    if (a.paused) throw bad(403, A.PAUSED);
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
      L.log(req, { action: 'account-create', actor: L.actorOf(a), target: accountTarget(a), detail: { kind: 'admin', firstRun: true } });
      return signIn(req, res, a);
    }
    const a = A.accountBySetup(token);
    if (!a) { L.log(req, { action: 'password-set', actor: null, detail: { how: 'setup link' }, status: 404 }); throw bad(404, 'This setup link has expired or was already used. Ask an admin for a new one.'); }
    if (a.paused) { L.log(req, { action: 'password-set', actor: L.actorOf(a), detail: { how: 'setup link' }, status: 403 }); throw bad(403, A.PAUSED); }
    await A.setPassword(a, password);
    A.endSessionsOf(a.id); A.noteSuccess(a.email);
    L.log(req, { action: 'password-set', actor: L.actorOf(a), detail: { how: 'setup link' } });
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
    L.log(req, { action: 'account-create', target: accountTarget(a), detail: { kind: a.kind, admin: A.isAdmin(a) } });
    const l = await makeLink(req, a, 'new');
    send(res, 201, { account: A.publicUser(a), ...l, ...listBody() });
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
    const was = { kind: a.kind, admin: wasAdmin };
    A.updateAccount(a, { kind, name: String(b.name || a.name).trim(), admin: !!admin, ...link });
    const roleChanged = was.kind !== a.kind || was.admin !== A.isAdmin(a);
    L.log(req, { action: roleChanged ? 'role-change' : 'account-edit', target: accountTarget(a), detail: roleChanged ? { from: was.kind + (was.admin && was.kind !== 'admin' ? '+admin' : ''), to: a.kind + (A.isAdmin(a) && a.kind !== 'admin' ? '+admin' : '') } : undefined });
    send(res, 200, { account: A.publicUser(a), ...listBody() });
  });
  app.post('/api/admin/accounts/:id/reset', async (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    if (a.id === req.user.id) throw bad(400, 'Change your own password from your account menu instead.');
    const l = await makeLink(req, a, 'reset');
    send(res, 200, { account: A.publicUser(a), ...l, ...listBody() });
  });
  // Clears a "forgot password" request without making a link.
  app.post('/api/admin/accounts/:id/dismiss', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    A.dismissResetRequest(a);
    L.log(req, { action: 'reset-dismissed', target: accountTarget(a) });
    send(res, 200, listBody());
  });
  app.delete('/api/admin/accounts/:id', (req, res, { id }) => {
    requireAdmin(req);
    const a = A.accountById(id); if (!a) throw bad(404, 'No such account.');
    if (a.id === req.user.id) throw bad(400, 'You cannot remove your own account.');
    L.log(req, { action: 'account-remove', target: accountTarget(a), detail: { kind: a.kind } });
    A.removeAccount(id);
    send(res, 200, listBody());
  });

  // ── Advisor: a new sign-in link for a student in their own advisory (advisorId = their teacherId) ──
  // Only student accounts, so an advisor can never reset a staff, family or admin account.
  const advisee = (req, studentId) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const s = api.getStudent(studentId);
    const mine = A.isAdmin(req.user) || (A.STAFF.includes(req.user.kind) && !!req.user.teacherId && s?.advisorId === req.user.teacherId);
    if (!s || !mine) throw bad(403, 'Only their advisor or the pilot admin can do that.');
    return A.allAccounts().find((a) => a.kind === 'student' && a.studentId === studentId) || null;
  };
  const brief = (a) => a && { id: a.id, name: a.name, email: a.email, hasPassword: !!a.password, resetRequest: a.resetRequest || null };
  app.get('/api/advisor/students/:studentId/account', (req, res, { studentId }) => send(res, 200, { account: brief(advisee(req, studentId)) }));
  app.post('/api/advisor/students/:studentId/reset', async (req, res, { studentId }) => {
    const a = advisee(req, studentId);
    if (!a) throw bad(404, 'This student has no account yet. Ask the pilot admin.');
    const l = await makeLink(req, a, 'reset');
    send(res, 200, { account: brief(a), ...l });
  });
};
