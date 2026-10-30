// Class photo drop on the real class lists: starts a clean pilot (TP_START=empty; needs `npm run build` first), imports the
// real roster. Mr David Coultas (T60198) opens C-392000 in My classes, drops 4 photos, gives photo 1 to Aaron Torres
// (Sabc0d6125e85), photo 2 to Aaron and a classmate ("Same students as previous", then a chip by keyboard), photo 3 to a
// second classmate and leaves photo 4 to nobody (deleted when he sends). Aaron, on a phone at Simple level, keeps one photo
// with a sentence: a moment on Science, endorsed by Mr Coultas. The first classmate says "Not for me"; the second reports
// her photo. The second classmate, a teacher with no reach and a signed-out browser cannot fetch Aaron's photo. The teacher
// sees Added / Not for me / Waiting; a coordinator removes the reported photo from Reports. Every account has its own
// browser context.
//   TP_ROSTER=/path/to/transit-roster.json (default: the project mount). Not committed: the names are real-ish.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..');
const ROSTER = process.env.TP_ROSTER || '/mnt/project-files/transit-portfolio/roster/transit-roster.json';
const SH = os.tmpdir() + '/tp-photo-drop-';
const AXE = require.resolve('axe-core/axe.min.js', { paths: [ROOT] });
const TID = 'T60198', AARON = 'Sabc0d6125e85', CLASS = 'C-392000';
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
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await new Promise((r) => setTimeout(r, 200)); } };
async function audit(p, label) {
  if (!await p.evaluate(() => !!window.axe)) await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 3) }))));
  const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
  ok(!bad.length, `axe: ${label}${bad.length ? ` ${JSON.stringify(bad)}` : ''}`);
}
// Fetch a file from inside a page (its cookies): the status.
const status = (page, u) => page.evaluate((x) => fetch(x, { cache: 'no-store' }).then((r) => r.status), u);

