// Family encouragement (api.addFamilyNote, editFamilyNote, deleteFamilyNote, thankFamilyNote, setFamilyNoteHidden; reportItem
// on a note): which moments, who may do each, who downloads them, the student's switch, reports, replay, PDPA.
// Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-famnotes-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, touchedBy } = await import('../scope.mjs');

// Fern (Year 12): her family sees what she shares with the school. Hana (Year 8): her family sees the advisor level.
const fern = { kind: 'student', studentId: 'S2001' }, gus = { kind: 'student', studentId: 'S2002' }, hana = { kind: 'student', studentId: 'S2003' };
const mum = { kind: 'parent', id: 'acc-mum', name: 'Mia Gale', children: ['S2001'] };
const dad = { kind: 'parent', id: 'acc-dad', name: 'Tom Gale', children: ['S2001'] };
const gusMum = { kind: 'parent', id: 'acc-gm', name: 'Lin Hale', children: ['S2002'] };
const hanaMum = { kind: 'parent', id: 'acc-hm', name: 'Aya Ito', children: ['S2003'] };
const brook = { kind: 'teacher', teacherId: 'T100' }; // Fern's advisor
const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches Fern CS
const gray = { kind: 'advisor', teacherId: 'T105' };   // nothing to do with Fern
const coord = { kind: 'coordinator', teacherId: 'T104' };
const admin = { kind: 'admin', id: 'acc-admin', name: 'Pat Admin' };
const as = (u) => ({ key: `u:${u.id}`, name: u.name });
let ev, evAdv, evPriv, evHana, n1;

test('setup: class lists and a few moments', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science']; }
  ev = api.addStation('S2001', { title: 'Osmosis practical', lineIds: ['science'], visibility: 'school' });
  evAdv = api.addStation('S2001', { title: 'College essay draft', lineIds: ['science'], visibility: 'advisor' });
  evPriv = api.addStation('S2001', { title: 'Diary', lineIds: ['science'], visibility: 'private' });
  evHana = api.addStation('S2003', { title: 'Robot arm', lineIds: ['science'], visibility: 'advisor' });
  assert.deepEqual([ev, evAdv, evPriv, evHana].map(api.familyShows), [true, false, false, true]);
});

test('writing: a family member as themselves, on a moment the family view shows', () => {
  assert.ok(canAct(mum, 'addFamilyNote', [ev.id, as(mum), 'So proud of you!', 'proud']));
  assert.ok(canAct(hanaMum, 'addFamilyNote', [evHana.id, as(hanaMum), '', 'welldone']), 'Year 8: the advisor level');
  assert.ok(!canAct(mum, 'addFamilyNote', [ev.id, as(dad), 'x', null]), 'not as someone else');
  assert.ok(!canAct(mum, 'addFamilyNote', [ev.id, { key: 'u:acc-mum', name: 'Someone' }, 'x', null]), 'with her own name');
  assert.ok(!canAct(mum, 'addFamilyNote', [evAdv.id, as(mum), 'x', null]), 'not shared with the family (Year 12, advisor only)');
  assert.ok(!canAct(mum, 'addFamilyNote', [evPriv.id, as(mum), 'x', null]), 'never private');
  assert.ok(!canAct(gusMum, 'addFamilyNote', [ev.id, as(gusMum), 'x', null]), 'not another family’s child');
  for (const u of [fern, gus, brook, carter, coord, admin]) assert.ok(!canAct(u, 'addFamilyNote', [ev.id, { key: `u:${u.id || 'x'}`, name: u.name || 'x' }, 'x', null]), u.kind);
  assert.throws(() => api.addFamilyNote(evAdv.id, as(mum), 'x'), (e) => e.status === 403);
  assert.throws(() => api.addFamilyNote(ev.id, as(mum), '', null), /a few words or pick a reaction/);
  assert.throws(() => api.addFamilyNote(ev.id, as(mum), 'x'.repeat(281)), /280 characters/);
  assert.throws(() => api.addFamilyNote(ev.id, as(mum), 'hi', 'hearts'), /reactions/);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, a, rec) => { step = { fn, args: a, rec }; });
  n1 = api.addFamilyNote(ev.id, as(mum), '  So proud   of you! ', 'proud');
  api.setActionHook(null);
  assert.deepEqual([n1.studentId, n1.by, n1.name, n1.text, n1.reaction], ['S2001', 'u:acc-mum', 'Mia Gale', 'So proud of you!', 'proud']);
  const note = api.getStore().notifications[0];
  assert.deepEqual([note.to, note.kind, note.go.screen, note.go.param], ['st:S2001', 'encourage', 'map', ev.id]);
  assert.equal(note.text, 'Mia Gale sent you encouragement for “Osmosis practical”: So proud of you!');
  assert.equal(api.getActivity('S2001')[0].text, 'Left a note on “Osmosis practical”');
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'replays the same');
  assert.throws(() => api.addFamilyNote(ev.id, as(mum), 'again'), (e) => e.status === 409, 'one note each per moment');
  assert.deepEqual(touchedBy('addFamilyNote', [ev.id]).students, ['S2001']);
});

