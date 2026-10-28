// The phone app (PWA), on a phone-sized Chromium: the manifest is linked and valid, its icons load, the service
// worker registers, caches the app shell and never an /api response or uploaded file, the offline page shows
// with no network, a new deploy shows "A new version is ready", the install hint can be dismissed for good,
// #/me/snap opens straight on the photo step (full and Simple level) and carries on through the normal flow,
// and signing out (pilot) clears the caches. Needs `npm run build` first; starts its own demo and pilot servers
// on a copy of dist/ (the update test changes sw.js there).
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-phone-'));
const DIST = path.join(TMP, 'dist');
fs.cpSync(path.join(ROOT, 'dist'), DIST, { recursive: true });
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const servers = [];
function start(port, mode) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: mode, TP_START: 'empty', DIST_DIR: DIST, DATA_DIR: fs.mkdtempSync(path.join(TMP, `${mode}-`)), LOG_REQUESTS: '0' } });
    servers.push(p);
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server exited ${c}: ${out}`)); });
  });
}
const PNG = fs.readFileSync(path.join(ROOT, 'public/icons/icon-192.png'));
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
const cached = (page) => page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };

(async () => {
  const port = await freePort(); const U = `http://localhost:${port}`;
  await start(port, 'demo');
  const b = await chromium.launch();
  try {
    // ── Served right ──
    const html = await (await fetch(`${U}/`)).text();
    ok(/<link rel="manifest" href="\.\/manifest\.webmanifest"/.test(html) && /rel="apple-touch-icon"/.test(html) && /name="theme-color" content="#002855"/.test(html), 'index links the manifest, the apple touch icon and the theme colour');
    const mr = await fetch(`${U}/manifest.webmanifest`);
    ok(mr.headers.get('content-type').startsWith('application/manifest+json'), `manifest content type (${mr.headers.get('content-type')})`);
    const m = await mr.json();
    ok(m.name === 'NIST Transit Portfolio' && m.short_name === 'Transit' && m.display === 'standalone' && m.theme_color === '#002855' && m.background_color === '#002855', 'manifest name, short name, standalone, navy colours');
    ok(m.start_url === './#/' && m.scope === './', 'start_url keeps the hash router');
    ok(['Add a moment', 'Take a photo'].every((n) => m.shortcuts.some((s) => s.name === n)) && m.shortcuts.some((s) => s.url.endsWith('#/me/snap')), 'shortcuts: Add a moment, Take a photo (#/me/snap)');
    for (const want of ['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']) {
      const [size, purpose] = want.split(' ');
      const ic = m.icons.find((i) => i.sizes === size && i.purpose === purpose);
      const r = ic && await fetch(new URL(ic.src, `${U}/manifest.webmanifest`));
      const buf = r && Buffer.from(await r.arrayBuffer());
      ok(r?.ok && r.headers.get('content-type') === 'image/png' && pngSize(buf).join('x') === size, `icon ${want} loads as a ${size} PNG`);
    }
    const at = await fetch(`${U}/icons/apple-touch-icon.png`);
    ok(at.ok && pngSize(Buffer.from(await at.arrayBuffer())).join('x') === '180x180', 'apple touch icon 180x180');
    const sw = await fetch(`${U}/sw.js`);
    const swText = await sw.text();
    ok(sw.headers.get('content-type').startsWith('text/javascript') && sw.headers.get('cache-control') === 'no-cache', `sw.js: javascript, Cache-Control no-cache (${sw.headers.get('cache-control')})`);
    ok(!/const VERSION = 'dev'/.test(swText) && /const SHELL = \["assets\//.test(swText), 'sw.js carries this build\'s version and shell');
    ok((await fetch(`${U}/offline.html`)).headers.get('cache-control') === 'no-cache', 'offline page revalidated');

    // ── On a phone ──
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${U}/#/maya/map`);
    ok(await page.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active)), 'service worker registers and activates');
    await until(() => page.evaluate(() => !!navigator.serviceWorker.controller));
    ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
    // Personal data through the worker: the record, sign-in state, an uploaded photo (by fetch and as an <img>).
    const up = await page.evaluate(async (bytes) => {
      await fetch('/api/state'); await fetch('/api/auth/me');
      const r = await fetch('/api/upload', { method: 'POST', headers: { 'content-type': 'image/png', 'x-filename': 'me.png' }, body: new Uint8Array(bytes) });
      const j = await r.json();
      await fetch(j.url); await fetch(j.url);
      await new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = j.url; document.body.append(i); });
      return j.url;
    }, [...PNG]);
    ok(/^\/api\/files\//.test(up), `uploaded a photo (${up})`);
    await page.reload(); await page.waitForSelector('.topnav');
    await page.evaluate(() => fetch('/api/state'));
    const keys = await cached(page);
    ok(keys.length > 0 && keys.some((k) => k.startsWith('/assets/')) && keys.includes('/offline.html'), `app shell cached (${keys.length} entries)`);
    ok(!keys.some((k) => k.includes('/api/')), 'no /api response or uploaded file in any cache');
    const fromSw = []; page.on('response', (r) => { if (r.url().includes('/assets/') && r.fromServiceWorker()) fromSw.push(r.url()); });
    await page.reload(); await page.waitForSelector('.topnav');
    ok(fromSw.length > 0, `assets served by the service worker on reload (${fromSw.length})`);

    // ── Install hint ──
    ok(await page.isVisible('.pa-hint'), 'install hint shows for a student on a phone');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'hint.png') });
    ok(/Add to Home screen|Install/.test(await page.textContent('.pa-hint')), 'hint says how to add it');
    await page.click('.pa-hint .pa-x');
    await page.reload(); await page.waitForSelector('.topnav');
    ok(!(await page.isVisible('.pa-hint')), 'dismissed hint stays gone after a reload');
    const desk = await b.newPage(); await desk.goto(`${U}/#/maya/map`); await desk.waitForSelector('.topnav');
    ok(!(await desk.isVisible('.pa-hint')), 'no install hint on a desktop');
    await desk.close();
    const ip = await b.newContext({ ...devices['iPhone 13'] }); const ipp = await ip.newPage();
    await ipp.goto(`${U}/#/lena/map`); await ipp.waitForSelector('.pa-hint');
    ok((await ipp.textContent('.pa-hint')).includes('Add to Home Screen'), 'iPhone: Share → Add to Home Screen');
    await ip.close();

    // ── Quick camera: #/me/snap ──
    await page.goto(`${U}/#/me/snap`);
    await page.waitForSelector('.sh-flow h2');
    ok((await page.textContent('.sh-flow h2')) === 'Take a photo', 'snap opens on the photo step (full-level student)');
    ok(await page.locator('.sh-flow input[type=file][capture=environment]').count() === 1, 'camera input with capture=environment');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'snap.png') });
    await page.setInputFiles('.sh-flow input[capture=environment]', { name: 'snap.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('.sh-preview img');
    const src = await page.getAttribute('.sh-preview img', 'src');
    ok(/(^|\/)api\/files\//.test(src), `photo uploaded, then asks what it was (${src})`);
    await page.fill('.sh-flow input.sh-input', 'Robotics build night');
    await page.click('.sh-flow .sh-next .primary');
    await page.click('.sh-lines button >> nth=0');
    await page.waitForSelector('.sh-flow textarea');
    await page.fill('.sh-flow textarea', 'I learned to wire a motor.');
    await page.click('.sh-flow .sh-next .primary');
    if (await page.isVisible('.sh-notnow')) { ok(true, 'offers to ask a teacher'); await page.click('.sh-notnow'); }
    await page.waitForSelector('.toast.show');
    ok((await page.textContent('.toast')).includes('Robotics build night'), 'moment added: toast');
    ok(await page.evaluate(() => location.hash) === '#/maya/map', `back on the map (${await page.evaluate(() => location.hash)})`);
    ok(!(await cached(page)).some((k) => k.includes('/api/')), 'still no /api entry in any cache after the photo was shown');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'after-snap.png') });
    await page.goto(`${U}/#/lena/snap`);
    await page.waitForSelector('.sh-flow h2');
    ok((await page.textContent('.sh-flow h2')) === 'Take a photo', 'snap opens on the photo step (Standard-level student)');
    await page.click('.sh-flow .panel-close');
    const vp = page.viewportSize(); await page.setViewportSize({ width: 1280, height: 800 }); // the level switch is in the wide header
    await page.goto(`${U}/#/maya/map`); await page.click('.intensity >> text=Simple'); await page.waitForSelector('.sh-card.add');
    await page.setViewportSize(vp);
    await page.goto(`${U}/#/me/snap`);
    await page.waitForSelector('.sh-flow h2');
    ok((await page.textContent('.sh-flow h2')) === 'Take a photo' && await page.locator('.sh-card.add').count() === 1, 'snap opens on the photo step (Simple level, over the Simple home)');
    await page.click('text=No photo, just write it');
    ok(await page.isVisible('.sh-flow input.sh-input'), 'no photo: straight to what you did');
    await page.goto(`${U}/#/me/add`);
    await page.waitForSelector('.sh-flow h2');
    ok((await page.textContent('.sh-flow h2')) === 'What did you do?', '#/me/add opens the add flow');
    await page.goto(`${U}/#/nair/snap`); await page.waitForSelector('.topnav');
    ok(await page.locator('.sh-flow').count() === 0, 'not for staff: snap goes to their home');
    ok(!errs.length, `no page errors ${errs.join(' | ')}`);

    // ── A new deploy ──
    await page.goto(`${U}/#/maya/map`); await page.waitForSelector('.topnav');
    fs.appendFileSync(path.join(DIST, 'sw.js'), '\n// next deploy\n');
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await page.waitForSelector('.pa-update', { timeout: 10000 }).catch(() => {});
    ok((await page.textContent('.pa-update').catch(() => '')).includes('A new version is ready'), 'new deploy: "A new version is ready" with Reload');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'update.png') });

    // ── Offline ──
    await ctx.setOffline(true);
    await page.goto(`${U}/`).catch(() => {});
    ok((await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ').includes("You're offline. Your moments will be here when you're back."), 'offline page when there is no network');
    ok(await page.evaluate(() => document.querySelector('img')?.naturalWidth === 192), 'offline page shows the icon from the cache');
    if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'offline.png') });
    await ctx.setOffline(false);
    await ctx.close();

    // ── Pilot: signing out clears the caches ──
    const pport = await freePort(); const P = `http://localhost:${pport}`;
    const srv = await start(pport, 'pilot');
    const r = await fetch(`${P}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' }) });
    const tok = r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
    const pc = await b.newContext({ ...devices['Pixel 7'] });
    await pc.addCookies([{ name: 'tp_session', value: tok, url: P }]);
    const pp = await pc.newPage();
    await pp.goto(`${P}/`); await pp.waitForSelector('.persona-btn');
    await pp.evaluate(() => navigator.serviceWorker.ready);
    await pp.evaluate(async () => (await caches.open('tp-sentinel')).put('/sentinel', new Response('x')));
    await pp.click('.persona-btn'); await pp.click('.sign-out'); await pp.waitForSelector('.auth-card h1');
    ok(!(await cached(pp)).includes('/sentinel') && !(await pp.evaluate(() => caches.keys())).includes('tp-sentinel'), 'sign-out cleared the caches');
    await pc.close();
  } finally {
    await b.close();
    servers.forEach((p) => p.kill());
    fs.rmSync(TMP, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; servers.forEach((p) => p.kill()); });
