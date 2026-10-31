// Families read only, on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and
// imports the real roster. Families do not act in the app (parents use email). Aaron Torres (Year 8)
// needs family consent: his parent joins from the family letter in Thai and the Consent page only says it is waiting and to
// email the advisor (no buttons). Ms Jane Altemen records "Family consent on file" on My advisory (date, how). The parent's
// page then says it is on file and how; Aaron's Privacy page says so too. The parent's account menu has no Feedback (staff
// keep it); language still changes. Every write a family could try is refused (403). axe on each screen. Each account has
// its own browser context. TP_ROSTER=/path/to/transit-roster.json (default: the project mount).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const TID = 'T25948', AARON = 'Sabc0d6125e85';
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
const tokOf = (r) => r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? `\n${bad.map((x) => `    ${x.impact} ${x.id}: ${x.nodes.slice(0, 4).join(', ')}`).join('\n')}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(os.tmpdir() + '/tp-famro-data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = []; const watch = (p, who) => p.on('pageerror', (e) => errs.push(`${who}: ${e.message}`));
  const ctx = async (tok, vp = { width: 1300, height: 900 }, extra = {}) => { const c = await b.newContext({ viewport: vp, ...extra }); if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); return c; };
  try {
    const post = (url, body, tok) => fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { cookie: `tp_session=${tok}` } : {}) }, body: JSON.stringify(body) });
    const act = (tok, fn, args) => post('/api/action', { fn, args, rec: [] }, tok);
    const setupWith = async (token, extra = {}) => tokOf(await post('/api/auth/setup', { token, password: 'pilot-pass-123', ...extra }));
    const adminTok = await setupWith(srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await post('/api/admin/roster', { roster }, adminTok)).json();
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const advisor = roster.teachers.find((t) => t.id === TID), aaron = roster.students.find((s) => s.id === AARON);
    ok(advisor && aaron && aaron.advisorId === TID, `${advisor?.name} advises ${aaron?.name} (Year ${aaron?.year})`);
    const tTok = await setupWith(links[advisor.email]);
    const aTok = await setupWith(links[aaron.email]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'art'], 'classic'])).ok, 'Aaron is set up');

    // ── The parent joins in Thai: consent is waiting, and there is nothing to press ──
    const lt = await (await post('/api/advisor/family/letters', { studentIds: [AARON] }, tTok)).json();
    const cP = await ctx(null, { width: 390, height: 820 }, { hasTouch: true, isMobile: true }); const p = await cP.newPage(); watch(p, 'parent');
    await p.goto(lt.letters[0].url.replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('#fj-h');
    await p.click('.auth-lang button[lang="th"]');
    await p.fill('input[autocomplete=name]', 'Maria Torres'); await p.fill('input[type=email]', 'maria.torres@family.example');
    await p.fill('input[autocomplete=new-password] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete=new-password] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type=submit]'); await p.waitForSelector('.fam-head', { timeout: 15000 });
    const pTok = (await cP.cookies()).find((k) => k.name === 'tp_session').value;
    await p.goto(`${U}/#/me/consent/${AARON}`); await p.waitForSelector('.page.family .fam-older');
    const c1 = await p.locator('.page.family').innerText();
    ok(/รอความยินยอม/.test(c1) && /ส่งอีเมลถึงครูที่ปรึกษาของ Aaron/.test(c1), 'Consent page in Thai: waiting, email the advisor');
    ok(await p.locator('.page.family main button, .page.family .cr-btns, .page.family .fam-older button:not(.ghost)').count() === 0, 'no consent buttons');
    await audit(p, 'family: consent, waiting (Thai, phone)');
    await p.click('.persona-btn'); await p.waitForSelector('.acct-menu');
    ok(await p.locator('.acct-menu .fb-menu').count() === 0, 'the family account menu has no Feedback');
    await p.keyboard.press('Escape');
    ok((await post('/api/feedback', { kind: 'idea', message: 'More photos please' }, pTok)).status === 403, 'and /api/feedback refuses a family (403)');
    const refused = [];
    for (const [fn, args] of [['recordFamilyConsent', [AARON, { on: true, date: '2026-10-01', how: 'email' }, null]], ['reportItem', [{ eventId: 'ev' }, 'other', '', { key: `fam:${AARON}` }]],
      ['setFamily', [{ email: true }]], ['addStation', [AARON, { title: 'x' }]]]) {
      if ((await act(pTok, fn, args)).status !== 403) refused.push(fn);
    }
    ok(!refused.length, `every family write is refused (403)${refused.length ? `: not ${refused.join(', ')}` : ''}`);

    // ── Ms Altemen records consent on My advisory ──
    const cT = await ctx(tTok); const t = await cT.newPage(); watch(t, 'advisor');
    await t.goto(`${U}/#/me/advisory`); await t.waitForSelector('.yh-open button:has-text("Family consent")');
    ok(/23 of 23 without family consent on file/.test(await t.locator('.yh-open:has-text("Family consent")').innerText()), 'My advisory: 23 of 23 without family consent');
    await t.click('.yh-open button:has-text("Family consent")'); await t.waitForSelector('.fc-panel');
    const row = t.locator('.fc-row', { hasText: aaron.name });
    await row.locator('button:has-text("Family consent on file")').click();
    await row.locator('input[type=date]').fill('2026-10-28');
    await row.locator('select').selectOption('paper');
    await row.locator('.fc-note input').fill('Signed form in the student file');
    await audit(t, 'advisor: family consent form');
    await row.locator('button:has-text("Save")').click();
    const rec = await until(async () => saved().familyConsent?.[AARON]);
    ok(rec && rec.on && rec.date === '2026-10-28' && rec.how === 'paper' && rec.by === TID, 'saved: on file, 28 Oct, on paper, by the advisor');
    await row.locator('small:has-text("Family consent on file")').waitFor();
    ok(/On paper/.test(await row.innerText()), 'the row says on file, on paper');
    ok(!saved().notifications.some((n) => n.to.startsWith('fam:')), 'nobody is notified in the app');
    ok((await act(adminTok, 'recordFamilyConsent', [AARON, { on: true, date: '2026-10-28', how: 'paper' }, null])).status === 200, 'an admin may record it too');

    // ── The parent and Aaron see it, read only ──
    await p.reload(); await p.waitForSelector('.page.family .fam-older');
    const c2 = await p.locator('.page.family').innerText();
    ok(/มีความยินยอมแล้ว/.test(c2) && /โรงเรียนบันทึกไว้เมื่อ/.test(c2) && /ทางเอกสาร/.test(c2), 'the parent: on file, recorded by the school, on paper (Thai)');
    await audit(p, 'family: consent, on file (Thai, phone)');
    await p.click('.fam-head .seg button[lang="en"]'); await p.waitForTimeout(500);
    ok(/Consent on file/.test(await p.locator('.page.family').innerText()), 'the parent still changes their own language');
    const cA = await ctx(aTok); const a = await cA.newPage(); watch(a, 'Aaron');
    await a.goto(`${U}/#/me/privacy`); await a.waitForSelector('.pv-consent');
    const pv = await a.locator('.pv-consent').innerText();
    ok(/Parent consent on file/.test(pv) && /Recorded by the school/.test(pv) && !/reminder/i.test(pv), 'Aaron’s Privacy page: on file, recorded by the school, no reminder button');
    await a.click('.persona-btn'); await a.waitForSelector('.acct-menu');
    ok(await a.locator('.acct-menu .fb-menu').count() === 1, 'students keep Feedback');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally {
    await b.close(); srv?.p.kill();
  }
})().catch((e) => { console.error(e); srv?.p.kill(); process.exit(1); });
