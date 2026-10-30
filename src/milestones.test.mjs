// Milestones (src/milestones.js): what a student's map earns, worked out from the map alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMilestones, milestoneCheer, milestoneTitle, since } from './milestones.js';

const lines = [{ id: 'art', name: 'Arts', colour: '#E73C3E' }, { id: 'science', name: 'Science', colour: '#4F529B' }, { id: 'art-mural', name: 'Murals', colour: '#E73C3E', parentLineId: 'art' }];
const root = (id) => (id === 'art-mural' ? 'art' : id);
let n = 0;
const ev = (date, lineIds, f = {}) => ({ id: `ev-${String(++n).padStart(3, '0')}`, title: `Moment ${n}`, date, lineIds, type: 'project', endorsements: [], ...f });
const keys = (list) => list.map((m) => m.key);

test('an empty map has none', () => {
  assert.deepEqual(deriveMilestones({ lines, events: [] }), []);
  assert.deepEqual(deriveMilestones(null), []);
});

test('the first moment, and the first on each line (a branch counts for its school line)', () => {
  const a = ev('2026-09-02', ['art']), b = ev('2026-09-01', ['science', 'art-mural']);
  const m = deriveMilestones({ lines, events: [a, b] }, { root });
  assert.deepEqual(keys(m), ['first', 'line:science', 'line:art']);
  assert.equal(m[0].eventId, b.id, 'the earliest by date, whatever order they were added');
  assert.equal(m.find((x) => x.key === 'line:art').eventId, b.id);
  assert.equal(m.find((x) => x.key === 'line:art').colour, '#E73C3E');
  assert.equal(milestoneTitle(m[2]), 'First moment on Arts');
  assert.equal(milestoneCheer(m[0]), 'Your journey has started!');
});

test('goals and future dates do not count; 5, 10 and 25 moments do', () => {
  const evs = Array.from({ length: 25 }, (_, i) => ev(`2026-${String(1 + (i % 9)).padStart(2, '0')}-1${i % 10}`, ['science']));
  const all = [...evs, ev('2026-10-01', ['art'], { type: 'goal' }), ev('2027-05-01', ['art'])];
  const m = deriveMilestones({ lines, events: all }, { today: '2026-10-30' });
  assert.deepEqual(m.filter((x) => x.kind === 'count').map((x) => x.n), [5, 10, 25]);
  assert.ok(!m.some((x) => x.key === 'line:art'), 'a goal or a future moment is not a moment yet');
  const sorted = [...evs].sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
  assert.equal(m.find((x) => x.key === 'count:5').eventId, sorted[4].id);
  assert.equal(milestoneTitle(m.find((x) => x.key === 'count:10')), '10 moments');
  assert.equal(deriveMilestones({ lines, events: evs.slice(0, 4) }).filter((x) => x.kind === 'count').length, 0);
});

test('steady: moments on one line in three different months', () => {
  const evs = [ev('2026-08-20', ['art']), ev('2026-08-28', ['art']), ev('2026-09-03', ['art']), ev('2026-09-10', ['science']), ev('2026-10-05', ['art-mural'])];
  const m = deriveMilestones({ lines, events: evs }, { root });
  const s = m.find((x) => x.key === 'steady:art');
  assert.ok(s && s.eventId === evs[4].id && s.date === '2026-10-05');
  assert.ok(!m.some((x) => x.key === 'steady:science'));
  assert.equal(milestoneTitle(s), 'Steady on Arts');
});

test('first endorsement (by its own date), first goal done, a term reflection, first spotted moment', () => {
  const a = ev('2026-09-01', ['art'], { endorsements: [{ date: '2026-09-20', teacher: { name: 'Ms Jane Altemen' } }] });
  const b = ev('2026-09-05', ['art'], { endorsements: [{ date: '2026-09-06', teacher: { name: 'Mr David Coultas' } }] });
  const g = ev('2026-09-07', ['science'], { wasGoal: true });
  const r = ev('2026-09-08', ['science'], { type: 'reflection', termReflection: 'rw-1' });
  const plain = ev('2026-09-08', ['science'], { type: 'reflection' });
  const sp = ev('2026-09-09', ['science'], { spotted: { id: 'sp-1', teacherId: 'T1' } });
  const m = deriveMilestones({ lines, events: [a, b, g, r, plain, sp] });
  const e = m.find((x) => x.key === 'endorsed');
  assert.equal(e.eventId, b.id); assert.equal(e.date, '2026-09-06'); assert.equal(e.teacher, 'Mr David Coultas');
  assert.equal(milestoneCheer(e), `Mr David Coultas checked “${b.title}”.`);
  assert.equal(m.find((x) => x.key === 'goal').eventId, g.id);
  assert.equal(m.find((x) => x.key === 'reflection').eventId, r.id);
  assert.equal(m.find((x) => x.key === 'spotted').eventId, sp.id);
  assert.equal(milestoneTitle(m.find((x) => x.key === 'spotted'), 'th'), 'เพิ่มช่วงเวลาที่ครูเห็นเป็นครั้งแรก');
});

test('only what the viewer can read: a private moment is simply not on their map', () => {
  const priv = ev('2026-09-01', ['art'], { visibility: 'private' }), shared = ev('2026-09-03', ['science'], { visibility: 'advisor' });
  const student = deriveMilestones({ lines, events: [priv, shared] });
  const advisor = deriveMilestones({ lines, events: [shared] });
  assert.equal(student[0].eventId, priv.id);
  assert.equal(advisor[0].eventId, shared.id);
  assert.ok(!advisor.some((x) => x.eventId === priv.id));
});

test('since: recent ones, newest first', () => {
  const m = deriveMilestones({ lines, events: [ev('2026-09-01', ['art']), ev('2026-10-20', ['science'])] });
  assert.deepEqual(keys(since(m, '2026-10-01')), ['line:science']);
});
