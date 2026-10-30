// Moment templates on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster. Aaron Torres (Year 8, Simple, on a phone, his own browser context) adds a Science moment with the Lab
// write-up guide, one part per screen with starters and read aloud; the moment carries the template id and its words sit
// under the headings. A coordinator (their own context) sees the six built-in templates, adds a school template for
// Science and turns the Reading log off (both in the activity log). Mr David Coultas (his own context) sets a class task
// for C-392000 with that template; Aaron sees the guide on the task and hands it in through it. At Standard, Aaron's add
// dialog shows the guide as labelled fields. axe (serious and critical) on every new screen.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-moment-templates-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-moment-templates-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', COULTAS = 'T60198', CLASS = 'C-392000';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await wait(200); } };
const day = (n) => new Date(Date.now() + 7 * 36e5 + n * 864e5).toISOString().slice(0, 10); // Bangkok

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
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
const SPEECH = () => { window.__said = []; if (window.speechSynthesis) { speechSynthesis.speak = (u) => { window.__said.push(`${u.lang}|${u.text}`); setTimeout(() => u.onend?.(), 30); }; speechSynthesis.cancel = () => {}; } };

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-mt-data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const auditLog = () => fs.readdirSync(dataDir).filter((f) => /^audit-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n')).map((l) => JSON.parse(l));
  const b = await chromium.launch();
  const errs = [];
  try {
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    const rec = saved();
    const cls = rec.classes.find((c) => c.id === CLASS);
    const aaron = roster.students.find((s) => s.id === AARON), coultas = roster.teachers.find((t) => t.id === COULTAS);
    ok(cls?.lineId === 'science' && cls.teacherIds.includes(COULTAS) && rec.enrolments.some((n) => n.classId === CLASS && n.studentId === AARON), `${coultas.name} teaches ${cls.name} on Science; ${aaron.name} is in it`);
    const coord = roster.teachers.find((x) => (x.roles || [])[0] === 'coordinator' && x.email && links[x.email]) || roster.teachers.find((x) => (x.roles || []).includes('coordinator') && links[x.email]);
    const tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[aaron.email]), cTok = await setupWith(U, links[coord.email]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'sport'], null])).ok, 'Aaron has picked his lines');
    ok((await act(aTok, 'saveMomentTemplate', [{ name: 'Mine', fields: [{ label: 'A' }, { label: 'B' }] }, null])).status === 403, 'a student cannot write a template (403)');
    ok((await act(tTok, 'saveMomentTemplate', [{ name: 'Mine', fields: [{ label: 'A' }, { label: 'B' }] }, COULTAS])).status === 403, 'nor can a subject teacher (403)');
    ok((await act(tTok, 'setMomentTemplateOff', ['mt-lab', true, COULTAS])).status === 403, 'nor turn one off (403)');

    // ── Aaron, on his phone (Simple): a Science moment with the Lab write-up guide ──
    const phone = async (tok) => {
      const c = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
      await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); await c.addInitScript(SPEECH);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${U}/#/me/map`); await p.waitForSelector('.simple .sh-actions');
      return [c, p];
    };
    const [cA, a] = await phone(aTok);
    await a.click('.sh-card.add'); await a.waitForSelector('.sh-flow h2');
    await a.fill('.sh-flow input.sh-input', 'Melting ice with salt'); await a.click('.sh-flow .sh-next .primary');
    await a.locator('.sh-lines button', { hasText: 'Science' }).click();
    await a.waitForSelector('.sh-flow .mt-offer');
    const offered = await a.locator('.mt-offer-list b').allInnerTexts();
    ok(JSON.stringify(offered) === JSON.stringify(['Lab write-up', 'Project milestone']), `after Science: “Use a guide” offers ${offered.join(', ')}`);
    await audit(a, 'Simple “What did you learn?” with Use a guide');
    await a.locator('.mt-offer-list button', { hasText: 'Lab write-up' }).click();
    await a.waitForSelector('.mt-step');
    ok((await a.innerText('.mt-from')).includes('Lab write-up') && (await a.innerText('.mt-from')).includes('Question 1 of 4'), 'Lab write-up, question 1 of 4');
    ok((await a.innerText('.mt-step h2')).trim() === 'What were you trying to find out?', 'one part per screen: “What were you trying to find out?”');
    ok((await a.getAttribute('.sh-steps', 'aria-label')) === 'Step 3 of 7', `the steps count each part (${await a.getAttribute('.sh-steps', 'aria-label')})`);
    await a.click('.mt-step h2 .vc-speak');
    ok(await until(() => a.evaluate(() => window.__said.includes('en-GB|What were you trying to find out?'))), 'read aloud: the question is read out (en-GB)');
    await a.click('.mt-step .sh-starters button >> nth=0');
    await a.type('.mt-step textarea', 'whether salt melts ice faster.');
    ok((await a.inputValue('.mt-step textarea')) === 'I wanted to find out whether salt melts ice faster.', 'a sentence starter begins the answer');
    await audit(a, 'Simple guide, part 1');
    await a.screenshot({ path: SH + 'simple-lab.png' });
    const answers = ['I wanted to find out whether salt melts ice faster.', 'We put two ice cubes on plates and salted one.', 'The salted cube melted in half the time.', 'Next time I would time it with a stopwatch.'];
    for (let i = 1; i < 4; i++) {
      await a.click('.mt-guided .sh-next .primary');
      ok((await a.innerText('.mt-from')).includes(`Question ${i + 1} of 4`), `question ${i + 1} of 4`);
      await a.fill('.mt-step textarea', answers[i]);
    }
    await a.click('.mt-guided .sh-next .primary');
    await a.waitForSelector('.sh-who'); await a.click('.sh-notnow'); await a.waitForSelector('.toast.show');
    const ev = await until(() => saved().events.find((e) => e.studentId === AARON && e.title === 'Melting ice with salt'));
    const refl = ev && saved().reflections.find((r) => r.eventId === ev.id);
    ok(ev?.templateId === 'mt-lab', `the moment carries the template id (${ev?.templateId})`);
    ok(refl?.text === `The question\n${answers[0]}\n\nWhat I did\n${answers[1]}\n\nWhat I found\n${answers[2]}\n\nWhat I’d change\n${answers[3]}` && refl.prompt === 'Lab write-up', 'its words: each answer under its heading, as the reflection');

    // ── A coordinator: the six built-in templates; adds one for Science; turns the Reading log off ──
    const cC = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await cC.addCookies([{ name: 'tp_session', value: cTok, url: U }]);
    const k = await cC.newPage(); k.on('pageerror', (e) => errs.push(e.message));
    await k.goto(`${U}/#/me/prompts`); await k.waitForSelector('.sp-page .mt-tabs');
    await k.click('.mt-tabs a:has-text("Moment templates")'); await k.waitForSelector('.mt-page .mt-card');
    ok(await k.locator('.mt-card').count() === 6, `${coord.name} sees the six built-in templates`);
    ok((await k.innerText('.mt-card:has(h2:has-text("Lab write-up"))')).includes('1 moment written with it'), 'Lab write-up: 1 moment written with it');
    await audit(k, 'coordinator Moment templates screen');
    await k.click('.mt-page .page-head .primary'); await k.waitForSelector('.mt-edit');
    await k.fill('.mt-edit label:has-text("Name") input', 'Field trip report');
    await k.fill('.mt-edit label:has-text("What it is for") input', 'For a science trip out of school.');
    const parts = [['Where we went', 'Where did your class go?', 'We went to… / We visited…'], ['What I saw', 'What did you see or find out?', 'I saw…'], ['A question I still have', 'What do you still wonder about?', '']];
    for (let i = 0; i < parts.length; i++) {
      if (i >= 2) await k.click('.mt-edit button:has-text("Add a part")');
      await k.fill(`.mt-edit input[aria-label="Part ${i + 1} heading"]`, parts[i][0]);
      await k.fill(`.mt-edit input[aria-label="Part ${i + 1} question"]`, parts[i][1]);
      await k.fill(`.mt-edit input[aria-label="Part ${i + 1} sentence starters"]`, parts[i][2]);
    }
    await k.locator('.mt-edit .line-chip', { hasText: 'Science' }).click();
    await audit(k, 'template editor');
    await k.screenshot({ path: SH + 'editor.png' });
    await k.click('.mt-edit .cp-foot .primary'); await k.waitForSelector('.mt-edit', { state: 'detached' });
    const mt = await until(() => (saved().momentTemplates || []).find((t) => t.name === 'Field trip report'));
    ok(!!mt && mt.by === coord.id && JSON.stringify(mt.lineIds) === '["science"]' && mt.fields.length === 3 && JSON.stringify(mt.fields[0].starters) === '["We went to…","We visited…"]', `saved on the server: ${mt?.id}, 3 parts, on Science, by ${coord.name}`);
    await k.click('.mt-card:has(h2:has-text("Reading log")) button:has-text("Turn off")');
    ok(await until(() => (saved().momentTemplates || []).find((t) => t.id === 'mt-reading')?.off === true), 'the Reading log is turned off');
    ok(await until(async () => (await k.innerText('.mt-card:has(h2:has-text("Reading log"))')).includes('Off')), 'and shows as Off');
    await k.screenshot({ path: SH + 'templates.png', fullPage: true });
    const log = auditLog();
    ok(log.some((e) => e.fn === 'saveMomentTemplate' && e.result === 'ok' && e.target?.id === mt.id && e.actor?.id) && log.some((e) => e.fn === 'setMomentTemplateOff' && e.target?.id === 'mt-reading'), 'the activity log has both changes with the template ids');
    ok(log.filter((e) => e.fn === 'saveMomentTemplate' && e.result === 'refused').length === 2, 'and the two refused attempts');
    await cC.close();

    // ── Mr Coultas sets a class task for C-392000 with the school's template ──
    const cT = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me/classes`); await t.waitForSelector('.mc-list');
    await t.locator('.mc-list li', { has: t.locator(`a[href$="/classes/${CLASS}"]`) }).locator('.tk-setbtn').click();
    const dlg = t.locator('.tk-set');
    await dlg.locator('label:has-text("Title") input').fill('Science museum trip');
    await dlg.locator('textarea').fill('Write about our trip to the science museum.');
    await dlg.locator('input[type=date]').fill(day(3));
    const sel = dlg.locator('label:has-text("Guide for students") select');
    const opts = await sel.locator('option').allInnerTexts();
    ok(opts.includes('Field trip report') && opts.includes('Lab write-up') && !opts.includes('Reading log'), 'the guide list has the school’s template and the Lab write-up, not the Reading log (off)');
    await sel.selectOption({ label: 'Field trip report' });
    await audit(t, 'Set a task with a guide');
    await dlg.locator('.cp-foot .primary').click(); await t.waitForSelector('.tk-set', { state: 'detached' });
    const task = await until(() => (saved().teacherTasks || []).find((x) => x.title === 'Science museum trip'));
    ok(task?.templateId === mt.id && task.classId === CLASS, `the task carries the template (${task?.templateId})`);
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.tk-list');
    ok((await t.innerText('.tk-list')).includes('guide: Field trip report'), 'the class page lists the task with its guide');

    // ── Aaron sees the guide on the task and hands it in through it ──
    await a.reload(); await a.waitForSelector('.simple .tk-card');
    await a.locator('.tk-card', { hasText: 'Science museum trip' }).click(); await a.waitForSelector('.tk-flow');
    ok((await a.innerText('.tk-flow .mt-guide-note')).includes('Mr Coultas gave you a guide:') && (await a.innerText('.tk-flow .mt-guide-note')).includes('Field trip report'), 'the brief says Mr Coultas gave a guide: Field trip report');
    await a.click('.tk-flow .sh-next .primary');
    ok((await a.innerText('.tk-flow .mt-step h2')).trim() === 'Where did your class go?' && (await a.innerText('.mt-from')).includes('Question 1 of 3'), 'the school’s template, one part per screen');
    ok(JSON.stringify(await a.locator('.tk-flow .sh-starters button').allInnerTexts()) === JSON.stringify(['We went to…', 'We visited…']), 'with its starters');
    await audit(a, 'hand-in through a guide');
    await a.screenshot({ path: SH + 'handin.png' });
    const trip = ['We went to the science museum.', 'I saw a model of a volcano.', 'How hot is lava?'];
    for (let i = 0; i < 3; i++) { if (i) ok((await a.innerText('.mt-from')).includes(`Question ${i + 1} of 3`), `part ${i + 1} of 3`); await a.fill('.tk-flow .mt-step textarea', trip[i]); await a.click('.tk-flow .sh-next .primary'); }
    await a.waitForSelector('.tk-flow h2:has-text("photo or a file")');
    await a.click('.tk-flow .sh-next .primary'); await a.waitForSelector('.tk-flow h2:has-text("Handed in!")');
    const hi = await until(() => (saved().handIns || []).find((r) => r.taskId === task.id && r.studentId === AARON && r.eventId));
    const hev = hi && saved().events.find((e) => e.id === hi.eventId);
    const hrf = hev && saved().reflections.find((r) => r.eventId === hev.id);
    ok(hev?.templateId === mt.id && hrf?.text === `Where we went\n${trip[0]}\n\nWhat I saw\n${trip[1]}\n\nA question I still have\n${trip[2]}` && hrf.prompt === 'Science museum trip', 'handed in: the moment has the template id and the answers under their headings');
    await cA.close();
    const g = await t.goto(`${U}/#/me/classes/${CLASS}~task~${task.id}`).then(() => t.waitForSelector('.tk-grid'));
    ok(!!g && (await t.innerText(`.tk-cell[data-student="${AARON}"]`)).includes('A question I still have'), 'Mr Coultas reads the sections on the hand-in grid');
    await cT.close();

    // ── Aaron at Standard: the add dialog's guide is labelled fields ──
    ok((await act(aTok, 'setIntensity', [AARON, 'standard'])).ok, 'Aaron switches to Standard');
    const cS = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await cS.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const s = await cS.newPage(); s.on('pageerror', (e) => errs.push(e.message));
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('button:has-text("Add a station")');
    await s.click('button:has-text("Add a station")'); await s.waitForSelector('.add-station');
    await s.fill('.add-station label:has-text("What happened") input', 'Volcano trip notes');
    await s.locator('.add-station .line-chip', { hasText: 'Science' }).click();
    await s.locator('.add-station .mt-offer-list button', { hasText: 'Field trip report' }).click();
    ok(await s.locator('.add-station .mt-fields .mt-field').count() === 3 && (await s.innerText('.mt-fields legend')).includes('Field trip report'), 'Standard: the guide as three labelled fields');
    await s.fill('.mt-fields textarea >> nth=0', 'The museum.'); await s.click('.mt-field:nth-of-type(2) .sp-starters button'); await s.type('.mt-fields textarea >> nth=1', 'a model volcano.');
    await audit(s, 'Standard add dialog with a guide');
    await s.screenshot({ path: SH + 'standard.png' });
    await s.click('.add-station .composer-foot .primary');
    const sev = await until(() => saved().events.find((e) => e.studentId === AARON && e.title === 'Volcano trip notes'));
    const srf = sev && saved().reflections.find((r) => r.eventId === sev.id);
    ok(sev?.templateId === mt.id && srf?.text === 'Where we went\nThe museum.\n\nWhat I saw\nI saw a model volcano.', `Standard: saved with the template and its headings (${JSON.stringify(srf?.text)})`);
    await cS.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
