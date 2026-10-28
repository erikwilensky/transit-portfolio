// Pilot record scoping (server/scope.mjs): starts its own pilot server (needs `npm run build` first), signs in
// one account per role, checks what each /api/state holds, and opens every screen each role can reach
// on that partial record without a page error or a broken screen.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });

function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server exited ${c}: ${out}`)); });
  });
}
// Screens per role (src/personas.js NAV), plus an advisor's student page.
const SCREENS = {
  student: ['map', 'studio', 'shared', 'inbox', 'links', 'activity', 'privacy', 'family', 'poster'],
  advisor: ['advisory', 'signals', 'student/st-01', 'student/st-09'],
  teacher: ['queue', 'crosslinks', 'depot', 'import'],
  counsellor: ['applications', 'letter', 'activities', 'search'],
  coordinator: ['cas', 'schoolline', 'core', 'governance', 'import'],
  leadership: ['dashboard', 'schoolmetro', 'profile', 'pdpa', 'rollout', 'pilot', 'audit', 'scan'],
  parent: ['family', 'consent', 'digest'],
};
const PEOPLE = [
  ['maya@x.th', 'Maya Chen', 'student', { studentId: 'st-01' }],
  ['pim@x.th', 'Pim Chaiyaporn', 'student', { studentId: 'st-09' }],
  ['whitfield@x.th', 'Mr James Whitfield', 'advisor', { teacherId: 't-07' }],
  ['nair@x.th', 'Ms Priya Nair', 'teacher', { teacherId: 't-01' }],
  ['adeyemi@x.th', 'Ms Ruth Adeyemi', 'counsellor', { teacherId: 't-09' }],
  ['brandt@x.th', 'Ms Clara Brandt', 'coordinator', { teacherId: 't-08' }],
  ['principal@x.th', 'Dr Anan Wongsakul', 'leadership', { teacherId: 't-10' }],
  ['nok@x.th', 'Khun Nok Chaiyaporn', 'parent', { children: ['st-06', 'st-09'] }],
];

(async () => {
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, fs.mkdtempSync(path.join(os.tmpdir(), 'tp-scope-')));
  const J = { 'content-type': 'application/json' };
  const post = (url, body, h = {}) => fetch(U + url, { method: 'POST', headers: { ...J, ...h }, body: JSON.stringify(body) });
  const cookieOf = (r) => r.headers.get('set-cookie').split(';')[0];
  const b = await chromium.launch();
  try {
    const admin = await post('/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'admin@x.th' });
    const AH = { cookie: cookieOf(admin) };
    for (const [email, name, kind, link] of PEOPLE) {
      const made = await (await post('/api/admin/accounts', { email, name, kind, ...link }, AH)).json();
      if (!made.setupUrl) { ok(false, `create ${kind}: ${JSON.stringify(made).slice(0, 200)}`); continue; }
      const su = await post('/api/auth/setup', { token: decodeURIComponent(made.setupUrl.split('/setup/')[1]), password: 'pass-12345' });
      const H = { cookie: cookieOf(su) };
      const store = (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
      const ids = new Set(store.students.map((s) => s.id));
      const evIds = new Set(store.events.map((e) => e.studentId));
      ok([...evIds].every((x) => ids.has(x)), `${name}: stations only for the ${ids.size} student(s) they receive`);
      if (kind === 'student') ok(ids.size === 1 && ids.has(link.studentId), `${name}: only their own record`);
      if (kind === 'parent') ok([...ids].sort().join() === 'st-06,st-09', `${name}: only their children`);
      if (kind === 'teacher' || kind === 'advisor') ok(!ids.has('st-09'), `${name}: not a student they do not work with`);
      if (kind !== 'student') ok(store.reflections.every((r) => r.visibility && r.visibility !== 'private'), `${name}: no private reflections`);

      const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } });
      await ctx.addCookies([{ name: 'tp_session', value: H.cookie.split('=')[1], url: U }]);
      const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.goto(U + '/#/'); await pg.waitForSelector('main.screen');
      const broken = [];
      for (const scr of SCREENS[kind]) {
        await pg.goto(`${U}/#/me/${scr}`); await pg.waitForTimeout(350);
        if (await pg.locator('text=This screen hit a problem').count()) broken.push(`${scr}: ${await pg.locator('.soon code').innerText().catch(() => '')}`);
      }
      ok(!broken.length, `${name} (${kind}): every screen renders${broken.length ? ' — ' + broken.join('; ') : ''}`);
      if (kind === 'advisor') { await pg.goto(`${U}/#/me/student/st-09`); await pg.waitForTimeout(300); ok(await pg.locator('text=not in your part of the record').count() === 1, `${name}: a student outside reach shows a plain message`); }
      // A change made on the partial record: replayed on the whole one, then this browser refetches its part.
      if (kind === 'teacher') {
        await pg.goto(`${U}/#/me/queue`); await pg.waitForSelector('.q-card');
        const n = await pg.locator('.q-card').count();
        await pg.locator('.q-card .q-actions .primary').first().click(); await pg.waitForTimeout(1500);
        const after = (await (await fetch(`${U}/api/state`, { headers: H })).json()).snapshot.store;
        ok(after.requests.filter((r) => r.teacherId === 't-01' && r.status === 'endorsed').length === 1 && await pg.locator('.q-card').count() === n - 1, `${name}: endorses on the partial record; the server and the page agree`);
      }
      ok(!errs.length, `${name}: no page errors ${errs.join('; ')}`);
      await ctx.close();
    }
  } catch (e) { ok(false, 'threw: ' + e.stack); }
  await b.close(); srv.p.kill();
})();
