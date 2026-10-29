// Activity log (pilot): who did what, for accountability. Append-only, outside the replayed record, so no mutator and
// no Undo can change it. One JSON line per event in DATA_DIR/audit-YYYY-MM.jsonl (a new file each month, UTC):
//   { at, actor: { id, name, kind } | null, action, fn?, target: { studentId?, studentIds?, teacherId?, accountId?, reportId?, id?, label? },
//     detail?, result: 'ok' | 'refused', status, ip }
// Never passwords, tokens, links, note, comment or reflection text: only ids, a short name label, counts and codes.
// Kept 400 days (older lines are pruned when the server starts). Erasing a student replaces their name label with
// "Erased student" and keeps the ids (redactStudent). Read with GET /api/audit (server/routes/66-audit.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, clientIp, onShutdown } from './lib.mjs';
import { api } from './store.mjs';
import { MODE } from './auth.mjs';

export const KEEP_DAYS = 400;
const FILE_RE = /^audit-(\d{4})-(\d{2})\.jsonl$/;
const fileOf = (iso) => path.join(DATA_DIR, `audit-${iso.slice(0, 7)}.jsonl`);
export const logFiles = () => fs.readdirSync(DATA_DIR).filter((f) => FILE_RE.test(f)).sort().map((f) => path.join(DATA_DIR, f));
const on = () => MODE === 'pilot';

export const actorOf = (a) => (a ? { id: a.id, name: a.name, kind: a.kind } : null);
export const studentLabel = (sid) => api.getStudent(sid)?.name || null;
// The main student of a change, as a target: one student by name, several by count.
export function studentsTarget(ids = []) {
  const u = [...new Set(ids.filter((x) => typeof x === 'string'))];
  if (!u.length) return {};
  if (u.length === 1) return { studentId: u[0], label: studentLabel(u[0]) };
  return { studentIds: u.slice(0, 50), label: `${u.length} students` };
}

function write(entry) {
  try { fs.appendFileSync(fileOf(entry.at), JSON.stringify(entry) + '\n'); } catch (e) { console.error('Activity log not written:', e.message); }
}
// log(req, { action, fn?, target?, detail?, status? = 200, actor? }). result follows the status: 2xx ok, else refused.
export function log(req, { action, fn, target, detail, status = 200, actor }) {
  if (!on()) return;
  const entry = { at: new Date().toISOString(), actor: actor !== undefined ? actor : actorOf(req?.user), action };
  if (fn) entry.fn = fn;
  entry.target = Object.fromEntries(Object.entries(target || {}).filter(([, v]) => v != null && v !== ''));
  if (detail && Object.keys(detail).length) entry.detail = detail;
  entry.result = status >= 200 && status < 300 ? 'ok' : 'refused';
  entry.status = status;
  entry.ip = req ? clientIp(req) : null;
  write(entry);
}

// ── Refused file downloads (404 by protection): one line per actor per hour, with the count ──
const pending = new Map(); // `${actor}|${hour}` → entry
const hourOf = (iso) => iso.slice(0, 13);
function flush(all = false) {
  const now = hourOf(new Date().toISOString());
  for (const [k, e] of pending) if (all || e.detail.hour < now) { write(e); pending.delete(k); }
}
export function fileRefused(req, name) {
  if (!on()) return;
  flush();
  const at = new Date().toISOString(), ip = clientIp(req), hour = hourOf(at);
  const k = `${req.user?.id || `ip:${ip}`}|${hour}`;
  const e = pending.get(k) || pending.set(k, { at, actor: actorOf(req.user), action: 'file-refused', target: {}, detail: { hour, count: 0, files: [] }, result: 'refused', status: 404, ip }).get(k);
  e.detail.count++; e.detail.last = at;
  if (e.detail.files.length < 20 && !e.detail.files.includes(name)) e.detail.files.push(name);
}
export const pendingEntries = () => [...pending.values()].map((e) => ({ ...e, detail: { ...e.detail, files: [...e.detail.files] } }));
setInterval(() => flush(), 60_000).unref();
onShutdown(() => flush(true));

// ── Reading ──
const readLines = (f) => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
// Every entry in the months from..to (YYYY-MM-DD, inclusive), oldest first, with the hour's refusals not written yet.
export function entriesBetween(from, to) {
  const lo = from ? from.slice(0, 7) : '0000-00', hi = to ? to.slice(0, 7) : '9999-99';
  const out = [];
  for (const f of logFiles()) { const [, y, m] = path.basename(f).match(FILE_RE); const mon = `${y}-${m}`; if (mon >= lo && mon <= hi) out.push(...readLines(f)); }
  out.push(...pendingEntries());
  return out;
}

// ── Keeping 400 days: whole months older than that go, and the oldest month left keeps only its newer lines ──
export function prune(now = Date.now()) {
  const cut = new Date(now - KEEP_DAYS * 864e5).toISOString();
  let removed = 0;
  for (const f of logFiles()) {
    const [, y, m] = path.basename(f).match(FILE_RE);
    if (`${y}-${m}` > cut.slice(0, 7)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
    const keep = lines.filter((l) => { try { return JSON.parse(l).at >= cut; } catch { return false; } });
    removed += lines.length - keep.length;
    if (!keep.length) fs.unlinkSync(f); else if (keep.length < lines.length) fs.writeFileSync(f, keep.join('\n') + '\n');
  }
  return removed;
}
try { const n = prune(); if (n) console.log(`Activity log: removed ${n} entries older than ${KEEP_DAYS} days.`); } catch (e) { console.error('Activity log not pruned:', e.message); }

// ── Erasure: the student's name label goes, the ids stay. accountIds: their removed accounts (actor names too). ──
export const ERASED = 'Erased student';
export function redactStudent(sid, accountIds = []) {
  flush(true);
  const gone = new Set(accountIds);
  for (const f of logFiles()) {
    let hit = false;
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => {
      let e; try { e = JSON.parse(l); } catch { return l; }
      const t = e.target || {};
      if (t.studentId === sid || (t.accountId && gone.has(t.accountId))) { t.label = ERASED; hit = true; }
      if (t.studentIds?.includes(sid) && t.label && !/^\d+ students$/.test(t.label)) { t.label = ERASED; hit = true; }
      if (e.actor && gone.has(e.actor.id)) { e.actor.name = ERASED; hit = true; }
      return JSON.stringify(e);
    });
    if (hit) fs.writeFileSync(f, lines.join('\n') + '\n');
  }
}
