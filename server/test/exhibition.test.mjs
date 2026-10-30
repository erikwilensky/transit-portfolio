// Exhibition screens (api.createExhibition, server/routes/45-exhibition.mjs, the ?ex= file token in server/files.mjs):
// only publishable moments, not hidden, not of a student who turned school screens off, never a removed slide; who may
// make, remove, pause and turn off; the scoped copy; and through the server, the feed, its photos and 404 once turned off.
// Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-exhibit-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api, changed } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { canSeeFile } = await import('../files.mjs');
const { exhibitionFeed } = await import('../routes/45-exhibition.mjs');

const TOKEN = 'a'.repeat(20) + 'B'.repeat(20) + '_-x';
const F = (c) => `${c.repeat(32)}.jpg`;
const brook = { id: 'u-ada', kind: 'advisor', teacherId: 'T100' }; // teaches 12 Biology (Fern, Gus), advises both
const carter = { id: 'u-ben', kind: 'teacher', teacherId: 'T101' }; // teaches 12 CS (Fern)
const gray = { id: 'u-finn', kind: 'advisor', teacherId: 'T105' }; // no classes
const coord = { id: 'u-eve', kind: 'coordinator', teacherId: 'T104' };
const fern = { id: 'u-fern', kind: 'student', studentId: 'S2001' };
const parent = { id: 'u-rose', kind: 'parent', children: ['S2001'] };
const admin = { id: 'u-admin', kind: 'admin' };
const m = {};
let ex;

test('setup: moments at every level', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['computing']; }
  m.pub = api.addStation('S2001', { title: 'Robot arm', lineIds: ['computing'], image: `api/files/${F('a')}`, visibility: 'publishable' });
  api.addReflection({ studentId: 'S2001', eventId: m.pub.id, prompt: 'p', text: 'It finally lifted a cup. Then it dropped it.', visibility: 'publishable' });
  api.addReflection({ studentId: 'S2001', eventId: m.pub.id, prompt: 'p', text: 'PRIVATE-THOUGHTS', visibility: 'private' });
  api.addMomentComment(m.pub.id, 'T101', 'COMMENT-TEXT');
  m.school = api.addStation('S2001', { title: 'School only', lineIds: ['computing'], image: `api/files/${F('b')}`, visibility: 'school' });
  m.gus = api.addStation('S2002', { title: 'Gus poster', lineIds: ['computing'], image: `api/files/${F('c')}`, visibility: 'publishable' });
  m.hidden = api.addStation('S2001', { title: 'Hidden one', lineIds: ['computing'], image: `api/files/${F('d')}`, visibility: 'publishable' });
  const r = api.reportItem({ eventId: m.hidden.id }, 'inappropriate', '', { key: 'T100' });
  api.moderateReport(r.id, 'hide', '', 'T104');
  changed({ fn: 'setup' });
});

test('who may make one', () => {
  const spec = (s) => [{ title: 'Open evening', seconds: 6, ...s }];
  assert.equal(canAct(carter, 'createExhibition', [...spec({ classIds: ['C-CS12'] }), 'T101', TOKEN]), true, 'a teacher, from a class they teach');
  assert.equal(canAct(carter, 'createExhibition', [...spec({ classIds: ['C-BIO12'] }), 'T101', TOKEN]), false, 'not a class they do not teach');
  assert.equal(canAct(carter, 'createExhibition', [...spec({ years: [13] }), 'T101', TOKEN]), false, 'never whole Years');
  assert.equal(canAct(carter, 'createExhibition', [...spec({}), 'T101', TOKEN]), false, 'never the whole school');
  assert.equal(canAct(carter, 'createExhibition', [...spec({ classIds: ['C-CS12'] }), 'T100', TOKEN]), false, 'only as themselves');
  assert.equal(canAct(carter, 'createExhibition', [...spec({ classIds: ['C-CS12'] }), 'T101', 'short']), false, 'a long random address');
  assert.equal(canAct(brook, 'createExhibition', [...spec({ advisory: true }), 'T100', TOKEN]), true, 'an advisor, their advisory');
  assert.equal(canAct(coord, 'createExhibition', [...spec({ years: [13, 9] }), 'T104', TOKEN]), true, 'a coordinator, any Year');
  assert.equal(canAct(admin, 'createExhibition', [...spec({}), null, TOKEN]), true);
  assert.equal(canAct(fern, 'createExhibition', [...spec({}), null, TOKEN]), false, 'never a student');
  assert.equal(canAct(parent, 'createExhibition', [...spec({}), null, TOKEN]), false);
});

