// Draws the phone-app icons in public/icons/ from public/icons/icon.svg (run after changing the SVG, commit the PNGs):
//   node scripts/icons.cjs
// icon-*.png have rounded corners; maskable-*.png and apple-touch-icon.png fill the square (the phone rounds them).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const DIR = path.resolve(__dirname, '../public/icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const OUT = [['icon-192.png', 192, true], ['icon-512.png', 512, true], ['maskable-192.png', 192, false], ['maskable-512.png', 512, false], ['apple-touch-icon.png', 180, false]];
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  for (const [name, size, round] of OUT) {
    await page.setViewportSize({ width: size, height: size });
    const s = (round ? svg : svg.replace(/rx="\d+"/, 'rx="0"')).replace('width="512" height="512"', `width="${size}" height="${size}"`);
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${s}`);
    await page.screenshot({ path: path.join(DIR, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log('wrote', name);
  }
  await b.close();
})();
