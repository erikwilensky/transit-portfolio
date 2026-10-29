// Pilot: import the school's class lists (docs/roster-format.md), then give everyone with an email a
// sign-in account linked to their record. The admin downloads the one-time setup links as a CSV.
//   POST /api/admin/roster { roster, dryRun?, pauseLeavers? } → { summary, warnings, newAccounts: { created, skipped }, paused, unpaused, ...listBody }
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

// Leavers: accounts linked to a record the file no longer has (not paused yet, never an admin). Back in the file: paused accounts to unpause.
export function leaversOf(summary) {
  const gone = new Set([...summary.missingFromFile.teachers, ...summary.missingFromFile.students].map((x) => x.id));
  return A.allAccounts().filter((a) => !a.paused && !A.isAdmin(a) && gone.has(a.studentId || a.teacherId));
}
const returning = (roster) => { const ids = new Set([...roster.teachers, ...roster.students].map((x) => x.id)); return A.allAccounts().filter((a) => a.paused && ids.has(a.studentId || a.teacherId)); };
const who = (a) => ({ id: a.id, name: a.name, email: a.email, kind: a.kind });

export default (app) => {
  app.post('/api/admin/roster', async (req, res) => {
    if (A.MODE !== 'pilot') return send(res, 403, { error: 'Class lists are imported in the pilot only.' });
    requireAdmin(req);
    const b = await readJson(req);
    const { roster, errors, warnings, missing } = api.parseRoster(b.roster);
    if (errors.length) return send(res, 400, { error: `The class lists have ${errors.length} problem${errors.length === 1 ? '' : 's'}. Nothing was imported.`, errors, warnings, missing });
    if (b.dryRun) {
      const { todo, skipped } = newAccountsFor(roster);
      const summary = api.previewRoster(roster);
      return send(res, 200, { summary, warnings, newAccounts: { toCreate: todo.length, skipped: skipped.length }, leavers: leaversOf(summary).map(who), returning: returning(roster).map(who), handover: api.handoverPreview(roster), counts: Object.fromEntries(['teachers', 'students', 'classes', 'enrolments'].map((k) => [k, roster[k].length])) });
    }
    const summary = api.importRoster(roster);
    changed({ fn: 'importRoster', by: 'admin' });
    // Leavers' accounts are paused only when asked; anyone paused who is back in the file is unpaused.
    const { paused, unpaused } = A.batchAccounts(() => ({
      paused: b.pauseLeavers ? leaversOf(summary).map((a) => (A.pauseAccount(a), who(a))) : [],
      unpaused: returning(roster).map((a) => (A.unpauseAccount(a), who(a))),
    }));
    const { todo, skipped } = newAccountsFor(roster);
    const base = originOf(req);
    const created = A.batchAccounts(() => todo.map((p) => {
      const a = A.createAccount({ email: p.email, name: p.name, kind: p.kind, ...(p.studentId ? { studentId: p.studentId } : { teacherId: p.teacherId }) });
      return { name: a.name, email: a.email, role: KIND_LABEL[a.kind] || a.kind, setupUrl: setupUrl(base, A.newSetup(a)) };
    }));
    send(res, 200, { summary, warnings, newAccounts: { created, skipped: skipped.length }, paused, unpaused, ...listBody() });
  });
};
