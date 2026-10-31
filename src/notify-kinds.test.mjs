// Notification settings: the classifier, the filters and quiet hours (src/notify-kinds.js). Run: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audienceOf, bellView, cleanNotify, groupOf, inferKind, noteKind, notifyProblem, quietNow, settingOf, weekOnly } from './notify-kinds.js';

test('older notifications get a kind from their words and link', () => {
  const cases = [
    ['A teacher has hidden “Party photos” while they look at it.', 'safeguarding'],
    ['A teacher has finished looking at a comment on “Lab”. It is shown again.', 'safeguarding'],
    ['A teacher has removed the photo from “Lab”.', 'safeguarding'],
    ['New report: a comment on “Lab” (Aaron Torres). Unkind or bullying.', 'report'],
    ['Aaron asked you to endorse “Plant growth experiment”', 'endorse'],
    ['Aaron added evidence to “Lab” and resubmitted it', 'endorse'],
    ['Maya invited you to sponsor a planned project: “Robots”', 'endorse'],
    ['Maya answered your reflection prompt', 'answers'],
    ['Aaron handed in “Soil test” again', 'handin'],
    ['Aaron wrote on “Plant growth experiment”: I watered one twice a day.', 'comment'],
    ['Mr Coultas wrote on “Lab”: see me about the conference', 'comment'],
    ['Ms Lee left a comment on your leaver portfolio', 'comment'],
    ['Ms Rao commented on your draft', 'comment'],
    ['Aaron is stuck on “Run 5k”', 'stuck'],
    ['Aaron set a goal and asked for a check-in: “Run 5k”', 'checkin'],
    ['Aaron added “Seen in the lab” to their journey', 'spotted'],
    ['Aaron said yes to showing “Lab” as an example', 'spotted'],
    ['Mr Coultas spotted something you did: “Helping in the lab”', 'spotted'],
    ['Mr David Coultas asked Science 8 a question: “What did you notice?”', 'class'],
    ['Reminder from Mr David Coultas: “What did you notice?”', 'class'],
    ['Mr Coultas set a task: “Soil test”, due Friday 6 Nov', 'class'],
    ['Reminder: “Soil test” is due tomorrow', 'class'],
    ['“Soil test” is now due Monday', 'class'],
    ['Mr Coultas gave you until Monday for “Soil test”', 'class'],
    ['Ms Altemen added a conference for Year 8: “Parent conferences”, 3 Nov 2026', 'conference'],
    ['Aaron Torres wrote on the conference note', 'conference'],
    ['Ms Altemen wrote on your conference note', 'conference'],
    ['Ms Altemen sent you encouragement for “Run 5k”: Keep going!', 'encourage'],
    ['Pim gave you kind feedback on “Lab”.', 'kindfb'],
    ['Aaron said thank you for your feedback on “Lab”.', 'kindfb'],
    ['Mr Coultas endorsed “Lab”', 'teacher'],
    ['Ms Nair asked for more evidence on “Lab”', 'teacher'],
    ['Ms Nair: Add one thing from this week.', 'teacher'],
    ['Term 1 reflection is open: look back on your term and pick what you are proud of', 'system'],
    ['3 items from Google Classroom are in your inbox. You choose where they go.', 'system'],
  ];
  for (const [text, kind] of cases) assert.equal(inferKind(text), kind, text);
  assert.equal(inferKind('Something new', { screen: 'reports' }), 'report');
  assert.equal(inferKind('Something new', { screen: 'queue' }), 'endorse');
  // A quoted title never decides it.
  assert.equal(inferKind('Aaron asked you to endorse “Parent conference night”'), 'endorse');
  assert.equal(inferKind('Aaron is stuck on “A teacher has hidden my password”'), 'stuck');
  // A kind named by notify() wins.
  assert.equal(noteKind({ text: 'Aaron asked you to endorse “Lab”', kind: 'answers' }), 'answers');
  assert.equal(noteKind({ text: 'Aaron asked you to endorse “Lab”' }), 'endorse');
});

test('groups per audience: staff fall back to System, others always get what is not listed', () => {
  assert.equal(audienceOf('student'), 'student'); assert.equal(audienceOf('parent'), 'family'); assert.equal(audienceOf('advisor'), 'staff'); assert.equal(audienceOf('admin'), 'staff');
  assert.equal(groupOf('answers', 'staff')[0], 'answers');
  assert.equal(groupOf('spotted', 'student')[0], 'teacher');
  assert.equal(groupOf('system', 'student'), null);
  assert.equal(groupOf('conference', 'family'), null, 'families get no conference notices');
  assert.equal(groupOf('milestone', 'family')[0], 'milestones');
});

