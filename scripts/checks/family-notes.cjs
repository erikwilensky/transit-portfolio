// Family encouragement on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real
// roster. Aaron Torres (Year 8, Simple level, phone) adds two moments (one just for him); a parent joins through the family
// letter in Thai and leaves a note with a reaction on the shared one, changes it, and writes and deletes another; Aaron sees
// it big on his home and in his bell, says thank you (the parent's bell, in Thai), reads it in Thai, hides and shows it;
// Ms Jane Altemen reads it on his page and reports it, a coordinator hides it, the parent sees the notice; Aaron turns notes
// off on "Show my family"; a teacher with no link to Aaron gets nothing and is refused. Activity log and PDPA copy too.
// Each person has their own browser context. TP_ROSTER=/path/to/transit-roster.json. Screenshots: tp-fn-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-fn-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const STUDENT = 'Sabc0d6125e85', ADVISOR = 'T25948'; // Aaron Torres, Ms Jane Altemen
const TITLE = 'Science fair poster', SECRET = 'Diary page', SECOND = 'Football match';
const NOTE = 'เก่งมากลูก แม่ภูมิใจมาก';
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
async function audit(p, include, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate((inc) => window.axe.run({ include: inc }, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))), include);
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-fn-data-'));
  srv = await start(port, dataDir);
  const full = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), altemen = person(ADVISOR);
    const mine = new Set(roster.enrolments.filter((n) => n.studentId === STUDENT).map((n) => n.classId));
    const myTeachers = new Set(roster.classes.filter((c) => mine.has(c.id)).flatMap((c) => c.teacherIds));
    const coultas = roster.teachers.find((t) => t.id === 'T60198');
    const other = roster.teachers.find((t) => t.roles.length === 1 && t.roles[0] === 'teacher' && links[t.email] && !myTeachers.has(t.id) && t.id !== ADVISOR);
    const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && !t.roles.includes('leadership') && links[t.email] && !myTeachers.has(t.id) && t.id !== ADVISOR);
    ok(aaron?.advisorId === ADVISOR && myTeachers.has(coultas.id) && !!other && !!coord, `${aaron.name} (Year ${aaron.year}), advised by ${altemen.name}; unrelated teacher ${other?.name}; coordinator ${coord?.name}`);
    const sTok = await setupWith(U, links[aaron.email]), aTok = await setupWith(U, links[altemen.email]);
    const oTok = await setupWith(U, links[other.email]), cTok = await setupWith(U, links[coord.email]), tTok = await setupWith(U, links[coultas.email]);
    const ctx = async (tok, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } });
      if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
    };

    // ── Aaron, Simple level on a phone: two moments, one just for him ──
    const s = await ctx(sTok, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    for (const l of ['Science', 'Sport']) { const btn = s.locator('.ob-pick', { hasText: l }).first(); if (!(await btn.getAttribute('aria-pressed') === 'true')) await btn.click(); }
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    const addMoment = async (title, line) => {
      await s.click('.sh-card.add');
      await s.fill('.sh-flow .sh-input', title); await s.click('.sh-flow .sh-next .primary');
      await s.click(`.sh-flow .sh-lines button:has-text("${line}")`);
      await s.click('.sh-flow .sh-next .primary');
      const notNow = s.locator('.sh-flow .sh-notnow');
      if (await notNow.count()) await notNow.click();
      return until(async () => full().events.find((e) => e.studentId === STUDENT && e.title === title));
    };
    const ev = await addMoment(TITLE, 'Science'), ev2 = await addMoment(SECOND, 'Sport'), evP = await addMoment(SECRET, 'Science');
    ok((await act(sTok, 'setVisibility', [evP.id, 'private'])).status === 200, 'one moment made just for him');
    ok(ev.visibility === 'advisor' && ev2.visibility === 'advisor', 'the others are shared with his advisor and family (Year 8: the advisor level)');

    // ── A parent joins through the family letter, in Thai ──
    const lt = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: H(aTok), body: JSON.stringify({ studentIds: [STUDENT] }) })).json();
    const p = await ctx(null);
    await p.goto(lt.letters[0].url.replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('form.auth-card');
    await p.click('.auth-lang button[lang="th"]');
    await p.fill('input[autocomplete="name"]', 'Maria Torres'); await p.fill('input[type="email"]', 'maria.torres@family.example');
    await p.fill('input[autocomplete="new-password"] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete="new-password"] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type="submit"]');
    await p.waitForSelector('.page.family[lang="th"]'); await p.waitForTimeout(600);
    const pTok = (await p.context().cookies()).find((c) => c.name === 'tp_session').value;
    const me = (await (await fetch(`${U}/api/auth/me`, { headers: H(pTok) })).json()).user;
    const famText = await p.locator('.page.family').innerText();
    ok(famText.includes(TITLE) && !famText.includes(SECRET), 'the parent sees the shared moment, not the private one');
    ok(famText.includes('เปิดดูรายการใดก็ได้'), 'the family view says (in Thai) where notes go');
    await p.locator('.pv-intro li button', { hasText: TITLE }).click();
    await p.waitForSelector('.station-panel.open .fn-compose');
    const panel = p.locator('.station-panel.open .fn-on');
    ok((await panel.locator('h3').innerText()) === 'ข้อความจากครอบครัว' && await panel.locator('.fn-reacts button', { hasText: 'ภูมิใจในตัวลูกนะ' }).count() === 1, 'the note box is in Thai, with the reactions');
    await panel.locator('.fn-reacts button', { hasText: 'ภูมิใจในตัวลูกนะ' }).click();
    await panel.locator('textarea').fill(NOTE);
    ok((await panel.locator('.fn-count').innerText()).includes('280'), 'a character count to 280');
    await audit(p, ['.station-panel.open .fn-on'], 'family note box (Thai)');
    await p.screenshot({ path: SH + 'parent-compose.png' });
    await panel.locator('.fn-foot .primary').click();
    const n = await until(async () => (full().familyNotes || []).find((x) => x.eventId === ev.id));
    ok(n && n.by === `u:${me.id}` && n.name === 'Maria Torres' && n.text === NOTE && n.reaction === 'proud', 'the note is saved on the server, as her own account');
    await p.waitForSelector('.station-panel.open .fn-note');
    ok(await p.locator('.station-panel.open .fn-compose').count() === 0, 'one note each: the box gives way to her note with Change and Delete');
    // Change it.
    await p.click('.station-panel.open .fn-note .fn-acts .ghost');
    await p.locator('.station-panel.open .fn-note textarea').fill(`${NOTE} เล่าให้ฟังตอนกินข้าวนะ`);
    await p.click('.station-panel.open .fn-note .fn-foot .primary');
    ok(await until(async () => full().familyNotes.find((x) => x.id === n.id)?.edited), 'she changed it');
    // Another on the second moment, then deleted.
    await p.click('.station-panel.open .panel-close');
    await p.locator('.pv-intro li button', { hasText: SECOND }).click();
    await p.waitForSelector('.station-panel.open .fn-compose');
    await p.locator('.station-panel.open .fn-reacts button', { hasText: 'สู้ต่อไปนะ' }).click();
    await p.click('.station-panel.open .fn-foot .primary');
    const n2 = await until(async () => full().familyNotes.find((x) => x.eventId === ev2.id));
    await p.waitForSelector('.station-panel.open .fn-note .linkish');
    await p.click('.station-panel.open .fn-note .linkish');
    ok(await until(async () => !full().familyNotes.some((x) => x.id === n2?.id)), 'a reaction-only note on the match, then deleted');
    ok((await act(pTok, 'addFamilyNote', [evP.id, { key: `u:${me.id}`, name: me.name }, 'hi', null])).status === 403, 'not on the private moment (403)');
    ok((await act(pTok, 'editFamilyNote', [n.id, 'u:someone', 'x', null])).status === 403, 'not as someone else (403)');

    // ── Aaron: the bell, big on his home, "Say thank you" ──
    const toAaron = full().notifications.find((x) => x.to === `st:${STUDENT}` && x.kind === 'encourage' && x.go?.param === ev.id);
    ok(toAaron?.text.startsWith(`Maria Torres sent you encouragement for “${TITLE}”`) && toAaron.go.param === ev.id, 'Aaron is notified (kind encourage), linked to the moment');
    await s.reload(); await s.waitForSelector('.fn-home');
    const home = await s.locator('.fn-home').innerText();
    ok(home.includes('From your family') && home.includes('Proud of you') && home.includes(NOTE) && home.includes('From Maria Torres'), 'his home: "From your family", the reaction, the note and who wrote it');
    ok(await s.locator('.fn-home .fn-list.big').count() === 1 && (await s.locator('.fn-home .fn-acts .primary').boundingBox()).height >= 44, 'big cards, a big "Say thank you"');
    await audit(s, ['.fn-home'], 'Simple home: from your family');
    await s.screenshot({ path: SH + 'student-home.png', fullPage: true });
    await s.click('button.bell'); await s.waitForSelector('.bell-menu');
    ok((await s.locator('.bell-menu').innerText()).includes('Maria Torres sent you encouragement'), 'and in his bell');
    await s.click('button.bell');
    await s.click('.fn-home .fn-acts .primary');
    ok(await until(async () => full().familyNotes.find((x) => x.id === n.id)?.thanked), 'he said thank you');
    await p.reload(); await p.waitForSelector('.page.family');
    await p.click('button.bell'); await p.waitForSelector('.bell-menu');
    const pb = await p.locator('.bell-menu').innerText();
    ok(pb.includes(`Aaron ขอบคุณสำหรับข้อความของคุณในเรื่อง “${TITLE}”`), `the parent's bell, in Thai: "Aaron ขอบคุณ…"${pb.includes('ขอบคุณ') ? '' : ` (${pb.slice(0, 200)})`}`);
    await p.click('button.bell');
    // In Thai.
    await fetch(`${U}/api/auth/prefs`, { method: 'POST', headers: H(sTok), body: JSON.stringify({ lang: 'th' }) });
    await s.reload(); await s.waitForSelector('.fn-home'); await s.waitForTimeout(500);
    const homeTh = await s.locator('.fn-home').innerText();
    ok(homeTh.includes('จากครอบครัวของคุณ') && homeTh.includes('ภูมิใจในตัวลูกนะ') && homeTh.includes('คุณขอบคุณแล้ว') && homeTh.includes('จาก Maria Torres') && homeTh.includes(NOTE), 'in Thai: heading, reaction and "thanked"; the note in her own words');
    ok(!/\b(From your family|Proud of you|Say thank you|Open the moment|Hide|Report)\b/.test(homeTh), `no English UI left on the card${/[A-Za-z]{4,}/.test(homeTh.replace(/Maria Torres|Science fair poster/g, '')) ? `: ${homeTh}` : ''}`);
    await audit(s, ['.fn-home'], 'Simple home card in Thai');
    await s.screenshot({ path: SH + 'student-home-th.png', fullPage: true });
    await fetch(`${U}/api/auth/prefs`, { method: 'POST', headers: H(sTok), body: JSON.stringify({ lang: 'en' }) });
    await s.reload(); await s.waitForSelector('.fn-home');
    // Hide it from his own view, then show it again from the moment.
    await s.click('.fn-home .fn-acts button:has-text("Hide")');
    ok(await until(async () => full().familyNotes.find((x) => x.id === n.id)?.studentHidden), 'he hid it from his view');
    await s.waitForSelector('.fn-home', { state: 'detached' });
    ok(!('studentHidden' in ((await state(pTok)).familyNotes.find((x) => x.id === n.id) || {})), 'his family is not told');
    await s.locator('.sh-feed li', { hasText: TITLE }).locator('button').first().click();
    await s.waitForSelector('.sh-moment .fn-on');
    await s.click('.sh-moment .fn-more'); await s.click('.sh-moment .fn-acts button:has-text("Show again")');
    ok(await until(async () => !full().familyNotes.find((x) => x.id === n.id)?.studentHidden), 'and showed it again from the moment');
    await s.click('.sh-moment .panel-close');
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');

    // ── Ms Altemen reads it on his page and reports it; a coordinator hides it ──
    const a = await ctx(aTok);
    await a.goto(`${U}/#/me/student/${STUDENT}~${ev.id}`); await a.waitForSelector('.station-panel.open .fn-on');
    const at = await a.locator('.station-panel.open .fn-on').innerText();
    ok(at.includes('Maria Torres (family)') && at.includes(NOTE) && at.includes('thanked'), `${altemen.name} reads the note on his page`);
    await a.waitForTimeout(700); // the panel slides in
    await audit(a, ['.station-panel.open .fn-on'], 'advisor: notes from family');
    await a.click('.station-panel.open .fn-on .sg-report');
    await a.click('.sg-dialog .sg-reasons button:has-text("Something else")');
    await a.click('.sg-dialog .primary');
    const rep = await until(async () => (full().reports || []).find((r) => r.familyNoteId === n.id));
    ok(rep?.from?.key === ADVISOR && rep.kind === 'familyNote', 'she reported it (safeguarding report on the note)');
    await a.screenshot({ path: SH + 'advisor.png' });
    ok((await act(tTok, 'reportItem', [{ familyNoteId: n.id }, 'other', '', { key: coultas.id }])).status === 200, `${coultas.name}, his science teacher, can report it too`);
    const c = await ctx(cTok);
    await c.goto(`${U}/#/me/reports`); await c.waitForSelector(`#rp-${rep.id}`);
    const card = c.locator(`#rp-${rep.id}`);
    const ct = await card.innerText();
    ok(/a note from family \(maria torres\)/i.test(ct) && ct.includes(NOTE), `Reports shows the note and who wrote it${/maria/i.test(ct) ? '' : `: ${ct}`}`);
    await card.locator('button:has-text("Hide it from the student")').click();
    ok(await until(async () => !!full().familyNotes.find((x) => x.id === n.id)?.hidden), 'the coordinator hid it');
    ok(!(await state(sTok)).familyNotes.some((x) => x.id === n.id), 'gone from Aaron’s copy');
    await p.reload(); await p.waitForSelector('.page.family');
    await p.locator('.pv-intro li button', { hasText: TITLE }).click();
    await p.waitForSelector('.station-panel.open .fn-note .sg-hidden');
    ok((await p.locator('.station-panel.open .fn-note .sg-hidden').innerText()).includes('ครูกำลังตรวจดูข้อความนี้'), 'the parent sees the notice, in Thai');
    await p.screenshot({ path: SH + 'parent-hidden.png' });
    await c.click('.sg-tabs button:has-text("Done")');
    await c.locator(`#rp-${rep.id} button:has-text("Show it again")`).click();
    ok(await until(async () => !full().familyNotes.find((x) => x.id === n.id)?.hidden), 'shown again');

    // ── A teacher with no link to Aaron: nothing, and refused ──
    const os_ = await state(oTok);
    ok(!(os_.familyNotes || []).length && !os_.students.some((x) => x.id === STUDENT), `${other.name} receives no notes and not Aaron`);
    ok((await act(oTok, 'reportItem', [{ familyNoteId: n.id }, 'other', '', { key: other.id }])).status === 403, 'and cannot report the note (403)');
    const o = await ctx(oTok);
    await o.goto(`${U}/#/me/student/${STUDENT}~${ev.id}`); await o.waitForTimeout(1200);
    ok(!(await o.locator('body').innerText()).includes(NOTE), 'his screens never show it');
    ok((await act(oTok, 'addFamilyNote', [ev.id, { key: `u:x`, name: other.name }, 'x', null])).status === 403 && (await act(adminTok, 'addFamilyNote', [ev.id, { key: 'u:x', name: 'Pat Admin' }, 'x', null])).status === 403, 'staff and admins cannot write as a family (403)');

    // ── Aaron turns notes off on "Show my family" ──
    await s.goto(`${U}/#/me/family`); await s.waitForSelector('.sh-fam-notes input');
    await audit(s, ['.sh-fam-notes'], 'Show my family: the switch');
    await s.locator('.sh-fam-notes input').uncheck();
    ok(await until(async () => full().privacy?.[STUDENT]?.familyNotes === false), 'he turned notes from family off');
    ok((await act(pTok, 'addFamilyNote', [ev2.id, { key: `u:${me.id}`, name: me.name }, 'hi', null])).status === 403, 'the family can no longer write (403)');
    await p.reload(); await p.waitForSelector('.page.family');
    ok((await p.locator('.page.family').innerText()).includes('Aaron ปิดรับข้อความจากครอบครัวไว้ชั่วคราว'), 'the family view says so, in Thai');
    await s.locator('.sh-fam-notes input').check();
    ok(await until(async () => full().privacy?.[STUDENT]?.familyNotes === true), 'and on again');

    // ── Activity log and PDPA copy ──
    const log = await (await fetch(`${U}/api/audit?student=${STUDENT}&size=200`, { headers: H(adminTok) })).json();
    const fns = new Set(log.entries.filter((x) => x.action === 'change').map((x) => x.fn));
    ok(['addFamilyNote', 'editFamilyNote', 'deleteFamilyNote', 'thankFamilyNote', 'setFamilyNoteHidden'].every((f) => fns.has(f)), 'the activity log has each change, with Aaron as the student');
    ok(!JSON.stringify(log).includes(NOTE.slice(0, 6)), 'never the note’s words');
    const zip = Buffer.from(await (await fetch(`${U}/api/me/export?student=${STUDENT}`, { headers: H(pTok) })).arrayBuffer());
    ok(zip.includes('familyNotes.json') && zip.includes(Buffer.from(NOTE)), 'the family’s PDPA copy includes familyNotes.json');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
