// Pilot sign-in: accounts, password hashes, sessions and the per-role action check.
// Routes live in server/routes/10-auth.mjs; other modules import from here (canAct, MODE, userOf).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DATA_DIR, writeAtomic, isHttps } from './lib.mjs';
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
let hold = false; // inside batchAccounts: save once at the end
const saveAccounts = () => hold || writeAtomic(ACCOUNTS, JSON.stringify(accounts, null, 2));
const saveSessions = () => hold || writeAtomic(SESSIONS, JSON.stringify(sessions));
// Many account changes at once (the roster import makes hundreds): one save at the end.
export function batchAccounts(fn) { hold = true; try { return fn(); } finally { hold = false; saveAccounts(); saveSessions(); } }

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
export async function setPassword(a, password) { a.password = await hashPassword(password); delete a.setup; delete a.resetRequest; saveAccounts(); }

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
// An account's setup link: shown once to the admin, stored only as a hash. It also ends the old password and
// sessions, answers any "forgot password" request and lifts a sign-in block on that email.
// keepPassword (an emailed "forgot" link): the old password works until the link is used.
export function newSetup(a, { keepPassword = false } = {}) {
  const t = token();
  a.setup = { hash: sha(t), expiresAt: new Date(Date.now() + SETUP_DAYS * 864e5).toISOString() };
  if (!keepPassword) { delete a.password; endSessionsOf(a.id); }
  delete a.resetRequest; fails.delete(`e:${a.email}`); saveAccounts();
  return t;
}
// "Forgot your password?": noted on the account for an admin (or the student's advisor) to answer.
export function noteResetRequest(a) { a.resetRequest = { at: new Date().toISOString(), n: (a.resetRequest?.n || 0) + 1 }; saveAccounts(); }
export function dismissResetRequest(a) { delete a.resetRequest; saveAccounts(); }
export function accountBySetup(t) {
  if (typeof t !== 'string' || !t) return null;
  const h = sha(t);
  return accounts.find((a) => a.setup?.hash === h && a.setup.expiresAt > new Date().toISOString()) || null;
}

// ── Sessions: random token in a cookie, its hash on disk, 30 days ──
const prune = () => { const now = Date.now(); let n = 0; for (const [k, s] of Object.entries(sessions)) if (s.expiresAt < now || !accountById(s.userId)) { delete sessions[k]; n++; } return n; };
if (prune()) saveSessions();
// Every successful sign-in (password, setup link, family join) notes lastSignInAt on the account, for sign-up progress.
export function startSession(userId) {
  const t = token();
  const a = accountById(userId); if (a) { a.lastSignInAt = new Date().toISOString(); saveAccounts(); }
  sessions[sha(t)] = { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_DAYS * 864e5 };
  prune(); saveSessions();
  return { token: t, maxAge: SESSION_DAYS * 86400 };
}
export function sessionUser(t) {
  if (!t) return null;
  const s = sessions[sha(t)];
  if (!s || s.expiresAt < Date.now()) return null;
  const a = accountById(s.userId);
  return a && !a.paused ? a : null;
}
export const sessionCount = (userId) => Object.values(sessions).filter((s) => s.userId === userId && s.expiresAt >= Date.now()).length;
export function endSession(t) { if (t && sessions[sha(t)]) { delete sessions[sha(t)]; saveSessions(); } }
export function endSessionsOf(userId, keep) {
  for (const [k, s] of Object.entries(sessions)) if (s.userId === userId && k !== (keep && sha(keep))) delete sessions[k];
  saveSessions();
}
export const cookieHeader = (req, value, maxAge) => {
  const secure = isHttps(req) || process.env.COOKIE_SECURE === '1';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
};

// ── Paused accounts (a leaver no longer in the class lists): no sign-in, no sessions, no setup. The record stays. ──
export const PAUSED = 'Your account is paused. Ask your teacher.';
export function pauseAccount(a) { a.paused = { at: new Date().toISOString() }; endSessionsOf(a.id); saveAccounts(); }
export function unpauseAccount(a) { delete a.paused; saveAccounts(); }