test('the family’s own copy can run it first', () => {
  const before = api.snapshot();
  api.restore(JSON.stringify(scopedSnapshot(dad)));
  let step = null; api.setActionHook((fn, a, rec) => { step = { fn, args: a, rec }; });
  const n = api.addFamilyNote(ev.id, as(dad), 'Tell me at dinner', 'dinner');
  api.setActionHook(null);
  api.restore(before);
  assert.equal(api.runAction(step.fn, step.args, step.rec).id, n.id);
  api.restore(before);
});

test('changing and deleting: only the writer', () => {
  assert.ok(canAct(mum, 'editFamilyNote', [n1.id, 'u:acc-mum', 'Proud!', null]));
  for (const u of [dad, fern, brook, coord, admin]) assert.ok(!canAct(u, 'editFamilyNote', [n1.id, `u:${u.id}`, 'x', null]), u.kind);
  assert.ok(!canAct(dad, 'editFamilyNote', [n1.id, 'u:acc-mum', 'x', null]), 'not as the other parent');
  assert.throws(() => api.editFamilyNote(n1.id, 'u:acc-dad', 'x'), (e) => e.status === 403);
  api.editFamilyNote(n1.id, 'u:acc-mum', 'Proud of how you kept going.', 'proud');
  assert.ok(api.getFamilyNote(n1.id).edited);
  const n2 = api.addFamilyNote(ev.id, as(dad), 'Well played', null);
  assert.ok(canAct(dad, 'deleteFamilyNote', [n2.id, 'u:acc-dad']) && !canAct(mum, 'deleteFamilyNote', [n2.id, 'u:acc-dad']));
  api.deleteFamilyNote(n2.id, 'u:acc-dad');
  assert.ok(!api.getFamilyNote(n2.id));
});

test('thanking and hiding from her own view: the student only', () => {
  for (const u of [mum, gus, brook, coord, admin]) { assert.ok(!canAct(u, 'thankFamilyNote', [n1.id]), u.kind); assert.ok(!canAct(u, 'setFamilyNoteHidden', [n1.id, true]), u.kind); }
  assert.ok(canAct(fern, 'thankFamilyNote', [n1.id]));
  api.thankFamilyNote(n1.id);
  const note = api.getStore().notifications[0];
  assert.deepEqual([note.to, note.text], ['fam:S2001', 'Fern said thank you for your note on “Osmosis practical”.']);
  api.setFamilyNoteHidden(n1.id, true);
  assert.ok(scopedSnapshot(fern).store.familyNotes.find((n) => n.id === n1.id).studentHidden, 'she keeps it, marked hidden');
  assert.ok(!('studentHidden' in scopedSnapshot(mum).store.familyNotes.find((n) => n.id === n1.id)), 'her family is not told');
  api.setFamilyNoteHidden(n1.id, false);
});

test('scope: the student, her family, advisor, current teachers and whole school; nobody else', () => {
  const ids = (u) => scopedSnapshot(u).store.familyNotes.map((n) => n.id);
  for (const u of [fern, mum, dad, brook, carter, coord, admin]) assert.deepEqual(ids(u), [n1.id], u.kind);
  for (const u of [gus, hana, gusMum, hanaMum, gray]) assert.deepEqual(ids(u), [], u.kind);
  assert.ok(!('by' in scopedSnapshot(fern).store.familyNotes[0]), 'the student does not get the account id');
  api.setVisibility(ev.id, 'advisor');
  assert.deepEqual(ids(mum), [], 'the moment left the family view: so do its notes');
  assert.deepEqual(ids(brook), [n1.id]);
  api.setVisibility(ev.id, 'school');
});

