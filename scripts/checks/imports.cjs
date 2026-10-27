// Real imports: the CAS coordinator imports a ManageBac CSV, the student finds the items in her inbox
// and accepts one onto the map; a repeat import adds nothing; a student imports her own CSV; phone width.
const path = require('path');
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const FX = path.join(__dirname, '../../src/imports/fixtures');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const U = `http://localhost:${process.env.PORT || 4173}/#/`; const SH = require('os').tmpdir() + '/tp-';
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + 'reset'); await p.waitForTimeout(400);

  // 1. Coordinator: ManageBac CAS export
  await p.goto(U + 'brandt/import'); await p.waitForTimeout(500);
  ok(await p.locator('.soon').count() === 0, 'coordinator import screen is built');
  ok(await p.locator('.imp-format.on', { hasText: 'CAS experiences' }).count() === 1, 'ManageBac CAS is the coordinator default');
  await p.setInputFiles('[data-testid=import-file]', path.join(FX, 'managebac-cas.csv')); await p.waitForTimeout(400);
  const ready = await p.locator('.imp-tr:not(.head) .imp-flag.ok').count();
  ok(ready === 4, `preview shows 4 ready rows (${ready})`);
  ok(await p.locator('.imp-tr.bad', { hasText: 'ปิ่น ชัยพร' }).count() === 1, 'unmatched Thai name is reported, not guessed');
  ok(await p.locator('.imp-tr.bad', { hasText: 'Rejected' }).count() === 1, 'rejected experience is reported');
  ok(await p.locator('.imp-tr', { hasText: 'Beach Guardians' }).locator('.imp-line', { hasText: 'Service' }).count() === 1, 'suggested line shown');
  await p.screenshot({ path: SH + 'imp-preview.png', fullPage: true });
  await p.click('button.primary:has-text("Send 4 items")'); await p.waitForTimeout(300);
  ok(/Done: 4 items in 4 inboxes/.test(await p.textContent('h1')), 'done screen');

  // 2. The student sees the items and accepts one
  await p.click('button:has-text("Open Maya’s inbox")'); await p.waitForTimeout(600);
  ok(p.url().endsWith('#/maya/inbox'), 'opened Maya’s inbox');
  const card = p.locator('.cand', { hasText: 'Beach Guardians' });
  ok(await card.count() === 1, 'imported item is in the inbox');
  ok(await card.locator('.line-chip[aria-pressed=true]', { hasText: 'Service' }).count() === 1, 'suggested line preselected');
  ok(await p.locator('.int-card', { hasText: 'CAS log' }).count() === 1, 'integration card still there');
  await card.locator('button.primary:has-text("Add to map")').click(); await p.waitForTimeout(800);
  ok(/#\/maya\/map\/ev-imp-/.test(p.url()), 'accepted onto the map: ' + p.url());
  ok(await p.locator('text=Beach Guardians').count() > 0, 'station visible on the map');

  // 3. Importing the same file again adds nothing
  await p.goto(U + 'brandt/import'); await p.waitForTimeout(400);
  await p.setInputFiles('[data-testid=import-file]', path.join(FX, 'managebac-cas.csv')); await p.waitForTimeout(400);
  ok(await p.locator('.imp-flag.dup').count() === 4, 'second import: all four already imported');
  ok(await p.locator('button.primary:has-text("Nothing to send")').isDisabled(), 'nothing to send');

  // 4. The student imports her own spreadsheet
  await p.goto(U + 'maya/inbox'); await p.waitForTimeout(600);
  await p.click('.int-head button:has-text("Import a file")'); await p.waitForTimeout(200);
  await p.setInputFiles('.imp-dlg [data-testid=import-file]', path.join(FX, 'generic.csv')); await p.waitForTimeout(300);
  ok(await p.locator('.imp-dlg .imp-flag.bad', { hasText: 'someone else' }).count() >= 1, 'rows for other students refused');
  await p.click('.imp-dlg button.primary:has-text("Add 1 to my inbox")'); await p.waitForTimeout(400);
  const mine = p.locator('.cand', { hasText: 'Swimming gala' });
  ok(await mine.count() === 1 && /Student-added/.test(await mine.textContent()), 'own file arrives as student-added');
  await p.screenshot({ path: SH + 'imp-inbox.png' });

  // 5. Teacher persona and phone width
  await p.goto(U + 'nair/import'); await p.waitForTimeout(400);
  ok(await p.locator('.imp-format.on', { hasText: 'tasks and grades' }).count() === 1, 'teacher import screen, tasks by default');
  const ph = await b.newPage({ viewport: { width: 390, height: 844 } }); ph.on('pageerror', (e) => errs.push(e.message));
  await ph.goto(U + 'brandt/import'); await ph.waitForTimeout(500);
  await ph.click('button:has-text("Try a sample")'); await ph.waitForTimeout(400);
  const over = await ph.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(over <= 0, `no sideways scroll at phone width (${over}px)`);
  await ph.screenshot({ path: SH + 'imp-phone.png', fullPage: true });
  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
})();
