import { send } from '../lib.mjs';
export default (app) => app.get('/api/health', (req, res) => send(res, 200, { ok: true, at: new Date().toISOString() }));
