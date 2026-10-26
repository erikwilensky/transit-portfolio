import { useEffect, useMemo, useRef, useState } from 'react';
import { getIntegrations, sync } from '../api.js';
import { ago } from '../format.js';
import MetroMap from './MetroMap.jsx';
import StationPanel from './StationPanel.jsx';

const GLYPH = { sis: 'SIS', lms: 'LMS', cas: 'CAS', clubs: 'CLB', github: 'GH', exams: 'EXM' };

export default function IntegrationsPanel({ map, lens, newIds, onSynced, version }) {
  const [syncing, setSyncing] = useState([]);
  const [selected, setSelected] = useState(null);
  const [, tick] = useState(0);
  const mapRef = useRef(null);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const integrations = useMemo(() => getIntegrations(map.student.id), [map, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPending = integrations.reduce((n, i) => n + i.pendingForStudent, 0);

  const run = (ids) => {
    setSyncing(ids);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
      const added = sync(ids, map.student.id);
      setSyncing([]);
      onSynced(added);
    }, 1400);
  };
  const event = map.events.find((e) => e.id === selected);

  return (
    <div className="integrations">
      <div className="flow" aria-label="Data flow">
        <div className={`flow-box${syncing.length ? ' busy' : ''}`}><b>Adapters</b><small>one per school system</small></div>
        <div className={`flow-pipe${syncing.length ? ' busy' : ''}`}><i /><i /><i /></div>
        <div className="flow-box core"><b>Verified data core</b><small>events · lines · evidence · consent</small></div>
        <div className="flow-pipe"><i /><i /><i /></div>
        <div className="flow-box"><b>Presentations</b><small>read-only lenses</small></div>
      </div>

      <div className="int-head">
        <h2>Connected systems</h2>
        <button className="primary" onClick={() => run(integrations.map((i) => i.id))} disabled={!!syncing.length}>
          {syncing.length ? 'Syncing…' : `Sync all${totalPending ? ` (${totalPending} new)` : ''}`}
        </button>
      </div>
      <div className="int-grid">
        {integrations.map((i) => {
          const busy = syncing.includes(i.id);
          return (
            <article key={i.id} className={`int-card${busy ? ' busy' : ''}`}>
              <div className="int-top">
                <span className="int-glyph">{GLYPH[i.id]}</span>
                <div><h3>{i.name}</h3><small>{i.detail} · {i.mode}</small></div>
              </div>
              <dl>
                <dt>Last synced</dt><dd>{busy ? 'syncing…' : ago(i.lastSynced)}</dd>
                <dt>Items</dt><dd>{i.itemCount.toLocaleString()}</dd>
              </dl>
              <div className="int-foot">
                <span className={`pending${i.pendingForStudent ? ' has' : ''}`}>{i.pendingForStudent ? `${i.pendingForStudent} new for ${map.student.name.split(' ')[0]}` : 'Up to date'}</span>
                <button onClick={() => run([i.id])} disabled={!!syncing.length}>Sync</button>
              </div>
              <div className="int-progress"><i /></div>
            </article>
          );
        })}
      </div>

      <div className="int-map" ref={mapRef}>
        <div className="int-map-head">
          <h2>{map.student.name}'s map</h2>
          <span className="fineprint">New items arrive as advisor-only until the student chooses to publish them. Every item keeps its source reference.</span>
        </div>
        <div className="int-map-frame">
          <MetroMap map={map} lens={lens} newIds={newIds} selectedId={selected} onSelect={setSelected} fitKey={map.student.id} />
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}
