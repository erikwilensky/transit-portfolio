// Report comments on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster. Aaron Torres (Sabc0d6125e85, 8C) has a moment with his own words, endorsed by Mr David Coultas, and a
// moment Mr Coultas spotted. Mr Coultas (T60198) writes report comments for C-392000: Aaron's row shows both moments,
// the checks catch a classmate's name, the draft saves, Mark done counts "1 of N done", Copy and the CSV export work.
// Ms Jane Altemen (T25948) writes Aaron's advisor comment for 8C. Another teacher and Aaron cannot read either draft.
// A coordinator sees counts per teacher, not text; the admin sets a word limit; the export is in the activity log; axe.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Every account has its own browser context.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const SH = os.tmpdir() + '/tp-report-';
const TID = 'T60198', ADV = 'T25948', AARON = 'Sabc0d6125e85', CLASS = 'C-392000', COORD = 'T9057';
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
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`)));
  ok(!v.length, `axe: no serious violations on ${label}${v.length ? ` (${v.join('; ')})` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok = adminTok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) }); if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`); return (await r.json()).result; };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = await state(adminTok);
    const T = (id) => roster.teachers.find((t) => t.id === id);
    const kids = rec.enrolments.filter((n) => n.classId === CLASS && !n.to).map((n) => n.studentId);
    const aaron = rec.students.find((s) => s.id === AARON);
    const mate = rec.students.filter((s) => kids.includes(s.id) && s.id !== AARON && s.name.split(' ')[0] !== 'Aaron').sort((x, y) => x.name.localeCompare(y.name))[0];
    const advisees = rec.students.filter((s) => s.advisorId === ADV);
    ok(kids.includes(AARON) && aaron.advisorId === ADV, `${T(TID).name} teaches ${CLASS} (${kids.length} students) with ${aaron.name}; ${T(ADV).name} advises him (${advisees.length} advisees)`);
    const other = roster.teachers.find((t) => t.email && t.id !== TID && t.id !== ADV && !rec.classes.some((c) => c.teacherIds.includes(t.id) && rec.enrolments.some((n) => n.classId === c.id && n.studentId === AARON)) && t.roles.includes('teacher') && !t.roles.some((r) => ['coordinator', 'leadership', 'counsellor'].includes(r)));
    const tTok = await setupWith(U, links[T(TID).email]), aTok = await setupWith(U, links[T(ADV).email]), oTok = await setupWith(U, links[other.email]);
    const sTok = await setupWith(U, links[aaron.email]), cTok = await setupWith(U, links[T(COORD).email]);

    // ── Aaron's term: a moment in his own words that Mr Coultas endorses, and one Mr Coultas spotted ──
    const ev = await act(sTok, 'addStation', [AARON, { title: 'Density column experiment', lineIds: ['science'], type: 'project', visibility: 'advisor', reflection: 'I learned that salt water is denser than fresh water.', requestFrom: TID }]);
    const rq = (await state(tTok)).requests.find((r) => r.eventId === ev.id);
    await act(tTok, 'endorse', [[rq.id], TID, 'Careful measuring and a clear write-up.']);
    const [sp] = await act(tTok, 'spotMoment', [[AARON], TID, { title: 'Helped a classmate with the microscope', note: 'Patient and clear.', lineId: 'science', classId: CLASS }]);
    await act(sTok, 'acceptSpotted', [sp.id, AARON]);
    await act(sTok, 'addStation', [AARON, { title: 'Joined the football team', lineIds: ['sport'], type: 'sport', visibility: 'advisor' }]);

    // ── Mr Coultas writes for C-392000 ──
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const errs = []; t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.topnav');
    if (!await t.locator('a[href="#/me/reportcomments"]').count()) await t.click('.topnav button[aria-haspopup="menu"]');
    ok(await t.locator('a[href="#/me/reportcomments"]').count() > 0, 'Report comments is in his navigation');
    await t.goto(`${U}/#/me/reportcomments`); await t.waitForSelector('.rc-groups');
    const card = t.locator(`.rc-groups li[data-group="${CLASS}"]`);
    ok((await card.innerText()).includes(`0 of ${kids.length}`), `the class card says 0 of ${kids.length} done`);
    await card.locator('a').click();
    await t.waitForSelector(`.rc-row[data-student="${AARON}"]`);
    ok(await t.locator('.rc-row').count() === kids.length, `one row per student (${kids.length})`);
    const row = t.locator(`.rc-row[data-student="${AARON}"]`);
    const rowText = await row.innerText();
    ok(rowText.includes('Density column experiment') && rowText.includes('salt water is denser') && rowText.includes('Careful measuring'), 'Aaron’s row: the moment, his own words and the endorsement');
    ok(rowText.includes('Helped a classmate with the microscope') && /Spotted by Mr David Coultas/.test(rowText), 'and the moment Mr Coultas spotted');
    ok(!rowText.includes('Joined the football team'), 'a moment on another line is not in the subject view');
    const box = row.locator('textarea');
    await box.fill(`${mate.name.split(' ')[0]} measured carefully this term.`);
    ok(/Mentions/.test(await row.locator('.rc-checks').innerText()) && /first name is not used/.test(await row.locator('.rc-checks').innerText()), `the checks catch ${mate.name.split(' ')[0]}'s name and the missing first name`);
    const TEXT = 'Aaron measured carefully this term and explained his density column clearly. He helped others at the microscope.';
    await box.fill(TEXT);
    const checks = await row.locator('.rc-checks').innerText();
    ok(/Uses Aaron's first name/.test(checks) && !/Mentions/.test(checks), 'with the right name the checks pass');
    ok(/17 \/ 150 words/.test(await row.locator('.rc-count').innerText()), 'counts words against the limit (17 / 150)');
    await row.locator('.rc-state:has-text("Saved")').waitFor({ timeout: 5000 });
    await row.locator('button:has-text("Mark done")').click();
    await t.locator('.rc-prog b:has-text("1 of")').waitFor({ timeout: 5000 });
    ok((await t.locator('.rc-prog b').innerText()) === `1 of ${kids.length} done`, `progress: 1 of ${kids.length} done`);
    await row.locator('button:has-text("Copy")').click();
    ok(await t.evaluate(() => navigator.clipboard.readText()) === TEXT, 'Copy puts the comment on the clipboard');
    const [dl] = await Promise.all([t.waitForEvent('download'), t.click('.rc-csv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(csv.startsWith('﻿Student ID,Name,Comment') && csv.includes(`${AARON},${aaron.name},${TEXT}`) && csv.trim().split('\r\n').length === kids.length + 1, `the CSV: every student, Aaron with his comment (${dl.suggestedFilename()})`);
    await t.screenshot({ path: SH + 'class.png', fullPage: false });
    await axe(t, 'the class page');
    await t.reload(); await t.waitForSelector(`.rc-row[data-student="${AARON}"] textarea:not([disabled])`);
    ok(await t.locator(`.rc-row[data-student="${AARON}"] textarea`).inputValue() === TEXT && await t.locator(`.rc-row[data-student="${AARON}"] button[aria-pressed="true"]`).count() === 1, 'after a reload the draft and Done are kept');

    // ── Ms Altemen writes Aaron's advisor comment ──
    const cA = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(`${U}/#/me/reportcomments`); await a.waitForSelector(`.rc-groups li[data-group="${ADV}"]`);
    ok(/Advisory 8C/.test(await a.locator(`.rc-groups li[data-group="${ADV}"]`).innerText()), 'her list has "Advisory 8C"');
    await a.locator(`.rc-groups li[data-group="${ADV}"] a`).click();
    const arow = a.locator(`.rc-row[data-student="${AARON}"]`); await arow.waitFor();
    const at = await arow.innerText();
    ok(at.includes('Density column experiment') && at.includes('Joined the football team'), 'the advisor view has every line');
    const ATEXT = 'Aaron has settled well into 8C and joined the football team.';
    await arow.locator('textarea').fill(ATEXT);
    await arow.locator('.rc-state:has-text("Saved")').waitFor({ timeout: 5000 });
    await arow.locator('button:has-text("Mark done")').click();
    await a.locator('.rc-prog b:has-text("1 of")').waitFor({ timeout: 5000 });
    ok((await a.locator('.rc-prog b').innerText()) === `1 of ${advisees.length} done`, `advisor progress: 1 of ${advisees.length} done`);
    await axe(a, 'the advisory page');

    // ── Nobody else reads either draft ──
    const mine = async (tok) => (await (await fetch(`${U}/api/report-comments`, { headers: H(tok) })).json()).drafts;
    ok((await mine(oTok)).length === 0 && (await mine(sTok)).length === 0 && (await mine(cTok)).length === 0 && (await mine(adminTok)).length === 0, `${other.name}, Aaron, a coordinator and the admin get no drafts`);
    for (const [who, tok] of [[other.name, oTok], ['Aaron', sTok], ['the coordinator', cTok], ['the admin', adminTok]]) {
      const s = JSON.stringify(await state(tok));
      ok(!s.includes('density column clearly') && !s.includes('settled well into 8C'), `${who}'s record copy has neither draft`);
    }
    const put = (tok, k, g) => fetch(`${U}/api/report-comments/${k}/${g}/${AARON}`, { method: 'PUT', headers: H(tok), body: JSON.stringify({ text: 'x' }) }).then((r) => r.status);
    ok(await put(oTok, 'subject', CLASS) === 403 && await put(oTok, 'advisor', ADV) === 403 && await put(sTok, 'subject', CLASS) === 403 && await put(aTok, 'subject', CLASS) === 403, 'nobody else may write them');
    ok((await fetch(`${U}/api/report-comments/export?kind=subject&group=${CLASS}`, { headers: H(oTok) })).status === 403, 'nor export the class');
    const cS = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await cS.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
    const s = await cS.newPage();
    await s.goto(`${U}/#/me/reportcomments`); await s.waitForTimeout(1500);
    const sBody = await s.locator('body').innerText();
    ok(!sBody.includes('density column clearly') && !sBody.includes('settled well') && await s.locator('.rc').count() === 0, 'Aaron cannot open the screen or see a draft');

    // ── A coordinator: counts per teacher; the admin: the limit ──
    const cC = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cC.addCookies([{ name: 'tp_session', value: cTok, url: U }]);
    const c = await cC.newPage(); c.on('pageerror', (e) => errs.push(e.message));
    await c.goto(`${U}/#/me/reportcomments`); await c.waitForSelector('.rc-ptable');
    await c.check('text=Only those who have started');
    const pt = await c.locator('.rc-ptable').innerText();
    ok(pt.includes(T(TID).name) && pt.includes(T(ADV).name) && await c.locator('.rc-ptable tbody tr').count() === 2, 'progress lists the two who started');
    ok(new RegExp(`Y8 Sciences 08.04 \\(04\\): 1 of ${kids.length} done`).test(await c.locator(`.rc-ptable tr[data-teacher="${TID}"]`).textContent()), `Mr Coultas: C-392000 1 of ${kids.length} done`);
    ok(!(await c.locator('body').innerText()).includes('density column'), 'no comment text on the progress panel');
    await axe(c, 'the progress panel');
    const cAd = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cAd.addCookies([{ name: 'tp_session', value: adminTok, url: U }]);
    const ad = await cAd.newPage(); ad.on('pageerror', (e) => errs.push(e.message));
    await ad.goto(`${U}/#/me/reportcomments`); await ad.waitForSelector('.rc-limits');
    const sub = ad.locator('.rc-limits fieldset').first();
    await sub.locator('label:has-text("Words") input').fill('15');
    await sub.locator('button:has-text("Save")').click();
    await until(async () => (await (await fetch(`${U}/api/report-comments`, { headers: H(tTok) })).json()).limits.subject.words === 15);
    await t.reload(); await t.waitForSelector(`.rc-row[data-student="${AARON}"] textarea:not([disabled])`);
    const r2 = t.locator(`.rc-row[data-student="${AARON}"]`);
    ok(/17 \/ 15 words/.test(await r2.locator('.rc-count').innerText()) && /2 words over the limit of 15/.test(await r2.locator('.rc-checks').innerText()), 'after the admin sets 15 words, Mr Coultas sees 2 over');
    const log = await (await fetch(`${U}/api/audit?action=report-export`, { headers: H() })).json();
    ok(log.total === 1 && log.entries[0].actor.name === T(TID).name && log.entries[0].target.label === 'Y8 Sciences 08.04 (04)', 'the export is in the activity log, by Mr Coultas, for the class');
    ok(!JSON.stringify(log).includes('density column'), 'without the text');
    // Phone width: no sideways scroll on the class page.
    await t.setViewportSize({ width: 390, height: 844 }); await t.waitForTimeout(300);
    ok(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await t.screenshot({ path: SH + 'phone.png' });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('screenshots', SH + 'class.png', SH + 'phone.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv?.p.kill(); }
})();
