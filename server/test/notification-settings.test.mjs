// Notification settings: kinds on new notifications, "Clear read" (own bell only, nothing deleted), and the settings
// per account (POST /api/auth/prefs { notify }) against a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { inferKind } from '../../src/notify-kinds.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nsettings-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');

test('every new notification carries a kind; class answers and hand-ins are named, safeguarding too', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
  const T = 't:T100', S = 'st:S2001';
  const p = api.askClass('C-BIO12', 'T100', { question: 'What did you see?', asMoment: true });
  assert.equal(api.getNotifications(S)[0].kind, 'class');
  api.answerPrompt(p.id, 'S2001', { text: 'Cells.' });
  assert.equal(api.getNotifications(T)[0].kind, 'answers', 'an answer is a class answer, not a plain endorsement request');
  const day = new Date(Date.parse(api.TODAY) + 864e5).toISOString().slice(0, 10);
  const task = api.setTask('C-BIO12', 'T100', { title: 'Plant cell poster', brief: 'Draw it.', due: day, checklist: [], needsFile: false });
  api.handInTask(task.id, 'S2001', { text: 'Done' });
  assert.equal(api.getNotifications(T)[0].kind, 'handin');
  const e = api.addStation('S2001', { title: 'Robot', lineIds: ['art'], requestFrom: 'T100', visibility: 'school' });
  assert.equal(api.getNotifications(T)[0].kind, 'endorse');
  const r = api.reportItem({ eventId: e.id }, 'other', '', { key: 'T100' });
  assert.equal(api.getNotifications('role:coordinator')[0].kind, 'report');
  api.moderateReport(r.id, 'hide', '', 'T104');
  assert.equal(api.getNotifications(S)[0].kind, 'safeguarding');
  for (const n of api.getStore().notifications) assert.ok(n.kind, n.text);
  // Without a named kind, it is what the words say.
  const named = new Set(['answers', 'handin']);
  for (const n of api.getStore().notifications) if (!named.has(n.kind) && !/^[^:]+: /.test(n.text)) assert.equal(n.kind, inferKind(n.text, n.go), n.text);
});

test('Clear read: only read ones, only your own bell, kept in the record', () => {
  const S = 'st:S2001';
  const before = api.getStore().notifications.length;
  const mine = api.getNotifications(S);
  assert.ok(mine.some((n) => !n.read));
  mine[0].read = true;
  api.clearReadNotifications([S]);
  assert.ok(mine[0].cleared); assert.ok(mine.filter((n) => !n.read).every((n) => !n.cleared), 'unread ones stay');
  assert.equal(api.getStore().notifications.length, before, 'nothing deleted');
  const stu = { id: 'u1', kind: 'student', studentId: 'S2001' };
  assert.ok(canAct(stu, 'clearReadNotifications', [[S]]));
  assert.ok(!canAct(stu, 'clearReadNotifications', [['t:T100']]));
  assert.ok(canAct({ id: 'u2', kind: 'teacher', teacherId: 'T100' }, 'clearReadNotifications', [['t:T100', 'role:teacher']]));
});

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
const stop = (srv) => new Promise((r) => { srv.p.once('exit', r); srv.p.kill(); });

test('settings per account: checked for the person, their own only, kept with language and display', async () => {
  const port = await freePort();
  const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nsettings-srv-'));
  const env = { PORT: String(port), DATA_DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' };
  let srv = await start(env);
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const me = (c) => json(req('GET', '/api/auth/me', null, c)).then((j) => j.user);
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const ada = (await json(req('POST', '/api/auth/setup', { token: link['ada.brook@example.org'], password: 'ada-pass-123' }))).cookie;
    const fern = (await json(req('POST', '/api/auth/setup', { token: link['fern.gale@example.org'], password: 'fern-pass-123' }))).cookie;
    assert.equal((await me(ada)).notify, undefined, 'nothing chosen yet');
    await json(req('POST', '/api/auth/prefs', { lang: 'th' }, ada));
    const mine = { kinds: { answers: 'off', comments: 'week', endorse: 'on' }, quiet: { on: true, from: '21:00', to: '07:00' } };
    const r = await json(req('POST', '/api/auth/prefs', { notify: mine }, ada));
    assert.equal(r.status, 200);
    assert.deepEqual(r.user.notify, { kinds: { answers: 'off', comments: 'week' }, quiet: mine.quiet }, '“on” is left out');
    assert.equal(r.user.lang, 'th', 'the language is left alone');
    // A student has On and Off only, and only the student groups.
    assert.equal((await req('POST', '/api/auth/prefs', { notify: { kinds: { teacher: 'week' } } }, fern)).status, 400);
    assert.equal((await req('POST', '/api/auth/prefs', { notify: { kinds: { answers: 'off' } } }, fern)).status, 400);
    assert.equal((await json(req('POST', '/api/auth/prefs', { notify: { kinds: { kindfb: 'off' } } }, fern))).user.notify.quiet.on, false, 'quiet hours off by default');
    for (const notify of [null, [], 'off', { kinds: { answers: 'loud' } }, { kinds: [] }, { quiet: { on: true, from: '9pm', to: '07:00' } }, { quiet: { on: 1, from: '21:00', to: '07:00' } }, { other: 1 }]) {
      assert.equal((await req('POST', '/api/auth/prefs', { notify }, ada)).status, 400, JSON.stringify(notify));
    }
    assert.equal((await req('POST', '/api/auth/prefs', { notify: mine })).status, 401, 'signed out');
    assert.equal((await me(ac)).notify, undefined, 'nobody else’s');
    await stop(srv);
    srv = await start(env);
    assert.deepEqual((await me(ada)).notify.kinds, { answers: 'off', comments: 'week' }, 'kept in accounts.json');
  } finally { srv.p.kill(); }
});
