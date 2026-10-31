// System health (server/health.mjs, src/screens/SystemHealth.jsx): pilot only, admins only.
//   GET /api/admin/health                    → { at, overall, version, sections: [{ id, title, status, summary, todo, facts }] }
//   GET /api/admin/health?format=diagnostics → the same as a JSON download for support, without paths, names, emails,
//                                              ids or addresses (facts marked private are left out).
// status: 'ok' | 'check' | 'problem'. facts: [{ label, value, type?: 'bytes' | 'time' | 'count', private? }].
// The newest backup is looked for in BACKUP_DIR (as scripts/backup.sh: relative to the repo, default
// ../transit-portfolio-backups; in Docker, docker-compose.yml mounts it read-only at /backups).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, send } from '../lib.mjs';
import { rev } from '../store.mjs';
import * as A from '../auth.mjs';
import * as L from '../audit.mjs';
import * as S from '../sis.mjs';
import * as H from '../health.mjs';
import { requireAdmin } from './10-auth.mjs';

const bad = (status, message) => Object.assign(new Error(message), { status });
const START_REV = rev;
export const BACKUP_DIR = path.resolve(ROOT, process.env.BACKUP_DIR || '../transit-portfolio-backups');
export const BACKUP_MAX_H = 26;
const BACKUP_RE = /^(.+)-(\d{8})-(\d{6})\.tar\.gz$/;
const GB = 1024 ** 3, HOUR = 3600_000;
const JOBS = [['class-tasks', 'Class task reminders']];
const RANK = { ok: 0, check: 1, problem: 2 };

