// Milestones (docs/pilot-server.md "Milestones and celebrations"): worked out from a student's map as one viewer reads
// it (getStudentMap), never stored. Pure, so the unit tests and the server can load it. Only "seen" is kept in the record
// (api.markMilestonesSeen). Never a count against other students: each one is about this student's own journey.
export const COUNTS = [5, 10, 25];
export const STEADY_MONTHS = 3;
export const RECENT_DAYS = 14;
const ORDER = ['first', 'line', 'count', 'endorsed', 'goal', 'reflection', 'steady', 'spotted'];
const byDate = (a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id));

// map: { lines, events } (events with endorsements, as getStudentMap gives them). root(id): a branch's school line.
// line(id): a line not on this map (an ended or hidden one). → [{ key, kind, n?, date, eventId, eventTitle, lineId,
// lineName, colour, teacher? }], oldest first.
export function deriveMilestones(map, { today = '9999-12-31', root = (id) => id, line = () => null } = {}) {
  const lines = new Map((map?.lines || []).map((l) => [l.id, l]));
  const lineOf = (id) => { const r = root(id) || id; return lines.get(r) || line(r) || lines.get(id) || line(id) || { id: r, name: r, colour: null }; };
  const moments = (map?.events || []).filter((e) => e.type !== 'goal' && e.date && e.date <= today).sort(byDate);
  const out = [];
  const add = (key, kind, e, l = lineOf(e.lineIds?.[0]), extra = {}) => out.push({ key, kind, date: e.date, eventId: e.id, eventTitle: e.title, lineId: l.id, lineName: l.name, colour: l.colour || null, ...extra });
  if (moments[0]) add('first', 'first', moments[0]);
  const months = new Map();
  for (const e of moments) {
    for (const l of new Map((e.lineIds || []).map((id) => [lineOf(id).id, lineOf(id)])).values()) {
      if (!months.has(l.id)) { months.set(l.id, new Set()); add(`line:${l.id}`, 'line', e, l); }
      const m = months.get(l.id), had = m.size;
      m.add(e.date.slice(0, 7));
      if (had < STEADY_MONTHS && m.size === STEADY_MONTHS) add(`steady:${l.id}`, 'steady', e, l);
    }
  }
  for (const n of COUNTS) if (moments.length >= n) add(`count:${n}`, 'count', moments[n - 1], undefined, { n });
  const endorsed = moments.flatMap((e) => (e.endorsements || []).filter((x) => x.date && x.date <= today).map((x) => ({ e, x }))).sort((a, b) => a.x.date.localeCompare(b.x.date) || byDate(a.e, b.e))[0];
  if (endorsed) { add('endorsed', 'endorsed', endorsed.e, undefined, { teacher: endorsed.x.teacher?.name || null }); out.at(-1).date = endorsed.x.date; }
  const goal = moments.find((e) => e.wasGoal);
  if (goal) add('goal', 'goal', goal);
  const refl = moments.find((e) => e.type === 'reflection' && e.termReflection);
  if (refl) add('reflection', 'reflection', refl);
  const spot = moments.find((e) => e.spotted);
  if (spot) add('spotted', 'spotted', spot);
  return out.sort((a, b) => a.date.localeCompare(b.date) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (a.n || 0) - (b.n || 0));
}

// Newest day first; on one day in the order they happen (first moment, then its line, …).
export const newestFirst = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (a.n || 0) - (b.n || 0));
// Milestones dated on or after a day ('YYYY-MM-DD'), newest first.
export const since = (list, day) => newestFirst(list.filter((m) => m.date >= day));

// A short name for anyone reading it (student, advisor, family). nameOf: a line's name in that language.
const TITLE = {
  en: { first: () => 'First moment', line: (m, l) => `First moment on ${l}`, count: (m) => `${m.n} moments`, endorsed: () => 'First endorsement', goal: () => 'First goal done', reflection: () => 'Term reflection finished', steady: (m, l) => `Steady on ${l}`, spotted: () => 'First spotted moment added' },
  th: { first: () => 'ช่วงเวลาแรก', line: (m, l) => `ช่วงเวลาแรกในสาย ${l}`, count: (m) => `${m.n} ช่วงเวลา`, endorsed: () => 'การรับรองครั้งแรก', goal: () => 'ทำเป้าหมายแรกสำเร็จ', reflection: () => 'สะท้อนคิดประจำภาคเรียนเสร็จแล้ว', steady: (m, l) => `สม่ำเสมอในสาย ${l}`, spotted: () => 'เพิ่มช่วงเวลาที่ครูเห็นเป็นครั้งแรก' },
};
export const milestoneTitle = (m, lang = 'en', nameOf = (s) => s) => (TITLE[lang] || TITLE.en)[m.kind]?.(m, nameOf(m.lineName || '')) || m.kind;
// What the student reads when it happens, in plain words.
const CHEER = {
  first: () => 'Your journey has started!',
  line: (m) => `Your first moment on ${m.lineName}.`,
  count: (m) => `${m.n} moments on your journey!`,
  endorsed: (m) => `${m.teacher || 'A teacher'} checked “${m.eventTitle}”.`,
  goal: (m) => `You did “${m.eventTitle}”, the first goal you planned.`,
  reflection: () => 'You looked back on your term and finished your reflection.',
  steady: (m) => `You added to ${m.lineName} in ${STEADY_MONTHS} different months.`,
  spotted: (m) => `You added “${m.eventTitle}”, which a teacher spotted.`,
};
export const milestoneCheer = (m) => CHEER[m.kind]?.(m) || '';
