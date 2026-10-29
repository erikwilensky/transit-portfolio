// School overview (pilot): aggregate counts for leadership, coordinators and the pilot admin. Computed here from the
// whole record, so nothing private leaves the server: no names, only counts, and any group of 1 to 4 students shows
// "fewer than 5" instead of its number.
//   GET /api/overview → { today, min, ranges: [range], quiet: [{ name, pct }] }
//   GET /api/overview?format=csv&range=term|weeks4 → the same as a CSV file
// range = { id, label, from, to, years: [yearRow], totals: yearRow, lines: [{ id, name, moments, endorsedPct }], weeks: [{ from, to, moments }] }
// yearRow = { year, students, signedUp, active, withMoment, moments, perStudent, reflections, endorsements, families }
import { send } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import { context } from './62-progress.mjs';

export const MIN = 5;
export const SMALL = 'fewer than 5';
const KINDS = ['leadership', 'coordinator'];
const YEARS = [7, 8, 9, 10, 11, 12, 13];
const COUNTS = ['students', 'signedUp', 'active', 'withMoment', 'families'];
const bad = (status, message) => Object.assign(new Error(message), { status });
const hide = (n) => (n > 0 && n < MIN ? SMALL : n);
const day = (d) => Date.parse(`${d}T12:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export const mayRead = (u) => !!u && (A.isAdmin(u) || KINDS.includes(u.kind));

function yearRow(year, g) {
  const r = { year, students: g.students, signedUp: g.signedUp, active: g.active, withMoment: g.with.size, moments: g.moments, perStudent: g.students ? Math.round((10 * g.moments) / g.students) / 10 : 0, reflections: g.reflections, endorsements: g.endorsements, families: g.families };
  if (g.students > 0 && g.students < MIN) { for (const k of Object.keys(r)) if (k !== 'year') r[k] = SMALL; } else for (const k of COUNTS) r[k] = hide(r[k]);
  return r;
}

function range(id, label, from, to, people, evs, store) {
  const blank = () => ({ students: 0, signedUp: 0, active: 0, families: 0, with: new Set(), moments: 0, reflections: 0, endorsements: 0 });
  const g = new Map(YEARS.map((y) => [y, blank()])), all = blank();
  const both = (sid, f) => { f(g.get(people.get(sid).year)); f(all); };
  for (const p of people.values()) both(p.id, (r) => { r.students++; r.signedUp += +p.signedUp; r.active += +p.active; r.families += +(p.families > 0); });
  const inRange = (d) => d >= from && d <= to;
  const school = store.lines.filter((l) => !l.studentId && !l.parentLineId);
  const lines = new Map(school.map((l) => [l.id, { id: l.id, name: l.name, moments: 0, endorsed: 0, who: new Set() }]));
  const own = { id: 'own', name: 'Students\' own lines', moments: 0, endorsed: 0, who: new Set() };
  const endorsedIds = new Set(store.endorsements.map((n) => n.eventId));
  const span = Math.floor((day(to) - day(from)) / 864e5) + 1, nw = Math.ceil(span / 7);
  const weeks = Array.from({ length: nw }, (_, i) => ({ from: iso(Math.max(day(from), day(to) - (7 * (nw - 1 - i) + 6) * 864e5)), to: iso(day(to) - 7 * (nw - 1 - i) * 864e5), moments: 0, who: new Set() }));
  for (const e of evs.values()) {
    if (!inRange(e.date)) continue;
    both(e.studentId, (r) => { r.moments++; r.with.add(e.studentId); if (e.type === 'reflection') r.reflections++; });
    const ok = e.verification === 'teacher-endorsed' || endorsedIds.has(e.id);
    for (const root of new Set(e.lineIds.map(api.rootLine))) {
      const l = lines.get(root) || own;
      l.moments++; l.endorsed += +ok; l.who.add(e.studentId);
    }
    const w = weeks[nw - 1 - Math.floor((day(to) - day(e.date)) / 864e5 / 7)];
    if (w) { w.moments++; w.who.add(e.studentId); }
  }
  for (const r of store.reflections) if (inRange(r.date) && evs.has(r.eventId)) both(evs.get(r.eventId).studentId, (x) => x.reflections++);
  for (const n of store.endorsements) if (inRange(n.date) && evs.has(n.eventId)) both(evs.get(n.eventId).studentId, (x) => x.endorsements++);
  const lineRow = (l) => (l.who.size > 0 && l.who.size < MIN ? { id: l.id, name: l.name, moments: SMALL, endorsedPct: SMALL }
    : { id: l.id, name: l.name, moments: l.moments, endorsedPct: l.moments ? Math.round((100 * l.endorsed) / l.moments) : null });
  return {
    id, label, from, to,
    years: YEARS.map((y) => yearRow(y, g.get(y))), totals: yearRow('all', all),
    lines: [...lines.values(), ...(own.moments ? [own] : [])].map(lineRow),
    weeks: weeks.map((w) => ({ from: w.from, to: w.to, moments: w.who.size > 0 && w.who.size < MIN ? SMALL : w.moments })),
  };
}

export function overview(now = new Date()) {
  const { students, rowOf } = context(now);
  const today = api.TODAY, store = api.getStore();
  const people = new Map(students.map(rowOf).filter((r) => r.year >= 7 && r.year <= 13).map((r) => [r.id, r]));
  const evs = new Map(store.events.filter((e) => e.type !== 'goal' && e.date <= today && people.has(e.studentId)).map((e) => [e.id, e]));
  const rooms = new Map();
  for (const p of people.values()) if (p.homeroom) { const r = rooms.get(p.homeroom) || rooms.set(p.homeroom, { n: 0, active: 0 }).get(p.homeroom); r.n++; r.active += +p.active; }
  const quiet = [...rooms].filter(([, r]) => r.n >= MIN && r.active / r.n < 0.3).map(([name, r]) => ({ name, pct: Math.round((100 * r.active) / r.n) }))
    .sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name, 'en', { numeric: true }));
  const term = api.TERM_START <= today ? api.TERM_START : api.daysBefore(27);
  return { today, min: MIN, ranges: [range('term', 'This term', term, today, people, evs, store), range('weeks4', 'Last 4 weeks', api.daysBefore(27), today, people, evs, store)], quiet };
}

const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function overviewCsv(o, id) {
  const r = o.ranges.find((x) => x.id === id) || o.ranges[0];
  const rows = [[`School overview: ${r.label.toLowerCase()} (${r.from} to ${r.to})`], [`Groups of 1 to 4 students show "${SMALL}". No names.`], [],
    ['Year', 'Students', 'Signed up', 'Active this week', 'At least one moment', 'Moments', 'Moments per student', 'Reflections', 'Endorsements given', 'Families joined'],
    ...[...r.years, r.totals].map((y) => [y.year === 'all' ? 'All Years' : `Year ${y.year}`, y.students, y.signedUp, y.active, y.withMoment, y.moments, y.perStudent, y.reflections, y.endorsements, y.families]),
    [], ['Line', 'Moments', 'Endorsed (%)'], ...r.lines.map((l) => [l.name, l.moments, l.endorsedPct ?? '']),
    [], ['Week from', 'Week to', 'Moments'], ...r.weeks.map((w) => [w.from, w.to, w.moments]),
    [], ['Quiet homeroom (under 30% active this week)', 'Active (%)'], ...o.quiet.map((q) => [q.name, q.pct])];
  return '\ufeff' + rows.map((x) => x.map(cell).join(',')).join('\r\n') + '\r\n';
}

export default (app) => {
  app.get('/api/overview', (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    if (!mayRead(req.user)) throw bad(403, 'Only leadership, coordinators and the pilot admin can see the school overview.');
    const o = overview();
    if (req.query?.get('format') !== 'csv') return send(res, 200, o);
    const id = req.query.get('range') === 'weeks4' ? 'weeks4' : 'term';
    send(res, 200, overviewCsv(o, id), { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="school-overview-${id === 'term' ? 'term' : 'last-4-weeks'}-${o.today}.csv"` });
  });
};