let srv;
(async () => {
  if (!fs.existsSync(ROSTER)) { console.log('SKIP no roster file at', ROSTER); return; }
  const port = await freePort(); const U = `http://localhost:${port}`;
  const dataDir = fs.mkdtempSync(SH + 'data-');
  srv = await start(port, dataDir);
  const saved = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8')).store;
  const onDisk = (u) => fs.existsSync(path.join(dataDir, 'uploads', u.split('/').pop()));
  const b = await chromium.launch();
  try {
    const adminTok = await setupWith(U, srv.setup, { name: 'Pat Admin', email: 'pat@example.org' });
    const H = { cookie: `tp_session=${adminTok}`, 'content-type': 'application/json' };
    const state = async (h = H) => (await (await fetch(`${U}/api/state`, { headers: h })).json()).snapshot.store;
    const act = (tok, fn, args) => fetch(`${U}/api/action`, { method: 'POST', headers: { ...H, cookie: `tp_session=${tok}` }, body: JSON.stringify({ fn, args, rec: [] }) });
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const ij = await (await fetch(`${U}/api/admin/roster`, { method: 'POST', headers: H, body: JSON.stringify({ roster }) })).json();
    ok(ij.newAccounts.created.length > 900, `real roster imported (${ij.newAccounts.created.length} accounts)`);
    const links = Object.fromEntries(ij.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const rec = await state();
    const teacher = roster.teachers.find((t) => t.id === TID);
    const email = new Map(roster.students.map((x) => [x.id, x.email]));
    const kids = rec.enrolments.filter((n) => n.classId === CLASS && !n.to).map((n) => n.studentId);
    const aaron = rec.students.find((s) => s.id === AARON);
    ok(teacher && aaron && kids.includes(AARON), `${teacher?.name} teaches ${CLASS} (${kids.length} students), ${aaron?.name} is in it`);
    const [m1, m2] = rec.students.filter((s) => kids.includes(s.id) && s.id !== AARON && links[email.get(s.id)]).sort((a, c) => a.name.localeCompare(c.name));
    const aaronClasses = new Set(rec.enrolments.filter((n) => n.studentId === AARON).map((n) => n.classId));
    const near = new Set(rec.classes.filter((c) => aaronClasses.has(c.id)).flatMap((c) => c.teacherIds));
    const outsiderT = roster.teachers.find((x) => x.id !== TID && links[x.email] && !near.has(x.id) && aaron.advisorId !== x.id && !['leadership', 'coordinator', 'counsellor'].some((r) => (x.roles || []).includes(r)));

    // ── Mr Coultas, on a laptop: drops 4 photos on his class ──
    const tTok = await setupWith(U, links[teacher.email]);
    const cT = await b.newContext({ viewport: { width: 1300, height: 900 } });
    await cT.addCookies([{ name: 'tp_session', value: tTok, url: U }]);
    const t = await cT.newPage(); const tErrs = []; t.on('pageerror', (e) => tErrs.push(e.message));
    await t.goto(`${U}/#/me/classes/${CLASS}`); await t.waitForSelector('.mc-table');
    const pngs = [];
    for (let i = 0; i < 4; i++) pngs.push({ name: `practical-${i + 1}.png`, mimeType: 'image/png', buffer: await t.screenshot({ clip: { x: 20 * i, y: 0, width: 160 + 20 * i, height: 120 } }) });
    await t.click('.pd-open'); await t.waitForSelector('.pd-dialog');
    const safe = await t.locator('.pd-safe').innerText();
    ok(/other students’ faces/.test(safe) && /everyone you give it to sees them/.test(safe), 'a clear reminder: other students’ faces are seen by everyone a photo is given to');
    ok(await t.locator('.pd-dialog select').inputValue() === 'science', 'the line defaults to the class’s line (science)');
    await t.fill('.pd-form input[placeholder^="e.g. Electricity"]', 'Electricity practical');
    await t.fill('.pd-note input', 'Great teamwork wiring the circuits.');
    await t.setInputFiles('.pd-drop input[type=file]', pngs);
    await until(async () => (await t.locator('.pd-photo .pd-prog').count()) === 0 && (await t.locator('.pd-photo').count()) === 4);
    ok(await t.locator('.pd-photo').count() === 4 && await t.locator('.pd-prog.err').count() === 0, '4 photos uploaded');
    const card = (i) => t.locator('.pd-photo').nth(i);
    const chip = (i, s) => card(i).locator(`.pd-chip[title="${s.name}"]`);
    await chip(0, aaron).click();
    ok(await chip(0, aaron).getAttribute('aria-pressed') === 'true', 'photo 1: Aaron');
    await card(1).locator('button:has-text("Same students as previous")').click();
    // A chip by keyboard: focus it, press Space.
    await chip(1, m1).focus(); await t.keyboard.press('Space');
    ok(await chip(1, aaron).getAttribute('aria-pressed') === 'true' && await chip(1, m1).getAttribute('aria-pressed') === 'true', `photo 2: Aaron (same as previous) and ${m1.name} (keyboard)`);
    await chip(2, m2).click();
    ok((await t.locator('.pd-foot span').innerText()).includes('1 photo given to nobody is deleted when you send'), 'the footer says the photo given to nobody is deleted');
    await t.screenshot({ path: SH + 'teacher-dialog.png', fullPage: true });
    await audit(t, 'the photo drop dialog');
    const urls = await t.locator('.pd-photo .pd-thumb img').evaluateAll((l) => l.map((x) => x.src));
    const draftFiles = fs.readdirSync(path.join(dataDir, 'uploads')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, 'uploads', f), 'utf8'))).filter((m) => m.purpose === 'photo-drop');
    ok(draftFiles.length === 4, 'uploaded as photo-drop photos of one draft');
    await t.click('.pd-foot .primary');
    await t.waitForSelector('.pd-dialog', { state: 'detached' });
    const drop = await until(async () => saved().photoDrops?.[0]);
    ok(drop && drop.title === 'Electricity practical' && drop.photos.length === 3 && drop.lineId === 'science', 'saved: a batch of 3 given photos on Science');
    const [p1, p2, p3] = drop.photos;
    const offers = saved().spotted.filter((x) => x.dropId === drop.id);
    ok(offers.length === 3 && offers.find((x) => x.studentId === AARON)?.photos.length === 2, 'one offer each: Aaron 2 photos, the classmates 1 each');
    const gone = await until(async () => { const left = fs.readdirSync(path.join(dataDir, 'uploads')).filter((f) => !f.endsWith('.json')); return left.length === 3 ? left : null; });
    ok(!!gone && [p1, p2, p3].every((p) => onDisk(p.url)), 'the photo given to nobody was deleted when he sent the batch');
    ok(saved().notifications.some((n) => n.to === `st:${AARON}` && n.text === `Mr Coultas added photos from “Electricity practical”` && n.kind === 'spotted'), 'Aaron is notified ("Mr Coultas added photos from …", kind spotted)');
    ok(urls.length === 4, 'four thumbnails were shown');

    // ── Refused on the server ──
    const oTok = await setupWith(U, links[outsiderT.email]);
    ok((await act(oTok, 'dropPhotos', [CLASS, outsiderT.id, { lineId: 'science', photos: [{ url: p1.url, studentIds: [AARON] }] }])).status === 403, `a teacher who does not teach ${CLASS} cannot drop photos on it`);
    const m1Tok = await setupWith(U, links[email.get(m1.id)]);
    const aOffer = offers.find((x) => x.studentId === AARON);
    ok((await act(m1Tok, 'acceptSpotted', [aOffer.id, AARON, { photos: [p1.id] }])).status === 403, 'a classmate cannot keep Aaron’s photos');
    ok((await act(tTok, 'acceptSpotted', [aOffer.id, AARON, { photos: [p1.id] }])).status === 403, 'the teacher cannot keep them for him');

    // ── Who can fetch Aaron's photo 1 (separate contexts) ──
    const m2Tok = await setupWith(U, links[email.get(m2.id)]);
    const ctxFor = async (tok, opts = {}) => { const c = await b.newContext({ viewport: { width: 1200, height: 820 }, ...opts }); if (tok) await c.addCookies([{ name: 'tp_session', value: tok, url: U }]); const p = await c.newPage(); await p.goto(`${U}/#/me`); return { c, p }; };
    const M2 = await ctxFor(m2Tok), O = await ctxFor(oTok), N = await ctxFor(null), M1 = await ctxFor(m1Tok);
    ok(await status(M2.p, `${U}/${p1.url}`) === 404, `${m2.name} (a classmate, another context) cannot fetch Aaron’s photo: 404`);
    ok(await status(M2.p, `${U}/${p3.url}`) === 200, `${m2.name} can fetch her own photo`);
    ok(await status(M1.p, `${U}/${p1.url}`) === 404 && await status(M1.p, `${U}/${p2.url}`) === 200, `${m1.name} fetches the shared photo, not Aaron’s own`);
    ok(await status(O.p, `${U}/${p1.url}`) === 404, 'a teacher with no reach: 404');
    ok(await status(N.p, `${U}/${p1.url}`) === 404, 'signed out: 404');
    ok(await status(t, `${U}/${p1.url}`) === 200, 'Mr Coultas: 200');

    // ── Aaron, on a phone, at Simple level: keeps one photo with a sentence ──
    const aTok = await setupWith(U, links[email.get(AARON)]);
    const mine = await state({ cookie: `tp_session=${aTok}` });
    ok(mine.photoDrops.length === 0 && mine.spotted.length === 1 && mine.spotted[0].photos.length === 2, 'Aaron receives his offer with his 2 photos, not the batch');
    const cA = await b.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    await cA.addCookies([{ name: 'tp_session', value: aTok, url: U }]);
    const a = await cA.newPage(); const aErrs = []; a.on('pageerror', (e) => aErrs.push(e.message));
    await a.goto(`${U}/#/me/map`); await a.waitForSelector('.onboard');
    await a.locator('.ob-pick:not(.on)').first().click(); await a.locator('.ob-pick:not(.on)').first().click();
    await a.click('.ob-foot .primary'); await a.click('.ob-foot .primary');
    await a.click('text=Go to my map'); await a.waitForSelector('.simple .sh-actions');
    await a.waitForSelector('.simple .pd-offer.big');
    const text = await a.locator('.pd-offer').innerText();
    ok(text.includes('Mr Coultas added photos from Electricity practical') && text.includes('Great teamwork'), 'Simple: a big card, "Mr Coultas added photos from Electricity practical", with his note');
    ok(await a.locator('.pd-offer .pd-pick').count() === 2 && await a.locator('.pd-offer .pd-pick[aria-pressed="true"]').count() === 2, 'both photos, picked to keep');
    ok(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at phone width');
    await audit(a, 'Aaron’s class photos card at Simple');
    await a.locator('.pd-offer .pd-pick').nth(1).click();
    await a.fill('.pd-say input', 'I wired the circuit and the bulb lit up first time.');
    ok(await a.locator('.pd-acts .primary').innerText() === 'Keep 1 photo', 'the button says "Keep 1 photo"');
    await a.screenshot({ path: SH + 'aaron-simple.png', fullPage: true });
    await a.click('.pd-acts .primary');
    await a.waitForSelector('.pd-offer', { state: 'detached' });
    const ev = await until(async () => saved().events.find((e) => e.studentId === AARON && e.title === 'Electricity practical'));
    ok(ev && ev.lineIds[0] === 'science' && ev.evidence.length === 1 && ev.evidence[0].url === p1.url && ev.summary.startsWith('I wired the circuit') && ev.verification === 'teacher-endorsed' && ev.visibility === 'school', 'kept: a moment on Science with photo 1, in his words, endorsed');
    ok(saved().endorsements.some((n) => n.eventId === ev?.id && n.teacherId === TID), 'the endorsement is Mr Coultas’s');
    ok(saved().notifications.some((n) => n.to === `t:${TID}` && n.text === `${aaron.name.split(' ')[0]} kept 1 photo from “Electricity practical”`), 'Mr Coultas hears that Aaron kept 1 photo');
    ok(await status(a, `${U}/${p1.url}`) === 200, 'Aaron fetches his kept photo');
    ok(await until(async () => (await status(a, `${U}/${p2.url}`)) === 404), 'the photo he did not keep no longer opens for him');
    ok(await status(M1.p, `${U}/${p2.url}`) === 200, `…but still does for ${m1.name}`);
    ok(await status(M2.p, `${U}/${p1.url}`) === 404, `${m2.name} still cannot fetch Aaron’s photo once it is on his map`);
    ok(!aErrs.length, `no page errors for Aaron${aErrs.length ? `: ${aErrs.join(' | ')}` : ''}`);

    // ── The first classmate, at Standard: "Not for me" ──
    ok((await act(m1Tok, 'completeOnboarding', [m1.id, ['science'], 'classic'])).ok && (await act(m1Tok, 'setIntensity', [m1.id, 'standard'])).ok, `${m1.name} is set up at Standard`);
    await M1.p.goto(`${U}/#/me/map`); await M1.p.waitForSelector('.home-head .pd-offer');
    await M1.p.waitForTimeout(600); await audit(M1.p, 'class photos card at Standard');
    await M1.p.click('.pd-offer .pd-acts .ghost');
    await M1.p.waitForSelector('.pd-offer', { state: 'detached' });
    ok(await until(async () => saved().spotted.find((x) => x.studentId === m1.id && x.dropId)?.status === 'declined'), 'declined: nothing goes on the map');

    // ── The second classmate reports her photo ──
    ok((await act(m2Tok, 'completeOnboarding', [m2.id, ['science'], 'classic'])).ok && (await act(m2Tok, 'setIntensity', [m2.id, 'standard'])).ok, `${m2.name} is set up at Standard`);
    await M2.p.goto(`${U}/#/me/map`); await M2.p.waitForSelector('.home-head .pd-offer');
    await M2.p.click('.pd-offer .pd-report'); await M2.p.waitForSelector('.sg-dialog');
    await M2.p.waitForTimeout(600); await audit(M2.p, 'reporting a class photo');
    await M2.p.click('.sg-dialog .sg-reasons button >> nth=1'); await M2.p.click('.sg-dialog .sg-foot .primary');
    await M2.p.waitForSelector('.pd-offer .sg-sent');
    const rp = await until(async () => saved().reports?.find((r) => r.photoId === p3.id));
    ok(rp && rp.kind === 'photo' && rp.studentId === m2.id && rp.from.key === 'student', 'the report is saved for the moderators');
    ok(saved().notifications.some((n) => n.to === 'role:counsellor' && /^New report: a photo from “Electricity practical”/.test(n.text)), 'moderators are told');


    // ── Mr Coultas sees who added it, who is waiting, who said no ──
    await t.reload(); await t.waitForSelector('.pd-list');
    await t.click('.pd-list summary');
    const row = (n) => t.locator('.pd-rows li', { hasText: n }).innerText();
    ok((await t.locator('.pd-list summary').innerText()).includes('1 added · 1 waiting · 1 said no'), 'the batch: 1 added · 1 waiting · 1 said no');
    ok((await row(aaron.name)).includes('Added') && (await row(aaron.name)).includes('Kept 1 of 2 photos'), 'Aaron: Added, kept 1 of 2');
    ok((await row(m1.name)).includes('Not for me'), `${m1.name}: Not for me`);
    ok((await row(m2.name)).includes('Waiting'), `${m2.name}: Waiting`);
    ok(await t.locator('.spot-list').count() === 0, 'class photos are not listed again under spotted moments');
    await audit(t, 'the class page with its photo drops');
    await t.screenshot({ path: SH + 'teacher-list.png', fullPage: true });
    ok(!tErrs.length, `no teacher page errors${tErrs.length ? `: ${tErrs.join(' | ')}` : ''}`);
    // ── A coordinator removes it from Reports: it leaves her offer and the file is deleted ──
    const coordT = roster.teachers.find((x) => (x.roles || []).includes('coordinator') && !(x.roles || []).includes('leadership') && links[x.email]);
    const C = await ctxFor(await setupWith(U, links[coordT.email]));
    const cErrs = []; C.p.on('pageerror', (e) => cErrs.push(e.message));
    await C.p.goto(`${U}/#/me/reports`); await C.p.waitForSelector('.sg-card');
    const rc = C.p.locator('.sg-card', { hasText: 'Electricity practical' });
    ok((await rc.innerText()).toLowerCase().includes('class photo from mr david coultas') && await rc.locator('img').count() === 1, 'Reports: the card shows the class photo and who took it');
    ok(await status(C.p, `${U}/${p3.url}`) === 200, 'the coordinator can open the reported photo');
    await audit(C.p, 'Reports with a class photo');
    await rc.locator('button:has-text("Remove photo")').click();
    ok(await until(async () => saved().reports.find((r) => r.id === rp.id)?.status === 'photo-removed'), 'the report says photo removed');
    const after = saved();
    ok(after.photoDrops[0].photos.find((p) => p.id === p3.id).url === null && after.spotted.find((x) => x.studentId === m2.id && x.dropId).status === 'removed', 'the photo left the batch and her offer');
    ok(await until(async () => !onDisk(p3.url)), 'the file is deleted');
    ok(after.notifications.some((n) => n.to === `st:${m2.id}` && n.text === 'A teacher has removed a photo from “Electricity practical”.' && n.kind === 'safeguarding'), 'she is told (safeguarding)');
    ok(!cErrs.length, `no coordinator page errors${cErrs.length ? `: ${cErrs.join(' | ')}` : ''}`);
    await C.c.close();
    for (const x of [M1, M2, O, N]) await x.c.close();
  } finally { await b.close(); srv.p.kill(); }
})().catch((e) => { console.error(e); srv?.p?.kill(); process.exit(1); });
