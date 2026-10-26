// Learner profile tags: filter by attribute, edit tags on a station, leadership view.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => { const b = await chromium.launch(); const errs=[]; const U='http://localhost:4173/#/'; const SH=require('os').tmpdir()+'/tp-';
const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
await p.goto(U+'reset'); await p.waitForTimeout(400);
await p.goto(U+'maya/map'); await p.reload(); await p.waitForTimeout(900);
await p.click('.map-bar >> text=Filters'); await p.selectOption('select[aria-label="Learner profile"]', 'Risk-taker'); await p.waitForTimeout(400);
ok(/\d+ match/.test(await p.textContent('.find-n')), 'Risk-taker filter: ' + (await p.textContent('.find-n')).trim());
await p.click('.map-bar >> role=button[name="List"]'); await p.waitForTimeout(300);
await p.locator('.sl-row').first().click(); await p.waitForTimeout(400);
const before = await p.locator('.station-panel .tag-box').first().textContent(); ok(/Risk-taker/.test(before), 'station carries the tag');
await p.click('.station-panel .tag-box .linkish'); await p.waitForTimeout(200);
const had = /Principled/.test(before);
await p.click('.tag-box.editing >> role=button[name="Principled"]'); await p.click('.tag-box.editing >> text=Done'); await p.waitForTimeout(200);
const after = await p.locator('.station-panel .tag-box').first().textContent(); ok(/Principled/.test(after) !== had, 'editing flips a tag');
await p.screenshot({ path: SH+'n6-panel.png' });
await p.goto(U+'principal/profile'); await p.waitForTimeout(700); ok(await p.locator('.card-sec').count() > 0, 'leadership profile view'); await p.screenshot({ path: SH+'n6-lead.png' });
ok(!errs.length, 'no page errors ' + errs.join('; ')); await b.close(); })();
