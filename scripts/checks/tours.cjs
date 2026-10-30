const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const phone of [false, true]) {
  const p = await (await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('CON ' + m.text()));
  await p.goto('http://localhost:4173/#/reset'); await p.waitForTimeout(800);
  await p.click('.tour-btn'); const n = await p.locator('.tour-play').count(); await p.keyboard.press('Escape'); if (await p.getAttribute('.tour-btn', 'aria-expanded') === 'true') await p.click('.tour-btn').catch(()=>{}); // Escape closes the menu now
  for (let t = 0; t < n; t++) {
    await p.goto('http://localhost:4173/#/reset'); await p.waitForTimeout(600);
    await p.click('.tour-btn'); await p.locator('.tour-play').nth(t).click(); await p.waitForTimeout(800);
    for (let i = 0; i < 40; i++) {
      const title = await p.$eval('.pr-text b', (e) => e.innerText).catch(() => null); if (!title) break;
      const st = await p.evaluate(() => ({ soon: !!document.querySelector('.soon'), boom: !!document.querySelector('.err-boundary, .error-boundary'), empty: (document.querySelector('main.screen')?.innerText || '').trim().length < 40 && !document.querySelector('.tour-card, .tc'), hs: document.documentElement.scrollWidth > innerWidth + 1 }));
      const flags = Object.entries(st).filter(([, v]) => v).map(([k]) => k);
      console.log(phone ? 'PH' : 'DT', t, i + 1, title, '|', p.url().split('#')[1], flags.join(','));
      await p.screenshot({ path: `${require('os').tmpdir()}/tp-tour-${phone ? 'ph' : 'dt'}-${t}-${String(i + 1).padStart(2, '0')}.png` });
      await p.click('.presenter .primary'); await p.waitForTimeout(900);
    }
    console.log('end url', p.url().split('#')[1], 'presenter gone:', !(await p.$('.presenter')));
  }
  console.log('ERRS', [...new Set(errs)]);
  }
  await b.close();
})();
