// Advisor year sign-off on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real
// roster, each account in its own browser context. Aaron Torres (Year 8, 8C) has a moment endorsed by Ms Jane Altemen and a
// goal. Ms Altemen opens "Year sign-off" on My advisory, checks his year (auto items and their links), ticks the manual item,
// writes a note for next year's advisor (it becomes her handover note) and signs it off. Leadership sees 8C 1 of 23 on the
// School overview, downloads the CSV and sets the closing date; another advisor is refused (403); Aaron at Simple on a phone
// sees "Your advisor has signed off your year" with what went well (never the checklist); his family's copy has nothing.
// The activity log, axe on each new screen.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-signoff-*.png in the temp folder.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-signoff-'));
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
async function audit(p, label, within = null) { // within: only that part of the page
  await p.waitForTimeout(400);
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate((w) => window.axe.run(w ? document.querySelector(w) : document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))), within);
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
    const c8 = roster.students.filter((s) => s.homeroom === '8C');
    const lead = roster.teachers.find((t) => t.roles.includes('leadership') && links[t.email] && !roster.students.some((s) => s.advisorId === t.id));
    const other = roster.teachers.find((t) => t.id !== ALTEMEN && t.roles.includes('advisor') && !t.roles.includes('leadership') && !t.roles.includes('coordinator') && links[t.email]);
    const [aTok, alTok, lTok, oTok] = [await tokOf(AARON), await tokOf(ALTEMEN), await tokOf(lead.id), await tokOf(other.id)];
    ok(aaron.homeroom === '8C' && aaron.advisorId === ALTEMEN && c8.length === 23, `${aaron.name} (8C of ${c8.length}), ${altemen.name} (advisor), ${lead.name} (leadership), ${other.name} (another advisor)`);

    // ── Aaron's year: a moment his advisor endorses, and a goal ──
    await act(aTok, 'completeOnboarding', [AARON, ['science'], null]);
    await act(aTok, 'addStation', [AARON, { title: 'Bridge out of straws', date: day(-1), lineIds: ['science'], visibility: 'advisor' }]);
    let st = saved();
    const ev = st.events.find((e) => e.studentId === AARON && e.title === 'Bridge out of straws');
    await act(aTok, 'requestEndorsement', [ev.id, ALTEMEN, 'Our science project']);
    const rq = (st = saved()).requests.find((r) => r.eventId === ev.id);
    ok((await act(alTok, 'endorse', [[rq.id], ALTEMEN, 'Careful, patient work.'])).ok, 'Ms Altemen endorses his moment');
    await act(aTok, 'addGoal', [AARON, { title: 'Join the robotics club', date: day(60), lineId: 'science' }]);

    // ── Refusals ──
    ok((await act(oTok, 'signOffYear', [AARON, other.id])).status === 403, 'another advisor cannot sign off Aaron');
    ok((await act(oTok, 'signOffYear', [AARON, ALTEMEN])).status === 403, '…nor as Ms Altemen');
    ok((await act(lTok, 'signOffYear', [AARON, lead.id])).status === 403, 'leadership cannot sign off for an advisor');
    ok((await act(aTok, 'signOffYear', [AARON, ALTEMEN])).status === 403, 'Aaron cannot sign off himself');
    ok((await act(alTok, 'setSignoffClose', [day(30), ALTEMEN])).status === 403, 'an advisor cannot set the closing date');

    // ── Ms Altemen: My advisory › Year sign-off ──
    let T = await (async () => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: alTok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; })();
    await T.p.goto(`${U}/#/me/advisory`); await T.p.waitForSelector('.ys-adv');
    ok(/Signed off: 0 of 23/.test(await T.p.innerText('.ys-adv .ys-head')), 'Year sign-off: “Signed off: 0 of 23”');
    await T.p.click('.ys-adv .ys-head button');
    const row = T.p.locator('.ys-row', { hasText: aaron.name });
    await row.locator('.ys-who button').click();
    const body = (await row.innerText()).replace(/\s+/g, ' ');
    ok(/At least one endorsed moment/.test(body) && /Bridge out of straws/.test(body) && /A goal set or met/.test(body) && /Join the robotics club/.test(body) && /Moments on at least 3 lines this year \(not yet\)/.test(body), 'his checklist: endorsed and goal met (named), lines not yet');
    ok(!/movingUp|Moving-up/.test(body) && !/CAS/.test(body), 'Year 8: no moving-up or CAS item');
    await audit(T.p, 'My advisory, Year sign-off open');
    await T.p.screenshot({ path: path.join(SH, 'tp-signoff-advisor.png'), fullPage: true });
    // The link of the endorsed item opens the moment on his map.
    await row.locator('.ys-items li', { hasText: 'At least one endorsed moment' }).locator('button').click();
    await T.p.waitForFunction((id) => location.hash.includes(id), AARON);
    ok(T.p.url().includes(`${AARON}~${ev.id}`), '“Open it” opens the endorsed moment on his page');
    await T.p.goto(`${U}/#/me/advisory`); await T.p.waitForSelector('.ys-adv');
    await T.p.click('.ys-adv .ys-head button');
    await row.locator('.ys-who button').click();
    await row.locator('.ys-tick input').check();
    await until(() => saved().yearSignoffs?.find((r) => r.studentId === AARON)?.ticks?.talk);
    await row.locator('textarea').first().fill('Thoughtful in science; give him a job in group work.');
    await row.locator('.ys-foot .primary').click();
    const rec = await until(() => saved().yearSignoffs?.find((r) => r.studentId === AARON && r.status === 'signed'));
    ok(!!rec && rec.celebrated?.endorsed === 1 && rec.celebrated?.lines === 1 && rec.celebrated?.goalsSet === 1, `signed off, with what went well: ${JSON.stringify(rec?.celebrated)}`);
    ok(saved().handoverNotes?.find((n) => n.studentId === AARON && n.by === ALTEMEN)?.text === 'Thoughtful in science; give him a job in group work.', 'the note is her handover note for next year’s advisor');
    await T.p.waitForSelector('.ys-adv .ys-chip.signed');
    ok(/Signed off: 1 of 23/.test(await T.p.innerText('.ys-adv .ys-head')) && await row.locator('button:has-text("Undo sign-off")').isVisible(), '“Signed off: 1 of 23”, and it can be taken back');
    await audit(T.p, 'Year sign-off, signed');
    await T.c.close();

    // ── Leadership: School overview › Year sign-off ──
    let L = await (async () => { const c = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true }); await c.addCookies([{ name: 'tp_session', value: lTok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; })();
    await L.p.goto(`${U}/#/me/overview`); await L.p.waitForSelector('.ys-prog');
    await L.p.click('.ys-prog .ys-year button:has-text("Year 8")');
    const hr = (await L.p.locator('.ys-hr', { hasText: '8C' }).innerText()).replace(/\s+/g, ' ');
    ok(/8C 23 1 0 22/.test(hr) && /8C: 1 of 23/.test(hr), `leadership sees 8C 1 of 23 (“${hr}”)`);
    ok(!/Thoughtful|group work/.test(await L.p.innerText('.ys-prog')), 'no notes on the panel');
    const lState = await stateOf(lTok);
    ok(lState.yearSignoffs.every((r) => !('ticks' in r) && !('reason' in r) && !('celebrated' in r)), 'leadership’s copy: status only');
    const [dl] = await Promise.all([L.p.waitForEvent('download'), L.p.click('.ys-prog button:has-text("Download as CSV")')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(/^School year,Year,Homeroom,Students,Signed off,Not this year,Not yet/.test(csv) && /,8,8C,23,1,0,22/.test(csv), 'CSV: 8C 23, 1 signed off');
    await L.p.click('.ys-prog button:has-text("Checklist and closing date")');
    await L.p.fill('#ys-close', day(20));
    await L.p.click('.ys-close .primary');
    ok(!!await until(() => saved().signoffSettings?.closes?.on === day(20)), 'the closing date is saved');
    await audit(L.p, 'School overview, Year sign-off and settings', '.ys-prog'); // the overview's older By Year table has its own scrollable-region-focusable finding
    await L.p.screenshot({ path: path.join(SH, 'tp-signoff-leadership.png'), fullPage: true });
    await L.c.close();

    // ── Aaron, on his phone at Simple level ──
    let S = await (async () => { const c = await b.newContext({ ...devices['Pixel 7'] }); await c.addCookies([{ name: 'tp_session', value: aTok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; })();
    await S.p.goto(`${U}/#/me/map`); await S.p.waitForSelector('.ys-card.simple');
    const card = (await S.p.innerText('.ys-card')).replace(/\s+/g, ' ');
    ok(/Your advisor has signed off your year/.test(card) && /Ms Altemen looked back at your year/.test(card) && /1 endorsed moment/.test(card) && /A goal to work towards/.test(card), `his card: “${card}”`);
    ok(!/not yet|lines this year|Talked through|Thoughtful/.test(card), 'never the checklist, its gaps or the note');
    const aState = await stateOf(aTok);
    ok(aState.yearSignoffs.length === 1 && !('ticks' in aState.yearSignoffs[0]) && !(aState.handoverNotes || []).length, 'his copy: his sign-off only, no ticks, no handover note');
    ok(aState.notifications.some((n) => n.text === 'Ms Altemen signed off your year. Well done!' && n.kind === 'milestone'), 'he is told in the app');
    await audit(S.p, 'Aaron’s Simple home with the card');
    await S.p.screenshot({ path: path.join(SH, 'tp-signoff-aaron.png'), fullPage: true });
    await S.c.close();

    // ── Aaron's family: nothing new ──
    const fam = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ email: 'torres.family@example.org', name: 'Ana Torres', kind: 'parent', children: [AARON] }) })).json();
    const fState = await stateOf(await setupWith(U, fam.setupUrl.split('/setup/')[1]));
    ok((fState.yearSignoffs || []).length === 0 && fState.signoffSettings === undefined && !(fState.notifications || []).some((n) => /signed off/.test(n.text)), 'his family’s copy: no sign-off, no settings, no notice');
    const oState = await stateOf(oTok);
    ok(!(oState.yearSignoffs || []).some((r) => r.studentId === AARON), 'the other advisor’s copy: not Aaron’s');

    // ── Activity log ──
    const log = await (await fetch(`${U}/api/audit?action=change&size=500`, { headers: H(adminTok) })).json();
    const fns = log.entries.filter((e) => /Signoff|signOff/.test(e.fn || ''));
    ok(fns.some((e) => e.fn === 'signOffYear' && e.target.studentId === AARON && e.target.teacherId === ALTEMEN && e.result === 'ok') && fns.some((e) => e.fn === 'signOffYear' && e.result === 'refused') && fns.some((e) => e.fn === 'setSignoffClose' && e.result === 'ok'), 'activity log: the sign-off (student, advisor), refusals, the closing date');
    ok(!JSON.stringify(log.entries).includes('Thoughtful'), 'the note is never in the log');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) { ok(false, `crashed: ${e.stack || e}`); } finally {
    await b.close();
    srv?.p.kill('SIGTERM');
  }
})();
