// Simple-level goals on real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster, then Aaron Torres (Year 8, Simple) plans "something I want to do" on Science and asks his Science
// teacher, Mr David Coultas, to help. Coultas accepts the invitation, Aaron's advisor sees the goal, Aaron marks it
// done with a photo and a sentence, and Coultas endorses it in one click. Aaron also drops a second goal.
// Each account has its own browser context. TP_ROSTER=/path/to/transit-roster.json (default: the project mount).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-goals-';
const AARON = 'Sabc0d6125e85', COULTAS = 'T60198', TITLE = 'Enter the science fair';
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
  srv = await start(port, fs.mkdtempSync(SH + 'data-'));
  const b = await chromium.launch();
  try {
    const H = { cookie: `tp_session=${await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' })}`, 'content-type': 'application/json' };
    const state = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const rec = await state();
    const aaron = rec.students.find((s) => s.id === AARON);
    const sci = rec.classes.find((c) => c.teacherIds?.includes(COULTAS) && rec.enrolments.some((n) => n.classId === c.id && n.studentId === AARON));
    const line = rec.lines.find((l) => l.id === sci?.lineId);
    ok(aaron && sci && line, `Aaron (Year ${aaron?.grade + 1}) is in ${sci?.name}, on the ${line?.name} line`);
    const advisor = person(aaron.advisorId);
    const ctx = async (id, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 860 } });
      await c.addCookies([{ name: 'tp_session', value: await setupWith(U, links[person(id).email]), url: U }]);
      const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p;
    };

    // ── Aaron, on a phone: onboarding, then the Simple home ──
    const s = await ctx(AARON, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    await s.locator('.ob-pick', { hasText: line.name }).click();
    await s.locator('.ob-pick:not(.on)').first().click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    ok(await s.locator('.sh-card.goal', { hasText: 'Something I want to do' }).count() === 1, 'Simple home: a "Something I want to do" card');
    ok(await s.locator('.sh-card.ask').count() === 0, 'no question card while there is nothing to answer');
    const fits = await s.evaluate(() => [...document.querySelectorAll('.sh-card')].every((c) => c.getBoundingClientRect().right <= innerWidth));
    ok(fits && await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the cards fit at phone width, no sideways scroll');

    // The flow: what, colour, when, a teacher to help.
    await s.click('.sh-card.goal'); await s.waitForSelector('.sh-flow');
    const ideas = await s.locator('.sh-idea').allInnerTexts();
    ok(ideas.includes(TITLE), `friendly examples for his lines (${ideas.join(' · ')})`);
    await s.fill('.sh-input', TITLE); await s.click('.sh-next .primary');
    await s.locator('.sh-lines button', { hasText: line.name }).click();
    const whens = await s.locator('.sh-when > button').allInnerTexts();
    ok(['In a few weeks', 'By the end of this term', 'This year', 'Pick a date'].every((w) => whens.some((x) => x.startsWith(w))), 'big "when" choices, and pick a date');
    await s.locator('.sh-when > button', { hasText: 'By the end of this term' }).click();
    await s.waitForSelector('text=Want a teacher to help you with it?');
    const ask = await s.locator('.sh-ask').first().innerText();
    ok(ask.includes(person(COULTAS).name), `suggests his ${line.name} teacher (${ask.replace(/\n/g, ' · ')})`);
    await s.screenshot({ path: SH + 'sponsor.png' });
    await s.locator('.sh-ask').first().click();
    await s.waitForSelector('.sh-coming');
    const g = await until(async () => (await state()).events.find((e) => e.studentId === AARON && e.title === TITLE));
    ok(g?.type === 'goal' && g.lineIds[0] === line.id && g.sponsor?.teacherId === COULTAS && g.sponsor.status === 'invited' && g.date > new Date().toISOString().slice(0, 10), 'saved as a goal on Science with Coultas invited to sponsor');
    ok(await s.locator(`.sh-track:has-text("${line.name}") .sh-stop.goal`).count() === 1, 'a dashed stop ahead of Today on the Science track');
    ok((await s.locator('.sh-coming').innerText()).includes('Waiting for Mr Coultas to say yes'), '"Coming up": waiting for Mr Coultas');
    await s.screenshot({ path: SH + 'home.png', fullPage: true });

    // ── Coultas: the invitation, accepted ──
    const t = await ctx(COULTAS);
    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('main.screen');
    const inv = t.locator('.sp-card.invite', { hasText: TITLE });
    await inv.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await inv.count() === 1 && (await inv.innerText()).includes('Aaron Torres'), 'Coultas sees the sponsor invitation from Aaron');
    await inv.locator('input').fill('Show me your poster plan before the fair');
    await inv.locator('text=Sponsor it').click();
    ok(await until(async () => (await state()).events.find((e) => e.id === g.id)?.sponsor?.status === 'accepted'), 'he accepts it');

    // ── Aaron's advisor sees the goal on his page ──
    const a = await ctx(aaron.advisorId);
    await a.goto(`${U}/#/me/student/${AARON}`); await a.waitForSelector('.adv-student');
    ok((await a.locator('.agenda').innerText()).includes(TITLE), `his advisor (${advisor.name}) sees it in the meeting agenda`);

    // ── Aaron: it says Coultas is helping; he did it, with a photo and a sentence ──
    await s.reload(); await s.waitForSelector('.sh-coming');
    const card = s.locator('.sh-goal', { hasText: TITLE });
    ok((await card.innerText()).includes('Mr Coultas is helping you') && (await card.innerText()).includes('poster plan'), '"Mr Coultas is helping you", with his expectations');
    await card.locator('text=I did it!').click();
    await s.waitForSelector('text=You did it! Add a photo?');
    const png = await s.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
    await s.setInputFiles('.sh-photo-btn:not(.cam) input', { name: 'fair.png', mimeType: 'image/png', buffer: png });
    await s.waitForSelector('.sh-preview img');
    const src = await s.locator('.sh-preview img').getAttribute('src');
    await s.click('.sh-next .primary');
    await s.fill('textarea.sh-input', 'I was proud when the judges asked about my results.');
    await s.click('.sh-flow .sh-next .primary');
    const done = await until(async () => { const e = (await state()).events.find((x) => x.id === g.id); return e?.type !== 'goal' && e?.evidence[0]?.url === src && e; });
    ok(done && done.wasGoal && /^api\/files\//.test(src), `a moment now, with the uploaded photo (${src})`);
    ok(await until(async () => (await state()).reflections.some((r) => r.eventId === g.id && /judges/.test(r.text))), 'and his sentence');
    const rq = await until(async () => (await state()).requests.find((r) => r.eventId === g.id && r.status === 'pending'));
    ok(rq?.teacherId === COULTAS && rq.source === 'sponsor', 'it went back to Coultas to endorse');
    await s.waitForSelector('.sh-coming', { state: 'detached' }).catch(() => {});
    ok(await s.locator('.sh-stop.goal').count() === 0 && await s.locator(`.sh-track:has-text("${line.name}") .sh-stop.v-student-added`).count() === 1, 'the dashed goal stop is a moment stop now');

    // ── Coultas endorses it in one click ──
    await t.reload(); await t.waitForSelector('main.screen');
    const q = t.locator('.q-card', { hasText: TITLE });
    await q.waitFor({ timeout: 8000 }).catch(() => {});
    ok(await q.count() === 1 && (await q.innerText()).includes('Finished project you sponsored') && await q.locator('img.q-img').count() === 1, 'Coultas: "Finished project you sponsored", with the photo');
    await q.locator('button.primary', { hasText: 'Endorse' }).click();
    ok(await until(async () => (await state()).events.find((e) => e.id === g.id)?.verification === 'teacher-endorsed'), 'one click: endorsed');
    await s.reload(); await s.waitForSelector('.sh-tracks');
    await s.locator(`.sh-track:has-text("${line.name}") .sh-stop.v-teacher-endorsed`).first().waitFor({ timeout: 8000 }).catch(() => {}); // the reload may draw before the sync lands
    ok(await s.locator(`.sh-track:has-text("${line.name}") .sh-stop.v-teacher-endorsed`).count() === 1, 'Aaron’s stop is solid (checked by a teacher)');

    // ── A second goal, no teacher, then "Not doing this any more" ──
    await s.click('.sh-card.goal'); await s.fill('.sh-input', 'Learn to juggle'); await s.click('.sh-next .primary');
    await s.locator('.sh-lines button').first().click();
    await s.locator('.sh-when > button', { hasText: 'In a few weeks' }).click();
    if (await s.locator('text=Want a teacher to help you with it?').count()) await s.click('text=Not now');
    await s.waitForSelector('.sh-goal:has-text("Learn to juggle")');
    const j = await until(async () => (await state()).events.find((e) => e.studentId === AARON && e.title === 'Learn to juggle'));
    ok(j?.type === 'goal' && !j.sponsor, '"Not now": a goal without a sponsor');
    await s.locator('.sh-goal:has-text("Learn to juggle") >> text=Not doing this any more').click();
    await s.click('text=Yes, take it off');
    ok(await until(async () => !(await state()).events.some((e) => e.id === j.id)), '"Not doing this any more" takes it off');
    await s.screenshot({ path: SH + 'end.png', fullPage: true });
    for (const [n, p] of [['Aaron', s], ['Coultas', t], ['advisor', a]]) ok(!p.errs.length, `${n}: no page errors${p.errs.length ? `: ${p.errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
