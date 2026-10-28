// A student's copy of their data, and erasure. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-pdpa-'));
const UP = path.join(DIR, 'uploads'); fs.mkdirSync(UP, { recursive: true });
const { api } = await import('../store.mjs');
const A = await import('../auth.mjs');
const { buildCopy, eraseStudent } = await import('../routes/50-pdpa.mjs');
const { zip, unzip } = await import('../zip.mjs');

// A pilot student with a bit of everything, and two uploaded files (one also used on Maya's map).
const NAME = 'Zed Quillfeather';
const s = api.addStudent({ name: NAME, year: 9 });
const sid = s.id;
const F1 = `${'a'.repeat(32)}.pdf`, F2 = `${'b'.repeat(32)}.png`;
for (const f of [F1, F2]) { fs.writeFileSync(path.join(UP, f), `file ${f}`); fs.writeFileSync(path.join(UP, `${f}.json`), JSON.stringify({ name: `${f[0]}-evidence`, type: 'application/pdf' })); }
const ev = api.addStation(sid, { title: 'ZED-STATION-ONE', lineIds: ['science'], files: [{ kind: 'pdf', url: `/api/files/${F1}`, caption: 'Report' }, { kind: 'image', url: `/api/files/${F2}`, caption: 'Photo' }] });
api.addStation('st-01', { title: 'Maya reuses a photo', lineIds: ['science'], files: [{ kind: 'image', url: `/api/files/${F2}`, caption: 'Shared photo' }] });
api.addReflection({ studentId: sid, eventId: ev.id, prompt: 'p', text: 'ZED-PRIVATE-REFLECTION', visibility: 'private' });
api.requestEndorsement(ev.id, 't-01', 'please');
const rq = api.getStore().requests.find((r) => r.eventId === ev.id);
api.endorse([rq.id], 't-01', 'ZED-ENDORSED');
const pres = { ...structuredClone(api.getDrafts()['st-01'][0]), id: 'pr-zed', studentId: sid, title: 'ZED-DRAFT', shareLinks: [{ token: 'tp-zed1', expiresAt: '2027-06-01', views: 0, revoked: false }] };
api.setStudentDrafts(sid, [pres]);
api.addComment('pr-zed', sid, 'ZED-COMMENT', ev.id, 't-09');
api.askEvidence(ev.id, 'A reader', 'ZED-EVIDENCE-ASK');
api.recordView('tp-zed1', sid, 'Someone');
api.setPrivacy(sid, { linkDays: 30 });
const stu = A.createAccount({ email: 'zed@nist.ac.th', name: NAME, kind: 'student', studentId: sid });
const mum = A.createAccount({ email: 'zmum@example.com', name: 'Zed Mum', kind: 'parent', children: [sid] });
const two = A.createAccount({ email: 'both@example.com', name: 'Two Kids', kind: 'parent', children: [sid, 'st-01'] });

const read = (entries) => Object.fromEntries(entries.map((e) => [e.name, e.name.endsWith('.json') || e.name.endsWith('.txt') ? e.data.toString() : e.data]));
const otherStudents = () => api.getStudents({ includeCohort: true }).filter((x) => x.id !== sid);

test('the copy holds the student\'s own items, all visibilities, and their files', () => {
  const { entries } = buildCopy(sid);
  const z = read(unzip(zip(entries)));
  assert.ok(z['README.txt'].includes(NAME) && z['README.txt'].includes('events.json'));
  assert.equal(JSON.parse(z['student.json']).id, sid);
  for (const [file, text] of [['events.json', 'ZED-STATION-ONE'], ['reflections.json', 'ZED-PRIVATE-REFLECTION'], ['endorsements.json', 'ZED-ENDORSED'], ['drafts.json', 'tp-zed1'], ['comments.json', 'ZED-COMMENT'], ['evidenceRequests.json', 'ZED-EVIDENCE-ASK'], ['requests.json', rq.id], ['linkViews.json', 'tp-zed1'], ['privacy.json', '"linkDays": 30'], ['activity.json', 'ZED-STATION-ONE'], ['accounts.json', 'zed@nist.ac.th']]) {
    assert.ok(z[file]?.includes(text), `${file} has ${text}`);
  }
  assert.ok(!z['accounts.json'].includes('hash') && !z['accounts.json'].includes('salt'));
  assert.equal(z[`files/${F1}`].toString(), `file ${F1}`);
  assert.ok(z[`files/${F2}`]);
  assert.ok(JSON.parse(z['manifest.json']).uploads.some((u) => u.name === 'a-evidence'));
});

