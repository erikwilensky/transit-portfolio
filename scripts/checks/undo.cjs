// Undo with no server (static preview): the toast puts the snapshot back, as before. With the
// server, sync.cjs covers undo for everyone and auth.cjs who may undo what.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errs = []; const U = (process.env.BASE || 'http://localhost:4173') + '/#/';
  const p = await b.newPage({ viewport: { width: 1300, height: 860 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + 'reset'); await p.waitForTimeout(400); await p.goto(U + 'maya/map'); await p.waitForTimeout(800);
  const T = `Undo check ${Date.now().toString(36)}`;
  await p.click('text=Add a station');
  await p.fill('.add-station label:has-text("What happened") input', T);
  await p.click('.add-station .chips .line-chip >> text=Computing');
  await p.click('.add-station >> text=Add to my map'); await p.waitForTimeout(500);
  const has = () => p.evaluate((t) => Object.keys(localStorage).some((k) => k.startsWith('tp-store-') && JSON.parse(localStorage[k]).store.events.some((e) => e.title === t)), T);
  ok(await has(), 'station added');
  const id = await p.evaluate((t) => { const k = Object.keys(localStorage).find((x) => x.startsWith('tp-store-')); return JSON.parse(localStorage[k]).store.events.find((e) => e.title === t).id; }, T);
  await p.goto(U + `maya/map/${id}`); await p.waitForTimeout(500);
  await p.click('.station-panel.open button.danger:has-text("Delete")'); await p.waitForTimeout(400);
  ok(!(await has()), 'station deleted');
  await p.click('.toast-undo'); await p.waitForTimeout(400);
  ok(await has(), 'Undo with no server puts it back');
  await p.reload(); await p.waitForTimeout(800);
  ok(await has(), 'and it is still there after a reload');
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
