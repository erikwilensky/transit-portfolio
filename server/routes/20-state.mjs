// The shared record: read it, change it, hear about changes, reset it.
// A browser runs each change itself first, then posts { fn, args, rec } here; the server replays
// the same api.js function with the recorded ids and times (api.runAction), so both end identical.
import { send, readJson } from '../lib.mjs';
import { api, changed, onChange, rev } from '../store.mjs';
import { MODE, canAct, isAdmin } from '../auth.mjs';
import { undoProblem, rebuild } from '../history.mjs';
import { scopedSnapshot, touchedBy } from '../scope.mjs';
import * as L from '../audit.mjs';

// The changes a browser may ask for: every api.js mutator, except reset (POST /api/reset) and erasure
// (POST /api/admin/students/:id/erase, which also removes the student's files and accounts).
const ALLOW = new Set(api.MUTATORS.filter((n) => n !== 'resetDemo' && n !== 'eraseStudent'));
// One change at a time, in the order they arrive.
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
const decode = (args) => args.map((x) => (x && typeof x === 'object' && x.$undefined === 1 ? undefined : x));
const userId = (req) => req.user?.id ?? null;
const json = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
// Activity log (server/audit.mjs): the change's main student, teacher and item ids, never its text.
// An item id only when the record has an item by that id (a note's text is never taken for one).
const KNOWN = ['getEvent', 'getReport', 'getMomentComment', 'getSpotted', 'getClassPrompt', 'getLine', 'getPresentation', 'getExhibition', 'getSchoolEvent'];
const known = (x) => typeof x === 'string' && x.length <= 64 && KNOWN.some((g) => { try { return !!api[g]?.(x); } catch { return false; } });
function targetOf(fn, args) {
  let t = {}; try { const x = touchedBy(fn, args); t = { ...L.studentsTarget(x.students), ...(x.as?.[0] && x.as[0] !== '?' ? { teacherId: x.as[0] } : {}) }; } catch { /* malformed */ }
  const id = args.find((a) => a !== t.studentId && a !== t.teacherId && known(a));
  if (fn === 'moderateReport' || fn === 'reportItem') { const r = fn === 'moderateReport' ? api.getReport?.(args[0]) : null; return { ...t, ...(r ? { reportId: r.id, ...L.studentsTarget([r.studentId]) } : {}), ...(args[0]?.eventId ? { id: args[0].eventId } : {}) }; }
  return { ...t, ...(id ? { id } : {}) };
}
const detailOf = (fn, args) => (fn === 'moderateReport' && typeof args[1] === 'string' && /^\w{1,20}$/.test(args[1]) ? { decision: args[1] } : undefined);
const logAction = (req, fn, args, status) => { const a = Array.isArray(args) ? decode(args) : []; L.log(req, { action: fn === 'moderateReport' ? 'report-decision' : 'change', fn: String(fn).slice(0, 60), target: ALLOW.has(fn) ? targetOf(fn, a) : {}, detail: ALLOW.has(fn) ? detailOf(fn, a) : undefined, status }); };

export default (app) => {
  // Pilot: each person downloads only their own part of the record (server/scope.mjs). Demo: all of it.
  app.get('/api/state', (req, res) => send(res, 200, { snapshot: MODE === 'pilot' ? scopedSnapshot(req.user) : JSON.parse(api.snapshot()), rev }));

  app.post('/api/action', async (req, res) => {
    const { fn, args = [], rec = [] } = await readJson(req);
    if (!ALLOW.has(fn)) { logAction(req, fn, [], 400); return send(res, 400, { error: `Not an allowed change: ${fn}` }); }
    if (!Array.isArray(args) || !Array.isArray(rec)) { logAction(req, fn, [], 400); return send(res, 400, { error: 'args and rec must be arrays' }); }
    // Pilot: each person may only make the changes their role allows (server/auth.mjs). Demo: no accounts, all allowed.
    if (MODE === 'pilot' && !canAct(req.user, fn, decode(args))) { logAction(req, fn, args, 403); return send(res, 403, { error: 'Not allowed for your account' }); }
    const out = await serial(() => {
      const prev = rev;
      let target = {};
      try { target = MODE === 'pilot' ? targetOf(fn, decode(args)) : {}; } catch { /* malformed */ }
      const done = (status) => L.log(req, { action: fn === 'moderateReport' ? 'report-decision' : 'change', fn, target, detail: detailOf(fn, decode(args)), status });
      try {
        const result = json(api.runAction(fn, decode(args), rec));
        if (!target.id && typeof result?.id === 'string' && known(result.id)) target.id = result.id;
        done(200);
        // scoped: the browser ran it on its part of the record only, so it fetches its new part. by/args: usage counting.
        return { status: 200, body: { result, rev: changed({ fn, step: { fn, args, rec }, userId: userId(req), by: req.user?.id, args: decode(args) }), prev, ...(MODE === 'pilot' ? { scoped: true } : {}) } };
      } catch (e) {
        // The change may have half-run: save and announce anyway, so every device resyncs.
        console.error(`Action ${fn} failed:`, e.message);
        done(e.status || 422);
        return { status: e.status || 422, body: { error: e.message, rev: changed({ fn, error: true }), prev } };
      }
    });
    send(res, out.status, out.body);
  });

  // Undo one change (or a few made together) by rev: rebuilt without it, every later change kept (server/history.mjs).
  // Pilot: only your own changes, unless admin. → { rev, prev, undone, skipped: [{ rev, fn, error }] }
  app.post('/api/undo', async (req, res) => {
    const body = await readJson(req);
    const revs = [...new Set(Array.isArray(body.revs) ? body.revs : [body.rev])];
    if (!revs.length || !revs.every(Number.isInteger)) return send(res, 400, { error: 'Say which change to undo' });
    const out = await serial(() => {
      for (const r of revs) { const p = undoProblem(r, req.user, { mode: MODE, isAdmin }); if (p) { L.log(req, { action: 'undo', detail: { revs: revs.slice(0, 20) }, status: p.status }); return { status: p.status, body: { error: p.error } }; } }
      const prev = rev;
      const u = rebuild(revs);
      L.log(req, { action: 'undo', detail: { revs: u.revs, skipped: u.dropped.length } });
      return { status: 200, body: { rev: changed({ fn: 'undo', undo: u, userId: userId(req) }), prev, undone: u.revs, skipped: u.dropped } };
    });
    send(res, out.status, out.body);
  });

  app.post('/api/reset', async (req, res) => {
    if (MODE === 'pilot') return send(res, 403, { error: 'Reset is only for the demo' });
    const out = await serial(() => { const prev = rev; api.resetDemo(); return { rev: changed({ fn: 'resetDemo' }), prev }; });
    send(res, 200, out);
  });

  // Server-Sent Events: { rev } now and after every change, a comment every 25s to keep proxies open.
  app.get('/api/stream', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    const push = (info) => res.write(`data: ${JSON.stringify({ rev: info.rev })}\n\n`);
    res.write('retry: 3000\n\n'); push({ rev });
    const off = onChange(push);
    const beat = setInterval(() => res.write(': hb\n\n'), 25000);
    req.on('close', () => { off(); clearInterval(beat); });
  });
};