test('settings filter the bell and the count, never the record', () => {
  const prefs = cleanNotify({ kinds: { answers: 'off', comments: 'week', reports: 'off' } });
  const notes = [
    { id: 1, text: 'Aaron asked you to endorse “Answer”', kind: 'answers', read: false },
    { id: 2, text: 'Aaron asked you to endorse “Lab”', read: false },
    { id: 3, text: 'Aaron wrote on “Lab”: hi', read: false },
    { id: 4, text: 'New report: “Lab” (Aaron). Something else.', read: false },
    { id: 5, text: 'A teacher has hidden “Lab” while they look at it.', read: true },
    { id: 6, text: 'Mr Coultas endorsed “Old”', read: true, cleared: true },
  ];
  assert.equal(settingOf(notes[0], prefs, 'staff'), 'off');
  assert.equal(settingOf(notes[2], prefs, 'staff'), 'week');
  assert.equal(settingOf(notes[3], prefs, 'staff'), 'week', 'reports cannot be turned off, only kept for This week');
  assert.equal(settingOf(notes[4], { kinds: { system: 'off' } }, 'staff'), 'on', 'safeguarding always arrives');
  const b = bellView(notes, prefs, 'staff', Date.parse('2026-10-30T05:00:00Z'));
  assert.deepEqual(b.shown.map((n) => n.id), [2, 5]);
  assert.equal(b.unread, 1); assert.equal(b.badge, 1); assert.equal(b.hidden, 4);
  assert.deepEqual(weekOnly(notes, prefs, 'staff').map((n) => n.id), [3, 4]);
  assert.equal(notes.length, 6, 'nothing removed');
  // Students and families have On and Off only: a 'week' there means off.
  assert.equal(settingOf({ text: 'Ms Nair: hi' }, { kinds: { teacher: 'week' } }, 'student'), 'off');
  assert.equal(settingOf({ text: 'Aaron reached a milestone' }, cleanNotify({ kinds: { milestones: 'off' } }), 'family'), 'off');
  assert.ok(notifyProblem({ kinds: { consent: 'off' } }, 'family'), 'no consent group for families');
  assert.equal(settingOf({ text: 'A teacher has hidden “x” while they look at it.' }, { kinds: { teacher: 'off', comments: 'off' } }, 'student'), 'on');
});

test('quiet hours in Bangkok: over midnight, the badge waits, the bell still lists', () => {
  const q = { on: true, from: '21:00', to: '07:00' };
  const at = (bkk) => Date.parse(`2026-10-30T${bkk}:00+07:00`);
  assert.equal(quietNow(q, at('22:30')), true);
  assert.equal(quietNow(q, at('03:00')), true);
  assert.equal(quietNow(q, at('06:59')), true);
  assert.equal(quietNow(q, at('07:00')), false);
  assert.equal(quietNow(q, at('12:00')), false);
  assert.equal(quietNow(q, at('21:00')), true);
  assert.equal(quietNow({ ...q, on: false }, at('22:30')), false, 'off by default');
  assert.equal(quietNow({ on: true, from: '13:00', to: '14:00' }, at('13:30')), true, 'within a day');
  assert.equal(quietNow({ on: true, from: '13:00', to: '13:00' }, at('13:00')), false);
  const notes = [{ id: 1, text: 'Mr Coultas endorsed “Lab”', read: false }];
  const b = bellView(notes, cleanNotify({ quiet: q }), 'student', at('23:00'));
  assert.equal(b.shown.length, 1); assert.equal(b.unread, 1); assert.equal(b.badge, 0); assert.equal(b.quiet, true);
  assert.equal(bellView(notes, cleanNotify({ quiet: q }), 'student', at('07:01')).badge, 1, 'back when quiet hours end');
});

test('cleaning and checking settings', () => {
  assert.deepEqual(cleanNotify(null), { kinds: {}, quiet: { on: false, from: '21:00', to: '07:00' } });
  assert.deepEqual(cleanNotify({ kinds: { answers: 'off', nope: 'off', comments: 'loud', endorse: 'on' }, quiet: { on: true, from: '25:00', to: '06:30' } }), { kinds: { answers: 'off' }, quiet: { on: true, from: '21:00', to: '06:30' } });
  assert.equal(notifyProblem({ kinds: { answers: 'week' }, quiet: { on: true, from: '21:00', to: '07:00' } }, 'staff'), null);
  assert.equal(notifyProblem({ kinds: {} }, 'family'), null);
  assert.ok(notifyProblem({ kinds: { answers: 'week' } }, 'student'), 'not a student group');
  assert.ok(notifyProblem({ kinds: { teacher: 'week' } }, 'student'), 'students have On and Off only');
  assert.ok(notifyProblem({ kinds: { answers: 'off' }, extra: 1 }, 'staff'));
  assert.ok(notifyProblem({ quiet: { on: 'yes', from: '21:00', to: '07:00' } }, 'staff'));
  assert.ok(notifyProblem({ quiet: { on: true, from: '9pm', to: '07:00' } }, 'staff'));
  assert.ok(notifyProblem([], 'staff')); assert.ok(notifyProblem('off', 'staff')); assert.ok(notifyProblem(null, 'staff'));
});
