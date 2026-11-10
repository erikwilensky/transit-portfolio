// Student polish (demo preview: npm run build && npx vite preview --port 4173 --strictPort &, or PORT=…).
// Lena (Standard) adds a station without asking a teacher: the toast must not claim an endorsement was requested.
// A date before her map starts keeps Add disabled and says why. Maya (Full) at phone width: a list view search that
// matches nothing says so; Lena's own reflection does not show as "Signal: My own reflection".
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const U = `http://localhost:${process.env.PORT || 4173}/#/`;
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } }); p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto(U + 'reset'); await p.waitForTimeout(400);
    await p.goto(U + 'lena/map'); await p.waitForTimeout(800);
    await p.click('text=Add a station'); await p.fill('.add-station input >> nth=0', 'Poetry evening');
    await p.locator('.add-station .line-chip').first().click();
    await p.locator('.add-station select').last().selectOption('');
    await p.fill('.add-station input[type=date]', '2012-03-04');
    ok(await p.locator('.add-station .composer-foot .primary').isDisabled(), 'a date before the map starts keeps Add disabled');
    ok(/Your map starts on 1 Aug 2025/.test(await p.locator('.add-station').innerText()), 'and says when the map starts');
    await p.fill('.add-station input[type=date]', '2026-10-01');
    await p.click('.add-station .composer-foot .primary'); await p.waitForTimeout(500);
    const t = await p.locator('.toast').textContent();
    ok(t.includes('Added “Poetry evening”') && !t.includes('Endorsement requested'), `no teacher asked, no "Endorsement requested": "${t}"`);
    await p.click('.station-panel button:has-text("Add a reflection")');
    await p.fill('.station-panel textarea[aria-label="Reflection"]', 'Reading aloud was scary, then fun.');
    await p.click('.station-panel button:has-text("Save reflection")'); await p.waitForTimeout(400);
    const refl = await p.locator('.station-panel .reflection').last().innerText();
    ok(refl.includes('Reading aloud') && !refl.includes('Signal:'), 'an own reflection has no "Signal:" line');
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(U + 'maya/map'); await p.waitForTimeout(800);
    if (!(await p.locator('.st-list').count())) await p.click('.seg button:has-text("List")');
    await p.fill('.map-q', 'zzqx'); await p.waitForTimeout(200);
    ok((await p.locator('.st-list').innerText()).includes('No stations match'), 'a search with no match says so');
  } catch (e) { ok(false, e.message.split('\n')[0]); }
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
})();
