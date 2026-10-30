import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../api.js';
import { canSearch, collect, createIndex, DATES, KINDS, mapFor, marks, search, setDocs, snippet } from '../search.js';
import { fmtDate } from '../format.js';
import StationPanel from './StationPanel.jsx';
import { pilotPersona } from '../personas.js';
import './search.css';

// Search (docs/pilot-server.md "Search"): the top bar's box, "/" from anywhere, and at Simple level "Find something I did".
// Over the browser's own part of the record only. The index is built on first use and refreshed after a change.
let cache = null; // { key, ix, dirty, buildMs }
api.subscribe(() => { if (cache) cache.dirty = true; });
const keyOf = (p) => `${p.id}|${p.kind}|${p.studentId || p.teacherId || (p.children || []).join(',')}|${p.admin ? 1 : 0}`;
function indexFor(persona) {
  const key = keyOf(persona);
  if (!cache || cache.key !== key) cache = { key, ix: createIndex(), dirty: true, buildMs: 0 };
  if (cache.dirty) { const t = performance.now(); setDocs(cache.ix, collect(api, persona)); cache.dirty = false; cache.buildMs = performance.now() - t; }
  return cache.ix;
}
const run = (persona, q, f) => search(indexFor(persona), q, { ...f, today: api.TODAY, termStart: api.TERM_START });
// For the browser checks: how long one search takes here, the index refresh included.
let current = null;
if (typeof window !== 'undefined') window.__tpSearch = (q, f = {}, { cold } = {}) => {
  if (!current) return null;
  if (cold) cache = null;
  const t = performance.now(); const r = run(current, q, f); const ms = performance.now() - t;
  return { ms, buildMs: cache.buildMs, docs: cache.ix.docs.size, total: r.total, titles: r.results.map((d) => `${d.kind}:${d.title}`) };
};
export const OPEN_EVENT = 'tp-search-open';
// "/" from anywhere: the box in the top bar (or its phone sheet), else Simple level's finder. false: no search here.
export function openSearch() {
  const el = document.getElementById('tsearch-q');
  if (el && el.offsetParent !== null) { el.focus(); el.select(); return true; }
  if (document.querySelector('[data-search-open]')) { dispatchEvent(new Event(OPEN_EVENT)); return true; }
  return false;
}

const TH = { 'Search': 'ค้นหา', 'Search your family view': 'ค้นหาในหน้าครอบครัว', 'Nothing matches': 'ไม่พบสิ่งที่ค้นหา', 'Moments': 'ช่วงเวลา', 'Goals': 'เป้าหมาย', 'Reflections': 'การสะท้อนคิด', "Teachers' notes": 'บันทึกจากครู',
  'Any type': 'ทุกประเภท', 'Any line': 'ทุกเส้นทาง', 'Any time': 'ทุกช่วงเวลา', 'Close': 'ปิด', 'Type': 'ประเภท', 'Line': 'เส้นทาง', 'When': 'เมื่อไร' };
const say = (lang, s) => (lang === 'th' && TH[s]) || s;
const Hl = ({ text, ns }) => marks(text, ns).map(([t, on], i) => (on ? <mark key={i}>{t}</mark> : t));
const placeholderOf = (p) => (p.kind === 'student' ? 'Search your portfolio' : p.kind === 'parent' ? 'Search your family view' : 'Search students and moments');

