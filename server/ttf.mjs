// TrueType for the PDF writer (server/pdf.mjs), no dependencies: read a font, shape a run of text (the font's own
// 'ccmp' substitutions and 'mark'/'mkmk' positioning, which is what Thai needs: ำ split, tone marks lifted over
// vowels, narrow marks beside ป ฝ ฟ, ญ ฐ without their tail over a vowel below) and write a subset for embedding
// (unused glyphs emptied, ids kept, so the PDF can use CIDToGIDMap /Identity).
import fs from 'node:fs';

export function loadFont(file) {
  const b = fs.readFileSync(file);
  const u16 = (o) => b.readUInt16BE(o), i16 = (o) => b.readInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0, n = u16(4); i < n; i++) { const o = 12 + i * 16; tables[b.toString('latin1', o, o + 4)] = { off: u32(o + 8), len: u32(o + 12) }; }
  const T = (t) => tables[t]?.off;
  const head = T('head'), upem = u16(head + 18), longLoca = i16(head + 50) === 1;
  const numGlyphs = u16(T('maxp') + 4), nH = u16(T('hhea') + 34), hmtx = T('hmtx');
  const adv = new Uint16Array(numGlyphs);
  for (let g = 0; g < numGlyphs; g++) adv[g] = u16(hmtx + Math.min(g, nH - 1) * 4);
  const loca = T('loca'), glyfAt = (g) => longLoca ? [u32(loca + g * 4), u32(loca + g * 4 + 4)] : [u16(loca + g * 2) * 2, u16(loca + g * 2 + 2) * 2];
  // cmap: Windows Unicode, full repertoire (format 12) or BMP (format 4).
  const cmap = new Map(), cm = T('cmap');
  const subs = Array.from({ length: u16(cm + 2) }, (_, i) => ({ p: u16(cm + 4 + i * 8), e: u16(cm + 6 + i * 8), o: cm + u32(cm + 8 + i * 8) }));
  const sub = subs.find((s) => s.p === 3 && s.e === 10 && u16(s.o) === 12) || subs.find((s) => s.p === 3 && s.e === 1 && u16(s.o) === 4);
  if (u16(sub.o) === 12) {
    for (let i = 0, n = u32(sub.o + 12); i < n; i++) { const o = sub.o + 16 + i * 12; for (let c = u32(o), g = u32(o + 8); c <= u32(o + 4); c++, g++) cmap.set(c, g); }
  } else {
    const seg = u16(sub.o + 6) / 2, ends = sub.o + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
    for (let i = 0; i < seg; i++) {
      const s = u16(starts + i * 2), e = u16(ends + i * 2), d = i16(deltas + i * 2), ro = u16(ranges + i * 2);
      for (let c = s; c <= e && c !== 0xffff; c++) {
        let g = ro ? u16(ranges + i * 2 + ro + (c - s) * 2) : c;
        if (g) g = (g + d) & 0xffff;
        if (g) cmap.set(c, g);
      }
    }
  }
  // OpenType layout helpers.
  const coverage = (o) => {
    const m = new Map();
    if (u16(o) === 1) for (let i = 0, n = u16(o + 2); i < n; i++) m.set(u16(o + 4 + i * 2), i);
    else for (let i = 0, n = u16(o + 2); i < n; i++) { const r = o + 4 + i * 6; for (let g = u16(r), k = u16(r + 4); g <= u16(r + 2); g++, k++) m.set(g, k); }
    return m;
  };
  const classDef = (o) => {
    const m = new Map();
    if (!o) return m;
    if (u16(o) === 1) for (let i = 0, s = u16(o + 2), n = u16(o + 4); i < n; i++) m.set(s + i, u16(o + 6 + i * 2));
    else for (let i = 0, n = u16(o + 2); i < n; i++) { const r = o + 4 + i * 6; for (let g = u16(r); g <= u16(r + 2); g++) m.set(g, u16(r + 4)); }
    return m;
  };
  const gdef = T('GDEF'), glyphClass = classDef(gdef && u16(gdef + 4) && gdef + u16(gdef + 4)), attachClass = classDef(gdef && u16(gdef + 10) && gdef + u16(gdef + 10));
  const anchor = (o) => [i16(o + 2), i16(o + 4)];
  // The lookups of the given features for a script (its default language), in lookup-list order.
  const layout = (tag, feats, script, ext) => {
    const t = T(tag);
    if (!t) return { order: [] };
    const sl = t + u16(t + 4), fl = t + u16(t + 6), ll = t + u16(t + 8);
    const scripts = Array.from({ length: u16(sl) }, (_, i) => [b.toString('latin1', sl + 2 + i * 6, sl + 6 + i * 6), sl + u16(sl + 6 + i * 6)]);
    const sc = (scripts.find(([s]) => s === script) || scripts.find(([s]) => s === 'DFLT') || [])[1];
    if (!sc || !u16(sc)) return { order: [] };
    const ls = sc + u16(sc), want = new Set();
    for (let i = 0, n = u16(ls + 4); i < n; i++) {
      const fi = u16(ls + 6 + i * 2), rec = fl + 2 + fi * 6;
      if (!feats.includes(b.toString('latin1', rec, rec + 4))) continue;
      const f = fl + u16(rec + 4);
      for (let j = 0, m = u16(f + 2); j < m; j++) want.add(u16(f + 4 + j * 2));
    }
    const lookup = (i) => {
      const l = ll + u16(ll + 2 + i * 2);
      let type = u16(l);
      const flag = u16(l + 2);
      const subtables = Array.from({ length: u16(l + 4) }, (_, j) => {
        let s = l + u16(l + 6 + j * 2);
        if (type === ext) { type = u16(s + 2); s += u32(s + 4); }
        return s;
      });
      return { type, flag, subtables };
    };
    return { order: [...want].sort((x, y) => x - y), lookup };
  };
  return { b, u16, i16, u32, tables, upem, numGlyphs, adv, cmap, glyfAt, coverage, glyphClass, attachClass, anchor, layout, cache: new Map() };
}

