// Shared record through the pilot server: two devices stay in step without a reload, ids match
// everywhere, and the record survives a reload and a server restart. Needs `npm run build` first.
// Starts its own server (on SYNC_PORT, or a random port) with an empty data folder.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const ROOT = path.resolve(__dirname, '../..'); const PORT = process.env.SYNC_PORT || 20000 + Math.floor(Math.random() * 20000);
const API = `http://localhost:${PORT}/api`, U = `http://localhost:${PORT}/#/`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-sync-'));
let srv = null;
process.on('exit', () => srv?.kill());
const start = () => new Promise((res, rej) => {
  const s = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT, DATA_DIR: DATA, TP_MODE: 'demo' } });
  s.stdout.on('data', (d) => /server on/.test(d) && res(s)); s.stderr.on('data', (d) => process.stderr.write(d)); s.on('exit', (c) => rej(new Error(`server exited ${c}`)));
});
const stop = (s) => new Promise((res) => { s.removeAllListeners('exit'); s.on('exit', res); s.kill(); });
const state = async () => (await (await fetch(`${API}/state`)).json()).snapshot;
const evByTitle = (snap, t) => snap.store.events.find((e) => e.title === t);
const local = (p) => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('tp-store-')); return k && JSON.parse(localStorage.getItem(k)).store; });
const until = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
async function addStation(p, title, teacher) {
  await p.click('text=Add a station');
  await p.fill('.add-station label:has-text("What happened") input', title);
  await p.click('.add-station .chips .line-chip >> text=Computing');
  if (teacher) await p.selectOption('.add-station label:has-text("Ask a teacher") select', teacher);
  await p.click('.add-station >> text=Add to my map');
}

(async () => {
  srv = await start();
  const b = await chromium.launch(); const errs = [];
  const A = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const B = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
  await A.goto(U + 'reset'); await A.waitForTimeout(800);
  await A.goto(U + 'maya/map'); await B.goto(U + 'nair/queue');
  ok(await until(async () => (await B.textContent('.sync-state')) === 'Saved'), 'header says Saved with the server');

  // A student adds a station on one device; the teacher sees it in the queue on another, no reload.
  const T1 = `Sync check ${Date.now().toString(36)}`;
  await addStation(A, T1, 't-01');
  ok(await until(() => B.locator(`.q-card[aria-label*="${T1}"]`).count()), 'new station reaches the other device without reload');
  await B.locator(`.q-card[aria-label*="${T1}"] >> text=Endorse`).last().click();
  const endorsed = (s) => { const e = s?.events.find((x) => x.title === T1); return !!e && e.verification === 'teacher-endorsed' && s.endorsements.some((n) => n.eventId === e.id && n.teacherId === 't-01'); };
  ok(await until(async () => endorsed((await state()).store)), 'endorsement reaches the server');
  ok(await until(async () => endorsed(await local(A))), 'endorsement reaches the first device without reload');
  await A.click('.bell'); ok(await until(() => A.locator(`.bell-menu >> text=endorsed “${T1}”`).count()), 'student is notified live');

  // Same ids on both devices and the server (deterministic replay).
  const srvS = await state(), la = await local(A), lb = await local(B);
  const ids = (s) => { const e = s.events.find((x) => x.title === T1); return [e.id, ...s.reflections.concat(s.endorsements, s.requests).filter((x) => x.eventId === e.id).map((x) => x.id).sort()].join(' '); };
  ok(ids(srvS.store) === ids(la) && ids(la) === ids(lb), `ids identical everywhere: ${ids(la)}`);
  ok(srvS.store.activity[0].ts === la.activity[0].ts && la.activity[0].ts === lb.activity[0].ts, 'timestamps identical everywhere');

  // Two devices add at the same moment: both land, ids never collide.
  await B.goto(U + 'maya/map'); await B.waitForTimeout(600);
  const T2 = `${T1} A`, T3 = `${T1} B`;
  await Promise.all([addStation(A, T2), addStation(B, T3)]);
  ok(await until(async () => { const s = await state(); return evByTitle(s, T2) && evByTitle(s, T3); }), 'concurrent additions both reach the server');
  const s2 = await state(); const all = s2.store.events.map((e) => e.id).concat(s2.store.activity.map((a) => a.id), s2.store.notifications.map((n) => n.id));
  ok(new Set(all).size === all.length, `no duplicate ids on the server (${evByTitle(s2, T2).id}, ${evByTitle(s2, T3).id})`);
  ok(await until(async () => { const [x, y] = [await local(A), await local(B)]; return [T2, T3].every((t) => x.events.some((e) => e.title === t) && y.events.some((e) => e.title === t)); }), 'both devices end with both stations');

  // Reload: still there.
  await B.reload(); await B.waitForTimeout(800);
  await B.fill('.map-q', T1); await B.waitForTimeout(400);
  ok(/3 match/.test(await B.textContent('.find-n')), 'after reload the stations are still there');

  // Server stops: the header says so; it restarts with the record intact and the devices reconnect.
  await stop(srv);
  ok(await until(async () => (await A.textContent('.sync-state')) === 'Offline, saving here'), 'header says Offline when the server is gone');
  srv = await start();
  ok(evByTitle(await state(), T1)?.verification === 'teacher-endorsed', 'after a server restart the record is still there');
  ok(await until(async () => (await A.textContent('.sync-state')) === 'Saved', 9000), 'device reconnects and says Saved');
  const C = await (await b.newContext()).newPage(); await C.goto(U + 'maya/map'); await C.waitForTimeout(800);
  await C.fill('.map-q', T1); await C.waitForTimeout(400);
  ok(/3 match/.test(await C.textContent('.find-n')), 'a fresh device sees the stations after the restart');

  // Reset from one device puts every device back.
  await A.goto(U + 'reset'); await A.waitForTimeout(300);
  ok(await until(async () => !evByTitle(await state(), T1)), 'reset clears the server record');
  ok(await until(async () => !(await local(B)).events.some((e) => e.title === T1)), 'reset reaches the other device');

  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close(); await stop(srv); fs.rmSync(DATA, { recursive: true, force: true });
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
