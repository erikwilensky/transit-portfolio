// Public share links (#/s/<token>) and printed verify codes (#/v/<code>), for readers outside the school.
// No sign-in. Each answer carries only what that one link or code shares, never the whole record.
import { send, readJson } from '../lib.mjs';
import { api, changed } from '../store.mjs';
import { verifyCode } from '../../src/format.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
const EMAIL = /^\S+@\S+\.\S+$/;

// The presentation and link behind a token, or an error a reader can understand.
export function findLink(token) {
  for (const list of Object.values(api.getDrafts())) for (const pres of list || []) {
    const link = pres.shareLinks?.find((l) => l.token === token);
    if (link) {
      if (link.revoked) throw fail(410, 'This link has been withdrawn. The student controls who can read their portfolio. Ask them for a new link.');
      if (link.expiresAt < api.TODAY) throw fail(410, 'This link has expired. Ask the student for a new link.');
      return { pres, link };
    }
  }
  throw fail(404, 'This link does not exist. Check the address, or ask the student for a new link.');
}

// Every store key the browser code may read, emptied, so nothing is carried over by accident.
const emptyLike = (v) => (Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : v);
const STUDENT_FIELDS = ['id', 'name', 'grade', 'programme', 'avatar', 'g9StartYear', 'startGrade', 'endGrade', 'cohortOnly'];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// A minimal snapshot, in the shape api.js snapshot() uses ({ store, seq, evSeq }), with only what this link shares:
// the one student, their publishable stations the presentation shows (after its lens and hidden lines),
// that presentation with only this link, and the public reflections and endorsements on those stations.
export function publicSnapshot(token, { gate = false } = {}) {
  const { pres, link } = findLink(token);
  const full = api.getStore();
  const sid = pres.studentId;
  const student = api.getStudent(sid);
  const map = api.getStudentMap(sid, 'public');
  const lens = api.applyLens(map, pres, { hiddenLines: pres.filters?.hiddenLines || [] });
  const lineIds = new Set(map.lines.filter((l) => lens.lineState[l.id] !== 'hidden').map((l) => l.id));
  const eventIds = gate ? new Set() : lens.visible;

  const store = Object.fromEntries(Object.entries(full).map(([k, v]) => [k, emptyLike(v)]));
  store.family = { lang: 'en' };
  const keep = (obj) => obj && Object.fromEntries(Object.entries(obj).filter(([id]) => lineIds.has(id)));
  store.students = [{
    ...pick(student, STUDENT_FIELDS),
    laneOrder: gate ? [] : student.laneOrder.filter((id) => lineIds.has(id)),
    lineLabels: keep(student.lineLabels), lineStatus: keep(student.lineStatus),
  }];
  // Lines a shown line branches from stay too (for "branch of …"), without being on the map.
  const parents = new Set([...lineIds].map((id) => api.getLine(id)?.parentLineId).filter(Boolean));
  store.lines = gate ? [] : full.lines.filter((l) => lineIds.has(l.id) || parents.has(l.id)).map((l) => structuredClone(l));
  store.events = full.events.filter((e) => eventIds.has(e.id) && e.studentId === sid && e.visibility === 'publishable')
    .map(({ sponsor, ...e }) => ({ ...structuredClone(e), lineIds: e.lineIds.filter((id) => lineIds.has(id)) }));
  const shown = new Set(store.events.map((e) => e.id));
  store.reflections = full.reflections.filter((r) => shown.has(r.eventId) && r.visibility === 'publishable').map((r) => ({ ...r }));
  store.endorsements = full.endorsements.filter((n) => shown.has(n.eventId)).map(({ id, eventId, teacherId, note, date }) => ({ id, eventId, teacherId, note, date }));
  store.tags = Object.fromEntries(Object.entries(full.tags || {}).filter(([id]) => shown.has(id)));
  const { shareLinks, ...rest } = pres;
  const presentation = structuredClone(rest);
  if (gate) { delete presentation.site; delete presentation.narratives; delete presentation.intro; delete presentation.design; }
  store.drafts = { [sid]: [{ ...presentation, shareLinks: [{ ...structuredClone(link), sharedWith: link.sharedWith || api.SHARED_LABEL[token] || null }] }] };
  store.linkViews = { [token]: api.extraViews(token) };
  return { store, seq: 1, evSeq: 900 };
}

// What the verification page needs for one station, looked up by its printed code.
export function publicVerify(code) {
  const want = String(code || '').toUpperCase();
  const e = api.getStore().events.find((x) => x.visibility === 'publishable' && verifyCode(x.id) === want);
  if (!e) throw fail(404, 'No public record for this code. The code may be mistyped, or the student has not made this item publishable.');
  const s = api.getStudent(e.studentId);
  return {
    code: want,
    event: { id: e.id, title: e.title, date: e.date, verification: e.verification, source: { system: e.source?.system, ref: e.source?.ref ?? null } },
    student: { name: s.name },
    endorsements: api.getStore().endorsements.filter((n) => n.eventId === e.id)
      .map((n) => { const t = api.getTeacher(n.teacherId); return { note: n.note, date: n.date, teacher: t ? { name: t.name, role: t.role } : null }; }),
  };
}

const reader = (link, body) => (EMAIL.test(body?.email || '') ? String(body.email).trim().slice(0, 200) : null);

export default (app) => {
  app.get('/api/public/share/:token', (req, res, { token }) => {
    const { pres, link } = findLink(token);
    if (api.isGated(link)) return send(res, 200, { gated: true, ...publicSnapshot(token, { gate: true }) });
    api.recordView(token, pres.studentId, 'Anonymous viewer');
    changed({ kind: 'view', token });
    send(res, 200, { gated: false, ...publicSnapshot(token) });
  });

  // Email-gated links: the reader gives an email first; it is logged next to the view.
  app.post('/api/public/share/:token/open', async (req, res, { token }) => {
    const { pres, link } = findLink(token);
    const email = reader(link, await readJson(req));
    if (!email) throw fail(400, 'Enter a work email to open this portfolio.');
    api.recordView(token, pres.studentId, email);
    changed({ kind: 'view', token });
    send(res, 200, { gated: false, ...publicSnapshot(token) });
  });

  // "Request more time" on a link: tells the student.
  app.post('/api/public/share/:token/extend', async (req, res, { token }) => {
    const { pres, link } = findLink(token);
    const body = await readJson(req);
    const who = reader(link, body) || link.sharedWith || api.SHARED_LABEL[token] || 'A viewer';
    const persona = api.PERSONA_OF_STUDENT[pres.studentId];
    api.notify(persona, `${who} asked to extend link /s/${token}`, { persona, screen: 'links' });
    changed({ kind: 'notify' });
    send(res, 200, { ok: true });
  });

  // "Ask for more evidence" on a station this link shows.
  app.post('/api/public/share/:token/ask', async (req, res, { token }) => {
    const { link } = findLink(token);
    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 2000);
    const snap = publicSnapshot(token);
    if (!text || !snap.store.events.some((e) => e.id === body.eventId)) throw fail(400, 'Nothing to ask about.');
    api.askEvidence(body.eventId, reader(link, body) || link.sharedWith || api.SHARED_LABEL[token] || 'A reader', text);
    changed({ kind: 'request' });
    send(res, 200, { ok: true });
  });

  app.get('/api/public/verify/:code', (req, res, { code }) => send(res, 200, publicVerify(code)));
};
