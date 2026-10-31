// Notification settings and quiet hours on the real class lists: starts a clean pilot (TP_START=empty; needs
// `npm run build` first) and imports the real roster. Aaron Torres (Sabc0d6125e85) asks Mr David Coultas (T60198) to
// endorse a moment and answers his class question. Mr Coultas turns Class answers off in the account menu: the answer's
// request leaves his bell (the plain request stays) but the answers still wait on This week; with "Only in This week"
// they are listed there instead; the choice follows him to a second device. Aaron turns everything off and sets quiet
// hours 21:00–07:00: at 22:30 Bangkok (Playwright's clock) the bell shows no number while the notifications, and a
// safeguarding notice that can't be turned off, are still in it; at 07:30 the number is back. Mark all as read and
// Clear read. Every account has its own browser context; axe over the dialog and the bell.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-ns-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198', CLASS = 'C-392000';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const bangkok = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function start(port, dataDir, mode = 'pilot') {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: mode, ...(mode === 'pilot' ? { TP_START: 'empty' } : {}), DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
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
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`)));
  ok(!v.length, `axe: ${label}${v.length ? `\n    ${v.join('\n    ')}` : ''}`);
}

let srv, demo;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) }); return { status: r.status, ...(await r.json()) }; };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const aaron = roster.students.find((s) => s.id === STUDENT), coultas = roster.teachers.find((t) => t.id === TEACHER);
    ok(!!aaron && roster.classes.find((c) => c.id === CLASS)?.teacherIds.includes(TEACHER), `${aaron?.name} is in ${coultas?.name}’s ${CLASS}`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]);
    const ctx = async (tok, opt = {}) => {
      const c = await b.newContext(opt.phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } });
      await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); if (opt.at) await p.clock.setFixedTime(opt.at);
      p.on('pageerror', (e) => errs.push(e.message)); return p;
    };

    // ── Aaron: a moment for Mr Coultas to endorse, and an answer to his class question (a moment too) ──
    const plain = await act(sTok, 'addStation', [STUDENT, { title: 'Plant growth experiment', lineIds: ['science'], visibility: 'school', requestFrom: TEACHER }]);
    ok(plain.status === 200, 'Aaron asks Mr Coultas to endorse “Plant growth experiment”');
    const q = await act(tTok, 'askClass', [CLASS, TEACHER, { question: 'What did you notice in the lab today?', asMoment: true }]);
    ok(q.status === 200, `${coultas.name} asks ${CLASS} a question, answered as a moment`);
    ok((await act(sTok, 'answerPrompt', [q.result.id, STUDENT, { text: 'The roots grew towards the water.', title: 'Roots and water' }])).status === 200, 'Aaron answers it');
    const mate = roster.students.find((x) => x.id !== STUDENT && roster.enrolments.some((e) => e.classId === CLASS && e.studentId === x.id));
    const mTok = await setupWith(U, links[mate.email]);
    ok((await act(mTok, 'answerPrompt', [q.result.id, mate.id, { text: 'Leaves turned to the light.', title: 'Leaves and light' }])).status === 200, 'a classmate answers too');
    const rec = () => { const j = JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')); return j.store || j; };
    const tn = (await until(() => rec().notifications.some((n) => n.text.includes('Leaves and light')) && rec())).notifications.filter((n) => n.to === `t:${TEACHER}`);
    ok(tn.some((n) => n.kind === 'answers' && n.text.includes('Roots and water')) && tn.some((n) => n.kind === 'endorse' && n.text.includes('Plant growth experiment')), 'the record holds a class-answer notification and a plain request, each with its kind');

    // ── Mr Coultas: Class answers off ──
    const t = await ctx(tTok);
    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('.queue');
    const bellText = async (p) => { await p.click('.icon-btn.bell'); await p.waitForSelector('.bell-menu'); const x = await p.locator('.bell-menu').innerText(); await p.click('.icon-btn.bell'); await p.waitForSelector('.bell-menu', { state: 'detached' }); return x; };
    let bt = await bellText(t);
    ok(bt.includes('Roots and water') && bt.includes('Leaves and light') && bt.includes('Plant growth experiment'), 'at first all three are in his bell');
    await t.click('.persona-btn'); await t.click('.acct-menu .ns-menu');
    await t.waitForSelector('.ns-modal');
    const rows = await t.locator('.ns-row legend').allInnerTexts();
    ok(['Endorsement requests', 'Class answers', 'Task hand-ins', 'Comments', 'Spotted replies', 'Stuck goals and check-ins', 'Conferences', 'System'].every((l) => rows.includes(l)) && !rows.includes('Reports (moderators)'), `staff groups (no Reports for a subject teacher): ${rows.join(', ')}`);
    ok(await t.locator('.ns-row[data-kind="answers"] label').count() === 3, 'each has On, Off and Only in This week');
    ok((await t.locator('.ns-always').innerText()).includes('can’t be turned off'), 'safeguarding and account security: always on, and it says so');
    await audit(t, 'notification settings (teacher)');
    await t.screenshot({ path: SH + 'teacher-dialog.png' });
    await t.click('.ns-row[data-kind="answers"] label:has-text("Off")');
    await t.click('.ns-foot .primary');
    await t.waitForSelector('.ns-modal', { state: 'detached' });
    const acc = async (tok) => (await (await fetch(`${U}/api/auth/me`, { headers: H(tok) })).json()).user;
    ok((await until(async () => (await acc(tTok)).notify?.kinds?.answers === 'off')), 'saved on his account');
    bt = await bellText(t);
    ok(!bt.includes('Roots and water') && bt.includes('Plant growth experiment'), 'no class answers in the bell; the plain request stays');
    ok(/2 not shown/.test(bt), 'the bell says two are not shown (the two answers)');
    ok(rec().notifications.some((n) => n.text.includes('Roots and water')), 'nothing deleted from the record');
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.tw');
    ok((await t.locator('.tw-wait').first().innerText()).includes('Answers to “What did you notice in the lab today?”'), 'the answers still wait on This week (Waiting for you)');
    ok((await t.locator(`.tw-classes tr[data-class="${CLASS}"]`).innerText()).includes('answered (2 of'), 'and in his class row');
    ok(await t.locator('.tw-notes').count() === 0, 'Off: not listed under Kept for This week');
    // A second device follows the account.
    const t2 = await ctx(tTok, { phone: true });
    await t2.goto(`${U}/#/me/queue`); await t2.waitForSelector('.queue');
    bt = await bellText(t2);
    ok(!bt.includes('Roots and water') && bt.includes('Plant growth experiment'), 'his phone follows the same choice');
    await t2.context().close();
    // Only in This week: out of the bell, listed on This week.
    await t.click('.persona-btn'); await t.click('.acct-menu .ns-menu'); await t.waitForSelector('.ns-modal');
    ok(await t.locator('.ns-row[data-kind="answers"] input[value="off"]').isChecked(), 'the dialog shows his choice');
    await t.click('.ns-row[data-kind="answers"] label:has-text("Only in This week")');
    await t.click('.ns-foot .primary'); await t.waitForSelector('.ns-modal', { state: 'detached' });
    await until(async () => (await acc(tTok)).notify?.kinds?.answers === 'week');
    await t.waitForSelector('.tw-notes');
    ok((await t.locator('.tw-notes').innerText()).includes('Roots and water'), 'Only in This week: listed under Kept for This week');
    await audit(t, 'This week with kept notifications');
    await t.screenshot({ path: SH + 'teacher-week.png', fullPage: true });
    // Mark all as read, Clear read.
    await t.click('.icon-btn.bell'); await t.waitForSelector('.bell-menu');
    await audit(t, 'the bell (teacher)');
    await t.click('.icon-btn.bell');
    await until(async () => rec().notifications.filter((n) => n.to === `t:${TEACHER}`).every((n) => n.read)); // opening the bell marks them read 1.5 s later
    await act(sTok, 'addMomentComment', [plain.result.id, 'student', 'I watered one twice a day.']);
    await t.waitForSelector('.icon-btn.bell .badge');
    await t.click('.icon-btn.bell'); await t.waitForSelector('.bell-menu');
    await t.click('.bell-menu .bm-actions button:has-text("Mark all as read")');
    ok(await until(async () => rec().notifications.filter((n) => n.to === `t:${TEACHER}`).every((n) => n.read)), 'Mark all as read');
    await t.click('.bell-menu .bm-actions button:has-text("Clear read")');
    ok(await until(async () => rec().notifications.filter((n) => n.to === `t:${TEACHER}`).every((n) => n.cleared)), 'Clear read marks them cleared, kept in the record');
    ok(await until(async () => !(await t.locator('.bell-menu').innerText()).includes('Plant growth experiment')), 'and they leave his bell');
    await t.context().close();

    // ── A safeguarding notice for Aaron: Mr Coultas reports the moment, the admin hides it ──
    const rep = await act(tTok, 'reportItem', [{ eventId: plain.result.id }, 'personal', 'A home address shows.', { key: TEACHER, name: coultas.name }]);
    ok(rep.status === 200, 'Mr Coultas reports the moment');
    ok((await act(adminTok, 'moderateReport', [rep.result.id, 'hide', '', null])).status === 200, 'the admin hides it while they look');

    // ── Aaron: everything off, quiet hours 21:00–07:00 ──
    const today = bangkok();
    const night = new Date(`${today}T22:30:00+07:00`), morning = new Date(Date.parse(`${today}T07:30:00+07:00`) + 864e5);
    const s = await ctx(sTok, { phone: true, at: new Date(`${today}T12:00:00+07:00`) });
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.icon-btn.bell');
    await s.click('.persona-btn'); await s.click('.acct-menu .ns-menu'); await s.waitForSelector('.ns-modal');
    const srows = await s.locator('.ns-row legend').allInnerTexts();
    ok(['Teacher replies and endorsements', 'Comments', 'Class questions and tasks', 'Kind feedback', 'Milestones', 'Encouragement', 'Conferences'].every((l) => srows.includes(l)), `student groups: ${srows.join(', ')}`);
    ok(await s.locator('.ns-row label:has-text("Only in This week")').count() === 0, 'students choose On or Off');
    for (const k of await s.locator('.ns-row').evaluateAll((els) => els.map((e) => e.dataset.kind))) await s.click(`.ns-row[data-kind="${k}"] label:has-text("Off")`);
    await s.check('.ns-quiet .ns-check input');
    ok(await s.locator('.ns-times input').first().inputValue() === '21:00' && await s.locator('.ns-times input').last().inputValue() === '07:00', 'quiet hours start at 21:00–07:00');
    await audit(s, 'notification settings (student, phone)');
    await s.screenshot({ path: SH + 'student-dialog.png', fullPage: true });
    await s.click('.ns-foot .primary'); await s.waitForSelector('.ns-modal', { state: 'detached' });
    ok(await until(async () => (await acc(sTok)).notify?.quiet?.on === true), 'saved on his account');
    await s.context().close();

    const unreadFor = async () => rec().notifications.filter((n) => n.to === `st:${STUDENT}` && !n.read).length;
    ok(await unreadFor() > 0, `he has unread notifications (${await unreadFor()})`);
    const n = await ctx(sTok, { phone: true, at: night });
    await n.goto(`${U}/#/me/map`); await n.waitForSelector('.icon-btn.bell');
    ok(await n.locator('.icon-btn.bell .badge').count() === 0, `at 22:30 Bangkok the bell shows no number`);
    ok(/quiet hours/.test(await n.locator('.icon-btn.bell').getAttribute('aria-label')), 'its name says quiet hours');
    // Something new arrives during quiet hours: still no number.
    await act(tTok, 'addMomentComment', [plain.result.id, TEACHER, 'Please take the address out.']);
    await n.waitForTimeout(1500);
    ok(await n.locator('.icon-btn.bell .badge').count() === 0, 'a new one during quiet hours: still no number');
    const m = await ctx(sTok, { phone: true, at: morning });
    await m.goto(`${U}/#/me/map`); await m.waitForSelector('.icon-btn.bell');
    const badge = await m.locator('.icon-btn.bell .badge').innerText().catch(() => '');
    ok(badge === '1', `at 07:30 the number is back: only the safeguarding notice counts, the rest are off (${badge})`);
    await m.context().close();
    await n.click('.icon-btn.bell'); await n.waitForSelector('.bell-menu');
    const sb = await n.locator('.bell-menu').innerText();
    ok(sb.includes('A teacher has hidden “Plant growth experiment”'), 'the safeguarding notice still shows, with everything else off');
    ok(!sb.includes('wrote on') && !/asked .* a question/.test(sb), 'the comment and the class question are not in the bell');
    ok(sb.includes('Quiet hours: the number waits until 07:00'), 'the bell says the number waits');
    await audit(n, 'the bell in quiet hours (student, phone)');
    await n.screenshot({ path: SH + 'student-quiet.png' });
    await n.context().close();

    // ── Demo: kept per device, per persona ──
    const dport = await freePort(); const D = `http://localhost:${dport}`;
    demo = await start(dport, fs.mkdtempSync(SH + 'demo-'), 'demo');
    await fetch(`${D}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn: 'addStation', args: ['st-01', { title: 'Demo kite', lineIds: ['science'], requestFrom: 't-01' }], rec: [] }) });
    const dc = await b.newContext({ viewport: { width: 1300, height: 900 } }); const d = await dc.newPage(); d.on('pageerror', (e) => errs.push(e.message));
    await d.goto(`${D}/#/nair/queue`); await d.waitForSelector('.icon-btn.bell');
    bt = await bellText(d);
    ok(bt.includes('Demo kite'), 'demo: Ms Nair’s bell has the request');
    await d.click('.icon-btn.bell'); await d.click('.bell-menu .bm-settings'); await d.waitForSelector('.ns-modal');
    await d.click('.ns-row[data-kind="endorse"] label:has-text("Off")'); await d.click('.ns-foot .primary'); await d.waitForSelector('.ns-modal', { state: 'detached' });
    await d.reload(); await d.waitForSelector('.icon-btn.bell');
    ok(!(await bellText(d)).includes('Demo kite'), 'demo: Endorsement requests off, kept on this device after a reload');
    const d2 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
    await d2.goto(`${D}/#/nair/queue`); await d2.waitForSelector('.icon-btn.bell');
    ok((await bellText(d2)).includes('Demo kite'), 'demo: another device keeps its own settings');
    await d2.context().close(); await dc.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); demo?.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
