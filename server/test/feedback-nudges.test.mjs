// Pilot feedback and advisor nudges, against a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
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

test('nudges: advisor or whole-school staff only, once a week; feedback: sent, read, done, copied and erased', async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-fbn-'));
  const srv = await start({ PORT: String(port), DATA_DIR: dir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0', FEEDBACK_LIMIT: '3' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie, headers = {}) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined || body === null ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const act = (cookie, fn, args) => req('POST', '/api/action', { fn, args, rec: [] }, cookie);
  const state = async (cookie) => (await json(req('GET', '/api/state', null, cookie))).snapshot.store;
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie; // advises Fern and Gus
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie; // teaches Fern
    const dan = (await setup(link['dan.ellis@example.org'], 'dan-pass-123')).cookie; // leadership
    const fern = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const gus = (await setup(link['gus.hale@example.org'], 'gus-pass-123')).cookie;

    // ── Nudges ──
    assert.equal((await act(ben, 'nudgeStudent', ['S2001', 'T101'])).status, 403, 'a subject teacher');
    assert.equal((await act(ada, 'nudgeStudent', ['S2003', 'T100'])).status, 403, "another advisor's student");
    assert.equal((await act(ada, 'nudgeStudent', ['S2001', 'T101'])).status, 403, 'as someone else');
    assert.equal((await act(fern, 'nudgeStudent', ['S2001', 'T100'])).status, 403, 'a student');
    assert.equal((await act(ada, 'nudgeStudent', ['S2001', 'T100'])).status, 200);
    assert.equal((await act(dan, 'nudgeStudent', ['S2001', 'T103', 'Again?'])).status, 409, 'once in 7 days');
    assert.equal((await act(dan, 'nudgeStudent', ['S2002', 'T103', 'Show us your maths project!'])).status, 200, 'whole-school staff, as themselves');
    const fs1 = await state(fern);
    assert.deepEqual(fs1.nudges.map((n) => [n.studentId, n.from]), [['S2001', 'T100']], 'Fern sees only her own nudge');
    assert.match(fs1.notifications.find((n) => n.to === 'st:S2001').text, /^Ms Brook: Your advisor would love to see/);
    assert.equal(fs1.notifications.find((n) => n.to === 'st:S2001').go.param, 'add');
    assert.deepEqual((await state(ada)).nudges.map((n) => n.studentId).sort(), ['S2001', 'S2002'], 'the advisor sees both');
    assert.equal((await state(ben)).nudges.length, 1, 'a teacher of Fern sees hers only');
    assert.equal((await state(gus)).nudges[0].text, 'Show us your maths project!');

    // ── Feedback ──
    const send = (cookie, body, ua = 'TestBrowser/1.0') => req('POST', '/api/feedback', body, cookie, { 'user-agent': ua });
    assert.equal((await send(null, { kind: 'idea', message: 'hello' })).status, 401);
    assert.equal((await send(fern, { kind: 'nope', message: 'hello' })).status, 400);
    assert.equal((await send(fern, { kind: 'idea', message: ' ' })).status, 400);
    const up = (cookie) => json(req('POST', '/api/upload', Buffer.from('not really a png'), cookie, { 'content-type': 'image/png', 'x-filename': 'shot.png' }));
    const mine = await up(fern), adas = await up(ada);
    assert.equal((await send(fern, { kind: 'broken', message: 'The add button does nothing', screenshot: adas.url })).status, 400, "someone else's file");
    assert.equal((await send(fern, { kind: 'broken', message: 'The add button does nothing', route: '#/me/map', screenshot: mine.url })).status, 201);
    assert.equal((await send(fern, { kind: 'confusing', message: 'What is a line?', route: '#/me/map' })).status, 201);
    assert.equal((await send(ada, { kind: 'idea', message: 'Let me nudge by homeroom', route: '#/me/advisory' })).status, 201);
    assert.equal((await send(fern, { kind: 'idea', message: 'Dark mode please' })).status, 201);
    assert.equal((await send(fern, { kind: 'idea', message: 'One more' })).status, 429, 'rate limited per account');
    assert.equal((await send(gus, { kind: 'idea', message: 'Gus is fine' })).status, 201, 'others still can');

    assert.equal((await req('GET', '/api/admin/feedback', null, ada)).status, 403);
    assert.equal((await req('GET', '/api/admin/feedback', null, fern)).status, 403);
    const list = await json(req('GET', '/api/admin/feedback', null, dan));
    assert.equal(list.items.length, 5);
    assert.ok(list.items.every((f, i) => !i || list.items[i - 1].at >= f.at), 'newest first');
    const broken = list.items.find((f) => f.kind === 'broken');
    assert.deepEqual([broken.name, broken.role, broken.year, broken.route, broken.ua, broken.done], ['Fern Gale', 'student', 12, '#/me/map', 'TestBrowser/1.0', null]);
    assert.equal(broken.screenshot.url, mine.url);
    assert.equal(list.items.find((f) => f.by && f.name === 'Ms Ada Brook').role, 'advisor');
    const done = await json(req('POST', `/api/admin/feedback/${broken.id}`, { done: true }, dan));
    assert.equal(done.item.done.name, 'Dr Dan Ellis');
    assert.equal((await json(req('GET', '/api/admin/feedback', null, ac))).items.find((f) => f.id === broken.id).done.name, 'Dr Dan Ellis', 'saved');

    // ── PDPA: the copy has her feedback (and screenshot) and nudges; erasure removes them ──
    const zip = Buffer.from(await (await req('GET', '/api/me/export', null, fern)).arrayBuffer()).toString('latin1');
    assert.match(zip, /feedback\.json/); assert.match(zip, /The add button does nothing/); assert.match(zip, /nudges\.json/);
    assert.match(zip, new RegExp(`files/${mine.url.split('/').pop().replace('.', '\\.')}`));
    assert.doesNotMatch(zip, /Let me nudge by homeroom/);
    const er = await json(req('POST', '/api/admin/students/S2001/erase', { confirm: 'Fern Gale' }, ac));
    assert.equal(er.feedback, 3);
    assert.deepEqual((await json(req('GET', '/api/admin/feedback', null, dan))).items.map((f) => f.name).sort(), ['Gus Hale', 'Ms Ada Brook']);
    assert.equal((await req('GET', mine.url, null, dan)).status, 404, 'her screenshot is gone');
    assert.equal((await req('GET', adas.url, null, ada)).status, 200, 'Ada\'s upload is kept (its uploader opens it)');
    assert.deepEqual((await state(ada)).nudges.map((n) => n.studentId), ['S2002']);
    assert.ok(!JSON.parse(fs.readFileSync(path.join(dir, 'feedback.json'), 'utf8')).some((f) => f.studentId === 'S2001'));
  } finally { srv.p.kill(); }
});
