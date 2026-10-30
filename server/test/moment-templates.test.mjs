// Moment templates (api.saveMomentTemplate, setMomentTemplateOff, templatesFor, templateText; templateId on addStation,
// setTask/handInTask, askClass/answerPrompt): built-in ones with Thai, school ones, lines, on and off, permissions, scope,
// replay, and the activity log through a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FX = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-moment-templates-'));
process.env.TP_MODE = 'pilot'; process.env.TP_START = 'empty';
const { api } = await import('../store.mjs');
const { canAct } = await import('../auth.mjs');
const { scopedSnapshot } = await import('../scope.mjs');
const { studentThai } = await import('../../src/i18n.js');

const carter = { kind: 'teacher', teacherId: 'T101' }; // teaches 8 Robotics (computing) and 12 CS
const brook = { kind: 'teacher', teacherId: 'T100' };  // teaches 12 Biology (science)
const fong = { kind: 'coordinator', teacherId: 'T104' };
const ellis = { kind: 'leadership', teacherId: 'T103' };
const dumas = { kind: 'counsellor', teacherId: 'T102' };
const s1 = { kind: 'student', studentId: 'S2001' };
const FIELDS = [{ label: 'Where we went', ask: 'Where did the class go?', starters: ['We went to…', ' ', 'We went to…'] }, { label: 'What I saw', ask: '', starters: [] }];
let mine;

test('setup: class lists; Biology on Science, Computer Science on Computing', () => {
  api.importRoster(structuredClone(FX));
  for (const c of api.getClasses()) c.lineId = { 'C-BIO12': 'science', 'C-CS12': 'computing', 'C-ROB8': 'computing' }[c.id] || null;
  for (const s of api.getStore().students) { s.onboarding = false; s.laneOrder = ['science', 'computing']; }
});

test('built-in templates: six, each with 2–6 parts and starters, Thai for every word a student sees', () => {
  const ids = api.MT_BUILTIN.map((t) => t.id);
  assert.deepEqual(ids, ['mt-lab', 'mt-reading', 'mt-match', 'mt-show', 'mt-trip', 'mt-milestone']);
  for (const t of api.MT_BUILTIN) {
    assert.ok(t.fields.length >= 2 && t.fields.length <= 6 && t.fields.every((f) => f.label && f.ask && f.starters.length), t.id);
    for (const s of [t.name, t.about, ...t.fields.flatMap((f) => [f.label, f.ask, ...f.starters])]) assert.ok(/[฀-๿]/.test(studentThai(s) || ''), `Thai for “${s}”`);
    assert.ok(t.lineIds.every((l) => api.schoolLines().some((x) => x.id === l)), t.id);
  }
  for (const s of ['Use a guide', 'Stop using the guide', 'Question 2 of 4', 'Ways to start: What I did', 'Mr Coultas gave you a guide:']) assert.ok(/[฀-๿]/.test(studentThai(s) || ''), `Thai for “${s}”`);
  assert.deepEqual(api.templatesFor('science').map((t) => t.id), ['mt-lab', 'mt-milestone']);
  assert.deepEqual(api.templatesFor('sport').map((t) => t.id), ['mt-match', 'mt-milestone']);
  assert.deepEqual(api.templatesFor(null), []);
  const lab = api.getMomentTemplate('mt-lab');
  assert.equal(api.templateText(lab, ['Does salt melt ice faster?', '', 'Yes, twice as fast.']), 'The question\nDoes salt melt ice faster?\n\nWhat I found\nYes, twice as fast.');
});

test('canAct: coordinators, leadership and admins, as themselves; nobody else', () => {
  const save = (by) => [{ name: 'Field trip', fields: FIELDS }, by];
  assert.ok(canAct(fong, 'saveMomentTemplate', save('T104')) && canAct(ellis, 'saveMomentTemplate', save('T103')));
  assert.ok(canAct({ kind: 'admin' }, 'saveMomentTemplate', save(null)));
  assert.ok(!canAct({ kind: 'admin' }, 'saveMomentTemplate', save('T104')), 'an admin not as someone else');
  assert.ok(!canAct(fong, 'saveMomentTemplate', save('T103')), 'only as herself');
  for (const u of [brook, carter, dumas, s1, { kind: 'advisor', teacherId: 'T105' }, { kind: 'parent', children: ['S2001'] }]) {
    assert.ok(!canAct(u, 'saveMomentTemplate', save(u.teacherId ?? null)), u.kind);
    assert.ok(!canAct(u, 'setMomentTemplateOff', ['mt-lab', true, u.teacherId ?? null]), u.kind);
  }
  assert.ok(canAct(fong, 'setMomentTemplateOff', ['mt-lab', true, 'T104']));
  assert.ok(!canAct(fong, 'setMomentTemplateOff', ['mt-nope', true, 'T104']), 'no such template');
});

