// Thai for students on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports
// the real roster and gives three students something on every screen: Aaron Torres (Year 8, Simple, on a phone), a Year 10
// student (Standard) and a Year 12 student (Full, with a leaver portfolio), each in their own browser context. Teachers set
// a class task, ask the class a question, spot a moment, open a term reflection, comment and send encouragement; a
// classmate gives kind feedback. Each student switches to ไทย in the display menu, then every screen and flow they can
// reach is walked and fails if visible English interface text remains (people's names, line names and codes, the
// school's own words and the students' own words are allowed: they are never translated). Also: their own words stay as
// written even when they match an interface string, a Thai sentence starter puts Thai in the box, dates have Thai
// months and Gregorian years, <html lang="th">, axe (serious, critical) on the main screens, and English comes back.
// TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Leftovers and screenshots: SCRATCH or the temp folder.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || process.env.ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'tp-thai-students-'));
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const AARON = 'Sabc0d6125e85', ALTEMEN = 'T25948', COULTAS = 'T60198', CLASS = 'C-392000';
const THAI = /[฀-๿]/;
const freePort = () => new Promise((r) => { const srv = require('net').createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => r(port)); }); });
function start(port, dataDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', TP_START: 'empty', DATA_DIR: dataDir, LOG_REQUESTS: '0' } });
    let out = ''; let setup = null;
    const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
    p.stdout.on('data', (d) => { out += d; setup ||= out.match(/#\/setup\/(\S+)/)?.[1]; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const setupWith = async (U, token, extra = {}) => {
  const r = await fetch(`${U}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: 'pilot-pass-123', ...extra }) });
  if (!r.ok) throw new Error(`setup ${r.status}`);
  return r.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
};
const day = (n) => new Date(Date.now() + 7 * 36e5 + n * 864e5).toISOString().slice(0, 10); // Bangkok

// The record's own words, as src/api.js recordWords() collects them (kept in step with it).
const NOT_WORDS = new Set(['activity', 'notifications', 'linkViews', 'rosterImport', 'answered', 'intensity', 'family']);
const NOT_WORD_KEYS = new Set(['id', 'type', 'kind', 'status', 'verification', 'visibility', 'role', 'audience', 'theme', 'layout', 'tier', 'prompt', 'phrase', 'url', 'token', 'date', 'at', 'ts', 'colour']);
function recordWords(store) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { const s = v.trim(); if (s && /[A-Za-z]/.test(s)) out.add(s); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const k in v) if (!NOT_WORD_KEYS.has(k)) walk(v[k]);
  };
  for (const k in store) if (!NOT_WORDS.has(k)) walk(store[k]);
  return out;
}
// Words that stay English in Thai: the product, the school's systems and programmes, file kinds.
const KEEP = ['Transit Portfolio', 'Transit', 'Portfolio', 'NIST', 'ManageBac', 'Toddle', 'PowerSchool', 'GitHub', 'Google', 'IB', 'MYP', 'DP', 'CAS', 'LO', 'TOK', 'EE', 'PDPA', 'PDF', 'QR', 'CSV', 'JSON', 'HTML', 'CSS', 'API', 'URL', 'ID', 'SIS', 'English', 'Diploma', 'IB Diploma', 'IB MYP', 'Year', 'Ctrl', 'K', 'AM', 'PM', 'km', 'kg', 'OK', 'ZIP', 'A3', 'A4', 'UCL',
  'Metro', 'Ivy', 'Slate', 'Night', 'LMS', 'CLB', 'GH', 'EXM', 'index.html', 'style.css', 'data.json', 'endpoint', 'pull request', 'commit', 'README', 'Enter', 'Esc']; // theme names, system codes, file names

// Visible text and labels on the page, outside people's own words and form fields.
const COLLECT = () => {
  const out = [];
  const shown = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return el.getClientRects().length > 0; };
  const skip = (el) => !!el.closest('[translate="no"], textarea, script, style, code, pre, noscript, [contenteditable="true"], .tour-btn, .presenter');
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement; const v = n.nodeValue.trim();
    if (!v || !/[A-Za-z]{2}/.test(v) || skip(el) || !shown(el)) continue;
    out.push({ v, at: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`, block: (el.closest('li, p, button, label, h1, h2, h3, div') || el).innerText?.slice(0, 160) });
  }
  for (const el of document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]')) {
    if (el.closest('[translate="no"]') || !shown(el) && el.tagName !== 'IMG') continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) { const v = el.getAttribute(a)?.trim(); if (v && /[A-Za-z]{2}/.test(v)) out.push({ v, at: `@${a} ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}` }); }
  }
  return out;
};

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-thai-students-data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
  const b = await chromium.launch();
  const leftovers = {};
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const act = async (tok, fn, args) => { const r = await fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) }); const j = await r.json().catch(() => ({})); if (!r.ok) console.log('INFO', fn, r.status, j.error); return j.result; };
    const stateOf = async (tok) => (await (await fetch(`${U}/api/state`, { headers: { cookie: `tp_session=${tok}` } })).json()).snapshot.store;
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const person = (id) => [...roster.students, ...roster.teachers].find((x) => x.id === id);
    const tok = {}; const tokOf = async (id) => (tok[id] ||= await setupWith(U, links[person(id).email]));
    const classesOf = (sid) => roster.enrolments.filter((e) => e.studentId === sid).map((e) => e.classId);
    // A Year 10 student with an advisor and a Year 10 classmate; a Year 12 student with an advisor.
    const pick = (year) => roster.students.filter((s) => s.year === year && links[s.email] && roster.teachers.find((t) => t.id === s.advisorId && links[t.email]))
      .find((s) => roster.students.some((o) => o.id !== s.id && o.year === year && links[o.email] && classesOf(o.id).some((c) => classesOf(s.id).includes(c))));
    const Y10 = pick(10), Y12 = pick(12);
    const mate = roster.students.find((o) => o.id !== Y10.id && o.year === 10 && links[o.email] && classesOf(o.id).some((c) => classesOf(Y10.id).includes(c)));
    ok(Y10 && Y12 && mate, `students: ${person(AARON).name} (Year 8), ${Y10.name} (Year 10), ${Y12.name} (Year 12); ${mate.name} shares a class with ${Y10.name.split(' ')[0]}`);
    const names = new Set([...roster.students, ...roster.teachers].flatMap((x) => [x.name, ...x.name.split(/\s+/)]).concat(['Pat', 'Admin']));

    // What is left in English on the page, after people's words, names, lines and kept words are taken out.
    const sweep = async (p, sid, label) => {
      await p.waitForTimeout(250);
      const words = recordWords(await stateOf(tok[sid]));
      const lines = (await stateOf(tok[sid])).lines.map((l) => l.name);
      const own = [...words].filter((w) => w.length > 2).sort((x, y) => y.length - x.length);
      const keep = [...lines, ...KEEP].sort((x, y) => y.length - x.length);
      const left = [];
      for (const { v, at, block } of await p.evaluate(COLLECT)) {
        if (words.has(v)) continue;
        if (/^(text|tspan)\./.test(at) && own.some((w) => w.includes(v))) continue; // a long title wrapped over lines on the map
        let r = v;
        for (const w of own) if (r.includes(w)) r = r.split(w).join(' ');
        for (const w of keep) r = r.replace(new RegExp(`(^|[^A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'gi'), '$1 ');
        r = r.replace(/https?:\/\/\S*|\S+@\S+|#\/\S*|\/s\/\S+|\S+\.(png|jpe?g|svg|pdf|webm|m4a)\b/gi, ' ');
        r = r.split(/[^A-Za-z’'-]+/).filter((w) => /[A-Za-z]{2}/.test(w) && !names.has(w.replace(/’s$/, ''))).join(' ');
        if (r) left.push(`${v}   [${at}]${block && block !== v ? `   « ${block.replace(/\s+/g, ' ')} »` : ''}`);
      }
      const uniq = [...new Set(left)];
      if (uniq.length) leftovers[label] = uniq;
      ok(!uniq.length, `${label}: no English interface text${uniq.length ? ` (${uniq.length}: ${uniq.slice(0, +(process.env.TH_ALL || 4)).map((x) => x.split('   ')[0]).join(' | ')})` : ''}`);
    };
    const audit = async (p, label, include = ['main']) => {
      if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
      const v = await p.evaluate((inc) => window.axe.run({ include: inc }, { resultTypes: ['violations'] }).then((r) => r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`)), include);
      ok(!v.length, `axe: ${label}${v.length ? ` ${v.join(' | ')}` : ''}`);
    };
    const ctx = async (sid, phone) => {
      await tokOf(sid);
      const c = await b.newContext(phone ? { viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true } : { viewport: { width: 1360, height: 900 } });
      await c.addCookies([{ name: 'tp_session', value: tok[sid], url: U }]);
      const p = await c.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p;
    };
    const toThai = async (p) => {
      await p.click('.view-btn'); await p.click('.view-menu button[lang="th"]');
      await p.waitForFunction(() => document.documentElement.lang === 'th');
      await p.click('.view-btn').catch(() => {});
    };
    const close = async (p) => { await p.keyboard.press('Escape'); const x = p.locator('.modal .panel-close, .station-panel.open .panel-close, .modal-back .panel-close'); if (await x.count()) await x.first().click().catch(() => {}); await p.waitForTimeout(200); };
    const openSweep = async (p, sid, sel, label) => {
      const el = p.locator(sel).first();
      if (!await el.count()) { ok(false, `${label}: ${sel} is on the page`); return false; }
      await el.click(); await sweep(p, sid, label); return true;
    };

    // ── Seeds: teachers and classmates leave something for each student ──
    const [aT, yT, zT, mT] = [await tokOf(AARON), await tokOf(Y10.id), await tokOf(Y12.id), await tokOf(mate.id)];
    const cT = await tokOf(COULTAS), alT = await tokOf(ALTEMEN), y10Adv = await tokOf(Y10.advisorId), y12Adv = await tokOf(Y12.advisorId);

    // ═══ Aaron Torres, Year 8, Simple, on a phone: switches to ไทย before onboarding ═══
    const a = await ctx(AARON, true);
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.onboard');
    await toThai(a);
    ok((await stateOf(aT)) && (await (await fetch(`${U}/api/auth/me`, { headers: { cookie: `tp_session=${aT}` } })).json()).user.lang === 'th', 'Aaron’s account keeps ไทย (/api/auth/prefs)');
    await sweep(a, AARON, 'Aaron: onboarding, step 1');
    await a.locator('.ob-pick').first().click(); await a.locator('.ob-pick:not(.on)').first().click();
    await a.click('.ob-foot .primary'); await sweep(a, AARON, 'Aaron: onboarding, step 2');
    await a.click('.ob-foot .primary'); await sweep(a, AARON, 'Aaron: onboarding, last step');
    await a.click('.ob-foot .primary'); await a.waitForSelector('.simple .sh-actions');
    const aLines = (await stateOf(aT)).students.find((s) => s.id === AARON).laneOrder;
    // His moments, a goal with a check-in, and what his teachers send.
    const m1 = await act(aT, 'addStation', [AARON, { title: 'Built a bridge out of straws', lineIds: [aLines[0]], date: day(-20), type: 'project', summary: 'It held two kilos.', visibility: 'advisor' }]);
    await act(aT, 'addStation', [AARON, { title: 'Painted the class mural', lineIds: [aLines[1]], date: day(-9), type: 'project', visibility: 'advisor' }]);
    const g1 = await act(aT, 'addGoal', [AARON, { title: 'Run 5k', date: day(30), lineId: aLines[0], summary: '', checkIn: true }]);
    await act(cT, 'setTask', [CLASS, COULTAS, { title: 'Cell diagram', due: day(1), brief: 'Draw and label a plant cell.', checklist: ['Label the nucleus'], needs: 'photo' }]);
    await act(cT, 'askClass', [CLASS, COULTAS, { question: 'What surprised you in the lab this week?' }]);
    await act(cT, 'spotMoment', [[AARON], COULTAS, { title: 'Helped tidy the lab', note: 'Thank you for staying behind.', lineId: 'science', classId: CLASS }]);
    // Class photos (PhotoDrop.jsx): two photos from a practical, after the spotted moment.
    await act(cT, 'dropPhotos', [CLASS, COULTAS, { title: 'Electricity practical', lineId: 'science', note: 'Great wiring.', photos: [{ url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', studentIds: [AARON] }, { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', studentIds: [AARON] }] }]);
    await act(alT, 'openReflectionWindow', [{ title: 'Term 1 reflection', opens: day(0), closes: day(14), advisorId: ALTEMEN }, ALTEMEN]);
    await act(alT, 'addMomentComment', [m1.id, ALTEMEN, 'Brilliant engineering, Aaron.']);
    // School events (SchoolEvents.jsx): a card after Sports day (Year 8), and Week Without Walls coming up for Years 8 and 10.
    await act(adminTok, 'addSchoolEvent', [{ title: 'Sports day', start: day(-1), end: day(-1), for: { kind: 'years', years: [8] }, lineId: 'sport', question: 'What was your best moment?' }, null]);
    await act(adminTok, 'addSchoolEvent', [{ title: 'Week Without Walls', start: day(6), end: day(9), for: { kind: 'years', years: [8, 10] }, lineId: 'service' }, null]);
    await a.reload(); await a.waitForSelector('.simple .sh-actions');
    await a.waitForTimeout(800);
    ok(await a.evaluate(() => document.documentElement.lang) === 'th', '<html lang="th"> while Aaron reads Thai');
    const ms = a.locator('.ms-x'); if (await ms.count()) { await sweep(a, AARON, 'Aaron: a milestone celebration'); await ms.first().click(); }
    await sweep(a, AARON, 'Aaron: Simple home');
    if (await openSweep(a, AARON, '.se-card .primary', 'Aaron: add something from Sports day')) { await a.click('.sh-flow .sh-next .primary'); await sweep(a, AARON, 'Aaron: Sports day, its question'); await close(a); }
    ok(/\d{1,2} (ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.) 20\d\d/.test(await a.locator('.sh-feed').innerText()), 'dates: Thai month names, Gregorian years');
    await audit(a, 'Aaron, Simple home in Thai');
    await a.screenshot({ path: path.join(SH, 'aaron-home.png'), fullPage: true });
    // Add something I did, one question per screen; a Thai starter puts Thai in the box.
    await a.click('.sh-card.add'); await sweep(a, AARON, 'Aaron: add, what did you do');
    await a.fill('.sh-flow .sh-input', 'Made a volcano'); await a.click('.sh-flow .sh-next .primary');
    await sweep(a, AARON, 'Aaron: add, which colour');
    await a.locator('.sh-flow .sh-lines button').first().click();
    await sweep(a, AARON, 'Aaron: add, what did you learn');
    await a.locator('.sh-flow .sh-starters button').first().click();
    ok(THAI.test(await a.locator('.sh-flow textarea').inputValue()), `a Thai sentence starter writes Thai: “${await a.locator('.sh-flow textarea').inputValue()}”`);
    await a.click('.sh-flow .sk-open'); await a.locator('.sh-flow .sk-chip').first().click(); await sweep(a, AARON, 'Aaron: add, which skills');
    const help = a.locator('.sh-flow .sp-help'); if (await help.count()) { await help.click(); await sweep(a, AARON, 'Aaron: add, built-in questions'); }
    await close(a);
    // Something I want to do.
    await a.click('.sh-card.goal'); await sweep(a, AARON, 'Aaron: goal, what');
    await a.fill('.sh-flow .sh-input', 'Join the chess club'); await a.click('.sh-flow .sh-next .primary');
    await sweep(a, AARON, 'Aaron: goal, colour'); await a.locator('.sh-flow .sh-lines button').first().click();
    await sweep(a, AARON, 'Aaron: goal, when'); await a.locator('.sh-flow .sh-when > button').nth(1).click();
    if (await a.locator('.sh-flow .sh-who').count()) { await sweep(a, AARON, 'Aaron: goal, a teacher to help'); await a.click('.sh-flow .sh-notnow'); }
    await a.waitForTimeout(500); await sweep(a, AARON, 'Aaron: the toast after a goal');
    // Answer a question, a moment, a check-in, a task, a class question, the term reflection.
    if (await openSweep(a, AARON, '.sh-card.ask', 'Aaron: answer a question')) await close(a);
    await a.locator('.sh-feed li button', { hasText: 'Built a bridge' }).click(); await sweep(a, AARON, 'Aaron: a moment'); await close(a);
    if (await openSweep(a, AARON, '.gc-big', 'Aaron: goal check-in')) {
      await a.locator('.gc-flow .gc-ch').nth(1).click(); await sweep(a, AARON, 'Aaron: check-in, a sentence');
      await a.fill('.gc-flow textarea', 'I stop after one kilometre'); await a.click('.gc-flow .sh-next .primary');
      await sweep(a, AARON, 'Aaron: check-in, next step'); await a.click('.gc-flow .sh-next .primary'); await a.waitForTimeout(400);
    }
    await act(alT, 'sendEncouragement', [g1.id, ALTEMEN, 'I’m proud of you for keeping at it.', '']);
    // Family encouragement: a family member (joined by the family letter) leaves a note on his moment.
    const famL = await (await fetch(`${U}/api/advisor/family/letters`, { method: 'POST', headers: { ...H, cookie: `tp_session=${alT}` }, body: JSON.stringify({ studentIds: [AARON] }) })).json();
    const fj = await fetch(`${U}/api/family/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: famL.letters[0].url.split('/family/')[1], name: 'Maria Torres', email: 'maria.torres@family.example', password: 'family-pass-1' }) });
    const fT = fj.headers.get('set-cookie').match(/tp_session=([^;]+)/)[1];
    const fMe = (await (await fetch(`${U}/api/auth/me`, { headers: { cookie: `tp_session=${fT}` } })).json()).user;
    await act(fT, 'addFamilyNote', [m1.id, { key: `u:${fMe.id}`, name: fMe.name }, 'So proud of you!', 'proud']);
    if (await openSweep(a, AARON, '.tk-card', 'Aaron: hand in a task')) await close(a);
    if (await openSweep(a, AARON, '.cp-card', 'Aaron: a class question')) await close(a);
    if (await openSweep(a, AARON, '.tr-card .primary', 'Aaron: term reflection, look back')) {
      await a.locator('.tr-pick').first().click(); await a.click('.tr-flow .sh-next .primary');
      await sweep(a, AARON, 'Aaron: term reflection, a moment'); await close(a);
    }
    // Student-led conferences: get ready one question a screen, then Conference mode on his own phone.
    const cr = await act(alT, 'openConferenceRound', [{ title: 'Student-led conferences', slot: 15, days: [{ date: day(3), from: '15:00', to: '17:00' }], breaks: [], location: 'Room 8C', advisorId: ALTEMEN }, ALTEMEN]);
    await a.reload(); await a.waitForSelector('.slc-card'); await sweep(a, AARON, 'Aaron: get ready for my conference');
    if (await openSweep(a, AARON, '.slc-card .primary', 'Aaron: conference prep, what to show')) {
      const next = async (label) => { await a.click('.slc-flow .sh-next .primary'); await sweep(a, AARON, `Aaron: conference prep, ${label}`); };
      await a.locator('.slc-flow .tr-pick').first().click(); await next('a moment');
      await a.fill('.slc-flow textarea', 'I tested it twice.'); await next('proud');
      await a.fill('.slc-flow textarea', 'I kept going.'); await next('hard');
      await next('goal'); await next('review');
      await a.click('.slc-flow .sh-next .primary'); await a.waitForTimeout(300); await sweep(a, AARON, 'Aaron: conference prep, ready');
      await a.click('.slc-flow .sh-next .primary'); await a.waitForSelector('.slc-mode'); await sweep(a, AARON, 'Aaron: Conference mode, hello');
      await audit(a, 'Aaron, Conference mode in Thai', ['.slc-mode']);
      for (const label of ['a moment', 'looking back', 'next steps']) { await a.click('.slc-foot .primary'); await sweep(a, AARON, `Aaron: Conference mode, ${label}`); }
      await close(a);
      await act(alT, 'writeConfNote', [cr.id, AARON, 'family', 'Read together after dinner', ALTEMEN]);
      await a.reload(); await a.waitForSelector('.slc-note'); await sweep(a, AARON, 'Aaron: my conference note');
      if (await openSweep(a, AARON, '.slc-note .slc-card-btns .primary', 'Aaron: my conference note, what I will do next')) await a.click('.slc-note .sh-next .ghost');
    }
    await a.reload(); await a.waitForSelector('.simple .sh-actions');
    await a.locator('.sh-goal').first().waitFor({ timeout: 4000 }).catch(() => {});
    await sweep(a, AARON, 'Aaron: Simple home with a goal, an encouragement and a check-in');
    if (await a.locator('.fn-home .fn-acts .ghost').count()) {
      await a.locator('.fn-home .fn-acts .ghost').first().click(); await a.waitForSelector('.sh-moment .fn-on');
      await sweep(a, AARON, 'Aaron: a moment with a note from family');
      await a.click('.sh-moment .fn-on .sg-report'); await a.waitForSelector('.sg-dialog'); await sweep(a, AARON, 'Aaron: report a note from family'); await close(a); await close(a);
    } else ok(false, 'Aaron: the Simple home shows the note from family');
    await a.locator('.sh-spot .primary, .spot-me .spot-acts .primary').first().click().catch(() => {}); await sweep(a, AARON, 'Aaron: added a spotted moment');
    if (await a.locator('.pd-offer').count()) {
      await a.locator('.pd-offer .pd-pick').first().click(); await sweep(a, AARON, 'Aaron: class photos, one not kept');
      await a.locator('.pd-offer .pd-report').first().click(); await a.waitForSelector('.sg-dialog'); await sweep(a, AARON, 'Aaron: report a class photo'); await close(a);
      await a.locator('.pd-offer .pd-acts .primary').click(); await sweep(a, AARON, 'Aaron: kept a class photo');
    } else ok(false, 'Aaron: the class photos card is on his Simple home');
    const did = a.locator('.sh-goal .sh-goal-do .primary').first();
    if (await did.count()) {
      await did.click(); await a.waitForSelector('.sh-flow'); await sweep(a, AARON, 'Aaron: I did it, a photo');
      await a.click('.sh-flow .sh-next .primary'); await sweep(a, AARON, 'Aaron: I did it, how did it go');
      await a.locator('.sh-flow .sh-starters button').first().click();
      ok(THAI.test(await a.locator('.sh-flow textarea').inputValue()), 'a Simple starter writes Thai in “How did it go?”');
      await a.click('.sh-flow .sh-next .primary'); await a.waitForTimeout(400); await sweep(a, AARON, 'Aaron: after I did it');
    }
    await a.click('.bell'); await sweep(a, AARON, 'Aaron: notifications'); await a.click('.bell');
    await a.click('.view-btn'); await sweep(a, AARON, 'Aaron: display menu'); await a.click('.view-btn');
    await a.click('.fb-simple button'); await a.waitForTimeout(300); await sweep(a, AARON, 'Aaron: tell us something'); await close(a);
    await a.goto(`${U}/#/me/family`); await a.waitForSelector('.sh-fam'); await sweep(a, AARON, 'Aaron: show my family');
    await a.goto(`${U}/#/me/skills`); await a.waitForSelector('.sk-page'); await sweep(a, AARON, 'Aaron: my skills');
    if (await openSweep(a, AARON, '.sk-totag button', 'Aaron: my skills, picking for a moment')) { await a.click('.sk-totag .sk-chip >> nth=0'); await a.click('.sk-totag .primary'); await a.waitForSelector('.sk-collect'); await sweep(a, AARON, 'Aaron: my skills, one used'); await a.click('.sk-big >> nth=0'); await sweep(a, AARON, 'Aaron: my skills, when I used it'); }
    await a.goto(`${U}/#/me/add`); await a.waitForSelector('.sh-flow'); await sweep(a, AARON, 'Aaron: the phone app’s add'); await close(a);
    await a.screenshot({ path: path.join(SH, 'aaron-family.png') });

    // ═══ Year 10 at Standard, on a laptop ═══
    await act(yT, 'completeOnboarding', [Y10.id, ['science', 'art', 'service'], 'classic']);
    const r1 = await act(yT, 'addStation', [Y10.id, { title: 'Reflection', lineIds: ['science'], date: day(-30), type: 'project', summary: 'Our group poster about rivers.', visibility: 'school' }]);
    const r2 = await act(yT, 'addStation', [Y10.id, { title: 'Beach clean-up', lineIds: ['service'], date: day(-12), type: 'service', visibility: 'advisor' }]);
    await act(yT, 'addReflection', [{ studentId: Y10.id, eventId: r2.id, prompt: 'What did you learn?', text: 'Plastic travels a long way.', visibility: 'advisor' }]);
    await act(yT, 'requestEndorsement', [r2.id, Y10.advisorId, 'Could you check this?']);
    const yg = await act(yT, 'addGoal', [Y10.id, { title: 'Read three books', date: day(40), lineId: 'art', summary: '', checkIn: true }]);
    await act(yT, 'setPeerFeedback', [r1.id, true]);
    await act(mT, 'completeOnboarding', [mate.id, ['science'], 'classic']);
    await act(mT, 'givePeerFeedback', [r1.id, mate.id, [{ phrase: 'liked', text: 'the colours on the map' }]]);
    const mm = await act(mT, 'addStation', [mate.id, { title: 'Our river model', lineIds: ['science'], date: day(-5), type: 'project', visibility: 'school' }]);
    await act(mT, 'setPeerFeedback', [mm.id, true]);
    await act(y10Adv, 'addMomentComment', [r2.id, Y10.advisorId, 'Great work out there.']);
    await act(y10Adv, 'openReflectionWindow', [{ title: 'Term 1 reflection', opens: day(0), closes: day(14), advisorId: Y10.advisorId }, Y10.advisorId]);
    await act(y10Adv, 'openConferenceRound', [{ title: 'Student-led conferences', slot: 15, days: [{ date: day(3), from: '15:00', to: '17:00' }], breaks: [], location: 'Room 10', advisorId: Y10.advisorId }, Y10.advisorId]);
    await act(y10Adv, 'nudgeStudent', [Y10.id, Y10.advisorId, 'Add something from this week.', 'quiet']);
    const s = await ctx(Y10.id);
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.home');
    await toThai(s); await s.waitForTimeout(500);
    await sweep(s, Y10.id, 'Year 10: map');
    if (await openSweep(s, Y10.id, '.se-coming .ghost', 'Year 10: a goal for a school event coming up')) await close(s);
    await audit(s, 'Year 10, map in Thai');
    if (await openSweep(s, Y10.id, '.slc-card .primary', 'Year 10: get ready for my conference')) {
      await s.locator('.slc-flow .tr-pick').first().click(); await sweep(s, Y10.id, 'Year 10: conference prep, a moment picked');
      await s.locator('.slc-flow input[name=slc-g]').nth(-1).check().catch(() => {}); await close(s);
    }
    await s.screenshot({ path: path.join(SH, 'y10-map.png') });
    await s.goto(`${U}/#/me/map/${r1.id}`); await s.waitForSelector('.station-panel.open');
    ok((await s.locator('.station-panel.open h2, .station-panel.open h1').first().innerText()).trim() === 'Reflection', 'a moment called “Reflection” keeps its title, in English');
    await sweep(s, Y10.id, 'Year 10: station panel with kind feedback');
    await audit(s, 'Year 10, station panel', ['.station-panel.open']);
    await s.goto(`${U}/#/me/map/${r2.id}`); await s.waitForSelector('.station-panel.open'); await sweep(s, Y10.id, 'Year 10: station panel with a comment');
    for (const [b, label] of [['เพิ่มบทสะท้อนคิด', 'add a reflection'], ['ขอการรับรอง', 'ask for an endorsement'], ['แก้ไข', 'edit']]) {
      await s.goto(`${U}/#/me/map/${r1.id}`); await s.reload(); await s.waitForSelector('.station-panel.open');
      const btn = s.locator('.station-panel.open button', { hasText: b }).first();
      if (await btn.count()) { await btn.click(); await sweep(s, Y10.id, `Year 10: station panel, ${label}`); } else ok(false, `Year 10: the station panel has “${b}”`);
    }
    const vb = s.locator('.station-panel.open .as-btn').first(); if (await vb.count()) { await vb.click(); await sweep(s, Y10.id, 'Year 10: verification record'); await close(s); }
    await s.goto(`${U}/#/me/map/${yg.id}`); await s.waitForSelector('.station-panel.open'); await sweep(s, Y10.id, 'Year 10: a goal');
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.home');
    await s.click('.home-actions > .primary'); await s.waitForSelector('.modal'); await sweep(s, Y10.id, 'Year 10: add a station'); await close(s);
    const menuItems = async () => { await s.click('.home-actions .menu-wrap > button'); await s.waitForSelector('.home-actions .menu'); return s.locator('.home-actions .menu [role=menuitem]').count(); };
    const nItems = await menuItems(); await sweep(s, Y10.id, 'Year 10: Plan & review menu');
    for (let i = 0; i < nItems; i++) {
      await s.goto(`${U}/#/me/map`); await s.reload(); await s.waitForSelector('.home'); await menuItems();
      const what = (await s.locator('.home-actions .menu [role=menuitem] b').nth(i).innerText()).split('\n')[0];
      await s.locator('.home-actions .menu [role=menuitem]').nth(i).click();
      if (/poster|โปสเตอร์/i.test(what)) await s.waitForTimeout(800);
      await sweep(s, Y10.id, `Year 10: ${what}`); await close(s);
    }
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.home');
    const fl = s.locator('.map-bar button[aria-expanded]'); if (await fl.count()) { await fl.first().click(); await sweep(s, Y10.id, 'Year 10: filters'); }
    if (await openSweep(s, Y10.id, '.tr-card .primary', 'Year 10: term reflection')) await close(s);
    for (const k of ['skills', 'studio', 'inbox', 'links', 'privacy']) {
      await s.goto(`${U}/#/me/${k}`); await s.waitForTimeout(900); await sweep(s, Y10.id, `Year 10: ${k}`);
      if (k === 'studio') for (const i of [1, 2, 3, 4]) { const au = s.locator('.studio [role=radiogroup] button, .studio .seg button').nth(i); if (await au.count()) { await au.click(); await sweep(s, Y10.id, `Year 10: studio, choice ${i}`); } }
      if (k === 'inbox') { await s.click('.integrations button.ghost:has-text("จำลองสัปดาห์หน้า"), button:has-text("จำลองสัปดาห์หน้า")').catch(() => {}); await s.waitForTimeout(1500); await sweep(s, Y10.id, 'Year 10: inbox after a week'); }
      if (k === 'links') {
        const sel = s.locator('select:visible').first(); if (await sel.count()) { const v = await sel.locator('option').nth(1).getAttribute('value'); await sel.selectOption(v); }
        await s.locator('button:has-text("สร้างลิงก์")').last().click().catch(() => {}); await s.waitForTimeout(600); await sweep(s, Y10.id, 'Year 10: a new share link');
        await close(s);
      }
    }
    await audit(s, 'Year 10, privacy in Thai');
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.home');
    if (await openSweep(s, Y10.id, '.pf-classes .pf-moment button', 'Year 10: give kind feedback')) {
      await s.locator('.pf-dialog [aria-pressed]').first().click(); await sweep(s, Y10.id, 'Year 10: kind feedback, a phrase picked'); await close(s);
    }
    await s.keyboard.press('Control+k'); await s.waitForTimeout(300); await sweep(s, Y10.id, 'Year 10: jump to anything'); await s.keyboard.press('Escape');
    await s.click('.persona-btn'); await sweep(s, Y10.id, 'Year 10: account menu');
    await s.locator('.menu [role=menuitem], .menu button').filter({ hasText: 'ข้อเสนอแนะ' }).first().click().catch(() => {}); await s.waitForTimeout(300); await sweep(s, Y10.id, 'Year 10: feedback dialog'); await close(s);
    await s.click('.bell'); await sweep(s, Y10.id, 'Year 10: notifications'); await s.click('.bell');
    await s.click('.view-btn'); await sweep(s, Y10.id, 'Year 10: display menu'); await s.click('.view-btn');

    // ═══ Year 12 at Full, with a leaver portfolio ═══
    await act(zT, 'completeOnboarding', [Y12.id, ['science', 'service', 'art'], 'classic']);
    for (const [title, line, n] of [['Led the beach clean-up', 'service', 40], ['Extended essay field work', 'science', 20], ['Exhibition piece', 'art', 8]]) await act(zT, 'addStation', [Y12.id, { title, lineIds: [line], date: day(-n), type: 'project', visibility: 'publishable', summary: 'A day I am proud of.' }]);
    const f = await ctx(Y12.id);
    await f.goto(`${U}/#/me/map`); await f.waitForSelector('.home');
    await toThai(f); await f.waitForTimeout(500);
    await sweep(f, Y12.id, 'Year 12: map');
    const seg = f.locator('.map-bar .seg.small[role=group] button'); if (await seg.count()) { await seg.last().click(); await sweep(f, Y12.id, 'Year 12: list view'); await seg.first().click(); }
    const q = f.locator('.map-q'); if (await q.count()) { await q.fill('beach'); await sweep(f, Y12.id, 'Year 12: map search'); await q.fill('zzzz'); await sweep(f, Y12.id, 'Year 12: map search, nothing found'); await q.fill(''); }
    for (const k of ['studio', 'shared', 'inbox', 'links', 'activity', 'privacy', 'poster', 'cas']) {
      await f.goto(`${U}/#/me/${k}`); await f.waitForTimeout(900); await sweep(f, Y12.id, `Year 12: ${k}`);
      if (k === 'studio') {
        const code = f.locator('.tier-toggle button').nth(2); if (await code.count()) { await code.click(); await f.waitForTimeout(500); await sweep(f, Y12.id, 'Year 12: studio, code tier'); }
        const cmp = f.locator('.compare-btn'); if (await cmp.count()) { await cmp.click(); await sweep(f, Y12.id, 'Year 12: compare two audiences'); await cmp.click(); }
      }
    }
    // CAS: an experience with hours waiting, the hours form, the supervisor choices and a new experience
    const today = new Date().toISOString().slice(0, 10);
    await act(zT, 'logCasExperience', [Y12.id, { title: 'Coaching junior football', strand: 'A', from: today, outcomes: [1, 5], reflection: 'Patience matters more than drills.', hours: { date: today, hours: 2, note: '', supervisor: { kind: 'none' } } }]);
    await f.goto(`${U}/#/me/cas`); await f.waitForSelector('.cas-exp'); await sweep(f, Y12.id, 'Year 12: CAS with an experience');
    await f.locator('.cas-row-btns button').first().click(); await f.waitForSelector('.cas-inline'); await sweep(f, Y12.id, 'Year 12: CAS, log more hours');
    await f.locator('.cas-sup input[type=radio]').nth(1).check(); await sweep(f, Y12.id, 'Year 12: CAS, someone outside school');
    await f.locator('.cas-inline .ghost').first().click();
    await f.locator('.cas-log > .primary').click(); await f.waitForSelector('.cas-form-card'); await sweep(f, Y12.id, 'Year 12: CAS, a new experience');
    await audit(f, 'Year 12, CAS in Thai');
    await f.goto(`${U}/#/me/leaver`); await f.waitForSelector('.lv-start'); await sweep(f, Y12.id, 'Year 12: leaver portfolio, start');
    await f.click('.lv-start .primary'); await f.waitForSelector('.lv-steps'); await sweep(f, Y12.id, 'Year 12: leaver portfolio builder');
    for (let i = 1; i < 5; i++) { await f.locator('.lv-steps button').nth(i).click(); await sweep(f, Y12.id, `Year 12: leaver portfolio, step ${i + 1}`); if (i === 1) { const add = f.locator('.lv-step button:has-text("เพิ่ม")').first(); if (await add.count()) { await add.click(); await sweep(f, Y12.id, 'Year 12: leaver portfolio, a moment picked'); } } }
    await audit(f, 'Year 12, leaver portfolio builder in Thai');
    await f.screenshot({ path: path.join(SH, 'y12-leaver.png'), fullPage: true });

    // ── Back to English: nothing Thai is left behind ──
    await s.goto(`${U}/#/me/map`); await s.waitForSelector('.home');
    await s.click('.view-btn'); await s.click('.view-menu button[lang="en"]'); await s.waitForFunction(() => document.documentElement.lang === 'en');
    const en = (await s.locator('#main').innerText());
    ok(!THAI.test(en), 'back in English: the map has no Thai left');
    for (const [n, p] of [['Aaron', a], ['Year 10', s], ['Year 12', f]]) ok(!p.errs.length, `${n}: no page errors${p.errs.length ? `: ${p.errs.join(' | ')}` : ''}`);
  } finally {
    fs.writeFileSync(path.join(SH, 'leftovers.json'), JSON.stringify(leftovers, null, 1));
    console.log('INFO leftovers and screenshots in', SH);
    await b.close(); srv.p.kill();
  }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
