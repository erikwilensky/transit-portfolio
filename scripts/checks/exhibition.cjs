// Exhibition screens on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) with a
// short refresh (TP_EXHIBIT_REFRESH_S=3), imports the real roster and picks a class whose teacher has an account. Two of
// its students add a moment with a photo and make it publishable themselves; a third does too but turns school screens off
// in Privacy. The teacher makes a school screen for the class; a signed-out 1920x1080 screen shows the two slides moving on
// by themselves (first names and Years, no surnames, photos through the screen's token), a tablet shows it upright. The
// teacher removes one and it goes from the running screen within the refresh; offline, the screen keeps its slides; turned
// off, it says so. The activity log has the create, remove and turn off. Every account has its own browser context.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-exhibit-';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0', TP_EXHIBIT_REFRESH_S: '3' } });
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
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const email = new Map([...roster.students, ...roster.teachers].map((x) => [x.id, x.email]));
    const rec = (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${adminTok}` } })).json()).snapshot.store;
    const plain = (t) => links[email.get(t)] && roster.teachers.find((x) => x.id === t)?.roles.every((r) => r === 'teacher' || r === 'advisor');
    const kidsOf = (c) => rec.enrolments.filter((n) => n.classId === c.id && !n.to).map((n) => n.studentId).filter((id) => links[email.get(id)]).sort();
    const cls = roster.classes.find((c) => c.teacherIds?.some(plain) && kidsOf(c).length >= 3);
    const [A, B, C] = kidsOf(cls).map((id) => rec.students.find((s) => s.id === id));
    const teacher = roster.teachers.find((t) => t.id === cls.teacherIds.find(plain));
    ok(!!(A && B && C && teacher), `picked ${cls.name}: ${A?.name} (Year ${A?.grade + 1}), ${B?.name}, ${C?.name} (opts out); teacher ${teacher?.name}`);
    const first = (s) => s.name.split(' ')[0];
    const surname = (s) => s.name.split(' ').slice(1).join(' ');

    const tok = {};
    const ev = {};
    for (const [k, s, title] of [['A', A, 'Bridge out of straws'], ['B', B, 'Our river poster'], ['C', C, 'My clay owl']]) {
      tok[k] = await setupWith(U, links[email.get(s.id)]);
      await act(tok[k], 'completeOnboarding', [s.id, ['science'], 'classic']); await act(tok[k], 'setIntensity', [s.id, 'standard']);
      const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { cookie: `tp_session=${tok[k]}`, 'content-type': 'image/png', 'x-filename': 'photo.png' }, body: PNG })).json();
      ev[k] = (await (await act(tok[k], 'addStation', [s.id, { title, lineIds: ['science'], visibility: 'school', image: up.url.replace(/^\//, '') }])).json()).result;
      ok((await act(tok[k], 'setVisibility', [ev[k].id, 'publishable'])).ok, `${first(s)} made “${title}” publishable`);
    }
    await act(tok.A, 'addReflection', [{ studentId: A.id, eventId: ev.A.id, prompt: 'What went well?', text: 'It held three books before it bent. Next time I will use more triangles.', visibility: 'publishable' }]);
    tok.T = await setupWith(U, links[teacher.email]);
    const ctx = async (k, viewport = { width: 1280, height: 860 }) => {
      const c = await b.newContext({ viewport });
      if (k) await c.addCookies([{ name: 'tp_session', value: tok[k], url: U }]);
      const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); return { c, p, errs };
    };

    // ── The third student turns school screens off in Privacy ──
    const cc = await ctx('C');
    await cc.p.goto(`${U}/#/me/privacy`); await cc.p.waitForSelector('.pv-screens');
    await cc.p.locator('.pv-screens input[type=checkbox]').check();
    ok(await until(() => saved().privacy?.[C.id]?.screens === false), `${first(C)} turned school screens off (saved)`);
    ok(!cc.errs.length, 'no page errors for the student');

    // ── The teacher makes a screen for the class ──
    const t = await ctx('T');
    t.p.on('dialog', (d) => d.accept());
    await t.p.goto(`${U}/#/me/screens`); await t.p.waitForSelector('.exh-page');
    await t.p.click('text=New school screen');
    await t.p.fill('.exh-new input[maxlength="80"]', 'Open evening: our class');
    await t.p.locator('.exh-chip', { hasText: cls.name }).first().click();
    await t.p.selectOption('.exh-new select', '6');
    await t.p.screenshot({ path: SH + 'new.png' });
    await t.p.click('.exh-new button[type=submit]');
    const x = await until(() => (saved().exhibitions || [])[0]);
    ok(x && x.by === teacher.id && x.classIds.includes(cls.id) && x.seconds === 6 && x.token.length >= 32, 'saved: by the teacher, for the class, 6 seconds, a long token');
    await t.p.waitForSelector('.exh-url input');
    const url = await t.p.locator('.exh-url input').inputValue();
    ok(url.endsWith(`#/x/${x.token}`), 'the panel shows the screen’s address');
    await t.p.waitForSelector('.exh-slide');
    ok(await t.p.locator('.exh-slide').count() === 2 && !(await t.p.locator('.exh-slides').innerText()).includes('clay owl'), 'the queue: two slides, not the opted-out student’s');
    await t.p.screenshot({ path: SH + 'panel.png', fullPage: true });

    // ── A signed-out TV ──
    const tv = await ctx(null, { width: 1920, height: 1080 });
    await tv.p.goto(url); await tv.p.waitForSelector('.kx-slide.on');
    ok(await tv.p.locator('.kiosk').getAttribute('data-count') === '2', 'the TV shows two slides');
    const text = await tv.p.locator('.kiosk').innerText();
    ok(!text.includes('clay owl') && !text.includes(first(C) + ' ·'), 'the student who opted out never appears');
    const on1 = await tv.p.locator('.kx-slide.on').getAttribute('data-event');
    const shown = await tv.p.locator('.kx-slide.on').innerText();
    const who = on1 === ev.A.id ? A : B;
    ok(shown.includes(`${first(who)} · Year ${who.grade + 1}`) && !shown.includes(surname(who)), `first name and Year only (${first(who)} · Year ${who.grade + 1})`);
    ok(await until(() => tv.p.locator('.kx-slide.on img').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false)), 'the photo opens on the signed-out screen');
    ok(await tv.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'fits 1920x1080 with no scrolling');
    ok(await tv.p.locator('a, nav, button').count() === 0, 'no navigation on the screen');
    await tv.p.screenshot({ path: SH + 'tv-1.png' });
    const on2 = await until(async () => { const v = await tv.p.locator('.kx-slide.on').getAttribute('data-event'); return v !== on1 && v; }, 9000);
    ok(!!on2, 'it moves on by itself');
    await tv.p.screenshot({ path: SH + 'tv-2.png' });
    const aText = await tv.p.locator(`.kx-slide[data-event="${ev.A.id}"]`).innerText();
    ok(aText.includes('“It held three books before it bent.”') && !aText.includes('triangles'), 'one line from the publishable reflection');
    ok(!(await tv.p.content()).includes(surname(A)) && !(await tv.p.content()).includes(surname(B)), 'no surname anywhere in the page');

    // ── A tablet, upright ──
    const tab = await ctx(null, { width: 820, height: 1180 });
    await tab.p.goto(url); await tab.p.waitForSelector('.kx-slide.on');
    const box = await tab.p.locator('.kx-slide.on .kx-photo').boundingBox(), tbox = await tab.p.locator('.kx-slide.on .kx-text').boundingBox();
    ok(box && tbox && tbox.y >= box.y + box.height - 1 && await tab.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'on a tablet: photo above the words, no sideways scroll');
    await tab.p.screenshot({ path: SH + 'tablet.png' });

    // ── The teacher removes one; it goes from the running screen within the refresh ──
    await t.p.locator(`.exh-slide[data-event="${ev.A.id}"] button`).click();
    ok(await until(() => saved().exhibitions[0].removed.some((r) => r.eventId === ev.A.id && r.by === teacher.id)), 'removed: saved, by the teacher');
    ok(await until(async () => (await tv.p.locator('.kiosk').getAttribute('data-count')) === '1' && (await tv.p.locator(`.kx-slide[data-event="${ev.A.id}"]`).count()) === 0, 6000), 'the TV drops it within the refresh (3 s)');
    ok((await fetch(`${U}/api/files/${ev.A.evidence[0].url.split('/').pop()}?ex=${x.token}`)).status === 404, 'its photo no longer opens with the token');
    await act(tok.A, 'setVisibility', [ev.A.id, 'school']); await act(tok.A, 'setVisibility', [ev.A.id, 'publishable']);
    await new Promise((r) => setTimeout(r, 3500));
    ok(await tv.p.locator(`.kx-slide[data-event="${ev.A.id}"]`).count() === 0, 'a removed slide never returns');

    // ── Offline: it keeps going with what it has ──
    await tv.c.setOffline(true);
    await new Promise((r) => setTimeout(r, 4000));
    ok(await tv.p.locator('.kiosk').getAttribute('data-state') === 'offline' && await tv.p.locator('.kx-slide.on').count() === 1, 'offline: still showing its slide');
    await tv.p.screenshot({ path: SH + 'tv-offline.png' });
    await tv.c.setOffline(false);

    // ── Pause, then turn off ──
    await t.p.click('.exh-actions button:has-text("Pause")');
    ok(await until(async () => (await tv.p.locator('.kx-empty').innerText().catch(() => '')).includes('Back soon'), 8000), 'paused: the screen shows the logo and “Back soon.”');
    await t.p.click('.exh-actions button:has-text("Start again")');
    ok(await until(async () => (await tv.p.locator('.kx-slide.on').count()) === 1, 8000), 'started again');
    await t.p.click('.exh-actions button:has-text("Turn off")');
    ok(await until(() => !!saved().exhibitions[0].revoked), 'turned off: saved');
    ok((await fetch(`${U}/api/public/exhibition/${x.token}`)).status === 404, 'the address answers 404');
    ok(await until(async () => (await tv.p.locator('.kx-empty').innerText().catch(() => '')).includes('turned off'), 8000), 'the TV says it has been turned off');
    ok(await tv.p.evaluate(() => new Promise((res) => { const r = indexedDB.open('tp-exhibit', 1); r.onsuccess = () => { const q = r.result.transaction('photos').objectStore('photos').count(); q.onsuccess = () => res(q.result === 0); }; r.onerror = () => res(false); })), 'and forgets the photos it kept');
    ok(![tv, tab, t].some((x) => x.errs.length), `no page errors${[tv, tab, t].flatMap((x) => x.errs).join(' | ')}`);

    // ── Activity log ──
    const log = fs.readdirSync(dataDir).filter((f) => f.startsWith('audit-')).flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    for (const fn of ['createExhibition', 'removeExhibitionSlide', 'revokeExhibition']) ok(log.some((e) => e.fn === fn && e.result === 'ok' && e.actor?.name === teacher.name), `activity log: ${fn} by the teacher`);
    ok(!JSON.stringify(log).includes(x.token), 'the screen’s address is never in the log');
  } finally { await b.close(); srv?.p.kill(); }
})().catch((e) => { console.error(e); process.exitCode = 1; srv?.p.kill(); });
