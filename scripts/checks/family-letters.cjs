// Family sign-in letters on the school's real class lists: starts its own clean pilot server (needs
// `npm run build` first), imports the roster, signs in as the advisor with the most advisees, prints their
// family letters (two per A4 page, one QR each), then a parent joins from one letter on a phone-sized
// screen and lands on the family view, and a second advisee's letter adds a sibling to the same account.
// The advisor then sees who joined; the admin sees the homeroom's families. ROSTER=<path> picks the file;
// without it the check is skipped. Screenshots and a PDF go to SCRATCH (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-family-'));
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const count = {}; for (const s of roster.students) count[s.advisorId] = (count[s.advisorId] || 0) + 1;
  const [advId, n] = Object.entries(count).filter(([id]) => roster.teachers.find((t) => t.id === id)?.email).sort((a, b) => b[1] - a[1])[0];
  const advisor = roster.teachers.find((t) => t.id === advId);
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, path.join(SCRATCH, 'data'));
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json() }; };
  const get = async (url, tok) => (await fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} })).json();
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp }); if (token) await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  try {
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(imp.newAccounts?.created?.length > 1000, `real roster imported: ${imp.newAccounts?.created?.length} accounts`);
    const advLink = imp.newAccounts.created.find((a) => a.email === advisor.email).setupUrl.split('/setup/')[1];
    const advTok = cookieOf((await post('/api/auth/setup', { token: advLink, password: 'pilot-pass-123' })).r);

    // ── The advisor prints family letters ──
    const cV = await ctxOf(advTok); const v = await cV.newPage(); v.on('pageerror', (e) => errs.push(e.message));
    await v.goto(`${U}/#/me/advisory`); await v.click('text=Print family letters');
    await v.waitForSelector('.fl-panel .fl-row');
    ok(new RegExp(`0 of ${n} advisees have a family account`).test(await v.locator('.fl-panel').innerText()), `${advisor.name}: 0 of ${n} advisees have a family account`);
    ok(await v.locator('.fl-panel .fl-row').count() === n, `one row per advisee (${n})`);
    await v.click(`.fl-panel button:has-text("Make ${n} letters")`); await v.waitForSelector('.fl-letter');
    const letters = await v.locator('.fl-letter').count();
    const qrs = await v.locator('.fl-letter .fl-qr svg').count();
    const pages = await v.locator('.fl-page').count();
    ok(letters === n && qrs === n, `letter sheet: ${letters} letters, ${qrs} QR codes`);
    ok(pages === Math.ceil(n / 2), `${pages} A4 pages, two letters each`);
    const firstText = await v.locator('.fl-letter').first().innerText();
    ok(/NIST International School/i.test(firstText) && /Dear family of \S+ \(\S+\),/.test(firstText) && /chooses to share with family/.test(firstText) && /works until \d+ \w+ 20\d\d/.test(firstText), 'a letter: school, "Dear family of <first name> (<homeroom>)", what they see, expiry');
    const bad = await v.evaluate(() => [...document.querySelectorAll('.fl-overlay *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(bad === 0, 'brand: no shadows, no gradients, weights up to 600');
    await v.screenshot({ path: path.join(SCRATCH, 'letters-screen.png') });
    await v.emulateMedia({ media: 'print' });
    ok(await v.locator('#root').isHidden() && await v.locator('.sc-bar').isHidden(), 'print: only the letters');
    const pdf = await v.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(SCRATCH, 'letters.pdf'), pdf);
    const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pdfPages === pages, `PDF has ${pdfPages} A4 pages`);
    await v.emulateMedia({ media: 'screen' });
    const links = await v.locator('.fl-link').allInnerTexts();
    const dears = await v.locator('.fl-dear').allInnerTexts();
    await v.click('.sc-bar button:has-text("Close")');

    // ── A parent joins from the first letter, on a phone ──
    const cP = await ctxOf(null, { width: 390, height: 800 }); const p = await cP.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    const first1 = dears[0].match(/Dear family of (\S+)/)[1];
    await p.goto(`http://${links[0].trim()}`); await p.waitForSelector('#fj-h');
    ok((await p.locator('#fj-h').innerText()).startsWith(`Family of ${first1}`), `join page shows only the first name: ${await p.locator('#fj-h').innerText()}`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(wide, 'join page fits a phone screen');
    await p.screenshot({ path: path.join(SCRATCH, 'join-phone.png') });
    await p.fill('input[autocomplete=name]', 'Sam Family'); await p.fill('input[type=email]', 'sam@family.example');
    await p.fill('input[autocomplete=new-password] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete=new-password] >> nth=1', 'family-pass-1');
    await p.click('button:has-text("Make my account")'); await p.waitForSelector('main.screen', { timeout: 15000 });
    await p.waitForTimeout(800);
    const fv = await p.locator('main.screen').innerText();
    ok(/Family view/.test(await p.locator('body').innerText()) && fv.includes(first1), `lands on the family view of ${first1}`);
    await p.screenshot({ path: path.join(SCRATCH, 'family-view.png') });
    const pTok = (await cP.cookies()).find((c) => c.name === 'tp_session').value;
    const st1 = (await get('/api/state', pTok)).snapshot.store;
    ok(st1.students.length === 1, 'their record holds their own child only');

    // ── A second advisee's letter adds a sibling to the same account ──
    const first2 = dears[1].match(/Dear family of (\S+)/)[1];
    await p.goto(`http://${links[1].trim()}`); await p.waitForSelector('#fj-h');
    ok((await p.locator('#fj-h').innerText()) === `Add ${first2} to your account`, 'signed in: offers to add the sibling');
    await p.click(`button:has-text("Add ${first2}")`); await p.waitForSelector('main.screen', { timeout: 15000 }); await p.waitForTimeout(800);
    const me = await get('/api/auth/me', pTok);
    ok(me.user.kind === 'parent' && me.user.children.length === 2, 'one family account with both children');
    const fv2 = await p.locator('body').innerText();
    ok(fv2.includes(first1) && fv2.includes(first2), 'the family view names both children');
    ok((await get('/api/admin/accounts', adminTok)).accounts.filter((a) => a.kind === 'parent').length === 1, 'no second account was made');
    await p.screenshot({ path: path.join(SCRATCH, 'family-two.png') });

    // ── The advisor sees who joined, and only new letters for the rest ──
    await v.reload(); await v.click('text=Print family letters'); await v.waitForSelector('.fl-panel .fl-row');
    const panel = await v.locator('.fl-panel').innerText();
    ok(new RegExp(`2 of ${n} advisees have a family account`).test(panel) && (panel.match(/Sam Family/g) || []).length === 2, 'advisor: 2 advisees with a family, Sam Family on both');
    ok(await v.locator(`.fl-panel button:has-text("Make ${n - 2} letter")`).count() === 1, `only students with no family yet: ${n - 2} letters`);
    await v.screenshot({ path: path.join(SCRATCH, 'advisor-panel.png'), fullPage: true });

    // ── Admin: by homeroom ──
    const room = roster.students.find((s) => s.advisorId === advId && s.name.startsWith(first1)).homeroom;
    const cA = await ctxOf(adminTok); const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(`${U}/#/me/accounts`); await a.click('text=Print family letters'); await a.waitForSelector('.fl-panel .sc-rooms label');
    ok(await a.locator('.fl-panel .sc-rooms label').count() > 20, `admin: ${await a.locator('.fl-panel .sc-rooms label').count()} homerooms`);
    await a.selectOption('.fl-look select', room); await a.waitForSelector('.fl-panel .fl-row');
    ok(/Sam Family/.test(await a.locator('.fl-panel .fl-list').innerText()), `admin sees homeroom ${room}'s family`);
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots and PDF in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
