// Exhibition screens (api.createExhibition; the screen is src/screens/Kiosk.jsx at #/x/<token>, the owner's panel
// src/screens/Exhibitions.jsx). No sign-in for the screen: its long random token is the key, and it shows only what
// api.exhibitionSlides allows (publishable, not hidden, the student has not turned school screens off, never removed),
// with first names and Years, never surnames or comments. Photos open through the screen's own token (?ex=, server/files.mjs).
//   GET /api/public/exhibition/:token → { title, seconds, paused, refresh (seconds), slides: [{ eventId, title, date, name,
//       year, line: { id, name, colour }, photo, quote }] }; 404 once turned off or for an unknown token.
//   GET /api/exhibitions/:id/slides (signed in) → { slides (with studentId), removed: [{ eventId, title, name, by, at }] }:
//       the owner, admins and moderators see every slide; another teacher only the slides of students in a class they
//       teach now (the ones they may remove). Changes go through /api/action (create, remove a slide, pause, turn off),
//       which the activity log records.
import { send } from '../lib.mjs';
import { api } from '../store.mjs';
import { MODE, STAFF, isAdmin } from '../auth.mjs';

export const REFRESH_S = Math.max(2, Number(process.env.TP_EXHIBIT_REFRESH_S) || 300);
const fail = (status, message) => Object.assign(new Error(message), { status });
const FILE = /api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})/;

export function liveExhibition(token) {
  const x = api.exhibitionByToken(token);
  if (!x || x.revoked) throw fail(404, 'This screen has been turned off, or the address is wrong.');
  return x;
}
// A photo's address on the screen: an upload through the token, a web picture as it is, a built-in picture by path.
const photoUrl = (url, token) => {
  if (!url || typeof url !== 'string') return null;
  const m = FILE.exec(url);
  if (m) return `/api/files/${m[1]}?ex=${encodeURIComponent(token)}`;
  if (/^https:\/\//.test(url)) return url;
  return /^\/?(api\/|data:|blob:|javascript:)/i.test(url) || url.includes(':') ? null : `/${url.replace(/^\//, '')}`;
};
export function exhibitionFeed(token) {
  const x = liveExhibition(token);
  const slides = x.paused ? [] : api.exhibitionSlides(x).map(({ studentId, photo, ...s }) => ({ ...s, photo: photoUrl(photo, token) }));
  return { title: x.title, seconds: x.seconds, paused: !!x.paused, refresh: REFRESH_S, slides };
}

const teaches = (tid) => new Set((api.getStore().classes || []).filter((c) => (c.teacherIds || []).includes(tid)).map((c) => c.id));
const taughtBy = (tid) => { const mine = teaches(tid); return new Set(api.getEnrolments().filter((n) => mine.has(n.classId) && !(n.to && n.to < api.TODAY)).map((n) => n.studentId)); };

export default (app) => {
  app.get('/api/public/exhibition/:token', (req, res, { token }) => send(res, 200, exhibitionFeed(token)));

  app.get('/api/exhibitions/:id/slides', (req, res, { id }) => {
    const x = api.getExhibition(id), u = req.user;
    if (!x) throw fail(404, 'No such screen.');
    let only = null; // null: every slide
    if (MODE === 'pilot') {
      if (!u || !(isAdmin(u) || STAFF.includes(u.kind))) throw fail(404, 'No such screen.');
      const whole = isAdmin(u) || api.MODERATOR_KINDS.includes(u.kind) || (!!x.by && x.by === u.teacherId);
      if (!whole) only = taughtBy(u.teacherId);
    }
    const slides = api.exhibitionSlides(x).filter((s) => !only || only.has(s.studentId)).map((s) => ({ ...s, photo: s.photo && !/^https:|^\//.test(s.photo) ? `/${s.photo}` : s.photo }));
    const removed = (x.removed || []).map((r) => ({ ...r, e: api.getEvent(r.eventId) })).filter((r) => !only || (r.e && only.has(r.e.studentId)))
      .map(({ e, ...r }) => ({ ...r, title: e?.title || 'A moment', name: e ? api.getStudent(e.studentId)?.name.split(' ')[0] || '' : '', byName: api.getTeacher(r.by)?.name || (r.by ? '' : 'Pilot admin') }));
    send(res, 200, { slides, removed, refresh: REFRESH_S });
  });
};
