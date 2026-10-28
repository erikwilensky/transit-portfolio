// Notifications reach pilot people (st:, t:, fam:, role: keys), not only the demo personas. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-notify-'));
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');

const s = api.addStudent({ name: 'Ada Pilot', year: 8, programme: 'IB MYP' });
const t = api.addTeacher({ name: 'Mr Ben Okoro', role: 'Physics' });
api.getStore().students.find((x) => x.id === s.id).advisorId = t.id;
const S = `st:${s.id}`, T = `t:${t.id}`, F = `fam:${s.id}`;
const last = (to) => api.getNotifications(to)[0];
const sent = (to, fn) => { const n = api.getNotifications(to).length; fn(); assert.equal(api.getNotifications(to).length, n + 1, `one more for ${to}`); return last(to); };

test('recipient keys', () => {
  assert.equal(api.toStudent(s.id), S); assert.equal(api.toTeacher(t.id), T); assert.equal(api.toFamily(s.id), F);
  assert.equal(api.toStudent('st-01'), 'maya'); assert.equal(api.toTeacher('t-08'), 'brandt'); assert.equal(api.toFamily('st-09'), 'parent');
  assert.equal(api.toStudent(undefined), null);
  assert.deepEqual(api.notifyKeys({ kind: 'student', studentId: s.id }), [S]);
  assert.deepEqual(api.notifyKeys({ id: 'me', kind: 'teacher', teacherId: t.id }).sort(), ['role:teacher', T].sort());
  assert.deepEqual(api.notifyKeys({ kind: 'parent', children: [s.id] }), [F]);
  // A seeded record answers to its demo persona id too.
  assert.deepEqual(api.notifyKeys({ id: 'maya', kind: 'student', studentId: 'st-01' }).sort(), ['maya', 'st:st-01'].sort());
  assert.ok(api.notifyKeys({ id: 'brandt', kind: 'coordinator', teacherId: 't-08' }).includes('role:coordinator'));
  assert.equal(api.shortName('Ms Clara Brandt'), 'Ms Brandt'); assert.equal(api.shortName('Kru Napat Srisuk'), 'Kru Napat'); assert.equal(api.shortName('Ben Okoro'), 'Ben Okoro');
});

test('a pilot student and a pilot teacher hear each other', () => {
  const e = api.addStation(s.id, { title: 'Bridge model', lineIds: ['science'] });
  const n1 = sent(T, () => api.requestEndorsement(e.id, t.id));
  assert.match(n1.text, /^Ada asked you to endorse “Bridge model”/); assert.deepEqual(n1.go, { persona: T, screen: 'queue' });
  const rq = api.getRequests(t.id)[0];
  const n2 = sent(S, () => api.endorse(rq.id, t.id, 'Good'));
  assert.equal(n2.text, 'Mr Ben Okoro endorsed “Bridge model”'); assert.equal(n2.go.persona, S);
  const p = sent(S, () => api.sendPrompt(s.id, e.id, 'What did you learn?', t.id));
  assert.match(p.text, /Mr Ben Okoro sent you a reflection prompt/);
  const pm = api.getPrompts(s.id).at(-1);
  sent(T, () => api.addReflection({ studentId: s.id, eventId: e.id, text: 'Lots', signal: { key: `prompt:${pm.id}`, promptId: pm.id } }));
  // Asked for more, then resubmitted.
  const e2 = api.addStation(s.id, { title: 'Kite', lineIds: ['science'], requestFrom: t.id });
  const rq2 = api.getRequests(t.id).find((r) => r.eventId === e2.id);
  sent(S, () => api.declineRequest(rq2.id, 'More please'));
  assert.match(sent(T, () => api.resubmit(rq2.id, null, 'Added')).text, /resubmitted/);
});

