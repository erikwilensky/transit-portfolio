// Admin "See as": a read-only look at the app as another account sees it. No session swap, no cookie change:
// the admin stays signed in as themselves and the browser shows this copy without syncing (src/preview.js).
// GET /api/admin/preview/:accountId (admin) → { user: that account as /api/auth/me gives it, snapshot: its scoped
//     record (server/scope.mjs), rev }. Never a password hash, setup token or session.
// Each start writes one line to DATA_DIR/audit.log: { at, action: 'preview', by, accountId, kind }.
import { send } from '../lib.mjs';
import { rev } from '../store.mjs';
import * as A from '../auth.mjs';
import { scopedSnapshot } from '../scope.mjs';
import { me, requireAdmin } from './10-auth.mjs';
import { audit } from './50-pdpa.mjs';
import { previewing } from '../files.mjs';
import * as L from '../audit.mjs';
import { readJson } from '../lib.mjs';
import { accountTarget } from './10-auth.mjs';

export default (app) => {
  app.get('/api/admin/preview/:accountId', (req, res, { accountId }) => {
    requireAdmin(req);
    const a = A.accountById(accountId);
    if (!a) return send(res, 404, { error: 'No such account.' });
    audit({ action: 'preview', by: req.user.id, accountId: a.id, kind: a.kind });
    previewing(req.user, a.id); // its files open for this admin while they look
    L.log(req, { action: 'see-as-start', target: accountTarget(a), detail: { kind: a.kind } });
    send(res, 200, { user: me(a), snapshot: scopedSnapshot(a), rev });
  });
  // Exit from See as (src/preview.js): only for the activity log.
  app.post('/api/admin/preview/stop', async (req, res) => {
    requireAdmin(req);
    const a = A.accountById(String((await readJson(req)).accountId || ''));
    L.log(req, { action: 'see-as-stop', target: a ? accountTarget(a) : {} });
    send(res, 200, { ok: true });
  });
};
