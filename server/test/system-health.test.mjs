// System health (server/health.mjs, server/routes/69-health.mjs), against a real pilot server with a temporary backups
// folder: admins only, what it reports, the backup age warning, recent errors, sign-in failures, and diagnostics with no
// secrets or personal data. Run: npm run test:server (after npm run build:server).
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
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, LOG_REQUESTS: '0', ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const stop = (p) => new Promise((r) => { p.once('exit', r); p.kill('SIGTERM'); });

test('health.mjs: errors keep 50, without emails or tokens; heartbeats', async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-health-unit-'));
  const H = await import('../health.mjs');
  for (let i = 0; i < 60; i++) H.noteError('GET /api/x', new Error(`boom ${i}`));
  H.noteError('POST /api/action', new Error('bad for pat@example.org with token abcdefABCDEF0123456789xyzXYZ'));
  const e = H.recentErrors();
  assert.equal(e.length, 50);
  assert.equal(e[0].route, 'POST /api/action');
  assert.ok(!e[0].message.includes('pat@example.org') && !e[0].message.includes('abcdefABCDEF'), e[0].message);
  assert.match(e[0].message, /\[email\].*\[token\]/);
  H.beat('demo-job', { every: 1000 });
  H.beat('demo-job', { error: new Error('it broke') });
  const j = H.heartbeats().find((x) => x.name === 'demo-job');
  assert.equal(j.runs, 2); assert.ok(j.lastOk && j.lastError.message === 'it broke' && j.every === 1000);
  assert.ok(H.VERSION.label && (H.VERSION.commit || H.VERSION.package));
});

