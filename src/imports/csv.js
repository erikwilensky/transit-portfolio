// A small, forgiving CSV reader. Pure: no DOM, no Node APIs, so it runs in the browser and in tests.
// Handles a byte-order mark, CRLF or LF (or old Mac CR) line ends, quoted fields with commas,
// doubled quotes and line breaks inside them, and files saved with ; or tab instead of commas.

export const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// Picks the delimiter that splits the first line into the most columns (outside quotes).
export function sniffDelimiter(text) {
  let first = ''; let q = false;
  for (const ch of text) { if (ch === '"') q = !q; else if (!q && (ch === '\n' || ch === '\r')) break; first += ch; }
  const count = (d) => { let n = 0, inq = false; for (const ch of first) { if (ch === '"') inq = !inq; else if (!inq && ch === d) n++; } return n; };
  const [best, n] = [',', ';', '\t'].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

// Returns rows as arrays of strings. Blank lines are dropped; unquoted cells are trimmed.
export function parseCsv(input, { delimiter } = {}) {
  const text = stripBom(String(input ?? ''));
  const d = delimiter || sniffDelimiter(text);
  const rows = []; let row = []; let cell = ''; let q = false; let quoted = false;
  const endCell = () => { row.push(quoted ? cell : cell.trim()); cell = ''; quoted = false; };
  const endRow = () => { endCell(); if (row.some((c) => c !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '' && !quoted) { cell = ''; q = true; quoted = true; }
    else if (ch === d) endCell();
    else if (ch === '\r') { endRow(); if (text[i + 1] === '\n') i++; }
    else if (ch === '\n') endRow();
    else if (quoted) { if (ch.trim()) cell += ch; } // stray characters after a closing quote
    else cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  return rows.map((r) => r.map((c) => c.replace(/\r\n?/g, '\n')));
}

// Writes rows back to CSV (used for the downloadable template). Quotes only where needed.
export const toCsv = (rows) => rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