// The words, filters and results, shared by the top bar and Simple level.
function useFinder(persona, version) {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ kind: '', line: '', when: '', studentId: '' });
  const active = !!(q.trim() || f.kind || f.line || f.when || f.studentId); // the index is built on the first search, not before
  const res = useMemo(() => (active && canSearch(persona) ? run(persona, q, f) : null), [persona, q, f, version, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => {
    if (!active) return [];
    const ix = indexFor(persona); const seen = new Map();
    for (const d of ix.docs.values()) for (const id of d.lineIds || []) if (!seen.has(id)) seen.set(id, api.getLine(id)?.name || id);
    return [...seen].filter(([id]) => persona.kind === 'student' || !api.getLine(id)?.parentLineId).sort((a, b) => a[1].localeCompare(b[1]));
  }, [persona, version, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return { q, setQ, f, setF, res, lines };
}

// The result list: one listbox, its options grouped under a label per kind.
function Results({ id, res, at, setAt, pick, lang, persona }) {
  let n = -1;
  return (
    <div id={id} role="listbox" aria-label={say(lang, 'Search')} className="ts-list">
      {res.groups.map(([k, label, docs]) => (
        <div key={k} role="group" aria-labelledby={`${id}-g-${k}`} className="ts-group">
          <div id={`${id}-g-${k}`} className="ts-gl" role="presentation">{say(lang, label)} <small>{docs.length}</small></div>
          {docs.map((d) => { n += 1; const i = n; return (
            <div key={d.id} id={`${id}-o-${i}`} role="option" aria-selected={i === at} className={`ts-opt${i === at ? ' on' : ''}`} onPointerMove={() => setAt(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(d)}>
              <span className="ts-dot" style={{ '--c': d.colour || '#8D8FBE' }} aria-hidden="true" />
              <span className="ts-txt">
                <b><Hl text={d.title} ns={res.needles} /></b>
                <small>{d.sub}{d.date ? `${d.sub ? ' · ' : ''}${fmtDate(d.date)}` : ''}</small>
                {d.match && <span className="ts-snip"><i>{d.match[0]}:</i> <Hl text={snippet(d.match[1], res.needles)} ns={res.needles} /></span>}
              </span>
              {persona.kind !== 'student' && d.kind === 'student' && <span className="ts-go" aria-hidden="true">›</span>}
            </div>
          ); })}
        </div>
      ))}
    </div>
  );
}

function Filters({ persona, finder, lang }) {
  const { f, setF, lines } = finder;
  const kinds = KINDS.filter(([k]) => (k === 'student' ? persona.kind !== 'student' && persona.kind !== 'parent' : k === 'line' ? persona.kind === 'student' : true));
  const kid = f.studentId && api.getStudent(f.studentId);
  return (
    <div className="ts-filters" role="group" aria-label="Filters">
      {kid && <button className="ts-chip" onClick={() => setF({ ...f, studentId: '' })} aria-label={`Only ${kid.name}: show everyone`}>{kid.name} <span aria-hidden="true">×</span></button>}
      <label><span className="sr-only">{say(lang, 'Type')}</span><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="">{say(lang, 'Any type')}</option>{kinds.map(([k, l]) => <option key={k} value={k}>{say(lang, l)}</option>)}</select></label>
      {lines.length > 0 && <label><span className="sr-only">{say(lang, 'Line')}</span><select value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })}><option value="">{say(lang, 'Any line')}</option>{lines.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>}
      <label><span className="sr-only">{say(lang, 'When')}</span><select value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })}>{DATES.map(([k, l]) => <option key={k} value={k}>{say(lang, l)}</option>)}</select></label>
    </div>
  );
}

// Where a student result can go for this person: their advisee's page, or the class they teach the student in.
function studentPage(persona, sid) {
  const s = api.getStudent(sid); const tid = persona.teacherId;
  if (!s || !tid) return null;
  if (s.advisorId === tid && (persona.kind === 'advisor' || persona.also?.includes('advisor'))) return ['student', sid];
  const mine = new Set(api.getClasses().filter((c) => (c.teacherIds || []).includes(tid)).map((c) => c.id));
  const cls = api.getEnrolments().find((n) => n.studentId === sid && !n.to && mine.has(n.classId));
  return cls && pilotPersona() && (persona.kind === 'teacher' || persona.also?.includes('teacher')) ? ['classes', `${cls.classId}~${sid}`] : null;
}

// Opening a result: a student goes to their own map; staff and families get the station panel as their screens show it.
function useOpen(persona, go, toast, close) {
  const [panel, setPanel] = useState(null); // { sid, eventId }
  const map = useMemo(() => panel && mapFor(api, persona, panel.sid), [panel, persona]);
  const event = map?.events.find((e) => e.id === panel?.eventId);
  const open = (d) => {
    close();
    if (persona.kind === 'student') { go(persona.id, 'map', d.eventId); return; }
    setPanel({ sid: d.studentId, eventId: d.eventId });
  };
  // Out of the top bar (its stacking and colours), onto the page.
  const view = event ? createPortal(<div className="sr-panel"><StationPanel event={event} map={map} onClose={() => setPanel(null)} readOnly toast={toast} /></div>, document.body) : null;
  return { open, view, shut: panel && (() => setPanel(null)) };
}

