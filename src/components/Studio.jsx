import { useMemo, useState } from 'react';
import { applyLens, LENSES } from '../api.js';
import { THEMES, LAYOUTS } from '../themes/themes.js';
import LensSwitcher from './LensSwitcher.jsx';
import TierToggle from './TierToggle.jsx';
import PresentationView from './PresentationView.jsx';
import CodeView from './CodeView.jsx';
import StationPanel from './StationPanel.jsx';

export default function Studio({ map, drafts, audience, setAudience, tier, setTier, updateDraft, onShare, toast }) {
  const pres = drafts.find((p) => p.audience === audience) || drafts[0];
  const lens = useMemo(() => applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines }), [map, pres]);
  const [selected, setSelected] = useState(null);
  const event = map.events.find((e) => e.id === selected && lens.visible.has(e.id));
  const specific = drafts.find((p) => p.audience === 'specific');
  const set = (patch) => updateDraft(pres.id, patch);

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
        <div className="bar-group"><label>Audience</label><LensSwitcher value={audience} onChange={(a) => { setAudience(a); setSelected(null); }} targetName={specific?.targetName} /></div>
        <div className="bar-group"><label>Skill tier</label><TierToggle value={tier} onChange={setTier} /></div>
      </div>
      <p className="lens-blurb">{LENSES[pres.audience].blurb}</p>

      <div className={`studio-body tier-${tier}`}>
        <aside className="studio-controls" aria-label={`${tier} controls`}>
          {tier === 'template' && (
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
                    <i style={{ background: l.colour }} />{l.name}{l.status === 'ended' && <small> ended</small>}</label></li>
                ))}
              </ul>
              <button className="primary wide" onClick={() => onShare(pres)}>Create share link</button>
              <p className="fineprint">Three choices and a link: a polished page in about two minutes.</p>
            </>
          )}
          {tier === 'builder' && (
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
                        <i /><b>{l.name}</b>
                        <span className="spacer" />
                        <button onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${l.name} up`}>↑</button>
                        <button onClick={() => move(id, 1)} disabled={i === lens.order.length - 1} aria-label={`Move ${l.name} down`}>↓</button>
                        <button onClick={() => toggleLine(id)} aria-label={hidden ? `Show ${l.name}` : `Hide ${l.name}`}>{hidden ? 'Show' : 'Hide'}</button>
                      </div>
                      {!hidden && <textarea rows={2} placeholder={`What does your ${l.name} line say about you?`} value={pres.narratives?.[id] || ''}
                        onChange={(e) => set({ narratives: { ...pres.narratives, [id]: e.target.value } })} />}
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
          {tier === 'code' && (
            <>
              <h3>Build your own site</h3>
              <p>Export this presentation's data through the read API and build any site you like with the starter files.</p>
              <ol className="steps">
                <li>Copy <code>data.json</code> or call the endpoint.</li>
                <li>Start from <code>index.html</code> and <code>style.css</code>.</li>
                <li>Publish through the share system so links expire and log views.</li>
              </ol>
              <p className="fineprint">Tier 3 uses the same read API and visibility rules as Templates and Builder, so a hand-built site can never expose private data. The site itself becomes a portfolio station on the Computing line.</p>
            </>
          )}
        </aside>

        <div className={`studio-preview theme-${pres.theme}`}>
          {tier === 'code'
            ? <CodeView pres={pres} map={map} lens={lens} />
            : <PresentationView map={map} lens={lens} pres={pres} selectedId={selected} onSelect={setSelected} />}
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly />
        </div>
      </div>
    </div>
  );
}
