// Pilot usage: who is active and how much is happening. Counting only, never content.
// Per user per day: when last seen (any /api request), how many requests, and how many changes by
// mutator name; per student per day: how often their share links were opened. Kept in DATA_DIR/usage.json,
// saved at most every few seconds and on shutdown.
// GET /api/admin/usage (admin or leadership) → { today, tz, weeks, people, byRole, byYear, totals }
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, send, middleware, writeAtomic, onShutdown } from '../lib.mjs';
import { api, onChange } from '../store.mjs';
import * as A from '../auth.mjs';

const FILE = path.join(DATA_DIR, 'usage.json');
const TZ = process.env.TP_TZ || 'Asia/Bangkok';
const SAVE_MS = Number(process.env.USAGE_SAVE_MS || 5000);
let usage = (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { days: {} }; } })();
usage.days ||= {};
let timer = null;
export const flush = () => { clearTimeout(timer); timer = null; writeAtomic(FILE, JSON.stringify(usage)); };
const save = () => { timer ||= setTimeout(flush, SAVE_MS); timer.unref?.(); };
onShutdown(async () => { if (timer) flush(); });

// The school's calendar day (Bangkok), as YYYY-MM-DD.
export const dayOf = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const day = (d) => (usage.days[d] ||= { u: {}, opens: {} });
const userDay = (id, d = dayOf()) => (day(d).u[id] ||= { seen: null, req: 0, fn: {} });

export function noteSeen(user, when = new Date()) {
  if (!user?.id) return;
  const u = userDay(user.id, dayOf(when)); u.seen = when.toISOString(); u.req++; save();
}
export function noteChange(info, when = new Date()) {
  const d = dayOf(when);
  // A student was erased: their counts and their accounts' counts go too.
  if (info.fn === 'eraseStudent' && info.erased) { forget(info.erased.studentId, info.erased.accounts || []); return; }
  if (info.kind === 'view' && info.token) { const sid = studentOfToken(info.token); if (sid) { day(d).opens[sid] = (day(d).opens[sid] || 0) + 1; save(); } return; }
  if (!info.fn || info.error || !A.accountById(info.by)) return; // server-made changes (by: 'admin') are not a person's
  const u = userDay(info.by, d); u.fn[info.fn] = (u.fn[info.fn] || 0) + 1; u.seen = when.toISOString();
  // Endorsing a batch counts each endorsement.
  if (info.fn === 'endorse' && Array.isArray(info.args?.[0])) u.fn.endorsed = (u.fn.endorsed || 0) + info.args[0].length;
  if (info.fn === 'endorseClassTask' && Array.isArray(info.args?.[1])) u.fn.endorsed = (u.fn.endorsed || 0) + info.args[1].length;
  if (info.fn === 'recordView' && info.args?.[1]) day(d).opens[info.args[1]] = (day(d).opens[info.args[1]] || 0) + 1;
  save();
}
function forget(sid, accountIds) {
  for (const v of Object.values(usage.days)) { delete v.opens?.[sid]; for (const id of accountIds) delete v.u[id]; }
  save();
}
function studentOfToken(token) {
  for (const [sid, list] of Object.entries(api.getDrafts())) if ((list || []).some((p) => p.shareLinks?.some((l) => l.token === token))) return sid;
  return null;
}

// What the counts mean. A change made through another (addBranch adds a station) counts once, as the outer one.
export const COUNTS = {
  stations: ['addStation', 'addBranch', 'acceptCandidate', 'addAlumStation'],
  reflections: ['addReflection'],
};
const sum = (fn, names) => names.reduce((n, k) => n + (fn[k] || 0), 0);
const tally = (fn) => ({ stations: sum(fn, COUNTS.stations), reflections: sum(fn, COUNTS.reflections), endorsements: fn.endorsed || 0, changes: Object.entries(fn).reduce((n, [k, v]) => n + (k === 'endorsed' ? 0 : v), 0) });
const add = (a, b) => { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]; return a; };
const monday = (d) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const plusDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const yearOfStudent = (sid) => { const s = api.getStudent(sid); return s ? `Year ${s.grade + 1}` : 'Removed'; };
// A person's Year group: a student's own Year; staff and families have none.
const groupOf = (a) => (a.kind === 'student' ? yearOfStudent(a.studentId) : a.kind === 'parent' ? 'Families' : 'Staff');

