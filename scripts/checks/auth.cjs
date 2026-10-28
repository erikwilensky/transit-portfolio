// Pilot sign-in: starts its own pilot and demo servers (needs `npm run build` first), then checks
// first-run admin setup, a student account linked to a new student, role-only screens, sign-out,
// 401s for unsigned API calls, slowed failed sign-ins, forgot password → admin makes a new link,
// sign out everywhere, canAct, and that demo mode is unchanged.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
// Free ports picked at start, so this check never collides with a server already running.
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
let PILOT, DEMO;
const SH = os.tmpdir() + '/tp-auth-';

function start(port, mode, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: mode, DATA_DIR: dataDir } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server ${mode} did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/(http:\/\/\S+#\/setup\/\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup, log: () => out }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server ${mode} exited ${c}: ${out}`)); });
  });
}
const status = async (url, opts) => (await fetch(url, opts)).status;

(async () => {
  PILOT = Number(process.env.AUTH_PORT) || await freePort(); DEMO = await freePort();
  const dataP = fs.mkdtempSync(SH + 'pilot-'), dataD = fs.mkdtempSync(SH + 'demo-');
  const pilot = await start(PILOT, 'pilot', dataP);
  const demo = await start(DEMO, 'demo', dataD);
  const U = `http://localhost:${PILOT}`;
  const b = await chromium.launch();
  const errs = [];
  try {
    // ── Unsigned API calls ──
    ok(!!pilot.setup, 'first run prints a one-time admin setup link');
    ok(!/password/i.test(pilot.log().replace(/setup/gi, '')), 'no default password in the log');
    const me0 = await (await fetch(`${U}/api/auth/me`)).json();
    ok(me0.mode === 'pilot' && me0.user === null, 'GET /api/auth/me → pilot, signed out');
    for (const [m, u] of [['GET', '/api/state'], ['POST', '/api/action'], ['GET', '/api/stream'], ['POST', '/api/reset'], ['POST', '/api/upload'], ['GET', '/api/admin/accounts']]) ok(await status(U + u, { method: m }) === 401, `unsigned ${m} ${u} → 401`);
    ok(await status(`${U}/api/health`) === 200, 'GET /api/health stays open');
    ok(await status(`${U}/api/public/verify/x`) !== 401, '/api/public/* stays open');
    ok(await status(`${U}/api/files/nothing.png`) !== 401, 'GET /api/files/* stays open');
    ok(await status(`${U}/api/auth/login`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' }) === 403, 'cross-site POST refused');

    // ── Signed out: the sign-in screen, no persona switcher or tours ──
    const ctxA = await b.newContext({ viewport: { width: 1300, height: 860 } });
    const a = await ctxA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(U + '/#/maya/map'); await a.waitForSelector('.auth-card');
    ok(await a.locator('h1', { hasText: 'Sign in' }).count() === 1, 'signed out → sign-in screen');
    ok(await a.locator('.persona-btn, .tour-btn').count() === 0, 'no persona switcher or tours when signed out');
    await a.screenshot({ path: SH + 'signin.png' });

    // ── First-run admin setup ──
    await a.goto(pilot.setup); await a.waitForSelector('#setup-h');
    ok((await a.textContent('#setup-h')).includes('Set up the pilot'), 'setup link opens the first admin form');
    await a.fill('input[autocomplete=name]', 'Pat Admin'); await a.fill('input[type=email]', 'admin@nist.ac.th');
    const pw = a.locator('input[autocomplete=new-password]'); await pw.nth(0).fill('admin-pass-123'); await pw.nth(1).fill('admin-pass-123');
    await a.click('button[type=submit]'); await a.waitForSelector('.acc h1');
    ok(await a.locator('.topnav nav a', { hasText: 'Accounts' }).count() >= 1, 'admin signed in, sees Accounts');
    ok(await a.locator('.tour-btn').count() === 0, 'no pitch tour, presenter or reset in pilot');
    ok((await a.textContent('.persona-btn')).includes('Signed in'), 'header says Signed in, not Viewing as');
    ok(await status(pilot.setup.replace('/#/setup/', '/api/auth/setup/')) === 404, 'first-run link works only once');

    // ── Create a student account linked to a new Year 8 student ──
    await a.click('text=Add an account');
    await a.fill('.acc-form input >> nth=0', 'Ploy Srisuk'); await a.fill('.acc-form input[type=email]', 'ploy@nist.ac.th');
    await a.selectOption('.acc-form select >> nth=0', 'student');
    await a.selectOption('.acc-form select >> nth=1', '8');
    await a.click('text=Create and make a setup link'); await a.waitForSelector('.acc-link input');
    const link = await a.inputValue('.acc-link input');
    ok(/#\/setup\//.test(link), 'admin gets a one-time setup link: ' + link.replace(/setup\/.*/, 'setup/…'));
    ok(await a.locator('.acc-table td', { hasText: 'Ploy Srisuk · Year 8' }).count() === 1, 'account linked to the new student, Year 8');
    await a.screenshot({ path: SH + 'accounts.png' });
    const adminCookie = (await ctxA.cookies()).find((c) => c.name === 'tp_session');
    ok(adminCookie?.httpOnly && adminCookie.sameSite === 'Lax', 'session cookie is HttpOnly, SameSite=Lax');

    // ── The student signs in on another device ──
    const ctxS = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true });
    const s = await ctxS.newPage(); s.on('pageerror', (e) => errs.push(e.message));
    await s.goto(link); await s.waitForSelector('#setup-h');
    ok((await s.textContent('#setup-h')).includes('Welcome, Ploy'), 'student setup page greets them');
    const spw = s.locator('input[autocomplete=new-password]'); await spw.nth(0).fill('ploy-pass-123'); await spw.nth(1).fill('ploy-pass-123');
    await s.click('button[type=submit]'); await s.waitForSelector('.onboard');
    ok(true, 'new student lands on onboarding with an empty map');
    ok(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await s.screenshot({ path: SH + 'student-onboard.png' });
    const navText = await s.locator('.topnav').innerText();
    ok(!/Accounts|Dashboard|Endorsements|Advisory/.test(navText), 'student nav has no staff or admin screens');
    ok(/My journey/.test(navText) && !/Presentation studio/.test(navText), 'a Year 8 starts on the Simple interface');
    // Onboarding works on the new record: two interests, then on to the map.
    await s.locator('.ob-pick').nth(0).click(); await s.locator('.ob-pick').nth(1).click();
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.waitForSelector('.ob-foot .primary:not([disabled])', { timeout: 8000 }); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForTimeout(800);
    ok(await s.locator('.onboard').count() === 0 && await s.locator('.screen-map').count() === 1, 'onboarding finishes on their own map');
    await s.screenshot({ path: SH + 'student-map.png' });
    await s.goto(U + '/#/principal/dashboard'); await s.waitForTimeout(500);
    ok(await s.locator('.screen-map').count() === 1 && await s.locator('.dash').count() === 0, 'typing a staff address still shows only their own screens');
    ok(await s.locator('.tour-btn').count() === 0, 'no tours for the student');
    const sCookie = (await ctxS.cookies()).find((c) => c.name === 'tp_session');
    const H = { cookie: `tp_session=${sCookie.value}` };
    ok(await status(`${U}/api/admin/accounts`, { headers: H }) === 403, 'student cannot reach the admin API');
    ok(await status(`${U}/api/reset`, { method: 'POST', headers: H }) === 403, 'student cannot reset the record');
    const me1 = await (await fetch(`${U}/api/auth/me`, { headers: H })).json();
    ok(me1.user?.kind === 'student' && /^st-/.test(me1.user.studentId) && !('password' in me1.user), 'me → student account, no hash');

    // ── Sign out, sign back in, sign out ──
    await s.click('.persona-btn'); await s.click('.sign-out'); await s.waitForSelector('.auth-card h1');
    ok((await (await fetch(`${U}/api/auth/me`, { headers: H })).json()).user === null, 'signing out ends the session on the server');
    await s.fill('input[type=email]', 'ploy@nist.ac.th'); await s.fill('input[type=password]', 'ploy-pass-123'); await s.click('button[type=submit]');
    await s.waitForSelector('main.screen'); ok(await s.locator('.persona-btn .av').innerText() === 'PS', 'student signs in with email and password');
    await s.click('.persona-btn'); await s.click('.sign-out'); await s.waitForSelector('.auth-card h1'); ok(true, 'signed out again');

    // ── Repeated failures slow down, then stop ──
    const login = (pw) => fetch(`${U}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ploy@nist.ac.th', password: pw }) });
    for (let i = 0; i < 3; i++) await login('wrong');
    let t0 = Date.now(); const r4 = await login('wrong'); const slow = Date.now() - t0;
    ok(r4.status === 401 && slow >= 240, `4th wrong password is slowed (${slow} ms)`);
    for (let i = 0; i < 6; i++) await login('wrong');
    const locked = await login('ploy-pass-123');
    ok(locked.status === 429 && (await locked.json()).error === 'Too many tries. Wait 15 minutes or ask your teacher.', 'after 10 failures the email is locked for 15 minutes, in plain words');

    // ── Forgot password → the admin makes a new sign-in link ──
    const forgot = (email) => fetch(`${U}/api/auth/forgot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }).then(async (r) => [r.status, await r.text()]);
    ok(JSON.stringify(await forgot('nobody@nist.ac.th')) === JSON.stringify(await forgot('admin@nist.ac.th')), 'forgot: same answer for an unknown and a known email');
    await s.click('text=Forgot your password?'); await s.waitForSelector('#forgot-h');
    await s.fill('input[type=email]', 'ploy@nist.ac.th'); await s.click('text=Ask for a new link'); await s.waitForSelector('[role=status]');
    ok(/Ask your teacher or the pilot admin for a new sign-in link/.test(await s.textContent('[role=status]')), 'student is told to ask their teacher or the pilot admin');
    await s.screenshot({ path: SH + 'forgot.png' });
    await a.reload(); await a.waitForSelector('.acc-asked');
    const asked = await a.locator('.acc-asked li').allInnerTexts();
    ok(asked.length === 2 && asked.some((t) => t.includes('Ploy Srisuk')) && asked.some((t) => t.includes('Pat Admin')), 'Accounts shows the requests at the top');
    await a.screenshot({ path: SH + 'accounts-asked.png' });
    await a.locator('.acc-asked li', { hasText: 'Pat Admin' }).locator('text=Dismiss').click();
    await a.waitForFunction(() => document.querySelectorAll('.acc-asked li').length === 1);
    ok(true, 'Dismiss clears a request');
    await a.locator('.acc-asked li', { hasText: 'Ploy Srisuk' }).locator('text=Make a new sign-in link').click(); await a.waitForSelector('.acc-link input');
    const relink = await a.inputValue('.acc-link input');
    ok(/#\/setup\//.test(relink) && await a.locator('.acc-asked').count() === 0, 'admin makes a new sign-in link; the request is answered');
    await s.goto(relink); await s.waitForSelector('#setup-h');
    const rpw = s.locator('input[autocomplete=new-password]'); await rpw.nth(0).fill('ploy-new-pass-1'); await rpw.nth(1).fill('ploy-new-pass-1');
    await s.click('button[type=submit]'); await s.waitForSelector('main.screen');
    ok((await login('ploy-new-pass-1')).status === 200, 'the new link lifts the lock: signs in with the new password');
    ok((await login('ploy-pass-123')).status === 401, 'the old password has ended');

    // ── Own account menu: devices and sign out everywhere ──
    await a.click('.persona-btn'); await a.waitForSelector('.acct-devices');
    ok(/Signed in on this device only/.test(await a.locator('.acct-menu').innerText()), 'account menu says how many devices');
    await a.screenshot({ path: SH + 'account-menu.png' });
    await a.click('.persona-btn');
    await s.click('.persona-btn'); await s.waitForSelector('.sign-out-all');
    ok(/Signed in on \d+ devices/.test(await s.locator('.acct-menu').innerText()), 'student signed in on several devices sees the count');
    await s.click('.sign-out-all'); await s.waitForSelector('.auth-card h1');
    ok((await login('ploy-new-pass-1')).status === 200, 'sign out everywhere, then back in');

    // ── canAct (the per-role check /api/action can call) ──
    process.env.DATA_DIR = fs.mkdtempSync(SH + 'unit-');
    const A = await import(path.join(ROOT, 'server/auth.mjs'));
    const st = { kind: 'student', studentId: 'st-01' };
    ok(A.canAct(st, 'addStation', ['st-01', {}]) && !A.canAct(st, 'addStation', ['st-02', {}]), 'canAct: student adds only to their own map');
    ok(A.canAct(st, 'editStation', ['ev-042', {}]) && !A.canAct({ kind: 'student', studentId: 'st-02' }, 'editStation', ['ev-042', {}]), 'canAct: a station can be edited only by its own student');
    ok(!A.canAct(st, 'endorse', [['rq-1'], 't-01', 'x']) && !A.canAct(st, 'resetDemo', []), 'canAct: student cannot endorse or reset');
    ok(A.canAct({ kind: 'teacher', teacherId: 't-01' }, 'endorse', [[], 't-01']) && !A.canAct({ kind: 'teacher' }, 'addStudent', [{}]), 'canAct: staff act, only admins add records');
    ok(A.canAct({ kind: 'admin', admin: true }, 'resetDemo', []) && !A.canAct(null, 'addStation', ['st-01']), 'canAct: admin yes, nobody signed in no');

    // ── Demo mode is unchanged ──
    const meD = await (await fetch(`http://localhost:${DEMO}/api/auth/me`)).json();
    ok(meD.mode === 'demo', 'demo server says mode demo');
    ok(await status(`http://localhost:${DEMO}/api/admin/accounts`) === 401, 'demo has no admin without sign-in');
    const d = await (await b.newContext({ viewport: { width: 1300, height: 860 } })).newPage(); d.on('pageerror', (e) => errs.push(e.message));
    await d.goto(`http://localhost:${DEMO}/#/maya/map`); await d.waitForSelector('.persona-btn');
    ok((await d.textContent('.persona-btn')).includes('Viewing as') && await d.locator('.tour-btn').count() === 1, 'demo: Viewing as switcher and pitch tour');
    ok(await d.locator('.auth-card').count() === 0, 'demo: no sign-in');
  } catch (e) { ok(false, 'threw: ' + e.message); }
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close(); pilot.p.kill(); demo.p.kill();
})();
