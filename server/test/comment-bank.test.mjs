// Teacher comment bank (api.addPhrase, editPhrase, deletePhrase, movePhrase, usePhrase): permissions, scope, replay,
// {first name}, use counts, and the activity log through a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-phrases-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');

const brook = { kind: 'teacher', teacherId: 'T100' }, carter = { kind: 'teacher', teacherId: 'T101' };
const coord = { kind: 'coordinator', teacherId: 'T104' }, lead = { kind: 'leadership', teacherId: 'T103' };
const counsellor = { kind: 'counsellor', teacherId: 'T102' }, admin = { kind: 'admin' };
const s1 = { kind: 'student', studentId: 'S2001' }, fam = { kind: 'parent', children: ['S2001'] };
let mine, school;

test('setup: class lists', () => { api.importRoster(structuredClone(FX)); });

test('mutators: add, edit, move, delete; checked, deterministic on replay', () => {
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  mine = api.addPhrase('T100', 'T100', { text: '  Great   work, {first name}! ', kind: 'praise' });
  api.setActionHook(null);
  assert.deepEqual([mine.owner, mine.text, mine.kind, mine.order, mine.by], ['T100', 'Great work, {first name}!', 'praise', 1, 'T100']);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  mine = api.getPhrase(mine.id);
  const two = api.addPhrase('T100', 'T100', { text: 'Could you add a photo of the result?', kind: 'next' });
  assert.throws(() => api.addPhrase('T100', 'T100', { text: 'great work, {FIRST NAME}!' }), /already/);
  assert.throws(() => api.addPhrase('T100', 'T101', { text: 'Nope' }), /own bank/);
  assert.throws(() => api.addPhrase('T100', 'T100', { text: ' ' }), /Write/);
  assert.equal(api.addPhrase('T101', 'T101', { text: 'Nice', kind: 'weird' }).kind, 'other');
  api.movePhrase(two.id, 'T100', -1);
  assert.deepEqual(api.phraseBank('T100').mine.map((p) => p.id), [two.id, mine.id]);
  api.movePhrase(two.id, 'T100', -1);
  assert.deepEqual(api.phraseBank('T100').mine.map((p) => p.id), [two.id, mine.id], 'already first');
  api.editPhrase(two.id, 'T100', { text: 'Could you add a photo, {first name}?', kind: 'question' });
  assert.equal(api.getPhrase(two.id).kind, 'question');
  school = api.addPhrase('school', 'T104', { text: 'You showed real care here.', kind: 'praise', lineId: 'science' });
  assert.equal(school.lineId, 'science');
  api.usePhrase(school.id, 'T100'); api.usePhrase(school.id, 'T100'); api.usePhrase(mine.id, 'T100');
  assert.deepEqual(api.phraseBank('T100').uses, { [school.id]: 2, [mine.id]: 1 });
  assert.throws(() => api.usePhrase(mine.id, 'T101'), /No such/, 'not someone else\'s phrase');
  api.deletePhrase(two.id, 'T100');
  assert.equal(api.getPhrase(two.id), undefined);
});

test('{first name}: filled in, or taken out tidily with no one student; saving puts it back', () => {
  assert.equal(api.fillPhrase('Great work, {first name}!', 'Aaron'), 'Great work, Aaron!');
  assert.equal(api.fillPhrase('Great work, {first name}!', null), 'Great work!');
  assert.equal(api.fillPhrase('{first name}, could you add a photo?', null), 'Could you add a photo?');
  assert.equal(api.phraseFrom('Well done Aaron, Aaronson.', 'Aaron'), 'Well done {first name}, Aaronson.');
});

