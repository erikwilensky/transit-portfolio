// Draws the illustrated evidence images in public/evidence (flat SVG scenes,
// no photos, no real people). Run with: node scripts/illustrations.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../public/evidence/', import.meta.url);
mkdirSync(dir, { recursive: true });

const W = 640, H = 420;
const svg = (body, bg = '#e8eef4') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>\n`;
const person = (x, y, s = 1, shirt = '#1E6FD9', skin = '#c68e64') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="0" width="32" height="46" rx="14" fill="${shirt}"/><circle cx="0" cy="-14" r="13" fill="${skin}"/><rect x="-14" y="44" width="11" height="34" rx="5" fill="#2b3240"/><rect x="3" y="44" width="11" height="34" rx="5" fill="#2b3240"/></g>`;
const sun = (x, y, r = 34) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f6c14b"/>`;
const cloud = (x, y) => `<g fill="#fff" opacity=".9"><ellipse cx="${x}" cy="${y}" rx="46" ry="18"/><ellipse cx="${x + 30}" cy="${y - 10}" rx="30" ry="18"/><ellipse cx="${x - 26}" cy="${y - 6}" rx="24" ry="14"/></g>`;
const bars = (x, y, w, h, vals, col) => vals.map((v, i) => `<rect x="${x + i * (w / vals.length) + 4}" y="${y + h - v * h}" width="${w / vals.length - 8}" height="${v * h}" rx="3" fill="${col}"/>`).join('');
const line = (x, y, w, h, vals, col, sw = 4) => `<polyline fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" points="${vals.map((v, i) => `${x + (i * w) / (vals.length - 1)},${y + h - v * h}`).join(' ')}"/>`;
const screen = (x, y, w, h, inner) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#1b1f27"/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="6" fill="#f8fafc"/>${inner}`;