// Shape one run (no line breaks) → [{ g, x, y, u }] in font units; x is where the glyph is drawn from the run's start,
// u the text it stands for (for copying text out of the PDF). Letters the font lacks come out as glyph 0.
export function shape(font, text) {
  const hit = font.cache.get(text);
  if (hit) return hit;
  const { u16, coverage, glyphClass, attachClass, anchor } = font;
  // SARA AM as NIKHAHIT + SARA AA up front, so each glyph stands for its own letters when text is copied out.
  let buf = [...text.replace(/ำ/g, 'ํา')].map((ch) => ({ g: font.cmap.get(ch.codePointAt(0)) || 0, u: ch }));
  if (!font.gsub) {
    font.gsub = { thai: font.layout('GSUB', ['ccmp'], 'thai', 7), latn: font.layout('GSUB', ['ccmp'], 'latn', 7) };
    font.gpos = font.layout('GPOS', ['mark', 'mkmk'], 'thai', 9);
  }
  const covs = new Map(), cov = (o) => covs.get(o) || (covs.set(o, coverage(o)), covs.get(o));
  const single = (lk, i) => {
    for (const s of lk.subtables) {
      const k = cov(s + u16(s + 2)).get(buf[i].g);
      if (k === undefined) continue;
      if (lk.type === 1) { buf[i] = { ...buf[i], g: u16(s) === 1 ? (buf[i].g + font.i16(s + 4)) & 0xffff : u16(s + 6 + k * 2) }; return true; }
    }
    return false;
  };
  const apply = (lk, i) => {
    const g = buf[i].g;
    for (const s of lk.subtables) {
      if (lk.type === 1 || lk.type === 2 || lk.type === 4) {
        const k = cov(s + u16(s + 2)).get(g);
        if (k === undefined) continue;
        if (lk.type === 1) return single(lk, i) ? 1 : 0;
        if (lk.type === 2) {
          const q = s + u16(s + 6 + k * 2), n = u16(q);
          buf.splice(i, 1, ...Array.from({ length: n }, (_, j) => ({ g: u16(q + 2 + j * 2), u: j ? '' : buf[i].u })));
          return n;
        }
        const set = s + u16(s + 6 + k * 2);
        for (let j = 0, n = u16(set); j < n; j++) {
          const lig = set + u16(set + 2 + j * 2), comps = u16(lig + 2);
          if (i + comps > buf.length) continue;
          let ok = true;
          for (let c = 1; c < comps && ok; c++) ok = buf[i + c].g === u16(lig + 2 + c * 2);
          if (!ok) continue;
          buf.splice(i, comps, { g: u16(lig), u: buf.slice(i, i + comps).map((x) => x.u).join('') });
          return 1;
        }
      } else if (lk.type === 6 && u16(s) === 3) {
        let o = s + 2;
        const list = () => { const n = u16(o), r = Array.from({ length: n }, (_, j) => s + u16(o + 2 + j * 2)); o += 2 + n * 2; return r; };
        const back = list(), input = list(), ahead = list();
        if (i - back.length < 0 || i + input.length + ahead.length > buf.length) continue;
        if (!back.every((c, j) => cov(c).has(buf[i - 1 - j].g)) || !input.every((c, j) => cov(c).has(buf[i + j].g)) || !ahead.every((c, j) => cov(c).has(buf[i + input.length + j].g))) continue;
        for (let r = 0, n = u16(o); r < n; r++) single(font.gsub.thai.lookup(u16(o + 4 + r * 4)), i + u16(o + 2 + r * 4));
        return input.length;
      }
    }
    return 0;
  };
  const gsub = /[฀-๿]/.test(text) ? font.gsub.thai : font.gsub.latn;
  for (const li of gsub.order) {
    const lk = gsub.lookup(li);
    for (let i = 0; i < buf.length;) i += apply(lk, i) || 1;
  }
  // Positions: marks attach to the glyph before them (a base for 'mark', a mark for 'mkmk').
  const pen = []; let x = 0;
  for (const it of buf) { pen.push(x); x += font.adv[it.g]; }
  const at = new Map();
  const isMark = (g) => glyphClass.get(g) === 3;
  for (const li of font.gpos.order) {
    const lk = font.gpos.lookup(li), only = lk.flag >> 8;
    for (let i = 0; i < buf.length; i++) {
      const g = buf[i].g;
      if (!isMark(g) || (only && attachClass.get(g) !== only)) continue;
      for (const s of lk.subtables) {
        if (u16(s) !== 1 || (lk.type !== 4 && lk.type !== 6)) continue;
        const mk = cov(s + u16(s + 2)).get(g);
        if (mk === undefined) continue;
        let j = i - 1;
        if (lk.type === 4) while (j >= 0 && isMark(buf[j].g)) j--;
        else while (j >= 0 && only && isMark(buf[j].g) && attachClass.get(buf[j].g) !== only) j--;
        if (j < 0 || (lk.type === 6 && !isMark(buf[j].g))) continue;
        const bk = cov(s + u16(s + 4)).get(buf[j].g);
        if (bk === undefined) continue;
        const classes = u16(s + 6), ma = s + u16(s + 8), ba = s + u16(s + 10);
        const cls = u16(ma + 2 + mk * 4), mAnchor = anchor(ma + u16(ma + 4 + mk * 4));
        const bo = u16(ba + 2 + (bk * classes + cls) * 2);
        if (!bo) continue;
        const bAnchor = anchor(ba + bo);
        at.set(i, { to: j, dx: bAnchor[0] - mAnchor[0], dy: bAnchor[1] - mAnchor[1] });
        break;
      }
    }
  }
  const pos = [];
  const place = (i) => {
    if (pos[i]) return pos[i];
    const a = at.get(i);
    if (!a) return (pos[i] = [pen[i], 0]);
    const p = place(a.to);
    return (pos[i] = [p[0] + a.dx, p[1] + a.dy]);
  };
  const out = buf.map((it, i) => ({ g: it.g, u: it.u, x: place(i)[0], y: place(i)[1], at: at.has(i) }));
  out.width = x;
  if (font.cache.size > 5000) font.cache.clear();
  font.cache.set(text, out);
  return out;
}

