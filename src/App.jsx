import { useEffect, useMemo, useState } from 'react';
import { applyLens, getPresentations, getStudentMap, getStudents, subscribe } from './api.js';
import MetroMap from './components/MetroMap.jsx';
import StationPanel from './components/StationPanel.jsx';
import Studio from './components/Studio.jsx';
import SharedView from './components/SharedView.jsx';
import IntegrationsPanel from './components/IntegrationsPanel.jsx';
import AdvisorGrid from './components/AdvisorGrid.jsx';
import { MapLegend, VerifyLegend } from './components/Badge.jsx';

const SCREENS = [
  ['map', 'Student map'],
  ['studio', 'Presentation studio'],
  ['shared', 'Shared view'],
  ['integrations', 'Integrations'],
  ['advisor', 'Advisor'],
];
const readRoute = () => {
  const r = location.hash.replace(/^#\/?/, '');
  return SCREENS.some(([id]) => id === r) ? r : 'map';
};

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [studentId, setStudentId] = useState('st-01');
  const [version, setVersion] = useState(0);
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const [selected, setSelected] = useState(null);
  const [hiddenLines, setHiddenLines] = useState({});
  const [audience, setAudience] = useState('general');
  const [tier, setTier] = useState('template');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(getStudents().map((s) => [s.id, structuredClone(getPresentations(s.id))])));
  const [newIds, setNewIds] = useState(new Set());
  const [toastMsg, setToastMsg] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  const go = (r) => { location.hash = `/${r}`; setRoute(r); };
  const toast = (m) => { setToastMsg(m); clearTimeout(window.__toast); window.__toast = setTimeout(() => setToastMsg(null), 3200); };

  const students = getStudents();
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const publicMap = useMemo(() => getStudentMap(studentId, 'public'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const hidden = hiddenLines[studentId] || [];
  const homeLens = useMemo(() => applyLens(map, null, { hiddenLines: hidden }), [map, hidden]);
  const fullLens = useMemo(() => applyLens(map, null), [map]);
  const myDrafts = drafts[studentId];
  const links = myDrafts.flatMap((p) => p.shareLinks);

  const switchStudent = (id) => { setStudentId(id); setSelected(null); };
  const toggleLine = (id) => setHiddenLines({ ...hiddenLines, [studentId]: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] });
  const updateDraft = (presId, patch) => setDrafts({ ...drafts, [studentId]: myDrafts.map((p) => (p.id === presId ? { ...p, ...patch } : p)) });
  const share = (pres) => {
    const token = `tp-${Math.random().toString(36).slice(2, 6)}`;
    const link = { token, presentationId: pres.id, expiresAt: '2026-12-31', revoked: false, views: 0 };
    updateDraft(pres.id, { shareLinks: [...pres.shareLinks, link] });
    toast(`Share link created: /s/${token}, expires 31 Dec 2026`);
  };
  const onAdded = (e) => {
    setNewIds(new Set([e.id]));
    toast(`Added “${e.title}” to the map`);
    setTimeout(() => setNewIds(new Set()), 7000);
  };

  const tour = [
    ['Open Maya’s interchange', 'Air-quality sensor network: evidence and endorsement', () => { switchStudent('st-01'); setHiddenLines({ ...hiddenLines, 'st-01': [] }); go('map'); setTimeout(() => setSelected('ev-042'), 60); }],
    ['Lens: General → University', 'Same data, new format: profile becomes a narrative', () => { switchStudent('st-01'); setTier('template'); setAudience('general'); go('studio'); setTimeout(() => setAudience('university'), 1200); }],
    ['Lens: Specific university', '“Why Data Science” statement with focused evidence', () => { switchStudent('st-01'); setTier('builder'); go('studio'); setAudience('specific'); }],
    ['Lens: Employer and Scholarship', 'A CV, then an impact timeline', () => { switchStudent('st-01'); setTier('template'); go('studio'); setAudience('employer'); }],
    ['Tier: Code', 'The JSON behind the same view', () => { switchStudent('st-01'); go('studio'); setTier('code'); }],
    ['Custom: design your own page', 'Themes, blocks, drag to place and resize', () => { switchStudent('st-01'); go('studio'); setAudience('custom'); }],
    ['Integrations: Sync and choose', 'Items land in an inbox; add one to Computing', () => { switchStudent('st-01'); go('integrations'); }],
  ];

  const student = map.student;
  const selectedEvent = map.events.find((e) => e.id === selected);
  const reflections = map.events.filter((e) => e.type === 'reflection').length + map.events.reduce((n, e) => n + e.reflections.length, 0);

  return (
    <div className="app">
      <header className="topnav">
        <div className="brand" aria-label="Transit Portfolio">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="var(--ink)" /><path d="M5 16h6l4-6h6" stroke="var(--bg)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="13" cy="13" r="2.6" fill="var(--bg)" /></svg>
          <span>Transit Portfolio</span>
        </div>
        <nav aria-label="Screens">
          {SCREENS.map(([id, label], i) => (
            <a key={id} href={`#/${id}`} className={route === id ? 'on' : ''} aria-current={route === id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(id); }}>
              <span className="n">{i + 1}</span>{label}
            </a>
          ))}
        </nav>
        <div className="nav-right">
          {route !== 'advisor' && (
            <div className="student-switch" role="radiogroup" aria-label="Student">
              {students.map((s) => (
                <button key={s.id} role="radio" aria-checked={s.id === studentId} className={s.id === studentId ? 'on' : ''} onClick={() => switchStudent(s.id)} title={`${s.name}, Grade ${s.grade}`}>
                  <span className="av" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span><span className="nm">{s.name.split(' ')[0]} <small>G{s.grade}</small></span>
                </button>
              ))}
            </div>
          )}
          <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '☾'}</button>
          <div className="tour-wrap">
            <button className="icon-btn tour-btn" onClick={() => setTourOpen(!tourOpen)} aria-expanded={tourOpen}>Pitch tour</button>
            {tourOpen && (
              <div className="tour" role="menu">
                <div className="tour-title">Five-minute pitch</div>
                {tour.map(([t, sub, fn], i) => (
                  <button key={i} role="menuitem" onClick={() => { fn(); setTourOpen(false); }}><span className="n">{i + 1}</span><span><b>{t}</b><small>{sub}</small></span></button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`screen screen-${route}`}>
        {route === 'map' && (
          <div className="home">
            <div className="home-head">
              <div className="who">
                <span className="pres-avatar" style={{ background: student.avatar.colour }}>{student.avatar.initials}</span>
                <div>
                  <h1>{student.name}</h1>
                  <p>Grade {student.grade} · {student.programme} · Advisory {student.homeroom}</p>
                </div>
                <div className="stats">
                  <span><b>{map.events.length}</b> stations</span>
                  <span><b>{map.lines.length}</b> lines</span>
                  <span><b>{reflections}</b> reflections</span>
                </div>
              </div>
              <div className="chips filter" role="group" aria-label="Show or hide lines">
                {map.lines.map((l) => (
                  <button key={l.id} className={`line-chip${hidden.includes(l.id) ? ' off' : ''}${l.status === 'ended' ? ' ended' : ''}`} style={{ '--c': l.colour }} aria-pressed={!hidden.includes(l.id)} onClick={() => toggleLine(l.id)}>
                    <i />{l.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="home-map">
              <MetroMap map={map} lens={homeLens} selectedId={selected} onSelect={setSelected} fitKey={studentId} newIds={newIds} />
              <StationPanel event={selectedEvent} map={map} onClose={() => setSelected(null)} />
            </div>
            <div className="home-foot"><MapLegend /><VerifyLegend /><span className="hint">Tap a station · drag to pan · pinch or scroll to zoom</span></div>
          </div>
        )}
        {route === 'studio' && <Studio key={studentId} map={publicMap} drafts={myDrafts} audience={audience} setAudience={setAudience} tier={tier} setTier={setTier} updateDraft={updateDraft} onShare={share} toast={toast} />}
        {route === 'shared' && <SharedView key={studentId} publicMap={publicMap} drafts={myDrafts} links={links} />}
        {route === 'integrations' && <IntegrationsPanel map={map} lens={fullLens} newIds={newIds} onAdded={onAdded} toast={toast} version={version} />}
        {route === 'advisor' && <AdvisorGrid advisorId="t-07" version={version} toast={toast} onOpen={(id) => { switchStudent(id); go('map'); }} />}
      </main>
      <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
    </div>
  );
}
