// Activity log reads (server/audit.mjs): each month file is parsed once and kept while its size and mtime stay the
// same; appended lines parse only the new part; a rewrite (erasure, or a file changed outside) parses it again.
// Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-auditcache-'));
process.env.DATA_DIR = DIR; process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const audit = await import('../audit.mjs');
const actor = { id: 'acc-1', name: 'Ms Ada Brook', kind: 'advisor' };
const add = (action, target = {}) => audit.log(null, { action, target, actor });
const count = () => ({ ...audit.parsedCount });

test('repeated reads do not parse the month again', () => {
  add('sign-in'); add('change', { studentId: 'S2002', label: 'Gus Hale' });
  const a = count();
  const first = audit.entriesBetween();
  assert.deepEqual(first.map((e) => e.action), ['sign-in', 'change']);
  assert.equal(audit.parsedCount.files, a.files + 1);
  for (let i = 0; i < 5; i++) assert.equal(audit.entriesBetween().length, 2);
  assert.deepEqual(count(), { files: a.files + 1, tails: a.tails }, 'five more reads, no parsing');
});

test('a new line parses only the new part', () => {
  const a = count();
  add('sign-out');
  assert.deepEqual(audit.entriesBetween().map((e) => e.action), ['sign-in', 'change', 'sign-out']);
  assert.deepEqual(count(), { files: a.files, tails: a.tails + 1 });
});

test('a rewritten file is read again: erasure, or a change outside the server', () => {
  audit.redactStudent('S2002');
  assert.equal(audit.entriesBetween().find((e) => e.action === 'change').target.label, audit.ERASED);
  const [f] = audit.logFiles();
  const a = count();
  const text = fs.readFileSync(f, 'utf8').replace('"sign-out"', '"sign-off"'); // same size
  fs.writeFileSync(f, text);
  const t = new Date(Date.now() + 5000); fs.utimesSync(f, t, t);
  assert.ok(audit.entriesBetween().some((e) => e.action === 'sign-off'));
  assert.equal(audit.parsedCount.files, a.files + 1);
  fs.unlinkSync(f);
  assert.equal(audit.entriesBetween().length, 0, 'a removed file is gone from the cache');
});
