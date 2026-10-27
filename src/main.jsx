import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import App from './App.jsx';
import SignIn from './screens/SignIn.jsx';
import { getAuth, loadAuth, onAuth } from './auth.js';
import './styles.css';
import './print.css';

// Pilot mode: sign in first (public share, verify and family links stay open). Demo mode: straight into the app.
const isPublic = () => /^#\/?(s|v|p)(\/|$)/.test(location.hash);
const setupToken = () => location.hash.match(/^#\/?setup\/([^/?]+)/)?.[1];
// After signing in, start the page afresh so the record loads for this person.
const done = () => { location.hash = '#/'; location.reload(); };
function Root() {
  const [auth, setAuth] = useState(getAuth);
  const [, setHash] = useState(location.hash);
  useEffect(() => onAuth(setAuth), []);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  if (auth.mode === 'pilot' && (setupToken() || (!auth.user && !isPublic()))) {
    document.documentElement.dataset.theme ||= window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return <SignIn setupToken={setupToken()} onDone={done} />;
  }
  return <App />;
}
loadAuth().then(() => createRoot(document.getElementById('root')).render(<Root />));
