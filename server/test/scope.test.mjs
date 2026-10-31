// Pilot record scoping: who downloads which students, and who may change them. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-scope-'));
const { api } = await import('../store.mjs');
const { reachOf, scopedSnapshot, recipientKeys } = await import('../scope.mjs');
const { canAct } = await import('../auth.mjs');

const S = api.getStore();
const stu = (sid) => ({ id: 'u-s', kind: 'student', studentId: sid });
const teacher = (tid, kind = 'teacher') => ({ id: 'u-t', kind, teacherId: tid });
const PARENT = { id: 'u-p', kind: 'parent', children: ['st-06', 'st-09'] };
const LEAD = { id: 'u-l', kind: 'leadership', teacherId: 't-10' };
const ADMIN = { id: 'u-a', kind: 'admin', admin: true };
const studentsIn = (snap) => new Set([
  ...snap.store.students.map((s) => s.id), ...snap.store.events.map((e) => e.studentId), ...snap.store.inbox.map((e) => e.studentId),
  ...snap.store.requests.map((r) => r.studentId), ...snap.store.comments.map((c) => c.studentId), ...snap.store.activity.map((a) => a.studentId),
  ...Object.keys(snap.store.drafts), ...Object.keys(snap.store.notes), ...snap.store.pending.map((p) => p.event.studentId),
]);

// A live record: a roster class, private and advisor-only items, a teacher email, notifications in both key styles.
S.classes = [{ id: 'cl-art', name: 'Visual Arts 11', teacherIds: ['t-06'] }];
S.enrolments = [{ studentId: 'st-02', classId: 'cl-art' }];
S.teachers.find((t) => t.id === 't-01').email = 'nair@school.example';
const priv = api.addStation('st-01', { title: 'SECRET-PRIVATE-STATION', lineIds: ['science'], visibility: 'private' });
api.addReflection({ studentId: 'st-01', eventId: 'ev-042', prompt: 'p', text: 'SECRET-PRIVATE-REFLECTION', visibility: 'private' });
api.addReflection({ studentId: 'st-01', eventId: 'ev-042', prompt: 'p', text: 'ADVISOR-LEVEL-REFLECTION', visibility: 'advisor' });
api.addReflection({ studentId: 'st-01', eventId: priv.id, prompt: 'p', text: 'ON-PRIVATE-STATION', visibility: 'advisor' });
api.capturePhone('st-03', { title: 'LENA-INBOX-ITEM' });
api.addNotification('maya', 'FOR-MAYA-PERSONA');
api.addNotification('st:st-01', 'FOR-MAYA-RECORD');
api.addNotification('arun', 'FOR-ARUN');
api.addNotification('t:t-01', 'FOR-NAIR-RECORD');

test('reachOf: a student, a family, whole-school roles', () => {
  assert.deepEqual([...reachOf(stu('st-02'))], ['st-02']);
  assert.deepEqual([...reachOf(PARENT)].sort(), ['st-06', 'st-09']);
  for (const k of ['admin', 'leadership', 'coordinator', 'counsellor']) assert.equal(reachOf({ kind: k, teacherId: 't-08' }), null, k);
  assert.equal(reachOf(ADMIN), null);
  assert.equal(reachOf(null).size, 0);
});

test('reachOf: an advisor or teacher reaches the students they work with', () => {
  assert.deepEqual([...reachOf(teacher('t-07', 'advisor'))].sort(), S.students.filter((s) => s.advisorId === 't-07').map((s) => s.id).sort());
  const nair = reachOf(teacher('t-01'));
  for (const sid of ['st-01', 'st-02', 'st-07']) assert.ok(nair.has(sid), `t-01 → ${sid} (requests, sponsor, class tasks)`);
  assert.ok(!nair.has('st-03') && !nair.has('st-09'));
  const sato = reachOf(teacher('t-06'));
  assert.ok(sato.has('st-03'), 'endorsement request'); assert.ok(sato.has('st-02'), 'enrolled in a class they teach');
  assert.ok(!sato.has('st-01'));
  assert.ok(reachOf(teacher('t-02')).has('st-01'), 'DP supervisor');
  assert.equal(reachOf(teacher('t-99')).size, 0);
});

