// Milestones and celebrations on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first),
// imports the real roster. Aaron Torres (Sabc0d6125e85), on a phone at Simple, adds his first moments and sees the
// first-moment celebration once: not again after a reload, nor on a second device; a later milestone arrives live on that
// second device, which prefers reduced motion (a still station). A classmate at Standard gets a quiet toast and a badge on
// the map's station. Ms Jane Altemen (T25948) sees Aaron's milestone on My advisory, on his page and in This week. Aaron's
// family sees milestones only from moments the family view shows. Only the student may mark them seen. Every account has
// its own browser context. TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-ms-*.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-ms-';
const TID = 'T25948', AARON = 'Sabc0d6125e85';
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
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-ms-data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    const advisor = roster.teachers.find((t) => t.id === TID);
    const kids = roster.students.filter((s) => s.advisorId === TID).sort((a, c) => a.name.localeCompare(c.name));
    const aaron = kids.find((s) => s.id === AARON), mira = kids.find((s) => s.id !== AARON && links[email.get(s.id)]);
    ok(advisor && aaron && mira, `${advisor?.name} advises ${aaron?.name} and ${mira?.name}`);
    const aTok = await setupWith(U, links[email.get(AARON)]), mTok = await setupWith(U, links[email.get(mira.id)]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'art'], 'classic'])).ok && (await act(aTok, 'setIntensity', [AARON, 'simple'])).ok, 'Aaron is set up at Simple, nothing on his map yet');

    // ── Aaron, on a phone, at Simple: his first moment ──
    const cA = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.sh-hello');
    ok(await a.locator('.ms-big').count() === 0 && await a.locator('.ms-strip').count() === 0, 'nothing to celebrate yet');
    const addMoment = async (title, line) => {
      await a.click('.sh-card.add'); await a.fill('.sh-flow input.sh-input', title);
      await a.click('.sh-flow .sh-next .primary:has-text("Next")');
      await a.locator('.sh-flow .sh-lines button', { hasText: line }).click();
      const last = a.locator('.sh-flow button:has-text("Skip and add it"), .sh-flow button:has-text("Skip")').first();
      await last.click();
      const notNow = a.locator('.sh-flow button:has-text("Not now, just add it")');
      if (await notNow.count()) await notNow.click();
      await a.waitForSelector('.sh-flow', { state: 'detached' });
    };
    await addMoment('Built a bridge out of straws', 'Science');
    await a.waitForSelector('.ms-big');
    const big = await a.locator('.ms-big').innerText();
    ok(big.includes('First moment') && big.includes('Your journey has started!') && big.includes('First moment on Science'), 'a big friendly card: "First moment", and "First moment on Science"');
    ok(await a.locator('.ms-big').evaluate((el) => getComputedStyle(el).borderTopColor) === 'rgb(79, 82, 155)', 'in the line’s colour (Science)');
    ok(await a.locator('.ms-big .ms-station:not(.still)').count() === 1, 'with a small station animation');
    ok(await noScroll(a), 'no sideways scroll at phone width');
    await a.screenshot({ path: SH + 'aaron-first.png' });
    const seen = await until(async () => { const s = saved().milestonesSeen?.[AARON]; return s?.first && s['line:science'] ? s : null; });
    ok(!!seen, 'saved as seen in the record, at once');
    await a.click('.ms-big button:has-text("Yay!")');
    ok(await a.locator('.ms-big').count() === 0, 'gone once he taps Yay');
    ok((await a.locator('.ms-strip').innerText()).includes('First moment'), '"My milestones" on his home');
    await addMoment('Painted the class mural', 'Art');
    await a.waitForSelector('.ms-big');
    const big2 = await a.locator('.ms-big').innerText();
    ok(big2.includes('First moment on Art') && !big2.includes('Your journey has started'), 'the next one: only what is new ("First moment on Art")');
    await a.click('.ms-big button:has-text("Yay!")');
    await a.reload(); await a.waitForSelector('.sh-hello'); await pause(1500);
    ok(await a.locator('.ms-big').count() === 0, 'not again after a reload');
    ok(await a.locator('.ms-strip li').count() === 3, 'the strip: three milestones');
    ok(!aErrs.length, `no page errors for Aaron${aErrs.length ? `: ${aErrs.join(' | ')}` : ''}`);
    await cA.close();

    // ── A second device, preferring reduced motion: nothing old; a new milestone arrives live, still ──
    const cA2 = await b.newContext({ viewport: { width: 1200, height: 860 }, reducedMotion: 'reduce' });
    await cA2.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a2 = await cA2.newPage(); const a2Errs = []; a2.on('pageerror', (e) => a2Errs.push(e.message));
    await a2.goto(`${U}/#/me/map`); await a2.waitForSelector('.sh-hello'); await pause(1500);
    ok(await a2.locator('.ms-big').count() === 0, 'not on a second device either');
    ok(await a2.locator('.ms-strip li').count() === 3, 'the second device shows the same milestones');
    const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    for (const [t, n] of [['Ran the 800 m', 2], ['Science fair poster', 1], ['Pond survey', 0]]) await act(aTok, 'addStation', [AARON, { title: t, lineIds: ['science'], date: day(n), type: 'project' }]);
    await a2.waitForSelector('.ms-big', { timeout: 10000 });
    ok((await a2.locator('.ms-big').innerText()).includes('5 moments'), 'live, from his other device: "5 moments"');
    ok(await a2.locator('.ms-big .ms-station.still').count() === 1, 'reduced motion: the station is still');
    await a2.screenshot({ path: SH + 'aaron-five.png' });
    ok(!!(await until(async () => saved().milestonesSeen?.[AARON]?.['count:5'])), 'marked seen');
    ok(!a2Errs.length, `no page errors on the second device${a2Errs.length ? `: ${a2Errs.join(' | ')}` : ''}`);
    await cA2.close();

    // ── Only the student marks them seen ──
    const tTok = await setupWith(U, links[advisor.email]);
    ok((await act(tTok, 'markMilestonesSeen', [AARON, ['steady:science']])).status === 403, 'not his advisor');
    ok((await act(adminTok, 'markMilestonesSeen', [AARON, ['steady:science']])).status === 403, 'not an admin');
    ok((await act(mTok, 'markMilestonesSeen', [AARON, ['steady:science']])).status === 403, 'not a classmate');
    ok(!('milestonesSeen' in (await state(tTok))) || !Object.keys((await state(tTok)).milestonesSeen).length, 'the seen state does not reach the advisor');

    // ── A classmate at Standard: a quiet toast and a badge on the map's station ──
    ok((await act(mTok, 'completeOnboarding', [mira.id, ['science', 'art'], 'classic'])).ok && (await act(mTok, 'setIntensity', [mira.id, 'standard'])).ok, `${mira.name} at Standard`);
    const cM = await b.newContext({ viewport: { width: 1200, height: 860 } });
    await cM.addCookies([{ name: 'tp_session', value: mTok, url: U }]);
    const m = await cM.newPage(); const mErrs = []; m.on('pageerror', (e) => mErrs.push(e.message));
    await m.goto(`${U}/#/me/map`); await m.waitForSelector('.home-map');
    await act(mTok, 'addStation', [mira.id, { title: 'Wrote a poem for assembly', lineIds: ['art'], type: 'project' }]);
    await m.waitForSelector('.ms-toast', { timeout: 10000 });
    ok((await m.locator('.ms-toast').innerText()).includes('Milestone: First moment'), 'Standard: a quiet toast');
    ok(await m.locator('.ms-big').count() === 0, 'no big card at Standard');
    ok(!!(await m.waitForSelector('.station .ms-badge', { timeout: 5000 }).catch(() => null)) && await m.locator('.station .ms-badge').count() === 1, 'a badge on the map’s station');
    await m.screenshot({ path: SH + 'standard.png' });
    ok(!mErrs.length, `no page errors at Standard${mErrs.length ? `: ${mErrs.join(' | ')}` : ''}`);
    await cM.close();

    // ── Ms Altemen: My advisory, Aaron's page, This week ──
    await act(aTok, 'addStation', [AARON, { title: 'My diary', lineIds: ['sport'], type: 'project', visibility: 'private' }]);
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.ms-strip[aria-label="Recent milestones"]');
    const adv = await t.locator('.ms-strip[aria-label="Recent milestones"]').innerText();
    ok(adv.includes(aaron.name) && adv.includes('First moment') && adv.includes('5 moments'), 'My advisory: Aaron’s recent milestones');
    ok(!adv.includes('Sport'), 'not from his private moment');
    ok(!/\b(top|rank|leader|most)\b/i.test(adv), 'no leaderboard or comparison words');
    await t.screenshot({ path: SH + 'advisory.png' });
    await t.locator('.ms-strip[aria-label="Recent milestones"] button', { hasText: aaron.name }).first().click();
    await t.waitForSelector('.ms-adv');
    ok((await t.locator('.ms-adv').innerText()).includes('First moment on Science'), 'his page: his milestones');
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('#tw-cel');
    const week = await t.locator('.ms-week').innerText().catch(() => '');
    ok(week.includes(aaron.name) && week.includes('First moment'), 'This week: Celebrate lists the milestones');
    await t.screenshot({ path: SH + 'week.png', fullPage: true });
    ok(!tErrs.length, `no advisor page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);

    // ── Aaron's family: only from moments the family view shows ──
    const r = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'aaron.family@example.org', name: 'A Parent', kind: 'parent', children: [AARON] }) })).json();
    const fTok = await setupWith(U, r.setupUrl.split('/setup/')[1]);
    const cF = await b.newContext({ viewport: { width: 390, height: 820 }, isMobile: true });
    await cF.addCookies([{ name: 'tp_session', value: fTok, url: U }]);
    const f = await cF.newPage(); const fErrs = []; f.on('pageerror', (e) => fErrs.push(e.message));
    await f.goto(`${U}/#/me`); await f.waitForSelector('.ms-strip');
    const fam = await f.locator('.ms-strip').innerText();
    ok(fam.includes('First moment on Science') && !fam.includes('Sport'), 'the family sees his milestones, never one from a private moment');
    ok(await noScroll(f), 'no sideways scroll on the family’s phone');
    ok(await f.locator('.ms-big, .ms-toast').count() === 0, 'families get no celebration of their own');
    ok(!fErrs.length, `no family page errors${fErrs.length ? `: ${fErrs.join(' | ')}` : ''}`);
    await f.screenshot({ path: SH + 'family.png' });
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
