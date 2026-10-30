// CAS hours with an outside supervisor (api.setCasCode, confirmCasHours, returnCasHours): they have no account and are never
// emailed. The student shows or prints a one-time code (and its QR, #/c/<code>); the supervisor opens it and confirms with the
// email address the student gave for them. Only the code's SHA-256 is kept in the record, for CAS_CODE_DAYS days.
//   POST /api/cas/code { entryId } (signed in: the student whose hours they are, or a CAS coordinator) → { code, expires }.
//       A new code replaces the old one. Only for pending hours that name an outside supervisor.
//   GET  /api/public/cas/:code → { student (first name), year, title, strand, date, hours, note, supervisor (name), expires }
//   POST /api/public/cas/:code { email, ok, comment? } → { status }: ok true confirms, false sends back. The code then stops.
// Wrong codes and wrong emails count per address (CAS_TRIES in 15 minutes, then 429); five wrong emails end that code.
import crypto from 'node:crypto';
import { send, readJson, clientIp } from '../lib.mjs';
import { api, changed } from '../store.mjs';
import { MODE, isAdmin, normEmail } from '../auth.mjs';
import * as L from '../audit.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
export const codeHash = (c) => crypto.createHash('sha256').update(`cas:${normCode(c)}`).digest('hex');
const makeCode = () => Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');
const WINDOW = 15 * 60 * 1000, TRIES = Number(process.env.CAS_TRIES) || 30;
const misses = new Map(); // ip → { n, first }
const wrongEmail = new Map(); // entryId → n
const missed = (ip) => { const m = misses.get(ip); if (!m || Date.now() - m.first > WINDOW) { misses.delete(ip); return 0; } return m.n; };
const miss = (ip) => { if (misses.size > 20000) misses.clear(); const n = missed(ip); misses.set(ip, { n: n + 1, first: n ? misses.get(ip).first : Date.now() }); };
const GONE = 'This code does not work. It may be mistyped, already used, or more than 30 days old. Ask the student for a new one.';

function entryFor(req, code) {
  const ip = clientIp(req);
  if (missed(ip) >= TRIES) throw fail(429, 'Too many tries. Wait 15 minutes.');
  const x = normCode(code).length === 8 ? api.casByCode(codeHash(code)) : null;
  if (!x) { miss(ip); throw fail(404, GONE); }
  return x;
}
const view = (x) => {
  const a = api.casAbout(x);
  return { student: a.name.split(' ')[0], year: a.year, title: a.title, strand: a.strand, date: x.date, hours: x.hours, note: x.note || '', supervisor: x.supervisor?.name || '', expires: x.code.expires };
};

export default (app) => {
  app.post('/api/cas/code', async (req, res) => {
    const { entryId } = await readJson(req);
    const x = api.getCasEntry(entryId), u = req.user;
    const allowed = MODE !== 'pilot' || (!!u && !!x && ((u.kind === 'student' && u.studentId === x.studentId) || isAdmin(u) || api.isCasCoordinator(u)));
    if (!x || !allowed) throw fail(404, 'No such hours.');
    if (x.status !== 'pending' || x.supervisor?.kind !== 'outside') throw fail(400, 'A code is only for hours waiting for an outside supervisor.');
    const code = makeCode(), expires = api.daysBefore(-api.CAS_CODE_DAYS);
    api.setCasCode(x.id, codeHash(code), expires);
    wrongEmail.delete(x.id);
    changed({ kind: 'cas-code', by: u?.id });
    L.log(req, { action: 'cas-code', target: { ...L.studentsTarget([x.studentId]), id: x.id } });
    send(res, 200, { code: `${code.slice(0, 4)}-${code.slice(4)}`, expires });
  });

  app.get('/api/public/cas/:code', (req, res, { code }) => send(res, 200, view(entryFor(req, code))));

  app.post('/api/public/cas/:code', async (req, res, { code }) => {
    const body = await readJson(req);
    const x = entryFor(req, code);
    if (!body.email || normEmail(body.email) !== x.supervisor.email) {
      miss(clientIp(req));
      const n = (wrongEmail.get(x.id) || 0) + 1; wrongEmail.set(x.id, n);
      if (n >= 5) { api.setCasCode(x.id, null); wrongEmail.delete(x.id); changed({ kind: 'cas-code' }); throw fail(404, GONE); }
      throw fail(400, 'That is not the email address the student gave for you. Check it, or ask the student.');
    }
    const ok = body.ok !== false;
    const opts = { via: 'code', name: x.supervisor.name, comment: String(body.comment || '').slice(0, 500) };
    if (ok) api.confirmCasHours(x.id, null, opts); else api.returnCasHours(x.id, null, opts);
    wrongEmail.delete(x.id);
    changed({ kind: 'cas-confirm' });
    L.log(req, { action: 'cas-confirm', actor: null, target: { ...L.studentsTarget([x.studentId]), id: x.id }, detail: { via: 'code', result: ok ? 'confirmed' : 'returned' } });
    send(res, 200, { status: ok ? 'confirmed' : 'returned' });
  });
};
