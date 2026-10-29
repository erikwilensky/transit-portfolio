// Protected uploaded files on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first)
// and imports the real roster. Aaron Torres (Year 8) uploads a photo: only he can open it until it is on a moment. On
// a school-level moment: Aaron, Mr David Coultas (teaches him) and a parent (family letter) open it; a teacher with no
// reach and a signed-out browser get 404. A private moment's file: Aaron only. Hidden by a moderator: gone for the
// parent. Publishable on a share link: the signed-out reader sees it on the share page. Each person has their own
// browser context (cookie jar). TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-files-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-files-';
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198'; // Aaron Torres, Mr David Coultas
const WHOLE = ['leadership', 'coordinator', 'counsellor', 'admin'];
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-files-data-'));
  srv = await start(port, dataDir);
  const full = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), coultas = person(TEACHER), advisor = person(aaron.advisorId);
    const hisClasses = new Set(roster.enrolments.filter((n) => n.studentId === STUDENT).map((n) => n.classId));
    const cls = roster.classes.find((c) => c.teacherIds.includes(TEACHER) && hisClasses.has(c.id));
    const stranger = roster.teachers.find((t) => links[t.email] && t.id !== aaron.advisorId && !t.roles.some((r) => WHOLE.includes(r))
      && !roster.classes.some((c) => c.teacherIds.includes(t.id) && hisClasses.has(c.id)));
    const coord = roster.teachers.find((t) => t.roles.includes('coordinator') && links[t.email] && t.id !== TEACHER);
    ok(!!cls && !!stranger && !!coord, `${aaron.name} (Year ${aaron.year}); ${coultas.name} teaches him ${cls?.name}; ${stranger?.name} does not teach or advise him`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]);
    const xTok = await setupWith(U, links[stranger.email]), cTok = await setupWith(U, links[coord.email]), aTok = await setupWith(U, links[advisor.email]);
    const ctx = async (tok) => {
      const c = await b.newContext({ viewport: { width: 1300, height: 900 } });
      if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(`${U}/offline.html`); return p;
    };
    const s = await ctx(sTok), t = await ctx(tTok), x = await ctx(xTok), out = await ctx(null);
    // A parent joins through the family letter in their own context.
    const lt = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: H(aTok), body: JSON.stringify({ studentIds: [STUDENT] }) })).json();
    const p = await ctx(null);
    await p.goto(lt.letters[0].url.replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('form.auth-card');
    await p.fill('input[autocomplete="name"]', 'Maria Torres'); await p.fill('input[type="email"]', 'maria.torres@family.example');
    await p.fill('input[autocomplete="new-password"] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete="new-password"] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type="submit"]'); await p.waitForSelector('.page.family');

    // Each browser asks for the file with its own cookies.
    const who = { aaron: s, coultas: t, stranger: x, parent: p, signedOut: out };
    const get = (page, url) => page.evaluate(async (u) => { const r = await fetch(u, { cache: 'no-store' }); return { status: r.status, cc: r.headers.get('cache-control') }; }, `${U}/${url}`);
    const statuses = async (url) => Object.fromEntries(await Promise.all(Object.entries(who).map(async ([k, pg]) => [k, (await get(pg, url)).status])));
    const act = (page, fn, args) => page.evaluate(async ([fn, args]) => (await fetch('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn, args, rec: [] }) })).status, [fn, args]);
    const upload = (name) => s.evaluate(async (name) => {
      const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.fillStyle = '#002855'; g.fillRect(0, 0, 80, 60);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const r = await fetch('/api/upload', { method: 'POST', headers: { 'content-type': 'image/png', 'x-filename': name }, body: blob });
      return (await r.json()).url.replace(/^\//, '');
    }, name);

    ok(await act(s, 'completeOnboarding', [STUDENT, ['science', 'sport'], null]) === 200, 'Aaron picks his lines');
    const line = 'science';
    // ── Uploaded, on nothing yet ──
    const photo = await upload('bridge.png');
    ok(/^api\/files\/[a-f0-9]{32}\.png$/.test(photo), `uploaded (${photo})`);
    let st = await statuses(photo);
    ok(st.aaron === 200 && st.coultas === 404 && st.stranger === 404 && st.parent === 404 && st.signedOut === 404, `before it is on a moment: only Aaron (${JSON.stringify(st)})`);

    // ── On a school-level moment ──
    ok(await act(s, 'addStation', [STUDENT, { title: 'Bridge model', lineIds: [line], image: photo, visibility: 'school' }]) === 200, 'Aaron adds a moment with it');
    const ev = await until(() => full().events.find((e) => e.studentId === STUDENT && e.title === 'Bridge model'));
    st = await statuses(photo);
    ok(st.aaron === 200 && st.coultas === 200 && st.parent === 200, `Aaron, his teacher and his parent open it (${JSON.stringify(st)})`);
    ok(st.stranger === 404 && st.signedOut === 404, 'a teacher with no reach and a signed-out browser get 404');
    const h = await get(t, photo);
    ok(h.cc === 'private, no-cache', `Cache-Control: ${h.cc}`);
    ok((await get(x, 'api/files/0123456789abcdef0123456789abcdef.png')).status === 404, 'a file that does not exist: the same 404');

    // Mr Coultas sees the photo on the moment in My classes.
    await t.goto(`${U}/#/me/classes/${cls.id}~${STUDENT}`); await t.waitForSelector('.mc-read');
    await t.locator('.metro .station[aria-label^="Bridge model"]').first().click();
    await t.waitForSelector('.station-panel.open img');
    const loaded = await until(() => t.evaluate((src) => [...document.querySelectorAll('.station-panel.open img')].some((i) => i.getAttribute('src') === src && i.complete && i.naturalWidth > 0), photo));
    ok(loaded, 'the photo loads in his station panel');
    await t.screenshot({ path: SH + 'teacher.png' });

    // ── A private moment's file ──
    const diary = await upload('diary.png');
    await act(s, 'addStation', [STUDENT, { title: 'Diary page', lineIds: [line], image: diary, visibility: 'private' }]);
    st = await statuses(diary);
    ok(st.aaron === 200 && Object.entries(st).every(([k, v]) => k === 'aaron' || v === 404), `a private moment's photo: Aaron only (${JSON.stringify(st)})`);

    // ── Hidden by a moderator ──
    ok(await act(t, 'reportItem', [{ eventId: ev.id }, 'personal', 'An address', { key: TEACHER }]) === 200, 'Mr Coultas reports it');
    const rep = full().reports.find((r) => r.eventId === ev.id);
    const c = await ctx(cTok);
    ok(await act(c, 'moderateReport', [rep.id, 'hide', '', coord.id]) === 200, `${coord.name} hides it`);
    st = await statuses(photo);
    ok(st.parent === 404 && st.aaron === 200 && st.coultas === 200, `hidden: gone for the parent, kept for Aaron and staff (${JSON.stringify(st)})`);
    await act(c, 'moderateReport', [rep.id, 'unhide', '', coord.id]);
    ok((await get(p, photo)).status === 200, 'shown again: the parent opens it again');

    // ── Publishable, on a share link ──
    await act(s, 'setVisibility', [ev.id, 'publishable']);
    const drafts = (await (await fetch(`${U}/api/state`, { headers: H(sTok) })).json()).snapshot.store.drafts[STUDENT] || [];
    const token = 'tpfiles' + Date.now().toString(36);
    const pres = drafts.find((d) => d.audience === 'general') || drafts[0];
    ok(!!pres, 'Aaron has a presentation to share');
    const list = drafts.map((d) => (d.id === pres.id ? { ...d, shareLinks: [...(d.shareLinks || []), { token, created: '2026-10-01', expiresAt: '2099-01-01', views: 0 }] } : d));
    ok(await act(s, 'setStudentDrafts', [STUDENT, list]) === 200, 'Aaron makes a share link');
    st = await statuses(photo);
    ok(st.signedOut === 200 && st.stranger === 200, `publishable on an open link: anyone (${JSON.stringify(st)})`);
    ok((await get(out, diary)).status === 404, 'the private photo still not');
    await out.goto(`${U}/#/s/${token}`);
    const shown = await until(() => out.evaluate((src) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src')?.endsWith(src) && i.complete && i.naturalWidth > 0), photo));
    ok(shown, 'the signed-out reader sees the photo on the share page');
    await out.screenshot({ path: SH + 'share.png' });
    const revoked = list.map((d) => (d.id === pres.id ? { ...d, shareLinks: d.shareLinks.map((l) => (l.token === token ? { ...l, revoked: true } : l)) } : d));
    await act(s, 'setStudentDrafts', [STUDENT, revoked]);
    ok((await get(out, photo)).status === 404, 'link withdrawn: signed out gets 404 again');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
