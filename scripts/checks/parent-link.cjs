// Parent conference link: Thai and English, remembered language, advisor makes the link.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => { const b = await chromium.launch(); const errs=[]; const U='http://localhost:4173/#/'; const SH=require('os').tmpdir()+'/tp-';
const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
await p.goto(U+'reset'); await p.waitForTimeout(400);
await p.goto(U+'p/st-01/th'); await p.reload(); await p.waitForTimeout(1200); await p.screenshot({ path: SH+'n1-th.png' });
ok(/[฀-๿]/.test(await p.textContent('.pv-intro h1')), 'Thai heading');
const item = p.locator('.pv-intro ul li .linkish').first();
if (await item.count()) { await item.click(); await p.waitForTimeout(500); ok(await p.locator('.station-panel').count() > 0, 'term item opens a station'); await p.screenshot({ path: SH+'n1-th-panel.png' }); await p.keyboard.press('Escape'); }
else console.log('INFO no public items this term');
await p.click('.landing-bar >> text=English').catch(() => p.click('button[lang="en"]')); await p.waitForTimeout(400);
const h1 = await p.textContent('.pv-intro h1'); ok(!/[฀-๿]/.test(h1), 'English heading: ' + h1);
await p.goto(U+'p/st-01'); await p.reload(); await p.waitForTimeout(800); console.log('INFO remembered', await p.textContent('.pv-intro h1'));
await p.goto(U+'whitfield/student/st-01'); await p.waitForTimeout(800);
await p.click('summary >> text=Parent conference link'); await p.waitForTimeout(200);
const mk = p.locator('text=Make a parent link'); if (await mk.count()) await mk.click(); await p.waitForTimeout(300);
ok(await p.locator('a[href$="/p/st-01/th"]').count() === 1, 'advisor gets a Thai link');
ok(!errs.length, 'no page errors ' + errs.join('; ')); await b.close(); })();