test('the student turns notes from family off (Privacy), and on', () => {
  assert.ok(canAct(fern, 'setPrivacy', ['S2001', { familyNotes: false }]));
  api.setPrivacy('S2001', { familyNotes: false });
  assert.ok(!canAct(dad, 'addFamilyNote', [ev.id, as(dad), 'x', null]));
  assert.throws(() => api.addFamilyNote(ev.id, as(dad), 'x'), (e) => e.status === 409);
  assert.deepEqual(scopedSnapshot(mum).store.privacy, { S2001: { familyNotes: false } }, 'the family gets only the switch');
  api.setPrivacy('S2001', { familyNotes: true });
  assert.deepEqual(scopedSnapshot(mum).store.privacy, {});
  assert.ok(canAct(dad, 'addFamilyNote', [ev.id, as(dad), 'x', null]));
});

test('reporting a note and a moderator hiding it', () => {
  const t = { familyNoteId: n1.id };
  assert.ok(canAct(fern, 'reportItem', [t, 'unkind', '', { key: 'student' }]));
  assert.ok(canAct(carter, 'reportItem', [t, 'unkind', '', { key: 'T101' }]));
  assert.ok(canAct(admin, 'reportItem', [t, 'unkind', '', { key: 'admin', name: 'Pat Admin' }]));
  assert.ok(!canAct(gray, 'reportItem', [t, 'unkind', '', { key: 'T105' }]), 'not someone who reads it');
  assert.ok(!canAct(carter, 'reportItem', [t, 'unkind', '', { key: 'T100' }]), 'as himself only');
  assert.ok(!canAct(dad, 'reportItem', [t, 'unkind', '', { key: 'fam:S2001', name: 'Tom Gale' }]));
  assert.throws(() => api.reportItem(t, 'unkind', '', { key: 'fam:S2001', name: 'Tom Gale' }), /Speak to the school/);
  const r = api.reportItem(t, 'personal', 'Has our address', { key: 'student' });
  assert.deepEqual([r.kind, r.familyNoteId, r.studentId], ['familyNote', n1.id, 'S2001']);
  assert.match(api.getStore().notifications.find((x) => x.to === 'role:coordinator').text, /^New report: a family note on “Osmosis practical”/);
  assert.equal(scopedSnapshot(fern).store.reports.find((x) => x.id === r.id).familyNoteId, n1.id);
  assert.ok(!canAct(brook, 'moderateReport', [r.id, 'hide', '', 'T100']));
  assert.ok(canAct(coord, 'moderateReport', [r.id, 'hide', '', 'T104']));
  assert.throws(() => api.moderateReport(r.id, 'photo', '', 'T104'), /no photo/);
  api.moderateReport(r.id, 'hide', 'Checked', 'T104');
  assert.equal(api.getReport(r.id).status, 'hidden');
  assert.match(api.getStore().notifications[0].text, /^A teacher has hidden a note from your family on “Osmosis practical”\.$/);
  const ids = (u) => scopedSnapshot(u).store.familyNotes.map((n) => n.id);
  assert.deepEqual(ids(fern), [], 'gone from the student');
  assert.deepEqual(ids(dad), [], 'and from the other parent');
  assert.ok(scopedSnapshot(mum).store.familyNotes.find((n) => n.id === n1.id)?.hidden, 'its writer keeps it, with the notice');
  assert.ok(scopedSnapshot(brook).store.familyNotes[0].hidden, 'staff see it hidden');
  assert.ok(!canAct(fern, 'thankFamilyNote', [n1.id]));
  api.moderateReport(r.id, 'unhide', '', 'T104');
  assert.deepEqual(ids(fern), [n1.id]);
});

test('PDPA: the copy has the notes on her moments; erasure removes them', () => {
  const own = api.studentData('S2001').own.familyNotes;
  assert.ok(own.length >= 1 && own.every((n) => n.studentId === 'S2001'));
  assert.equal(api.studentData('S2002').own.familyNotes, undefined);
  api.eraseStudent('S2001');
  assert.deepEqual(api.familyNotesOf('S2001'), []);
});
