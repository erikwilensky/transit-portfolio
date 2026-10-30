// Leaver archive on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster and picks two Year 13 students at runtime. The admin (Accounts › End of year: leaver archive) downloads both
// archives in one streamed ZIP and checks each: README (English and Thai), my-journey.pdf with every moment (private too),
// my-journey.html, the photo, the data copy. Schedules erasure in 90 days for one; on the day (the schedule file moved
// back) the due list shows it, nothing has been erased, and the admin confirms with the name typed. The first student
// downloads their own archive from Privacy; a teacher gets 403. axe on the new panel and Privacy. Separate browser
// contexts per account. TP_ROSTER=/path/to/roster.json.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-archive-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
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
async function axe(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad).slice(0, 600)}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const { unzip } = await import(path.join(ROOT, 'server/zip.mjs'));
  const files = (buf) => Object.fromEntries(unzip(buf).map((e) => [e.name, e.data]));
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-archive-data-');
  srv = await start(port, dataDir);
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const y13 = roster.students.filter((s) => s.year === 13 && links[s.email]).sort((x, y) => x.name.localeCompare(y.name));
    const [A, B] = y13;
    const teacher = roster.teachers.find((t) => links[t.email] && t.roles.includes('teacher') && !t.roles.includes('leadership'));
    ok(A && B && teacher, `picked Year 13 students ${A?.name} and ${B?.name}, and a teacher, ${teacher?.name}`);
    const first = A.name.split(' ')[0];

    // ── A's journey: two moments (one private), a reflection, a photo ──
    const aTok = await setupWith(U, links[A.email]), tTok = await setupWith(U, links[teacher.email]);
    await act(aTok, 'completeOnboarding', [A.id, ['science', 'service'], 'classic']);
    const up = await (await fetch(`${U}/api/upload`, { method: 'POST', headers: { cookie: `tp_session=${aTok}`, 'content-type': 'image/png', 'x-filename': 'reef-survey.png' }, body: PNG })).json();
    await act(aTok, 'addStation', [A.id, { title: 'Reef survey at Koh Tao', lineIds: ['science'], date: '2026-02-14', visibility: 'school', summary: 'Counted parrotfish along two transects.', reflection: 'Waiting for the tide taught me patience.', evidence: [{ kind: 'image', url: up.url, caption: 'Our transect' }] }]);
    await act(aTok, 'addStation', [A.id, { title: 'Notes to myself', lineIds: ['service'], date: '2026-04-01', visibility: 'private' }]);

    // ── The admin: the panel ──
    const cAd = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
    await cAd.addCookies([{ name: 'tp_session', value: adminTok, url: U }]);
    const ad = await cAd.newPage(); const errs = []; ad.on('pageerror', (e) => errs.push(e.message));
    await ad.goto(`${U}/#/me/accounts`); await ad.waitForSelector('.la .la-sum', { timeout: 20000 });
    ok(/\d+ leaving students · 0 downloaded/.test(await ad.locator('.la-sum').innerText()) && await ad.locator('.la-table').count() === 0, 'the panel sums up; the list opens on request');
    await ad.click('.la button:has-text("Show the list")'); await ad.waitForSelector('.la-table');
    const rows = await ad.locator('.la-table tbody tr').count();
    ok(rows === y13.length + roster.students.filter((s) => s.year === 13 && !links[s.email]).length, `End of year: leaver archive lists every Year 13 student (${rows})`);
    ok(await ad.locator('.la-bar button', { hasText: 'Download archives' }).isDisabled(), '"Download archives" waits for a choice');
    await ad.check(`input[aria-label="Choose ${A.name}"]`); await ad.check(`input[aria-label="Choose ${B.name}"]`);
    const [dl] = await Promise.all([ad.waitForEvent('download'), ad.click('.la-bar button:has-text("Download archives (2)")')]);
    const zipPath = SH + 'two.zip'; await dl.saveAs(zipPath);
    const outer = files(fs.readFileSync(zipPath));
    const inner = Object.keys(outer).filter((k) => k.endsWith('.zip'));
    ok(dl.suggestedFilename().startsWith('leaver-archives-') && inner.length === 2 && outer['README.txt'], `one streamed ZIP (${dl.suggestedFilename()}): ${Object.keys(outer).join(', ')}`);
    const za = files(outer[inner.find((k) => k.includes(A.id.toLowerCase()))]);
    const zb = files(outer[inner.find((k) => k.includes(B.id.toLowerCase()))]);
    const need = ['README.txt', 'my-journey.pdf', 'my-journey.html', 'data/events.json', 'data/student.json', 'data/README.txt'];
    ok(need.every((f) => za[f]) && need.filter((f) => f !== 'data/events.json').every((f) => zb[f]), `each archive has ${need.join(', ')} (events.json once there are moments)`);
    const pdfA = za['my-journey.pdf'].toString('latin1');
    fs.writeFileSync(SH + 'journey.pdf', za['my-journey.pdf']);
    ok(pdfA.startsWith('%PDF') && /\/MediaBox \[0 0 595\.28 841\.89\]/.test(pdfA) && ['Reef survey at Koh Tao', 'Notes to myself', 'Waiting for the tide taught me patience.', 'photos/reef-survey.png'].every((t) => pdfA.includes(t)), `${first}'s my-journey.pdf (A4): both moments, private too, the reflection, where the photo is`);
    ok(za['photos/reef-survey.png']?.equals(PNG), 'the photo, under its own name');
    ok(za['README.txt'].toString().includes('ในโฟลเดอร์นี้มีอะไรบ้าง') && za['README.txt'].toString().includes('What is in this folder'), 'README in English and Thai');
    ok(JSON.parse(zb['data/student.json']).id === B.id && !zb['my-journey.pdf'].toString('latin1').includes('Reef survey'), `${B.name}'s archive is theirs alone`);
    ok(await until(async () => (await ad.locator('.la-table tr', { hasText: A.name }).locator('.acc-tag', { hasText: 'Downloaded' }).count()) === 1, 10000), 'the panel shows "Downloaded"');

    // ── Erasure: scheduled, never automatic, confirmed on the day ──
    await ad.click(`.la-table tr:has-text("${B.name}") button:has-text("Schedule erasure in 90 days")`);
    await ad.waitForSelector(`.la-table tr:has-text("${B.name}") .acc-tag:has-text("Due")`);
    const st = JSON.parse(fs.readFileSync(path.join(dataDir, 'leaver-archive.json'), 'utf8'));
    const due = st.erasures[B.id]?.due;
    ok(due && Math.round((Date.parse(due) - Date.now()) / 864e5) >= 89, `erasure of ${B.name} due ${due}`);
    ok(await ad.locator('.la-due').count() === 0, 'nothing due today');
    await ad.locator('.la').screenshot({ path: SH + 'panel.png' });
    st.erasures[B.id].due = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dataDir, 'leaver-archive.json'), JSON.stringify(st));
    await ad.reload(); await ad.waitForSelector('.la-due'); await ad.click('.la button:has-text("Show the list")');
    ok((await ad.locator('.la-due').innerText()).includes(B.name), `on the day: ${B.name} is under "erasures due"`);
    const stillThere = (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store.students.some((s) => s.id === B.id);
    ok(stillThere, 'and is still in the record until an admin confirms');
    await ad.locator('.la-due').scrollIntoViewIfNeeded();
    await axe(ad, 'Accounts with the leaver archive and an erasure due');
    await ad.click('.la-due button:has-text("Erase…")');
    await axe(ad, 'the erase confirmation');
    ok(await ad.locator('.la-due button:has-text("for good")').isDisabled(), 'Erase waits for the name');
    await ad.fill('.la-due input', B.name);
    await ad.click('.la-due button:has-text("for good")');
    ok(await until(async () => (await ad.locator('.la-due').count()) === 0 && (await ad.locator('.la-table tr', { hasText: B.name }).count()) === 0), `${B.name} erased, gone from the list`);
    ok(!(await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store.students.some((s) => s.id === B.id), 'and from the record');
    await ad.setViewportSize({ width: 390, height: 860 });
    ok(await ad.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Accounts at phone width: no sideways scroll');

    // ── The student downloads their own, from Privacy ──
    const cS = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await cS.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const s = await cS.newPage(); s.on('pageerror', (e) => errs.push(e.message));
    await s.goto(`${U}/#/me/privacy`); await s.waitForSelector('.pv-archive');
    await axe(s, 'Privacy with "Download my archive"');
    const [sd] = await Promise.all([s.waitForEvent('download'), s.click('.pv-archive')]);
    const own = files(fs.readFileSync(await sd.path()));
    ok(sd.suggestedFilename().includes('-archive-') && own['my-journey.pdf'].toString('latin1').includes('Reef survey at Koh Tao') && own['photos/reef-survey.png'], `${first} downloads their own archive (${sd.suggestedFilename()})`);
    const sr = await cS.request.get(`${U}/api/me/archive?student=${encodeURIComponent(roster.students.find((x) => x.id !== A.id && x.id !== B.id).id)}`);
    ok(sr.status() === 403, 'but not another student\'s (403)');

    // ── A teacher: 403 everywhere ──
    const cT = await b.newContext();
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const codes = [];
    for (const u of ['/api/me/archive', `/api/admin/students/${A.id}/archive`, `/api/admin/leavers/archive?ids=${A.id}`, '/api/admin/leavers']) codes.push((await cT.request.get(`${U}${u}`)).status());
    codes.push((await cT.request.post(`${U}/api/admin/leavers/${A.id}/erasure`, { headers: { origin: U } })).status());
    ok(codes.every((c) => c === 403), `${teacher.name} (teacher): 403 for every archive route (${codes.join(', ')})`);

    // ── Activity log ──
    const log = fs.readdirSync(dataDir).filter((f) => /^audit-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n')).map((l) => JSON.parse(l));
    const n = (a, f = () => true) => log.filter((e) => e.action === a && f(e)).length;
    ok(n('leaver-archive', (e) => e.detail.combined === 2) === 2 && n('leaver-archive', (e) => e.detail.how === 'self') === 1, 'activity log: one line per archive downloaded, the student\'s own too');
    ok(n('erasure-schedule') === 1 && n('pdpa-erase', (e) => e.detail?.scheduled) === 1, 'and the schedule and the erasure');
    ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
