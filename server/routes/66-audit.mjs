// Activity log reader (server/audit.mjs): admins and leadership only.
//   GET /api/audit?person=&student=&action=&result=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=0&size=100
//     → { entries (newest first), total, page, size, actions: [action names in the log], people: [{ id, name, kind }] }
//   GET /api/audit?…&format=csv → every matching entry as CSV (no paging).
// person: an account id, or part of a name (the actor, or the account an entry is about). student: a student id, or
// part of the name label.
import { send } from '../lib.mjs';
import * as A from '../auth.mjs';
import { entriesBetween } from '../audit.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const has = (s, q) => String(s || '').toLowerCase().includes(q);

export function filterEntries(all, q) {
  const pid = String(q.get('person') || '').trim(), sid = String(q.get('student') || '').trim();
  const person = pid.toLowerCase(), student = sid.toLowerCase();
  const action = q.get('action') || '', result = q.get('result') || '';
  const from = DAY.test(q.get('from') || '') ? q.get('from') : null, to = DAY.test(q.get('to') || '') ? q.get('to') : null;
  return all.filter((e) => {
    if (from && e.at.slice(0, 10) < from) return false;
    if (to && e.at.slice(0, 10) > to) return false;
    if (action && e.action !== action) return false;
    if (result && e.result !== result) return false;
    const t = e.target || {};
    if (person && !(e.actor?.id === pid || t.accountId === pid || has(e.actor?.name, person) || (t.accountId && has(t.label, person)))) return false;
    if (student && !(t.studentId === sid || t.studentIds?.includes(sid) || ((t.studentId || t.studentIds) && has(t.label, student)))) return false;
    return true;
  });
}

const cell = (v) => { let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const COLS = ['at', 'actor_id', 'actor_name', 'actor_kind', 'action', 'change', 'student_ids', 'teacher_id', 'account_id', 'report_id', 'item_id', 'label', 'detail', 'result', 'status', 'ip'];
export const toCsv = (rows) => [COLS.join(','), ...rows.map((e) => {
  const t = e.target || {};
  return [e.at, e.actor?.id, e.actor?.name, e.actor?.kind, e.action, e.fn, (t.studentIds || (t.studentId ? [t.studentId] : [])).join(' '), t.teacherId, t.accountId, t.reportId, t.id, t.label, e.detail, e.result, e.status, e.ip].map(cell).join(',');
})].join('\r\n') + '\r\n';

export default (app) => {
  app.get('/api/audit', (req, res) => {
    const u = req.user;
    if (!u) throw bad(401, 'Sign in first.');
    if (!(A.isAdmin(u) || u.kind === 'leadership')) throw bad(403, 'Only an admin or leadership can read the activity log.');
    const q = req.query;
    const all = entriesBetween(q.get('from'), q.get('to')).sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    const rows = filterEntries(all, q);
    if (q.get('format') === 'csv') {
      return send(res, 200, toCsv(rows), { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"` });
    }
    const size = Math.min(500, Math.max(1, Number(q.get('size')) || 100)), page = Math.max(0, Number(q.get('page')) || 0);
    const people = new Map();
    for (const e of all) if (e.actor?.id && !people.has(e.actor.id)) people.set(e.actor.id, e.actor);
    send(res, 200, {
      entries: rows.slice(page * size, (page + 1) * size), total: rows.length, page, size,
      actions: [...new Set(all.map((e) => e.action))].sort(),
      people: [...people.values()].sort((x, y) => String(x.name).localeCompare(String(y.name))),
    });
  });
};