test('canAct: own bank as yourself; the school bank for coordinators, leadership and admins; never students or families', () => {
  const t = { text: 'Keep going' };
  assert.ok(canAct(brook, 'addPhrase', ['T100', 'T100', t]));
  assert.ok(!canAct(brook, 'addPhrase', ['T101', 'T100', t]));
  assert.ok(!canAct(brook, 'addPhrase', ['T100', 'T101', t]));
  assert.ok(!canAct(brook, 'addPhrase', ['school', 'T100', t]), 'a teacher does not publish');
  assert.ok(!canAct(counsellor, 'addPhrase', ['school', 'T102', t]));
  assert.ok(canAct(coord, 'addPhrase', ['school', 'T104', t]));
  assert.ok(canAct(lead, 'editPhrase', [school.id, 'T103', t]));
  assert.ok(canAct(admin, 'deletePhrase', [school.id, null]));
  assert.ok(!canAct(admin, 'addPhrase', ['school', 'T104', t]), 'an admin as someone else');
  assert.ok(!canAct(admin, 'addPhrase', ['T100', null, t]));
  assert.ok(canAct(brook, 'editPhrase', [mine.id, 'T100', t]));
  assert.ok(!canAct(carter, 'editPhrase', [mine.id, 'T101', t]));
  assert.ok(!canAct(coord, 'deletePhrase', [mine.id, 'T104']), 'a coordinator never changes a teacher\'s own bank');
  assert.ok(!canAct(brook, 'movePhrase', [school.id, 'T100', 1]));
  assert.ok(canAct(brook, 'usePhrase', [school.id, 'T100']));
  assert.ok(canAct(brook, 'usePhrase', [mine.id, 'T100']));
  assert.ok(!canAct(carter, 'usePhrase', [mine.id, 'T101']));
  assert.ok(!canAct(admin, 'usePhrase', [school.id, null]));
  assert.ok(!canAct(brook, 'usePhrase', ['ph-nope', 'T100']));
  for (const u of [s1, fam]) for (const [fn, a] of [['addPhrase', ['school', null, t]], ['usePhrase', [school.id, null]], ['addPhrase', ['T100', 'T100', t]]]) assert.ok(!canAct(u, fn, a), `${u.kind} ${fn}`);
});

test('scope: your own phrases, the school bank and your own counts; students and families nothing', () => {
  const ids = (u) => scopedSnapshot(u).store.phrases.map((p) => p.id).sort();
  const carterOwn = api.phraseBank('T101').mine.map((p) => p.id);
  assert.deepEqual(ids(brook), [mine.id, school.id].sort());
  assert.deepEqual(ids(carter), [...carterOwn, school.id].sort());
  assert.deepEqual(ids(coord), [school.id], 'whole-school roles do not get teachers\' own banks');
  assert.deepEqual(ids(admin), [school.id]);
  assert.deepEqual(ids(s1), []);
  assert.deepEqual(ids(fam), []);
  assert.deepEqual(Object.keys(scopedSnapshot(brook).store.phraseUses), ['T100']);
  assert.deepEqual(scopedSnapshot(carter).store.phraseUses, {});
  assert.deepEqual(scopedSnapshot(s1).store.phraseUses, {});
  assert.deepEqual(scopedSnapshot(fam).store.phraseUses, {});
  assert.ok(!JSON.stringify(scopedSnapshot(s1).store).includes('real care'));
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
const stop = (p) => new Promise((r) => { p.once('exit', r); p.kill('SIGTERM'); });

test('server: school bank changes get their own activity-log line without the text; refusals answered 403', async () => {
  const port = await freePort(), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-phrases-srv-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; const j = await r.json().catch(() => ({})); return { status: r.status, ...j, cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const act = (c, fn, args) => json(req('POST', '/api/action', { fn, args, rec: [] }, c));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const dan = (await setup(link['dan.ellis@example.org'], 'dan-pass-123')).cookie;
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const fern = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const add = await act(dan, 'addPhrase', ['school', 'T103', { text: 'SECRET-PHRASE-TEXT, {first name}', kind: 'next' }]);
    assert.equal(add.status, 200);
    const pid = add.result.id;
    assert.equal((await act(dan, 'editPhrase', [pid, 'T103', { text: 'SECRET-PHRASE-EDIT', kind: 'praise' }])).status, 200);
    assert.equal((await act(ben, 'addPhrase', ['school', 'T101', { text: 'Not mine to publish' }])).status, 403);
    assert.equal((await act(ben, 'addPhrase', ['T101', 'T101', { text: 'SECRET-OWN-PHRASE' }])).status, 200);
    assert.equal((await act(ben, 'usePhrase', [pid, 'T101'])).status, 200);
    assert.equal((await act(fern, 'usePhrase', [pid, null])).status, 403);
    assert.equal((await act(dan, 'deletePhrase', [pid, 'T103'])).status, 200);
    const st = await json(req('GET', '/api/state', null, fern));
    assert.deepEqual(st.snapshot.store.phrases, []);
    await new Promise((r) => setTimeout(r, 100));
    const text = fs.readdirSync(DIR).filter((f) => /^audit-.*\.jsonl$/.test(f)).map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
    assert.ok(!text.includes('SECRET'), 'phrase text is never logged');
    const lines = text.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.action === 'school-phrase');
    assert.deepEqual(lines.map((e) => [e.detail.op, e.detail.kind, e.target.id, e.actor?.name]), [['add', 'next', pid, 'Dr Dan Ellis'], ['edit', 'praise', pid, 'Dr Dan Ellis'], ['delete', 'praise', pid, 'Dr Dan Ellis']]);
  } finally { await stop(srv.p); }
});
