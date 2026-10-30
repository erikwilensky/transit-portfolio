// School events on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real roster,
// each account in its own browser context. The admin adds Sports day for Year 8 (yesterday, with a photo, a line and a
// question) and imports two more from a CSV. Aaron Torres (Year 8, 8C, Simple, on a phone) gets the card on his home and
// adds a moment from it in the guided flow, already filled; an 8C classmate at Standard sees Week Without Walls under
// Coming up, sets a goal for it and says Sports day is not for her. Ms Jane Altemen (8C's advisor) sees 8C's count; a
// coordinator sends the one reminder (a second is refused); a Year 10 student never gets Sports day; Aaron's family sees
// the event's name on his moment. Refusals over /api/action, the activity log, and axe on the new screens.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-events-*.png in the temp folder.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-events-'));
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', ALTEMEN = 'T25948';
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
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const day = (n) => new Date(Date.now() + 7 * 36e5 + n * 864e5).toISOString().slice(0, 10); // Bangkok
async function audit(p, label) {
  await p.waitForTimeout(600); // dialogs fade in
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(SH, 'data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const stateOf = async (tok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const tokOf = async (id) => setupWith(U, links[person(id).email]);
    const aaron = person(AARON), altemen = person(ALTEMEN);
    const year8 = roster.students.filter((s) => s.year === 8);
    const mate = year8.find((s) => s.homeroom === '8C' && s.id !== AARON && links[s.email]);
    const y10 = roster.students.find((s) => s.year === 10 && links[s.email]);
    const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && !t.roles.includes('leadership') && links[t.email]);
    const [aTok, mTok, yTok, alTok, cTok] = [await tokOf(AARON), await tokOf(mate.id), await tokOf(y10.id), await tokOf(ALTEMEN), await tokOf(coord.id)];
    for (const [tok, s] of [[aTok, aaron], [mTok, mate], [yTok, y10]]) await act(tok, 'completeOnboarding', [s.id, ['science'], null]);
    await act(mTok, 'setIntensity', [mate.id, 'standard']); await act(yTok, 'setIntensity', [y10.id, 'standard']);
    ok(aaron.homeroom === '8C' && aaron.advisorId === ALTEMEN, `${aaron.name} (8C, Simple), ${mate.name} (8C, Standard), ${y10.name} (Year 10), ${coord.name} (coordinator), ${altemen.name} (8C’s advisor)`);
    const ctx = async (tok, phone) => {
      const c = await b.newContext(phone ? { ...devices['Pixel 7'] } : { viewport: { width: 1300, height: 900 } });
      await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { c, p };
    };
    const go = async (p, hash) => { await p.goto(`${U}/${hash}`); await p.waitForSelector('.topnav'); };

    // ── The admin adds Sports day for Year 8, yesterday ──
    let A = await ctx(adminTok);
    await go(A.p, '#/me/events');
    ok((await A.p.locator('.topnav :text-is("School events")').count()) > 0 && await A.p.isVisible('.se-head h1'), 'School events is in the admin’s navigation, and opens');
    await A.p.click('.se-head .primary');
    const dlg = A.p.locator('.se-set');
    await dlg.locator('label:has-text("Name") input').fill('Sports day');
    await dlg.locator('label:has-text("First day") input').fill(day(-1));
    await dlg.locator('.se-radio:has-text("Some Years") input').check();
    await dlg.locator('.se-chip:has-text("Year 8") input').check();
    ok(new RegExp(`^${year8.length} students$`).test((await dlg.locator('.se-for [role=status]').innerText()).trim()), `Year 8: ${year8.length} students`);
    await dlg.locator('select').selectOption('sport');
    await dlg.locator('label:has-text("A question") input').fill('What was your best moment?');
    await dlg.locator('.se-photo input[type=file]').setInputFiles({ name: 'sports.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(ROOT, 'public/icons/icon-192.png')) });
    await dlg.locator('.se-photo img').waitFor();
    await audit(A.p, 'Add a school event');
    await A.p.screenshot({ path: path.join(SH, 'tp-events-add.png') });
    await dlg.locator('.cp-foot .primary').click();
    const ev = await until(() => (saved().schoolEvents || []).find((x) => x.title === 'Sports day'));
    ok(!!ev && ev.studentIds.length === year8.length && ev.lineId === 'sport' && /api\/files\//.test(ev.photo || '') && ev.question, `saved: for ${ev?.studentIds.length} students, on Sport, with a photo and a question`);
    // Import from a CSV: Week Without Walls (Years 8 and 10), a concert (whole school); a bad file shows its rows to fix.
    await A.p.click('.se-head .ghost');
    const imp = A.p.locator('.se-set');
    await imp.locator('input[type=file]').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('title,start,end,years,line\nTrip,soon,,8,\n') });
    await imp.locator('.se-errs').waitFor().catch(() => {});
    ok(await imp.locator('.se-errs').isVisible() && await imp.locator('.cp-foot .primary').isDisabled(), 'a row with a bad date is shown, and nothing can be imported');
    await imp.locator('input[type=file]').setInputFiles({ name: 'events.csv', mimeType: 'text/csv', buffer: Buffer.from(`title,start,end,years,line\r\nWeek Without Walls,${day(6)},${day(9)},8;10,Service\r\n"Concert, winter",${day(20)},,,Music\r\n`) });
    await imp.locator('.se-preview').waitFor();
    await audit(A.p, 'Import school events');
    await imp.locator('.cp-foot .primary').click();
    const www = await until(() => (saved().schoolEvents || []).find((x) => x.title === 'Week Without Walls'));
    ok(!!www && www.for.years.join() === '8,10' && www.lineId === 'service' && (saved().schoolEvents || []).some((x) => x.title === 'Concert, winter' && x.for.kind === 'school'), 'CSV imported: Week Without Walls (Years 8 and 10, Service), Concert, winter (whole school)');
    await A.p.waitForSelector('.se-row:has-text("Week Without Walls")');
    await audit(A.p, 'School events, admin');
    await A.c.close();

    // ── Refusals ──
    const fields = { title: 'Mine', start: day(1), for: { kind: 'school' } };
    ok((await act(alTok, 'addSchoolEvent', [fields, ALTEMEN])).status === 403, 'an advisor cannot add an event');
    ok((await act(aTok, 'addSchoolEvent', [fields, null])).status === 403, 'a student cannot add an event');
    ok((await act(cTok, 'addSchoolEvent', [fields, ALTEMEN])).status === 403, 'a coordinator only as themselves');
    ok((await act(yTok, 'dismissSchoolEvent', [ev.id, y10.id])).status === 403, 'a Year 10 student cannot dismiss the Year 8 event');
    ok((await act(aTok, 'dismissSchoolEvent', [ev.id, mate.id])).status === 403, 'Aaron cannot dismiss it for a classmate');
    ok((await act(alTok, 'remindSchoolEvent', [ev.id, ALTEMEN])).status === 403, 'an advisor cannot send the reminder');

    // ── Aaron, on his phone at Simple level: the card, then the guided add flow already filled ──
    let S = await ctx(aTok, true);
    await go(S.p, '#/me/map');
    await S.p.waitForSelector('.simple .se-card');
    const card = (await S.p.innerText('.se-card')).replace(/\s+/g, ' ');
    ok(/Add something from Sports day/.test(card) && await S.p.isVisible('.se-card img'), `the card: "${card}"`);
    await audit(S.p, 'Aaron’s Simple home with the card');
    await S.p.screenshot({ path: path.join(SH, 'tp-events-aaron-card.png'), fullPage: true });
    await S.p.click('.se-card .primary');
    await S.p.waitForSelector('.sh-flow');
    ok(await S.p.inputValue('.sh-flow .sh-input') === 'Sports day', 'the title is already filled');
    await S.p.click('.sh-flow .sh-next .primary');
    await S.p.waitForSelector('.sh-flow textarea');
    ok((await S.p.innerText('.sh-flow')).includes('What was your best moment?'), 'the line is picked for him, and the event’s question is asked');
    await audit(S.p, 'the add flow from Sports day');
    await S.p.fill('.sh-flow textarea', 'I came second in the relay.');
    await S.p.click('.sh-flow .sh-next .primary');
    if (await S.p.locator('.sh-flow .sh-notnow').count()) await S.p.click('.sh-flow .sh-notnow');
    const mom = await until(() => saved().events.find((e) => e.studentId === AARON && e.schoolEvent === ev.id));
    const refl = mom && saved().reflections.find((r) => r.eventId === mom.id);
    ok(!!mom && mom.title === 'Sports day' && mom.date === day(-1) && mom.lineIds.includes('sport') && mom.source.ref === 'Sports day', `his moment: “${mom?.title}”, ${mom?.date}, on ${mom?.lineIds.join()}, from the event`);
    ok(refl?.prompt === 'What was your best moment?' && refl.text === 'I came second in the relay.', 'his words answer the event’s question');
    await S.p.waitForSelector('.se-card', { state: 'detached' });
    ok(true, 'the card goes once he has added something');
    await S.p.locator('.sh-feed li button', { hasText: 'Sports day' }).click();
    ok(/School event\s+Sports day/.test(await S.p.innerText('.sh-moment .se-on')), 'his moment links to the event');
    await S.c.close();

    // ── An 8C classmate at Standard: Coming up, a goal for it; Sports day is not for her ──
    let M = await ctx(mTok);
    await go(M.p, '#/me/map');
    await M.p.waitForSelector('.se-coming');
    const coming = await M.p.innerText('.se-coming');
    ok(/Week Without Walls/.test(coming) && /Concert, winter/.test(coming) && !/Sports day/.test(coming), 'Coming up: Week Without Walls and the concert, not Sports day (it is over)');
    await M.p.click('.se-coming li:has-text("Week Without Walls") .ghost');
    await M.p.waitForSelector('.modal[aria-label="Plan a goal"]');
    ok(await M.p.inputValue('.modal[aria-label="Plan a goal"] input:not([type])') === 'Week Without Walls' && await M.p.inputValue('.modal[aria-label="Plan a goal"] input[type=date]') === day(6), 'Set a goal: the name and the first day are filled');
    await audit(M.p, 'Standard home with Coming up and the goal dialog');
    await M.p.click('.modal[aria-label="Plan a goal"] .composer-foot .primary');
    ok(await until(() => saved().events.some((e) => e.studentId === mate.id && e.type === 'goal' && e.title === 'Week Without Walls')), 'her goal is on her map');
    await M.p.click('.se-card .ghost');
    ok(await until(() => (saved().schoolEventAdds || []).some((r) => r.studentId === mate.id && r.dismissed && !r.added)), 'Not for me: dismissed');
    await M.p.waitForSelector('.se-card', { state: 'detached' });
    await M.c.close();

    // ── Ms Altemen, 8C's advisor: 8C's count ──
    let T = await ctx(alTok);
    await go(T.p, '#/me/events');
    const row = T.p.locator('.se-row', { hasText: 'Sports day' });
    await row.waitFor();
    const mine = new Set([...roster.students.filter((s) => s.advisorId === ALTEMEN).map((s) => s.id), ...roster.enrolments.filter((n) => roster.classes.find((c) => c.id === n.classId)?.teacherIds.includes(ALTEMEN)).map((n) => n.studentId)]);
    const in8C = year8.filter((s) => s.homeroom === '8C' && mine.has(s.id)).length;
    const g8c = (await row.locator('.se-groups li', { hasText: '8C' }).innerText()).replace(/\s+/g, ' ');
    ok(new RegExp(`8C.*1 of ${in8C}`).test(g8c), `8C: “${g8c}” (1 of ${in8C})`);
    ok(!await row.locator('button:has-text("Send one reminder")').count() && !await T.p.locator('.se-head .primary').count(), 'no reminder or add button for an advisor');
    await row.locator('button:has-text("Show names")').click();
    const names = await row.locator('.se-names').innerText();
    ok(names.includes(aaron.name) && names.includes(mate.name) && /Said not for me/.test(names), 'names: Aaron added something, his classmate said not for me');
    await audit(T.p, 'School events, advisor');
    await T.p.screenshot({ path: path.join(SH, 'tp-events-altemen.png'), fullPage: true });
    await T.c.close();
    const alState = await stateOf(alTok);
    ok(alState.schoolEvents.find((x) => x.id === ev.id).studentIds.every((sid) => mine.has(sid)), 'her copy of the record: only her advisees and class students');

    // ── A coordinator sends the one reminder ──
    let C = await ctx(cTok);
    await go(C.p, '#/me/events');
    await C.p.locator('.se-row', { hasText: 'Sports day' }).locator('button:has-text("Send one reminder")').click();
    await C.p.waitForSelector('.toast.show');
    const rem = await until(() => saved().schoolEvents.find((x) => x.id === ev.id).reminded);
    const sent = saved().notifications.filter((n) => n.go?.param === `se~${ev.id}`);
    ok(rem?.n === year8.length - 2 && sent.length === rem.n && sent.every((n) => n.kind === 'class'), `reminder to ${rem?.n} students (not Aaron or his classmate), kind “class”`);
    ok(!sent.some((n) => n.to === `st:${AARON}` || n.to === `st:${mate.id}`), 'nobody who added something or said not for me');
    ok(await C.p.isVisible('.se-row:has-text("Sports day") :text("Reminder sent")'), 'the row says the reminder was sent');
    ok((await act(cTok, 'remindSchoolEvent', [ev.id, coord.id])).status === 409, 'a second reminder is refused');
    await C.c.close();

    // ── A Year 10 student never gets Sports day ──
    const yState = await stateOf(yTok);
    ok(!yState.schoolEvents.some((x) => x.id === ev.id) && yState.schoolEvents.some((x) => x.title === 'Week Without Walls'), 'Year 10’s copy: Week Without Walls, not Sports day');
    let Y = await ctx(yTok);
    await go(Y.p, '#/me/map');
    await Y.p.waitForSelector('.se-coming');
    ok(!await Y.p.locator('.se-card').count() && !(await Y.p.innerText('main')).includes('Sports day'), 'no Sports day card or stop on the Year 10 home');
    await Y.c.close();

    // ── Aaron's family: the event's name on his moment ──
    const fam = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ email: 'torres.family@example.org', name: 'Ana Torres', kind: 'parent', children: [AARON] }) })).json();
    const fTok = await setupWith(U, fam.setupUrl.split('/setup/')[1]);
    const fState = await stateOf(fTok);
    ok(fState.events.find((e) => e.schoolEvent === ev.id)?.source.ref === 'Sports day' && (fState.schoolEventAdds || []).length === 0, 'his family’s copy: the moment with the event’s name, no rows');
    let F = await ctx(fTok);
    await go(F.p, '#/me');
    await F.p.waitForSelector('.se-on');
    ok(/School event\s+Sports day/.test(await F.p.locator('.se-on').first().innerText()), 'the family view shows “School event Sports day” on the moment');
    await F.c.close();

    // ── Activity log ──
    const log = await (await fetch(`${U}/api/audit?action=change&size=500`, { headers: H(adminTok) })).json();
    const fns = log.entries.filter((e) => /SchoolEvent/.test(e.fn || ''));
    ok(fns.some((e) => e.fn === 'addSchoolEvent' && e.target.id === ev.id && e.result === 'ok') && fns.some((e) => e.fn === 'remindSchoolEvent' && e.target.teacherId === coord.id) && fns.some((e) => e.fn === 'addSchoolEvent' && e.result === 'refused'), 'activity log: added (with its id), the reminder (who), refusals');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) { ok(false, `crashed: ${e.stack || e}`); } finally {
    await b.close();
    srv?.p.kill('SIGTERM');
  }
})();
