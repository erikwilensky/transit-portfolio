import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import App from './App.jsx';
import SignIn from './screens/SignIn.jsx';
import FamilyJoin from './screens/FamilyJoin.jsx';
import { getAuth, loadAuth, onAuth } from './auth.js';
import { isPublicRoute } from './publicRoute.js';
import { startSync } from './sync.js';
import { OfflineBar } from './components/OfflineBar.jsx';
import { useLiveDate } from './api.js';
import './styles.css';
import './print.css';
import { keepShell, registerServiceWorker } from './pwa.js';
import { UpdateBar } from './components/PhoneApp.jsx';
import { RefusedBar } from './components/Refused.jsx';
import { PreviewBar } from './components/PreviewBar.jsx';
import { previewTarget, startPreview, watchPreviewLinks } from './preview.js';

// Pilot mode: sign in first (public share, verify and family links stay open). Demo mode: straight into the app.
const isPublic = () => /^#\/?(s|v|p)(\/|$)/.test(location.hash);
const setupToken = () => location.hash.match(/^#\/?setup\/([^/?]+)/)?.[1];
const familyToken = () => location.hash.match(/^#\/?family\/([\w-]{16,64})$/)?.[1]; // a family letter's link
// After signing in, start the page afresh so the record loads for this person.
const done = () => { location.hash = '#/'; location.reload(); };
function Root() {
  const [auth, setAuth] = useState(getAuth);
  const [, setHash] = useState(location.hash);
  useEffect(() => onAuth(setAuth), []);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  if (auth.mode === 'pilot' && familyToken()) {
    document.documentElement.dataset.theme ||= window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return <FamilyJoin token={familyToken()} onDone={done} />;
  }
  if (auth.mode === 'pilot' && (setupToken() || (!auth.user && !isPublic()))) {
    document.documentElement.dataset.theme ||= window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return <SignIn setupToken={setupToken()} onDone={done} />;
  }
  return <App />;
}
// The shared record (src/sync.js): with a server, take its record before the first paint, in demo mode
// or once signed in. Never on public share and verify pages (they read /api/public/*); if a reader
// moves on from one into the app, start then.
const mayShare = () => { const a = getAuth(); return a.server && (a.mode !== 'pilot' || !!a.user); };
// Offline capture: the signed-in account's changes not sent yet are taken up again; with no connection, this device's copy.
const sync = () => { const a = getAuth(); if (a.mode === 'pilot' && a.user) keepShell(); return startSync({ user: a.mode === 'pilot' ? a.user?.id : null, offline: !!a.offline }); };
const render = () => createRoot(document.getElementById('root')).render(<><PreviewBar /><Root /><UpdateBar /><RefusedBar /><OfflineBar /></>);
registerServiceWorker(); // the phone app (src/pwa.js)
loadAuth().then(() => {
  if (getAuth().mode === 'pilot') useLiveDate(); // a pilot runs on the real calendar, like its server
  if (!mayShare()) return render();
  // Admin "See as" (src/preview.js): that person's copy, read-only, and no sync. If it cannot start, the admin's own view.
  watchPreviewLinks();
  const pv = getAuth().mode === 'pilot' && previewTarget();
  if (pv) return startPreview(pv).then((on) => (on ? render() : sync().finally(render)));
  if (!isPublicRoute()) return sync().finally(render);
  render();
  const f = () => { if (!isPublicRoute()) { removeEventListener('hashchange', f); sync(); } };
  addEventListener('hashchange', f);
});
