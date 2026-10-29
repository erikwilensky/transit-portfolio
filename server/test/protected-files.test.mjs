// Protected uploaded files (server/files.mjs, GET /api/files/:name in pilot mode): who may open a file, the index and
// its cache, and the route's answers (404 for anyone else, Cache-Control private). Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-files-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api, changed } = await import('../store.mjs');
const { canSeeFile, fileIndex, previewing } = await import('../files.mjs');
const A = await import('../auth.mjs');

const fern = { id: 'u-fern', kind: 'student', studentId: 'S2001' };
const gus = { id: 'u-gus', kind: 'student', studentId: 'S2002' };
const brook = { id: 'u-ada', kind: 'advisor', teacherId: 'T100' }; // Fern's advisor
const carter = { id: 'u-ben', kind: 'teacher', teacherId: 'T101' }; // teaches Fern (12 CS)
const gray = { id: 'u-finn', kind: 'advisor', teacherId: 'T105' }; // no reach
const coord = { id: 'u-eve', kind: 'coordinator', teacherId: 'T104' };
const parent = { id: 'u-rose', kind: 'parent', children: ['S2001'] };
const otherParent = { id: 'u-ann', kind: 'parent', children: ['S2002'] };
const admin = { id: 'u-admin', kind: 'admin' };
const F = (c) => `${c.repeat(32)}.jpg`;
const url = (f) => `api/files/${f}`;
const sees = (f, meta = {}) => Object.fromEntries(Object.entries({ fern, gus, brook, carter, gray, coord, parent, otherParent, admin, out: null }).map(([k, u]) => [k, canSeeFile(u, f, meta)]));
let moment;

test('setup', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  changed({ fn: 'setup' });
});

test('an upload attached to nothing: its uploader only', () => {
  assert.deepEqual(Object.entries(sees(F('a'), { by: 'u-fern' })).filter(([, v]) => v).map(([k]) => k), ['fern']);
  assert.equal(canSeeFile(fern, F('a'), {}), false, 'no uploader on file: nobody');
});

test("a moment's photo: the student and staff in reach at advisor level; families at the family view", () => {
  moment = api.addStation('S2001', { title: 'Robot', lineIds: ['computing'], image: url(F('b')), visibility: 'advisor' });
  changed({ fn: 'addStation' });
  assert.deepEqual(sees(F('b')), { fern: true, gus: false, brook: true, carter: true, gray: false, coord: true, parent: false, otherParent: false, admin: true, out: false });
  api.setVisibility(moment.id, 'school'); changed({ fn: 'setVisibility' });
  assert.equal(canSeeFile(parent, F('b')), true, 'a Year 13 family sees school moments');
  assert.equal(canSeeFile(otherParent, F('b')), false);
  assert.equal(canSeeFile(gray, F('b')), false, 'school level, still no reach');
});

test('hidden by safeguarding: gone for the family, kept for the student and staff', () => {
  const r = api.reportItem({ eventId: moment.id }, 'inappropriate', '', { key: 'T100' });
  api.moderateReport(r.id, 'hide', '', 'T104'); changed({ fn: 'moderateReport' });
  assert.equal(canSeeFile(parent, F('b')), false);
  assert.equal(canSeeFile(fern, F('b')), true);
  assert.equal(canSeeFile(brook, F('b')), true);
  api.moderateReport(r.id, 'unhide', '', 'T104'); changed({ fn: 'moderateReport' });
  assert.equal(canSeeFile(parent, F('b')), true);
});

test('a private moment: the student only (admin too only while seeing as the student)', () => {
  const p = api.addStation('S2001', { title: 'Diary', lineIds: ['computing'], visibility: 'private', files: [{ kind: 'file', url: url(F('c')), caption: 'Notes' }] });
  api.addReflection({ eventId: p.id, studentId: 'S2001', text: 'x', visibility: 'private' });
  changed({ fn: 'addStation' });
  assert.deepEqual(Object.entries(sees(F('c'))).filter(([, v]) => v).map(([k]) => k), ['fern']);
  previewing(admin, 'u-nobody'); // no such account: nothing more
  assert.equal(canSeeFile(admin, F('c')), false);
  const acct = A.createAccount({ email: 'fern.gale@example.org', name: 'Fern Gale', kind: 'student', studentId: 'S2001' });
  previewing(admin, acct.id);
  assert.equal(canSeeFile(admin, F('c')), true, 'See as Fern');
  assert.equal(canSeeFile(brook, F('c')), false, 'only for the admin who looks');
});

