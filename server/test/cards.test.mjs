// Printable sign-in cards and pausing leavers, against a real pilot server. Run: npm run test:server.
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

test('sign-in cards: advisors for their own advisees only, admin per homeroom and staff; pausing leavers', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-cards-')), TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));

    // Ada advises Fern and Gus (T100); Ben only teaches (T101); Finn advises nobody (T105).
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const finn = (await setup(link['finn.gray@example.org'], 'finn-pass-123')).cookie;
    const fern = await setup(link['fern.gale@example.org'], 'fern-pass-123');
    assert.equal(fern.status, 200);

    const list = await json(req('GET', '/api/advisor/cards', null, ada));
    assert.deepEqual(list.students.map((s) => [s.name, s.homeroom, s.hasPassword]), [['Fern Gale', '12B', true], ['Gus Hale', '12B', false]]);
    const c1 = await json(req('POST', '/api/advisor/cards', {}, ada));
    assert.equal(c1.status, 200);
    assert.equal(c1.school, 'NIST International School');
    assert.deepEqual(c1.cards.map((c) => [c.name, c.homeroom, c.year, c.email]), [['Gus Hale', '12B', 12, 'gus.hale@example.org']], 'only those without a password');
    assert.match(c1.cards[0].setupUrl, /\/#\/setup\/[\w-]{20,}$/);
    assert.ok(new Date(c1.cards[0].expiresAt) - Date.now() > 6.9 * 864e5);
    // The old CSV link stops working; the card's link works.
    assert.equal((await setup(link['gus.hale@example.org'], 'gus-pass-123')).status, 404);
    assert.equal((await setup(c1.cards[0].setupUrl, 'gus-pass-123')).status, 200);
    // Everyone: also Fern, whose password ends.
    const c2 = await json(req('POST', '/api/advisor/cards', { includeSignedUp: true }, ada));
    assert.deepEqual(c2.cards.map((c) => c.name), ['Fern Gale', 'Gus Hale']);
    assert.equal((await req('GET', '/api/auth/me', null, fern.cookie).then((r) => r.json())).user, null, 'Fern signed out');
    assert.equal((await req('POST', '/api/auth/login', { email: 'fern.gale@example.org', password: 'fern-pass-123' })).status, 401);

    // Not someone else's advisees, not a teacher, not an advisor of nobody, not a student, not signed out.
    assert.equal((await req('POST', '/api/advisor/cards', { studentIds: ['S2003'] }, ada)).status, 403, "another advisor's student");
    assert.equal((await req('POST', '/api/advisor/cards', { studentIds: ['S2001'] }, ben)).status, 403, 'a teacher');
    assert.equal((await req('POST', '/api/advisor/cards', {}, ben)).status, 403);
    assert.equal((await req('POST', '/api/advisor/cards', { studentIds: ['S2001'] }, finn)).status, 403);
    assert.equal((await req('POST', '/api/advisor/cards', {}, (await setup(c2.cards[1].setupUrl, 'gus-pass-456')).cookie)).status, 403, 'a student');
    assert.equal((await req('POST', '/api/advisor/cards', {})).status, 401);
    assert.equal((await req('POST', '/api/admin/cards', { homerooms: ['12B'] }, ada)).status, 403, 'admin route');

    // Admin: per homeroom and staff.
    const g = await json(req('GET', '/api/admin/cards', null, ac));
    assert.deepEqual(g.homerooms.map((r) => [r.name, r.students, r.waiting]), [['12B', 2, 1]]);
    assert.deepEqual(g.staff, { total: 5, waiting: 2 });
    const c3 = await json(req('POST', '/api/admin/cards', { homerooms: ['12B'], staff: true }, ac));
    assert.deepEqual(c3.cards.map((c) => c.name).sort(), ['Dr Dan Ellis', 'Fern Gale', 'Ms Chloe Dumas']);
    assert.ok(!c3.cards.some((c) => c.email === 'pat@example.org'), 'never the admin themself');

    // Rate limit per account.
    let last; for (let i = 0; i < 30; i++) last = await req('POST', '/api/advisor/cards', { studentIds: [] }, ada);
    assert.equal(last.status, 429);

    // Leavers: Gus is not in the next file. The preview lists him; pausing is off unless asked.
    const minus = { ...ROSTER, students: ROSTER.students.filter((s) => s.id !== 'S2002'), enrolments: ROSTER.enrolments.filter((e) => e.studentId !== 'S2002') };
    const dry = await json(req('POST', '/api/admin/roster', { roster: minus, dryRun: true }, ac));
    assert.deepEqual(dry.leavers.map((a) => a.name), ['Gus Hale']);
    assert.deepEqual((await json(req('POST', '/api/admin/roster', { roster: minus }, ac))).paused, []);
    const gus = await json(req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: 'gus-pass-456' }));
    assert.equal(gus.status, 200);
    const p = await json(req('POST', '/api/admin/roster', { roster: minus, pauseLeavers: true }, ac));
    assert.deepEqual(p.paused.map((a) => a.name), ['Gus Hale']);
    assert.ok(p.accounts.find((a) => a.email === 'gus.hale@example.org').paused.at);
    assert.equal((await req('GET', '/api/state', null, gus.cookie)).status, 401, 'sessions ended');
    const refused = await json(req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: 'gus-pass-456' }));
    assert.equal(refused.status, 403); assert.equal(refused.error, 'Your account is paused. Ask your teacher.');
    const st = (await (await req('GET', '/api/state', null, ac)).json()).snapshot.store;
    assert.ok(st.students.some((s) => s.id === 'S2002'), 'the record stays');
    assert.ok(!(await json(req('POST', '/api/admin/cards', { homerooms: ['12B'], includeSignedUp: true }, ac))).cards.some((c) => c.name === 'Gus Hale'), 'no card for a paused account');

    // Unpause by hand, pause again, then a later import that has him unpauses him.
    const id = p.accounts.find((a) => a.email === 'gus.hale@example.org').id;
    assert.equal((await req('POST', `/api/admin/accounts/${id}/unpause`, {}, ada)).status, 403);
    const u = await json(req('POST', `/api/admin/accounts/${id}/unpause`, {}, ac));
    assert.ok(!u.accounts.find((a) => a.id === id).paused);
    assert.equal((await req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: 'gus-pass-456' })).status, 200);
    await json(req('POST', `/api/admin/accounts/${id}/pause`, {}, ac));
    assert.equal((await req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: 'gus-pass-456' })).status, 403);
    const back = await json(req('POST', '/api/admin/roster', { roster: ROSTER, dryRun: true }, ac));
    assert.deepEqual(back.returning.map((a) => a.name), ['Gus Hale']);
    assert.deepEqual((await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac))).unpaused.map((a) => a.name), ['Gus Hale']);
    assert.equal((await req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: 'gus-pass-456' })).status, 200);
    assert.ok(!/setup\/[\w-]{20,}/.test(srv.out().replaceAll(srv.setup, '')), 'no links in the log but the first-run one');
  } finally { srv.p.kill(); }
});
