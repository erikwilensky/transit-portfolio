// Conference booking (api.openConferenceRound … sendConferenceReminders): who may open, book, cancel and block; double
// bookings and sibling clashes refused; the 24-hour rule; what each person's copy holds; reminders; PDPA. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-confbook-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct, createAccount } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
await import('../routes/68-conference.mjs'); // siblings from the family accounts
const { noteText } = await import('../../src/i18n.js').catch(() => ({ noteText: null }));

const brook = { kind: 'advisor', teacherId: 'T100' };  // advises S2001, S2002 (12B)
const fong = { kind: 'coordinator', teacherId: 'T104' }; // coordinator, advises S2003 (8A)
const gray = { kind: 'advisor', teacherId: 'T105' };   // advises nobody
const carter = { kind: 'teacher', teacherId: 'T101' };
const both = { kind: 'parent', children: ['S2001', 'S2003'] }; // Fern (12B, Ms Brook) and Hana (8A, Ms Fong)
const gus = { kind: 'parent', children: ['S2002'] };
const s1 = { kind: 'student', studentId: 'S2001' };
const day = (n) => api.daysBefore(-n);
// A Bangkok date and time a few hours from now: well inside 24 hours, not yet passed.
const soonSlot = () => {
  const bkk = (t) => new Date(t + 7 * 3600e3).toISOString();
  const h = +bkk(Date.now()).slice(11, 13), t = Date.now() + (h >= 20 ? 8 : 3) * 3600e3, iso = bkk(t);
  const m = Math.floor(+iso.slice(14, 16) / 10) * 10;
  const from = `${iso.slice(11, 13)}:${String(m).padStart(2, '0')}`, to = `${iso.slice(11, 13)}:${String(m).padStart(2, '0')}`.replace(/^(\d\d)/, (x) => String(+x + 1).padStart(2, '0'));
  return { date: iso.slice(0, 10), from, to };
};
const near = soonSlot();
const spec = { title: 'Term 1 conferences', slot: 15, days: [{ date: day(3), from: '15:00', to: '17:00' }, { date: day(4), from: '15:00', to: '16:00' }], breaks: [{ from: '16:00', to: '16:15' }], location: 'Room 12B', advisorId: 'T100' };
let A, B;

test('setup: class lists, family accounts', () => {
  api.importRoster(structuredClone(FX));
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['art']; }
  createAccount({ email: 'both@family.example', name: 'Gale-Ito Family', kind: 'parent', children: ['S2001', 'S2003'] });
  createAccount({ email: 'gus@family.example', name: 'Hale Family', kind: 'parent', children: ['S2002'] });
  assert.deepEqual(api.confSiblings('S2001'), ['S2003']);
});

test('canAct: who may open a round', () => {
  assert.ok(canAct(brook, 'openConferenceRound', [spec, 'T100']));
  assert.ok(!canAct(brook, 'openConferenceRound', [{ ...spec, advisorId: null, year: 12 }, 'T100']), 'an advisor never opens a whole Year');
  assert.ok(!canAct(brook, 'openConferenceRound', [{ ...spec, advisorId: 'T104' }, 'T100']), 'nor another advisory');
  assert.ok(!canAct(brook, 'openConferenceRound', [spec, 'T104']), 'only as herself');
  assert.ok(!canAct(gray, 'openConferenceRound', [spec, 'T105']));
  assert.ok(canAct(fong, 'openConferenceRound', [{ ...spec, advisorId: null, year: 12 }, 'T104']), 'a coordinator opens a Year');
  assert.ok(!canAct(s1, 'openConferenceRound', [spec, 'T100']));
  assert.ok(!canAct(both, 'openConferenceRound', [spec, 'T100']));
  assert.ok(!canAct(both, 'sendConferenceReminders', []) && !canAct(brook, 'sendConferenceReminders', []), 'reminders: the server only');
});

