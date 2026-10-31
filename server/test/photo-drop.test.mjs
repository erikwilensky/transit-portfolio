// Class photo drop (api.dropPhotos; acceptSpotted with photos; reportItem on { photoId }; server/routes/71-photo-drop.mjs):
// permissions, scope, who may open each photo, keeping and declining, reports, erasure, deleting unsent photos, the upload
// route's limits. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-photo-drop-'));
process.env.DATA_DIR = DATA; process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api, changed } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot, touchedBy } = await import('../scope.mjs');
const { canSeeFile } = await import('../files.mjs');
const { afterChange, sweep, keptSince } = await import('../routes/71-photo-drop.mjs');

const fern = { id: 'u-fern', kind: 'student', studentId: 'S2001' };
const gus = { id: 'u-gus', kind: 'student', studentId: 'S2002' };
const hal = { id: 'u-hal', kind: 'student', studentId: 'S2003' }; // not in Biology
const brook = { id: 'u-ada', kind: 'advisor', teacherId: 'T100' }; // teaches 12 Biology (S2001, S2002)
const carter = { id: 'u-ben', kind: 'teacher', teacherId: 'T101' }; // teaches S2001 (CS), not S2002
const gray = { id: 'u-finn', kind: 'advisor', teacherId: 'T105' }; // no reach
const coord = { id: 'u-eve', kind: 'coordinator', teacherId: 'T104' };
const parent = { id: 'u-rose', kind: 'parent', children: ['S2001'] };
const admin = { id: 'u-admin', kind: 'admin' };
const UP = path.join(DATA, 'uploads');
const F = (c) => `${c.repeat(32)}.jpg`;
const url = (f) => `api/files/${f}`;
const put = (f, meta) => { fs.mkdirSync(UP, { recursive: true }); fs.writeFileSync(path.join(UP, f), 'jpg'); fs.writeFileSync(path.join(UP, `${f}.json`), JSON.stringify({ name: 'x.jpg', type: 'image/jpeg', at: new Date().toISOString(), ...meta })); };
const exists = (f) => fs.existsSync(path.join(UP, f));
const who = (f) => Object.entries({ fern, gus, hal, brook, carter, gray, coord, parent, admin }).filter(([, u]) => canSeeFile(u, f, {})).map(([k]) => k);
const DRAFT = 'abc123-draft';
const spec = { title: 'Electricity practical', date: '', lineId: 'science', note: 'Great wiring.', draft: DRAFT,
  photos: [{ url: url(F('a')), name: 'a.jpg', studentIds: ['S2001'] }, { url: url(F('b')), name: 'b.jpg', studentIds: ['S2001', 'S2002'] }, { url: url(F('c')), name: 'c.jpg', studentIds: ['S2002'] }, { url: url(F('d')), name: 'd.jpg', studentIds: [] }] };
let drop;
const offer = (sid) => api.getStore().spotted.find((x) => x.dropId === drop.id && x.studentId === sid);

test('setup', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
  for (const c of 'abcd') put(F(c), { by: 'u-ada', purpose: 'photo-drop', draft: DRAFT });
  put(F('e'), { by: 'u-ada', purpose: 'photo-drop', draft: 'other-draft' });
  changed({ fn: 'setup' });
});

test('canAct: a teacher of the class, as themselves; never students, families, other teachers', () => {
  assert.ok(canAct(brook, 'dropPhotos', ['C-BIO12', 'T100', spec]));
  assert.ok(!canAct(brook, 'dropPhotos', ['C-BIO12', 'T101', spec]), 'only as herself');
  assert.ok(!canAct(carter, 'dropPhotos', ['C-BIO12', 'T101', spec]), 'not his class');
  assert.ok(!canAct(coord, 'dropPhotos', ['C-BIO12', 'T104', spec]), 'whole-school staff only for a class they teach');
  assert.ok(!canAct(admin, 'dropPhotos', ['C-BIO12', 'T100', spec]));
  assert.ok(!canAct(fern, 'dropPhotos', ['C-BIO12', 'T100', spec]));
  assert.ok(!canAct(parent, 'dropPhotos', ['C-BIO12', 'T100', spec]));
  assert.deepEqual(touchedBy('dropPhotos', ['C-BIO12', 'T100', spec]), { students: ['S2001', 'S2002'], as: ['T100'] });
});

