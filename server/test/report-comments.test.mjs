// Report comment drafts (server/report-comments.mjs, routes/71-report-comments.mjs), against a real pilot server:
// who may write for whom, privacy to the writer, progress counts without text, limits, CSV export and its log line,
// the PDPA copy (admin only) and erasure. Run: npm run test:server.
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

test('report comments: private drafts, permissions, progress counts, limits, CSV, PDPA', async () => {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-rc-'));
  const srv = await start({ PORT: String(port), DATA_DIR: dir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie) => fetch(`${U}${url}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json().catch(() => ({}))), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const put = (cookie, kind, group, sid, body) => json(req('PUT', `/api/report-comments/${kind}/${group}/${sid}`, body, cookie));
  const mine = async (cookie) => (await json(req('GET', '/api/report-comments', null, cookie)));
  const TEXT = 'Fern has grown into a careful scientist this term.';
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie; // teaches 12 Biology (Fern, Gus), advises both
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie; // teaches Fern in 12 CS
    const dan = (await setup(link['dan.ellis@example.org'], 'dan-pass-123')).cookie; // leadership
    const fern = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;

    assert.equal((await json(req('GET', '/api/report-comments'))).status, 401);
    // Who may write for whom.
    const a1 = await put(ada, 'subject', 'C-BIO12', 'S2001', { text: TEXT });
    assert.equal(a1.status, 200); assert.equal(a1.draft.text, TEXT); assert.equal(a1.draft.done, false);
    assert.equal((await put(ada, 'subject', 'C-BIO12', 'S2002', { text: '=SUM(A1) Gus, "steady"', done: true })).status, 200);
    assert.equal((await put(ada, 'advisor', 'T100', 'S2001', { text: 'Advisor words about Fern.' })).status, 200);
    assert.equal((await put(ben, 'subject', 'C-BIO12', 'S2001', { text: 'x' })).status, 403, 'not his class');
    assert.equal((await put(ada, 'subject', 'C-BIO12', 'S2003', { text: 'x' })).status, 403, 'not in the class');
    assert.equal((await put(ada, 'subject', 'C-NOPE', 'S2001', { text: 'x' })).status, 403);
    assert.equal((await put(ada, 'advisor', 'T104', 'S2003', { text: 'x' })).status, 403, "another advisor's advisee");
    assert.equal((await put(ben, 'advisor', 'T101', 'S2001', { text: 'x' })).status, 403, 'not his advisee');
    assert.equal((await put(fern, 'subject', 'C-BIO12', 'S2001', { text: 'x' })).status, 403, 'a student');
    assert.equal((await put(ada, 'nope', 'C-BIO12', 'S2001', { text: 'x' })).status, 400);
    assert.equal((await put(ada, 'subject', 'C-BIO12', 'S2001', { text: 'y'.repeat(4001) })).status, 413);
    assert.equal((await put(ben, 'subject', 'C-CS12', 'S2001', { text: 'Ben on Fern.' })).status, 200);

    // Private to the writer: nobody else's GET, snapshot or progress carries the words.
    assert.deepEqual((await mine(ada)).drafts.map((d) => `${d.kind}|${d.studentId}`).sort(), ['advisor|S2001', 'subject|S2001', 'subject|S2002']);
    assert.deepEqual((await mine(ben)).drafts.map((d) => d.text), ['Ben on Fern.']);
    for (const c of [fern, dan, ac]) assert.deepEqual((await mine(c)).drafts, []);
    for (const c of [fern, ben, dan, ac]) assert.ok(!JSON.stringify(await json(req('GET', '/api/state', null, c))).includes('careful scientist'));
    const prev = await json(req('GET', `/api/admin/preview/${imp.accounts.find((a) => a.email === 'ada.brook@example.org').id}`, null, ac));
    assert.ok(!JSON.stringify(prev).includes('careful scientist'), 'See as never shows drafts');

    // Progress: coordinators, leadership, admins; counts only.
    assert.equal((await json(req('GET', '/api/report-comments/progress', null, ben))).status, 403);
    assert.equal((await json(req('GET', '/api/report-comments/progress', null, fern))).status, 403);
    const pr = await json(req('GET', '/api/report-comments/progress', null, dan));
    assert.equal(pr.status, 200);
    assert.ok(!JSON.stringify(pr).includes('careful scientist') && !JSON.stringify(pr).includes('Ben on Fern'));
    const brook = pr.teachers.find((t) => t.teacherId === 'T100');
    assert.deepEqual(brook.classes.find((c) => c.id === 'C-BIO12'), { id: 'C-BIO12', name: '12 Biology HL', students: 2, drafted: 2, done: 1 });
    assert.deepEqual(brook.advisor, { students: 2, drafted: 1, done: 0 });
    assert.equal(pr.teachers.find((t) => t.teacherId === 'T101').subject.drafted, 1);
    assert.equal((await json(req('GET', '/api/report-comments/progress', null, ac))).status, 200);

    // Done, and clearing a draft removes it.
    assert.equal((await put(ada, 'subject', 'C-BIO12', 'S2001', { text: TEXT, done: true })).draft.done, true);
    assert.equal((await put(ada, 'advisor', 'T100', 'S2001', { text: '  ', done: false })).draft, null);
    assert.equal((await mine(ada)).drafts.length, 2);

    // Limits: admins only.
    assert.deepEqual((await mine(ada)).limits.subject, { words: 150, chars: 1000 });
    assert.equal((await json(req('POST', '/api/admin/report-comments/limits', { kind: 'subject', words: 90, chars: 600 }, dan))).status, 403);
    assert.equal((await json(req('POST', '/api/admin/report-comments/limits', { kind: 'bad', words: 90 }, ac))).status, 400);
    assert.deepEqual((await json(req('POST', '/api/admin/report-comments/limits', { kind: 'subject', words: 90, chars: '' }, ac))).limits.subject, { words: 90, chars: 0 });
    assert.deepEqual((await mine(ben)).limits.subject, { words: 90, chars: 0 });

    // CSV export: the writer's own, every student, formulas defused; one activity-log line without text.
    assert.equal((await req('GET', '/api/report-comments/export?kind=subject&group=C-BIO12', null, ben)).status, 403);
    const r = await req('GET', '/api/report-comments/export?kind=subject&group=C-BIO12', null, ada);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv/);
    const raw = Buffer.from(await r.arrayBuffer());
    assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'a BOM, so Excel reads Thai');
    assert.equal(raw.subarray(3).toString('utf8'), `Student ID,Name,Comment\r\nS2001,Fern Gale,${TEXT}\r\nS2002,Gus Hale,"'=SUM(A1) Gus, ""steady"""\r\n`);
    const adv = await (await req('GET', '/api/report-comments/export?kind=advisor&group=T100', null, ada)).text();
    assert.equal(adv.split('\r\n').length, 4, 'header, two advisees, end');
    const log = fs.readdirSync(dir).filter((f) => /^audit-.*\.jsonl$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
    const ex = log.trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.action === 'report-export');
    assert.equal(ex.length, 2);
    assert.deepEqual([ex[0].target.id, ex[0].target.label, ex[0].detail], ['C-BIO12', '12 Biology HL', { kind: 'subject', rows: 2, written: 2, done: 2 }]);
    assert.ok(!log.includes('careful scientist'));
    assert.ok(log.includes('"report-limits"'));
    const audit = await json(req('GET', '/api/audit?action=report-export', null, ac));
    assert.equal(audit.total, 2);

    // PDPA: an admin's copy includes the drafts about the student; the student's own download does not.
    const zipA = Buffer.from(await (await req('GET', '/api/admin/students/S2001/export', null, ac)).arrayBuffer()).toString('latin1');
    assert.ok(zipA.includes('report-comments.json') && zipA.includes('careful scientist') && zipA.includes('Ben on Fern.'));
    const zipF = Buffer.from(await (await req('GET', '/api/me/export', null, fern)).arrayBuffer()).toString('latin1');
    assert.ok(zipF.includes('student.json') && !zipF.includes('report-comments.json') && !zipF.includes('careful scientist'));
    // Erasure removes every draft about them.
    assert.equal((await json(req('POST', '/api/admin/students/S2002/erase', { confirm: 'Gus Hale' }, ac))).status, 200);
    assert.deepEqual((await mine(ada)).drafts.map((d) => d.studentId), ['S2001']);
    assert.ok(!fs.readFileSync(path.join(dir, 'report-comments.json'), 'utf8').includes('S2002'));
  } finally { srv.p.kill(); }
});