test('a student never receives another student’s record', () => {
  const snap = scopedSnapshot(stu('st-02'));
  assert.deepEqual([...studentsIn(snap)], ['st-02']);
  const json = JSON.stringify(snap);
  for (const r of S.reflections) if (api.getEvent(r.eventId)?.studentId !== 'st-02') assert.ok(!json.includes(r.text.slice(0, 50)), `leaks ${r.id}`);
  for (const e of S.events) if (e.studentId !== 'st-02') assert.ok(!snap.store.events.some((x) => x.id === e.id));
  assert.deepEqual(Object.keys(snap.store.drafts), ['st-02']);
  assert.ok(!json.includes('LENA-INBOX-ITEM') && !json.includes('SECRET-PRIVATE'));
  assert.ok(snap.store.lines.every((l) => !l.studentId || l.studentId === 'st-02'));
  assert.deepEqual(snap.store.notes, {}, 'no advisor notes');
  assert.deepEqual(snap.store.letters, {});
});

test('a student receives all of their own record, private items too', () => {
  const snap = scopedSnapshot(stu('st-01'));
  const json = JSON.stringify(snap);
  for (const t of ['SECRET-PRIVATE-STATION', 'SECRET-PRIVATE-REFLECTION', 'ADVISOR-LEVEL-REFLECTION', 'ON-PRIVATE-STATION']) assert.ok(json.includes(t), t);
  assert.equal(snap.store.events.length, S.events.filter((e) => e.studentId === 'st-01').length);
});

test('a teacher never receives a student outside their reach', () => {
  for (const tid of ['t-01', 't-06', 't-07', 't-02']) {
    const u = teacher(tid, tid === 't-07' ? 'advisor' : 'teacher');
    const reach = reachOf(u);
    const snap = scopedSnapshot(u);
    for (const sid of studentsIn(snap)) assert.ok(reach.has(sid), `${tid} receives ${sid}`);
    const json = JSON.stringify(snap);
    for (const e of S.events) if (!reach.has(e.studentId)) assert.ok(!json.includes(`"${e.id}"`), `${tid} receives ${e.id}`);
  }
  const sato = scopedSnapshot(teacher('t-06'));
  assert.ok(!sato.store.students.some((s) => s.id === 'st-01') && !JSON.stringify(sato).includes('Maya Chen'));
  assert.ok(!JSON.stringify(sato).includes('LENA-INBOX-ITEM'), 'a student’s undecided inbox stays theirs, even in reach');
});

test('private reflections and stations never reach staff, whatever the role', () => {
  for (const u of [teacher('t-07', 'advisor'), teacher('t-01'), teacher('t-02'), LEAD, ADMIN, { kind: 'counsellor', teacherId: 't-09' }, { kind: 'coordinator', teacherId: 't-08' }]) {
    const snap = scopedSnapshot(u);
    const json = JSON.stringify(snap);
    assert.ok(!json.includes('SECRET-PRIVATE-REFLECTION'), `${u.kind} gets a private reflection`);
    assert.ok(!json.includes('SECRET-PRIVATE-STATION') && !json.includes('ON-PRIVATE-STATION'), `${u.kind} gets a private station`);
    assert.ok(snap.store.reflections.every((r) => r.visibility && r.visibility !== 'private'));
    assert.ok(snap.store.events.every((e) => e.visibility !== 'private'));
    assert.ok(snap.store.activity.every((a) => !a.text.includes('SECRET-PRIVATE-STATION')), `${u.kind}: activity names a private station`);
  }
  assert.ok(JSON.stringify(scopedSnapshot(teacher('t-07', 'advisor'))).includes('ADVISOR-LEVEL-REFLECTION'), 'the advisor reads advisor-level reflections');
  assert.ok(scopedSnapshot(LEAD).store.scope.privateStations >= 1, 'whole-school roles get the count, not the content');
});

test('a station a student sent to a teacher reaches that teacher, even when private', () => {
  const g = api.addGoal('st-03', { title: 'PRIVATE-SPONSORED-PLAN', date: '2027-03-01', lineId: 'art', sponsor: 't-06' });
  api.setVisibility(g.id, 'private');
  assert.ok(scopedSnapshot(teacher('t-06')).store.events.some((e) => e.id === g.id));
  assert.ok(!scopedSnapshot(teacher('t-07', 'advisor')).store.events.some((e) => e.id === g.id));
});

test('a family sees only what the family view shows', () => {
  const snap = scopedSnapshot(PARENT);
  assert.deepEqual([...studentsIn(snap)].sort(), ['st-06', 'st-09']);
  for (const e of snap.store.events) assert.ok(api.VISIBLE_TO[api.familyViewer(e.studentId)].includes(e.visibility));
  for (const r of snap.store.reflections) assert.ok(api.VISIBLE_TO[api.familyViewer(api.getEvent(r.eventId).studentId)].includes(r.visibility));
  assert.equal(snap.store.inbox.length + snap.store.requests.length + snap.store.prompts.length + snap.store.comments.length, 0);
  assert.deepEqual(snap.store.drafts, {});
});