test('saveMomentTemplate: a school template, checked, tidied, edited in place, deterministic on replay', () => {
  assert.throws(() => api.saveMomentTemplate({ name: 'Hi', fields: FIELDS }, 'T104'), /name/);
  assert.throws(() => api.saveMomentTemplate({ name: 'Field trip', fields: FIELDS.slice(0, 1) }, 'T104'), /2 to 6 parts/);
  assert.throws(() => api.saveMomentTemplate({ name: 'Field trip', fields: [FIELDS[0], { ...FIELDS[1], label: 'where WE went' }] }, 'T104'), /own heading/);
  assert.throws(() => api.saveMomentTemplate({ name: 'Lab write-up', fields: FIELDS }, 'T104'), /already/);
  assert.throws(() => api.saveMomentTemplate({ name: 'Field trip', fields: FIELDS, lineIds: ['nope'] }, 'T104'), /school lines/);
  assert.throws(() => api.saveMomentTemplate({ id: 'mt-nope', name: 'Field trip', fields: FIELDS }, 'T104'), /No such template/);
  const before = api.snapshot();
  let step = null; api.setActionHook((fn, args, rec) => { step = { fn, args, rec }; });
  mine = api.saveMomentTemplate({ name: '  Field   trip ', about: 'For a day out.', fields: FIELDS, lineIds: ['science', 'science'], from: 'mt-trip' }, 'T104');
  api.setActionHook(null);
  assert.deepEqual([mine.name, mine.builtIn, mine.from, mine.lineIds, mine.fields], ['Field trip', false, 'mt-trip', ['science'],
    [{ label: 'Where we went', ask: 'Where did the class go?', starters: ['We went to…'] }, { label: 'What I saw', ask: 'What I saw', starters: [] }]]);
  const after = api.snapshot();
  api.restore(before); api.runAction(step.fn, step.args, step.rec);
  assert.equal(api.snapshot(), after);
  assert.deepEqual(api.templatesFor('science').map((t) => t.id), ['mt-lab', 'mt-milestone', mine.id]);
  assert.deepEqual(api.templatesFor('computing').map((t) => t.id), ['mt-match', 'mt-milestone']);
  const again = api.saveMomentTemplate({ id: mine.id, name: 'Field trip', fields: [...FIELDS, { label: 'Next time', ask: 'Would you go again?' }], lineIds: [] }, 'T103');
  assert.equal(again.id, mine.id); assert.equal(again.fields.length, 3); assert.equal(again.by, 'T103');
  assert.ok(api.templatesFor('computing').some((t) => t.id === mine.id), 'no lines: every line');
});

test('built-ins: the school changes their lines and turns them off, never their words', () => {
  const lab = api.saveMomentTemplate({ id: 'mt-lab', name: 'Ignored', fields: FIELDS, lineIds: ['science', 'computing'] }, 'T104');
  assert.deepEqual([lab.name, lab.lineIds, lab.fields.length], ['Lab write-up', ['science', 'computing'], 4]);
  assert.ok(api.templatesFor('computing').some((t) => t.id === 'mt-lab'));
  api.setMomentTemplateOff('mt-lab', true, 'T104');
  assert.ok(!api.templatesFor('science').some((t) => t.id === 'mt-lab') && api.getMomentTemplate('mt-lab').off);
  assert.equal(api.liveTemplate('mt-lab'), null);
  api.setMomentTemplateOff('mt-lab', false, 'T104');
  assert.deepEqual(api.getMomentTemplate('mt-lab').lineIds, ['science', 'computing'], 'turning on keeps its lines');
  assert.throws(() => api.setMomentTemplateOff('mt-nope', true), /No such/);
});

test('a moment written with a guide: its words under the headings, the template id, the template’s name as the prompt', () => {
  const lab = api.getMomentTemplate('mt-lab');
  const e = api.addStation('S2001', { title: 'Salt and ice', lineIds: ['science'], reflection: api.templateText(lab, ['Does salt melt ice?', 'Two cups', 'Yes']), templateId: lab.id });
  assert.equal(e.templateId, 'mt-lab');
  const r = api.getStore().reflections.find((x) => x.eventId === e.id);
  assert.equal(r.prompt, 'Lab write-up');
  assert.ok(r.text.startsWith('The question\nDoes salt melt ice?\n\nWhat I did\nTwo cups'));
  assert.equal(api.templateUses('mt-lab'), 1);
});

