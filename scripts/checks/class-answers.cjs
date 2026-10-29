// Reviewing class-question answers on the real class lists: starts a clean pilot (TP_START=empty; needs
// `npm run build` first), imports the real roster. Mr David Coultas (T60198) asks Y8 Sciences 08.04 (04) (C-392000)
// a question as a moment; four students answer in their own browsers (Aaron Torres with a photo). Coultas sees one
// grouped card in Endorsements, opens Review answers, asks one student for more, endorses all the others at once
// with a shared note and a chip, and downloads the CSV. Aaron then sees "Checked by a teacher".
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-answers-';
const CLASS = 'C-392000', TEACHER = 'T60198', AARON = 'Sabc0d6125e85';
const Q = 'What did you learn from the science fair?';
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
// A tiny CSV reader (quoted cells, doubled quotes, newlines inside quotes).
const parseCsv = (s) => { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\r') { /* skip */ } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; } if (cell || row.length) { row.push(cell); rows.push(row); } return rows; };

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const state = async (h = H) => (await (await fetch(`${U}/api/state`, { headers: h })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = await state();
    const coultas = roster.teachers.find((t) => t.id === TEACHER);
    const cls = rec.classes.find((c) => c.id === CLASS);
    ok(coultas && cls && cls.teacherIds.includes(TEACHER) && cls.lineId, `${coultas?.name} teaches ${cls?.name}, on a line (${cls?.lineId})`);
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    const kids = rec.enrolments.filter((n) => n.classId === CLASS && !n.to).map((n) => n.studentId);
    const M = kids.length;
    ok(kids.includes(AARON), `Aaron Torres is in the class (${M} students)`);
    const answering = [AARON, ...kids.filter((k) => k !== AARON && links[email.get(k)]).slice(0, 3)];
    const names = new Map(rec.students.map((s) => [s.id, s.name]));

    // ── Coultas asks from the class page ──
    const tTok = await setupWith(U, links[coultas.email]);
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.cp-head-acts .primary');
    await t.click('.cp-head-acts .primary'); await t.waitForSelector('.cp-ask');
    await t.fill('.cp-ask textarea', Q);
    await t.fill('.cp-ask input:not([type])', 'Year 8 science fair');
    ok(await t.locator('.cp-ask .cp-check input').isChecked(), 'asked as a moment');
    await t.click('.cp-foot .primary');
    const prompt = await until(async () => (await state()).classPrompts?.find((p) => p.classId === CLASS));
    ok(prompt?.asMoment && prompt.studentIds.length === M, `saved, asked of ${prompt?.studentIds.length} students`);

    // ── Four students answer, each in their own browser ──
    const students = {};
    for (const [i, sid] of answering.entries()) {
      const sTok = await setupWith(U, links[email.get(sid)]);
      const c = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
      await c.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
      const s = await c.newPage(); const errs = []; s.on('pageerror', (e) => errs.push(e.message));
      students[sid] = { s, errs, tok: sTok };
      await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
      await s.locator('.ob-pick:not(.on)').first().click(); await s.locator('.ob-pick:not(.on)').first().click();
      await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
      await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
      const shown = await s.waitForSelector('.simple .cp-open .cp-card', { timeout: 6000 }).catch(() => null);
      ok(!!shown && (await s.locator('.cp-open').innerText()).includes(Q), `${names.get(sid)} sees the question at the top of their home`);
      if (!shown) continue;
      await s.click('.cp-open .cp-card'); await s.waitForSelector('.cp-flow .cp-big');
      await s.click('.cp-flow .sh-next .primary');
      await s.fill('.cp-flow textarea', i === 0 ? 'Plants grow faster under blue light, "really".' : i === 3 ? 'It was fun.' : `Answer ${i}: salt water conducts electricity, tap water barely.`);
      await s.click('.cp-flow .sh-next .primary');
      if (i === 0) {
        const png = await s.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } });
        await s.setInputFiles('.cp-flow .sh-photo-btn:not(.cam) input', { name: 'fair.png', mimeType: 'image/png', buffer: png });
        await s.waitForSelector('.cp-flow .sh-preview img');
      }
      await s.click('.cp-flow .sh-next .primary');
      await s.waitForSelector('.cp-flow >> text=Done!');
      await s.click('.cp-flow .sh-next .primary');
    }
    const answers = await until(async () => { const a = (await state()).classAnswers || []; return a.filter((x) => x.promptId === prompt.id).length === 4 ? a : null; });
    ok(!!answers, 'four answers on the server');

    // ── Endorsements: one grouped card, not four ──
    await t.goto(`${U}/#/me/queue`); await t.reload();
    await t.waitForSelector('.q-group');
    const g = await t.locator('.q-group').innerText();
    ok(g.includes(`Answers to “${Q}” · 4 waiting`) && g.includes(cls.name), `grouped: "Answers to “${Q}” · 4 waiting"`);
    ok(await t.locator('.q-card', { hasText: 'Year 8 science fair' }).count() === 0, 'no separate cards for the answers');
    ok((await t.locator('.meter').innerText()).includes('4'), 'the meter still counts them as waiting');
    await t.screenshot({ path: SH + 'queue.png' });
    await t.click('.q-group button:has-text("Review all")');
    await t.waitForSelector('.ca-card');
    ok(decodeURIComponent(t.url()).includes(`/classes/${CLASS}~answers~${prompt.id}`), 'Review all opens the review view');
    ok(await t.locator('.ca-card').count() === 4, 'one card per answer');
    const aaronCard = t.locator('.ca-card', { hasText: names.get(AARON) });
    ok(await aaronCard.locator('img.ca-img').count() === 1, 'Aaron’s answer shows his photo');
    ok((await aaronCard.innerText()).includes('Waiting') && (await aaronCard.innerText()).includes('8C'), 'with his homeroom and "Waiting"');
    ok((await t.locator('.ca-rest li').count()) === M - 4, `the ${M - 4} others are listed as not answered yet`);
    ok((await t.locator('.ca-bar .primary').innerText()).includes('Endorse all waiting (4)'), '"Endorse all waiting (4)"');
    await t.screenshot({ path: SH + 'review.png', fullPage: true });

    // Keyboard: X selects the focused answer; A on the "It was fun." answer asks for more.
    await t.locator('.ca-card').first().focus(); await t.keyboard.press('x');
    ok((await t.locator('.ca-bar .ghost').innerText()).includes('(1)'), 'X selects an answer (Endorse selected (1))');
    await t.keyboard.press('x');
    const lazy = t.locator('.ca-card', { hasText: 'It was fun.' });
    await lazy.focus(); await t.keyboard.press('a');
    await t.waitForSelector('.ca-more input:focus');
    await t.keyboard.type('Tell me one thing you found out.'); await t.keyboard.press('Enter');
    await t.waitForSelector('.ca-card:has-text("It was fun.") .ca-st.ca-more');
    ok((await t.locator('.ca-bar .primary').innerText()).includes('(3)'), 'asked one for more: 3 waiting');

    await t.click('.ca-bar .q-chips button:has-text("Clear progress")');
    await t.fill('.ca-bar .ca-note', 'Good observations.');
    await t.click('.ca-bar .primary');
    await t.waitForSelector('.ca-bar', { state: 'detached' });
    const st = await until(async () => { const s = await state(); const evs = new Set(answers.filter((a) => a.promptId === prompt.id).map((a) => a.eventId)); const e = s.events.filter((x) => evs.has(x.id)); return e.filter((x) => x.verification === 'teacher-endorsed').length === 3 ? s : null; });
    ok(!!st, 'three answers endorsed on the server, in one go');
    ok(st && st.endorsements.filter((n) => n.note === 'Clear progress. Good observations.').length === 3, 'each with the shared note and chip');
    const lazyRq = st?.requests.find((r) => r.status === 'returned');
    ok(lazyRq?.reason === 'Tell me one thing you found out.', 'the asked-for-more request carries the note');
    ok(await t.locator('.ca-card .ca-st.ca-endorsed').count() === 3, 'the cards say Endorsed');
    await t.screenshot({ path: SH + 'endorsed.png', fullPage: true });

    // ── CSV ──
    const [dl] = await Promise.all([t.waitForEvent('download'), t.click('button:has-text("Download answers (CSV)")')]);
    const buf = fs.readFileSync(await dl.path());
    ok(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, 'the CSV starts with a UTF-8 BOM');
    ok(/\.csv$/.test(dl.suggestedFilename()), `named ${dl.suggestedFilename()}`);
    const rows = parseCsv(buf.toString('utf8').slice(1));
    ok(rows[0].join() === 'Name,Homeroom,Status,Answered at,Answer,Endorsed', 'header: Name, Homeroom, Status, Answered at, Answer, Endorsed');
    ok(rows.length - 1 === M, `one row per student asked (${rows.length - 1} of ${M})`);
    const aRow = rows.find((r) => r[0] === names.get(AARON));
    ok(aRow && aRow[1] === '8C' && aRow[2] === 'Endorsed' && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(aRow[3]) && aRow[4] === 'Plants grow faster under blue light, "really".' && aRow[5] === 'yes', `Aaron’s row: ${aRow?.join(' | ')}`);
    ok(rows.filter((r) => r[2] === 'Endorsed' && r[5] === 'yes').length === 3, 'three endorsed rows');
    ok(rows.filter((r) => r[2] === 'Asked for more' && r[5] === 'no').length === 1, 'one asked for more');
    ok(rows.filter((r) => r[2] === 'Not answered yet' && !r[3] && !r[4]).length === M - 4, `${M - 4} not answered yet`);

    // ── The queue is clear of them; Aaron sees "Checked by a teacher" ──
    await t.goto(`${U}/#/me/queue`);
    await t.waitForSelector('.page.queue');
    ok(await t.locator('.q-group').count() === 0, 'the group is gone from Endorsements');
    const A = students[AARON].s;
    await A.reload(); await A.waitForSelector('.simple .sh-feed');
    const feed = await A.locator('.simple .sh-feed').innerText();
    ok(feed.includes('Checked by a teacher'), 'Aaron sees "Checked by a teacher"');
    await A.screenshot({ path: SH + 'aaron.png', fullPage: true });
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);
    const sErrs = Object.values(students).flatMap((x) => x.errs);
    ok(!sErrs.length, `no student page errors${sErrs.length ? `: ${sErrs.join(' | ')}` : ''}`);
    // Another teacher cannot endorse Coultas's answers.
    const other = roster.teachers.find((x) => x.id !== TEACHER && links[x.email] && x.roles.join() === 'teacher');
    const oTok = await setupWith(U, links[other.email]);
    const ids = (await state()).requests.filter((r) => r.teacherId === TEACHER).map((r) => r.id);
    const r = await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${oTok}` }, body: JSON.stringify({ fn: 'endorse', args: [ids, other.id, 'x'], rec: [] }) });
    ok(r.status === 403, `another teacher endorsing them is refused (${r.status})`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
