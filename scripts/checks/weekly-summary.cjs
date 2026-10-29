// "This week" on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and imports
// the real roster. Aaron Torres (Year 8, 8C) signs up, his family joins by letter, and on a phone at Simple level he adds
// a moment on Science and asks Mr David Coultas (T60198) to check it; he also shares one with the school, answers a class
// question and comments. Mr Coultas sees the request and the comment under "Waiting for you" and the moments in his
// science class C-392000; Last week is empty. Ms Jane Altemen (T25948, advisor of 8C) sees her advisory: new moments,
// the sign-up and family this week, and quiet students with a nudge. On a Monday both land on This week.
// Every account has its own browser context.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-week-';
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198', ADVISOR = 'T25948', CLASS = 'C-392000';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const bangkok = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

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
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok = adminTok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) }); return { status: r.status, ...(await r.json()) }; };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), coultas = person(TEACHER), altemen = person(ADVISOR);
    ok(aaron?.advisorId === ADVISOR && roster.classes.find((c) => c.id === CLASS)?.teacherIds.includes(TEACHER), `${aaron?.name} (${aaron?.homeroom}), advised by ${altemen?.name}, in ${coultas?.name}’s ${CLASS}`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[altemen.email]);
    const ctx = async (tok, opt = {}) => { const c = await b.newContext(opt.phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); if (opt.at) await p.clock.setFixedTime(opt.at); p.on('pageerror', (e) => errs.push(e.message)); return p; };

    // ── Aaron's family joins by letter ──
    const letters = await (await fetch(`${U}/api/admin/family/letters`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ homerooms: [aaron.homeroom] }) })).json();
    const letter = letters.letters.find((l) => l.studentId === STUDENT);
    const fj = await fetch(`${U}/api/family/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: letter.url.split('/family/')[1], name: 'Sam Torres', email: 'sam.torres@family.example', password: 'family-pass-123' }) });
    ok(fj.status === 200, 'a family member joins Aaron by letter');

    // ── Aaron, on a phone, at Simple level: adds a moment and asks Mr Coultas ──
    const s = await ctx(sTok, { phone: true });
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    for (const l of ['Science', 'Sport']) { const btn = s.locator('.ob-pick', { hasText: l }).first(); if (!(await btn.getAttribute('aria-pressed') === 'true')) await btn.click(); }
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    await s.click('.sh-card.add');
    await s.fill('.sh-flow .sh-input', 'Plant growth experiment'); await s.click('.sh-flow .sh-next .primary');
    await s.click('.sh-flow .sh-lines button:has-text("Science")');
    await s.click('.sh-flow .sh-next .primary'); // skip the reflection
    if (!(await s.locator('.sh-flow .sh-ask', { hasText: coultas.name }).count())) await s.click('.sh-flow .sh-ask.other:has-text("Someone else")');
    await s.locator('.sh-flow .sh-ask', { hasText: coultas.name }).first().click();
    const ev = await until(async () => (await state()).events.find((e) => e.studentId === STUDENT && e.title === 'Plant growth experiment'));
    ok(!!ev && (await state()).requests.some((r) => r.eventId === ev.id && r.teacherId === TEACHER && r.status === 'pending'), `Aaron adds “Plant growth experiment” and asks ${coultas.name}`);
    await s.context().close();
    // He also shares one with the school, comments on the first, and answers a class question.
    const shared = await act(sTok, 'addStation', [STUDENT, { title: 'Science fair poster', lineIds: ['science'], visibility: 'school', reflection: 'We tested three soils.' }]);
    ok(shared.status === 200, 'Aaron adds a school-visible moment');
    ok((await act(sTok, 'addMomentComment', [ev.id, 'student', 'I watered one twice a day.'])).status === 200, 'and comments on his moment');
    const q = await act(tTok, 'askClass', [CLASS, TEACHER, { question: 'What did you notice in the lab today?' }]);
    ok(q.status === 200, `${coultas.name} asks ${CLASS} a question`);
    ok((await act(sTok, 'answerPrompt', [q.result.id, STUDENT, { text: 'The roots grew towards the water.' }])).status === 200, 'Aaron answers it');
    const classSize = (await state(tTok)).classPrompts.find((p) => p.id === q.result.id).studentIds.length;

    // ── Mr Coultas: This week ──
    const t = await ctx(tTok);
    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('.queue');
    ok(await t.locator('.topnav a:has-text("This week"), .topnav button:has-text("This week")').count() >= 1, 'This week is in his top bar');
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.tw');
    const wait = await t.locator('.tw-wait').innerText();
    ok(/1\s*Endorsement request\b/.test(wait.replace(/\n/g, ' ')), `Waiting for you: 1 endorsement request (${wait.replace(/\n/g, ' · ')})`);
    ok(wait.includes('New comment on “Plant growth experiment”') && wait.includes(aaron.name), 'and Aaron’s new comment');
    const row = t.locator(`.tw-classes tr[data-class="${CLASS}"]`);
    const cells = async (r) => (await r.locator('td').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
    const c = await cells(row);
    ok(c[1] === '3 on Science', `his science class: 3 moments on Science this week, the two and the answer (${c.join(' | ')})`);
    ok(c[2] === `1 of ${classSize}`, `1 of ${classSize} students added something`);
    ok(c[3] === `${Math.round(100 / classSize)}% answered (1 of ${classSize})`, 'the class question: 1 answered');
    const cel = await t.locator('.tw-cel').innerText();
    ok(cel.includes('Science fair poster') && !cel.includes('Plant growth experiment'), 'Celebrate shows the school-visible moment only');
    ok(await t.locator('#tw-adv').count() === 0, 'no advisory section for a subject teacher');
    await t.screenshot({ path: SH + 'coultas.png', fullPage: true });
    await t.click('.tw-wait a:has-text("Endorsement request")'); await t.waitForSelector('.q-card');
    ok(t.url().endsWith('#/me/queue') && (await t.locator('.q-card', { hasText: 'Plant growth experiment' }).count()) === 1, 'the row opens Endorsements with the moment');
    await t.goto(`${U}/#/me/week`); await t.waitForSelector('.tw');
    await t.click('.tw-tabs a:has-text("Last week")'); await t.waitForSelector('.tw .kicker:has-text("Last week")');
    const l = await cells(t.locator(`.tw-classes tr[data-class="${CLASS}"]`));
    ok(l[1] === '0 on Science' && l[3] === 'None asked', `Last week: nothing yet (${l.join(' | ')})`);
    ok((await t.locator('.tw-wait').innerText()).includes('Endorsement request'), 'Waiting for you is the same on Last week');
    await t.setViewportSize({ width: 390, height: 820 });
    await t.click('.tw-tabs a:has-text("This week")'); await t.waitForSelector('.tw .kicker:has-text("This week")');
    ok(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await t.screenshot({ path: SH + 'coultas-phone.png', fullPage: true });

    // ── Ms Altemen, Aaron's advisor: Your advisory ──
    const a = await ctx(aTok);
    await a.goto(`${U}/#/me/week`); await a.waitForSelector('#tw-adv');
    await a.waitForSelector('.tw-tiles .tile:has-text("families joined"), .tw-tiles .tile:has-text("family joined")');
    const tiles = (await a.locator('.tw-tiles').innerText()).replace(/\s+/g, ' ');
    const adviseeCount = roster.students.filter((x) => x.advisorId === ADVISOR).length;
    ok(/3 new moments/.test(tiles) && new RegExp(`1 of ${adviseeCount} added something`).test(tiles), `her advisory: 3 new moments, 1 of ${adviseeCount} added something (${tiles})`);
    ok(/1 signed up this week · 1 of/.test(tiles), 'Aaron signed up this week');
    ok(/1 family joined · 1 of/.test(tiles), 'his family joined this week');
    ok((await a.locator('.tw-moments').innerText()).includes('Plant growth experiment'), 'the new moments are listed');
    const quiet = a.locator('.tw .nd-quiet');
    ok(await quiet.count() === 1 && !(await quiet.innerText()).includes(aaron.name), 'Quiet for 3 weeks lists the others, not Aaron');
    ok(await quiet.locator('button:has-text("Send a nudge")').count() > 0, 'with Send a nudge');
    await quiet.locator('button:has-text("Send a nudge")').first().click();
    await quiet.locator('.nd-edit .primary').click();
    ok(!!(await until(async () => (await state()).nudges?.some((n) => n.from === ADVISOR))), 'a nudge from This week is saved');
    ok((await a.locator('.tw-cel').innerText()).includes('Science fair poster'), 'she sees it under Celebrate too');
    await a.screenshot({ path: SH + 'altemen.png', fullPage: true });
    await a.click('.tw-cel a:has-text("Science fair poster")'); await a.waitForURL(/#\/me\/student\//);
    ok(a.url().includes(`student/${STUDENT}~`), 'a celebrated moment opens on Aaron’s map');

    // ── Landing: a Monday opens This week; another day the usual home ──
    const today = bangkok();
    if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 1) {
      const n = await ctx(aTok); await n.goto(`${U}/#/me`); await n.waitForSelector('main.screen');
      ok(await n.locator('.tw').count() === 0, `not a Monday (${today}): she lands on her usual home`);
      await n.context().close();
    }
    const mon = new Date(Date.parse(`${today}T03:00:00Z`) + ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7 || 7) * 864e5);
    for (const [who, tok] of [['Ms Altemen', aTok], ['Mr Coultas', tTok]]) {
      const m = await ctx(tok, { at: mon }); await m.goto(`${U}/#/me`); await m.waitForSelector('main.screen');
      ok(await m.waitForSelector('.tw', { timeout: 5000 }).then(() => true, () => false), `${who} lands on This week on Monday ${bangkok(mon)}`);
      await m.context().close();
    }
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
