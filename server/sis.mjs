// Class list sync from the school information system (pilot). docs/roster-format.md "SIS sync", docs/pilot-server.md.
// Settings (environment only): SIS_URL, SIS_TOKEN (sent as "Authorization: Bearer"), SIS_SYNC_AT ("02:00" in TP_TZ,
// default Asia/Bangkok; "off" for no nightly check), SIS_MAP (a JSON field-mapping file, relative to DATA_DIR).
// A check fetches the feed (a transit-roster/1 file, or any JSON mapped with SIS_MAP), validates it and compares it with
// the record into a change report. Nothing is applied here: an admin applies or dismisses the report (routes/67-sis.mjs).
// DATA_DIR/sis-sync.json { status, gone, reports (newest first, last 10) }; DATA_DIR/sis-pending.json { id, roster } for
// the report waiting to be applied. The token is never written to either, logged or sent to the browser.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';
import { api } from './store.mjs';
import { newAccountsFor, leaversOf } from './routes/15-roster.mjs';
import * as L from './audit.mjs';

export const KEEP = 10, DROP = 0.1, LIST_MAX = 200, TIMEOUT_MS = Number(process.env.SIS_TIMEOUT_MS || 60_000);
const FILE = path.join(DATA_DIR, 'sis-sync.json'), PENDING = path.join(DATA_DIR, 'sis-pending.json');
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function config(env = process.env) {
  const at = String(env.SIS_SYNC_AT ?? '02:00').trim();
  const m = at.match(HHMM);
  return {
    url: String(env.SIS_URL || '').trim(), token: String(env.SIS_TOKEN || '').trim(),
    at: m ? `${m[1].padStart(2, '0')}:${m[2]}` : null, tz: env.TP_TZ || 'Asia/Bangkok',
    map: env.SIS_MAP ? path.resolve(DATA_DIR, env.SIS_MAP) : null,
  };
}
export const CFG = config();

