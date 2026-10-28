// Pilot feedback: what people tell us from the Feedback button. Kept outside the shared record, in
// DATA_DIR/feedback.json: [{ id, at, by (account id), name, role, studentId?, year?, route, ua, kind, message, screenshot?, done? }].
// Routes: server/routes/65-feedback.mjs. The PDPA copy and erasure (50-pdpa.mjs) use feedbackOf / eraseFeedbackOf.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';

const FILE = path.join(DATA_DIR, 'feedback.json');
let items = (() => { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; } })();
const save = () => writeAtomic(FILE, JSON.stringify(items, null, 1));

export const KINDS = { broken: "Something's broken", idea: 'An idea', confusing: "Something's confusing" };
export const allFeedback = () => [...items].sort((a, b) => b.at.localeCompare(a.at));
export const feedbackById = (id) => items.find((f) => f.id === id);
export function addFeedback(f) {
  const item = { id: `fb-${crypto.randomBytes(6).toString('hex')}`, at: new Date().toISOString(), ...f, done: null };
  items.push(item); save();
  return item;
}
export function setDone(item, done, by) { item.done = done ? { at: new Date().toISOString(), by: by.id, name: by.name } : null; save(); return item; }
// A student's feedback: sent from their own accounts, or about their record (studentId).
const isOf = (f, sid, accountIds) => f.studentId === sid || accountIds.includes(f.by);
export const feedbackOf = (sid, accountIds = []) => items.filter((f) => isOf(f, sid, accountIds));
export function eraseFeedbackOf(sid, accountIds = []) {
  const gone = items.filter((f) => isOf(f, sid, accountIds));
  if (gone.length) { items = items.filter((f) => !isOf(f, sid, accountIds)); save(); }
  return gone;
}
export const _reset = () => { items = []; };
