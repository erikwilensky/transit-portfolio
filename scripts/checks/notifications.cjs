// Notifications for pilot people: starts its own pilot server (needs `npm run build` first), makes a new
// teacher and a new student, the student asks for an endorsement, the teacher's bell shows it live, the
// teacher endorses from the queue, the student's bell shows that live, and marking read is allowed.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const PORT = process.env.NOTIFY_PORT || 20000 + Math.floor(Math.random() * 20000), U = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-notify-'));
let srv = null; process.on('exit', () => srv?.kill());
const start = () => new Promise((res, rej) => {
  const s = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT, DATA_DIR: DATA, TP_MODE: 'pilot' } });
  let out = ''; s.stdout.on('data', (d) => { out += d; if (/server on/.test(out)) res({ s, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); });
  s.stderr.on('data', (d) => process.stderr.write(d)); s.on('exit', (c) => rej(new Error(`server exited ${c}: ${out}`)));
});
const until = async (f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
async function call(method, url, body, cookie) {
  const r = await fetch(U + url, { method, headers: { 'content-type': 'application/json', origin: U, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const c = (r.headers.get('set-cookie') || '').match(/tp_session=[^;]+/)?.[0];
  return { status: r.status, json: await r.json().catch(() => ({})), cookie: c };
}
const setupToken = (url) => decodeURIComponent(url.split('#/setup/')[1]);

(async () => {
  const { s, setup } = await start(); srv = s;
  const admin = (await call('POST', '/api/auth/setup', { token: decodeURIComponent(setup), password: 'admin-pass-123', name: 'Pat Admin', email: 'admin@nist.ac.th' })).cookie;
  ok(!!admin, 'admin set up');
  const mk = async (body, pw) => {
    const r = await call('POST', '/api/admin/accounts', body, admin);
    const done = await call('POST', '/api/auth/setup', { token: setupToken(r.json.setupUrl), password: pw }, null);
    return { account: r.json.account, cookie: done.cookie, user: done.json.user };
  };
  const T = await mk({ name: 'Mr Ben Okoro', email: 'ben@nist.ac.th', kind: 'teacher', newTeacher: { name: 'Mr Ben Okoro', role: 'Physics' } }, 'teacher-pass-123');
  const S = await mk({ name: 'Ada Pilot', email: 'ada@nist.ac.th', kind: 'student', newStudent: { name: 'Ada Pilot', year: 12, programme: 'IB Diploma' } }, 'student-pass-123');
  const tid = T.user?.teacherId, sid = S.user?.studentId;
  ok(/^t-/.test(tid) && /^st-/.test(sid), `new teacher ${tid} and student ${sid}`);
  ok((await call('POST', '/api/action', { fn: 'completeOnboarding', args: [sid, ['science', 'computing'], 'general'] }, S.cookie)).status === 200, 'student finishes onboarding');

  const b = await chromium.launch(); const errs = [];
  const page = async (cookie, hash) => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } });
    await ctx.addCookies([{ name: 'tp_session', value: cookie.split('=')[1], url: U }]);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${U}/#/${hash}`); await p.waitForSelector('main.screen'); return p;
  };
  try {
    const tp = await page(T.cookie, 'me/queue'), sp = await page(S.cookie, 'me/map');
    const title = `Pilot notify ${Date.now().toString(36)}`;
    ok((await call('POST', '/api/action', { fn: 'addStation', args: [sid, { title, lineIds: ['science'], requestFrom: tid }] }, S.cookie)).status === 200, 'student asks the new teacher to endorse');
    ok(await until(async () => (await tp.locator('.bell .badge').count()) > 0), 'teacher bell shows an unread count live');
    await tp.click('.bell');
    ok(await until(() => tp.locator(`.bell-menu >> text=Ada asked you to endorse “${title}”`).count()), 'teacher sees “Ada asked you to endorse”');
    await tp.waitForTimeout(1800);
    const st = async () => (await (await fetch(`${U}/api/state`, { headers: { cookie: T.cookie } })).json()).snapshot.store;
    ok(await until(async () => (await st()).notifications.filter((n) => n.to === `t:${tid}`).every((n) => n.read)), 'opening the bell marks the teacher’s notifications read on the server');
    await tp.click('.bell');
    await tp.locator(`.q-card[aria-label*="${title}"] >> text=Endorse`).last().click();
    ok(await until(async () => (await sp.locator('.bell .badge').count()) > 0), 'student bell shows an unread count live');
    await sp.click('.bell');
    ok(await until(() => sp.locator(`.bell-menu >> text=Mr Ben Okoro endorsed “${title}”`).count()), 'student sees “Mr Ben Okoro endorsed”');
    await sp.locator('.bell-menu button', { hasText: 'endorsed' }).first().click();
    ok(await until(async () => /#\/me\/map\/ev-/.test(sp.url())), 'clicking it opens the station on their own map');
    const forged = await call('POST', '/api/action', { fn: 'markNotificationsRead', args: [[`t:${tid}`]] }, S.cookie);
    ok(forged.status === 403, 'a student cannot mark the teacher’s bell read');
    ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  } finally { await b.close(); srv.kill(); }
})().catch((e) => { console.error(e); process.exitCode = 1; srv?.kill(); });