test('school lines and the staff directory stay, without emails', () => {
  for (const u of [stu('st-02'), PARENT, teacher('t-06'), LEAD]) {
    const snap = scopedSnapshot(u);
    assert.equal(snap.store.teachers.length, S.teachers.length);
    assert.ok(snap.store.teachers.every((t) => !('email' in t) && t.name && t.role));
    assert.equal(snap.store.lines.filter((l) => !l.studentId).length, api.getSchoolLines().length);
  }
});

test('notifications: only the person’s own, by persona id or record key', () => {
  assert.deepEqual(scopedSnapshot(stu('st-01')).store.notifications.map((n) => n.text).sort(), ['FOR-MAYA-PERSONA', 'FOR-MAYA-RECORD']);
  assert.deepEqual(scopedSnapshot(teacher('t-01')).store.notifications.map((n) => n.text), ['FOR-NAIR-RECORD']);
  assert.equal(scopedSnapshot(LEAD).store.notifications.length, 0);
  assert.ok(recipientKeys({ id: 'u-x', kind: 'student', studentId: 'st-01' }).has('maya'));
});

test('whole-school screens still have what they read', () => {
  const snap = scopedSnapshot(LEAD);
  assert.equal(snap.store.students.length, S.students.length);
  assert.equal(snap.store.events.length, S.events.filter((e) => e.visibility !== 'private').length);
  assert.equal(snap.store.roster.length, S.roster.length);
  assert.deepEqual(Object.keys(snap.store.drafts).sort(), Object.keys(S.drafts).sort());
});

test('a browser holding only its part of the record can run its normal changes', async () => {
  const copy = await import(`../build/api.js?copy=${Date.now()}`);
  const run = (u, f) => { copy.load(scopedSnapshot(u)); assert.doesNotThrow(f); };
  run(teacher('t-01'), () => { const r = copy.getRequests('t-01')[0]; copy.endorse([r.id], 't-01', 'ok'); copy.declineRequest(copy.getRequests('t-01')[0].id, 'more'); copy.getSponsored('t-01'); copy.addCheckIn('ev-sp-1', 'hi', 't-01'); copy.endorseClassTask('ct-1', ['st-01', 'st-02'], 'done'); copy.getClassTasks('t-01'); });
  run(teacher('t-07', 'advisor'), () => { copy.getCohort('t-07'); copy.sendPrompt('st-01', 'ev-042', 'why?', 't-07'); copy.addNote('st-01', 'n'); copy.addGoal('st-02', { title: 'g', date: '2027-01-01', lineId: 'music' }, 't-07'); copy.growth('st-03'); copy.getActivity('st-01'); });
  run(teacher('t-06'), () => { copy.getStudentMap('st-03', 'advisor'); copy.getRequests('t-06'); });
  run(stu('st-02'), () => { const e = copy.addStation('st-02', { title: 't', lineIds: ['music'] }); copy.requestEndorsement(e.id, 't-03'); copy.addReflection({ studentId: 'st-02', eventId: e.id, text: 'x' }); copy.getActivity('st-02'); copy.getStudentMap('st-02'); copy.termReview('st-02'); copy.suggestInterchanges('st-02'); });
  run(PARENT, () => { copy.getDigest('st-09'); copy.getStudentMap('st-06', copy.familyViewer('st-06')); copy.consentOnFile('st-09'); copy.familyConsentOf('st-09'); });
  run(LEAD, () => { copy.auditLog(); copy.profileCoverage(); copy.getDpCore(); copy.linePairs(); copy.getStudents({ includeCohort: true }).forEach((s) => copy.getSignals(s.id)); });
});

