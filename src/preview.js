// Admin "See as": the app as another account sees it, read-only, while the admin stays signed in as themselves.
// #/preview/<accountId> (Accounts → "See as …") remembers the account for this tab (sessionStorage), fetches
// GET /api/admin/preview/:id (server/routes/18-preview.mjs) and shows that copy of the record with that person's
// persona. Sync never starts (no /api/stream, nothing posted), the record is never saved in this browser, and
// every change is refused before it runs: "Preview only: nothing is saved". Exit goes back to Accounts.
import { getStudent, loadPreview, setActionGuard } from './api.js';
import { personaFor, yearOf } from './auth.js';
import { home, setPilotPersona } from './personas.js';

export const PREVIEW_MSG = 'Preview only: nothing is saved';
const KEY = 'tp-preview';
const fromHash = () => location.hash.match(/^#\/?preview\/([\w-]+)/)?.[1] || null;
let info = null; // { user, persona, label } once started; { error } when the server said no
export const preview = () => info;
export const inPreview = () => !!info?.persona;

export function previewTarget() {
  const h = fromHash();
  try { if (h) sessionStorage.setItem(KEY, h); return h || sessionStorage.getItem(KEY); } catch { return h; }
}
const forget = () => { try { sessionStorage.removeItem(KEY); } catch { /* blocked */ } };
// "See as" in the same tab: start the page afresh in preview.
export const watchPreviewLinks = () => addEventListener('hashchange', () => { if (fromHash()) location.reload(); });

export function exitPreview() {
  forget();
  location.hash = '#/me/accounts';
  location.reload();
}

const refused = () => dispatchEvent(new CustomEvent('tp-preview-refused'));
// A change the viewer asked for (a click, a key) is refused out loud, and throws so the screen stops there rather than
// carry on as if it was saved. One a screen makes by itself (an effect, a timer: reading the bell) is skipped quietly.
const PREVIEW_ERR = 'tp-preview-refused';
function blockWrites() {
  setActionGuard(() => {
    if (!globalThis.event || !/^(click|submit|keydown|keyup|change|input|pointerup|touchend)$/.test(globalThis.event.type)) return true;
    refused(); throw Object.assign(new Error(PREVIEW_MSG), { name: PREVIEW_ERR });
  });
  addEventListener('error', (e) => { if (e.error?.name === PREVIEW_ERR) e.preventDefault(); });
  const write = (method, url) => !/^(GET|HEAD)$/i.test(method || 'GET') && new URL(url, location.href).pathname.startsWith('/api/');
  const f = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    if (!write(init.method || input?.method, input?.url || String(input))) return f(input, init);
    refused();
    return Promise.resolve(new Response(JSON.stringify({ error: PREVIEW_MSG }), { status: 403, headers: { 'content-type': 'application/json' } }));
  };
  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.tpBlocked = write(method, String(url)); return open.call(this, method, url, ...rest); };
  XMLHttpRequest.prototype.send = function (...a) { if (!this.tpBlocked) return send.apply(this, a); refused(); setTimeout(() => this.onerror?.(new ProgressEvent('error'))); };
}

// "Year 8, 8C" for a student; otherwise the role their own header shows ("Sciences · Advisor, 8C", "Family · Aaron").
function labelOf(user, persona) {
  const s = user.studentId && getStudent(user.studentId);
  return s ? [yearOf(s), s.homeroom].filter(Boolean).join(', ') : persona.role || '';
}

// Resolves true when the preview is on; false (and the admin's own view) when it could not start.
export async function startPreview(id) {
  let j = {}, ok = false;
  try { const r = await fetch(`/api/admin/preview/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' }); ok = r.ok; j = await r.json(); } catch { /* no server */ }
  if (!ok || !j.snapshot) { forget(); info = { error: j.error || 'That preview could not be opened.' }; if (fromHash()) history.replaceState(null, '', '#/me/accounts'); return false; }
  loadPreview(j.snapshot);
  const persona = personaFor(j.user);
  setPilotPersona(persona);
  blockWrites();
  info = { user: j.user, persona, label: labelOf(j.user, persona) };
  if (fromHash()) history.replaceState(null, '', `#/${persona.id}/${home(persona)}`);
  return true;
}
