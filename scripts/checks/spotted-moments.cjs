// Spotted moments on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster. Mr David Coultas (T60198) opens his class C-392000 in My classes, spots something for Aaron Torres
// (Sabc0d6125e85) with a photo, then ticks two classmates and spots one moment for both. Aaron, on a phone at Simple
// level, adds it to his journey: a station on Science, spotted and endorsed by Mr Coultas. One classmate, at Standard
// level, says "Not for me"; the teacher only sees "Not added". Every account has its own browser context.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-spotted-';
const TID = 'T60198', AARON = 'Sabc0d6125e85', CLASS = 'C-392000';
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
    const state = async (h = H) => (await (await fetch(`${U}/api/state`, { headers: h })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = await state();
    const teacher = roster.teachers.find((t) => t.id === TID);
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    const kids = rec.enrolments.filter((n) => n.classId === CLASS && !n.to).map((n) => n.studentId);
    const aaron = rec.students.find((s) => s.id === AARON);
    ok(teacher && aaron && kids.includes(AARON), `${teacher?.name} teaches ${CLASS} (${kids.length} students), ${aaron?.name} is in it`);
    const [m1, m2] = rec.students.filter((s) => kids.includes(s.id) && s.id !== AARON && links[email.get(s.id)]).sort((a, c) => a.name.localeCompare(c.name));
    const outsider = rec.students.find((s) => !kids.includes(s.id) && s.grade === 7 && s.advisorId !== TID);

    // ── Mr Coultas, on a laptop: spots something for Aaron from his class page ──
    const tTok = await setupWith(U, links[teacher.email]);
    const cT = await b.newContext({ viewport: { width: 1300, height: 860 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.mc-table');
    await t.locator('.mc-table tr', { hasText: aaron.name }).locator('.spot-row').click();
    await t.waitForSelector('.spot-dialog');
    ok(await t.locator('.spot-dialog select').inputValue() === 'science', 'the line defaults to the class’s line (science)');
    await t.fill('.spot-dialog input:not([type])', 'Kept the group going in the practical');
    await t.fill('.spot-dialog textarea', 'You re-ran the test when it failed and explained why.');
    const png = await t.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
    await t.setInputFiles('.spot-dialog .spot-photo input', { name: 'lab.png', mimeType: 'image/png', buffer: png });
    await t.waitForSelector('.spot-dialog .spot-photo img');
    const photoUrl = await t.locator('.spot-dialog .spot-photo img').getAttribute('src');
    await t.screenshot({ path: SH + 'dialog.png' });
    await t.click('.spot-dialog .cp-foot .primary');
    const one = await until(async () => saved().spotted?.find((x) => x.studentId === AARON));
    ok(one && one.teacherId === TID && one.classId === CLASS && one.lineId === 'science' && one.image === photoUrl && one.status === 'open', 'saved on the server: open, on science, with the photo');
    ok(!saved().events.some((e) => e.studentId === AARON && e.title === one?.title), 'nothing on Aaron’s map yet');
    ok(saved().notifications.some((n) => n.to === `st:${AARON}` && /^Mr Coultas spotted something you did/.test(n.text)), 'Aaron is notified: "Mr Coultas spotted something you did"');

    // ── Ticks two classmates and spots one moment for both ──
    for (const m of [m1, m2]) await t.locator('.mc-table tr', { hasText: m.name }).locator('.mc-tick input').check();
    await t.click('.mc-spot-bar .primary:has-text("I spotted something (2)")');
    await t.waitForSelector('.spot-dialog');
    ok((await t.locator('.spot-dialog .spot-who').innerText()).includes(m1.name), 'the dialog names the ticked students');
    await t.fill('.spot-dialog input:not([type])', 'Helped set up the science fair');
    await t.click('.spot-dialog .cp-foot .primary');
    const two = await until(async () => { const l = (saved().spotted || []).filter((x) => x.title === 'Helped set up the science fair'); return l.length === 2 ? l : null; });
    ok(two && two.map((x) => x.studentId).sort().join() === [m1.id, m2.id].sort().join(), 'the same moment is suggested to each of the two');
    ok(await t.locator('.mc-tick input:checked').count() === 0, 'the ticks clear after sending');
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);

    // ── Refused on the server ──
    const r1 = await act(tTok, 'spotMoment', [[outsider.id], TID, { title: 'Not in my reach', lineId: 'science' }]);
    ok(r1.status === 403, `spotting for a student outside his reach is refused (${r1.status})`);
    const r2 = await act(tTok, 'acceptSpotted', [one.id, AARON]);
    ok(r2.status === 403, `the teacher cannot accept for Aaron (${r2.status})`);

    // ── Aaron, on a phone, at Simple level ──
    const aTok = await setupWith(U, links[email.get(AARON)]);
    const mine = await state({ cookie: `tp_session=${aTok}` });
    ok(mine.spotted.length === 1 && mine.spotted[0].id === one.id, 'Aaron receives only his own suggestion');
    const m1Tok = await setupWith(U, links[email.get(m1.id)]);
    const r3 = await act(m1Tok, 'acceptSpotted', [one.id, AARON]);
    ok(r3.status === 403, `a classmate cannot accept Aaron’s (${r3.status})`);
    const cA = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.onboard');
    await a.locator('.ob-pick:not(.on)').first().click(); await a.locator('.ob-pick:not(.on)').first().click();
    await a.click('.ob-foot .primary'); await a.click('.ob-foot .primary');
    await a.click('text=Go to my map'); await a.waitForSelector('.simple .sh-actions');
    await a.waitForSelector('.simple .spot-me.big');
    const card = await a.locator('.spot-me').innerText();
    ok(card.includes('Mr Coultas spotted something you did') && card.includes('Kept the group going in the practical'), 'Simple: a big card, "Mr Coultas spotted something you did"');
    ok(await a.locator('.spot-me img').getAttribute('src') === photoUrl, 'with the teacher’s photo');
    ok(await a.locator('.spot-me button:has-text("Add to my journey")').count() === 1 && await a.locator('.spot-me button:has-text("Not for me")').count() === 1, 'with "Add to my journey" and "Not for me"');
    ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await a.screenshot({ path: SH + 'aaron-simple.png' });
    await a.click('.spot-me button:has-text("Add to my journey")');
    await a.waitForSelector('.spot-me', { state: 'detached' });
    const ev = await until(async () => saved().events.find((e) => e.studentId === AARON && e.title === 'Kept the group going in the practical'));
    ok(ev && ev.lineIds[0] === 'science' && ev.spotted?.teacherId === TID && ev.verification === 'teacher-endorsed' && ev.evidence[0]?.url === photoUrl, 'accepted: a station on Science, spotted by Mr Coultas, endorsed, with the photo');
    ok(saved().endorsements.some((n) => n.eventId === ev?.id && n.teacherId === TID), 'the endorsement is Mr Coultas’s');
    ok(saved().spotted.find((x) => x.id === one.id).status === 'accepted', 'the suggestion is accepted');
    ok(saved().notifications.some((n) => n.to === `t:${TID}` && n.text.includes(`${aaron.name.split(' ')[0]} added`)), 'Mr Coultas hears that Aaron added it');
    ok(!aErrs.length, `no page errors for Aaron${aErrs.length ? `: ${aErrs.join(' | ')}` : ''}`);

    // ── A classmate, at Standard level: "Not for me" ──
    ok((await act(m1Tok, 'completeOnboarding', [m1.id, ['science'], 'classic'])).ok && (await act(m1Tok, 'setIntensity', [m1.id, 'standard'])).ok, `${m1.name} is set up at Standard`);
    const cM = await b.newContext({ viewport: { width: 1200, height: 820 } });
    await cM.addCookies([{ name: 'tp_session', value: m1Tok, url: U }]);
    const m = await cM.newPage(); const mErrs = []; m.on('pageerror', (e) => mErrs.push(e.message));
    await m.goto(`${U}/#/me/map`); await m.waitForSelector('.home-head .spot-me');
    ok((await m.locator('.home-head .spot-me').innerText()).includes('Helped set up the science fair'), 'Standard: the suggestion is at the top of the map home');
    await m.screenshot({ path: SH + 'classmate-standard.png' });
    const bells0 = saved().notifications.filter((n) => n.to === `t:${TID}`).length;
    await m.click('.spot-me button:has-text("Not for me")');
    await m.waitForSelector('.spot-me', { state: 'detached' });
    const declined = await until(async () => saved().spotted.find((x) => x.studentId === m1.id && x.status === 'declined'));
    ok(!!declined && !saved().events.some((e) => e.studentId === m1.id && e.title === 'Helped set up the science fair'), 'declined: nothing goes on the map');
    ok(saved().notifications.filter((n) => n.to === `t:${TID}`).length === bells0, 'Mr Coultas is not told');
    ok(!mErrs.length, `no page errors for the classmate${mErrs.length ? `: ${mErrs.join(' | ')}` : ''}`);

    // ── Mr Coultas sees Added / Not added / Waiting, and nothing more about the decline ──
    const tCopy = await state({ cookie: `tp_session=${tTok}` });
    const dCopy = tCopy.spotted.find((x) => x.id === declined.id);
    ok(dCopy && dCopy.status === 'closed' && !('decidedAt' in dCopy), 'his copy of the record says only "closed" for the declined one');
    ok(tCopy.events.some((e) => e.id === ev.id), 'he sees Aaron’s new station');
    await t.reload(); await t.waitForSelector('.spot-list');
    const row = (n) => t.locator('.spot-list li', { hasText: n }).innerText();
    ok((await row(aaron.name)).includes('Added'), 'Aaron: Added');
    ok((await row(m1.name)).includes('Not added'), `${m1.name}: Not added`);
    ok((await row(m2.name)).includes('Waiting'), `${m2.name}: Waiting`);
    await t.screenshot({ path: SH + 'teacher-list.png', fullPage: true });
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
