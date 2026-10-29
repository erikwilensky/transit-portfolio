// Moment comments on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and imports
// the real roster. A Year 8 student (Simple level, phone size) adds a moment and asks his science teacher to check it;
// the teacher comments from Endorsements; the student sees "1 new", reads it as "Mr <Surname>" and replies; his advisor
// opens the thread from her notification. A parent linked to him, and a teacher out of reach, get nothing.
// Each person has their own browser context (cookie jar).
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-comments-';
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198', ADVISOR = 'T25948'; // Aaron Torres, Mr David Coultas, Ms Jane Altemen
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
  const bells = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store.notifications;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok = adminTok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), coultas = person(TEACHER), altemen = person(ADVISOR);
    ok(aaron?.advisorId === ADVISOR, `${aaron?.name}, Year ${aaron?.year}, advised by ${altemen?.name}; science with ${coultas?.name}`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[altemen.email]);
    const ctx = async (tok, phone) => { const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

    // ── Aaron, on a phone, at Simple level: adds a moment and asks Mr Coultas ──
    const s = await ctx(sTok, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    for (const l of ['Science', 'Sport']) { const btn = s.locator('.ob-pick', { hasText: l }).first(); if (!(await btn.getAttribute('aria-pressed') === 'true')) await btn.click(); }
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    await s.click('.sh-card.add');
    await s.fill('.sh-flow .sh-input', 'Plant growth experiment'); await s.click('.sh-flow .sh-next .primary');
    await s.click('.sh-flow .sh-lines button:has-text("Science")');
    await s.click('.sh-flow .sh-next .primary'); // skip the reflection
    const ask = s.locator('.sh-flow .sh-ask', { hasText: coultas.name });
    if (!(await ask.count())) await s.click('.sh-flow .sh-ask.other:has-text("Someone else")');
    await s.locator('.sh-flow .sh-ask', { hasText: coultas.name }).first().click();
    const ev = await until(async () => (await state()).events.find((e) => e.studentId === STUDENT && e.title === 'Plant growth experiment'));
    ok(!!ev && (await state()).requests.some((r) => r.eventId === ev.id && r.teacherId === TEACHER), `the moment is saved and ${coultas.name} was asked to check it`);

    // ── Mr Coultas comments from Endorsements ──
    let t = await ctx(tTok);
    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('.q-card');
    const card = t.locator('.q-card', { hasText: 'Plant growth experiment' });
    ok(await card.count() === 1, 'the moment is in his Endorsements queue');
    await card.locator('.mc-toggle').click();
    await card.locator('.mc-write textarea').fill('Great start, Aaron. What did you change between the two plants?');
    await card.locator('.mc-write .primary').click();
    const c1 = await until(async () => (await state()).momentComments?.find((c) => c.eventId === ev.id && c.by === TEACHER));
    ok(!!c1, 'his comment is saved on the server');
    ok(bells().some((n) => n.to === `st:${STUDENT}` && n.go?.param === ev.id && /^Mr Coultas wrote on/.test(n.text)), 'Aaron is notified, linked to the moment ("Mr Coultas wrote on …")');
    await t.screenshot({ path: SH + 'teacher-queue.png' });
    await t.close(); // an open thread on screen counts as read

    // ── Aaron sees it on his phone and replies ──
    await s.goto(`${U}/#/me/map`); await s.reload(); await s.waitForSelector('.sh-feed');
    const tile = s.locator('.sh-feed li', { hasText: 'Plant growth experiment' });
    ok((await tile.locator('.mc-new').innerText()).trim() === '1 new', 'My moments: "1 new" on the card');
    await s.screenshot({ path: SH + 'student-home.png' });
    await tile.locator('button').click(); await s.waitForSelector('.sh-moment .mc-thread');
    const th = await s.locator('.sh-moment .mc-thread').innerText();
    ok(th.includes('Mr Coultas') && !th.includes('Mr David Coultas') && th.includes('What did you change'), 'the moment shows the comment from "Mr Coultas"');
    await s.click('.sh-moment .mc-reply');
    await s.fill('.sh-moment .mc-write textarea', 'One had more light. It grew taller.');
    await s.screenshot({ path: SH + 'student-reply.png' });
    await s.click('.sh-moment .mc-write .primary');
    const c2 = await until(async () => (await state()).momentComments?.find((c) => c.eventId === ev.id && c.by === 'student'));
    ok(!!c2, 'his reply is saved');
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await s.click('.sh-moment .panel-close');
    ok(await s.locator('.sh-feed li', { hasText: 'Plant growth experiment' }).locator('.mc-new').count() === 0, 'the badge is gone once read');
    const toCoultas = bells().find((n) => n.to === `t:${TEACHER}` && /^Aaron wrote on/.test(n.text));
    const toAdvisor = bells().find((n) => n.to === `t:${ADVISOR}` && /^Aaron wrote on/.test(n.text));
    ok(toCoultas?.go?.param === `c~${ev.id}`, 'Mr Coultas is notified, linked to the thread in his queue');
    ok(toAdvisor?.go?.screen === 'student' && toAdvisor.go.param === `${STUDENT}~${ev.id}`, 'his advisor is notified, linked to the station on his map');

    // ── Mr Coultas sees "1 new" in his queue ──
    t = await ctx(tTok); await t.goto(`${U}/#/me/queue`); await t.waitForSelector('.q-card');
    ok((await t.locator('.q-card', { hasText: 'Plant growth experiment' }).locator('.mc-toggle .mc-new').innerText()).trim() === '1 new', 'his queue card shows "1 new"');

    // ── The advisor opens the thread from her notification ──
    const a = await ctx(aTok);
    await a.goto(`${U}/#/me/${toAdvisor.go.screen}/${toAdvisor.go.param}`); await a.waitForSelector('.station-panel.open .mc-thread');
    const at = await a.locator('.station-panel.open .mc-thread').innerText();
    ok(at.includes(coultas.name) && at.includes(aaron.name) && at.includes('One had more light'), `${altemen.name} sees the thread: ${coultas.name} and ${aaron.name}`);
    ok(await a.locator('.station-panel.open .mc-write textarea').count() === 1, 'and can write in it as the advisor');
    await a.screenshot({ path: SH + 'advisor.png' });

    // ── A parent linked to Aaron gets nothing ──
    const lt = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: H(aTok), body: JSON.stringify({ studentIds: [STUDENT] }) })).json();
    const tok = lt.letters[0].url.split('/family/')[1];
    const j = await fetch(`${U}/api/family/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, name: 'Torres Family', email: 'torres@family.example', password: 'family-pass-1' }) });
    const pTok = j.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
    const ps = await state(pTok);
    ok(ps.students.some((x) => x.id === STUDENT) && ps.events.some((e) => e.id === ev.id), 'the parent receives Aaron and the moment');
    ok(!ps.momentComments?.length && !ps.commentReads?.length && !JSON.stringify(ps).includes('One had more light'), 'but no comments at all');
    ok((await act(pTok, 'addMomentComment', [ev.id, 'student', 'Hello'])).status === 403, 'a parent cannot comment (403)');
    const p = await ctx(pTok);
    await p.goto(`${U}/#/me/family`); await p.waitForSelector('main.screen'); await p.waitForTimeout(800);
    ok(!(await p.locator('body').innerText()).includes('What did you change'), 'the family view shows no comment');

    // ── A teacher out of reach is refused ──
    const other = roster.teachers.find((x) => x.id !== TEACHER && x.id !== ADVISOR && x.roles.join() === 'teacher' && links[x.email]
      && !roster.classes.some((c) => c.teacherIds.includes(x.id) && roster.enrolments.some((n) => n.classId === c.id && n.studentId === STUDENT)));
    const oTok = await setupWith(U, links[other.email]);
    ok((await act(oTok, 'addMomentComment', [ev.id, other.id, 'Hi'])).status === 403, `${other.name}, who does not teach him, is refused (403)`);
    ok(!(await state(oTok)).momentComments?.length, 'and receives no comments');
    ok((await act(tTok, 'addMomentComment', [ev.id, ADVISOR, 'As her'])).status === 403, 'Mr Coultas cannot write as someone else');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
