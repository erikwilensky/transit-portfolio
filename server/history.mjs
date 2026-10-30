// Undo one change, for anyone, without wiping other people's changes since.
// Every change to the record is kept here as the steps that made it ({ fn, args, rec }, replayable with
// api.runAction), grouped in segments that start from a saved copy of the record (a checkpoint, every
// CP_EVERY changes). Undo rebuilds: back to the checkpoint before the change, then every later change
// again except the undone ones. A later change that now fails is left out and reported.
// A change that cannot be replayed (reset, a whole-record restore, a failed action, a direct edit)
// starts a fresh segment: nothing before it can be undone any more.
// On disk: DATA_DIR/history/cp-<rev>.json (checkpoints) and log.jsonl (one change per line).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';
import { api, onChange, rev } from './store.mjs';

export const MAX_CHANGES = Number(process.env.UNDO_MAX || 200);
export const WINDOW_MS = Number(process.env.UNDO_WINDOW_MS || 2 * 3600e3);
const CP_EVERY = 20;
// An erasure also clears the history, so no saved copy keeps the erased student.
const BARRIER = new Set(['resetDemo', 'restore', 'eraseStudent']);
const DIR = path.join(DATA_DIR, 'history'), LOG = path.join(DIR, 'log.jsonl');
const cpFile = (r) => path.join(DIR, `cp-${r}.json`);

// undefined does not survive JSON (same marker as src/sync.js).
export const encode = (args) => args.map((x) => (x === undefined ? { $undefined: 1 } : x));
export const decode = (args) => args.map((x) => (x && typeof x === 'object' && x.$undefined === 1 ? undefined : x));

let segs = []; // [{ rev, snap, entries: [{ rev, userId, steps, at, undone?, dropped? } | { rev, userId, undo, dropped, at }] }]
let direct = []; // changes made by server code itself (admin, public pages), caught by the action hook
let rebuilding = false;
const save = (fn) => { try { fs.mkdirSync(DIR, { recursive: true }); fn(); } catch (e) { console.error('Undo history not saved:', e.message); } };
const writeLog = () => save(() => writeAtomic(LOG, segs.flatMap((s) => s.entries).map((e) => JSON.stringify(e) + '\n').join('')));
const fresh = (r) => {
  for (const s of segs) save(() => fs.rmSync(cpFile(s.rev), { force: true }));
  segs = [{ rev: r, snap: api.snapshot(), entries: [] }];
  save(() => writeAtomic(cpFile(r), segs[0].snap)); writeLog();
};

