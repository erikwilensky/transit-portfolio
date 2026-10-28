// Class prompts on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster, then a subject teacher asks a Year 8 class a question from My classes (as a moment on the
// class's line). A Year 8 student in it answers at Simple level on a phone, with a photo. The teacher then sees
// "1 of N" answered, the answer, and the new station in Endorsements. A student outside the class receives nothing.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-prompts-';
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
  // Everyone's notifications (each person's /api/state carries only their own): the saved record.
  const bells = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store.notifications;
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const state = async (h = H) => (await (await fetch(`${U}/api/state`, { headers: h })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = await state();
    const staff = new Map(roster.teachers.map((t) => [t.id, t]));
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    const year = new Map(rec.students.map((s) => [s.id, s.grade + 1]));
    const placesOf = (cid) => rec.enrolments.filter((n) => n.classId === cid && !n.to).map((n) => n.studentId);
    // A Year 8 class on a line, taught by a plain subject teacher with an account.
    const pick = rec.classes.map((c) => ({ c, t: staff.get(c.teacherIds[0]), kids: placesOf(c.id) }))
      .find(({ c, t, kids }) => c.lineId && t && links[t.email] && t.roles.join() === 'teacher' && kids.length > 3 && kids.every((k) => year.get(k) === 8) && kids.some((k) => links[email.get(k)]));
    ok(!!pick, `a Year 8 class on a line${pick ? `: ${pick.c.name} (${pick.kids.length} students, ${pick.t.name}, ${pick.c.lineId})` : ''}`);
    const M = pick.kids.length;
    const lineName = rec.lines.find((l) => l.id === pick.c.lineId).name;

    // ── The teacher asks from My classes ──
    const tTok = await setupWith(U, links[pick.t.email]);
    const TH = { ...H, cookie: `tp_session=${tTok}` };
    const cT = await b.newContext({ viewport: { width: 1300, height: 860 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/classes`); await t.waitForSelector('.mc-list li');
    await t.locator('.mc-list li', { hasText: pick.c.name }).first().locator('.cp-askbtn').click();
    await t.waitForSelector('.cp-ask');
    ok(await t.locator('.cp-ask .cp-check', { hasText: `Add it as a moment on ${lineName}` }).count() === 1, `"Add it as a moment on ${lineName}" is offered`);
    ok(await t.locator('.cp-ask .cp-check input').isChecked(), 'and ticked by default for a class on a line');
    await t.fill('.cp-ask textarea', 'What did you learn from the science fair?');
    await t.fill('.cp-ask input:not([type])', 'Year 8 science fair');
    ok(new RegExp(`${M} students will be asked`).test(await t.locator('.cp-foot').innerText()), `the form says ${M} students will be asked`);
    await t.screenshot({ path: SH + 'ask.png' });
    await t.click('.cp-foot .primary');
    const prompt = await until(async () => (await state()).classPrompts?.find((p) => p.classId === pick.c.id));
    ok(prompt && prompt.studentIds.length === M && prompt.asMoment, `saved on the server, asked of ${prompt?.studentIds.length} students, as a moment`);
    const asked = bells().filter((n) => n.text.includes('What did you learn from the science fair?'));
    ok(asked.length === M && new Set(asked.map((n) => n.to)).size === M, 'every student in the class was notified, once');
    // Another teacher's class (not one of theirs) is refused.
    const other = rec.classes.find((c) => !c.teacherIds.includes(pick.t.id) && placesOf(c.id).length);
    const refused = await fetch(`${U}/api/action`, { method: 'POST', headers: TH, body: JSON.stringify({ fn: 'askClass', args: [other.id, pick.t.id, { question: 'Not my class?' }], rec: [] }) });
    ok(refused.status === 403, `asking ${other.name}, not theirs, is refused (${refused.status})`);

    // ── A Year 8 student answers at Simple level, on a phone, with a photo ──
    const kid = rec.students.find((s) => pick.kids.includes(s.id) && links[email.get(s.id)]);
    const sTok = await setupWith(U, links[email.get(kid.id)]);
    const mine = await state({ cookie: `tp_session=${sTok}` });
    ok(mine.classPrompts.length === 1 && mine.classPrompts[0].studentIds.join() === kid.id, 'the student receives the prompt, without their classmates’ ids');
    const outsider = rec.students.find((s) => !pick.kids.includes(s.id) && links[email.get(s.id)]);
    const theirs = await state({ cookie: `tp_session=${await setupWith(U, links[email.get(outsider.id)])}` });
    ok(!theirs.classPrompts?.length && !theirs.classAnswers?.length, 'a student outside the class receives no prompt');
    const cS = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cS.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
    const s = await cS.newPage(); const errs = []; s.on('pageerror', (e) => errs.push(e.message));
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    await s.locator('.ob-pick:not(.on)').first().click(); await s.locator('.ob-pick:not(.on)').first().click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    await s.waitForSelector('.simple .cp-open .cp-card');
    const top = await s.locator('.simple > *').evaluateAll((els) => els.map((e) => e.className));
    ok(top.indexOf('cp-open big') === 1, `the question is at the top of the Simple home, under the greeting (${top.slice(0, 3).join(' | ')})`);
    ok((await s.locator('.cp-open').innerText()).includes('What did you learn from the science fair?'), 'it shows the question');
    await s.screenshot({ path: SH + 'student-home.png' });
    await s.click('.cp-open .cp-card'); await s.waitForSelector('.cp-flow .cp-big');
    ok(await s.locator('.cp-flow button', { hasText: 'Not for me' }).count() === 1, 'a big question card, with "Not for me"');
    await s.screenshot({ path: SH + 'student-question.png' });
    await s.click('.cp-flow .sh-next .primary');
    await s.fill('.cp-flow textarea', 'Plants grow faster under blue light than red.');
    await s.click('.cp-flow .sh-next .primary');
    ok(await s.locator('.cp-flow .sh-photo-btn.cam input[capture="environment"]').count() === 1, 'the photo step offers the camera on a phone');
    const png = await s.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
    await s.setInputFiles('.cp-flow .sh-photo-btn:not(.cam) input', { name: 'fair.png', mimeType: 'image/png', buffer: png });
    await s.waitForSelector('.cp-flow .sh-preview img');
    const src = await s.locator('.cp-flow .sh-preview img').getAttribute('src');
    await s.click('.cp-flow .sh-next .primary');
    await s.waitForSelector('.cp-flow >> text=Done!');
    ok((await s.locator('.cp-flow').innerText()).includes(`on your ${lineName} line`), 'done: it is on the class’s line, waiting for the teacher');
    await s.screenshot({ path: SH + 'student-done.png' });
    await s.click('.cp-flow .sh-next .primary');
    ok(await s.locator('.cp-open').count() === 0, 'the question is gone from the home once answered');
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    ok(!errs.length, `no student page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    const ev = await until(async () => (await state()).events.find((e) => e.studentId === kid.id && e.title === 'Year 8 science fair'));
    ok(ev && ev.lineIds[0] === pick.c.lineId && ev.evidence[0]?.url === src, 'the station is on the class’s line with the uploaded photo');
    const rq = await until(async () => (await state()).requests.find((r) => r.eventId === ev?.id && r.status === 'pending'));
    ok(rq?.teacherId === pick.t.id, 'its endorsement request went to the asking teacher');

    // ── The teacher sees 1 of N, the answer, and the station in Endorsements ──
    await t.goto(`${U}/#/me/classes/${pick.c.id}`); await t.waitForSelector('.cp-item');
    const item = await t.locator('.cp-item').innerText();
    ok(item.includes(`1 of ${M}`), `the class page says 1 of ${M} answered`);
    ok(item.includes('Plants grow faster under blue light') && item.includes(kid.name), 'and lists the answer with the student’s name');
    const remind = t.locator('.cp-acts button', { hasText: 'Remind the rest' });
    ok(new RegExp(`\\(${M - 1}\\)`).test(await remind.innerText()), `"Remind the rest (${M - 1})"`);
    const n0 = bells().length;
    await remind.click();
    await t.waitForSelector('.cp-acts button:has-text("Reminded today")');
    const n1 = await until(async () => { const n = bells().length; return n > n0 ? n : 0; });
    ok(n1 - n0 === M - 1, `one reminder to each of the ${M - 1} others`);
    ok(await t.locator('.cp-acts button:has-text("Reminded today")').isDisabled(), 'and only once today');
    await t.screenshot({ path: SH + 'class.png', fullPage: true });
    await t.click('.cp-acts a:has-text("Open Endorsements")');
    await t.waitForSelector('text=Year 8 science fair', { timeout: 8000 }).catch(() => {});
    const q = await t.locator('main').innerText();
    ok(q.includes('Year 8 science fair') && q.includes(kid.name.split(' ')[0]), 'the new station is in the teacher’s Endorsements queue');
    await t.screenshot({ path: SH + 'queue.png' });
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);

    // ── At Standard level a second question shows at the top of the map home; "Not for me" hides it ──
    const act = (h, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: h, body: JSON.stringify({ fn, args, rec: [] }) });
    ok((await act(TH, 'askClass', [pick.c.id, pick.t.id, { question: 'Which talk did you like best?', asMoment: false }])).ok, 'a second question, not as a moment');
    ok((await act({ ...H, cookie: `tp_session=${sTok}` }, 'setIntensity', [kid.id, 'standard'])).ok, 'the student switches to Standard');
    await s.goto(`${U}/#/me/map`); await s.reload(); await s.waitForSelector('.home-head .cp-open');
    ok((await s.locator('.home-head .cp-open').innerText()).includes('Which talk did you like best?'), 'Standard: the question is at the top of the map home');
    await s.screenshot({ path: SH + 'standard.png' });
    await s.click('.home-head .cp-card'); await s.click('.cp-flow button:has-text("Not for me")');
    await s.waitForSelector('.home-head .cp-open', { state: 'detached' });
    const skipped = await until(async () => (await state()).classAnswers?.find((a) => a.studentId === kid.id && a.skipped));
    ok(!!skipped, '"Not for me" hides it and the teacher sees it as skipped');
    ok(!errs.length, `no student page errors at Standard${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
