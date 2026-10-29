// Thai for families, per person, on the school's real class lists: starts its own clean pilot server (needs
// `npm run build` first), imports the roster, prints the biggest advisory's family letters (Thai and English on each,
// still two to an A4 page), then two parents of different students join from their letters in separate browsers:
// one picks ไทย on the join page, the other stays in English. Each keeps their own language after a reload and on a
// second device; the Thai parent's family view, menus and notifications are in Thai, the other's in English. The
// sign-in page remembers ไทย before anyone signs in. ROSTER=<path> picks the file; without it the check is skipped.
// Screenshots and a PDF go to SCRATCH (or the temp folder), never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-thai-'));
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const THAI = /[฀-๿]/;

function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}

(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
  const count = {}; for (const s of roster.students) count[s.advisorId] = (count[s.advisorId] || 0) + 1;
  const [advId, n] = Object.entries(count).filter(([id]) => roster.teachers.find((t) => t.id === id)?.email).sort((a, b) => b[1] - a[1])[0];
  const advisor = roster.teachers.find((t) => t.id === advId);
  const port = await freePort(); const U = `http://localhost:${port}`;
  const srv = await start(port, path.join(SCRATCH, 'data'));
  const post = async (url, body, tok) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) }); return { r, j: await r.json() }; };
  const get = async (url, tok) => (await fetch(`${U}${url}`, { headers: tok ? { cookie: `tp_session=${tok}` } : {} })).json();
  const cookieOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
  const b = await chromium.launch();
  const ctxOf = async (token, vp = { width: 1300, height: 860 }) => { const c = await b.newContext({ viewport: vp }); if (token) await c.addCookies([{ name: 'tp_session', value: token, url: U }]); return c; };
  const errs = [];
  const watch = (pg) => pg.on('pageerror', (e) => errs.push(e.message));
  try {
    const adminTok = cookieOf((await post('/api/auth/setup', { token: srv.setup, password: 'pilot-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).r);
    const imp = (await post('/api/admin/roster', { roster }, adminTok)).j;
    ok(imp.newAccounts?.created?.length > 1000, `real roster imported: ${imp.newAccounts?.created?.length} accounts`);
    const linkOf = (email) => imp.newAccounts.created.find((a) => a.email === email).setupUrl.split('/setup/')[1];
    const advTok = cookieOf((await post('/api/auth/setup', { token: linkOf(advisor.email), password: 'pilot-pass-123' })).r);

    // ── Letters: Thai and English on each, two to an A4 page ──
    const cV = await ctxOf(advTok); const v = await cV.newPage(); watch(v);
    await v.goto(`${U}/#/me/advisory`); await v.click('text=Print family letters');
    await v.waitForSelector('.fl-panel .fl-row');
    await v.click(`.fl-panel button:has-text("Make ${n} letters")`); await v.waitForSelector('.fl-letter');
    ok(await v.locator('.fl-lang select').inputValue() === 'both', 'letters default to Thai and English');
    const both = await v.locator('.fl-letter').first().innerText();
    ok(/ถึงครอบครัวของ \S+/.test(both) && /Dear family of \S+/.test(both) && /เลือกแบ่งปันกับครอบครัว/.test(both) && /chooses to share with family/.test(both) && /ใช้ได้ถึงวันที่/.test(both) && /works until/.test(both), 'each letter: Thai paragraph and English paragraph, both expiries');
    const pages = await v.locator('.fl-page').count();
    ok(await v.locator('.fl-letter').count() === n && pages === Math.ceil(n / 2), `${n} letters on ${pages} pages, two a page`);
    const font = await v.evaluate(() => getComputedStyle(document.querySelector('.fl-part[lang="th"] p')).fontFamily);
    ok(/Sarabun/.test(font), `Thai paragraphs use a Thai font: ${font}`);
    await v.evaluate(() => document.fonts.ready);
    // Sarabun comes from Google Fonts (index.html): without the internet the browser's own Thai font stands in.
    console.log('INFO Sarabun loaded:', await v.evaluate(() => document.fonts.check('16px Sarabun', 'ครอบครัว')));
    await v.screenshot({ path: path.join(SCRATCH, 'letters-both.png') });
    await v.emulateMedia({ media: 'print' });
    const over = await v.evaluate(() => [...document.querySelectorAll('.fl-letter')].filter((e) => e.scrollHeight > e.clientHeight + 1).length);
    ok(over === 0, `print: every bilingual letter fits its half page (${over} overflow)`);
    const pdf = await v.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(SCRATCH, 'letters-both.pdf'), pdf);
    const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pdfPages === pages, `PDF has ${pdfPages} A4 pages for ${n} letters`);
    await v.emulateMedia({ media: 'screen' });
    await v.selectOption('.fl-lang select', 'en');
    const en = await v.locator('.fl-letter').first().innerText();
    ok(!THAI.test(en) && /Dear family of/.test(en), 'English only: no Thai');
    await v.selectOption('.fl-lang select', 'th');
    const th = await v.locator('.fl-letter').first().innerText();
    ok(/ถึงครอบครัวของ/.test(th) && !/Dear family|works until/.test(th), 'Thai only: no English letter text');
    const links = await v.locator('.fl-link').allInnerTexts();
    await v.click('.sc-bar button:has-text("Close")');

    // ── Two parents of different students, separate browsers ──
    const join = async (link, lang, name, email) => {
      const c = await ctxOf(null, { width: 390, height: 800 }); const p = await c.newPage(); watch(p);
      await p.goto(`http://${link.trim()}`); await p.waitForSelector('#fj-h');
      if (lang === 'th') { await p.click('.auth-lang button[lang="th"]'); }
      await p.fill('input[autocomplete=name]', name); await p.fill('input[type=email]', email);
      await p.fill('input[autocomplete=new-password] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete=new-password] >> nth=1', 'family-pass-1');
      const h = await p.locator('#fj-h').innerText();
      await p.click('form.auth-card button[type=submit]'); await p.waitForSelector('main.screen', { timeout: 15000 }); await p.waitForTimeout(800);
      return { c, p, h, tok: (await c.cookies()).find((k) => k.name === 'tp_session').value };
    };
    const A = await join(links[0], 'th', 'Nok Family', 'nok@family.example');
    const B = await join(links[1], 'en', 'Sam Family', 'sam@family.example');
    ok(/^ครอบครัวของ /.test(A.h), `join page in Thai: ${A.h}`);
    ok(/^Family of /.test(B.h), `join page in English: ${B.h}`);
    const meA = (await get('/api/auth/me', A.tok)).user; const meB = (await get('/api/auth/me', B.tok)).user;
    ok(meA.lang === 'th' && !meB.lang, `the account keeps the join page's choice: ${meA.lang} / ${meB.lang || 'not set (English)'}`);
    const fam = async (P) => (await P.p.locator('.page.family').innerText());
    ok(/แผนที่ของ/.test(await fam(A)) && await A.p.locator('.page.family[lang="th"]').count() === 1, 'parent A: the family view is in Thai');
    ok(/’s map/.test(await fam(B)) && !THAI.test((await fam(B)).replace(/ไทย/g, '')), 'parent B: the family view is in English');
    await A.p.screenshot({ path: path.join(SCRATCH, 'family-th.png') });
    await B.p.screenshot({ path: path.join(SCRATCH, 'family-en.png') });

    // B picks English explicitly, A switches to Thai from the family view again: nobody changes the other.
    await B.p.click('.fam-head .seg button[lang="en"]'); await B.p.waitForTimeout(500);
    ok((await get('/api/auth/me', B.tok)).user.lang === 'en' && (await get('/api/auth/me', A.tok)).user.lang === 'th', 'each toggle writes only its own account');
    await A.p.reload(); await A.p.waitForSelector('.page.family'); await B.p.reload(); await B.p.waitForSelector('.page.family');
    ok(/แผนที่ของ/.test(await fam(A)) && /’s map/.test(await fam(B)), 'after a reload each keeps theirs');

    // A second device for parent A: signs in with email and password, in Thai with nothing saved on that device.
    const c2 = await ctxOf(null); const p2 = await c2.newPage(); watch(p2);
    await p2.goto(`${U}/`); await p2.waitForSelector('#signin-h');
    ok(await p2.locator('#signin-h').innerText() === 'Sign in', 'a new device starts the sign-in page in English');
    await p2.fill('input[type=email]', 'nok@family.example'); await p2.fill('input[type=password]', 'family-pass-1');
    await p2.click('button[type=submit]'); await p2.waitForSelector('.page.family', { timeout: 15000 });
    ok(/แผนที่ของ/.test(await p2.locator('.page.family').innerText()), 'parent A on a second device: Thai, from the account');

    // ── Notifications: the students ask their families to look at consent; each bell in its own language ──
    const kids = [meA.children[0], meB.children[0]];
    for (const sid of kids) {
      const s = roster.students.find((x) => x.id === sid);
      const sTok = cookieOf((await post('/api/auth/setup', { token: linkOf(s.email), password: 'pilot-pass-123' })).r);
      const r = await post('/api/action', { fn: 'remindParent', args: [sid], rec: [] }, sTok);
      ok(r.r.status === 200, `${s.name.split(' ')[0]} asks their family to look at consent`);
    }
    const bell = async (pg) => { await pg.reload(); await pg.waitForSelector('.page.family'); await pg.click('.icon-btn.bell'); await pg.waitForSelector('.bell-menu'); return pg.locator('.bell-menu').innerText(); };
    const bA = await bell(A.p); const bB = await bell(B.p);
    const firstA = roster.students.find((x) => x.id === kids[0]).name.split(' ')[0];
    const firstB = roster.students.find((x) => x.id === kids[1]).name.split(' ')[0];
    ok(bA.includes(`${firstA} ขอให้คุณดูคำขอความยินยอม`) && /การแจ้งเตือนสำหรับ/.test(bA), `parent A's bell in Thai: ${bA.split('\n').slice(0, 3).join(' / ')}`);
    ok(bB.includes(`${firstB} asked you to look at a consent request`) && /Notifications for/i.test(bB), "parent B's bell in English");
    const note = (await get('/api/state', A.tok)).snapshot.store.notifications.find((x) => x.to === `fam:${kids[0]}`);
    ok(note && /asked you to look/.test(note.text), 'stored once, in English; only the rendering is Thai');
    await A.p.screenshot({ path: path.join(SCRATCH, 'bell-th.png') });
    // The account menu in Thai too.
    await A.p.keyboard.press('Escape'); await A.p.click('.persona-btn'); await A.p.waitForSelector('.acct-menu');
    ok(/ออกจากระบบ/.test(await A.p.locator('.acct-menu').innerText()), 'parent A: account menu in Thai');

    // ── The sign-in page remembers ไทย on this device, before anyone signs in ──
    const c3 = await ctxOf(null, { width: 390, height: 800 }); const p3 = await c3.newPage(); watch(p3);
    await p3.goto(`${U}/`); await p3.waitForSelector('#signin-h');
    await p3.click('.auth-lang button[lang="th"]');
    ok(await p3.locator('#signin-h').innerText() === 'เข้าสู่ระบบ', 'sign-in page switches to Thai');
    await p3.reload(); await p3.waitForSelector('#signin-h');
    ok(await p3.locator('#signin-h').innerText() === 'เข้าสู่ระบบ' && await p3.locator('.auth-page[lang="th"]').count() === 1, 'and remembers it after a reload');
    await p3.fill('input[type=email]', 'nobody@family.example'); await p3.fill('input[type=password]', 'wrong-pass-1'); await p3.click('button[type=submit]');
    await p3.waitForSelector('.auth-err');
    ok(await p3.locator('.auth-err').innerText() === 'อีเมลและรหัสผ่านไม่ตรงกัน', 'the server\'s answer in Thai');
    ok(await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'fits a phone screen');
    await p3.screenshot({ path: path.join(SCRATCH, 'signin-th.png') });

    // Students' own words are never translated: station titles stay as written (marked lang="en").
    ok(await A.p.evaluate(() => [...document.querySelectorAll('.page.family .pv-intro li button')].every((e) => e.lang === 'en')), "students' titles are left in their own words");
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots and PDF in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
