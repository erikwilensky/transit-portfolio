import { useEffect, useRef, useState } from 'react';
import { BLOCKS, FONTS, PRESETS, SPANS, newBlock, defaultDesign } from './design.js';
import { TYPE_LABEL } from '../format.js';

// Undo/redo for the design. Transient changes (mid-drag resize) skip history.
export function useDesignHistory(design, save) {
  const past = useRef([]), future = useRef([]);
  const [, bump] = useState(0);
  const commit = (next, transient) => {
    if (!transient) { past.current.push(design); if (past.current.length > 80) past.current.shift(); future.current = []; }
    save(next); bump((n) => n + 1);
  };
  const undo = () => { const prev = past.current.pop(); if (!prev) return; future.current.push(design); save(prev); bump((n) => n + 1); };
  const redo = () => { const next = future.current.pop(); if (!next) return; past.current.push(design); save(next); bump((n) => n + 1); };
  const reset = () => { past.current = []; future.current = []; bump((n) => n + 1); };
  return { commit, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

const Seg = ({ value, options, onChange }) => (
  <div className="seg small cb-seg">{options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
);
const Field = ({ label, children }) => <label className="cb-field"><span>{label}</span>{children}</label>;

export default function CustomBuilder({ map, lens, design, history, selectedBlockId, setSelectedBlockId, onShare }) {
  const [tab, setTab] = useState('blocks');
  const [dragId, setDragId] = useState(null);
  const { commit } = history;
  const t = design.theme;
  const sel = design.blocks.find((b) => b.id === selectedBlockId);
  const vis = map.events.filter((e) => lens.visible.has(e.id));
  const past = vis.filter((e) => e.type !== 'goal');
  const lines = map.lines.filter((l) => lens.lineState[l.id] !== 'hidden');

  useEffect(() => { if (sel) setTab('blocks'); }, [selectedBlockId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => {
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? history.redo() : history.undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !typing) { e.preventDefault(); commit({ ...design, blocks: design.blocks.filter((b) => b.id !== sel.id) }); setSelectedBlockId(null); }
      if (e.key === 'Escape' && !typing) setSelectedBlockId(null);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  const setTheme = (patch) => commit({ ...design, theme: { ...t, ...patch, preset: patch.preset || 'custom' } });
  const setBlock = (patch) => commit({ ...design, blocks: design.blocks.map((b) => (b.id === sel.id ? { ...b, ...patch } : b)) });
  const setProps = (patch) => setBlock({ props: { ...sel.props, ...patch } });
  const add = (type) => {
    const b = newBlock(type, map);
    const blocks = [...design.blocks];
    const i = sel ? blocks.indexOf(sel) + 1 : blocks.length;
    blocks.splice(i, 0, b);
    commit({ ...design, blocks }); setSelectedBlockId(b.id);
  };
  const reorder = (overId) => {
    if (!dragId || dragId === overId) return;
    const blocks = design.blocks.filter((b) => b.id !== dragId);
    blocks.splice(blocks.findIndex((b) => b.id === overId), 0, design.blocks.find((b) => b.id === dragId));
    commit({ ...design, blocks });
  };

  const stationSelect = (value, onChange, filter = () => true) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Choose a station…</option>
      {lines.map((l) => {
        const evs = past.filter((e) => e.lineIds[0] === l.id && filter(e));
        return evs.length > 0 && <optgroup key={l.id} label={l.name}>{evs.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</optgroup>;
      })}
    </select>
  );
  const lineSelect = (value, onChange) => (
    <select value={value || 'all'} onChange={(e) => onChange(e.target.value)}>
      <option value="all">All lines</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
  const headingField = () => <Field label="Heading"><input value={sel.props.heading || ''} onChange={(e) => setProps({ heading: e.target.value })} placeholder="(no heading)" /></Field>;

  const inspector = () => {
    const p = sel.props;
    switch (sel.type) {
      case 'hero': return (<>
        <Field label="Name"><input value={p.title} onChange={(e) => setProps({ title: e.target.value })} /></Field>
        <Field label="Subtitle"><input value={p.subtitle} onChange={(e) => setProps({ subtitle: e.target.value })} /></Field>
        <Field label="Tagline"><textarea rows={2} value={p.tagline} onChange={(e) => setProps({ tagline: e.target.value })} /></Field>
        <Field label="Layout"><Seg value={p.layout} onChange={(v) => setProps({ layout: v })} options={[['left', 'Left'], ['center', 'Centred'], ['split', 'With map']]} /></Field>
        <label className="cb-check"><input type="checkbox" checked={p.avatar} onChange={() => setProps({ avatar: !p.avatar })} /> Show avatar</label>
      </>);
      case 'text': return (<>{headingField()}<Field label="Text"><textarea rows={6} value={p.body} onChange={(e) => setProps({ body: e.target.value })} /></Field></>);
      case 'map': return (<>
        <Field label="Height"><Seg value={p.height} onChange={(v) => setProps({ height: v })} options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} /></Field>
        <Field label="Lines on this map">
          <ul className="cb-list">{lines.map((l) => {
            const on = !p.lines.length || p.lines.includes(l.id);
            const all = lines.map((x) => x.id);
            const next = on ? (p.lines.length ? p.lines : all).filter((x) => x !== l.id) : [...p.lines, l.id];
            return <li key={l.id}><label><input type="checkbox" checked={on} onChange={() => setProps({ lines: next.length === all.length ? [] : next })} /><i style={{ background: l.colour }} />{l.name}</label></li>;
          })}</ul>
        </Field>
      </>);
      case 'feature': return (<>
        <Field label="Station">{stationSelect(p.eventId, (v) => setProps({ eventId: v }))}</Field>
        <Field label="Image"><Seg value={p.imageSide} onChange={(v) => setProps({ imageSide: v })} options={[['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['none', 'None']]} /></Field>
        <label className="cb-check"><input type="checkbox" checked={p.showReflection} onChange={() => setProps({ showReflection: !p.showReflection })} /> Show reflection</label>
        <label className="cb-check"><input type="checkbox" checked={p.showEndorsement} onChange={() => setProps({ showEndorsement: !p.showEndorsement })} /> Show teacher endorsement</label>
      </>);
      case 'stations': return (<>
        {headingField()}
        <Field label="Choose stations"><Seg value={p.source} onChange={(v) => setProps({ source: v })} options={[['line', 'By line and type'], ['pick', 'Pick by hand']]} /></Field>
        {p.source === 'line' ? (<>
          <Field label="Line">{lineSelect(p.lineId, (v) => setProps({ lineId: v }))}</Field>
          <Field label="Types">
            <div className="cb-tags">{Object.entries(TYPE_LABEL).filter(([k]) => k !== 'goal').map(([k, l]) => (
              <button key={k} className={p.types.includes(k) ? 'on' : ''} onClick={() => setProps({ types: p.types.includes(k) ? p.types.filter((x) => x !== k) : [...p.types, k] })}>{l}</button>
            ))}</div>
          </Field>
          <Field label={`Show up to ${p.limit}`}><input type="range" min={1} max={12} value={p.limit} onChange={(e) => setProps({ limit: +e.target.value })} /></Field>
        </>) : (
          <Field label={`${p.eventIds.length} picked`}>
            <ul className="cb-list scroll">{past.map((e) => (
              <li key={e.id}><label><input type="checkbox" checked={p.eventIds.includes(e.id)} onChange={() => setProps({ eventIds: p.eventIds.includes(e.id) ? p.eventIds.filter((x) => x !== e.id) : [...p.eventIds, e.id] })} />{e.title}</label></li>
            ))}</ul>
          </Field>
        )}
        <Field label="Style"><Seg value={p.style} onChange={(v) => setProps({ style: v })} options={[['cards', 'Cards'], ['list', 'List'], ['compact', 'Compact']]} /></Field>
        <Field label="Columns"><Seg value={p.columns} onChange={(v) => setProps({ columns: v })} options={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} /></Field>
        <label className="cb-check"><input type="checkbox" checked={p.showImages} onChange={() => setProps({ showImages: !p.showImages })} /> Show images</label>
      </>);
      case 'gallery': return (<>
        {headingField()}
        <Field label="Line">{lineSelect(p.lineId, (v) => setProps({ lineId: v }))}</Field>
        <Field label={`Up to ${p.limit} images`}><input type="range" min={1} max={12} value={p.limit} onChange={(e) => setProps({ limit: +e.target.value })} /></Field>
        <Field label="Columns"><Seg value={p.columns} onChange={(v) => setProps({ columns: v })} options={[[1, '1'], [2, '2'], [3, '3'], [4, '4']]} /></Field>
      </>);
      case 'quote': return (<>
        <Field label="Quote from"><Seg value={p.source} onChange={(v) => setProps({ source: v })} options={[['reflection', 'My reflection'], ['endorsement', 'A teacher']]} /></Field>
        <Field label="Station">{stationSelect(p.eventId, (v) => setProps({ eventId: v }), (e) => (p.source === 'endorsement' ? e.endorsements.length : e.reflections?.length))}</Field>
        <Field label="Size"><Seg value={p.size} onChange={(v) => setProps({ size: v })} options={[['m', 'M'], ['l', 'L'], ['xl', 'XL']]} /></Field>
      </>);
      case 'stats': return (
        <Field label="Numbers to show">
          <div className="cb-tags">{[['stations', 'Stations'], ['lines', 'Lines'], ['endorsements', 'Endorsements'], ['reflections', 'Reflections'], ['interchanges', 'Interchanges'], ['years', 'Years']].map(([k, l]) => (
            <button key={k} className={p.items.includes(k) ? 'on' : ''} onClick={() => setProps({ items: p.items.includes(k) ? p.items.filter((x) => x !== k) : [...p.items, k] })}>{l}</button>
          ))}</div>
        </Field>
      );
      case 'timeline': return (<>{headingField()}<Field label="Line">{lineSelect(p.lineId, (v) => setProps({ lineId: v }))}</Field>
        <Field label={`Last ${p.limit} stops`}><input type="range" min={2} max={16} value={p.limit} onChange={(e) => setProps({ limit: +e.target.value })} /></Field></>);
      case 'skills': return (<>{headingField()}
        <Field label="Tags">
          <div className="cb-tags">{p.tags.map((tag, i) => <button key={i} className="on" onClick={() => setProps({ tags: p.tags.filter((_, j) => j !== i) })} title="Remove">{tag} ✕</button>)}</div>
          <input placeholder="Add a skill and press Enter" onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { setProps({ tags: [...p.tags, e.currentTarget.value.trim()] }); e.currentTarget.value = ''; } }} />
        </Field></>);
      case 'lines': case 'goals': return headingField();
      case 'divider': return <Field label="Style"><Seg value={p.style} onChange={(v) => setProps({ style: v })} options={[['space', 'Space'], ['line', 'Line'], ['metro', 'Metro']]} /></Field>;
      default: return null;
    }
  };

  return (
    <div className="cbuilder">
      <div className="cb-top">
        <Seg value={tab} onChange={(v) => { setTab(v); if (v === 'style') setSelectedBlockId(null); }} options={[['blocks', 'Blocks'], ['style', 'Style']]} />
        <span className="spacer" />
        <button className="icon-btn" onClick={history.undo} disabled={!history.canUndo} title="Undo (⌘Z)">↶</button>
        <button className="icon-btn" onClick={history.redo} disabled={!history.canRedo} title="Redo (⇧⌘Z)">↷</button>
      </div>

      {tab === 'blocks' && sel && (
        <div className="cb-inspector">
          <button className="cb-back" onClick={() => setSelectedBlockId(null)}>‹ All blocks</button>
          <h3>{BLOCKS[sel.type].icon} {BLOCKS[sel.type].label}</h3>
          <Field label="Width"><Seg value={sel.span} onChange={(v) => setBlock({ span: v })} options={SPANS} /></Field>
          <Field label="Look"><Seg value={sel.style} onChange={(v) => setBlock({ style: v })} options={[['plain', 'Plain'], ['card', 'Card'], ['accent', 'Accent'], ['inverse', 'Bold']]} /></Field>
          <Field label="Align"><Seg value={sel.align} onChange={(v) => setBlock({ align: v })} options={[['left', 'Left'], ['center', 'Centre']]} /></Field>
          <hr />
          {inspector()}
        </div>
      )}

      {tab === 'blocks' && !sel && (
        <>
          <h3>Add a block</h3>
          <div className="cb-palette">
            {Object.entries(BLOCKS).map(([k, b]) => <button key={k} onClick={() => add(k)} title={b.hint}><span>{b.icon}</span>{b.label}</button>)}
          </div>
          <h3>On your page</h3>
          <ol className="cb-order">
            {design.blocks.map((b) => (
              <li key={b.id} draggable onDragStart={() => setDragId(b.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { reorder(b.id); setDragId(null); }} onDragEnd={() => setDragId(null)}
                className={dragId === b.id ? 'dragging' : ''} onClick={() => setSelectedBlockId(b.id)}>
                <span className="grip">⠿</span><span>{BLOCKS[b.type].icon}</span><b>{BLOCKS[b.type].label}</b>
                <small>{b.props.heading || b.props.title || ''}</small><span className="w">{SPANS.find(([n]) => n === b.span)?.[1]}</span>
              </li>
            ))}
          </ol>
          <p className="fineprint">Drag blocks here or on the page. Drag a block's right edge to resize. Click text on the page to edit it. Verified stations can be placed, never edited.</p>
        </>
      )}

      {tab === 'style' && (
        <div className="cb-style">
          <h3>Start from</h3>
          <div className="cb-presets">
            {Object.entries(PRESETS).map(([k, pr]) => (
              <button key={k} className={t.preset === k ? 'on' : ''} onClick={() => setTheme({ ...pr, preset: k })} style={{ background: pr.bg, color: pr.ink, fontFamily: FONTS[pr.font].head, borderRadius: Math.min(pr.radius, 12) }}>
                <span className="dots"><i style={{ background: pr.accent }} /><i style={{ background: pr.accent2 }} /><i style={{ background: pr.surface, border: `1px solid ${pr.muted}` }} /></span>{pr.label}
              </button>
            ))}
          </div>
          <h3>Colours</h3>
          <div className="cb-colours">
            {[['bg', 'Background'], ['surface', 'Cards'], ['ink', 'Text'], ['muted', 'Soft text'], ['accent', 'Accent'], ['accent2', 'Second accent']].map(([k, l]) => (
              <label key={k}><input type="color" value={t[k]} onChange={(e) => setTheme({ [k]: e.target.value })} /><span>{l}</span></label>
            ))}
          </div>
          <h3>Fonts</h3>
          <div className="cb-fonts">
            {Object.entries(FONTS).map(([k, f]) => (
              <button key={k} className={t.font === k ? 'on' : ''} onClick={() => setTheme({ font: k })}><b style={{ fontFamily: f.head }}>Aa</b><span style={{ fontFamily: f.body }}>{f.label}</span></button>
            ))}
          </div>
          <Field label={`Corners: ${t.radius}px`}><input type="range" min={0} max={28} value={t.radius} onChange={(e) => setTheme({ radius: +e.target.value })} /></Field>
          <Field label="Background"><Seg value={t.pattern} onChange={(v) => setTheme({ pattern: v })} options={[['none', 'Plain'], ['dots', 'Dots'], ['grid', 'Grid'], ['lines', 'Lines'], ['gradient', 'Glow']]} /></Field>
          <Field label="Cards"><Seg value={t.card} onChange={(v) => setTheme({ card: v })} options={[['flat', 'Flat'], ['outline', 'Outline'], ['shadow', 'Shadow'], ['glass', 'Glass']]} /></Field>
          <Field label="Spacing"><Seg value={t.spacing} onChange={(v) => setTheme({ spacing: v })} options={[['compact', 'Compact'], ['cosy', 'Cosy'], ['airy', 'Airy']]} /></Field>
          <Field label="Page width"><Seg value={t.width} onChange={(v) => setTheme({ width: v })} options={[['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']]} /></Field>
          <label className="cb-check"><input type="checkbox" checked={!!t.headerBand} onChange={() => setTheme({ headerBand: !t.headerBand })} /> Colour band behind the hero</label>
          <button className="ghost wide" onClick={() => { if (confirm('Start again from the suggested page? You can undo this.')) commit(defaultDesign(map)); }}>Reset to suggested page</button>
        </div>
      )}
      <button className="primary wide" onClick={onShare}>Create share link</button>
    </div>
  );
}
