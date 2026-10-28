// Pilot sign-in, browser side. The server says which mode it runs in (GET /api/auth/me).
// Demo mode (the default, and whenever there is no server): the persona switcher, tours and reset, no sign-in.
// Pilot mode: each person signs in and sees only their own role's screens, built as a persona.
import { addStudent, addTeacher, getStudent, getTeacher } from './api.js';
import { PERSONAS, NAV, setPilotPersona } from './personas.js';

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
  } catch {
    set({ mode: 'demo', user: null, server: false });
  }
  return state;
}

export const signIn = async (email, password) => { const j = await call('POST', '/api/auth/login', { email, password }); set({ ...state, user: j.user }); return j.user; };
export const getSetup = (token) => call('GET', `/api/auth/setup/${encodeURIComponent(token)}`);
export const finishSetup = async (body) => { const j = await call('POST', '/api/auth/setup', body); set({ ...state, user: j.user }); return j.user; };
export const changePassword = (current, password) => call('POST', '/api/auth/password', { current, password });
// "Forgot your password?": the same answer whether or not the email has an account. → { ok, emailed }
export const forgotPassword = (email) => call('POST', '/api/auth/forgot', { email });
export const sessionCount = () => call('GET', '/api/auth/sessions').then((j) => j.devices);
// Signing out also clears this browser's saved copy of the record, so the next person on a shared device starts clean.
// everywhere: ends every session of this account, on every device.
export async function signOut(everywhere = false) {
  try { await call('POST', everywhere ? '/api/auth/logout-everywhere' : '/api/auth/logout'); } catch { /* already signed out */ }
  try { Object.keys(localStorage).filter((k) => k.startsWith('tp-')).forEach((k) => localStorage.removeItem(k)); } catch { /* blocked */ }
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
  roster: (roster, dryRun) => call('POST', '/api/admin/roster', { roster, dryRun }),
};
// An advisor (or admin): the sign-in account of a student in their advisory, and a new link for it.
export const advisee = {
  account: (studentId) => call('GET', `/api/advisor/students/${encodeURIComponent(studentId)}/account`).then((j) => j.account),
  reset: (studentId) => call('POST', `/api/advisor/students/${encodeURIComponent(studentId)}/reset`),
};
// PDPA copy: a ZIP of everything held about a student. Admins any student; students their own; parents their children.
export const exportUrl = (studentId, asAdmin) => (asAdmin ? `/api/admin/students/${encodeURIComponent(studentId)}/export` : `/api/me/export${studentId ? `?student=${encodeURIComponent(studentId)}` : ''}`);

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
  if (user.admin && kind !== 'admin') p.nav = [...NAV[kind], ['accounts', 'Accounts']];
  // Pilot usage, for leadership and the pilot admin.
  if (kind === 'leadership' || user.admin) p.nav = [...(p.nav || NAV[kind]), ['usage', 'Pilot usage']];
  return p;
}
function applyPersona() { setPilotPersona(state.mode === 'pilot' && state.user ? personaFor(state.user) : null); }
