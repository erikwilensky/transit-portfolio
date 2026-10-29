// Pilot sign-in, browser side. The server says which mode it runs in (GET /api/auth/me).
// Demo mode (the default, and whenever there is no server): the persona switcher, tours and reset, no sign-in.
// Pilot mode: each person signs in and sees only their own role's screens, built as a persona.
import { addStudent, addTeacher, getStudent, getTeacher, isModerator, setLang, setOwnLang } from './api.js';
import { savedLang, saveLang } from './i18n.js';
import { PERSONAS, NAV, setPilotPersona } from './personas.js';
import { clearCaches } from './pwa.js';
import { dropUnsent, unsent } from './sync.js';
import { signOutWarning } from './outbox.js';

let state = { mode: 'demo', user: null, server: false };
const listeners = new Set();
export const onAuth = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const set = (next) => { state = next; applyPersona(); listeners.forEach((fn) => fn(state)); };
export const getAuth = () => state;
export const isPilot = () => state.mode === 'pilot';

async function call(method, url, body) {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(json.error || (r.status === 429 ? 'Too many tries. Wait a few minutes.' : 'Something went wrong. Try again.')), { status: r.status });
  return json;
}

// Asks the server which mode it is in and who is signed in. No server (static hosting, vite preview): demo.
export async function loadAuth() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no server');
    const j = await r.json();
    set({ mode: j.mode === 'pilot' ? 'pilot' : 'demo', user: j.user || null, server: true });
    remember(j.mode === 'pilot' && j.user ? { mode: 'pilot', user: j.user } : null);
  } catch (e) {
    // No connection at all (not a page without a server): the account last signed in here, so changes can be made
    // offline and sent later (src/sync.js). Signing out forgets it (a tp- key).
    const last = e instanceof TypeError && remembered();
    set(last ? { ...last, server: true, offline: true } : { mode: 'demo', user: null, server: false });
  }
  return state;
}
const LAST = 'tp-offline-auth';
const remember = (a) => { try { if (a) localStorage.setItem(LAST, JSON.stringify(a)); else localStorage.removeItem(LAST); } catch { /* blocked */ } };
const remembered = () => { try { const a = JSON.parse(localStorage.getItem(LAST)); return a?.user?.id ? a : null; } catch { return null; } };

