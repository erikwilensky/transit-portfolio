// The Simple add flow on real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first),
// imports the real roster as the admin, then a Year 8 student signs in on a phone, adds a moment with their own
// photo and asks the suggested teacher (the teacher of their class on that line) to check it. That teacher
// then sees the request in their Endorsements queue.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-simple-';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const callName = (n) => { const m = /^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+(.+)$/i.exec(n.trim()); return m ? `${m[1]} ${m[2].split(/\s+/).pop()}` : n; };

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
    const state = async () => (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const imp = await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) });
    const ij = await imp.json();
    ok(imp.ok && ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts?.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));

    // A Year 8 student, a line, and the teacher the flow should suggest: the first of their class teachers on it
    // (as teachersOf/endorserChoices order them), here a plain subject teacher with an account.
    const rec = await state();
    const classes = new Map(rec.classes.map((c) => [c.id, c]));
    const teacher = new Map(roster.teachers.map((t) => [t.id, t])); // the snapshot's staff directory has no emails or roles
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    let pick = null;
    for (const s of rec.students.filter((x) => x.grade === 7 && links[email.get(x.id)])) {
      const seen = []; // [teacherId, lineId] in teachersOf order
      for (const n of rec.enrolments) if (n.studentId === s.id && !n.to) for (const tid of classes.get(n.classId)?.teacherIds || []) if (!seen.some(([id]) => id === tid)) seen.push([tid, classes.get(n.classId).lineId]);
      for (const lineId of [...new Set(seen.map(([, l]) => l).filter(Boolean))]) {
        const tid = seen.find(([, l]) => l === lineId)[0]; const t = teacher.get(tid);
        if (t && links[t.email] && (t.roles || []).join() === 'teacher') { pick = { s, lineId, t, other: seen.map(([, l]) => l).find((l) => l && l !== lineId) }; break; }
      }
      if (pick) break;
    }
    ok(!!pick, `found a Year 8 student with a class teacher on a line${pick ? `: ${pick.s.name}, ${pick.lineId}, ${pick.t.name}` : ''}`);
    const lineName = (id) => rec.lines.find((l) => l.id === id).name;

    // ── The student, on a phone ──
    const sTok = await setupWith(U, links[email.get(pick.s.id)]);
    const cS = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cS.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
    const s = await cS.newPage(); const errs = []; s.on('pageerror', (e) => errs.push(e.message));
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    await s.locator('.ob-pick', { hasText: lineName(pick.lineId) }).click();
    const second = pick.other && pick.other !== pick.lineId ? s.locator('.ob-pick', { hasText: lineName(pick.other) }) : s.locator('.ob-pick:not(.on)').first();
    await second.click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    ok(true, 'Year 8 student lands on the Simple home');

    await s.click('text=Add something I did'); await s.waitForSelector('.sh-flow');
    ok(await s.locator('.sh-photos').count() === 0, 'pilot: the sample pictures are not offered');
    ok(await s.locator('.sh-photo-btn', { hasText: 'Take or choose a photo' }).count() === 1, 'a big "Take or choose a photo" button');
    ok(await s.locator('.sh-photo-btn.cam input[capture="environment"]').count() === 1, 'on a phone: a camera button (capture=environment)');
    await s.fill('.sh-input', 'Science fair poster');
    const png = await s.screenshot({ clip: { x: 0, y: 0, width: 120, height: 90 } }); // a real image file
    await s.setInputFiles('.sh-photo-btn:not(.cam) input', { name: 'poster.png', mimeType: 'image/png', buffer: png });
    await s.waitForSelector('.sh-preview img');
    const src = await s.locator('.sh-preview img').getAttribute('src');
    ok(/^api\/files\//.test(src), `the photo is uploaded to the server (${src})`);
    await s.click('.sh-next .primary');
    await s.locator('.sh-lines button', { hasText: lineName(pick.lineId) }).click();
    await s.click('.sh-next .primary'); // skip the reflection
    await s.waitForSelector('text=Ask a teacher to check it?');
    const ask = await s.locator('.sh-ask').first().innerText();
    ok(ask.includes(pick.t.name), `the suggested teacher is the class teacher on that line (${ask.replace(/\n/g, ' · ')})`);
    await s.click('text=Someone else');
    ok(await s.locator('.sh-others .sh-ask').count() >= 1, `"Someone else" lists ${await s.locator('.sh-others .sh-ask').count()} other teachers`);
    await s.screenshot({ path: SH + 'ask.png' });
    await s.locator('.sh-ask').first().click();
    await s.waitForSelector('.sh-feed');
    const ev = await until(async () => (await state()).events.find((e) => e.studentId === pick.s.id && e.title === 'Science fair poster'));
    ok(ev && ev.evidence[0]?.url === src, 'the station is saved with the uploaded photo');
    const rq = await until(async () => (await state()).requests.find((r) => r.eventId === ev?.id && r.status === 'pending'));
    ok(rq?.teacherId === pick.t.id, 'an endorsement request went to the suggested teacher');
    const card = await s.locator('.sh-feed li').first().innerText();
    ok(card.includes(`Waiting for ${callName(pick.t.name)}`), `the moment card says "Waiting for ${callName(pick.t.name)}"`);
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await s.screenshot({ path: SH + 'home.png' });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);

    // ── The teacher sees it in their queue ──
    const cT = await b.newContext({ viewport: { width: 1300, height: 860 } });
    await cT.addCookies([{ name: 'tp_session', value: await setupWith(U, links[pick.t.email]), url: U }]);
    const t = await cT.newPage();
    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('main.screen');
    await t.waitForSelector('text=Science fair poster', { timeout: 8000 }).catch(() => {});
    const q = await t.locator('main').innerText();
    ok(q.includes('Science fair poster') && q.includes(pick.s.name.split(' ')[0]), 'the teacher sees the request in their Endorsements queue');
    await t.screenshot({ path: SH + 'queue.png' });
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