test('openConferenceRound: the advisory, families told, replayed exactly; slots skip the break', () => {
  const before = api.snapshot(), n0 = api.getStore().notifications.length;
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  A = api.openConferenceRound({ ...spec, days: [{ date: near.date, from: near.from, to: near.to }, ...spec.days] }, 'T100');
  api.setActionHook(null);
  assert.deepEqual([A.studentIds, A.advisorIds, A.slot], [['S2001', 'S2002'], ['T100'], 15]);
  const nt = api.getStore().notifications.slice(0, api.getStore().notifications.length - n0);
  assert.deepEqual(nt.map((n) => n.to).sort(), ['fam:S2001', 'fam:S2002']);
  assert.match(nt[0].text, /^Ms Brook opened conference booking: “Term 1 conferences”\. Pick a time for (Fern|Gus)$/);
  if (noteText) assert.match(noteText('th', nt[0].text), /^Ms Brook เปิดให้จองเวลาประชุมผู้ปกครอง/);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.deepEqual(api.confDayTimes(A, A.days.find((d) => d.date === day(4))), ['15:00', '15:15', '15:30', '15:45']);
  assert.ok(!api.confDayTimes(A, A.days.find((d) => d.date === day(3))).includes('16:00'), 'the break');
  assert.throws(() => api.openConferenceRound(spec, 'T100'), /already have conference booking/);
  assert.throws(() => api.openConferenceRound({ ...spec, advisorId: 'T104', slot: 12 }, 'T104'), /10, 15 or 20/);
  assert.throws(() => api.openConferenceRound({ ...spec, advisorId: 'T104', online: true, link: 'not a link' }, 'T104'), /meeting link/);
  B = api.openConferenceRound({ ...spec, slot: 10, advisorId: 'T104', online: true, link: 'https://meet.example/fong', location: '' }, 'T104');
  assert.deepEqual(B.studentIds, ['S2003']);
});

test('booking: a family for their own child only; the advisor for advisees; double bookings refused', () => {
  const at = { date: day(3), time: '15:00' };
  assert.ok(canAct(both, 'bookConference', [A.id, 'S2001', at, 'family']));
  assert.ok(!canAct(both, 'bookConference', [A.id, 'S2002', at, 'family']), 'not another family’s child');
  assert.ok(!canAct(both, 'bookConference', [A.id, 'S2001', at, 'T100']), 'a family books as the family');
  assert.ok(!canAct(s1, 'bookConference', [A.id, 'S2001', at, 'family']), 'never the student');
  assert.ok(canAct(brook, 'bookConference', [A.id, 'S2002', at, 'T100']));
  assert.ok(!canAct(fong, 'bookConference', [A.id, 'S2002', at, 'T104']), 'not someone else’s advisee, whole-school or not');
  assert.ok(!canAct(carter, 'bookConference', [A.id, 'S2002', at, 'T101']));
  const b = api.bookConference(A.id, 'S2001', at, 'family');
  assert.equal(b.advisorId, 'T100');
  assert.ok(api.getStore().notifications.some((n) => n.to === 't:T100' && /^Fern Gale’s family booked a conference: \d+ \w+ \d{4} at 15:00$/.test(n.text)));
  assert.ok(api.getStore().notifications.some((n) => n.to === 'st:S2001' && /Your conference with Ms Brook is on/.test(n.text)), 'the student is told when');
  assert.throws(() => api.bookConference(A.id, 'S2002', at, 'family'), (e) => e.status === 409 && /just taken/.test(e.message));
  assert.throws(() => api.bookConference(A.id, 'S2002', at, 'T100'), /just taken/, 'the advisor cannot double-book either');
  assert.throws(() => api.bookConference(A.id, 'S2002', { date: day(3), time: '15:05' }, 'family'), /Pick one of the times/);
  const moved = api.bookConference(A.id, 'S2001', { date: day(3), time: '15:15' }, 'family');
  assert.equal(moved.id, b.id, 'booking again moves it: one slot per child');
  assert.equal(api.getConfBookings().filter((x) => x.studentId === 'S2001').length, 1);
  api.bookConference(A.id, 'S2002', at, 'family');
});