const scenes = {
  // ── Maya ──
  'aq-sensor': svg(`${sun(540, 80)}${cloud(150, 90)}${cloud(400, 60)}
    <rect y="300" width="${W}" height="120" fill="#9aa5b1"/><rect y="290" width="${W}" height="14" fill="#7b8794"/>
    <rect x="300" y="170" width="8" height="125" fill="#52606d"/>
    <rect x="250" y="180" width="110" height="80" rx="10" fill="#f8fafc" stroke="#1E6FD9" stroke-width="5"/>
    <g fill="#1E6FD9">${[0, 1, 2, 3].map((i) => `<rect x="${264 + i * 22}" y="196" width="12" height="4" rx="2"/><rect x="${264 + i * 22}" y="206" width="12" height="4" rx="2"/>`).join('')}</g>
    <circle cx="305" cy="238" r="9" fill="#2E9E4F"/><rect x="330" y="150" width="4" height="32" fill="#52606d"/><circle cx="332" cy="146" r="6" fill="#E2343C"/>
    <path d="M120 140 q20 -10 40 0 t40 0" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>`, '#bfe0f5'),
  'aq-dashboard': svg(`${screen(70, 50, 500, 320, `
    <text x="100" y="98" font-family="Helvetica,Arial" font-size="20" font-weight="700" fill="#1b1f27">Campus air quality · PM2.5</text>
    ${line(100, 120, 440, 150, [.3, .32, .28, .35, .7, .9, .62, .4, .33, .3, .36, .31], '#1E6FD9')}
    <line x1="100" x2="540" y1="200" y2="200" stroke="#E2343C" stroke-dasharray="6 6" stroke-width="2"/>
    <text x="470" y="194" font-family="Helvetica,Arial" font-size="12" fill="#E2343C">WHO limit</text>
    ${[['Canteen', '#E2343C'], ['Library', '#2E9E4F'], ['Gym', '#2E9E4F']].map(([t, c], i) => `<rect x="${100 + i * 150}" y="300" width="130" height="44" rx="8" fill="#eef2f7"/><circle cx="${118 + i * 150}" cy="322" r="7" fill="${c}"/><text x="${132 + i * 150}" y="327" font-family="Helvetica,Arial" font-size="15" fill="#1b1f27">${t}</text>`).join('')}`)}`, '#dfe7f0'),
  'beach-cleanup': svg(`${sun(90, 70, 30)}<rect y="230" width="${W}" height="190" fill="#f1d9a7"/><path d="M0 230 q80 -18 160 0 t160 0 t160 0 t160 0 v-40 h-640z" fill="#5fb3d9"/>
    <rect y="150" width="${W}" height="45" fill="#5fb3d9"/>
    ${person(200, 270, 1, '#E2343C')}${person(300, 262, 1.05, '#2E9E4F', '#8d5a3b')}${person(420, 274, .95, '#F2A100', '#e0b48c')}
    <rect x="460" y="330" width="70" height="56" rx="6" fill="#2b3240"/><rect x="470" y="322" width="50" height="10" rx="4" fill="#52606d"/>
    <g fill="#1E6FD9"><rect x="120" y="360" width="18" height="10" rx="3" transform="rotate(20 129 365)"/><circle cx="560" cy="370" r="7"/><rect x="250" y="380" width="22" height="8" rx="3"/></g>
    <rect x="320" y="300" width="60" height="44" rx="4" fill="#fff" stroke="#2b3240" stroke-width="3"/><g stroke="#2b3240" stroke-width="2">${[0, 1, 2, 3].map((i) => `<line x1="328" x2="372" y1="${312 + i * 8}" y2="${312 + i * 8}"/>`).join('')}</g>`, '#cfe8f7'),
  'compost-bin': svg(`<rect y="300" width="${W}" height="120" fill="#7cb46b"/>
    <rect x="230" y="160" width="180" height="150" rx="10" fill="#2E9E4F"/><rect x="220" y="145" width="200" height="26" rx="8" fill="#22803e"/>
    <path d="M300 220 l20 -26 l20 26 h-12 v26 h-16 v-26z" fill="#fff"/><text x="320" y="285" text-anchor="middle" font-family="Helvetica,Arial" font-size="20" font-weight="700" fill="#fff">COMPOST</text>
    ${[[120, 320, '#F2A100'], [480, 330, '#E2343C'], [160, 360, '#8A5A44'], [520, 370, '#F2A100']].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="20" ry="12" fill="${c}"/>`).join('')}`, '#e6f2dc'),
  'sci-fair-poster': svg(`<rect x="110" y="40" width="420" height="320" rx="6" fill="#fff" stroke="#6B3FB0" stroke-width="6"/>
    <text x="320" y="88" text-anchor="middle" font-family="Helvetica,Arial" font-size="26" font-weight="700" fill="#6B3FB0">Microplastics in Bangkok canals</text>
    ${bars(140, 120, 200, 140, [.4, .85, .6], '#6B3FB0')}<g font-family="Helvetica,Arial" font-size="13" fill="#52606d"><text x="160" y="280">Canal A</text><text x="225" y="280">Canal B</text><text x="290" y="280">Canal C</text></g>
    <circle cx="430" cy="180" r="56" fill="#eef2f7" stroke="#52606d" stroke-width="4"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M${400 + i * 12} ${160 + (i % 2) * 20} q10 10 20 0" stroke="#1E6FD9" stroke-width="3" fill="none"/>`).join('')}
    <rect x="370" y="300" width="130" height="36" rx="18" fill="#c0c7d1"/><text x="435" y="324" text-anchor="middle" font-family="Helvetica,Arial" font-size="16" font-weight="700" fill="#fff">SILVER</text>
    <rect x="290" y="360" width="60" height="50" fill="#8A5A44"/>`, '#efe9f7'),
  'mangroves': svg(`<rect y="250" width="${W}" height="170" fill="#4f9fbf"/>${sun(520, 80)}
    ${[120, 260, 400, 540].map((x, i) => `<g><path d="M${x} 300 v-90" stroke="#6b4f3a" stroke-width="10"/><path d="M${x} 300 l-30 40 M${x} 300 l30 40 M${x} 300 l0 45" stroke="#6b4f3a" stroke-width="6"/><circle cx="${x}" cy="${190 - (i % 2) * 10}" r="${44 + (i % 2) * 8}" fill="#2E9E4F"/><circle cx="${x - 30}" cy="215" r="28" fill="#3cb15e"/><circle cx="${x + 30}" cy="212" r="26" fill="#27894a"/></g>`).join('')}
    <g fill="#F2A100">${[180, 330, 470].map((x) => `<rect x="${x}" y="320" width="8" height="28" rx="2"/><rect x="${x - 6}" y="314" width="20" height="10" rx="3"/>`).join('')}</g>`, '#d6eef7'),
  'stem-club': svg(`<rect x="60" y="40" width="520" height="220" rx="8" fill="#fff" stroke="#9aa5b1" stroke-width="6"/>
    <g stroke="#1E6FD9" stroke-width="5" fill="none"><circle cx="160" cy="130" r="40"/><path d="M220 170 l60 -80 l60 80 z"/></g><text x="380" y="120" font-family="Helvetica,Arial" font-size="28" fill="#E2343C">if (sensor &gt; 30)</text><text x="400" y="160" font-family="Helvetica,Arial" font-size="28" fill="#2E9E4F">light.on()</text>
    ${person(170, 300, .9, '#E0458B', '#8d5a3b')}${person(270, 306, .85, '#F2A100')}${person(370, 300, .9, '#00A39E', '#e0b48c')}${person(470, 296, 1.05, '#6B3FB0')}
    <rect x="120" y="360" width="400" height="20" rx="6" fill="#8A5A44"/>`, '#f3efe6'),
  'hackathon': svg(`<rect y="300" width="${W}" height="120" fill="#3a3f4b"/>${[110, 270, 430].map((x, i) => `<rect x="${x}" y="200" width="120" height="80" rx="6" fill="#1b1f27"/><rect x="${x + 6}" y="206" width="108" height="66" rx="3" fill="${['#1E6FD9', '#2E9E4F', '#6B3FB0'][i]}"/><rect x="${x - 10}" y="280" width="140" height="10" rx="4" fill="#9aa5b1"/>`).join('')}
    <rect x="200" y="50" width="240" height="70" rx="12" fill="#F2A100"/><text x="320" y="96" text-anchor="middle" font-family="Helvetica,Arial" font-size="30" font-weight="800" fill="#1b1f27">2nd PLACE</text>
    <path d="M140 170 q30 -40 60 0" stroke="#fff" stroke-width="3" fill="none" opacity=".4"/>`, '#262b35'),
  // ── Arun ──
  'piano-stage': svg(`<rect y="300" width="${W}" height="120" fill="#5b3a29"/><path d="M220 0 L120 300 H520 L420 0z" fill="#fff6d6" opacity=".35"/>
    <path d="M190 300 v-90 q0 -30 30 -30 h170 q60 0 80 60 l10 60z" fill="#111"/><rect x="200" y="300" width="10" height="50" fill="#111"/><rect x="450" y="300" width="10" height="50" fill="#111"/>
    <g>${Array.from({ length: 14 }, (_, i) => `<rect x="${215 + i * 12}" y="232" width="11" height="26" fill="#fff"/>`).join('')}${[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => `<rect x="${223 + i * 12}" y="232" width="7" height="16" fill="#111"/>`).join('')}</g>
    ${person(160, 222, 1.05, '#E0458B', '#a86b45')}<rect x="130" y="300" width="60" height="12" rx="4" fill="#333"/>`, '#2a1f3d'),
  'phone-stands': svg(`<rect y="290" width="${W}" height="130" fill="#d4d9e0"/>${['#c0c7d1', '#9aa5b1', '#00A39E', '#007f7a'].map((c, i) => `<g transform="translate(${100 + i * 125} 0)"><path d="M0 290 h80 l-14 -40 h-24 l-20 -90 h-14 l14 90z" fill="${c}"/><text x="40" y="330" text-anchor="middle" font-family="Helvetica,Arial" font-size="16" fill="#52606d">v${i + 1}</text></g>`).join('')}
    <rect x="480" y="150" width="54" height="96" rx="8" fill="#1b1f27" transform="rotate(-14 507 198)"/>`, '#eef1f4'),
  'rainfall-game': svg(`${screen(60, 40, 520, 330, `<rect x="70" y="50" width="500" height="310" fill="#29435c"/>
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${80 + (i * 47) % 480}" y1="${60 + (i * 31) % 240}" x2="${74 + (i * 47) % 480}" y2="${76 + (i * 31) % 240}" stroke="#9fd3f5" stroke-width="2"/>`).join('')}
    <rect x="70" y="300" width="500" height="60" fill="#2E9E4F"/><rect x="300" y="260" width="26" height="40" rx="6" fill="#F2A100"/><circle cx="313" cy="252" r="10" fill="#e0b48c"/>
    <rect x="90" y="70" width="160" height="42" rx="8" fill="#1b1f27" opacity=".7"/>${line(98, 76, 144, 30, [.2, .5, .9, .4, .7, .3, .8, .5], '#E0458B', 3)}
    <text x="500" y="92" font-family="Helvetica,Arial" font-size="16" fill="#fff">♪ storm</text>`)}`, '#dfe7f0'),
  'arcade': svg(`<rect y="330" width="${W}" height="90" fill="#3a3f4b"/><path d="M240 330 v-250 q0 -20 20 -20 h120 q20 0 20 20 v250z" fill="#00A39E"/><rect x="250" y="70" width="140" height="30" rx="4" fill="#1b1f27"/><text x="320" y="92" text-anchor="middle" font-family="Helvetica,Arial" font-size="16" font-weight="800" fill="#F2A100">STUDENT ARCADE</text>
    <rect x="258" y="112" width="124" height="96" rx="6" fill="#1b1f27"/><rect x="266" y="120" width="108" height="80" fill="#6B3FB0"/><circle cx="300" cy="170" r="10" fill="#F2A100"/><rect x="330" y="150" width="30" height="8" fill="#2E9E4F"/>
    <path d="M240 220 h160 l20 40 h-200z" fill="#007f7a"/><circle cx="280" cy="238" r="8" fill="#E2343C"/><circle cx="340" cy="236" r="7" fill="#1E6FD9"/><circle cx="362" cy="242" r="7" fill="#F2A100"/>`, '#1f2430'),
  'pcb': svg(`<rect x="110" y="70" width="420" height="280" rx="14" fill="#1f7a4d"/>${Array.from({ length: 16 }, (_, i) => `<rect x="${150 + (i % 4) * 70}" y="${100 + Math.floor(i / 4) * 58}" width="50" height="44" rx="6" fill="#e9ecef" stroke="#0f4f31" stroke-width="3"/>`).join('')}
    <g stroke="#f3c05a" stroke-width="3" fill="none"><path d="M440 110 h50 v200"/><path d="M440 160 h30 v150"/><path d="M440 220 h20 v90"/></g><rect x="460" y="300" width="50" height="30" rx="4" fill="#111"/>`, '#e8eef4'),
  // ── Lena ──
  'sketchbook': svg(`<rect x="90" y="60" width="460" height="300" rx="10" fill="#fdfbf5" stroke="#8A5A44" stroke-width="5"/><line x1="320" y1="60" x2="320" y2="360" stroke="#d6cfc2" stroke-width="3"/>
    <g fill="none" stroke="#3a3f4b" stroke-width="3"><circle cx="200" cy="170" r="50"/><path d="M175 160 q8 -6 14 0 M212 160 q8 -6 14 0 M180 195 q22 16 42 0"/><path d="M380 260 l40 -80 l40 80 z M360 270 h130"/><path d="M370 140 q30 -40 60 0 t60 0"/></g>
    <text x="205" y="320" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#8A5A44">day 61</text><text x="430" y="320" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#8A5A44">day 62</text>`, '#efe7da'),
  'bowl': svg(`<ellipse cx="320" cy="330" rx="200" ry="30" fill="#c9b8a6"/><path d="M190 200 q0 120 130 130 q130 -10 130 -130z" fill="#a8775b"/><ellipse cx="320" cy="200" rx="130" ry="26" fill="#7d5640"/><ellipse cx="320" cy="200" rx="112" ry="18" fill="#5e3f2e"/>
    <path d="M210 250 q110 30 220 0" stroke="#c99a7a" stroke-width="5" fill="none"/>`, '#eadfd3'),
  'mural': svg(`<rect y="340" width="${W}" height="80" fill="#9aa5b1"/><rect x="40" y="50" width="560" height="290" fill="#fff6e0"/>
    <circle cx="140" cy="130" r="50" fill="#F2A100"/><path d="M40 300 q140 -120 280 -20 t280 -30 v90 h-560z" fill="#2E9E4F"/><path d="M40 330 q160 -60 300 -10 t260 0 v20 h-560z" fill="#1E6FD9"/>
    ${[[260, 150, '#E2343C'], [330, 170, '#E0458B'], [400, 140, '#6B3FB0'], [470, 165, '#00A39E']].map(([x, y, c]) => `<path d="M${x} ${y} q-30 -40 0 -60 q30 20 0 60z" fill="${c}"/>`).join('')}
    ${person(520, 300, .7, '#E2343C', '#e0b48c')}<rect x="545" y="250" width="6" height="50" fill="#8A5A44" transform="rotate(30 548 275)"/>`, '#dfe4ea'),
  'welcome-pack': svg(`<g transform="rotate(-6 320 210)"><rect x="170" y="70" width="300" height="280" rx="8" fill="#fff" stroke="#F06A1D" stroke-width="5"/>
    <rect x="170" y="70" width="300" height="70" rx="8" fill="#F06A1D"/><text x="320" y="115" text-anchor="middle" font-family="Helvetica,Arial" font-size="26" font-weight="800" fill="#fff">Willkommen!</text>
    <g fill="#c0c7d1">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="200" y="${165 + i * 26}" width="${220 - (i % 3) * 40}" height="10" rx="5"/>`).join('')}</g>
    <circle cx="420" cy="300" r="26" fill="#E2343C"/><path d="M408 300 l9 9 l16 -18" stroke="#fff" stroke-width="5" fill="none"/></g>`, '#fbeee4'),
};

for (const [name, content] of Object.entries(scenes)) writeFileSync(new URL(`${name}.svg`, dir), content);
console.log(Object.keys(scenes).length, 'illustrations');
