import { useMemo, useRef, useState } from 'react';
import MetroMap from '../components/MetroMap.jsx';
import { VerifyBadge } from '../components/Badge.jsx';
import { applyLens } from '../api.js';
import { fmtDate } from '../format.js';
import { BLOCKS, SPANS, themeVars } from './design.js';

const SPAN_STEPS = SPANS.map(([n]) => n).sort((a, b) => a - b);
const firstImage = (e) => e?.evidence.find((x) => x.kind === 'image');
const firstPara = (t) => t.split('\n\n')[0];

// Text the student owns, editable in place while designing.
function Editable({ value, onChange, editable, tag: Tag = 'span', className, multiline }) {
  if (!editable) return <Tag className={className}>{value}</Tag>;
  return (
    <Tag className={`${className || ''} editable`} contentEditable suppressContentEditableWarning spellCheck
      onKeyDown={(e) => { if (!multiline && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } e.stopPropagation(); }}
      onBlur={(e) => { const v = e.currentTarget.innerText.trim(); if (v !== value) onChange(v); }}>{value}</Tag>
  );
}

export default function CustomView({ map, lens, design, editable = false, selectedBlockId, onSelectBlock, onChange, onOpenStation }) {
  const t = design.theme;
  const vis = useMemo(() => map.events.filter((e) => lens.visible.has(e.id)), [map, lens]);
  const past = vis.filter((e) => e.type !== 'goal');
  const byId = Object.fromEntries(vis.map((e) => [e.id, e]));
  const lineById = Object.fromEntries(map.lines.map((l) => [l.id, l]));
  const shownLines = lens.order.filter((id) => lens.lineState[id] !== 'hidden').map((id) => lineById[id]).filter(Boolean);
  const onLine = (lineId) => (lineId === 'all' || !lineId ? past : past.filter((e) => e.lineIds.includes(lineId)));
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, over, pos }

  const setBlock = (id, patch, transient) => onChange?.({ ...design, blocks: design.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }, transient);
  const setProps = (b, patch) => setBlock(b.id, { props: { ...b.props, ...patch } });
  const open = (id) => !editable && onOpenStation?.(id);

  const chips = (e) => (
    <span className="cv-chips">{e.lineIds.filter((id) => lens.lineState[id] && lens.lineState[id] !== 'hidden').map((id) => <i key={id} style={{ '--c': lineById[id]?.colour }}>{lineById[id]?.name}</i>)}</span>
  );

  const empty = (msg) => (editable ? <div className="cv-empty">{msg}</div> : null);
  const renderBlock = (b) => {
    const p = b.props;
    const ed = (key, opts = {}) => <Editable value={p[key] || ''} editable={editable} onChange={(v) => setProps(b, { [key]: v })} {...opts} />;
    const heading = p.heading !== undefined && (p.heading || editable) && ed('heading', { tag: 'h2', className: 'cv-h2' });
    switch (b.type) {
      case 'hero': return (
        <div className={`cv-hero hero-${p.layout}`}>
          <div className="cv-hero-text">
            {p.avatar && <div className="cv-avatar" style={{ background: map.student.avatar.colour }}>{map.student.avatar.initials}</div>}
            {ed('title', { tag: 'h1', className: 'cv-title' })}
            {ed('subtitle', { tag: 'div', className: 'cv-sub' })}
            {ed('tagline', { tag: 'p', className: 'cv-tagline', multiline: true })}
          </div>
          {p.layout === 'split' && <div className="cv-hero-map"><MetroMap map={map} lens={lens} mini /></div>}
        </div>
      );
      case 'text': return <div className="cv-text">{heading}{ed('body', { tag: 'div', className: 'cv-body', multiline: true })}</div>;
      case 'map': {
        const hidden = p.lines?.length ? map.lines.map((l) => l.id).filter((id) => !p.lines.includes(id)) : [];
        const l2 = hidden.length ? applyLens(map, null, { hiddenLines: [...hidden, ...map.lines.filter((l) => lens.lineState[l.id] === 'hidden').map((l) => l.id)] }) : lens;
        return <div className={`cv-map h-${p.height}`}><MetroMap map={map} lens={l2} mini /></div>;
      }
      case 'feature': {
        const e = byId[p.eventId];
        if (!e) return empty('Choose a station to feature');
        const img = firstImage(e), r = e.reflections?.[0], n = e.endorsements?.[0];
        return (
          <article className={`cv-feature img-${p.imageSide}`} onClick={() => open(e.id)}>
            {img && <img src={img.url} alt={img.caption} loading="lazy" />}
            <div className="cv-feature-body">
              <div className="cv-kicker">{fmtDate(e.date)}</div>
              <h3>{e.title}</h3>
              <p>{e.about || e.summary}</p>
              {p.showReflection && r && <blockquote className="cv-refl">“{firstPara(r.text)}”</blockquote>}
              {p.showEndorsement && n && <blockquote className="cv-endorse">“{n.note}”<cite>{n.teacher?.name}, {n.teacher?.role}</cite></blockquote>}
              <div className="cv-foot">{chips(e)}<VerifyBadge level={e.verification} /></div>
            </div>
          </article>
        );
      }
      case 'stations': {
        const evs = p.source === 'pick' ? p.eventIds.map((id) => byId[id]).filter(Boolean)
          : onLine(p.lineId).filter((e) => !p.types?.length || p.types.includes(e.type)).slice().reverse().slice(0, p.limit);
        return (
          <div>
            {heading}
            {!evs.length && empty('No stations match')}
            <div className={`cv-stations st-${p.style}`} style={{ '--cols': p.columns }}>
              {evs.map((e) => (
                <article key={e.id} className="cv-card" onClick={() => open(e.id)} style={{ '--c': lineById[e.lineIds[0]]?.colour }}>
                  {p.showImages && p.style !== 'compact' && firstImage(e) && <img src={firstImage(e).url} alt={firstImage(e).caption} loading="lazy" />}
                  <div className="cv-card-body">
                    <div className="cv-kicker">{fmtDate(e.date)}</div>
                    <h3>{e.title}</h3>
                    {p.style !== 'compact' && <p>{e.summary}</p>}
                    <div className="cv-foot">{chips(e)}<VerifyBadge level={e.verification} /></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      }
      case 'gallery': {
        const imgs = onLine(p.lineId).slice().reverse().flatMap((e) => e.evidence.filter((x) => x.kind === 'image').map((x) => ({ ...x, e }))).slice(0, p.limit);
        return (
          <div>{heading}
            <div className="cv-gallery" style={{ '--cols': p.columns }}>
              {imgs.map((x, i) => <figure key={i} onClick={() => open(x.e.id)}><img src={x.url} alt={x.caption} loading="lazy" /><figcaption>{x.e.title}</figcaption></figure>)}
            </div>
          </div>
        );
      }
      case 'quote': {
        const e = byId[p.eventId];
        const text = p.source === 'endorsement' ? e?.endorsements?.[0]?.note : e?.reflections?.[0] && firstPara(e.reflections[0].text);
        if (!text) return empty(`Choose a station with a published ${p.source}`);
        const who = p.source === 'endorsement' ? `${e.endorsements[0].teacher?.name}, ${e.endorsements[0].teacher?.role}` : `From my reflection on “${e.title}”`;
        return <blockquote className={`cv-quote q-${p.size}`} onClick={() => open(e.id)}>“{text}”<cite>{who}</cite></blockquote>;
      }
      case 'stats': {
        const all = {
          stations: [past.length, 'stations'], lines: [shownLines.length, 'lines'], endorsements: [past.filter((e) => e.endorsements.length).length, 'teacher endorsements'],
          reflections: [vis.reduce((n, e) => n + (e.reflections?.length || 0), 0), 'reflections'], interchanges: [past.filter((e) => e.lineIds.length > 1).length, 'interchanges'],
          years: [new Set(past.map((e) => e.date.slice(0, 4))).size, 'years'],
        };
        return <div className="cv-stats">{p.items.map((k) => all[k] && <div key={k}><b>{all[k][0]}</b><span>{all[k][1]}</span></div>)}</div>;
      }
      case 'timeline': {
        const evs = onLine(p.lineId).slice(-p.limit).reverse();
        return (
          <div>{heading}
            <ol className="cv-timeline">{evs.map((e) => <li key={e.id} style={{ '--c': lineById[e.lineIds[0]]?.colour }} onClick={() => open(e.id)}><span className="cv-kicker">{fmtDate(e.date)}</span><b>{e.title}</b><span>{e.summary}</span></li>)}</ol>
          </div>
        );
      }
      case 'lines': return (
        <div>{heading}
          <div className="cv-lines">{shownLines.map((l) => {
            const evs = onLine(l.id);
            if (!evs.length) return null;
            return <section key={l.id} style={{ '--c': l.colour }}><h3><i />{l.name}</h3><p>{evs[0].date.slice(0, 4)}–{l.status === 'ended' ? evs.at(-1).date.slice(0, 4) : 'now'} · {evs.length} stations</p>
              <ul>{evs.slice(-3).reverse().map((e) => <li key={e.id} onClick={() => open(e.id)}>{e.title}</li>)}</ul></section>;
          })}</div>
        </div>
      );
      case 'skills': return (
        <div>{heading}
          <div className="cv-tags">{p.tags.map((tag, i) => <span key={i}>{tag}</span>)}</div>
        </div>
      );
      case 'goals': {
        const goals = vis.filter((e) => e.type === 'goal');
        return <div>{heading}<ul className="cv-goals">{goals.map((e) => <li key={e.id} onClick={() => open(e.id)}><b>{e.title}</b><span>{fmtDate(e.date)}</span></li>)}</ul></div>;
      }
      case 'divider': return <div className={`cv-divider d-${p.style}`}>{p.style === 'metro' && <><i /><i /><i /></>}</div>;
      default: return null;
    }
  };

  // ── Editing: drag to reorder, drag the edge to resize ───────────────
  const move = (id, d) => {
    const blocks = [...design.blocks]; const i = blocks.findIndex((b) => b.id === id), j = i + d;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; onChange({ ...design, blocks });
  };
  const dup = (b) => { const blocks = [...design.blocks]; const i = blocks.indexOf(b); const c = structuredClone(b); c.id = `${b.id}c${Date.now().toString(36)}`; blocks.splice(i + 1, 0, c); onChange({ ...design, blocks }); onSelectBlock?.(c.id); };
  const del = (b) => { onChange({ ...design, blocks: design.blocks.filter((x) => x.id !== b.id) }); onSelectBlock?.(null); };
  const onDragOver = (e, b) => {
    if (!drag) return; e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const pos = b.span < 6 ? (e.clientX < r.left + r.width / 2 ? 'before' : 'after') : (e.clientY < r.top + r.height / 2 ? 'before' : 'after');
    if (drag.over !== b.id || drag.pos !== pos) setDrag({ ...drag, over: b.id, pos });
  };
  const onDrop = (e) => {
    e.preventDefault();
    if (!drag?.over || drag.over === drag.id) return setDrag(null);
    const blocks = design.blocks.filter((x) => x.id !== drag.id);
    const moving = design.blocks.find((x) => x.id === drag.id);
    const i = blocks.findIndex((x) => x.id === drag.over);
    blocks.splice(drag.pos === 'after' ? i + 1 : i, 0, moving);
    onChange({ ...design, blocks }); setDrag(null);
  };
  const startResize = (e, b) => {
    e.preventDefault(); e.stopPropagation();
    const grid = gridRef.current; const col = grid.getBoundingClientRect().width / 6;
    const startX = e.clientX, start = b.span;
    let last = start;
    const mv = (ev) => {
      const raw = start + (ev.clientX - startX) / col;
      const snap = SPAN_STEPS.reduce((best, s) => (Math.abs(s - raw) < Math.abs(best - raw) ? s : best), SPAN_STEPS[0]);
      if (snap !== last) { last = snap; setBlock(b.id, { span: snap }, true); }
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); setBlock(b.id, { span: last }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };

  return (
    <div className={`cv-page pat-${t.pattern} card-${t.card}${t.headerBand ? ' band' : ''}${editable ? ' editing' : ''}`} style={themeVars(t)}
      onClick={editable ? () => onSelectBlock?.(null) : undefined}>
      <div className="cv-grid" ref={gridRef} onDragEnd={() => setDrag(null)}>
        {design.blocks.map((b) => (
          <section key={b.id} className={`cv-block t-${b.type} s-${b.style} a-${b.align}${selectedBlockId === b.id ? ' sel' : ''}${drag?.over === b.id ? ` drop-${drag.pos}` : ''}${drag?.id === b.id ? ' dragging' : ''}`}
            style={{ '--span': b.span }}
            onClick={editable ? (e) => { e.stopPropagation(); onSelectBlock?.(b.id); } : undefined}
            onDragOver={editable ? (e) => onDragOver(e, b) : undefined} onDrop={editable ? onDrop : undefined}>
            {editable && (
              <div className="cv-tools" onClick={(e) => e.stopPropagation()}>
                <span className="cv-grip" draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); setDrag({ id: b.id }); onSelectBlock?.(b.id); }} title="Drag to move">⠿ {BLOCKS[b.type].label}</span>
                <span className="cv-spans">{SPANS.map(([n, l]) => <button key={n} className={b.span === n ? 'on' : ''} onClick={() => setBlock(b.id, { span: n })} title={`Width ${l}`}>{l}</button>)}</span>
                <button onClick={() => move(b.id, -1)} title="Move up">↑</button>
                <button onClick={() => move(b.id, 1)} title="Move down">↓</button>
                <button onClick={() => dup(b)} title="Duplicate">⧉</button>
                <button onClick={() => del(b)} title="Delete">✕</button>
              </div>
            )}
            {renderBlock(b)}
            {editable && <span className="cv-resize" onPointerDown={(e) => startResize(e, b)} title="Drag to resize" />}
          </section>
        ))}
        {editable && !design.blocks.length && <div className="cv-empty big">Add a block from the panel to start your page.</div>}
      </div>
    </div>
  );
}
