// Student-led conferences on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and
// imports the real roster. Ms Jane Altemen (T25948) opens a conference round for 8C on My advisory. Aaron Torres, at Simple
// on a phone, gets ready (one question a screen, sentence starters, read aloud): two moments, his words, proud, hard, his
// goal. The advisor sees "Prepared: 1 of 23", books his time and opens Conference mode from the booking list: one moment a
// screen with its photo, then the goal; it keeps working offline (the photo and a private staff note, sent when back). Aaron
// adds "What I will do next" in his own Conference mode; his parent joins from a family letter in Thai and adds "What we
// will try at home". Each sees the conference note; the conference sheet carries his prep (one A4 page). axe on every new
// screen. Each account has its own browser context. TP_ROSTER=/path/to/transit-roster.json (default: the project mount).
// Screenshots and a PDF: tp-slc-* in SCRATCH or the temp folder.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-slc-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const TID = 'T25948', AARON = 'Sabc0d6125e85';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
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
const tokOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
const noScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? `\n${bad.map((x) => `    ${x.impact} ${x.id}: ${x.nodes.slice(0, 4).join(', ')}`).join('\n')}` : ''}`);
}
// A Bangkok date n days on, and (today) the next quarter hour at least 20 minutes away.
const bkk = (ms) => new Date(ms + 7 * 3600e3).toISOString();
const day = (n) => bkk(Date.now() + n * 864e5).slice(0, 10);
function firstDay() {
  const t = bkk(Date.now() + 20 * 60e3), h = +t.slice(11, 13), m = Math.ceil(+t.slice(14, 16) / 15) * 15;
  const from = h * 60 + m;
  if (t.slice(0, 10) !== day(0) || from > 23 * 60) return { date: day(1), from: '15:00', to: '17:00' };
  const hm = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  return { date: day(0), from: hm(from), to: hm(Math.min(from + 120, 23 * 60 + 55)) };
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-slc-data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = []; const watch = (p, who) => p.on('pageerror', (e) => errs.push(`${who}: ${e.message}`));
  const ctx = async (tok, vp = { width: 1300, height: 900 }, extra = {}) => { const c = await b.newContext({ viewport: vp, ...extra }); if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); return c; };
  try {
    const post = (url, body, tok) => fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) });
    const setupWith = async (token, extra = {}) => tokOf(await post('/api/auth/setup', { token, password: 'pilot-pass-123', ...extra }));
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const act = async (tok, fn, args) => { const r = await post('/api/action', { fn, args, rec: [] }, tok); const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; };
    const adminTok = await setupWith(srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await post('/api/admin/roster', { roster }, adminTok)).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const advisor = roster.teachers.find((t) => t.id === TID);
    const kids = roster.students.filter((s) => s.advisorId === TID);
    const aaron = kids.find((s) => s.id === AARON), other = kids.filter((s) => s.id !== AARON).sort((a, c) => a.name.localeCompare(c.name))[0];
    ok(advisor && aaron && kids.length === 23, `${advisor?.name} advises 8C (${kids.length}), with ${aaron?.name}`);
    const tTok = await setupWith(links[advisor.email]);
    const aTok = await setupWith(links[aaron.email]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'art'], 'classic'])).status === 200, 'Aaron is set up');
    await act(aTok, 'setIntensity', [AARON, 'simple']);
    const lanes = (await state(aTok)).students.find((s) => s.id === AARON).laneOrder;
    const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { cookie: `tp_session=${aTok}`, 'content-type': 'image/png', 'x-filename': 'bridge.png' }, body: PNG })).json();
    const m1 = (await act(aTok, 'addStation', [AARON, { title: 'Built a bridge out of straws', lineIds: [lanes[0]], date: day(-12), type: 'project', summary: 'It held two kilos.', visibility: 'advisor', evidence: [{ kind: 'image', url: up.url, caption: 'The bridge' }] }])).result;
    const m2 = (await act(aTok, 'addStation', [AARON, { title: 'Painted the class mural', lineIds: [lanes[1]], date: day(-6), type: 'project', visibility: 'advisor' }])).result;
    await act(aTok, 'addStation', [AARON, { title: 'My private diary', lineIds: [lanes[1]], date: day(-3), type: 'project', visibility: 'private' }]);
    const g = (await act(aTok, 'addGoal', [AARON, { title: 'Run 5k', date: day(30), lineId: lanes[0], summary: '', checkIn: false }])).result;
    ok(m1?.id && m2?.id && g?.id, 'Aaron has two moments (one with a photo), a private one and a goal');

    // ── Ms Altemen opens a round for 8C ──
    const D1 = firstDay();
    const cT = await ctx(tTok); const t = await cT.newPage(); watch(t, 'advisor');
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.cb-adv');
    await t.click('.cb-adv button:has-text("Open conference booking")');
    const form = t.locator('.cb-adv .cb-form');
    await form.locator('label:has-text("Title") input').fill('Student-led conferences');
    await form.locator('.cb-row').nth(0).locator('input[type=date]').fill(D1.date);
    await form.locator('.cb-row').nth(0).locator('label:has-text("From") input').fill(D1.from);
    await form.locator('.cb-row').nth(0).locator('label:has-text("To") input').fill(D1.to);
    await form.getByRole('textbox', { name: 'Room' }).fill('Room 8C');
    await t.click('.cb-form button[type=submit]:has-text("Open for 23 families")');
    const r = await until(async () => saved().confRounds?.[0]);
    ok(r && r.studentIds.length === 23 && r.days[0].date === D1.date, `a round for the 23 advisees on ${D1.date} ${D1.from}–${D1.to} (Bangkok)`);
    await t.waitForSelector('.slc-adv');
    ok(/Prepared: 0 of 23/.test(await t.locator('.slc-adv').innerText()), 'the round shows "Prepared: 0 of 23"');

    // ── Aaron gets ready at Simple, on a phone ──
    const cA = await ctx(aTok, { width: 390, height: 820 }, { hasTouch: true, isMobile: true }); const a = await cA.newPage(); watch(a, 'Aaron');
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.slc-card');
    const card = await a.locator('.slc-card').innerText();
    ok(/Get ready for my conference/.test(card) && /show your family/.test(card), `Aaron’s home: "${card.split('\n').slice(0, 2).join(' / ')}" (short and warm for Year 8)`);
    await audit(a, 'student: the conference card (Simple)');
    await a.click('.slc-card .primary:has-text("Get ready")'); await a.waitForSelector('.slc-flow'); await a.waitForTimeout(500); // the dialog fades in
    ok(/What do you want to show\?/.test(await a.locator('.slc-flow').innerText()), 'one question a screen: what do you want to show?');
    ok(await a.locator('.slc-flow .vc-said button').count() > 0, 'the question has a read-aloud button (src/voice.js)');
    const picks = await a.locator('.slc-flow .tr-pick').allInnerTexts();
    ok(picks.some((x) => /bridge/.test(x)) && picks.some((x) => /mural/.test(x)) && !picks.some((x) => /diary/.test(x)), 'his moments to pick, never the private one');
    await audit(a, 'student: prep, pick');
    await a.locator('.slc-flow .tr-pick', { hasText: 'bridge' }).click(); await a.locator('.slc-flow .tr-pick', { hasText: 'mural' }).click();
    await a.click('.slc-flow .sh-next .primary');
    ok(/What do you want to say about it\?/.test(await a.locator('.slc-flow').innerText()) && /bridge/.test(await a.locator('.slc-about').innerText()), 'then one screen for each moment');
    await a.locator('.slc-flow .sh-starters button', { hasText: 'This shows…' }).click();
    ok((await a.locator('.slc-flow textarea').inputValue()).startsWith('This shows'), 'a sentence starter goes into the box');
    await a.fill('.slc-flow textarea', 'This shows I can test an idea and fix it.');
    await audit(a, 'student: prep, a moment');
    await a.screenshot({ path: SH + 'prep-moment.png' });
    await a.click('.slc-flow .sh-next .primary'); // mural
    ok(/Skip/.test(await a.locator('.slc-flow .sh-next .primary').innerText()), 'nothing written: Skip');
    await a.click('.slc-flow .sh-next .primary');
    await a.fill('.slc-flow textarea', 'I am proud that I kept going when it fell down.'); await a.click('.slc-flow .sh-next .primary');
    await a.fill('.slc-flow textarea', 'It was hard when the glue would not dry.'); await a.click('.slc-flow .sh-next .primary');
    await a.locator('.slc-flow .slc-goals button', { hasText: 'Run 5k' }).click();
    await audit(a, 'student: prep, goal');
    await a.click('.slc-flow .sh-next .primary');
    const rev = await a.locator('.slc-flow .tr-review').innerText();
    ok(/bridge/.test(rev) && /test an idea/.test(rev) && /kept going/.test(rev) && /glue/.test(rev) && /Run 5k/.test(rev), 'review: his moments, words, proud, hard and goal');
    ok(await noScroll(a), 'no sideways scroll at phone width (prep)');
    await a.click('.slc-flow .primary:has-text("I am ready")');
    await a.waitForSelector('.slc-flow h2:has-text("Well done")');
    const prep = await until(async () => saved().confPreps?.find((x) => x.studentId === AARON && x.status === 'ready'));
    ok(prep && prep.picks.length === 2 && prep.picks[0] === m1.id && prep.says[m1.id] && prep.goal?.goalId === g.id && prep.proud && prep.hard, 'saved: ready, two moments, his words, proud, hard, his goal');
    await a.click('.slc-flow button:has-text("Close")');

    // ── The advisor: who has prepared, books his time, Conference mode from the booking list ──
    await t.reload(); await t.waitForSelector('.slc-adv');
    ok(/Prepared: 1 of 23/.test(await t.locator('.slc-adv').innerText()), 'the round shows "Prepared: 1 of 23"');
    await t.click('.slc-adv button:has-text("Who has prepared")');
    ok(/Ready/.test(await t.locator('.slc-who-list li', { hasText: aaron.name }).innerText()), 'and Aaron is ready');
    await audit(t, 'advisor: the round with who has prepared');
    const free = t.locator('.cb-grid .cb-slot.free').first();
    await free.locator('select').selectOption(AARON); await free.locator('button:has-text("Book")').click();
    const bk = await until(async () => saved().confBookings?.find((x) => x.studentId === AARON));
    ok(bk && bk.date === D1.date && bk.by === TID, `she books Aaron at ${bk?.time} on ${bk?.date}`);
    const slot = t.locator('.cb-grid .cb-slot.booked', { hasText: aaron.name });
    await slot.waitFor();
    ok(/Prepared/.test(await slot.innerText()), 'his booked time says "Prepared"');
    await slot.locator('button:has-text("Conference mode")').click(); await t.waitForSelector('.slc-mode');
    ok(/Hi, I’m Aaron!/.test(await t.locator('.slc-stage h1').innerText()), 'Conference mode opens warm for Year 8: "Hi, I’m Aaron!"');
    await audit(t, 'advisor: Conference mode, hello');
    await t.click('.slc-foot .primary');
    await t.waitForFunction(() => document.querySelector('.slc-moment img')?.complete);
    const m1s = await t.locator('.slc-stage').innerText();
    ok(/Built a bridge out of straws/.test(m1s) && /test an idea/.test(m1s) && /Moment 1 of 2/.test(m1s), 'one moment a screen: his title and his words');
    ok(await t.evaluate(() => document.querySelector('.slc-moment img').naturalWidth > 0), 'with its photo');
    const big = await t.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.slc-stage h1')).fontSize));
    ok(big >= 30, `large text (${big}px)`);
    await audit(t, 'advisor: Conference mode, a moment');
    await t.screenshot({ path: SH + 'mode-moment.png' });
    // Offline from here on.
    await cT.setOffline(true); await t.evaluate(() => dispatchEvent(new Event('offline')));
    await t.click('.slc-foot .primary'); // mural
    await t.click('.slc-foot .primary'); // looking back
    ok(/I am proud of/.test(await t.locator('.slc-stage').innerText()) && /glue/.test(await t.locator('.slc-stage').innerText()), 'proud and hard on one screen');
    await t.click('.slc-foot .primary');
    ok(/My goal/.test(await t.locator('.slc-stage').innerText()) && /Run 5k/.test(await t.locator('.slc-stage h1').innerText()), 'then the goal');
    ok(await t.locator('.slc-off').count() === 1, 'offline: it says it still works');
    await t.click('.slc-foot .ghost'); await t.click('.slc-foot .ghost'); await t.click('.slc-foot .ghost');
    ok(await t.evaluate(() => { const i = document.querySelector('.slc-moment img'); return !!i && i.complete && i.naturalWidth > 0 && i.src.startsWith('blob:'); }), 'offline, back on the first moment: the photo still shows (kept in memory)');
    for (let i = 0; i < 4; i++) await t.click('.slc-foot .primary');
    ok(/Our next steps/.test(await t.locator('.slc-stage h1').innerText()), 'the last screen: our next steps');
    await t.fill('#slc-staff', 'Aaron led the whole thing. Ask about robotics club.');
    await t.click('.slc-staff button:has-text("Save note")');
    await audit(t, 'advisor: Conference mode, next steps (offline)');
    await t.screenshot({ path: SH + 'mode-next.png' });
    ok(!(saved().notes?.[AARON] || []).length, 'offline: the staff note waits on the device');
    await cT.setOffline(false); await t.evaluate(() => dispatchEvent(new Event('online')));
    ok(await until(async () => (saved().notes?.[AARON] || []).some((n) => /robotics club/.test(n.text)), 15000), 'back online: the private staff note is saved with her advisor notes');
    await t.click('.slc-bar button[lang="th"]');
    ok(/โหมดการประชุม/.test(await t.locator('.slc-bar').innerText()) && /ก้าวต่อไปของเรา/.test(await t.locator('.slc-stage h1').innerText()), 'the ไทย switch shows Conference mode in Thai for the family');
    await t.click('.slc-bar button[lang="en"]');
    await t.click('.slc-bar button:has-text("Close")');

    // ── Aaron adds his line in his own Conference mode ──
    await a.reload(); await a.waitForSelector('.slc-card');
    await a.click('.slc-card button:has-text("Start my conference")'); await a.waitForSelector('.slc-mode');
    ok(await noScroll(a), 'Conference mode: no sideways scroll on a phone');
    for (let i = 0; i < 5; i++) await a.click('.slc-foot .primary');
    ok(/Our next steps/.test(await a.locator('.slc-stage h1').innerText()) && await a.locator('#slc-l-family').evaluate((x) => x.tagName) === 'P', 'his last screen: his own line to write, the family’s to read');
    await a.fill('#slc-l-student', 'Next I will enter the bridge contest.');
    await a.locator('.slc-line', { hasText: 'What I will do next' }).locator('button:has-text("Save")').click();
    const n1 = await until(async () => saved().confNotes?.find((x) => x.studentId === AARON)?.student);
    ok(n1 && n1.text === 'Next I will enter the bridge contest.' && n1.by === 'student', 'saved on his conference note, as Aaron');
    await audit(a, 'student: Conference mode, next steps');
    await a.click('.slc-foot .primary:has-text("Finish")');

    // ── Aaron's parent joins from a family letter, in Thai, and adds the family's line ──
    const lt = await (await post('/api/advisor/family/letters', { studentIds: [AARON, other.id] }, tTok)).json();
    const letter = (sid) => lt.letters.find((l) => l.studentId === sid).url;
    const cP = await ctx(null, { width: 390, height: 820 }, { hasTouch: true, isMobile: true }); const p = await cP.newPage(); watch(p, 'parent');
    await p.goto(letter(AARON).replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('#fj-h');
    await p.click('.auth-lang button[lang="th"]');
    await p.fill('input[autocomplete=name]', 'Torres Family'); await p.fill('input[type=email]', 'torres@family.example');
    await p.fill('input[autocomplete=new-password] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete=new-password] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type=submit]'); await p.waitForSelector('.slc-fam', { timeout: 15000 });
    const pTok = (await cP.cookies()).find((k) => k.name === 'tp_session').value;
    const fam = await p.locator('.slc-fam').innerText();
    ok(/หลังการประชุมของ Aaron/.test(fam) && /สิ่งที่เราจะลองทำที่บ้าน/.test(fam) && /bridge contest/.test(fam), 'the family card is in Thai, with Aaron’s line');
    await audit(p, 'family: after the conference (Thai, phone)');
    await p.click('.slc-fam button.primary');
    await p.fill('.slc-fam textarea', 'We will build something together on Saturdays.');
    await p.click('.slc-fam .primary:has-text("บันทึก")');
    const n2 = await until(async () => saved().confNotes?.find((x) => x.studentId === AARON)?.family);
    ok(n2 && n2.by === 'family' && /Saturdays/.test(n2.text), 'saved on the conference note, as the family');
    await p.waitForSelector('.slc-fam button:has-text("แก้ไขบรรทัดของเรา")');
    ok(await noScroll(p), 'no sideways scroll at phone width (family)');
    await p.screenshot({ path: SH + 'family.png', fullPage: true });
    const ps = await state(pTok);
    ok(ps.confNotes.length === 1 && !(ps.confPreps || []).length && !(ps.notes || {})[AARON], 'the family’s copy: the note, never his prep or the staff note');
    ok(saved().notifications.some((n) => n.to === `st:${AARON}` && n.text === 'Your family wrote on your conference note') && saved().notifications.some((n) => n.to === `t:${TID}` && /family wrote on the conference note/.test(n.text)), 'Aaron and his advisor are told in the app');
    const jq = await post('/api/family/join', { token: letter(other.id).split('/family/')[1], name: 'Second Family', email: 'second@family.example', password: 'family-pass-1' });
    const qTok = tokOf(jq), qs = await state(qTok);
    ok(!(qs.confNotes || []).length && !(qs.confPreps || []).length && !JSON.stringify(qs).includes('bridge contest'), 'another 8C family gets neither');
    ok((await act(qTok, 'writeConfNote', [r.id, AARON, 'family', 'x', 'family'])).status === 403, 'and cannot write on Aaron’s note (403)');
    ok((await act(aTok, 'writeConfNote', [r.id, AARON, 'family', 'x', 'student'])).status === 403, 'Aaron cannot write his family’s line (403)');

    // ── Everyone sees the note; the sheet carries his prep ──
    await a.reload(); await a.waitForSelector('.slc-note');
    const an = await a.locator('.slc-note').innerText();
    ok(/Saturdays/.test(an) && /bridge contest/.test(an), 'Aaron’s home: both lines on his conference note');
    await audit(a, 'student: my conference note');
    await t.goto(`${U}/#/me/student/${AARON}~sheet`); await t.waitForSelector('.cf-sheet .cf-prep');
    const sp = await t.locator('.cf-sheet .cf-prep').textContent();
    ok(/In Aaron’s words/.test(sp) && /bridge/.test(sp) && /kept going/.test(sp) && /glue/.test(sp) && /Run 5k/.test(sp), 'the conference sheet: his prep in his words');
    await t.emulateMedia({ media: 'print' });
    const pdf = await t.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH + 'sheet.pdf', pdf);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 1, `the sheet with his prep still prints on ${pages} A4 page`);
    await t.emulateMedia({ media: 'screen' });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally {
    await b.close(); srv?.p.kill();
  }
})().catch((e) => { console.error(e); srv?.p.kill(); process.exit(1); });
