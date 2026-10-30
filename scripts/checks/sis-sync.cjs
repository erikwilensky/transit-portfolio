// Class list sync from the SIS, in the browser. A mock SIS on localhost serves the real roster (read at runtime, never
// copied into the repo), then a modified copy (held in memory only). A clean pilot (TP_START=empty; needs `npm run build`
// first) points at it. The admin presses Check now on Accounts › Class list sync, reads the change report and applies it:
// first the whole school, then the changes (a homeroom, an advisor handover, two leavers, a new student, a renamed class,
// a class place ended), pausing the leavers' accounts. A feed with more than 10% of students gone is refused; a report is
// dismissed; a bad token shows the error. The token never reaches the page, its API answers or the data folder.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-sis-';
const TOKEN = 'sis-check-token-91c2e7';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port, dataDir, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0', SIS_SYNC_AT: 'off', ...env } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server exited ${c}: ${out}`)); });
  });
}
const setupWith = async (U, token, extra = {}) => {
  const r = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: 'pilot-pass-123', ...extra }) });
  if (!r.ok) throw new Error(`setup ${r.status}`);
  return r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
};

let srv, srv2, sis;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  let feed = JSON.stringify(roster);
  sis = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) { res.writeHead(401); return res.end(); }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(feed);
  }).listen(0);
  const SIS = `http://localhost:${sis.address().port}/v1/class-lists`;
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir, { SIS_URL: SIS, SIS_TOKEN: TOKEN });
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const stateOf = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    const ca = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
    await ca.addCookies([{ name: 'tp_session', value: adminTok, url: U }]);
    const ad = await ca.newPage(); const errs = []; const bodies = [];
    ad.on('pageerror', (e) => errs.push(e.message));
    ad.on('response', async (r) => { if (r.url().includes('/api/')) try { bodies.push(await r.text()); } catch { /* streamed */ } });
    await ad.goto(`${U}/#/me/accounts`); await ad.waitForSelector('.sis');
    ok(/Not checked yet/.test(await ad.locator('.sis-status').innerText()), 'Class list sync: set up, not checked yet');

    // ── First check: the whole school ──
    await ad.click('.sis button:has-text("Check now")'); await ad.waitForSelector('.sis-report');
    const counts = await ad.locator('.sis-report .acc-counts').innerText();
    ok(new RegExp(`Students\\s+${roster.students.length}\\s+${roster.students.length}`).test(counts) && new RegExp(`Staff\\s+${roster.teachers.length}\\s+${roster.teachers.length}`).test(counts), `report: every student and staff member is new (${roster.students.length}, ${roster.teachers.length})`);
    ok(/Connected/.test(await ad.locator('.sis-status').innerText()), 'status: Connected, last checked just now');
    ok((await stateOf()).students.length === 0, 'nothing applied by the check');
    await ad.screenshot({ path: SH + 'first.png', fullPage: false });
    let t0 = Date.now();
    await ad.click('.sis button:has-text("Apply these changes")'); await ad.waitForSelector('.sis .acc-ok', { timeout: 30000 });
    ok((await stateOf()).students.length === roster.students.length, `applied: ${roster.students.length} students in the record (${Date.now() - t0} ms)`);
    ok(await ad.locator('.sis button:has-text("Download sign-in links")').count() === 1, 'setup links to download, as with a file import');
    ok(/Applied by Pat Admin/.test(await ad.locator('.sis-history').textContent()), 'history: applied by the admin');

    // ── The modified copy ──
    const next = structuredClone(roster);
    const advisors = [...new Set(next.students.map((s) => s.advisorId))];
    const mover = next.students.find((s) => s.email && s.year < 12);
    const moved = next.students.find((s) => s.email && s.id !== mover.id && s.homeroom !== mover.homeroom);
    const newAdv = advisors.find((a) => a !== moved.advisorId);
    const leavers = next.students.filter((s) => s.email && s.id !== mover.id && s.id !== moved.id).slice(0, 2);
    const oldHome = mover.homeroom; mover.homeroom = `${mover.year}Z`;
    const oldAdvName = next.teachers.find((t) => t.id === moved.advisorId).name, newAdvName = next.teachers.find((t) => t.id === newAdv).name;
    moved.advisorId = newAdv;
    const gone = new Set(leavers.map((s) => s.id));
    next.students = next.students.filter((s) => !gone.has(s.id));
    next.enrolments = next.enrolments.filter((e) => !gone.has(e.studentId));
    next.students.push({ id: 'SIS-CHECK-1', name: 'Nara Testwong', year: 7, programme: 'MYP', homeroom: '7A', advisorId: advisors[0] });
    const cls = next.classes[0]; const oldClass = cls.name; cls.name = `${cls.name} (new name)`;
    const endIdx = next.enrolments.findIndex((e) => e.studentId === mover.id); const ended = next.enrolments[endIdx]; next.enrolments.splice(endIdx, 1);
    feed = JSON.stringify(next);
    await ad.click('.sis button:has-text("Check now")'); await ad.waitForSelector('.sis-report h3');
    const rep = await ad.locator('.sis-report').innerText();
    ok(rep.includes(`Homeroom ${oldHome} → ${mover.homeroom}`), `changed: ${mover.name}, homeroom ${oldHome} → ${mover.homeroom}`);
    ok(rep.includes(`Advisor ${oldAdvName} → ${newAdvName}`), `changed: ${moved.name}, advisor ${oldAdvName} → ${newAdvName}`);
    ok(rep.includes('Nara Testwong') && /New students: 1 student/.test(rep), 'new: 1 student');
    ok(/Leaving: students no longer in the feed: 2 students/.test(rep) && leavers.every((s) => rep.includes(s.name)), 'leaving: the 2 students by name');
    ok(rep.includes(`${oldClass} → ${cls.name}`), 'changed: the renamed class');
    ok(/Advisor handovers: 1 student/.test(rep) && rep.includes(`${oldAdvName} → ${newAdvName}`), 'advisor handovers: 1 student, old → new');
    ok(/Leaving a class \(kept as history\): \d+ class place/.test(rep), 'class places that end are listed');
    await ad.screenshot({ path: SH + 'changes.png', fullPage: true });
    await ad.check('.sis .acc-check input');
    await ad.click('.sis button:has-text("Apply these changes")'); await ad.waitForSelector('.sis .acc-ok', { timeout: 30000 });
    const st = await stateOf();
    ok(st.students.find((s) => s.id === mover.id).homeroom === mover.homeroom && st.students.find((s) => s.id === moved.id).advisorId === newAdv && st.students.some((s) => s.id === 'SIS-CHECK-1'), 'applied: homeroom, advisor and the new student are in the record');
    ok(st.handovers.some((h) => h.studentId === moved.id && h.to === newAdv), 'the year handover logic noted the advisor change');
    ok(st.enrolments.find((e) => e.studentId === ended.studentId && e.classId === ended.classId).to, 'the ended class place stays as history');
    ok(st.students.filter((s) => gone.has(s.id)).length === 2, 'leavers stay in the record');
    const accts = (await (await fetch(`${U}/api/admin/accounts`, { headers: H })).json()).accounts;
    ok(leavers.every((s) => accts.find((a) => a.studentId === s.id)?.paused), 'the leavers’ accounts are paused');
    ok(/Paused 2 accounts/.test(await ad.locator('.sis .acc-ok').innerText()), 'the panel says 2 accounts were paused');

    // ── More than 10% of students gone: refused ──
    const drop = structuredClone(next);
    const cut = new Set(drop.students.slice(0, Math.ceil(drop.students.length * 0.15)).map((s) => s.id));
    drop.students = drop.students.filter((s) => !cut.has(s.id)); drop.enrolments = drop.enrolments.filter((e) => !cut.has(e.studentId));
    feed = JSON.stringify(drop);
    await ad.click('.sis button:has-text("Check now")'); await ad.waitForSelector('.sis-refused');
    ok(/more than 10%/.test(await ad.locator('.sis-refused').innerText()) && await ad.locator('.sis button:has-text("Apply these changes")').count() === 0, `a ${cut.size}-student drop is refused: no Apply button`);
    ok((await stateOf()).students.length === st.students.length, 'nothing changed');
    await ad.screenshot({ path: SH + 'refused.png', fullPage: false });

    // ── Dismiss ──
    const small = structuredClone(next); small.students.find((s) => s.id === 'SIS-CHECK-1').homeroom = '7B';
    feed = JSON.stringify(small);
    await ad.click('.sis button:has-text("Check now")'); await ad.waitForSelector('.sis button:has-text("Dismiss")');
    await ad.click('.sis button:has-text("Dismiss")'); await ad.waitForSelector('.sis button:has-text("Dismiss")', { state: 'detached' });
    await ad.click('.sis-history summary');
    const hist = await ad.locator('.sis-history').innerText();
    ok(/Dismissed by Pat Admin/.test(hist) && /Not applied: too many students left/.test(hist) && (hist.match(/Applied by Pat Admin/g) || []).length === 2, 'history: 2 applied, 1 refused, 1 dismissed, with who');
    ok((await stateOf()).students.find((s) => s.id === 'SIS-CHECK-1').homeroom === '7A', 'a dismissed report changes nothing');
    await ad.screenshot({ path: SH + 'history.png', fullPage: false });

    // ── Activity log, and the token is nowhere ──
    const log = (await (await fetch(`${U}/api/audit?size=500`, { headers: H })).json()).entries;
    ok(log.filter((e) => e.action === 'sis-fetch').length === 4 && log.filter((e) => e.action === 'sis-apply').length === 2 && log.filter((e) => e.action === 'sis-dismiss').length === 1, 'activity log: 4 fetches, 2 applies, 1 dismiss');
    const html = await ad.content();
    const files = fs.readdirSync(dataDir).filter((f) => /\.(json|jsonl|log)$/.test(f)).map((f) => fs.readFileSync(path.join(dataDir, f), 'utf8')).join('');
    ok(![html, ...bodies, files].some((x) => x.includes(TOKEN)) && !bodies.some((x) => x.includes(SIS)), `the token is not in the page, ${bodies.length} API answers or the data folder`);
    ok(!errs.length, `no page errors ${errs.join(' | ')}`);

    // ── A bad token: the error shows ──
    const port2 = await freePort(); const U2 = `http://localhost:${port2}`;
    srv2 = await start(port2, fs.mkdtempSync(SH + 'data2-'), { SIS_URL: SIS, SIS_TOKEN: 'not-the-token' });
    const tok2 = await setupWith(U2, srv2.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const cb = await b.newContext({ viewport: { width: 1300, height: 900 } }); await cb.addCookies([{ name: 'tp_session', value: tok2, url: U2 }]);
    const p2 = await cb.newPage(); await p2.goto(`${U2}/#/me/accounts`); await p2.waitForSelector('.sis');
    await p2.click('.sis button:has-text("Check now")'); await p2.waitForSelector('.sis .auth-err');
    const t2 = await p2.locator('.sis').innerText();
    ok(/Not connected/.test(t2) && /refused the token \(HTTP 401\)/.test(t2) && !/Apply these changes/.test(t2), 'bad token: Not connected, last error, nothing to apply');
    await p2.screenshot({ path: SH + 'bad-token.png', fullPage: false });
  } catch (e) { console.log('FAIL', e.stack || e); process.exitCode = 1; }
  finally { await b.close(); srv?.p.kill(); srv2?.p.kill(); sis?.close(); }
})();
