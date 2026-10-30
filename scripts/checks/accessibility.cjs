// Readability and accessibility: axe-core (devDependency) over the main screens, in the demo and in a clean pilot on the
// real class lists (TP_ROSTER, default the project mount; the pilot half is skipped without it), each account in its own
// browser context: student (Simple, Standard, Full home and map, station panel, add flows), teacher (queue, My classes,
// This week), advisor (My advisory, a student, This week), parent (family view) and admin (Accounts). Fails on serious or
// critical violations, in normal and in high contrast. Keyboard only: a student at Simple adds a moment and asks a
// teacher; that teacher endorses it. Display options: kept per device in the demo and per account in the pilot; print
// ignores size and contrast; the metro map's labels keep their size. Needs `npm run build` first. Screenshots: tp-a11y-*.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const TMP = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-a11y-'));
const AARON = 'Sabc0d6125e85', ADVISOR = 'T25948', TEACHER = 'T60198';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const servers = [];
function start(port, mode) {
  return new Promise((resolve, reject) => {
    const dataDir = fs.mkdtempSync(path.join(TMP, `${mode}-`));
    const env = { ...process.env, PORT: String(port), TP_MODE: mode, DATA_DIR: dataDir, LOG_REQUESTS: '0', ...(mode === 'pilot' ? { TP_START: 'empty' } : {}) };
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env });
    servers.push(p);
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup, dataDir }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const settle = (p) => p.waitForTimeout(500);

