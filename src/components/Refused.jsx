import { useEffect, useState } from 'react';
import { getAuth } from '../auth.js';

// A change the server refused would otherwise just vanish when this browser fetches the record again. Say so, and when
// the reason is that the browser is now signed in as someone else (private windows and tabs share one sign-in), say who.
export function RefusedBar() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    const on = async (ev) => {
      const { status, error, kept } = ev.detail || {};
      const me = getAuth().user;
      if (me && (status === 401 || status === 403)) {
        const now = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
        if (now && now.user?.id !== me.id) return setMsg({ reload: true, kept, who: now.user?.name || null });
      }
      setMsg({ text: error || 'the server did not accept it' });
    };
    // Coming back to this window: check it is still signed in as the same person before anything is changed.
    const back = async () => {
      const me = getAuth().user;
      if (!me || document.visibilityState !== 'visible') return;
      const now = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (now && now.user?.id !== me.id) setMsg({ reload: true, early: true, who: now.user?.name || null });
    };
    addEventListener('tp-refused', on); addEventListener('focus', back); document.addEventListener('visibilitychange', back);
    return () => { removeEventListener('tp-refused', on); removeEventListener('focus', back); document.removeEventListener('visibilitychange', back); };
  }, []);
  if (!msg) return null;
  return (
    <div className="pa-update rf-bar" role="alert">
      {msg.reload
        ? <span>{msg.who ? `This browser is now signed in as ${msg.who}, from another window.` : 'This browser was signed out in another window.'} {msg.early ? 'Reload before changing anything.' : msg.kept ? 'Your changes wait on this device until you sign in again.' : 'Your last change was not saved.'}</span>
        : <span>That change was not saved: {msg.text}.</span>}
      {msg.reload ? <button onClick={() => location.reload()}>Reload</button> : <button onClick={() => setMsg(null)}>OK</button>}
    </div>
  );
}
