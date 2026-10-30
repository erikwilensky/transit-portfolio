// Class list sync from the SIS (server/sis.mjs), pilot only, admins only. Nothing is applied without an admin.
//   GET  /api/admin/sis                         → { configured, connected, lastChecked, lastError, syncAt, tz, mapped, checking, reports }
//   POST /api/admin/sis/check                   → { ...that, error? }  ("Check now": fetch, validate, build a change report)
//   POST /api/admin/sis/reports/:id/apply { pauseLeavers? } → the roster import's body (setup links for new accounts) + { sis }
//   POST /api/admin/sis/reports/:id/dismiss     → { sis }
// Never the URL or the token: only whether it is set up, when it last checked, and the last error.
import { send, readJson } from '../lib.mjs';
import { api } from '../store.mjs';
import * as A from '../auth.mjs';
import * as L from '../audit.mjs';
import * as S from '../sis.mjs';
import { requireAdmin } from './10-auth.mjs';
import { applyRoster } from './15-roster.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
export function view() {
  const { status, reports } = S.load(), c = S.CFG;
  const ok = status.lastOk && (!status.lastError || status.lastOk >= status.lastError.at);
  return { configured: !!c.url, connected: !!(c.url && ok), lastChecked: status.lastChecked, lastError: status.lastError, syncAt: c.at, tz: c.tz, mapped: !!c.map, checking: S.isChecking(), reports };
}
const guard = (req) => { if (A.MODE !== 'pilot') throw bad(403, 'Class list sync is for the pilot only.'); requireAdmin(req); };
const who = (u) => ({ id: u.id, name: u.name });

export default (app) => {
  app.get('/api/admin/sis', (req, res) => { guard(req); send(res, 200, view()); });
  app.post('/api/admin/sis/check', async (req, res) => {
    guard(req);
    if (!S.CFG.url) throw bad(409, 'The SIS is not set up: add SIS_URL and SIS_TOKEN to the pilot’s settings.');
    const r = await S.check(req);
    send(res, 200, { ...view(), ...(r.error ? { error: r.error } : {}) });
  });
  app.post('/api/admin/sis/reports/:id/apply', async (req, res, { id }) => {
    guard(req);
    const b = await readJson(req);
    const r = S.load().reports.find((x) => x.id === id);
    if (!r) throw bad(404, 'No such report.');
    const roster = r.status === 'ready' && S.pendingRoster(id);
    if (!roster) throw bad(409, r.status === 'refused' ? 'This report cannot be applied: too many students left the feed.' : 'This report is no longer waiting to be applied.');
    if ((api.getStore().rosterImport?.at || null) !== r.base) throw bad(409, 'The class lists changed since this check. Press Check now for a new report.');
    const out = applyRoster(req, roster, { pauseLeavers: !!b.pauseLeavers, action: 'sis-apply', detail: { report: id } });
    S.settle(id, 'applied', who(req.user), { accountsCreated: out.newAccounts.created.length, paused: out.paused.length, unpaused: out.unpaused.length }, out.summary);
    send(res, 200, { ...out, sis: view() });
  });
  app.post('/api/admin/sis/reports/:id/dismiss', (req, res, { id }) => {
    guard(req);
    const r = S.load().reports.find((x) => x.id === id);
    if (!r) throw bad(404, 'No such report.');
    if (r.status !== 'ready') throw bad(409, 'This report is no longer waiting.');
    S.settle(id, 'dismissed', who(req.user));
    L.log(req, { action: 'sis-dismiss', target: { id } });
    send(res, 200, { sis: view() });
  });
  // The nightly check: a look every 30 s (and once shortly after start), pilot only, when SIS_URL is set.
  if (A.MODE === 'pilot' && S.CFG.url && S.CFG.at) {
    const t = () => { try { S.tick()?.catch((e) => console.error('SIS check:', e)); } catch (e) { console.error('SIS check:', e); } };
    setTimeout(t, 1000).unref();
    setInterval(t, 30_000).unref();
  }
};
