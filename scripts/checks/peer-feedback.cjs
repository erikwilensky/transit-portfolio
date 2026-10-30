// Kind feedback from classmates on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build`
// first) and imports the real roster. Two Year 9+ students who share a class are picked from the file: the owner adds a
// moment with a photo and opts it in from the station panel; the classmate finds it under "From your classes", picks two
// phrases and sends; the owner reads it (first name only) and says thank you. A Year 9+ student in none of the owner's
// classes, and Aaron Torres (Year 8), see nothing; the class teacher sees it on the class page; the owner reports it and
// a coordinator hides it from Reports. Every account has its own browser context.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-peer-';
const AARON = 'Sabc0d6125e85';
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
    const email = new Map([...roster.students, ...roster.teachers].map((x) => [x.id, x.email]));
    const rec = await state(adminTok);
    const grade = new Map(rec.students.map((s) => [s.id, s.grade]));
    const classesOf = (sid) => new Set(rec.enrolments.filter((n) => n.studentId === sid && !n.to).map((n) => n.classId));
    // A Year 9+ class with a teacher who has an account, and two of its students.
    const plain = (t) => links[email.get(t)] && roster.teachers.find((x) => x.id === t)?.roles.every((r) => r === 'teacher' || r === 'advisor');
    const cls = roster.classes.find((c) => c.year >= 9 && c.teacherIds?.some(plain) && rec.enrolments.filter((n) => n.classId === c.id).length >= 4);
    const kids = rec.enrolments.filter((n) => n.classId === cls.id && !n.to).map((n) => n.studentId).filter((id) => grade.get(id) >= 8 && links[email.get(id)]).sort();
    const [A, B] = kids.map((id) => rec.students.find((s) => s.id === id));
    const mineA = classesOf(A.id);
    const C = rec.students.find((s) => s.grade >= 8 && links[email.get(s.id)] && ![...classesOf(s.id)].some((c) => mineA.has(c)));
    const tid = cls.teacherIds.find(plain);
    const teacher = roster.teachers.find((t) => t.id === tid);
    const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && links[t.email]);
    const aaron = rec.students.find((s) => s.id === AARON);
    ok(!!(A && B && C && teacher && coord) && aaron?.grade === 7, `picked ${cls.name}: ${A?.name} (Year ${A?.grade + 1}) and ${B?.name}; outsider ${C?.name}; teacher ${teacher?.name}; coordinator ${coord?.name}; ${aaron?.name} is Year ${aaron?.grade + 1}`);
    const first = (s) => s.name.split(' ')[0];

    const tok = {};
    for (const [k, s] of [['A', A], ['B', B], ['C', C], ['aaron', aaron]]) {
      tok[k] = await setupWith(U, links[email.get(s.id)]);
      ok((await act(tok[k], 'completeOnboarding', [s.id, ['science'], 'classic'])).ok && (await act(tok[k], 'setIntensity', [s.id, 'standard'])).ok, `${s.name} is set up at Standard`);
    }
    tok.T = await setupWith(U, links[teacher.email]);
    tok.co = await setupWith(U, links[coord.email]);
    const ctx = async (k, w = 1280) => { const c = await b.newContext({ viewport: { width: w, height: 860 } }); await c.addCookies([{ name: 'tp_session', value: tok[k], url: U }]); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); return { p, errs }; };

    // ── The owner adds a moment with a photo (school can see it) and opts it in from the station panel ──
    const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { cookie: `tp_session=${tok.A}`, 'content-type': 'image/png', 'x-filename': 'poster.png' }, body: PNG })).json();
    const added = await (await act(tok.A, 'addStation', [A.id, { title: 'Our group poster', lineIds: ['science'], visibility: 'school', summary: 'We made a poster about rivers.', image: up.url.replace(/^\//, '') }])).json();
    const ev = added.result;
    ok(ev?.id && ev.evidence[0]?.url.includes(up.url.slice(1)), `${first(A)} added “Our group poster” with a photo`);
    const priv = (await (await act(tok.A, 'addStation', [A.id, { title: 'My diary', lineIds: ['science'], visibility: 'private' }])).json()).result;
    const a = await ctx('A');
    await a.p.goto(`${U}/#/me/map/${ev.id}`); await a.p.waitForSelector('.station-panel.open .pf-on');
    ok((await a.p.locator('.pf-on').innerText()).includes('Let classmates in my classes give kind feedback'), 'the station panel offers "Let classmates in my classes give kind feedback"');
    await a.p.locator('.pf-switch input').check();
    ok(await until(async () => saved().events.find((e) => e.id === ev.id)?.peerFeedback === true), 'opted in: saved on the server');
    await a.p.screenshot({ path: SH + 'owner-optin.png' });
    await a.p.goto(`${U}/#/me/map/${priv.id}`); await a.p.waitForSelector('.station-panel.open .pf-on');
    ok(await a.p.locator('.pf-switch input').isDisabled() && (await a.p.locator('.pf-on').innerText()).includes('Only for moments the school can see'), 'a private moment cannot be opted in');
    ok((await act(tok.B, 'setPeerFeedback', [ev.id, false])).status === 403, 'a classmate cannot change the owner’s switch');

    // ── The classmate: "From your classes", two phrases, send ──
    const bb = await ctx('B', 390);
    await bb.p.goto(`${U}/#/me/map`); await bb.p.waitForSelector('.pf-classes');
    const row = bb.p.locator('.pf-moment', { hasText: 'Our group poster' });
    ok((await row.innerText()).includes(`${first(A)} · ${cls.name}`), `"From your classes" shows the moment with ${first(A)} and the class`);
    ok(!(await bb.p.locator('.pf-classes').innerText()).includes('We made a poster'), 'only the title and photo, not the summary');
    ok(await until(() => row.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0)), 'the photo opens for the classmate');
    ok(await bb.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await row.locator('button').click(); await bb.p.waitForSelector('.pf-dialog');
    await bb.p.click('.pf-phrases button:has-text("I liked how")');
    await bb.p.click('.pf-phrases button:has-text("You could try")');
    ok(await bb.p.locator('.pf-phrases button:disabled').count() === 2, 'two phrases at most');
    await bb.p.fill('.pf-finish:has-text("I liked how") input', 'you drew the river in layers.');
    await bb.p.fill('.pf-finish:has-text("You could try") input', 'adding a key.');
    await bb.p.screenshot({ path: SH + 'give.png' });
    await bb.p.click('.pf-dialog .cp-foot .primary');
    const fb = await until(async () => (saved().peerFeedback || []).find((f) => f.eventId === ev.id));
    ok(fb && fb.fromId === B.id && fb.studentId === A.id && fb.classId && fb.parts.map((p) => p.phrase).join() === 'liked,try', 'saved: from the classmate, in a shared class, two phrases');
    ok(saved().notifications.some((n) => n.to === `st:${A.id}` && n.text.startsWith(`${first(B)} gave you kind feedback`)), `${first(A)} is told`);
    ok((await act(tok.T, 'givePeerFeedback', [ev.id, B.id, [{ phrase: 'liked', text: 'staff writing' }]])).status === 403, 'the teacher cannot write as a student');
    ok((await act(adminTok, 'givePeerFeedback', [ev.id, B.id, [{ phrase: 'liked', text: 'admin writing' }]])).status === 403, 'nor can the admin');
    ok(!bb.errs.length, `no page errors for the classmate${bb.errs.length ? `: ${bb.errs.join(' | ')}` : ''}`);

    // ── The owner reads it with the first name only, and says thank you ──
    const ownCopy = await state(tok.A);
    ok(ownCopy.peerFeedback.length === 1 && !('fromId' in ownCopy.peerFeedback[0]) && ownCopy.peerFeedback[0].fromName === first(B), 'the owner’s copy: the classmate’s first name, no id');
    await a.p.goto(`${U}/#/me/map/${ev.id}`); await a.p.waitForSelector('.pf-list li');
    const item = await a.p.locator('.pf-list li').innerText();
    ok(item.includes(first(B)) && !item.includes(B.name.split(' ').slice(1).join(' ')) && item.includes('I liked how you drew the river in layers.') && item.includes('You could try adding a key.'), `the owner reads “${first(B)}” and the two sentences`);
    await a.p.click('.pf-list button:has-text("Say thank you")');
    ok(await until(async () => !!saved().peerFeedback.find((f) => f.id === fb.id).thanked), 'thanked: saved');
    ok(saved().notifications.some((n) => n.to === `st:${B.id}` && n.text.startsWith(`${first(A)} said thank you`)), `${first(B)} hears the thank you`);
    await a.p.screenshot({ path: SH + 'owner-thanks.png' });
    await bb.p.reload(); await bb.p.waitForSelector('.pf-mine');
    ok((await bb.p.locator('.pf-mine').innerText()).includes(`${first(A)} said thank you`), 'the classmate sees the thank you');

    // ── An outsider and Aaron (Year 8) see nothing ──
    const cCopy = await state(tok.C);
    ok(!cCopy.peerMoments.length && !cCopy.peerFeedback.length && !cCopy.events.some((e) => e.id === ev.id), `${C.name} (not in ${first(A)}’s classes) gets nothing`);
    ok((await act(tok.C, 'givePeerFeedback', [ev.id, C.id, [{ phrase: 'liked', text: 'hi' }]])).status === 403, 'and cannot give feedback');
    const cc = await ctx('C');
    await cc.p.goto(`${U}/#/me/map`); await cc.p.waitForSelector('.home-head');
    ok(await cc.p.locator('.pf-classes').count() === 0, 'no "From your classes" for the outsider');
    ok((await fetch(`${U}${up.url}`, { headers: { cookie: `tp_session=${tok.C}` } })).status === 404, 'nor the photo (404)');
    const aCopy = await state(tok.aaron);
    ok(!aCopy.peerMoments.length && !aCopy.peerFeedback.length, 'Aaron (Year 8) gets nothing');
    const own8 = (await (await act(tok.aaron, 'addStation', [AARON, { title: 'Year 8 project', lineIds: ['science'], visibility: 'school' }])).json()).result;
    ok((await (await act(tok.aaron, 'setPeerFeedback', [own8.id, true])).json()).error?.includes('not on for your Year'), 'and cannot opt in');
    const ar = await ctx('aaron');
    await ar.p.goto(`${U}/#/me/map/${own8.id}`); await ar.p.waitForSelector('.station-panel.open');
    ok(await ar.p.locator('.pf-on, .pf-classes').count() === 0, 'Aaron sees no kind-feedback switch or list');

    // ── The class teacher sees it ──
    const tCopy = await state(tok.T);
    ok(tCopy.peerFeedback.some((f) => f.id === fb.id && f.fromId === B.id), `${teacher.name}’s copy has it whole`);
    const tt = await ctx('T');
    await tt.p.goto(`${U}/#/me/classes/${cls.id}`); await tt.p.waitForSelector('.pf-class');
    const tl = await tt.p.locator('.pf-class').innerText();
    ok(tl.includes(`${B.name} → ${A.name}`) && tl.includes('Thanked'), 'the class page lists it: who to whom, thanked');
    await tt.p.screenshot({ path: SH + 'teacher.png', fullPage: true });
    ok(!tt.errs.length, `no teacher page errors${tt.errs.length ? `: ${tt.errs.join(' | ')}` : ''}`);

    // ── A report, and a coordinator hides it ──
    await a.p.click('.pf-list .sg-report'); await a.p.waitForSelector('.sg-dialog');
    await a.p.click('.sg-reasons button:has-text("Unkind")'); await a.p.click('.sg-dialog .primary');
    const rp = await until(async () => (saved().reports || []).find((r) => r.feedbackId === fb.id));
    ok(rp && rp.kind === 'feedback' && rp.from.key === 'student', 'the owner reported it');
    const co = await ctx('co');
    await co.p.goto(`${U}/#/me/reports`); await co.p.waitForSelector(`#rp-${rp.id}`);
    const card = co.p.locator(`#rp-${rp.id}`);
    const ct = await card.innerText();
    ok(/kind feedback from a classmate/i.test(ct) && ct.includes('I liked how you drew the river in layers.'), `Reports shows the feedback${ct.includes('river') ? '' : `: ${ct}`}`);
    await card.locator('button:has-text("Hide from everyone")').click();
    ok(await until(async () => !!saved().peerFeedback.find((f) => f.id === fb.id).hidden), 'hidden: saved');
    ok(!(await state(tok.A)).peerFeedback.some((f) => f.id === fb.id), 'gone from the owner’s copy');
    ok((await state(tok.T)).peerFeedback.find((f) => f.id === fb.id)?.hidden, 'the teacher still sees it, marked hidden');
    await co.p.screenshot({ path: SH + 'reports.png' });

    // ── The Year switch ──
    const y = A.grade + 1;
    ok((await act(tok.T, 'setPeerFeedbackYear', [y, false, tid])).status === 403, 'a teacher cannot turn a Year off');
    await co.p.goto(`${U}/#/me/overview`); await co.p.waitForSelector('.pf-years');
    await co.p.locator('.pf-switch', { hasText: `Year ${y}` }).locator('input').uncheck();
    ok(await until(async () => saved().peerSettings?.offYears?.includes(y)), `the coordinator turned Year ${y} off`);
    ok(!(await state(tok.B)).peerMoments.length || grade.get(B.id) + 1 !== y, 'the classmate no longer gets the list');
    ok(!co.errs.length && !a.errs.length && !cc.errs.length && !ar.errs.length, `no page errors${[...co.errs, ...a.errs, ...cc.errs, ...ar.errs].join(' | ')}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
