import { useEffect, useMemo, useState } from 'react';
import { applyLens, getStore, getStudentMap, suggestInterchanges } from '../api.js';
import LineDialog from '../components/LineDialog.jsx';
import PhoneCapture from '../components/PhoneCapture.jsx';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import ReflectComposer from '../components/ReflectComposer.jsx';
import AddStation from '../components/AddStation.jsx';
import GoalDialog from '../components/GoalDialog.jsx';
import TermReview from '../components/TermReview.jsx';
import { MapLegend, VerifyLegend } from '../components/Badge.jsx';
import { TOUR_REFLECTION, TOUR_STATION, tourEvent } from '../tourStory.js';


const TODAY_STR = '2026-10-26';
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const countRefl = (m) => m.events.filter((e) => e.type === 'reflection').length + m.events.reduce((n, e) => n + e.reflections.length, 0);
const SEE = [['student', 'Me'], ['advisor', 'Advisor'], ['school', 'School'], ['public', 'Public']];

export default function StudentMap({ map, studentId, toast, focusId, go, persona }) {
  const [hidden, setHidden] = useState([]);
  const [selected, setSelected] = useState(focusId && focusId.startsWith('ev-') ? focusId : null);
  const [signal, setSignal] = useState(null);
  const [adding, setAdding] = useState(null); // null | {} prefill
  const [newIds, setNewIds] = useState(() => new Set(focusId && focusId.startsWith('ev-') && getStore().events.find((e) => e.id === focusId)?.verification === 'student-added' ? [focusId] : []));
  const [tourStage, setTourStage] = useState(focusId === 'tour' ? 'signal' : null);
  const [seeAs, setSeeAs] = useState('student');
  const [scrub, setScrub] = useState(null); // null = today; otherwise a day index
  const [playing, setPlaying] = useState(false);
  const [lineMode, setLineMode] = useState(null);
  const [menu, setMenu] = useState(false);
  const [phone, setPhone] = useState(false);
  const [goal, setGoal] = useState(false);
  const [review, setReview] = useState(false);
  const sugCount = useMemo(() => suggestInterchanges(studentId).length, [studentId, map]);
  // X2: the same record as another viewer is allowed to read it (filtered in api.js, not here).
  const seen = useMemo(() => (seeAs === 'student' ? map : getStudentMap(studentId, seeAs)), [map, seeAs, studentId]);
  // X3: time travel. Days from the first station to today.
  const first = map.events[0]?.date || TODAY_STR;
  const span = Math.max(1, dayDiff(first, TODAY_STR));
  const at = scrub === null ? TODAY_STR : addDays(first, scrub);
  const shown = useMemo(() => {
    if (scrub === null) return seen;
    const events = seen.events.filter((e) => e.date <= at);
    const ids = new Set(events.map((e) => e.id));
    // A line that ends later is still running at this date.
    const lines = seen.lines.map((l) => (l.status === 'ended' && seen.events.some((e) => e.lineIds.includes(l.id) && e.date > at) ? { ...l, status: 'active' } : l));
    return { ...seen, events, lines, signals: seen.signals.filter((g) => ids.has(g.eventId)) };
  }, [seen, scrub, at]);
  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => setScrub((v) => { const n = (v ?? 0) + 9; if (n >= span) { setPlaying(false); return null; } return n; }), 60);
    return () => clearInterval(t);
  }, [playing, span]);
  const lens = useMemo(() => applyLens(shown, null, { hiddenLines: hidden }), [shown, hidden]);
  const s = map.student;
  const reflections = countRefl(map);
  const openSignals = map.signals.filter((g) => g.open);

  useEffect(() => {
    if (tourStage === 'signal') {
      const g = map.signals.find((x) => x.kind === 'prompt' && x.open);
      if (g) setSignal(g); else if (!tourEvent()) { setTourStage('add'); setAdding(TOUR_STATION); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markNew = (id) => { setNewIds(new Set([id])); setTimeout(() => setNewIds(new Set()), 8000); };
  const event = shown.events.find((e) => e.id === selected);

  return (
    <div className="home">
      <div className="home-head">
        <div className="who">
          <span className="pres-avatar" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span>
          <div>
            <h1>{s.name}</h1>
            <p>Year {s.grade + 1} · {s.programme} · Advisory {s.homeroom}</p>
          </div>
          <div className="stats">
            <span><b>{map.events.length}</b> stations</span>
            <span><b>{map.lines.length}</b> lines</span>
            <span><b>{reflections}</b> reflections</span>
            {openSignals.length > 0 && <button className="sig-chip" onClick={() => setSignal(openSignals[0])}><span className="sig-dot" aria-hidden="true" />{openSignals.length} open signal{openSignals.length > 1 ? 's' : ''}</button>}
          </div>
          <div className="home-actions">
            <button className="ghost" onClick={() => setReview(true)}>Term in review{sugCount > 0 && <span className="badge-n" aria-label={`${sugCount} suggestions`}>{sugCount}</span>}</button>
            <button className="ghost" onClick={() => setPhone(true)}>Capture on phone</button>
            <div className="menu-wrap">
              <button className="ghost" onClick={() => setMenu(!menu)} aria-expanded={menu}>Plan ▾</button>
              {menu && <div className="menu" role="menu" style={{ width: 240 }}>
                <button role="menuitem" onClick={() => { setMenu(false); setGoal(true); }}><span><b>Plan a goal</b><small>A dashed station, with a sponsor if you like</small></span></button>
                <button role="menuitem" onClick={() => { setMenu(false); setLineMode('branch'); }}><span><b>Start a branch</b><small>A sub-line under a school line</small></span></button>
                <button role="menuitem" onClick={() => { setMenu(false); setLineMode('end'); }}><span><b>End a line</b><small>Terminus, then a reflection</small></span></button>
              </div>}
            </div>
            <button className="primary" onClick={() => setAdding({})}>＋ Add a station</button>
          </div>
        </div>
        <div className="see-as" role="group" aria-label="See my map as">
          <span>See as</span>
          <div className="seg small">{SEE.map(([k, l]) => <button key={k} className={seeAs === k ? 'on' : ''} aria-pressed={seeAs === k} onClick={() => { setSeeAs(k); setSelected(null); }}>{l}</button>)}</div>
          {seeAs !== 'student' && <span className="see-note"><b>{seen.events.length}</b> of {map.events.length} stations and <b>{countRefl(seen)}</b> of {reflections} reflections visible to {seeAs === 'public' ? 'anyone with a link' : seeAs === 'school' ? 'school staff' : 'your advisor'}</span>}
        </div>
        <div className="chips filter" role="group" aria-label="Show or hide lines">
          {map.lines.map((l) => (
            <button key={l.id} className={`line-chip${hidden.includes(l.id) ? ' off' : ''}${l.status === 'ended' ? ' ended' : ''}`} style={{ '--c': l.colour }} aria-pressed={!hidden.includes(l.id)}
              onClick={() => setHidden(hidden.includes(l.id) ? hidden.filter((x) => x !== l.id) : [...hidden, l.id])}><i />{l.name}</button>
          ))}
        </div>
      </div>
      <div className="home-map">
        <MetroMap map={shown} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => (g.open ? setSignal(g) : setSelected(g.eventId))} fitKey={studentId} newIds={newIds} />
        <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly={seeAs !== 'student'} toast={toast} />
      </div>
      <div className="scrubber">
        <button className="icon-btn" onClick={() => { if (playing) setPlaying(false); else { if (scrub === null) setScrub(0); setPlaying(true); } }} aria-label={playing ? 'Pause' : 'Play the journey'}>{playing ? '❚❚' : '▶'}</button>
        <input type="range" min={0} max={span} value={scrub ?? span} onChange={(e) => { setPlaying(false); const v = +e.target.value; setScrub(v >= span ? null : v); }} aria-label="Travel through time" />
        <span className="scrub-date">{scrub === null ? 'Today' : new Date(at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
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
      {lineMode && <LineDialog mode={lineMode} map={map} studentId={studentId} onClose={() => setLineMode(null)} onDone={(r, msg) => {
        setLineMode(null); toast(msg);
        if (r?.id) markNew(r.id);
        if (r?.endedLine) setTimeout(() => { const g = getStudentMap(studentId).signals.find((x) => x.kind === 'terminus' && x.lineId === r.endedLine && x.open); if (g) setSignal(g); }, 600);
      }} />}
      {goal && <GoalDialog map={map} studentId={studentId} onClose={() => setGoal(false)} onDone={(e, msg) => { setGoal(false); toast(msg); markNew(e.id); setSelected(e.id); }} />}
      {review && <TermReview map={map} studentId={studentId} toast={toast} onClose={() => setReview(false)} onOpen={(id) => { setReview(false); setSelected(id); }} />}
      {phone && <PhoneCapture map={map} studentId={studentId} onClose={() => setPhone(false)} onSent={() => { setPhone(false); go(persona.id, 'inbox'); }} />}
      {adding && (
        <AddStation map={map} studentId={studentId} prefill={adding} onClose={() => { setAdding(null); setTourStage(null); }}
          onAdded={(e) => { setAdding(null); setTourStage(null); markNew(e.id); setSelected(e.id); toast(e.verification === 'student-added' && adding.requestFrom !== '' ? `Added “${e.title}”. Endorsement requested.` : `Added “${e.title}”`); }} />
      )}
    </div>
  );
}
