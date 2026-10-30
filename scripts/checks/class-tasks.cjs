// Class tasks on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real roster,
// each account in its own browser context. Mr David Coultas sets a task for Y8 Sciences 08.04 (04) from My classes
// (due tomorrow, a checklist, needs a photo); every student gets the day-before reminder once. Aaron Torres hands it in
// at Simple level on a phone, offline (photo and change wait in the outbox), and it arrives when he is back. Then the
// server is restarted two days later (a Date shift for the server process and the browsers): a classmate at Standard
// level sees it overdue (red, and the word "Overdue") and hands it in late; Mr Coultas sees it under "Waiting for you"
// in This week, opens the hand-in grid (handed in / late / not yet, with the moment), gives another student more time
// and endorses Aaron's from the grid. Refusals over /api/action, and axe on the new screens.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-tasks-*.png in the temp folder.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(os.tmpdir(), 'tp-tasks-');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', TID = 'T60198', CLASS = 'C-392000';
const DAY = 864e5;
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
// The server process "two days later": Date moved forward (TP_SHIFT_DAYS), nothing else changed.
const SHIM = path.join(fs.mkdtempSync(SH + 'shim-'), 'shift.mjs');
fs.writeFileSync(SHIM, `const s = Number(process.env.TP_SHIFT_DAYS || 0) * ${DAY};
if (s) { const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + s); } static now() { return D.now() + s; } }; }\n`);
function start(port, dataDir, shift = 0) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--import', SHIM, 'server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0', TASK_TICK_MS: '1000', TP_SHIFT_DAYS: String(shift) } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server exited ${c}: ${out}`)); });
  });
}
const stop = (s) => new Promise((r) => { if (!s || s.p.exitCode !== null) return r(); s.p.removeAllListeners('exit'); s.p.once('exit', r); s.p.kill('SIGTERM'); });
const setupWith = async (U, token, extra = {}) => {
  const r = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: 'pilot-pass-123', ...extra }) });
  if (!r.ok) throw new Error(`setup ${r.status}`);
  return r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
};
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bkk = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
const held = (page) => page.evaluate(() => new Promise((done) => {
  const r = indexedDB.open('tp-outbox', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'k', autoIncrement: true }).createIndex('uid', 'uid');
  r.onsuccess = () => { const g = r.result.transaction('items').objectStore('items').getAll(); g.onsuccess = () => { done(g.result.filter((x) => !/markMilestonesSeen/.test(x.body || '')).map(({ blob, ...x }) => ({ ...x, blob: !!blob }))); r.result.close(); }; };
  r.onerror = () => done(null);
}));

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const coultas = roster.teachers.find((t) => t.id === TID), aaron = roster.students.find((s) => s.id === AARON);
    const kids = roster.enrolments.filter((n) => n.classId === CLASS).map((n) => n.studentId);
    const mates = kids.filter((k) => k !== AARON).map((k) => roster.students.find((s) => s.id === k)).filter((s) => links[s.email]);
    const late = mates[0], slow = mates[1];
    const other = roster.teachers.find((t) => t.id !== TID && links[t.email] && t.roles.join() === 'teacher');
    const tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[aaron.email]), lTok = await setupWith(U, links[late.email]), oTok = await setupWith(U, links[other.email]);
    for (const [tok, s] of [[aTok, aaron], [lTok, late]]) await act(tok, 'completeOnboarding', [s.id, ['science'], null]);
    ok((await act(lTok, 'setIntensity', [late.id, 'standard'])).ok, `${coultas.name} teaches ${roster.classes.find((c) => c.id === CLASS).name} (${kids.length}); ${aaron.name} at Simple; ${late.name} at Standard`);
    const today = bkk(Date.now()), tomorrow = bkk(Date.now() + DAY);
    const desk = async (tok, at) => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); if (at) await p.clock.setFixedTime(at); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; };
    const phone = async (tok, at) => { const c = await b.newContext({ ...devices['Pixel 7'] }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); if (at) await p.clock.setFixedTime(at); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; };
    const go = async (p, hash) => { await p.goto(`${U}/${hash}`); await p.waitForSelector('.topnav'); };

    // ── Mr Coultas sets the task from My classes ──
    let T = await desk(tTok);
    await go(T.p, '#/me/classes');
    const row = T.p.locator('.mc-list li', { has: T.p.locator(`a[href$="/classes/${CLASS}"]`) });
    await row.locator('.tk-setbtn').click();
    const dlg = T.p.locator('.tk-set');
    await dlg.locator('label:has-text("Title") input').fill('Plant cell poster');
    await dlg.locator('textarea').fill('Draw and label a plant cell. Use your notes from Tuesday.');
    await dlg.locator('input[type=date]').fill(tomorrow);
    ok((await dlg.locator('label:has-text("Hand-ins go on") select').inputValue()) === 'science', 'the line starts as the class’s line (Science)');
    await dlg.locator('.tk-add').click(); await dlg.locator('.tk-item input').nth(0).fill('Label the nucleus');
    await dlg.locator('.tk-add').click(); await dlg.locator('.tk-item input').nth(1).fill('Label the cell wall');
    await dlg.locator('.cp-check input').check();
    await audit(T.p, 'Set a task dialog');
    await dlg.locator('.cp-foot .primary').click();
    await T.p.waitForSelector('.toast.show');
    const task = await until(() => (saved().teacherTasks || []).find((t) => t.classId === CLASS));
    ok(!!task && task.due === tomorrow && task.checklist.length === 2 && task.needsFile && task.studentIds.length === kids.length, `task set: due ${task?.due}, ${task?.checklist.length} checklist items, needs a photo, for ${task?.studentIds.length} students`);
    const bell = (sid, re) => saved().notifications.filter((n) => n.to === `st:${sid}` && re.test(n.text));
    ok(bell(AARON, /set a task: “Plant cell poster”, due tomorrow/).length === 1, 'Aaron’s bell: “Mr Coultas set a task … due tomorrow”');
    ok(await until(() => bell(AARON, /^Reminder: “Plant cell poster” is due tomorrow/).length === 1, 5000), 'the day-before reminder arrives (the server’s check)');
    await wait(2500);
    const reminders = saved().notifications.filter((n) => /^Reminder: “Plant cell poster”/.test(n.text));
    ok(reminders.length === kids.length && new Set(reminders.map((n) => n.to)).size === kids.length, `once per student, however often the server looks (${reminders.length})`);
    await go(T.p, `#/me/classes/${CLASS}`);
    ok(await T.p.isVisible('.tk-list:has-text("Plant cell poster")'), 'the class page lists the task, 0 of ' + kids.length);
    await T.c.close();

    // ── Refusals ──
    ok((await act(oTok, 'setTask', [CLASS, other.id, { title: 'Not mine', due: tomorrow }])).status === 403, `${other.name}, who does not teach the class, cannot set it a task`);
    ok((await act(aTok, 'handInTask', [task.id, late.id, { text: 'For my friend', image: 'api/files/x.png' }])).status === 403, 'Aaron cannot hand in for a classmate');
    ok((await act(aTok, 'remindDueTasks', [])).status === 403 && (await act(adminTok, 'remindDueTasks', [])).status === 403, 'nobody calls the reminder through /api/action');

    // ── Aaron, on his phone, at Simple level, offline ──
    let A = await phone(aTok);
    await go(A.p, '#/me/map');
    await A.p.waitForSelector('.simple .tk-card');
    const card = await A.p.innerText('.tk-card');
    ok(/Mr Coultas set a task/.test(card) && /Plant cell poster/.test(card) && /due tomorrow/.test(card), `a big card: "${card.replace(/\s+/g, ' ')}"`);
    await audit(A.p, 'Simple home with a task');
    await until(() => A.p.evaluate(() => !!navigator.serviceWorker.controller));
    await A.c.setOffline(true);
    await A.p.click('.tk-card');
    await A.p.waitForSelector('.tk-flow');
    await audit(A.p, 'hand-in flow, the brief');
    await A.p.click('.tk-flow .sh-next .primary');
    await A.p.locator('.tk-ticks input').nth(0).check(); await A.p.locator('.tk-ticks input').nth(1).check();
    await A.p.click('.tk-flow .sh-next .primary');
    await A.p.fill('.tk-flow textarea', 'I drew a plant cell and labelled the nucleus and the wall.');
    await A.p.click('.tk-flow .sh-next .primary');
    ok(await A.p.isDisabled('.tk-flow .sh-next .primary'), 'it needs a photo: Hand it in waits for one');
    await A.p.setInputFiles('.tk-flow input[capture=environment]', { name: 'cell.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(ROOT, 'public/icons/icon-192.png')) });
    await A.p.waitForSelector('.tk-flow .sh-preview img');
    await A.p.click('.tk-flow .sh-next .primary');
    await A.p.waitForSelector('.tk-flow h2:has-text("Handed in!")');
    const rows = await held(A.p);
    ok(rows.length === 2 && rows[0].upload && /handInTask/.test(rows[1].body), `offline: the photo and the hand-in wait on the phone (${rows.length})`);
    ok(!(saved().handIns || []).some((r) => r.studentId === AARON && r.eventId), 'nothing on the server yet');
    await A.p.screenshot({ path: SH + 'aaron-done.png' });
    await A.p.click('.tk-flow .sh-next .primary');
    await A.c.setOffline(false);
    const hi = await until(() => { const s = saved(); const r = (s.handIns || []).find((x) => x.studentId === AARON && x.eventId); const e = r && s.events.find((x) => x.id === r.eventId); return e && /^api\/files\//.test(e.evidence[0]?.url || '') ? { r, e } : null; }, 15000);
    ok(!!hi && hi.e.lineIds[0] === 'science' && hi.e.task === task.id && hi.r.ticked.length === 2, `back online: a moment on Science, linked to the task, with the uploaded photo (${hi?.e.evidence[0]?.url})`);
    ok(saved().requests.some((r) => r.eventId === hi?.e.id && r.teacherId === TID && r.status === 'pending'), 'waiting for Mr Coultas to check it');
    ok(await until(async () => !(await A.p.isVisible('.tk-card'))), 'the card goes from Aaron’s home');
    await A.c.close();

    // ── Two days later ──
    await stop(srv);
    srv = await start(port, dataDir, 2);
    const later = Date.now() + 2 * DAY;
    const L = await desk(lTok, later);
    await go(L.p, '#/me/map');
    await L.p.waitForSelector('.tk-mine');
    const item = L.p.locator('.tk-mine li', { hasText: 'Plant cell poster' });
    const due = await item.locator('.tk-due').innerText();
    const red = await item.locator('.tk-due').evaluate((el) => getComputedStyle(el).color);
    ok(/^Overdue/.test(due) && red === 'rgb(180, 35, 24)', `${late.name}, Standard level: "${due}" in red (${red}), with the word too`);
    await audit(L.p, 'Standard home, Tasks list with an overdue task');
    await item.locator('button').click();
    await L.p.waitForSelector('.tk-flow');
    ok(/Late\./.test(await L.p.innerText('.tk-flow')), 'the brief says it is late');
    await L.p.click('.tk-flow .sh-next .primary');
    await L.p.locator('.tk-ticks input').nth(0).check();
    await L.p.click('.tk-flow .sh-next .primary');
    await L.p.fill('.tk-flow textarea', 'Mine is late, sorry.');
    await L.p.click('.tk-flow .sh-next .primary');
    await L.p.setInputFiles('.tk-flow input[type=file]:not([capture])[accept="image/*"]', { name: 'late.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(ROOT, 'public/icons/icon-192.png')) });
    await L.p.waitForSelector('.tk-flow .sh-preview img');
    await L.p.click('.tk-flow .sh-next .primary');
    await L.p.waitForSelector('.tk-flow h2:has-text("Handed in!")');
    const lr = await until(() => (saved().handIns || []).find((x) => x.studentId === late.id && x.eventId));
    ok(!!lr && lr.date > task.due, `${late.name} handed in on ${lr?.date}, after ${task.due}: late`);
    await L.c.close();

    // ── Mr Coultas: This week, then the hand-in grid ──
    T = await desk(tTok, later);
    await go(T.p, '#/me/week');
    const w = T.p.locator('.tw-wait li', { hasText: 'Hand-ins for “Plant cell poster”' });
    ok(await until(() => w.isVisible()) && (await w.locator('b').innerText()) === '2', 'This week, Waiting for you: “Hand-ins for “Plant cell poster”” · 2');
    ok(!(await T.p.locator('.tw-wait li', { hasText: 'Endorsement request' }).count()), 'not counted again as single endorsement requests');
    await w.locator('a').click();
    await T.p.waitForSelector('.tk-grid');
    const cell = (sid) => T.p.locator(`.tk-cell[data-student="${sid}"]`);
    ok(/Handed in(?! late)/.test(await cell(AARON).innerText()) && /To look at/.test(await cell(AARON).innerText()) && await cell(AARON).locator('img.ca-img').count() === 1, 'grid: Aaron handed in, to look at, with his photo and words');
    ok(/Handed in late/.test(await cell(late.id).innerText()), `grid: ${late.name} handed in late`);
    ok(/Not yet, overdue/.test(await cell(slow.id).innerText()), `grid: ${slow.name} not yet, overdue`);
    await audit(T.p, 'hand-in grid');
    await T.p.screenshot({ path: SH + 'grid.png', fullPage: true });
    const until3 = bkk(later + 3 * DAY);
    await cell(slow.id).locator('button:has-text("More time")').click();
    await cell(slow.id).locator('input[type=date]').fill(until3);
    await cell(slow.id).locator('button:has-text("Give more time")').click();
    ok(await until(() => (saved().handIns || []).some((r) => r.studentId === slow.id && r.due === until3)), `more time for ${slow.name}, until ${until3}`);
    ok(await until(async () => /More time: until/.test(await cell(slow.id).innerText()) && !/overdue/.test(await cell(slow.id).innerText())), 'the grid shows it, no longer overdue');
    ok(bell(slow.id, /gave you until/).length === 1, `${slow.name} is told`);
    await cell(AARON).locator('button:has-text("Endorse")').click();
    await T.p.waitForSelector('.toast.show');
    ok(await until(() => saved().events.find((e) => e.id === hi.e.id)?.verification === 'teacher-endorsed'), 'endorsed from the grid: Aaron’s moment is teacher-endorsed');
    ok(await until(async () => /Endorsed/.test(await cell(AARON).innerText())), 'the grid says Endorsed');
    ok(bell(AARON, /endorsed “Plant cell poster”/).length === 1, 'Aaron hears about it');
    await T.c.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) { ok(false, e.stack || String(e)); } finally { await b.close(); await stop(srv); }
})();
