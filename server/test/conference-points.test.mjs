// Talking points on an advisor's conference sheet (src/conference-points.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { talkingPoints } from '../../src/conference-points.js';

test('busiest line, a quiet line and the next goal, in that order', () => {
  const p = talkingPoints({ first: 'Aaron', moments: 5, reflections: 2, lines: [{ name: 'Sport', count: 1, ever: 1 }, { name: 'Science', count: 4, ever: 6 }, { name: 'Music', count: 0, ever: 3 }, { name: 'Art', count: 0, ever: 0 }],
    goals: [{ title: 'Swim gala', days: 40 }, { title: 'Science fair', days: 9 }] });
  assert.equal(p.length, 3);
  assert.match(p[0], /^Busiest line: Science, with 4 moments this term/);
  assert.match(p[1], /^Nothing on Music this term\. Is it still a line Aaron wants/); // the quiet line he used most before
  assert.match(p[2], /^Goal “Science fair” is due in 9 days/);
});

test('weeks for a later goal, and a goal past its date when none is ahead', () => {
  assert.match(talkingPoints({ lines: [{ name: 'Sport', count: 1 }], goals: [{ title: 'Gala', days: 30 }], moments: 1, reflections: 1 })[1], /due in 4 weeks/);
  assert.match(talkingPoints({ lines: [{ name: 'Sport', count: 1 }], goals: [{ title: 'Gala', days: -3 }], moments: 1, reflections: 1 })[1], /“Gala” has passed its date/);
});

test('an empty term still gives three useful prompts, never repeated', () => {
  const p = talkingPoints({ first: 'Mai', lines: [], goals: [] });
  assert.equal(p.length, 3);
  assert.equal(new Set(p).size, 3);
  assert.match(p[0], /Nothing added this term yet/);
  assert.match(p[1], /No goals planned yet\. What would Mai like/);
});

test('no reflections and endorsements become prompts when there is room', () => {
  const p = talkingPoints({ first: 'Lee', moments: 3, reflections: 0, endorsements: 2, lines: [{ name: 'Art', count: 3 }], goals: [] });
  assert.deepEqual(p.map((x) => x.split(' ')[0]), ['Busiest', 'No', '2']);
});
