// Search (src/search.js): the index, Thai, highlights, filters, and what each viewer may search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { collect, createIndex, marks, needles, search, setDocs, snippet, words } from './search.js';

const doc = (id, title, f = {}) => ({ id, kind: 'moment', studentId: 'S1', eventId: id, title, sub: '', date: '2026-10-01', lineIds: ['science'], fields: [['Title', title, 4], ['Summary', f.summary || '', 2]], ...f });
const titles = (r) => r.results.map((d) => d.title);

test('prefix words, all words must match, title before body', () => {
  const ix = createIndex();
  setDocs(ix, [doc('a', 'Built a model volcano'), doc('b', 'Science fair', { summary: 'My volcano model erupted twice' }), doc('c', 'Started the art club')]);
  assert.deepEqual(titles(search(ix, 'volc')), ['Built a model volcano', 'Science fair']);
  assert.deepEqual(titles(search(ix, 'volcano erupted')), ['Science fair']);
  assert.deepEqual(titles(search(ix, 'art')), ['Started the art club'], 'a word start, not inside "Started"');
  assert.equal(search(ix, 'VOLCANO').total, 2, 'any case');
  assert.equal(search(ix, '').total, 0);
  assert.equal(search(ix, 'zebra').total, 0);
  const b = search(ix, 'erupted').results[0];
  assert.deepEqual(b.match.slice(0, 2), ['Summary', 'My volcano model erupted twice'], 'the field that matched, for the snippet');
});

test('Thai: segmented words, and a substring match where the word breaks differ', () => {
  const ix = createIndex();
  setDocs(ix, [doc('t', 'ทำหุ่นยนต์กับเพื่อน'), doc('e', 'Robot club')]);
  assert.deepEqual(titles(search(ix, 'หุ่นยนต์')), ['ทำหุ่นยนต์กับเพื่อน']);
  assert.deepEqual(titles(search(ix, 'ยนต์')), ['ทำหุ่นยนต์กับเพื่อน'], 'inside a word');
  assert.deepEqual(titles(search(ix, 'เพื่อน robot')), [], 'every word must match');
  assert.deepEqual(needles('หุ่นยนต์ กับ  robot-club'), ['หุ่นยนต์', 'กับ', 'robot', 'club']);
  assert.ok(words('ทำหุ่นยนต์').length >= 2, 'the segmenter splits Thai');
  assert.deepEqual(words('ทำหุ่นยนต์ fair', null), ['ทำหุ่นยนต์', 'fair'], 'no segmenter: runs of letters');
  assert.deepEqual(marks('ทำหุ่นยนต์กับเพื่อน', ['หุ่นยนต์']), [['ทำ', false], ['หุ่นยนต์', true], ['กับเพื่อน', false]]);
});

test('highlights and snippets', () => {
  assert.deepEqual(marks('Built a Volcano model', ['volc', 'mod']), [['Built a ', false], ['Volc', true], ['ano ', false], ['mod', true], ['el', false]]);
  assert.deepEqual(marks('restart art', ['art']), [['restart ', false], ['art', true]]);
  assert.deepEqual(marks('nothing', []), [['nothing', false]]);
  const long = `${'a '.repeat(80)}the volcano erupted ${'b '.repeat(80)}`;
  const s = snippet(long, ['volcano']);
  assert.ok(s.includes('volcano') && s.startsWith('…') && s.endsWith('…') && s.length < 120, s);
});

test('filters by kind, line and date; an empty query with a filter lists it; the limit', () => {
  const ix = createIndex();
  setDocs(ix, [doc('a', 'Volcano', { date: '2026-10-20' }), doc('b', 'Volcano again', { date: '2025-03-01', lineIds: ['art'] }), doc('g', 'Volcano goal', { kind: 'goal', date: '2026-12-01' })]);
  const o = { today: '2026-10-26', termStart: '2026-08-17' };
  assert.deepEqual(titles(search(ix, 'volcano', { ...o, kind: 'goal' })), ['Volcano goal']);
  assert.deepEqual(titles(search(ix, 'volcano', { ...o, line: 'art' })), ['Volcano again']);
  assert.deepEqual(titles(search(ix, 'volcano', { ...o, when: 'term' })), ['Volcano']);
  assert.deepEqual(titles(search(ix, 'volcano', { ...o, when: 'older' })), ['Volcano again']);
  assert.deepEqual(titles(search(ix, '', { ...o, line: 'art' })), ['Volcano again']);
  const r = search(ix, 'volcano', { limit: 2 });
  assert.equal(r.results.length, 2); assert.equal(r.total, 3);
  assert.deepEqual(r.groups.map(([k]) => k), ['moment', 'goal'].filter((k) => r.results.some((d) => d.kind === k)));
});

test('the index follows changes: only changed docs are re-read, removed ones go', () => {
  const ix = createIndex();
  assert.equal(setDocs(ix, [doc('a', 'Volcano'), doc('b', 'Choir')]), 2);
  assert.equal(setDocs(ix, [doc('a', 'Volcano'), doc('b', 'Choir')]), 0);
  assert.equal(setDocs(ix, [doc('a', 'Lava lamp')]), 2);
  assert.equal(search(ix, 'volcano').total, 0); assert.equal(search(ix, 'choir').total, 0); assert.equal(search(ix, 'lava').total, 1);
  assert.ok(!ix.terms.has('choir'), 'no stale terms');
});

