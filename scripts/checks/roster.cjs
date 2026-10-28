// Roster import and the clean pilot start: starts its own pilot server with TP_START=empty (needs
// `npm run build` first), imports the fixture CSVs from the Accounts screen, downloads the sign-in links,
// then signs in as every role and opens each of their screens on the near-empty record: none may crash.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const FX = path.join(ROOT, 'src/imports/fixtures/roster');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const SH = os.tmpdir() + '/tp-roster-';
const FICTIONAL = /Maya Chen|Arun Mehta|Whitfield|Priya Nair|Adeyemi|Brandt|Wongsakul|Chaiyaporn/;

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
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, fs.mkdtempSync(SH + 'data-'));
  const { NAV } = await import(path.join(ROOT, 'src/personas.js'));
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  // Opens each screen; a crash is a page error or the error boundary's message.
  async function tour(page, who, screens, { fictional = true } = {}) {
    const bad = [];
    for (const sc of screens) {
      const errs = []; const onErr = (e) => errs.push(e.message); page.on('pageerror', onErr);
      await page.goto(`${U}/#/me/${sc}`); await page.waitForSelector('main.screen, .onboard, .acc', { timeout: 8000 }).catch(() => errs.push('nothing rendered'));
      await page.waitForTimeout(250);
      if (await page.locator('text=This screen hit a problem').count()) errs.push(await page.locator('.soon code').innerText().catch(() => 'boundary'));
      if (fictional) { const t = await page.locator('main, .onboard').first().innerText().catch(() => ''); const m = t.match(FICTIONAL); if (m) errs.push(`shows fictional ${m[0]}`); }
      page.off('pageerror', onErr);
      if (errs.length) bad.push(`${sc}: ${errs.join(' | ')}`);
    }
    ok(!bad.length, `${who}: ${screens.length} screens open on the empty record${bad.length ? `\n   ${bad.join('\n   ')}` : ''}`);
  }
  try {
    const st0 = await (await fetch(`${U}/api/health`)).json().catch(() => ({}));
    ok(!!srv.setup, 'clean pilot prints the first admin link');
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const rec = (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    ok(rec.students.length === 0 && rec.teachers.length === 0 && rec.events.length === 0 && rec.lines.length === 9, 'TP_START=empty: nine school lines, no people, no stations');

    // ── Admin: the Accounts screen before and after the import ──
    const ctxA = await ctxOf(adminTok); const a = await ctxA.newPage();
    await tour(a, 'admin, before any import', ['accounts']);
    // Staff before any students exist: dashboards, search and grids with nobody in them.
    for (const kind of ['leadership', 'counsellor', 'coordinator', 'advisor', 'teacher']) {
      const j = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ name: `Early ${kind}`, email: `early-${kind}@example.org`, kind, newTeacher: { name: `Early ${kind}`, role: kind } }) })).json();
      const c = await ctxOf(await setupWith(U, j.setupUrl.split('/setup/')[1])); const p = await c.newPage();
      await tour(p, `${kind}, no students yet`, NAV[kind].map(([id]) => id)); await c.close();
    }
    await a.reload(); await a.click('text=Import class lists'); await a.waitForSelector('#roster-h');
    // A broken file: the missing ids are listed and nothing is imported.
    const broken = JSON.parse(fs.readFileSync(path.join(FX, 'roster.json'), 'utf8')); broken.students[0].advisorId = 'T999';
    await a.setInputFiles('.acc-file input', { name: 'roster.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) });
    await a.waitForSelector('.acc-problems');
    ok(/T999/.test(await a.locator('.acc-problems').innerText()), 'a missing advisor id stops the import and is named');
    // The four CSVs: preview, then import.
    await a.setInputFiles('.acc-file input', ['teachers.csv', 'students.csv', 'classes.csv', 'enrolments.csv'].map((f) => path.join(FX, f)));
    await a.waitForSelector('.acc-counts');
    const prev = await a.locator('.acc-roster').innerText();
    ok(/Staff\s+6\s+6\s+0/.test(prev) && /Students\s+3\s+3\s+0/.test(prev) && /Class places\s+7\s+7\s+0/.test(prev), 'preview counts: 6 staff, 3 students, 7 class places, all new');
    ok(/7 people with an email will get a sign-in account/.test(prev), 'preview: 7 sign-in accounts to make');
    ok(/12 Maths AA HL/.test(prev), 'preview lists the class with no line');
    ok((await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store.students.length === 0, 'preview changes nothing');
    await a.screenshot({ path: SH + 'preview.png', fullPage: true });
    await a.click('.acc-roster button:has-text("Import")'); await a.waitForSelector('.acc-ok');
    ok(/Added 6 staff, 3 students, 5 classes, 7 class places/.test(await a.locator('.acc-ok').innerText()), 'summary after import');
    const [dl] = await Promise.all([a.waitForEvent('download'), a.click('text=Download sign-in links (CSV)')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r?\n/);
    ok(csv[0] === 'name,email,role,setup link' && csv.length === 8, `sign-in links CSV: header and 7 rows (${dl.suggestedFilename()})`);
    await a.screenshot({ path: SH + 'done.png', fullPage: true });
    await a.click('.acc-roster button:has-text("Close")');
    await a.waitForTimeout(300); const tbl = await a.locator('.acc-table').innerText();
    ok(/Fern Gale/.test(tbl) && /Fern Gale · Year 12/.test(tbl), 'the new accounts are in the table, linked to their records' + (/Fern/.test(tbl) ? '' : '\n' + tbl.slice(0, 300)));
    const links = Object.fromEntries(csv.slice(1).map((l) => l.split(',')).map(([n, e, r, u]) => [e, u.split('/setup/')[1]]));

    // A parent, made the usual way, linked to an imported student.
    const par = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Jo Gale', email: 'jo.gale@example.org', kind: 'parent', children: ['S2001'] }) })).json();
    links['jo.gale@example.org'] = par.setupUrl.split('/setup/')[1];

    // ── Every role on the near-empty record ──
    const roles = [
      ['ada.brook@example.org', 'advisor with two students', 'advisor'], ['finn.gray@example.org', 'advisor with no students', 'advisor'],
      ['ben.carter@example.org', 'subject teacher', 'teacher'], ['chloe.dumas@example.org', 'counsellor', 'counsellor'],
      ['dan.ellis@example.org', 'leadership', 'leadership'], ['jo.gale@example.org', 'parent', 'parent'],
    ];
    for (const [email, who, kind] of roles) {
      const c = await ctxOf(await setupWith(U, links[email])); const p = await c.newPage();
      await tour(p, who, [...NAV[kind].map(([id]) => id), ...(kind === 'advisor' ? ['student/S2001'] : [])]);
      await c.close();
    }
    // Coordinator: Eve has no email, so link an account to her record by hand.
    const eve = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Ms Eve Fong', email: 'eve@example.org', kind: 'coordinator', teacherId: 'T104' }) })).json();
    { const c = await ctxOf(await setupWith(U, eve.setupUrl.split('/setup/')[1])); const p = await c.newPage(); await tour(p, 'coordinator', NAV.coordinator.map(([id]) => id)); await c.close(); }

    // A student: onboarding (no made-up starter stations), then every screen with an empty map.
    const cS = await ctxOf(await setupWith(U, links['fern.gale@example.org']), { width: 390, height: 800 }); const s = await cS.newPage();
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    await s.locator('.ob-pick').nth(0).click(); await s.locator('.ob-pick').nth(1).click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    ok(await s.locator('text=Pick a simple look').count() === 1, 'clean start skips the made-up "already verified" stations step');
    await s.click('text=Go to my map'); await s.waitForSelector('.screen-map');
    await s.waitForTimeout(600);
    const evs = (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store.events;
    ok(evs.length === 0, 'onboarding added no stations');
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'empty map: no sideways scroll at phone width');
    await s.screenshot({ path: SH + 'student-map.png' });
    await tour(s, 'student with an empty map', NAV.student.map(([id]) => id));
    // Every audience lens of the starter presentations opens.
    { const errs = []; s.on('pageerror', (e) => errs.push(e.message)); await s.goto(`${U}/#/me/studio`); await s.waitForSelector('.lens-switch');
      const n = await s.locator('.lens-switch button').count();
      for (let i = 0; i < n; i++) { await s.locator('.lens-switch button').nth(i).click(); await s.waitForTimeout(200); if (await s.locator('text=This screen hit a problem').count()) errs.push(`lens ${i}`); }
      ok(n >= 3 && !errs.length, `studio: ${n} lenses open on the starter presentations${errs.length ? ` (${errs.join(', ')})` : ''}`); }
    await tour(a, 'admin, after the import', ['accounts']);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
