import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLens, getAlumMap, getStudent, getStudentMap, subscribe, getDrafts, setStudentDrafts, hasPublicCopy, getNotifications, markNotificationsRead, notifyKeys, resetDemo, restore, markOf, changeCount, logLink, addStation, getLang, getIntensity, setIntensity, INTENSITY, INTENSITY_NAV, INTENSITY_LABEL } from './api.js';
import SimpleHome, { ShowFamily, QuickAdd } from './screens/SimpleHome.jsx';
import { InstallHint } from './components/PhoneApp.jsx';
import { ReadAloudSetting } from './components/Voice.jsx';
import IntensityControl from './components/IntensityControl.jsx';
import DisplaySettings from './components/DisplaySettings.jsx';
import { ensureEndorsed } from './tourStory.js';
import { PERSONAS, KIND_LABEL, personaById, home, navOf, pilotPersona } from './personas.js';
import Accounts from './screens/Accounts.jsx';
import Usage from './screens/Usage.jsx';
import Reports from './screens/Reports.jsx';
import Overview from './screens/Overview.jsx';
import ActivityLog from './screens/ActivityLog.jsx';
import Exhibitions from './screens/Exhibitions.jsx';
import { isModerator } from './api.js';
import { AccountMenu, PasswordDialog } from './screens/SignIn.jsx';
import { appUrl, inkOn } from './format.js';
import Studio from './components/Studio.jsx';
import SharedView from './components/SharedView.jsx';
import IntegrationsPanel from './components/IntegrationsPanel.jsx';
import AdvisorGrid from './components/AdvisorGrid.jsx';
import StudentMap from './screens/StudentMap.jsx';
import { CarryOverGoals } from './components/YearHandover.jsx';
import AdvisorStudent from './screens/AdvisorStudent.jsx';
import TeacherQueue from './screens/TeacherQueue.jsx';
import MyClasses from './screens/MyClasses.jsx';
import CasDashboard from './screens/CasDashboard.jsx';
import ReferenceLetter from './screens/ReferenceLetter.jsx';
import SchoolDashboard from './screens/SchoolDashboard.jsx';
import ShareLanding from './screens/ShareLanding.jsx';
import { PublicShare, PublicVerify } from './screens/PublicPage.jsx';
import ScanIn from './screens/ScanIn.jsx';
import ComingSoon from './screens/ComingSoon.jsx';
import ShareLinks from './screens/ShareLinks.jsx';
import Activity from './screens/Activity.jsx';
import Privacy from './screens/Privacy.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Pdpa from './screens/Pdpa.jsx';
import { FeedbackDialog } from './components/Feedback.jsx';
import { NudgeBanner } from './components/Nudges.jsx';
import { TermReflectionCard } from './components/TermReflection.jsx';
import { StudentConference } from './components/ConferenceBooking.jsx';
import { StudentMilestones } from './components/Milestones.jsx';
import Applications from './screens/Applications.jsx';
import SignalBoard from './screens/SignalBoard.jsx';
import SchoolLine from './screens/SchoolLine.jsx';
import SchoolMetro from './screens/SchoolMetro.jsx';
import Crosslinks from './screens/Crosslinks.jsx';
import Depot from './screens/Depot.jsx';
import ActivitiesList from './screens/ActivitiesList.jsx';
import CohortSearch from './screens/CohortSearch.jsx';
import DpCore from './screens/DpCore.jsx';
import Governance from './screens/Governance.jsx';
import Rollout from './screens/Rollout.jsx';
import ParentView from './screens/ParentView.jsx';
import Family from './screens/Family.jsx';
import LearnerProfile from './screens/LearnerProfile.jsx';
import { agoIn, noteText, tr } from './i18n.js';
import { chooseLang } from './auth.js';
import { isPublicRoute } from './publicRoute.js';
import Pilot from './screens/Pilot.jsx';
import AuditLog from './screens/AuditLog.jsx';
import Poster from './screens/Poster.jsx';
import AlumJourney from './screens/AlumJourney.jsx';
import ImportFile from './screens/ImportFile.jsx';
import Logo from './components/Logo.jsx';
import NavBar from './components/NavBar.jsx';
import Launcher from './components/Launcher.jsx';
import ShareDialog from './components/ShareDialog.jsx';
import ShareGaps from './components/ShareGaps.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import SyncStatus from './components/SyncStatus.jsx';
import { serverMode, undoSince } from './sync.js';
import { inPreview } from './preview.js'; // admin "See as": no account menu for the person shown
import { VerifyProvider } from './components/VerifyModal.jsx';
import { TOURS, tourMinutes, stopCount } from './tour.js';
import ThisWeek from './screens/ThisWeek.jsx';
import { TODAY } from './api.js';
import { isMonday } from './week.js';
import { QADrawer, TourCard, TourRoute } from './components/TourCards.jsx';
import { LeaverBuilder, PublicLeaver } from './components/Leaver.jsx';
import { leaverAllowed } from './api.js';
import SubjectPromptsScreen from './components/SubjectPrompts.jsx';
import { CasConfirm, CasLog } from './components/Cas.jsx';
import { casAllowed, casToConfirm, isCasCoordinator } from './api.js';

