// Printable sign-in cards and pausing leavers, on the school's real class lists: starts its own clean pilot
// server (needs `npm run build` first), imports the roster from the Accounts screen, signs in as the advisor
// with the most advisees, prints their cards (one QR each, 10 per A4 page), sets a password from one card,
// then imports a copy of the roster without that student (written to SCRATCH, never the repo), pauses them,
// and unpauses them from Accounts. ROSTER=<path> picks the file; without it the check is skipped.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-cards-'));
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
const setupWith = async (U, token, extra = {}) => {
  const r = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: 'pilot-pass-123', ...extra }) });
  if (!r.ok) throw new Error(`setup ${r.status}`);
  return r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
};

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const count = {}; for (const s of roster.students) if (s.email) count[s.advisorId] = (count[s.advisorId] || 0) + 1;
  const [advId, n] = Object.entries(count).filter(([id]) => roster.teachers.find((t) => t.id === id)?.email).sort((a, b) => b[1] - a[1])[0];
  const advisor = roster.teachers.find((t) => t.id === advId);
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, path.join(SCRATCH, 'data'));
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); if (token) await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const cA = await ctxOf(adminTok); const a = await cA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    const importFile = async (file, pause) => {
      await a.goto(`${U}/#/me/accounts`); await a.reload(); await a.click('text=Import class lists');
      await a.setInputFiles('.acc-file input', file); await a.waitForSelector('.acc-counts', { timeout: 20000 });
      const text = await a.locator('.acc-roster').innerText();
      if (pause) await a.check('.acc-leavers input');
      await a.click('.acc-roster button:has-text("Import")'); await a.waitForSelector('.acc-ok', { timeout: 30000 });
      return text;
    };
    await importFile(ROSTER);
    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('text=Download sign-in links (CSV)')]);
    const links = Object.fromEntries(fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).map(([, e, , u]) => [e, u.split('/setup/')[1]]));
    ok(Object.keys(links).length > 1000, `real roster imported: ${Object.keys(links).length} sign-in links`);

    // ── The advisor prints cards for their advisees ──
    const cV = await ctxOf(await setupWith(U, links[advisor.email])); const v = await cV.newPage(); v.on('pageerror', (e) => errs.push(e.message));
    await v.goto(`${U}/#/me/advisory`); await v.click('text=Print sign-in cards');
    await v.waitForSelector('.sc-panel .auth-lede:has-text("not set a password")');
    ok(new RegExp(`${n} advisees of ${n} have not set a password`).test(await v.locator('.sc-panel').innerText()), `${advisor.name}: ${n} advisees waiting`);
    await v.check('.sc-panel input[type=checkbox]');
    ok(/loses it and is signed out/.test(await v.locator('.sc-panel').innerText()), 'everyone: warns in plain words before ending passwords');
    await v.uncheck('.sc-panel input[type=checkbox]');
    await v.click(`text=Make ${n} cards`); await v.waitForSelector('.sc-card');
    const cards = await v.locator('.sc-card').count();
    const qrs = await v.locator('.sc-card .sc-qr svg, .sc-card canvas').count();
    const pages = await v.locator('.sc-page').count();
    ok(cards === n && qrs === n, `print sheet: ${cards} cards, ${qrs} QR codes`);
    ok(pages === Math.ceil(n / 10), `${pages} A4 pages of up to 10`);
    const first = await v.locator('.sc-card').first().innerText();
    ok(/NIST International School/i.test(first) && /Homeroom \S+ · Year \d+/.test(first) && /Scan, choose a password, done\./.test(first) && /Use it by \d+ \w+ 20\d\d/.test(first), 'a card: school, name, homeroom, steps, expiry');
    await v.screenshot({ path: path.join(SCRATCH, 'cards-screen.png') });
    await v.emulateMedia({ media: 'print' });
    ok(await v.locator('#root').isHidden() && await v.locator('.sc-bar').isHidden(), 'print: only the cards, no app around them');
    await v.screenshot({ path: path.join(SCRATCH, 'cards-print.png'), fullPage: true });
    const pdf = await v.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(SCRATCH, 'cards.pdf'), pdf);
    const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pdfPages === pages, `PDF has ${pdfPages} A4 pages`);
    await v.emulateMedia({ media: 'screen' });

    // ── A card's link works: the student chooses a password ──
    const name = (await v.locator('.sc-card .sc-name').first().innerText()).trim();
    const url = `http://${(await v.locator('.sc-card .sc-link').first().innerText()).trim()}`;
    const student = roster.students.find((s) => s.name === name && s.advisorId === advId);
    const cS = await ctxOf(null, { width: 390, height: 800 }); const s = await cS.newPage();
    await s.goto(url); await s.waitForSelector('#setup-h');
    await s.fill('input[autocomplete=new-password] >> nth=0', 'card-pass-123'); await s.fill('input[autocomplete=new-password] >> nth=1', 'card-pass-123');
    await s.click('text=Save and sign in'); await s.waitForSelector('.onboard, main.screen', { timeout: 10000 });
    ok(true, `${name} set a password from their card`);
    const oldLink = await fetch(`${U}/api/auth/setup/${links[student.email]}`);
    ok(oldLink.status === 404, 'the earlier CSV link no longer works');
    await cS.close();

    // ── A leaver: the next roster has everyone but this student ──
    const minus = { ...roster, students: roster.students.filter((x) => x.id !== student.id), enrolments: roster.enrolments.filter((e) => e.studentId !== student.id) };
    const file = path.join(SCRATCH, 'roster-minus-one.json'); fs.writeFileSync(file, JSON.stringify(minus));
    const prev = await importFile(file, true);
    ok(/Pause the accounts of 1 person who is no longer in the class lists/.test(prev) && prev.includes(name), 'import confirm offers to pause the one leaver, by name');
    ok(/Paused 1 account/.test(await a.locator('.acc-ok').innerText()), 'paused after import');
    const cL = await ctxOf(null); const l = await cL.newPage();
    await l.goto(`${U}/`); await l.fill('input[type=email]', student.email); await l.fill('input[type=password]', 'card-pass-123'); await l.click('button:has-text("Sign in")');
    await l.waitForSelector('.auth-err');
    ok((await l.locator('.auth-err').innerText()).includes('Your account is paused. Ask your teacher.'), 'paused: sign-in refused in plain words');
    await a.click('.acc-roster button:has-text("Close")');
    const row = a.locator('.acc-table tr', { hasText: student.email });
    ok(/Paused/.test(await row.innerText()), 'Accounts shows the account as paused');
    const st = (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${adminTok}` } })).json()).snapshot.store;
    ok(st.students.some((x) => x.id === student.id), 'the record stays');
    await row.locator('button:has-text("Unpause")').click(); await a.waitForTimeout(400);
    ok(!/Paused/.test(await a.locator('.acc-table tr', { hasText: student.email }).innerText()), 'Unpause');
    await l.click('button:has-text("Sign in")'); await l.waitForSelector('.onboard, main.screen', { timeout: 10000 });
    ok(true, 'signs in again after Unpause');
    await cL.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots and PDF in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
