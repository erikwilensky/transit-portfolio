import { useRef, useState } from 'react';
import { getLine, getStore } from '../api.js';
import { fmtDate, TYPE_LABEL, VERIFY_LABEL } from '../format.js';
import '../imports/imports.css';

// Reads dropped files as text. UTF-8 first; a CSV saved by Thai Windows Excel (TIS-620 / Windows-874) is decoded as that.
export async function readFiles(fileList) {
  const out = [];
  for (const f of [...fileList]) {
    const buf = await f.arrayBuffer();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { try { text = new TextDecoder('windows-874').decode(buf); } catch { text = new TextDecoder().decode(buf); } }
    out.push({ name: f.name, text });
  }
  return out;
}
export function downloadText(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DropZone({ accept, multiple, onFiles, hint }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  return (
    <label className={`imp-drop${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" data-testid="import-file"
        onChange={(e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ''; }} />
      <span className="imp-drop-tri" aria-hidden="true" />
      <b>Drop the file here, or choose it</b>
      <small>{hint}</small>
    </label>
  );
}

// Items already in an inbox, skipped, or on a map (same source and reference) will not be added again.
export function alreadyThere(c) {
  const s = getStore();
  const key = (e) => `${e.studentId}|${e.source?.system}|${e.source?.ref}`;
  const k = key(c);
  return [...s.inbox, ...s.dismissed, ...s.events].some((e) => e.id === c.id || key(e) === k || (e.mergedFrom || []).some((m) => `${e.studentId}|${m.system}|${m.ref}` === k));
}

const LineChip = ({ id }) => { const l = getLine(id); return l ? <span className="imp-line" style={{ '--c': l.colour }}><i />{l.name}</span> : null; };

// The preview: one row per item in the file, with the student it matched and anything that stops it.
export function PreviewTable({ result, showStudent = true }) {
  const [only, setOnly] = useState(false);
  const rows = result.items.map((it) => ({ ...it, dup: it.candidate && alreadyThere(it.candidate) }));
  const shown = only ? rows.filter((r) => r.problem || r.dup || r.warnings.length) : rows;
  const flagged = rows.filter((r) => r.problem || r.dup || r.warnings.length).length;
  return (
    <div className="imp-preview">
      {flagged > 0 && <label className="cb-check imp-only"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Only rows that need a look ({flagged})</label>}
      <div className={`imp-table${showStudent ? '' : ' no-student'}`} role="table" aria-label="What the file contains">
        <div className="imp-tr head" role="row">
          <span role="columnheader">Row</span>{showStudent && <span role="columnheader">Student</span>}<span role="columnheader">Item</span><span role="columnheader">Date</span><span role="columnheader">Suggested line</span><span role="columnheader">Check</span>
        </div>
        {shown.map((r, i) => (
          <div key={`${r.row}-${i}`} role="row" className={`imp-tr${r.problem ? ' bad' : r.dup ? ' dup' : r.warnings.length ? ' warn' : ''}`}>
            <span role="cell" className="imp-row" data-l="Row">{r.row}</span>
            {showStudent && <span role="cell" data-l="Student">{r.studentName ? <><b>{r.studentName}</b><small>by {r.matchedBy}</small></> : <em>Not matched</em>}</span>}
            <span role="cell" data-l="Item"><b>{r.candidate?.title || r.label}</b>{r.candidate && <small>{TYPE_LABEL[r.candidate.type]} · {VERIFY_LABEL[r.candidate.verification]}</small>}</span>
            <span role="cell" data-l="Date">{r.candidate ? fmtDate(r.candidate.date) : '–'}</span>
            <span role="cell" data-l="Line">{r.candidate ? (r.candidate.suggestedLineIds.length ? r.candidate.suggestedLineIds.map((id) => <LineChip key={id} id={id} />) : <small>None: the student picks</small>) : '–'}</span>
            <span role="cell" data-l="Check" className="imp-check">
              {r.problem ? <span className="imp-flag bad">{r.problem}</span> : r.dup ? <span className="imp-flag dup">Already imported</span> : r.warnings.length ? r.warnings.map((w) => <span key={w} className="imp-flag warn">{w}</span>) : <span className="imp-flag ok">Ready</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const readyOf = (result) => result.candidates.filter((c) => !alreadyThere(c));
