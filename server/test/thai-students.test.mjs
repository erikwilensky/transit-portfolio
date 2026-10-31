// Thai for students (src/i18n.js studentThai, src/api.js recordWords): the built-in prompts, the notifications students
// get, dates and the record's own words. Needs `npm run build` (server/build/api.js). Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const api = await import('../build/api.js');
const { studentThai, thaiDates } = await import('../../src/i18n.js');
const THAI = /[฀-๿]/;

test('every built-in subject prompt (note, questions, starters) has Thai', () => {
  const miss = [];
  for (const p of Object.values(api.DEFAULT_PROMPTS)) for (const s of [p.note, ...p.questions, ...p.starters]) if (!THAI.test(studentThai(s) || '')) miss.push(s);
  assert.deepEqual(miss, []);
});

test('the notifications a student gets are read in Thai, keeping names and quoted titles', () => {
  const cases = [
    ['Mr Coultas set a task: “Cell diagram”, due tomorrow', /^Mr Coultas มอบหมายงาน: “Cell diagram” ส่งพรุ่งนี้$/],
    ['Ms Altemen sent you encouragement for “Run 5k”: I’m proud of you for keeping at it.', /^Ms Altemen .*“Run 5k”/],
    ['Term 1 reflection is open: look back on your term and pick what you are proud of', /^Term 1 reflection เปิดแล้ว/],
    ['Jin gave you kind feedback on “Reflection”.', /^Jin .*“Reflection”/],
    ['Mr Gardner wrote on “Beach clean-up”: Great work out there.', /^Mr Gardner .*“Beach clean-up”: Great work out there\.$/],
    ['Your conference: 3 Nov 2026 to 4 Nov 2026', /^การประชุมของคุณ: 3 พ\.ย\. 2026 ถึง 4 พ\.ย\. 2026$/],
  ];
  for (const [en, re] of cases) assert.match(studentThai(en) || '', re, en);
});

test('dates: Thai months, Gregorian years, weekdays', () => {
  assert.equal(thaiDates('12 Oct 2026'), '12 ต.ค. 2026');
  assert.equal(thaiDates('Tue 3 Nov'), 'อ. 3 พ.ย.');
  assert.equal(studentThai('By 11 Dec 2026'), 'ภายใน 11 ธ.ค. 2026');
});

test('unknown text and people’s words are left alone', () => {
  assert.equal(studentThai('Built a bridge out of straws'), null);
  assert.equal(studentThai('What surprised you in the lab this week?'), null);
});

test('recordWords holds the record’s words but not the app’s own messages', () => {
  api.load({ store: { students: [{ id: 's1', name: 'Kit Ng', grade: 7 }], events: [{ id: 'e1', studentId: 's1', title: 'Coming up', type: 'project', lineIds: ['science'] }], notifications: [{ to: 'st:s1', text: 'Mr X set a task: “Y”, due today' }], activity: [{ text: 'Added “Coming up”' }], lines: [{ id: 'science', name: 'Science' }] }, seq: 1 });
  const w = api.recordWords();
  assert.ok(w.has('Coming up') && w.has('Kit Ng') && w.has('Science'));
  assert.ok(!w.has('Mr X set a task: “Y”, due today') && !w.has('Added “Coming up”') && !w.has('project'));
});