test('only publishable, never hidden, first name and Year, one line of a publishable reflection, no comments', () => {
  ex = api.createExhibition({ title: 'Open evening', years: [12], seconds: 6 }, 'T104', TOKEN);
  changed({ fn: 'createExhibition' });
  const feed = exhibitionFeed(TOKEN);
  assert.deepEqual(feed.slides.map((s) => s.title).sort(), ['Gus poster', 'Robot arm']);
  const robot = feed.slides.find((s) => s.eventId === m.pub.id);
  assert.equal(robot.name, 'Fern');
  assert.equal(robot.year, 12);
  assert.equal(robot.quote, 'It finally lifted a cup.');
  assert.equal(robot.photo, `/api/files/${F('a')}?ex=${TOKEN}`);
  assert.equal(robot.line.id, 'computing');
  const json = JSON.stringify(feed);
  for (const s of ['Gale', 'Hale', 'PRIVATE-THOUGHTS', 'COMMENT-TEXT', 'School only', 'Hidden one', 'S2001']) assert.ok(!json.includes(s), `leaks ${s}`);
  assert.equal(feed.seconds, 6);
});

test('a student who turned school screens off never appears', () => {
  api.setPrivacy('S2002', { screens: false }); changed({ fn: 'setPrivacy' });
  assert.deepEqual(exhibitionFeed(TOKEN).slides.map((s) => s.title), ['Robot arm']);
  assert.equal(canSeeFile(null, F('c'), {}, TOKEN), false, 'nor their photo');
  api.setPrivacy('S2002', { screens: true }); changed({ fn: 'setPrivacy' });
  assert.equal(exhibitionFeed(TOKEN).slides.length, 2);
});

test("photos: only through the screen's own token, only for its slides", () => {
  assert.equal(canSeeFile(null, F('a'), {}, TOKEN), true);
  assert.equal(canSeeFile(null, F('a')), false, 'no token');
  assert.equal(canSeeFile(null, F('a'), {}, 'z'.repeat(43)), false, 'another token');
  assert.equal(canSeeFile(null, F('b'), {}, TOKEN), false, 'a school-only moment');
  assert.equal(canSeeFile(null, F('d'), {}, TOKEN), false, 'a hidden moment');
});

test('removing a slide: the owner, a teacher of the student’s class, moderators; never back', () => {
  assert.equal(canAct(carter, 'removeExhibitionSlide', [ex.id, m.pub.id, 'T101']), true, 'Fern’s CS teacher');
  assert.equal(canAct(carter, 'removeExhibitionSlide', [ex.id, m.gus.id, 'T101']), false, 'not Gus (not in his class)');
  assert.equal(canAct(gray, 'removeExhibitionSlide', [ex.id, m.pub.id, 'T105']), false, 'no class with her');
  assert.equal(canAct(carter, 'removeExhibitionSlide', [ex.id, m.pub.id, 'T100']), false, 'only as themselves');
  assert.equal(canAct(fern, 'removeExhibitionSlide', [ex.id, m.pub.id, null]), false, 'not the student');
  assert.equal(canAct(carter, 'pauseExhibition', [ex.id, true, 'T101']), false, 'pausing: the owner only');
  assert.equal(canAct(coord, 'pauseExhibition', [ex.id, true, 'T104']), true);
  assert.equal(canAct(carter, 'revokeExhibition', [ex.id, 'T101']), false);
  api.removeExhibitionSlide(ex.id, m.pub.id, 'T101'); changed({ fn: 'removeExhibitionSlide' });
  assert.deepEqual(exhibitionFeed(TOKEN).slides.map((s) => s.title), ['Gus poster']);
  assert.equal(canSeeFile(null, F('a'), {}, TOKEN), false, 'its photo closes');
  api.setVisibility(m.pub.id, 'school'); api.setVisibility(m.pub.id, 'publishable'); changed({ fn: 'setVisibility' });
  assert.ok(!exhibitionFeed(TOKEN).slides.some((s) => s.eventId === m.pub.id), 'removed slides never return');
});

test('paused: no slides, no photos', () => {
  api.pauseExhibition(ex.id, true, 'T104'); changed({ fn: 'pauseExhibition' });
  const f = exhibitionFeed(TOKEN);
  assert.equal(f.paused, true); assert.equal(f.slides.length, 0);
  assert.equal(canSeeFile(null, F('c'), {}, TOKEN), false);
  api.pauseExhibition(ex.id, false, 'T104'); changed({ fn: 'pauseExhibition' });
  assert.equal(canSeeFile(null, F('c'), {}, TOKEN), true);
});

test('the scoped copy: the owner gets the address, other staff do not, students and families get nothing', () => {
  assert.equal(scopedSnapshot(coord).store.exhibitions[0].token, TOKEN);
  assert.equal(scopedSnapshot(admin).store.exhibitions[0].token, TOKEN);
  const c = scopedSnapshot(carter).store.exhibitions[0];
  assert.equal(c.token, null); assert.equal(c.id, ex.id);
  assert.deepEqual(scopedSnapshot(gray).store.exhibitions[0].removed, [], 'removed slides of students out of reach are left out');
  assert.deepEqual(scopedSnapshot(fern).store.exhibitions, []);
  assert.deepEqual(scopedSnapshot(parent).store.exhibitions, []);
});

