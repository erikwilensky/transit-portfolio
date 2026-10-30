// Polish round: a Thai parent reads the refused-change bar in Thai, an English parent in English (pilot, the fixture
// class lists); the demo's moderator personas (coordinator, counsellor, leadership) have Reports in their navigation
// and it opens the safeguarding queue. Needs `npm run build` first; starts its own pilot and demo servers.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
const TMP = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-polish-'));
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const THAI = /[฀-๿]/;
const servers = [];
function start(port, mode) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(port), TP_MODE: mode, DATA_DIR: fs.mkdtempSync(path.join(TMP, `${mode}-`)), LOG_REQUESTS: '0', ...(mode === 'pilot' ? { TP_START: 'empty' } : {}) };
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env });
    servers.push(p);
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  try {
    // ── Pilot: two parents of the same student, one Thai and one English, each in their own browser ──
    const port = await freePort(); const U = `http://localhost:${port}`;
    const srv = await start(port, 'pilot');
    const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json() }; };
    const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    ok((await post('/api/admin/roster', { roster: ROSTER }, adminTok)).r.status === 200, 'fixture class lists imported');
    const parent = async (name, email, lang) => {
      const c = (await post('/api/admin/accounts', { kind: 'parent', name, email, children: ['S2002'] }, adminTok)).j;
      const tok = cookieOf((await post('/api/auth/setup', { token: c.setupUrl.split('/setup/')[1], password: 'family-pass-1' })).r);
      if (lang) await post('/api/auth/prefs', { lang }, tok);
      const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
      await ctx.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${U}/`); await p.waitForSelector('.page.family', { timeout: 15000 });
      return p;
    };
    const th = await parent('Nok Hale', 'nok@family.example', 'th');
    const en = await parent('Sam Hale', 'sam@family.example', null);
    // What src/sync.js sends when the server refuses a change (403 from canAct).
    const refuse = (p) => p.evaluate(() => dispatchEvent(new CustomEvent('tp-refused', { detail: { status: 403, error: 'Not allowed for your account' } })));
    await refuse(th); await refuse(en);
    await th.waitForSelector('.rf-bar'); await en.waitForSelector('.rf-bar');
    const barTh = await th.locator('.rf-bar').innerText(), barEn = await en.locator('.rf-bar').innerText();
    ok(/การแก้ไขนั้นยังไม่ได้บันทึก/.test(barTh) && /บัญชีของคุณทำสิ่งนี้ไม่ได้/.test(barTh) && /ตกลง/.test(barTh) && !/[A-Za-z]{3}/.test(barTh), `Thai parent: refused bar in Thai: ${barTh.replace(/\n/g, ' ')}`);
    ok(await th.locator('.rf-bar[lang="th"]').count() === 1, 'Thai parent: the bar is marked lang="th"');
    ok(/That change was not saved: Not allowed for your account\./.test(barEn) && !THAI.test(barEn), `English parent: refused bar in English: ${barEn.replace(/\n/g, ' ')}`);
    await th.click('.rf-bar button'); ok(await th.locator('.rf-bar').count() === 0, 'ตกลง closes it');
    await th.screenshot({ path: path.join(TMP, 'refused-th.png') });

    // ── Demo: Reports in the moderators' navigation ──
    const dport = await freePort(); const D = `http://localhost:${dport}`;
    await start(dport, 'demo');
    for (const [id, who] of [['brandt', 'coordinator'], ['adeyemi', 'counsellor'], ['principal', 'leadership']]) {
      const ctx = await b.newContext({ viewport: { width: 1300, height: 860 } });
      const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${D}/#/${id}`); await p.waitForSelector('nav.navbar');
      const labels = await p.locator('nav.navbar .nav-measure a').allTextContents();
      ok(labels.includes('Reports') && labels.filter((l) => l === 'Reports').length === 1, `demo ${who}: Reports in the nav once (${labels.join(', ')})`);
      await p.goto(`${D}/#/${id}/reports`); await p.waitForSelector('.sg-page h1');
      ok(await p.locator('.sg-page h1').innerText() === 'Reports' && await p.locator('.sg-tabs').count() === 1, `demo ${who}: Reports opens the safeguarding queue`);
      await ctx.close();
    }
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.goto(`${D}/#/nair`); await p.waitForSelector('nav.navbar');
    ok(!(await p.locator('nav.navbar .nav-measure a').allTextContents()).includes('Reports'), 'demo subject teacher: no Reports');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } catch (e) { ok(false, e.stack || String(e)); } finally {
    await b.close(); for (const s of servers) s.kill();
    console.log('INFO screenshots in', TMP);
  }
})();
