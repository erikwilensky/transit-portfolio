// Print and "Download PDF": every document a student or counsellor hands over prints as clean A4.
// Checks page counts, A4 size, no app chrome in print, the footer, the saved file name, and dark mode.
// PRINT_SAVE=1 also writes the PDFs to shots/print/.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const U = `http://localhost:${process.env.PORT || 4173}/#/`;
const OUT = path.join(__dirname, '../../shots/print');
const pages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const a4 = (buf) => /\/MediaBox\s*\[\s*0 0 59[45]\.\d+ 84[12]\.\d+\s*\]/.test(buf.toString('latin1'));

const studio = (label) => async (p) => { await p.goto(U + 'maya/studio'); await p.waitForTimeout(500); await p.locator('.lens-switch button', { hasText: label }).first().click(); await p.waitForTimeout(600); };
const DOCS = [
  ['general', 'Maya Chen – Profile', studio('General'), 4],
  ['university', 'Maya Chen – University narrative', studio('University'), 14],
  ['specific', 'Maya Chen – Data Science statement', studio('Specific'), 8],
  ['employer', 'Maya Chen – Employer CV', studio('Employer'), 4],
  ['scholarship', 'Maya Chen – Scholarship impact timeline', studio('Scholarship'), 7],
  ['custom', 'Maya Chen – Portfolio page', studio('Custom'), 8],
  ['share-link', 'Maya Chen – Data Science statement', async (p) => { await p.goto(U + 's/tp-nb7d'); await p.waitForTimeout(700); }, 8, true],
  ['share-skim', 'Maya Chen – Portfolio summary', async (p) => { await p.goto(U + 's/tp-g3n2'); await p.waitForTimeout(600); await p.click('text=60-second view'); await p.waitForTimeout(300); }, 2, true],
  ['reference-letter', 'Maya Chen – Reference letter', async (p) => { await p.goto(U + 'adeyemi/letter/st-01'); await p.waitForTimeout(600); }, 2],
  ['activities', 'Maya Chen – Activities list', async (p) => { await p.goto(U + 'adeyemi/activities'); await p.waitForTimeout(600); }, 2],
];
const CHROME = '.topnav, .presenter, .toast, .station-panel, .studio-bar, .studio-controls, .landing-bar, .landing-banner, .letter-tools, .letter-side, .al-bar, .print-btn, .tour-card';

(async () => {
  const b = await chromium.launch(); const errs = [];
  if (process.env.PRINT_SAVE) fs.mkdirSync(OUT, { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: scheme })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(U + 'reset'); await p.waitForTimeout(500);
    for (const [name, title, go, max, shared] of DOCS) {
      if (scheme === 'dark' && !['employer', 'reference-letter', 'share-link'].includes(name)) continue;
      const tag = `${name}${scheme === 'dark' ? ' (dark mode)' : ''}`;
      await p.emulateMedia({ media: 'screen' }); await go(p);
      ok(await p.locator('.print-btn').count() === 1, `${tag}: one Download PDF button`);
      // The button names the file and opens the dialog; stub the dialog to see the title it set.
      await p.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = document.title; window.dispatchEvent(new Event('afterprint')); }; });
      await p.click('.print-btn');
      ok(await p.evaluate(() => window.__printed) === title, `${tag}: saves as “${title}.pdf”`);
      ok(await p.title() === 'NIST Transit Portfolio', `${tag}: title restored after printing`);

      await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(150);
      const st = await p.evaluate((sel) => {
        const shown = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && e.getClientRects().length > 0; };
        const bg = (e) => getComputedStyle(e).backgroundColor;
        return {
          chrome: [...document.querySelectorAll(sel)].filter(shown).map((e) => e.className),
          colophon: [...document.querySelectorAll('.print-colophon')].filter(shown).length,
          qr: [...document.querySelectorAll('.print-colophon .qr')].filter(shown).length,
          page: [...document.querySelectorAll('style[data-print-page]')].some((s) => /size: A4 portrait/.test(s.textContent) && /@bottom-left/.test(s.textContent)),
          theme: document.documentElement.dataset.theme || 'light',
          body: bg(document.body),
          title: document.title,
        };
      }, CHROME);
      ok(!st.chrome.length, `${tag}: no app chrome in print ${st.chrome.join(', ')}`);
      ok(st.colophon === 1, `${tag}: footer block printed`);
      ok(shared ? st.qr === 1 : st.qr === 0, `${tag}: ${shared ? 'QR code back to the share link' : 'no QR without a share link'}`);
      ok(st.page, `${tag}: A4 portrait with a running footer`);
      ok(st.theme !== 'dark' && /255, 255, 255/.test(st.body), `${tag}: light page (${st.theme}, ${st.body})`);
      ok(st.title === title, `${tag}: title while printing is “${st.title}”`);

      const buf = await p.pdf({ preferCSSPageSize: true });
      const n = pages(buf);
      ok(n >= 1 && n <= max, `${tag}: ${n} page${n === 1 ? '' : 's'} (at most ${max})`);
      ok(a4(buf), `${tag}: A4 paper`);
      if (process.env.PRINT_SAVE && scheme === 'light') fs.writeFileSync(path.join(OUT, `${title}.pdf`), buf);
      await p.emulateMedia({ media: 'screen' }); await p.waitForTimeout(100);
      ok(await p.title() === 'NIST Transit Portfolio', `${tag}: title restored after print preview`);
      if (scheme === 'dark') ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', `${tag}: dark mode back on screen`);
    }
    await p.context().close();
  }

  // The map poster keeps its own A3 landscape sheet.
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(U + 'maya/poster'); await p.waitForTimeout(800); await p.emulateMedia({ media: 'print' });
  const buf = await p.pdf({ preferCSSPageSize: true });
  ok(pages(buf) === 1 && /\/MediaBox\s*\[\s*0 0 119\d\.\d+ 84\d\.\d+\s*\]/.test(buf.toString('latin1')), `poster: one A3 landscape page (${pages(buf)})`);
  ok(!errs.length, `no page errors ${errs.join('; ')}`);
  await b.close();
})();
