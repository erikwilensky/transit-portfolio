// Per-person settings: POST /api/auth/prefs { lang } changes the signed-in account's own language ('en' or 'th'),
// and nobody else's (no account id is taken). /api/auth/me then carries `lang` on the user, on every device.
import { send, readJson } from '../lib.mjs';
import * as A from '../auth.mjs';
import { me } from './10-auth.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
export default (app) => {
  app.post('/api/auth/prefs', async (req, res) => {
    if (!req.user) throw bad(401, 'Sign in first.');
    const b = await readJson(req);
    const problem = A.setPrefs(req.user, { lang: b?.lang });
    if (problem) throw bad(400, problem);
    send(res, 200, { user: me(req.user) });
  });
};
