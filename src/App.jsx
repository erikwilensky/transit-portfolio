import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLens, getPresentations, getStudentMap, getStudents, subscribe, getNotifications, markNotificationsRead } from './api.js';
import { PERSONAS, KIND_LABEL, NAV, personaById, home } from './personas.js';
import { ago } from './format.js';
import Studio from './components/Studio.jsx';
import SharedView from './components/SharedView.jsx';
import IntegrationsPanel from './components/IntegrationsPanel.jsx';
import AdvisorGrid from './components/AdvisorGrid.jsx';
import StudentMap from './screens/StudentMap.jsx';
import AdvisorStudent from './screens/AdvisorStudent.jsx';
import TeacherQueue from './screens/TeacherQueue.jsx';
import CasDashboard from './screens/CasDashboard.jsx';
import ReferenceLetter from './screens/ReferenceLetter.jsx';
import SchoolDashboard from './screens/SchoolDashboard.jsx';
import ShareLanding from './screens/ShareLanding.jsx';
import VerifyPage from './screens/VerifyPage.jsx';
import ScanIn from './screens/ScanIn.jsx';
import ComingSoon from './screens/ComingSoon.jsx';
import ShareLinks from './screens/ShareLinks.jsx';
import Activity from './screens/Activity.jsx';
import Privacy from './screens/Privacy.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Pdpa from './screens/Pdpa.jsx';
import Applications from './screens/Applications.jsx';
import Logo from './components/Logo.jsx';
import { VerifyProvider } from './components/VerifyModal.jsx';
import { TOURS } from './tour.js';

// Routes: #/<persona>/<screen>/<param>, plus public #/s/<token> and #/v/<code>.
const parse = () => {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 's' || a === 'v') return { publicKind: a, param: b };
  const p = personaById(a);
  const screens = NAV[p.kind].map(([id]) => id).concat(p.kind === 'advisor' ? ['student'] : []);
  return { persona: p.id, screen: screens.includes(b) ? b : home(p), param: c || null };
};

