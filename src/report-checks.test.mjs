// Report comments (src/report-checks.js): counts and the simple checks on a draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import { charCount, checkComment, firstName, wordCount } from './report-checks.js';

const aaron = { id: 'S1', name: 'Aaron Torres' }, ann = { id: 'S2', name: 'Ann Lee' }, maya = { id: 'S3', name: 'Maya Torres' };
const keys = (r) => Object.fromEntries(r.map((c) => [c.key, c.level]));

test('counts words and characters (Thai counts by character)', () => {
  assert.equal(wordCount('  Aaron  worked hard.\nWell done. '), 5);
  assert.equal(wordCount(''), 0);
  assert.equal(charCount('สวัสดี'), 6);
  assert.equal(firstName('Aaron Torres'), 'Aaron');
});

test('first name used, another student named, limits and length', () => {
  assert.deepEqual(keys(checkComment('', aaron)), { empty: 'warn' });
  assert.deepEqual(keys(checkComment('aaron has worked well this term in every lesson.', aaron, [aaron, ann, maya], { words: 20 })), { first: 'ok' });
  assert.deepEqual(keys(checkComment('He has worked well this term in every lesson.', aaron, [], { words: 20 })), { first: 'warn' });
  const wrong = checkComment('Maya has worked well. Aaron too.', aaron, [aaron, ann, maya]);
  assert.equal(keys(wrong).wrong, 'problem'); assert.match(wrong.at(-1).text, /Mentions Maya/);
  assert.equal(keys(checkComment('Aaron Torres works hard.', aaron, [aaron, maya])).wrong, undefined, 'a shared surname is his own');
  assert.equal(keys(checkComment('Aaron may annotate.', aaron, [aaron, { id: 'S4', name: 'May Ito' }, ann])).wrong, undefined, 'lower-case words are not names');
  assert.equal(keys(checkComment('Annabel and Ann.', { id: 'S5', name: 'Annabel Ko' }, [ann])).wrong, 'problem', 'Ann is not part of Annabel');
  const long = checkComment('Aaron '.repeat(12), aaron, [], { words: 10, chars: 50 });
  assert.deepEqual([keys(long).words, keys(long).chars], ['problem', 'problem']);
  assert.equal(keys(checkComment('Aaron did well.', aaron, [], { words: 100 })).short, 'warn');
});
