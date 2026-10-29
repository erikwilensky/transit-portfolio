// Activity log (server/audit.mjs, GET /api/audit), against a real pilot server. Run: npm run test:server.
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
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1], out: () => out }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const stop = (p) => new Promise((r) => { p.once('exit', r); p.kill('SIGTERM'); });
const day = (ms) => new Date(Date.now() - ms * 864e5).toISOString();
const month = (iso) => iso.slice(0, 7);

test('activity log: written on action, refusals logged, no secrets, admin and leadership only, pruned at 400 days', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-audit-'));
  // Old lines from before: 401 days old goes, 399 days old stays; a whole month 500 days old goes.
  const old = day(401), keep = day(399), ancient = day(500);
  const line = (at, action) => JSON.stringify({ at, actor: null, action, target: {}, result: 'ok', status: 200, ip: null }) + '\n';
  fs.appendFileSync(path.join(DIR, `audit-${month(ancient)}.jsonl`), line(ancient, 'ancient-entry'));
  fs.appendFileSync(path.join(DIR, `audit-${month(old)}.jsonl`), line(old, 'old-entry'));
  fs.appendFileSync(path.join(DIR, `audit-${month(keep)}.jsonl`), line(keep, 'kept-entry'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; const text = await r.text(); let j = {}; try { j = JSON.parse(text || '{}'); } catch { /* csv */ } return { status: r.status, text, ...j, cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const allText = () => fs.readdirSync(DIR).filter((f) => /^audit-.*\.jsonl$/.test(f)).map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
  try {
    assert.ok(!fs.existsSync(path.join(DIR, `audit-${month(ancient)}.jsonl`)) || month(ancient) === month(keep), 'a whole old month is removed');
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    assert.equal(imp.status, 200);
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fern = await setup(link['fern.gale@example.org'], 'fern-pass-123');
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;
    const dan = (await setup(link['dan.ellis@example.org'], 'dan-pass-123')).cookie;
    const sid = fern.user.studentId;

    // A student's change is written, with its main student by name; its text is not.
    const add = await json(req('POST', '/api/action', { fn: 'addStation', args: [sid, { title: 'Robot build', lineIds: [] }], rec: [] }, fern.cookie));
    assert.equal(add.status, 200);
    const evId = add.result.id;
    assert.equal((await req('POST', '/api/action', { fn: 'addReflection', args: [{ studentId: sid, eventId: evId, prompt: 'p', text: 'SECRET-REFLECTION-TEXT' }], rec: [] }, fern.cookie)).status, 200);
    assert.equal((await req('POST', '/api/action', { fn: 'addNote', args: [sid, 'SECRET-NOTE-TEXT-42'], rec: [] }, ada)).status, 200);
    assert.equal((await req('POST', '/api/action', { fn: 'addMomentComment', args: [evId, 'student', 'SECRET-COMMENT-TEXT'], rec: [] }, fern.cookie)).status, 200);
    // Refused: a student writing an advisor's note, and a change nobody may ask for here.
    assert.equal((await req('POST', '/api/action', { fn: 'addNote', args: [sid, 'SECRET-REFUSED-NOTE'], rec: [] }, fern.cookie)).status, 403);
    assert.equal((await req('POST', '/api/action', { fn: 'eraseStudent', args: [sid], rec: [] }, fern.cookie)).status, 400);
    // Sign-in failure and success.
    assert.equal((await req('POST', '/api/auth/login', { email: 'fern.gale@example.org', password: 'WRONG-PASSWORD-1' })).status, 401);
    assert.equal((await req('POST', '/api/auth/login', { email: 'nobody@example.org', password: 'WRONG-PASSWORD-2' })).status, 401);
    assert.equal((await req('POST', '/api/auth/login', { email: 'fern.gale@example.org', password: 'fern-pass-123' })).status, 200);
    // A refused file, twice: one line for the hour, counted.
    const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-filename': 'mine.png', cookie: fern.cookie }, body: Buffer.from('png') })).json();
    for (let i = 0; i < 2; i++) assert.equal((await req('GET', up.url, null, ben)).status, 404);
    assert.equal((await req('GET', up.url, null, fern.cookie)).status, 200);
    // Who may read it: admin and leadership; a teacher, a student and nobody signed in may not.
    assert.equal((await req('GET', '/api/audit', null, ben)).status, 403);
    assert.equal((await req('GET', '/api/audit', null, ada)).status, 403);
    assert.equal((await req('GET', '/api/audit', null, fern.cookie)).status, 403);
    assert.equal((await req('GET', '/api/audit')).status, 401);
    assert.equal((await req('GET', '/api/audit?format=csv', null, ben)).status, 403);
    // See as, account changes, a reset link.
    const accounts = (await json(req('GET', '/api/admin/accounts', null, ac))).accounts;
    const idOf = (email) => accounts.find((a) => a.email === email).id;
    assert.equal((await req('GET', `/api/admin/preview/${idOf('fern.gale@example.org')}`, null, ac)).status, 200);
    assert.equal((await req('POST', '/api/admin/preview/stop', { accountId: idOf('fern.gale@example.org') }, ac)).status, 200);
    const reset = await json(req('POST', `/api/admin/accounts/${idOf('ben.carter@example.org')}/reset`, null, ac));
    assert.equal((await req('POST', `/api/admin/accounts/${idOf('ben.carter@example.org')}`, { kind: 'coordinator' }, ac)).status, 200);
    assert.equal((await req('POST', `/api/admin/accounts/${idOf('gus.hale@example.org')}/pause`, null, ac)).status, 200);
    // Undo of Fern's own change.
    assert.equal((await req('POST', '/api/undo', { rev: add.rev }, fern.cookie)).status, 200);

    const lead = await json(req('GET', '/api/audit', null, dan));
    assert.equal(lead.status, 200);
    const all = (await json(req('GET', '/api/audit?size=500', null, ac))).entries;
    const find = (pred, msg) => { const e = all.find(pred); assert.ok(e, msg); return e; };

    const a1 = find((e) => e.action === 'change' && e.fn === 'addStation', 'addStation logged');
    assert.equal(a1.result, 'ok'); assert.equal(a1.actor.name, 'Fern Gale'); assert.equal(a1.target.studentId, sid); assert.equal(a1.target.label, 'Fern Gale');
    assert.ok(a1.ip && a1.at);
    const no = find((e) => e.fn === 'addNote' && e.result === 'refused', 'refused note logged');
    assert.equal(no.status, 403); assert.equal(no.actor.name, 'Fern Gale'); assert.equal(no.target.label, 'Fern Gale');
    find((e) => e.fn === 'eraseStudent' && e.status === 400, 'a change not allowed at all is logged');
    find((e) => e.action === 'sign-in-failed' && e.actor?.name === 'Fern Gale', 'failed sign-in on an account');
    find((e) => e.action === 'sign-in-failed' && !e.actor && e.target.label === 'Unknown email', 'failed sign-in, unknown email');
    find((e) => e.action === 'sign-in' && e.result === 'ok' && e.actor?.name === 'Fern Gale', 'sign-in');
    const fr = find((e) => e.action === 'file-refused', 'refused file');
    assert.equal(fr.detail.count, 2); assert.equal(fr.actor.name, 'Mr Ben Carter');
    find((e) => e.action === 'see-as-start' && e.target.label === 'Fern Gale', 'See as start');
    find((e) => e.action === 'see-as-stop', 'See as stop');
    find((e) => e.action === 'setup-link' && e.detail?.why === 'reset', 'reset link');
    const rc = find((e) => e.action === 'role-change', 'role change');
    assert.equal(rc.detail.from, 'teacher'); assert.equal(rc.detail.to, 'coordinator');
    find((e) => e.action === 'account-pause' && e.target.label === 'Gus Hale', 'pause');
    const ri = find((e) => e.action === 'roster-import', 'roster import');
    assert.equal(ri.detail.students, ROSTER.students.length);
    find((e) => e.action === 'undo' && e.result === 'ok', 'undo');
    find((e) => e.action === 'password-set' && e.actor?.name === 'Fern Gale', 'password set');
    find((e) => e.action === 'kept-entry', 'a 399-day-old entry is kept');
    assert.ok(!all.some((e) => e.action === 'old-entry' || e.action === 'ancient-entry'), 'older than 400 days is pruned');

    // Never a password, token, link, cookie, or anything people wrote.
    const text = allText() + JSON.stringify(all);
    for (const s of ['SECRET-REFLECTION-TEXT', 'SECRET-NOTE-TEXT-42', 'SECRET-COMMENT-TEXT', 'SECRET-REFUSED-NOTE', 'fern-pass-123', 'admin-pass-123', 'WRONG-PASSWORD', 'nobody@example.org', srv.setup, reset.setupUrl.split('/setup/')[1], link['fern.gale@example.org'].split('/setup/')[1], fern.cookie.split('=')[1], '"hash"', '"salt"']) {
      assert.ok(!text.includes(s), `the log holds ${s}`);
    }

    // Filters: person, student, action, result, dates; paging; CSV.
    const q = async (qs) => (await json(req('GET', `/api/audit?${qs}`, null, ac)));
    const byFern = await q(`person=${idOf('fern.gale@example.org')}&size=500`);
    assert.ok(byFern.total > 0 && byFern.entries.every((e) => e.actor?.id === idOf('fern.gale@example.org') || e.target.accountId === idOf('fern.gale@example.org')));
    const byName = await q('person=ben%20carter');
    assert.ok(byName.total > 0 && byName.entries.every((e) => /Ben Carter/.test(e.actor?.name || '') || /Ben Carter/.test(e.target.label || '')));
    const aboutFern = await q(`student=${sid}&size=500`);
    assert.ok(aboutFern.entries.length && aboutFern.entries.every((e) => e.target.studentId === sid || e.target.studentIds?.includes(sid)));
    assert.ok((await q('student=fern')).total >= aboutFern.total);
    const refused = await q('result=refused&size=500');
    assert.ok(refused.entries.length >= 3 && refused.entries.every((e) => e.result === 'refused'));
    assert.ok((await q('action=role-change')).entries.every((e) => e.action === 'role-change'));
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await q(`from=${today}&action=kept-entry`)).total, 0);
    assert.equal((await q(`to=${keep.slice(0, 10)}`)).total, 1);
    const p0 = await q('size=3&page=0'), p1 = await q('size=3&page=1');
    assert.equal(p0.entries.length, 3); assert.notDeepEqual(p0.entries, p1.entries);
    assert.ok(p0.entries[0].at >= p0.entries[2].at, 'newest first');
    assert.ok(p0.actions.includes('change') && p0.people.some((p) => p.name === 'Fern Gale'));
    const csv = await json(req('GET', `/api/audit?format=csv&student=${sid}`, null, dan));
    assert.equal(csv.status, 200);
    assert.ok(csv.text.startsWith('at,actor_id') && csv.text.trim().split('\r\n').length === aboutFern.total + 1);

    // Erasure: the student's name label goes from the log, the ids stay.
    const gus = 'S2002';
    assert.equal((await req('POST', '/api/action', { fn: 'addStation', args: [gus, { title: 'Gus moment', lineIds: [] }], rec: [] }, ada)).status, 200);
    assert.ok(allText().includes('Gus Hale'));
    assert.equal((await req('POST', `/api/admin/students/${gus}/erase`, { confirm: 'Gus Hale' }, ac)).status, 200);
    assert.ok(!allText().includes('Gus Hale'), 'the erased student\'s name is gone from the log');
    const after = (await q(`student=${gus}&size=500`)).entries;
    assert.ok(after.some((e) => e.fn === 'addStation') && after.some((e) => e.action === 'pdpa-erase') && after.every((e) => e.target.label === 'Erased student'));
  } finally {
    await stop(srv.p);
  }
  // After shutdown, the hour's refused files are on disk too.
  assert.ok(allText().includes('"file-refused"'));
});
