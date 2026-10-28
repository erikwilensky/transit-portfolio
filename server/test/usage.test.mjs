// Pilot usage counting. Run: npm run test:server (after npm run build:server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-usage-'));
process.env.USAGE_SAVE_MS = '20';
const { api, changed } = await import('../store.mjs');
const A = await import('../auth.mjs');
const { middleware } = await import('../lib.mjs');
const U = await import('../routes/60-usage.mjs');

const routes = {};
U.default({ get: (p, h) => { routes[p] = h; } });
const s = api.addStudent({ name: 'Usage Student', year: 9 });
const stu = A.createAccount({ email: 'u-s@nist.ac.th', name: 'Usage Student', kind: 'student', studentId: s.id });
const tea = A.createAccount({ email: 'u-t@nist.ac.th', name: 'Usage Teacher', kind: 'teacher', teacherId: 't-01' });
const idle = A.createAccount({ email: 'u-i@nist.ac.th', name: 'Never Here', kind: 'advisor', teacherId: 't-07' });
const head = A.createAccount({ email: 'u-h@nist.ac.th', name: 'Head', kind: 'leadership', teacherId: 't-10' });
const hit = (user, pathname) => { for (const m of middleware) m({ user, method: 'GET' }, {}, new URL(`http://x${pathname}`)); };
const get = (user) => { const res = { req: { headers: {} }, writeHead(st) { this.status = st; }, end(b) { this.body = b ? JSON.parse(b) : null; } }; routes['/api/admin/usage']({ user }, res); return res; };

test('requests and changes are counted per person, per day, without content', async () => {
  hit(stu, '/api/auth/me'); hit(stu, '/api/state'); hit(stu, '/api/stream');
  changed({ fn: 'addStation', by: stu.id, args: [s.id, { title: 'SECRET-TITLE' }] });
  changed({ fn: 'addReflection', by: stu.id, args: [{ text: 'SECRET-TEXT' }] });
  hit(tea, '/api/action');
  changed({ fn: 'endorse', by: tea.id, args: [['rq-1', 'rq-2'], 't-01', 'SECRET-NOTE'] });
  changed({ fn: 'setVisibility', by: tea.id, error: true });
  changed({ kind: 'view', token: 'tp-nb7d' }); // a reader outside the school opens Maya's link
  const sum = U.summary();
  const p = Object.fromEntries(sum.people.map((x) => [x.id, x]));
  assert.equal(p[stu.id].status, 'today');
  assert.equal(p[stu.id].stations, 1); assert.equal(p[stu.id].reflections, 1); assert.equal(p[stu.id].changes, 2);
  assert.equal(p[tea.id].endorsements, 2); assert.equal(p[tea.id].changes, 1, 'a failed change is not counted');
  assert.equal(p[idle.id].status, 'never');
  assert.equal(sum.byYear['Year 9'].stations, 1);
  assert.equal(sum.byYear['Year 13'].shareOpens, 1, 'share opens count on the student\'s Year group');
  assert.equal(sum.byRole.teacher.endorsements, 2);
  assert.equal(sum.byRole.advisor.never, 1);
  assert.equal(sum.totals.today, 2); assert.equal(sum.totals.shareOpens, 1);
  await new Promise((r) => setTimeout(r, 60));
  const saved = fs.readFileSync(path.join(DIR, 'usage.json'), 'utf8');
  assert.ok(!/SECRET/.test(saved), 'usage.json holds no content');
  assert.equal(JSON.parse(saved).days[U.dayOf()].u[stu.id].req, 1, 'background sync (/api/state, /api/stream) is not counted');
});

test('weeks run from the first counted day; older activity is earlier', () => {
  const old = new Date(Date.now() - 15 * 864e5);
  U.noteSeen(idle, old);
  const sum = U.summary();
  assert.ok(sum.weeks.length >= 3);
  assert.equal(sum.people.find((x) => x.id === idle.id).status, 'earlier');
  assert.ok(sum.weeks.every((w, i) => i === 0 || w.start > sum.weeks[i - 1].start));
  assert.equal(sum.weeks.at(-1).changes, 3);
});

test('only admin and leadership may read it', () => {
  assert.equal(get(stu).status, 403);
  assert.equal(get(tea).status, 403);
  assert.equal(get(null).status, 401);
  const r = get(head); assert.equal(r.status, 200); assert.ok(Array.isArray(r.body.people));
  assert.equal(get({ id: 'u-a', kind: 'admin' }).status, 200);
});

test('erasing a student forgets their counts', () => {
  changed({ fn: 'eraseStudent', by: 'u-admin', erased: { studentId: 'st-01', accounts: [stu.id] } });
  const sum = U.summary();
  assert.equal(sum.totals.shareOpens, 0);
  assert.ok(!Object.values(JSON.parse(JSON.stringify(sum.weeks))).some((w) => w.stations));
});

test('a flush writes usage.json at once (the shutdown hook)', () => {
  fs.rmSync(path.join(DIR, 'usage.json'), { force: true });
  U.flush();
  assert.ok(fs.existsSync(path.join(DIR, 'usage.json')));
});
