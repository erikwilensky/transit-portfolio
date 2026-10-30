// Conference booking on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and
// imports the real roster. Ms Jane Altemen (T25948) opens conference booking for Advisory 8C on My advisory. A parent
// joins from Aaron Torres's family letter on a phone, in Thai, and books a time. A second 8C family (another letter) sees
// that time taken with no name, and cannot book it. Aaron sees when his conference is. The advisor sees the day grid,
// blocks a time, books for a third family, and prints the day's schedule (one A4 page, names and conference sheet links;
// a link opens that student's sheet). axe over every new screen. Each account has its own browser context.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots and a PDF: tp-confbook-* in SCRATCH or tmp.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-confbook-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const TID = 'T25948', AARON = 'Sabc0d6125e85';
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

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-confbook-data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = []; const watch = (p, who) => p.on('pageerror', (e) => errs.push(`${who}: ${e.message}`));
  const ctx = async (tok, vp = { width: 1300, height: 900 }, extra = {}) => { const c = await b.newContext({ viewport: vp, ...extra }); if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); return c; };
  try {
    const post = (url, body, tok) => fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) });
    const setupWith = async (token, extra = {}) => tokOf(await post('/api/auth/setup', { token, password: 'pilot-pass-123', ...extra }));
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const act = (tok, fn, args) => post('/api/action', { fn, args, rec: [] }, tok);
    const adminTok = await setupWith(srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await post('/api/admin/roster', { roster }, adminTok)).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const advisor = roster.teachers.find((t) => t.id === TID);
    const kids = roster.students.filter((s) => s.advisorId === TID).sort((a, c) => a.name.localeCompare(c.name));
    const aaron = kids.find((s) => s.id === AARON), other = kids.find((s) => s.id !== AARON), third = kids.filter((s) => s.id !== AARON)[1];
    ok(advisor && aaron && kids.length === 23 && kids.every((s) => s.homeroom === '8C'), `${advisor?.name} advises 8C (${kids.length}): ${aaron?.name}, ${other?.name}, ${third?.name}`);
    const tTok = await setupWith(links[advisor.email]);
    const aTok = await setupWith(links[aaron.email]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'art'], 'classic'])).ok, 'Aaron is set up');

    // ── Ms Altemen opens booking on My advisory ──
    const day = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10); // Bangkok dates
    const D1 = day(3), D2 = day(4);
    const cT = await ctx(tTok); const t = await cT.newPage(); watch(t, 'advisor');
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.cb-adv');
    await t.click('.cb-adv button:has-text("Open conference booking")');
    const form = t.locator('.cb-adv .cb-form');
    await form.locator('label:has-text("Title") input').fill('Term 1 family conferences');
    await form.locator('label:has-text("Each conference") select').selectOption('15');
    await form.locator('.cb-row').nth(0).locator('input[type=date]').fill(D1);
    await form.locator('.cb-row').nth(0).locator('label:has-text("From") input').fill('15:00');
    await form.locator('.cb-row').nth(0).locator('label:has-text("To") input').fill('17:00');
    await form.locator('button:has-text("Add a day")').click();
    await form.locator('.cb-row').nth(1).locator('input[type=date]').fill(D2);
    await form.locator('button:has-text("Add a break")').click();
    await form.locator('fieldset:has-text("Breaks") label:has-text("From") input').fill('16:00');
    await form.locator('fieldset:has-text("Breaks") label:has-text("To") input').fill('16:15');
    await form.getByRole('textbox', { name: 'Room' }).fill('Room 8C');
    await audit(t, 'advisor: the round form');
    await t.click('.cb-form button[type=submit]:has-text("Open for 23 families")');
    const r = await until(async () => saved().confRounds?.[0]);
    ok(r && r.studentIds.length === 23 && r.advisorId === TID && r.by === TID && r.slot === 15 && r.days.length === 2 && r.breaks[0]?.from === '16:00' && r.location === 'Room 8C', 'saved: a round for the 23 advisees, two days, a break, Room 8C');
    ok(saved().notifications.filter((n) => /opened conference booking/.test(n.text) && n.to.startsWith('fam:')).length === 23, 'each family is told in the app');
    await t.waitForSelector('.cb-count');
    ok((await t.locator('.cb-count').innerText()) === 'Booked: 0 of 23', 'advisory: "Booked: 0 of 23"');
    ok(await t.locator('.cb-grid .cb-slot').count() === 7, 'day grid: 15:00 to 17:00 in 15 minutes, less the break: 7 times');

    // ── Family letters: Aaron's parent joins on a phone, in Thai ──
    const lt = await (await post('/api/advisor/family/letters', { studentIds: [AARON, other.id, third.id] }, tTok)).json();
    const letter = (sid) => lt.letters.find((l) => l.studentId === sid).url;
    const cP = await ctx(null, { width: 390, height: 820 }, { hasTouch: true, isMobile: true }); const p = await cP.newPage(); watch(p, 'parent A');
    await p.goto(letter(AARON).replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('#fj-h');
    await p.click('.auth-lang button[lang="th"]');
    await p.fill('input[autocomplete=name]', 'Torres Family'); await p.fill('input[type=email]', 'torres@family.example');
    await p.fill('input[autocomplete=new-password] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete=new-password] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type=submit]'); await p.waitForSelector('.cb-fam', { timeout: 15000 });
    const pTok = (await cP.cookies()).find((k) => k.name === 'tp_session').value;
    const card = await p.locator('.cb-fam').innerText();
    ok(/จองเวลาประชุมผู้ปกครอง/.test(card) && /เลือกเวลาสำหรับ Aaron/.test(card) && /เวลาประเทศไทย/.test(card) && /15 นาที/.test(card), 'the family card is in Thai: book, pick a time for Aaron, Bangkok time, 15 minutes');
    ok(await noScroll(p), 'no sideways scroll at phone width (family card)');
    await audit(p, 'family: the booking card (Thai, phone)');
    await p.screenshot({ path: SH + 'family-pick.png', fullPage: true });
    await p.locator('.cb-day').first().locator('button.cb-t', { hasText: '15:30' }).click();
    const bk = await until(async () => saved().confBookings?.find((x) => x.studentId === AARON));
    ok(bk && bk.date === D1 && bk.time === '15:30' && bk.by === 'family' && bk.advisorId === TID, `booked on the server: Aaron, ${bk?.date} 15:30, by the family`);
    await p.waitForSelector('.cb-mine');
    ok(/จองแล้ว/.test(await p.locator('.cb-mine').innerText()) && /15:30 น\./.test(await p.locator('.cb-mine').innerText()), 'the card shows the booking, in Thai with Bangkok time');
    ok(await p.locator('.cb-mine button', { hasText: 'เปลี่ยนเวลา' }).count() === 1 && await p.locator('.cb-mine button', { hasText: 'ยกเลิกการจอง' }).count() === 1, 'change and cancel are offered (more than 24 hours ahead)');
    await p.screenshot({ path: SH + 'family-booked.png', fullPage: true });
    ok(saved().notifications.some((n) => n.to === `t:${TID}` && n.text.startsWith(`${aaron.name}’s family booked a conference:`)), 'the advisor is told in the app');

    // ── A second 8C family: Aaron's time is taken, with no name ──
    const j = await post('/api/family/join', { token: letter(other.id).split('/family/')[1], name: 'Second Family', email: 'second@family.example', password: 'family-pass-1' });
    const qTok = tokOf(j);
    const qs = await state(qTok);
    ok(qs.confBookings.length === 1 && qs.confBookings[0].taken && !('studentId' in qs.confBookings[0]) && !JSON.stringify(qs).includes(AARON) && !JSON.stringify(qs).includes('Torres'), 'their copy: one taken time, no student, no name');
    const cQ = await ctx(qTok); const q = await cQ.newPage(); watch(q, 'parent B');
    await q.goto(`${U}/#/me/family`); await q.waitForSelector('.cb-fam');
    const slot = q.locator('.cb-day').first().locator('.cb-times li', { hasText: '15:30' });
    ok(/Taken/.test(await slot.innerText()) && await slot.locator('button').count() === 0, 'the second family sees 15:30 as "Taken", not bookable');
    ok(!/Aaron|Torres/.test(await q.locator('main').innerText()), 'and never Aaron’s name');
    const dbl = await act(qTok, 'bookConference', [r.id, other.id, { date: D1, time: '15:30' }, 'family']);
    ok(dbl.status === 409 && /just taken/.test((await dbl.json()).error), 'booking it anyway is refused (409)');
    ok((await act(qTok, 'bookConference', [r.id, AARON, { date: D1, time: '15:45' }, 'family'])).status === 403, 'and nobody books for another family’s child (403)');
    await audit(q, 'family: the booking card (English)');
    await q.locator('.cb-day').first().locator('button.cb-t', { hasText: '15:00' }).click();
    ok(await until(async () => saved().confBookings?.some((x) => x.studentId === other.id && x.time === '15:00')), 'the second family books 15:00');

    // ── Aaron sees when his conference is ──
    const cA = await ctx(aTok, { width: 390, height: 820 }, { hasTouch: true, isMobile: true }); const a = await cA.newPage(); watch(a, 'Aaron');
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.cb-student');
    const ac = await a.locator('.cb-student').innerText();
    ok(/Your conference/.test(ac) && /15:30/.test(ac) && /Ms Altemen/.test(ac) && /Room 8C/.test(ac), `Aaron's home: "${ac.replace(/\s+/g, ' ').trim()}"`);
    ok(saved().notifications.some((n) => n.to === `st:${AARON}` && /^Your conference with Ms Altemen is on/.test(n.text)), 'and was told in the app');
    await audit(a, 'student: your conference');
    await a.screenshot({ path: SH + 'student.png' });

    // ── The advisor: day grid, block, book for a family, print ──
    await t.reload(); await t.waitForSelector('.cb-grid');
    const g = t.locator('.cb-grid');
    const at = (hm) => g.locator('.cb-slot').filter({ has: t.locator('.cb-time', { hasText: new RegExp(`^${hm}`) }) });
    ok(/Aaron Torres/.test(await at('15:30').innerText()) && /Booked by the family/.test(await at('15:30').innerText()), 'day grid: Aaron at 15:30, booked by the family');
    await at('16:15').locator('button:has-text("Block")').click();
    ok(await until(async () => saved().confBlocks?.some((k) => k.time === '16:15' && k.date === D1)), 'she blocks 16:15');
    const s1645 = at('16:45');
    await s1645.locator('select').selectOption(third.id);
    await s1645.locator('button:has-text("Book")').click();
    const tb = await until(async () => saved().confBookings?.find((x) => x.studentId === third.id));
    ok(tb && tb.time === '16:45' && tb.by === TID, `she books 16:45 for ${third.name}’s family`);
    ok(saved().notifications.some((n) => n.to === `fam:${third.id}` && /^Ms Altemen booked .*’s conference:/.test(n.text)), 'that family is told');
    await t.waitForSelector('.cb-legend:has-text("3 booked")');
    ok(/3 booked/.test(await t.locator('.cb-legend').innerText()) && /1 blocked/.test(await t.locator('.cb-legend').innerText()), 'the legend: 3 booked, 1 blocked');
    ok((await t.locator('.cb-count').innerText()) === 'Booked: 3 of 23', '"Booked: 3 of 23"');
    await audit(t, 'advisor: the day grid');
    await t.screenshot({ path: SH + 'advisor-grid.png', fullPage: true });
    const qs2 = await state(qTok);
    ok(qs2.confBlocks.length === 1 && qs2.confBlocks[0].taken && !('by' in qs2.confBlocks[0]) && qs2.confBookings.filter((x) => x.taken).length === 2, 'the second family: the block and the others’ bookings, only as taken times');

    await t.click('button:has-text("Print the day’s schedule")');
    await t.waitForSelector('.cbp-sheet');
    const sheet = await t.locator('.cbp-sheet').innerText();
    ok(sheet.includes('Term 1 family conferences') && sheet.includes(advisor.name) && sheet.includes('Bangkok time') && sheet.includes('Room 8C'), 'schedule: title, advisor, Bangkok time, room');
    ok(sheet.includes(aaron.name) && sheet.includes(other.name) && sheet.includes(third.name) && /Blocked/.test(sheet), 'schedule: the three students and the blocked time');
    const href = await t.locator('.cbp-table tr', { hasText: aaron.name }).locator('a').getAttribute('href');
    ok(href.endsWith(`#/me/student/${AARON}~sheet`), `each student has their conference sheet link (${href.replace(/^https?:\/\/[^#]+/, '')})`);
    await audit(t, 'advisor: the day schedule');
    await t.emulateMedia({ media: 'print' });
    const pdf = await t.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH + 'schedule.pdf', pdf);
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 1, `the day's schedule prints on ${pages} A4 page`);
    await t.emulateMedia({ media: 'screen' });
    await t.screenshot({ path: SH + 'schedule.png', fullPage: true });
    await t.click('.cbp-bar button:has-text("Close")');
    await t.goto(href.replace(/^https?:\/\/[^#]+/, `${U}/`)); await t.waitForSelector('.cf-overlay');
    ok((await t.locator('.cf-overlay').innerText()).includes(aaron.name), 'the link opens Aaron’s conference sheet');

    // ── The family changes the time; refused clashes and passing times are the server test's ──
    await p.reload(); await p.waitForSelector('.cb-mine');
    await p.click('.cb-mine button:has-text("เปลี่ยนเวลา")');
    await p.locator('.cb-day').nth(1).locator('button.cb-t', { hasText: '15:15' }).click();
    ok(await until(async () => saved().confBookings?.find((x) => x.studentId === AARON)?.date === D2), 'Aaron’s family moves to the second day, 15:15');
    ok(saved().confBookings.filter((x) => x.studentId === AARON).length === 1, 'still one booking for Aaron');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally {
    await b.close(); srv?.p.kill();
  }
})().catch((e) => { console.error(e); srv?.p.kill(); process.exit(1); });
