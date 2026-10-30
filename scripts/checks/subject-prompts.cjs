// Subject prompts on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster. Mr David Coultas (T60198), in his own browser context, writes prompts for his class C-392000 (a note, three
// questions, starters, an example of his own). Aaron Torres (Year 8, Simple, in that class), on a phone in his own context,
// adds a Science moment and gets Mr Coultas's questions one per screen, with the starters, the example and read aloud
// (speechSynthesis watched); the moment carries the prompts' id and Mr Coultas sees "1 moment written with them". At
// Standard, Aaron's add dialog opens "Ideas for this line" on them. A Year 8 student of another Science class, in a third
// context, gets the built-in Science prompts instead. axe (serious and critical) over every new screen.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-subject-prompts-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-subject-prompts-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', COULTAS = 'T60198', CLASS = 'C-392000';
const QS = ['What question did your experiment try to answer?', 'What did you change, and what did you keep the same?', 'What did your results show?'];
const NOTE = 'A good science moment says what you tested and what the results showed, even if it did not work.';
const STARTERS = ['Our question was…', 'We kept the same…'];
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await wait(200); } };

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-sp-data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
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
    const inClass = new Set(rec.enrolments.filter((n) => n.classId === CLASS).map((n) => n.studentId));
    const other = rec.enrolments.map((n) => ({ n, c: rec.classes.find((c) => c.id === n.classId) }))
      .find(({ n, c }) => c?.lineId === 'science' && c.year === 8 && !c.teacherIds.includes(COULTAS) && !inClass.has(n.studentId) && roster.students.find((s) => s.id === n.studentId)?.email);
    const aaron = roster.students.find((s) => s.id === AARON), coultas = roster.teachers.find((t) => t.id === COULTAS);
    const otherS = roster.students.find((s) => s.id === other.n.studentId);
    ok(cls?.lineId === 'science' && cls.teacherIds.includes(COULTAS) && inClass.has(AARON), `${coultas.name} teaches ${cls.name} on Science; ${aaron.name} is in it`);
    ok(!!otherS, `${otherS?.name} (Year ${otherS?.year}) is in ${other.c.name}, another teacher’s Science class`);
    const tTok = await setupWith(U, links[coultas.email]), aTok = await setupWith(U, links[aaron.email]), oTok = await setupWith(U, links[otherS.email]);
    ok((await act(aTok, 'completeOnboarding', [AARON, ['science', 'sport'], null])).ok && (await act(oTok, 'completeOnboarding', [otherS.id, ['science', 'art'], null])).ok, 'both students have picked their lines');
    // A student never writes prompts; a teacher never for a class that is not theirs.
    ok((await act(aTok, 'setSubjectPrompts', [{ classId: CLASS }, { questions: QS }, COULTAS])).status === 403, 'a student cannot write prompts (403)');
    ok((await act(tTok, 'setSubjectPrompts', [{ classId: other.c.id }, { questions: QS }, COULTAS])).status === 403, 'nor can Mr Coultas for another teacher’s class (403)');
    ok((await act(tTok, 'setSubjectPrompts', [{ lineId: 'science' }, { questions: QS }, COULTAS])).status === 403, 'nor for the whole Science line (403)');

    // ── Mr Coultas, on his laptop: writes prompts for his class ──
    const cT = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.sp-card');
    ok((await t.innerText('.sp-card')).includes('built-in Science prompts'), 'his class page says students see the built-in Science prompts');
    await audit(t, 'teacher class page with the prompts card');
    await t.click('.sp-card button:has-text("Write prompts for this class")'); await t.waitForSelector('.sp-edit');
    ok(await t.locator('.sp-edit input[aria-label^="Question"]').count() === 5, 'the editor starts from the 5 built-in questions');
    await t.fill('.sp-edit textarea >> nth=0', NOTE);
    while (await t.locator('.sp-edit input[aria-label^="Question"]').count() > 3) await t.locator('.sp-edit button[aria-label^="Remove question"]').last().click();
    for (let i = 0; i < 3; i++) await t.fill(`.sp-edit input[aria-label="Question ${i + 1}"]`, QS[i]);
    while (await t.locator('.sp-edit button[aria-label^="Remove starter"]').count()) await t.locator('.sp-edit button[aria-label^="Remove starter"]').first().click();
    for (let i = 0; i < STARTERS.length; i++) { await t.click('.sp-edit button:has-text("Add a starter")'); await t.fill(`.sp-edit input[aria-label="Starter ${i + 1}"]`, STARTERS[i]); }
    await t.click('.sp-edit button:has-text("Write one")');
    await t.fill('.sp-own input', 'Which paper towel holds the most water?');
    await t.fill('.sp-own textarea', 'We tested three brands. Only the size of the towel changed. The thickest held twice as much.');
    await t.click('.sp-own button:has-text("Add this example")');
    await audit(t, 'prompt editor');
    await t.screenshot({ path: SH + 'editor.png' });
    await t.click('.sp-edit .cp-foot .primary'); await t.waitForSelector('.sp-edit', { state: 'detached' });
    const sp = await until(() => (saved().subjectPrompts || []).find((p) => p.classId === CLASS));
    ok(!!sp && sp.by === COULTAS && JSON.stringify(sp.questions) === JSON.stringify(QS) && JSON.stringify(sp.starters) === JSON.stringify(STARTERS) && sp.note === NOTE && sp.examples[0]?.status === 'teacher', `saved on the server: ${sp?.id}, his note, 3 questions, 2 starters, 1 example`);
    await until(async () => (await t.innerText('.sp-card')).includes('0 moments written with them'));
    ok((await t.innerText('.sp-card')).includes(`Yours for ${cls.name}`), 'the card now says the prompts are his for the class');

    // ── Aaron, on his phone (Simple): adds a Science moment, one question per screen ──
    const phone = async (tok) => {
      const c = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
      await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); await c.addInitScript(SPEECH);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${U}/#/me/map`); await p.waitForSelector('.simple .sh-actions');
      return [c, p];
    };
    const [cA, a] = await phone(aTok);
    await a.click('.sh-card.add'); await a.waitForSelector('.sh-flow h2');
    await a.fill('.sh-flow input.sh-input', 'Paper towel test'); await a.click('.sh-flow .sh-next .primary');
    await a.locator('.sh-lines button', { hasText: 'Science' }).click();
    await a.waitForSelector('.sp-guided');
    const from = await a.innerText('.sp-guided .sp-from');
    ok(from.includes('Mr Coultas') && from.includes(cls.name), `the first question says who it is from (${from})`);
    ok((await a.innerText('.sp-guided .sp-note')) === NOTE, 'his note on what makes a good moment');
    ok((await a.innerText('.sp-guided h2')).trim() === QS[0], `question 1 of 3: “${QS[0]}”`);
    const dots = await a.getAttribute('.sh-steps', 'aria-label');
    ok(dots === 'Step 3 of 6', `the steps count each question (${dots})`);
    ok(JSON.stringify(await a.locator('.sp-guided .sh-starters button').allInnerTexts()) === JSON.stringify(STARTERS), 'his sentence starters');
    await a.click('.sp-guided h2 .vc-speak');
    ok(await until(() => a.evaluate((q) => window.__said.includes(`en-GB|${q}`), QS[0])), 'read aloud: the speaker reads the question out (en-GB)');
    await a.click('.sp-examples summary');
    ok((await a.innerText('.sp-examples')).includes('Which paper towel holds the most water?') && (await a.innerText('.sp-examples')).includes('Written by a teacher'), 'his example is there to open');
    await audit(a, 'Simple question screen with a teacher’s prompts');
    await a.screenshot({ path: SH + 'simple-q1.png' });
    await a.click('.sp-guided .sh-starters button >> nth=0');
    await a.type('.sp-guided textarea', 'which towel soaks up most.');
    ok((await a.inputValue('.sp-guided textarea')) === 'Our question was which towel soaks up most.', 'a starter begins the answer');
    await a.click('.sp-guided .sh-next .primary');
    ok((await a.innerText('.sp-guided h2')).trim() === QS[1] && (await a.innerText('.sp-from')) === 'Question 2 of 3', 'Next question: question 2 of 3');
    await a.fill('.sp-guided textarea', 'We changed the brand and kept the size the same.');
    await a.click('.sp-guided .sh-next .primary');
    ok((await a.innerText('.sp-guided h2')).trim() === QS[2], 'question 3 of 3');
    await a.fill('.sp-guided textarea', 'The thickest towel held the most.');
    await a.click('.sp-guided .sh-next .primary');
    await a.waitForSelector('.sh-who'); await a.click('.sh-notnow'); await a.waitForSelector('.toast.show');
    const ev = await until(() => saved().events.find((e) => e.studentId === AARON && e.title === 'Paper towel test'));
    const refl = ev && saved().reflections.find((r) => r.eventId === ev.id)?.text;
    ok(ev?.promptId === sp.id, `the moment carries the prompts’ id (${ev?.promptId})`);
    ok(refl === `${QS[0]}\nOur question was which towel soaks up most.\n\n${QS[1]}\nWe changed the brand and kept the size the same.\n\n${QS[2]}\nThe thickest towel held the most.`, 'each answer is kept under its question');
    await t.reload(); await t.waitForSelector('.sp-card');
    ok(await until(async () => (await t.innerText('.sp-card')).includes('1 moment written with them')), 'Mr Coultas sees “1 moment written with them”');

    // ── Aaron at Standard: the add dialog's "Ideas for this line", open on his teacher's prompts ──
    ok((await act(aTok, 'setIntensity', [AARON, 'standard'])).ok, 'Aaron switches to Standard');
    await a.goto(`${U}/#/me/map`); await a.reload(); await a.waitForSelector('button:has-text("Add a station")');
    await a.click('button:has-text("Add a station")'); await a.waitForSelector('.add-station');
    await a.locator('.add-station .line-chip', { hasText: 'Science' }).click();
    await a.waitForSelector('.sp-ideas');
    ok(await a.evaluate(() => document.querySelector('.sp-ideas').open) && (await a.innerText('.sp-ideas summary')).includes('Mr Coultas'), 'Standard: “Ideas for this line” is open on Mr Coultas’s prompts');
    await a.click('.sp-ideas .sp-starters button >> nth=1');
    ok((await a.inputValue('.add-station textarea')).startsWith('We kept the same'), 'a starter goes into the reflection');
    await audit(a, 'Standard add dialog with Ideas for this line');
    await cA.close();

    // ── A Year 8 student of another Science class: the built-in Science prompts ──
    const [cO, o] = await phone(oTok);
    await o.click('.sh-card.add'); await o.waitForSelector('.sh-flow h2');
    await o.fill('.sh-flow input.sh-input', 'Volcano model'); await o.click('.sh-flow .sh-next .primary');
    await o.locator('.sh-lines button', { hasText: 'Science' }).click();
    await o.waitForSelector('.sh-flow textarea');
    ok(await o.locator('.sp-guided').count() === 0 && (await o.innerText('.sh-flow h2')).trim() === 'What did you learn?', 'no teacher’s questions: the usual “What did you learn?” screen');
    const note = await o.innerText('.sh-flow .sp-note');
    ok(note.startsWith('A good science moment says what you set out to find out') && !(await o.innerText('.sh-flow')).includes('Coultas'), 'the built-in Science note, nothing of Mr Coultas’s');
    ok((await o.locator('.sh-starters button').allInnerTexts()).includes('I wanted to find out…'), 'the built-in Science starters');
    await o.click('.sp-help');
    ok((await o.innerText('.sp-guided .sp-from')) === 'Ideas for every student' && (await o.innerText('.sp-guided h2')).trim() === 'What were you trying to find out?', '“Help me with questions”: the built-in questions, one per screen');
    await audit(o, 'Simple question screen with the built-in prompts');
    await o.screenshot({ path: SH + 'default.png' });
    await o.fill('.sp-guided textarea', 'Whether baking soda and vinegar make enough gas.');
    await o.click('.sp-skip'); await o.waitForSelector('.sh-who'); await o.click('.sh-notnow'); await o.waitForSelector('.toast.show');
    const ev2 = await until(() => saved().events.find((e) => e.studentId === otherS.id && e.title === 'Volcano model'));
    ok(ev2?.promptId === 'sp-default-science', `the moment counts for the built-in Science prompts (${ev2?.promptId})`);
    const o2 = await (await fetch(`${U}/api/state`, { headers: H(oTok) })).json();
    const o2s = typeof o2.snapshot === "string" ? JSON.parse(o2.snapshot) : o2.snapshot;
    ok((o2s.store.subjectPrompts || []).every((p) => p.examples.every((x) => !x.studentId)), 'their record holds no student ids in anyone’s examples');
    await cO.close(); await cT.close();

    // ── A coordinator (head of department): every line's prompts, and the classes with their own ──
    const coord = roster.teachers.find((x) => (x.roles || [])[0] === 'coordinator' && x.email && links[x.email]) || roster.teachers.find((x) => (x.roles || []).includes('coordinator') && links[x.email]);
    const cTok = await setupWith(U, links[coord.email]);
    const cC = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await cC.addCookies([{ name: 'tp_session', value: cTok, url: U }]);
    const k = await cC.newPage(); k.on('pageerror', (e) => errs.push(e.message));
    await k.goto(`${U}/#/me/prompts`); await k.waitForSelector('.sp-page .sp-card');
    ok(await k.locator('nav >> text=Subject prompts').count() > 0 || await k.locator('text=Subject prompts').count() > 0, `${coord.name} has Subject prompts in the menu`);
    ok(await k.locator('.sp-page .sp-card').count() === 9, 'all nine school lines');
    const sci = await k.innerText('.sp-page .sp-card:has(h2:has-text("Science"))');
    ok(sci.includes('Built-in prompts') && sci.includes('built-in prompts used for 1 moment') && sci.includes(`${cls.name} (1 moment)`), `Science: built-in, used once, and ${cls.name} with its own, used once`);
    await audit(k, 'coordinator Subject prompts screen');
    await k.click('.sp-page .sp-card:has(h2:has-text("Art")) button:has-text("Write the line’s prompts")'); await k.waitForSelector('.sp-edit');
    await k.click('.sp-edit .cp-foot .primary'); await k.waitForSelector('.sp-edit', { state: 'detached' });
    ok(await until(() => (saved().subjectPrompts || []).some((p) => p.lineId === 'art' && !p.classId && p.by === coord.id)), 'the coordinator saves the Art line’s prompts (from the built-in ones)');
    await k.screenshot({ path: SH + 'lines.png' });
    await cC.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
