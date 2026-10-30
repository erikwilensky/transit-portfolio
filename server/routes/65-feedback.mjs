// Pilot feedback (data in server/feedback.mjs).
// POST /api/feedback { kind: broken|idea|confusing, message, route, screenshot? }   anyone signed in but a family account (403) → 201 { id }
//      At most 10 per account per hour (429). screenshot: an /api/files/ image this account uploaded.
// GET  /api/admin/feedback                     admin or leadership → { items: newest first }
// POST /api/admin/feedback/:id { done: bool }  admin or leadership → { item }
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import * as F from '../feedback.mjs';

const UPLOADS = path.join(DATA_DIR, 'uploads');
const fail = (status, message) => Object.assign(new Error(message), { status });
const LIMIT = Number(process.env.FEEDBACK_LIMIT) || 10, WINDOW = 60 * 60 * 1000;
const sent = new Map(); // account id → times sent in the last hour
const SHOT = /^\/?api\/files\/([a-f0-9]{32}\.(?:jpg|png|gif|webp|heic|heif|avif))$/;
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const canRead = (u) => A.isAdmin(u) || u?.kind === 'leadership';

function screenshotOf(url, user) {
  if (!url) return null;
  const m = SHOT.exec(String(url));
  if (!m) throw fail(400, 'The screenshot must be a picture.');
  let meta; try { meta = JSON.parse(fs.readFileSync(path.join(UPLOADS, `${m[1]}.json`), 'utf8')); } catch { throw fail(400, 'That screenshot was not found. Add it again.'); }
  if (meta.by !== user.id) throw fail(400, 'That screenshot was not found. Add it again.');
  return { url: `/api/files/${m[1]}`, name: meta.name, size: meta.size };
}
// The sender as the list shows them now: the account's current name, or what was kept when it was sent.
const view = (f) => { const a = A.accountById(f.by); return { ...f, name: a?.name || f.name, gone: !a }; };

export default (app) => {
  app.post('/api/feedback', async (req, res) => {
    const u = req.user; if (!u) throw fail(401, 'Sign in first.');
    if (u.kind === 'parent') throw fail(403, 'Families give feedback to the school by email.'); // since 30 October 2026
    const b = await readJson(req);
    if (!Object.hasOwn(F.KINDS, b.kind)) throw fail(400, 'Pick what kind of feedback it is.');
    const message = clip(b.message, 4000);
    if (message.length < 3) throw fail(400, 'Write a few words about it.');
    const now = Date.now(), times = (sent.get(u.id) || []).filter((t) => now - t < WINDOW);
    if (times.length >= LIMIT) throw fail(429, 'Thank you! You have sent a lot this hour. Try again later.');
    const screenshot = screenshotOf(b.screenshot, u);
    times.push(now); sent.set(u.id, times);
    const s = u.kind === 'student' ? api.getStudent(u.studentId) : null;
    const f = F.addFeedback({ by: u.id, name: u.name, role: u.kind, ...(s ? { studentId: s.id, year: s.grade + 1 } : {}),
      route: clip(b.route, 300) || null, ua: clip(req.headers['user-agent'], 300) || null, kind: b.kind, message, screenshot });
    send(res, 201, { id: f.id });
  });
  app.get('/api/admin/feedback', (req, res) => {
    if (!req.user) throw fail(401, 'Sign in first.');
    if (!canRead(req.user)) throw fail(403, 'Only leadership and the pilot admin can read feedback.');
    send(res, 200, { items: F.allFeedback().map(view) });
  });
  app.post('/api/admin/feedback/:id', async (req, res, { id }) => {
    if (!req.user) throw fail(401, 'Sign in first.');
    if (!canRead(req.user)) throw fail(403, 'Only leadership and the pilot admin can read feedback.');
    const f = F.feedbackById(id); if (!f) throw fail(404, 'No such feedback.');
    const { done } = await readJson(req);
    send(res, 200, { item: view(F.setDone(f, !!done, req.user)) });
  });
};
