// Search on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real roster, each
// account in its own browser context. Aaron Torres (Year 8, Simple level) finds his moment with "Find something I did",
// by recent chips, his line and by typing, and a Thai-titled one by a Thai word; at Standard level from the top bar ("/",
// combobox, filters, Enter opens the station panel). Mr David Coultas (teaches Aaron) finds Aaron by name and his
// school-visible moment, never the private one; a teacher with no reach finds nothing of Aaron; Aaron's family finds
// the family view's moments. Times: under 50 ms for Aaron with 300 moments and a coordinator over all 960 students
// (index refresh included). axe on the open search.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-search-*.png in the temp folder.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = path.join(os.tmpdir(), 'tp-search-');
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', TID = 'T60198', CLASS = 'C-392000';
const THAI = 'ทำหุ่นยนต์กับเพื่อน';
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
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
const opts = (p, sel = '#tsearch [role=option]') => p.locator(sel).evaluateAll((l) => l.map((x) => x.querySelector('b').textContent));

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  srv = await start(port, fs.mkdtempSync(SH + 'data-'));
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) }); return r.ok ? (await r.json()).result : null; };
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const coultas = roster.teachers.find((t) => t.id === TID), aaron = roster.students.find((s) => s.id === AARON);
    const aaronClasses = new Set(roster.enrolments.filter((n) => n.studentId === AARON).map((n) => n.classId));
    const teachesAaron = (t) => roster.classes.some((c) => aaronClasses.has(c.id) && (c.teacherIds || []).includes(t.id));
    const stranger = roster.teachers.find((t) => links[t.email] && t.roles.join() === 'teacher' && !teachesAaron(t) && aaron.advisorId !== t.id);
    const coord = roster.teachers.find((t) => links[t.email] && t.roles.includes('coordinator') && !t.roles.includes('leadership'));
    const fam = await (await fetch(`${U}/api/admin/accounts`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ email: 'torres.family@example.org', name: 'Khun Torres', kind: 'parent', children: [AARON] }) })).json();
    const tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[aaron.email]), sTok = await setupWith(U, links[stranger.email]);
    const cTok = await setupWith(U, links[coord.email]), fTok = await setupWith(U, decodeURIComponent(fam.setupUrl.split('/setup/')[1]));
    ok(teachesAaron(coultas) && !teachesAaron(stranger), `${coultas.name} teaches ${aaron.name}; ${stranger.name} does not; coordinator ${coord.name}`);

    await act(aTok, 'completeOnboarding', [AARON, ['science'], null]);
    const volcano = await act(aTok, 'addStation', [AARON, { title: 'Built a model volcano', type: 'project', lineIds: ['science'], summary: 'Baking soda eruption for Y8 Sciences', visibility: 'school', imageCaption: 'Lava everywhere' }]);
    const diary = await act(aTok, 'addStation', [AARON, { title: 'Volcano diary', type: 'project', lineIds: ['science'], summary: 'Secret notes about the volcano, just for me', visibility: 'private' }]);
    const thai = await act(aTok, 'addStation', [AARON, { title: THAI, type: 'project', lineIds: ['science'], summary: 'หุ่นยนต์เดินได้สามก้าว', visibility: 'school' }]);
    await act(aTok, 'addReflection', [{ studentId: AARON, eventId: volcano.id, prompt: 'What surprised you?', text: 'The magma foam went over the table', visibility: 'private' }]);
    ok(volcano && diary && thai, 'Aaron adds a school moment, a private one and a Thai-titled one');

    const ctx = async (tok, vp = { width: 1300, height: 900 }) => { const c = await b.newContext({ viewport: vp }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return { c, p }; };
    const go = async (p, hash) => { await p.goto(`${U}/${hash}`); await p.waitForSelector('.topnav'); await p.waitForTimeout(500); };

    // ── Aaron at Simple level: "Find something I did" ──
    const A = await ctx(aTok);
    await go(A.p, '#/me/map');
    ok(await A.p.locator('.sf-big').isVisible(), 'Simple level: a big "Find something I did", no free-text box in the top bar');
    ok(!(await A.p.locator('#tsearch-q').count()), 'no top-bar text box at Simple level');
    await A.p.click('.sf-big'); await A.p.waitForSelector('.sf');
    const chips = await A.p.locator('.sf-chips').first().innerText();
    ok(chips.includes('Built a model volcano') && chips.includes(THAI), 'recent moments as chips');
    await audit(A.p, 'Simple level finder');
    await A.p.screenshot({ path: SH + 'simple.png' });
    await A.p.click('.sf-chip.line'); await A.p.waitForSelector('.sf-moments');
    ok((await A.p.locator('.sf-moments').innerText()).includes('Built a model volcano'), 'a line chip lists that line\'s moments');
    await A.p.click('.sf-back'); await A.p.click('.sf-type');
    await A.p.fill('#sf-q', 'volc'); await A.p.waitForTimeout(150);
    const mine = await opts(A.p, '#sf-list [role=option]');
    ok(mine.includes('Built a model volcano') && mine.includes('Volcano diary'), `typing finds his moments, his private one too (${mine.join(', ')})`);
    ok(await A.p.locator('#sf-list mark').first().textContent() === 'volc' || (await A.p.locator('#sf-list mark').allTextContents()).some((t) => /^volc$/i.test(t)), 'the matching word is highlighted');
    await A.p.fill('#sf-q', 'magma'); await A.p.waitForTimeout(150);
    ok((await A.p.locator('#sf-list [role=option]').count()) === 1 && (await A.p.locator('#sf-list').innerText()).includes('magma foam'), 'his own reflection, with the matching words');
    await A.p.fill('#sf-q', 'หุ่นยนต์'); await A.p.waitForTimeout(150);
    ok((await opts(A.p, '#sf-list [role=option]')).includes(THAI), 'a Thai word finds the Thai-titled moment');
    await A.p.fill('#sf-q', 'ยนต์'); await A.p.waitForTimeout(150);
    ok((await opts(A.p, '#sf-list [role=option]')).includes(THAI), 'part of a Thai word (no spaces) finds it too');
    await A.p.fill('#sf-q', 'volcano'); await A.p.waitForTimeout(150);
    await A.p.keyboard.press('ArrowDown'); await A.p.keyboard.press('Enter');
    await A.p.waitForSelector('.sh-moment');
    ok(['Built a model volcano', 'Volcano diary'].includes(await A.p.locator('.sh-moment h2').textContent()), 'Enter opens the moment');
    await A.p.keyboard.press('Escape'); await A.p.waitForTimeout(200);
    await A.p.keyboard.press('/'); await A.p.waitForTimeout(200);
    ok(await A.p.locator('.sf').isVisible(), '"/" opens the finder at Simple level');
    await A.p.keyboard.press('Escape');

    // ── Aaron at Standard level: the top bar ──
    await act(aTok, 'setIntensity', [AARON, 'standard']);
    await go(A.p, '#/me/map');
    await A.p.keyboard.press('/');
    ok(await A.p.evaluate(() => document.activeElement?.id === 'tsearch-q'), '"/" focuses the search box');
    await A.p.keyboard.type('volcano'); await A.p.waitForTimeout(200);
    ok(await A.p.getAttribute('#tsearch-q', 'aria-expanded') === 'true' && await A.p.getAttribute('#tsearch-q', 'aria-controls') === 'tsearch', 'combobox: expanded, controls the listbox');
    const groups = await A.p.locator('#tsearch [role=group]').evaluateAll((l) => l.map((g) => g.querySelector('.ts-gl').textContent));
    ok(groups.some((g) => g.startsWith('Moments')) && groups.some((g) => g.startsWith('Lines') === false), `results grouped (${groups.join(' | ')})`);
    await audit(A.p, 'top-bar search, open');
    await A.p.screenshot({ path: SH + 'standard.png' });
    await A.p.selectOption('.ts-filters select >> nth=0', 'goal'); await A.p.waitForTimeout(150);
    ok(!(await A.p.locator('#tsearch [role=option]').count()), 'type filter: no goals match');
    await A.p.selectOption('.ts-filters select >> nth=0', ''); await A.p.selectOption('.ts-filters select >> nth=2', 'month'); await A.p.waitForTimeout(150);
    ok((await opts(A.p)).includes('Built a model volcano'), 'date filter: last 30 days');
    await A.p.focus('#tsearch-q'); await A.p.keyboard.press('ArrowDown');
    ok(!!(await A.p.getAttribute('#tsearch-q', 'aria-activedescendant')), 'arrow keys set aria-activedescendant');
    await A.p.keyboard.press('Enter'); await A.p.waitForTimeout(600);
    ok(/\/map\/ev-/.test(A.p.url()) && ['Built a model volcano', 'Volcano diary'].includes(await A.p.locator('.station-panel.open h2').first().textContent()), 'Enter opens the station panel on his map');

    // 300 moments, then the time one search takes (index refresh included).
    for (let i = 0; i < 297; i++) await act(aTok, 'addStation', [AARON, { title: `Practice log ${i}: ${['rehearsal', 'lab notes', 'football drills', 'sketchbook', 'reading'][i % 5]}`, type: 'project', lineIds: ['science'], summary: `Week ${i % 40} notes on ${['magnets', 'plants', 'fractions', 'poems'][i % 4]} and how it went`, visibility: 'advisor' }]);
    await go(A.p, '#/me/map'); await A.p.waitForTimeout(800);
    const aT = await A.p.evaluate(() => { const first = window.__tpSearch('volcano', {}, { cold: true }); const t = []; for (const q of ['practice', 'magnets week', 'หุ่นยนต์', 'p']) t.push(window.__tpSearch(q).ms); return { first, warm: Math.max(...t) }; });
    ok(aT.first.docs >= 300, `Aaron's index: ${aT.first.docs} docs`);
    ok(aT.first.ms < 50 && aT.warm < 50, `Aaron with 300 moments: first search ${aT.first.ms.toFixed(1)} ms (index ${aT.first.buildMs.toFixed(1)} ms), then at most ${aT.warm.toFixed(1)} ms`);

    // ── Mr Coultas ──
    const T = await ctx(tTok);
    await go(T.p, '#/me');
    await T.p.click('#tsearch-q'); await T.p.keyboard.type('Aaron'); await T.p.waitForTimeout(200);
    ok((await opts(T.p)).includes('Aaron Torres'), 'Mr Coultas finds Aaron by name');
    await T.p.fill('#tsearch-q', '8C'); await T.p.waitForTimeout(150);
    ok((await opts(T.p)).includes('Aaron Torres'), 'and by homeroom');
    await T.p.fill('#tsearch-q', 'volcano'); await T.p.waitForTimeout(150);
    const tv = await opts(T.p);
    ok(tv.includes('Built a model volcano') && !tv.includes('Volcano diary'), `his school-visible moment, not his private one (${tv.join(', ')})`);
    const tq = await T.p.evaluate(() => ['diary', 'secret', 'magma', 'practice'].map((q) => window.__tpSearch(q).total));
    ok(tq.every((n) => n === 0), `no private moment or reflection, no advisor-level moment (${tq})`);
    ok((await T.p.evaluate((q) => window.__tpSearch(q).titles, 'หุ่นยนต์')).includes(`moment:${THAI}`), 'a Thai search finds the Thai-titled moment');
    await act(aTok, 'addStation', [AARON, { title: 'Rocket launch day', type: 'project', lineIds: ['science'], summary: 'Water rockets on the field', visibility: 'school' }]);
    ok(await T.p.waitForFunction(() => window.__tpSearch('rocket').total === 1, null, { timeout: 8000 }).then(() => true, () => false), 'a moment Aaron adds while the page is open is found (the index follows the record)');
    await audit(T.p, 'staff search, open');
    await T.p.screenshot({ path: SH + 'teacher.png' });
    await T.p.locator('#tsearch [role=option]', { hasText: 'Built a model volcano' }).click(); await T.p.waitForTimeout(400);
    ok((await T.p.locator('.sr-panel .station-panel.open h2').textContent()) === 'Built a model volcano', 'a result opens the station panel (read only)');
    await T.p.keyboard.press('Escape'); await T.p.waitForTimeout(200);
    ok(!(await T.p.locator('.sr-panel .station-panel.open').count()), 'Escape closes it');
    await T.p.fill('#tsearch-q', 'Aaron'); await T.p.waitForTimeout(150);
    await T.p.locator('#tsearch [role=option]', { has: T.p.locator('b', { hasText: /^Aaron Torres$/ }) }).click(); await T.p.waitForTimeout(200);
    ok((await T.p.locator('.ts-chip').textContent()).includes('Aaron Torres') && (await opts(T.p)).includes('Built a model volcano'), 'a student result lists what he may read of that student');
    await T.p.click('.ts-page'); await T.p.waitForTimeout(500);
    ok(T.p.url().endsWith(`/classes/${CLASS}~${AARON}`), 'and opens the student in the class he teaches');

    // ── A teacher with no reach ──
    const S = await ctx(sTok);
    await go(S.p, '#/me');
    await S.p.click('#tsearch-q'); await S.p.keyboard.type('Aaron'); await S.p.waitForTimeout(200);
    ok(!(await opts(S.p)).includes('Aaron Torres'), `${stranger.name} (no reach) cannot find Aaron`);
    ok((await S.p.evaluate(() => ['torres', 'volcano', 'หุ่นยนต์'].map((q) => window.__tpSearch(q).total))).every((n) => n === 0), 'nor his moments');

    // ── Aaron's family ──
    const F = await ctx(fTok);
    await go(F.p, '#/me');
    await F.p.click('#tsearch-q'); await F.p.keyboard.type('volcano'); await F.p.waitForTimeout(200);
    const fv = await opts(F.p);
    ok(fv.includes('Built a model volcano') && !fv.includes('Volcano diary'), `the family finds the family view's moment, not the private one (${fv.join(', ')})`);
    await F.p.locator('#tsearch [role=option]').first().click(); await F.p.waitForTimeout(400);
    ok((await F.p.locator('.sr-panel .station-panel.open h2').textContent()) === 'Built a model volcano', 'and opens it');

    // ── A coordinator over the whole school ──
    const C = await ctx(cTok);
    await go(C.p, '#/me');
    const cT = await C.p.evaluate(() => { const first = window.__tpSearch('torres', {}, { cold: true }); const t = []; for (const q of ['aaron', 'a', '8c', 'year 8', 'practice', 'หุ่นยนต์']) t.push(window.__tpSearch(q).ms); return { first, warm: Math.max(...t) }; });
    ok(cT.first.docs >= 960 && cT.first.titles.includes('student:Aaron Torres'), `coordinator: ${cT.first.docs} docs, finds Aaron`);
    ok(cT.first.ms < 50 && cT.warm < 50, `coordinator over 960 students: first search ${cT.first.ms.toFixed(1)} ms (index ${cT.first.buildMs.toFixed(1)} ms), then at most ${cT.warm.toFixed(1)} ms`);
    ok(!(await C.p.evaluate(() => window.__tpSearch('diary').total)), 'coordinator: no private moment');

    // ── Phone ──
    const P = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await P.addCookies([{ name: 'tp_session', value: tTok, url: U }]); const pp = await P.newPage(); pp.on('pageerror', (e) => errs.push(e.message));
    await go(pp, '#/me');
    await pp.click('.ts-phone'); await pp.waitForFunction(() => document.activeElement?.id === 'tsearch-q'); await pp.keyboard.type('volcano'); await pp.waitForTimeout(200);
    ok(await pp.locator('.tsearch.sheet #tsearch [role=option]').count() > 0, 'phone: the search opens as a full sheet');
    ok(await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
    await pp.screenshot({ path: SH + 'phone.png' });
    ok(!errs.length, `no page errors ${errs.join('; ')}`);
  } finally {
    await b.close(); srv?.p.kill();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; srv?.p.kill(); });