const n_ = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ago = (ms) => { const h = ms / HOUR; return h < 1 ? n_(Math.max(1, Math.round(ms / 60_000)), 'minute') : h < 48 ? n_(Math.round(h), 'hour') : n_(Math.round(h / 24), 'day'); };
const bytes = (n) => (n >= GB ? `${(n / GB).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
function folder(dir, skip = () => false) {
  let size = 0, files = 0;
  const walk = (d) => {
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.isFile() && !skip(e.name)) { try { size += fs.statSync(f).size; files++; } catch { /* gone */ } }
    }
  };
  walk(dir);
  return { size, files };
}
const sec = (id, title, status, summary, todo, facts) => ({ id, title, status, summary, todo: todo || null, facts });

function serverSection(now) {
  return sec('server', 'Server', 'ok', `Version ${H.VERSION.label}, running for ${ago(now - H.STARTED)}.`, null, [
    { label: 'Version', value: H.VERSION.commit ? `commit ${H.VERSION.commit}` : H.VERSION.package ? `package ${H.VERSION.package}` : 'unknown' },
    { label: 'Started', value: new Date(H.STARTED).toISOString(), type: 'time' },
    { label: 'Node', value: process.version },
  ]);
}

function storageSection() {
  const used = folder(DATA_DIR);
  let free = null, total = null;
  try { const s = fs.statfsSync(DATA_DIR); free = s.bavail * s.bsize; total = s.blocks * s.bsize; } catch { /* not available here */ }
  const facts = [{ label: 'Data folder', value: used.size, type: 'bytes' }, { label: 'Data folder path', value: DATA_DIR, private: true }];
  if (free == null) return sec('storage', 'Disk space', 'check', `The data folder uses ${bytes(used.size)}. This server cannot tell how much disk space is free.`, 'Check the free space on the Mac yourself (Apple menu › About This Mac › Storage).', facts);
  facts.push({ label: 'Free disk space', value: free, type: 'bytes' }, { label: 'Disk size', value: total, type: 'bytes' });
  const pct = total ? free / total : 1;
  const status = free < GB || pct < 0.05 ? 'problem' : free < 5 * GB || pct < 0.1 ? 'check' : 'ok';
  const summary = `The data folder uses ${bytes(used.size)}. ${bytes(free)} of the disk is free (${Math.round(pct * 100)}%).`;
  return sec('storage', 'Disk space', status, summary, status === 'ok' ? null : status === 'problem' ? 'The disk is nearly full and saving may soon fail. Free some space on the Mac now, or move the backups to another disk.' : 'Disk space is getting low. Free some space on the Mac soon.', facts);
}

function recordSection() {
  const st = fs.statSync(path.join(DATA_DIR, 'state.json'), { throwIfNoEntry: false });
  const n = rev - START_REV;
  const facts = [{ label: 'state.json', value: st?.size || 0, type: 'bytes' }, { label: 'Changes since start', value: n, type: 'count' }, { label: 'Revision', value: rev, type: 'count' }];
  if (!st) return sec('record', 'The record', 'check', 'There is no saved record (state.json) yet.', 'This is normal before the first change. If people have been using the pilot, check the data folder setting (DATA_DIR).', facts);
  const big = st.size > 100 * 1024 ** 2;
  return sec('record', 'The record', big ? 'check' : 'ok', `The record is ${bytes(st.size)}, with ${n.toLocaleString('en-GB')} ${n === 1 ? 'change' : 'changes'} saved since the server started.`, big ? 'The record is large, so saving and loading get slower. Tell support.' : null, facts);
}

function uploadsSection() {
  const u = folder(path.join(DATA_DIR, 'uploads'), (f) => f.endsWith('.json'));
  return sec('uploads', 'Uploaded files', 'ok', `${u.files.toLocaleString('en-GB')} ${u.files === 1 ? 'file' : 'files'}, ${bytes(u.size)} in all.`, null, [{ label: 'Files', value: u.files, type: 'count' }, { label: 'Total size', value: u.size, type: 'bytes' }]);
}

export function backupSection(now = Date.now(), dir = BACKUP_DIR) {
  const facts = [{ label: 'Backups folder', value: dir, private: true }];
  let names;
  try { names = fs.readdirSync(dir); } catch {
    return sec('backup', 'Backups', 'problem', 'The server cannot see the backups folder, so it cannot tell whether the nightly backup ran.', 'Check that BACKUP_DIR points at the folder scripts/backup.sh writes to (in Docker it is mounted at /backups), and that the nightly backup is installed (docs/pilot-server.md, Backups).', facts);
  }
  const all = names.filter((f) => BACKUP_RE.test(f)).map((f) => { const s = fs.statSync(path.join(dir, f), { throwIfNoEntry: false }); return s && { name: f, folder: f.match(BACKUP_RE)[1], at: s.mtimeMs, size: s.size }; }).filter(Boolean).sort((a, b) => b.at - a.at);
  facts.push({ label: 'Backups kept', value: all.length, type: 'count' });
  if (!all.length) return sec('backup', 'Backups', 'problem', 'There are no backups in the backups folder.', 'Install the nightly backup (docs/pilot-server.md, Backups), then run it once now to test it.', facts);
  const n = all[0], age = now - n.at;
  facts.unshift({ label: 'Newest backup', value: new Date(n.at).toISOString(), type: 'time' }, { label: 'Its size', value: n.size, type: 'bytes' });
  let logFailed = false;
  try {
    const log = fs.readFileSync(path.join(dir, 'backup.log'), 'utf8').trimEnd().split('\n').slice(-6);
    logFailed = log.some((l) => /failed|Skipped/.test(l)) && !/backed up/.test(log.at(-1));
  } catch { /* no log */ }
  if (age > BACKUP_MAX_H * HOUR) {
    return sec('backup', 'Backups', age > 72 * HOUR ? 'problem' : 'check', `The newest backup is ${ago(age)} old.`, 'Check the Mac is awake at 02:30, and look at backup.log in the backups folder for an error.', facts);
  }
  if (logFailed) return sec('backup', 'Backups', 'check', `The newest backup is ${ago(age)} old, but the backup log ends with an error.`, 'Look at backup.log in the backups folder.', facts);
  if (n.size < 1024) return sec('backup', 'Backups', 'check', `The newest backup is ${ago(age)} old but very small (${bytes(n.size)}).`, 'Check the backup holds the data folder: tar -tzf on the newest file should list state.json.', facts);
  return sec('backup', 'Backups', 'ok', `The newest backup is ${ago(age)} old (${bytes(n.size)}).`, null, facts);
}

function sisSection(now) {
  const { status: s } = S.load(), c = S.CFG;
  const facts = [{ label: 'Last check', value: s.lastChecked, type: 'time' }, { label: 'Last good check', value: s.lastOk, type: 'time' }];
  if (!c.url) return sec('sis', 'Class list sync', 'ok', 'Class list sync is not set up, so class lists come from file imports (Accounts › Import class lists).', null, facts);
  if (s.lastError) facts.push({ label: 'Last error', value: s.lastError.message }, { label: 'Error at', value: s.lastError.at, type: 'time' });
  if (s.lastError && (!s.lastOk || s.lastError.at > s.lastOk)) return sec('sis', 'Class list sync', 'problem', `The last class list check failed: ${s.lastError.message}`, 'Open Accounts › Class list sync and press Check now. If it still fails, check SIS_URL and SIS_TOKEN.', facts);
  if (!s.lastOk) return sec('sis', 'Class list sync', now - H.STARTED > 26 * HOUR ? 'check' : 'ok', 'Class list sync is set up but has not checked yet.', c.at ? `It checks every night at ${c.at}. To check now, open Accounts › Class list sync.` : 'The nightly check is off (SIS_SYNC_AT=off). Check from Accounts › Class list sync.', facts);
  const age = now - Date.parse(s.lastOk);
  if (c.at && age > 26 * HOUR) return sec('sis', 'Class list sync', 'check', `The last good class list check was ${ago(age)} ago, but it should run every night at ${c.at}.`, 'Check the server was running overnight, then press Check now in Accounts › Class list sync.', facts);
  return sec('sis', 'Class list sync', 'ok', `The last class list check was ${ago(age)} ago and worked.`, null, facts);
}

function jobsSection(now) {
  const beats = new Map(H.heartbeats().map((j) => [j.name, j]));
  const facts = [], worst = [];
  for (const [id, label] of JOBS) {
    const j = beats.get(id);
    facts.push({ label: `${label}: last run`, value: j?.lastRun || null, type: 'time' });
    if (j?.lastError) facts.push({ label: `${label}: last error`, value: j.lastError.message });
    if (!j) { if (now - H.STARTED > 15 * 60_000) worst.push(['check', `${label} have not run since the server started.`]); continue; }
    if (j.lastError && (!j.lastOk || j.lastError.at >= j.lastOk)) worst.push(['problem', `${label} failed the last time they ran: ${j.lastError.message}`]);
    else if (j.every && now - Date.parse(j.lastRun) > 3 * j.every + 60_000) worst.push(['check', `${label} last ran ${ago(now - Date.parse(j.lastRun))} ago, later than expected.`]);
  }
  if (!worst.length) return sec('jobs', 'Reminders', 'ok', 'Class task reminders are running.', null, facts);
  worst.sort((a, b) => RANK[b[0]] - RANK[a[0]]);
  return sec('jobs', 'Reminders', worst[0][0], worst.map((w) => w[1]).join(' '), 'Restart the server (scripts/deploy-mac.sh). If it happens again, download the diagnostics and send them to support.', facts);
}

function errorsSection(now) {
  const list = H.recentErrors();
  const day = list.filter((e) => now - Date.parse(e.at) < 24 * HOUR), hour = day.filter((e) => now - Date.parse(e.at) < HOUR);
  const facts = [{ label: 'Errors in the last 24 hours', value: day.length, type: 'count' }, { label: 'Errors in the last hour', value: hour.length, type: 'count' }];
  if (!day.length) return { ...sec('errors', 'Server errors', 'ok', 'No server errors in the last 24 hours.', null, facts), errors: list };
  const status = hour.length >= 10 ? 'problem' : 'check';
  return { ...sec('errors', 'Server errors', status, `${day.length} server ${day.length === 1 ? 'error' : 'errors'} in the last 24 hours${hour.length ? `, ${hour.length} in the last hour` : ''}. People may have seen “Something went wrong”.`, 'Download the diagnostics below and send them to support. They hold the errors without anyone’s data.', facts), errors: list };
}

function signinSection(now) {
  const since = new Date(now - 24 * HOUR).toISOString();
  const rows = L.entriesBetween(since.slice(0, 10), null).filter((e) => e.at >= since);
  const failed = rows.filter((e) => e.action === 'sign-in-failed').length;
  const locked = rows.filter((e) => e.action === 'sign-in-locked');
  const lockedPeople = new Set(locked.map((e) => e.actor?.id || 'unknown')).size;
  const ok = rows.filter((e) => e.action === 'sign-in' && e.result === 'ok').length;
  const facts = [{ label: 'Sign-ins', value: ok, type: 'count' }, { label: 'Wrong passwords', value: failed, type: 'count' }, { label: 'Blocked (too many tries)', value: locked.length, type: 'count' }, { label: 'Accounts blocked', value: lockedPeople, type: 'count' }];
  const status = failed >= 200 || lockedPeople >= 10 ? 'problem' : failed >= 30 || locked.length ? 'check' : 'ok';
  const summary = `In the last 24 hours: ${ok} ${ok === 1 ? 'sign-in' : 'sign-ins'}, ${failed} wrong ${failed === 1 ? 'password' : 'passwords'}${locked.length ? `, and ${lockedPeople} ${lockedPeople === 1 ? 'account' : 'accounts'} blocked for 15 minutes after too many tries` : ''}.`;
  return sec('signin', 'Sign-in', status, summary, status === 'ok' ? null : status === 'problem' ? 'That is a lot of failed sign-ins: someone may be guessing passwords. Look at the Activity log (What: Sign-in failed) for where they come from.' : 'Someone may have forgotten a password. The Activity log shows who; give them a new sign-in link from Accounts.', facts);
}

function sessionsSection() {
  const s = A.liveSessions();
  return sec('sessions', 'Signed in', 'ok', `${s.sessions} active ${s.sessions === 1 ? 'session' : 'sessions'} for ${s.people} ${s.people === 1 ? 'person' : 'people'} (a session lasts 30 days, or until they sign out).`, null, [{ label: 'Active sessions', value: s.sessions, type: 'count' }, { label: 'People', value: s.people, type: 'count' }]);
}

export function report(now = Date.now()) {
  const sections = [serverSection(now), storageSection(), recordSection(), uploadsSection(), backupSection(now), sisSection(now), jobsSection(now), errorsSection(now), signinSection(now), sessionsSection()];
  const overall = sections.reduce((w, s) => (RANK[s.status] > RANK[w] ? s.status : w), 'ok');
  return { at: new Date(now).toISOString(), mode: A.MODE, overall, version: H.VERSION, uptimeS: Math.round((now - H.STARTED) / 1000), sections };
}
// For support: no private facts (paths), and nothing else that could name a person.
export const diagnostics = (r) => ({ kind: 'transit-diagnostics/1', ...r, node: process.version, platform: process.platform, sections: r.sections.map((s) => ({ ...s, facts: s.facts.filter((f) => !f.private) })) });

export default (app) => {
  app.get('/api/admin/health', (req, res) => {
    if (A.MODE !== 'pilot') throw bad(403, 'System health is for the pilot only.');
    requireAdmin(req);
    const r = report();
    if (req.query.get('format') !== 'diagnostics') return send(res, 200, r);
    L.log(req, { action: 'health-diagnostics', detail: { overall: r.overall } });
    send(res, 200, JSON.stringify(diagnostics(r), null, 2), { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="transit-diagnostics-${r.at.slice(0, 10)}.json"` });
  });
};