// Load from disk; anything that does not end at the record's own revision is thrown away.
function load() {
  try {
    const cps = fs.readdirSync(DIR).map((f) => /^cp-(\d+)\.json$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
    segs = cps.map((r) => ({ rev: r, snap: fs.readFileSync(cpFile(r), 'utf8'), entries: [] }));
    const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    for (const e of lines) { const s = segs.findLast((x) => x.rev < e.rev); if (s) s.entries.push(e); }
    const last = segs.at(-1)?.entries.at(-1)?.rev ?? segs.at(-1)?.rev;
    if (last !== rev) throw new Error('out of step');
  } catch { fresh(rev); }
}
load();

// Server code calling an api.js change directly (not through runAction): note its steps.
api.setActionHook((fn, args, rec) => { if (!rebuilding) direct.push({ fn, args: JSON.parse(JSON.stringify(encode(args))), rec }); });

// Server code whose direct call changed nothing (no changed() follows) forgets its steps, or the next change would start
// a fresh segment and nothing before it could be undone.
export const forgetDirect = (fn) => { direct = direct.filter((d) => d.fn !== fn); };

// Every changed() lands here. info.step (from /api/action) or the direct steps make it replayable.
onChange((info) => {
  const steps = info.undo ? null : info.step ? (direct.length ? null : [info.step]) : direct.length ? direct : null;
  direct = [];
  if (info.undo) return add({ rev: info.rev, userId: info.userId ?? null, undo: info.undo.revs, dropped: info.undo.dropped, at: Date.now() });
  if (!steps || info.error || steps.some((s) => BARRIER.has(s.fn))) return fresh(info.rev);
  add({ rev: info.rev, userId: info.userId ?? null, steps, at: Date.now() });
});
function add(e) {
  const last = segs.at(-1);
  last.entries.push(e);
  save(() => fs.appendFileSync(LOG, JSON.stringify(e) + '\n'));
  if (last.entries.length >= CP_EVERY) { segs.push({ rev: e.rev, snap: api.snapshot(), entries: [] }); save(() => writeAtomic(cpFile(e.rev), segs.at(-1).snap)); }
  // Keep about MAX_CHANGES, dropping whole segments from the front, and nothing older than the window.
  let cut = false;
  while (segs.length > 1 && (count() - segs[0].entries.length >= MAX_CHANGES || segs[0].entries.every((x) => x.at < Date.now() - WINDOW_MS))) {
    save(() => fs.rmSync(cpFile(segs[0].rev), { force: true })); segs.shift(); cut = true;
  }
  if (cut) writeLog();
}
const count = () => segs.reduce((n, s) => n + s.entries.length, 0);
const find = (r) => { for (const s of segs) { const e = s.entries.find((x) => x.rev === r); if (e) return e; } return null; };

// Features may refuse to undo some changes (guard(entry) → null or { status, error }), e.g. a photo batch students kept from.
export const undoGuards = new Set();
// May this person undo the change at rev r? Returns null or { status, error } in plain words.
export function undoProblem(r, user, { mode = 'demo', isAdmin = () => false } = {}) {
  const e = find(r);
  if (!e || e.at < Date.now() - WINDOW_MS) return { status: 410, error: 'That change is too old to undo.' };
  if (!e.steps) return { status: 400, error: 'An undo cannot be undone.' };
  if (e.undone) return { status: 409, error: 'That change was already undone.' };
  if (e.dropped) return { status: 409, error: 'That change is no longer in the record.' };
  if (mode === 'pilot' && !isAdmin(user) && (!user || e.userId !== user.id)) return { status: 403, error: 'You can only undo your own changes.' };
  for (const g of undoGuards) { const p = g(e); if (p) return p; }
  return null;
}

// Rebuild without the changes at `revs`. The caller checks undoProblem first, runs this in its
// one-at-a-time chain and calls changed({ undo: result, userId }) after. Returns { revs, dropped }.
export function rebuild(revs) {
  const set = new Set(revs);
  const at = segs.findLastIndex((s) => s.rev < Math.min(...revs));
  rebuilding = true;
  const dropped = [];
  try {
    api.load(JSON.parse(segs[at].snap));
    for (let i = at; i < segs.length; i++) {
      const s = segs[i];
      if (i > at) { s.snap = api.snapshot(); save(() => writeAtomic(cpFile(s.rev), s.snap)); } // later checkpoints follow the new history
      for (const e of s.entries) {
        if (!e.steps || e.undone || e.dropped) continue;
        if (set.has(e.rev)) { e.undone = true; continue; }
        const before = api.snapshot();
        try { for (const st of e.steps) api.runAction(st.fn, decode(st.args), st.rec); } catch (err) {
          api.load(JSON.parse(before)); e.dropped = true;
          dropped.push({ rev: e.rev, fn: e.steps[0].fn, error: err.message });
        }
      }
    }
  } finally { rebuilding = false; direct = []; }
  return { revs: [...set], dropped };
}

// Replay the undo markers kept on disk (flags are not in the log lines themselves).
for (const e of segs.flatMap((s) => s.entries)) if (e.undo) {
  for (const r of e.undo) { const x = find(r); if (x) x.undone = true; }
  for (const d of e.dropped || []) { const x = find(d.rev); if (x) x.dropped = true; }
}
export const historySize = () => count();
