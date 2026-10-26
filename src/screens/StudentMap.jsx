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
import { MapLegend, VerifyBadge, VerifyLegend } from '../components/Badge.jsx';
import { fmtDate, fmtTerm, TYPE_LABEL, VERIFY_LABEL } from '../format.js';
import { TOUR_REFLECTION, TOUR_STATION, tourEvent } from '../tourStory.js';


const TODAY_STR = '2026-10-26';
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const countRefl = (m) => m.events.filter((e) => e.type === 'reflection').length + m.events.reduce((n, e) => n + e.reflections.length, 0);
const yearOf = (e, s) => fmtTerm(e.date, s.g9StartYear, s.startGrade).split(',')[0];
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
  // F10: search and filters narrow the map itself; the list view reads the same result.
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [ver, setVer] = useState('');
  const [year, setYear] = useState('');
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 600 ? 'list' : 'map'));
  const filtering = q.trim() || kind || ver || year;
  const base = useMemo(() => applyLens(shown, null, { hiddenLines: hidden }), [shown, hidden]);
  const lens = useMemo(() => {
    if (!filtering) return base;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visible = new Set([...base.visible].filter((id) => {
      const e = shown.events.find((x) => x.id === id);
      const hay = `${e.title} ${e.summary} ${e.about || ''} ${e.reflections.map((r) => r.text).join(' ')} ${e.lineIds.map((l) => shown.lines.find((x) => x.id === l)?.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w)) && (!kind || e.type === kind) && (!ver || e.verification === ver) && (!year || yearOf(e, shown.student) === year);
    }));
    return { ...base, visible };
  }, [base, shown, q, kind, ver, year, filtering]);
  const years = useMemo(() => [...new Set(map.events.map((e) => yearOf(e, map.student)))], [map]);
  const kinds = useMemo(() => [...new Set(map.events.map((e) => e.type))], [map]);
  const listed = useMemo(() => shown.events.filter((e) => lens.visible.has(e.id)).sort((a, b) => b.date.localeCompare(a.date)), [shown, lens]);
  const s = map.student;
  const reflections = countRefl(map);
  const openSignals = map.signals.filter((g) => g.open);

  useEffect(() => {
    if (tourStage === 'signal') {
      const g = map.signals.find((x) => x.kind === 'prompt' && x.open);
      if (g) setSignal(g); else if (!tourEvent()) { setTourStage('add'); setAdding(TOUR_STATION); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new station in the URL (from a notification or the launcher) opens even when the map is already showing.
  useEffect(() => { if (focusId?.startsWith('ev-')) { setSelected(focusId); setView('map'); } }, [focusId]);
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
        <div className="map-find" role="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stations, reflections, lines" aria-label="Search the map" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind"><option value="">Any kind</option>{kinds.map((k) => <option key={k} value={k}>{TYPE_LABEL[k] || k}</option>)}</select>
          <select value={ver} onChange={(e) => setVer(e.target.value)} aria-label="Verification"><option value="">Any verification</option>{Object.entries(VERIFY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year"><option value="">Any year</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
          {filtering && <span className="find-n" role="status">{lens.visible.size} match{lens.visible.size === 1 ? '' : 'es'} <button className="linkish" onClick={() => { setQ(''); setKind(''); setVer(''); setYear(''); }}>Clear</button></span>}
          <div className="seg small" role="group" aria-label="Show as"><button className={view === 'map' ? 'on' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button><button className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button></div>
        </div>
        <div className="chips filter" role="group" aria-label="Show or hide lines">
          {map.lines.map((l) => (
            <button key={l.id} className={`line-chip${hidden.includes(l.id) ? ' off' : ''}${l.status === 'ended' ? ' ended' : ''}`} style={{ '--c': l.colour }} aria-pressed={!hidden.includes(l.id)}
              onClick={() => setHidden(hidden.includes(l.id) ? hidden.filter((x) => x !== l.id) : [...hidden, l.id])}><i />{l.name}</button>
          ))}
        </div>
      </div>
      <div className="home-map">
        {view === 'map' ? <MetroMap map={shown} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => (g.open ? setSignal(g) : setSelected(g.eventId))} fitKey={studentId} newIds={newIds} />
          : <StationList events={listed} map={shown} selected={selected} onSelect={setSelected} />}
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

// F10: the same stations as a list, newest first, grouped by Year. Phones and screen readers start here.
function StationList({ events, map, selected, onSelect }) {
  const groups = [];
  for (const e of events) { const y = yearOf(e, map.student); if (groups.at(-1)?.y !== y) groups.push({ y, items: [] }); groups.at(-1).items.push(e); }
  if (!events.length) return <div className="st-list empty"><p>No stations match. Try fewer words or clear the filters.</p></div>;
  return (
    <div className="st-list">
      {groups.map((g) => (
        <section key={g.y}>
          <h3>{g.y}</h3>
          <ul>{g.items.map((e) => (
            <li key={e.id}>
              <button className={`sl-row${selected === e.id ? ' on' : ''}${e.type === 'goal' ? ' goal' : ''}`} onClick={() => onSelect(e.id)} aria-current={selected === e.id || undefined}>
                <span className="sl-dots" aria-hidden="true">{e.lineIds.map((l) => <i key={l} style={{ background: map.lines.find((x) => x.id === l)?.colour }} />)}</span>
                <span className="sl-main"><b>{e.title}</b><small>{fmtDate(e.date)} · {TYPE_LABEL[e.type]} · {e.lineIds.map((l) => map.lines.find((x) => x.id === l)?.name).filter(Boolean).join(', ')}</small></span>
                <VerifyBadge level={e.verification} event={e} />
              </button>
            </li>
          ))}</ul>
        </section>
      ))}
    </div>
  );
}
