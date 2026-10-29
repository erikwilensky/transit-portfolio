// Admin "See as" on the school's real class lists (names altered; read from the project files, never copied into
// the repo). Starts its own clean pilot server (needs `npm run build` first) and imports the roster. Aaron Torres,
// Mr David Coultas and Ms Jane Altemen (advisor of 8C) each sign in in their own browser; the admin, in another,
// opens "See as" for each from Accounts and must see the same nav and home, with the read-only banner. A moment
// added in the preview is refused ("Preview only: nothing is saved") and the server record is unchanged; nothing
// syncs, this browser's saved record is untouched, Exit returns to Accounts and the admin's sign-in is unchanged.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-seeas-';
const AARON = 'Sabc0d6125e85', COULTAS = 'T60198', ALTEMEN = 'T25948';
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
const navOf = (p) => p.locator('.navbar .nav-measure a').allTextContents();
const screenOf = (p) => p.evaluate(() => [...document.querySelector('main.screen').classList].find((c) => c.startsWith('screen-')));

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP the real roster is not here:', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const port = await freePort(); const U = `http://localhost:${port}`;
  const DATA = fs.mkdtempSync(SH + 'data-');
  const srv = await start(port, DATA);
  const b = await chromium.launch();
  const VP = { width: 1400, height: 900 };
  const ctxOf = async (token) => { const c = await b.newContext({ viewport: VP }); await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const imp = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    const links = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    ok(imp.newAccounts.created.length > 1000, `real roster imported (${imp.newAccounts.created.length} accounts)`);
    const accounts = (await (await fetch(`${U}/api/admin/accounts`, { headers: H })).json()).accounts;
    const acc = (rec) => accounts.find((a) => a.studentId === rec || a.teacherId === rec || a.id === rec);
    const email = (id) => (roster.students.find((s) => s.id === id) || roster.teachers.find((t) => t.id === id)).email;
    const state = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json());

    // Also a coordinator from the class lists, and a parent of Aaron (made here, as a family letter would).
    const COORD = acc(roster.teachers.find((t) => t.email && acc(t.id)?.kind === 'coordinator').id).teacherId;
    const fam = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ kind: 'parent', name: 'Mrs Rosa Torres', email: 'rosa.torres@example.org', children: [AARON] }) })).json();
    const PARENT = fam.account.id; accounts.push(fam.account);
    links['rosa.torres@example.org'] = fam.setupUrl.split('/setup/')[1];

    // ── Each person in their own browser: what they see. Aaron goes through first-run so he has a home. ──
    const own = {};
    for (const id of [AARON, COULTAS, ALTEMEN, COORD, PARENT]) {
      const c = await ctxOf(await setupWith(U, links[id === PARENT ? 'rosa.torres@example.org' : email(id)])); const p = await c.newPage();
      await p.goto(`${U}/#/me`); await p.waitForSelector('.topnav');
      if (id === AARON) {
        await p.waitForSelector('.onboard');
        await p.locator('.ob-pick').nth(0).click(); await p.locator('.ob-pick').nth(1).click();
        await p.click('.ob-foot .primary'); await p.click('.ob-foot .primary');
        await p.click('text=Go to my map'); await p.waitForSelector('.simple .sh-actions');
        await p.goto(`${U}/#/me`); await p.reload(); await p.waitForSelector('.simple .sh-actions');
      } else await p.waitForSelector('main.screen');
      await p.waitForTimeout(300);
      own[id] = { nav: await navOf(p), screen: await screenOf(p), simple: await p.locator('.simple .sh-actions').count() };
      await c.close();
    }

    // ── The admin ──
    const cA = await ctxOf(adminTok); const a = await cA.newPage();
    const errs = []; a.on('pageerror', (e) => { if (e.message !== 'Preview only: nothing is saved') errs.push(e.message); });
    const sent = []; a.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/stream' || (r.method() !== 'GET' && u.pathname.startsWith('/api/'))) sent.push(`${r.method()} ${u.pathname}`); });
    await a.goto(`${U}/#/me/accounts`); await a.waitForSelector('.acc-table tbody tr');
    const saved = () => a.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('tp-store')).map((k) => [k, localStorage.getItem(k)])));
    const savedBefore = await saved();
    const cookieBefore = (await cA.cookies()).find((c) => c.name === 'tp_session').value;
    const adminNav = await navOf(a);

    const seeAs = async (id, first) => {
      const row = a.locator('.acc-table tbody tr', { hasText: acc(id).email });
      const btn = row.locator('a.acc-see');
      ok((await btn.innerText()) === `See as ${first}`, `Accounts row has "See as ${first}"`);
      sent.length = 0;
      await btn.click(); await a.waitForSelector('.pv-bar'); await a.waitForSelector('main.screen'); await a.waitForTimeout(400);
      return a.locator('.pv-bar').innerText();
    };
    const same = async (id, who) => {
      const nav = await navOf(a), screen = await screenOf(a);
      ok(JSON.stringify(nav) === JSON.stringify(own[id].nav), `${who}: preview nav is theirs (${nav.join(', ')})`);
      ok(screen === own[id].screen, `${who}: preview opens on their home (${screen})`);
    };

    // Aaron Torres, Year 8 in 8C, at his own interface level.
    const banner = await seeAs(AARON, 'Aaron');
    ok(/^Seeing the portfolio as Aaron Torres \(Year 8, 8C\)\. Read-only\.\s*Exit preview$/.test(banner.trim()), `banner: ${banner.replace(/\s+/g, ' ')}`);
    await same(AARON, 'Aaron');
    ok(await a.locator('.simple .sh-actions').count() === own[AARON].simple, 'Aaron: the same Simple home');
    ok(await a.locator('.persona-btn b').innerText() === 'Aaron Torres', 'the header shows Aaron');
    const before = await state();
    await a.click('text=Add something I did'); await a.waitForSelector('.sh-flow');
    await a.fill('.sh-input', 'Preview should not save this');
    await a.click('.sh-next .primary');
    await a.locator('.sh-lines button').first().click();
    await a.click('.sh-next .primary');
    await a.waitForSelector('text=Ask a teacher to check it?');
    await a.locator('.sh-ask').first().click();
    await a.waitForSelector('.pv-said', { timeout: 4000 }).catch(() => {});
    ok((await a.locator('.pv-said').innerText().catch(() => '')) === 'Preview only: nothing is saved', 'adding a moment says "Preview only: nothing is saved"');
    await a.waitForTimeout(600);
    const after = await state();
    ok(after.rev === before.rev && !after.snapshot.store.events.some((e) => e.title === 'Preview should not save this'), `the server record is unchanged (rev ${before.rev} → ${after.rev})`);
    ok(!sent.length, `nothing was sent or streamed during the preview${sent.length ? `: ${sent.join(', ')}` : ''}`);
    await a.screenshot({ path: SH + 'aaron.png' });
    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');
    ok(/#\/me\/accounts$/.test(a.url()) && !(await a.locator('.pv-bar').count()), 'Exit preview returns to Accounts, no banner');
    ok(JSON.stringify(await navOf(a)) === JSON.stringify(adminNav), 'the admin has their own nav again');

    // Mr David Coultas, a subject teacher.
    const bt = await seeAs(COULTAS, 'David');
    ok(bt.includes('Seeing the portfolio as Mr David Coultas') && bt.includes('Read-only.'), `banner: ${bt.replace(/\s+/g, ' ')}`);
    await same(COULTAS, 'Mr Coultas');
    ok(!sent.length, 'nothing sent or streamed');
    await a.screenshot({ path: SH + 'coultas.png' });
    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');

    // Ms Jane Altemen, Aaron's advisor: her advisory, with Aaron in it.
    const bj = await seeAs(ALTEMEN, 'Jane');
    ok(/Seeing the portfolio as Ms Jane Altemen \(.*Advisor.*8C\)\. Read-only\./.test(bj), `banner: ${bj.replace(/\s+/g, ' ')}`);
    await same(ALTEMEN, 'Ms Altemen');
    await a.goto(`${U}/#/me/advisory`); await a.waitForSelector('main.screen'); await a.waitForTimeout(400);
    ok(await a.locator('.pv-bar').count() === 1 && (await a.locator('main.screen').innerText()).includes('Aaron'), 'her advisory lists Aaron, still in preview');
    await a.screenshot({ path: SH + 'altemen.png' });
    await a.reload(); await a.waitForSelector('.pv-bar');
    ok((await a.locator('.pv-bar').innerText()).includes('Ms Jane Altemen'), 'a reload stays in the preview (this tab only)');
    ok(!sent.length, 'nothing sent or streamed');

    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');

    // A coordinator and a family.
    const coordName = acc(COORD).name;
    const bc = await seeAs(COORD, coordName.replace(/^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+/i, '').split(/\s+/)[0]);
    ok(bc.includes(`Seeing the portfolio as ${coordName}`), `banner: ${bc.replace(/\s+/g, ' ')}`);
    await same(COORD, coordName);
    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');
    const bp = await seeAs(PARENT, 'Rosa');
    ok(/Seeing the portfolio as Mrs Rosa Torres \(Family · Aaron\)\. Read-only\./.test(bp), `banner: ${bp.replace(/\s+/g, ' ')}`);
    await same(PARENT, 'Mrs Torres');
    ok((await a.locator('main.screen').innerText()).includes('Aaron'), 'the family view shows Aaron');
    ok(!sent.length, 'nothing sent or streamed');
    await a.screenshot({ path: SH + 'parent.png' });

    // A second tab of the same browser is the admin's own view.
    const a2 = await cA.newPage(); await a2.goto(`${U}/#/me/accounts`); await a2.waitForSelector('.acc-table tbody tr');
    ok(!(await a2.locator('.pv-bar').count()), 'another tab is the admin\'s own view');
    await a2.close();

    await a.click('.pv-bar button'); await a.waitForSelector('.acc-table tbody tr');
    ok(JSON.stringify(await saved()) === JSON.stringify(savedBefore), 'this browser\'s saved record was not overwritten');
    ok((await cA.cookies()).find((c) => c.name === 'tp_session').value === cookieBefore, 'the admin\'s cookie is unchanged');
    const me = await a.evaluate(() => fetch('/api/auth/me').then((r) => r.json()));
    ok(me.user?.name === 'Pat Admin' && me.user.admin, 'still signed in as the admin');
    const audit = fs.readFileSync(path.join(DATA, 'audit.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.action === 'preview');
    ok(audit.length === 6 && audit.every((l) => l.by === me.user.id) && [AARON, COULTAS, ALTEMEN, COORD, PARENT].every((id) => audit.some((l) => l.accountId === acc(id).id)), `each preview start is in the audit log (${audit.length})`);
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
