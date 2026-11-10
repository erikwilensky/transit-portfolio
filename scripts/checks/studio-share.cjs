// Presentation studio → share link, in the demo (vite preview on PORT, default 4173).
// The Specific page takes a course, university and matching lines; the Employer CV takes skills; a link made from
// the studio has a long random token and expires after the student's "links last" setting (90 days by default),
// and the dialog's Copy button tells the truth when the clipboard is blocked.
const { chromium } = require('playwright');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const U = `http://localhost:${process.env.PORT || 4173}/#/`;

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + 'reset'); await p.waitForTimeout(500);
  await p.goto(U + 'maya/studio'); await p.waitForTimeout(600);

  await p.locator('.lens-switch button', { hasText: 'Specific' }).first().click(); await p.waitForTimeout(300);
  await p.locator('.studio-bar button', { hasText: 'Builder' }).first().click(); await p.waitForTimeout(300);
  await p.fill('.studio-controls label:has-text("Course") input', 'Environmental Science');
  await p.fill('.studio-controls label:has-text("University") input', 'Riverside University');
  await p.waitForTimeout(200);
  ok((await p.textContent('.lens-switch button[aria-checked=true]')).includes('Environmental Science'), 'Specific: the course names the audience');
  ok((await p.textContent('.studio-preview .letter h2')) === 'Why Environmental Science', 'Specific: the letter asks “Why <course>”');
  ok((await p.textContent('.studio-preview .letter')).includes('Riverside University'), 'Specific: the letter names the university');
  const focus = p.locator('.studio-controls li:has-text("Environment") input[type=checkbox]').first();
  const before = await p.locator('.studio-preview .evidence-line').count();
  await focus.click(); await p.waitForTimeout(200);
  ok(await p.locator('.studio-preview .evidence-line').count() !== before, 'Specific: ticking a matching line changes the evidence shown');

  await p.locator('.lens-switch button', { hasText: 'Employer' }).first().click(); await p.waitForTimeout(300);
  await p.fill('.studio-controls label:has-text("Skills") textarea', 'Python\n\nSoldering');
  await p.waitForTimeout(200);
  ok((await p.locator('.studio-preview .cv-side ul li').allTextContents()).join('|') === 'Python|Soldering', 'Employer: skills, one per line, blank lines dropped');

  await p.locator('.lens-switch button', { hasText: 'General' }).first().click(); await p.waitForTimeout(300);
  await p.locator('.studio-bar button', { hasText: 'Template' }).first().click(); await p.waitForTimeout(200);
  await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }); });
  await p.locator('.studio-controls button.primary', { hasText: 'Create share link' }).click(); await p.waitForTimeout(400);
  if (!(await p.locator('.share-dlg').count())) { await p.locator('.modal button', { hasText: 'Share without them' }).click(); await p.waitForTimeout(400); }
  const url = await p.inputValue('.share-dlg input');
  const token = url.split('/s/')[1];
  ok(/^tp-[a-z0-9]{16}$/.test(token), `studio link has a long random token (${token})`);
  ok(/Expires/.test(await p.textContent('.share-dlg .fineprint')), 'the dialog says when it expires');
  await p.click('.share-dlg button.primary'); await p.waitForTimeout(200);
  ok((await p.textContent('.share-dlg button.primary')) !== 'Copied', `Copy does not claim success when the clipboard is blocked (${await p.textContent('.share-dlg button.primary')})`);
  await p.click('.share-dlg .panel-close');

  await p.goto(U + 'maya/links'); await p.waitForTimeout(500);
  const row = p.locator('.link-row', { hasText: token });
  ok(await row.count() === 1, 'the new link is listed under Share links');
  ok(/9\d days left/.test(await row.locator('.lr-status').textContent()), `it lasts the default 90 days (${await row.locator('.lr-status').textContent()})`);

  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
  await b.close();
})();