test('goals, sponsors, check-ins and lines', () => {
  const g = sent(T, () => api.addGoal(s.id, { title: 'Solar car', date: '2027-03-01', lineId: 'science', sponsor: t.id })).text;
  assert.match(g, /invited you to sponsor/);
  const ev = api.getStore().events.find((x) => x.title === 'Solar car');
  assert.match(sent(S, () => api.answerSponsor(ev.id, true, 'Weekly')).text, /Mr Ben Okoro will sponsor/);
  sent(T, () => api.addCheckIn(ev.id, 'Wheels done', 'student'));
  assert.match(sent(S, () => api.addCheckIn(ev.id, 'Nice', t.id)).text, /Mr Ben Okoro checked in/);
  assert.match(sent(T, () => api.addGoal(s.id, { title: 'Read more', date: '2027-01-01', lineId: 'science', checkIn: '2026-12-01' })).text, /asked for a check-in/);
  assert.match(sent(S, () => api.addGoal(s.id, { title: 'Agreed', date: '2027-01-01', lineId: 'science' }, t.id)).text, /^Mr Ben Okoro added a goal/);
  sent(T, () => api.endLine(s.id, 'science'));
  sent('role:coordinator', () => api.addBranch(s.id, 'science', 'Rocketry', { title: 'Water rocket' }));
  const line = api.getAllLines().find((l) => l.studentId === s.id && l.name === 'Rocketry');
  assert.equal(sent(S, () => api.decideBranch(line.id, true, undefined, t.id)).text, 'Mr Okoro approved your new line “Rocketry”');
});

test('families, comments, nudges and imports', () => {
  api.getStore().consentReqs.push({ id: 'cr-pilot', studentId: s.id, kind: 'join', title: 'Join', status: 'pending' });
  assert.deepEqual(sent(F, () => api.remindParent(s.id)).go, { persona: F, screen: 'consent', param: s.id });
  const before = api.getNotifications('whitfield').length;
  sent(S, () => api.answerConsent('cr-pilot', 'approved', 'Khun Pilot'));
  assert.equal(last(T).text, 'Ada’s family answered a consent request');
  assert.equal(api.getNotifications('whitfield').length, before, 'the demo advisor does not hear about a pilot student');
  assert.match(sent(S, () => api.addComment('pr-x', s.id, 'Lead with the kite', null, t.id)).text, /^Mr Ben Okoro commented/);
  assert.match(sent(S, () => api.nudgeMilestone(s.id, { id: 'm1', part: 'EE', name: 'Draft', due: '2026-10-01' }, t.id)).text, /^Mr Okoro: your EE draft/);
  assert.equal(api.getActivity(s.id).find((a) => a.kind === 'prompt' && /Reminded/.test(a.text)).actor, 'Mr Ben Okoro');
  sent(S, () => api.importCandidates([{ studentId: s.id, title: 'Quiz', date: '2026-10-01', source: { system: 'ManageBac', ref: 'q-1' }, lineIds: ['science'] }], { sourceId: 'lms', file: 'x.csv' }));
});

test('the demo personas keep their texts', () => {
  const l = api.getAllLines().find((x) => x.id === 'st-04-robotics');
  l.studentId = 'st-01';
  assert.equal(sent('maya', () => api.decideBranch(l.id, true)).text, 'Ms Brandt approved your new line “Robotics”');
  const n = sent('maya', () => api.nudgeMilestone('st-01', { id: 'm2', part: 'EE', name: 'Draft', due: '2026-10-01' }));
  assert.match(n.text, /^Ms Brandt: your EE draft/);
  assert.equal(api.getActivity('st-01').find((a) => /Reminded Maya/.test(a.text)).actor, 'Ms Clara Brandt');
  sent('whitfield', () => api.answerConsent('cr-1', 'approved', 'Khun Nok Chaiyaporn'));
  sent('parent', () => api.remindParent('st-09'));
});

test('reading and marking a bell by keys', () => {
  assert.ok(api.getNotifications([S, T]).length === api.getNotifications(S).length + api.getNotifications(T).length);
  api.markNotificationsRead([S]);
  assert.ok(api.getNotifications(S).every((n) => n.read)); assert.ok(api.getNotifications(T).some((n) => !n.read));
  // On the server, a person may only mark their own bell.
  const stu = { id: 'u1', kind: 'student', studentId: s.id }, tea = { id: 'u2', kind: 'teacher', teacherId: t.id };
  assert.ok(canAct(stu, 'markNotificationsRead', [[S]])); assert.ok(canAct(stu, 'markNotificationsRead', [S]));
  assert.ok(!canAct(stu, 'markNotificationsRead', [[T]])); assert.ok(!canAct(stu, 'markNotificationsRead', ['maya']));
  assert.ok(canAct(tea, 'markNotificationsRead', [[T, 'role:teacher']]));
  assert.ok(canAct({ id: 'u3', kind: 'student', studentId: 'st-01' }, 'markNotificationsRead', [['maya', 'st:st-01']]));
  assert.ok(canAct({ id: 'u4', kind: 'parent', children: [s.id] }, 'markNotificationsRead', [[F]]));
});
