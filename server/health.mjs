// System health (routes/69-health.mjs): the version, background job heartbeats and the last 50 server errors.
// In memory only. An error keeps its time, the route pattern (never the path with ids) and a short message with anything
// like an email address or a token taken out: never request bodies, query strings or cookies.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

export const STARTED = Date.now();

// GIT_COMMIT (baked into the Docker image by scripts/deploy-mac.sh), else git in a checkout, else the package version.
const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || null; } catch { return null; } })();
const commit = (() => {
  const c = String(process.env.GIT_COMMIT || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(c)) return c.slice(0, 12);
  try { return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: ROOT, timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch { return null; }
})();
export const VERSION = { commit, package: pkg, label: commit || (pkg ? `v${pkg}` : 'unknown') };

const MAX = 50;
const errors = [];
export const clean = (m) => String(m ?? '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]').replace(/\b[A-Za-z0-9_\-]{24,}\b/g, '[token]').replace(/\s+/g, ' ').slice(0, 200);
export function noteError(where, e) {
  errors.unshift({ at: new Date().toISOString(), route: String(where || 'unknown').slice(0, 80), message: clean(e?.message || e) || 'Error' });
  errors.length = Math.min(errors.length, MAX);
}
export const recentErrors = () => errors.map((e) => ({ ...e }));

// beat(name, { every }) after a background job ran; beat(name, { error }) when it failed.
const jobs = new Map();
export function beat(name, { every, error } = {}) {
  const j = jobs.get(name) || { name, lastRun: null, lastOk: null, lastError: null, every: null, runs: 0 };
  const at = new Date().toISOString();
  j.lastRun = at; j.runs++;
  if (every) j.every = every;
  if (error) { j.lastError = { at, message: clean(error.message || error) }; noteError(`job ${name}`, error); } else j.lastOk = at;
  jobs.set(name, j);
}
export const heartbeats = () => [...jobs.values()].map((j) => ({ ...j }));
