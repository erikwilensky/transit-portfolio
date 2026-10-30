// Weekly goal check-ins on real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster, then Aaron Torres (Year 8, Simple, on a phone) plans two goals, checks in "Stuck" on "Run 5k" and
// snoozes the other. The server is stopped and his check-in moved back a week in its saved record (seeded dates), then
// started again: Aaron is asked again and is stuck again. His advisor, Ms Jane Altemen, sees "Aaron is stuck on 'Run 5k'"
// on My advisory and in This week and sends encouragement; Aaron sees it in his bell and on the goal. At Standard, the
// compact card. Each account has its own browser context. axe over the new parts. TP_ROSTER=/path/to/transit-roster.json.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-checkins-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', ALTEMEN = 'T25948', GOAL = 'Run 5k', OTHER = 'Learn to juggle';
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
const stop = (s) => new Promise((r) => { s.p.removeAllListeners('exit'); s.p.on('exit', r); s.p.kill(); });
const setupWith = async (U, token, extra = {}) => {
  const r = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: 'pilot-pass-123', ...extra }) });
  if (!r.ok) throw new Error(`setup ${r.status}`);
  return r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
};
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
async function audit(p, include, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate((inc) => window.axe.run({ include: inc }, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))), include);
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
const day = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const data = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, data);
  const b = await chromium.launch();
  try {
    const H = { cookie: `tp_session=${await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' })}`, 'content-type': 'application/json' };
    const state = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const aaron = (await state()).students.find((s) => s.id === AARON);
    ok(aaron?.advisorId === ALTEMEN, `Aaron Torres (Year ${aaron?.grade + 1}) is advised by ${person(ALTEMEN).name}`);
    const cookies = {};
    const ctx = async (id, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 860 } });
      cookies[id] ||= await setupWith(U, links[person(id).email]);
      await c.addCookies([{ name: 'tp_session', value: cookies[id], url: U }]);
      const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p;
    };
    const goals = async () => (await state()).events.filter((e) => e.studentId === AARON && e.type === 'goal');

    // ── Week 1. Aaron, on a phone: onboarding, two goals ──
    const s = await ctx(AARON, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    await s.locator('.ob-pick').first().click(); await s.locator('.ob-pick:not(.on)').first().click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    ok(await s.locator('.gc-big').count() === 0, 'no check-in without a goal');
    for (const title of [GOAL, OTHER]) {
      await s.click('.sh-card.goal'); await s.fill('.sh-input', title); await s.click('.sh-next .primary');
      await s.locator('.sh-lines button').first().click();
      await s.locator('.sh-when > button', { hasText: 'By the end of this term' }).click();
      if (await s.locator('text=Want a teacher to help you with it?').count()) await s.click('text=Not now');
      await s.waitForSelector(`.sh-goal:has-text("${title}")`);
    }
    await until(async () => (await goals()).length === 2);
    const big = s.locator('.gc-big', { hasText: GOAL });
    await big.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await big.count() === 1 && await s.locator('.gc-big').count() === 2, 'Simple home: one "How is your goal going?" card per goal');
    await audit(s, ['.gc-simple'], 'Simple check-in cards');
    // Snooze the second goal for 2 weeks.
    await s.locator('.gc-big', { hasText: OTHER }).click(); await s.waitForSelector('.gc-flow');
    await s.click('text=Ask me again in 2 weeks');
    const today = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10); // Bangkok
    ok(await until(async () => (await goals()).find((e) => e.title === OTHER)?.checkinSnooze === day(today, 14)), `"${OTHER}" snoozed until ${day(today, 14)}`);
    // Check in on Run 5k: Stuck, a sentence, a next step. One question per screen.
    await big.click(); await s.waitForSelector('.gc-flow');
    const choices = await s.locator('.gc-flow .gc-ch').allInnerTexts();
    ok(['Going well', 'Stuck', 'Not started'].every((c) => choices.some((x) => x.includes(c))), `three big choices (${choices.map((x) => x.replace(/\W*\n/, ' ')).join(' · ')})`);
    await audit(s, ['.gc-flow'], 'Simple check-in, first question');
    await s.screenshot({ path: SH + 'simple-q1.png' });
    await s.locator('.gc-flow .gc-ch', { hasText: 'Stuck' }).click();
    await s.waitForSelector('text=Want to say a bit more?');
    await s.fill('.gc-flow textarea', 'I keep stopping after one kilometre');
    await audit(s, ['.gc-flow'], 'Simple check-in, a sentence');
    await s.click('.gc-flow .sh-next .primary');
    await s.waitForSelector('text=What’s one next step?');
    await s.fill('.gc-flow input.sh-input', 'Ask Coach about a walk-run plan');
    await s.click('.gc-flow .sh-next .primary');
    let ci = await until(async () => (await goals()).find((e) => e.title === GOAL)?.checkins?.[0]);
    ok(ci?.status === 'stuck' && /kilometre/.test(ci.note) && /walk-run/.test(ci.next), 'saved on the goal: Stuck, his sentence and next step');
    await s.waitForSelector('.gc-big', { state: 'detached' }).catch(() => {});
    ok(await s.locator('.gc-big').count() === 0, 'nothing more to answer this week');

    // ── A week later (seeded): his check-in moved back 7 days in the saved record ──
    await stop(srv);
    const file = path.join(data, 'state.json'); const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    const g = saved.store.events.find((e) => e.studentId === AARON && e.title === GOAL);
    for (const c of g.checkins) { c.week = day(c.week, -7); c.date = day(c.date, -7); c.at = new Date(Date.parse(c.at) - 7 * 864e5).toISOString(); }
    fs.writeFileSync(file, JSON.stringify(saved));
    srv = await start(port, data);
    await s.reload(); await s.waitForSelector('.simple .sh-actions');
    await big.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await big.count() === 1 && await s.locator('.gc-big', { hasText: OTHER }).count() === 0, 'a new week: asked again about Run 5k, not the snoozed goal');
    await big.click(); await s.locator('.gc-flow .gc-ch', { hasText: 'Stuck' }).click();
    await s.fill('.gc-flow textarea', 'Still stuck, my legs hurt');
    await s.click('.gc-flow .sh-next .primary'); await s.click('.gc-flow .sh-next .primary'); // no next step this time
    ci = await until(async () => { const e = (await goals()).find((x) => x.title === GOAL); return e?.checkins?.length === 2 && e.checkins; });
    ok(ci && ci.every((c) => c.status === 'stuck') && ci[0].week < ci[1].week, 'Stuck two weeks running');

    // ── Ms Altemen: the flag on My advisory and in This week, and encouragement ──
    const t = await ctx(ALTEMEN);
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.tw');
    const wf = t.locator('.gc-flags');
    await wf.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await wf.count() === 1 && (await wf.innerText()).includes(`Aaron is stuck on “${GOAL}”`), 'This week: "Aaron is stuck on “Run 5k”"');
    ok((await t.locator('.bell').getAttribute('aria-label')).includes('unread'), 'and a notification in her bell');
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.advisor');
    const af = t.locator('.gc-flags li', { hasText: GOAL });
    await af.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await af.count() === 1 && (await af.innerText()).includes('legs hurt'), 'My advisory: the flag, with his latest sentence');
    await af.locator('text=Send encouragement').click();
    const presets = await af.locator('.gc-line').count();
    ok(presets >= 3, `${presets} kind preset lines`);
    await af.locator('.gc-line').nth(1).click();
    await af.locator('.gc-enc input[type="text"], .gc-enc > input').fill('Come and find me at lunch on Tuesday.');
    await audit(t, ['.gc-flags'], 'stuck flag with the encouragement form');
    await t.screenshot({ path: SH + 'advisory.png' });
    await af.locator('.gc-enc .primary').click();
    const en = await until(async () => (await goals()).find((e) => e.title === GOAL)?.encouragements?.[0]);
    ok(en?.by === ALTEMEN && /lunch on Tuesday/.test(en.text) && en.line, 'sent: a preset line and her sentence');
    await t.waitForSelector('.gc-flags .nd-sent');
    ok((await t.locator('.gc-flags').innerText()).includes('Encouragement sent'), 'the flag shows it was sent');
    await t.goto(`${U}/#/me/student/${AARON}~${g.id}`); await t.waitForSelector('.station-panel.open .gc-time');
    ok((await t.locator('.station-panel .gc-time').innerText()).includes('Stuck'), 'her view of the goal: the check-in timeline');

    // ── Aaron sees it ──
    await s.reload(); await s.waitForSelector('.simple .sh-actions');
    await s.click('.bell'); await s.waitForSelector('.bell-menu');
    ok((await s.locator('.bell-menu').innerText()).includes('Ms Altemen sent you encouragement for “Run 5k”'), 'Aaron: "Ms Altemen sent you encouragement" in his bell');
    await s.goto(`${U}/#/me/map/${g.id}`); await s.reload(); await s.waitForSelector('.modal .sh-goal .gc-time');
    const tl = await s.locator('.modal .gc-time').innerText();
    ok(tl.includes('lunch on Tuesday') && tl.includes('Stuck'), 'and on his goal, with his check-ins');
    await audit(s, ['.modal .gc-time'], 'check-in timeline');
    await s.screenshot({ path: SH + 'aaron-goal.png' });

    // ── At Standard: the compact card, and the station panel ──
    await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${cookies[AARON]}` }, body: JSON.stringify({ fn: 'setIntensity', args: [AARON, 'standard'], rec: [] }) });
    await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${cookies[AARON]}` }, body: JSON.stringify({ fn: 'addGoal', args: [AARON, { title: 'Read three books', date: day(today, 40), lineId: g.lineIds[0], summary: '' }], rec: [] }) });
    const w = await ctx(AARON);
    await w.goto(`${U}/#/me/map`); await w.waitForSelector('.home');
    const card = w.locator('.gc-card', { hasText: 'Read three books' });
    await card.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await card.count() === 1 && await w.locator('.gc-card').count() === 1, 'Standard: one compact card, for the goal not yet checked in');
    await card.locator('.gc-ch', { hasText: 'Going well' }).click();
    await card.locator('input').nth(1).fill('Finish chapter four');
    await audit(w, ['.gc-list'], 'compact check-in card');
    await card.locator('.primary').click();
    ok(await until(async () => (await goals()).find((e) => e.title === 'Read three books')?.checkins?.[0]?.status === 'well'), 'saved: Going well');
    await w.goto(`${U}/#/me/map/${g.id}`); await w.waitForSelector('.station-panel.open .gc-time');
    ok((await w.locator('.station-panel .gc-time').innerText()).includes('lunch on Tuesday'), 'Standard station panel: the timeline with the encouragement');

    // ── Not allowed: Altemen checking in for him, another advisor sending encouragement ──
    const r1 = await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${cookies[ALTEMEN]}` }, body: JSON.stringify({ fn: 'checkInGoal', args: [g.id, { status: 'well' }], rec: [] }) });
    ok(r1.status === 403, `an advisor cannot check in for a student (${r1.status})`);
    const otherAdv = roster.teachers.find((x) => x.roles.includes('advisor') && x.id !== ALTEMEN && links[x.email]);
    const r2 = await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${await setupWith(U, links[otherAdv.email])}` }, body: JSON.stringify({ fn: 'sendEncouragement', args: [g.id, otherAdv.id, 'x', 'hi'], rec: [] }) });
    ok(r2.status === 403, `another advisor cannot send encouragement (${r2.status})`);
    for (const [n, p] of [['Aaron', s], ['Altemen', t], ['Aaron (Standard)', w]]) ok(!p.errs.length, `${n}: no page errors${p.errs.length ? `: ${p.errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
