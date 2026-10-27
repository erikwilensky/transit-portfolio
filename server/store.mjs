// The live record on the server. src/api.js is bundled for Node (npm run build:server)
// so the server runs exactly the same functions as the browser, on one shared store.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';

export const api = await import('./build/api.js');
const FILE = path.join(DATA_DIR, 'state.json');
export let rev = 0;
if (fs.existsSync(FILE)) {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  api.restore(JSON.stringify(saved));
  rev = saved.rev || 0;
}
const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
// Call after any change to the store: bumps the revision, saves to disk, tells listeners.
export function changed(info = {}) {
  rev += 1;
  writeAtomic(FILE, JSON.stringify({ ...JSON.parse(api.snapshot()), rev }));
  for (const fn of listeners) fn({ rev, ...info });
  return rev;
}