// Routes: #/<persona>/<screen>/<param>, plus public #/s/<token>, #/v/<code> and #/p/<student>[/th] (parent link).
// A screen set this persona uses: their own kind, or another hat they wear in the pilot (persona.also).
const acts = (p, kind) => p.kind === kind || !!p.also?.includes(kind);
const parse = () => {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 's' || a === 'v' || a === 'p' || a === 'l') return { publicKind: a, param: b, lang: c };
  const p = personaById(a);
  const screens = navOf(p).map(([id]) => id).concat(p.kind === 'advisor' ? ['student'] : p.kind === 'student' ? ['poster', 'add', 'snap', 'leaver', 'cas'] : []).concat(p.teacherId && p.kind !== 'student' ? ['cas', 'casconfirm'] : []);
  // Staff with "This week" land on it on Mondays (Bangkok) when the address names no screen.
  return { persona: p.id, screen: screens.includes(b) ? b : !b && screens.includes('week') && isMonday(TODAY) ? 'week' : home(p), param: c || null };
};

// Presentations (drafts, letters, custom pages, share links) live in the record, in api.js.
const setDrafts = (upd) => {
  const cur = getDrafts();
  const next = typeof upd === 'function' ? upd(cur) : upd;
  for (const id of Object.keys(next)) if (next[id] !== cur[id]) setStudentDrafts(id, next[id]);
};