test('siblings: a clash across advisors is refused, side-by-side times are fine', () => {
  // Fern 15:15–15:30 with Ms Brook; Hana's 10-minute slots with Ms Fong.
  assert.throws(() => api.bookConference(B.id, 'S2003', { date: day(3), time: '15:20' }, 'family'), (e) => e.status === 409 && /clashes with Fern/.test(e.message));
  assert.throws(() => api.bookConference(B.id, 'S2003', { date: day(3), time: '15:10' }, 'T104'), /clashes with Fern/, 'the advisor booking for the family too');
  const h = api.bookConference(B.id, 'S2003', { date: day(3), time: '15:30' }, 'family');
  assert.equal(h.time, '15:30');
  assert.throws(() => api.bookConference(A.id, 'S2001', { date: day(3), time: '15:30' }, 'family'), /clashes with Hana/);
});

test('24 hours: families cannot book, move or cancel inside it; the advisor can', () => {
  const t = api.confDayTimes(A, A.days[0])[0];
  const soon = { date: near.date, time: t };
  assert.ok(!canAct(gus, 'bookConference', [A.id, 'S2002', soon, 'family']), 'refused by the server’s clock');
  assert.throws(() => api.bookConference(A.id, 'S2002', soon, 'family'), /at least 24 hours/);
  assert.ok(canAct(brook, 'bookConference', [A.id, 'S2002', soon, 'T100']));
  const b = api.bookConference(A.id, 'S2002', soon, 'T100');
  assert.ok(api.getStore().notifications.some((n) => n.to === 'fam:S2002' && /^Ms Brook booked Gus’s conference:/.test(n.text)), 'the family is told');
  assert.ok(!canAct(gus, 'cancelConference', [b.id, 'family']));
  assert.throws(() => api.cancelConference(b.id, 'family'), /Less than 24 hours/);
  assert.ok(!canAct(gus, 'bookConference', [A.id, 'S2002', { date: day(4), time: '15:00' }, 'family']), 'nor move it');
  assert.throws(() => api.bookConference(A.id, 'S2002', { date: day(4), time: '15:00' }, 'family'), /Less than 24 hours/);
  assert.ok(canAct(brook, 'cancelConference', [b.id, 'T100']));
  api.bookConference(A.id, 'S2002', { date: day(3), time: '15:00' }, 'T100');
  assert.equal(api.confBookingOf(A.id, 'S2002').date, day(3));
});

test('cancel: a family until 24 hours before, for their own child', () => {
  const b = api.confBookingOf(B.id, 'S2003');
  assert.ok(!canAct(gus, 'cancelConference', [b.id, 'family']));
  assert.ok(!canAct(brook, 'cancelConference', [b.id, 'T100']), 'not another advisor’s');
  assert.ok(canAct(both, 'cancelConference', [b.id, 'family']));
  api.cancelConference(b.id, 'family');
  assert.equal(api.confBookingOf(B.id, 'S2003'), null);
  assert.ok(api.getStore().notifications.some((n) => n.to === 't:T104' && /Hana Ito’s family cancelled/.test(n.text)));
  api.bookConference(B.id, 'S2003', { date: day(4), time: '15:30' }, 'family');
});

test('blocking: the advisor of that grid, never a booked time', () => {
  assert.ok(canAct(brook, 'blockConferenceSlot', [A.id, 'T100', day(3), '15:30', true, 'T100']));
  assert.ok(!canAct(fong, 'blockConferenceSlot', [A.id, 'T100', day(3), '15:30', true, 'T104']));
  assert.ok(!canAct(both, 'blockConferenceSlot', [A.id, 'T100', day(3), '15:30', true, 'family']));
  api.blockConferenceSlot(A.id, 'T100', day(3), '15:30', true, 'T100');
  assert.throws(() => api.blockConferenceSlot(A.id, 'T100', day(3), '15:00', true, 'T100'), /cancel it first/);
  assert.throws(() => api.bookConference(A.id, 'S2002', { date: day(3), time: '15:30' }, 'family'), /just taken/);
  const g = api.confGrid(A.id, 'T100').days.find((d) => d.date === day(3)).slots;
  assert.deepEqual(g.slice(0, 4).map((x) => x.state), ['booked', 'booked', 'blocked', 'free']);
});

