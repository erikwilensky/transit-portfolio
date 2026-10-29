// Activity log on the school's real class lists: starts its own clean pilot server (needs `npm run build` first),
// imports the roster, then a student adds moments and a reflection, their advisor writes a note, a subject teacher is
// refused a change, someone mistypes a password, and the admin uses See as. Checks the log as leadership (nav, rows,
// filters by person, student, action, result and date, paging, CSV of the filtered set, no secrets on the page, phone
// width, brand), as the admin (See as start and stop appear), and that a subject teacher has no nav item and gets 403.
// Each account has its own browser context. ROSTER=<path> picks the file; without it the check is skipped.
// Screenshots go to SCRATCH (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-activity-log-'));
const DATA = path.join(SCRATCH, 'data');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: DATA, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const advisor = roster.teachers.find((t) => t.email && t.roles.includes('advisor') && roster.students.some((s) => s.advisorId === t.id && s.email));
  const stu = roster.students.find((s) => s.advisorId === advisor.id && s.email);
  const lead = roster.teachers.find((t) => t.roles.includes('leadership') && t.email);
  const teachesStu = new Set(roster.classes.filter((c) => roster.enrolments.some((e) => e.classId === c.id && e.studentId === stu.id)).flatMap((c) => c.teacherIds));
  const teacher = roster.teachers.find((t) => t.roles.length === 1 && t.roles[0] === 'teacher' && t.email && !teachesStu.has(t.id));
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port);
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json().catch(() => ({})) }; };
  const get = (url, tok) => fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} });
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 900 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  const SECRETS = ['SECRET-REFLECTION-71', 'SECRET-NOTE-72', 'pilot-pass-123', 'WRONG-PASS-73'];
  try {
    ok(advisor && stu && lead && teacher, `advisor ${advisor?.name}, student ${stu?.name}, leadership, and a teacher who does not teach them`);
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(imp.newAccounts?.created?.length > 1000, `real roster imported: ${imp.newAccounts?.created?.length} accounts`);
    const linkOf = (email) => imp.newAccounts.created.find((a) => a.email === email).setupUrl.split('/setup/')[1];
    const setup = async (email) => cookieOf((await post('/api/auth/setup', { token: linkOf(email), password: 'pilot-pass-123' })).r);
    const stuTok = await setup(stu.email), advTok = await setup(advisor.email), leadTok = await setup(lead.email), teachTok = await setup(teacher.email);

    // ── What happens ──
    let ev;
    for (let i = 0; i < 60; i++) { const a = await post('/api/action', { fn: 'addStation', args: [stu.id, { title: `Moment ${i}`, lineIds: ['science'] }] }, stuTok); if (a.r.status !== 200) ok(false, `addStation ${a.r.status}`); ev ||= a.j.result.id; }
    ok((await post('/api/action', { fn: 'addReflection', args: [{ studentId: stu.id, eventId: ev, prompt: 'p', text: SECRETS[0] }] }, stuTok)).r.status === 200, 'student reflection');
    ok((await post('/api/action', { fn: 'addNote', args: [stu.id, SECRETS[1]] }, advTok)).r.status === 200, 'advisor note');
    ok((await post('/api/action', { fn: 'addNote', args: [stu.id, SECRETS[1]] }, teachTok)).r.status === 403, 'a teacher who does not teach them is refused');
    ok((await post('/api/auth/login', { email: stu.email, password: SECRETS[3] })).r.status === 401, 'a mistyped password');

    // ── Teacher: no nav, 403 ──
    ok((await get('/api/audit', teachTok)).status === 403 && (await get('/api/audit?format=csv', teachTok)).status === 403, 'a teacher gets 403');
    ok((await get('/api/audit', stuTok)).status === 403 && (await get('/api/audit', advTok)).status === 403, 'a student and an advisor get 403');
    const cT = await ctxOf(teachTok); const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me`); await t.waitForSelector('.navbar');
    ok(!(await t.locator('.nav-measure').textContent()).includes('Activity log'), 'teacher: no Activity log in the nav');
    await t.goto(`${U}/#/me/activitylog`); await t.waitForTimeout(500);
    ok(!(await t.locator('.al-table').count()), 'teacher: the address does not open it');

    // ── Admin: See as, then the log shows it ──
    const cA = await ctxOf(adminTok); const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(`${U}/#/me`); await a.waitForSelector('.navbar');
    ok((await a.locator('.nav-measure').textContent()).includes('Activity log'), 'admin: Activity log in the nav');
    const accs = await (await get('/api/admin/accounts', adminTok)).json();
    const stuAcc = accs.accounts.find((x) => x.email === stu.email);
    await a.goto(`${U}/#/preview/${stuAcc.id}`); await a.waitForSelector('.pv-bar');
    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');
    await a.goto(`${U}/#/me/activitylog`); await a.waitForSelector('.al-table');
    await a.selectOption('.al-filters select >> nth=0', 'see-as-stop'); await a.waitForTimeout(600);
    const seeRows = await a.locator('.al-table tbody tr').allInnerTexts();
    ok(seeRows.length === 1 && seeRows[0].includes('Pat Admin') && seeRows[0].includes(stu.name), `admin: See as stop is in the log (${seeRows.length})`);
    await a.selectOption('.al-filters select >> nth=0', 'see-as-start'); await a.waitForTimeout(600);
    ok(await a.locator('.al-table tbody tr').count() === 1, 'admin: See as start is in the log');

    // ── Leadership: the screen ──
    const cL = await ctxOf(leadTok); const p = await cL.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${U}/#/me`); await p.waitForSelector('.navbar');
    ok((await p.locator('.nav-measure').textContent()).includes('Activity log'), 'leadership: Activity log in the nav');
    await p.goto(`${U}/#/me/activitylog`); await p.waitForSelector('.al-table');
    const total = await (await get('/api/audit?size=1', leadTok)).json();
    ok(total.total >= 70 && await p.locator('.al-table tbody tr').count() === 50, `first page: 50 of ${total.total} entries`);
    ok(/page 1 of \d+/.test(await p.locator('.al-count').innerText()), 'paging shown');
    const first = await p.locator('.al-table tbody tr').first().innerText();
    await p.click('.al-pages button:has-text("Older")'); await p.waitForTimeout(500);
    ok(/page 2 of/.test(await p.locator('.al-count').innerText()) && (await p.locator('.al-table tbody tr').first().innerText()) !== first, 'Older shows page 2');
    const text = await p.locator('main').innerText();
    ok(!SECRETS.some((s) => text.includes(s)) && !text.includes(linkOf(stu.email)), 'no passwords, links or written text on the page');
    // Filters.
    await p.fill('.al-filters input >> nth=1', stu.name); await p.waitForTimeout(800);
    const stuRows = await p.locator('.al-table tbody tr').allInnerTexts();
    ok(stuRows.length === 50 && stuRows.every((r) => r.includes(stu.name)), `student filter: every row is about ${stu.name}`);
    await p.selectOption('.al-filters select >> nth=1', 'refused'); await p.waitForTimeout(600);
    const ref = await p.locator('.al-table tbody tr').allInnerTexts();
    ok(ref.length === 1 && ref[0].includes(teacher.name) && ref[0].includes('Refused') && ref[0].includes('403'), `refused about ${stu.name}: the teacher's note (${ref.length})`);
    await p.click('.al-clear'); await p.waitForTimeout(600);
    await p.selectOption('.al-filters select >> nth=0', 'sign-in-failed'); await p.waitForTimeout(600);
    const fail = await p.locator('.al-table tbody tr').allInnerTexts();
    ok(fail.length === 1 && fail[0].includes(stu.name) && fail[0].includes('Sign-in failed'), 'action filter: the failed sign-in');
    await p.selectOption('.al-filters select >> nth=0', ''); await p.fill('.al-filters input >> nth=0', advisor.name); await p.waitForTimeout(800);
    const adv = await p.locator('.al-table tbody tr').allInnerTexts();
    ok(adv.length >= 2 && adv.every((r) => r.includes(advisor.name)) && adv.some((r) => /add note/.test(r)), `person filter: ${advisor.name} (${adv.length})`);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a.al-dl')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    const lines = csv.trim().split('\r\n');
    ok(/^activity-log-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()) && lines[0].startsWith('at,actor_id') && lines.length === adv.length + 1 && lines.slice(1).every((l) => l.includes(advisor.name)), `CSV of the filtered set: ${lines.length - 1} rows`);
    ok(!SECRETS.some((s) => csv.includes(s)), 'no secrets in the CSV');
    const tomorrow = new Date(Date.now() + 864e5 * 2).toISOString().slice(0, 10);
    await p.fill('.al-filters input >> nth=0', ''); await p.fill('.al-filters input[type=date] >> nth=0', tomorrow); await p.waitForTimeout(800);
    ok((await p.locator('main').innerText()).includes('Nothing matches these filters.'), 'date filter: nothing from the day after tomorrow');
    await p.click('.al-clear'); await p.waitForTimeout(600);
    await p.screenshot({ path: path.join(SCRATCH, 'activity-log.png'), fullPage: false });
    const brand = await p.evaluate(() => [...document.querySelectorAll('.al *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(brand === 0, 'brand: no shadows, no gradients, weights up to 600');
    await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone width: no sideways page scroll');
    await p.screenshot({ path: path.join(SCRATCH, 'activity-log-phone.png'), fullPage: false });

    // ── On disk: no secrets anywhere in the log files ──
    const disk = fs.readdirSync(DATA).filter((f) => /^audit-.*\.jsonl$/.test(f)).map((f) => fs.readFileSync(path.join(DATA, f), 'utf8')).join('');
    ok(disk.length > 0 && !SECRETS.some((s) => disk.includes(s)) && !disk.includes(stuTok) && !disk.includes(linkOf(stu.email)), 'log files hold no passwords, tokens or written text');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