export default function App() {
  const [route, setRoute] = useState(parse);
  const [version, setVersion] = useState(0);
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const [audience, setAudience] = useState('general');
  const [tier, setTier] = useState('template');
  const [toastMsg, setToastMsg] = useState(null);
  const [menu, setMenu] = useState(null); // 'persona' | 'bell' | 'tour'
  const [tourState, setTourState] = useState(null); // { tour, step }
  const [auto, setAuto] = useState(false);
  const [launch, setLaunch] = useState(false);
  const [qa, setQa] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false); // pilot feedback
  // Pilot mode: the signed-in person's own persona; no switcher, tours, presenter or reset.
  const pilot = pilotPersona();
  // F18: Escape closes the top dialog, else an open station panel; Tab stays inside an open dialog;
  // focus moves into a dialog when it opens and returns to where it was when it closes.
  useEffect(() => {
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const top = () => [...document.querySelectorAll('.modal-back')].at(-1);
    const k = (e) => {
      if (e.defaultPrevented) return;
      const dlg = top();
      if (e.key === 'Escape') {
        const close = dlg ? dlg.querySelector('.panel-close') : document.querySelector('.station-panel.open .panel-close');
        if (close) { e.preventDefault(); close.click(); } else if (dlg) { e.preventDefault(); dlg.click(); }
      }
      if (e.key === 'Tab' && dlg) {
        const f = [...dlg.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    const back = [];
    // A step that replaces the focused button (a flow's Next) would drop focus to the page: keep it in the dialog.
    let last = null, prev = null; const fin = (e) => { prev = last; last = e.target; }; addEventListener('focusin', fin);
    const mo = new MutationObserver(() => {
      const dlg = top();
      if (dlg?.dataset.focused && document.activeElement === document.body && last && !last.isConnected) { last = null; ([...dlg.querySelectorAll(FOCUSABLE)].find((x) => !x.classList.contains('panel-close') && x.offsetParent !== null) || dlg.querySelector(FOCUSABLE))?.focus(); }
      if (dlg && !dlg.dataset.focused) {
        dlg.dataset.focused = '1'; back.push(dlg.contains(document.activeElement) ? prev : document.activeElement); // autoFocus got there first
        if (!dlg.contains(document.activeElement)) (dlg.querySelector('[autofocus], input:not([type=checkbox]), textarea') || dlg.querySelector(FOCUSABLE))?.focus();
      }
      const open = document.querySelectorAll('.modal-back').length;
      while (back.length > open) { const el = back.pop(); if (el?.isConnected) el.focus(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    addEventListener('keydown', k); return () => { removeEventListener('keydown', k); removeEventListener('focusin', fin); mo.disconnect(); };
  }, []);
  // Escape closes an open top-bar menu and puts focus back on the button that opened it.
  useEffect(() => {
    if (!menu) return undefined;
    const k = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-back')) return;
      const btn = document.querySelector('.topnav .menu')?.closest('.menu-wrap')?.querySelector(':scope > button');
      e.preventDefault(); setMenu(null); btn?.focus();
    };
    addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true);
  }, [menu]);
  // F16: / or Ctrl+K opens the launcher from anywhere (except while typing).
  useEffect(() => {
    const k = (e) => {
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setLaunch((v) => !v); }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setLaunch(true); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
  const drafts = getDrafts();
  // F3: #/reset puts the demo back to its seeded state (handy on a shared screen).
  useEffect(() => {
    const f = () => { if (location.hash.startsWith('#/reset') && !pilotPersona()) { resetDemo(); history.replaceState(null, '', '#/principal/dashboard'); setRoute(parse()); } };
    f(); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);
  // Leaving a public page that holds only the server's pruned copy: start again with the full record.
  useEffect(() => { const f = () => { if (hasPublicCopy() && !isPublicRoute()) location.reload(); else setRoute(parse()); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => { const f = (e) => { if (!e.target.closest('.menu-wrap')) setMenu(null); }; addEventListener('pointerdown', f); return () => removeEventListener('pointerdown', f); }, []);

  const tourRef = useRef(null);
  useEffect(() => { const k = (e) => tourRef.current?.key(e); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  useEffect(() => { if (!auto || !tourState) return undefined; const t = setTimeout(() => tourRef.current?.advance(), 12000); return () => clearTimeout(t); }, [auto, tourState]);

  const go = (persona, screen, param) => {
    // A notification's target may be a pilot key (st:…, t:…): in the demo that stays on the current persona.
    const p = personaById(persona && (pilotPersona() || PERSONAS.some((x) => x.id === persona)) ? persona : route.persona);
    const h = `#/${p.id}/${screen || home(p)}${param ? `/${param}` : ''}`;
    if (location.hash !== h) history.pushState(null, '', h);
    setRoute(parse()); setMenu(null);
  };
  // F9: a toast can carry a snapshot taken before the action; Undo restores it. With the server, Undo
  // asks it to take back just this page's changes since that snapshot, keeping everyone else's.
  const toast = (m, undo) => { setToastMsg({ m, undo, mark: undo && markOf(undo), upto: changeCount() }); clearTimeout(window.__toast); window.__toast = setTimeout(() => setToastMsg(null), undo ? 6000 : 3400); };
  const undoToast = (t) => {
    if (!serverMode()) { restore(t.undo); setToastMsg(null); return; }
    setToastMsg({ m: 'Undoing…' });
    undoSince(t.mark, t.upto).then((r) => toast(r.error || (r.skipped ? `Undone, but ${r.skipped} later change${r.skipped === 1 ? '' : 's'} could not be kept.` : 'Undone')));
  };

  // Share links and verify codes: with the pilot server, only what was shared is fetched (see publicRoute.js).
  if (route.publicKind === 's') return <PublicShare key={route.param} token={route.param} version={version} />;
  if (route.publicKind === 'v') return <PublicVerify key={route.param || ''} code={route.param} />;
  if (route.publicKind === 'p') return <VerifyProvider><ParentView studentId={route.param} lang={route.lang} /></VerifyProvider>;
  if (route.publicKind === 'l') return <PublicLeaver key={route.param} token={route.param} />;

  const persona = personaById(route.persona);
  const studentId = persona.studentId;
  // N1: a parent's navigation follows their language.
  const lang = getLang();
  const T = (s) => tr(lang, s);
  // Students choose how much interface they see; the record is the same at every level.
  const level = persona.kind === 'student' ? getIntensity(persona.studentId) : null;
  const changeLevel = (v) => { setIntensity(persona.studentId, v); if (INTENSITY_NAV[v] && !INTENSITY_NAV[v].includes(route.screen)) go(persona.id, 'map'); toast(`Interface set to ${v}. Your map and everything on it stay the same.`); };
  const nav = navOf(persona).filter(([id]) => !level || !INTENSITY_NAV[level] || INTENSITY_NAV[level].includes(id)).map(([id, l]) => [id, T(INTENSITY_LABEL[level]?.[id] || l)]);
  if (persona.kind === 'student' && leaverAllowed(studentId)) nav.push(['leaver', 'Leaver portfolio']); // Years 11 to 13
  // CAS (src/components/Cas.jsx): Years 12 and 13 log experiences and hours (pilot); staff named as supervisor confirm; a teacher
  // marked as CAS coordinator on Accounts gets the cohort grid.
  if (pilot && persona.kind === 'student' && casAllowed(studentId)) nav.push(['cas', 'CAS']);
  if (persona.kind !== 'student' && persona.teacherId && casToConfirm(persona.teacherId).length) nav.push(['casconfirm', 'CAS to confirm']);
  if (persona.kind !== 'student' && persona.kind !== 'coordinator' && isCasCoordinator(persona)) nav.push(['cas', 'CAS outcomes']);
  const keys = notifyKeys(persona);
  const notes = getNotifications(keys);
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
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.modal-back, .station-panel.open')) { setAuto(false); setTourState(null); }
    },
    advance: () => stepTo(tourState.step === tour.steps.length - 1 ? 0 : tourState.step + 1),
  } : null;

  return (
    <VerifyProvider>
      <div className={`app kind-${persona.kind}${level ? ` int-${level}` : ''}`} lang={lang}>
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{T('Skip to content')}</a>
        <header className="topnav">
          <a className="brand" href={`#/${persona.id}`} aria-label="NIST Transit Portfolio home"><Logo className="brand-logo" /><span className="brand-name"><b>Transit</b> Portfolio</span></a>
          <NavBar items={nav} hrefOf={(id) => `#/${persona.id}/${id}`} isOn={(id) => route.screen === id || (id === 'advisory' && route.screen === 'student')} onGo={(id) => go(persona.id, id)} moreLabel={T('More')} />
          <div className="nav-right">
            <SyncStatus />
            <button className="icon-btn nav-search" onClick={() => setLaunch(true)} aria-label="Jump to anything (Ctrl+K)" title="Jump to anything (/ or Ctrl+K)"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
            <div className="menu-wrap">
              <button className="persona-btn" onClick={() => setMenu(menu === 'persona' ? null : 'persona')} aria-expanded={menu === 'persona'} aria-haspopup="menu">
                <span className="av" style={{ background: persona.colour, color: inkOn(persona.colour) }}>{persona.initials}</span>
                <span className="pb-text"><small>{T(inPreview() ? 'Seeing as' : pilot ? 'Signed in' : 'Viewing as')}</small><b>{persona.name}</b></span><span aria-hidden="true">▾</span>
              </button>
              {menu === 'persona' && pilot && !inPreview() && (
                <AccountMenu persona={persona} onPassword={() => { setMenu(null); setPwOpen(true); }} onFeedback={() => { setMenu(null); setFbOpen(true); }} />
              )}
              {menu === 'persona' && !pilot && (
                <div className="menu persona-menu" role="menu">
                  {Object.entries(KIND_LABEL).map(([kind, label]) => (
                    <div key={kind} className="pm-group">
                      <div className="menu-title">{T(label)}</div>
                      {PERSONAS.filter((p) => p.kind === kind).map((p) => (
                        <button key={p.id} role="menuitem" className={p.id === persona.id ? 'on' : ''} onClick={() => go(p.id)}>
                          <span className="av" style={{ background: p.colour, color: inkOn(p.colour) }}>{p.initials}</span><span><b>{p.name}</b><small>{p.role}</small></span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-wrap">
              <button className="icon-btn bell" onClick={() => { setMenu(menu === 'bell' ? null : 'bell'); if (unread) setTimeout(() => markNotificationsRead(keys), 1500); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4z M10 21h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                {unread > 0 && <span className="badge">{unread}</span>}
              </button>
              {menu === 'bell' && (
                <div className="menu bell-menu" role="menu">
                  <div className="menu-title">{T('Notifications for')} {persona.name}</div>
                  {!notes.length && <p className="menu-empty">{T('Nothing yet. Things other people do with this record will show up here.')}</p>}
                  {notes.map((n) => (
                    <button key={n.id} role="menuitem" className={n.read ? '' : 'unread'} onClick={() => n.go && go(n.go.persona, n.go.screen, n.go.param)}>
                      <span><b>{noteText(lang, n.text)}</b><small>{agoIn(lang, n.ts)}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {level && <IntensityControl compact value={level} onChange={changeLevel} />}
            <div className="menu-wrap">
              <button className="icon-btn view-btn" onClick={() => setMenu(menu === 'view' ? null : 'view')} aria-expanded={menu === 'view'} aria-haspopup="menu" aria-label={T('Display settings')} title={T('Display settings')}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
              {menu === 'view' && (
                <div className="menu view-menu" role="group" aria-label={T('Display settings')}>
                  {level && <><div className="menu-title">How much to show</div><div className="vm-row"><IntensityControl value={level} onChange={changeLevel} /><small className="vm-note">{INTENSITY.find(([k]) => k === level)?.[2]}</small></div></>}
                  <div className="menu-title">{T('Language')}</div>
                  <div className="vm-row seg">{[['en', 'English'], ['th', 'ภาษาไทย']].map(([k, l]) => <button key={k} className={lang === k ? 'on' : ''} lang={k} onClick={() => chooseLang(k)}>{l}</button>)}</div>
                  <div className="menu-title">{T('Theme')}</div>
                  <div className="vm-row seg">{[[false, 'Light'], [true, 'Dark']].map(([k, l]) => <button key={l} className={dark === k ? 'on' : ''} onClick={() => setDark(k)}>{T(l)}</button>)}</div>
                  <ReadAloudSetting T={T} />
                  <DisplaySettings T={T} />
                </div>
              )}
            </div>
            {!pilot && <div className="menu-wrap">
              <button className="icon-btn tour-btn" onClick={() => setMenu(menu === 'tour' ? null : 'tour')} aria-expanded={menu === 'tour'}>{T('Pitch tour')}</button>
              {menu === 'tour' && (
                <div className="menu tour" role="menu">
                  <div className="menu-title">Tours</div>
                  {Object.entries(TOURS).map(([id, t]) => (
                    <div key={id} className="tour-row">
                      <div className="tr-head"><span><b>{t.title}</b><small>{t.use} · {stopCount(t)} stops · about {tourMinutes(t)} min</small></span>
                        <button className="tour-play" onClick={() => { setMenu(null); ctx.startTour(id); }}>▶ Present</button></div>
                      <details><summary>Jump to a stop</summary>
                        {t.steps.map((st, i) => (
                          <button key={i} role="menuitem" onClick={() => { setMenu(null); setTourState({ tour: id, step: i }); st.run(ctx); }}><span className="n">{st.card ? '■' : i + 1}</span><span><b>{st.title}</b><small>{st.sub}</small></span></button>
                        ))}
                      </details>
                    </div>
                  ))}
                  <button className="qa-open" onClick={() => { setMenu(null); setQa(true); }}><b>Q&amp;A drawer</b><small>Likely board questions, each with a screen that answers it</small></button>
                  <div className="menu-title">Demo state</div>
                  <div className="demo-states">
                    <button onClick={() => { resetDemo(); setTourState(null); setMenu(null); go('principal', 'dashboard'); toast('Demo reset. Ready for the tour.'); }}><b>Reset, ready for the tour</b><small>Clean record, starts on the dashboard</small></button>
                    <button onClick={() => { resetDemo(); ensureEndorsed(); setTourState(null); setMenu(null); go('maya', 'map'); toast('Reset with the tour already played'); }}><b>Reset, tour already played</b><small>Hackathon added and endorsed</small></button>
                  </div>
                  <p className="fineprint demo-note">{serverMode() ? 'Changes are saved on the server, so every device sees them at once. Reset puts every device back.' : 'Changes are saved in this browser, so a rehearsal is still here tomorrow. Open a second tab to show two people at once.'}</p>
                </div>
              )}
            </div>}
          </div>
        </header>

        <main id="main" tabIndex={-1} className={`screen screen-${route.screen}`} key={`${persona.id}-${route.screen}`}>
          <ErrorBoundary resetKey={`${persona.id}-${route.screen}-${route.param}`}>
          {persona.kind === 'student' && <StudentScreens {...ctx} screen={route.screen} param={route.param} studentId={studentId} />}
          {persona.kind === 'student' && route.screen === 'map' && !tour && !getStudent(studentId)?.onboarding && <InstallHint />}
          {acts(persona, 'advisor') && route.screen === 'advisory' && <AdvisorGrid advisorId={persona.teacherId} version={version} toast={toast} persona={persona} focus={route.param} onOpen={(id) => go(persona.id, 'student', id)} />}
          {acts(persona, 'advisor') && route.screen === 'student' && (getStudent(route.param?.split('~')[0] || 'st-01') ? <AdvisorStudent studentId={route.param?.split('~')[0] || 'st-01'} focus={route.param?.split('~')[1]} {...ctx} /> : <NotInRecord onBack={() => go(persona.id, 'advisory')} />)}
          {acts(persona, 'teacher') && route.screen === 'queue' && <TeacherQueue teacherId={persona.teacherId} focus={route.param} {...ctx} />}
          {pilot && acts(persona, 'teacher') && route.screen === 'classes' && <MyClasses teacherId={persona.teacherId} param={route.param} {...ctx} />}
          {persona.kind !== 'student' && isCasCoordinator(persona) && route.screen === 'cas' && <CasDashboard {...ctx} />}
          {persona.kind !== 'student' && persona.teacherId && route.screen === 'casconfirm' && <CasConfirm {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'letter' && (getStudent(route.param || 'st-01') ? <ReferenceLetter {...ctx} studentId={route.param || 'st-01'} /> : <NotInRecord onBack={() => go(persona.id, 'applications')} />)}
          {persona.kind === 'leadership' && route.screen === 'dashboard' && <SchoolDashboard {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'scan' && <ScanIn {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'pdpa' && <Pdpa {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'applications' && <Applications {...ctx} />}
          {acts(persona, 'advisor') && route.screen === 'signals' && <SignalBoard {...ctx} />}
          {persona.kind === 'coordinator' && route.screen === 'schoolline' && <SchoolLine {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'schoolmetro' && <SchoolMetro {...ctx} />}
          {persona.kind === 'teacher' && route.screen === 'crosslinks' && <Crosslinks {...ctx} />}
          {persona.kind === 'teacher' && route.screen === 'depot' && <Depot {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'activities' && <ActivitiesList {...ctx} />}
          {persona.kind === 'counsellor' && route.screen === 'search' && <CohortSearch {...ctx} />}
          {persona.kind === 'coordinator' && route.screen === 'core' && <DpCore {...ctx} />}
          {persona.kind === 'coordinator' && route.screen === 'governance' && <Governance {...ctx} />}
          {(persona.kind === 'coordinator' || persona.kind === 'teacher') && route.screen === 'import' && <ImportFile {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'rollout' && <Rollout {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'pilot' && <Pilot {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'audit' && <AuditLog {...ctx} />}
          {persona.kind === 'leadership' && route.screen === 'profile' && <LearnerProfile {...ctx} />}
          {persona.kind === 'parent' && <Family {...ctx} screen={route.screen} param={route.param} />}
          {persona.kind === 'alum' && route.screen === 'journey' && <AlumJourney {...ctx} />}
          {persona.kind === 'alum' && route.screen === 'poster' && <AlumPoster {...ctx} />}
          {persona.kind === 'external' && <ShareLanding token={persona.token} drafts={drafts} version={version} embedded />}
          {persona.admin && route.screen === 'accounts' && <Accounts {...ctx} />}
          {pilot && route.screen === 'usage' && (persona.admin || persona.kind === 'leadership') && <Usage {...ctx} />}
          {isModerator(persona) && route.screen === 'reports' && <Reports {...ctx} focus={route.param} />}
          {pilot && route.screen === 'week' && (acts(persona, 'teacher') || acts(persona, 'advisor')) && <ThisWeek {...ctx} param={route.param} />}
          {pilot && route.screen === 'overview' && (persona.admin || persona.kind === 'leadership' || persona.kind === 'coordinator') && <Overview {...ctx} />}
          {pilot && route.screen === 'activitylog' && (persona.admin || persona.kind === 'leadership') && <ActivityLog {...ctx} />}
          {pilot && route.screen === 'screens' && (persona.admin || ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'].includes(persona.kind)) && <Exhibitions {...ctx} />}
          {pilot && route.screen === 'prompts' && (persona.admin || persona.kind === 'coordinator' || persona.kind === 'leadership') && <SubjectPromptsScreen {...ctx} />}
          {route.screen !== 'prompts' && route.screen !== 'screens' && route.screen !== 'accounts' && route.screen !== 'usage' && route.screen !== 'reports' && route.screen !== 'overview' && route.screen !== 'week' && route.screen !== 'activitylog' && route.screen !== 'leaver' && route.screen !== 'cas' && route.screen !== 'casconfirm' && <ComingSoon {...ctx} screen={route.screen} kind={persona.kind} persona={persona} />}
          </ErrorBoundary>
          {pilot && level === 'simple' && <div className="fb-simple"><button onClick={() => setFbOpen(true)}>Something not working? Tell us</button></div>}
        </main>

        {tour?.steps[tourState.step].card && <TourCard kind={tour.steps[tourState.step].card} ctx={ctx} />}
        {qa && <QADrawer ctx={ctx} onClose={() => setQa(false)} />}
        {tour && (
          <div className="presenter" role="dialog" aria-label="Pitch tour">
            {auto && <span className="pr-prog" key={tourState.step} aria-hidden="true" />}
            <div className="pr-main">
              <TourRoute tour={tour} step={tourState.step} onStep={stepTo} />
              <div className="pr-text"><b>{tour.steps[tourState.step].title}</b><span>{tour.steps[tourState.step].say}</span></div>
            </div>
            <button className="pr-qa" onClick={() => setQa(true)} title="Likely questions, with a screen for each">Q&amp;A</button>
            <button onClick={() => stepTo(tourState.step - 1)} disabled={tourState.step === 0} aria-label="Previous">‹</button>
            <button className="primary" onClick={() => stepTo(tourState.step + 1)}>{tourState.step === tour.steps.length - 1 ? 'Finish' : 'Next ›'}</button>
            <button className={`pr-auto${auto ? ' on' : ''}`} onClick={() => setAuto(!auto)} aria-pressed={auto} title="Auto-play every 12 seconds, looping">{auto ? '❚❚ Auto' : '▶ Auto'}</button>
            <button onClick={() => { setAuto(false); setTourState(null); }} aria-label="Close tour">×</button>
          </div>
        )}
        {launch && <Launcher onGo={go} onClose={() => setLaunch(false)} only={pilot} />}
        {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} toast={toast} />}
        {fbOpen && <FeedbackDialog simple={level === 'simple'} onClose={() => setFbOpen(false)} toast={toast} />}
        <div className={`toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg?.m}{toastMsg?.undo && <button className="toast-undo" onClick={() => undoToast(toastMsg)}>Undo</button>}</div>
      </div>
    </VerifyProvider>
  );
}

// Pilot: each person holds only the students they work with, so an address can name someone not here.
function NotInRecord({ onBack }) {
  return <div className="empty"><p>This student is not in your part of the record.</p><button className="ghost" onClick={onBack}>Back</button></div>;
}

function StudentScreens({ screen, param, studentId, drafts, setDrafts, audience, setAudience, tier, setTier, toast, version, go, persona }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const publicMap = useMemo(() => getStudentMap(studentId, 'public'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const myDrafts = drafts[studentId] || [];
  const links = myDrafts.flatMap((p) => p.shareLinks);
  const updateDraft = (presId, patch) => setDrafts((d) => ({ ...d, [studentId]: d[studentId].map((p) => (p.id === presId ? { ...p, ...patch } : p)) }));
  const [newLink, setNewLink] = useState(null);
  // A nudge (banner or notification, #/<persona>/map/add) opens the add flow.
  const [addReq, setAddReq] = useState(0);
  useEffect(() => { if (param === 'add' && screen === 'map') setAddReq((n) => n + 1); }, [param, screen]);
  const nudge = <><StudentMilestones studentId={studentId} version={version} simple={getIntensity(studentId) === 'simple'} /><NudgeBanner studentId={studentId} version={version} simple={getIntensity(studentId) === 'simple'} onAdd={() => setAddReq((n) => n + 1)} /><CarryOverGoals studentId={studentId} version={version} toast={toast} simple={getIntensity(studentId) === 'simple'} />
    <TermReflectionCard studentId={studentId} version={version} toast={toast} simple={getIntensity(studentId) === 'simple'} auto={screen === 'map' && param === 'reflect'} />
    <StudentConference studentId={studentId} version={version} simple={getIntensity(studentId) === 'simple'} /></>;
  // N11: stations a presentation would show but a link cannot, because they are not publishable.
  const [gapFor, setGapFor] = useState(null);
  const gapsOf = (pres) => { const l = applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines }); return map.events.filter((e) => l.visible.has(e.id) && e.type !== 'goal' && e.visibility !== 'publishable'); };
  const askShare = (pres, opts = {}) => { if (!opts.site && gapsOf(pres).length) return setGapFor(pres); share(pres, opts); };
  const share = (pres, { site } = {}) => {
    const link = { token: `tp-${Math.random().toString(36).slice(2, 6)}`, presentationId: pres.id, expiresAt: '2026-12-31', revoked: false, views: 0, ...(site ? { site: true, sharedWith: 'Anyone with the link' } : {}) };
    const patch = { shareLinks: [...pres.shareLinks, link] };
    if (site) {
      // F17: the hand-built site goes out under a share link and becomes a station on the Computing line.
      const lines = map.lines.some((l) => l.id === 'computing') ? ['computing'] : [map.lines[0].id];
      const e = addStation(studentId, { title: 'Published my own portfolio site', type: 'project', lineIds: lines, summary: 'Hand-built in HTML on the read API, published through a share link.', visibility: 'publishable', via: 'Code tier',
        evidence: [{ kind: 'link', url: appUrl(`s/${link.token}`), caption: `Live site /s/${link.token}` }] });
      patch.site = { ...(pres.site || {}), token: link.token, publishedAt: new Date().toISOString(), eventId: e.id };
    }
    updateDraft(pres.id, patch);
    logLink(studentId, `${site ? 'Published a hand-built site' : 'Created share link'} /s/${link.token} for “${pres.title}”`);
    setNewLink({ link, title: site ? `${pres.title} (your own site)` : pres.title });
  };
  // The phone app's shortcuts, #/me/add and #/me/snap: the add flow over the student's home, at any level.
  if (screen === 'add' || screen === 'snap') {
    const home = () => { history.replaceState(null, '', `#/${persona.id}/map`); go(persona.id, 'map'); };
    return <><StudentScreens {...{ drafts, setDrafts, audience, setAudience, tier, setTier, toast, version, go, persona, studentId }} screen="map" />
      {!map.student.onboarding && <QuickAdd map={map} studentId={studentId} toast={toast} camera={screen === 'snap'} onClose={home} />}</>;
  }
  if (map.student.onboarding) return <Onboarding map={map} studentId={studentId} onDone={() => { toast('Your map is ready.'); go(persona.id, 'map'); }} />;
  const level = getIntensity(studentId);
  if (screen === 'leaver' && !leaverAllowed(studentId)) screen = 'map'; // under Year 11: no leaver portfolio
  if (screen === 'cas' && !casAllowed(studentId)) screen = 'map'; // CAS: Years 12 and 13
  if (level === 'simple' && screen === 'map') return <>{nudge}<SimpleHome map={map} studentId={studentId} toast={toast} version={version} addRequest={addReq} focusId={param} /></>;
  if (screen === 'leaver' && leaverAllowed(studentId)) return <LeaverBuilder studentId={studentId} version={version} toast={toast} />;
  if (screen === 'poster') return <Poster map={map} publicMap={publicMap} drafts={myDrafts} toast={toast} />;
  if (screen === 'family') return <ShowFamily map={map} toast={toast} version={version} />;
  if (screen === 'links') return <ShareLinks studentId={studentId} drafts={myDrafts} updateDraft={updateDraft} toast={toast} version={version} />;
  if (screen === 'activity') return <Activity studentId={studentId} version={version} />;
  if (screen === 'privacy') return <Privacy studentId={studentId} drafts={myDrafts} toast={toast} go={go} persona={persona} version={version} />;
  if (screen === 'cas' && casAllowed(studentId)) return <CasLog studentId={studentId} version={version} toast={toast} go={go} persona={persona} />;
  if (screen === 'map') return <>{nudge}<StudentMap map={map} studentId={studentId} toast={toast} version={version} focusId={param} go={go} persona={persona} addRequest={addReq} /></>;
  if (screen === 'studio') return <>{newLink && <ShareDialog link={newLink.link} title={newLink.title} onClose={() => setNewLink(null)} />}
    {gapFor && <ShareGaps pres={gapFor} gaps={gapsOf(gapFor)} lines={map.lines} toast={toast} onClose={() => setGapFor(null)} onShare={() => { const p = gapFor; setGapFor(null); share(myDrafts.find((x) => x.id === p.id) || p); }} />}<Studio key={studentId} level={level} map={publicMap} drafts={myDrafts} audience={(level === 'simple' && !['general', 'university', 'employer'].includes(audience)) || (level === 'standard' && audience === 'custom') ? 'general' : audience} setAudience={setAudience} tier={level === 'simple' ? 'template' : level === 'standard' && tier === 'code' ? 'builder' : tier} setTier={setTier} updateDraft={updateDraft} onShare={askShare} toast={toast} /></>;
  if (screen === 'shared') return <SharedView key={studentId} publicMap={publicMap} drafts={myDrafts} links={links} />;
  if (screen === 'inbox') return <IntegrationsPanel map={map} lens={applyLens(map, null)} newIds={new Set()} onAdded={(e) => { toast(`Added “${e.title}” to the map`); go(persona.id, 'map', e.id); }} toast={toast} version={version} />;
  return null;
}

function AlumPoster({ version, toast, drafts }) {
  const map = useMemo(() => getAlumMap(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const publicMap = useMemo(() => getAlumMap('public'), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Poster alum map={map} publicMap={publicMap} drafts={drafts['st-01'] || []} toast={toast} />;
}
