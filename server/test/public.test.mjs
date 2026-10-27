// Public share links and verify codes carry only what was shared. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-public-'));
const { api } = await import('../store.mjs');
const { publicSnapshot, publicVerify, findLink } = await import('../routes/40-public.mjs');
const { verifyCode } = await import('../../src/format.js');

const live = () => Object.values(api.getDrafts()).flat().flatMap((p) => p.shareLinks.filter((l) => !l.revoked && l.expiresAt >= api.TODAY).map((l) => ({ pres: p, link: l })));

test('a private reflection never appears in a share payload', () => {
  const links = live();
  assert.ok(links.length > 2, 'seed has live links');
  for (const { pres, link } of links) {
    const snap = publicSnapshot(link.token);
    const json = JSON.stringify(snap);
    const mine = new Set(api.getStore().events.filter((e) => e.studentId === pres.studentId).map((e) => e.id));
    // Includes private reflections on stations this link does show.
    const hidden = api.getStore().reflections.filter((r) => mine.has(r.eventId) && (r.visibility || 'private') !== 'publishable');
    assert.ok(hidden.length > 0);
    for (const r of hidden) assert.ok(!json.includes(r.text.slice(0, 60)), `${link.token} leaks reflection ${r.id}`);
    assert.ok(snap.store.reflections.every((r) => r.visibility === 'publishable'));
  }
});

test('a private reflection on a shown station is left out, even when added live', () => {
  const { pres, link } = live().find((x) => x.link.token === 'tp-g3n2');
  const shown = publicSnapshot(link.token).store.events[0];
  api.addReflection({ studentId: pres.studentId, eventId: shown.id, prompt: 'p', text: 'SECRET-PRIVATE-REFLECTION-XYZ', visibility: 'private' });
  api.addReflection({ studentId: pres.studentId, eventId: shown.id, prompt: 'p', text: 'ADVISOR-ONLY-REFLECTION-XYZ', visibility: 'advisor' });
  const json = JSON.stringify(publicSnapshot(link.token));
  assert.ok(!json.includes('SECRET-PRIVATE-REFLECTION-XYZ'));
  assert.ok(!json.includes('ADVISOR-ONLY-REFLECTION-XYZ'));
});

test('only the one student, presentation and link', () => {
  for (const { pres, link } of live()) {
    const snap = publicSnapshot(link.token);
    const json = JSON.stringify(snap);
    const s = snap.store;
    assert.deepEqual(s.students.map((x) => x.id), [pres.studentId]);
    assert.deepEqual(Object.keys(s.drafts), [pres.studentId]);
    assert.equal(s.drafts[pres.studentId].length, 1);
    assert.deepEqual(s.drafts[pres.studentId][0].shareLinks.map((l) => l.token), [link.token]);
    for (const o of api.getStudents({ includeCohort: true })) if (o.id !== pres.studentId) assert.ok(!json.includes(o.name), `${link.token} names ${o.name}`);
    for (const { link: l } of live()) if (l.token !== link.token) assert.ok(!json.includes(l.token), `${link.token} carries ${l.token}`);
    assert.ok(s.events.length > 0);
    assert.ok(s.events.every((e) => e.studentId === pres.studentId && e.visibility === 'publishable'));
    for (const k of ['notes', 'requests', 'prompts', 'comments', 'evidenceRequests', 'notifications', 'activity', 'inbox', 'pending', 'applications']) {
      const v = s[k]; assert.ok(!v || (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0), `${k} is empty`);
    }
    assert.ok(!('advisorId' in s.students[0]));
  }
});

test('hidden lines and the lens are respected', () => {
  const { pres, link } = live().find((x) => x.pres.filters?.hiddenLines?.length);
  const s = publicSnapshot(link.token).store;
  for (const id of pres.filters.hiddenLines) {
    assert.ok(!s.students[0].laneOrder.includes(id));
    assert.ok(s.events.every((e) => !e.lineIds.includes(id)));
  }
  const map = api.getStudentMap(pres.studentId, 'public');
  const lens = api.applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines });
  assert.deepEqual(new Set(s.events.map((e) => e.id)), lens.visible);
});

test('gated links send no stations before the email', () => {
  const s = publicSnapshot('tp-u8k4', { gate: true }).store;
  assert.equal(s.events.length, 0);
  assert.equal(s.reflections.length, 0);
  assert.equal(s.students.length, 1);
});

test('unknown, revoked and expired links', () => {
  assert.throws(() => findLink('nope'), (e) => e.status === 404);
  assert.throws(() => findLink('tp-e1x9'), (e) => e.status === 410 && /withdrawn/.test(e.message));
  const p = Object.values(api.getDrafts()).flat().find((x) => x.shareLinks.some((l) => l.token === 'tp-g3n2'));
  const l = p.shareLinks.find((x) => x.token === 'tp-g3n2'); const was = l.expiresAt;
  l.expiresAt = '2020-01-01';
  assert.throws(() => findLink('tp-g3n2'), (e) => e.status === 410 && /expired/.test(e.message));
  l.expiresAt = was;
});

test('verify codes: publishable only, one station', () => {
  const pub = api.getStore().events.find((e) => e.visibility === 'publishable' && api.getStore().endorsements.some((n) => n.eventId === e.id));
  const r = publicVerify(verifyCode(pub.id));
  assert.equal(r.event.title, pub.title);
  assert.equal(r.student.name, api.getStudent(pub.studentId).name);
  assert.ok(r.endorsements.length > 0 && r.endorsements[0].teacher.name);
  assert.deepEqual(Object.keys(r).sort(), ['code', 'endorsements', 'event', 'student']);
  assert.ok(!('summary' in r.event) && !('evidence' in r.event));
  const priv = api.getStore().events.find((e) => e.visibility !== 'publishable');
  assert.throws(() => publicVerify(verifyCode(priv.id)), (e) => e.status === 404);
  assert.throws(() => publicVerify('NIST-ZZZZZZ'), (e) => e.status === 404);
});
