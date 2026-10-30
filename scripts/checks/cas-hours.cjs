// CAS hours on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and imports the real
// roster. At runtime it picks a Year 12 or 13 student, a member of staff who neither teaches nor advises them, and a
// coordinator. The student logs a Service experience with 2 hours naming that teacher; the coordinator's grid shows them
// waiting; the teacher confirms from "CAS to confirm" (seeing only that entry, not the student's record) and the grid updates
// live. Then 1.5 hours with an outside supervisor: the student shows the code, the supervisor (signed out, on a phone)
// confirms with their email. Then 1 hour with nobody named, which the coordinator confirms on their behalf. Every account has
// its own browser context; axe over each new screen (serious and critical fail; the shared toast, caught mid-fade, is left out).
// The coordinator puts a comment-bank phrase into a nudge from the grid's side panel (and the send-back there has the picker).
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const SH = os.tmpdir() + '/tp-cas-';
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
  const v = await p.evaluate(() => window.axe.run({ exclude: [['.toast']] }, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
const ctxFor = async (b, U, tok, opts = { viewport: { width: 1300, height: 900 } }) => { const c = await b.newContext(opts); if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); return { c, p, errs }; };

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
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = saved();
    // ── Picked at runtime ──
    const student = roster.students.filter((s) => (s.year === 12 || s.year === 13) && links[s.email] && s.advisorId).sort((a, c) => a.id.localeCompare(c.id))[0];
    const myClasses = new Set(rec.enrolments.filter((n) => n.studentId === student.id && !n.to).map((n) => n.classId));
    const teachesMe = new Set(rec.classes.filter((c) => myClasses.has(c.id)).flatMap((c) => c.teacherIds || []));
    const teacher = roster.teachers.filter((t) => links[t.email] && t.roles.length === 1 && t.roles[0] === 'teacher' && !teachesMe.has(t.id) && t.id !== student.advisorId).sort((a, c) => a.id.localeCompare(c.id))[0];
    const coord = roster.teachers.filter((t) => links[t.email] && t.roles.includes('coordinator') && !t.roles.includes('leadership') && t.id !== teacher.id).sort((a, c) => a.id.localeCompare(c.id))[0];
    const first = student.name.split(' ')[0];
    ok(student && teacher && coord, `picked Year ${student?.year} ${student?.name}, supervisor ${teacher?.name} (not their teacher or advisor), coordinator ${coord?.name}`);
    const sTok = await setupWith(U, links[student.email]);
    const tTok = await setupWith(U, links[teacher.email]);
    const cTok = await setupWith(U, links[coord.email]);
    ok((await act(sTok, 'completeOnboarding', [student.id, ['service'], 'classic'])).ok, 'the student’s map is set up');

    // ── The student logs a Service experience with 2 hours, naming the teacher ──
    const S = await ctxFor(b, U, sTok);
    await S.p.goto(`${U}/#/me/map`); await S.p.waitForSelector('.navbar');
    const navHas = (x, label) => until(async () => (await x.p.evaluate(() => [...document.querySelectorAll('.nav-measure a')].map((a) => a.textContent))).includes(label));
    ok(await navHas(S, 'CAS'), 'CAS is in the student’s navigation');
    await S.p.goto(`${U}/#/me/cas`); await S.p.waitForSelector('.cas-log');
    await audit(S.p, 'student CAS page, empty');
    await S.p.click('.cas-log > button.primary:has-text("Log a new experience")');
    await S.p.fill('.cas-form-card input[placeholder^="e.g. Coaching"]', 'Reading club at the community library');
    await S.p.check('.cas-form-card .cas-radios-set input[type=radio] >> nth=2');
    for (const n of [2, 5, 6]) await S.p.check(`.cas-outcomes label:nth-of-type(${n}) input`);
    await S.p.fill('.cas-form-card label:has-text("Reflection") textarea', 'Reading aloud to younger children taught me to slow down.');
    await S.p.fill('.cas-form-card input[type=number]', '2');
    await S.p.selectOption('.cas-form-card .cas-sup select', teacher.id);
    await audit(S.p, 'student CAS page, new experience form');
    await S.p.click('.cas-form-card button[type=submit]');
    const ev = await until(async () => saved().events.find((e) => e.studentId === student.id && e.title === 'Reading club at the community library'));
    const h1 = ev && saved().casHours.find((x) => x.eventId === ev.id);
    ok(ev && ev.type === 'cas' && ev.lineIds[0] === 'cas' && ev.cas.strand === 'S' && ev.cas.outcomes.join() === '2,5,6', 'saved: a Service station on the CAS line, LO2, LO5, LO6');
    ok(h1 && h1.hours === 2 && h1.status === 'pending' && h1.supervisor.teacherId === teacher.id, `2 hours waiting for ${teacher.name}`);
    ok(saved().notifications.some((n) => n.to === `t:${teacher.id}` && n.text.startsWith(`${first} asked you to confirm 2 hours of CAS`)), 'the teacher is told');
    await S.p.waitForSelector('.cas-exp');
    await audit(S.p, 'student CAS page, one experience');

    // ── The coordinator's grid: hours waiting; filter by advisor ──
    const C = await ctxFor(b, U, cTok);
    await C.p.goto(`${U}/#/me/cas`); await C.p.waitForSelector('.cas-table');
    const advisorName = rec.teachers.find((t) => t.id === student.advisorId)?.name;
    await C.p.selectOption('.cas-tools select', student.advisorId);
    const cRow = () => C.p.locator('.cas-row.wide', { hasText: student.name });
    ok(await cRow().count() === 1, `filtered to ${advisorName}’s advisees, ${student.name} is there`);
    ok(await C.p.locator('.cas-row.wide:not(.head)').count() < 60, `the filter narrows the cohort (${await C.p.locator('.cas-row.wide:not(.head)').count()} rows)`);
    ok((await cRow().locator('.cas-hrs').innerText()).includes('0 h') && (await cRow().locator('.cas-hrs').innerText()).includes('2 h waiting'), 'the grid: 0 h confirmed, 2 h waiting');
    const flags = await cRow().locator('.cas-flags').innerText();
    ok(!flags.includes('No Service yet') && flags.includes('Outcome missing') && !flags.includes('No reflection'), `flags: ${flags.replace(/\n/g, ', ')}`);
    await audit(C.p, 'coordinator CAS grid');

    // ── The comment bank in the grid's side panel: the nudge box and "Not right" both have the Phrases picker ──
    ok((await act(cTok, 'addPhrase', ['school', coord.id, { text: 'Hi {first name}, could you add a reflection on what you learned?', kind: 'next' }])).ok, 'the coordinator adds a school phrase');
    await C.p.reload(); await C.p.waitForSelector('.cas-table');
    await C.p.selectOption('.cas-tools select', student.advisorId);
    await cRow().locator('.cas-hrs').click(); await C.p.waitForSelector('.cas-side .cas-nudge .ph-open');
    await C.p.fill('.cas-nudge textarea', '');
    await C.p.click('.cas-nudge .ph-open'); await C.p.waitForSelector('.cas-nudge [role=combobox]');
    await audit(C.p, 'coordinator side panel with the phrase picker open');
    await C.p.keyboard.type('reflection'); await C.p.keyboard.press('Enter');
    const nudge = await C.p.inputValue('.cas-nudge textarea');
    ok(nudge === `Hi ${first}, could you add a reflection on what you learned?`, `the phrase goes into the nudge box with ${first}’s name: “${nudge}”`);
    ok(!(saved().casNudges || []).some((n) => n.studentId === student.id), 'nothing is sent until the coordinator sends it');
    await C.p.click('.cas-nudge button:has-text("Send nudge")');
    ok(await until(async () => (saved().casNudges || []).some((n) => n.studentId === student.id && n.text === nudge)), 'Send nudge sends it as written');
    await C.p.click('.cas-side .cas-decide button:has-text("Not right")');
    ok(await C.p.locator('.cas-side .cas-decide .ph-open').count() === 1, 'the send-back box there has the picker too');
    await C.p.click('.cas-side .cas-decide button:has-text("Cancel")');

    // ── The teacher confirms from "CAS to confirm", seeing only that entry ──
    const tCopy = await state(tTok);
    ok(tCopy.casHours.length === 1 && tCopy.casHours[0].about?.title === ev.title && !tCopy.students.some((s) => s.id === student.id), 'the teacher’s copy: that one entry, not the student’s record');
    const T = await ctxFor(b, U, tTok);
    await T.p.goto(`${U}/#/me`); await T.p.waitForSelector('.navbar');
    ok(await navHas(T, 'CAS to confirm'), '"CAS to confirm" is in the teacher’s navigation');
    await T.p.goto(`${U}/#/me/casconfirm`); await T.p.waitForSelector('.cas-confirm .cas-list li');
    const li = await T.p.locator('.cas-confirm .cas-list li').first().innerText();
    ok(li.includes(student.name) && li.includes(ev.title) && li.includes('2 hours'), 'the list names the student, the experience and the hours');
    await audit(T.p, 'teacher CAS to confirm');
    await T.p.click('.cas-confirm .cas-list li button.primary:has-text("Confirm")');
    ok(await until(async () => saved().casHours.find((x) => x.id === h1.id)?.status === 'confirmed'), 'confirmed on the server');
    ok(saved().casHours.find((x) => x.id === h1.id).decided.via === 'supervisor', 'as the supervisor');
    ok(await until(async () => (await cRow().locator('.cas-hrs').innerText()).includes('2 h') && (await cRow().locator('.cas-hrs').innerText()).includes('none waiting')), 'the coordinator’s grid updates live: 2 h confirmed');
    ok((await act(tTok, 'confirmCasHours', [h1.id, coord.id, { via: 'coordinator' }])).status === 403, 'the teacher cannot act as the coordinator');

    // ── 1.5 hours with an outside supervisor: the code ──
    await S.p.click('.cas-exp button:has-text("Log more hours")');
    await S.p.fill('.cas-exp .cas-inline input[type=number]', '1.5');
    await S.p.check('.cas-exp .cas-inline .cas-sup input[type=radio] >> nth=1');
    await S.p.fill('.cas-exp .cas-inline .cas-sup input[placeholder^="e.g. Khun"]', 'Khun Ratana Library');
    await S.p.fill('.cas-exp .cas-inline .cas-sup input[type=email]', 'ratana@library.example.org');
    await S.p.fill('.cas-exp .cas-inline input[placeholder^="e.g. Coached"]', 'Ran the Saturday story hour');
    await S.p.click('.cas-exp .cas-inline button[type=submit]');
    const h2 = await until(async () => saved().casHours.find((x) => x.eventId === ev.id && x.supervisor?.kind === 'outside'));
    ok(h2 && h2.hours === 1.5 && h2.status === 'pending', '1.5 hours waiting for the outside supervisor');
    await S.p.click('.cas-hours li:has-text("1.5 hours") button:has-text("Show code")');
    await S.p.waitForSelector('.cas-the-code');
    const code = (await S.p.locator('.cas-the-code').innerText()).trim();
    ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), `a code: ${code}`);
    ok(await S.p.locator('.cas-code .qr svg').count() === 1, 'with a QR code');
    await audit(S.p, 'student code card');
    await S.p.screenshot({ path: SH + 'code.png' });
    await S.p.click('.cas-code-bar button:has-text("Close")');

    const O = await ctxFor(b, U, null, { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await O.p.goto(`${U}/#/c/${code}`); await O.p.waitForSelector('.cas-public-card dl');
    const pub = await O.p.locator('.cas-public').innerText();
    ok(pub.includes(`${first} (Year ${student.year})`) && pub.includes(ev.title) && pub.includes('1.5 hours') && !pub.includes(student.name.split(' ').slice(1).join(' ')), 'the supervisor sees first name, Year, the experience and hours, no surname');
    ok(await O.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await audit(O.p, 'outside supervisor page');
    await O.p.fill('.cas-public-card input[type=email]', 'someone@else.org');
    await O.p.click('.cas-public-card button.primary');
    await O.p.waitForSelector('.cas-public-card [role=alert]');
    ok((await O.p.locator('.cas-public-card [role=alert]').innerText()).includes('not the email'), 'a wrong email is refused');
    await O.p.fill('.cas-public-card input[type=email]', 'Ratana@Library.example.org');
    await O.p.click('.cas-public-card button.primary');
    await O.p.waitForSelector('.cas-public-card[role=status]');
    ok((await O.p.locator('.cas-public-card[role=status]').innerText()).includes('The hours are confirmed'), 'confirmed: "Thank you. The hours are confirmed."');
    const d2 = saved().casHours.find((x) => x.id === h2.id);
    ok(d2.status === 'confirmed' && d2.decided.via === 'code' && d2.decided.name === 'Khun Ratana Library' && !d2.code, 'saved: confirmed by code, the code gone');
    await O.p.reload(); await O.p.waitForSelector('.cas-public-card [role=alert]');
    ok((await O.p.locator('.cas-public-card [role=alert]').innerText()).includes('does not work'), 'the code works once');
    ok(await until(async () => (await S.p.locator('.cas-hours li:has-text("1.5 hours") .cas-st').innerText()) === 'Confirmed'), 'the student sees it confirmed');

    // ── 1 hour with nobody named: the coordinator confirms on their behalf ──
    await S.p.click('.cas-exp button:has-text("Log more hours")');
    await S.p.fill('.cas-exp .cas-inline input[type=number]', '1');
    await S.p.check('.cas-exp .cas-inline .cas-sup input[type=radio] >> nth=2');
    await S.p.click('.cas-exp .cas-inline button[type=submit]');
    const h3 = await until(async () => saved().casHours.find((x) => x.eventId === ev.id && !x.supervisor));
    ok(!!h3, '1 hour with nobody named');
    const wl = C.p.locator('.cas-waiting li', { hasText: student.name });
    await until(async () => await wl.count() === 1);
    await audit(C.p, 'coordinator grid with hours waiting');
    await wl.locator('button.primary:has-text("Confirm")').click();
    ok(await until(async () => saved().casHours.find((x) => x.id === h3.id)?.status === 'confirmed'), 'the coordinator confirmed it');
    ok(saved().casHours.find((x) => x.id === h3.id).decided.via === 'coordinator', 'as CAS coordinator');
    ok(await until(async () => (await cRow().locator('.cas-hrs').innerText()).startsWith('4.5 h')), 'the grid: 4.5 h confirmed');
    await C.p.screenshot({ path: SH + 'grid.png', fullPage: true });

    // ── On the student's map, on the CAS line ──
    await S.p.goto(`${U}/#/me/map`);
    ok(!!await S.p.waitForSelector(`svg.metro [role=button][aria-label^="${ev.title}, CAS,"]`, { timeout: 8000 }).catch(() => null), 'the experience is a station on the student’s map, on the CAS line');
    const lanes = (await state(sTok)).students.find((s) => s.id === student.id).laneOrder;
    ok(lanes.includes('cas'), 'the CAS line is on their map');

    // ── The admin marks the teacher as CAS coordinator on Accounts: the cohort grid appears for them ──
    const A = await ctxFor(b, U, adminTok);
    await A.p.goto(`${U}/#/me/accounts`); await A.p.waitForSelector('.acc-cas select');
    await A.p.selectOption('.acc-cas select', teacher.id);
    await A.p.click('.acc-cas button.auth-btn');
    ok(await until(async () => saved().teachers.find((t) => t.id === teacher.id)?.casCoordinator === true), `${teacher.name} is marked as CAS coordinator`);
    await A.p.waitForSelector(`.acc-cas li:has-text("${teacher.name}")`);
    await audit(A.p, 'Accounts with CAS coordinators');
    await T.p.goto(`${U}/#/me/cas`); await T.p.reload();
    ok(await navHas(T, 'CAS outcomes'), '"CAS outcomes" is in their navigation');
    await T.p.waitForSelector('.cas-table');
    ok(await T.p.locator('.cas-row.wide:not(.head)').count() > 200, `they see Years 12 and 13 (${await T.p.locator('.cas-row.wide:not(.head)').count()} students)`);
    for (const [n, x] of [['student', S], ['teacher', T], ['coordinator', C], ['outside supervisor', O], ['admin', A]]) ok(!x.errs.length, `no page errors for the ${n}${x.errs.length ? `: ${x.errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