// ── Slowing down repeated failed sign-ins, per email and per address ──
// The address is lib's clientIp(req) (the visitor behind cloudflared). A whole school can share one
// public address (school Wi-Fi), so the per-address limit is loose (AUTH_IP_LIMIT, default 300 failures
// in 15 minutes) and the strict one is per email (10). Failures per address only slow things down after
// many (every 50 counts as one per-email failure).
const fails = new Map(); // key → { n, first }
const WINDOW = 15 * 60 * 1000;
export const EMAIL_LIMIT = 10;
export const IP_LIMIT = Number(process.env.AUTH_IP_LIMIT) || 300;
export const BLOCKED = 'Too many tries. Wait 15 minutes or ask your teacher.';
export const failCount = (k) => { const f = fails.get(k); if (!f || Date.now() - f.first > WINDOW) { fails.delete(k); return 0; } return f.n; };
export const bump = (k) => { if (fails.size > 50000) for (const key of [...fails.keys()]) failCount(key); const n = failCount(k); fails.set(k, { n: n + 1, first: n ? fails.get(k).first : Date.now() }); return n + 1; };
export function throttle(email, ip) {
  if (failCount(`e:${email}`) >= EMAIL_LIMIT || failCount(`i:${ip}`) >= IP_LIMIT) return { blocked: true };
  const n = Math.max(failCount(`e:${email}`), Math.floor(failCount(`i:${ip}`) / 50));
  return { delay: n >= 3 ? Math.min(250 * 2 ** (n - 3), 8000) : 0 };
}
export function noteFailure(email, ip) { bump(`e:${email}`); bump(`i:${ip}`); }
export const noteSuccess = (email) => fails.delete(`e:${email}`);

// ── canAct: may this signed-in person call this api.js mutator with these arguments? ──
// Cheap, server-side, per role. Students may only change their own record; families only answer
// consent for their own children; whole-school staff may call any mutator except the admin-only ones;
// advisors and teachers only on the students they work with (reachOf in server/scope.mjs), only as
// themselves, and not the school-wide settings. Which students a call touches: touchedBy (scope.mjs).
// /api/action calls it in pilot mode: `if (!canAct(req.user, fn, args)) 403`. Demo mode has no accounts.
const ADMIN_ONLY = new Set(['resetDemo', 'restore', 'addStudent', 'addTeacher', 'eraseStudent', 'importRoster']);
// setLang is the demo's one shared family language; in a pilot each person keeps their own (POST /api/auth/prefs).
const ANYONE = new Set(['recordView']);
// School-wide settings an advisor or subject teacher does not change.
const WHOLE_SCHOOL_ONLY = new Set(['addSchoolLine', 'renameLine', 'decideBranch', 'setRollout', 'matchRoster', 'setSubjectLine']);
// The mutators a student may call, on their own record only.
const STUDENT_FNS = new Set(['setStudentDrafts', 'setGithub', 'disconnectGithub', 'simulateWeek', 'addStation', 'addBranch', 'endLine', 'restartLine',
  'completeOnboarding', 'capturePhone', 'setPrivacy', 'logLink', 'addGoal', 'setIntensity', 'remindParent', 'sync', 'importCandidates', 'addReflection',
  'setVisibility', 'editStation', 'deleteStation', 'completeGoal', 'setTags', 'requestEndorsement', 'addCheckIn', 'acceptCandidate', 'dismissCandidate',
  'restoreCandidate', 'mergeCandidate', 'resubmit', 'answerEvidence', 'acceptInterchange', 'ignoreInterchange', 'answerPrompt', 'skipPrompt']);