test('canAct: advisors and teachers act only on students they reach, as themselves', () => {
  const nair = teacher('t-01'), sato = teacher('t-06'), whit = teacher('t-07', 'advisor');
  const rq1 = S.requests.find((r) => r.teacherId === 't-01' && r.studentId === 'st-01');
  assert.ok(canAct(nair, 'endorse', [[rq1.id], 't-01', 'ok']));
  assert.ok(!canAct(nair, 'endorse', [[rq1.id], 't-06', 'ok']), 'not as another teacher');
  assert.ok(!canAct(sato, 'endorse', [[rq1.id], 't-06', 'ok']), 'not a request to someone else');
  assert.ok(canAct(nair, 'endorse', [[], 't-01']));
  assert.ok(canAct(whit, 'sendPrompt', ['st-03', 'ev-205', 'why?', 't-07']));
  assert.ok(!canAct(nair, 'sendPrompt', ['st-03', 'ev-205', 'why?', 't-01']), 'st-03 is outside Ms Nair’s reach');
  assert.ok(!canAct(nair, 'sendPrompt', ['st-01', 'ev-042', 'why?']), 'the default sender is the seeded advisor');
  assert.ok(canAct(whit, 'addNote', ['st-01', 'n']) && !canAct(sato, 'addNote', ['st-01', 'n']));
  assert.ok(canAct(nair, 'addCheckIn', ['ev-sp-1', 'hi', 't-01']) && !canAct(sato, 'addCheckIn', ['ev-sp-1', 'hi', 't-06']));
  assert.ok(canAct(nair, 'answerSponsor', ['ev-sp-2', true, '']) && !canAct(whit, 'answerSponsor', ['ev-sp-2', true, '']));
  assert.ok(canAct(nair, 'endorseClassTask', ['ct-1', ['st-01', 'st-02'], 'x']) && !canAct(nair, 'endorseClassTask', ['ct-1', ['st-03'], 'x']));
  assert.ok(canAct(whit, 'addGoal', ['st-02', { title: 'g' }, 't-07']) && !canAct(whit, 'addGoal', ['st-09', { title: 'g' }, 't-07']));
  assert.ok(!canAct(nair, 'addComment', ['pr-02', 'st-01', 'x']), 'the default author is the counsellor');
  assert.ok(canAct(sato, 'importCandidates', [[{ studentId: 'st-03' }], { sourceId: 'csv', by: { teacherId: 't-06' } }]));
  assert.ok(!canAct(sato, 'importCandidates', [[{ studentId: 'st-01' }], { sourceId: 'csv', by: { teacherId: 't-06' } }]));
  assert.ok(!canAct(nair, 'editStation', ['ev-205', {}]) && !canAct(nair, 'setVisibility', ['nope', 'private']), 'unknown or out-of-reach stations');
  for (const fn of ['addSchoolLine', 'renameLine', 'decideBranch', 'setRollout', 'matchRoster']) assert.ok(!canAct(nair, fn, ['x']), fn);
  assert.ok(canAct(nair, 'markNotificationsRead', ['nair']) && canAct(nair, 'recordView', ['tp-x', 'st-09']));
  assert.ok(!canAct(nair, 'addStudent', [{}]) && !canAct(nair, 'restore', ['{}']));
});

test('canAct: unknown mutators, whole-school roles, students and Undo', () => {
  const nair = teacher('t-01');
  assert.ok(canAct(nair, 'someFutureChange', [{ note: 'school-level' }]), 'touches no student');
  assert.ok(canAct(nair, 'someFutureChange', ['st-01']) && !canAct(nair, 'someFutureChange', [{ who: 'st-09' }]), 'names a student outside reach');
  assert.ok(!canAct(nair, 'someFutureChange', ['ev-205']), 'names a station outside reach');
  for (const u of [LEAD, { kind: 'counsellor', teacherId: 't-09' }, { kind: 'coordinator', teacherId: 't-08' }]) {
    assert.ok(canAct(u, 'addComment', ['pr-02', 'st-01', 'x']) && canAct(u, 'decideBranch', ['st-04-robotics', true]) && canAct(u, 'casNudge', ['st-09', 'x', 'y', 'z']), u.kind);
    assert.ok(!canAct(u, 'addStudent', [{}]) && !canAct(u, 'resetDemo', []));
  }
  assert.ok(!canAct(ADMIN, 'restore', ['{}']) && canAct(ADMIN, 'resetDemo', []), 'Undo’s whole-record copy is refused for everyone');
  const maya = stu('st-01');
  assert.ok(canAct(maya, 'addStation', ['st-01', {}]) && !canAct(maya, 'addStation', ['st-02', {}]));
  assert.ok(!canAct(maya, 'addGoal', ['st-01', {}, 't-07']) && canAct(maya, 'addGoal', ['st-01', {}]));
  assert.ok(canAct(maya, 'addCheckIn', ['ev-sp-1', 'x', 'student']) && !canAct(maya, 'addCheckIn', ['ev-sp-1', 'x', 't-01']));
  assert.ok(canAct(maya, 'importCandidates', [[{ studentId: 'st-01' }], { sourceId: 'mine' }]) && !canAct(maya, 'importCandidates', [[{ studentId: 'st-01' }], { sourceId: 'csv' }]));
  assert.ok(!canAct(maya, 'endorse', [[], 't-01']) && !canAct(maya, 'sendPrompt', ['st-01', 'ev-042', 'x', 't-07']));
  assert.ok(!canAct(PARENT, 'recordFamilyConsent', ['st-09', { on: true }, null]) && !canAct(PARENT, 'addStation', ['st-09', {}]), 'families change nothing');
});
