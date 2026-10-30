// System health (src/screens/SystemHealth.jsx, server/routes/69-health.mjs): starts its own clean pilot server (needs
// `npm run build` first) with a temporary backups folder holding a 3-day-old backup, imports the fixture class lists, and
// checks: the admin has System health in the nav, every part shows OK / Check this / Problem with what to do, the backup
// warning, Download diagnostics (no names, emails, paths or tokens), axe (light, dark, high contrast), phone width and
// brand; a teacher has no nav entry, the address does not open it, and the API answers 403.
// Each account has its own browser context. Screenshots go to SCRATCH (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-system-health-'));
const DATA = path.join(SCRATCH, 'data'), BK = path.join(SCRATCH, 'backups');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: DATA, BACKUP_DIR: BK, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
async function axe(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`)));
  ok(!v.length, `axe ${label}${v.length ? `: ${v.join(' | ')}` : ''}`);
}

(async () => {
  fs.mkdirSync(BK, { recursive: true });
  const old = path.join(BK, 'transit-pilot-data-20261027-023000.tar.gz');
  fs.writeFileSync(old, Buffer.alloc(4096, 1));
  const t3 = (Date.now() - 3 * 864e5 - 3600_000) / 1000; fs.utimesSync(old, t3, t3);
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port);
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json().catch(() => ({})) }; };
  const get = (url, tok) => fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} });
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 900 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  try {
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster: ROSTER }, adminTok)).j;
    const linkOf = (email) => imp.newAccounts.created.find((a) => a.email === email).setupUrl.split('/setup/')[1];
    const teachTok = cookieOf((await post('/api/auth/setup', { token: linkOf('ben.carter@example.org'), password: 'pilot-pass-123' })).r);
    await post('/api/auth/login', { email: 'fern.gale@example.org', password: 'WRONG-PASS-73' });

    // ── Teacher: no nav entry, 403 ──
    ok((await get('/api/admin/health', teachTok)).status === 403 && (await get('/api/admin/health?format=diagnostics', teachTok)).status === 403, 'teacher: the API answers 403');
    const cT = await ctxOf(teachTok); const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me`); await t.waitForSelector('.navbar');
    ok(!(await t.locator('.nav-measure').textContent()).includes('System health'), 'teacher: no System health in the nav');
    await t.goto(`${U}/#/me/health`); await t.waitForTimeout(600);
    ok(!(await t.locator('.syh').count()), 'teacher: the address does not open it');

    // ── Admin: the page ──
    const cA = await ctxOf(adminTok); const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(`${U}/#/me`); await a.waitForSelector('.navbar');
    ok((await a.locator('.nav-measure').textContent()).includes('System health'), 'admin: System health in the nav');
    await a.goto(`${U}/#/me/health`); await a.waitForSelector('.syh-sec');
    const ids = await a.locator('.syh-sec').evaluateAll((xs) => xs.map((x) => x.dataset.section));
    ok(ids.join() === 'server,storage,record,uploads,backup,sis,jobs,errors,signin,sessions', `every part shown: ${ids.join(', ')}`);
    const badges = await a.locator('.syh-sec .syh-badge').allInnerTexts();
    ok(badges.length === 10 && badges.every((x) => /^\S\s*(OK|Check this|Problem)$/.test(x.trim())), `each part says OK / Check this / Problem (${badges.map((x) => x.trim().slice(1).trim()).join(', ')})`);
    const bk = await a.locator('[data-section=backup]').innerText();
    ok(/Problem/.test(bk) && /The newest backup is 3 days old/.test(bk) && /Check the Mac is awake at 02:30/.test(bk), 'backup: 3 days old, with what to do');
    ok(/Problem/.test(await a.locator('.syh-overall').innerText()), 'overall: Problem');
    ok(/1 wrong password/.test(await a.locator('[data-section=signin]').innerText()), 'sign-in: the wrong password is counted');
    ok(/Version/.test(await a.locator('[data-section=server]').innerText()), 'server: version shown');
    await axe(a, 'System health (light)');
    await a.evaluate(() => document.documentElement.classList.add('a11y-contrast')); await axe(a, 'System health (high contrast)');
    await a.evaluate(() => { document.documentElement.classList.remove('a11y-contrast'); document.documentElement.dataset.theme = 'dark'; }); await a.waitForTimeout(200);
    await axe(a, 'System health (dark)');
    await a.screenshot({ path: path.join(SCRATCH, 'system-health-dark.png'), fullPage: true });
    await a.evaluate(() => { document.documentElement.dataset.theme = 'light'; });

    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('a.syh-dl')]);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    const diag = JSON.parse(text);
    const people = [...ROSTER.teachers, ...ROSTER.students].flatMap((x) => [x.name, x.email]).filter(Boolean);
    const leaks = [DATA, BK, SCRATCH, 'Pat Admin', 'pat@example.org', 'pilot-pass-123', 'WRONG-PASS-73', adminTok, teachTok, ...people].filter((s) => text.includes(s));
    ok(/^transit-diagnostics-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()) && diag.sections.length === 10 && !leaks.length, `diagnostics: a JSON file without personal data${leaks.length ? ` (holds ${leaks.join(', ')})` : ''}`);

    // Fresh backup: Check again turns it OK.
    fs.writeFileSync(path.join(BK, 'transit-pilot-data-20261030-023000.tar.gz'), Buffer.alloc(8192, 1));
    await a.click('.syh-actions button'); await a.waitForFunction(() => /OK/.test(document.querySelector('[data-section=backup] .syh-badge')?.textContent || ''));
    ok(true, 'Check again: a fresh backup is OK');
    await a.screenshot({ path: path.join(SCRATCH, 'system-health.png'), fullPage: true });
    const brand = await a.evaluate(() => [...document.querySelectorAll('.syh *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(brand === 0, 'brand: no shadows, no gradients, weights up to 600');
    await a.setViewportSize({ width: 390, height: 800 }); await a.waitForTimeout(300);
    ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone width: no sideways page scroll');
    await axe(a, 'System health (phone)');
    await a.screenshot({ path: path.join(SCRATCH, 'system-health-phone.png'), fullPage: false });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