// A student's own file import only, never as a school source.
const STUDENT_EXTRA = { importCandidates: (a) => a[1]?.sourceId === 'mine' && Array.isArray(a[0]) && a[0].length > 0 };
const st = () => api.getStore();
// Class prompts, for an advisor or subject teacher: only a class they teach (an advisor of every student in it is not
// enough), and never a student's answer.
const teachesClass = (u, classId) => !!classId && !!(st().classes || []).find((c) => c.id === classId)?.teacherIds?.includes(u.teacherId);
const STAFF_EXTRA = {
  askClass: (u, a) => teachesClass(u, a[0]),
  remindClass: (u, a) => teachesClass(u, api.getClassPrompt(a[0])?.classId),
  answerPrompt: () => false, skipPrompt: () => false,
};
export function canAct(user, fn, args = []) {
  if (!user || typeof fn !== 'string') return false;
  // Undo sends a whole copy of the record, and in a pilot every browser holds only its own part of it.
  if (fn === 'restore') return false;
  if (fn === 'setHandoverNote') { try { return handoverOk(user, args); } catch { return false; } }
  if (isAdmin(user)) return true;
  if (ADMIN_ONLY.has(fn)) return false;
  if (ANYONE.has(fn)) return true;
  if (COMMENT_FNS.has(fn)) { try { return commentOk(user, fn, args); } catch { return false; } }
  if (SAFE_FNS.has(fn)) { try { return safeOk(user, fn, args); } catch { return false; } }
  // Only your own bell: every key must be one of yours (st:…, t:…, fam:…, role:…, or your record's demo persona id).
  if (fn === 'markNotificationsRead') { const mine = new Set(api.notifyKeys({ kind: user.kind, studentId: user.studentId, teacherId: user.teacherId, children: user.children })); return [].concat(args[0] ?? []).every((k) => mine.has(k)); }
  try {
    // A nudge: the student's own advisor, or whole-school staff, as themselves.
    if (fn === 'nudgeStudent') return STAFF.includes(user.kind) && !!user.teacherId && args[1] === user.teacherId && (reachOf(user) === null || api.getStudent(args[0])?.advisorId === user.teacherId);
    if (STAFF.includes(user.kind)) {
      const reach = reachOf(user);
      if (reach === null) return true;
      if (WHOLE_SCHOOL_ONLY.has(fn)) return false;
      if (STAFF_EXTRA[fn] && !STAFF_EXTRA[fn](user, args)) return false;
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

// ── Moment comments (api.addMomentComment, editMomentComment, deleteMomentComment, markCommentsRead) ──
// As yourself only ('student' for a student; your teacherId for staff), never on a private station. A student: their
// own stations. Whole-school staff: any. An advisor or teacher: a student in reach, and to write, only as that student's
// advisor, a teacher they asked about the station, or its sponsor (api.commentsAsked); reading marks need only reach.
// Editing: within api.COMMENT_EDIT_MIN minutes by the server's clock too.
const COMMENT_FNS = new Set(['addMomentComment', 'editMomentComment', 'deleteMomentComment', 'markCommentsRead']);
for (const f of COMMENT_FNS) STUDENT_FNS.add(f);
function commentOk(user, fn, [target, by]) {
  const c = fn === 'editMomentComment' || fn === 'deleteMomentComment' ? api.getMomentComment(target) : null;
  const e = api.getEvent(c ? c.eventId : target);
  if (!e || (c === null && fn !== 'addMomentComment' && fn !== 'markCommentsRead') || e.visibility === 'private') return false;
  if (c && c.by !== by) return false;
  if (fn === 'editMomentComment' && Date.now() - Date.parse(c.at) > (api.COMMENT_EDIT_MIN + 1) * 60000) return false;
  if (user.kind === 'student') return by === 'student' && e.studentId === user.studentId;
  if (!STAFF.includes(user.kind) || !user.teacherId || by !== user.teacherId) return false;
  const reach = reachOf(user);
  if (reach === null) return true;
  if (!reach.has(e.studentId)) return false;
  return fn === 'markCommentsRead' || fn === 'deleteMomentComment' || api.commentsAsked(e.id, user.teacherId);
}

// ── Per-person settings (POST /api/auth/prefs): each account's own language, kept on the account ──
export const LANGS = ['en', 'th'];
export function setPrefs(a, { lang }) {
  if (!LANGS.includes(lang)) return 'Pick English or Thai.';
  a.lang = lang; saveAccounts();
  return null;
}
// The demo's one shared family language (api.setLang) would change it for everybody: in a pilot only an admin may.
ADMIN_ONLY.add('setLang');
// ── Safeguarding (api.reportItem, api.moderateReport) ──
// Reporting: as yourself only (from.key: 'student', your teacherId, 'fam:<child>' with your name, or admin), on what you
// can see: a student their own moment or a comment on it; staff a student in reach; a family a child's moment as the
// family view shows it (never a comment, never a hidden one). Moderating: coordinators, counsellors, leadership and
// admins, as themselves.
const SAFE_FNS = new Set(['reportItem', 'moderateReport']);
function safeOk(user, fn, args) {
  if (fn === 'moderateReport') return api.MODERATOR_KINDS.includes(user.kind) && (user.teacherId ? args[3] === user.teacherId : !args[3]);
  const [target, , , from] = args;
  const c = target?.commentId ? api.getMomentComment(target.commentId) : null;
  const e = api.getEvent(c ? c.eventId : target?.eventId);
  if (!e || e.visibility === 'private' || (target?.commentId && !c)) return false;
  const key = from?.key;
  if (user.kind === 'student') return key === 'student' && e.studentId === user.studentId;
  if (STAFF.includes(user.kind)) { const reach = reachOf(user); return !!user.teacherId && key === user.teacherId && (reach === null || reach.has(e.studentId)); }
  if (user.kind === 'parent') return !c && !e.hidden && key === `fam:${e.studentId}` && (user.children || []).includes(e.studentId) && from?.name === user.name && api.VISIBLE_TO[api.familyViewer(e.studentId)].includes(e.visibility);
  return false;
}
// ── Year handover (api.setHandoverNote, carryOverGoal, closeGoal) ──
// A handover note: only the student's current advisor or the advisor they were handed over from (their latest handover),
// as themselves. Nobody else writes one, admins and whole-school roles included (coordinators read them). Carrying over
// or closing a goal: the student on their own goals, or staff by reach as for any station.
function handoverOk(user, [studentId, , by]) {
  if (!STAFF.includes(user.kind) || !user.teacherId || by !== user.teacherId) return false;
  const s = api.getStudent(studentId);
  return !!s && (s.advisorId === by || api.previousAdvisorOf(studentId) === by);
}
for (const f of ['carryOverGoal', 'closeGoal']) STUDENT_FNS.add(f);