test('dropPhotos: one offer per student with only their photos, notified, deterministic on replay', () => {
  assert.throws(() => api.dropPhotos('C-BIO12', 'T100', { ...spec, photos: [{ url: url(F('a')), studentIds: ['S2003'] }] }), /Only students in this class/);
  assert.throws(() => api.dropPhotos('C-BIO12', 'T100', { ...spec, photos: [{ url: 'api/files/x.pdf', studentIds: ['S2001'] }] }), /Only photos/);
  assert.throws(() => api.dropPhotos('C-BIO12', 'T100', { ...spec, photos: [spec.photos[3]] }), /at least one photo/);
  assert.throws(() => api.dropPhotos('C-BIO12', 'T101', spec), /not one of yours/);
  assert.throws(() => api.dropPhotos('C-BIO12', 'T100', { ...spec, photos: Array.from({ length: 41 }, () => spec.photos[0]) }), /At most 40/);
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  drop = api.dropPhotos('C-BIO12', 'T100', spec);
  api.setActionHook(null);
  assert.equal(drop.photos.length, 3, 'the photo given to nobody is not kept');
  assert.equal(drop.date, api.TODAY);
  assert.deepEqual(offer('S2001').photos.map((p) => p.url), [url(F('a')), url(F('b'))]);
  assert.deepEqual(offer('S2002').photos.map((p) => p.url), [url(F('b')), url(F('c'))]);
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(nt.map((n) => [n.to, n.text, n.kind]).sort(), [['st:S2001', 'Ms Brook added photos from “Electricity practical”', 'spotted'], ['st:S2002', 'Ms Brook added photos from “Electricity practical”', 'spotted']]);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  drop = api.getPhotoDrop(drop.id);
  const t = api.dropPhotos('C-BIO12', 'T100', { lineId: 'science', photos: [{ url: url(F('a')), studentIds: ['S2001'] }] });
  assert.equal(t.title, 'Photos from Biology', 'no title: the subject');
  api.getStore().photoDrops.pop(); api.getStore().spotted.pop();
  const day = api.dropPhotos('C-BIO12', 'T100', { lineId: 'science', date: '2099-01-01', photos: [{ url: url(F('a')), studentIds: ['S2001'] }] });
  assert.equal(day.date, api.TODAY, 'a date in the future becomes today');
  api.getStore().photoDrops.pop(); api.getStore().spotted.pop();
  changed({ fn: 'dropPhotos', args: ['C-BIO12', 'T100', spec], by: 'u-ada' });
});

test('sending deleted the draft’s photo nobody was given, and nothing else', () => {
  afterChange({ fn: 'dropPhotos', args: ['C-BIO12', 'T100', spec], by: 'u-ada' });
  assert.ok(!exists(F('d')), 'unassigned: deleted');
  assert.ok(exists(F('a')) && exists(F('b')) && exists(F('c')), 'given ones stay');
  assert.ok(exists(F('e')), 'another draft is untouched');
});

test('scope: the batch only to its teacher; each student their own offer; nobody else', () => {
  const drops = (u) => scopedSnapshot(u).store.photoDrops.map((d) => d.id);
  assert.deepEqual(drops(brook), [drop.id]);
  for (const u of [fern, gus, carter, coord, parent, admin]) assert.deepEqual(drops(u), []);
  const offers = (u) => scopedSnapshot(u).store.spotted.filter((x) => x.dropId).map((x) => x.studentId).sort();
  assert.deepEqual(offers(fern), ['S2001']);
  assert.deepEqual(offers(gus), ['S2002']);
  assert.deepEqual(offers(hal), []);
  assert.deepEqual(offers(brook), ['S2001', 'S2002']);
  assert.deepEqual(offers(coord), []);
});

