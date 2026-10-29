// Advisor conference sheets on the school's real class lists: starts its own clean pilot server (needs `npm run build`
// first), imports the roster, and Aaron Torres adds two moments from his own browser: one shared with his advisor (with a
// reflection) and one private. His advisor, Ms Jane Altemen, writes a note and a comment, then prints conference sheets
// for all of advisory 8C: one A4 page per student in the PDF; Aaron's shows the shared moment and reflection, never the
// private one. The family copy leaves out comments, notes and signals. Then one sheet from Aaron's own page.
// ROSTER=<path> picks the file; without it the check is skipped. Screenshots and PDFs go to SCRATCH, never the repo.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SCRATCH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-conference-'));
const SH = (f) => path.join(SCRATCH, f);
const STUDENT = 'Sabc0d6125e85', ADVISOR = 'T25948'; // Aaron Torres; Ms Jane Altemen, advisory 8C
const SHARED = 'Bridge build for the design challenge', SECRET = 'Diary page only for me';
const SHARED_REFL = 'I learned that triangles make the bridge stiffer than squares.', SECRET_REFL = 'Nobody else should read this sentence.';
const NOTE = 'Talked about joining the robotics club next term.';
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
const pdfPages = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

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

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  srv = await start(port, path.join(SCRATCH, 'data'));
  const b = await chromium.launch();
  const errs = [];
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const aaron = roster.students.find((s) => s.id === STUDENT), jane = roster.teachers.find((t) => t.id === ADVISOR);
    const advisees = roster.students.filter((s) => s.advisorId === ADVISOR);
    ok(aaron?.advisorId === ADVISOR && advisees.length === 23, `${aaron?.name} (Year ${aaron?.year}) is one of ${jane?.name}'s ${advisees.length} advisees`);
    const sTok = await setupWith(U, links[aaron.email]), aTok = await setupWith(U, links[jane.email]);
    const page = async (tok) => { const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

    // ── Aaron, in his own browser: two moments, one shared with his advisor, one private ──
    const s = await page(sTok);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('main.screen');
    const act = async (p, fn, args) => { const r = await p.request.post(`${U}/api/action`, { data: { fn, args, rec: [] } }); return r.status(); };
    ok(await act(s, 'completeOnboarding', [STUDENT, ['science', 'design', 'sport'], 'general']) === 200, 'Aaron picks Science, Design and Sport');
    ok(await act(s, 'addStation', [STUDENT, { title: SHARED, lineIds: ['design'], type: 'project', visibility: 'advisor', reflection: SHARED_REFL }]) === 200, 'Aaron adds a moment for his advisor, with a reflection');
    ok(await act(s, 'addStation', [STUDENT, { title: SECRET, lineIds: ['science'], type: 'project', visibility: 'private', reflection: SECRET_REFL }]) === 200, 'Aaron adds a private moment, with a reflection');
    const soon = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    ok(await act(s, 'addGoal', [STUDENT, { title: 'Science fair poster', date: soon, lineId: 'science' }]) === 200, 'Aaron plans a goal for 10 days from now');

    // ── Ms Altemen: a note and a comment, both only for staff ──
    const a = await page(aTok);
    const st = (await (await fetch(`${U}/api/state`, { headers: H(aTok) })).json()).snapshot.store;
    const shared = st.events.find((e) => e.title === SHARED);
    ok(!!shared && !st.events.some((e) => e.title === SECRET) && !st.reflections.some((r) => r.text === SECRET_REFL), 'her record has the shared moment and never the private one');
    await a.goto(`${U}/#/me/advisory`); await a.waitForSelector('.adv-grid');
    ok(await act(a, 'addNote', [STUDENT, NOTE]) === 200, 'she writes an advisor note');
    ok(await act(a, 'addMomentComment', [shared.id, ADVISOR, 'Lovely bridge. Which design failed first?']) === 200, 'she comments on the shared moment');
    await a.reload(); await a.waitForSelector('.adv-grid');

    // ── All of advisory 8C ──
    await a.click('button:has-text("Print conference sheets")');
    ok(/All 23 students/.test(await a.locator('.cf-panel').innerText()), 'the panel offers all 23 students');
    await a.click('.cf-panel label:has-text("Choose students")');
    ok(await a.locator('.cf-pick input[type=checkbox]').count() === 23 && await a.locator('.cf-panel button:has-text("Make 0 sheets")').isDisabled(), 'Choose students: a tick box each, nothing until ticked');
    await a.locator('.cf-pick label', { hasText: aaron.name }).locator('input').check();
    ok(await a.locator('.cf-panel button:has-text("Make 1 sheet")').count() === 1, 'one tick: one sheet');
    await a.click('.cf-panel label:has-text("All 23 students")');
    const t0 = Date.now();
    await a.click('.cf-panel button:has-text("Make 23 sheets")'); await a.waitForSelector('.cf-sheet');
    ok(await a.locator('.cf-sheet').count() === 23, `23 sheets on screen in ${Date.now() - t0} ms`);
    const sheet = a.locator(`.cf-sheet[data-student="${STUDENT}"]`);
    const text = await sheet.innerText();
    ok(text.includes(SHARED) && text.includes(SHARED_REFL), "Aaron's sheet shows the shared moment and its reflection");
    ok(!text.includes(SECRET) && !text.includes(SECRET_REFL) && !(await a.locator('.cf-overlay').innerText()).includes(SECRET), 'never the private moment or reflection');
    ok(new RegExp(`Year ${aaron.year}`).test(text) && text.includes(aaron.homeroom) && /Design[\s\S]*Science[\s\S]*Sport|Science|Design/.test(text), `name, Year ${aaron.year}, homeroom ${aaron.homeroom} and his lines`);
    ok(/Science fair poster[\s\S]*Due soon/.test(text), 'the goal with its status');
    ok(text.includes(NOTE) && /Comments\s*1/i.test(text), 'advisor copy: her note and the comment count');
    const points = await sheet.locator('.cf-talk li').allInnerTexts();
    ok(points.length === 3 && /^Busiest line: Design/.test(points[0]) && points.some((p) => /Science fair poster/.test(p)), `three talking points: ${points.join(' | ')}`);
    ok(await sheet.locator('.cf-lines span').count() >= 4, 'blank lines for notes');
    ok(new RegExp(`Prepared by ${jane.name} on \\d+ \\w+ 20\\d\\d · confidential to the student, family and school`).test(text), 'footer: prepared by her, dated, confidential');
    const bad = await a.evaluate(() => [...document.querySelectorAll('.cf-overlay *')].filter((e) => { const s = getComputedStyle(e); return s.boxShadow !== 'none' || /gradient/.test(s.backgroundImage) || Number(s.fontWeight) > 600; }).length);
    ok(bad === 0, 'brand: no shadows, no gradients, weights up to 600');
    await sheet.screenshot({ path: SH('aaron-sheet.png') });
    await a.emulateMedia({ media: 'print' });
    ok(await a.locator('#root').isHidden() && await a.locator('.cf-bar').isHidden(), 'print: only the sheets');
    const fit = await a.evaluate(() => [...document.querySelectorAll('.cf-sheet')].filter((s) => s.scrollHeight > s.clientHeight + 1).map((s) => s.dataset.student));
    ok(!fit.length, `every sheet fits its page${fit.length ? `: overflow ${fit.join(', ')}` : ''}`);
    const t1 = Date.now();
    const pdf = await a.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH('advisory-8C.pdf'), pdf);
    ok(pdfPages(pdf) === 23, `PDF: ${pdfPages(pdf)} A4 pages in ${Date.now() - t1} ms`);
    await a.emulateMedia({ media: 'screen' });

    // ── Family copy ──
    await a.click('.cf-bar label:has-text("Family copy")');
    await a.waitForSelector('.cf-sheet.family');
    const fam = await sheet.innerText();
    const young = aaron.year <= 9; // Years 7 to 9: the family sees what the advisor sees
    ok(/family copy/i.test(fam) && !fam.includes(NOTE) && !/Comments/i.test(fam) && !/For the advisor only/i.test(fam), 'family copy: no note, no comment count, nothing for the advisor only');
    ok(young ? fam.includes(SHARED) && fam.includes(SHARED_REFL) : !fam.includes(SHARED), young ? 'Year 7 to 9: the family sees what the advisor sees' : 'Year 10 up: the family sees only what is shared with the school');
    ok(!fam.includes(SECRET) && !fam.includes(SECRET_REFL), 'family copy: never the private moment');
    await sheet.screenshot({ path: SH('aaron-family.png') });
    await a.emulateMedia({ media: 'print' });
    const fpdf = await a.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH('advisory-8C-family.pdf'), fpdf);
    ok(pdfPages(fpdf) === 23, `family PDF: ${pdfPages(fpdf)} pages`);
    await a.emulateMedia({ media: 'screen' });
    await a.click('.cf-bar button:has-text("Close")');

    // ── One sheet from Aaron's page ──
    await a.goto(`${U}/#/me/student/${STUDENT}`); await a.waitForSelector('.as-head');
    await a.click('.as-head button:has-text("Conference sheet")'); await a.waitForSelector('.cf-sheet');
    ok(await a.locator('.cf-sheet').count() === 1 && (await a.locator('.cf-sheet').innerText()).includes(SHARED), "Aaron's page: one sheet, his");
    await a.emulateMedia({ media: 'print' });
    const one = await a.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(SH('aaron.pdf'), one);
    ok(pdfPages(one) === 1, 'one-page PDF');
    await a.emulateMedia({ media: 'screen' });

    // ── Phone width ──
    await a.setViewportSize({ width: 390, height: 820 });
    ok(await a.evaluate(() => document.querySelector('.cf-overlay').scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots and PDFs in', SCRATCH);
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv?.p.kill(); }
})();
