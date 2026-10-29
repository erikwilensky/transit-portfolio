// Safeguarding: reports and the moderators' answers are api.js changes (api.reportItem, api.moderateReport), so they
// go through /api/action, canAct and Undo like any other. This module does the one thing the record cannot: when a
// moderator removes a photo ("Remove photo"), the uploaded file itself is deleted from DATA_DIR/uploads (with the .json
// beside it), unless the record still uses it somewhere else. Undo of that change leaves the moment without its photo.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib.mjs';
import { api, onChange } from '../store.mjs';

const UPLOADS = path.join(DATA_DIR, 'uploads');
const NAME = /api\/files\/([a-f0-9]{32}\.[a-z0-9]{2,5})/;
// The uploaded files the stations' evidence points at (cheap: no copy of the record).
const stationFiles = () => {
  const out = new Set();
  for (const e of api.getStore().events) for (const x of e.evidence || []) { const m = NAME.exec(x?.url || ''); if (m) out.add(m[1]); }
  return out;
};
let before = stationFiles();

export function removedPhotos(info) {
  const now = stationFiles();
  const gone = info.fn === 'moderateReport' && !info.error && info.args?.[1] === 'photo' ? [...before].filter((f) => !now.has(f)) : [];
  before = now;
  if (!gone.length) return [];
  const all = api.snapshot();
  const removed = gone.filter((f) => !all.includes(`api/files/${f}`));
  for (const f of removed) for (const x of [f, `${f}.json`]) { try { fs.unlinkSync(path.join(UPLOADS, x)); } catch { /* already gone */ } }
  return removed;
}

export default () => { onChange(removedPhotos); };
