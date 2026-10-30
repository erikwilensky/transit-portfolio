// Safeguarding on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and imports the
// real roster. Aaron Torres (Year 8, Simple level, phone) adds a moment with a photo and asks Mr David Coultas to check it;
// a parent joins through the family letter and sees it; Mr Coultas reports it from My classes; a coordinator opens Reports
// and hides it; Aaron sees the notice (bell and moment); the parent no longer sees it. Each person has their own browser
// context (cookie jar). TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-safe-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-safe-';
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198'; // Aaron Torres, Mr David Coultas
const TITLE = 'Bridge model test';
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

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-safe-data-'));
  srv = await start(port, dataDir);
  const full = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), coultas = person(TEACHER), advisor = person(aaron.advisorId);
    const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && !t.roles.includes('leadership') && links[t.email] && t.id !== TEACHER);
    const cls = roster.classes.find((c) => c.teacherIds.includes(TEACHER) && roster.enrolments.some((n) => n.classId === c.id && n.studentId === STUDENT));
    ok(!!coord && !!cls, `${aaron.name} (Year ${aaron.year}); ${coultas.name} teaches him ${cls?.name}; coordinator ${coord?.name}`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]);
    const cTok = await setupWith(U, links[coord.email]), aTok = await setupWith(U, links[advisor.email]);
    const ctx = async (tok, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } });
      if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
    };

    // ── Aaron, on a phone at Simple level: a moment with a photo, asks Mr Coultas to check it ──
    const s = await ctx(sTok, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    for (const l of ['Science', 'Sport']) { const btn = s.locator('.ob-pick', { hasText: l }).first(); if (!(await btn.getAttribute('aria-pressed') === 'true')) await btn.click(); }
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    await s.click('.sh-card.add');
    await s.fill('.sh-flow .sh-input', TITLE);
    const png = await s.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
    await s.setInputFiles('.sh-photo-btn:not(.cam) input', { name: 'bridge.png', mimeType: 'image/png', buffer: png });
    await s.waitForSelector('.sh-preview img');
    const src = await s.locator('.sh-preview img').getAttribute('src');
    await s.click('.sh-flow .sh-next .primary');
    await s.click('.sh-flow .sh-lines button:has-text("Science")');
    await s.click('.sh-flow .sh-next .primary');
    if (!(await s.locator('.sh-flow .sh-ask', { hasText: coultas.name }).count())) await s.click('.sh-flow .sh-ask.other:has-text("Someone else")');
    await s.locator('.sh-flow .sh-ask', { hasText: coultas.name }).first().click();
    const ev = await until(() => full().events.find((e) => e.studentId === STUDENT && e.title === TITLE));
    ok(!!ev && ev.evidence[0]?.url === src && /^api\/files\//.test(src), `the moment is saved with the uploaded photo (${src})`);
    ok((await fetch(`${U}/${src}`, { headers: H(sTok) })).status === 200 && (await fetch(`${U}/${src}`)).status === 404, 'the photo file is served to Aaron, not signed out');

    // ── A parent joins through the family letter and sees the moment ──
    const lt = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: H(aTok), body: JSON.stringify({ studentIds: [STUDENT] }) })).json();
    const p = await ctx(null);
    await p.goto(lt.letters[0].url.replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('form.auth-card');
    await p.fill('input[autocomplete="name"]', 'Maria Torres'); await p.fill('input[type="email"]', 'maria.torres@family.example');
    await p.fill('input[autocomplete="new-password"] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete="new-password"] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type="submit"]');
    await p.waitForSelector('.page.family'); await p.waitForTimeout(600);
    ok((await p.locator('.page.family').innerText()).includes(TITLE), 'the parent (joined by the family letter) sees the moment');
    const pTok = (await p.context().cookies()).find((c) => c.name === 'tp_session').value;
    await p.locator('.page.family .pv-intro li button', { hasText: TITLE }).first().click(); await p.waitForTimeout(400);
    ok(await p.locator('.sg-report').count() === 0, 'families have no Report button (since 30 October 2026: they speak to the school by email)');
    ok((await act(pTok, 'reportItem', [{ eventId: ev.id }, 'other', '', { key: `fam:${STUDENT}`, name: 'Maria Torres' }])).status === 403, 'and reporting from a family account is refused (403)');
    await p.keyboard.press('Escape');

    // ── Mr Coultas reports it from My classes ──
    const t = await ctx(tTok);
    await t.goto(`${U}/#/me/classes/${cls.id}~${STUDENT}`); await t.waitForSelector('.mc-read');
    await t.locator(`.metro .station[aria-label^="${TITLE}"]`).first().click();
    await t.waitForSelector('.station-panel.open .sg-report');
    ok(!(await t.locator('.topnav').innerText()).includes('Reports'), 'a teacher has no Reports screen');
    await t.click('.station-panel.open .sg-report');
    await t.click('.sg-dialog .sg-reasons button:has-text("Personal information shown")');
    await t.fill('.sg-dialog textarea', 'The photo shows a home address.');
    await t.screenshot({ path: SH + 'report-dialog.png' });
    await t.click('.sg-dialog .primary');
    const rep = await until(() => (full().reports || []).find((r) => r.eventId === ev.id));
    ok(rep?.from?.key === TEACHER && rep.from.name === coultas.name && rep.reason === 'personal', 'the report is saved with the reporter (server side)');
    ok(await t.locator('.station-panel.open .sg-sent').count() === 1, 'he sees "Reported"');
    ok(full().notifications.some((n) => n.to === 'role:coordinator' && n.go?.param === rep.id && !n.text.includes('Coultas')), 'coordinators are notified, without the reporter’s name');
    ok((await act(tTok, 'moderateReport', [rep.id, 'hide', '', TEACHER])).status === 403, 'a teacher cannot moderate (403)');
    const tr = (await state(tTok)).reports || [];
    ok(tr.length === 1 && !tr[0].from.name && !tr[0].note, 'his copy holds only his own report, without names or notes');
    const sr = await state(sTok);
    ok(!(sr.reports || []).length && !JSON.stringify(sr.reports || []).includes('home address'), 'Aaron’s copy holds no report');

    // ── A coordinator opens Reports and hides it ──
    const c = await ctx(cTok);
    await c.goto(`${U}/#/me`); await c.waitForSelector('.topnav');
    const navLink = c.locator('.topnav a:visible', { hasText: /^Reports$/ });
    if (!(await navLink.count())) await c.locator('.topnav button:visible', { hasText: 'More' }).first().click();
    await c.locator('.topnav a:visible', { hasText: /^Reports$/ }).first().click();
    await c.waitForSelector('.sg-card');
    const cardText = await c.locator('.sg-card').first().innerText();
    ok(cardText.includes(TITLE) && cardText.includes(aaron.name) && cardText.includes(coultas.name) && cardText.includes('Personal information shown') && cardText.includes('home address'), 'the card: moment, student, reporter, reason and note');
    ok(await c.locator('.sg-card .sg-item img').getAttribute('src') === src, 'with the photo thumbnail');
    await c.screenshot({ path: SH + 'queue.png' });
    await c.fill('.sg-card textarea', 'Talking to Aaron about it.');
    await c.click('.sg-card button:has-text("Hide from everyone but the student and staff")');
    const hid = await until(() => full().events.find((e) => e.id === ev.id)?.hidden);
    ok(!!hid && hid.by === coord.name, `hidden by ${coord.name}`);
    ok(full().reports.find((r) => r.id === rep.id).history[0]?.note === 'Talking to Aaron about it.', 'the note is kept in the history');
    await c.click('.sg-tabs button:has-text("Done")'); await c.waitForSelector('.sg-card .sg-history');
    await c.screenshot({ path: SH + 'done.png' });

    // ── Aaron sees the notice ──
    ok(full().notifications.some((n) => n.to === `st:${STUDENT}` && n.text === `A teacher has hidden “${TITLE}” while they look at it.`), 'Aaron is notified: "A teacher has hidden … while they look at it."');
    await s.reload(); await s.waitForSelector('.sh-feed');
    await s.locator('.sh-feed li', { hasText: TITLE }).locator('button').first().click();
    await s.waitForSelector('.sh-moment .sg-hidden');
    ok((await s.locator('.sh-moment .sg-hidden').innerText()).includes('A teacher has hidden this moment'), 'his moment says a teacher has hidden it');
    await s.screenshot({ path: SH + 'student.png' });
    await s.click('.sh-moment .panel-close');
    await s.click('button.bell'); await s.waitForSelector('.bell-menu');
    ok((await s.locator('.bell-menu').innerText()).includes(`A teacher has hidden “${TITLE}” while they look at it.`), 'and in his bell');
    await s.screenshot({ path: SH + 'student-bell.png' });
    await s.click('button.bell');

    // ── The parent no longer sees it ──
    await p.reload(); await p.waitForSelector('.page.family'); await p.waitForTimeout(600);
    ok(!(await p.locator('.page.family').innerText()).includes(TITLE), 'the family view no longer shows it');
    const ps = await state(pTok);
    ok(!ps.events.some((e) => e.id === ev.id) && !JSON.stringify(ps).includes(TITLE), 'nor does the parent’s copy of the record');
    ok((await act(pTok, 'reportItem', [{ eventId: ev.id }, 'other', '', { key: `fam:${STUDENT}`, name: 'Maria Torres' }])).status === 403, 'nor after it is hidden (403)');
    await p.screenshot({ path: SH + 'family.png' });
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
