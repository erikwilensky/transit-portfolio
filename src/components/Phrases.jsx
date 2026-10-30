// Teacher comment bank (api.addPhrase … usePhrase): a small picker next to the boxes staff write to students in, and
// "Save as a phrase". Inserting only puts the words in the box; nothing is sent until the teacher sends it as before.
// Pilot only, staff and admins only (students and families never get a bank). Manage: src/screens/Phrases.jsx.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { addPhrase, fillPhrase, phraseBank, phraseFrom, PHRASE_KINDS, usePhrase as countPhrase } from '../api.js';
import { pilotPersona } from '../personas.js';
import './phrases.css';

const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership', 'admin'];
// The signed-in member of staff, or null (students, families, the demo).
export function phraseWriter() {
  const p = pilotPersona();
  return p && (STAFF.includes(p.kind) || p.admin) ? p : null;
}
const KIND = Object.fromEntries(PHRASE_KINDS);
// The groups the picker shows: yours first, then the school's by kind (the box's own kind first). Most used first in each.
export function pickerGroups(teacherId, kind) {
  const { mine, school, uses } = phraseBank(teacherId);
  const used = (list) => list.map((p, i) => ({ p, i, n: uses[p.id] || 0 })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.p);
  const kinds = PHRASE_KINDS.map(([k]) => k).sort((a, b) => (b === kind) - (a === kind));
  return [{ id: 'mine', label: 'Your phrases', list: used(mine) },
    ...kinds.map((k) => ({ id: k, label: `School: ${KIND[k]}`, list: used(school.filter((p) => p.kind === k)) }))].filter((g) => g.list.length);
}

// value/onChange: the box's text. first: the student's first name for {first name} (none for a note to many). box: a ref
// to the input or textarea, to insert at the cursor (else at the end). kind: praise, next or question, for saving.
export default function PhraseTools({ value, onChange, first = null, kind = 'other', box = null, save = true }) {
  const me = phraseWriter();
  const tid = me?.teacherId || null;
  const id = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [act, setAct] = useState(0);
  const [said, setSaid] = useState('');
  const btn = useRef(null), wrap = useRef(null), filter = useRef(null);
  const groups = useMemo(() => (me ? pickerGroups(tid, kind) : []), [me, tid, kind, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = groups.map((g) => ({ ...g, list: g.list.filter((p) => words.every((w) => `${p.text} ${KIND[p.kind]}`.toLowerCase().includes(w))) })).filter((g) => g.list.length);
  const flat = shown.flatMap((g) => g.list);
  useEffect(() => { if (open) { setQ(''); setAct(0); } }, [open]);
  useEffect(() => { if (act >= flat.length) setAct(Math.max(0, flat.length - 1)); }, [flat.length, act]);
  useEffect(() => { document.getElementById(`${id}-o${act}`)?.scrollIntoView?.({ block: 'nearest' }); }, [act, id]);
  if (!me) return null;
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const insert = (p) => {
    const words = fillPhrase(p.text, first);
    const el = box?.current, v = value || '';
    let at = v.length, end = v.length;
    if (el && typeof el.selectionStart === 'number' && el.dataset.phraseAt) { at = el.selectionStart; end = el.selectionEnd; }
    const before = v.slice(0, at), after = v.slice(end);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${words}${after && !/^\s/.test(after) ? ' ' : ''}${after}`;
    onChange(next);
    if (tid) { try { countPhrase(p.id, tid); } catch { /* refused or gone: the words are in the box anyway */ } }
    setSaid(`Put in: ${words}`);
    setOpen(false);
    const caret = (before + pad + words).length;
    (box?.current || btn.current)?.focus();
    setTimeout(() => { const b = box?.current; if (b) { b.focus(); try { b.setSelectionRange(caret, caret); } catch { /* not a text box */ } } else btn.current?.focus(); }, 0);
  };
  const key = (e) => {
    e.stopPropagation(); // not the card's own shortcuts (J, K, E…)
    if (e.key === 'ArrowDown') { e.preventDefault(); setAct((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setAct(0); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setAct(flat.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[act]) insert(flat[act]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  const blur = (e) => { if (!wrap.current?.contains(e.relatedTarget)) setOpen(false); };
  const text = String(value || '').trim();
  const doSave = () => {
    try { addPhrase(tid, tid, { text: phraseFrom(text, first), kind }); setSaid('Saved to your phrases'); }
    catch (err) { setSaid(err.message || 'Not saved'); }
  };
  let n = -1;
  return (
    <div className="ph-tools" ref={wrap} onBlur={blur} onKeyDown={(e) => { if (open && e.target !== filter.current && ['ArrowDown', 'ArrowUp', 'Escape'].includes(e.key)) { filter.current?.focus(); key(e); } else if (open) e.stopPropagation(); }}>
      <button type="button" ref={btn} className="ph-open" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-pop` : undefined}
        onClick={() => setOpen(!open)}>Phrases</button>
      {save && tid && <button type="button" className="linkish ph-save" disabled={text.length < 3} onClick={doSave}>Save this as a phrase</button>}
      <span className="ph-said" role="status" aria-live="polite">{said}</span>
      {open && (
        <div className="ph-pop" id={`${id}-pop`} role="dialog" aria-label="Your saved phrases">
          <input ref={filter} autoFocus className="ph-filter" type="text" role="combobox" value={q} onChange={(e) => { setQ(e.target.value); setAct(0); }} onKeyDown={key}
            placeholder="Type to filter" aria-label="Filter phrases" aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-list`}
            aria-activedescendant={flat.length ? `${id}-o${act}` : undefined} autoComplete="off" />
          <p className="ph-count" aria-live="polite">{flat.length ? `${flat.length} phrase${flat.length === 1 ? '' : 's'}. Arrow keys to choose, Enter to put it in the box.` : groups.length ? 'No phrase has those words.' : 'No phrases yet. Write one in the box and save it, or add some in My phrases.'}</p>
          {flat.length > 0 && (
            <div className="ph-list" id={`${id}-list`} role="listbox" aria-label="Phrases">
              {shown.map((g) => (
                <div key={g.id} role="group" aria-labelledby={`${id}-g-${g.id}`}>
                  <div className="ph-group" id={`${id}-g-${g.id}`} role="presentation">{g.label}</div>
                  {g.list.map((p) => { n++; const i = n; return (
                    <div key={p.id} id={`${id}-o${i}`} role="option" aria-selected={i === act} className={`ph-opt${i === act ? ' on' : ''}`}
                      onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setAct(i)} onClick={() => insert(p)}>{fillPhrase(p.text, first)}</div>
                  ); })}
                </div>
              ))}
            </div>
          )}
          <div className="ph-foot"><a href={`#/${me.id}/phrases`} onClick={() => setOpen(false)}>Manage my phrases</a><button type="button" className="linkish" onClick={() => close()}>Close</button></div>
        </div>
      )}
    </div>
  );
}

// Remember where the cursor was in a box, so a phrase goes there (props for the input or textarea).
export const phraseBox = (ref) => ({ ref, onSelect: (e) => { e.currentTarget.dataset.phraseAt = '1'; } });

// Report writing helper (src/report-comments.js, when that feature is in this copy): its draft boxes get the picker too.
const RC = Object.values(import.meta.glob('../report-comments.js', { eager: true }))[0];
if (RC?.reportHooks) RC.reportHooks.phrasePicker = ({ student, insert }) => <PhraseTools value="" first={student?.name?.split(' ')[0] || null} save={false} onChange={(v) => insert(v)} />;
