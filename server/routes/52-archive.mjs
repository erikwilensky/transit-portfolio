// Leaver archive (server/archive.mjs): end of year, each leaving student's whole journey as a ZIP to keep.
// GET    /api/admin/leavers                     admin → { students: [row], due: [row], eraseDays }
// GET    /api/admin/students/:id/archive        admin → one student's archive (ZIP)
// GET    /api/admin/leavers/archive?ids=a,b | ?all=1   admin → one ZIP holding each student's archive ZIP, streamed
// GET    /api/me/archive                        a student → their own archive (admins: ?student=<id>); anyone else 403
// POST   /api/admin/leavers/:id/erasure         admin → erasure scheduled ERASE_DAYS from today (after a download)
// DELETE /api/admin/leavers/:id/erasure         admin → schedule withdrawn
// POST   /api/admin/leavers/:id/erase { confirm: name }   admin, on or after the day → the PDPA erase. Never automatic.
// Every download, schedule, withdrawal and erasure goes to the activity log (server/audit.mjs).
import { send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import * as L from '../audit.mjs';
import { zip, zipStream } from '../zip.mjs';
import { audit, eraseStudent } from './50-pdpa.mjs';
import { ERASE_DAYS, archiveName, buildArchive, leaverRows, leavers, loadState, plusDays, saveState, slug, today } from '../archive.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const requireAdmin = (req) => { if (!req.user) throw fail(401, 'Sign in first.'); if (!A.isAdmin(req.user)) throw fail(403, 'Only an admin can do that.'); };
const sameName = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();
const listBody = () => { const students = leaverRows(); return { students, due: students.filter((s) => s.erasure && s.erasure.due <= today()), today: today(), eraseDays: ERASE_DAYS }; };

function noteDownload(req, sids, how, combined = 0) {
  if (A.isAdmin(req.user) && how === 'admin') {
    const st = loadState();
    for (const sid of sids) st.downloads[sid] = { at: new Date().toISOString(), by: req.user.id };
    saveState(st);
  }
  for (const sid of sids) {
    audit({ action: 'archive', by: req.user?.id || null, studentId: sid });
    L.log(req, { action: 'leaver-archive', target: L.studentsTarget([sid]), detail: { how, ...(combined ? { combined } : {}) } });
  }
}

function sendOne(req, res, sid, how) {
  const a = buildArchive(sid); if (!a) throw fail(404, 'No such student.');
  const body = zip(a.entries);
  noteDownload(req, [sid], how);
  send(res, 200, body, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${archiveName(a.student)}"`, 'content-length': body.length });
}

export default (app) => {
  app.get('/api/admin/leavers', (req, res) => { requireAdmin(req); send(res, 200, listBody()); });
  app.get('/api/admin/students/:id/archive', (req, res, { id }) => { requireAdmin(req); sendOne(req, res, id, 'admin'); });
  app.get('/api/me/archive', (req, res) => {
    const u = req.user; if (!u) throw fail(401, 'Sign in first.');
    const want = req.query.get('student');
    if (A.isAdmin(u) && want) return sendOne(req, res, want, 'admin');
    if (u.kind !== 'student' || !u.studentId || (want && want !== u.studentId)) throw fail(403, 'You can download only your own archive.');
    sendOne(req, res, u.studentId, 'self');
  });

  // Many students: one entry per student archive, built and sent one at a time.
  app.get('/api/admin/leavers/archive', async (req, res) => {
    requireAdmin(req);
    const ids = req.query.get('all') ? [...leavers().keys()] : [...new Set(String(req.query.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean))];
    if (!ids.length) throw fail(400, 'Choose at least one student.');
    const missing = ids.filter((id) => !api.getStudent(id));
    if (missing.length) throw fail(404, `No such student: ${missing.slice(0, 3).join(', ')}`);
    res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="leaver-archives-${today()}.zip"`, 'cache-control': 'no-store' });
    const z = zipStream(res);
    const list = [];
    try {
      for (const id of ids) {
        const a = buildArchive(id); if (!a) continue;
        const name = `${slug(a.student.name)}-${slug(id)}.zip`;
        await z.add(name, zip(a.entries));
        list.push(`${name.padEnd(48)}${a.student.name}, Year ${a.student.grade + 1}${a.student.homeroom ? `, ${a.student.homeroom}` : ''}`);
      }
      await z.add('README.txt', [`NIST Transit Portfolio: leaver archives, made on ${today()}.`, '', 'Each .zip is one student\'s archive, to give to them. Inside, README.txt (English and Thai) explains what it holds.', '', ...list, ''].join('\r\n'));
      await z.end();
      noteDownload(req, ids, 'admin', ids.length);
    } catch (e) { console.error('Leaver archive download stopped:', e.message); res.destroy(); }
  });

  app.post('/api/admin/leavers/:id/erasure', (req, res, { id }) => {
    requireAdmin(req);
    const s = api.getStudent(id); if (!s) throw fail(404, 'No such student.');
    const st = loadState();
    if (!st.downloads[id]) throw fail(409, 'Download their archive first.');
    st.erasures[id] = { due: plusDays(today(), ERASE_DAYS), at: new Date().toISOString(), by: req.user.id };
    saveState(st);
    L.log(req, { action: 'erasure-schedule', target: L.studentsTarget([id]), detail: { due: st.erasures[id].due } });
    send(res, 200, listBody());
  });
  app.delete('/api/admin/leavers/:id/erasure', (req, res, { id }) => {
    requireAdmin(req);
    const st = loadState(); if (!st.erasures[id]) throw fail(404, 'No erasure is scheduled for this student.');
    const { due } = st.erasures[id]; delete st.erasures[id]; saveState(st);
    L.log(req, { action: 'erasure-cancel', target: L.studentsTarget([id]), detail: { due } });
    send(res, 200, listBody());
  });
  app.post('/api/admin/leavers/:id/erase', async (req, res, { id }) => {
    requireAdmin(req);
    const s = api.getStudent(id); if (!s) throw fail(404, 'No such student.');
    const e = loadState().erasures[id];
    if (!e) throw fail(409, 'No erasure is scheduled for this student.');
    if (e.due > today()) throw fail(409, `This erasure is due on ${e.due}, not before.`);
    const { confirm } = await readJson(req);
    if (!sameName(confirm, s.name)) throw fail(400, 'Type the student\'s name exactly to confirm.');
    const out = eraseStudent(id, req.user.id);
    const st = loadState(); delete st.erasures[id]; delete st.downloads[id]; saveState(st);
    L.log(req, { action: 'pdpa-erase', target: { studentId: id, label: L.ERASED }, detail: { accounts: out.accounts, files: out.files, scheduled: e.due } });
    send(res, 200, { ...listBody(), erased: out });
  });
};
