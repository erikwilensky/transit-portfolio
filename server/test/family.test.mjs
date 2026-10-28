// Family sign-in letters, against a real pilot server. Run: npm run test:server.
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

test('family letters: advisors for their own advisees, joining, siblings, use limit, paused, removing', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-family-')), TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const tok = (l) => l.url.split('/#/family/')[1];
  const join = (l, body, cookie) => json(req('POST', '/api/family/join', { token: tok(l), ...body }, cookie));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    // Ada advises Fern and Gus (12B); Ben only teaches.
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;

    const list = await json(req('GET', '/api/advisor/family', null, ada));
    assert.deepEqual(list.students.map((s) => [s.name, s.homeroom, s.family.length, s.invite]), [['Fern Gale', '12B', 0, null], ['Gus Hale', '12B', 0, null]]);
    const l1 = await json(req('POST', '/api/advisor/family/letters', {}, ada));
    assert.equal(l1.status, 200);
    assert.equal(l1.school, 'NIST International School');
    assert.deepEqual(l1.letters.map((l) => [l.firstName, l.homeroom, l.year]), [['Fern', '12B', 12], ['Gus', '12B', 12]]);
    assert.match(l1.letters[0].url, /\/#\/family\/[\w-]{20,}$/);
    assert.ok(new Date(l1.letters[0].expiresAt) - Date.now() > 29.9 * 864e5);
    const [fern, gus] = l1.letters;

    // Only an advisor, for their own advisees; never a teacher; never signed out.
    assert.equal((await req('POST', '/api/advisor/family/letters', { studentIds: ['S2003'] }, ada)).status, 403, "another advisor's student");
    assert.equal((await req('POST', '/api/advisor/family/letters', { studentIds: ['S2001'] }, ben)).status, 403, 'a teacher');
    assert.equal((await req('GET', '/api/advisor/family', null, ben)).status, 403);
    assert.equal((await req('POST', '/api/advisor/family/letters', {})).status, 401);
    assert.equal((await req('POST', '/api/admin/family/letters', { homerooms: ['12B'] }, ada)).status, 403, 'admin route');

    // Before joining: the first name and homeroom only.
    const look = await json(req('GET', `/api/family/invite/${tok(fern)}`));
    assert.equal(look.status, 200);
    assert.deepEqual(Object.keys(look).filter((k) => !['status', 'cookie'].includes(k)).sort(), ['expiresAt', 'firstName', 'homeroom']);
    assert.deepEqual([look.firstName, look.homeroom], ['Fern', '12B']);
    assert.equal((await req('GET', '/api/family/invite/not-a-real-token-at-all')).status, 404);

    // A parent joins, then adds a sibling while signed in: one account.
    assert.equal((await join(fern, { name: 'Mo Gale', email: 'mo@family.example', password: 'short' })).status, 400);
    const mo = await join(fern, { name: 'Mo Gale', email: 'mo@family.example', password: 'mo-pass-1234' });
    assert.equal(mo.status, 200);
    assert.deepEqual([mo.user.kind, mo.user.children], ['parent', ['S2001']]);
    const st = (c) => req('GET', '/api/state', null, c).then((r) => r.json()).then((j) => j.snapshot.store);
    assert.deepEqual((await st(mo.cookie)).students.map((s) => s.id), ['S2001'], 'sees their own child only');
    const sib = await join(gus, {}, mo.cookie);
    assert.equal(sib.status, 200); assert.equal(sib.added, true);
    assert.deepEqual(sib.user.children, ['S2001', 'S2002']);
    assert.deepEqual((await st(mo.cookie)).students.map((s) => s.id).sort(), ['S2001', 'S2002']);
    assert.equal((await json(req('GET', '/api/auth/me', null, mo.cookie))).user.children.length, 2);
    assert.equal(A_count(await json(req('GET', '/api/admin/accounts', null, ac)), 'mo@family.example'), 1, 'one account for both');

    // A second family member on Fern's letter; a third is refused.
    const jo = await join(fern, { name: 'Jo Gale', email: 'jo@family.example', password: 'jo-pass-1234' });
    assert.equal(jo.status, 200);
    const third = await join(fern, { name: 'Al Gale', email: 'al@family.example', password: 'al-pass-1234' });
    assert.equal(third.status, 404); assert.match(third.error, /two family members/);
    assert.equal((await req('GET', `/api/family/invite/${tok(fern)}`)).status, 404);

    // An existing family email joins with its password (not signed in); a wrong password or a school email is refused.
    assert.equal((await join(gus, { email: 'jo@family.example', password: 'wrong-pass-1' })).status, 401);
    assert.equal((await join(gus, { name: 'Ada', email: 'ada.brook@example.org', password: 'ada-pass-123' })).status, 409);
    assert.equal((await join(gus, {}, ada)).status, 403, 'signed in as staff');
    const jo2 = await join(gus, { email: 'jo@family.example', password: 'jo-pass-1234' });
    assert.equal(jo2.status, 200); assert.deepEqual(jo2.user.children, ['S2001', 'S2002']);

    // The advisor sees who joined; only those with no family yet get a letter.
    const after = await json(req('GET', '/api/advisor/family', null, ada));
    assert.deepEqual(after.students.map((s) => s.family.map((f) => f.name).sort()), [['Jo Gale', 'Mo Gale'], ['Jo Gale', 'Mo Gale']]);
    assert.equal((await json(req('POST', '/api/advisor/family/letters', { onlyNew: true }, ada))).letters.length, 0);

    // A new letter cancels the earlier one.
    const l2 = await json(req('POST', '/api/advisor/family/letters', { studentIds: ['S2002'] }, ada));
    assert.equal(l2.letters.length, 1);
    assert.equal((await req('GET', `/api/family/invite/${tok(gus)}`)).status, 404, 'old letter cancelled');
    assert.equal((await req('GET', `/api/family/invite/${tok(l2.letters[0])}`)).status, 200);

    // Remove a family member: a teacher cannot; the advisor unlinks; the last child removes the account.
    assert.equal((await req('POST', '/api/family/unlink', { studentId: 'S2001', accountId: mo.user.id }, ben)).status, 403);
    assert.equal((await req('POST', '/api/family/unlink', { studentId: 'S2003', accountId: mo.user.id }, ada)).status, 403);
    const u1 = await json(req('POST', '/api/family/unlink', { studentId: 'S2001', accountId: mo.user.id }, ada));
    assert.deepEqual([u1.status, u1.removed], [200, false]);
    assert.deepEqual((await st(mo.cookie)).students.map((s) => s.id), ['S2002']);
    const u2 = await json(req('POST', '/api/family/unlink', { studentId: 'S2002', accountId: mo.user.id }, ada));
    assert.equal(u2.removed, true);
    assert.equal((await req('POST', '/api/auth/login', { email: 'mo@family.example', password: 'mo-pass-1234' })).status, 401);

    // Paused student: no letters, and an open letter is refused.
    const accs = await json(req('GET', '/api/admin/accounts', null, ac));
    const gusAcc = accs.accounts.find((a) => a.email === 'gus.hale@example.org');
    await json(req('POST', `/api/admin/accounts/${gusAcc.id}/pause`, {}, ac));
    assert.equal((await req('GET', `/api/family/invite/${tok(l2.letters[0])}`)).status, 403);
    assert.equal((await join(l2.letters[0], { name: 'New Hale', email: 'new@family.example', password: 'new-pass-1234' })).status, 403);
    assert.deepEqual((await json(req('POST', '/api/advisor/family/letters', {}, ada))).letters.map((l) => l.firstName), ['Fern']);
    assert.equal((await json(req('GET', '/api/advisor/family', null, ada))).students.find((s) => s.id === 'S2002').paused, true);

    // Admin: per homeroom (a student without a sign-in account gets a letter too); deleting the family account.
    const g = await json(req('GET', '/api/admin/family?homeroom=12B', null, ac));
    assert.deepEqual(g.homerooms.map((r) => [r.name, r.students, r.withFamily]), [['8A', 1, 0], ['12B', 2, 2]]);
    assert.deepEqual(g.students.map((s) => s.name), ['Fern Gale', 'Gus Hale']);
    const l3 = await json(req('POST', '/api/admin/family/letters', { homerooms: ['8A'] }, ac));
    assert.deepEqual(l3.letters.map((l) => [l.firstName, l.homeroom]), [['Hana', '8A']]);
    assert.equal((await req('DELETE', `/api/admin/accounts/${jo.user.id}`, null, ac)).status, 200);
    assert.equal((await json(req('GET', '/api/admin/family?homeroom=12B', null, ac))).homerooms[1].withFamily, 0);

    // Many bad tokens from one address: slowed to a stop.
    let last; for (let i = 0; i < 31; i++) last = await req('GET', `/api/family/invite/bad-token-${String(i).padStart(12, '0')}`);
    assert.equal(last.status, 429);
    assert.ok(!/family\/[\w-]{20,}/.test(srv.out()), 'no family links in the log');
  } finally { srv.p.kill(); }
});
const A_count = (list, email) => list.accounts.filter((a) => a.email === email).length;
