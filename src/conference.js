import { familyViewer, getMomentComments, getNotes, getStudentMap, sheetPrep, sheetSteps, TERM_START, TODAY } from './api.js';
import { talkingPoints } from './conference-points.js';

// What one conference sheet shows (src/components/ConferenceSheets.jsx). The advisor's copy reads the record as the
// advisor may (never private moments or reflections); the family copy reads it as the family view does
// (familyViewer: Years 7 to 9 what the advisor sees, from Year 10 what the student shares with the school) and
// leaves out what only staff see: moment comments, advisor notes and reflection signals.
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function conferenceSheet(studentId, { family = false } = {}) {
  const map = getStudentMap(studentId, family ? familyViewer(studentId) : 'advisor');
  const s = map.student, first = s.name.split(' ')[0];
  const inTerm = (d) => !!d && d >= TERM_START && d <= TODAY;
  const moments = map.events.filter((e) => inTerm(e.date) && e.type !== 'goal' && e.type !== 'reflection');
  const lines = map.lines.map((l) => ({
    id: l.id, name: l.name, colour: l.colour, status: l.status,
    moments: moments.filter((e) => e.lineIds.includes(l.id)),
    ever: map.events.filter((e) => e.type !== 'goal' && e.date <= TODAY && e.lineIds.includes(l.id)).length,
  })).map((l) => ({ ...l, count: l.moments.length }));
  const reflections = map.events.flatMap((e) => [
    ...e.reflections.map((r) => ({ id: r.id, text: r.text, prompt: r.prompt, date: r.date || e.date, title: e.title })),
    ...(e.type === 'reflection' && !e.reflections.length && e.summary ? [{ id: e.id, text: e.summary, date: e.date, title: e.title }] : []),
  ]).filter((r) => r.date <= TODAY).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const goals = map.events.filter((e) => e.type === 'goal' || (e.wasGoal && inTerm(e.date))).map((e) => {
    const d = days(TODAY, e.date);
    const status = e.type !== 'goal' ? 'Done' : d < 0 ? 'Past its date' : d <= 42 ? 'Due soon' : 'Planned';
    return { id: e.id, title: e.title, date: e.date, days: d, status, done: e.type !== 'goal', sponsor: e.sponsor?.status === 'accepted' ? e.sponsor.teacherId : null };
  }).sort((a, b) => a.done - b.done || a.date.localeCompare(b.date));
  const endorsements = map.events.flatMap((e) => e.endorsements.map((n) => ({ id: n.id, teacher: n.teacher?.name || 'A teacher', title: e.title, note: n.note, date: n.date })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const answers = map.events.filter((e) => e.source?.system === 'Class question' && inTerm(e.date))
    .map((e) => ({ id: e.id, question: e.reflections.find((r) => r.prompt)?.prompt || e.title, date: e.date }));
  const termRefl = reflections.filter((r) => inTerm(r.date)).length;
  const termEndorse = endorsements.filter((n) => inTerm(n.date)).length;
  const steps = sheetSteps(studentId, family);
  const staff = family ? null : {
    comments: map.events.reduce((n, e) => n + getMomentComments(e.id).length, 0),
    notes: getNotes(studentId).filter((n) => n !== steps?.note).slice(-2).reverse(),
    signals: map.signals.filter((g) => g.open).length,
  };
  const points = talkingPoints({
    first, moments: moments.length, reflections: termRefl, endorsements: termEndorse,
    lines: lines.filter((l) => l.status !== 'ended').map((l) => ({ name: l.name, count: l.count, ever: l.ever })),
    goals: goals.filter((g) => !g.done),
  });
  return { student: s, first, year: s.grade + 1, homeroom: s.homeroom || '', family, lines, moments, reflections, termRefl, goals, endorsements, termEndorse, answers, staff, points, prep: sheetPrep(studentId, family ? familyViewer(studentId) : 'advisor'), steps };
}


