import { useEffect, useState } from 'react';
import { getAuth } from '../auth.js';
import { getLang } from '../api.js';
import { barWords, errText } from '../i18n.js';

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
      setMsg({ text: error || null });
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
  const lang = getLang(), w = barWords(lang);
  return (
    <div className="pa-update rf-bar" role="alert" lang={lang}>
      {msg.reload
        ? <span>{msg.who ? w.nowAs(msg.who) : w.out} {msg.early ? w.early : msg.kept ? w.kept : w.lost}</span>
        : <span>{w.refused(msg.text ? errText(lang, msg.text) : w.why)}</span>}
      {msg.reload ? <button onClick={() => location.reload()}>{w.reload}</button> : <button onClick={() => setMsg(null)}>{w.ok}</button>}
    </div>
  );
}