test('system health: admin only, contents, backup age, errors, sign-ins, diagnostics without secrets', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-health-'));
  const BK = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-health-backups-'));
  const old = path.join(BK, 'transit-pilot-data-20261027-023000.tar.gz');
  fs.writeFileSync(old, Buffer.alloc(4096, 1));
  const three = (Date.now() - 3 * 864e5 - 3600_000) / 1000; fs.utimesSync(old, three, three);
  // From the activity log: an account blocked an hour ago (counted), another 30 hours ago (not).
  const line = (ms, action, id) => JSON.stringify({ at: new Date(Date.now() - ms).toISOString(), actor: { id, name: `Zedrick ${id}`, kind: 'student' }, action, target: {}, result: 'refused', status: 429, ip: '203.0.113.9' }) + '\n';
  for (const [ms, id] of [[3600_000, 'acc-x'], [30 * 3600_000, 'acc-y']]) fs.appendFileSync(path.join(DIR, `audit-${new Date(Date.now() - ms).toISOString().slice(0, 7)}.jsonl`), line(ms, 'sign-in-locked', id));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, BACKUP_DIR: BK, TP_MODE: 'pilot', TP_START: 'empty', GIT_COMMIT: 'abc1234def56' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie, raw) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const json = async (p) => { const r = await p; const j = await r.json().catch(() => ({})); return { status: r.status, ...j, cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const sec = (h, id) => h.sections.find((s) => s.id === id);
  const fact = (s, label) => s.facts.find((f) => f.label === label)?.value;
  try {
    const health = await json(req('GET', '/api/health'));
    assert.equal(health.ok, true); assert.equal(health.version, 'abc1234def56');
    const admin = await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }));
    const ac = admin.cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const setup = async (email, password) => (await json(req('POST', '/api/auth/setup', { token: link[email], password }))).cookie;
    const ben = await setup('ben.carter@example.org', 'ben-pass-123');
    const fern = await setup('fern.gale@example.org', 'fern-pass-123');
    // Admin only.
    assert.equal((await req('GET', '/api/admin/health')).status, 401);
    assert.equal((await req('GET', '/api/admin/health', null, ben)).status, 403);
    assert.equal((await req('GET', '/api/admin/health', null, fern)).status, 403);
    assert.equal((await req('GET', '/api/admin/health?format=diagnostics', null, ben)).status, 403);
    // Wrong passwords.
    for (let i = 0; i < 2; i++) await req('POST', '/api/auth/login', { email: 'gus.hale@example.org', password: `WRONG-PASSWORD-${i}` });
    await req('POST', '/api/auth/login', { email: 'nobody@example.org', password: 'WRONG-PASSWORD-X' });
    // An upload, and a server error (a body that is JSON null).
    const up = await fetch(`${U}/api/upload`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-filename': 'mine.png', cookie: fern }, body: Buffer.alloc(2048, 7) });
    assert.equal(up.status, 201);
    assert.equal((await req('POST', '/api/action', null, ac, 'null')).status, 500);

    const h = await json(req('GET', '/api/admin/health', null, ac));
    assert.equal(h.status, 200);
    assert.deepEqual(h.sections.map((s) => s.id), ['server', 'storage', 'record', 'uploads', 'backup', 'sis', 'jobs', 'errors', 'signin', 'sessions']);
    assert.ok(h.sections.every((s) => ['ok', 'check', 'problem'].includes(s.status) && s.summary));
    assert.equal(h.version.commit, 'abc1234def56');
    assert.ok(h.uptimeS >= 0);
    const b = sec(h, 'backup');
    assert.equal(b.status, 'problem'); assert.match(b.summary, /The newest backup is 3 days old/); assert.match(b.todo, /02:30/);
    assert.equal(fact(b, 'Backups folder'), BK);
    assert.ok(fact(sec(h, 'storage'), 'Data folder') > 0);
    assert.ok(fact(sec(h, 'record'), 'Changes since start') >= 1 && fact(sec(h, 'record'), 'state.json') > 0);
    assert.equal(fact(sec(h, 'uploads'), 'Files'), 1); assert.equal(fact(sec(h, 'uploads'), 'Total size'), 2048);
    assert.equal(sec(h, 'sis').status, 'ok'); assert.match(sec(h, 'sis').summary, /not set up/);
    const err = sec(h, 'errors');
    assert.equal(err.status, 'check'); assert.equal(err.errors[0].route, 'POST /api/action');
    const si = sec(h, 'signin');
    assert.equal(si.status, 'check');
    assert.equal(fact(si, 'Wrong passwords'), 3, JSON.stringify(si.facts)); assert.equal(fact(si, 'Accounts blocked'), 1); assert.match(si.summary, /1 account blocked/);
    assert.equal(fact(sec(h, 'sessions'), 'Active sessions'), 3); assert.equal(fact(sec(h, 'sessions'), 'People'), 3);
    assert.equal(h.overall, 'problem');

    // Diagnostics: a download, no paths, names, emails, ids, addresses, passwords or tokens.
    const d = await req('GET', '/api/admin/health?format=diagnostics', null, ac);
    assert.equal(d.status, 200);
    assert.match(d.headers.get('content-disposition'), /attachment; filename="transit-diagnostics-\d{4}-\d{2}-\d{2}\.json"/);
    const text = await d.text();
    const diag = JSON.parse(text);
    assert.equal(diag.kind, 'transit-diagnostics/1'); assert.equal(diag.sections.length, 10);
    const people = [...ROSTER.teachers, ...ROSTER.students].flatMap((p) => [p.name, p.email, p.id]).filter(Boolean);
    const secrets = [DIR, BK, 'Pat Admin', 'pat@example.org', 'admin-pass-123', 'WRONG-PASSWORD', 'nobody@example.org', ac.split('=')[1], ben.split('=')[1], srv.setup, '127.0.0.1', '::1', '203.0.113.9', 'acc-x', 'Zedrick', ...people, ...Object.values(link)];
    for (const s of secrets) assert.ok(!text.includes(s), `diagnostics hold ${s}`);
    assert.ok(diag.sections.every((s) => s.facts.every((f) => !f.private)));
    const audit = fs.readdirSync(DIR).filter((f) => /^audit-/.test(f)).map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
    assert.match(audit, /"action":"health-diagnostics"/);

    // A fresh backup: OK.
    fs.writeFileSync(path.join(BK, 'transit-pilot-data-20261030-023000.tar.gz'), Buffer.alloc(8192, 1));
    const h2 = await json(req('GET', '/api/admin/health', null, ac));
    assert.equal(sec(h2, 'backup').status, 'ok'); assert.match(sec(h2, 'backup').summary, /minutes? old \(8 KB\)/);
    // A backups folder that is not there: a problem with what to do.
    fs.rmSync(BK, { recursive: true });
    const h3 = await json(req('GET', '/api/admin/health', null, ac));
    assert.equal(sec(h3, 'backup').status, 'problem'); assert.match(sec(h3, 'backup').todo, /BACKUP_DIR/);
  } finally { await stop(srv.p); }
});

test('system health: not in the demo', async () => {
  const port = await freePort();
  const srv = await start({ PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-health-demo-')), TP_MODE: 'demo' });
  try {
    assert.equal((await fetch(`http://localhost:${port}/api/admin/health`)).status, 403);
    assert.ok((await (await fetch(`http://localhost:${port}/api/health`)).json()).version);
  } finally { await stop(srv.p); }
});
