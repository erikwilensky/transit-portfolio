// PDPA copy and erasure, and the pilot usage page. Starts its own pilot and demo servers (needs `npm run build`).
// A student's ZIP has their items and no one else's; parents get only their children; the admin removes a
// student with the type-the-name confirm and nothing of them is left; leadership sees usage and downloads a CSV.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const SH = os.tmpdir() + '/tp-pdpa-';

function start(port, mode, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: mode, DATA_DIR: dataDir, LOG_REQUESTS: '0', USAGE_SAVE_MS: '100' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server ${mode} did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => { clearTimeout(t); reject(new Error(`server ${mode} exited ${c}: ${out}`)); });
  });
}
// Stored-only ZIP reader (the server writes no compression).
function unzip(buf) {
  const out = {};
  for (let i = 0; buf.readUInt32LE(i) === 0x04034b50;) {
    const size = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26), x = buf.readUInt16LE(i + 28);
    out[buf.subarray(i + 30, i + 30 + n).toString()] = buf.subarray(i + 30 + n + x, i + 30 + n + x + size);
    i += 30 + n + x + size;
  }
  return out;
}

(async () => {
  const PORT = await freePort(), DEMO = await freePort();
  const DATA = fs.mkdtempSync(SH + 'pilot-');
  const pilot = await start(PORT, 'pilot', DATA);
  const demo = await start(DEMO, 'demo', fs.mkdtempSync(SH + 'demo-'));
  const U = `http://localhost:${PORT}`;
  const jar = {};
  const api = async (who, method, url, body, raw) => {
    const r = await fetch(U + url, { method, headers: { ...(jar[who] ? { cookie: jar[who] } : {}), ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...(raw || {}) }, body: body && !raw ? JSON.stringify(body) : body });
    const c = r.headers.get('set-cookie'); if (c) jar[who] = c.split(';')[0];
    return r;
  };
  const json = async (...a) => (await api(...a)).json();
  const setupAs = async (who, setupUrl, password) => api(who, 'POST', '/api/auth/setup', { token: setupUrl.split('#/setup/')[1], password });
  const b = await chromium.launch();
  const errs = [];
  try {
    // ── Accounts: admin, a new Year 10 student, Arun (seeded), leadership, a parent of Kit and Maya ──
    await api('admin', 'POST', '/api/auth/setup', { token: pilot.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'admin@nist.ac.th' });
    const kitA = await json('admin', 'POST', '/api/admin/accounts', { email: 'kit@nist.ac.th', name: 'Kit Wongsa', kind: 'student', newStudent: { name: 'Kit Wongsa', year: 10 } });
    const kit = kitA.account.studentId;
    await setupAs('kit', kitA.setupUrl, 'kit-pass-123');
    const arunA = await json('admin', 'POST', '/api/admin/accounts', { email: 'arun@nist.ac.th', name: 'Arun Mehta', kind: 'student', studentId: 'st-02' });
    await setupAs('arun', arunA.setupUrl, 'arun-pass-123');
    const headA = await json('admin', 'POST', '/api/admin/accounts', { email: 'head@nist.ac.th', name: 'Dr Anan Wongsakul', kind: 'leadership', teacherId: 't-10' });
    await setupAs('head', headA.setupUrl, 'head-pass-123');
    const momA = await json('admin', 'POST', '/api/admin/accounts', { email: 'mum@example.com', name: 'Khun Mali', kind: 'parent', children: [kit, 'st-01'] });
    await setupAs('mum', momA.setupUrl, 'mum-pass-123');
    ok(!!kit && jar.kit && jar.head && jar.mum, 'admin made a student, leadership and parent account');

    // ── Kit adds a station with an uploaded file and a reflection ──
    const up = await (await api('kit', 'POST', '/api/upload', Buffer.from('%PDF-1.4 kit'), { 'content-type': 'application/pdf', 'x-filename': 'kit-report.pdf' })).json();
    ok(/^\/api\/files\//.test(up.url), 'Kit uploads a PDF');
    const st = await json('kit', 'POST', '/api/action', { fn: 'addStation', args: [kit, { title: 'KIT-STATION', lineIds: ['science'], files: [{ kind: 'pdf', url: up.url, caption: 'Report' }] }], rec: [] });
    await api('kit', 'POST', '/api/action', { fn: 'addReflection', args: [{ studentId: kit, eventId: st.result.id, prompt: 'p', text: 'KIT-PRIVATE-THOUGHT', visibility: 'private' }], rec: [] });
    await api('arun', 'POST', '/api/action', { fn: 'addStation', args: ['st-02', { title: 'ARUN-STATION', lineIds: ['science'] }], rec: [] });
    ok((await api('kit', 'POST', '/api/action', { fn: 'eraseStudent', args: [kit], rec: [] })).status === 400, 'eraseStudent is refused through /api/action');

    // ── Copies: who may download whose ──
    const zipOf = async (who, url) => { const r = await api(who, 'GET', url); return { status: r.status, type: r.headers.get('content-type'), files: r.ok ? unzip(Buffer.from(await r.arrayBuffer())) : null }; };
    const mine = await zipOf('kit', '/api/me/export');
    ok(mine.status === 200 && mine.type === 'application/zip', 'student downloads their own copy as a ZIP');
    const text = Object.entries(mine.files).filter(([n]) => /\.(json|txt)$/.test(n)).map(([, d]) => d.toString()).join('\n');
    ok(mine.files['README.txt'] && /Kit Wongsa/.test(mine.files['README.txt']) && /events\.json/.test(mine.files['README.txt']), 'the copy has a README naming each file');
    ok(text.includes('KIT-STATION') && text.includes('KIT-PRIVATE-THOUGHT'), 'the copy has their station and private reflection');
    ok(mine.files[`files/${up.url.split('/').pop()}`]?.toString() === '%PDF-1.4 kit', 'the copy has their uploaded file');
    ok(!text.includes('ARUN-STATION') && !/"st-0\d"/.test(text), 'the copy has nothing of another student');
    ok(!/"hash"|"salt"/.test(text), 'no password hashes in the copy');
    const sneaky = await zipOf('kit', '/api/me/export?student=st-02');
    ok(sneaky.status === 200 && !Object.values(sneaky.files).join('').includes('ARUN-STATION'), 'a student asking for another student still gets only their own');
    ok((await zipOf('mum', `/api/me/export?student=${kit}`)).status === 200, 'a parent downloads their child\'s copy');
    ok((await zipOf('mum', '/api/me/export?student=st-02')).status === 403, 'a parent cannot download another child\'s copy');
    ok((await zipOf('head', '/api/me/export')).status === 403 && (await zipOf('head', '/api/admin/students/st-02/export')).status === 403, 'leadership (not admin) cannot download a student\'s copy');
    const arunCopy = await zipOf('admin', '/api/admin/students/st-02/export');
    ok(arunCopy.status === 200 && Object.values(arunCopy.files).join('').includes('ARUN-STATION'), 'the admin downloads any student\'s copy');
    ok((await api(null, 'GET', '/api/me/export')).status === 401, 'unsigned → 401');

    // ── Usage API ──
    ok((await api('kit', 'GET', '/api/admin/usage')).status === 403, 'a student cannot read usage');
    const use = await json('head', 'GET', '/api/admin/usage');
    const kitRow = use.people.find((p) => p.name === 'Kit Wongsa');
    ok(kitRow?.stations === 1 && kitRow.reflections === 1 && kitRow.status === 'today', 'usage counts Kit\'s station and reflection, active today');
    ok(use.byYear['Year 10']?.stations === 1 && use.byRole.student.people === 2, 'usage by Year group and by role');
    ok(!JSON.stringify(use).includes('KIT-STATION'), 'usage carries no content');

    // ── Leadership: the usage page and its CSV ──
    const ctxH = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
    const h = await ctxH.newPage(); h.on('pageerror', (e) => errs.push(e.message));
    await h.goto(U + '/'); await h.fill('input[type=email]', 'head@nist.ac.th'); await h.fill('input[type=password]', 'head-pass-123'); await h.click('button[type=submit]');
    await h.waitForSelector('main.screen');
    await h.goto(U + '/#/principal/usage'); await h.waitForSelector('.usage h1');
    ok((await h.textContent('.usage h1')).includes('Who is using the pilot'), 'leadership opens Pilot usage');
    ok(await h.locator('.us-chart svg .us-bar').count() >= 1, 'a weekly chart is drawn');
    ok(await h.locator('.us-table td', { hasText: 'Kit Wongsa' }).count() === 1, 'Kit is listed with their activity');
    await h.locator('.us-chart svg g[tabindex]').last().hover();
    ok(/active/.test(await h.textContent('.us-tip')), 'pointing at a week shows its numbers');
    const [dl] = await Promise.all([h.waitForEvent('download'), h.click('text=Download as CSV')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(/^﻿?Name,Role,Year group/.test(csv) && /Kit Wongsa,Students,Year 10/.test(csv), 'Download as CSV gives one row per person');
    await h.screenshot({ path: SH + 'usage.png', fullPage: true });
    await h.setViewportSize({ width: 390, height: 800 }); await h.waitForTimeout(300);
    ok(await h.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'usage page: no sideways scroll at phone width');
    await h.screenshot({ path: SH + 'usage-phone.png', fullPage: true });
    await h.goto(U + '/#/principal/pilot'); await h.waitForSelector('.pilot');
    ok(await h.locator('text=See who is using the pilot').count() === 1, 'Pilot options links to usage in pilot mode');

    // ── Admin: remove Kit with the two-step confirm ──
    const ctxA = await b.newContext({ viewport: { width: 1300, height: 900 } });
    const a = await ctxA.newPage(); a.on('pageerror', (e) => errs.push(e.message));
    await a.goto(U + '/'); await a.fill('input[type=email]', 'admin@nist.ac.th'); await a.fill('input[type=password]', 'admin-pass-123'); await a.click('button[type=submit]');
    await a.waitForSelector('.acc h1');
    await a.selectOption('.acc-data select', kit);
    ok(await a.getAttribute('.acc-data a.auth-btn', 'href') === `/api/admin/students/${kit}/export`, 'Accounts offers the student\'s data as a download');
    await a.click('text=Remove this student…');
    ok(/30 days/.test(await a.textContent('.acc-erase')), 'the confirm reminds that backups hold the data for 30 days');
    const go = a.locator('.acc-erase button.danger');
    ok(await go.isDisabled(), 'remove is disabled until the name is typed');
    await a.fill('.acc-erase input', 'Kit Wong'); ok(await go.isDisabled(), 'a wrong name keeps it disabled');
    await a.fill('.acc-erase input', 'kit wongsa'); ok(!(await go.isDisabled()), 'the right name enables it');
    await a.screenshot({ path: SH + 'erase-confirm.png', fullPage: true });
    await go.click(); await a.waitForSelector('.acc-erase', { state: 'detached' });
    await a.waitForTimeout(400);
    const snap = JSON.stringify((await json('admin', 'GET', '/api/state')).snapshot);
    ok(!snap.includes(kit) && !snap.includes('KIT-') && !snap.includes('Kit Wongsa'), 'nothing of Kit is left in the record');
    ok(snap.includes('ARUN-STATION') && snap.includes('"st-01"'), 'other students are untouched');
    ok((await api(null, 'GET', up.url)).status === 404, 'Kit\'s uploaded file is deleted');
    ok((await api(null, 'POST', '/api/auth/login', { email: 'kit@nist.ac.th', password: 'kit-pass-123' })).status === 401, 'Kit\'s account is gone');
    const accts = (await json('admin', 'GET', '/api/admin/accounts')).accounts;
    ok(JSON.stringify(accts.find((x) => x.email === 'mum@example.com')?.children) === '["st-01"]', 'the parent keeps only their other child');
    ok(await a.locator('.acc-table td', { hasText: 'Kit Wongsa' }).count() === 0, 'Accounts no longer lists Kit');
    const audit = fs.readFileSync(path.join(DATA, 'audit.log'), 'utf8');
    ok(/"action":"erase"/.test(audit) && audit.includes(kit) && !audit.includes('Kit'), 'audit log line: who, when, which id, no content');
    ok(!(await json('head', 'GET', '/api/admin/usage')).people.some((p) => p.name === 'Kit Wongsa'), 'usage no longer lists Kit');

    // ── Demo mode: no usage screen ──
    const d = await (await b.newContext({ viewport: { width: 1300, height: 860 } })).newPage(); d.on('pageerror', (e) => errs.push(e.message));
    await d.goto(`http://localhost:${DEMO}/#/principal/usage`); await d.waitForSelector('main.screen');
    ok(await d.locator('.usage').count() === 0 && await d.locator('.persona-btn', { hasText: 'Viewing as' }).count() === 1, 'demo: no usage page, persona switcher as before');
  } catch (e) { ok(false, 'threw: ' + e.message); }
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close(); pilot.p.kill(); demo.p.kill();
})();