test('class tasks and questions carry a guide; the hand-in and the answer use it', () => {
  api.setMomentTemplateOff(mine.id, true, 'T104');
  assert.throws(() => api.setTask('C-BIO12', 'T100', { title: 'Osmosis lab', due: '2026-12-01', templateId: mine.id }), /turned on/);
  assert.throws(() => api.askClass('C-BIO12', 'T100', { question: 'How did the trip go?', templateId: 'mt-nope' }), /turned on/);
  api.setMomentTemplateOff(mine.id, false, 'T104');
  const t = api.setTask('C-BIO12', 'T100', { title: 'Osmosis lab', due: '2026-12-01', templateId: 'mt-lab' });
  assert.equal(t.templateId, 'mt-lab');
  const plain = api.setTask('C-BIO12', 'T100', { title: 'Plain task', due: '2026-12-01' });
  assert.ok(!('templateId' in plain), 'no guide: no key');
  api.setMomentTemplateOff('mt-lab', true, 'T104');
  api.editTask(t.id, 'T100', { title: 'Osmosis lab write-up' });
  assert.equal(api.getTask(t.id).templateId, 'mt-lab', 'a guide already on a task stays when it is edited');
  api.setMomentTemplateOff('mt-lab', false, 'T104');
  assert.ok(canAct(s1, 'handInTask', [t.id, 'S2001', { text: 'x', templateId: 'mt-lab' }]));
  const words = api.templateText(api.getMomentTemplate('mt-lab'), ['Does water move?', 'Potato in salt water']);
  const row = api.handInTask(t.id, 'S2001', { text: words, templateId: 'mt-lab' });
  assert.equal(api.getEvent(row.eventId).templateId, 'mt-lab');
  assert.equal(api.taskGrid(t.id).rows.find((r) => r.studentId === 'S2001').text, words, 'the grid shows the sections');
  const row2 = api.handInTask(plain.id, 'S2001', { text: 'Done it', templateId: 'mt-lab' });
  assert.ok(!api.getEvent(row2.eventId).templateId, 'only the task’s own guide counts');
  api.editTask(t.id, 'T100', { templateId: null });
  assert.equal(api.getTask(t.id).templateId, null);
  const q = api.askClass('C-BIO12', 'T100', { question: 'How did the trip go?', asMoment: true, templateId: mine.id });
  assert.equal(q.templateId, mine.id);
  const a = api.answerPrompt(q.id, 'S2002', { text: api.templateText(api.getMomentTemplate(mine.id), ['The river']), templateId: mine.id });
  assert.equal(api.getEvent(a.eventId).templateId, mine.id);
  assert.equal(a.text, 'Where we went\nThe river');
});

test('scope: everyone but families gets the templates', () => {
  for (const u of [s1, brook, fong, dumas, { kind: 'admin' }]) assert.ok(scopedSnapshot(u).store.momentTemplates.some((t) => t.id === mine.id), u.kind);
  assert.deepEqual(scopedSnapshot({ kind: 'parent', children: ['S2001'] }).store.momentTemplates, []);
});

const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
test('activity log: a school template change is logged with its id and who acted; a refusal too', async () => {
  const port = await freePort(), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-mt-audit-'));
  const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' } });
  const setupTok = await new Promise((resolve, reject) => { let out = ''; const t = setTimeout(() => reject(new Error(out)), 15000); p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve(out.match(/#\/setup\/(\S+)/)?.[1]); } }); });
  const U = `http://localhost:${port}`;
  const post = async (url, body, cookie) => { const r = await fetch(`${U}${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }); return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], ...(await r.json().catch(() => ({}))) }; };
  try {
    const admin = (await post('/api/auth/setup', { token: setupTok, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' })).cookie;
    const imp = await post('/api/admin/roster', { roster: FX }, admin);
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl.split('/setup/')[1]]));
    const dan = (await post('/api/auth/setup', { token: link['dan.ellis@example.org'], password: 'dan-pass-123' })).cookie; // leadership
    const ben = (await post('/api/auth/setup', { token: link['ben.carter@example.org'], password: 'ben-pass-123' })).cookie;
    const made = await post('/api/action', { fn: 'saveMomentTemplate', args: [{ name: 'Field trip', fields: FIELDS }, 'T103'], rec: [] }, dan);
    assert.equal(made.status, 200);
    assert.equal((await post('/api/action', { fn: 'setMomentTemplateOff', args: ['mt-reading', true, 'T103'], rec: [] }, dan)).status, 200);
    assert.equal((await post('/api/action', { fn: 'saveMomentTemplate', args: [{ name: 'Sneaky', fields: FIELDS }, 'T101'], rec: [] }, ben)).status, 403);
    const log = fs.readdirSync(DIR).filter((f) => /^audit-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n')).map((l) => JSON.parse(l));
    const one = (fn, result) => log.find((e) => e.fn === fn && e.result === result);
    assert.deepEqual([one('saveMomentTemplate', 'ok')?.target, one('saveMomentTemplate', 'ok')?.actor?.kind], [{ teacherId: 'T103', id: made.result.id }, 'leadership']);
    assert.deepEqual(one('setMomentTemplateOff', 'ok')?.target, { teacherId: 'T103', id: 'mt-reading' });
    assert.equal(one('saveMomentTemplate', 'refused')?.status, 403);
    assert.ok(!JSON.stringify(log).includes('Where did the class go?'), 'no template wording in the log');
  } finally { p.kill(); }
});
