// Pilot sign-in: accounts, password hashes, sessions and the per-role action check.
// Routes live in server/routes/10-auth.mjs; other modules import from here (canAct, MODE, userOf).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DATA_DIR, writeAtomic } from './lib.mjs';
import { api } from './store.mjs';
import { reachOf, touchedBy } from './scope.mjs';

export const MODE = process.env.TP_MODE === 'pilot' ? 'pilot' : 'demo';
export const KINDS = ['student', 'advisor', 'teacher', 'counsellor', 'coordinator', 'leadership', 'parent', 'admin'];
export const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
const SESSION_DAYS = 30;
const SETUP_DAYS = 7;
export const COOKIE = 'tp_session';

// ── Files ──
const ACCOUNTS = path.join(DATA_DIR, 'accounts.json');
const SESSIONS = path.join(DATA_DIR, 'sessions.json');
const readFile = (f, empty) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return empty; } };
let accounts = readFile(ACCOUNTS, []);
let sessions = readFile(SESSIONS, {});
const saveAccounts = () => writeAtomic(ACCOUNTS, JSON.stringify(accounts, null, 2));
const saveSessions = () => writeAtomic(SESSIONS, JSON.stringify(sessions));

// ── Hashing ──
const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(String(password), salt, 64, SCRYPT)).toString('hex');
  return { salt, hash };
}
// Always runs scrypt, even for an unknown email, so timing does not reveal which emails exist.
const DUMMY = { salt: '00000000000000000000000000000000', hash: '0'.repeat(128) };
export async function checkPassword(account, password) {
  const ref = account?.password || DUMMY;
  const got = await scrypt(String(password ?? ''), ref.salt, 64, SCRYPT);
  const ok = crypto.timingSafeEqual(got, Buffer.from(ref.hash, 'hex'));
  return ok && !!account?.password;
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
export const passwordProblem = (p) => (typeof p !== 'string' || p.length < 8 ? 'Use at least 8 characters.' : p.length > 200 ? 'That password is too long.' : null);

// ── Accounts ──
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const allAccounts = () => accounts;
export const accountById = (id) => accounts.find((a) => a.id === id);
export const accountByEmail = (email) => accounts.find((a) => a.email === normEmail(email));
export const isAdmin = (a) => !!a && (a.kind === 'admin' || !!a.admin);
// What the browser sees of an account: never the hash or setup token.
export function publicUser(a) {
  if (!a) return null;
  const { password, setup, ...rest } = a;
  return { ...rest, admin: isAdmin(a), hasPassword: !!password };
}
// Checks the record link for a kind. Returns an error message or null.
export function linkProblem({ kind, studentId, teacherId, children }) {
  if (!KINDS.includes(kind)) return 'Pick a role.';
  if (kind === 'student' && !api.getStudent(studentId)) return 'Link a student record.';
  if (STAFF.includes(kind) && !api.getTeacher(teacherId)) return 'Link a staff record.';
  if (kind === 'parent' && (!Array.isArray(children) || !children.length || children.some((c) => !api.getStudent(c)))) return 'Link at least one child.';
  return null;
}
export function linkOf({ kind, studentId, teacherId, children }) {
  if (kind === 'student') return { studentId };
  if (STAFF.includes(kind)) return { teacherId };
  if (kind === 'parent') return { children: [...children] };
  return {};
}
export function createAccount({ email, name, kind, admin = false, ...link }) {
  const a = { id: `u-${crypto.randomBytes(5).toString('hex')}`, email: normEmail(email), name: String(name).trim(), kind, ...linkOf({ kind, ...link }), admin: kind === 'admin' || (kind === 'leadership' && !!admin), createdAt: new Date().toISOString() };
  accounts.push(a); saveAccounts();
  return a;
}
export function updateAccount(a, patch) {
  for (const k of ['studentId', 'teacherId', 'children']) delete a[k];
  Object.assign(a, patch); saveAccounts();
}
export function removeAccount(id) { accounts = accounts.filter((a) => a.id !== id); endSessionsOf(id); saveAccounts(); }
export async function setPassword(a, password) { a.password = await hashPassword(password); delete a.setup; saveAccounts(); }

// ── One-time setup links ──
// First run (no accounts yet): a setup token held in memory only, printed to the log.
let firstRun = null;
export function firstRunToken() {
  if (accounts.length) return null;
  if (!firstRun) firstRun = token();
  return firstRun;
}
export const isFirstRunToken = (t) => !accounts.length && !!firstRun && typeof t === 'string' && t.length === firstRun.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(firstRun));
export const clearFirstRun = () => { firstRun = null; };
// An account's setup link: shown once to the admin, stored only as a hash. It also ends the old password and sessions.
export function newSetup(a) {
  const t = token();
  a.setup = { hash: sha(t), expiresAt: new Date(Date.now() + SETUP_DAYS * 864e5).toISOString() };
  delete a.password; endSessionsOf(a.id); saveAccounts();
  return t;
}
export function accountBySetup(t) {
  if (typeof t !== 'string' || !t) return null;
  const h = sha(t);
  return accounts.find((a) => a.setup?.hash === h && a.setup.expiresAt > new Date().toISOString()) || null;
}

