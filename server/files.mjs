// Pilot: who may open an uploaded file (GET /api/files/:name). A file is served to someone who may read a record
// that uses it, and to its uploader. The source of truth is what that person downloads (scopedSnapshot, so reach,
// visibility levels, the family view and safeguarding's hidden moments all apply as they do to the record), or what
// an open share link shows (publicSnapshot). An index of file → students whose records use it (rebuilt lazily after
// each change) answers most refusals without building anyone's copy; each person's set of files is kept until the
// next change. Feedback screenshots: their sender, and the feedback readers (admin, leadership).
import { api, rev } from './store.mjs';
import { reachOf, scopedSnapshot } from './scope.mjs';
import { publicSnapshot } from './routes/40-public.mjs';
import { leaverPublicFiles } from './routes/41-leaver.mjs';
import * as A from './auth.mjs';
import * as F from './feedback.mjs';

const RE = /api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})/g;
const namesIn = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v ?? null); return s.includes('api/files/') ? [...s.matchAll(RE)].map((m) => m[1]) : []; };

let at = null;
const now = () => {
  if (at?.rev !== rev || at.today !== api.TODAY) at = { rev, today: api.TODAY, index: null, pub: null, users: new Map() };
  return at;
};

// fileName → Set of studentIds whose records use it ('*': a record not tied to one student).
function buildIndex() {
  const s = api.getStore(), idx = new Map();
  const evSid = new Map([...s.events, ...(s.inbox || []), ...(s.dismissed || []), ...(s.alumEvents || [])].map((e) => [e.id, e.studentId]));
  const add = (v, sid) => { for (const n of namesIn(v)) (idx.get(n) || idx.set(n, new Set()).get(n)).add(sid || '*'); };
  for (const v of Object.values(s)) {
    if (Array.isArray(v)) for (const x of v) add(x, x?.studentId || x?.event?.studentId || evSid.get(x?.eventId));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) add(x, api.getStudent(k) ? k : evSid.get(k));
  }
  return idx;
}
export const fileIndex = () => { const c = now(); return (c.index ||= buildIndex()); };

// Files any open share link shows (revoked and expired links show nothing).
function publicFiles() {
  const c = now();
  if (c.pub) return c.pub;
  c.pub = new Set();
  for (const list of Object.values(api.getDrafts() || {})) for (const p of list || []) for (const l of p.shareLinks || []) {
    if (l.revoked || l.expiresAt < api.TODAY) continue;
    try { for (const n of namesIn(publicSnapshot(l.token).store)) c.pub.add(n); } catch { /* a link that no longer opens */ }
  }
  for (const s of leaverPublicFiles()) for (const n of namesIn(s)) c.pub.add(n); // leaver portfolio links
  return c.pub;
}

const userKey = (u) => JSON.stringify([u.id, u.kind, !!u.admin, u.studentId, u.teacherId, u.children]);
function seen(u) {
  const c = now(), k = userKey(u);
  let e = c.users.get(k);
  if (!e) c.users.set(k, (e = { reach: reachOf(u), files: null }));
  return e;
}
const filesOf = (u) => { const e = seen(u); return (e.files ||= new Set(namesIn(scopedSnapshot(u).store))); };

// An admin's "See as" preview shows another account's copy: its files open for that admin for a while.
const previews = new Map(); // admin account id → Map(accountId → until)
const PREVIEW_MS = 2 * 60 * 60 * 1000;
export function previewing(admin, accountId) {
  (previews.get(admin.id) || previews.set(admin.id, new Map()).get(admin.id)).set(accountId, Date.now() + PREVIEW_MS);
}
const previewed = (u) => [...(previews.get(u.id) || new Map())].filter(([, until]) => until > Date.now()).map(([id]) => A.accountById(id)).filter(Boolean);

const viaRecord = (u, name, refs) => {
  const { reach } = seen(u);
  if (reach && !refs.has('*') && ![...refs].some((sid) => reach.has(sid))) return false; // nobody in reach uses it
  return filesOf(u).has(name);
};

// meta: the .json kept beside the upload ({ by: account id, … }).
// exToken: an exhibition screen's token (?ex=, server/routes/45-exhibition.mjs), for the photos on its slides.
export function canSeeFile(user, name, meta = {}, exToken = null) {
  if (user && meta.by && meta.by === user.id) return true;
  if (publicFiles().has(name)) return true;
  if (exToken && exhibitionFiles(exToken).has(name)) return true;
  if (!user) return false;
  if ((A.isAdmin(user) || user.kind === 'leadership') && F.allFeedback().some((f) => f.screenshot?.url?.endsWith(`/${name}`))) return true;
  // Kind feedback: the photo on a classmate's moment opened for feedback (api.peerMomentsFor).
  if (user.kind === 'student' && user.studentId && api.peerMomentsFor(user.studentId).some((m) => m.image?.includes(`api/files/${name}`))) return true;
  const refs = fileIndex().get(name);
  if (!refs) return false; // not attached to anything yet: the uploader only
  return [user, ...(A.isAdmin(user) ? previewed(user) : [])].some((u) => viaRecord(u, name, refs));
}

// Photos on an exhibition screen's slides, by its token: none once it is paused or turned off.
export function exhibitionFiles(token) {
  const x = api.exhibitionByToken(token);
  if (!x || x.revoked || x.paused) return new Set();
  const c = now(), ex = (c.ex ||= new Map());
  if (!ex.has(x.id)) ex.set(x.id, new Set(api.exhibitionSlides(x).flatMap((s) => namesIn(s.photo))));
  return ex.get(x.id);
}
