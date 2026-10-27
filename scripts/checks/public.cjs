// Share links and verify codes for a reader on another device: a fresh browser, nothing saved.
// With the pilot server (BASE=http://localhost:8787 node public.cjs), the page must fetch only what was shared.
// Without one (vite preview on 4173, the default), it still renders from the browser's own copy.
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const BASE = (process.env.BASE || 'http://localhost:4173').replace(/\/$/, '');
const data = (f) => require(path.join(__dirname, '../../data', f));
(async () => {
  const { verifyCode } = await import(path.join(__dirname, '../../src/format.js'));
  const students = data('students.json'), events = data('events.json'), refls = data('reflections.json');
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const bodies = []; // every /api response the page received
  p.on('response', async (r) => { if (r.url().includes('/api/')) { try { bodies.push({ url: r.url(), status: r.status(), text: await r.text() }); } catch { /* aborted */ } } });
  await p.goto(`${BASE}/`); await p.waitForTimeout(300);
  const server = await p.evaluate(async () => { try { const r = await fetch('api/health'); return (r.headers.get('content-type') || '').includes('json'); } catch { return false; } });
  console.log('INFO', BASE, server ? 'with the pilot server' : 'no server (browser copy)');
  bodies.length = 0;

  // An open link: Maya's general portfolio.
  await p.goto(`${BASE}/#/s/tp-g3n2`); await p.waitForSelector('.landing-banner', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('.landing-banner').count() === 1, 'share link opens');
  ok((await p.textContent('.lb-meta').catch(() => '')).includes('Maya Chen'), 'shows the student');
  const stations = p.locator('.landing-body .station');
  ok(await stations.count() > 3, `map has stations (${await stations.count()})`);
  if (await stations.count()) { await p.locator('.landing-body .p-item, .landing-body li[class=""], .landing-body .case-card').first().click(); await p.waitForTimeout(500); ok(await p.locator('.station-panel.open').count() === 1, 'a station opens'); await p.keyboard.press('Escape'); }

  // Gated link: the email first, then the portfolio.
  await p.goto(`${BASE}/#/s/tp-u8k4`); await p.waitForSelector('.link-gate', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('.link-gate').count() === 1, 'gated link asks for an email');
  await p.fill('.link-gate input[type=email]', 'reader@northbridge.ac.uk'); await p.click('.link-gate button.primary');
  await p.waitForSelector('.landing-banner', { timeout: 8000 }).catch(() => {});
  ok(await p.locator('.landing-banner').count() === 1, 'gated link opens after the email');

  // Withdrawn and unknown links.
  await p.goto(`${BASE}/#/s/tp-e1x9`); await p.waitForSelector('.link-dead h2', { timeout: 8000 }).catch(() => {});
  ok(/withdrawn/.test(await p.textContent('.link-dead h2').catch(() => '')), 'withdrawn link says so');
  await p.goto(`${BASE}/#/s/tp-nope`); await p.waitForSelector('.link-dead h2', { timeout: 8000 }).catch(() => {});
  ok(/does not exist/.test(await p.textContent('.link-dead h2').catch(() => '')), 'unknown link says so');

  // A printed verify code, and one for a station that is not publishable.
  const pub = events.find((e) => e.id === 'ev-009');
  await p.goto(`${BASE}/#/v/${verifyCode(pub.id)}`); await p.waitForSelector('.vrec h3', { timeout: 8000 }).catch(() => {});
  ok((await p.textContent('.vrec h3').catch(() => '')) === pub.title, 'verify code shows the station');
  ok((await p.textContent('.vrec-who').catch(() => '')).includes('Maya Chen'), 'verify code names the student');
  const priv = events.find((e) => e.visibility !== 'publishable');
  await p.goto(`${BASE}/#/v/${verifyCode(priv.id)}`); await p.waitForSelector('.vrec h3', { timeout: 8000 }).catch(() => {});
  ok(/No public record/.test(await p.textContent('.vrec h3').catch(() => '')), 'a non-public code finds nothing');

  if (server) {
    const all = bodies.map((x) => x.text).join('\n');
    ok(bodies.some((x) => x.url.includes('/api/public/share/tp-g3n2')), 'fetched the share from the server');
    ok(!bodies.some((x) => /\/api\/(state|stream)/.test(x.url)), 'never fetched the full record');
    const others = students.filter((s) => s.id !== 'st-01').map((s) => s.name).filter((n) => all.includes(n));
    ok(!others.length, `no other students named in the payload ${others.join(', ')}`);
    const mine = new Set(events.filter((e) => e.studentId === 'st-01').map((e) => e.id));
    const leaked = refls.filter((r) => mine.has(r.eventId) && (r.visibility || 'private') !== 'publishable' && all.includes(r.text.slice(0, 60)));
    ok(!leaked.length, `no private reflection text in the payload ${leaked.map((r) => r.id).join(', ')}`);
    ok(!/tp-nb7d|tp-c7m1|tp-a1g0|tp-l5g2/.test(all), 'no other share tokens in the payload');
    const saved = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tp-store')));
    ok(!saved.length, 'nothing saved in the reader’s browser');
  }
  // Share links in the app are full addresses that work on another device (after the checks above: the full app saves).
  await p.goto(`${BASE}/#/maya/links`); await p.waitForTimeout(1200);
  const href = await p.locator('a[href*="#/s/"]').first().getAttribute('href').catch(() => null);
  ok(href && href.startsWith(`${BASE}/`), `share link is absolute: ${href}`);
  ok(!errs.length, `no page errors ${errs.join('; ')}`);
  await b.close();
})();
