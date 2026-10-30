// A minimal PDF writer for text documents (the leaver archive): A4, Helvetica, headings, paragraphs, a coloured bar for
// a line, a footer with page numbers. No dependencies. pdf({ title, footer, blocks }) → Buffer.
// blocks: [{ t: 'h1' | 'h2' | 'h3' | 'p' | 'small' | 'quote', text, colour? ('#rrggbb', h2 only) }].
// The standard fonts have Western letters only (WinAnsi). Anything else (Thai, for instance) shows as "[?]";
// lost(blocks) says whether that happens, so the caller can point to a copy that has every word.
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
// Helvetica widths (1/1000 em) for 32–126; other letters count as 556.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '•': 0x95, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '™': 0x99, 'Œ': 0x8c, 'œ': 0x9c, 'Š': 0x8a, 'š': 0x9a, 'Ž': 0x8e, 'ž': 0x9e, 'Ÿ': 0x9f };
const code = (ch) => { const c = ch.codePointAt(0); return c >= 32 && c < 127 ? c : c >= 0xa0 && c <= 0xff ? c : WIN[ch] ?? null; };
// Text in WinAnsi, unknown letters as "[?]" (a run of them once). Marks that combine with the letter before are dropped.
const winText = (s) => String(s ?? '').normalize('NFC').replace(/\t/g, ' ').replace(/[̀-ͯ​-‍️]/g, '').replace(/[^\n]+/g, (line) => {
  let out = '', bad = false;
  for (const ch of line) { const c = code(ch); if (c === null) { if (!bad) out += '[?]'; bad = true; } else { out += String.fromCharCode(c); bad = false; } }
  return out;
});
export const lost = (blocks) => blocks.some((b) => [...String(b.text ?? '')].some((ch) => ch !== '\n' && code(ch) === null && !/[̀-ͯ​-‍️\t]/.test(ch)));
const width = (s, size, bold) => { let w = 0; for (const ch of s) { const c = ch.charCodeAt(0); w += c >= 32 && c < 127 ? HELV[c - 32] : 556; } return (w * size * (bold ? 1.07 : 1)) / 1000; };
const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
const rgb = (c) => c.map((x) => x.toFixed(3)).join(' ');
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null; };

function wrap(text, size, bold, max) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (let word of para.split(/ +/)) {
      while (width(word, size, bold) > max) { // a word longer than the line: break it
        let i = word.length; while (i > 1 && width(word.slice(0, i), size, bold) > max) i--;
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, i)); word = word.slice(i);
      }
      const next = line ? `${line} ${word}` : word;
      if (width(next, size, bold) > max && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export function pdf({ title = '', footer = '', blocks = [] }) {
  const pages = [];
  let ops = null, y = 0;
  const page = () => { ops = []; pages.push(ops); y = H - TOP; };
  page();
  blocks.forEach((b, i) => {
    const st = STYLE[b.t] || STYLE.p, lead = st.size * 1.35, indent = st.indent || 0;
    const lines = wrap(winText(b.text), st.size, st.bold, W - 2 * MX - indent - (b.t === 'h2' && b.colour ? 12 : 0));
    // A heading keeps two lines of what follows with it.
    const need = (b.t.startsWith('h') ? lines.length + 2 : Math.min(lines.length, 2)) * lead;
    if (y !== H - TOP) y -= st.before;
    if (y - need < BOTTOM && y !== H - TOP) page();
    if (b.t === 'h2' && b.colour && hex(b.colour)) ops.push(`${rgb(hex(b.colour))} rg ${MX} ${(y - lead * lines.length + st.size * 0.25).toFixed(2)} 5 ${(lead * lines.length).toFixed(2)} re f`);
    for (const line of lines) {
      if (y - lead < BOTTOM) page();
      y -= lead;
      if (b.t === 'quote') ops.push(`${rgb(GREY)} rg ${MX} ${(y - st.size * 0.3).toFixed(2)} 1.5 ${lead.toFixed(2)} re f`);
      if (line) ops.push(`BT /${st.bold ? 'F2' : 'F1'} ${st.size} Tf ${rgb(st.colour)} rg ${(MX + indent + (b.t === 'h2' && b.colour ? 12 : 0)).toFixed(2)} ${y.toFixed(2)} Td (${esc(line)}) Tj ET`);
    }
    y -= st.after;
    if (b.t === 'h1' && i === 0) { ops.push(`${rgb(NAVY)} rg ${MX} ${(y - 4).toFixed(2)} ${(W - 2 * MX).toFixed(2)} 2 re f`); y -= 12; }
  });
  const n = pages.length, foot = winText(footer);
  const objs = [];
  const add = (s) => (objs.push(s), objs.length);
  const catalog = add(''), tree = add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info = add(`<< /Title (${esc(winText(title))}) /Producer (NIST Transit Portfolio) /CreationDate (D:${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}Z) >>`);
  const kids = pages.map((p, i) => {
    const right = `Page ${i + 1} of ${n}`;
    const s = [...p, `BT /F1 7.5 Tf ${rgb(GREY)} rg ${MX} 36 Td (${esc(foot)}) Tj ET`, `BT /F1 7.5 Tf ${rgb(GREY)} rg ${(W - MX - width(right, 7.5)).toFixed(2)} 36 Td (${right}) Tj ET`].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`);
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objs[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`;
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const at = objs.map((o, i) => { const off = Buffer.byteLength(out, 'latin1'); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return off; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
