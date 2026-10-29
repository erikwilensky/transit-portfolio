import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import App from './App.jsx';
import SignIn from './screens/SignIn.jsx';
import FamilyJoin from './screens/FamilyJoin.jsx';
import { getAuth, loadAuth, onAuth } from './auth.js';
import { isPublicRoute } from './publicRoute.js';
import { startSync } from './sync.js';
import { useLiveDate } from './api.js';
import './styles.css';
import './print.css';
import { registerServiceWorker } from './pwa.js';
import { UpdateBar } from './components/PhoneApp.jsx';
import { RefusedBar } from './components/Refused.jsx';

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
const render = () => createRoot(document.getElementById('root')).render(<><Root /><UpdateBar /><RefusedBar /></>);
registerServiceWorker(); // the phone app (src/pwa.js)
loadAuth().then(() => {
  if (getAuth().mode === 'pilot') useLiveDate(); // a pilot runs on the real calendar, like its server
  if (!mayShare()) return render();
  if (!isPublicRoute()) return startSync().finally(render);
  render();
  const f = () => { if (!isPublicRoute()) { removeEventListener('hashchange', f); startSync(); } };
  addEventListener('hashchange', f);
});
