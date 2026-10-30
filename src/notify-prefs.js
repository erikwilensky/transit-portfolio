// Notification settings in the browser (src/notify-kinds.js has the rules). In a pilot they belong to the signed-in
// account (POST /api/auth/prefs { notify }, back on /api/auth/me as user.notify), so every device follows them. In the
// demo they are kept on this device, one set per persona (localStorage['tp-notify']). A See as preview shows the
// previewed account's and never saves.
import { getAuth } from './auth.js';
import { inPreview, preview } from './preview.js';
import { cleanNotify } from './notify-kinds.js';

const KEY = 'tp-notify';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
let demo = load();
const subs = new Set();
export const onNotifyPrefs = (fn) => (subs.add(fn), () => subs.delete(fn));
const pilot = () => { const s = getAuth(); return s.mode === 'pilot' && !!s.user; };

export function getNotifyPrefs(persona) {
  if (inPreview()) return cleanNotify(preview()?.user?.notify);
  if (pilot()) return cleanNotify(getAuth().user.notify);
  return cleanNotify(demo[persona?.id]);
}
// Returns null when saved, else an error message (the choice stays on this page either way).
export async function setNotifyPrefs(persona, next) {
  const p = cleanNotify(next);
  if (inPreview()) return 'Preview only: nothing is saved';
  if (!pilot()) {
    demo = { ...demo, [persona.id]: p };
    try { localStorage.setItem(KEY, JSON.stringify(demo)); } catch { /* blocked: this page keeps it */ }
    subs.forEach((fn) => fn(p));
    return null;
  }
  getAuth().user.notify = p;
  subs.forEach((fn) => fn(p));
  try {
    const r = await fetch('/api/auth/prefs', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notify: p }) });
    return r.ok ? null : (await r.json().catch(() => ({}))).error || 'Not saved. Try again.';
  } catch { return 'Not saved: you are offline. This device keeps it for now.'; }
}