test('turned off: 404, no photos', () => {
  api.revokeExhibition(ex.id, 'T104'); changed({ fn: 'revokeExhibition' });
  assert.throws(() => exhibitionFeed(TOKEN), (e) => e.status === 404);
  assert.equal(canSeeFile(null, F('c'), {}, TOKEN), false);
  assert.throws(() => api.removeExhibitionSlide(ex.id, m.gus.id, 'T104'), /turned off/);
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

test('through the server: the feed signed out, photos by token, the queue, the activity log, 404 once turned off', async () => {
  const port = await freePort(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-exhibit-http-'));
  const srv = await start({ PORT: String(port), DATA_DIR: dataDir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0', TP_EXHIBIT_REFRESH_S: '3' });
  const U = `http://localhost:${port}`;
  const req = (method, u, body, cookie, headers = {}) => fetch(`${U}${u}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json().catch(() => ({}))), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (u, password) => json(req('POST', '/api/auth/setup', { token: u.split('/setup/')[1], password }));
  const act = (cookie, fn, args) => json(req('POST', '/api/action', { fn, args, rec: [] }, cookie));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fernC = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const gusC = (await setup(link['gus.hale@example.org'], 'gus-pass-123')).cookie;
    const benC = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const finnC = (await setup(link['finn.gray@example.org'], 'finn-pass-123')).cookie;
    const up = await json(req('POST', '/api/upload', Buffer.from('png bytes'), fernC, { 'content-type': 'image/png', 'x-filename': 'arm.png' }));
    const a = await act(fernC, 'addStation', ['S2001', { title: 'Robot arm', lineIds: ['computing'], image: up.url.slice(1), visibility: 'publishable' }]);
    assert.equal(a.status, 200);
    assert.equal((await act(gusC, 'addStation', ['S2002', { title: 'Gus poster', lineIds: ['computing'], visibility: 'publishable' }])).status, 200);
    assert.equal((await act(gusC, 'setPrivacy', ['S2002', { screens: false }])).status, 200, 'Gus turns school screens off');
    assert.equal((await act(benC, 'createExhibition', [{ title: 'CS showcase', classIds: ['C-BIO12'] }, 'T101', TOKEN])).status, 403, 'not a class he teaches');
    const made = await act(benC, 'createExhibition', [{ title: 'CS showcase', classIds: ['C-CS12'], seconds: 5 }, 'T101', TOKEN]);
    assert.equal(made.status, 200);
    const exId = made.result.id;
    const feed = await json(req('GET', `/api/public/exhibition/${TOKEN}`));
    assert.equal(feed.status, 200);
    assert.equal(feed.refresh, 3);
    assert.deepEqual(feed.slides.map((s) => s.title), ['Robot arm']);
    const photo = feed.slides[0].photo;
    assert.equal((await req('GET', photo)).status, 200, 'the photo, signed out, with the token');
    assert.equal((await req('GET', up.url)).status, 404, 'not without it');
    assert.equal((await req('GET', `${up.url}?ex=${'q'.repeat(40)}`)).status, 404, 'nor with another');
    const q = await json(req('GET', `/api/exhibitions/${exId}/slides`, null, benC));
    assert.equal(q.slides.length, 1);
    assert.equal((await json(req('GET', `/api/exhibitions/${exId}/slides`, null, finnC))).slides.length, 0, 'another teacher sees none of it');
    assert.equal((await json(req('GET', `/api/exhibitions/${exId}/slides`, null, fernC))).status, 404, 'a student: nothing');
    assert.equal((await act(finnC, 'removeExhibitionSlide', [exId, a.result.id, 'T105'])).status, 403);
    assert.equal((await act(benC, 'removeExhibitionSlide', [exId, a.result.id, 'T101'])).status, 200);
    assert.equal((await json(req('GET', `/api/public/exhibition/${TOKEN}`))).slides.length, 0, 'removed');
    assert.equal((await req('GET', photo)).status, 404, 'its photo too');
    assert.equal((await act(finnC, 'revokeExhibition', [exId, 'T105'])).status, 403);
    assert.equal((await act(benC, 'revokeExhibition', [exId, 'T101'])).status, 200);
    assert.equal((await req('GET', `/api/public/exhibition/${TOKEN}`)).status, 404, 'turned off: 404');
    const log = fs.readdirSync(dataDir).filter((f) => f.startsWith('audit-')).flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    const ok = (fn) => log.filter((e) => e.fn === fn && e.result === 'ok');
    assert.equal(ok('createExhibition').length, 1);
    assert.equal(ok('createExhibition')[0].target.id, exId);
    assert.equal(ok('removeExhibitionSlide')[0].target.studentId, 'S2001');
    assert.equal(ok('revokeExhibition').length, 1);
    assert.ok(!JSON.stringify(log).includes(TOKEN), 'the address is never in the log');
  } finally { srv.p.kill(); }
});
