// School overview on the school's real class lists: starts its own clean pilot server (needs `npm run build` first),
// imports the roster, signs up 8 students of the first Year 8 homeroom (each adds a Science moment; one also adds a
// Computing one), then checks the overview as leadership (nav, Year rows, "fewer than 5" on Computing, quiet groups,
// no student names on the page, CSV download, phone width, brand), as a coordinator (nav), and that a subject teacher
// and a student get 403. ROSTER=<path> picks the file; without it the check is skipped. Screenshots go to SCRATCH
// (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-overview-'));
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
  const roomName = [...new Set(roster.students.filter((s) => s.year === 8).map((s) => s.homeroom))].sort()[0];
  const room = roster.students.filter((s) => s.homeroom === roomName && s.email).sort((a, b) => a.id.localeCompare(b.id));
  const lead = roster.teachers.find((t) => t.roles.includes('leadership') && t.email);
  const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && !t.roles.includes('leadership') && t.email);
  const teacher = roster.teachers.find((t) => t.roles.length === 1 && t.roles[0] === 'teacher' && t.email);
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port);
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json() }; };
  const get = (url, tok) => fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} });
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 900 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  try {
    ok(room.length >= 16 && lead && coord && teacher, `Year 8 homeroom with ${room.length} students; leadership, coordinator and teacher accounts found`);
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(imp.newAccounts?.created?.length > 1000, `real roster imported: ${imp.newAccounts?.created?.length} accounts`);
    const linkOf = (email) => imp.newAccounts.created.find((a) => a.email === email).setupUrl.split('/setup/')[1];
    const setup = async (email) => cookieOf((await post('/api/auth/setup', { token: linkOf(email), password: 'pilot-pass-123' })).r);
    const eight = room.slice(0, 8); let stuTok;
    for (const [i, s] of eight.entries()) {
      const tok = await setup(s.email); stuTok ||= tok;
      const a = await post('/api/action', { fn: 'addStation', args: [s.id, { title: `Moment ${i}`, lineIds: ['science'] }] }, tok);
      if (!i) await post('/api/action', { fn: 'addStation', args: [s.id, { title: 'Robot', lineIds: ['computing'] }] }, tok);
      if (a.r.status !== 200) ok(false, `addStation: ${JSON.stringify(a.j)}`);
    }
    const leadTok = await setup(lead.email), coordTok = await setup(coord.email), teachTok = await setup(teacher.email);

    // ── Server ──
    const t0 = Date.now(); const o = await (await get('/api/overview', leadTok)).json(); const ms = Date.now() - t0;
    ok(ms < 500, `GET /api/overview took ${ms} ms`);
    const term = o.ranges.find((r) => r.id === 'term'), y8 = term.years.find((r) => r.year === 8);
    ok(term.totals.students === 960 && term.years.length === 7, `term: ${term.totals.students} students in Years 7 to 13`);
    ok(y8.signedUp === 8 && y8.active === 8 && y8.withMoment === 8 && y8.moments === 9, `Year 8: ${JSON.stringify(y8)}`);
    ok(term.years.filter((r) => r.year !== 8).every((r) => r.signedUp === 0 && r.moments === 0), 'other Years: nobody yet');
    const comp = term.lines.find((l) => l.id === 'computing'), sci = term.lines.find((l) => l.id === 'science');
    ok(comp.moments === 'fewer than 5' && comp.endorsedPct === 'fewer than 5' && sci.moments === 8 && sci.endorsedPct === 0, `lines: Science ${sci.moments}, Computing "${comp.moments}"`);
    const rooms = new Set(roster.students.map((s) => s.homeroom));
    ok(o.quiet.length === rooms.size - 1 && !o.quiet.some((q) => q.name === roomName) && o.quiet.every((q) => Object.keys(q).join() === 'name,pct'), `quiet: ${o.quiet.length} of ${rooms.size} homerooms (not ${roomName}, ${Math.round((800) / room.length)}% active)`);
    const body = JSON.stringify(o);
    ok(!roster.students.some((s) => body.includes(s.name) || body.includes(s.id)) && !roster.teachers.some((t) => body.includes(t.name)), 'no student or staff names or ids in the answer');
    ok((await get('/api/overview', teachTok)).status === 403, 'a subject teacher gets 403');
    ok((await get('/api/overview', stuTok)).status === 403, 'a student gets 403');
    ok((await get('/api/overview?format=csv', stuTok)).status === 403, 'a student gets 403 on the CSV');

    // ── Leadership: the screen ──
    const cL = await ctxOf(leadTok); const p = await cL.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${U}/#/me`); await p.waitForSelector('.navbar');
    ok((await p.locator('.nav-measure').textContent()).includes('School overview'), 'leadership: School overview in the nav');
    await p.goto(`${U}/#/me/overview`); await p.waitForSelector('.ov-years');
    const rows = await p.locator('.ov-years tbody tr').allInnerTexts();
    ok(rows.length === 8 && /^Year 7/.test(rows[0]) && /^All Years/.test(rows[7]), `Year 7 to 13 and All Years (${rows.length} rows)`);
    ok(/Year 8\s+\d+\s+8\s+8\s+8\s+[\d.]+\s+0\s+0\s+0/.test(rows[1]), `Year 8 row: ${rows[1].replace(/\s+/g, ' ')}`);
    const compRow = (await p.locator('.ov-lines tr', { hasText: 'Computing' }).innerText()).replace(/\s+/g, ' ');
    ok(/fewer than 5 fewer than 5/.test(compRow), `Computing row: ${compRow}`);
    ok(await p.locator('.ov-quiet li').count() === o.quiet.length, `Quiet groups: ${o.quiet.length} homerooms listed`);
    ok(await p.locator('.us-chart svg path.us-bar').count() >= 1, 'weekly chart drawn');
    const text = await p.locator('main').innerText();
    ok(!roster.students.some((s) => text.includes(s.name)), 'no student names on the page');
    await p.screenshot({ path: path.join(SCRATCH, 'overview.png'), fullPage: true });
    const brand = await p.evaluate(() => [...document.querySelectorAll('.ov *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(brand === 0, 'brand: no shadows, no gradients, weights up to 600');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.us-bar')).fill) === 'rgb(0, 40, 85)', 'bars in NIST navy');
    await p.click('.ov-tabs button:has-text("Last 4 weeks")');
    ok(await p.locator('.ov-tabs button.on').innerText() === 'Last 4 weeks', 'switch to the last 4 weeks');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a.ov-dl')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(/last-4-weeks/.test(dl.suggestedFilename()) && /\nYear 8,\d+,8,8,8,9,/.test(csv) && /\nComputing,fewer than 5,fewer than 5/.test(csv), `CSV ${dl.suggestedFilename()}`);
    ok(!roster.students.some((s) => csv.includes(s.name)), 'no student names in the CSV');
    await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone width: no sideways page scroll');
    await p.screenshot({ path: path.join(SCRATCH, 'overview-phone.png'), fullPage: true });

    // ── Coordinator and teacher: nav ──
    const cC = await ctxOf(coordTok); const c = await cC.newPage(); c.on('pageerror', (e) => errs.push(e.message));
    await c.goto(`${U}/#/me`); await c.waitForSelector('.navbar');
    ok((await c.locator('.nav-measure').textContent()).includes('School overview'), 'coordinator: School overview in the nav');
    const cT = await ctxOf(teachTok); const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me`); await t.waitForSelector('.navbar');
    ok(!(await t.locator('.nav-measure').textContent()).includes('School overview'), 'teacher: no School overview');
    await t.goto(`${U}/#/me/overview`); await t.waitForTimeout(500);
    ok(!(await t.locator('.ov-years').count()), 'teacher: the address does not open it');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
