// Undo one change without wiping anyone else's (server/history.mjs). Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-undo-'));
const { api, changed } = await import('../store.mjs');
const H = await import('../history.mjs');

// A change made by someone: run it (the history hook catches the steps), then changed() as /api/action does.
const by = (userId, fn, ...args) => { const out = api[fn](...args); return { out, rev: changed({ fn, userId }) }; };
const pilot = { mode: 'pilot', isAdmin: (u) => !!u?.admin };
const undo = (revs, user, opts = pilot) => {
  for (const r of [].concat(revs)) { const p = H.undoProblem(r, user, opts); if (p) return p; }
  const u = H.rebuild([].concat(revs)); return { ...u, rev: changed({ fn: 'undo', undo: u, userId: user?.id }) };
};
const A = { id: 'u-a' }, B = { id: 'u-b' }, ADMIN = { id: 'u-x', admin: true };
const ev = (id) => api.getStore().events.find((e) => e.id === id);
const other = () => api.getStore().events.find((e) => e.studentId === 'st-02');

test('undo an older change while a later change by someone else survives', () => {
  const { out: st } = by('u-a', 'addStation', 'st-01', { title: 'Robot club', lineIds: [api.getStore().events.find((e) => e.studentId === 'st-01').lineIds[0]] });
  const { rev: del } = by('u-a', 'deleteStation', st.id);
  assert.equal(ev(st.id), undefined);
  // 25 more changes by someone else, so the rebuild crosses a checkpoint.
  const y = other();
  const { out: rf } = by('u-b', 'addReflection', { studentId: 'st-02', eventId: y.id, prompt: 'p', text: 'Kept reflection', visibility: 'private' });
  for (let i = 0; i < 25; i++) by('u-b', 'addNote', 'st-02', `note ${i}`);
  const r = undo(del, A);
  assert.ok(r.rev, JSON.stringify(r));
  assert.deepEqual(r.dropped, []);
  assert.equal(ev(st.id)?.title, 'Robot club', 'the deleted station is back, same id');
  assert.ok(api.getStore().reflections.some((x) => x.id === rf.id && x.text === 'Kept reflection'), "the other person's reflection stays");
  assert.equal(api.getStore().notes['st-02'].filter((n) => /^note /.test(n.text)).length, 25, 'and all their later changes');
});

test('someone else cannot undo your change; an admin can', () => {
  const { rev } = by('u-a', 'addNote', 'st-01', 'A note');
  assert.equal(undo(rev, B).status, 403);
  assert.equal(undo(rev, null).status, 403);
  assert.equal(H.undoProblem(rev, B, { mode: 'demo' }), null, 'demo: anyone');
  assert.ok(undo(rev, ADMIN).rev);
  assert.ok(!api.getStore().notes['st-01']?.some((n) => n.text === 'A note'));
});

test('a change cannot be undone twice, and an undo cannot be undone', () => {
  const { rev } = by('u-a', 'addNote', 'st-01', 'Twice');
  const r = undo(rev, A);
  assert.ok(r.rev);
  assert.equal(undo(rev, A).status, 409);
  assert.equal(undo(r.rev, A).status, 400);
  assert.equal(undo(999999, A).status, 410);
});

test('a later change that no longer fits is left out and reported', () => {
  const line = api.getStore().events.find((e) => e.studentId === 'st-01').lineIds[0];
  const { out: st, rev: add } = by('u-a', 'addStation', 'st-01', { title: 'Short-lived', lineIds: [line] });
  const { rev: ask } = by('u-b', 'requestEndorsement', st.id, 't-01', null); // needs the station
  const { rev: note } = by('u-b', 'addNote', 'st-01', 'Unrelated');
  const r = undo(add, A);
  assert.deepEqual(r.dropped.map((d) => d.rev), [ask]);
  assert.equal(ev(st.id), undefined);
  assert.ok(!api.getStore().requests.some((q) => q.eventId === st.id));
  assert.ok(api.getStore().notes['st-01'].some((n) => n.text === 'Unrelated'));
  assert.equal(H.undoProblem(ask, B, pilot).status, 409, 'the left-out change is gone');
  assert.equal(H.undoProblem(note, B, pilot), null);
});

test('several changes made together undo in one go', () => {
  const ids = api.getStore().events.filter((e) => e.studentId === 'st-03' && e.visibility !== 'publishable').slice(0, 2).map((e) => e.id);
  const revs = ids.map((id) => by('u-a', 'setVisibility', id, 'publishable').rev);
  assert.ok(undo(revs, A).rev);
  assert.ok(ids.every((id) => ev(id).visibility !== 'publishable'));
});

test('a reset starts the history again; the log is on disk', () => {
  const { rev } = by('u-a', 'addNote', 'st-01', 'Before reset');
  api.resetDemo(); changed({ fn: 'resetDemo' });
  assert.equal(H.undoProblem(rev, A, pilot).status, 410);
  const { rev: after } = by('u-a', 'addNote', 'st-01', 'After reset');
  const log = fs.readFileSync(path.join(process.env.DATA_DIR, 'history', 'log.jsonl'), 'utf8');
  assert.ok(log.includes(`"rev":${after}`));
  assert.ok(fs.readdirSync(path.join(process.env.DATA_DIR, 'history')).some((f) => f.startsWith('cp-')));
});
