import { useEffect, useMemo, useState } from 'react';
import { applyLens, LENSES } from '../api.js';
import { THEMES, LAYOUTS } from '../themes/themes.js';
import LensSwitcher from './LensSwitcher.jsx';
import TierToggle from './TierToggle.jsx';
import PresentationView from './PresentationView.jsx';
import CodeView from './CodeView.jsx';
import StationPanel from './StationPanel.jsx';
import CustomView from '../custom/CustomView.jsx';
import CustomBuilder, { useDesignHistory } from '../custom/CustomBuilder.jsx';
import { defaultDesign } from '../custom/design.js';
import { CommentStrip } from './DraftComments.jsx';
import LensCompare from './LensCompare.jsx';
import { draftNarrative } from './drafts.js';
import { PrintButton, PrintFooter, PrintHead } from './PrintKit.jsx';
import { presentationName } from '../print.js';

export default function Studio({ level = 'full', map, drafts, audience, setAudience, tier, setTier, updateDraft, onShare, toast }) {
  const pres = drafts.find((p) => p.audience === audience) || drafts[0];
  const lens = useMemo(() => applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines }), [map, pres]);
  const [selected, setSelected] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [compare, setCompare] = useState(false);
  const [undoText, setUndoText] = useState({}); // N10: what a line said before the last draft
  const first = map.student.name.split(' ')[0];
  const event = map.events.find((e) => e.id === selected && lens.visible.has(e.id));
  const specific = drafts.find((p) => p.audience === 'specific');
  const set = (patch) => updateDraft(pres.id, patch);
  const custom = pres.layout === 'custom';
  const design = useMemo(() => pres.design || defaultDesign(map), [pres.design, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useDesignHistory(design, (d) => set({ design: d }));
  const [blockId, setBlockId] = useState(null);
  const [editing, setEditing] = useState(true);
  // Anything that reads as a document can be saved as a PDF; the Code tier shows source instead.
  const printable = !compare && (custom || tier !== 'code');
  const docTitle = presentationName(map.student.name, pres);
  useEffect(() => { if (custom && !pres.design) set({ design }); history.reset(); setBlockId(null); }, [custom, pres.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLine = (id) => {
    const h = pres.filters.hiddenLines;
    set({ filters: { ...pres.filters, hiddenLines: h.includes(id) ? h.filter((x) => x !== id) : [...h, id] } });
  };
  const move = (id, d) => {
    const order = [...lens.order];
    const i = order.indexOf(id), j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    set({ order });
  };

  return (
    <div className="studio">
      <div className="studio-bar">
        {!compare && <><div className="bar-group"><label>Audience</label><LensSwitcher value={audience} onChange={(a) => { setAudience(a); setSelected(null); }} targetName={specific?.targetName} only={level === 'simple' ? ['general', 'university', 'employer'] : level === 'standard' ? ['general', 'university', 'specific', 'employer', 'scholarship'] : null} /></div>
        {custom
          ? <div className="bar-group"><label>Mode</label><div className="seg"><button className={editing ? 'on' : ''} onClick={() => setEditing(true)}>Design</button><button className={!editing ? 'on' : ''} onClick={() => { setEditing(false); setBlockId(null); }}>Preview</button></div></div>
          : level !== 'simple' && <div className="bar-group"><label>Skill tier</label><TierToggle value={tier} onChange={setTier} only={level === 'standard' ? ['template', 'builder'] : null} /></div>}</>}
        {level === 'full' && <button className={`compare-btn${compare ? ' on' : ''}`} onClick={() => setCompare(!compare)} aria-pressed={compare}>{compare ? 'Back to editing' : 'Compare two audiences'}</button>}
        {!compare && <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-pressed={collapsed}>{collapsed ? 'Show controls' : 'Hide controls'}</button>}
      </div>
      {compare ? <LensCompare map={map} drafts={drafts} initial={audience} /> : <>
      <div className="studio-sub"><p className="lens-blurb">{LENSES[pres.audience].blurb}</p>{printable && <PrintButton title={docTitle} />}</div>
      <CommentStrip presId={pres.id} onPick={setSelected} />

      <div className={`studio-body tier-${tier}${custom ? ' custom' : ''}${collapsed ? ' collapsed' : ''}`}>
        <aside className="studio-controls" aria-label={`${custom ? 'custom page' : tier} controls`}>
          {custom && <CustomBuilder map={map} lens={lens} design={design} history={history} selectedBlockId={blockId} setSelectedBlockId={setBlockId} onShare={() => onShare(pres)} />}
          {!custom && tier === 'template' && (
            <>
              <h3>Theme</h3>
              <div className="themes">
                {Object.entries(THEMES).map(([id, t]) => (
                  <button key={id} className={`theme-pick${pres.theme === id ? ' on' : ''}`} onClick={() => set({ theme: id })} aria-pressed={pres.theme === id}>
                    <span className="sw">{t.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
                    <b>{t.label}</b><small>{t.note}</small>
                  </button>
                ))}
              </div>
              <label className="map-toggle"><input type="checkbox" checked={!!pres.showMap} onChange={() => set({ showMap: !pres.showMap })} /> Include a small journey map</label>
              <h3>Lines to show</h3>
              <ul className="line-toggles">
                {map.lines.map((l) => (
                  <li key={l.id}><label><input type="checkbox" checked={!pres.filters.hiddenLines.includes(l.id)} onChange={() => toggleLine(l.id)} />
                    <i style={{ background: l.colour }} />{l.name}</label>
                    {l.status === 'ended' && <span className="pub-note">{pres.filters.hiddenLines.includes(l.id) ? 'Ended line: private by default' : `Ended line: ${first} chose to publish it`}</span>}</li>
                ))}
              </ul>
              <button className="primary wide" onClick={() => onShare(pres)}>Create share link</button>
              <p className="fineprint">Three choices and a link: a polished page in about two minutes. Ended lines and reflections stay private unless {first} publishes them.</p>
            </>
          )}
          {!custom && tier === 'builder' && (
            <>
              <h3>Layout</h3>
              <div className="seg small">
                {Object.entries(LAYOUTS).map(([id, label]) => <button key={id} className={pres.layout === id ? 'on' : ''} onClick={() => set({ layout: id })}>{label}</button>)}
              </div>
              <label className="map-toggle"><input type="checkbox" checked={!!pres.showMap} onChange={() => set({ showMap: !pres.showMap })} /> Include a small journey map</label>
              <h3>Line order and narrative</h3>
              <ol className="builder-lines">
                {lens.order.map((id, i) => {
                  const l = map.lines.find((x) => x.id === id);
                  const hidden = lens.lineState[id] === 'hidden';
                  return (
                    <li key={id} className={hidden ? 'off' : ''} style={{ '--c': l.colour }}>
                      <div className="bl-head">
                        <i /><b>{l.name}</b>{l.status === 'ended' && <small className="vis-tag">{hidden ? 'ended · private by default' : `ended · published by ${first}`}</small>}
                        <span className="spacer" />
                        <button onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${l.name} up`}>↑</button>
                        <button onClick={() => move(id, 1)} disabled={i === lens.order.length - 1} aria-label={`Move ${l.name} down`}>↓</button>
                        <button onClick={() => toggleLine(id)} aria-label={hidden ? `Show ${l.name}` : `Hide ${l.name}`}>{hidden ? 'Show' : 'Hide'}</button>
                      </div>
                      {!hidden && <textarea rows={pres.narratives?.[id]?.length > 140 ? 5 : 2} placeholder={`What does your ${l.name} line say about you?`} value={pres.narratives?.[id] || ''}
                        onChange={(e) => set({ narratives: { ...pres.narratives, [id]: e.target.value } })} />}
                      {!hidden && (
                        <div className="bl-draft">
                          <button className="linkish" onClick={() => { const d = draftNarrative(map, lens, id, pres.audience); if (!d) return toast(`No ${l.name} stations in this presentation yet`); setUndoText({ ...undoText, [id]: pres.narratives?.[id] || '' }); set({ narratives: { ...pres.narratives, [id]: d } }); }}>{pres.narratives?.[id] ? 'Replace with a draft from my stations' : 'Draft from my stations'}</button>
                          {id in undoText && <button className="linkish" onClick={() => { set({ narratives: { ...pres.narratives, [id]: undoText[id] } }); const u = { ...undoText }; delete u[id]; setUndoText(u); }}>Undo</button>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {pres.audience === 'specific' && (
                <>
                  <h3>Why this course</h3>
                  <textarea rows={4} value={pres.whyCourse || ''} onChange={(e) => set({ whyCourse: e.target.value })} />
                </>
              )}
              <button className="primary wide" onClick={() => onShare(pres)}>Create share link</button>
            </>
          )}
          {!custom && tier === 'code' && (
            <>
              <h3>Build your own site</h3>
              <p>Export this presentation's data through the read API and build any site you like with the starter files.</p>
              <ol className="steps">
                <li>Copy <code>data.json</code> or call the endpoint.</li>
                <li>Start from <code>index.html</code> and <code>style.css</code>.</li>
                <li>Publish through the share system so links expire and log views.</li>
              </ol>
              <p className="fineprint">Tier 3 uses the same read API and visibility rules as Templates and Builder, so a hand-built site can never expose private data. The site itself becomes a portfolio station on the Computing line.</p>
              <h3>Publish</h3>
              {pres.site?.token ? (
                <div className="site-live">
                  <p><b>Your site is live</b> at <code>/s/{pres.site.token}</code>. Edits to index.html show up there straight away.</p>
                  <a className="ghost" href={`#/s/${pres.site.token}`} target="_blank" rel="noreferrer">Open my site</a>
                </div>
              ) : (
                <>
                  <p className="fineprint">{pres.site?.html != null ? 'Publishes your index.html' : 'Publishes the starter index.html (edit or upload your own first if you like)'} under a share link that expires and logs views.</p>
                  <button className="primary wide" onClick={() => onShare(pres, { site: true })}>Publish my site</button>
                </>
              )}
            </>
          )}
        </aside>

        <div className={`studio-preview theme-${pres.theme}`}>
          {printable && !custom && <PrintHead kicker={LENSES[pres.audience].label} />}
          {custom
            ? <CustomView map={map} lens={lens} design={design} editable={editing} selectedBlockId={blockId} onSelectBlock={setBlockId} onChange={history.commit} onOpenStation={setSelected} />
            : tier === 'code'
            ? <CodeView pres={pres} map={map} lens={lens} onHtml={(h) => set({ site: { ...(pres.site || {}), html: h } })} />
            : <PresentationView map={map} lens={lens} pres={pres} selectedId={selected} onSelect={setSelected} />}
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly />
          {printable && <PrintFooter name={map.student.name} margin={custom ? '10mm 10mm 17mm' : undefined} />}
        </div>
      </div>
      </>}
    </div>
  );
}