test('who may open each photo: the students given it, the uploader, staff who reach them', () => {
  assert.deepEqual(who(F('a')), ['fern', 'brook', 'carter', 'coord', 'admin']);
  assert.deepEqual(who(F('b')), ['fern', 'gus', 'brook', 'carter', 'coord', 'admin']);
  assert.deepEqual(who(F('c')), ['gus', 'brook', 'coord', 'admin'], 'Carter does not reach Gus; Fern was not given it');
  assert.ok(canSeeFile(gus, F('a'), { by: 'u-ada' }) === false, 'a classmate cannot open Fern’s photo');
  assert.ok(canSeeFile({ id: 'u-ada', kind: 'advisor', teacherId: 'T100' }, F('e'), { by: 'u-ada' }), 'an unsent photo: its uploader');
  assert.ok(!canSeeFile(fern, F('e'), { by: 'u-ada' }));
});

test('keeping: the chosen photos become an endorsed moment in the student’s words', () => {
  const x = offer('S2001'), [pa, pb] = x.photos;
  assert.ok(canAct(fern, 'acceptSpotted', [x.id, 'S2001', { photos: [pa.id], text: 'I wired it.' }]));
  assert.ok(!canAct(gus, 'acceptSpotted', [x.id, 'S2001', { photos: [pa.id] }]));
  assert.ok(!canAct(brook, 'acceptSpotted', [x.id, 'S2001', { photos: [pa.id] }]));
  assert.throws(() => api.acceptSpotted(x.id, 'S2001', { photos: [] }), /at least one photo/);
  assert.throws(() => api.acceptSpotted(x.id, 'S2001', { photos: [offer('S2002').photos[1].id] }), /at least one photo/, 'not a photo of theirs');
  const n0 = api.getStore().notifications.length;
  const e = api.acceptSpotted(x.id, 'S2001', { photos: [pa.id], text: 'I wired the circuit and the bulb lit.' });
  assert.deepEqual(e.evidence.map((v) => v.url), [pa.url]);
  assert.equal(e.summary, 'I wired the circuit and the bulb lit.');
  assert.equal(e.verification, 'teacher-endorsed');
  assert.equal(e.visibility, 'school');
  assert.equal(e.lineIds[0], 'science');
  assert.equal(e.spotted.dropId, drop.id);
  assert.ok(api.getStore().endorsements.some((n) => n.eventId === e.id && n.teacherId === 'T100'));
  assert.equal(api.getStore().notifications[0].text, 'Fern kept 1 photo from “Electricity practical”');
  assert.equal(api.getStore().notifications.length, n0 + 1);
  assert.deepEqual(offer('S2001').kept, [pa.id]);
  changed({ fn: 'acceptSpotted' });
  // Fern's copy keeps only the photo she kept; the one she did not keep no longer opens for her (Gus still has it).
  const mine = scopedSnapshot(fern).store.spotted.find((y) => y.id === x.id);
  assert.deepEqual(mine.photos.map((p) => p.id), [pa.id]);
  assert.ok(canSeeFile(fern, F('a'), {}));
  assert.ok(!canSeeFile(fern, F('b'), {}));
  assert.ok(canSeeFile(gus, F('b'), {}));
  assert.throws(() => api.acceptSpotted(x.id, 'S2001', { photos: [pa.id] }), /already answered/);
});

