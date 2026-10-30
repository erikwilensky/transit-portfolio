// PDPA rights for a student: a copy of everything held about them, and erasure.
// GET  /api/admin/students/:id/export   admin → a ZIP of everything about that student
// GET  /api/me/export[?student=<id>]     a student → their own; a parent → one of their children; an admin → anyone
// POST /api/admin/students/:id/erase { confirm: <the student's name> }   admin → removes the student from the
//      record (api.eraseStudent), their uploaded files no other record uses, their account and family links.
// Every copy and erasure writes one line to DATA_DIR/audit.log: when, who, what, which student id. No content.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, send, readJson } from '../lib.mjs';
import { api, changed } from '../store.mjs';
import * as A from '../auth.mjs';
import { zip } from '../zip.mjs';
import { feedbackOf, eraseFeedbackOf } from '../feedback.mjs';
import * as L from '../audit.mjs';
import { draftsAbout, eraseDraftsAbout } from '../report-comments.mjs';

const UPLOADS = path.join(DATA_DIR, 'uploads');
const AUDIT = path.join(DATA_DIR, 'audit.log');
const fail = (status, message) => Object.assign(new Error(message), { status });
const FILE_RE = /\/api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})/g;
export const filesIn = (obj) => [...new Set([...JSON.stringify(obj).matchAll(FILE_RE)].map((m) => m[1]))];
export function audit(entry) {
  try { fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); } catch (e) { console.error('Audit log not written:', e.message); }
}

// Accounts tied to a student: their own, and families linked to them. Never the password or setup token.
const studentAccounts = (sid) => A.allAccounts().filter((a) => a.studentId === sid);
const familyAccounts = (sid) => A.allAccounts().filter((a) => a.children?.includes(sid));
// A family account linked to other children too lists only this one.
const accountCopy = (a, sid) => { const { password, setup, ...rest } = a; return rest.children ? { ...rest, children: [sid] } : rest; };

// What each file in the copy holds. Collections not listed here (added later) are explained generically.
const ABOUT = {
  events: 'Your stations: every item on your map, at every visibility, private ones too.',
  reflections: 'Your reflections, at every visibility.',
  endorsements: 'Endorsements teachers gave on your stations.',
  drafts: 'Your presentations and drafts, with their share links (who each was for, when it expires, if it was switched off).',
  linkViews: 'How many times each of your share links was opened.',
  inbox: 'Items from school systems waiting for you to add or skip.',
  dismissed: 'Items from school systems you skipped.',
  pending: 'Items school systems hold for you that have not reached your inbox yet.',
  requests: 'Endorsement requests about your stations, and their answers.',
  evidenceRequests: 'Requests from readers of your share links to see more evidence, and your answers.',
  comments: 'Comments staff left on your drafts.',
  consentReqs: 'Consent requests sent to your family, and their answers.',
  notifications: 'Notifications sent to you.',
  prompts: 'Reflection prompts staff sent you.',
  notes: 'Notes your advisor keeps about you.',
  lines: 'Lines you asked for on your map.',
  privacy: 'Your privacy defaults.',
  intensity: 'How much of the app you chose to see (Simple, Standard, Full).',
  tags: 'Learner profile and approaches-to-learning tags on your stations.',
  github: 'Your GitHub connection and which repositories you shared.',
  casProjects: 'Your CAS project.', casNudges: 'CAS reminders staff sent you.',
  letters: 'Your reference letter.', applications: 'Your university applications.',
  alumEvents: 'Stations added after you left NIST.', answered: 'Which prompts and map moments you answered with a reflection.',
  roster: 'Rows from imported files that were matched to you.',
  classAnswers: 'Your answers to questions a teacher asked your class (or that you said were not for you).', classPrompts: 'Questions teachers asked your classes.',
  nudges: 'Nudges your advisor sent you to add something.',
  momentComments: 'Comments on your moments, yours and your teachers\', with who wrote each and when.',
  commentReads: 'When you and your teachers last read the comments on each moment.',
  spotted: 'Moments a teacher spotted and suggested for your journey, and whether you added them.',
  termReflections: 'Your end-of-term reflections: the moments you picked, your answers and goal, finished or still a draft.',
  peerFeedback: 'Kind feedback you gave classmates, and feedback classmates gave you (with their first name), whether it was thanked or hidden.',
  handIns: 'Tasks teachers set your classes that you handed in (or were given more time or a reminder for): when, which moment, what you ticked.',
};
const README = (s, files, accounts, when, rc) => [
  `Everything NIST Transit Portfolio holds about ${s.name} (student id ${s.id})`,
  `Made on ${when.slice(0, 10)} at ${when.slice(11, 16)} UTC, under Thailand's Personal Data Protection Act (the right to a copy).`,
  '',
  'Each .json file is plain text: open it with any text editor or a browser.',
  '',
  'student.json        Your student record: name, Year (grade + 1), programme, advisor, the lines on your map.',
  'activity.json       Your activity log: what you and others did on your record, and who opened your share links.',
  ...files.map(([f, about]) => `${f.padEnd(20)}${about}`),
  accounts ? 'accounts.json       Your sign-in account and the family accounts linked to you. Passwords are never kept in a readable form and are not included.' : null,
  'feedback.json       Feedback you sent with the Feedback button, with the screen you were on and your browser.',
  rc ? 'report-comments.json Report comments teachers and your advisor were drafting about you (not yet final), with who wrote each and when.' : null,
  'mentions.json       Other people\'s items that list you (a class task you handed in), with only your entry.',
  'files/              The files you uploaded as evidence. manifest.json gives each one\'s original name.',
  'manifest.json       A list of every file in this copy.',
  '',
  'To have something corrected or removed, ask the school\'s data protection officer or the pilot admin.',
].filter((l) => l !== null).join('\r\n');