export const signIn = async (email, password) => { const j = await call('POST', '/api/auth/login', { email, password }); set({ ...state, user: await adoptLang(j.user) }); return j.user; };
export const getSetup = (token) => call('GET', `/api/auth/setup/${encodeURIComponent(token)}`);
export const finishSetup = async (body) => { const j = await call('POST', '/api/auth/setup', body); set({ ...state, user: await adoptLang(j.user) }); return j.user; };
export const changePassword = (current, password) => call('POST', '/api/auth/password', { current, password });
// "Forgot your password?": the same answer whether or not the email has an account. → { ok, emailed }
export const forgotPassword = (email) => call('POST', '/api/auth/forgot', { email });
export const sessionCount = () => call('GET', '/api/auth/sessions').then((j) => j.devices);
// Signing out also clears this browser's saved copy of the record, so the next person on a shared device starts clean.
// everywhere: ends every session of this account, on every device.
// Changes made offline and not sent yet are this account's to lose: ask first, then drop only theirs.
export async function signOut(everywhere = false) {
  const uid = state.user?.id;
  if (uid) {
    const n = await unsent(uid);
    if (n && !confirm(signOutWarning(n))) return false;
    await dropUnsent(uid);
  }
  try { await call('POST', everywhere ? '/api/auth/logout-everywhere' : '/api/auth/logout'); } catch { /* already signed out */ }
  try { Object.keys(localStorage).filter((k) => k.startsWith('tp-')).forEach((k) => localStorage.removeItem(k)); } catch { /* blocked */ }
  await clearCaches();
  location.hash = '#/';
  location.reload();
}
export const admin = {
  list: () => call('GET', '/api/admin/accounts'),
  create: (body) => call('POST', '/api/admin/accounts', body),
  update: (id, body) => call('POST', `/api/admin/accounts/${encodeURIComponent(id)}`, body),
  reset: (id) => call('POST', `/api/admin/accounts/${encodeURIComponent(id)}/reset`),
  remove: (id) => call('DELETE', `/api/admin/accounts/${encodeURIComponent(id)}`),
  dismiss: (id) => call('POST', `/api/admin/accounts/${encodeURIComponent(id)}/dismiss`),
  // PDPA: remove a student and everything about them (confirm = their name, typed).
  erase: (id, confirm) => call('POST', `/api/admin/students/${encodeURIComponent(id)}/erase`, { confirm }),
  usage: () => call('GET', '/api/admin/usage'),
  roster: (roster, dryRun, opts = {}) => call('POST', '/api/admin/roster', { roster, dryRun, ...opts }), // opts: { pauseLeavers }
};
// An advisor (or admin): the sign-in account of a student in their advisory, and a new link for it.
export const advisee = {
  account: (studentId) => call('GET', `/api/advisor/students/${encodeURIComponent(studentId)}/account`).then((j) => j.account),
  reset: (studentId) => call('POST', `/api/advisor/students/${encodeURIComponent(studentId)}/reset`),
};
// PDPA copy: a ZIP of everything held about a student. Admins any student; students their own; parents their children.
export const exportUrl = (studentId, asAdmin) => (asAdmin ? `/api/admin/students/${encodeURIComponent(studentId)}/export` : `/api/me/export${studentId ? `?student=${encodeURIComponent(studentId)}` : ''}`);
// Printable sign-in cards (server/routes/16-cards.mjs): new one-time setup links in a batch; unpausing a leaver.
export const signinCards = {
  advisees: () => call('GET', '/api/advisor/cards').then((j) => j.students),
  forAdvisees: (body) => call('POST', '/api/advisor/cards', body),
  groups: () => call('GET', '/api/admin/cards'),
  forAdmin: (body) => call('POST', '/api/admin/cards', body),
  unpause: (id) => call('POST', `/api/admin/accounts/${encodeURIComponent(id)}/unpause`),
};
// Family sign-in letters (server/routes/17-family.mjs): printed invitations, joining as family, removing a family member.
export const family = {
  invite: (token) => call('GET', `/api/family/invite/${encodeURIComponent(token)}`),
  join: async (body) => { const j = await call('POST', '/api/family/join', body); set({ ...state, user: await adoptLang(j.user) }); return j; },
  advisees: () => call('GET', '/api/advisor/family').then((j) => j.students),
  forAdvisees: (body) => call('POST', '/api/advisor/family/letters', body),
  groups: (homeroom) => call('GET', `/api/admin/family${homeroom ? `?homeroom=${encodeURIComponent(homeroom)}` : ''}`),
  forAdmin: (body) => call('POST', '/api/admin/family/letters', body),
  unlink: (studentId, accountId) => call('POST', '/api/family/unlink', { studentId, accountId }),
};
// Sign-up progress (server/routes/62-progress.mjs): by homeroom for leadership and the admin; an advisor's own advisees.
export const progress = {
  school: (homeroom) => call('GET', `/api/admin/progress${homeroom ? `?homeroom=${encodeURIComponent(homeroom)}` : ''}`),
  advisees: () => call('GET', '/api/advisor/progress'),
};
// Pilot feedback (server/routes/65-feedback.mjs): anyone signed in sends; leadership and the pilot admin read.
export const feedback = {
  send: (body) => call('POST', '/api/feedback', body),
  list: () => call('GET', '/api/admin/feedback').then((j) => j.items),
  done: (id, done) => call('POST', `/api/admin/feedback/${encodeURIComponent(id)}`, { done }).then((j) => j.item),
};
// School overview (server/routes/63-overview.mjs): aggregate counts, no names; leadership, coordinators and admins.
export const overview = {
  get: () => call('GET', '/api/overview'),
  csvUrl: (range) => `/api/overview?format=csv&range=${encodeURIComponent(range)}`,
};

