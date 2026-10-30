// Term reflection on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster. Ms Jane Altemen (T25948) opens a term reflection for Advisory 8C on My advisory. Aaron Torres
// (Sabc0d6125e85), on a phone at Simple level, looks back, picks two moments, answers with sentence starters, sets a goal
// and finishes. Another 8C student at Standard saves a draft, comes back in a new browser, carries on and finishes with
// "Only me". The advisor sees "Reflections: 2 of 23 done", reminds the rest with a nudge, and finds Aaron's reflection on
// his conference sheet; Aaron's family sees it (Year 8: advisor level), nobody sees the "Only me" one. Every account has
// its own browser context. TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-reflect-*.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-reflect-';
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

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-reflect-data-');
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
    ok(advisor && aaron && kids.length === 23 && kids.every((s) => s.homeroom === '8C'), `${advisor?.name} advises 8C (${kids.length}), ${aaron?.name} and ${mira?.name} among them`);

    // Both students set up, with a few moments this term.
    const aTok = await setupWith(U, links[email.get(AARON)]), mTok = await setupWith(U, links[email.get(mira.id)]);
    const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    for (const [tok, sid, level, ms] of [[aTok, AARON, 'simple', [['Built a bridge out of straws', 'science', 30], ['Painted the class mural', 'art', 18], ['Ran the 800 m at sports day', 'science', 6]]], [mTok, mira.id, 'standard', [['Wrote a poem for the assembly', 'art', 25], ['Tested pond water', 'science', 9]]]]) {
      ok((await act(tok, 'completeOnboarding', [sid, ['science', 'art'], 'classic'])).ok && (await act(tok, 'setIntensity', [sid, level])).ok, `${sid === AARON ? aaron.name : mira.name} is set up at ${level}`);
      for (const [title, line, n] of ms) await act(tok, 'addStation', [sid, { title, lineIds: [line], date: day(n), type: 'project' }]);
    }

    // ── Refused on the server ──
    const spec = { title: 'Term 1 reflection', opens: day(0), closes: day(-14), advisorId: TID };
    ok((await act(aTok, 'openReflectionWindow', [spec, TID])).status === 403, 'a student cannot open one');
    const otherAdv = roster.teachers.find((t) => t.id !== TID && roster.students.some((s) => s.advisorId === t.id) && links[t.email]);
    const oTok = await setupWith(U, links[otherAdv.email]);
    ok((await act(oTok, 'openReflectionWindow', [spec, otherAdv.id])).status === 403, `another advisor (${otherAdv.name}) cannot open one for 8C`);
    ok((await act(oTok, 'openReflectionWindow', [{ ...spec, advisorId: null, year: 8 }, otherAdv.id])).status === 403, 'nor for the whole Year');

    // ── Ms Altemen opens it on My advisory ──
    const tTok = await setupWith(U, links[advisor.email]);
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.tr-adv');
    await t.click('.tr-adv button:has-text("Open a term reflection")');
    ok(await t.locator('.tr-form input').first().inputValue() === 'Term 1 reflection', 'the title is suggested: "Term 1 reflection"');
    await t.click('.tr-form button:has-text("Open for 23 students")');
    const w = await until(async () => saved().reflectionWindows?.[0]);
    ok(w && w.studentIds.length === 23 && w.advisorId === TID && w.by === TID && w.title === 'Term 1 reflection', 'saved: a window for the 23 advisees, opened by her');
    ok(saved().notifications.filter((n) => n.go?.param === 'reflect').length === 23, 'each student is told');
    await t.waitForSelector('.tr-count');
    ok((await t.locator('.tr-adv .tr-count').innerText()) === 'Reflections: 0 of 23 done', 'the strip: "Reflections: 0 of 23 done"');
    ok((await act(tTok, 'saveTermReflection', [w.id, AARON, {}])).status === 403, 'the advisor cannot write it for Aaron');
    ok((await act(mTok, 'saveTermReflection', [w.id, AARON, {}])).status === 403, 'nor a classmate');

    // ── Aaron, on a phone, at Simple ──
    const cA = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.tr-card.simple');
    ok((await a.locator('.tr-card').innerText()).includes('Term 1 reflection'), 'Simple home: a big "Term 1 reflection" card');
    ok(await noScroll(a), 'no sideways scroll at phone width (home)');
    await a.screenshot({ path: SH + 'aaron-card.png' });
    await a.click('.tr-card button:has-text("Start")');
    await a.waitForSelector('.tr-flow .tr-picks');
    ok(await a.locator('.tr-pick').count() === 3, 'look back: his three moments as cards');
    await a.locator('.tr-pick', { hasText: 'Built a bridge' }).click();
    await a.locator('.tr-pick', { hasText: 'Painted the class mural' }).click();
    ok(await a.locator('.tr-pick.on').count() === 2, 'two picked');
    ok(await noScroll(a), 'no sideways scroll (look back)');
    await a.screenshot({ path: SH + 'aaron-look.png' });
    await a.click('.sh-next .primary:has-text("Next")');
    for (const [did, learned] of [['a bridge that held 2 kg', 'triangles make it strong'], ['the sky part with Mia', 'mixing colours takes patience']]) {
      await a.waitForSelector('.tr-q');
      await a.locator('.tr-q').nth(0).locator('button:has-text("I made…")').click();
      await a.locator('.tr-q').nth(0).locator('textarea').pressSequentially(did);
      await a.locator('.tr-q').nth(1).locator('button:has-text("I learned that…")').click();
      await a.locator('.tr-q').nth(1).locator('textarea').pressSequentially(learned);
      ok(await noScroll(a), 'no sideways scroll (a moment)');
      await a.click('.sh-next .primary:has-text("Next")');
    }
    await a.waitForSelector('h2:has-text("One thing to do next term")');
    ok(await until(async () => saved().termReflections?.find((r) => r.studentId === AARON)?.answers?.[saved().termReflections.find((r) => r.studentId === AARON).picks[1]]?.learned), 'a draft is saved as he goes');
    await a.fill('.tr-flow input.sh-input', 'Enter the science fair');
    await a.locator('.sh-lines button', { hasText: 'Science' }).click();
    await a.screenshot({ path: SH + 'aaron-goal.png' });
    await a.click('.sh-next .primary:has-text("Next")');
    await a.waitForSelector('.tr-review');
    ok((await a.locator('.tr-review').innerText()).includes('I made a bridge that held 2 kg'), 'review: what he wrote, with the sentence starter');
    ok((await a.locator('.tr-flow .sh-note').innerText()).includes('family'), 'review says his advisor and family can see it');
    await a.screenshot({ path: SH + 'aaron-review.png' });
    await a.click('.tr-finish');
    await a.waitForSelector('h2:has-text("Well done")');
    const ar = await until(async () => saved().termReflections.find((r) => r.studentId === AARON && r.status === 'done'));
    const st = saved(), ev = st.events.find((e) => e.id === ar?.eventId), goal = st.events.find((e) => e.id === ar?.goalId);
    ok(ev && ev.type === 'reflection' && ev.title === 'Term 1 reflection' && ev.reflectsOn.length === 2 && ev.visibility === 'advisor', 'finished: a reflection station linked to the two moments');
    ok(st.reflections.filter((r) => r.eventId === ev?.id).length === 2 && st.reflections.some((r) => r.eventId === ev?.id && r.text.startsWith('I made a bridge that held 2 kg. I learned that triangles make it strong.')), 'one reflection per moment, in his words');
    ok(goal && goal.type === 'goal' && goal.title === 'Enter the science fair' && goal.lineIds[0] === 'science', 'and his goal for next term');
    await a.click('.tr-flow .primary:has-text("Close")');
    ok(await a.locator('.tr-card').count() === 0, 'the card is gone once finished');
    ok(!aErrs.length, `no page errors for Aaron${aErrs.length ? `: ${aErrs.join(' | ')}` : ''}`);

    // ── Mira, at Standard: saves a draft, comes back on another browser, finishes with "Only me" ──
    const cM = await b.newContext({ viewport: { width: 1200, height: 860 } });
    await cM.addCookies([{ name: 'tp_session', value: mTok, url: U }]);
    const m = await cM.newPage(); const mErrs = []; m.on('pageerror', (e) => mErrs.push(e.message));
    await m.goto(`${U}/#/me/map`); await m.waitForSelector('.tr-card:not(.simple)');
    await m.click('.tr-card button:has-text("Start")');
    await m.waitForSelector('.tr-page');
    await m.locator('.tr-pick', { hasText: 'Tested pond water' }).click();
    await m.locator('.tr-moment textarea').nth(0).fill('Tested pond water with my group for a week.');
    await m.screenshot({ path: SH + 'mira-page.png' });
    await m.click('.tr-page button:has-text("Save and finish later")');
    const draft = await until(async () => saved().termReflections.find((r) => r.studentId === mira.id));
    ok(draft && draft.status === 'draft' && Object.values(draft.answers)[0]?.did.startsWith('Tested pond water'), 'saved as a draft on the server');
    ok((await state(tTok)).termReflections.find((r) => r.studentId === mira.id)?.answers === undefined, 'the advisor’s copy says only that it was started');
    await cM.close();
    const cM2 = await b.newContext({ viewport: { width: 1200, height: 860 } });
    await cM2.addCookies([{ name: 'tp_session', value: mTok, url: U }]);
    const m2 = await cM2.newPage(); m2.on('pageerror', (e) => mErrs.push(e.message));
    await m2.goto(`${U}/#/me/map`); await m2.waitForSelector('.tr-card');
    ok((await m2.locator('.tr-card').innerText()).includes('Carry on'), 'on another browser: "Carry on"');
    await m2.click('.tr-card button:has-text("Carry on")');
    await m2.waitForSelector('.tr-page');
    ok(await m2.locator('.tr-pick.on').count() === 1 && (await m2.locator('.tr-moment textarea').nth(0).inputValue()).startsWith('Tested pond water'), 'resumed: her pick and words are back');
    await m2.locator('.tr-moment textarea').nth(1).fill('Results change with the weather.');
    await m2.check('.tr-goal label:has-text("No goal for now") input');
    await m2.selectOption('.tr-page select[aria-label="Who can see it"]', 'private');
    await m2.click('.tr-page button:has-text("Review")');
    await m2.waitForSelector('.tr-review');
    await m2.click('.tr-finish');
    await m2.waitForSelector('.tr-page button:has-text("Close")');
    const mr = await until(async () => saved().termReflections.find((r) => r.studentId === mira.id && r.status === 'done'));
    ok(mr && saved().events.find((e) => e.id === mr.eventId)?.visibility === 'private' && !mr.goalId, 'finished, "Only me", no goal');
    ok(!mErrs.length, `no page errors for ${mira.name}${mErrs.length ? `: ${mErrs.join(' | ')}` : ''}`);

    // ── Ms Altemen: 2 of 23, reminds the rest, the conference sheet ──
    await t.reload(); await t.waitForSelector('.tr-count');
    ok((await t.locator('.tr-adv .tr-count').innerText()) === 'Reflections: 2 of 23 done', 'the strip: "Reflections: 2 of 23 done"');
    await t.click('.tr-adv button:has-text("Who hasn\'t finished (21)")');
    ok(await t.locator('.tr-adv .nd-list li').count() === 21 && !(await t.locator('.tr-adv .nd-list').innerText()).includes(aaron.name), 'who hasn’t finished: 21, not Aaron');
    await t.click('.tr-adv button:has-text("Remind the rest (21)")');
    await t.screenshot({ path: SH + 'advisor.png' });
    await t.click('.tr-adv .nd-edit .primary:has-text("Send")');
    const nudges = await until(async () => { const l = (saved().nudges || []).filter((n) => n.about === `reflection:${w.id}`); return l.length === 21 ? l : null; });
    ok(!!nudges && !nudges.some((n) => n.studentId === AARON || n.studentId === mira.id), 'reminders: a nudge each to the 21, none to those done');
    ok(saved().notifications.some((n) => n.to === `st:${nudges?.[0].studentId}` && n.go?.param === 'reflect' && n.text.startsWith('Ms Altemen:')), 'their notification opens the reflection');
    ok(!(await state(tTok)).events.some((e) => e.id === mr.eventId), 'the "Only me" reflection never reaches the advisor');
    await t.goto(`${U}/#/me/student/${AARON}`); await t.waitForSelector('button:has-text("Conference sheet")');
    await t.click('button:has-text("Conference sheet")'); await t.waitForSelector('.cf-sheet');
    const sheet = await t.locator('.cf-sheet .cf-refl').innerText();
    ok(sheet.includes('Term 1 reflection') && sheet.includes('triangles make it strong'), 'Aaron’s conference sheet lists the term reflection');
    await t.screenshot({ path: SH + 'conference.png' });
    ok(!tErrs.length, `no advisor page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);

    // ── Families: Aaron's sees it (Year 8, advisor level); Mira's never sees "Only me" ──
    const fam = async (sid, mail) => { const r = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ email: mail, name: 'A Parent', kind: 'parent', children: [sid] }) })).json(); return setupWith(U, r.setupUrl.split('/setup/')[1]); };
    const fa = await state(await fam(AARON, 'aaron.family@example.org'));
    ok(fa.events.some((e) => e.id === ar.eventId) && fa.reflections.some((r) => r.eventId === ar.eventId) && !fa.termReflections?.length, 'Aaron’s family sees the reflection station, not the draft record');
    const fm = await state(await fam(mira.id, 'mira.family@example.org'));
    ok(!fm.events.some((e) => e.id === mr.eventId), `${mira.name}’s family does not see her "Only me" reflection`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
