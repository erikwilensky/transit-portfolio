// "This week" for teachers and advisors (src/screens/ThisWeek.jsx), computed in the browser from the part of the
// record this person already holds (server/scope.mjs). Nothing here asks the server for more.
import { TODAY, classAnswerGroups, classesOf, classPrompts, commentStaff, getEvent, getLine, getMomentComments, getReports, getRequests, getStore, getStudent, isModerator, rootLine, spottedBy, unreadComments } from './api.js';
import { atInWeek, inWeek, weekOf } from './week.js';

const SCHOOL = ['school', 'publishable'];
const moment = (e) => e.type !== 'goal' && !e.alum && e.date <= TODAY;

// When each moment was added: its own date, or the day the log says the student added it (a back-dated moment added
// this week counts this week). Keyed by student and title, as the log names stations by title.
function addedIndex() {
  const m = new Map();
  for (const a of getStore().activity) {
    if (a.kind !== 'station' || a.actor !== getStudent(a.studentId)?.name) continue;
    const t = a.text?.match(/^Added “(.+?)”(?: from .+)?$/)?.[1];
    if (t) { const k = `${a.studentId}|${t}`; (m.get(k) || m.set(k, []).get(k)).push(a.ts); }
  }
  return m;
}

// Everything the summary shows, for one week: back = 0 (this week) or 1 (last week).
// "Waiting for you" is what waits now, whichever week is shown.
export function weeklySummary(persona, back = 0) {
  const tid = persona.teacherId, w = weekOf(TODAY, back);
  const teaches = persona.kind === 'teacher' || !!persona.also?.includes('teacher');
  const advises = persona.kind === 'advisor' || !!persona.also?.includes('advisor');
  const idx = addedIndex();
  const addedIn = (e) => moment(e) && (inWeek(e.date, w) || (idx.get(`${e.studentId}|${e.title}`) || []).some((at) => atInWeek(at, w)));
  const week = getStore().events.filter(addedIn);

  // ── Waiting for you ──
  const groups = teaches ? classAnswerGroups(tid) : [];
  const inGroup = new Set(groups.flatMap((g) => g.requests.map((r) => r.id)));
  const requests = teaches ? getRequests(tid).filter((r) => !inGroup.has(r.id)) : [];
  const reports = isModerator(persona) ? getReports().filter((r) => r.status === 'open') : null;
  const spotted = tid ? spottedBy(tid).filter((x) => x.shown === 'waiting') : [];
  const threads = [...new Set((getStore().momentComments || []).map((c) => c.eventId))]
    .filter((id) => getEvent(id) && commentStaff(id).includes(tid))
    .map((id) => ({ event: getEvent(id), student: getStudent(getEvent(id).studentId), unread: unreadComments(id, tid), last: getMomentComments(id).at(-1)?.at || '' }))
    .filter((t) => t.unread > 0).sort((a, b) => b.last.localeCompare(a.last));

  // ── In your classes ──
  const classes = teaches ? classesOf(tid).map((c) => {
    const inClass = new Set(c.studentIds);
    const mine = week.filter((e) => inClass.has(e.studentId) && (!c.lineId || e.lineIds.some((l) => rootLine(l) === c.lineId)));
    const asked = classPrompts(c.id).filter((p) => inWeek(p.date, w));
    const of = asked.reduce((n, p) => n + p.studentIds.length, 0), answered = asked.reduce((n, p) => n + p.answers.length, 0);
    return { ...c, moments: mine.length, students: new Set(mine.map((e) => e.studentId)).size, questions: asked.length, answered, asked: of, rate: of ? Math.round((100 * answered) / of) : null };
  }) : [];

  // ── Your advisory ──
  const advisees = advises ? getStore().students.filter((s) => s.advisorId === tid && !s.cohortOnly) : [];
  const mineIds = new Set(advisees.map((s) => s.id));
  const advMoments = week.filter((e) => mineIds.has(e.studentId));

  // ── Celebrate: up to 5 school-visible moments from their students, the richest first ──
  const classOf = new Map(); for (const c of classes) for (const sid of c.studentIds) if (!classOf.has(sid)) classOf.set(sid, c.id);
  const theirs = (sid) => mineIds.has(sid) || classOf.has(sid);
  const score = (e) => 2 * e.evidence.some((x) => x.kind === 'image') + (e.verification !== 'student-added' || getStore().endorsements.some((n) => n.eventId === e.id)) + getStore().reflections.some((r) => r.eventId === e.id);
  const celebrate = week.filter((e) => theirs(e.studentId) && SCHOOL.includes(e.visibility) && !e.hidden)
    .map((e) => ({ event: e, student: getStudent(e.studentId), line: getLine(e.lineIds[0]) || null, photo: e.evidence.find((x) => x.kind === 'image') || null, score: score(e), advisee: mineIds.has(e.studentId), classId: classOf.get(e.studentId) || null }))
    .sort((a, b) => b.score - a.score || b.event.date.localeCompare(a.event.date) || b.event.id.localeCompare(a.event.id)).slice(0, 5);

  return {
    week: w, teaches, advises,
    waiting: { requests, groups, reports, spotted, threads },
    classes,
    advisory: advises ? { students: advisees, moments: advMoments.length, active: new Set(advMoments.map((e) => e.studentId)).size, list: advMoments.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((e) => ({ event: e, student: getStudent(e.studentId) })) } : null,
    celebrate,
  };
}

// Sign-ups and families who joined in the week, from GET /api/advisor/progress (signedUpAt and familyAt, the times family accounts joined, per student).
export function weekSignups(progress, back = 0) {
  if (!progress) return null;
  const w = weekOf(TODAY, back);
  return { ...progress, signedUpWeek: progress.students.filter((s) => atInWeek(s.signedUpAt, w)).length, familiesWeek: progress.students.filter((s) => (s.familyAt || []).some((at) => atInWeek(at, w))).length };
}
