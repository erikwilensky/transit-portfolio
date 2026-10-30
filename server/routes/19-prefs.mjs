// Per-person settings: POST /api/auth/prefs { lang?, display? } changes the signed-in account's own language ('en' or
// 'th') and display options (src/a11y.js), and nobody else's (no account id is taken). /api/auth/me then carries
// `lang` and `display` on the user, on every device.
// display: { size: 'normal'|'large'|'larger', contrast: bool, font: bool, motion: 'auto'|'on'|'off' }, all four.
import { send, readJson } from '../lib.mjs';
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
    const problem = A.setPrefs(req.user, { lang: b?.lang, display });
    if (problem) throw bad(400, problem);
    send(res, 200, { user: me(req.user) });
  });
};