test('reporting a photo: a student who holds it, staff in reach; moderators remove it everywhere', () => {
  const pc = offer('S2002').photos.find((p) => p.url === url(F('c')));
  assert.ok(canAct(gus, 'reportItem', [{ photoId: pc.id, studentId: 'S2002' }, 'personal', '', { key: 'student' }]));
  assert.ok(!canAct(fern, 'reportItem', [{ photoId: pc.id, studentId: 'S2002' }, 'personal', '', { key: 'student' }]), 'not given to Fern');
  assert.ok(!canAct(fern, 'reportItem', [{ photoId: pc.id, studentId: 'S2001' }, 'personal', '', { key: 'student' }]));
  assert.ok(canAct(brook, 'reportItem', [{ photoId: pc.id }, 'personal', '', { key: 'T100' }]));
  assert.ok(!canAct(carter, 'reportItem', [{ photoId: pc.id }, 'personal', '', { key: 'T101' }]), 'Carter does not reach Gus');
  assert.ok(!canAct({ kind: 'parent', children: ['S2002'] }, 'reportItem', [{ photoId: pc.id, studentId: 'S2002' }, 'personal', '', { key: 'fam:S2002', name: 'Ann' }]));
  const r = api.reportItem({ photoId: pc.id, studentId: 'S2002' }, 'personal', 'My friend is in it', { key: 'student' });
  assert.equal(r.kind, 'photo'); assert.equal(r.url, pc.url); assert.equal(r.title, 'Electricity practical');
  assert.equal(api.reportItem({ photoId: pc.id, studentId: 'S2002' }, 'personal', '', { key: 'student' }).id, r.id, 'one open report per person');
  assert.match(api.getStore().notifications[0].text, /^New report: a photo from “Electricity practical” \(Gus/);
  changed({ fn: 'reportItem' });
  const gusReports = scopedSnapshot(gus).store.reports;
  assert.equal(gusReports.length, 1); assert.equal(gusReports[0].photoId, pc.id); assert.ok(!('note' in gusReports[0]) && !('url' in gusReports[0]));
  assert.ok(canSeeFile({ id: 'u-dan', kind: 'counsellor', teacherId: 'T102' }, F('c'), {}), 'moderators can open the reported photo');
  assert.ok(canAct(coord, 'moderateReport', [r.id, 'photo', '', 'T104']));
  assert.throws(() => api.moderateReport(r.id, 'hide', '', 'T104'), /remove it/);
  api.moderateReport(r.id, 'photo', 'Removed', 'T104');
  assert.equal(api.getPhotoDrop(drop.id).photos.find((p) => p.id === pc.id).url, null);
  assert.deepEqual(offer('S2002').photos.map((p) => p.url), [url(F('b'))]);
  assert.equal(api.getReport(r.id).status, 'photo-removed');
  assert.equal(api.getReport(r.id).url, null);
  assert.equal(api.getStore().notifications[0].text, 'A teacher has removed a photo from “Electricity practical”.');
  assert.equal(api.getStore().notifications[0].kind, 'safeguarding');
  changed({ fn: 'moderateReport' });
  afterChange({ fn: 'moderateReport', args: [r.id, 'photo'] });
  assert.ok(!exists(F('c')), 'the file is deleted once nothing uses it');
  assert.deepEqual(who(F('c')), []);
});

test('"Not for me": the teacher sees who said no, and the student no longer opens the photos', () => {
  const x = offer('S2002');
  api.declineSpotted(x.id, 'S2002');
  changed({ fn: 'declineSpotted' });
  const t = scopedSnapshot(brook).store.spotted.find((y) => y.id === x.id);
  assert.equal(t.status, 'declined', 'not "closed" for class photos');
  const rows = api.photoDropsBy('T100', 'C-BIO12')[0];
  assert.deepEqual(rows.rows.map((r) => [r.student.id, r.shown, r.kept]), [['S2001', 'added', 1], ['S2002', 'not for me', 0]]);
  assert.deepEqual(rows.counts, { added: 1, waiting: 0, no: 1, expired: 0 });
  assert.deepEqual(scopedSnapshot(gus).store.spotted.find((y) => y.id === x.id).photos, []);
  assert.ok(!canSeeFile(gus, F('b'), {}));
  assert.ok(canSeeFile(brook, F('b'), {}), 'the teacher still can');
});

test('the 7-day sweep deletes unsent photos only', () => {
  const old = new Date(Date.now() - 8 * 864e5).toISOString();
  put(F('f'), { by: 'u-ada', purpose: 'photo-drop', draft: 'old-draft', at: old });
  put(F('9'), { by: 'u-fern', at: old }); // an ordinary upload
  const gone = sweep();
  assert.deepEqual(gone, [F('f')]);
  assert.ok(exists(F('e')), 'a recent draft stays');
  assert.ok(exists(F('9')), 'not a drop photo');
  assert.ok(exists(F('a')), 'a sent one stays');
  assert.deepEqual(sweep(Date.now() + 8 * 864e5).sort(), [F('e')], 'the other draft goes after 7 days; sent ones never');
});

test('editing a sent batch: the title and note, a student added, a photo taken back unless kept; only its teacher', () => {
  // A batch of its own: photo 7 for Fern (she keeps it), photo 8 for Fern and Gus (Gus says "Not for me").
  for (const c of '78') put(F(c), { by: 'u-ada', purpose: 'photo-drop', draft: 'edit-draft-1' });
  const spec2 = { title: 'Electricity practical', lineId: 'science', note: 'Great wiring.', draft: 'edit-draft-1', photos: [{ url: url(F('7')), name: '7.jpg', studentIds: ['S2001'] }, { url: url(F('8')), name: '8.jpg', studentIds: ['S2001', 'S2002'] }] };
  let d2 = api.dropPhotos('C-BIO12', 'T100', spec2);
  const my = (sid) => api.getStore().spotted.filter((x) => x.dropId === d2.id && x.studentId === sid);
  const [pa, pb] = d2.photos;
  api.acceptSpotted(my('S2001')[0].id, 'S2001', { photos: [pa.id] });
  api.declineSpotted(my('S2002')[0].id, 'S2002');
  my('S2001')[0].decidedAt = new Date(Date.now() - 120e3).toISOString(); // she kept it two minutes ago
  changed({ fn: 'dropPhotos' });
  const sp = { title: 'Circuits practical', note: 'Brilliant wiring.', add: [{ photoId: pa.id, studentId: 'S2002' }], withdraw: [{ photoId: pb.id, studentId: 'S2001' }] };
  assert.ok(canAct(brook, 'editPhotoDrop', [d2.id, 'T100', sp]));
  assert.ok(!canAct(brook, 'editPhotoDrop', [d2.id, 'T101', sp]), 'only as herself');
  for (const [u, tid] of [[carter, 'T101'], [coord, 'T104'], [admin, 'T100'], [fern, 'T100'], [parent, 'T100']]) assert.ok(!canAct(u, 'editPhotoDrop', [d2.id, tid, sp]), `${u.kind}: never`);
  assert.deepEqual(touchedBy('editPhotoDrop', [d2.id, 'T100', sp]), { students: ['S2002', 'S2001'], as: ['T100'] });
  assert.throws(() => api.editPhotoDrop(d2.id, 'T101', sp), /Only the teacher who sent/);
  assert.throws(() => api.editPhotoDrop(d2.id, 'T100', { add: [{ photoId: pa.id, studentId: 'S2003' }] }), /Only students in this class/);
  assert.throws(() => api.editPhotoDrop(d2.id, 'T100', { withdraw: [{ photoId: pa.id, studentId: 'S2001' }] }), (e) => e.status === 409 && /Fern has kept this photo, so it stays with them/.test(e.message));
  assert.throws(() => api.editPhotoDrop(d2.id, 'T100', {}), /Nothing to change/);
  const kept = api.getStore().events.find((e) => e.spotted?.dropId === d2.id);
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  api.editPhotoDrop(d2.id, 'T100', sp);
  api.setActionHook(null);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after, 'deterministic on replay');
  d2 = api.getPhotoDrop(d2.id);
  assert.equal(d2.title, 'Circuits practical'); assert.equal(d2.note, 'Brilliant wiring.');
  // Gus had said "Not for me": a new offer with only the new photo, and he is told as when it was sent.
  const gusOffers = my('S2002');
  assert.deepEqual(gusOffers.map((x) => [x.status, x.photos.map((p) => p.id), x.title]), [['declined', [pb.id], 'Electricity practical'], ['open', [pa.id], 'Circuits practical']]);
  assert.deepEqual(api.getStore().notifications.slice(0, api.getStore().notifications.length - n0).map((n) => [n.to, n.text, n.kind]), [['st:S2002', 'Ms Brook added photos from “Circuits practical”', 'spotted']]);
  assert.ok(canSeeFile(gus, F('7'), {}), 'Gus now opens photo 7');
  // Fern kept photo 7: it stays with her; photo 8 (not kept) is taken back from her.
  assert.deepEqual(d2.photos.find((p) => p.id === pb.id).studentIds, ['S2002']);
  assert.ok(!my('S2001')[0].photos.some((p) => p.id === pb.id) && my('S2001')[0].kept.includes(pa.id));
  const still = api.getStore().events.find((e) => e.id === kept.id);
  assert.deepEqual([still.title, still.evidence.map((v) => v.url)], ['Electricity practical', [url(F('7'))]], 'her kept moment is as she kept it');
  const rows = api.photoDropsBy('T100', 'C-BIO12').find((x) => x.id === d2.id);
  assert.deepEqual(rows.rows.map((r) => [r.student.id, r.shown]), [['S2001', 'added'], ['S2002', 'waiting']], 'one row a student');
  assert.deepEqual(rows.kept, { [pa.id]: ['S2001'] });
  changed({ fn: 'editPhotoDrop' }); afterChange({ fn: 'editPhotoDrop' });

  // Taking 8 back from its last student: it leaves the batch; the file is kept while Undo could bring it back.
  api.editPhotoDrop(d2.id, 'T100', { withdraw: [{ photoId: pb.id, studentId: 'S2002' }] });
  assert.ok(!api.getPhotoDrop(d2.id).photos.some((p) => p.id === pb.id));
  changed({ fn: 'editPhotoDrop' });
  assert.deepEqual(afterChange({ fn: 'editPhotoDrop' }), []);
  assert.ok(exists(F('8')), 'kept for Undo');
  assert.ok(JSON.parse(fs.readFileSync(path.join(UP, `${F('8')}.json`), 'utf8')).heldAt > 0, 'held in its .json, so a restart keeps it too');
  assert.deepEqual(afterChange({ fn: 'markRead' }), [], 'a later change does not delete it either');
  assert.deepEqual(sweep(), [], 'not yet');
  assert.deepEqual(sweep(Date.now() + 3 * 3600e3), [F('8')], 'deleted once the undo window has passed');

  // Undo is refused once a student has kept photos from the batch (since the change).
  const sent = { at: Date.now() - 60e3, steps: [{ fn: 'dropPhotos', args: ['C-BIO12', 'T100', spec2], rec: [['i', d2.id]] }] };
  assert.equal(keptSince(sent).status, 409);
  assert.equal(keptSince({ ...sent, steps: [{ fn: 'dropPhotos', args: ['C-BIO12', 'T100', spec2], rec: [] }] }).status, 409, 'found by its draft too');
  const edit = { at: Date.now() - 60e3, steps: [{ fn: 'editPhotoDrop', args: [d2.id, 'T100', sp], rec: [] }] };
  assert.equal(keptSince(edit), null, 'nobody kept anything since the edit');
  api.acceptSpotted(gusOffers[1].id, 'S2002', { photos: [pa.id] });
  assert.equal(keptSince(edit).status, 409, 'Gus kept the photo the edit gave him');
  assert.equal(keptSince({ ...edit, at: Date.now() + 60e3 }), null, 'an edit after his keep');

  // Same permissions as sending: once she no longer teaches the class, she cannot edit it either.
  const bio = api.getStore().classes.find((c) => c.id === 'C-BIO12'), was = bio.teacherIds;
  bio.teacherIds = was.filter((x) => x !== 'T100');
  assert.ok(!canAct(brook, 'editPhotoDrop', [d2.id, 'T100', { title: 'x' }]), 'not her class any more: refused');
  assert.throws(() => api.editPhotoDrop(d2.id, 'T100', { title: 'x' }), (e) => e.status === 403);
  bio.teacherIds = was;
});