test('scope: another family sees taken times without names; staff and students only their own', () => {
  const g = scopedSnapshot({ ...gus, id: 'u-gus' }).store;
  assert.deepEqual(g.confRounds.map((r) => [r.id, r.studentIds]), [[A.id, ['S2002']]]);
  const other = g.confBookings.filter((b) => b.studentId !== 'S2002');
  assert.ok(other.length >= 1 && other.every((b) => b.taken && !('studentId' in b) && !('by' in b) && !('id' in b)), 'Fern’s booking is only a taken time');
  assert.ok(!JSON.stringify(g).includes('S2001') && !JSON.stringify(g).includes('Fern'), 'no trace of the other family');
  assert.ok(!g.confBookings.some((b) => b.roundId === B.id), 'not other advisors’ grids');
  assert.ok(g.confBlocks.every((k) => k.taken && !('by' in k)));
  const fam = scopedSnapshot({ ...both, id: 'u-both' }).store;
  assert.deepEqual(fam.confRounds.map((r) => r.id).sort(), [A.id, B.id].sort());
  assert.ok(fam.confBookings.some((b) => b.studentId === 'S2001') && fam.confBookings.some((b) => b.studentId === 'S2003'), 'both children, side by side');
  assert.ok(!JSON.stringify(fam).includes('S2002'));
  const st = scopedSnapshot(s1).store;
  assert.deepEqual(st.confBookings.map((b) => b.studentId), ['S2001']);
  assert.deepEqual(st.confRounds.map((r) => r.studentIds), [['S2001']]);
  assert.deepEqual(st.confBlocks, []);
  const adv = scopedSnapshot(brook).store;
  assert.deepEqual(adv.confBookings.map((b) => b.studentId).sort(), ['S2001', 'S2002']);
  assert.ok(!scopedSnapshot(carter).store.confBookings.length);
  assert.equal(scopedSnapshot(fong).store.confBookings.length, 3, 'whole-school staff: all');
});

test('edit and close: refused while a booking would lose its time; the advisor or opener only', () => {
  assert.ok(canAct(brook, 'editConferenceRound', [A.id, { title: 'x' }, 'T100']));
  assert.ok(!canAct(gray, 'editConferenceRound', [A.id, { title: 'x' }, 'T105']));
  assert.ok(canAct(fong, 'closeConferenceRound', [A.id, 'T104']), 'whole-school staff');
  assert.throws(() => api.editConferenceRound(A.id, { days: A.days.filter((d) => d.date !== day(3)) }, 'T100'), (e) => e.status === 409 && /would lose/.test(e.message));
  const r = api.editConferenceRound(A.id, { location: 'Library', breaks: [] }, 'T100');
  assert.equal(r.location, 'Library');
});

test('reminders the day before: family and advisor, once', () => {
  const n = api.sendConferenceReminders(api.daysBefore(-2)); // tomorrow is day(3)
  assert.equal(n, 2);
  const nt = api.getStore().notifications;
  const fam = nt.find((x) => x.to === 'fam:S2001' && /^Reminder:/.test(x.text));
  assert.match(fam.text, /^Reminder: Fern’s conference with Ms Brook is tomorrow, \d+ \w+ \d{4} at 15:15 · Library$/);
  if (noteText) assert.match(noteText('th', fam.text), /^เตือนความจำ: พรุ่งนี้ Fern มีนัดประชุมกับ Ms Brook .* เวลา 15:15 น\. · Library$/);
  assert.ok(nt.some((x) => x.to === 't:T100' && /^Reminder: 2 conferences tomorrow, the first .* at 15:00$/.test(x.text)));
  assert.equal(api.sendConferenceReminders(api.daysBefore(-2)), 0, 'only once');
});

test('PDPA: a booking is in the student’s copy and goes with erasure', () => {
  const copy = api.studentData('S2001');
  assert.ok(copy.own.confBookings?.some((b) => b.studentId === 'S2001'));
  assert.ok(!copy.own.confBookings.some((b) => b.studentId !== 'S2001'));
  api.eraseStudent('S2003');
  assert.ok(!api.getConfBookings().some((b) => b.studentId === 'S2003'));
  assert.ok(!api.getConferenceRound(B.id) || !api.getConferenceRound(B.id).studentIds.includes('S2003'));
});