export function summary(now = new Date()) {
  const today = dayOf(now), weekStart = plusDays(today, -6);
  const days = Object.keys(usage.days).sort();
  const accounts = A.allAccounts();
  const people = accounts.map((a) => {
    let lastSeen = null, lastChange = null, active = 0; const t = { stations: 0, reflections: 0, endorsements: 0, changes: 0 };
    for (const d of days) {
      const u = usage.days[d].u[a.id]; if (!u) continue;
      active++; lastSeen = u.seen || lastSeen; add(t, tally(u.fn));
      if (Object.keys(u.fn).length) lastChange = d;
    }
    const lastDay = lastSeen && dayOf(new Date(lastSeen));
    const status = !lastDay ? 'never' : lastDay === today ? 'today' : lastDay >= weekStart ? 'week' : 'earlier';
    return { id: a.id, name: a.name, kind: a.kind, group: groupOf(a), lastSeen, lastChange, daysActive: active, status, ...t };
  });
  // Weeks from the first day anyone was counted (or today) to this week, Monday to Sunday.
  const first = monday(days[0] || today), weeks = [];
  for (let w = first; w <= today; w = plusDays(w, 7)) {
    const ds = days.filter((d) => d >= w && d < plusDays(w, 7));
    const users = new Set(), changers = new Set(), t = { stations: 0, reflections: 0, endorsements: 0, changes: 0, shareOpens: 0 };
    for (const d of ds) {
      for (const [id, u] of Object.entries(usage.days[d].u)) { users.add(id); if (Object.keys(u.fn).length) changers.add(id); add(t, tally(u.fn)); }
      t.shareOpens += Object.values(usage.days[d].opens || {}).reduce((n, v) => n + v, 0);
    }
    weeks.push({ start: w, active: users.size, changed: changers.size, ...t });
  }
  // By role and by Year group: people, how many were active this week, and what they did.
  const byRole = {}, byYear = {};
  for (const p of people) for (const [map, key] of [[byRole, p.kind], [byYear, p.group]]) {
    const r = (map[key] ||= { people: 0, activeWeek: 0, never: 0, stations: 0, reflections: 0, endorsements: 0, changes: 0, shareOpens: 0 });
    r.people++; if (p.status === 'today' || p.status === 'week') r.activeWeek++; if (p.status === 'never') r.never++;
    add(r, { stations: p.stations, reflections: p.reflections, endorsements: p.endorsements, changes: p.changes });
  }
  // Share links are opened by readers outside the school: counted on the student's Year group.
  for (const d of days) for (const [sid, n] of Object.entries(usage.days[d].opens || {})) {
    const g = yearOfStudent(sid);
    (byYear[g] ||= { people: 0, activeWeek: 0, never: 0, stations: 0, reflections: 0, endorsements: 0, changes: 0, shareOpens: 0 }).shareOpens += n;
  }
  const totals = weeks.reduce((t, w) => add(t, { stations: w.stations, reflections: w.reflections, endorsements: w.endorsements, changes: w.changes, shareOpens: w.shareOpens }), {});
  const count = (s) => people.filter((p) => p.status === s).length;
  return { today, tz: TZ, people, weeks, byRole, byYear, totals: { ...totals, people: people.length, today: count('today'), week: count('today') + count('week'), never: count('never') } };
}
// Each account's last request ever (ISO), for sign-up progress (server/routes/62-progress.mjs).
export function lastSeenAll() {
  const out = {};
  for (const d of Object.keys(usage.days).sort()) for (const [id, u] of Object.entries(usage.days[d].u)) if (u.seen) out[id] = u.seen;
  return out;
}
export const _reset = () => { usage = { days: {} }; };

export default (app) => {
  // Background sync (the record and its event stream) does not count as being there.
  middleware.push((req, res, url) => { if (req.user && url.pathname !== '/api/state' && url.pathname !== '/api/stream') noteSeen(req.user); return false; });
  onChange((info) => noteChange(info));
  app.get('/api/admin/usage', (req, res) => {
    if (!req.user) return send(res, 401, { error: 'Sign in first.' });
    if (!A.isAdmin(req.user) && req.user.kind !== 'leadership') return send(res, 403, { error: 'Only leadership and the pilot admin can see usage.' });
    send(res, 200, summary());
  });
};
