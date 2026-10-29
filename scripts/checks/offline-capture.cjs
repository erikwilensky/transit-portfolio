// Offline capture on the phone, on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build`
// first) and imports the real roster. Aaron Torres (Year 8, Simple level) on a phone-sized context goes offline, adds a
// moment with a photo and asks Mr David Coultas to check it, reloads while still offline (the app opens, the moment
// and its photo are there, "Saved on this phone"), comes back online: the photo uploads first, the moment follows with
// the real address, and Mr Coultas, in his own context, sees the moment and opens the photo. Then: signing out with
// changes not sent warns first ("1 change is not sent yet. Sign out anyway?") and clears only on yes; and a second
// account signing in on the same browser never sends Aaron's queue (neither in his open tab nor in a fresh one),
// which goes when Aaron is back. TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-offline-*.png.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(os.tmpdir(), 'tp-offline-');
const AARON = 'Sabc0d6125e85', TID = 'T60198', CLASS = 'C-392000';
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
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// What is waiting in this browser's IndexedDB (src/outbox.js), without the photo bytes.
const held = (page) => page.evaluate(() => new Promise((ok) => {
  const r = indexedDB.open('tp-outbox', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'k', autoIncrement: true }).createIndex('uid', 'uid');
  r.onsuccess = () => { const g = r.result.transaction('items').objectStore('items').getAll(); g.onsuccess = () => { ok(g.result.map(({ blob, ...x }) => ({ ...x, blob: !!blob }))); r.result.close(); }; };
  r.onerror = () => ok(null);
}));
const cached = (page) => page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname + new URL(r.url).search); return out; });

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const titled = (t) => saved().events.find((e) => e.studentId === AARON && e.title === t);
  const photoOf = (e) => e?.evidence?.find((x) => x.kind === 'image')?.url || e?.image || '';
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const aaron = roster.students.find((s) => s.id === AARON), coultas = roster.teachers.find((t) => t.id === TID);
    const other = roster.students.find((s) => s.id !== AARON && links[s.email] && s.year >= 10);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]), oTok = await setupWith(U, links[other.email]);
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    ok((await act(sTok, 'completeOnboarding', [AARON, ['science', 'sport'], null])).ok, `${aaron.name} (Year ${aaron.year}) has picked his lines; ${coultas.name} teaches him; ${other.name} is another student`);
    const phone = async (tok) => {
      const c = await b.newContext({ ...devices['Pixel 7'] });
      await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      return c;
    };
    const open = async (c, hash = '#/me/map') => {
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${U}/${hash}`); await p.waitForSelector('.topnav');
      return p;
    };
    // The Simple add flow (#/me/snap or #/me/add). photo: a PNG buffer for the camera step; ask: a teacher's surname.
    const addMoment = async (p, title, { photo, ask } = {}) => {
      await p.evaluate((h) => { location.hash = h; }, photo ? '#/me/snap' : '#/me/add');
      await p.waitForSelector('.sh-flow h2');
      if (photo) {
        await p.setInputFiles('.sh-flow input[capture=environment]', { name: 'bridge.png', mimeType: 'image/png', buffer: photo });
        await p.waitForSelector('.sh-preview img');
      }
      await p.fill('.sh-flow input.sh-input', title);
      await p.click('.sh-flow .sh-next .primary');
      await p.click('.sh-lines button:has-text("Science")');
      await p.fill('.sh-flow textarea', 'We tested it until it held.');
      await p.click('.sh-flow .sh-next .primary');
      if (await p.isVisible('.sh-who')) {
        if (ask && await p.locator(`.sh-ask:has-text("${ask}")`).count() === 0) await p.click('.sh-ask.other:has-text("Someone else")');
        if (ask) await p.click(`.sh-ask:has-text("${ask}")`); else await p.click('.sh-notnow');
      }
      await p.waitForSelector('.toast.show');
    };
    const PNG = fs.readFileSync(path.join(ROOT, 'public/icons/icon-192.png'));
    const surname = coultas.name.split(' ').at(-1);

    // ── Aaron, on his phone: the app is ready for offline (the worker keeps the page once he is signed in) ──
    const cA = await phone(sTok);
    let a = await open(cA);
    await a.waitForSelector('.simple .sh-actions');
    await until(() => a.evaluate(() => !!navigator.serviceWorker.controller));
    ok(await until(async () => (await cached(a)).includes('/?shell')), 'signed in: the service worker keeps the app page for offline');
    ok(!(await cached(a)).some((k) => k.includes('/api/')), 'and still never an /api response');

    // ── Offline: a moment with a photo ──
    await cA.setOffline(true);
    await addMoment(a, 'Bridge that held 5 kg', { photo: PNG, ask: surname });
    ok(true, `added offline, asking ${coultas.name} to check it`);
    await a.waitForSelector('.ob-bar');
    const bar = await a.innerText('.ob-bar');
    ok(bar === 'Saved on this phone. It will send when you are back online.', `Simple, plain words: "${bar}"`);
    ok((await a.innerText('.sync-state')).includes('Saved on this phone'), `header: "${await a.innerText('.sync-state')}"`);
    let rows = await held(a);
    ok(rows.length === 2 && rows[0].upload && rows[0].blob && /addStation/.test(rows[1].body) && /#tpq-/.test(rows[1].body) && rows.every((r) => r.uid === rows[0].uid), `kept on the phone in order: the photo, then the moment that names it (${rows.length})`);
    const aaronUid = rows[0]?.uid;
    ok(!titled('Bridge that held 5 kg'), 'nothing on the server yet');
    await a.screenshot({ path: SH + 'offline-added.png' });

    // ── Reload, still offline ──
    await wait(400);
    await a.reload(); await a.waitForSelector('.topnav');
    ok(await a.isVisible('.simple .sh-actions'), 'reloaded with no connection: the app opens, signed in as Aaron');
    ok(await until(async () => (await a.innerText('.ob-bar').catch(() => '')).includes('Saved on this phone')), 'still shown as waiting after the reload');
    const local = await a.evaluate(() => globalThis.__tpRecord?.().events.find((e) => e.title === 'Bridge that held 5 kg'));
    const localPhoto = local?.evidence?.find((x) => x.kind === 'image')?.url || local?.image || '';
    ok(/^blob:.+#tpq-/.test(localPhoto), `the moment is on this phone's copy, its photo from a placeholder (${localPhoto.slice(0, 24)}…)`);
    const shows = await a.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok('error'); i.src = u; }), localPhoto);
    ok(shows > 0, `the placeholder photo still shows after the reload (${shows}px wide)`);
    ok((await held(a)).length === 2, 'both still kept');
    await a.screenshot({ path: SH + 'offline-reloaded.png' });

    // ── Back online ──
    await cA.setOffline(false);
    const ev = await until(() => { const e = titled('Bridge that held 5 kg'); return e && /^api\/files\//.test(photoOf(e)) ? e : null; }, 15000);
    ok(!!ev, `sent when back: the moment has the uploaded photo (${photoOf(ev)})`);
    ok(ev?.requestFrom === TID || saved().endorsements?.some((n) => n.eventId === ev?.id && n.teacherId === TID) || saved().requests?.some?.((r) => r.eventId === ev?.id), `${coultas.name} is asked to check it`);
    ok(await until(async () => (await held(a)).length === 0), 'nothing left waiting on the phone');
    ok(await until(async () => !(await a.isVisible('.ob-bar'))), 'the waiting note goes');
    ok(await until(() => a.evaluate((img) => globalThis.__tpRecord?.().events.some((e) => e.title === 'Bridge that held 5 kg' && JSON.stringify(e).includes(img)), photoOf(ev))), 'the phone takes the server copy, with the real address');

    // ── Mr Coultas, in his own context ──
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me/classes/${CLASS}~${AARON}`); await t.waitForSelector('.mc-read');
    await t.locator('.metro .station[aria-label^="Bridge that held 5 kg"]').first().click();
    await t.waitForSelector('.station-panel.open img');
    ok(await until(() => t.evaluate((src) => [...document.querySelectorAll('.station-panel.open img')].some((i) => i.getAttribute('src') === src && i.complete && i.naturalWidth > 0), photoOf(ev))), `${coultas.name} sees the moment and its photo`);
    await t.screenshot({ path: SH + 'teacher.png' });

    // ── Signing out with changes not sent ──
    await cA.setOffline(true);
    await addMoment(a, 'Practice match');
    let dialog = null;
    a.once('dialog', (d) => { dialog = d.message(); d.dismiss(); });
    await a.click('.persona-btn'); await a.click('.sign-out');
    await until(() => dialog);
    ok(dialog === '1 change is not sent yet. Sign out anyway?', `warned: "${dialog}"`);
    await wait(300);
    ok(await a.isVisible('.topnav') && (await held(a)).length === 1, 'No: still signed in, the change still waiting');
    await addMoment(a, 'Second practice');
    dialog = null;
    a.once('dialog', (d) => { dialog = d.message(); d.accept(); });
    await a.click('.persona-btn'); await a.click('.sign-out');
    await until(() => dialog);
    ok(dialog === '2 changes are not sent yet. Sign out anyway?', `warned again: "${dialog}"`);
    await wait(1000);
    await cA.setOffline(false);
    const back = await open(cA); await wait(2500);
    ok((await held(back)).length === 0, 'Yes: this account’s waiting changes are cleared from the phone');
    ok(!titled('Practice match') && !titled('Second practice'), 'and never reach the server');
    await cA.close();

    // ── Another account on the same browser ──
    const cS = await phone(sTok);
    const p1 = await open(cS);
    await until(() => p1.evaluate(() => !!navigator.serviceWorker.controller));
    await cS.setOffline(true);
    await addMoment(p1, 'Secret plan');
    ok((await held(p1)).length === 1, 'Aaron, offline in his tab: one change waiting');
    // Someone else signs in on this browser (another tab) while Aaron's tab is still offline.
    await cS.addCookies([{ name: 'tp_session', value: oTok, url: U }]);
    await cS.setOffline(false);
    await p1.waitForSelector('.rf-bar', { timeout: 15000 }).catch(() => {});
    const rf = await p1.innerText('.rf-bar').catch(() => '');
    ok(rf.includes(`signed in as ${other.name}`) && rf.includes('wait on this device'), `Aaron's tab does not send it under ${other.name}: "${rf.slice(0, 90)}"`);
    await wait(1500);
    ok(!saved().events.some((e) => e.title === 'Secret plan'), 'not on the server, under anyone');
    await p1.close();
    const p2 = await open(cS);
    await wait(2500);
    ok(!saved().events.some((e) => e.title === 'Secret plan'), `${other.name}, fresh on the same browser: Aaron's queue is not sent`);
    ok(!(await p2.isVisible('.ob-bar')), `${other.name} has nothing waiting`);
    rows = await held(p2);
    ok(rows.length === 1 && rows[0].uid === aaronUid, 'Aaron’s change stays on the device, under his account');
    await p2.close();
    // Aaron signs in again on this browser: his change goes, as his.
    await cS.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
    const p3 = await open(cS);
    ok(!!await until(() => titled('Secret plan'), 10000), 'Aaron back: his waiting change is sent, under his account');
    ok(await until(async () => (await held(p3)).length === 0), 'and nothing is left waiting');
    await cS.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally {
    await b.close();
    srv?.p.kill();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; srv?.p.kill(); });
