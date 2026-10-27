// The shared record: read it, change it, hear about changes, reset it.
// A browser runs each change itself first, then posts { fn, args, rec } here; the server replays
// the same api.js function with the recorded ids and times (api.runAction), so both end identical.
import { send, readJson } from '../lib.mjs';
import { api, changed, onChange, rev } from '../store.mjs';
import { MODE, canAct } from '../auth.mjs';

// The changes a browser may ask for: every api.js mutator, except reset (POST /api/reset).
const ALLOW = new Set(api.MUTATORS.filter((n) => n !== 'resetDemo'));
// One change at a time, in the order they arrive.
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
const decode = (args) => args.map((x) => (x && typeof x === 'object' && x.$undefined === 1 ? undefined : x));
const json = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export default (app) => {
  app.get('/api/state', (req, res) => send(res, 200, { snapshot: JSON.parse(api.snapshot()), rev }));

  app.post('/api/action', async (req, res) => {
    const { fn, args = [], rec = [] } = await readJson(req);
    if (!ALLOW.has(fn)) return send(res, 400, { error: `Not an allowed change: ${fn}` });
    if (!Array.isArray(args) || !Array.isArray(rec)) return send(res, 400, { error: 'args and rec must be arrays' });
    // Pilot: each person may only make the changes their role allows (server/auth.mjs). Demo: no accounts, all allowed.
    if (MODE === 'pilot' && !canAct(req.user, fn, decode(args))) return send(res, 403, { error: 'Not allowed for your account' });
    const out = await serial(() => {
      const prev = rev;
      try {
        const result = json(api.runAction(fn, decode(args), rec));
        return { status: 200, body: { result, rev: changed({ fn }), prev } };
      } catch (e) {
        // The change may have half-run: save and announce anyway, so every device resyncs.
        console.error(`Action ${fn} failed:`, e.message);
        return { status: e.status || 422, body: { error: e.message, rev: changed({ fn, error: true }), prev } };
      }
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
