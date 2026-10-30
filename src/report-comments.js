// Report writing helper (src/screens/ReportComments.jsx): what a student did this term, gathered from the part of the
// record this teacher or advisor already holds, beside a private draft box. The drafts live on the server, never in the
// record (server/report-comments.mjs, server/routes/71-report-comments.mjs). No AI writing: the teacher writes every word.
import { checkComment, charCount, firstName, wordCount } from './report-checks.js';
import { TODAY, classesOf, getClasses, getEnrolments, getLine, getStore, getStudent, getStudentMap, getTeacher, rootLine, termStartOf } from './api.js';

// Hook for the comment bank (built separately): set reportHooks.phrasePicker to a component. Each draft box renders
// it with { student, kind, classId, text, insert(str) } under the text box; insert adds the phrase at the cursor.
export const reportHooks = { phrasePicker: null };

export const KIND_LABEL = { subject: 'Subject comment', advisor: 'Advisor comment' };
export const DEFAULT_LIMITS = { subject: { words: 150, chars: 1000 }, advisor: { words: 200, chars: 1300 } };
export { checkComment, charCount, firstName, wordCount };
export const termRange = (d = TODAY) => ({ from: termStartOf(d), to: d });

// ── What each student did, from the record this person holds ──
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const inRange = (d, { from, to }) => !!d && d >= from && d <= to;
const current = (e) => !(e.to && e.to < TODAY);
export const groupStudents = (kind, groupId) => {
  const ids = kind === 'subject'
    ? [...new Set(getEnrolments().filter((e) => e.classId === groupId && current(e)).map((e) => e.studentId))]
    : getStore().students.filter((s) => s.advisorId === groupId && !s.cohortOnly).map((s) => s.id);
  return ids.map(getStudent).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
};
const tagOf = (e, spots) => {
  const sys = e.source?.system;
  if (e.spotted) return `Spotted by ${getTeacher(e.spotted.teacherId)?.name || 'a teacher'}`;
  if (sys === 'Class question') return 'Class question';
  if (sys === 'Class task') return 'Task hand-in';
  if (sys === 'Term reflection') return 'Term reflection';
  return spots.has(e.id) ? 'Spotted' : null;
};
// One student's moments in the range: on the class's line or for the class (subject), or on every line (advisor).
export function momentsFor(studentId, { kind, classId = null, from, to, teacherId = null }) {
  const st = getStore(), range = { from, to };
  const c = classId ? getClasses().find((x) => x.id === classId) : null;
  const prompts = new Map((st.classPrompts || []).map((p) => [p.id, p])), tasks = new Map((st.teacherTasks || []).map((t) => [t.id, t]));
  const forClass = new Set();
  for (const a of st.classAnswers || []) if (a.studentId === studentId && a.eventId && prompts.get(a.promptId)?.classId === classId) forClass.add(a.eventId);
  for (const h of st.handIns || []) if (h.studentId === studentId && h.eventId && tasks.get(h.taskId)?.classId === classId) forClass.add(h.eventId);
  const spotClass = new Map((st.spotted || []).map((x) => [x.id, x.classId]));
  const map = getStudentMap(studentId, 'advisor');
  const events = map.events.filter((e) => e.type !== 'goal' && inRange(e.date, range) && e.date <= TODAY
    && (kind === 'advisor' || forClass.has(e.id) || (e.spotted && spotClass.get(e.spotted.id) === classId) || (c?.lineId && e.lineIds.some((l) => rootLine(l) === c.lineId))))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((e) => ({
      id: e.id, date: e.date, title: e.title, type: e.type, line: getLine(rootLine(e.lineIds[0])) || null, tag: tagOf(e, forClass),
      words: e.reflections.map((r) => clip(r.text, 220)).filter(Boolean), summary: clip(e.summary, 160),
      endorsements: e.endorsements.map((n) => ({ by: n.teacher?.name || 'A teacher', note: clip(n.note, 160) })),
      endorsed: e.verification === 'teacher-endorsed' || e.verification === 'school-verified',
    }));
  // The teacher's own spotted suggestions the student has not added (yet).
  const spotted = teacherId ? (st.spotted || []).filter((x) => x.studentId === studentId && x.teacherId === teacherId && x.status !== 'accepted' && (kind === 'advisor' || x.classId === classId) && inRange(x.date, range))
    .map((x) => ({ id: x.id, date: x.date, title: x.title, note: clip(x.note, 160) })) : [];
  // Class tasks set in the range: handed in or not.
  const set = [...tasks.values()].filter((t) => (kind === 'advisor' || t.classId === classId) && t.studentIds?.includes(studentId) && inRange(t.date, range));
  const handed = new Set((st.handIns || []).filter((h) => h.studentId === studentId && h.eventId).map((h) => h.taskId));
  const taskSum = set.length ? { set: set.length, handedIn: set.filter((t) => handed.has(t.id)).length } : null;
  const answers = (st.classAnswers || []).filter((a) => a.studentId === studentId && !a.skipped && inRange(a.date, range) && (kind === 'advisor' || prompts.get(a.promptId)?.classId === classId)).length;
  const out = { events, spotted, tasks: taskSum, answers, endorsements: events.reduce((n, e) => n + e.endorsements.length, 0) };
  if (kind === 'advisor') {
    const tr = (st.termReflections || []).filter((r) => r.studentId === studentId).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0];
    const w = tr && (st.reflectionWindows || []).find((x) => x.id === tr.windowId);
    const station = tr?.eventId && map.events.find((e) => e.id === tr.eventId);
    out.reflection = tr ? { title: w?.title || 'Term reflection', status: tr.status, words: station ? station.reflections.map((r) => clip(r.text, 300)) : [] } : null;
    out.goals = st.events.filter((e) => e.studentId === studentId && e.type === 'goal' && ['advisor', 'school', 'publishable'].includes(e.visibility) && (!e.closedOn || inRange(e.closedOn, range)))
      .map((e) => ({ id: e.id, title: e.title, date: e.date, closed: !!e.closedOn, last: (e.checkins || []).at(-1)?.status || null }));
  }
  return out;
}
// The groups this person writes for: their current classes, and their advisory.
export function groupsOf(persona) {
  const tid = persona.teacherId;
  if (!tid) return [];
  const classes = classesOf(tid).map((c) => ({ kind: 'subject', id: c.id, name: c.name, line: c.line, total: c.studentIds.length }));
  const adv = getStore().students.filter((s) => s.advisorId === tid && !s.cohortOnly);
  const homes = [...new Set(adv.map((s) => s.homeroom).filter(Boolean))];
  return [...(adv.length ? [{ kind: 'advisor', id: tid, name: homes.length ? `Advisory ${homes.join(', ')}` : 'My advisory', total: adv.length }] : []), ...classes];
}

// ── The server (pilot) ──
async function call(method, url, body) {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again.'), { status: r.status });
  return j;
}
const enc = encodeURIComponent;
export const reportApi = {
  mine: () => call('GET', '/api/report-comments'),
  save: (kind, group, studentId, body) => call('PUT', `/api/report-comments/${enc(kind)}/${enc(group)}/${enc(studentId)}`, body).then((j) => j.draft),
  exportUrl: (kind, group) => `/api/report-comments/export?kind=${enc(kind)}&group=${enc(group)}`,
  progress: () => call('GET', '/api/report-comments/progress'),
  setLimits: (kind, words, chars) => call('POST', '/api/admin/report-comments/limits', { kind, words, chars }).then((j) => j.limits),
};