test('PDPA: offers are part of a student’s copy; erasure takes them out of every photo', () => {
  const d = api.studentData('S2001');
  assert.ok(d.own.spotted.some((x) => x.dropId === drop.id));
  assert.ok(!JSON.stringify([d.own.spotted, d.own.photoDrops, d.mentioned.photoDrops]).includes('S2002'), 'no classmate ids in the copy');
  api.eraseStudent('S2001');
  const left = api.getPhotoDrop(drop.id).photos;
  assert.ok(left.every((p) => !p.studentIds.includes('S2001')));
  assert.ok(!left.some((p) => p.url === url(F('a'))), 'a photo given only to her leaves the drop');
  assert.ok(left.some((p) => p.url === url(F('b'))), 'a shared one stays for the others');
});

// ── Through the server: the upload route's limits and the discard route ──
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
test('POST /api/upload with x-purpose and POST /api/photo-drops/discard', async () => {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-pd-http-'));
  const srv = await start({ PORT: String(port), DATA_DIR: dir, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, u, body, cookie, headers = {}) => fetch(`${U}${u}`, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body == null ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json()), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: FX }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const ada = (await json(req('POST', '/api/auth/setup', { token: link['ada.brook@example.org'].split('/setup/')[1], password: 'ada-pass-123' }))).cookie;
    const ben = (await json(req('POST', '/api/auth/setup', { token: link['ben.carter@example.org'].split('/setup/')[1], password: 'ben-pass-123' }))).cookie;
    const H = { 'x-purpose': 'photo-drop:http-draft-1', 'x-filename': 'p.jpg' };
    assert.equal((await req('POST', '/api/upload', Buffer.from('pdf'), ada, { ...H, 'content-type': 'application/pdf', 'x-filename': 'p.pdf' })).status, 415, 'photos only');
    assert.equal((await req('POST', '/api/upload', Buffer.alloc(10), ada, { ...H, 'content-type': 'image/jpeg', 'content-length': String(16 * 1024 * 1024) }).catch(() => ({ status: 413 }))).status, 413, 'at most 15 MB');
    const up = await json(req('POST', '/api/upload', Buffer.from('jpg bytes'), ada, { ...H, 'content-type': 'image/jpeg' }));
    assert.equal(up.status, 201);
    const name = up.url.split('/').pop();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'uploads', `${name}.json`), 'utf8')).draft, 'http-draft-1');
    assert.equal((await req('GET', up.url, null, ben)).status, 404, 'unsent: only the uploader');
    assert.equal((await req('GET', up.url, null, ada)).status, 200);
    assert.deepEqual((await json(req('POST', '/api/photo-drops/discard', { files: [name] }, ben))).deleted, 0, 'not his');
    assert.equal((await req('POST', '/api/photo-drops/discard', { files: [name] })).status, 401);
    assert.deepEqual((await json(req('POST', '/api/photo-drops/discard', { files: [name] }, ada))).deleted, 1);
    assert.ok(!fs.existsSync(path.join(dir, 'uploads', name)));
  } finally { srv.p.kill(); }
});