// ── Sessions: random token in a cookie, its hash on disk, 30 days ──
const prune = () => { const now = Date.now(); let n = 0; for (const [k, s] of Object.entries(sessions)) if (s.expiresAt < now || !accountById(s.userId)) { delete sessions[k]; n++; } return n; };
if (prune()) saveSessions();
export function startSession(userId) {
  const t = token();
  sessions[sha(t)] = { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_DAYS * 864e5 };
  prune(); saveSessions();
  return { token: t, maxAge: SESSION_DAYS * 86400 };
}
export function sessionUser(t) {
  if (!t) return null;
  const s = sessions[sha(t)];
  if (!s || s.expiresAt < Date.now()) return null;
  return accountById(s.userId) || null;
}
export function endSession(t) { if (t && sessions[sha(t)]) { delete sessions[sha(t)]; saveSessions(); } }
export function endSessionsOf(userId, keep) {
  for (const [k, s] of Object.entries(sessions)) if (s.userId === userId && k !== (keep && sha(keep))) delete sessions[k];
  saveSessions();
}
export const cookieHeader = (req, value, maxAge) => {
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
};

// ── Slowing down repeated failed sign-ins, per email and per address ──
const fails = new Map(); // key → { n, first }
const WINDOW = 15 * 60 * 1000;
const failCount = (k) => { const f = fails.get(k); if (!f || Date.now() - f.first > WINDOW) { fails.delete(k); return 0; } return f.n; };
export const clientIp = (req) => (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
export function throttle(email, ip) {
  const n = Math.max(failCount(`e:${email}`), Math.floor(failCount(`i:${ip}`) / 3));
  if (failCount(`e:${email}`) >= 10 || failCount(`i:${ip}`) >= 30) return { blocked: true };
  return { delay: n >= 3 ? Math.min(250 * 2 ** (n - 3), 8000) : 0 };
}
export function noteFailure(email, ip) {
  for (const k of [`e:${email}`, `i:${ip}`]) { const n = failCount(k); fails.set(k, { n: n + 1, first: n ? fails.get(k).first : Date.now() }); }
}
export const noteSuccess = (email) => fails.delete(`e:${email}`);

// ── canAct: may this signed-in person call this api.js mutator with these arguments? ──
// Cheap, server-side, per role. Students may only change their own record; families only answer
// consent for their own children; whole-school staff may call any mutator except the admin-only ones;
// advisors and teachers only on the students they work with (reachOf in server/scope.mjs), only as
// themselves, and not the school-wide settings. Which students a call touches: touchedBy (scope.mjs).
// /api/action calls it in pilot mode: `if (!canAct(req.user, fn, args)) 403`. Demo mode has no accounts.
const ADMIN_ONLY = new Set(['resetDemo', 'restore', 'addStudent', 'addTeacher']);
const ANYONE = new Set(['recordView', 'setLang']);
// School-wide settings an advisor or subject teacher does not change.
const WHOLE_SCHOOL_ONLY = new Set(['addSchoolLine', 'renameLine', 'decideBranch', 'setRollout', 'matchRoster']);
// The mutators a student may call, on their own record only.
const STUDENT_FNS = new Set(['setStudentDrafts', 'setGithub', 'disconnectGithub', 'simulateWeek', 'addStation', 'addBranch', 'endLine', 'restartLine',
  'completeOnboarding', 'capturePhone', 'setPrivacy', 'logLink', 'addGoal', 'setIntensity', 'remindParent', 'sync', 'importCandidates', 'addReflection',
  'setVisibility', 'editStation', 'deleteStation', 'completeGoal', 'setTags', 'requestEndorsement', 'addCheckIn', 'acceptCandidate', 'dismissCandidate',
  'restoreCandidate', 'mergeCandidate', 'resubmit', 'answerEvidence', 'acceptInterchange', 'ignoreInterchange']);
// A student's own file import only, never as a school source.
const STUDENT_EXTRA = { importCandidates: (a) => a[1]?.sourceId === 'mine' && Array.isArray(a[0]) && a[0].length > 0 };
const st = () => api.getStore();
export function canAct(user, fn, args = []) {
  if (!user || typeof fn !== 'string') return false;
  // Undo sends a whole copy of the record, and in a pilot every browser holds only its own part of it.
  if (fn === 'restore') return false;
  if (isAdmin(user)) return true;
  if (ADMIN_ONLY.has(fn)) return false;
  if (ANYONE.has(fn)) return true;
  // Only your own bell: every key must be one of yours (st:…, t:…, fam:…, role:…, or your record's demo persona id).
  if (fn === 'markNotificationsRead') { const mine = new Set(api.notifyKeys({ kind: user.kind, studentId: user.studentId, teacherId: user.teacherId, children: user.children })); return [].concat(args[0] ?? []).every((k) => mine.has(k)); }
  try {
    if (STAFF.includes(user.kind)) {
      const reach = reachOf(user);
      if (reach === null) return true;
      if (WHOLE_SCHOOL_ONLY.has(fn)) return false;
      const t = touchedBy(fn, args);
      return t.students.every((sid) => reach.has(sid)) && t.as.every((id) => id === user.teacherId);
    }
    if (user.kind === 'student') {
      if (!STUDENT_FNS.has(fn) || (STUDENT_EXTRA[fn] && !STUDENT_EXTRA[fn](args))) return false;
      const t = touchedBy(fn, args);
      return !t.as.length && t.students.every((sid) => sid === user.studentId);
    }
    if (user.kind === 'parent') {
      if (fn === 'setFamily') return true;
      if (fn === 'answerConsent') return user.children.includes(st().consentReqs.find((r) => r.id === args[0])?.studentId);
    }
  } catch { /* malformed arguments */ }
  return false;
}
