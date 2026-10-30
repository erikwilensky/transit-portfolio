// Teacher comment bank on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first) and
// imports the real roster. A coordinator publishes a school phrase on My phrases; Mr David Coultas adds his own, then on
// Aaron Torres's moment in Endorsements puts a phrase in his comment and the school phrase in his endorsement note, all by
// keyboard (filter as you type, arrows, Enter), saves a phrase from the comment box, and sends. Nothing goes until he sends.
// Aaron (a student context) receives no bank and sees no picker. School bank changes are in the activity log, without text.
// Each person has their own browser context. axe over the picker and My phrases. TP_ROSTER=/path/to/transit-roster.json.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const STUDENT = 'Sabc0d6125e85', TEACHER = 'T60198'; // Aaron Torres, Mr David Coultas
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
async function audit(p, include, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate((inc) => window.axe.run({ include: inc }, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')) }))), include);
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-phrases-'));
  srv = await start(port, dataDir);
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok = adminTok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) }); return { status: r.status, ...(await r.json()) }; };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const accounts = (await (await fetch(`${U}/api/admin/accounts`, { headers: H(adminTok) })).json()).accounts;
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), coultas = person(TEACHER);
    const coordAcc = accounts.find((a) => a.kind === 'coordinator' && a.teacherId && links[a.email]);
    ok(!!coordAcc, `a coordinator on the real roster: ${coordAcc?.name}`);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]), cTok = await setupWith(U, links[coordAcc.email]);
    const ctx = async (tok) => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

    // Aaron's moment, sent to Mr Coultas to endorse (through the API: the student side has its own checks).
    const ev = (await act(sTok, 'addStation', [STUDENT, { title: 'Plant growth experiment', lineIds: ['science'], visibility: 'school' }])).result;
    ok((await act(sTok, 'requestEndorsement', [ev.id, TEACHER, 'Please check my results'])).status === 200, `${aaron.name} asked ${coultas.name} to endorse a moment`);

    // ── The coordinator publishes a school phrase ──
    const c = await ctx(cTok);
    await c.goto(`${U}/#/me/phrases`); await c.waitForSelector('.ph-page');
    ok(await c.locator('nav >> text=My phrases').count() > 0 || await c.locator('text=My phrases').count() > 0, 'My phrases is in the coordinator\'s navigation');
    const pub = c.locator('form[aria-label="Publish a school phrase"]');
    await pub.locator('textarea').fill('Thank you for your careful work, {first name}.');
    await pub.locator('select').first().selectOption('praise');
    await pub.locator('button[type=submit]').click();
    ok(await until(async () => (await state()).phrases?.some((p) => p.owner === 'school' && /careful work/.test(p.text))), 'the school phrase is published');
    await c.waitForSelector('.ph-items >> text=careful work');
    await audit(c, ['.ph-page'], 'My phrases (coordinator)');

    // ── Mr Coultas: his own phrase, then the picker on Aaron's moment ──
    const t = await ctx(tTok);
    await t.goto(`${U}/#/me/phrases`); await t.waitForSelector('.ph-page');
    ok(await t.locator('.ph-items >> text=careful work').count() === 1, `${coultas.name} sees the school phrase`);
    ok(await t.locator('form[aria-label="Publish a school phrase"]').count() === 0, 'a teacher cannot publish to the school bank');
    const mine = t.locator('form[aria-label="Add a phrase"]');
    await mine.locator('textarea').fill('Great start, {first name}! What would you change next time?');
    await mine.locator('select').selectOption('question');
    await mine.locator('button[type=submit]').click();
    await t.waitForSelector('.ph-items >> text=Great start');
    await mine.locator('textarea').fill('Could you add a photo of the plants?');
    await mine.locator('button[type=submit]').click();
    await t.waitForSelector('.ph-items >> text=photo of the plants');
    await t.locator('button[aria-label^="Move up: Could you add a photo"]').click();
    ok(await until(async () => { const own = (await state(tTok)).phrases.filter((p) => p.owner === TEACHER).sort((a, b) => a.order - b.order); return own[0]?.text.startsWith('Could you'); }), 'reordered his own phrases');

    await t.goto(`${U}/#/me/queue`); await t.waitForSelector('.q-card');
    const card = t.locator('.q-card', { hasText: 'Plant growth experiment' });
    ok(await card.count() === 1, 'Aaron\'s moment is in his Endorsements queue');
    await card.locator('.mc-toggle').click();
    const ta = card.locator('.mc-write textarea');
    const cTools = card.locator('.mc-thread .ph-tools');
    await cTools.locator('.ph-open').click();
    await t.waitForSelector('.mc-thread .ph-pop');
    await audit(t, ['.mc-thread .ph-pop'], 'phrase picker (open)');
    ok(await t.evaluate(() => document.activeElement?.classList.contains('ph-filter')), 'the filter box has focus when the picker opens');
    await t.keyboard.type('great start');
    ok(await cTools.locator('[role=option]').count() === 1, 'filter as you type: one phrase left');
    ok(await cTools.locator('[role=option]').first().innerText() === 'Great start, Aaron! What would you change next time?', '{first name} shows as Aaron in the list');
    await t.keyboard.press('Enter');
    ok(await ta.inputValue() === 'Great start, Aaron! What would you change next time?', 'Enter puts the phrase in the comment box, name filled in');
    ok(await until(() => t.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'), 2000), 'focus goes back to the box');
    ok(!(await state(tTok)).momentComments.some((x) => x.eventId === ev.id), 'inserting sends nothing');
    await ta.press('End'); await t.keyboard.type(' Lovely detail on the roots, Aaron.');
    await cTools.locator('.ph-open').click(); await t.keyboard.press('Escape');
    ok(await cTools.locator('.ph-pop').count() === 0 && await t.evaluate(() => document.activeElement?.classList.contains('ph-open')), 'Escape closes the picker and returns to its button');
    await ta.fill('Lovely detail on the roots, Aaron.');
    await cTools.locator('.ph-save').click();
    ok(await until(async () => (await state(tTok)).phrases.some((p) => p.owner === TEACHER && p.text === 'Lovely detail on the roots, {first name}.')), '"Save this as a phrase" keeps it with {first name}');
    await ta.fill('Great start, Aaron! What would you change next time?');
    await card.locator('.mc-write .primary').click();
    ok(await until(async () => (await state(tTok)).momentComments.some((x) => x.eventId === ev.id && x.by === TEACHER && x.text.startsWith('Great start, Aaron!'))), 'the comment is sent when he sends it');

    // The endorsement note: his most used phrase floats to the top of his own; the school phrase, chosen with the arrow keys.
    const qTools = card.locator('.q-body > .ph-tools');
    await qTools.locator('.ph-open').click();
    ok((await qTools.locator('[role=group]').first().locator('[role=option]').first().innerText()).startsWith('Great start'), 'his most used phrase is first, ahead of his manual order');
    const opts = qTools.locator('[role=option]');
    const texts = await opts.allInnerTexts();
    ok(texts.includes('Thank you for your careful work, Aaron.') && await qTools.locator('.ph-group', { hasText: 'School: Praise' }).count() === 1, 'the school phrase is in his picker, grouped by kind');
    const target = texts.indexOf('Thank you for your careful work, Aaron.');
    for (let i = 0; i < target; i++) await t.keyboard.press('ArrowDown');
    ok(await qTools.locator('[role=option][aria-selected=true]').innerText() === 'Thank you for your careful work, Aaron.', 'arrow keys move the choice (aria-activedescendant)');
    await t.keyboard.press('Enter');
    ok(await card.locator('input[aria-label="Note"]').inputValue() === 'Thank you for your careful work, Aaron.', 'the school phrase is in the endorsement note');
    await card.locator('.q-actions .primary').click();
    ok(await until(async () => (await state(tTok)).endorsements.some((n) => n.eventId === ev.id && n.teacherId === TEACHER && /careful work, Aaron/.test(n.note))), `${coultas.name} endorsed Aaron's moment with the phrase`);
    const ts = await state(tTok), uses = ts.phraseUses[TEACHER] || {};
    const school = ts.phrases.find((p) => p.owner === 'school'), gs = ts.phrases.find((p) => /^Great start/.test(p.text));
    ok(uses[school.id] === 1 && uses[gs.id] === 1, 'each use is counted for him');
    ok(Object.keys(ts.phraseUses).join() === TEACHER, 'his record carries only his own counts');


    // ── Aaron: no bank, no picker ──
    const ss = await state(sTok);
    ok(Array.isArray(ss.phrases) && ss.phrases.length === 0 && Object.keys(ss.phraseUses || {}).length === 0, 'the student\'s record has no phrases and no counts');
    ok(!JSON.stringify(ss).includes('Lovely detail on the roots') && !JSON.stringify(ss).includes('{first name}'), 'no phrase anywhere in the student\'s record (only what was sent to him)');
    ok((await act(sTok, 'usePhrase', [school.id, null])).status === 403 && (await act(sTok, 'addPhrase', [STUDENT, STUDENT, { text: 'Hi' }])).status === 403, 'the student cannot use or add phrases');
    const s = await ctx(sTok);
    await s.goto(`${U}/#/me/phrases`); await s.waitForTimeout(1200);
    ok(await s.locator('.ph-page, .ph-tools').count() === 0, 'My phrases does not open for a student');
    ok(await s.locator('text=My phrases').count() === 0, 'and is not in a student\'s navigation');

    // A teacher's own bank stays his own.
    const cs = await state(cTok);
    ok(!cs.phrases.some((p) => p.owner === TEACHER), 'the coordinator does not receive his own phrases');

    // ── Activity log ──
    const log = fs.readdirSync(dataDir).filter((f) => /^audit-.*\.jsonl$/.test(f)).map((f) => fs.readFileSync(path.join(dataDir, f), 'utf8')).join('');
    const lines = log.split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.action === 'school-phrase');
    ok(lines.length === 1 && lines[0].detail.op === 'add' && lines[0].actor?.name === coordAcc.name, 'publishing is in the activity log, by the coordinator');
    ok(!log.includes('careful work') && !log.includes('Great start'), 'phrase text is never in the activity log');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  } catch (e) { ok(false, e.stack || e.message); } finally {
    await b.close();
    srv?.p.kill('SIGTERM');
  }
})();
