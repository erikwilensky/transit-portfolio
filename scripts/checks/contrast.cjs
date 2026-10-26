const { chromium } = require('playwright');
const mode = process.argv[2] || 'dark';
const NAV = {
  maya: ['map','studio','shared','inbox','links','activity','privacy','poster'], lena: ['map','studio','inbox','links','privacy'], pim: ['map','family'],
  whitfield: ['advisory','student/st-01','signals'], nair: ['queue','crosslinks','depot'], adeyemi: ['applications','letter','activities','search'],
  brandt: ['cas','schoolline','core','governance'], principal: ['dashboard','schoolmetro','profile','pdpa','rollout','pilot','audit','scan'],
  parent: ['family','consent','digest'], reader: ['reader'], 'maya-alum': ['journey','poster'],
};
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: mode })).newPage();
  await p.goto('http://localhost:4173/#/reset'); await p.waitForTimeout(800);
  const routes = Object.entries(NAV).flatMap(([who, ss]) => ss.map((s) => `${who}/${s}`)).concat(['s/tp-g3n2', 'v/NIST-000000', 'v', 'p/st-09']);
  const bad = {};
  for (const r of routes) {
    await p.goto('http://localhost:4173/#/' + r); await p.waitForTimeout(900);
    const res = await p.evaluate(() => {
      const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && (c[3] ?? 1) > .9) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const t = walker.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (seen.has(el)) continue; seen.add(el);
        if (el.closest('svg, .poster-sheet, .cv-page, .pres, .ev-doc, [class*="ev-"]')) continue;
        const rc = el.getBoundingClientRect(); if (!rc.width || rc.bottom < 0 || rc.top > 3000) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < .6) continue;
        const fg = parse(cs.color); if ((fg[3] ?? 1) < .9) continue; const bg = bgOf(el); if (!bg) continue;
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        const big = parseFloat(cs.fontSize) >= 18.6 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
        if (ratio < (big ? 3 : 4.5) && !el.closest('button:disabled')) out.push(`${ratio.toFixed(2)} ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${t.textContent.trim().slice(0, 30)}" ${cs.color} on rgb(${bg.slice(0,3)})`);
      }
      return out;
    });
    if (res.length) bad[r] = res;
  }
  for (const [r, l] of Object.entries(bad)) { console.log('##', r); [...new Set(l)].slice(0, 12).forEach((x) => console.log('  ', x)); }
  await b.close();
})();
