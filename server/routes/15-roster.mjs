// Pilot: import the school's class lists (docs/roster-format.md), then give everyone with an email a
// sign-in account linked to their record. The admin downloads the one-time setup links as a CSV.
//   POST /api/admin/roster { roster, dryRun? } → { summary, warnings, newAccounts: { created, skipped }, ...listBody }
// roster is the parsed JSON, or { teachers, students, classes, enrolments } CSV texts. Problems → 400 { errors, missing }.
import { send, readJson } from '../lib.mjs';
import { api, changed } from '../store.mjs';
import * as A from '../auth.mjs';
import { originOf, setupUrl, requireAdmin, listBody } from './10-auth.mjs';

const KIND_LABEL = { student: 'Student', advisor: 'Advisor', teacher: 'Teacher', counsellor: 'University counsellor', coordinator: 'Coordinator', leadership: 'Leadership' };

// Everyone in the roster with an email and no account yet (by email, or already linked to the record).
export function newAccountsFor(roster) {
  const linked = new Set(A.allAccounts().flatMap((a) => [a.studentId, a.teacherId]).filter(Boolean));
  const people = [...roster.teachers.map((t) => ({ ...t, kind: api.kindOfRoles(t.roles), teacherId: t.id })), ...roster.students.map((s) => ({ ...s, kind: 'student', studentId: s.id }))];
  const todo = [], skipped = [];
  for (const p of people) {
    if (!p.email) continue;
    if (A.accountByEmail(p.email) || linked.has(p.id)) skipped.push(p.email); else todo.push(p);
  }
  return { todo, skipped };
}

export default (app) => {
  app.post('/api/admin/roster', async (req, res) => {
    if (A.MODE !== 'pilot') return send(res, 403, { error: 'Class lists are imported in the pilot only.' });
    requireAdmin(req);
    const b = await readJson(req);
    const { roster, errors, warnings, missing } = api.parseRoster(b.roster);
    if (errors.length) return send(res, 400, { error: `The class lists have ${errors.length} problem${errors.length === 1 ? '' : 's'}. Nothing was imported.`, errors, warnings, missing });
    if (b.dryRun) {
      const { todo, skipped } = newAccountsFor(roster);
      return send(res, 200, { summary: api.previewRoster(roster), warnings, newAccounts: { toCreate: todo.length, skipped: skipped.length }, counts: Object.fromEntries(['teachers', 'students', 'classes', 'enrolments'].map((k) => [k, roster[k].length])) });
    }
    const summary = api.importRoster(roster);
    changed({ fn: 'importRoster', by: 'admin' });
    const { todo, skipped } = newAccountsFor(roster);
    const base = originOf(req);
    const created = A.batchAccounts(() => todo.map((p) => {
      const a = A.createAccount({ email: p.email, name: p.name, kind: p.kind, ...(p.studentId ? { studentId: p.studentId } : { teacherId: p.teacherId }) });
      return { name: a.name, email: a.email, role: KIND_LABEL[a.kind] || a.kind, setupUrl: setupUrl(base, A.newSetup(a)) };
    }));
    send(res, 200, { summary, warnings, newAccounts: { created, skipped: skipped.length }, ...listBody() });
  });
};
