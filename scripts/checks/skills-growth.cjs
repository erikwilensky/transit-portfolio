// Skills growth on the real class lists: a clean pilot (TP_START=empty; needs `npm run build` first) with the real roster.
// Aaron Torres (Year 8, Simple, phone) tags one moment while adding it and another from My skills, keeps a third just for
// him, and sees them as "Skills I've used" (no numbers), tapping one for its moments; the Simple moment card shows them.
// Ms Jane Altemen sees the chart on his page (table view, light and dark), Mr David Coultas (teaches him) only from the
// moment shared with the school, a parent from what the family view shows, and a teacher who does not teach him nothing.
// Each person has their own browser context. TP_ROSTER=/path/to/transit-roster.json. Screenshots: tp-sg-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-sg-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const STUDENT = 'Sabc0d6125e85', ADVISOR = 'T25948', TEACHER = 'T60198', CLASS = 'C-392000';
const BRIDGE = 'Built a bridge model', FAIR = 'Helped at the book fair', SECRET = 'Diary page';
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
const rowText = (p, name) => p.locator('.sk-card .sk-row', { hasText: name }).first().innerText();

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-sg-data-'));
  srv = await start(port, dataDir);
  const full = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const state = async (tok) => (await (await fetch(`${U}/api/state`, { headers: H(tok) })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => roster.teachers.find((t) => t.id === id) || roster.students.find((s) => s.id === id);
    const aaron = person(STUDENT), altemen = person(ADVISOR), coultas = person(TEACHER);
    const mine = new Set(roster.enrolments.filter((n) => n.studentId === STUDENT).map((n) => n.classId));
    const myTeachers = new Set(roster.classes.filter((c) => mine.has(c.id)).flatMap((c) => c.teacherIds));
    const other = roster.teachers.find((t) => t.roles.length === 1 && t.roles[0] === 'teacher' && links[t.email] && !myTeachers.has(t.id) && t.id !== ADVISOR);
    ok(aaron?.advisorId === ADVISOR && myTeachers.has(TEACHER) && !!other, `${aaron.name} (Year ${aaron.year}), advised by ${altemen.name}, taught by ${coultas.name}; unrelated teacher ${other?.name}`);
    const sTok = await setupWith(U, links[aaron.email]), aTok = await setupWith(U, links[altemen.email]);
    const tTok = await setupWith(U, links[coultas.email]), oTok = await setupWith(U, links[other.email]);
    const ctx = async (tok, phone) => {
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1300, height: 900 } });
      if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
    };

    // ── Aaron, Simple level on a phone ──
    const s = await ctx(sTok, true);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.onboard');
    for (const l of ['Science', 'Service']) { const btn = s.locator('.ob-pick', { hasText: l }).first(); if (await btn.count() && !(await btn.getAttribute('aria-pressed') === 'true')) await btn.click(); }
    await s.click('.ob-foot .primary'); await s.click('.ob-foot .primary');
    await s.click('text=Go to my map'); await s.waitForSelector('.simple .sh-actions');
    ok(await s.locator('nav a, nav button', { hasText: 'My skills' }).count() > 0, 'Simple: “My skills” is in his navigation');
    const addMoment = async (title, skills = []) => {
      await s.click('.sh-card.add');
      await s.fill('.sh-flow .sh-input', title); await s.click('.sh-flow .sh-next .primary');
      await s.locator('.sh-flow .sh-lines button').first().click();
      if (skills.length) {
        await s.click('.sh-flow .sk-open');
        await s.screenshot({ path: `${SH}add-open.png` });
        for (const k of skills) await s.click(`.sh-flow .sk-chip:has-text("${k}")`);
        await audit(s, ['.sh-flow .sk-step'], 'Simple add: the skills step');
        await s.screenshot({ path: `${SH}add-picked.png` });
      }
      await s.click('.sh-flow .sh-next .primary');
      const notNow = s.locator('.sh-flow .sh-notnow');
      if (await notNow.count()) await notNow.click();
      return until(async () => full().events.find((e) => e.studentId === STUDENT && e.title === title));
    };
    const ev1 = await addMoment(BRIDGE, ['Solving problems', 'Working with others']);
    ok(!!ev1, 'he added a moment with two skills');
    ok(await until(async () => { const t = full().tags?.[ev1.id]; return t && !t.auto && t.lp.join() === 'Thinker' && t.atl.join() === 'Social'; }), 'stored as the skills he picked (Thinker, Social)');
    // Up to three: a fourth is not offered.
    await s.click('.sh-card.add'); await s.fill('.sh-flow .sh-input', 'x'); await s.click('.sh-flow .sh-next .primary'); await s.locator('.sh-flow .sh-lines button').first().click();
    await s.click('.sh-flow .sk-open');
    for (const k of ['Asking questions', 'Helping others', 'Finding things out']) await s.click(`.sh-flow .sk-chip:has-text("${k}")`);
    ok(await s.locator('.sh-flow .sk-chip:has-text("Solving problems")').isDisabled(), 'with three picked, a fourth waits');
    await s.click('.sh-flow .panel-close');
    const ev2 = await addMoment(FAIR);
    const ev3 = await addMoment(SECRET);
    ok((await act(sTok, 'setVisibility', [ev3.id, 'private'])).status === 200 && (await act(sTok, 'setTags', [ev3.id, { lp: ['Reflective'], atl: [] }])).status === 200, 'a third, just for him, tagged Reflective');
    ok((await act(sTok, 'setVisibility', [ev1.id, 'school'])).status === 200, 'the bridge is shared with the school');

    await s.goto(`${U}/#/me/skills`); await s.waitForSelector('.sk-page.sk-simple');
    ok(await s.locator('.sk-totag button', { hasText: FAIR }).count() === 1, 'My skills offers the untagged moment');
    await s.locator('.sk-totag button', { hasText: FAIR }).click();
    await s.click('.sk-totag .sk-chip:has-text("Helping others")');
    await s.screenshot({ path: `${SH}simple-tagging.png` });
    await s.click('.sk-totag .primary');
    ok(await until(async () => full().tags?.[ev2.id]?.lp?.join() === 'Caring'), 'he tagged the book fair from My skills (Caring)');
    await s.waitForSelector('.sk-collect');
    const got = await s.locator('.sk-collect').innerText();
    ok(['Solving problems', 'Working with others', 'Helping others', 'Looking back and learning'].every((k) => got.includes(k)), 'his collection shows the four skills he used');
    ok(!/\d/.test(got) && !/\d/.test(await s.locator('.sk-head').innerText()), 'Simple: no numbers or rankings');
    await s.click('.sk-big:has-text("Solving problems")');
    ok((await s.locator('.sk-behind').innerText()).includes(BRIDGE), 'tapping a skill lists the moment behind it');
    await audit(s, ['.sk-page'], 'My skills, Simple');
    await s.screenshot({ path: `${SH}simple.png`, fullPage: true });
    await s.locator('.sk-behind button', { hasText: BRIDGE }).click();
    await s.waitForSelector('.sh-moment .sk-have');
    ok((await s.locator('.sh-moment .sk-have').innerText()).includes('Working with others'), 'the moment card shows its skills, with Change');
    await s.screenshot({ path: `${SH}moment.png` });

    // ── Ms Altemen: on his page ──
    const a = await ctx(aTok);
    await a.goto(`${U}/#/me/student/${STUDENT}`); await a.waitForSelector('.sk-card .sk-chart');
    ok(/1 moment/.test(await rowText(a, 'Thinker')) && /1 moment/.test(await rowText(a, 'Caring')), 'Ms Altemen sees Thinker and Caring');
    ok(/Not yet/.test(await rowText(a, 'Reflective')), 'not the private moment’s skill');
    await a.click('.sk-card .sk-row:has-text("Caring")');
    ok((await a.locator('.sk-card .sk-behind').innerText()).includes(FAIR), 'a skill opens its moments');
    await a.locator('.sk-card .sk-behind button', { hasText: FAIR }).click();
    ok(await a.locator('.station-panel.open h2', { hasText: FAIR }).count() === 1, 'and the moment opens on his map');
    await audit(a, ['.sk-card'], 'advisor: skills growth');
    await a.locator('.sk-card').screenshot({ path: `${SH}advisor.png` });
    await a.click('.sk-card .sk-tbl');
    const tbl = await a.locator('.sk-card .sk-table').innerText();
    ok(/Thinker/.test(tbl) && /Term 1/.test(tbl), 'table view for the chart');
    await audit(a, ['.sk-card'], 'advisor: skills table');
    await a.click('.sk-card .sk-tbl');
    await a.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await a.locator('.sk-card').screenshot({ path: `${SH}advisor-dark.png` });
    const dark = await a.evaluate(() => getComputedStyle(document.querySelector('.sk-track i.t1')).backgroundColor);
    ok(dark === 'rgb(37, 106, 191)', `dark mode uses its own term ramp (${dark})`);

    // ── Mr Coultas teaches him: only the moment shared with the school ──
    const t = await ctx(tTok);
    await t.goto(`${U}/#/me/classes/${CLASS}~${STUDENT}`); await t.waitForSelector('.sk-card');
    ok(/1 moment/.test(await rowText(t, 'Thinker')) && /Not yet/.test(await rowText(t, 'Caring')), 'Mr Coultas sees only the moment shared with the school');
    await audit(t, ['.sk-card'], 'teacher: skills growth');

    // ── A teacher who does not teach him ──
    const o = await ctx(oTok);
    await o.goto(`${U}/#/me/classes/${CLASS}~${STUDENT}`); await o.waitForTimeout(1500);
    ok(await o.locator('.sk-card').count() === 0, `${other.name} gets no skills view`);
    await o.goto(`${U}/#/me/student/${STUDENT}`); await o.waitForTimeout(800);
    ok(await o.locator('.sk-card').count() === 0, 'not by his advisee address either');
    const os_ = await state(oTok);
    ok(!os_.events.some((e) => e.studentId === STUDENT) && ![ev1.id, ev2.id, ev3.id].some((id) => os_.tags?.[id]), 'nor any of his moments or tags');
    ok((await act(oTok, 'setTags', [ev2.id, { lp: ['Balanced'], atl: [] }])).status === 403, 'and cannot tag them (403)');

    // ── A parent, through the family letter ──
    const lt = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: H(aTok), body: JSON.stringify({ studentIds: [STUDENT] }) })).json();
    const p = await ctx(null);
    await p.goto(lt.letters[0].url.replace(/^https?:\/\/[^/]+/, U)); await p.waitForSelector('form.auth-card');
    await p.fill('input[autocomplete="name"]', 'Maria Torres'); await p.fill('input[type="email"]', 'maria.torres@family.example');
    await p.fill('input[autocomplete="new-password"] >> nth=0', 'family-pass-1'); await p.fill('input[autocomplete="new-password"] >> nth=1', 'family-pass-1');
    await p.click('form.auth-card button[type="submit"]');
    await p.waitForSelector('.page.family .sk-card');
    ok(/1 moment/.test(await rowText(p, 'Caring')) && /Not yet/.test(await rowText(p, 'Reflective')), 'the family sees what the family view shows, never the private one');
    await audit(p, ['.sk-card'], 'family: skills growth');
    await p.click('.fam-head button[lang="th"]'); await p.waitForSelector('.page.family[lang="th"] .sk-card');
    const th = await p.locator('.sk-card').innerText();
    ok(th.includes('ทักษะที่เติบโต') && th.includes('ผู้มีน้ำใจ') && th.includes('ช่วยเหลือผู้อื่น'), 'in Thai for the family');
    await p.locator('.sk-card').screenshot({ path: `${SH}family-th.png` });
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
