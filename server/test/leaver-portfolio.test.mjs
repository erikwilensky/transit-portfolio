// Leaver portfolio (api.saveLeaver, shareLeaver, revokeLeaver, commentLeaver, doneLeaverComment, leaverView): who may build
// and comment, what each person's copy holds, what a link shows (never private or hidden items), files, PDPA. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-leaver-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api, changed } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { leaverPublic } = await import('../routes/41-leaver.mjs');
const { canSeeFile } = await import('../files.mjs');

const fern = { id: 'u-fern', kind: 'student', studentId: 'S2001' }; // Year 12
const gus = { id: 'u-gus', kind: 'student', studentId: 'S2002' };
const hana = { id: 'u-hana', kind: 'student', studentId: 'S2003' }; // Year 8
const brook = { id: 'u-ada', kind: 'advisor', teacherId: 'T100' }; // Fern's advisor
const carter = { id: 'u-ben', kind: 'teacher', teacherId: 'T101' }; // teaches Fern, not her advisor
const gray = { id: 'u-finn', kind: 'advisor', teacherId: 'T105' }; // no reach
const counsellor = { id: 'u-chloe', kind: 'counsellor', teacherId: 'T102' };
const parent = { id: 'u-rose', kind: 'parent', children: ['S2001'] };
const admin = { id: 'u-admin', kind: 'admin' };
const PHOTO = `api/files/${'c'.repeat(32)}.jpg`, EVID = `api/files/${'d'.repeat(32)}.jpg`;
const TOKEN = 'Abcdefghijklmnopqrstuvwx_1', TOKEN2 = 'Zyxwvutsrqponmlkjihgfedc-2';
let ev; // { a, b, c, priv, goal }
let refl, en;

test('setup: Fern with five moments at different levels, an endorsement', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science', 'art']; }
  const add = (title, visibility, extra = {}) => api.addStation('S2001', { title, lineIds: ['science'], visibility, date: '2026-05-01', ...extra });
  ev = {
    a: add('Led the river clean-up', 'school', { evidence: [{ kind: 'image', url: EVID, caption: 'The team' }, { kind: 'link', url: 'https://example.org', caption: 'Report' }] }),
    b: add('Science fair research on microplastics', 'publishable'),
    c: add('Taught Year 7 coding club', 'advisor'),
    priv: add('My diary of a hard term', 'private'),
    goal: api.addGoal('S2001', { title: 'Run a marathon', date: '2027-03-01', lineId: 'science' }),
  };
  refl = api.addReflection({ studentId: 'S2001', eventId: ev.a.id, prompt: 'What did you learn?', text: 'I learned to plan. It was hard at first! Next time I will start sooner.', visibility: 'school' });
  api.addReflection({ studentId: 'S2001', eventId: ev.a.id, prompt: 'Private', text: 'Only for me.', visibility: 'private' });
  api.getStore().endorsements.push({ id: 'en-a', eventId: ev.a.id, teacherId: 'T100', note: 'Real leadership.', date: '2026-05-02' });
  api.getStore().endorsements.push({ id: 'en-c', eventId: ev.c.id, teacherId: 'T101', note: 'Patient with the Year 7s.', date: '2026-05-03' });
  en = 'en-a';
  changed({ fn: 'setup' });
});

test('canAct: only the student builds, shares and withdraws; the advisor and whole-school staff comment, as themselves', () => {
  for (const fn of ['saveLeaver', 'shareLeaver', 'revokeLeaver', 'doneLeaverComment']) {
    assert.ok(canAct(fern, fn, ['S2001', {}]), fn);
    for (const u of [gus, brook, carter, counsellor, parent, admin]) assert.ok(!canAct(u, fn, ['S2001', {}]), `${fn} ${u.kind}`);
  }
  assert.ok(!canAct(brook, 'commentLeaver', ['S2001', 'T100', 'Nice']), 'no portfolio yet');
  api.saveLeaver('S2001', {});
  assert.ok(canAct(brook, 'commentLeaver', ['S2001', 'T100', 'Nice']));
  assert.ok(!canAct(brook, 'commentLeaver', ['S2001', 'T101', 'Nice']), 'only as herself');
  assert.ok(!canAct(carter, 'commentLeaver', ['S2001', 'T101', 'Nice']), 'a subject teacher in reach reads but does not comment');
  assert.ok(!canAct(gray, 'commentLeaver', ['S2001', 'T105', 'Nice']), 'no reach');
  assert.ok(canAct(counsellor, 'commentLeaver', ['S2001', 'T102', 'Nice']), 'whole-school staff');
  assert.ok(!canAct(fern, 'commentLeaver', ['S2001', 'T100', 'Nice']));
  assert.ok(!canAct(parent, 'commentLeaver', ['S2001', 'T100', 'Nice']));
});