test('public share links: anyone, for publishable moments on an open link; not once revoked', () => {
  const e = api.addStation('S2001', { title: 'Poster', lineIds: ['computing'], image: url(F('d')), visibility: 'publishable' });
  const link = { token: 'tok-files', expiresAt: '2099-01-01', created: '2026-10-01' };
  api.setStudentDrafts('S2001', [{ id: 'pr-f', studentId: 'S2001', title: 'Fern', audience: 'general', filters: { hiddenLines: [] }, shareLinks: [link] }]);
  changed({ fn: 'setStudentDrafts' });
  assert.equal(canSeeFile(null, F('d')), true);
  assert.equal(canSeeFile(gray, F('d')), true);
  assert.equal(canSeeFile(null, F('b')), false, 'a school moment is not on the link');
  api.setVisibility(e.id, 'school'); changed({ fn: 'setVisibility' });
  assert.equal(canSeeFile(null, F('d')), false, 'no longer publishable');
  api.setVisibility(e.id, 'publishable');
  api.setStudentDrafts('S2001', [{ id: 'pr-f', studentId: 'S2001', title: 'Fern', audience: 'general', filters: { hiddenLines: [] }, shareLinks: [{ ...link, revoked: true }] }]);
  changed({ fn: 'setStudentDrafts' });
  assert.equal(canSeeFile(null, F('d')), false, 'revoked');
});

test("a class answer's photo: the student and the class's teacher", () => {
  const p = api.askClass('C-CS12', 'T101', { question: 'What did you build?' });
  api.answerPrompt(p.id, 'S2001', { text: 'A robot', image: `/${url(F('e'))}` });
  changed({ fn: 'answerPrompt' });
  assert.equal(canSeeFile(fern, F('e')), true);
  assert.equal(canSeeFile(carter, F('e')), true);
  assert.equal(canSeeFile(gray, F('e')), false);
  assert.equal(canSeeFile(gus, F('e')), false);
  assert.equal(canSeeFile(parent, F('e')), false);
});

test('the index: cached until the next change, students per file', () => {
  const a = fileIndex();
  assert.equal(fileIndex(), a, 'same index without a change');
  assert.deepEqual([...a.get(F('b'))], ['S2001']);
  changed({ fn: 'noop' });
  assert.notEqual(fileIndex(), a, 'rebuilt after a change');
});

// ── Through the server ──
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

test('GET /api/files: 404 for anyone who may not see it, private no-cache for those who may', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-files-http-')), TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, u, body, cookie, headers = {}) => fetch(`${U}${u}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (u, password) => json(req('POST', '/api/auth/setup', { token: u.split('/setup/')[1], password }));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fernC = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const benC = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const finnC = (await setup(link['finn.gray@example.org'], 'finn-pass-123')).cookie;
    const up = await json(req('POST', '/api/upload', Buffer.from('png bytes'), fernC, { 'content-type': 'image/png', 'x-filename': 'robot.png' }));
    assert.equal(up.status, 201);
    const get = (cookie, h) => req('GET', up.url, null, cookie, h);
    assert.equal((await get(fernC)).status, 200, 'the uploader');
    assert.equal((await get(benC)).status, 404, 'not attached yet');
    assert.equal((await get(null)).status, 404, 'signed out');
    const add = await req('POST', '/api/action', { fn: 'addStation', args: ['S2001', { title: 'Robot', lineIds: ['computing'], image: up.url.slice(1), visibility: 'advisor' }], rec: [] }, fernC);
    assert.equal(add.status, 200);
    const ok = await get(benC);
    assert.equal(ok.status, 200, 'her teacher');
    assert.equal(await ok.text(), 'png bytes');
    assert.equal(ok.headers.get('cache-control'), 'private, no-cache');
    assert.equal((await get(benC, { 'if-none-match': ok.headers.get('etag') })).status, 304);
    assert.equal((await get(finnC, { 'if-none-match': ok.headers.get('etag') })).status, 404, 'a cached copy is not confirmed either');
    assert.equal((await get(finnC, { range: 'bytes=0-2' })).status, 404, 'no reach');
    const miss = await get(null);
    assert.equal(miss.status, 404);
    assert.deepEqual(await miss.json(), { error: 'Not found' }, 'the same answer as a file that does not exist');
  } finally { srv.p.kill(); }
});

test('demo mode: unchanged (anyone with the address, cached for a year)', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-files-demo-')), TP_MODE: 'demo', LOG_REQUESTS: '0' });
  try {
    const U = `http://localhost:${port}`;
    const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-filename': 'a.png' }, body: Buffer.from('x') })).json();
    const r = await fetch(`${U}${up.url}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'private, max-age=31536000, immutable');
  } finally { srv.p.kill(); }
});
