// Voice for younger students on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first),
// imports the real roster. Chromium with a fake microphone (--use-fake-device-for-media-stream). Aaron Torres (Year 8,
// Simple) on a phone: speaks to type with the keyboard (a stand-in SpeechRecognition, so no speech service is needed:
// en-GB, live words he can edit, the one-time note), hears questions read aloud (speechSynthesis watched) and turns on
// "Read questions aloud"; adds a moment with a voice note and asks Mr David Coultas to check it; adds a second voice note
// to the moment offline (kept on the phone, sent when back). Mr Coultas, in his own context, plays both in his queue
// (the audio loads, 200 from /api/files); a signed-out context gets 404; with SpeechRecognition taken away the mic is
// not shown and nothing breaks. TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Screenshots: tp-voice-*.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = (process.env.SCRATCH || os.tmpdir()) + '/tp-voice-';
const AARON = 'Sabc0d6125e85', COULTAS = 'T60198';
const TITLE = 'Built a bridge out of straws';
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

// A stand-in for the browser's speech recognition: says "i joined the" (interim), then "i joined the chess club" (final).
const FAKE_RECOGNITION = () => {
  window.__recog = [];
  class FakeRec {
    constructor() { window.__recog.push(this); this.lang = ''; }
    start() {
      const r = (t, isFinal) => Object.assign([{ transcript: t }], { isFinal });
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [r('i joined the', false)] }), 150);
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [r('i joined the chess club', true)] }), 700);
    }
    stop() { setTimeout(() => this.onend?.(), 10); }
    abort() { this.onend?.(); }
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  window.__said = [];
  if (window.speechSynthesis) { speechSynthesis.speak = (u) => { window.__said.push(`${u.lang}|${u.text}`); setTimeout(() => u.onend?.(), 50); }; speechSynthesis.cancel = () => {}; }
};
const NO_RECOGNITION = () => {
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) { try { delete window[k]; } catch { /* keep going */ } Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); }
};

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-voice-data-'));
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errs = [];
  try {
    const H = (tok) => ({ cookie: `tp_session=${tok}`, 'content-type': 'application/json' });
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H(adminTok), body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const aaron = roster.students.find((s) => s.id === AARON), coultas = roster.teachers.find((t) => t.id === COULTAS);
    const sTok = await setupWith(U, links[aaron.email]), tTok = await setupWith(U, links[coultas.email]);
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: H(tok), body: JSON.stringify({ fn, args, rec: [] }) });
    ok((await act(sTok, 'completeOnboarding', [AARON, ['science', 'sport'], null])).ok, `${aaron.name} (Year ${aaron.year}) has picked his lines`);
    const rec = saved();
    const sci = rec.classes.find((c) => c.teacherIds?.includes(COULTAS) && rec.enrolments.some((n) => n.classId === c.id && n.studentId === AARON));
    const line = rec.lines.find((l) => l.id === sci?.lineId);
    ok(!!line, `${coultas.name} teaches him ${sci?.name}, on the ${line?.name} line`);

    const phone = async (init) => {
      const c = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true, permissions: ['microphone'] });
      await c.addCookies([{ name: 'tp_session', value: sTok, url: U }]);
      if (init) await c.addInitScript(init);
      const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`${U}/#/me/map`); await p.waitForSelector('.simple .sh-actions');
      return [c, p];
    };

    // ── Aaron, on his phone: speak to type ──
    const [cA, a] = await phone(FAKE_RECOGNITION);
    await a.click('.sh-card.add'); await a.waitForSelector('.sh-flow h2');
    const mic = a.locator('.sh-flow .vc-mic');
    ok(await mic.count() === 1 && await mic.getAttribute('aria-label') === 'Say it instead of typing', 'a labelled mic under "What did you do?"');
    ok((await a.innerText('.sh-flow .vc-note')).includes('does not record or keep your voice'), 'the first time: a short note on where the speech goes');
    await mic.focus(); await a.keyboard.press('Enter');
    ok(await until(() => a.evaluate(() => document.querySelector('.sh-flow input.sh-input').value === 'I joined the')), 'live words appear while he speaks (interim)');
    ok(await until(() => a.evaluate(() => document.querySelector('.sh-flow input.sh-input').value === 'I joined the chess club')), 'then the final words');
    ok(await a.evaluate(() => window.__recog[0].lang) === 'en-GB', 'recognition in en-GB');
    ok(await mic.getAttribute('aria-pressed') === 'true', 'the mic shows it is listening (aria-pressed)');
    await a.keyboard.press('Enter');
    ok(await until(async () => await mic.getAttribute('aria-pressed') === 'false'), 'Enter again stops it');
    await a.fill('.sh-flow input.sh-input', TITLE);
    ok(await a.inputValue('.sh-flow input.sh-input') === TITLE, 'the words stay editable');
    await a.screenshot({ path: SH + 'mic.png' });

    // Read aloud: the speaker beside the question, by keyboard.
    const sp = a.locator('.sh-flow h2 .vc-speak');
    ok(await sp.count() === 1 && await sp.getAttribute('aria-label') === 'Read this out loud', 'a labelled speaker on the question');
    await sp.focus(); await a.keyboard.press('Space');
    ok(await until(() => a.evaluate(() => window.__said.includes('en-GB|What did you do?'))), 'it reads "What did you do?" out loud (en-GB)');

    // ── A moment with a voice note ──
    await a.click('.sh-flow .sh-next .primary');
    await a.locator('.sh-lines button', { hasText: line.name }).click();
    await a.waitForSelector('.sh-voice-btn');
    await a.click('.sh-voice-btn');
    await a.click('.vc-big');
    await a.waitForSelector('.vc-big.stop');
    await wait(2500);
    ok(/^0:0[1-3]/.test(await a.innerText('.vc-time')) && (await a.innerText('.vc-time')).includes('of 1:00'), `recording, with the time out of a minute (${(await a.innerText('.vc-time')).replace(/\n/g, ' ')})`);
    await a.click('.vc-big.stop');
    await a.waitForSelector('.vc-use');
    ok(await a.locator('.vc-row button', { hasText: 'Play again' }).count() === 1 && await a.locator('.vc-row button', { hasText: 'Record again' }).count() === 1, 'Stop, then Play again, Record again, Use this');
    await a.click('.vc-row button:has-text("Play again")');
    await a.screenshot({ path: SH + 'recorded.png' });
    await a.click('.vc-use');
    await a.waitForSelector('.sh-voice .vc-notes audio');
    const first = await a.getAttribute('.sh-voice .vc-notes audio', 'src');
    ok(/^api\/files\/[a-f0-9]{32}\.weba$/.test(first), `uploaded through /api/upload (${first})`);
    await a.click('.sh-flow .sh-next .primary');
    const surname = coultas.name.split(' ').at(-1);
    if (await a.locator(`.sh-ask:has-text("${surname}")`).count() === 0) await a.click('.sh-ask.other:has-text("Someone else")');
    await a.click(`.sh-ask:has-text("${surname}")`);
    await a.waitForSelector('.toast.show');
    const ev = await until(() => saved().events.find((e) => e.studentId === AARON && e.title === TITLE));
    const voice = ev?.evidence?.find((x) => x.url === first);
    ok(voice?.type === 'audio/webm' && voice.caption === 'Voice note', `on the moment as a voice note (${voice?.type})`);
    ok(saved().requests.some((r) => r.eventId === ev?.id && r.teacherId === COULTAS && r.status === 'pending'), `${coultas.name} is asked to check it`);

    // The moment shows it as a player; a second voice note, added offline.
    await a.click(`.sh-feed button:has-text("${TITLE}")`); await a.waitForSelector('.sh-moment');
    ok(await until(() => a.evaluate(() => { const x = document.querySelector('.sh-moment .vc-notes audio'); return x && x.readyState >= 1 && !x.error; })), 'the moment shows his voice note, and it loads');
    await cA.setOffline(true);
    await a.click('.sh-moment .sh-voice-btn'); await a.click('.vc-big'); await a.waitForSelector('.vc-big.stop'); await wait(1500);
    await a.click('.vc-big.stop'); await a.click('.vc-use');
    ok(await until(() => a.evaluate(() => document.querySelectorAll('.sh-moment .vc-notes audio').length === 2)), 'offline: the second voice note is on the moment at once');
    const local = await a.evaluate((t) => globalThis.__tpRecord?.().events.find((e) => e.title === t)?.evidence.filter((x) => /^audio\//.test(x.type)).map((x) => x.url), TITLE);
    ok(/^blob:.+#tpq-/.test(local?.[1] || ''), 'kept on the phone (a placeholder until it is sent)');
    await a.screenshot({ path: SH + 'offline.png' });
    await cA.setOffline(false);
    const both = await until(() => { const e = saved().events.find((x) => x.id === ev.id); const v = e?.evidence.filter((x) => /^audio\//.test(x.type)) || []; return v.length === 2 && v.every((x) => /^api\/files\/[a-f0-9]{32}\.weba$/.test(x.url)) ? v.map((x) => x.url) : null; }, 15000);
    ok(!!both, `back online: sent, both on the server's copy (${both?.[1]})`);

    // "Read questions aloud" in the display menu: questions are read by themselves.
    await a.keyboard.press('Escape');
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.simple .sh-actions');
    await a.click('.view-btn');
    const ra = a.locator('.view-menu [role=radiogroup][aria-label="Read questions aloud"]');
    ok(await ra.count() === 1, 'the display menu has "Read questions aloud"');
    await ra.locator('button', { hasText: 'On' }).click();
    await a.evaluate(() => { window.__said.length = 0; });
    await a.click('.view-btn');
    await a.click('.sh-card.goal'); await a.waitForSelector('.sh-flow h2');
    ok(await until(() => a.evaluate(() => window.__said.includes('en-GB|What do you want to do?'))), 'with it on, the goal question is read as it opens');
    ok(await a.evaluate(() => localStorage.getItem('tp-read-aloud')) === '1', 'kept on this device');

    // ── Mr Coultas, in his own context: both play in his queue ──
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); t.on('pageerror', (e) => errs.push(e.message));
    const got = [];
    t.on('response', (r) => { if (r.url().includes('/api/files/')) got.push([r.url().split('/api/files/')[1], r.status()]); });
    await t.goto(`${U}/#/me/queue`);
    const card = t.locator('article', { hasText: TITLE });
    await card.waitFor({ timeout: 10000 });
    ok(await until(() => t.evaluate((t) => { const a = [...document.querySelectorAll('article')].find((x) => x.innerText.includes(t)); const au = a ? [...a.querySelectorAll('audio')] : []; return au.length === 2 && au.every((x) => x.readyState >= 1 && !x.error); }, TITLE), 10000), `${coultas.name} sees the two voice notes as players on the request, and they load`);
    const names = both.map((u) => u.split('/').pop());
    ok(names.every((n) => got.some(([u, s]) => u === n && (s === 200 || s === 206))), `200 from /api/files for each (${got.map(([u, s]) => `${u.slice(0, 8)}…:${s}`).join(', ')})`);
    const status = (page, u) => page.evaluate(async (u) => (await fetch(u, { cache: 'no-store' })).status, `${U}/${u}`);
    ok(await status(t, both[0]) === 200, 'a plain GET answers 200 for him');
    await card.locator('audio').first().evaluate((x) => x.play().catch(() => {}));
    await wait(600);
    ok(await card.locator('audio').first().evaluate((x) => x.currentTime > 0 || !x.paused), 'it plays');
    await t.screenshot({ path: SH + 'teacher.png' });

    // ── Signed out ──
    const cO = await b.newContext(); const o = await cO.newPage();
    await o.goto(`${U}/offline.html`);
    ok(await status(o, both[0]) === 404 && await status(o, both[1]) === 404, 'a signed-out browser gets 404 for the voice notes');

    // ── No speech recognition in this browser: no mic, no errors ──
    const [cN, n] = await phone(NO_RECOGNITION);
    ok(await n.evaluate(() => !window.SpeechRecognition && !window.webkitSpeechRecognition), 'SpeechRecognition stubbed out');
    await n.click('.sh-card.add'); await n.waitForSelector('.sh-flow h2');
    ok(await n.locator('.vc-mic').count() === 0 && await n.locator('.vc-note').count() === 0, 'the mic is not shown, nor its note');
    await n.fill('.sh-flow input.sh-input', 'Typed it instead'); await n.click('.sh-flow .sh-next .primary');
    await n.locator('.sh-lines button', { hasText: line.name }).click();
    ok(await n.locator('.vc-mic').count() === 0 && await n.locator('.sh-voice-btn').count() === 1, 'typing still works, and voice notes are still offered');
    await cN.close();
    ok(!errs.length, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    console.log('Screenshots in', SH + '*.png');
  } catch (e) { ok(false, e.stack); } finally { await b.close(); srv.p.kill(); }
})();