// ── Saved state ──
const blank = () => ({ status: { lastChecked: null, lastOk: null, lastError: null, lastScheduledDay: null }, gone: [], reports: [] });
export function load() { try { return { ...blank(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { return blank(); } }
const save = (s) => writeAtomic(FILE, JSON.stringify(s));
const pending = () => { try { return JSON.parse(fs.readFileSync(PENDING, 'utf8')); } catch { return null; } };
const dropPending = () => { try { fs.unlinkSync(PENDING); } catch { /* none */ } };
export const pendingRoster = (id) => { const p = pending(); return p?.id === id ? p.roster : null; };

// ── Mapping a feed (SIS_MAP) ──
// { "format": "sis-map/1", "school": { field: spec }, "teachers" | "students" | "classes" | "enrolments": { "from": path,
// "fields": { field: spec } } }. A path is dotted ("contact.email"); "list[]" goes through each item of a list; "^." starts
// from the item one level up (in "from": "sections[].pupils[]", "^.code" is the section's). spec: a path, "=text" for a
// fixed value, or { path, map: { theirs: ours }, add: n, split: ";" }. A field that is not listed is read under its own name.
const FIELDS = {
  teachers: ['id', 'name', 'email', 'roles', 'department'],
  students: ['id', 'name', 'year', 'programme', 'homeroom', 'advisorId', 'joinedYear', 'email', 'house'],
  classes: ['id', 'name', 'subject', 'year', 'level', 'teacherIds', 'line'],
  enrolments: ['studentId', 'classId', 'from', 'to'],
};
const segs = (p) => String(p || '').split('.').filter(Boolean);
function walk(v, parts) {
  if (!parts.length) return v;
  const [h, ...rest] = parts;
  if (!h.endsWith('[]')) return v == null ? undefined : walk(v[h], rest);
  const list = h === '[]' ? v : v?.[h.slice(0, -2)];
  return Array.isArray(list) ? list.flatMap((x) => { const y = walk(x, rest); return y === undefined ? [] : [y]; }) : undefined;
}
function itemsAt(root, from) {
  const parts = segs(from);
  if (parts.length && !parts.at(-1).endsWith('[]')) parts[parts.length - 1] += '[]';
  let level = [{ v: root, up: [] }];
  for (const p of parts) {
    const k = p.endsWith('[]') ? p.slice(0, -2) : p;
    level = level.flatMap(({ v, up }) => {
      const x = k ? v?.[k] : v;
      if (!p.endsWith('[]')) return [{ v: x, up }];
      return Array.isArray(x) ? x.map((y) => ({ v: y, up: [...up, v] })) : [];
    });
  }
  return level;
}
function valueOf(item, up, spec) {
  const s = typeof spec === 'string' ? { path: spec } : spec || {};
  let p = String(s.path || '');
  if (p.startsWith('=')) return p.slice(1);
  let cur = item; const ups = [...up];
  while (p.startsWith('^.')) { cur = ups.pop(); p = p.slice(2); }
  let v = walk(cur, segs(p));
  if (s.split && typeof v === 'string') v = v.split(s.split).map((x) => x.trim());
  const one = (x) => {
    if (s.map && x != null && Object.hasOwn(s.map, String(x))) x = s.map[String(x)];
    if (s.add && x !== '' && x != null && !Number.isNaN(Number(x))) x = Number(x) + Number(s.add);
    return x;
  };
  return Array.isArray(v) ? v.flatMap((x) => one(x) ?? []).filter((x) => x !== '') : one(v);
}
export function mapFeed(feed, map) {
  if (!map || typeof map !== 'object') throw new Error('The mapping file is not a JSON object.');
  const out = { format: 'transit-roster/1' };
  const sm = map.school || {};
  out.school = Object.fromEntries(['name', 'academicYear', 'exportedAt', 'source'].map((k) => [k, sm[k] !== undefined ? valueOf(feed, [], sm[k]) : undefined]));
  for (const [part, fields] of Object.entries(FIELDS)) {
    const m = map[part];
    if (!m?.from) throw new Error(`The mapping file has no "from" for ${part}.`);
    out[part] = itemsAt(feed, m.from).filter(({ v }) => v && typeof v === 'object').map(({ v, up }) => Object.fromEntries(fields.map((f) => [f, valueOf(v, up, m.fields?.[f] ?? f)]).filter(([, x]) => x !== undefined)));
  }
  return out;
}

// ── Fetching ──
const fail = (message) => Object.assign(new Error(message), { sis: true });
export async function fetchFeed(cfg = CFG) {
  if (!/^https?:\/\//i.test(cfg.url)) throw fail('SIS_URL should start with http:// or https://.');
  let r;
  try {
    r = await fetch(cfg.url, { headers: { accept: 'application/json', ...(cfg.token ? { authorization: `Bearer ${cfg.token}` } : {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const code = e.cause?.code || e.name;
    throw fail(code === 'TimeoutError' ? `The SIS did not answer within ${Math.round(TIMEOUT_MS / 1000)} seconds.` : code === 'ENOTFOUND' ? 'Could not find the SIS (unknown host).' : code === 'ECONNREFUSED' ? 'Could not reach the SIS (connection refused).' : `Could not reach the SIS (${code || 'network error'}).`);
  }
  if (r.status === 401 || r.status === 403) throw fail(`The SIS refused the token (HTTP ${r.status}). Check SIS_TOKEN.`);
  if (!r.ok) throw fail(`The SIS answered HTTP ${r.status}.`);
  const text = await r.text();
  let feed; try { feed = JSON.parse(text.replace(/^﻿/, '')); } catch { throw fail('The SIS did not send JSON.'); }
  if (feed?.format === 'transit-roster/1') return { feed, mapped: false };
  if (!cfg.map) throw fail('The SIS sent JSON that is not a transit-roster/1 file, and no SIS_MAP is set.');
  let map; try { map = JSON.parse(fs.readFileSync(cfg.map, 'utf8')); } catch (e) { throw fail(`The mapping file (SIS_MAP) could not be read: ${e.code === 'ENOENT' ? 'not found' : 'not JSON'}.`); }
  try { return { feed: mapFeed(feed, map), mapped: true }; } catch (e) { throw fail(e.message); }
}

// ── The change report ──
const cap = (xs) => ({ n: xs.length, items: xs.slice(0, LIST_MAX) });
const diff = (pairs) => pairs.filter(([, a, b]) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)).map(([field, from, to]) => ({ field, from: from ?? null, to: to ?? null }));
export function buildReport(roster, warnings, gone = []) {
  const store = api.getStore();
  const byId = (xs) => new Map((xs || []).map((x) => [x.id, x]));
  const curS = byId(store.students), curT = byId(api.getTeachers()), curC = byId(store.classes);
  const newT = byId(roster.teachers), newS = byId(roster.students), newC = byId(roster.classes);
  const tName = (id) => newT.get(id)?.name || curT.get(id)?.name || id;
  const known = new Set(gone);
  const added = {}, changed = {}, leaving = {};
  const part = (k, cur, next, info, pairs) => {
    added[k] = cap(next.filter((x) => !cur.has(x.id)).map((x) => ({ id: x.id, name: x.name, info: info(x) })));
    changed[k] = cap(next.filter((x) => cur.has(x.id)).map((x) => ({ id: x.id, name: x.name, changes: diff(pairs(cur.get(x.id), x)) })).filter((x) => x.changes.length));
  };
  part('students', curS, roster.students, (s) => `Year ${s.year}, ${s.homeroom}`, (o, s) => [['name', o.name, s.name], ['year', o.grade + 1, s.year], ['homeroom', o.homeroom, s.homeroom], ['advisor', o.advisorId && tName(o.advisorId), tName(s.advisorId)], ['programme', o.programme, s.programme], ['email', o.email, s.email], ['house', o.house, s.house]]);
  part('teachers', curT, roster.teachers, (t) => t.roles.join(', '), (o, t) => [['name', o.name, t.name], ['email', o.email, t.email], ['roles', (o.roles || []).join(', '), t.roles.join(', ')], ['department', o.department, t.department]]);
  part('classes', curC, roster.classes, (c) => `Year ${c.year}, ${c.subject}`, (o, c) => [['name', o.name, c.name], ['subject', o.subject, c.subject], ['year', o.year, c.year], ['level', o.level, c.level], ['teachers', (o.teacherIds || []).map(tName).join(', '), c.teacherIds.map(tName).join(', ')]]);
  for (const [k, cur, next] of [['students', curS, newS], ['teachers', curT, newT], ['classes', curC, newC]]) {
    leaving[k] = cap([...cur.values()].filter((x) => !next.has(x.id) && !known.has(x.id)).map((x) => ({ id: x.id, name: x.name, info: k === 'students' ? `Year ${x.grade + 1}, ${x.homeroom || ''}` : '' })));
  }
  // Class places: joins (new pairs) and ends (open places of students in the feed that the feed no longer has).
  const pair = (e) => `${e.studentId}|${e.classId}`;
  const curE = new Map((store.enrolments || []).map((e) => [pair(e), e])), nextE = new Set(roster.enrolments.map(pair));
  const cName = (id) => newC.get(id)?.name || curC.get(id)?.name || id, sName = (id) => newS.get(id)?.name || curS.get(id)?.name || id;
  const place = (e) => ({ studentId: e.studentId, student: sName(e.studentId), classId: e.classId, class: cName(e.classId) });
  const joins = roster.enrolments.filter((e) => !curE.has(pair(e))).map(place);
  const ends = [...curE.values()].filter((e) => newS.has(e.studentId) && !e.to && !nextE.has(pair(e))).map(place);
  const summary = api.previewRoster(roster);
  const { todo } = newAccountsFor(roster);
  const base = [...curS.keys()].filter((id) => !known.has(id)).length;
  const drop = { students: leaving.students.n, of: base, pct: base ? Math.round((leaving.students.n / base) * 1000) / 10 : 0 };
  const w = [...warnings];
  if (base && leaving.students.n > base * DROP) w.unshift(`${drop.students} of ${base} students (${drop.pct}%) are no longer in the feed. That is more than 10%, so this report cannot be applied. Check the SIS export; if it is right, import the file from Accounts › Import class lists.`);
  const some = (o) => Object.values(o).some((x) => x.n);
  const any = some(added) || some(changed) || some(leaving) || joins.length || ends.length || summary.updated.enrolments;
  return {
    status: base && leaving.students.n > base * DROP ? 'refused' : any ? 'ready' : 'nothing',
    school: roster.school, counts: Object.fromEntries(Object.keys(FIELDS).map((k) => [k, roster[k].length])),
    added, changed, leaving, enrolments: { joins: cap(joins), ends: cap(ends), updated: summary.updated.enrolments },
    handover: api.handoverPreview(roster), accounts: { toCreate: todo.length, leavers: leaversOf(summary).length },
    drop, warnings: w.slice(0, 50), errors: [], base: store.rosterImport?.at || null,
  };
}

// ── One check: fetch, validate, report. by: the admin ({ id, name }) or null for the nightly check. ──
let running = null;
export const isChecking = () => !!running;
export function check(req = null, cfg = CFG) {
  return (running ||= run(req, cfg).finally(() => { running = null; }));
}
async function run(req, cfg) {
  const s = load(), at = new Date().toISOString(), by = req?.user ? { id: req.user.id, name: req.user.name } : null;
  s.status.lastChecked = at;
  const how = by ? 'admin' : 'schedule';
  let got;
  try { got = await fetchFeed(cfg); } catch (e) {
    const message = e.sis ? e.message : 'The check failed on the server.';
    if (!e.sis) console.error('SIS check:', e);
    s.status.lastError = { at, message };
    save(s);
    L.log(req, { action: 'sis-fetch', actor: by ? undefined : null, detail: { how, error: message }, status: 502 });
    return { error: message };
  }
  const p = api.parseRoster(got.feed);
  let report;
  if (p.errors.length) report = { status: 'invalid', school: got.feed?.school || null, errors: p.errors.slice(0, 50), errorCount: p.errors.length, missing: p.missing, warnings: p.warnings.slice(0, 50) };
  else report = buildReport(p.roster, p.warnings, s.gone);
  report = { id: `sis-${Date.parse(at).toString(36)}`, at, by, mapped: got.mapped, ...report };
  for (const r of s.reports) if (r.status === 'ready') r.status = 'replaced';
  dropPending();
  if (report.status === 'ready') writeAtomic(PENDING, JSON.stringify({ id: report.id, roster: p.roster }));
  s.reports = [report, ...s.reports].slice(0, KEEP);
  s.status.lastOk = at;
  save(s);
  const n = (o) => (o ? Object.values(o).reduce((t, x) => t + x.n, 0) : 0);
  L.log(req, { action: 'sis-fetch', actor: by ? undefined : null, target: { id: report.id }, detail: { how, report: report.status, ...(report.counts || {}), added: n(report.added), changed: n(report.changed), leaving: n(report.leaving), errors: report.errorCount || 0 } });
  return { report };
}

// After an admin applies or dismisses the report. Applied: the records the feed no longer had are noted as gone, so later
// reports do not list them again (nobody is removed from the record).
export function settle(id, how, by, extra = {}, summary = null) {
  const s = load();
  const r = s.reports.find((x) => x.id === id);
  if (r) Object.assign(r, { status: how, [how]: { at: new Date().toISOString(), by, ...extra } });
  if (summary) s.gone = [...new Set([...s.gone, ...Object.values(summary.missingFromFile).flat().map((x) => x.id)])];
  save(s); dropPending();
  return r;
}

// ── Nightly: the day to run for, when it is at or after SIS_SYNC_AT (within 3 hours) in TP_TZ and not yet run today ──
export function localNow(now, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) };
}
export function dueDay(now, at, tz, lastDay) {
  if (!at) return null;
  const { day, mins } = localNow(now, tz);
  const [h, m] = at.split(':').map(Number), t = h * 60 + m;
  return mins >= t && mins < t + 180 && lastDay !== day ? day : null;
}
export function tick(now = Date.now(), cfg = CFG) {
  if (!cfg.url || running) return null;
  const s = load(), day = dueDay(now, cfg.at, cfg.tz, s.status.lastScheduledDay);
  if (!day) return null;
  s.status.lastScheduledDay = day; save(s);
  return check(null, cfg);
}
