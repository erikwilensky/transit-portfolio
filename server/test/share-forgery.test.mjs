// A student writes their whole list of presentations at once (api.setStudentDrafts). It must never speak for another
// student or take over another student's share link. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-forgery-'));
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { findLink } = await import('../routes/40-public.mjs');

const [a, c] = Object.keys(api.getDrafts()).filter((id) => api.getDrafts()[id].length);
const me = { id: 'u-test', kind: 'student', studentId: a };
const mine = () => structuredClone(api.getDrafts()[a]);
const theirToken = Object.values(api.getDrafts()).flat().find((p) => p.studentId !== a && p.shareLinks?.length)?.shareLinks[0].token;

test('a student may save their own presentations and a new link', () => {
  const list = mine();
  list[0].shareLinks = [...(list[0].shareLinks || []), { token: 'tp-0123456789abcdefghijkl', expiresAt: '2099-01-01', revoked: false }];
  assert.equal(canAct(me, 'setStudentDrafts', [a, list]), true);
});

test('never a presentation that names another student', () => {
  const list = mine(); list[0].studentId = c;
  assert.equal(canAct(me, 'setStudentDrafts', [a, list]), false);
});

test('never a link token another student already uses', () => {
  assert.ok(theirToken, 'the seed has another student\'s link');
  const list = mine(); list[0].shareLinks = [{ token: theirToken, expiresAt: '2099-01-01', revoked: false }];
  assert.equal(canAct(me, 'setStudentDrafts', [a, list]), false);
});

test('a forged presentation already in the record never opens as a share link', () => {
  const list = mine(); list.push({ ...list[0], id: 'pr-forged', studentId: c, shareLinks: [{ token: 'tp-forged-forged-forged', expiresAt: '2099-01-01', revoked: false }] });
  api.setStudentDrafts(a, list);
  assert.throws(() => findLink('tp-forged-forged-forged'), (e) => e.status === 404);
});