// A subset of the font with only these glyphs drawn (and the glyphs they are built from); everything else is kept so
// glyph ids do not change. → Buffer (a TrueType file).
export function subset(font, used) {
  const { b, u16, tables } = font;
  const keep = new Set([0, ...used]), glyf = tables.glyf.off;
  for (const g of [...keep]) {
    const stack = [g];
    while (stack.length) {
      const [s, e] = font.glyfAt(stack.pop());
      if (e - s < 10 || b.readInt16BE(glyf + s) >= 0) continue;
      let o = glyf + s + 10, flags;
      do {
        flags = u16(o); const c = u16(o + 2);
        if (!keep.has(c)) { keep.add(c); stack.push(c); }
        o += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      } while (flags & 0x20);
    }
  }
  const parts = [], loca = Buffer.alloc((font.numGlyphs + 1) * 4);
  let size = 0;
  for (let g = 0; g < font.numGlyphs; g++) {
    loca.writeUInt32BE(size, g * 4);
    if (!keep.has(g)) continue;
    const [s, e] = font.glyfAt(g);
    const d = b.subarray(glyf + s, glyf + e), pad = (4 - (d.length % 4)) % 4;
    parts.push(d, Buffer.alloc(pad)); size += d.length + pad;
  }
  loca.writeUInt32BE(size, font.numGlyphs * 4);
  const head = Buffer.from(b.subarray(tables.head.off, tables.head.off + tables.head.len));
  head.writeUInt32BE(0, 8); head.writeInt16BE(1, 50);
  const copy = (t) => tables[t] && b.subarray(tables[t].off, tables[t].off + tables[t].len);
  const out = { head, hhea: copy('hhea'), maxp: copy('maxp'), hmtx: copy('hmtx'), loca, glyf: Buffer.concat(parts), 'cvt ': copy('cvt '), fpgm: copy('fpgm'), prep: copy('prep') };
  const tags = Object.keys(out).filter((t) => out[t]).sort();
  const n = tags.length, hdr = Buffer.alloc(12 + n * 16);
  let es = 0; while (2 ** (es + 1) <= n) es++;
  hdr.writeUInt32BE(0x00010000, 0); hdr.writeUInt16BE(n, 4); hdr.writeUInt16BE(16 * 2 ** es, 6); hdr.writeUInt16BE(es, 8); hdr.writeUInt16BE(n * 16 - 16 * 2 ** es, 10);
  const sum = (d) => { let s = 0; const p = Buffer.concat([d, Buffer.alloc((4 - (d.length % 4)) % 4)]); for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0; return s; };
  let off = hdr.length; const body = [];
  tags.forEach((t, i) => {
    const d = out[t], pad = (4 - (d.length % 4)) % 4, r = 12 + i * 16;
    hdr.write(t, r, 'latin1'); hdr.writeUInt32BE(sum(d), r + 4); hdr.writeUInt32BE(off, r + 8); hdr.writeUInt32BE(d.length, r + 12);
    body.push(d, Buffer.alloc(pad)); off += d.length + pad;
  });
  return Buffer.concat([hdr, ...body]);
}