test('Years: Year 11 to 13 only; under Year 11 is refused', () => {
  assert.equal(api.leaverAllowed('S2001'), true);
  assert.equal(api.leaverAllowed('S2003'), false);
  assert.throws(() => api.saveLeaver('S2003', {}), /Years 11 to 13/);
  api.getStudent('S2002').grade = 10;
  assert.equal(api.leaverAllowed('S2002'), true); assert.equal(api.leaverPractice('S2002'), true);
  api.getStudent('S2002').grade = 11;
});

test('saveLeaver: up to 8 moments, never private ones, goals or private reflections; replays the same', () => {
  const choices = api.leaverChoices('S2001');
  assert.deepEqual(choices.moments.map((e) => e.id).sort(), [ev.a.id, ev.b.id, ev.c.id].sort(), 'private moments and goals are not offered');
  assert.equal(choices.blocked, 1);
  assert.deepEqual(choices.endorsements.map((n) => n.id), ['en-a'], 'only endorsements on school-visible or publishable moments');
  assert.throws(() => api.saveLeaver('S2001', { moments: [{ eventId: ev.priv.id }] }), /Private moments/);
  assert.throws(() => api.saveLeaver('S2001', { moments: [{ eventId: ev.goal.id }] }), /cannot go/);
  const privR = api.getStore().reflections.find((r) => r.eventId === ev.a.id && r.visibility === 'private');
  assert.throws(() => api.saveLeaver('S2001', { moments: [{ eventId: ev.a.id, reflectionId: privR.id }] }), /Private reflections/);
  assert.throws(() => api.saveLeaver('S2001', { endorsements: ['en-c'] }), /school can see/);
  assert.throws(() => api.saveLeaver('S2001', { moments: Array.from({ length: 9 }, (_, i) => ({ eventId: api.addStation('S2001', { title: `M${i}`, lineIds: ['art'], visibility: 'school' }).id })) }), /up to 8/);
  assert.throws(() => api.saveLeaver('S2001', { profile: { email: 'nope' } }), /email/);
  assert.throws(() => api.saveLeaver('S2001', { profile: { photo: 'https://evil.example/x.jpg' } }), /photo/);
  assert.throws(() => api.saveLeaver('S2001', { template: 'neon' }), /template/);

  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  api.saveLeaver('S2001', {
    profile: { name: 'Fern Gale', statement: 'I like rivers and data.', email: 'fern@example.org', photo: PHOTO },
    moments: [{ eventId: ev.b.id }, { eventId: ev.a.id, evidence: [0, 7], reflectionId: refl.id, sentences: [0, 2] }, { eventId: ev.c.id }],
    endorsements: [en], template: 'two-column', skillsOff: ['Balanced', 'Nonsense'],
  });
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'the server replays it to the same record');
  const p = api.getLeaver('S2001');
  assert.deepEqual(p.moments[1], { eventId: ev.a.id, evidence: [0], reflectionId: refl.id, sentences: [0, 2] });
  assert.deepEqual(p.skillsOff, ['Balanced']);
});

test('leaverView: only what was picked, the chosen sentences, skills from the moments, endorsements with the teacher', () => {
  const v = api.leaverView('S2001');
  assert.deepEqual(v.moments.map((m) => m.title), ['Science fair research on microplastics', 'Led the river clean-up', 'Taught Year 7 coding club']);
  assert.equal(v.moments[1].reflection.text, 'I learned to plan. Next time I will start sooner.');
  assert.deepEqual(v.moments[1].evidence, [{ kind: 'image', url: EVID, caption: 'The team' }]);
  assert.equal(v.template, 'two-column'); assert.equal(v.year, 12);
  assert.ok(v.skills.lp.length + v.skills.atl.length > 0);
  assert.ok(!v.skills.lp.some((x) => x.k === 'Balanced'));
  assert.deepEqual(v.endorsements.map((n) => [n.teacher, n.note, n.moment]), [['Ms Ada Brook', 'Real leadership.', 'Led the river clean-up']]);
  assert.ok(!JSON.stringify(v).includes('diary'), 'nothing private');
});

