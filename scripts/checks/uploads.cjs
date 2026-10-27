// Evidence files: a photo, a PDF and a recording added to a new station, then opened in the panel.
// With the pilot server (node uploads.cjs http://localhost:8787) they must land in DATA_DIR/uploads
// and come back from /api/files. On a static preview (default, port 4173) they fall back to data URLs.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) process.exitCode = 1; };
const BASE = (process.argv[2] || process.env.TP_URL || 'http://localhost:4173').replace(/\/$/, '');
const DATA = process.env.DATA_DIR || path.join(__dirname, '../../.data');
const SH = require('os').tmpdir() + '/tp-';

// A one-page PDF, written by hand.
function pdf() {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const text = 'BT /F1 24 Tf 72 760 Td (Hackathon write-up) Tj ET';
  objs[3] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
// Half a second of a quiet tone as WAV.
function wav() {
  const n = 8000, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 3000), 44 + i * 2);
  return b;
}

(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', (e) => errs.push(e.message));
  const U = BASE + '/#/';
  const server = await p.request.get(BASE + '/api/health').then((r) => r.ok() && /json/.test(r.headers()['content-type'] || '')).catch(() => false);
  console.log('INFO', BASE, server ? 'pilot server: files go to the server' : 'no server: files stay in the browser');
  await p.goto(U + 'reset'); await p.waitForTimeout(400);
  await p.goto(U + 'maya/map'); await p.reload(); await p.waitForTimeout(1000);

  // A 3000 × 2000 photo, made in the page so it is a real JPEG.
  const big = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 37 % 360} 60% ${30 + i % 40}%)`; g.fillRect((i * 97) % 3000, (i * 61) % 2000, 300, 200); }
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]; }), 'base64');

  await p.click('button:has-text("Add a station"), button:has-text("Add something I did")');
  await p.waitForSelector('.add-station');
  await p.fill('.add-station input[placeholder^="e.g."]', 'Upload check: hackathon write-up');
  await p.locator('.add-station .line-chip').first().click();
  await p.locator('.add-station .photo-row input[type=file]').setInputFiles({ name: 'big-photo.jpg', mimeType: 'image/jpeg', buffer: big });
  await p.waitForSelector('.add-station .photo-prev', { timeout: 15000 });
  const photoUrl = await p.getAttribute('.add-station .photo-prev', 'src');
  await p.locator('.add-station .attach input[type=file]').setInputFiles({ name: 'Hackathon write-up.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await p.waitForSelector('.add-station .pending-files li', { timeout: 15000 });
  ok(/PDF/.test(await p.textContent('.add-station .pending-files li')), 'PDF waits in the form with its label');
  // A file the app does not take gets a plain message.
  await p.locator('.add-station .attach input[type=file]').setInputFiles({ name: 'page.html', mimeType: 'text/html', buffer: Buffer.from('<p>hi</p>') });
  await p.waitForSelector('.add-station .up-error', { timeout: 5000 });
  ok(/cannot be added/.test(await p.textContent('.add-station .up-error')), 'refused type shows a plain error');
  await p.screenshot({ path: SH + 'up-form.png' });
  await p.click('.add-station button.primary:has-text("Add to my map")');
  await p.waitForSelector('.station-panel.open h2'); await p.waitForTimeout(400);
  ok(/Upload check/.test(await p.textContent('.station-panel.open h2')), 'new station opens in the panel');

  const imgSrc = await p.getAttribute('.station-panel.open .ev-image img', 'src');
  if (server) {
    ok(/^api\/files\/[a-f0-9]{32}\.jpg$/.test(imgSrc), 'photo stored by address, relative to the page: ' + imgSrc);
    ok(fs.existsSync(path.join(DATA, 'uploads', path.basename(imgSrc))), 'photo file is in DATA_DIR/uploads');
  } else ok(/^data:image\/jpeg;base64,/.test(imgSrc || ''), 'photo falls back to a data URL');
  ok(photoUrl === imgSrc, 'the station keeps the photo from the form');
  const dims = await p.evaluate(() => new Promise((r) => { const i = document.querySelector('.station-panel.open .ev-image img'); const f = () => r([i.naturalWidth, i.naturalHeight]); i.complete && i.naturalWidth ? f() : (i.onload = f); }));
  ok(Math.max(...dims) <= (server ? 2000 : 1200) && Math.max(...dims) > 500, `big photo scaled down in the browser: ${dims.join(' × ')}`);
  if (server) { const r = await p.request.get(BASE + '/' + imgSrc); ok(r.ok() && r.headers()['content-type'] === 'image/jpeg', 'photo served as image/jpeg'); }

  // The PDF opens in the viewer.
  await p.click('.station-panel.open .ev-row:has-text("Hackathon write-up")');
  await p.waitForSelector('.ev-view .fv-frame');
  const frame = await p.getAttribute('.ev-view .fv-frame', 'src');
  if (server) {
    ok(/^api\/files\/[a-f0-9]{32}\.pdf$/.test(frame), 'PDF embedded from the server: ' + frame);
    ok(fs.existsSync(path.join(DATA, 'uploads', path.basename(frame))), 'PDF file is in DATA_DIR/uploads');
    const r = await p.request.get(BASE + '/' + frame);
    ok(r.ok() && r.headers()['content-type'] === 'application/pdf' && /^inline/.test(r.headers()['content-disposition']), 'PDF served inline as application/pdf');
    ok((await r.body()).slice(0, 5).toString() === '%PDF-', 'PDF bytes come back intact');
  } else ok(/^blob:/.test(frame || ''), 'PDF from a data URL opens through a blob URL');
  ok(await p.locator('.ev-view .fv-open').count() === 1, 'PDF has an open link too');
  await p.screenshot({ path: SH + 'up-pdf.png' });
  await p.click('.ev-view .panel-close');

  // A recording added afterwards plays in the panel.
  await p.locator('.station-panel.open .st-btns input[type=file]').setInputFiles({ name: 'Pitch practice.wav', mimeType: 'audio/wav', buffer: wav() });
  await p.waitForSelector('.station-panel.open .file-row audio', { timeout: 15000 });
  const aud = await p.getAttribute('.station-panel.open .file-row audio', 'src');
  ok(server ? /^api\/files\/[a-f0-9]{32}\.wav$/.test(aud) : /^data:audio\/wav/.test(aud || ''), 'recording attached and playable: ' + (aud || '').slice(0, 40));
  if (server) {
    const r = await p.request.get(BASE + '/' + aud, { headers: { range: 'bytes=0-99' } });
    ok(r.status() === 206 && /^bytes 0-99\//.test(r.headers()['content-range']), 'audio supports Range requests');
  }
  await p.screenshot({ path: SH + 'up-panel.png' });

  ok(!errs.length, 'no page errors ' + errs.join('; '));
  await b.close();
})();
