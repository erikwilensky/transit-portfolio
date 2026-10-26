import { useEffect, useMemo, useState } from 'react';
import { applyLens, getStore } from '../api.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import ReflectComposer from '../components/ReflectComposer.jsx';
import AddStation from '../components/AddStation.jsx';
import { MapLegend, VerifyLegend } from '../components/Badge.jsx';
import { TOUR_REFLECTION, TOUR_STATION, tourEvent } from '../tourStory.js';


export default function StudentMap({ map, studentId, toast, focusId, go, persona }) {
  const [hidden, setHidden] = useState([]);
  const [selected, setSelected] = useState(focusId && focusId.startsWith('ev-') ? focusId : null);
  const [signal, setSignal] = useState(null);
  const [adding, setAdding] = useState(null); // null | {} prefill
  const [newIds, setNewIds] = useState(() => new Set(focusId && focusId.startsWith('ev-') && getStore().events.find((e) => e.id === focusId)?.verification === 'student-added' ? [focusId] : []));
  const [tourStage, setTourStage] = useState(focusId === 'tour' ? 'signal' : null);
  const lens = useMemo(() => applyLens(map, null, { hiddenLines: hidden }), [map, hidden]);
  const s = map.student;
  const reflections = map.events.filter((e) => e.type === 'reflection').length + map.events.reduce((n, e) => n + e.reflections.length, 0);
  const openSignals = map.signals.filter((g) => g.open);

  useEffect(() => {
    if (tourStage === 'signal') {
      const g = map.signals.find((x) => x.kind === 'prompt' && x.open);
      if (g) setSignal(g); else if (!tourEvent()) { setTourStage('add'); setAdding(TOUR_STATION); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markNew = (id) => { setNewIds(new Set([id])); setTimeout(() => setNewIds(new Set()), 8000); };
  const event = map.events.find((e) => e.id === selected);

  return (
    <div className="home">
      <div className="home-head">
        <div className="who">
          <span className="pres-avatar" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span>
          <div>
            <h1>{s.name}</h1>
            <p>Grade {s.grade} · {s.programme} · Advisory {s.homeroom}</p>
          </div>
          <div className="stats">
            <span><b>{map.events.length}</b> stations</span>
            <span><b>{map.lines.length}</b> lines</span>
            <span><b>{reflections}</b> reflections</span>
            {openSignals.length > 0 && <button className="sig-chip" onClick={() => setSignal(openSignals[0])}><span className="sig-dot" aria-hidden="true" />{openSignals.length} open signal{openSignals.length > 1 ? 's' : ''}</button>}
          </div>
          <div className="home-actions">
            <button className="primary" onClick={() => setAdding({})}>＋ Add a station</button>
          </div>
        </div>
        <div className="chips filter" role="group" aria-label="Show or hide lines">
          {map.lines.map((l) => (
            <button key={l.id} className={`line-chip${hidden.includes(l.id) ? ' off' : ''}${l.status === 'ended' ? ' ended' : ''}`} style={{ '--c': l.colour }} aria-pressed={!hidden.includes(l.id)}
              onClick={() => setHidden(hidden.includes(l.id) ? hidden.filter((x) => x !== l.id) : [...hidden, l.id])}><i />{l.name}</button>
          ))}
        </div>
      </div>
      <div className="home-map">
        <MetroMap map={map} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => (g.open ? setSignal(g) : setSelected(g.eventId))} fitKey={studentId} newIds={newIds} />
        <StationPanel event={event} map={map} onClose={() => setSelected(null)} />
      </div>
      <div className="home-foot"><MapLegend /><VerifyLegend /><span className="hint">Tap a station or a signal · drag to pan · pinch or scroll to zoom</span></div>

      {signal && (
        <ReflectComposer signal={signal} studentId={studentId} prefill={tourStage === 'signal' ? TOUR_REFLECTION : ''}
          onClose={() => { setSignal(null); if (tourStage === 'signal') { setTourStage('add'); if (!tourEvent()) setAdding(TOUR_STATION); } }}
          onSaved={() => {
            setSignal(null); toast('Reflection saved. The signal is clear.');
            if (tourStage === 'signal') { setTourStage('add'); setTimeout(() => { if (!tourEvent()) setAdding(TOUR_STATION); }, 700); }
          }} />
      )}
      {adding && (
        <AddStation map={map} studentId={studentId} prefill={adding} onClose={() => { setAdding(null); setTourStage(null); }}
          onAdded={(e) => { setAdding(null); setTourStage(null); markNew(e.id); setSelected(e.id); toast(e.verification === 'student-added' && adding.requestFrom !== '' ? `Added “${e.title}”. Endorsement requested.` : `Added “${e.title}”`); }} />
      )}
    </div>
  );
}
