import { useEffect, useMemo, useRef, useState } from 'react';
import { getStore, getStudents } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';
import { KIND_LABEL, NAV, PERSONAS, navOf } from '../personas.js';

const STUDENT_PERSONA = Object.fromEntries(PERSONAS.filter((p) => p.kind === 'student').map((p) => [p.studentId, p.id]));

// F16: one box to jump to any person, student, station or screen. Opens on / or Ctrl+K.
// In pilot mode (`only` is the signed-in person's persona) it lists just their own screens.
export default function Launcher({ onGo, onClose, only }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const items = useMemo(() => {
    const out = [];
    if (only) {
      for (const [id, l] of navOf(only)) out.push({ kind: 'Page', label: l, sub: 'Your screens', go: () => onGo(only.id, id) });
      if (only.studentId) for (const e of getStore().events.filter((x) => x.studentId === only.studentId && !x.requirement)) out.push({ kind: 'Station', label: e.title, sub: `${TYPE_LABEL[e.type]} · ${fmtDate(e.date)}`, go: () => onGo(only.id, 'map', e.id) });
      out.push({ kind: 'Page', label: 'Verify a printed code', sub: 'Public verification page', go: () => { location.hash = '#/v'; } });
      return out;
    }
    for (const p of PERSONAS) out.push({ kind: 'Person', label: p.name, sub: `${p.role} · switch to their view`, go: () => onGo(p.id) });
    for (const p of PERSONAS) for (const [id, l] of NAV[p.kind]) out.push({ kind: 'Screen', label: l, sub: `${p.name} · ${KIND_LABEL[p.kind]}`, go: () => onGo(p.id, id) });
    for (const s of getStudents({ includeCohort: true })) {
      const pid = STUDENT_PERSONA[s.id];
      out.push({ kind: 'Student', label: s.name, sub: `Year ${s.grade + 1} · ${s.programme} · ${pid ? 'their own map' : 'advisor view'}`, go: () => (pid ? onGo(pid, 'map') : onGo('whitfield', 'student', s.id)) });
    }
    const names = Object.fromEntries(getStudents({ includeCohort: true }).map((s) => [s.id, s.name]));
    for (const e of getStore().events) {
      if (e.type === 'goal' && e.requirement) continue;
      const pid = STUDENT_PERSONA[e.studentId];
      out.push({ kind: 'Station', label: e.title, sub: `${names[e.studentId]} · ${TYPE_LABEL[e.type]} · ${fmtDate(e.date)}`, go: () => (pid ? onGo(pid, 'map', e.id) : onGo('whitfield', 'student', e.studentId)) });
    }
    out.push({ kind: 'Page', label: 'Verify a printed code', sub: 'Public verification page', go: () => { location.hash = '#/v'; } });
    out.push({ kind: 'Page', label: 'Reset the demo', sub: 'Back to the seeded state', go: () => { location.hash = '#/reset'; } });
    return out;
  }, [onGo, only]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items.filter((x) => x.kind === 'Person' || x.kind === 'Page');
    const score = (x) => { const l = x.label.toLowerCase(); return (l.startsWith(words[0]) ? 0 : 1) + ({ Person: 0, Student: 0, Screen: 1, Page: 1, Station: 2 }[x.kind]); };
    return items.filter((x) => words.every((w) => `${x.label} ${x.sub} ${x.kind}`.toLowerCase().includes(w))).sort((a, b) => score(a) - score(b)).slice(0, 40);
  }, [items, q]);
  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [at]);
  const pick = (x) => { onClose(); x.go(); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(shown.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && shown[at]) { e.preventDefault(); pick(shown[at]); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'Tab') e.preventDefault();
  };
  return (
    <div className="modal-back launcher-back" onClick={onClose}>
      <div className="launcher" role="dialog" aria-label="Jump to anything" onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Jump to a person, student, station or screen" aria-label="Jump to" role="combobox" aria-expanded="true" aria-controls="launch-list" aria-activedescendant={shown[at] ? `launch-${at}` : undefined} />
        <ul id="launch-list" ref={list} role="listbox">
          {shown.map((x, i) => (
            <li key={`${x.kind}-${x.label}-${x.sub}`} id={`launch-${i}`} role="option" aria-selected={i === at} className={i === at ? 'on' : ''} onPointerMove={() => setAt(i)} onClick={() => pick(x)}>
              <span className={`lk lk-${x.kind.toLowerCase()}`}>{x.kind}</span><span className="ll"><b>{x.label}</b><small>{x.sub}</small></span>
            </li>
          ))}
          {!shown.length && <li className="none">Nothing matches “{q}”.</li>}
        </ul>
        <div className="launch-foot"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>
      </div>
    </div>
  );
}
