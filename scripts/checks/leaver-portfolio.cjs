// Leaver portfolio on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster and picks a Year 13 student and their advisor at runtime. The student builds a portfolio with 3 moments (a
// private one is never offered), a photo, a shortened reflection and an endorsement; downloads the PDF in each template
// (A4, page count, nothing wider than the page); makes a share link. The advisor reads the draft and comments, cannot
// edit. A signed-out browser opens the link and sees only the chosen items; after the student withdraws it, 404. Aaron
// Torres (Year 8) does not see the feature. Every account has its own browser context. TP_ROSTER=/path/to/roster.json.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-leaver-';
const AARON = 'Sabc0d6125e85';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const pages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const a4 = (buf) => /\/MediaBox\s*\[\s*0 0 59[45]\.\d+ 84[12]\.\d+\s*\]/.test(buf.toString('latin1'));
// A 2x2 PNG (navy).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGNgYGD4z8DAwMDAwAAADQABAXnR4wAAAABJRU5ErkJggg==', 'base64');

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
const noScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
// In print: everything inside the document stays within its width.
const overflow = (p) => p.evaluate(() => {
  const doc = document.querySelector('.lv-doc'); if (!doc) return ['no document'];
  const r = doc.getBoundingClientRect();
  return [...doc.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 1 || b.left < r.left - 1); }).map((e) => e.className || e.tagName).slice(0, 5);
});

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-leaver-data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const teacher = new Map(roster.teachers.map((t) => [t.id, t]));
    const stu = roster.students.filter((s) => s.year === 13 && links[s.email] && links[teacher.get(s.advisorId)?.email]).sort((x, y) => x.name.localeCompare(y.name))[0];
    const adv = teacher.get(stu?.advisorId);
    ok(stu && adv, `picked a Year 13 student, ${stu?.name}, and their advisor, ${adv?.name}`);
    const sid = stu.id, first = stu.name.split(' ')[0];

    // ── The student's record: four moments (one private, one with a reflection), an endorsement from the advisor ──
    const sTok = await setupWith(U, links[stu.email]), tTok = await setupWith(U, links[adv.email]);
    ok((await act(sTok, 'completeOnboarding', [sid, ['science', 'service', 'art'], 'classic'])).ok && (await act(sTok, 'setIntensity', [sid, 'standard'])).ok, `${first} is set up`);
    const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const M = [
      ['Led the beach clean-up at Bang Saen', 'service', 'school', 120, { reflection: 'I learned to plan a big day. It was hard to get permission at first! Next time I will start the paperwork sooner.', summary: 'Organised 40 volunteers and logged what we collected.' }],
      ['Extended essay on mangrove carbon', 'science', 'publishable', 60, { summary: 'Measured soil carbon at three sites.' }],
      ['Painted the library mural', 'art', 'advisor', 30, {}],
      ['Notes on a hard week', 'art', 'private', 10, {}],
    ];
    for (const [title, line, visibility, n, extra] of M) await act(sTok, 'addStation', [sid, { title, lineIds: [line], date: day(n), type: 'project', visibility, ...extra }]);
    const evs = () => saved().events.filter((e) => e.studentId === sid);
    const idOf = (t) => evs().find((e) => e.title === t)?.id;
    ok(evs().length === 4, 'four moments on the map, one private');
    await act(sTok, 'requestEndorsement', [idOf(M[0][0]), adv.id, 'Could you endorse this?']);
    const rq = saved().requests.find((r) => r.eventId === idOf(M[0][0]));
    ok((await act(tTok, 'endorse', [[rq.id], adv.id, `${first} organised the whole day with real care.`])).ok, 'the advisor endorses the clean-up');

    // ── Refused on the server ──
    ok((await act(tTok, 'saveLeaver', [sid, { template: 'minimal' }])).status === 403, 'the advisor cannot edit the portfolio');
    ok((await act(adminTok, 'saveLeaver', [sid, { template: 'minimal' }])).status === 403, 'nor an admin');
    ok((await act(tTok, 'commentLeaver', [sid, adv.id, 'Too early'])).status === 403, 'no comments before there is a portfolio');

    // ── The student builds it ──
    const cS = await b.newContext({ viewport: { width: 1360, height: 900 } });
    await cS.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
    const s = await cS.newPage(); const sErrs = []; s.on('pageerror', (e) => sErrs.push(e.message));
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.topnav');
    ok(await s.locator('.topnav a, .topnav button', { hasText: 'Leaver portfolio' }).count() > 0, 'a Year 13 student has "Leaver portfolio" in the navigation');
    await s.goto(`${U}/#/me/leaver`); await s.waitForSelector('.lv-start');
    await s.click('.lv-start button:has-text("Start")');
    await s.waitForSelector('.lv-steps');
    ok(await until(async () => !!saved().leaver?.[sid]), 'started: a draft in the record');
    await s.fill('.lv-step textarea', 'I am a Year 13 student who loves the sea and wants to study marine science. I like turning a messy day outside into data people can use.');
    await s.fill('.lv-step input[type=email]', `${first.toLowerCase()}@example.com`);
    await s.locator('.lv-step input').first().click(); // blur saves
    await s.setInputFiles('.lv-file input[type=file]', { name: 'me.png', mimeType: 'image/png', buffer: PNG });
    ok(await until(async () => /api\/files\//.test(saved().leaver[sid].profile.photo || '')), 'profile: statement, email and an uploaded photo saved');
    ok(saved().leaver[sid].profile.statement.startsWith('I am a Year 13 student') && saved().leaver[sid].profile.email === `${first.toLowerCase()}@example.com`, 'the statement and email are in the draft');

    await s.click('.lv-nav .primary'); await s.waitForSelector('#lv-s2');
    const offered = await s.locator('.lv-choices li b').allInnerTexts();
    ok(offered.length === 3 && !offered.includes(M[3][0]), `moments step: 3 offered, the private one never (${offered.join(' | ')})`);
    ok((await s.locator('#lv-s2 + .lv-help').innerText()).includes('1 private or hidden moment is left out'), 'and it says one private moment is left out');
    for (const t of [M[0][0], M[1][0], M[2][0]]) await s.click(`.lv-choices button[aria-label="Add “${t}”"]`);
    await until(async () => saved().leaver[sid].moments.length === 3);
    await s.click(`button[aria-label="Move “${M[2][0]}” up"]`); // mural before the essay
    ok(await until(async () => saved().leaver[sid].moments.map((m) => m.eventId).join() === [idOf(M[0][0]), idOf(M[2][0]), idOf(M[1][0])].join()), 'three moments picked and reordered');
    const sent = s.locator('.lv-sents .lv-check').nth(1).locator('input'); // "It was hard to get permission at first!"
    await sent.uncheck();
    ok(await until(async () => JSON.stringify(saved().leaver[sid].moments[0].sentences) === '[0,2]'), 'only two sentences of the reflection kept');
    ok((await s.locator('.lv-preview .lv-refl p').first().innerText()) === 'I learned to plan a big day. Next time I will start the paperwork sooner.', 'the preview shows the chosen part of the reflection');
    ok(await s.locator('.lv-choices button:has-text("Add")').count() === 0, 'every moment it can use is picked');

    await s.click('.lv-nav .primary'); await s.waitForSelector('#lv-s3');
    ok(await s.locator('#lv-s3 ~ fieldset .lv-check').count() > 0 && await s.locator('.lv-preview .lv-skills .lv-chips li').count() > 0, 'skills and qualities come from the moments\' tags');
    await s.click('.lv-nav .primary'); await s.waitForSelector('#lv-s4');
    await s.locator('.lv-choices .lv-check input').first().check();
    ok(await until(async () => saved().leaver[sid].endorsements.length === 1), 'the advisor\'s endorsement included');
    ok((await s.locator('.lv-preview .lv-endorse').innerText()).includes(adv.name), 'shown with the teacher\'s name');
    await s.click('.lv-nav .primary'); await s.waitForSelector('#lv-s5');
    await s.screenshot({ path: SH + 'builder.png' });

    // ── PDF in every template ──
    for (const [k, label] of [['classic', 'NIST navy classic'], ['minimal', 'Minimal'], ['two-column', 'Two columns']]) {
      await s.click(`.lv-tpl:has-text("${label}")`);
      await until(async () => saved().leaver[sid].template === k);
      await s.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = document.title; window.dispatchEvent(new Event('afterprint')); }; });
      await s.click('.lv-top .print-btn');
      const title = await s.evaluate(() => window.__printed);
      await s.emulateMedia({ media: 'print' }); await s.waitForTimeout(200);
      const shown = await s.evaluate(() => [...document.querySelectorAll('.lv-edit, .lv-steps, .lv-top, .topnav, .soon')].filter((e) => getComputedStyle(e).display !== 'none').length);
      const over = await overflow(s);
      const buf = await s.pdf({ preferCSSPageSize: true });
      if (k === 'classic') fs.writeFileSync(SH + 'classic.pdf', buf);
      const n = pages(buf);
      ok(title === `${stu.name} – Leaver portfolio` && !shown && a4(buf) && n >= 1 && n <= 3 && !over.length, `PDF (${label}): “${title}.pdf”, A4, ${n} page${n === 1 ? '' : 's'}, no app chrome, nothing wider than the page${over.length ? ` (${over.join(', ')})` : ''}`);
      await s.emulateMedia({ media: 'screen' });
    }

    // ── A share link ──
    await s.fill('.lv-make input', 'Marine science admissions');
    await s.click('.lv-make button:has-text("Make a link")');
    await s.waitForSelector('.lv-made input');
    const url = await s.locator('.lv-made input').inputValue();
    const token = url.split('#/l/')[1];
    ok(/^[A-Za-z0-9_-]{22,}$/.test(token || '') && saved().leaver[sid].links[0]?.token === token, `a link: ${url.replace(U, '')}`);
    ok(await s.locator('.lv-links li', { hasText: 'Marine science admissions' }).count() === 1, 'listed as open, with its label');

    // ── The advisor reads the draft and comments ──
    const cT = await b.newContext({ viewport: { width: 1360, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/student/${sid}`); await t.waitForSelector('.lv-staff');
    ok((await t.locator('.lv-staff').innerText()).includes('3 moments'), 'the advisor\'s student page: "Leaver portfolio, 3 moments"');
    await t.click('.lv-staff button:has-text("Read the draft")');
    await t.waitForSelector('.lv-modal .lv-doc');
    ok(await t.locator('.lv-modal .lv-moment').count() === 3 && await t.locator('.lv-modal .lv-edit, .lv-modal input[type=checkbox], .lv-modal .lv-order').count() === 0, 'the draft: three moments, read only');
    const st = (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tTok}` } })).json()).snapshot.store;
    ok(st.leaver[sid] && st.leaver[sid].links.every((l) => !l.token), 'the advisor\'s copy has the draft but no link tokens');
    await t.fill('.lv-cm textarea', 'Put the essay first: it is closest to marine science.');
    await t.click('.lv-cm button:has-text("Add comment")');
    ok(await until(async () => saved().leaver[sid].comments?.[0]?.by === adv.id), 'comment saved, by the advisor');
    await t.screenshot({ path: SH + 'advisor.png' });
    ok(saved().notifications.some((x) => x.to === `st:${sid}` && /comment on your leaver portfolio/.test(x.text)), `${first} is told`);

    await s.reload(); await s.waitForSelector('.lv-comments');
    ok((await s.locator('.lv-comments').innerText()).includes('Put the essay first'), 'the student sees the comment');
    await s.click('.lv-comments button:has-text("Done")');
    ok(await until(async () => !!saved().leaver[sid].comments[0].done), 'and ticks it done');

    // ── Signed out: only the chosen items ──
    const cR = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const r = await cR.newPage(); const rErrs = []; r.on('pageerror', (e) => rErrs.push(e.message));
    await r.goto(url); await r.waitForSelector('.lv-public .lv-doc');
    const titles = await r.locator('.lv-moment h3').allInnerTexts();
    ok(titles.join('|') === [M[0][0], M[2][0], M[1][0]].join('|'), `signed out: the three chosen moments in order (${titles.join(' | ')})`);
    const body = await r.locator('body').innerText();
    ok(!body.includes(M[3][0]) && !body.includes('Put the essay first') && !body.includes('hard to get permission'), 'nothing private, no comments, not the reflection sentence left out');
    ok(body.includes(adv.name) && body.includes('marine science') && body.includes(`${first.toLowerCase()}@example.com`), 'the endorsement, statement and contact email are there');
    ok(await r.locator('.lv-photo').evaluate((img) => img.complete && img.naturalWidth > 0), 'the photo opens signed out');
    await r.setViewportSize({ width: 390, height: 820 });
    ok(await noScroll(r), 'no sideways scroll at phone width');
    await r.screenshot({ path: SH + 'public.png', fullPage: true });
    ok(!(await (await fetch(`${U}/api/state`)).ok), 'signed out, the record itself stays closed');

    // ── Withdrawn ──
    await s.click('.lv-steps button:has-text("Look and share")');
    await s.click('.lv-links li .lv-revoke');
    ok(await until(async () => saved().leaver[sid].links[0].revoked === true), 'the student withdraws the link');
    ok((await fetch(`${U}/api/public/leaver/${token}`)).status === 404, 'the link now answers 404');
    await r.reload(); await r.waitForSelector('.link-dead h2');
    ok((await r.locator('.link-dead h2').innerText()) === 'This link does not work', 'and the reader sees "This link does not work"');
    const photoName = saved().leaver[sid].profile.photo.split('/').pop();
    ok((await fetch(`${U}/api/files/${photoName}`)).status === 404, 'the photo no longer opens signed out');

    // ── A Year 8 student does not see it ──
    const aaron = roster.students.find((x) => x.id === AARON);
    const aTok = await setupWith(U, links[aaron.email]);
    await act(aTok, 'completeOnboarding', [AARON, ['science'], 'classic']);
    const cA = await b.newContext({ viewport: { width: 1200, height: 860 } });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.topnav');
    ok(await a.locator('.topnav', { hasText: 'Leaver portfolio' }).count() === 0, `${aaron.name} (Year ${aaron.year}): no "Leaver portfolio" in the navigation`);
    await a.goto(`${U}/#/me/leaver`); await a.waitForTimeout(800);
    ok(await a.locator('.lv-page').count() === 0, 'and the address shows his map instead');
    ok((await act(aTok, 'saveLeaver', [AARON, {}])).status === 403, 'the server refuses one for him too');

    ok(!sErrs.length && !tErrs.length && !rErrs.length && !aErrs.length, `no page errors ${[...sErrs, ...tErrs, ...rErrs, ...aErrs].join(' | ')}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
