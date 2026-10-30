import { send } from '../lib.mjs';
import { VERSION } from '../health.mjs';
export default (app) => app.get('/api/health', (req, res) => send(res, 200, { ok: true, at: new Date().toISOString(), version: VERSION.label }));
