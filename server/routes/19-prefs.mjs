// Per-person settings: POST /api/auth/prefs { lang?, display? } changes the signed-in account's own language ('en' or
// 'th') and display options (src/a11y.js), and nobody else's (no account id is taken). /api/auth/me then carries
// `lang` and `display` on the user, on every device.
// display: { size: 'normal'|'large'|'larger', contrast: bool, font: bool, motion: 'auto'|'on'|'off' }, all four.
// notify: { kinds: { [group]: 'off'|'week' (staff)|'on' }, quiet: { on, from: 'HH:MM', to: 'HH:MM' } } (src/notify-kinds.js).
import { send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import { me } from './10-auth.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const DISPLAY = { size: ['normal', 'large', 'larger'], contrast: [true, false], font: [true, false], motion: ['auto', 'on', 'off'] };
const displayOk = (d) => !!d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length === 4 && Object.entries(DISPLAY).every(([k, v]) => v.includes(d[k]));
export default (app) => {
  app.post('/api/auth/prefs', async (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const b = await readJson(req);
    if (b?.display !== undefined && !displayOk(b.display)) throw bad(400, 'Those display settings are not known.');
    const display = b?.display && Object.fromEntries(Object.keys(DISPLAY).map((k) => [k, b.display[k]]));
    let notify;
    if (b?.notify !== undefined) {
      const why = api.notifyProblem(b.notify, api.notifyAudience(req.user.kind));
      if (why) throw bad(400, why);
      notify = { kinds: Object.fromEntries(Object.entries(b.notify.kinds || {}).filter(([, v]) => v !== 'on')), quiet: b.notify.quiet || { on: false, from: '21:00', to: '07:00' } };
    }
    const problem = A.setPrefs(req.user, { lang: b?.lang, display, notify });
    if (problem) throw bad(400, problem);
    send(res, 200, { user: me(req.user) });
  });
};
