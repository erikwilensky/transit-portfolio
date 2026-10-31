// Moving-up summaries on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and
// imports the real roster. A Year 9 advisor opens "Moving up to Year 10" for their homeroom on My advisory. One of their
// students, on a phone at Simple level, picks moments, says who they are, how they learn best and a hope that becomes a
// goal, keeps the family's "yes" and finishes. A classmate starts a draft. The advisor sees "Summaries: 1 of N done",
// reminds the rest, reads the summary and prints it on one A4 page. A subject teacher of the student and an unrelated
// teacher get nothing; the family (in Thai) sees it; the activity log has the changes; after the next year's import the
// new advisor finds it in the Last year panel and the old one no longer does. Every account has its own browser context.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: SCRATCH or the temp folder, tp-mu-*.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(process.env.SCRATCH || os.tmpdir(), 'tp-mu-');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
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
const day = (n) => new Date(Date.now() + 7 * 36e5 - n * 864e5).toISOString().slice(0, 10); // Bangkok, n days ago

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-mu-data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const stateOf = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const tok = {}; const tokOf = async (id) => (tok[id] ||= await setupWith(U, links[person(id).email]));
    const classesOf = (sid) => roster.enrolments.filter((e) => e.studentId === sid).map((e) => e.classId);
    // A Year 9 homeroom whose advisor is a plain advisor (no whole-school role), and two of its students.
    const adv = roster.teachers.find((t) => !t.roles.some((r) => ['coordinator', 'leadership', 'counsellor'].includes(r)) && links[t.email] && roster.students.some((s) => s.advisorId === t.id && s.year === 9));
    const kids = roster.students.filter((s) => s.advisorId === adv.id).sort((a, c) => a.name.localeCompare(c.name));
    const [kid, mate] = kids.filter((s) => links[s.email]);
    const subj = roster.teachers.find((t) => t.id !== adv.id && links[t.email] && !t.roles.some((r) => ['coordinator', 'leadership', 'counsellor'].includes(r)) && roster.classes.some((c) => c.teacherIds.includes(t.id) && classesOf(kid.id).includes(c.id)));
    const other = roster.teachers.find((t) => ![adv.id, subj.id].includes(t.id) && links[t.email] && !t.roles.some((r) => ['coordinator', 'leadership', 'counsellor'].includes(r)) && !roster.students.some((s) => s.advisorId === t.id && s.id === kid.id) && !roster.classes.some((c) => c.teacherIds.includes(t.id) && classesOf(kid.id).includes(c.id)));
    ok(kid && mate && subj && other && kids.every((s) => s.year === 9), `${adv.name} advises ${kid.homeroom} (${kids.length}); ${kid.name} and ${mate.name}; ${subj.name} teaches ${kid.name.split(' ')[0]}; ${other.name} does not`);

    const kT = await tokOf(kid.id), mT = await tokOf(mate.id), aT = await tokOf(adv.id), sT = await tokOf(subj.id), oT = await tokOf(other.id);
    ok((await act(kT, 'completeOnboarding', [kid.id, ['science', 'art'], 'classic'])).ok && (await act(kT, 'setIntensity', [kid.id, 'simple'])).ok, `${kid.name} is set up at Simple`);
    for (const [title, line, n, visibility] of [['Built a bridge out of straws', 'science', 400, 'advisor'], ['Painted the class mural', 'art', 120, 'school'], ['Ran the 800 m at sports day', 'science', 20, 'advisor'], ['My worry diary', 'art', 5, 'private']]) await act(kT, 'addStation', [kid.id, { title, lineIds: [line], date: day(n), type: 'project', visibility }]);
    await act(mT, 'completeOnboarding', [mate.id, ['science'], 'classic']);

    // ── Refused on the server ──
    const spec = { title: 'Moving up to Year 10', opens: day(0), closes: day(-21), advisorId: adv.id };
    ok((await act(kT, 'openMovingUp', [spec, adv.id])).status === 403, 'a student cannot open one');
    ok((await act(oT, 'openMovingUp', [spec, other.id])).status === 403, `another teacher (${other.name}) cannot open one for ${kid.homeroom}`);
    ok((await act(aT, 'openMovingUp', [{ ...spec, advisorId: null, year: 9 }, adv.id])).status === 403, 'nor can the advisor open it for the whole Year');

    // ── The advisor opens it on My advisory ──
    const cA = await b.newContext({ viewport: { width: 1300, height: 900 } }); await cA.addCookies([{ name: 'tp_session', value: aT, url: U }]);
    const a = await cA.newPage(); a.errs = []; a.on('pageerror', (e) => a.errs.push(e.message));
    await a.goto(`${U}/#/me/advisory`); await a.waitForSelector('.mu-adv');
    await a.click('.mu-adv button:has-text("Open moving-up summaries")');
    ok(await a.locator('.mu-adv .tr-form input').first().inputValue() === 'Moving up to Year 10', 'the title is suggested: "Moving up to Year 10"');
    await a.click(`.mu-adv .tr-form button:has-text("Open for ${kids.length} students")`);
    const w = await until(async () => saved().movingUpWindows?.[0]);
    ok(w && w.studentIds.length === kids.length && w.advisorId === adv.id && w.by === adv.id, `saved: a window for the ${kids.length} advisees, opened by the advisor`);
    ok(saved().notifications.filter((n) => n.go?.param === 'movingup').length === kids.length, 'each student is told');
    await a.waitForSelector('.mu-count');
    ok((await a.locator('.mu-count').innerText()) === `Summaries: 0 of ${kids.length} done`, `the strip: "Summaries: 0 of ${kids.length} done"`);
    ok((await act(aT, 'saveMovingUp', [w.id, kid.id, {}])).status === 403, 'the advisor cannot write it for the student');
    ok((await act(mT, 'saveMovingUp', [w.id, kid.id, {}])).status === 403, 'nor can a classmate');

    // ── The student, on a phone, at Simple ──
    const cK = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true }); await cK.addCookies([{ name: 'tp_session', value: kT, url: U }]);
    const k = await cK.newPage(); k.errs = []; k.on('pageerror', (e) => k.errs.push(e.message));
    await k.goto(`${U}/#/me/map/movingup`); await k.waitForSelector('.mu-flow');
    ok(true, 'the notification’s link (#/me/map/movingup) opens the summary');
    await k.click('.mu-flow .panel-close'); await k.waitForSelector('.mu-card.simple');
    ok((await k.locator('.mu-card').innerText()).includes('Where I’ve been, where I’m going'), 'Simple home: a "Where I’ve been, where I’m going" card');
    ok(await noScroll(k), 'no sideways scroll at phone width (home)');
    await k.screenshot({ path: SH + 'card.png' });
    await k.click('.mu-card button:has-text("Start")'); await k.waitForSelector('.mu-flow .tr-picks');
    ok(await k.locator('.mu-flow .tr-pick').count() === 3, 'look back: three moments of the stage, never the private one');
    await k.locator('.tr-pick', { hasText: 'Built a bridge' }).click();
    await k.locator('.tr-pick', { hasText: 'Painted the class mural' }).click();
    ok(await noScroll(k), 'no sideways scroll (look back)');
    await k.click('.sh-next .primary:has-text("Next")');
    await k.waitForSelector('#mu-who');
    await k.locator('.tr-q').nth(0).locator('button:has-text("People say I am…")').click(); await k.locator('#mu-who').pressSequentially('kind and curious');
    await k.locator('#mu-proud').fill('I finished the 800 m.');
    await k.click('.sh-next .primary:has-text("Next")'); await k.waitForSelector('#mu-learn');
    await k.locator('.tr-q').nth(0).locator('button:has-text("I learn best when…")').click(); await k.locator('#mu-learn').pressSequentially('I can try it with my hands');
    await k.locator('#mu-helps').fill('A quiet word before a test.');
    await k.screenshot({ path: SH + 'learn.png' });
    await k.click('.sh-next .primary:has-text("Next")'); await k.waitForSelector('#mu-hope-0');
    await k.fill('#mu-hope-0', 'Join the robotics club');
    await k.check('.mu-hope .mu-goal input');
    await k.locator('.mu-hope .sh-lines button', { hasText: 'Science' }).click();
    ok(await noScroll(k), 'no sideways scroll (hopes)');
    await k.click('.sh-next .primary:has-text("Next")'); await k.waitForSelector('.mu-fams');
    ok(await k.locator('.mu-fams [aria-checked="true"]').innerText() === 'Yes, my family can see it', 'Year 9: the family sees it unless they say no');
    await k.click('.sh-next .primary:has-text("Next")'); await k.waitForSelector('.mu-flow .mu-sum');
    const rv = await k.locator('.mu-flow .mu-sum').innerText();
    ok(rv.includes('People say I am kind and curious') && rv.includes('Join the robotics club') && rv.includes('Built a bridge out of straws'), 'review: their words, the starter, the hope and the moments');
    if (!await k.evaluate(() => !!window.axe)) await k.addScriptTag({ path: AXE });
    const ax = await k.evaluate(() => window.axe.run(document.querySelector('.mu-flow'), { resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id)));
    ok(!ax.length, `axe: the review screen${ax.length ? ` ${ax.join(', ')}` : ''}`);
    await k.screenshot({ path: SH + 'review.png' });
    await k.click('.tr-finish'); await k.waitForSelector('h2:has-text("Well done")');
    const rec = await until(async () => saved().movingUp?.find((r) => r.studentId === kid.id && r.status === 'done'));
    const goal = rec && saved().events.find((e) => e.id === rec.goalIds[0]);
    ok(rec && rec.stage === 9 && rec.family === true && rec.moments.length === 2 && rec.who === 'People say I am kind and curious', 'saved on the record: done, Year 9, family yes, two moments, their words');
    ok(goal && goal.type === 'goal' && goal.title === 'Join the robotics club' && goal.lineIds[0] === 'science', 'the hope is a goal on their journey');
    await k.click('.mu-flow .primary:has-text("Close")');
    await k.waitForSelector('.mu-mine');
    ok(await k.locator('.mu-card:not(.mu-mine)').count() === 0, 'the Start card is gone; "My moving-up summary" stays');
    ok(!k.errs.length, `no page errors for the student${k.errs.length ? `: ${k.errs.join(' | ')}` : ''}`);

    // ── A classmate starts a draft ──
    ok((await act(mT, 'saveMovingUp', [w.id, mate.id, { who: 'Quiet but funny', step: 1 }])).ok, `${mate.name} saves a draft`);

    // ── The advisor sees it ──
    await a.reload(); await a.waitForSelector('.mu-count');
    ok((await a.locator('.mu-count').innerText()) === `Summaries: 1 of ${kids.length} done` && /1 started/.test(await a.locator('.mu-adv .tr-strip').innerText()), `"Summaries: 1 of ${kids.length} done", 1 started`);
    const advState = await stateOf(aT);
    const draft = advState.movingUp.find((r) => r.studentId === mate.id);
    ok(draft && draft.status === 'draft' && !('who' in draft), 'the advisor gets the draft only as started, never its words');
    await a.click('.mu-adv button.mu-remind');
    await a.click('.mu-adv .nd-edit .primary:has-text("Send")');
    ok(await until(async () => (saved().nudges || []).filter((n) => n.about === `movingup:${w.id}`).length === kids.length - 1), `reminders sent to the ${kids.length - 1} who have not finished`);
    await a.click('.mu-adv button:has-text("Read the summaries (1)")'); await a.waitForSelector('.mu-sheet');
    const sheet = await a.locator('.mu-sheet').innerText();
    ok(sheet.includes(kid.name) && sheet.includes('A quiet word before a test.') && sheet.includes('Now a goal on my journey'), 'the advisor reads the summary');
    await a.emulateMedia({ media: 'print' });
    const pdf = await a.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH + 'sheet.pdf', pdf);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 1, `prints on one A4 page (${pages})`);
    await a.emulateMedia({ media: 'screen' });
    await a.screenshot({ path: SH + 'sheet.png', fullPage: true });
    await a.click('.mu-bar .ghost:has-text("Close")');
    await a.goto(`${U}/#/me/student/${kid.id}`); await a.waitForSelector('.mu-staff');
    ok((await a.locator('.mu-staff').innerText()).includes('I can try it with my hands'), 'the advisor’s student page shows it');
    ok(!a.errs.length, `no page errors for the advisor${a.errs.length ? `: ${a.errs.join(' | ')}` : ''}`);

    // ── Teachers who are not the advisor ──
    const ss = await stateOf(sT), os_ = await stateOf(oT);
    ok(ss.students.some((s) => s.id === kid.id) && !(ss.movingUp || []).length, `${subj.name} teaches ${kid.name.split(' ')[0]} but receives no summary`);
    ok(!os_.students.some((s) => s.id === kid.id) && !(os_.movingUp || []).length && !(os_.movingUpWindows || []).length, `${other.name} receives neither the student nor the summary`);
    const cO = await b.newContext({ viewport: { width: 1200, height: 860 } }); await cO.addCookies([{ name: 'tp_session', value: oT, url: U }]);
    const o = await cO.newPage();
    await o.goto(`${U}/#/me/student/${kid.id}`); await o.waitForTimeout(800);
    ok(await o.locator('.mu-staff').count() === 0 && !(await o.locator('body').innerText()).includes('I can try it with my hands'), 'the unrelated teacher’s browser cannot show it');
    const cS = await b.newContext({ viewport: { width: 1200, height: 860 } }); await cS.addCookies([{ name: 'tp_session', value: sT, url: U }]);
    const sp = await cS.newPage();
    await sp.goto(`${U}/#/me/student/${kid.id}`); await sp.waitForTimeout(800);
    ok(await sp.locator('.mu-staff').count() === 0, 'nor the subject teacher’s');
    ok((await act(oT, 'closeMovingUp', [w.id])).status === 403 && (await act(sT, 'finishMovingUp', [w.id, kid.id, {}])).status === 403, 'neither can close it or write in it (403)');

    // ── The family, in Thai ──
    const fr = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'family.mu@example.org', name: `Family of ${kid.name}`, kind: 'parent', children: [kid.id] }) })).json();
    const fT = await setupWith(U, fr.setupUrl.split('/setup/')[1]);
    await fetch(`${U}/api/auth/prefs`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `tp_session=${fT}`, origin: U }, body: JSON.stringify({ lang: 'th' }) });
    const cF = await b.newContext({ viewport: { width: 1200, height: 860 } }); await cF.addCookies([{ name: 'tp_session', value: fT, url: U }]);
    const f = await cF.newPage(); f.errs = []; f.on('pageerror', (e) => f.errs.push(e.message));
    await f.goto(`${U}/#/me/family`); await f.waitForSelector('.mu-fam-card');
    const ft = await f.locator('.mu-fam-card').innerText();
    ok(ft.includes('สรุปก่อนขึ้นชั้นของ') && ft.includes('วิธีที่ฉันเรียนรู้ได้ดีที่สุด') && ft.includes('A quiet word before a test.'), 'the family reads it, with Thai labels and the student’s own words');
    ok(!ft.includes('My worry diary'), 'never the private moment');
    await f.screenshot({ path: SH + 'family.png', fullPage: true });
    await k.uncheck('.mu-mine .mu-fam input');
    await until(async () => saved().movingUp.find((r) => r.id === rec.id).family === false);
    ok(!((await stateOf(fT)).movingUp || []).length, 'the student says no: the family no longer receives it');
    await f.reload(); await f.waitForSelector('.page.family'); await f.waitForTimeout(500);
    ok(await f.locator('.mu-fam-card').count() === 0, 'and the family view no longer shows it');
    ok(!f.errs.length, `no page errors for the family${f.errs.length ? `: ${f.errs.join(' | ')}` : ''}`);

    // ── Activity log ──
    const log = await (await fetch(`${U}/api/audit?action=change&size=500`, { headers: H })).json();
    const fns = (fn, result = 'ok') => log.entries.filter((e) => e.fn === fn && e.result === result);
    ok(fns('openMovingUp').length === 1 && fns('finishMovingUp').some((e) => e.target.studentId === kid.id) && fns('setMovingUpFamily').length === 1, 'activity log: opened, finished (with the student) and the family choice');
    ok(fns('saveMovingUp', 'refused').length >= 2 && fns('openMovingUp', 'refused').length >= 3, 'activity log: the refusals too');
    ok(!JSON.stringify(log.entries).includes('A quiet word'), 'activity log: never the words');

    // ── Next year: the class lists move the student to a new advisor ──
    const NEW = roster.teachers.find((t) => t.id !== adv.id && links[t.email] && roster.students.some((s) => s.advisorId === t.id && s.year === 10) && !roster.classes.some((c) => c.teacherIds.includes(t.id) && classesOf(kid.id).includes(c.id)));
    const next = structuredClone(roster);
    next.school = { ...next.school, academicYear: '2027-28' };
    Object.assign(next.students.find((s) => s.id === kid.id), { advisorId: NEW.id, year: 10, homeroom: '10X' });
    const advClasses = new Set(next.classes.filter((c) => c.teacherIds.includes(adv.id)).map((c) => c.id));
    next.enrolments = next.enrolments.filter((e) => !(e.studentId === kid.id && advClasses.has(e.classId)));
    const ni = await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster: next }) });
    ok(ni.ok, 'the next year’s class lists are imported');
    const nT = await tokOf(NEW.id);
    const cN = await b.newContext({ viewport: { width: 1300, height: 900 } }); await cN.addCookies([{ name: 'tp_session', value: nT, url: U }]);
    const n = await cN.newPage(); n.errs = []; n.on('pageerror', (e) => n.errs.push(e.message));
    await n.goto(`${U}/#/me/student/${kid.id}`); await n.waitForSelector('.yh-last');
    const ly = await n.locator('.yh-last').innerText();
    ok(ly.includes('Where I’ve been, where I’m going') && ly.includes('I can try it with my hands') && ly.includes('Join the robotics club'), `${NEW.name} (next advisor) finds it in the Last year panel`);
    ok(await n.locator('.mu-staff:not(.mu-in-ly)').count() === 0, 'shown once, inside Last year');
    await n.screenshot({ path: SH + 'last-year.png', fullPage: true });
    ok(!((await stateOf(aT)).movingUp || []).some((r) => r.studentId === kid.id), 'the previous advisor no longer receives it');
    ok(!n.errs.length, `no page errors for the next advisor${n.errs.length ? `: ${n.errs.join(' | ')}` : ''}`);
  } finally {
    console.log('INFO screenshots and the PDF:', `${SH}*`);
    await b.close(); srv.p.kill();
  }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
