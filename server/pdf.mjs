// A minimal PDF writer for text documents (the leaver archive): A4, headings, paragraphs, a coloured bar for a line, a
// footer with page numbers. No dependencies. pdf({ title, footer, blocks }) → Buffer.
// blocks: [{ t: 'h1' | 'h2' | 'h3' | 'p' | 'small' | 'quote', text, colour? ('#rrggbb', h2 only) }].
// Text is set in Sarabun (server/fonts, SIL Open Font License, OFL.txt), Thai and English alike, embedded as a subset of
// the glyphs used; Thai is shaped by the font's own rules (server/ttf.mjs) and broken into lines between words
// (Intl.Segmenter). Letters Sarabun lacks (Chinese, emoji) show as "[?]"; lost(blocks) says whether that happens.
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { loadFont, shape, subset } from './ttf.mjs';

const W = 595.28, H = 841.89, MX = 56, TOP = 64, BOTTOM = 64;
const NAVY = [0, 0.157, 0.333], GREY = [0.337, 0.384, 0.478], INK = [0.1, 0.12, 0.16];
const STYLE = {
  h1: { size: 22, bold: true, colour: NAVY, before: 0, after: 6 },
  h2: { size: 14, bold: true, colour: NAVY, before: 18, after: 4 },
  h3: { size: 11.5, bold: true, colour: INK, before: 10, after: 1 },
  p: { size: 10.5, colour: INK, before: 3, after: 0 },
  quote: { size: 10.5, colour: INK, before: 3, after: 0, indent: 14 },
  small: { size: 8.5, colour: GREY, before: 2, after: 0 },
};
let FONTS = null;
const fonts = () => FONTS || (FONTS = {
  F1: loadFont(new URL('./fonts/Sarabun-Regular.ttf', import.meta.url)),
  F2: loadFont(new URL('./fonts/Sarabun-SemiBold.ttf', import.meta.url)),
});
const SKIP = /[\t​-‍️]/; // tabs (made spaces), zero-width joiners, the emoji variation selector
const known = (ch) => fonts().F1.cmap.has(ch.codePointAt(0));
// The text as it will be drawn: letters the font lacks as "[?]" (a run of them once).
const clean = (s) => String(s ?? '').normalize('NFC').replace(/\t/g, ' ').replace(/[​-‍️]/g, '').replace(/[^\n]+/g, (line) => {
  let out = '', bad = false;
  for (const ch of line) { if (known(ch)) { out += ch; bad = false; } else if (!/\p{M}/u.test(ch)) { if (!bad) out += '[?]'; bad = true; } }
  return out;
});
export const lost = (blocks) => blocks.some((b) => [...String(b.text ?? '').normalize('NFC')].some((ch) => ch !== '\n' && !SKIP.test(ch) && !known(ch) && !/\p{M}/u.test(ch)));
const width = (s, size, bold) => { const f = fonts()[bold ? 'F2' : 'F1']; return (shape(f, s).width * size) / f.upem; };
const rgb = (c) => c.map((x) => x.toFixed(3)).join(' ');
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null; };
const utf16 = (s) => { const b = Buffer.from(s, 'utf16le'); b.swap16(); return b.toString('hex').toUpperCase(); };

// Where a line may break: at spaces, and between two words when either is Thai (Thai has no spaces between words).
const WORDS = new Intl.Segmenter('th', { granularity: 'word' }), GRAPHEMES = new Intl.Segmenter('th', { granularity: 'grapheme' });
const THAI = /[฀-๿]/;
function units(para) {
  const out = [];
  let prev = null;
  for (const s of WORDS.segment(para)) {
    const space = /^\s+$/.test(s.segment);
    if (space) out.push({ space: true });
    else if (prev && !prev.space && !(prev.word && s.isWordLike && (THAI.test(prev.text) || THAI.test(s.segment)))) out[out.length - 1].text += s.segment;
    else out.push({ text: s.segment });
    prev = space ? { space: true } : { text: s.segment, word: s.isWordLike };
  }
  return out;
}
function wrap(text, size, bold, max) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '', gap = false;
    for (const u of units(para)) {
      if (u.space) { gap = !!line; continue; }
      let word = u.text;
      if (width(word, size, bold) > max) { // a word longer than the line: break it between letters
        if (line) { lines.push(line); line = ''; }
        let part = '';
        for (const { segment } of GRAPHEMES.segment(word)) {
          if (part && width(part + segment, size, bold) > max) { lines.push(part); part = ''; }
          part += segment;
        }
        word = part; gap = false;
      }
      const next = line ? `${line}${gap ? ' ' : ''}${word}` : word;
      if (line && width(next, size, bold) > max) { lines.push(line); line = word; } else line = next;
      gap = false;
    }
    lines.push(line);
  }
  return lines;
}

