// Not seen lately on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) on the real roster.
// Two classmates of Aaron Torres (Sabc0d6125e85) in C-392000 add something on Science (one of them "Only me"). Mr David
// Coultas (T60198) sees the rest as quiet on My classes and on the class page (2/4/6 weeks), nudges Aaron with a short line,
// opens "Nudge all" and cancels at the confirm, and finds the section on This week. Aaron, on a phone at Simple level, sees
// the banner, which opens the add flow on Science, adds a moment and the banner goes. Another teacher, a student and a
// family cannot nudge for that class; a second nudge inside 7 days is refused. Ms Jane Altemen (8C's advisor) sees a count.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots to SCRATCH or the temp folder (tp-nsl-*).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(process.env.SCRATCH || os.tmpdir(), 'tp-nsl-');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const TID = 'T60198', AARON = 'Sabc0d6125e85', CLASS = 'C-392000', ALTEMEN = 'T25948';
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
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nsl-data-'));
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
    const tEmail = new Map(roster.teachers.map((t) => [t.id, t.email])), sEmail = new Map(roster.students.map((x) => [x.id, x.email]));
    const rec = await state(adminTok);
    const kids = rec.enrolments.filter((n) => n.classId === CLASS && !n.to).map((n) => n.studentId);
    const aaron = rec.students.find((s) => s.id === AARON);
    const cls = rec.classes.find((c) => c.id === CLASS);
    ok(cls?.lineId === 'science' && kids.includes(AARON), `${cls?.name} is on Science, ${kids.length} students, ${aaron?.name} in it`);
    const [m1, m2] = rec.students.filter((s) => kids.includes(s.id) && s.id !== AARON && links[sEmail.get(s.id)]).sort((a, c) => a.name.localeCompare(c.name));
    const other = roster.teachers.find((t) => t.id !== TID && links[t.email] && !rec.classes.some((c) => c.id === CLASS && c.teacherIds.includes(t.id)) && rec.classes.some((c) => c.teacherIds.includes(t.id)));

    // ── Two classmates add something on Science: one for the advisor, one "Only me" ──
    const m1Tok = await setupWith(U, links[sEmail.get(m1.id)]), m2Tok = await setupWith(U, links[sEmail.get(m2.id)]);
    ok((await act(m1Tok, 'addStation', [m1.id, { title: 'Pendulum timings', lineIds: ['science'], type: 'project', visibility: 'advisor' }])).ok, `${m1.name} adds a Science moment`);
    ok((await act(m2Tok, 'addStation', [m2.id, { title: 'My own lab notes', lineIds: ['science'], type: 'project', visibility: 'private' }])).ok, `${m2.name} adds a private Science moment`);

    // ── Mr Coultas: My classes, then the class page ──
    const tTok = await setupWith(U, links[tEmail.get(TID)]);
    const tCopy = await state(tTok);
    ok(!tCopy.events.some((e) => e.studentId === m2.id && e.visibility === 'private'), 'his copy never holds the private moment');
    ok(!!tCopy.lineSeen?.[CLASS]?.last?.[m2.id] && !JSON.stringify(tCopy.lineSeen).includes('My own lab notes'), 'only its date reaches him (lineSeen)');
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/classes`); await t.waitForSelector('.mc-list');
    const row = t.locator('.mc-list li', { has: t.locator(`a[href$="/classes/${CLASS}"]`) });
    const quietN = kids.length - 2;
    ok((await row.locator('.nsl-row summary').innerText()).trim() === `${quietN} not seen lately on Science`, `My classes: "${quietN} not seen lately on Science" on ${cls.name}`);
    await row.locator('.nsl-row summary').click(); await row.locator('.nsl li').first().waitFor();
    ok(await row.locator('.nsl li').count() >= Math.min(quietN, 8), 'opening it lists the quiet students');
    await audit(t, 'My classes with a class opened');
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.nsl');
    const card = t.locator('.mc .nsl').first();
    const names = await card.locator('.nd-who b').allInnerTexts();
    ok(names.includes(aaron.name) && !names.includes(m1.name) && !names.includes(m2.name), 'class page: Aaron is listed; the two who added something (one privately) are not');
    ok((await card.locator('.nd-who small').first().innerText()).includes('Nothing added yet'), 'each says when they last added something ("Nothing added yet")');
    ok(await card.locator('.nsl-weeks button').count() === 3 && await card.locator('.nsl-weeks button[aria-pressed="true"]').innerText() === '4 weeks', 'the switch: 2, 4 or 6 weeks, 4 to start');
    await card.locator('.nsl-weeks button:has-text("2 weeks")').click();
    ok(await card.locator('.nsl-weeks button[aria-pressed="true"]').innerText() === '2 weeks' && (await card.locator('.fineprint').first().innerText()).includes('in 2 weeks'), 'switching to 2 weeks');
    await card.locator(`button[aria-label="Nudge ${aaron.name}"]`).click();
    ok((await card.locator('.nsl-msg').innerText()) === 'Mr Coultas would love to see something from Science', 'the nudge reads "Mr Coultas would love to see something from Science"');
    await card.locator('.nsl-note').fill('A photo of your circuit would be great.');
    await audit(t, 'class page, nudge open');
    await t.screenshot({ path: SH + 'teacher-nudge.png', fullPage: true });
    await card.locator('.nsl-edit .primary').click();
    const nd = await until(async () => saved().classNudges?.find((n) => n.studentId === AARON));
    ok(nd && nd.classId === CLASS && nd.from === TID && nd.lineId === 'science' && nd.note === 'A photo of your circuit would be great.', 'saved: one nudge for Aaron, Science, with the line');
    const note = saved().notifications.find((n) => n.to === `st:${AARON}` && /would love to see/.test(n.text));
    ok(note && note.kind === 'teacher' && note.text === 'Mr Coultas would love to see something from Science: “A photo of your circuit would be great.”' && note.go?.param === 'add~science', 'Aaron is notified (kind teacher), opening the add flow on Science');
    await t.waitForSelector(`.nsl li[data-student="${AARON}"] .nd-sent`);
    ok((await t.locator(`.mc .nsl li[data-student="${AARON}"] .nd-sent`).first().innerText()) === 'Nudged today', 'his row now says "Nudged today"');
    // Nudge all: a confirm with the names; cancelled.
    const all = card.locator('.nsl-all');
    ok((await all.innerText()) === `Nudge all ${quietN - 1}`, `"Nudge all ${quietN - 1}" (everyone not nudged this week)`);
    await all.click();
    ok((await card.locator('.nsl-confirm b').innerText()) === `Nudge all ${quietN - 1} students?` && (await card.locator('.nsl-edit .primary').innerText()) === `Yes, nudge ${quietN - 1}`, 'a confirm: "Nudge all N students?" and "Yes, nudge N"');
    await card.locator('.nsl-edit button:has-text("Cancel")').click();
    await t.waitForTimeout(400);
    ok(saved().classNudges.length === 1, 'cancelled: nothing more sent');
    // This week.
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.tw');
    ok((await t.locator('.nsl-week summary', { hasText: cls.name }).innerText()).includes('not seen lately on Science'), 'This week: a "Not seen lately" section with the class');
    await audit(t, 'This week');
    await t.screenshot({ path: SH + 'teacher-week.png', fullPage: true });
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);

    // ── Refused ──
    const oTok = await setupWith(U, links[other.email]);
    ok((await act(oTok, 'nudgeClass', [CLASS, [m1.id], other.id])).status === 403, `${other.name}, who does not teach it, cannot nudge for ${CLASS} (403)`);
    ok((await act(m1Tok, 'nudgeClass', [CLASS, [m1.id], TID])).status === 403, 'a student cannot (403)');
    ok((await act(tTok, 'nudgeClass', [CLASS, [AARON], TID])).status === 409, 'a second nudge for Aaron inside 7 days is refused (409)');
    const ms = rec.students.find((s) => !kids.includes(s.id));
    ok((await act(tTok, 'nudgeClass', [CLASS, [ms.id], TID])).status === 403, 'nor for a student not in the class (403)');
    ok(saved().classNudges.length === 1, 'still one nudge');
    const fams = (await state(m1Tok)).classNudges;
    ok(Array.isArray(fams) && fams.length === 0, 'a classmate’s copy holds no one else’s nudge');

    // ── Ms Altemen, 8C's advisor: a count only ──
    if (aaron.advisorId === ALTEMEN) {
      const alTok = await setupWith(U, links[tEmail.get(ALTEMEN)]);
      const alCopy = (await state(alTok)).classNudges;
      ok(alCopy.length === 1 && Object.keys(alCopy[0]).sort().join() === 'date,id,studentId', 'the advisor’s copy: that one was sent (id, student, date), not what it said or which class');
      const cAl = await b.newContext({ viewport: { width: 1300, height: 900 } });
      await cAl.addCookies([{ name: 'tp_session', value: alTok, url: U }]);
      const al = await cAl.newPage();
      await al.goto(`${U}/#/me/student/${AARON}`); await al.waitForSelector('.nsl-adv');
      ok((await al.locator('.nsl-adv p').innerText()).includes('once in the last 30 days'), 'her student page: "Subject teachers nudged them once in the last 30 days"');
    } else ok(false, `Aaron's advisor is ${aaron.advisorId}`);

    // ── Aaron, on a phone, at Simple level ──
    const aTok = await setupWith(U, links[sEmail.get(AARON)]);
    const cA = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.onboard');
    await a.locator('.ob-pick:not(.on)').first().click(); await a.locator('.ob-pick:not(.on)').first().click();
    await a.click('.ob-foot .primary'); await a.click('.ob-foot .primary');
    await a.click('text=Go to my map'); await a.waitForSelector('.simple .sh-actions');
    await a.waitForSelector('.nsl-banner');
    const banner = await a.locator('.nsl-banner').innerText();
    ok(banner.includes('Mr Coultas would love to see something from Science') && banner.includes('A photo of your circuit would be great.'), 'Simple: the banner, with the teacher’s line');
    ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await audit(a, 'Aaron, Simple home with the banner');
    await a.screenshot({ path: SH + 'aaron-banner.png', fullPage: true });
    await a.click('.nsl-banner >> text=Add something');
    await a.waitForSelector('.sh-flow');
    await a.fill('.sh-flow .sh-input', 'Built a circuit with a buzzer');
    await a.click('.sh-flow .sh-next .primary');
    ok(await a.locator('.sh-flow .sh-lines').count() === 0, 'the flow skips "which colour": it is on Science already');
    const finish = a.locator('.sh-flow .sh-next .primary');
    await finish.click();
    const notNow = a.locator('.sh-flow .sh-notnow');
    if (await notNow.count()) await notNow.click();
    const ev = await until(async () => saved().events.find((e) => e.studentId === AARON && e.title === 'Built a circuit with a buzzer'));
    ok(ev && ev.lineIds[0] === 'science', 'a moment on Science');
    await a.waitForSelector('.nsl-banner', { state: 'detached' });
    ok(true, 'the banner goes once he has added something for Science');
    ok(!aErrs.length, `no page errors for Aaron${aErrs.length ? `: ${aErrs.join(' | ')}` : ''}`);
    // The teacher no longer sees him as quiet.
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.mc .nsl');
    ok(!(await t.locator('.mc .nsl .nd-who b').allInnerTexts()).includes(aaron.name), 'Mr Coultas: Aaron is off the list');
    // The activity log names the change, never the words.
    const log = await (await fetch(`${U}/api/audit?action=change`, { headers: H })).json();
    const line = log.entries.find((e) => e.fn === 'nudgeClass' && e.result === 'ok');
    ok(line && line.target.studentId === AARON && line.target.teacherId === TID && !JSON.stringify(line).includes('circuit would be great'), 'activity log: nudgeClass, Aaron, Mr Coultas, no text');
    ok(log.entries.some((e) => e.fn === 'nudgeClass' && e.result === 'refused'), 'activity log: the refusals too');
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
