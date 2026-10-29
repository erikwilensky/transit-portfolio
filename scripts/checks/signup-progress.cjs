// Sign-up progress on the school's real class lists: starts its own clean pilot server (needs `npm run build`
// first), imports the roster, sets up 3 students in 8C (then moves their sign-in 10 days back and signs one in
// again), joins one family from a family letter, and checks the 8C row on Pilot usage (admin), its student list
// and its "Print sign-in cards" shortcut, and the advisor strip for Ms Jane Altemen (T25948). ROSTER=<path> picks
// the file; without it the check is skipped. Screenshots go to SCRATCH (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-progress-'));
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
const stop = (p) => new Promise((r) => { p.once('exit', r); p.kill('SIGTERM'); });

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const room = roster.students.filter((s) => s.homeroom === '8C').sort((a, b) => a.name.localeCompare(b.name));
  const jane = roster.teachers.find((t) => t.id === 'T25948');
  const port = await freePort(); const U = `http://localhost:${port}`;
  let srv = await start(port);
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json() }; };
  const get = async (url, tok) => (await fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} })).json();
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  try {
    ok(room.length === 23 && jane?.name === 'Ms Jane Altemen' && room.every((s) => s.advisorId === 'T25948'), `8C: ${room.length} students, all advised by ${jane?.name}`);
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(imp.newAccounts?.created?.length > 1000, `real roster imported: ${imp.newAccounts?.created?.length} accounts`);
    const linkOf = (email) => imp.newAccounts.created.find((a) => a.email === email).setupUrl.split('/setup/')[1];
    const three = room.slice(0, 3);
    for (const s of three) ok((await post('/api/auth/setup', { token: linkOf(s.email), password: 'student-pass-1' })).r.status === 200, `${s.name} sets a password`);
    const janeTok = cookieOf((await post('/api/auth/setup', { token: linkOf(jane.email), password: 'pilot-pass-123' })).r);

    // The three signed up 10 days ago; only the first signs in again this week.
    await stop(srv.p);
    const accFile = path.join(DATA, 'accounts.json');
    const accs = JSON.parse(fs.readFileSync(accFile, 'utf8'));
    const old = new Date(Date.now() - 10 * 864e5).toISOString();
    for (const a of accs) if (three.some((s) => s.email === a.email)) a.lastSignInAt = old;
    fs.writeFileSync(accFile, JSON.stringify(accs, null, 2));
    srv = await start(port);
    ok((await post('/api/auth/login', { email: three[0].email, password: 'student-pass-1' })).r.status === 200, `${three[0].name} signs in`);

    // One family joins from their family letter (printed by the advisor).
    const lt = (await post('/api/advisor/family/letters', { studentIds: [room[5].id] }, janeTok)).j;
    ok(lt.letters?.length === 1, `${jane.name} prints a family letter for ${room[5].name}`);
    ok((await post('/api/family/join', { token: lt.letters[0].url.split('/family/')[1], name: 'Sam Family', email: 'sam@family.example', password: 'family-pass-1' })).r.status === 200, 'the family joins');

    // ── Server: the 8C row, fast ──
    const t0 = Date.now(); const pr = await get('/api/admin/progress', adminTok); const ms = Date.now() - t0;
    const r8c = pr.homerooms.find((r) => r.name === '8C');
    ok(r8c && r8c.students === 23 && r8c.signedUp === 3 && r8c.active === 1 && r8c.families === 1 && r8c.moments === 0 && r8c.waiting === 20, `8C: ${JSON.stringify(r8c)}`);
    ok(pr.totals.students === 960 && pr.staff.total.total >= 130, `totals: ${pr.totals.students} students, ${pr.staff.total.total} staff (${pr.staff.total.signedUp} signed up)`);
    ok(ms < 500, `GET /api/admin/progress took ${ms} ms`);
    const ys = pr.homerooms.map((r) => r.year);
    ok(ys.every((y, i) => !i || y >= ys[i - 1]), `homerooms sorted by Year (${pr.homerooms.length} homerooms)`);

    // ── Admin: Pilot usage ──
    const cA = await ctxOf(adminTok); const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(`${U}/#/me/usage`); await a.waitForSelector('.sp-table');
    const row = a.locator('.sp-table tr', { has: a.locator('button.sp-room', { hasText: /^8C$/ }) });
    const cells = (await row.locator('td').allInnerTexts()).map((s) => s.trim());
    ok(cells[1] === '23' && cells[2].startsWith('3') && cells[3].startsWith('1') && cells[4].startsWith('0') && cells[5].startsWith('1'), `8C row on screen: ${cells.slice(0, 6).join(' | ')}`);
    ok(await row.locator('.sp-bar').count() === 4, 'four inline bars');
    ok(/All homerooms/.test(await a.locator('.sp-total').innerText()) && /All staff/.test(await a.locator('.sp-staff').innerText()), 'totals row and staff rows');
    await row.locator('button.sp-room').click(); await a.waitForSelector('.sp-list li');
    const list = a.locator('.sp-list');
    ok(await list.locator('li').count() === 23, '8C lists its 23 students');
    const chips = await list.locator('.acc-tag').allInnerTexts();
    const n = (t) => chips.filter((c) => c === t).length;
    ok(n('Active this week') === 1 && n('Signed up') === 2 && n('Not signed up') === 20, `chips: 1 active, 2 signed up, 20 not signed up`);
    const firstLi = await list.locator('li', { hasText: three[0].name }).innerText();
    ok(/Last here \d+ \w+/.test(firstLi), `${three[0].name}: last sign-in date shown`);
    await a.screenshot({ path: path.join(SCRATCH, 'usage-progress.png'), fullPage: true });
    const bad = await a.evaluate(() => [...document.querySelectorAll('.sp *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(bad === 0, 'brand: no shadows, no gradients, weights up to 600');
    await row.locator('button.sp-cards').click(); await a.waitForSelector('.sc-card');
    ok(await a.locator('.sc-card').count() === 20, 'Print sign-in cards: 20 cards for the not signed up');
    await a.click('.sc-bar button:has-text("Close")');
    await a.setViewportSize({ width: 390, height: 800 }); await a.waitForTimeout(300);
    const wide = await a.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.parentElement.closest('.us-scroll')).map((e) => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().right)}`).slice(0, 8));
    ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `phone width: no sideways page scroll${wide.length ? ` (${wide.join(', ')})` : ''}`);

    // Leadership-free check: the advisor gets 403 on the school table.
    ok((await fetch(`${U}/api/admin/progress`, { headers: { cookie: `tp_session=${janeTok}` } })).status === 403, 'an advisor cannot read the school table');

    // ── Advisor strip ──
    const cV = await ctxOf(janeTok); const v = await cV.newPage(); v.on('pageerror', (e) => errs.push(e.message));
    await v.goto(`${U}/#/me/advisory`); await v.waitForSelector('.sp-strip');
    const strip = (await v.locator('.sp-strip > p').innerText()).replace(/\s+/g, ' ');
    ok(/Signed up 3 of 23\W+Families 1 of 23\W+Active this week 1/.test(strip), `strip: ${strip}`);
    ok(await v.locator('text=Print sign-in cards').count() === 1 && await v.locator('text=Print family letters').count() === 1, 'next to Print sign-in cards and Print family letters');
    await v.click('.sp-strip button:has-text("missing")');
    const miss = await v.locator('.sp-missing').innerText();
    ok(/Not signed up \(20\)/.test(miss) && /No family account \(22\)/.test(miss) && !miss.split('No family')[0].includes(three[0].name), "Who's missing: 20 not signed up, 22 with no family");
    await v.screenshot({ path: path.join(SCRATCH, 'advisor-strip.png') });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
