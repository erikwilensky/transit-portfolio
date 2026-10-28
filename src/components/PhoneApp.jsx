import { useEffect, useState } from 'react';
import { dismissHint, hintDismissed, install, isIos, onPhone, onPwa, standalone } from '../pwa.js';
import './phone-app.css';

// "A new version is ready": a new deploy's service worker has taken over; the page reloads into it.
export function UpdateBar() {
  const [s, setS] = useState({});
  useEffect(() => onPwa(setS), []);
  if (!s.update) return null;
  return <div className="pa-update" role="status">A new version is ready <button onClick={() => location.reload()}>Reload</button></div>;
}

// For students on phones: how to put the app on the home screen. Dismissed once, gone on this device.
export function InstallHint() {
  const [s, setS] = useState({});
  const [hidden, setHidden] = useState(() => hintDismissed() || standalone() || !onPhone());
  useEffect(() => onPwa(setS), []);
  // Room at the foot of the page, so the fixed card never covers the last buttons (Feedback, Add).
  useEffect(() => { document.body.classList.toggle('pa-hint-on', !hidden); return () => document.body.classList.remove('pa-hint-on'); }, [hidden]);
  if (hidden) return null;
  const close = () => { dismissHint(); setHidden(true); };
  return (
    <aside className="pa-hint" aria-label="Add the app to your home screen">
      <img src="icons/icon-192.png" alt="" width="44" height="44" />
      <div>
        <b>Put Transit on your home screen</b>
        {s.prompt ? <p>Open it like an app, and add a photo in two taps.</p>
          : isIos() ? <p>In Safari, tap Share <svg className="pa-share" width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 1v9M3.5 4.5L7 1l3.5 3.5M4 7H1.5v8h11V7H10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>, then <b>Add to Home Screen</b>.</p>
            : <p>Open your browser menu <span aria-hidden="true">⋮</span> and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>}
        {s.prompt && <button className="primary" onClick={() => install().then((ok) => ok && close())}>Install</button>}
      </div>
      <button className="pa-x" onClick={close} aria-label="Not now">×</button>
    </aside>
  );
}
