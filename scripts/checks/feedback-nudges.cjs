// Feedback button and advisor nudges on the real class lists: a clean pilot (TP_START=empty; needs `npm run build`),
// the real roster imported as the admin. An advisor sees their quiet advisees, nudges one with their own words and
// then the rest; a Simple-level and a Standard-level advisee see the banner, open the add flow from it and send
// feedback (one with a screenshot); leadership reads it on Pilot usage, filters it and marks one done.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount; skipped without it). SCRATCH: where screenshots go.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(process.env.SCRATCH || os.tmpdir(), 'tp-fbn-');
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
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const noScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  srv = await start(port, fs.mkdtempSync(SH + 'data-'));
  const b = await chromium.launch();
  const errs = [];
  const page = async (tok, opts = {}) => { const c = await b.newContext({ viewport: { width: 1300, height: 900 }, ...opts }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const state = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts?.created.length > 900, `real roster imported (${ij.newAccounts?.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const email = new Map([...roster.students, ...roster.teachers].map((x) => [x.id, x.email]));

    // An advisor (with an account) of 4+ advisees with a Year 7–8 one (Simple by default); a second advisee is set to Standard.
    const rec = await state();
    let adv = null;
    for (const t of roster.teachers.filter((x) => (x.roles || []).includes('advisor') && links[x.email])) {
      const mine = rec.students.filter((s) => s.advisorId === t.id && links[email.get(s.id)]).sort((a, b) => a.name.localeCompare(b.name));
      const simple = mine.find((s) => s.grade + 1 <= 8);
      if (mine.length >= 4 && simple) { adv = { t, mine, simple, standard: mine.find((s) => s !== simple) }; break; }
    }
    ok(!!adv, `advisor ${adv.t.name}: ${adv.mine.length} advisees (Simple: ${adv.simple.name}, Year ${adv.simple.grade + 1}; other: ${adv.standard.name}, Year ${adv.standard.grade + 1})`);
    const stu = {};
    for (const s of adv.mine) stu[s.id] = await setupWith(U, links[email.get(s.id)]);
    const act = (sid, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { cookie: `tp_session=${stu[sid]}`, 'content-type': 'application/json' }, body: JSON.stringify({ fn, args, rec: [] }) });
    // One advisee is active (added a moment today); the two we follow have finished onboarding.
    const lines = rec.lines.filter((l) => !l.studentId).map((l) => l.id);
    const busy = adv.mine.find((s) => s !== adv.simple && s !== adv.standard);
    await act(busy.id, 'addStation', [busy.id, { title: 'Robotics club', lineIds: [lines[0]] }]);
    for (const s of [adv.simple, adv.standard]) await act(s.id, 'completeOnboarding', [s.id, lines.slice(0, 2), 'metro']);
    await act(adv.standard.id, 'setIntensity', [adv.standard.id, 'standard']);
    await act(adv.simple.id, 'setIntensity', [adv.simple.id, 'simple']);

    // ── The advisor ──
    const a = await page(await setupWith(U, links[adv.t.email]));
    await a.goto(`${U}/#/me/advisory`); await a.waitForSelector('.nd-quiet');
    ok(await a.locator('.nd-list li').count() === 8 && (await a.locator('.nd-more').innerText()) === `Show all ${adv.mine.length - 1}`, 'a long list shows 8, then "Show all"');
    await a.click('.nd-more');
    const rows = a.locator('.nd-list li');
    const quietN = adv.mine.length - 1;
    ok(await rows.count() === quietN, `"Quiet for 3 weeks" lists ${await rows.count()} of ${adv.mine.length} (the active one is not there)`);
    ok(!(await a.locator('.nd-list').innerText()).includes(busy.name), 'the advisee who added something today is not listed');
    ok((await rows.first().innerText()).includes('Not started yet'), 'nothing added ever: "Not started yet"');
    const row = rows.filter({ hasText: adv.simple.name });
    await row.locator('text=Send a nudge').click();
    const box = a.locator('#nd-text');
    ok((await box.inputValue()).startsWith('Your advisor would love to see'), 'the default message, ready to edit');
    await box.fill('Hi! Show me one thing from science this week.');
    await a.click('.nd-edit .primary');
    await row.locator('text=Nudged today').waitFor();
    ok(true, 'the row now says "Nudged today"');
    const all = a.locator('button', { hasText: /^Nudge all \d+$/ });
    ok((await all.innerText()) === `Nudge all ${quietN - 1}`, `"${await all.innerText()}" (everyone not nudged yet)`);
    await all.click(); await a.click('.nd-edit .primary');
    await until(async () => (await a.locator('.nd-sent').count()) === quietN);
    ok(await a.locator('.nd-sent').count() === quietN && await a.locator('text=Send a nudge').count() === 0, 'everyone quiet is nudged; no more buttons this week');
    const nudges = await until(async () => { const n = (await state()).nudges || []; return n.length === quietN && n; });
    ok(nudges && nudges.every((n) => n.from === adv.t.id), `${nudges?.length} nudges in the record, from the advisor`);
    ok(nudges && nudges.find((n) => n.studentId === adv.simple.id)?.text === 'Hi! Show me one thing from science this week.', 'the edited text was kept');
    await a.screenshot({ path: SH + 'advisor.png', fullPage: true });

    // ── A Simple-level advisee, on a phone ──
    const s = await page(stu[adv.simple.id], { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.nd-banner');
    ok((await s.locator('.nd-banner').innerText()).includes('Show me one thing from science'), 'Simple home: the banner with the advisor\'s words');
    await s.click('.nd-banner >> text=Add something'); await s.waitForSelector('.sh-flow');
    ok(true, '"Add something" opens the Simple add flow');
    await s.click('.sh-flow .panel-close');
    ok(await noScroll(s), 'no sideways scroll at phone width');
    await s.screenshot({ path: SH + 'simple-home.png', fullPage: true });
    await s.click('text=Something not working? Tell us'); await s.waitForSelector('.fb-dialog.simple');
    await s.click('.fb-kinds >> text=Something\'s broken');
    await s.fill('#fb-msg', 'The photo button is slow on my phone');
    const png = await s.screenshot({ clip: { x: 0, y: 0, width: 160, height: 120 } });
    await s.setInputFiles('.fb-file input', { name: 'screen.png', mimeType: 'image/png', buffer: png });
    await s.waitForSelector('.fb-shot img');
    await s.screenshot({ path: SH + 'simple-feedback.png' });
    await s.click('.fb-foot .primary'); await s.waitForSelector('.fb-dialog', { state: 'detached' });
    ok(true, 'Simple: big plain feedback button, sent with a screenshot');

    // ── A Standard-level advisee ──
    const d = await page(stu[adv.standard.id]);
    await d.goto(`${U}/#/me/map`); await d.waitForSelector('.nd-banner');
    ok(true, 'Standard home: the banner');
    await d.click('.nd-banner >> text=Add something'); await d.waitForSelector('.add-station');
    ok(true, '"Add something" opens Add a station');
    await d.keyboard.press('Escape'); await d.click('.add-station .panel-close').catch(() => {});
    await d.click('.persona-btn'); await d.click('.acct-menu >> text=Feedback'); await d.waitForSelector('.fb-dialog');
    await d.click('.fb-kinds >> text=An idea'); await d.fill('#fb-msg', 'Let me reorder my lines');
    await d.click('.fb-foot .primary'); await d.waitForSelector('.fb-dialog', { state: 'detached' });
    ok(true, 'Standard: feedback from the account menu');
    // Adding something answers the nudge: the banner goes.
    await act(adv.standard.id, 'addStation', [adv.standard.id, { title: 'Debate final', lineIds: [lines[0]] }]);
    await d.reload(); await d.waitForSelector('.student-map, main.screen'); await d.waitForTimeout(800);
    ok(await d.locator('.nd-banner').count() === 0, 'after adding something, no banner');

    // ── Leadership reads it on Pilot usage ──
    const lead = roster.teachers.find((t) => (t.roles || []).includes('leadership') && links[t.email]);
    const l = await page(await setupWith(U, links[lead.email]));
    await l.goto(`${U}/#/me/usage`); await l.waitForSelector('.fb-items li');
    const items = l.locator('.fb-items li');
    ok(await items.count() === 2, `Pilot usage: ${await items.count()} feedback items`);
    const firstTxt = await items.first().innerText();
    ok(firstTxt.includes('Let me reorder my lines') && firstTxt.includes(adv.standard.name) && firstTxt.includes(`Student, Year ${adv.standard.grade + 1}`), 'newest first, with name, role and Year');
    ok((await items.nth(1).innerText()).includes('#/me/map'), 'the screen was recorded');
    ok(await l.locator('.fb-thumb img').count() === 1, 'the screenshot shows');
    await l.selectOption('.fb-list select', 'broken');
    ok(await items.count() === 1 && (await items.first().innerText()).includes('photo button is slow'), 'filter by kind');
    await l.click('.fb-items >> text=Mark as done');
    await l.waitForSelector('.fb-items li', { state: 'detached' });
    ok(true, 'marked done: hidden unless "Done too"');
    await l.check('.fb-list input[type=checkbox]');
    ok((await items.first().innerText()).includes(`Done by ${lead.name}`), 'done, and by whom');
    await l.setViewportSize({ width: 390, height: 900 });
    await l.waitForTimeout(400);
    const wide = await l.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.us-scroll')).slice(0, 5).map((e) => `${e.tagName}.${e.className}`));
    ok(await noScroll(l), `Pilot usage: no sideways scroll at phone width${wide.length ? ` (${wide.join(', ')})` : ''}`);
    await l.screenshot({ path: SH + 'usage.png', fullPage: true });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