export default function App() {
  const [route, setRoute] = useState(parse);
  const [version, setVersion] = useState(0);
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const [audience, setAudience] = useState('general');
  const [tier, setTier] = useState('template');
  const [drafts, setDrafts] = useState(() => Object.fromEntries(getStudents().map((s) => [s.id, structuredClone(getPresentations(s.id))])));
  const [toastMsg, setToastMsg] = useState(null);
  const [menu, setMenu] = useState(null); // 'persona' | 'bell' | 'tour'
  const [tourState, setTourState] = useState(null); // { tour, step }
  const [auto, setAuto] = useState(false);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
  useEffect(() => { const f = () => setRoute(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => { const f = (e) => { if (!e.target.closest('.menu-wrap')) setMenu(null); }; addEventListener('pointerdown', f); return () => removeEventListener('pointerdown', f); }, []);

  const tourRef = useRef(null);
  useEffect(() => { const k = (e) => tourRef.current?.key(e); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  useEffect(() => { if (!auto || !tourState) return undefined; const t = setTimeout(() => tourRef.current?.advance(), 12000); return () => clearTimeout(t); }, [auto, tourState]);

  const go = (persona, screen, param) => {
    const p = personaById(persona || route.persona);
    const h = `#/${p.id}/${screen || home(p)}${param ? `/${param}` : ''}`;
    if (location.hash !== h) history.pushState(null, '', h);
    setRoute(parse()); setMenu(null);
  };
  const toast = (m) => { setToastMsg(m); clearTimeout(window.__toast); window.__toast = setTimeout(() => setToastMsg(null), 3400); };

  if (route.publicKind === 's') return <VerifyProvider><ShareLanding token={route.param} drafts={drafts} version={version} /></VerifyProvider>;
  if (route.publicKind === 'v') return <VerifyPage code={route.param} />;

  const persona = personaById(route.persona);
  const studentId = persona.studentId;
  const nav = NAV[persona.kind];
  const notes = getNotifications(persona.id);
  const unread = notes.filter((n) => !n.read).length;
  const ctx = { go, toast, version, persona, drafts, setDrafts, audience, setAudience, tier, setTier, startTour: (t) => { setTourState({ tour: t, step: 0 }); TOURS[t].steps[0].run(ctx); } };
  const tour = tourState && TOURS[tourState.tour];
  const stepTo = (i) => { if (!tour || i < 0 || i >= tour.steps.length) { setAuto(false); return setTourState(null); } setTourState({ ...tourState, step: i }); tour.steps[i].run(ctx); };
  // X7: arrow keys and space drive the tour; auto-play moves on every 12 seconds (for an open-day screen).
  tourRef.current = tourState ? {
    key: (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); stepTo(tourState.step + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); stepTo(tourState.step - 1); }
      if (e.key === 'Escape' && !document.querySelector('.modal-back')) { setAuto(false); setTourState(null); }
    },
    advance: () => stepTo(tourState.step === tour.steps.length - 1 ? 0 : tourState.step + 1),
  } : null;

  return (
    <VerifyProvider>
      <div className={`app kind-${persona.kind}`}>
        <header className="topnav">
          <a className="brand" href={`#/${persona.id}`} aria-label="NIST Transit Portfolio home"><Logo className="brand-logo" /><span className="brand-name"><b>Transit</b> Portfolio</span></a>
          <nav aria-label="Screens">
            {nav.map(([id, label]) => (
              <a key={id} href={`#/${persona.id}/${id}`} className={route.screen === id || (id === 'advisory' && route.screen === 'student') ? 'on' : ''} aria-current={route.screen === id ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); go(persona.id, id); }}>{label}</a>
            ))}
          </nav>
          <div className="nav-right">
            <div className="menu-wrap">
              <button className="persona-btn" onClick={() => setMenu(menu === 'persona' ? null : 'persona')} aria-expanded={menu === 'persona'} aria-haspopup="menu">
                <span className="av" style={{ background: persona.colour }}>{persona.initials}</span>
                <span className="pb-text"><small>Viewing as</small><b>{persona.name}</b></span><span aria-hidden="true">▾</span>
              </button>
              {menu === 'persona' && (
                <div className="menu persona-menu" role="menu">
                  {Object.entries(KIND_LABEL).map(([kind, label]) => (
                    <div key={kind} className="pm-group">
                      <div className="menu-title">{label}</div>
                      {PERSONAS.filter((p) => p.kind === kind).map((p) => (
                        <button key={p.id} role="menuitem" className={p.id === persona.id ? 'on' : ''} onClick={() => go(p.id)}>
                          <span className="av" style={{ background: p.colour }}>{p.initials}</span><span><b>{p.name}</b><small>{p.role}</small></span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-wrap">
              <button className="icon-btn bell" onClick={() => { setMenu(menu === 'bell' ? null : 'bell'); if (unread) setTimeout(() => markNotificationsRead(persona.id), 1500); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4z M10 21h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                {unread > 0 && <span className="badge">{unread}</span>}
              </button>
              {menu === 'bell' && (
                <div className="menu bell-menu" role="menu">
                  <div className="menu-title">Notifications for {persona.name}</div>
                  {!notes.length && <p className="menu-empty">Nothing yet. Things other people do with this record will show up here.</p>}
                  {notes.map((n) => (
                    <button key={n.id} role="menuitem" className={n.read ? '' : 'unread'} onClick={() => n.go && go(n.go.persona, n.go.screen, n.go.param)}>
                      <span><b>{n.text}</b><small>{ago(n.ts)}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '☾'}</button>
            <div className="menu-wrap">
              <button className="icon-btn tour-btn" onClick={() => setMenu(menu === 'tour' ? null : 'tour')} aria-expanded={menu === 'tour'}>Pitch tour</button>
              {menu === 'tour' && (
                <div className="menu tour" role="menu">
                  {Object.entries(TOURS).map(([id, t]) => (
                    <div key={id}>
                      <div className="menu-title">{t.title}</div>
                      {t.steps.map((s, i) => (
                        <button key={i} role="menuitem" onClick={() => { setMenu(null); setTourState({ tour: id, step: i }); s.run(ctx); }}><span className="n">{i + 1}</span><span><b>{s.title}</b><small>{s.sub}</small></span></button>
                      ))}
                      <button className="tour-play" onClick={() => { setMenu(null); ctx.startTour(id); }}>▶ Present this tour</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`screen screen-${route.screen}`} key={`${persona.id}-${route.screen}`}>
          {persona.kind === 'student' && <StudentScreens {...ctx} screen={route.screen} param={route.param} studentId={studentId} />}
          {persona.kind === 'advisor' && route.screen === 'advisory' && <AdvisorGrid advisorId={persona.teacherId} version={version} toast={toast} onOpen={(id) => go(persona.id, 'student', id)} />}
          {persona.kind === 'advisor' && route.screen === 'student' && <AdvisorStudent studentId={route.param || 'st-01'} {...ctx} />}
          {persona.kind === 'teacher' && route.screen === 'queue' && <TeacherQueue teacherId={persona.teacherId} {...ctx} />}
          {persona.kind === 'coordinator' && route.screen === 'cas' && <CasDashboard {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'letter' && <ReferenceLetter {...ctx} studentId={route.param || 'st-01'} />}
          {persona.kind === 'leadership' && route.screen === 'dashboard' && <SchoolDashboard {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'scan' && <ScanIn {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'pdpa' && <Pdpa {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'applications' && <Applications {...ctx} />}
          {persona.kind === 'external' && <ShareLanding token={persona.token} drafts={drafts} version={version} embedded />}
          <ComingSoon {...ctx} screen={route.screen} kind={persona.kind} />
        </main>

        {tour && (
          <div className="presenter" role="dialog" aria-label="Pitch tour">
            <span className="pr-n">{tourState.step + 1}/{tour.steps.length}</span>{auto && <span className="pr-prog" key={tourState.step} aria-hidden="true" />}
            <div className="pr-text"><b>{tour.steps[tourState.step].title}</b><span>{tour.steps[tourState.step].say}</span></div>
            <button onClick={() => stepTo(tourState.step - 1)} disabled={tourState.step === 0} aria-label="Previous">‹</button>
            <button className="primary" onClick={() => stepTo(tourState.step + 1)}>{tourState.step === tour.steps.length - 1 ? 'Finish' : 'Next ›'}</button>
            <button className={`pr-auto${auto ? ' on' : ''}`} onClick={() => setAuto(!auto)} aria-pressed={auto} title="Auto-play every 12 seconds, looping">{auto ? '❚❚ Auto' : '▶ Auto'}</button>
            <button onClick={() => { setAuto(false); setTourState(null); }} aria-label="Close tour">×</button>
          </div>
        )}
        <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
      </div>
    </VerifyProvider>
  );
}

function StudentScreens({ screen, param, studentId, drafts, setDrafts, audience, setAudience, tier, setTier, toast, version, go, persona }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const publicMap = useMemo(() => getStudentMap(studentId, 'public'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const myDrafts = drafts[studentId] || [];
  const links = myDrafts.flatMap((p) => p.shareLinks);
  const updateDraft = (presId, patch) => setDrafts((d) => ({ ...d, [studentId]: d[studentId].map((p) => (p.id === presId ? { ...p, ...patch } : p)) }));
  const share = (pres) => {
    const token = `tp-${Math.random().toString(36).slice(2, 6)}`;
    updateDraft(pres.id, { shareLinks: [...pres.shareLinks, { token, presentationId: pres.id, expiresAt: '2026-12-31', revoked: false, views: 0 }] });
    toast(`Share link created: /s/${token}, expires 31 Dec 2026`);
  };
  if (map.student.onboarding) return <Onboarding map={map} studentId={studentId} onDone={() => { toast('Your map is ready.'); go(persona.id, 'map'); }} />;
  if (screen === 'links') return <ShareLinks studentId={studentId} drafts={myDrafts} updateDraft={updateDraft} toast={toast} version={version} />;
  if (screen === 'activity') return <Activity studentId={studentId} version={version} />;
  if (screen === 'privacy') return <Privacy studentId={studentId} drafts={myDrafts} toast={toast} go={go} persona={persona} version={version} />;
  if (screen === 'map') return <StudentMap map={map} studentId={studentId} toast={toast} version={version} focusId={param} go={go} persona={persona} />;
  if (screen === 'studio') return <Studio key={studentId} map={publicMap} drafts={myDrafts} audience={audience} setAudience={setAudience} tier={tier} setTier={setTier} updateDraft={updateDraft} onShare={share} toast={toast} />;
  if (screen === 'shared') return <SharedView key={studentId} publicMap={publicMap} drafts={myDrafts} links={links} />;
  if (screen === 'inbox') return <IntegrationsPanel map={map} lens={applyLens(map, null)} newIds={new Set()} onAdded={(e) => { toast(`Added “${e.title}” to the map`); go(persona.id, 'map', e.id); }} toast={toast} version={version} />;
  return null;
}