// The copy as ZIP entries: [{ name, data }].
// reportComments: teachers' private report comment drafts about the student (server/report-comments.mjs). Only in a copy an
// admin makes (a formal PDPA request), never in the student's or family's own download or the leaver archive.
export function buildCopy(sid, { reportComments = false } = {}) {
  const accounts = [...studentAccounts(sid), ...familyAccounts(sid)];
  const d = api.studentData(sid, studentAccounts(sid).map((a) => a.id));
  if (!d) return null;
  const when = new Date().toISOString();
  const json = (v) => JSON.stringify(v, null, 2);
  const entries = [{ name: 'student.json', data: json(d.student) }, { name: 'activity.json', data: json(d.activity) }];
  const described = [];
  for (const [k, v] of Object.entries(d.own)) {
    if (k === 'students' || k === 'activity') continue; // in student.json and activity.json
    entries.push({ name: `${k}.json`, data: json(v) });
    described.push([`${k}.json`, ABOUT[k] || 'Other records about you.']);
  }
  if (accounts.length) entries.push({ name: 'accounts.json', data: json(accounts.map((a) => accountCopy(a, sid))) });
  const rc = reportComments ? draftsAbout(sid).map((x) => ({ kind: x.kind, class: x.kind === 'subject' ? api.getClasses().find((c) => c.id === x.group)?.name || x.group : 'Advisor comment', teacherId: x.teacherId, teacher: api.getTeacher(x.teacherId)?.name || null, text: x.text, done: x.done, updatedAt: x.updatedAt })) : null;
  if (rc) entries.push({ name: 'report-comments.json', data: json(rc) });
  entries.push({ name: 'mentions.json', data: json(d.mentioned) });
  const fb = feedbackOf(sid, studentAccounts(sid).map((a) => a.id));
  entries.push({ name: 'feedback.json', data: json(fb) });
  const files = [];
  for (const f of filesIn({ d, fb })) {
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(UPLOADS, `${f}.json`), 'utf8')); } catch { /* no meta */ }
    try { entries.push({ name: `files/${f}`, data: fs.readFileSync(path.join(UPLOADS, f)) }); files.push({ file: `files/${f}`, name: meta.name || f, type: meta.type, size: meta.size, added: meta.at }); } catch { files.push({ file: null, name: meta.name || f, missing: true }); }
  }
  entries.unshift({ name: 'README.txt', data: README(d.student, described, accounts.length, when, !!rc) });
  entries.push({ name: 'manifest.json', data: json({ format: d.format, studentId: sid, madeAt: when, files: entries.map((e) => e.name).concat('manifest.json'), uploads: files }) });
  return { entries, student: d.student };
}

