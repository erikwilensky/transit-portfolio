// My classes and subjects on lines, on the school's real class lists (names altered; read from the project
// files, never copied into the repo). Starts its own clean pilot server (needs `npm run build` first), imports
// the roster, signs in as the real teacher with the most classes, opens My classes, a class and a student,
// then as a coordinator puts Mathematics on a line and checks the teacher of a Maths class sees it.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-myclasses-';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
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

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP the real roster is not here:', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, fs.mkdtempSync(SH + 'data-'));
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const imp = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    const links = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    ok(imp.newAccounts.created.length > 1000, `real roster imported (${imp.summary.added.classes} classes, ${imp.newAccounts.created.length} accounts)`);
    const state = async (h = H) => (await (await fetch(`${U}/api/state`, { headers: h })).json()).snapshot.store;
    const full = await state();
    const act = (fn, args, h = H) => fetch(`${U}/api/action`, { method: 'POST', headers: h, body: JSON.stringify({ fn, args, rec: [] }) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

    // The real teacher (kind teacher, roles only "teacher") with the most classes.
    const count = (tid) => full.classes.filter((c) => c.teacherIds.includes(tid)).length;
    const t = roster.teachers.filter((x) => x.email && x.roles.length === 1 && x.roles[0] === 'teacher').sort((x, y) => count(y.id) - count(x.id))[0];
    const mine = full.classes.filter((c) => c.teacherIds.includes(t.id));
    const withLine = mine.find((c) => c.lineId && full.enrolments.some((e) => e.classId === c.id));
    // A real station and endorsement request from one of their students, on that class's line.
    const kid = full.enrolments.find((e) => e.classId === withLine.id).studentId;
    const ev = await act('addStation', [kid, { title: 'Class check station', lineIds: [withLine.lineId], visibility: 'school', requestFrom: t.id }]);
    ok(ev.status === 200, 'a student station with an endorsement request to the teacher');

    const tTok = await setupWith(U, links[t.email]);
    const cT = await ctxOf(tTok); const p = await cT.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${U}/#/me/queue`); await p.waitForSelector('.topnav');
    ok(await p.locator('.topnav >> text=My classes').count() > 0, `${t.name} (${mine.length} classes) has "My classes" in the nav`);
    const t0 = Date.now();
    await p.goto(`${U}/#/me/classes`); await p.waitForSelector('.mc-list li');
    const shown = await p.locator('.mc-list li').count();
    ok(shown === mine.length, `My classes lists ${shown} of ${mine.length} classes in ${Date.now() - t0} ms`);
    const row = p.locator('.mc-list li', { hasText: withLine.name });
    const rowText = await row.innerText();
    const kids = full.enrolments.filter((e) => e.classId === withLine.id && !e.to).length;
    ok(rowText.includes(`Year ${withLine.year}`) && new RegExp(`\\b${kids}\\s+students`).test(rowText) && /\b1\s+moment, 30 days/.test(rowText), `class row: Year, ${kids} students, 1 moment (${rowText.replace(/\s+/g, ' ')})`);
    const unlinked = mine.find((c) => !c.lineId);
    if (unlinked) ok(/Not on a line yet/.test(await p.locator('.mc-list li', { hasText: unlinked.name }).innerText()), `"Not on a line yet" on ${unlinked.name}`);
    ok(/^1\b/.test(await p.locator('.mc-wait').innerText()), '"Waiting for you" counts the request');
    await p.screenshot({ path: SH + 'list.png', fullPage: true });

    await row.locator('a').click(); await p.waitForSelector('.mc-table');
    ok(await p.locator('.mc-table tbody tr').count() === kids, `class page lists its ${kids} students`);
    const kidRow = p.locator('.mc-table tbody tr', { hasText: 'Class check station' });
    ok(await kidRow.count() === 1 && /1 request/.test(await kidRow.innerText()), 'the student shows their last moment on the line and the request');
    await p.screenshot({ path: SH + 'class.png', fullPage: true });
    await kidRow.locator('td a').first().click(); await p.waitForSelector('.mc-read .as-map svg, .mc-read .empty-state');
    ok(await p.locator('.mc-read .as-map').count() === 1, 'the student’s map opens, read only');
    await p.click('.mc-read .cb-back'); await p.waitForSelector('.mc-table');
    await p.click('.mc-wait'); await p.waitForSelector('.queue');
    ok(/\/queue$/.test(p.url()), '"Waiting for you" opens the Endorsements queue');
    ok(!errs.length, `no page errors (${errs.join(' | ')})`);
    ok((await act('setSubjectLine', ['Mathematics', 'science'], { ...H, cookie: `tp_session=${tTok}` })).status === 403, 'a teacher may not put a subject on a line');
    await cT.close();

    // ── A coordinator puts Mathematics on a line ──
    const co = roster.teachers.find((x) => x.email && x.roles.includes('coordinator'));
    const cC = await ctxOf(await setupWith(U, links[co.email])); const c = await cC.newPage();
    await c.goto(`${U}/#/me/governance`); await c.waitForSelector('.sl-table');
    const maths = full.classes.filter((x) => x.subject === 'Mathematics');
    const mRow = c.locator('.sl-table tr', { has: c.locator('select[aria-label="Line for Mathematics"]') });
    ok(new RegExp(`\\b${maths.length}\\b`).test(await mRow.innerText()), `Subjects and lines: Mathematics with ${maths.length} classes`);
    const before = await c.locator('.sl-table tbody tr').count();
    await c.selectOption('select[aria-label="Line for Mathematics"]', 'science');
    await c.waitForTimeout(1500);
    const after = await state();
    ok(after.classes.filter((x) => x.subject === 'Mathematics').every((x) => x.lineId === 'science') && after.subjectLines.Mathematics === 'science', 'every Mathematics class is on Science, and the choice is kept');
    ok(await c.locator('.sl-table tbody tr').count() === before, 'Mathematics stays listed, so it can be changed');
    await c.screenshot({ path: SH + 'subjects.png', fullPage: true });
    await cC.close();
    const re = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok((await state()).classes.filter((x) => x.subject === 'Mathematics').every((x) => x.lineId === 'science') && !re.summary.unmatchedClasses.some((x) => x.subject === 'Mathematics'), 're-import keeps Mathematics on Science');

    // The teacher of a Maths class now sees it on the Science line.
    const mt = roster.teachers.find((x) => x.email && maths.some((m) => m.teacherIds.includes(x.id)) && x.roles.every((r) => r === 'teacher' || r === 'advisor'));
    const cM = await ctxOf(await setupWith(U, links[mt.email])); const m = await cM.newPage();
    await m.goto(`${U}/#/me/classes`); await m.waitForSelector('.mc-list li');
    const mClass = maths.find((x) => x.teacherIds.includes(mt.id));
    ok(/Science/.test(await m.locator('.mc-list li', { hasText: mClass.name }).first().innerText()), `${mt.name} sees ${mClass.name} on Science`);
    await cM.close();
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