export function TopSearch({ persona, go, toast, version, lang, simple }) {
  current = persona;
  const finder = useFinder(persona, version);
  const { q, setQ, f, setF, res } = finder;
  const [focus, setFocus] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [at, setAt] = useState(-1);
  const wrap = useRef(null); const input = useRef(null);
  const close = () => { setFocus(false); setSheet(false); setAt(-1); };
  const { open, view, shut } = useOpen(persona, go, toast, close);
  const hasQuery = !!(q.trim() || f.studentId || f.kind || f.line || f.when);
  const expanded = focus && hasQuery;
  const list = res?.results || [];
  useEffect(() => { setAt(-1); }, [q, f]);
  useEffect(() => { if (sheet) input.current?.focus(); }, [sheet]);
  useEffect(() => { if (at >= 0) document.getElementById(`tsearch-o-${at}`)?.scrollIntoView({ block: 'nearest' }); }, [at]);
  useEffect(() => { const g = (e) => { if (!wrap.current?.contains(e.target)) { setFocus(false); setSheet(false); } }; addEventListener('pointerdown', g); return () => removeEventListener('pointerdown', g); }, []);
  if (!canSearch(persona)) return null;
  if (simple) return <><button className="icon-btn ts-simple" data-search-open onClick={() => dispatchEvent(new Event(OPEN_EVENT))} aria-label="Find something I did" title="Find something I did (/)"><Glass /></button><SimpleFind persona={persona} go={go} version={version} /></>;
  const pick = (d) => {
    if (d.kind === 'line') { setQ(''); setF({ ...f, line: d.lineIds[0] }); input.current?.focus(); return; }
    if (d.kind === 'student') {
      setQ(''); setF({ ...f, studentId: d.studentId }); input.current?.focus();
      return;
    }
    open(d);
  };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(true); setAt((a) => Math.min(list.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Home' && at >= 0) { e.preventDefault(); setAt(0); }
    else if (e.key === 'End' && at >= 0) { e.preventDefault(); setAt(list.length - 1); }
    else if (e.key === 'Enter') { const d = list[at >= 0 ? at : 0]; if (d && expanded) { e.preventDefault(); pick(d); } }
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (expanded || sheet) close(); else if (shut) shut(); else if (q || f.studentId) { setQ(''); setF({ kind: '', line: '', when: '', studentId: '' }); } else input.current?.blur();
    }
  };
  const page = f.studentId && studentPage(persona, f.studentId);
  return (
    <>
      <div ref={wrap} className={`tsearch${sheet ? ' sheet' : ''}${expanded ? ' open' : ''}`} role="search" aria-label={say(lang, 'Search')}>
        <button className="icon-btn ts-phone" onClick={() => { setSheet(true); setFocus(true); }} aria-label={say(lang, 'Search')}><Glass /></button>
        <div className="ts-box">
          <Glass />
          <input id="tsearch-q" ref={input} value={q} onChange={(e) => { setQ(e.target.value); setFocus(true); }} onFocus={() => setFocus(true)} onKeyDown={key}
            placeholder={say(lang, placeholderOf(persona))} aria-label={say(lang, placeholderOf(persona))} role="combobox" aria-expanded={expanded} aria-controls="tsearch" aria-autocomplete="list"
            aria-activedescendant={expanded && at >= 0 ? `tsearch-o-${at}` : undefined} autoComplete="off" spellCheck="false" lang={lang === 'th' ? 'th' : undefined} />
          <kbd className="ts-kbd" aria-hidden="true">/</kbd>
          {sheet && <button className="ts-x" onClick={close} aria-label={say(lang, 'Close')}>×</button>}
        </div>
        <div className="ts-pop" hidden={!expanded}>
          <Filters persona={persona} finder={finder} lang={lang} />
          {page && <button className="linkish ts-page" onClick={() => { close(); go(persona.id, page[0], page[1]); }}>Open {api.getStudent(f.studentId)?.name}’s page ›</button>}
          {res && <Results id="tsearch" res={res} at={at} setAt={setAt} pick={pick} lang={lang} persona={persona} />}
          {res && !res.total && <p className="ts-none">{say(lang, 'Nothing matches')}{q.trim() ? ` “${q.trim()}”` : ''}.</p>}
          {res && res.total > res.results.length && <p className="ts-more">Showing the best {res.results.length} of {res.total}. Add a word or a filter to narrow it.</p>}
        </div>
        <div className="sr-only" role="status" aria-live="polite">{expanded && res ? `${res.total} result${res.total === 1 ? '' : 's'}` : ''}</div>
      </div>
      {view}
    </>
  );
}