const slug = (s) => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'student';
function sendCopy(req, res, sid) {
  const copy = buildCopy(sid, { reportComments: A.isAdmin(req.user) });
  if (!copy) throw fail(404, 'No such student.');
  audit({ action: 'copy', by: req.user?.id || null, studentId: sid });
  L.log(req, { action: 'pdpa-copy', target: L.studentsTarget([sid]) });
  const body = zip(copy.entries);
  const name = `${slug(copy.student.name)}-data-${new Date().toISOString().slice(0, 10)}.zip`;
  send(res, 200, body, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}"`, 'content-length': body.length });
}

// Removes the student; returns what went. Exported for tests.
export function eraseStudent(sid, by) {
  const s = api.getStudent(sid); if (!s) throw fail(404, 'No such student.');
  const own = studentAccounts(sid), family = familyAccounts(sid);
  const gone = [...own, ...family.filter((a) => a.children.length === 1)].map((a) => a.id);
  const files = filesIn({ d: api.studentData(sid, own.map((a) => a.id)), fb: feedbackOf(sid, own.map((a) => a.id)) });
  const removed = api.eraseStudent(sid, own.map((a) => a.id));
  const feedback = eraseFeedbackOf(sid, own.map((a) => a.id)).length;
  eraseDraftsAbout(sid); // report comment drafts about them
  changed({ fn: 'eraseStudent', by, erased: { studentId: sid, accounts: gone } });
  // Their files, unless another record still points to one (a station copied to a class page, for instance).
  const rest = api.snapshot();
  let filesRemoved = 0;
  for (const f of files) {
    if (rest.includes(f)) continue;
    for (const x of [f, `${f}.json`]) { try { fs.unlinkSync(path.join(UPLOADS, x)); } catch { /* already gone */ } }
    filesRemoved++;
  }
  // Their account goes; a family account loses the link, and goes too when this was its only child.
  for (const id of gone) A.removeAccount(id);
  for (const a of family) if (!gone.includes(a.id)) A.updateAccount(a, { children: a.children.filter((c) => c !== sid) });
  audit({ action: 'erase', by: by || null, studentId: sid });
  // The activity log keeps the ids for safeguarding; the student's name label goes (server/audit.mjs).
  L.redactStudent(sid, gone);
  return { removed, feedback, files: filesRemoved, accounts: gone.length, familyUnlinked: family.length - (gone.length - own.length) };
}

const requireAdmin = (req) => { if (!req.user) throw fail(401, 'Sign in first.'); if (!A.isAdmin(req.user)) throw fail(403, 'Only an admin can do that.'); };
const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();

export default (app) => {
  app.get('/api/admin/students/:id/export', (req, res, { id }) => { requireAdmin(req); sendCopy(req, res, id); });
  app.get('/api/me/export', (req, res) => {
    const u = req.user; if (!u) throw fail(401, 'Sign in first.');
    const want = req.query.get('student');
    const sid = A.isAdmin(u) && want ? want
      : u.kind === 'student' ? u.studentId
        : u.kind === 'parent' ? (want ? (u.children.includes(want) ? want : null) : u.children[0]) : null;
    if (!sid) throw fail(403, 'You can download only your own data, or your child\'s.');
    sendCopy(req, res, sid);
  });
  app.post('/api/admin/students/:id/erase', async (req, res, { id }) => {
    requireAdmin(req);
    const s = api.getStudent(id); if (!s) throw fail(404, 'No such student.');
    const { confirm } = await readJson(req);
    if (!sameName(confirm, s.name)) throw fail(400, 'Type the student\'s name exactly to confirm.');
    const out = eraseStudent(id, req.user.id);
    L.log(req, { action: 'pdpa-erase', target: { studentId: id, label: L.ERASED }, detail: { accounts: out.accounts, files: out.files } });
    send(res, 200, out);
  });
};
