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
export async function setPassword(a, password) { a.password = await hashPassword(password); a.signedUpAt ||= new Date().toISOString(); delete a.setup; delete a.resetRequest; saveAccounts(); }

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
  if (SPOT_FNS.has(fn)) { try { return spotOk(user, fn, args); } catch { return false; } }
  if (fn === 'dropPhotos' || (fn === 'reportItem' && args[0]?.photoId)) { try { return dropOk(user, fn, args); } catch { return false; } }
  if (fn === 'setHandoverNote') { try { return handoverOk(user, args); } catch { return false; } }
  if (TR_FNS.has(fn)) { try { return termReflectionOk(user, fn, args); } catch { return false; } }
  if (PF_FNS.has(fn) || (fn === 'reportItem' && args[0]?.feedbackId)) { try { return peerOk(user, fn, args); } catch { return false; } }
  if (fn === 'markMilestonesSeen') return milestonesOk(user, args); // only the student, never staff, admins or families
  if (EX_FNS.has(fn)) { try { return exhibitionOk(user, fn, args); } catch { return false; } }
  if (LV_FNS.has(fn)) { try { return leaverOk(user, fn, args); } catch { return false; } }
  if (GC_FNS.has(fn)) { try { return checkinOk(user, fn, args); } catch { return false; } }
  if (TK_FNS.has(fn)) { try { return taskOk(user, fn, args); } catch { return false; } }
  if (CF_FNS.has(fn)) { try { return confOk(user, fn, args); } catch { return false; } }
  if (SLC_FNS.has(fn)) { try { return slcOk(user, fn, args); } catch { return false; } }
  if (SP_FNS.has(fn)) { try { return subjectPromptOk(user, fn, args); } catch { return false; } }
  if (CAS_FNS.has(fn)) { try { return casOk(user, fn, args); } catch { return false; } }
  if (PH_FNS.has(fn)) { try { return phraseOk(user, fn, args); } catch { return false; } }
  if (FN_FNS.has(fn) || (fn === 'reportItem' && args[0]?.familyNoteId)) { try { return familyNoteOk(user, fn, args); } catch { return false; } }
  if (SE_FNS.has(fn)) { try { return schoolEventOk(user, fn, args); } catch { return false; } }
  if (YS_FNS.has(fn)) { try { return signoffOk(user, fn, args); } catch { return false; } }
  if (MT_FNS.has(fn)) { try { return momentTemplateOk(user, fn, args); } catch { return false; } }
  if (isAdmin(user)) return true;
  if (ADMIN_ONLY.has(fn)) return false;
  if (ANYONE.has(fn)) return true;
  if (COMMENT_FNS.has(fn)) { try { return commentOk(user, fn, args); } catch { return false; } }
  if (SAFE_FNS.has(fn)) { try { return safeOk(user, fn, args); } catch { return false; } }
  // Only your own bell: every key must be one of yours (st:…, t:…, fam:…, role:…, or your record's demo persona id).
  if (fn === 'markNotificationsRead' || fn === 'clearReadNotifications') { const mine = new Set(api.notifyKeys({ kind: user.kind, studentId: user.studentId, teacherId: user.teacherId, children: user.children })); return [].concat(args[0] ?? []).every((k) => mine.has(k)); }
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
export function setPrefs(a, { lang, display, notify }) {
  if ((lang !== undefined || (!display && !notify)) && !LANGS.includes(lang)) return 'Pick English or Thai.';
  if (lang !== undefined) a.lang = lang;
  if (display) a.display = display; // already checked (routes/19-prefs.mjs)
  if (notify) a.notify = notify; // notification settings, checked there too
  saveAccounts();
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

// ── Spotted moments (api.spotMoment, acceptSpotted, declineSpotted) ──
// Spotting: any staff member (admins too, when linked to a staff record), as themselves, for students in their reach.
// Accepting or declining: only the student it was made for, never staff or admins on their behalf.
const SPOT_FNS = new Set(['spotMoment', 'acceptSpotted', 'declineSpotted']);
function spotOk(user, fn, args) {
  if (fn !== 'spotMoment') return user.kind === 'student' && !!user.studentId && args[1] === user.studentId && api.getSpotted(args[0])?.studentId === user.studentId;
  if (!(STAFF.includes(user.kind) || isAdmin(user)) || !user.teacherId || args[1] !== user.teacherId) return false;
  const ids = [].concat(args[0] ?? []), reach = reachOf(user);
  return ids.length > 0 && ids.every((sid) => typeof sid === 'string' && (reach === null ? !!api.getStudent(sid) : reach.has(sid)));
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
// ── Term reflection (api.openReflectionWindow, closeReflectionWindow, saveTermReflection, finishTermReflection) ──
// Opening: an advisor for their own advisees (advisorId is their teacherId), whole-school staff (a coordinator) for any
// advisory or a whole Year, as themselves; admins too. Closing early: whoever opened it, that advisory's advisor,
// whole-school staff and admins. Writing: only the student, on their own reflection in a window that includes them.
const TR_FNS = new Set(['openReflectionWindow', 'closeReflectionWindow', 'saveTermReflection', 'finishTermReflection']);
function termReflectionOk(user, fn, args) {
  if (fn === 'saveTermReflection' || fn === 'finishTermReflection') return user.kind === 'student' && !!user.studentId && args[1] === user.studentId && !!api.getReflectionWindow(args[0])?.studentIds.includes(user.studentId);
  if (isAdmin(user)) return fn === 'closeReflectionWindow' || !args[1] || args[1] === user.teacherId;
  if (!STAFF.includes(user.kind) || !user.teacherId) return false;
  const whole = reachOf(user) === null;
  if (fn === 'closeReflectionWindow') { const w = api.getReflectionWindow(args[0]); return !!w && (whole || w.by === user.teacherId || w.advisorId === user.teacherId); }
  const spec = args[0] || {};
  return args[1] === user.teacherId && (whole || (!spec.year && spec.advisorId === user.teacherId));
}
// ── Kind feedback from classmates (api.setPeerFeedback, givePeerFeedback, thankPeerFeedback, hidePeerFeedback,
// setPeerFeedbackYear; reportItem on { feedbackId }) ──
// Opting a moment in, thanking and hiding: only the student who owns the moment. Giving: only a student, as themselves,
// on a classmate's moment when they share a current class (never staff or admins writing as a student). Turning a Year
// off or on: coordinators and leadership as themselves, admins. Reporting feedback: the moment's owner ('student'), staff
// who can read it (the class's teachers, either student's advisor, whole-school roles) as themselves, admins.
const PF_FNS = new Set(['setPeerFeedback', 'givePeerFeedback', 'thankPeerFeedback', 'hidePeerFeedback', 'setPeerFeedbackYear']);
function peerOk(user, fn, args) {
  const me = user.kind === 'student' && user.studentId;
  if (fn === 'setPeerFeedback') return !!me && api.getEvent(args[0])?.studentId === me;
  if (fn === 'givePeerFeedback') { const e = api.getEvent(args[0]); return !!me && args[1] === me && !!e && e.studentId !== me && api.sharedClasses(e.studentId, me).length > 0; }
  if (fn === 'thankPeerFeedback' || fn === 'hidePeerFeedback') return !!me && api.getPeerFeedback(args[0])?.studentId === me;
  if (fn === 'setPeerFeedbackYear') return isAdmin(user) ? !args[2] || args[2] === user.teacherId : ['coordinator', 'leadership'].includes(user.kind) && !!user.teacherId && args[2] === user.teacherId;
  const f = api.getPeerFeedback(args[0].feedbackId), key = args[3]?.key;
  if (!f) return false;
  if (isAdmin(user)) return key === 'admin' || (!!user.teacherId && key === user.teacherId);
  if (me) return key === 'student' && f.studentId === me;
  if (!STAFF.includes(user.kind) || !user.teacherId || key !== user.teacherId) return false;
  return reachOf(user) === null || teachesClass(user, f.classId) || [f.studentId, f.fromId].some((sid) => api.getStudent(sid)?.advisorId === user.teacherId);
}
// ── Milestones (api.markMilestonesSeen): a student marks their own celebrations seen; nobody does it for them. ──
const milestonesOk = (user, args) => user.kind === 'student' && !!user.studentId && args[0] === user.studentId;
// ── Exhibition screens (api.createExhibition, removeExhibitionSlide, pauseExhibition, revokeExhibition) ──
// Staff and admins only, as themselves (an admin with no staff record: by null). Making one: whole-school staff and admins
// for any Years, classes and lines; an advisor or subject teacher only from classes they teach and their own advisory (at
// least one of those, never whole Years). Pausing and turning off: whoever made it, and admins. Removing a slide: those,
// the moderators (coordinators, counsellors, leadership), and a teacher of a class the moment's student is in now.
const EX_FNS = new Set(['createExhibition', 'removeExhibitionSlide', 'pauseExhibition', 'revokeExhibition']);
function exhibitionOk(user, fn, args) {
  const admin = isAdmin(user);
  if (!admin && !(STAFF.includes(user.kind) && user.teacherId)) return false;
  const by = fn === 'createExhibition' || fn === 'revokeExhibition' ? args[1] : args[2];
  if (admin ? !!by && by !== user.teacherId : by !== user.teacherId) return false;
  if (fn === 'createExhibition') {
    const spec = args[0] || {};
    if (typeof args[2] !== 'string' || !api.EXHIBIT_TOKEN.test(args[2])) return false;
    if (admin || reachOf(user) === null) return true;
    const classes = [].concat(spec.classIds || []);
    if ([].concat(spec.years || []).length || (!classes.length && !spec.advisory)) return false;
    return classes.every((c) => teachesClass(user, c));
  }
  const x = api.getExhibition(args[0]);
  if (!x) return false;
  if (admin || (!!x.by && x.by === user.teacherId)) return true;
  if (fn !== 'removeExhibitionSlide') return false;
  if (api.MODERATOR_KINDS.includes(user.kind)) return true;
  const e = api.getEvent(args[1]);
  return !!e && (st().enrolments || []).some((n) => n.studentId === e.studentId && !(n.to && n.to < api.TODAY) && teachesClass(user, n.classId));
}
// ── Leaver portfolio (api.saveLeaver, shareLeaver, revokeLeaver, doneLeaverComment, commentLeaver) ──
// Building, sharing, withdrawing and ticking comments: only the student, on their own (never staff, admins or families).
// Commenting: the student's advisor or whole-school staff, as themselves, once there is a portfolio.
const LV_FNS = new Set(['saveLeaver', 'shareLeaver', 'revokeLeaver', 'doneLeaverComment', 'commentLeaver']);
function leaverOk(user, fn, [sid, by]) {
  if (fn !== 'commentLeaver') return user.kind === 'student' && !!user.studentId && sid === user.studentId;
  if (!STAFF.includes(user.kind) || !user.teacherId || by !== user.teacherId || !api.getLeaver(sid)) return false;
  const reach = reachOf(user);
  return reach === null || (reach.has(sid) && api.getStudent(sid)?.advisorId === user.teacherId);
}
// ── Weekly goal check-ins (api.checkInGoal, snoozeCheckins, sendEncouragement) ──
// Checking in and snoozing: only the student, on their own open goals (never staff, admins or families on their behalf).
// Encouragement: the student's advisor or the goal's accepted sponsor, as themselves (admins too, only when they are one).
const GC_FNS = new Set(['checkInGoal', 'snoozeCheckins', 'sendEncouragement']);
function checkinOk(user, fn, [goalId, by]) {
  const e = api.getEvent(goalId);
  if (!api.isOpenGoal(e)) return false;
  if (fn !== 'sendEncouragement') return user.kind === 'student' && !!user.studentId && e.studentId === user.studentId;
  if (!(STAFF.includes(user.kind) || isAdmin(user)) || !user.teacherId || by !== user.teacherId) return false;
  return api.canEncourage(e.id, user.teacherId);
}
// ── Class tasks (api.setTask, editTask, extendTask, handInTask, remindDueTasks) ──
// Setting, editing and extending: a teacher of the class (in its teacherIds; whole-school staff and admins too, but only
// when they teach it), as themselves; extending only for a student the task was set for. Handing in: only that student,
// on their own. The day-before reminder: only the server (server/routes/68-tasks.mjs), never through /api/action.
const TK_FNS = new Set(['setTask', 'editTask', 'extendTask', 'handInTask', 'remindDueTasks']);
function taskOk(user, fn, a) {
  if (fn === 'remindDueTasks') return false;
  if (fn === 'handInTask') return user.kind === 'student' && !!user.studentId && a[1] === user.studentId && !!api.getTask(a[0])?.studentIds.includes(a[1]);
  if (!(STAFF.includes(user.kind) || isAdmin(user)) || !user.teacherId) return false;
  if (fn === 'setTask') return a[1] === user.teacherId && teachesClass(user, a[0]);
  const t = api.getTask(a[0]);
  if (!t || !teachesClass(user, t.classId)) return false;
  if (fn === 'editTask') return a[1] === user.teacherId;
  return a[3] === user.teacherId && t.studentIds.includes(a[1]);
}
// ── Conference booking (api.openConferenceRound, editConferenceRound, closeConferenceRound, bookConference,
// cancelConference, blockConferenceSlot) ──
// Opening: an advisor for their own advisory, whole-school staff for any advisory or a whole Year, as themselves; admins.
// Editing and closing: whoever opened it, its advisor, whole-school staff, admins. Booking: a family only for their own
// children ('family'), at least api.CONF_CHANGE_H hours ahead by the server's clock, and only moving a booking that is still
// that far off; the advisor (as themselves) for their own advisees, any time. Cancelling: the same. Blocking a slot: the
// advisor of that grid, as themselves. Students never; reminders only the server (sendConferenceReminders).
const CF_FNS = new Set(['openConferenceRound', 'editConferenceRound', 'closeConferenceRound', 'bookConference', 'cancelConference', 'blockConferenceSlot']);
ADMIN_ONLY.add('sendConferenceReminders');
function confOk(user, fn, args) {
  const admin = isAdmin(user), tid = user.teacherId || null, staff = STAFF.includes(user.kind) && !!tid;
  const whole = staff && reachOf(user) === null;
  const soon = (d, t) => api.confTooSoon(d, t, Date.now());
  if (fn === 'openConferenceRound') {
    const [spec, by] = args;
    if (admin) return !by || by === tid;
    return staff && by === tid && (whole || (!spec?.year && spec?.advisorId === tid));
  }
  if (fn === 'editConferenceRound' || fn === 'closeConferenceRound') {
    const r = api.getConferenceRound(args[0]), by = fn === 'editConferenceRound' ? args[2] : args[1];
    if (!r) return false;
    if (admin) return true;
    return staff && by === tid && (whole || r.by === tid || r.advisorId === tid);
  }
  if (fn === 'blockConferenceSlot') {
    const [rid, aid, , , , by] = args, r = api.getConferenceRound(rid);
    return !!r && r.advisorIds.includes(aid) && !!tid && aid === tid && by === tid && (staff || admin);
  }
  const parent = user.kind === 'parent', kids = user.children || [];
  if (fn === 'bookConference') {
    const [rid, sid, slot, by] = args, r = api.getConferenceRound(rid), s = api.getStudent(sid);
    if (!r || !s || !r.studentIds.includes(sid)) return false;
    if (parent) { const mine = api.confBookingOf(rid, sid); return by === 'family' && kids.includes(sid) && !soon(slot?.date, slot?.time) && !(mine && soon(mine.date, mine.time)); }
    return (staff || admin) && !!tid && by === tid && s.advisorId === tid;
  }
  if (fn === 'cancelConference') {
    const b = api.getConfBooking(args[0]), by = args[1];
    if (!b) return false;
    if (parent) return by === 'family' && kids.includes(b.studentId) && !soon(b.date, b.time);
    return (staff || admin) && !!tid && by === tid && api.getStudent(b.studentId)?.advisorId === tid;
  }
  return false;
}
// ── Student-led conferences (api.saveConfPrep, writeConfNote) ──
// Getting ready: only the student, on their own prep, in a round that includes them. The lines at the end: a parent for
// their own children (the family's line, as 'family'), the student their own line (as 'student'), and the student's
// advisor or whole-school staff either line, as themselves. Admins too, as themselves. Nobody else.
const SLC_FNS = new Set(['saveConfPrep', 'writeConfNote']);
function slcOk(user, fn, args) {
  const r = api.getConferenceRound(args[0]), sid = args[1];
  if (!r || !r.studentIds.includes(sid)) return false;
  if (fn === 'saveConfPrep') return user.kind === 'student' && !!user.studentId && sid === user.studentId;
  const [, , who, , by] = args;
  if (user.kind === 'parent') return who === 'family' && by === 'family' && (user.children || []).includes(sid);
  if (user.kind === 'student') return who === 'student' && by === 'student' && sid === user.studentId;
  const tid = user.teacherId || null;
  if (!tid || by !== tid || !(STAFF.includes(user.kind) || isAdmin(user))) return false;
  return isAdmin(user) || reachOf(user) === null || api.getStudent(sid)?.advisorId === tid;
}
// ── Subject prompts (api.setSubjectPrompts, clearSubjectPrompts, answerExampleAsk) ──
// A class's prompts: a teacher of that class (in its teacherIds), as themselves. A line's prompts: coordinators (heads of
// department) and leadership, as themselves. Admins: either, as themselves or with no staff record (by null). An example
// from a student's moment: only one the writer can reach. Saying yes or no to an example: only that student.
const SP_FNS = new Set(['setSubjectPrompts', 'clearSubjectPrompts', 'answerExampleAsk']);
const LINE_PROMPT_KINDS = ['coordinator', 'leadership'];
function subjectPromptOk(user, fn, args) {
  if (fn === 'answerExampleAsk') return user.kind === 'student' && !!user.studentId && args[2] === user.studentId && !!api.getSubjectPrompt(args[0])?.examples.some((x) => x.id === args[1] && x.studentId === user.studentId);
  const admin = isAdmin(user), by = args[fn === 'setSubjectPrompts' ? 2 : 1] ?? null;
  if (admin ? !!by && by !== user.teacherId : !(STAFF.includes(user.kind) && !!user.teacherId && by === user.teacherId)) return false;
  const target = fn === 'setSubjectPrompts' ? args[0] : api.getSubjectPrompt(args[0]);
  if (!target || typeof target !== 'object') return false;
  if (!admin && !(target.classId ? teachesClass(user, target.classId) : LINE_PROMPT_KINDS.includes(user.kind))) return false;
  if (fn !== 'setSubjectPrompts') return true;
  const reach = reachOf(user);
  return [].concat(args[1]?.examples || []).every((x) => { if (!x?.eventId) return true; const sid = api.getEvent(x.eventId)?.studentId; return !!sid && (reach === null || reach.has(sid)); });
}
// ── CAS hours (api.logCasExperience, logCasHours, withdrawCasHours, confirmCasHours, returnCasHours, setCasCode, setCasCoordinator) ──
// Logging and taking back: only the student (Years 12 and 13), on their own experiences. Confirming or sending back, as
// yourself: the staff supervisor the entry names ('supervisor'), or a CAS coordinator (role coordinator, or marked on
// Accounts) or admin on anyone's behalf ('coordinator'). An outside supervisor confirms through their code on the server
// (server/routes/47-cas.mjs), never through /api/action, and nobody sets a code here. Marking a CAS coordinator: admins.
const CAS_FNS = new Set(['logCasExperience', 'logCasHours', 'withdrawCasHours', 'confirmCasHours', 'returnCasHours', 'setCasCode', 'setCasCoordinator']);
function casOk(user, fn, args) {
  const me = user.kind === 'student' && user.studentId;
  if (fn === 'logCasExperience') return !!me && args[0] === me && api.casAllowed(me);
  if (fn === 'logCasHours') { const e = api.getEvent(args[1]); return !!me && args[0] === me && !!e?.cas && e.studentId === me && api.casAllowed(me); }
  if (fn === 'withdrawCasHours') return !!me && args[1] === me && api.getCasEntry(args[0])?.studentId === me;
  if (fn === 'setCasCoordinator') return isAdmin(user);
  if (fn === 'setCasCode') return false;
  const x = api.getCasEntry(args[0]), via = args[2]?.via;
  if (!x || me) return false;
  if (isAdmin(user)) return via === 'coordinator' && (args[1] ?? null) === (user.teacherId ?? null);
  if (!STAFF.includes(user.kind) || !user.teacherId || args[1] !== user.teacherId) return false;
  if (via === 'supervisor') return x.supervisor?.kind === 'staff' && x.supervisor.teacherId === user.teacherId;
  return via === 'coordinator' && api.isCasCoordinator({ kind: user.kind, teacherId: user.teacherId });
}

// ── Teacher comment bank (api.addPhrase, editPhrase, deletePhrase, movePhrase, usePhrase) ──
// Always as yourself (an admin with no staff record: by null). Your own bank: any member of staff with a staff record.
// The school bank: coordinators and leadership (with a staff record) and admins. Counting a use: your own or a school
// phrase, with a staff record. Students and families never.
const PH_FNS = new Set(['addPhrase', 'editPhrase', 'deletePhrase', 'movePhrase', 'usePhrase']);
const PH_SCHOOL = ['coordinator', 'leadership'];
function phraseOk(user, fn, args) {
  const admin = isAdmin(user), tid = user.teacherId || null;
  if (!(STAFF.includes(user.kind) || admin) || (args[1] ?? null) !== tid) return false;
  const owner = fn === 'addPhrase' ? args[0] : api.getPhrase(args[0])?.owner;
  if (typeof owner !== 'string') return false;
  if (fn === 'usePhrase') return !!tid && (owner === 'school' || owner === tid);
  if (owner === 'school') return admin || (!!tid && PH_SCHOOL.includes(user.kind));
  return !!tid && owner === tid;
}
// ── School events (api.addSchoolEvent, editSchoolEvent, removeSchoolEvent, importSchoolEvents, remindSchoolEvent,
// dismissSchoolEvent) ──
// Adding, editing, removing, importing and the one reminder: admins, coordinators and leadership, as themselves (an admin
// with no staff record as null). Dismissing the card: only a student it was for, on their own.
// A moment from it is an ordinary addStation; api.addStation links it only when the event was for that student.
const SE_FNS = new Set(['addSchoolEvent', 'editSchoolEvent', 'removeSchoolEvent', 'importSchoolEvents', 'remindSchoolEvent', 'dismissSchoolEvent']);
export const SE_MANAGERS = ['coordinator', 'leadership'];
export const manageSchoolEvents = (u) => !!u && (isAdmin(u) || (SE_MANAGERS.includes(u.kind) && !!u.teacherId));
function schoolEventOk(user, fn, a) {
  const me = user.kind === 'student' && user.studentId;
  if (fn === 'dismissSchoolEvent') return !!me && a[1] === me && !!api.getSchoolEvent(a[0])?.studentIds.includes(me);
  if (!manageSchoolEvents(user)) return false;
  const by = a[{ addSchoolEvent: 1, editSchoolEvent: 2, removeSchoolEvent: 1, importSchoolEvents: 1, remindSchoolEvent: 1 }[fn]] ?? null;
  if (by !== (user.teacherId ?? null)) return false;
  return fn === 'addSchoolEvent' || fn === 'importSchoolEvents' || !!api.getSchoolEvent(a[0]);
}

// ── System health (routes/69-health.mjs): how many sessions are live, and for how many people ──
export function liveSessions() {
  const now = Date.now(), live = Object.values(sessions).filter((s) => s.expiresAt >= now && accountById(s.userId));
  return { sessions: live.length, people: new Set(live.map((s) => s.userId)).size };
}

// ── Family encouragement (api.addFamilyNote, editFamilyNote, deleteFamilyNote, thankFamilyNote, setFamilyNoteHidden;
// reportItem on { familyNoteId }) ──
// Writing: only a family member, as their own account (`u:<id>`, their own name), on their child's moment that the family
// view shows (not hidden), while the student has notes on. Changing or deleting: only its writer. Thanking and hiding it
// from their own view: only the student. Reporting: the student, staff who read it (advisor, a current class's teacher,
// whole-school roles) as themselves, admins. Never staff or admins writing as a family.
const FN_FNS = new Set(['addFamilyNote', 'editFamilyNote', 'deleteFamilyNote', 'thankFamilyNote', 'setFamilyNoteHidden']);
function familyNoteOk(user, fn, args) {
  const me = user.kind === 'student' && user.studentId, fam = user.kind === 'parent' && !!user.id, key = `u:${user.id}`, kids = user.children || [];
  if (fn === 'addFamilyNote') { const e = api.getEvent(args[0]); return fam && !!e && kids.includes(e.studentId) && api.familyShows(e) && api.familyNotesOn(e.studentId) && args[1]?.key === key && args[1]?.name === user.name; }
  const n = api.getFamilyNote(fn === 'reportItem' ? args[0].familyNoteId : args[0]);
  if (!n) return false;
  if (fn === 'editFamilyNote' || fn === 'deleteFamilyNote') return fam && args[1] === key && n.by === key && kids.includes(n.studentId);
  if (fn !== 'reportItem') return !!me && n.studentId === me && !n.hidden;
  const k = args[3]?.key;
  if (isAdmin(user)) return k === 'admin' || (!!user.teacherId && k === user.teacherId);
  if (me) return k === 'student' && n.studentId === me && !n.hidden;
  if (!STAFF.includes(user.kind) || !user.teacherId || k !== user.teacherId) return false;
  return reachOf(user) === null || api.familyNoteReader(user.teacherId, n.studentId);
}
// ── Class photo drop (api.dropPhotos; acceptSpotted/declineSpotted answer it; reportItem on { photoId }) ──
// Sending: a teacher of the class (whole-school staff and admins too, only for a class they teach), as themselves; the
// mutator checks every student is in the class. Reporting a photo: a student it was given to who still holds it, as
// 'student'; staff who reach a student it was given to, as themselves; admins. Never families.
function dropOk(user, fn, args) {
  if (fn === 'dropPhotos') return (STAFF.includes(user.kind) || isAdmin(user)) && !!user.teacherId && args[1] === user.teacherId && teachesClass(user, args[0]);
  const [target, , , from] = args, f = api.dropPhotoById(target.photoId), key = from?.key;
  if (!f?.p.url) return false;
  const sid = target.studentId || f.p.studentIds[0];
  if (!f.p.studentIds.includes(sid)) return false;
  if (user.kind === 'student') return key === 'student' && sid === user.studentId && (st().spotted || []).some((x) => x.dropId === f.d.id && x.studentId === sid && x.photos?.some((p) => p.id === f.p.id) && (x.status === 'open' || (x.kept || []).includes(f.p.id)));
  if (isAdmin(user)) return key === 'admin' || (!!user.teacherId && key === user.teacherId);
  if (!STAFF.includes(user.kind) || !user.teacherId || key !== user.teacherId) return false;
  const reach = reachOf(user);
  return reach === null || reach.has(sid);
}

// ── Advisor year sign-off (api.tickSignoff, signOffYear, markNotThisYear, undoSignoff, setSignoffYear, setSignoffClose) ──
// Ticking, signing off, "Not this year" and taking it back: only the student's current advisor, as themselves (admins,
// leadership and other advisors never sign off for them). The checklist settings and the closing date: leadership as
// themselves, and admins (as themselves, or null with no staff record). Students and families never.
const YS_FNS = new Set(['tickSignoff', 'signOffYear', 'markNotThisYear', 'undoSignoff', 'setSignoffYear', 'setSignoffClose']);
const YS_BY = { tickSignoff: 3, signOffYear: 1, markNotThisYear: 1, undoSignoff: 1, setSignoffYear: 2, setSignoffClose: 1 };
export const manageSignoff = (u) => !!u && (isAdmin(u) || (u.kind === 'leadership' && !!u.teacherId));
function signoffOk(user, fn, a) {
  const by = a[YS_BY[fn]] ?? null;
  if (fn === 'setSignoffYear' || fn === 'setSignoffClose') return manageSignoff(user) && by === (user.teacherId ?? null);
  if (!(STAFF.includes(user.kind) || isAdmin(user)) || !user.teacherId || by !== user.teacherId) return false;
  return typeof a[0] === 'string' && api.getStudent(a[0])?.advisorId === user.teacherId;
}
// ── Moment templates (api.saveMomentTemplate, setMomentTemplateOff) ──
// The school's templates and the built-in ones' lines and on/off: coordinators and leadership as themselves, admins (as
// themselves, or by null without a staff record). Nobody else. Putting a guide on a class task or question goes with that
// task or question (taskOk, askClass); the mutator checks the guide is on.
const MT_FNS = new Set(['saveMomentTemplate', 'setMomentTemplateOff']);
const MT_KINDS = ['coordinator', 'leadership'];
function momentTemplateOk(user, fn, args) {
  const by = args[fn === 'saveMomentTemplate' ? 1 : 2] ?? null;
  if (fn === 'saveMomentTemplate' ? !args[0] || typeof args[0] !== 'object' : !api.getMomentTemplate(args[0])) return false;
  if (isAdmin(user)) return by === null || by === user.teacherId;
  return MT_KINDS.includes(user.kind) && !!user.teacherId && by === user.teacherId;
}
