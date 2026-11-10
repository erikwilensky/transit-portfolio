// Display options: text size, high contrast, easy-read font, reduce motion (docs/pilot-server.md, "Readability and
// accessibility"). Shown as classes on <html> (src/a11y.css); every CSS font size scales with --ts (vite.config.js).
// Kept on this device (localStorage), and in a pilot on the signed-in account too (POST /api/auth/prefs { display }),
// so the account's choice follows the person to every device.
import { getAuth, onAuth } from './auth.js';
import { inPreview } from './preview.js';

export const SIZES = [['normal', 'Normal'], ['large', 'Large'], ['larger', 'Larger']];
export const MOTION = [['auto', 'Like this device'], ['on', 'On'], ['off', 'Off']];
export const DISPLAY_DEFAULT = { size: 'normal', contrast: false, font: false, motion: 'auto' };
export const cleanDisplay = (d) => ({
  size: SIZES.some(([k]) => k === d?.size) ? d.size : 'normal',
  contrast: d?.contrast === true, font: d?.font === true,
  motion: MOTION.some(([k]) => k === d?.motion) ? d.motion : 'auto',
});
const KEY = 'tp-display';
const load = () => { try { return cleanDisplay(JSON.parse(localStorage.getItem(KEY))); } catch { return { ...DISPLAY_DEFAULT }; } };
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* blocked */ } };
let cur = load();
const subs = new Set();
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export const getDisplay = () => cur;
export const onDisplay = (fn) => (subs.add(fn), () => subs.delete(fn));
// Reduce motion: the person's choice, else the device's setting. Animations written in JS ask this (useTween, milestones).
export const calm = () => cur.motion === 'on' || (cur.motion === 'auto' && !!mq?.matches);

function apply() {
  if (typeof document === 'undefined') return;
  const c = document.documentElement.classList;
  c.toggle('a11y-large', cur.size === 'large'); c.toggle('a11y-larger', cur.size === 'larger');
  c.toggle('a11y-contrast', cur.contrast); c.toggle('a11y-font', cur.font); c.toggle('a11y-calm', calm()); c.toggle('a11y-moving', cur.motion === 'off');
  subs.forEach((fn) => fn(cur));
}
// A photo's alt text: its caption, unless that is only a file name (a phone's IMG_1234.jpg), then the moment's title.
export const photoAlt = (ev, title) => { const c = (ev?.caption || '').trim(); return c && !/\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(c) && !/^(img|dsc|pxl|photo)[-_ ]?\d/i.test(c) ? c : title || 'Photo'; };
const signedIn = (s = getAuth()) => s.mode === 'pilot' && !!s.user;

export async function setDisplay(patch) {
  cur = cleanDisplay({ ...cur, ...patch }); save(cur); apply();
  if (!signedIn() || inPreview()) return;
  getAuth().user.display = cur;
  try { await fetch('/api/auth/prefs', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display: cur }) }); } catch { /* offline: this device keeps it */ }
}

// A signed-in account's own choice wins (defaults when it has none), on every device it signs in on.
onAuth((s) => { if (signedIn(s) && !inPreview()) { cur = cleanDisplay(s.user.display); save(cur); apply(); } });
mq?.addEventListener?.('change', apply);
apply();

// Full-screen overlays that are not .modal-back dialogs (print sheets, sign-in cards, conference and meeting modes;
// src/App.jsx handles .modal-back): focus moves into one when it opens, Tab stays inside it, and focus returns to
// where it was when it closes. Each overlay closes on Escape itself.
const OVERLAY = '.sc-overlay, .cas-code-overlay, .cf-overlay, .meeting, .slc-mode, .mu-overlay';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const open = []; // [overlay, the element focused before it]
  new MutationObserver(() => {
    for (const el of document.querySelectorAll(OVERLAY)) {
      if (open.some(([o]) => o === el)) continue;
      open.push([el, document.activeElement]);
      if (!el.contains(document.activeElement)) [...el.querySelectorAll(FOCUSABLE)].find((x) => x.offsetParent !== null)?.focus();
    }
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i][0].isConnected) continue;
      const [, back] = open.splice(i, 1)[0];
      if (back?.isConnected && !open.length) back.focus();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('keydown', (e) => {
    const dlg = e.key === 'Tab' && !document.querySelector('.modal-back') && open.at(-1)?.[0];
    if (!dlg) return;
    const f = [...dlg.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });
}