// axe over the page as it is now; again for colour contrast with high contrast on. Serious and critical fail.
const summary = {};
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const run = (opts) => p.evaluate((o) => window.axe.run(document, o).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => `${n.target.join(' ')}${n.any[0]?.message ? ` (${n.any[0].message})` : ''}`) }))), opts);
  const base = await run({ resultTypes: ['violations'] });
  const hc = await p.evaluate(() => document.documentElement.classList.contains('a11y-contrast'));
  await p.evaluate(() => document.documentElement.classList.add('a11y-contrast'));
  const high = (await run({ runOnly: ['color-contrast'], resultTypes: ['violations'] })).map((v) => ({ ...v, id: `${v.id} (high contrast)` }));
  if (!hc) await p.evaluate(() => document.documentElement.classList.remove('a11y-contrast'));
  const all = [...base, ...high];
  const bad = all.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of all) summary[`${v.impact} ${v.id}`] = (summary[`${v.impact} ${v.id}`] || 0) + 1;
  ok(!bad.length, `axe: ${label}${bad.length ? `\n${bad.map((v) => `    ${v.impact} ${v.id}: ${v.help}\n${v.nodes.slice(0, 4).map((n) => `      ${n}`).join('\n')}`).join('\n')}` : ''}`);
  const minor = all.filter((v) => !bad.includes(v));
  if (minor.length) console.log(`INFO ${label}: ${minor.map((v) => `${v.impact} ${v.id}×${v.nodes.length}`).join(', ')}`);
}
// Tabs (or Shift+Tabs) until the focused element matches; false after `max` presses.
async function tabTo(p, test, { max = 80, back = false } = {}) {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    if (await p.evaluate(test)) return true;
  }
  return false;
}
const focusRing = (p) => p.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return el !== document.body && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
const noScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p, who) => { p.on('pageerror', (e) => errs.push(`${who}: ${e.message}`)); return p; };
  try {
    // ── Demo ──
    const dport = await freePort(); const D = `http://localhost:${dport}`;
    await start(dport, 'demo');
    const dctx = await b.newContext({ viewport: { width: 1300, height: 860 } });
    const d = watch(await dctx.newPage(), 'demo');
    const at = async (hash, sel) => { await d.goto(`${D}/#/${hash}`); await d.waitForSelector(sel, { timeout: 15000 }); await settle(d); };
    await at('pim/map', '.onboard'); await audit(d, 'demo student, first-time setup');
    await d.locator('.ob-pick').nth(0).click(); await d.locator('.ob-pick').nth(2).click();
    for (let i = 0; i < 6 && !await d.locator('.simple').count(); i++) await d.click('.ob-foot .primary:enabled', { timeout: 10000 }).catch(() => {});
    await d.waitForSelector('.simple .sh-actions'); await settle(d); await audit(d, 'demo student, Simple home');
    await d.click('.sh-card.add'); await d.waitForSelector('.sh-flow'); await settle(d); await audit(d, 'demo student, Simple add flow'); await d.keyboard.press('Escape');
    ok(await d.locator('.sh-flow').count() === 0 && await d.evaluate(() => document.activeElement?.classList.contains('add')), 'Escape closes the Simple add flow and focus returns to its button');
    await at('lena/map', 'svg.metro .station'); await audit(d, 'demo student, Standard map');
    await d.locator('svg.metro .station[role="button"]').first().focus(); await d.keyboard.press('Enter');
    await d.waitForSelector('.station-panel.open'); await settle(d); await audit(d, 'demo student, station panel');
    await d.keyboard.press('Escape'); ok(await d.locator('.station-panel.open').count() === 0, 'Escape closes the station panel');
    await d.locator('button.primary', { hasText: 'Add a station' }).click(); await d.waitForSelector('.modal-back'); await settle(d);
    await audit(d, 'demo student, Standard add a station');
    ok(await d.evaluate(() => document.querySelector('.modal-back').contains(document.activeElement)), 'focus moves into the add dialog');
    await d.keyboard.press('Escape'); await settle(d);
    ok(await d.locator('.modal-back').count() === 0 && await d.evaluate(() => /Add a station/.test(document.activeElement?.textContent || '')), 'Escape closes it and focus returns to "Add a station"');
    await at('maya/map', 'svg.metro .station'); await audit(d, 'demo student, Full map');
    await at('nair/queue', '.q-card'); await audit(d, 'demo teacher, queue');
    await at('whitfield/advisory', 'main h1'); await audit(d, 'demo advisor, My advisory');
    await at('whitfield/student/st-01', 'main h1'); await audit(d, 'demo advisor, a student');
    await at('parent', 'main h1'); await audit(d, 'demo family view');
    // Dark theme, normal and high contrast.
    const dk = await b.newContext({ viewport: { width: 1300, height: 860 }, colorScheme: 'dark' }); const k = watch(await dk.newPage(), 'demo dark');
    for (const [hash, sel] of [['pim/map', '.sh-actions'], ['lena/map', 'svg.metro .station'], ['nair/queue', '.q-card'], ['whitfield/advisory', 'main h1'], ['parent', 'main h1']]) {
      await k.goto(`${D}/#/${hash}`); await k.waitForSelector(sel); await settle(k); await audit(k, `demo ${hash}, dark`);
    }
    await dk.close();
    // Skip link: the first Tab, and Enter lands in the main content.
    await d.goto(`${D}/#/pim/map`); await d.reload(); await d.waitForSelector('.sh-actions'); await d.keyboard.press('Tab');
    ok(await d.evaluate(() => document.activeElement.classList.contains('skip-link')) && await focusRing(d), 'the first Tab shows "Skip to content", with a focus ring');
    await d.keyboard.press('Enter'); ok(await d.evaluate(() => document.activeElement.id === 'main'), 'Enter moves to the main content');

    // Display options, per device in the demo: chosen by keyboard in the display menu.
    await d.goto(`${D}/#/pim/map`); await d.waitForSelector('.sh-actions');
    await d.locator('.view-btn').focus(); await d.keyboard.press('Enter'); await d.waitForSelector('.view-menu');
    await audit(d, 'demo display menu');
    const pick = async (group, label) => { await d.locator(`.view-menu [role="radiogroup"][aria-label="${group}"] [role="radio"]`, { hasText: label }).focus(); await d.keyboard.press('Enter'); };
    const before = await d.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sh-hello') || document.body).fontSize));
    await pick('Text size', 'Larger'); await pick('High contrast', 'On'); await pick('Easy-read font', 'On'); await pick('Reduce motion', 'On');
    const cls = await d.evaluate(() => document.documentElement.className);
    ok(['a11y-larger', 'a11y-contrast', 'a11y-font', 'a11y-calm'].every((c) => cls.includes(c)), `classes on <html>: ${cls}`);
    const after = await d.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sh-hello') || document.body).fontSize));
    ok(Math.abs(after / before - 1.3) < 0.02, `Larger text: ${before}px → ${after}px`);
    ok(await d.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Atkinson')), 'the easy-read font is in use');
    await d.evaluate(() => document.fonts.ready);
    ok(await d.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"')), 'and it loads from the app itself (works offline)');
    ok(await d.locator('.view-menu [aria-checked="true"]', { hasText: 'Larger' }).count() === 1, 'the choice shows as checked');
    await d.keyboard.press('Escape'); await settle(d);
    ok(await d.locator('.view-menu').count() === 0 && await d.evaluate(() => document.activeElement?.classList.contains('view-btn')), 'Escape closes the display menu, focus back on its button');
    await d.setViewportSize({ width: 390, height: 820 }); await settle(d);
    ok(await noScroll(d), 'Simple home at Larger, phone width: no sideways scroll');
    await d.screenshot({ path: path.join(TMP, 'demo-simple-larger.png') });
    await audit(d, 'demo Simple home, Larger, high contrast, easy-read, phone width');
    await d.setViewportSize({ width: 1300, height: 860 });
    await d.reload(); await d.waitForSelector('.sh-actions');
    ok((await d.evaluate(() => document.documentElement.className)).includes('a11y-larger'), 'kept on this device after a reload');
    await d.goto(`${D}/#/lena/map`); await d.waitForSelector('svg.metro .station'); await settle(d);
    const mapLabel = await d.evaluate(() => getComputedStyle(document.querySelector('svg.metro .grade-label, svg.metro text')).fontSize);
    await d.screenshot({ path: path.join(TMP, 'demo-map-larger.png') });
    await d.emulateMedia({ media: 'print' });
    const print = await d.evaluate(() => ({ size: getComputedStyle(document.body).fontSize, bg: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() }));
    ok(print.size === '15px' && print.bg === '#56627a', `print ignores text size and contrast (${print.size}, --muted ${print.bg})`);
    await d.emulateMedia({ media: 'screen' });
    const c2 = await b.newContext({ reducedMotion: 'reduce' }); const d2 = watch(await c2.newPage(), 'demo 2');
    await d2.goto(`${D}/#/lena/map`); await d2.waitForSelector('svg.metro .station');
    const cls3 = await d2.evaluate(() => document.documentElement.className);
    ok(!/a11y-(large|contrast|font)/.test(cls3), `another device keeps its own (normal) display (${cls3})`);
    ok(cls3.includes('a11y-calm'), 'Reduce motion follows the device setting by default');
    const mapLabel2 = await d2.evaluate(() => getComputedStyle(document.querySelector('svg.metro .grade-label, svg.metro text')).fontSize);
    ok(mapLabel === mapLabel2, `the metro map's labels keep their size (${mapLabel} at Larger, ${mapLabel2} normal)`);
    await c2.close(); await dctx.close();

    // ── Pilot, the real class lists ──
    if (!fs.existsSync(ROSTER)) { console.log('SKIP pilot: no roster file at', ROSTER); return; }
    const port = await freePort(); const U = `http://localhost:${port}`;
    const srv = await start(port, 'pilot');
    const saved = () => JSON.parse(fs.readFileSync(path.join(srv.dataDir, 'state.json'), 'utf8')).store;
    const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json().catch(() => ({})) }; };
    const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
    const setup = async (token, extra = {}) => cookieOf((await post('/api/auth/setup', { token, password: 'pilot-pass-123', ...extra })).r);
    const act = (tok, fn, args) => post('/api/action', { fn, args, rec: [] }, tok).then((x) => x.r.ok);
    const adminTok = await setup(srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(ij.newAccounts?.created.length > 900, `real roster imported (${ij.newAccounts?.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const email = new Map([...roster.students, ...roster.teachers].map((x) => [x.id, x.email]));
    const tokOf = (id) => setup(links[email.get(id)]);
    // Students at each level: Aaron (Year 8, Simple), one at Standard and one at Full, with a moment or two each.
    const byYear = (y) => roster.students.find((s) => s.year === y && links[s.email]);
    const std = byYear(10), full = byYear(12);
    const aTok = await tokOf(AARON), sTok = await tokOf(std.id), fTok = await tokOf(full.id);
    for (const [tok, s, level] of [[aTok, AARON, 'simple'], [sTok, std.id, 'standard'], [fTok, full.id, 'full']]) {
      ok(await act(tok, 'completeOnboarding', [s, ['science', 'art'], 'classic']) && await act(tok, 'setIntensity', [s, level]), `${s} set up at ${level}`);
    }
    for (const [tok, s] of [[sTok, std.id], [fTok, full.id]]) await act(tok, 'addStation', [s, { title: 'Science fair poster', type: 'project', lineIds: ['science'], summary: 'A poster on bridges.', visibility: 'school' }]);
    const ctxFor = async (tok, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); return c; };
    const open = async (c, hash, sel, who) => { const p = c.pages()[0] || watch(await c.newPage(), who); await p.goto(`${U}/#/me/${hash}`); await p.waitForSelector(sel, { timeout: 20000 }); await settle(p); return p; };

    // Standard and Full students.
    const cStd = await ctxFor(sTok); let p = await open(cStd, 'map', 'svg.metro .station', 'standard');
    await audit(p, 'pilot student, Standard map');
    await p.locator('svg.metro .station[role="button"]').first().focus(); await p.keyboard.press('Enter'); await p.waitForSelector('.station-panel.open'); await settle(p);
    await audit(p, 'pilot student, station panel'); await cStd.close();
    const cFull = await ctxFor(fTok); p = await open(cFull, 'map', 'svg.metro .station', 'full'); await audit(p, 'pilot student, Full map'); await cFull.close();

    // Aaron at Simple: display options on his account, then keyboard only, add a moment and ask his science teacher.
    const cA = await ctxFor(aTok); const a = await open(cA, 'map', '.simple .sh-actions', 'aaron');
    await audit(a, 'pilot student, Simple home');
    ok(await tabTo(a, () => document.activeElement?.classList.contains('view-btn')), 'keyboard: Tab reaches Display settings');
    await a.keyboard.press('Enter'); await a.waitForSelector('.view-menu');
    ok(await tabTo(a, () => document.activeElement?.getAttribute('role') === 'radio' && document.activeElement.textContent === 'Large' && document.activeElement.closest('[aria-label="Text size"]')), 'keyboard: Tab reaches Text size, Large');
    await a.keyboard.press('Enter');
    ok(await tabTo(a, () => document.activeElement?.textContent === 'On' && !!document.activeElement.closest('[aria-label="High contrast"]')), 'keyboard: Tab reaches High contrast, On');
    await a.keyboard.press('Enter');
    const shown = await until(async () => (await (await fetch(`${U}/api/auth/me`, { headers: { cookie: `tp_session=${aTok}` } })).json()).user.display);
    ok(shown?.size === 'large' && shown.contrast === true && shown.font === false && shown.motion === 'auto', `saved on Aaron's account: ${JSON.stringify(shown)}`);
    await a.keyboard.press('Escape');
    const cA2 = await ctxFor(aTok, { width: 390, height: 820 }); const a2 = await open(cA2, 'map', '.simple .sh-actions', 'aaron 2');
    const cls2 = await a2.evaluate(() => document.documentElement.className);
    ok(cls2.includes('a11y-large') && cls2.includes('a11y-contrast'), `his second device shows them too (${cls2})`);
    ok(await noScroll(a2), 'Simple home at Large on his phone: no sideways scroll');
    await a2.screenshot({ path: path.join(TMP, 'pilot-simple-large-phone.png') }); await cA2.close();
    await a.reload(); await a.waitForSelector('.sh-actions'); await settle(a);
    await audit(a, 'pilot student, Simple home, Large and high contrast');

    await a.evaluate(() => document.activeElement?.blur());
    ok(await tabTo(a, () => document.activeElement?.classList.contains('sh-card') && document.activeElement.classList.contains('add')), 'keyboard: Tab reaches "Add something I did"');
    ok(await focusRing(a), 'with a visible focus ring');
    await a.keyboard.press('Enter'); await a.waitForSelector('.sh-flow'); await settle(a);
    await audit(a, 'pilot student, Simple add flow');
    ok(await a.evaluate(() => document.activeElement?.classList.contains('sh-input')), 'focus starts in "What did you do?"');
    await a.keyboard.type('Built a bridge out of straws'); await a.keyboard.press('Enter');
    await a.waitForSelector('.sh-lines');
    ok(await a.evaluate(() => document.querySelector('.sh-flow').contains(document.activeElement)), 'next step: focus stays in the dialog');
    ok(await tabTo(a, () => document.activeElement?.closest('.sh-lines') && document.activeElement.textContent.includes('Science'), { max: 20 }), 'keyboard: Tab reaches the Science line');
    await a.keyboard.press('Enter'); await a.waitForSelector('textarea.sh-input');
    await a.keyboard.type('Triangles are strong.');
    ok(await tabTo(a, () => document.activeElement?.classList.contains('primary') && /Next|Skip/.test(document.activeElement.textContent), { max: 20 }), 'keyboard: Tab reaches Next');
    await a.keyboard.press('Enter'); await a.waitForSelector('.sh-ask'); await settle(a);
    await audit(a, 'pilot student, Simple ask a teacher');
    ok(await tabTo(a, () => document.activeElement?.classList.contains('sh-ask'), { max: 20 }), 'keyboard: Tab reaches "Ask …"');
    const asked = await a.evaluate(() => document.activeElement.textContent);
    await a.keyboard.press('Enter'); await a.waitForSelector('.sh-flow', { state: 'detached' });
    const ev = await until(async () => saved().events.find((e) => e.studentId === AARON && e.title === 'Built a bridge out of straws'));
    const rq = await until(async () => saved().requests.find((r) => r.eventId === ev?.id && r.status === 'pending'));
    ok(ev && rq?.teacherId === TEACHER, `keyboard only: the moment is added and ${asked} is asked (${rq?.teacherId})`);
    ok(await until(() => a.evaluate(() => document.querySelector('.toast[role="status"]')?.textContent.length > 0)), 'the outcome is announced in the live region');
    await a.screenshot({ path: path.join(TMP, 'pilot-aaron-added.png') });
    await cA.close();

    // His science teacher: queue, My classes, This week; keyboard only, endorse.
    const tTok = await tokOf(TEACHER); const cT = await ctxFor(tTok);
    const t = await open(cT, 'queue', '.q-card', 'teacher');
    await audit(t, 'pilot teacher, queue');
    ok(await tabTo(t, () => document.activeElement?.classList.contains('primary') && document.activeElement.textContent === 'Endorse' && document.activeElement.closest('.q-card')?.textContent.includes('Built a bridge out of straws'), { max: 120 }), 'keyboard: Tab reaches Endorse on Aaron’s moment');
    ok(await focusRing(t), 'with a visible focus ring');
    await t.keyboard.press('Enter');
    ok(!!await until(async () => saved().events.find((e) => e.id === ev?.id)?.verification === 'teacher-endorsed'), 'keyboard only: endorsed');
    ok(await until(() => t.evaluate(() => /Endorsed/.test(document.querySelector('.toast[role="status"]')?.textContent || ''))), 'announced in the live region');
    await t.goto(`${U}/#/me/classes`); await t.waitForSelector('main h1'); await settle(t); await audit(t, 'pilot teacher, My classes');
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('main h1'); await settle(t); await audit(t, 'pilot teacher, This week');
    await cT.close();

    // His advisor.
    const cV = await ctxFor(await tokOf(ADVISOR));
    const v = await open(cV, 'advisory', 'main h1', 'advisor'); await audit(v, 'pilot advisor, My advisory');
    await v.goto(`${U}/#/me/student/${AARON}`); await v.waitForSelector('main h1'); await settle(v); await audit(v, 'pilot advisor, Aaron’s page');
    await v.goto(`${U}/#/me/week`); await v.waitForSelector('main h1'); await settle(v); await audit(v, 'pilot advisor, This week');
    await cV.close();

    // A parent of Aaron.
    const fam = (await post('/api/admin/accounts', { kind: 'parent', name: 'Nok Torres', email: 'nok@family.example', children: [AARON] }, adminTok)).j;
    const cP = await ctxFor(await setup(fam.setupUrl.split('/setup/')[1]), { width: 390, height: 820 });
    const pp = await open(cP, '', '.page.family', 'parent'); await audit(pp, 'pilot family view (phone)');
    await cP.close();

    // The admin: Accounts.
    const cAd = await ctxFor(adminTok);
    const ad = await open(cAd, 'accounts', 'main h1', 'admin'); await audit(ad, 'pilot admin, Accounts');
    await cAd.close();
  } catch (e) { ok(false, e.stack || String(e)); } finally {
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('INFO all axe findings (impact rule: screens):', JSON.stringify(summary));
    await b.close(); for (const s of servers) s.kill();
    console.log('INFO screenshots in', TMP);
  }
})();