test('the copy has nothing of another student', () => {
  for (const id of [sid, 'st-01', 'st-09']) {
    const { entries } = buildCopy(id);
    const text = entries.filter((e) => /\.(json|txt)$/.test(e.name)).map((e) => e.data.toString()).join('\n');
    const others = api.getStudents({ includeCohort: true }).filter((x) => x.id !== id);
    for (const o of others) assert.ok(!new RegExp(`"${o.id}"`).test(text), `${id}'s copy mentions ${o.id}`);
    const theirEvents = api.getStore().events.filter((e) => e.studentId !== id).map((e) => e.id);
    for (const e of theirEvents) assert.ok(!text.includes(`"${e}"`), `${id}'s copy has another student's station ${e}`);
  }
});

test('erasure removes the student, their files and accounts; others are untouched', () => {
  const before = Object.fromEntries(otherStudents().map((o) => [o.id, JSON.stringify(api.studentData(o.id).own)]));
  const evIds = api.getStore().events.filter((e) => e.studentId === sid).map((e) => e.id);
  const out = eraseStudent(sid, 'u-admin');
  assert.ok(out.removed.events >= 1 && out.removed.students === 1);
  const snap = api.snapshot();
  for (const needle of [sid, NAME, 'Zed', 'ZED-', 'tp-zed1', 'pr-zed', ...evIds]) assert.ok(!snap.includes(needle), `snapshot still has ${needle}: ${snap.slice(Math.max(0, snap.indexOf(needle) - 200), snap.indexOf(needle) + 50)}`);
  for (const o of otherStudents()) {
    const now = JSON.stringify(api.studentData(o.id).own);
    if (o.id === 'st-01') assert.ok(now.includes(F2) && now.length > 1000);
    else assert.equal(now, before[o.id], `${o.id} changed`);
  }
  assert.ok(!fs.existsSync(path.join(UP, F1)) && !fs.existsSync(path.join(UP, `${F1}.json`)), 'their own file is gone');
  assert.ok(fs.existsSync(path.join(UP, F2)), 'a file another record uses stays');
  assert.equal(out.files, 1);
  assert.ok(!A.accountById(stu.id) && !A.accountById(mum.id), 'student account and only-child family account removed');
  assert.deepEqual(A.accountById(two.id).children, ['st-01'], 'a family with another child keeps that link only');
  const lines = fs.readFileSync(path.join(DIR, 'audit.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const last = lines.at(-1);
  assert.equal(last.action, 'erase'); assert.equal(last.studentId, sid); assert.equal(last.by, 'u-admin');
  assert.ok(!JSON.stringify(lines).includes('Zed'), 'audit holds no names or content');
  assert.throws(() => eraseStudent(sid, 'u-admin'), /No such student/);
});

test('erasure is admin only, and not through /api/action', () => {
  assert.ok(api.MUTATORS.includes('eraseStudent'));
  assert.ok(!A.canAct({ kind: 'leadership' }, 'eraseStudent', ['st-01']));
  assert.ok(!A.canAct({ kind: 'student', studentId: 'st-01' }, 'eraseStudent', ['st-01']));
  assert.ok(A.canAct({ kind: 'admin' }, 'eraseStudent', ['st-01']));
});