test('share links: a token from the browser, a fixed set of lengths; the public answer; withdrawn: 404; expired: 410', () => {
  assert.throws(() => api.shareLeaver('S2001', { token: 'short', days: 90 }), /could not be made/);
  assert.throws(() => api.shareLeaver('S2001', { token: TOKEN, days: 1000 }), /how long/);
  const l = api.shareLeaver('S2001', { token: TOKEN, days: 90, label: 'UCL admissions' });
  assert.equal(l.expiresAt, api.daysBefore(-90));
  assert.throws(() => api.shareLeaver('S2001', { token: TOKEN, days: 90 }), /could not be made/);
  changed({ fn: 'shareLeaver' });
  const pub = leaverPublic(TOKEN);
  assert.deepEqual(pub.portfolio.moments.map((m) => m.title), ['Science fair research on microplastics', 'Led the river clean-up', 'Taught Year 7 coding club']);
  assert.ok(!JSON.stringify(pub).includes('S2001'), 'no record ids');
  assert.ok(!JSON.stringify(pub).includes('comments'));
  assert.throws(() => leaverPublic('Nonexistent_token_123456'), (e) => e.status === 404);
  api.shareLeaver('S2001', { token: TOKEN2, days: 30 });
  api.getLeaver('S2001').links.find((x) => x.token === TOKEN2).expiresAt = '2020-01-01';
  assert.throws(() => leaverPublic(TOKEN2), (e) => e.status === 410);
});

test('a moment made private or hidden by a moderator later drops out of every view by itself', () => {
  api.setVisibility(ev.c.id, 'private');
  api.getEvent(ev.b.id).hidden = { at: 'x', by: 'Ms Fong' };
  changed({ fn: 'x' });
  assert.deepEqual(leaverPublic(TOKEN).portfolio.moments.map((m) => m.title), ['Led the river clean-up']);
  api.setVisibility(ev.c.id, 'advisor'); delete api.getEvent(ev.b.id).hidden;
  changed({ fn: 'x' });
  assert.equal(leaverPublic(TOKEN).portfolio.moments.length, 3);
});

test('files: the photo and chosen evidence open signed out while the link is open; not after it is withdrawn', () => {
  assert.equal(canSeeFile(null, PHOTO.split('/').pop()), true);
  assert.equal(canSeeFile(null, EVID.split('/').pop()), true);
});

test('comments: the advisor comments, the student is told and ticks it done', () => {
  const c = api.commentLeaver('S2001', 'T100', 'Put the river clean-up first.');
  assert.ok(api.getStore().notifications.some((n) => n.to === 'st:S2001' && /comment on your leaver portfolio/.test(n.text)));
  assert.throws(() => api.commentLeaver('S2001', 'T100', ' '), /Write/);
  api.doneLeaverComment('S2001', c.id);
  assert.ok(api.getLeaver('S2001').comments[0].done);
  changed({ fn: 'commentLeaver' });
});

test('scope: the student whole; staff in reach without tokens; families, other students and staff with no reach nothing', () => {
  const of = (u) => scopedSnapshot(u).store.leaver;
  assert.equal(of(fern).S2001.links[0].token, TOKEN);
  for (const u of [brook, carter, counsellor]) {
    const p = of(u).S2001;
    assert.ok(p && p.moments.length === 3 && p.comments.length === 1, u.kind);
    assert.ok(p.links.length === 2 && p.links.every((l) => !l.token), `${u.kind}: no tokens`);
  }
  for (const u of [gus, hana, gray, parent]) assert.deepEqual(of(u), {}, u.kind);
});

test('withdrawing a link: 404 for the reader, files close', () => {
  api.revokeLeaver('S2001', TOKEN);
  changed({ fn: 'revokeLeaver' });
  assert.throws(() => leaverPublic(TOKEN), (e) => e.status === 404);
  assert.equal(canSeeFile(null, PHOTO.split('/').pop()), false);
  assert.ok(api.getActivity('S2001').some((a) => /Withdrew a leaver portfolio link for UCL admissions/.test(a.text)));
});

test('PDPA: the copy includes the portfolio; erasure removes it', () => {
  const copy = api.studentData('S2001');
  assert.ok(copy.own.leaver?.S2001?.moments.length === 3);
  api.eraseStudent('S2001');
  assert.equal(api.getLeaver('S2001'), null);
});
