import { useMemo, useState } from 'react';
import { applyLens, LENSES } from '../api.js';
import { fmtDate } from '../format.js';
import MetroMap from './MetroMap.jsx';

// N3: one record through two audiences at once. The middle ribbon lists what changed between them;
// hovering a row lights the station on both maps.
const KINDS = [
  ['grew', '↑', 'Grew', 'full on the right, thin on the left'],
  ['added', '+', 'Only on the right', ''],
  ['faded', '↓', 'Faded', 'full on the left, thin on the right'],
  ['dropped', '×', 'Only on the left', ''],
  ['moved', '↕', 'Moved', 'its line sits higher or lower'],
];

const emphasis = (e, lens) => (e.lineIds.some((id) => lens.lineState[id] === 'full') ? 'full' : 'thin');

export default function LensCompare({ map, drafts, initial }) {
  const opts = drafts.filter((p) => p.audience !== 'custom');
  const [a, setA] = useState(initial && !['custom', 'general'].includes(initial) ? initial : 'university');
  const [b, setB] = useState(a === 'employer' ? 'university' : 'employer');
  const [hl, setHl] = useState(null);
  const [showKept, setShowKept] = useState(false);
  const pa = opts.find((p) => p.audience === a) || opts[0];
  const pb = opts.find((p) => p.audience === b) || opts[1];
  const la = useMemo(() => applyLens(map, pa, { hiddenLines: pa.filters.hiddenLines }), [map, pa]);
  const lb = useMemo(() => applyLens(map, pb, { hiddenLines: pb.filters.hiddenLines }), [map, pb]);
  const rows = useMemo(() => {
    const out = [];
    for (const e of map.events) {
      if (e.type === 'goal') continue;
      const inA = la.visible.has(e.id), inB = lb.visible.has(e.id);
      if (!inA && !inB) continue;
      let kind = 'kept';
      if (inA && !inB) kind = 'dropped';
      else if (!inA && inB) kind = 'added';
      else {
        const ea = emphasis(e, la), eb = emphasis(e, lb);
        if (ea === 'thin' && eb === 'full') kind = 'grew';
        else if (ea === 'full' && eb === 'thin') kind = 'faded';
        else if (la.order.indexOf(e.lineIds[0]) !== lb.order.indexOf(e.lineIds[0])) kind = 'moved';
      }
      out.push({ e, kind });
    }
    return out;
  }, [map, la, lb]);
  const n = (k) => rows.filter((r) => r.kind === k).length;
  const pick = (val, set, other) => (
    <select value={val} onChange={(ev) => set(ev.target.value)} aria-label="Audience">
      {opts.map((p) => <option key={p.audience} value={p.audience} disabled={p.audience === other}>{LENSES[p.audience].label}</option>)}
    </select>
  );
  const lineOf = (e) => map.lines.find((l) => l.id === e.lineIds[0]);
  return (
    <div className="lens-compare">
      <p className="lc-sum">
        <b>{la.visible.size}</b> stations for {LENSES[a].label}, <b>{lb.visible.size}</b> for {LENSES[b].label}. Same verified record: {[
          n('grew') && `${n('grew')} grow`, n('faded') && `${n('faded')} fade`, (n('added') + n('dropped')) && `${n('added') + n('dropped')} appear in only one`, `${n('kept') + n('moved')} stay as they are`,
        ].filter(Boolean).join(', ')}.
      </p>
      <div className="lc-grid">
        <section className="lc-col">
          <header>{pick(a, setA, b)}<small>{LENSES[a].blurb}</small></header>
          <div className="lc-map"><MetroMap map={map} lens={la} selectedId={hl} panel={false} fitKey={`lc-a-${a}`} showToday={false} /></div>
        </section>
        <section className="lc-ribbon" aria-label="What changes between the two">
          <h3>What changes</h3>
          {KINDS.map(([k, ic, label, note]) => {
            const list = rows.filter((r) => r.kind === k);
            if (!list.length) return null;
            return (
              <div key={k} className={`lc-group k-${k}`}>
                <h4><span className="lc-ic" aria-hidden="true">{ic}</span>{label} <small>{list.length}{note ? ` · ${note}` : ''}</small></h4>
                <ul>{list.map(({ e }) => (
                  <li key={e.id} onPointerEnter={() => setHl(e.id)} onPointerLeave={() => setHl(null)} onFocus={() => setHl(e.id)} onBlur={() => setHl(null)} tabIndex={0} className={hl === e.id ? 'on' : ''}>
                    <i style={{ background: lineOf(e)?.colour }} /><span><b>{e.title}</b><small>{fmtDate(e.date)}</small></span>
                  </li>
                ))}</ul>
              </div>
            );
          })}
          <button className="linkish" onClick={() => setShowKept(!showKept)}>{showKept ? 'Hide' : 'Show'} the {n('kept')} that stay the same</button>
          {showKept && <ul className="lc-kept">{rows.filter((r) => r.kind === 'kept').map(({ e }) => <li key={e.id} onPointerEnter={() => setHl(e.id)} onPointerLeave={() => setHl(null)}><i style={{ background: lineOf(e)?.colour }} />{e.title}</li>)}</ul>}
        </section>
        <section className="lc-col">
          <header>{pick(b, setB, a)}<small>{LENSES[b].blurb}</small></header>
          <div className="lc-map"><MetroMap map={map} lens={lb} selectedId={hl} panel={false} fitKey={`lc-b-${b}`} showToday={false} /></div>
        </section>
      </div>
    </div>
  );
}
