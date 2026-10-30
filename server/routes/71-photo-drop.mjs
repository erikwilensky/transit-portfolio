// Class photo drop (api.dropPhotos, src/components/PhotoDrop.jsx): what the record cannot do itself, deleting files.
// Photos are uploaded with `x-purpose: photo-drop:<draft>` (server/routes/30-uploads.mjs keeps it in the .json beside each).
// - Sending a batch deletes every photo of that draft by that teacher that no student was given.
// - POST /api/photo-drops/discard { files: [name] } deletes the sender's own drop photos at once ("Remove" in the grid,
//   "Discard"), when the record does not use them. → { deleted }.
// - A drop photo the record no longer uses (a moderator removed it, a student was erased) is deleted.
// - Unsent photos are deleted after DROP_KEEP_DAYS (7): a look shortly after start and every PHOTO_DROP_TICK_MS (1 hour).
// - A photo an edit (api.editPhotoDrop) leaves given to nobody is kept until Undo can no longer bring it back (the undo
//   window), then deleted by the same look.
// - Undo of a sent batch (or of an edit) is refused once a student has kept photos from it since: their moment stays,
//   and so does every file it uses (prune never deletes a file the record still uses).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, send, readJson } from '../lib.mjs';
import { api, onChange } from '../store.mjs';
import { MODE } from '../auth.mjs';
import { beat } from '../health.mjs';
import * as L from '../audit.mjs';
import { undoGuards, WINDOW_MS } from '../history.mjs';

const DIR = path.join(DATA_DIR, 'uploads');
const NAME = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;
const MS = Math.max(1000, Number(process.env.PHOTO_DROP_TICK_MS) || 60 * 60_000);
const metaOf = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, `${f}.json`), 'utf8')); } catch { return null; } };
const remove = (f) => { for (const x of [f, `${f}.json`]) { try { fs.unlinkSync(path.join(DIR, x)); } catch { /* already gone */ } } };
const dropFiles = () => new Set((api.getStore().photoDrops || []).flatMap((d) => d.photos.map((p) => /api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})$/.exec(p.url || '')?.[1]).filter(Boolean)));
// Deletes the given drop uploads that nothing in the record uses. ok(meta, name): which ones may go.
function prune(names, ok) {
  if (!names.length) return [];
  const all = api.snapshot(), out = [];
  for (const f of names) {
    const m = metaOf(f);
    if (!NAME.test(f) || m?.purpose !== 'photo-drop' || !ok(m, f) || all.includes(`api/files/${f}`)) continue;
    remove(f); out.push(f);
  }
  return out;
}
const uploads = () => { try { return fs.readdirSync(DIR).filter((f) => NAME.test(f)); } catch { return []; } };

// Files an edit took out of a batch keep `heldAt` in their .json (so a restart keeps them too) until Undo can no longer
// bring them back.
const hold = (f, at) => { const m = metaOf(f); if (m?.purpose === 'photo-drop') { try { fs.writeFileSync(path.join(DIR, `${f}.json`), JSON.stringify({ ...m, heldAt: at })); } catch { /* not kept */ } } };
const holding = (m, now) => !!m?.heldAt && m.heldAt > now - WINDOW_MS;

// Unsent drop photos older than DROP_KEEP_DAYS, and photos an edit took out once Undo cannot bring them back.
export function sweep(now = Date.now()) {
  try {
    const cut = now - api.DROP_KEEP_DAYS * 864e5;
    const gone = prune(uploads(), (m) => (Date.parse(m.at) < cut || !!m.heldAt) && !holding(m, now));
    beat('photo-drop', { every: MS });
    return gone;
  } catch (e) { console.error('Photo drop sweep:', e); beat('photo-drop', { every: MS, error: e }); return []; }
}

let before = dropFiles();
export function afterChange(info) {
  const now = dropFiles();
  const gone = [...before].filter((f) => !now.has(f));
  before = now;
  if (info.fn === 'editPhotoDrop') { for (const f of gone) hold(f, Date.now()); return []; }
  let out = prune(gone, (m) => !holding(m, Date.now()));
  // Sent: the draft's photos nobody was given.
  const draft = info.fn === 'dropPhotos' && !info.error ? info.args?.[2]?.draft : null;
  if (draft && /^[a-z0-9-]{6,40}$/.test(draft)) out = out.concat(prune(uploads(), (m) => m.draft === draft && (m.by || null) === (info.by || null)));
  return out;
}

// The batch a change sent or edited (dropPhotos: its recorded id, else its draft), for the undo guard.
const dropOf = (st) => {
  if (st.fn === 'editPhotoDrop') return st.args?.[0] || null;
  if (st.fn !== 'dropPhotos') return null;
  const id = (st.rec || []).find((x) => Array.isArray(x) && x[0] === 'i' && /^pd-/.test(x[1]))?.[1], draft = st.args?.[2]?.draft;
  return id || (draft && (api.getStore().photoDrops || []).find((d) => d.draft === draft && d.teacherId === st.args[1])?.id) || null;
};
export function keptSince(e) {
  for (const st of e.steps || []) {
    const id = dropOf(st);
    if (id && (api.getStore().spotted || []).some((x) => x.dropId === id && x.status === 'accepted' && (st.fn === 'dropPhotos' || Date.parse(x.decidedAt) >= e.at))) {
      return { status: 409, error: 'Students have already kept photos from this batch, so it cannot be undone. Use Edit to take a photo back from anyone who has not kept it.' };
    }
  }
  return null;
}

export default (app) => {
  onChange(afterChange);
  undoGuards.add(keptSince);
  app.post('/api/photo-drops/discard', async (req, res) => {
    if (MODE === 'pilot' && !req.user) return send(res, 401, { error: 'Please sign in.' });
    const { files } = await readJson(req);
    const names = [...new Set([].concat(files || []).map((x) => String(x).split('/').pop()))].slice(0, 100);
    const gone = prune(names, (m) => (m.by || null) === (req.user?.id || null));
    if (MODE === 'pilot' && gone.length) L.log(req, { action: 'photo-discard', target: {}, detail: { count: gone.length } });
    send(res, 200, { deleted: gone.length });
  });
  setTimeout(sweep, 3000).unref();
  setInterval(sweep, MS).unref();
};