const Glass = () => <svg className="ts-glass" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

// Simple level: recent moments and line chips first; typing is one tap away.
export function SimpleFind({ persona, go, version, big }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const f = () => setShown(true); addEventListener(OPEN_EVENT, f); return () => removeEventListener(OPEN_EVENT, f); }, []);
  if (big) return <button className="sf-big" onClick={() => dispatchEvent(new Event(OPEN_EVENT))}><Glass /> Find something I did</button>;
  return shown ? createPortal(<SimpleDialog persona={persona} go={go} version={version} onClose={() => setShown(false)} />, document.body) : null;
}
function SimpleDialog({ persona, go, version, onClose }) {
  const finder = useFinder(persona, version);
  const { q, setQ, f, setF, res } = finder;
  const [typing, setTyping] = useState(false);
  const [at, setAt] = useState(-1);
  const map = useMemo(() => api.getStudentMap(persona.studentId, 'student'), [persona.studentId, version]);
  const recent = map.events.filter((e) => e.type !== 'goal' && e.date <= api.TODAY).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);
  const colour = (e) => map.lines.find((l) => l.id === e.lineIds[0])?.colour;
  const openEv = (id) => { onClose(); go(persona.id, 'map', id); };
  const list = res?.results || [];
  const pick = (d) => (d.kind === 'line' ? (setQ(''), setF({ ...f, line: d.lineIds[0] })) : openEv(d.eventId));
  useEffect(() => { setAt(-1); }, [q, f]);
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(list.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Enter' && list[at >= 0 ? at : 0]) { e.preventDefault(); pick(list[at >= 0 ? at : 0]); }
  };
  const line = f.line && map.lines.find((l) => l.id === f.line);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sf" role="dialog" aria-modal="true" aria-labelledby="sf-h" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="sf-h">Find something I did</h2>
        {!typing && !line && <>
          {recent.length > 0 && <><h3>Lately</h3><div className="sf-chips">{recent.map((e) => <button key={e.id} className="sf-chip" style={{ '--c': colour(e) }} onClick={() => openEv(e.id)}><i aria-hidden="true" />{e.title}</button>)}</div></>}
          {map.lines.length > 0 && <><h3>My lines</h3><div className="sf-chips">{map.lines.map((l) => <button key={l.id} className="sf-chip line" style={{ '--c': l.colour }} onClick={() => setF({ ...f, line: l.id })}><i aria-hidden="true" />{l.name}</button>)}</div></>}
          {!recent.length && <p className="sf-empty">Nothing on your map yet. Add your first thing and it will show up here.</p>}
          <button className="sf-type" onClick={() => setTyping(true)}>Type a word instead</button>
        </>}
        {line && !typing && <>
          <button className="linkish sf-back" onClick={() => setF({ ...f, line: '' })}>‹ All my things</button>
          <h3 className="sf-line" style={{ '--c': line.colour }}><i aria-hidden="true" />{line.name}</h3>
          <ul className="sf-moments">{(res?.results || []).filter((d) => d.kind === 'moment' || d.kind === 'goal').map((d) => <li key={d.id}><button onClick={() => openEv(d.eventId)} style={{ '--c': d.colour }}><b>{d.title}</b><small>{d.date && fmtDate(d.date)}</small></button></li>)}</ul>
          {!res?.results.some((d) => d.kind === 'moment' || d.kind === 'goal') && <p className="sf-empty">Nothing on this line yet.</p>}
        </>}
        {typing && <>
          <div className="ts-box sf-box"><Glass />
            <input id="sf-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Type a word" aria-label="Type a word to find" role="combobox"
              aria-expanded={!!q.trim()} aria-controls="sf-list" aria-autocomplete="list" aria-activedescendant={at >= 0 ? `sf-list-o-${at}` : undefined} autoComplete="off" />
          </div>
          {q.trim() && res && <Results id="sf-list" res={res} at={at} setAt={setAt} pick={pick} lang="en" persona={persona} />}
          {q.trim() && res && !res.total && <p className="sf-empty">Nothing matches “{q.trim()}”. Try a shorter word.</p>}
          <div className="sr-only" role="status" aria-live="polite">{q.trim() && res ? `${res.total} found` : ''}</div>
          <button className="linkish sf-back" onClick={() => { setTyping(false); setQ(''); }}>‹ Back to my recent things</button>
        </>}
      </div>
    </div>
  );
}