// ── An account becomes a persona in the PERSONAS shape, so every existing screen works unchanged ──
const COLOURS = { student: '#4F529B', advisor: '#008A60', teacher: '#002855', counsellor: '#E73C3E', coordinator: '#FF8F1C', leadership: '#002855', parent: '#FFB81C', admin: '#002855' };
const ROLE = { advisor: 'Advisor', teacher: 'Teacher', counsellor: 'University counsellor', coordinator: 'Coordinator', leadership: 'Leadership', admin: 'Pilot admin' };
const initials = (n) => n.replace(/^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
export const yearOf = (s) => (s ? `Year ${s.grade + 1}` : '');

export function personaFor(user) {
  // A browser without the live record yet may not know a new student or teacher: add the copy the server sent.
  if (user.record?.student && !getStudent(user.record.student.id)) addStudent(user.record.student);
  if (user.record?.teacher && !getTeacher(user.record.teacher.id)) addTeacher(user.record.teacher);
  for (const c of user.record?.children || []) if (!getStudent(c.id)) addStudent(c);
  const kind = user.kind;
  // Keep the seeded persona's id when the account is linked to one, so notifications addressed to it still arrive.
  const seeded = PERSONAS.find((p) => p.kind === kind && ((user.studentId && p.studentId === user.studentId) || (user.teacherId && p.teacherId === user.teacherId)));
  const student = user.studentId && getStudent(user.studentId);
  const teacher = user.teacherId && getTeacher(user.teacherId);
  const role = kind === 'student' ? `Student · ${yearOf(student)}`
    : kind === 'parent' ? `Family · ${(user.children || []).map((id) => getStudent(id)?.name.split(' ')[0]).filter(Boolean).join(' and ')}`
      : teacher?.role || ROLE[kind] || '';
  const p = {
    id: seeded?.id || 'me', kind, name: user.name, role, initials: initials(user.name),
    colour: student?.avatar?.colour || seeded?.colour || COLOURS[kind] || '#002855',
    ...(user.studentId ? { studentId: user.studentId } : {}), ...(user.teacherId ? { teacherId: user.teacherId } : {}), ...(user.children ? { children: user.children } : {}),
    account: user, admin: !!user.admin,
  };
  // Staff wear more than one hat (roles from the class lists): a coordinator who also teaches gets the
  // endorsement queue, an advisor who teaches too gets it, anyone who advises gets their advisory.
  const roles = user.record?.teacher?.roles || [];
  const also = [roles.includes('teacher') && kind !== 'teacher' && 'teacher', roles.includes('advisor') && kind !== 'advisor' && 'advisor'].filter(Boolean);
  // The class depot shows the demo's past classes only: not in a pilot.
  const nav = NAV[kind].filter(([id]) => id !== 'depot').map(([id, label]) => (id === 'advisory' ? [id, 'My advisory'] : [id, label]));
  if (also.includes('advisor')) nav.push(['advisory', 'My advisory']);
  if (also.includes('teacher')) nav.push(['queue', 'Endorsements']);
  // My classes (src/screens/MyClasses.jsx): anyone who teaches, next to Endorsements.
  if (kind === 'teacher' || also.includes('teacher')) nav.splice(nav.findIndex(([id]) => id === 'queue') + 1, 0, ['classes', 'My classes']);
  if (also.length) p.also = also;
  if (also.length || kind === 'advisor' || kind === 'teacher') p.nav = nav;
  if (user.admin && kind !== 'admin') p.nav = [...(p.nav || NAV[kind]), ['accounts', 'Accounts']];
  // Pilot usage, for leadership and the pilot admin.
  if (kind === 'leadership' || user.admin) p.nav = [...(p.nav || NAV[kind]), ['usage', 'Pilot usage']];
  // Safeguarding reports (src/screens/Reports.jsx): coordinators, counsellors, leadership and admins.
  if (isModerator(user)) p.nav = [...(p.nav || NAV[kind]), ['reports', 'Reports']];
  // School overview (src/screens/Overview.jsx): leadership, coordinators and admins.
  if (kind === 'leadership' || kind === 'coordinator' || user.admin) p.nav = [...(p.nav || NAV[kind]), ['overview', 'School overview']];
  return p;
}
function applyPersona() {
  setPilotPersona(state.mode === 'pilot' && state.user ? personaFor(state.user) : null);
  setOwnLang(state.mode === 'pilot' && state.user ? state.user.lang || 'en' : null);
}

// ── Language, per person (POST /api/auth/prefs): a pilot account keeps its own; the demo has one shared setting ──
export async function chooseLang(lang) {
  saveLang(lang);
  if (state.mode !== 'pilot' || !state.user) return setLang(lang);
  state = { ...state, user: { ...state.user, lang } };
  setOwnLang(lang);
  try { await call('POST', '/api/auth/prefs', { lang }); } catch { /* offline or preview: this device still shows it */ }
}
// A family member who chose Thai before signing in (sign-in page, letter link) and has no choice on the account yet keeps it.
async function adoptLang(user) {
  const l = savedLang();
  if (!user || user.lang || user.kind !== 'parent' || !l || l === 'en') return user;
  try { await call('POST', '/api/auth/prefs', { lang: l }); return { ...user, lang: l }; } catch { return user; }
}
