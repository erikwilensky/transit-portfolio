// Year handover on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster, a student in 8C adds a moment and a goal that has passed, and 8C's advisor writes a handover note from
// My advisory. The admin then imports, from Accounts › Start of year, a modified copy for the next year (made in a temp
// dir, never committed) where 8C's students move to another advisor and leave the old advisor's classes. The new advisor
// sees "New to you", the student's history and "Last year" with the note; the old advisor no longer gets them; the
// student carries the goal over; the student and family never get the note. Each account has its own browser context.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-handover-';
const NOTE = 'Strengths: kind and curious in science. What helps: a clear first step. What to watch: goes quiet before deadlines.';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

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
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const c8 = roster.students.filter((s) => s.homeroom === '8C');
    const OLD = c8[0].advisorId;
    const NEW = roster.teachers.find((t) => t.roles.includes('advisor') && t.email && t.id !== OLD && roster.students.some((s) => s.advisorId === t.id && s.homeroom !== '8C')).id;
    const kid = c8.find((s) => s.email);
    ok(c8.length > 0 && c8.every((s) => s.advisorId === OLD) && kid, `8C: ${c8.length} students, advisor ${person(OLD).name}; moving to ${person(NEW).name}`);
    const toks = {};
    const tok = async (id) => (toks[id] ||= await setupWith(U, links[person(id).email]));
    const ctx = async (id, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 860 } });
      await c.addCookies([{ name: 'tp_session', value: await tok(id), url: U }]);
      const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p;
    };
    const as = async (id) => ({ cookie: `tp_session=${await tok(id)}`, 'content-type': 'application/json' });
    const act = async (id, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: await as(id), body: JSON.stringify({ fn, args, rec: [] }) }); return { status: r.status, body: await r.json() }; };
    const stateOf = async (id) => (await (await fetch(`${U}/api/state`, { headers: id ? await as(id) : H })).json()).snapshot.store;

    // ── Some activity this year: the student's moment and a goal that has passed; a prompt from the advisor ──
    await act(kid.id, 'completeOnboarding', [kid.id, ['science', 'service'], 'metro']);
    const st = (await act(kid.id, 'addStation', [kid.id, { title: 'Canal water testing', date: day(12), lineIds: ['science'] }])).body.result;
    const goal = (await act(kid.id, 'addGoal', [kid.id, { title: 'Help at the beach clean-up', date: day(3), lineId: 'service' }])).body.result;
    const pr = await act(OLD, 'sendPrompt', [kid.id, st.id, 'What surprised you at the canal?', OLD]);
    ok(st?.id && goal?.id && pr.status === 200, 'the student added a moment and a goal; the advisor sent a prompt');

    // ── The old advisor writes a handover note from My advisory ──
    const o = await ctx(OLD);
    await o.goto(`${U}/#/me/advisory`); await o.waitForSelector('.adv-grid');
    await o.click('text=Write handover notes'); await o.waitForSelector('.yh-notes');
    const prompt = await o.locator('.yh-prompt').innerText();
    ok(/Strengths/.test(prompt) && /What helps/.test(prompt) && /What to watch/.test(prompt), 'the view prompts strengths, what helps, what to watch');
    const rows = await o.locator('.yh-row').count();
    ok(rows >= c8.length, `it lists the advisees (${rows})`);
    const row = o.locator('.yh-row', { hasText: kid.name });
    await row.locator('button', { hasText: 'Write note' }).click();
    await row.locator('textarea').fill(NOTE); await row.locator('button', { hasText: 'Save note' }).click();
    await until(async () => (await stateOf()).handoverNotes?.some((n) => n.studentId === kid.id && n.text === NOTE));
    ok((await stateOf()).handoverNotes?.some((n) => n.studentId === kid.id && n.by === OLD && n.text === NOTE), 'the note is saved on the server, by the advisor');
    await o.screenshot({ path: SH + 'write.png', fullPage: true });
    const forged = await act(NEW, 'setHandoverNote', [kid.id, 'Not mine to write', NEW]);
    const byKid = await act(kid.id, 'setHandoverNote', [kid.id, 'x', OLD]);
    ok(forged.status === 403 && byKid.status === 403, 'another advisor and the student may not write it (403)');
    ok(!(await stateOf(kid.id)).handoverNotes?.length, 'the student never downloads it');

    // ── The admin: Accounts › Start of year, with the next year's file (a temp copy) ──
    const next = structuredClone(roster);
    next.school = { ...next.school, academicYear: '2027-28', exportedAt: day(1) };
    const ids8 = new Set(c8.map((s) => s.id));
    for (const s of next.students) if (ids8.has(s.id)) s.advisorId = NEW;
    const oldClasses = new Set(next.classes.filter((c) => c.teacherIds.includes(OLD)).map((c) => c.id));
    next.enrolments = next.enrolments.filter((e) => !(ids8.has(e.studentId) && oldClasses.has(e.classId)));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-next-year-')); const file = path.join(tmp, 'transit-roster-2027-28.json');
    fs.writeFileSync(file, JSON.stringify(next));
    const ca = await b.newContext({ viewport: { width: 1300, height: 860 } }); await ca.addCookies([{ name: 'tp_session', value: adminTok, url: U }]);
    const ad = await ca.newPage(); ad.errs = []; ad.on('pageerror', (e) => ad.errs.push(e.message));
    await ad.goto(`${U}/#/me/accounts`); await ad.waitForSelector('.acc-table');
    await ad.click('text=Start of year'); await ad.waitForSelector('.yh-start');
    ok(/What happens when you import the new year/.test(await ad.locator('.yh-start').innerText()), 'Start of year explains what happens');
    await ad.setInputFiles('.acc-file input', file); await ad.waitForSelector('.yh-start-n');
    const pv = await ad.locator('.yh-start-n').innerText();
    ok(new RegExp(`From 2026-27 to 2027-28`).test(pv) && new RegExp(`${c8.length} students change advisor; 1 of them has a handover note`).test(pv), `preview: ${pv.trim()}`);
    ok((await ad.locator('.yh-groups').innerText()).includes(`${person(OLD).name} → ${person(NEW).name}`), 'preview names old → new advisor');
    await ad.screenshot({ path: SH + 'start.png', fullPage: true });
    await ad.click('.acc-roster button:has-text("Import")'); await ad.waitForSelector('.acc-ok');
    const rec = await stateOf();
    ok(rec.handovers.filter((h) => ids8.has(h.studentId) && h.from === OLD && h.to === NEW && h.newYear).length === c8.length && rec.yearStart?.year === '2027-28', 'every 8C student has a handover; the year started');
    fs.rmSync(tmp, { recursive: true, force: true });

    // ── The new advisor ──
    const n = await ctx(NEW);
    await n.goto(`${U}/#/me/advisory`); await n.waitForSelector('.yh-banner');
    ok(new RegExp(`New to you: ${c8.length} students`).test(await n.locator('.yh-banner').innerText()), '"New to you" banner with the 8C students');
    ok(await n.locator('.adv-card', { hasText: kid.name }).locator('.yh-tag').count() === 1, 'their cards say New to you');
    await n.screenshot({ path: SH + 'new.png', fullPage: true });
    await n.goto(`${U}/#/me/student/${kid.id}`); await n.waitForSelector('.yh-last');
    const ly = await n.locator('.yh-last').innerText();
    ok(ly.includes(person(OLD).name) && ly.includes(NOTE), 'Last year: the previous advisor and the handover note');
    ok(/1 moment/.test(ly) && /Science\s*1/.test(ly), `Last year: moments by line (${ly.replace(/\n/g, ' · ').slice(0, 160)})`);
    ok(await n.locator('.metro, svg').count() > 0 && (await stateOf(NEW)).events.some((e) => e.id === st.id), 'the new advisor sees the student’s history');
    await n.screenshot({ path: SH + 'last-year.png', fullPage: true });

    // ── The old advisor no longer sees them ──
    const os8 = await stateOf(OLD);
    ok(!os8.students.some((s) => ids8.has(s.id)) && !os8.events.some((e) => ids8.has(e.studentId)), 'the old advisor downloads none of the 8C students or their moments');
    ok((await act(OLD, 'addNote', [kid.id, 'still here?'])).status === 403, 'and cannot act on them (403)');
    await o.goto(`${U}/#/me/advisory`); await o.reload(); await o.waitForSelector('.advisor');
    ok(await o.locator('.adv-card', { hasText: kid.name }).count() === 0, 'they are gone from her advisory');
    await o.goto(`${U}/#/me/student/${kid.id}`); await o.waitForTimeout(500);
    ok(await o.locator('text=This student is not in your part of the record').count() === 1, 'the student page says not in your part');
    await o.goto(`${U}/#/me/advisory`); await o.waitForSelector('.advisor'); await o.click('text=Write handover notes');
    ok((await o.locator('.yh-notes').innerText()).includes('Students you handed over'), 'she can still finish notes for the students she handed over');

    // ── The student: last year's goal, carry over or close ──
    const s = await ctx(kid.id, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.yh-carry');
    ok((await s.locator('.yh-carry').innerText()).includes(goal.title), '"Carry over or close" shows last year’s goal');
    await s.screenshot({ path: SH + 'carry.png', fullPage: true });
    await s.locator('.yh-carry button', { hasText: 'Carry over' }).click();
    const carried = await until(async () => (await stateOf()).events.find((e) => e.id === goal.id && e.carriedOver));
    ok(carried && carried.date > day(0), `carried over to ${carried?.date}`);
    ok(await s.locator('.yh-carry').count() === 0, 'the card goes once nothing is left');
    ok(!s.errs.length && !n.errs.length && !o.errs.length && !ad.errs.length, `no page errors${[...s.errs, ...n.errs, ...o.errs, ...ad.errs].join(' | ')}`);
    await n.reload(); await n.waitForSelector('.yh-last');
    ok(/1 goal carried over/.test(await n.locator('.yh-last').innerText()), 'Last year shows the goal carried over');
    const ks = await stateOf(kid.id);
    ok(!ks.handoverNotes.length && !ks.handovers.length, 'the student downloads no handover notes or records');
  } catch (e) { console.log('FAIL', e.stack || e); process.exitCode = 1; }
  finally { await b.close(); srv?.p.kill(); }
})();
