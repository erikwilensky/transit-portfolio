// Report comment drafts (data in server/report-comments.mjs). Pilot; every route needs a signed-in account.
// GET  /api/report-comments                          → { limits, drafts: this account's own only }
// PUT  /api/report-comments/:kind/:group/:studentId { text, done }   the writer → { draft | null }
//      kind subject: group is a class the account's teacherId teaches, the student in it now.
//      kind advisor: group is the account's own teacherId, the student their advisee.
// GET  /api/report-comments/export?kind=&group=      the writer → CSV (Student ID, Name, Comment) of their drafts, every
//      student in the group; one 'report-export' line in the activity log (counts only).
// GET  /api/report-comments/progress                 coordinators, leadership, admins → counts per teacher, never text
// POST /api/admin/report-comments/limits { kind, words, chars }   admins → { limits }
import { send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import * as R from '../report-comments.mjs';
import * as L from '../audit.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const signedIn = (req) => { if (!req.user) throw fail(401, 'Sign in first.'); return req.user; };
const canSeeProgress = (u) => A.isAdmin(u) || u.kind === 'coordinator' || u.kind === 'leadership';
const current = (e) => !(e.to && e.to < api.TODAY);
const classStudents = (classId) => { const known = new Set(api.getStudents().map((s) => s.id)); return [...new Set(api.getEnrolments().filter((e) => e.classId === classId && current(e) && known.has(e.studentId)).map((e) => e.studentId))]; };
const advisees = (tid) => api.getStudents().filter((s) => s.advisorId === tid).map((s) => s.id);

// The group a writer may write for: its students and a label, or a refusal.
function groupFor(u, kind, group) {
  if (!R.KINDS.includes(kind)) throw fail(400, 'Unknown kind of report comment.');
  if (!u.teacherId) throw fail(403, 'Only teachers and advisors write report comments.');
  if (kind === 'subject') {
    const c = api.getClasses().find((x) => x.id === group);
    if (!c || !(c.teacherIds || []).includes(u.teacherId)) throw fail(403, 'You can write comments only for classes you teach.');
    return { students: classStudents(c.id), label: c.name, id: c.id };
  }
  if (group !== u.teacherId) throw fail(403, 'You can write advisor comments only for your own advisees.');
  return { students: advisees(u.teacherId), label: 'Advisory', id: null };
}
const csvCell = (v) => { const s = String(v ?? ''); const t = /^[=+\-@]/.test(s) ? `'${s}` : s; return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

export default (app) => {
  app.get('/api/report-comments', (req, res) => {
    const u = signedIn(req);
    send(res, 200, { limits: R.limits(), drafts: R.draftsBy(u.id) });
  });
  app.put('/api/report-comments/:kind/:group/:studentId', async (req, res, { kind, group, studentId }) => {
    const u = signedIn(req);
    const g = groupFor(u, kind, group);
    if (!g.students.includes(studentId)) throw fail(403, kind === 'subject' ? 'That student is not in this class.' : 'That student is not your advisee.');
    const b = await readJson(req);
    if (String(b.text ?? '').length > R.MAX_TEXT) throw fail(413, `A comment can be at most ${R.MAX_TEXT} characters.`);
    send(res, 200, { draft: R.putDraft({ by: u.id, teacherId: u.teacherId, kind, group, studentId }, { text: b.text, done: !!b.done }) });
  });
  app.get('/api/report-comments/export', (req, res) => {
    const u = signedIn(req);
    const kind = req.query.get('kind'), group = req.query.get('group') || '';
    const g = groupFor(u, kind, group);
    const mine = new Map(R.draftsBy(u.id).filter((d) => d.kind === kind && d.group === group).map((d) => [d.studentId, d]));
    const rows = g.students.map(api.getStudent).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const csv = '\ufeff' + [['Student ID', 'Name', 'Comment'], ...rows.map((s) => [s.id, s.name, mine.get(s.id)?.text || ''])].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    L.log(req, { action: 'report-export', target: { id: g.id, teacherId: u.teacherId, label: kind === 'subject' ? g.label : `Advisory of ${api.getTeacher(u.teacherId)?.name || u.name}` },
      detail: { kind, rows: rows.length, written: rows.filter((s) => mine.get(s.id)?.text.trim()).length, done: rows.filter((s) => mine.get(s.id)?.done).length } });
    const slug = String(kind === 'subject' ? g.label : 'advisory').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'class';
    send(res, 200, csv, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="report-comments-${slug}-${api.TODAY}.csv"` });
  });
  app.get('/api/report-comments/progress', (req, res) => {
    const u = signedIn(req);
    if (!canSeeProgress(u)) throw fail(403, 'Only coordinators, leadership and admins see report comment progress.');
    const counts = R.counts(), known = new Set(api.getStudents().map((s) => s.id));
    const places = new Map();
    for (const e of api.getEnrolments()) if (current(e) && known.has(e.studentId)) (places.get(e.classId) || places.set(e.classId, new Set()).get(e.classId)).add(e.studentId);
    const count = (tid, kind, group, ids) => { const c = counts.get(tid)?.get(`${kind}|${group}`); return { students: ids.size, drafted: c ? [...c.drafted].filter((x) => ids.has(x)).length : 0, done: c ? [...c.done].filter((x) => ids.has(x)).length : 0 }; };
    const teachers = [];
    for (const t of api.getTeachers()) {
      const classes = api.getClasses().filter((c) => (c.teacherIds || []).includes(t.id) && places.get(c.id)?.size)
        .map((c) => ({ id: c.id, name: c.name, ...count(t.id, 'subject', c.id, places.get(c.id)) }));
      const adv = new Set(advisees(t.id));
      if (!classes.length && !adv.size) continue;
      const sum = (k) => classes.reduce((n, c) => n + c[k], 0);
      teachers.push({ teacherId: t.id, name: t.name, classes, subject: { classes: classes.length, students: sum('students'), drafted: sum('drafted'), done: sum('done') }, advisor: adv.size ? count(t.id, 'advisor', t.id, adv) : null });
    }
    teachers.sort((a, b) => a.name.localeCompare(b.name));
    send(res, 200, { limits: R.limits(), teachers });
  });
  app.post('/api/admin/report-comments/limits', async (req, res) => {
    const u = signedIn(req);
    if (!A.isAdmin(u)) throw fail(403, 'Only an admin can set comment lengths.');
    const b = await readJson(req);
    if (!R.KINDS.includes(b.kind)) throw fail(400, 'Unknown kind of report comment.');
    const out = R.setLimits(b.kind, b);
    L.log(req, { action: 'report-limits', detail: { kind: b.kind, ...out[b.kind] } });
    send(res, 200, { limits: out });
  });
};
