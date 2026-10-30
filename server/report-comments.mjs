// Report comment drafts (pilot): what a teacher or advisor writes towards a student's end-of-term report comment,
// before they paste it into the school's report system. Private to the writer: kept outside the shared record (so no
// snapshot, Undo, See as or other account ever carries it), in DATA_DIR/report-comments.json:
//   { limits: { subject: { words, chars }, advisor: { words, chars } },
//     drafts: [{ id, by (account id), teacherId, kind: 'subject' | 'advisor', group (classId | advisor's teacherId), studentId,
//                text, done, updatedAt, doneAt }] }
// Routes: server/routes/71-report-comments.mjs. The PDPA copy made by an admin and erasure (50-pdpa.mjs) use draftsAbout / eraseDraftsAbout.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';

const FILE = path.join(DATA_DIR, 'report-comments.json');
export const KINDS = ['subject', 'advisor'];
export const DEFAULT_LIMITS = { subject: { words: 150, chars: 1000 }, advisor: { words: 200, chars: 1300 } };
export const MAX_TEXT = 4000;
const load = () => { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { limits: v.limits || {}, drafts: Array.isArray(v.drafts) ? v.drafts : [] }; } catch { return { limits: {}, drafts: [] }; } };
let data = load();
const save = () => writeAtomic(FILE, JSON.stringify(data));

export const limits = () => Object.fromEntries(KINDS.map((k) => [k, { ...DEFAULT_LIMITS[k], ...(data.limits[k] || {}) }]));
const num = (v) => (v === null || v === '' || v === undefined ? 0 : Math.max(0, Math.min(5000, Math.round(Number(v)) || 0)));
export function setLimits(kind, { words, chars }) {
  data.limits[kind] = { words: num(words), chars: num(chars) }; save();
  return limits();
}
export const draftsBy = (accountId) => data.drafts.filter((d) => d.by === accountId);
const find = (by, kind, group, studentId) => data.drafts.find((d) => d.by === by && d.kind === kind && d.group === group && d.studentId === studentId);
// Writes (or, with no text and not done, removes) the writer's one draft for that student in that group.
export function putDraft({ by, teacherId, kind, group, studentId }, { text, done }) {
  const t = String(text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, MAX_TEXT);
  let d = find(by, kind, group, studentId);
  const at = new Date().toISOString();
  if (!t.trim() && !done) { if (d) { data.drafts = data.drafts.filter((x) => x !== d); save(); } return null; }
  if (!d) data.drafts.push(d = { id: `rc-${crypto.randomBytes(6).toString('hex')}`, by, teacherId, kind, group, studentId, text: '', done: false });
  const wasDone = d.done;
  Object.assign(d, { teacherId, text: t, done: !!done, updatedAt: at, doneAt: done ? (wasDone ? d.doneAt : at) : null });
  save();
  return d;
}
// Counts only, for the coordinators' progress panel: teacherId → `${kind}|${group}` → { drafted: Set, done: Set } of studentIds.
export function counts() {
  const out = new Map();
  for (const d of data.drafts) {
    const m = out.get(d.teacherId) || out.set(d.teacherId, new Map()).get(d.teacherId);
    const k = `${d.kind}|${d.group}`, c = m.get(k) || m.set(k, { drafted: new Set(), done: new Set() }).get(k);
    if (d.text.trim()) c.drafted.add(d.studentId);
    if (d.done) c.done.add(d.studentId);
  }
  return out;
}
// PDPA: the drafts about one student (every writer's), and their removal.
export const draftsAbout = (sid) => data.drafts.filter((d) => d.studentId === sid);
export function eraseDraftsAbout(sid) {
  const n = draftsAbout(sid).length;
  if (n) { data.drafts = data.drafts.filter((d) => d.studentId !== sid); save(); }
  return n;
}
export const _reset = () => { data = { limits: {}, drafts: [] }; };
