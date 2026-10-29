// Offline capture (src/outbox.js): the queue per account, placeholder rewriting and the words. Node has no
// IndexedDB, so this runs the in-memory fallback a private window gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as ob from './outbox.js';

test('rows are kept per account, in order, and cleared per account', async () => {
  const a1 = await ob.add('acc-a', { url: '/api/action', body: '{"fn":"addStation"}' });
  await ob.add('acc-b', { url: '/api/action', body: '{"fn":"addNote"}' });
  await ob.add('acc-a', { upload: { key: 'k1', name: 'p.jpg', type: 'image/jpeg' }, blob: 'x' });
  const a3 = await ob.add('acc-a', { url: '/api/action', body: '{"image":"blob:http://h/1#tpq-k1"}' });
  let a = await ob.list('acc-a');
  assert.deepEqual(a.map((r) => r.k), [a1, a.at(1).k, a3]);
  assert.ok(a.every((r) => r.uid === 'acc-a'));
  assert.equal(ob.waiting(a), 2, 'a photo is not a change of its own');
  await ob.update(a3, { body: '{"image":"api/files/x.jpg"}' });
  await ob.remove(a1);
  a = await ob.list('acc-a');
  assert.equal(a.length, 2); assert.equal(a.at(-1).body, '{"image":"api/files/x.jpg"}');
  await ob.clear('acc-a');
  assert.equal((await ob.list('acc-a')).length, 0);
  assert.equal((await ob.list('acc-b')).length, 1, 'another account keeps its own');
});

test('placeholders are rewritten to the uploaded address, and only known ones', () => {
  const body = JSON.stringify({ fn: 'addStation', args: ['s1', { image: 'blob:http://localhost:5173/5e2c-11#tpq-abc1', evidence: [{ url: 'blob:http://x/2#tpq-zz' }] }] });
  const out = ob.swapUrls(body, { abc1: 'api/files/0123.jpg' });
  assert.match(out, /"image":"api\/files\/0123\.jpg"/);
  assert.match(out, /blob:http:\/\/x\/2#tpq-zz/);
  assert.equal(ob.swapUrls('{"image":"blob:http://h/9#tpq-q"}', { q: '' }), '{"image":""}', 'a refused photo drops out');
  assert.ok(ob.isPlaceholder('blob:http://h/9#tpq-q')); assert.ok(!ob.isPlaceholder('api/files/1.png')); assert.ok(!ob.isPlaceholder('blob:http://h/9'));
});

test('the words', () => {
  assert.equal(ob.waitingText(0), '');
  assert.equal(ob.waitingText(3), '3 changes waiting. Saved on this phone. They will send when you are back online.');
  assert.equal(ob.waitingText(1), '1 change waiting. Saved on this phone. It will send when you are back online.');
  assert.equal(ob.waitingText(2, { simple: true }), 'Saved on this phone. It will send when you are back online.');
  assert.equal(ob.waitingText(2, { offline: false }), 'Sending 2 changes saved on this phone…');
  assert.equal(ob.signOutWarning(2), '2 changes are not sent yet. Sign out anyway?');
  assert.equal(ob.signOutWarning(1), '1 change is not sent yet. Sign out anyway?');
});