// A tiny record and a getStudentMap that applies VISIBLE_TO as api.js does, to check what collect() reads for each viewer.
const VISIBLE_TO = { student: ['private', 'advisor', 'school', 'publishable'], advisor: ['advisor', 'school', 'publishable'], school: ['school', 'publishable'], public: ['publishable'] };
function fakeApi() {
  const students = [{ id: 'S1', name: 'Aaron Torres', grade: 7, homeroom: '8C', programme: 'IB MYP', advisorId: 'T1' }, { id: 'S2', name: 'Bea Lim', grade: 7, homeroom: '8A', advisorId: 'T9' }];
  const events = [
    { id: 'ev-1', studentId: 'S1', title: 'Volcano model', type: 'project', date: '2026-10-01', lineIds: ['science'], visibility: 'school', summary: '', evidence: [{ caption: 'Lava photo' }] },
    { id: 'ev-2', studentId: 'S1', title: 'Volcano diary', type: 'project', date: '2026-10-02', lineIds: ['science'], visibility: 'private', summary: '', evidence: [] },
    { id: 'ev-3', studentId: 'S1', title: 'Volcano for my advisor', type: 'project', date: '2026-10-03', lineIds: ['science'], visibility: 'advisor', summary: '', evidence: [] },
  ];
  const reflections = [{ id: 'r1', eventId: 'ev-1', text: 'The magma was messy', visibility: 'private' }, { id: 'r2', eventId: 'ev-1', text: 'Learned about tectonics', visibility: 'school' }];
  const getStudent = (id) => students.find((s) => s.id === id);
  return {
    VISIBLE_TO, getStudent, getStudents: () => students, getStore: () => ({ events }), getTeacher: (id) => ({ id, name: `Teacher ${id}` }), getLine: (id) => ({ id, name: id }), rootLine: (id) => id,
    familyViewer: () => 'advisor', getNotes: (sid) => (sid === 'S1' ? [{ date: '2026-10-05', text: 'Talked about the volcano project' }] : []), getRequests: () => [], getMomentComments: () => [], commentShown: () => true,
    getStudentMap: (sid, viewer, opts = {}) => ({
      student: getStudent(sid), signals: [], lines: [{ id: 'science', name: 'Science', colour: '#4F529B' }],
      events: events.filter((e) => e.studentId === sid && VISIBLE_TO[viewer].includes(e.visibility) && !(opts.family && e.hidden))
        .map((e) => ({ ...e, reflections: reflections.filter((r) => r.eventId === e.id && VISIBLE_TO[viewer].includes(r.visibility)), endorsements: [], tags: { lp: ['Thinker'], atl: [] } })),
    }),
  };
}
const find = (persona, q) => { const ix = createIndex(); setDocs(ix, collect(fakeApi(), persona)); return search(ix, q).results.map((d) => `${d.kind}:${d.kind === 'reflection' ? d.fields[1][1] : d.title}`); };

test('visibility: each viewer searches only what their screens show', () => {
  const mine = find({ kind: 'student', studentId: 'S1' }, 'volcano');
  assert.deepEqual(mine.filter((x) => x.startsWith('moment')).sort(), ['moment:Volcano diary', 'moment:Volcano for my advisor', 'moment:Volcano model'], 'their own record, private too');
  assert.deepEqual(find({ kind: 'student', studentId: 'S1' }, 'magma'), ['reflection:The magma was messy'], 'their own private reflection');
  assert.equal(find({ kind: 'student', studentId: 'S1' }, 'thinker').length, 3, 'learner profile tags');
  assert.deepEqual(find({ kind: 'student', studentId: 'S1' }, 'lava'), ['moment:Volcano model'], 'evidence captions');
  assert.ok(find({ kind: 'student', studentId: 'S1' }, 'science').includes('line:Science'), 'their lines');
  assert.deepEqual(find({ kind: 'student', studentId: 'S1' }, 'bea'), [], 'never another student');
  const teacher = { id: 'me', kind: 'teacher', teacherId: 'T5' };
  assert.deepEqual(find(teacher, 'volcano'), ['moment:Volcano model'], 'a teacher who is not the advisor: school level only');
  assert.deepEqual(find(teacher, 'aaron'), ['student:Aaron Torres', 'moment:Volcano model'], 'the student by name, and what they may read');
  assert.deepEqual(find(teacher, '8c'), ['student:Aaron Torres'], 'by homeroom');
  assert.deepEqual(find(teacher, 'magma'), [], 'no private reflection');
  assert.deepEqual(find(teacher, 'tectonics'), ['reflection:Learned about tectonics']);
  assert.deepEqual(find(teacher, 'talked'), [], 'advisor notes only for the advisor');
  const advisor = { id: 'me', kind: 'advisor', teacherId: 'T1' };
  assert.deepEqual(find(advisor, 'volcano').sort(), ['moment:Volcano for my advisor', 'moment:Volcano model', 'note:Advisor note on Aaron Torres'].sort());
  assert.ok(!find({ id: 'me', kind: 'coordinator', teacherId: 'T7' }, 'volcano').includes('moment:Volcano diary'), 'whole-school roles: never private');
  assert.deepEqual(find({ id: 'p', kind: 'parent', children: ['S1'] }, 'volcano').sort(), ['moment:Volcano for my advisor', 'moment:Volcano model'], 'a family: the family view');
  assert.deepEqual(find({ id: 'p', kind: 'parent', children: ['S1'] }, 'bea'), []);
  assert.deepEqual(find({ id: 'x', kind: 'external' }, 'volcano'), []);
});
