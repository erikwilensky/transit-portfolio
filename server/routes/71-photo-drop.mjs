// Class photo drop (api.dropPhotos, src/components/PhotoDrop.jsx): what the record cannot do itself, deleting files.
// Photos are uploaded with `x-purpose: photo-drop:<draft>` (server/routes/30-uploads.mjs keeps it in the .json beside each).
// - Sending a batch deletes every photo of that draft by that teacher that no student was given.
// - POST /api/photo-drops/discard { files: [name] } deletes the sender's own drop photos at once ("Remove" in the grid,
//   "Discard"), when the record does not use them. → { deleted }.
// - A drop photo the record no longer uses (a moderator removed it, a student was erased) is deleted.
// - Unsent photos are deleted after DROP_KEEP_DAYS (7): a look shortly after start and every PHOTO_DROP_TICK_MS (1 hour).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, send, readJson } from '../lib.mjs';
import { api, onChange } from '../store.mjs';
import { MODE } from '../auth.mjs';
import { beat } from '../health.mjs';
import * as L from '../audit.mjs';

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

// Unsent drop photos older than DROP_KEEP_DAYS.
export function sweep(now = Date.now()) {
  try {
    const cut = now - api.DROP_KEEP_DAYS * 864e5;
    const gone = prune(uploads(), (m) => Date.parse(m.at) < cut);
    beat('photo-drop', { every: MS });
    return gone;
  } catch (e) { console.error('Photo drop sweep:', e); beat('photo-drop', { every: MS, error: e }); return []; }
}

let before = dropFiles();
export function afterChange(info) {
  const now = dropFiles();
  const gone = [...before].filter((f) => !now.has(f));
  before = now;
  let out = prune(gone, () => true);
  // Sent: the draft's photos nobody was given.
  const draft = info.fn === 'dropPhotos' && !info.error ? info.args?.[2]?.draft : null;
  if (draft && /^[a-z0-9-]{6,40}$/.test(draft)) out = out.concat(prune(uploads(), (m) => m.draft === draft && (m.by || null) === (info.by || null)));
  return out;
}

export default (app) => {
  onChange(afterChange);
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