export function pdf({ title = '', footer = '', blocks = [] }) {
  const F = fonts(), used = { F1: new Map(), F2: new Map() };
  // One line of text: runs of glyphs set by the PDF's own advance widths, and a fresh position wherever a mark is moved.
  const text = (key, size, colour, x, y, s) => {
    const f = F[key], k = size / f.upem, seen = used[key];
    let out = `BT /${key} ${size} Tf ${rgb(colour)} rg`, run = '', expect = null;
    for (const g of shape(f, s)) {
      if (!seen.has(g.g) || (!seen.get(g.g) && g.u)) seen.set(g.g, g.u);
      const gx = x + g.x * k, gy = y + g.y * k;
      if (g.at || expect === null || Math.abs(expect - gx) > 0.005) {
        if (run) out += ` <${run}> Tj`;
        run = ''; out += ` 1 0 0 1 ${gx.toFixed(2)} ${gy.toFixed(2)} Tm`;
      }
      run += g.g.toString(16).padStart(4, '0');
      expect = g.at ? null : gx + f.adv[g.g] * k;
    }
    return `${out}${run ? ` <${run}> Tj` : ''} ET`;
  };
  const pages = [];
  let ops = null, y = 0;
  const page = () => { ops = []; pages.push(ops); y = H - TOP; };
  page();
  blocks.forEach((b, i) => {
    const st = STYLE[b.t] || STYLE.p, lead = st.size * 1.45, indent = st.indent || 0, key = st.bold ? 'F2' : 'F1';
    const lines = wrap(clean(b.text), st.size, st.bold, W - 2 * MX - indent - (b.t === 'h2' && b.colour ? 12 : 0));
    // A heading keeps two lines of what follows with it.
    const need = (b.t.startsWith('h') ? lines.length + 2 : Math.min(lines.length, 2)) * lead;
    if (y !== H - TOP) y -= st.before;
    if (y - need < BOTTOM && y !== H - TOP) page();
    if (b.t === 'h2' && b.colour && hex(b.colour)) ops.push(`${rgb(hex(b.colour))} rg ${MX} ${(y - lead * lines.length + st.size * 0.25).toFixed(2)} 5 ${(lead * lines.length).toFixed(2)} re f`);
    for (const line of lines) {
      if (y - lead < BOTTOM) page();
      y -= lead;
      if (b.t === 'quote') ops.push(`${rgb(GREY)} rg ${MX} ${(y - st.size * 0.3).toFixed(2)} 1.5 ${lead.toFixed(2)} re f`);
      if (line) ops.push(text(key, st.size, st.colour, MX + indent + (b.t === 'h2' && b.colour ? 12 : 0), y, line));
    }
    y -= st.after;
    if (b.t === 'h1' && i === 0) { ops.push(`${rgb(NAVY)} rg ${MX} ${(y - 4).toFixed(2)} ${(W - 2 * MX).toFixed(2)} 2 re f`); y -= 12; }
  });
  const n = pages.length, foot = clean(footer).replace(/\n/g, ' ');
  pages.forEach((p, i) => {
    const right = `Page ${i + 1} of ${n}`;
    p.push(text('F1', 7.5, GREY, MX, 36, foot), text('F1', 7.5, GREY, W - MX - width(right, 7.5), 36, right));
  });

  const objs = [];
  const add = (s) => (objs.push(s), objs.length);
  const stream = (dict, data, deflate) => {
    const body = deflate ? zlib.deflateSync(data) : Buffer.from(data, 'latin1');
    return add([`<< ${dict} /Length ${body.length}${deflate ? ' /Filter /FlateDecode' : ''} >>\nstream\n`, body, '\nendstream']);
  };
  const catalog = add(''), tree = add('');
  const fontObj = (key) => {
    const f = F[key], gids = [...used[key].keys()].sort((a, b) => a - b), k = 1000 / f.upem;
    const tag = [...createHash('sha1').update(gids.join(',')).digest().subarray(0, 6)].map((x) => String.fromCharCode(65 + (x % 26))).join('');
    const name = `${tag}+Sarabun-${key === 'F2' ? 'SemiBold' : 'Regular'}`;
    const font = subset(f, gids);
    const file = stream(`/Length1 ${font.length}`, font, true);
    const head = f.tables.head.off, os2 = f.tables['OS/2'].off, b = f.b;
    const bbox = [36, 38, 40, 42].map((o) => Math.round(b.readInt16BE(head + o) * k)).join(' ');
    const desc = add(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${bbox}] /ItalicAngle 0 /Ascent ${Math.round(b.readInt16BE(os2 + 68) * k)} /Descent ${Math.round(b.readInt16BE(os2 + 70) * k)} /CapHeight ${Math.round(b.readInt16BE(os2 + 88) * k)} /StemV ${key === 'F2' ? 120 : 80} /FontFile2 ${file} 0 R >>`);
    const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 0 /W [${gids.map((g) => `${g} [${Math.round(f.adv[g] * k)}]`).join(' ')}] /CIDToGIDMap /Identity >>`);
    // Copying text out: each glyph as its letter (the font's own map first, else what shaping made it from).
    if (!f.rev) { f.rev = new Map(); for (const [c, g] of f.cmap) if (!f.rev.has(g)) f.rev.set(g, String.fromCodePoint(c)); }
    const map = gids.map((g) => [g, f.rev.get(g) ?? used[key].get(g)]).filter(([, u]) => u);
    const chunks = [];
    for (let i = 0; i < map.length; i += 100) chunks.push(`${map.slice(i, i + 100).length} beginbfchar\n${map.slice(i, i + 100).map(([g, u]) => `<${g.toString(16).padStart(4, '0')}> <${utf16(u)}>`).join('\n')}\nendbfchar`);
    const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
    const tu = stream('', cmap, true);
    return add(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
  };
  const f1 = fontObj('F1'), f2 = fontObj('F2');
  const info = add(`<< /Title <FEFF${utf16(clean(title))}> /Producer (NIST Transit Portfolio) /CreationDate (D:${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}Z) >>`);
  const kids = pages.map((p) => {
    const content = stream('', p.join('\n'), false);
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objs[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`;
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let size = parts[0].length;
  const push = (x) => { const b = Buffer.isBuffer(x) ? x : Buffer.from(x, 'latin1'); parts.push(b); size += b.length; };
  const at = objs.map((o, i) => { const off = size; push(`${i + 1} 0 obj\n`); (Array.isArray(o) ? o : [o]).forEach(push); push('\nendobj\n'); return off; });
  const xref = size;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}

// The text of a PDF this writer made, a line per line drawn (each font's ToUnicode map applied to the glyph ids it draws;
// Thai as NFKC, so ำ reads back as ํา). For tests and checks.
export function pdfText(buf) {
  const s = buf.toString('latin1'), objs = {};
  for (const m of s.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) objs[m[1]] = m[2];
  const body = (n) => { const m = /^(<<[\s\S]*?>>)\nstream\n([\s\S]*)\nendstream$/.exec(objs[n]); const d = Buffer.from(m[2], 'latin1'); return (/FlateDecode/.test(m[1]) ? zlib.inflateSync(d) : d).toString('latin1'); };
  const maps = {}, lines = [];
  for (const page of Object.values(objs).filter((o) => /\/Type \/Page\b/.test(o))) {
    for (const [, key, ref] of page.matchAll(/\/(F\d) (\d+) 0 R/g)) {
      maps[key] ||= Object.fromEntries([...body(/\/ToUnicode (\d+) 0 R/.exec(objs[ref])[1]).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/gi)].map(([, g, u]) => [parseInt(g, 16), Buffer.from(u, 'hex').swap16().toString('utf16le')]));
    }
    for (const bt of body(/\/Contents (\d+) 0 R/.exec(page)[1]).match(/BT[\s\S]*?ET/g) || []) {
      const map = maps[/\/(F\d) /.exec(bt)[1]];
      lines.push([...bt.matchAll(/<([0-9a-f]+)> Tj/g)].map(([, h]) => h.match(/.{4}/g).map((g) => map[parseInt(g, 16)] ?? '').join('')).join(''));
    }
  }
  return lines.join('\n').normalize('NFKC');
}
