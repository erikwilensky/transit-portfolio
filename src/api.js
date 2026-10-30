// The only module that touches /data. Swap these functions for fetch() calls
// to a real read API later; components never import the JSON directly.
import studentsData from '../data/students.json';
import linesData from '../data/lines.json';
import eventsData from '../data/events.json';
import reflectionsData from '../data/reflections.json';
import endorsementsData from '../data/endorsements.json';
import teachersData from '../data/teachers.json';
import presentationsData from '../data/presentations.json';
import integrationsData from '../data/integrations.json';
import schoolData from '../data/school.json';
// Re-exported so the server bundle carries it (public verify codes); the server never loads src/.
export { verifyCode } from './format.js';
import { planRoster, parseRoster } from './imports/roster.js';
import { weekOf } from './week.js';
import { inferKind } from './notify-kinds.js';
export { notifyProblem, audienceOf as notifyAudience } from './notify-kinds.js';
// The server reads roster files with the same code (POST /api/admin/roster).
export { parseRoster, kindOfRoles } from './imports/roster.js';

// The demo's story is set on one day. A pilot runs on the real calendar (Bangkok): useLiveDate() switches
// TODAY to today's date and keeps it current (the server at start in pilot mode, the browser once signed in).
export let TODAY = '2026-10-26';
export const liveDate = () => !!clock;
// The date n days before TODAY.
export const daysBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
let clock = null;
export function useLiveDate(tz = 'Asia/Bangkok') {
  const tick = () => { TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); };
  tick(); clearInterval(clock); clock = setInterval(tick, 60000); clock.unref?.();
}

// In-memory store so the demo can "sync" new items. A reload resets it.
const store = {
  events: [...eventsData],
  pending: [...integrationsData.pending],
  inbox: [],      // synced, waiting for the student's decision
  dismissed: [],  // skipped by the student (can be undone)
  integrations: integrationsData.integrations.map((i) => ({ ...i })),
  reflections: reflectionsData.map((r) => ({ ...r })),
  endorsements: endorsementsData.map((n) => ({ ...n })),
  students: structuredClone(studentsData),
  teachers: structuredClone(teachersData), // staff records; the pilot adds real ones with addTeacher or importRoster
  classes: [],        // from the school's roster: { id, name, subject, year, level, teacherIds, lineId }
  enrolments: [],     // { studentId, classId, from, to }
  subjectLines: {},   // subject → the school line its classes go on (null: left off the map), api.setSubjectLine
  lines: structuredClone(linesData),
  requests: structuredClone(schoolData.requests),
  prompts: structuredClone(schoolData.prompts),
  notes: structuredClone(schoolData.notes),
  applications: structuredClone(schoolData.applications),
  activity: [],       // live actions taken during the demo
  notifications: [],  // per persona
  linkViews: {},      // token → extra views during the demo
  comments: [],       // counsellor comments on drafts
  evidenceRequests: [],
  answered: {},       // signal key → reflection id
  // Presentations per student (drafts, letters, custom pages, share links), edited in the studio.
  drafts: Object.fromEntries(studentsData.filter((st) => !st.cohortOnly).map((st) => [st.id, structuredClone(presentationsData.filter((p) => p.studentId === st.id))])),
};
const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => { listeners.forEach((fn) => fn()); persist(); };

const lineById = (id) => store.lines.find((l) => l.id === id);
// Looks staff up in the live record, so a teacher added in the pilot (or restored from a save) is found.
const teacherList = () => store.teachers || teachersData;
const teacherById = new Proxy({}, { get: (_, id) => teacherList().find((t) => t.id === id) });

export const getStudents = ({ includeCohort = false } = {}) => store.students.filter((s) => includeCohort || !s.cohortOnly);
export const getStudent = (id) => store.students.find((s) => s.id === id);
export const getTeacher = (id) => teacherById[id];
export const getTeachers = () => teacherList();

// ── Pilot: real people join the record. A new student starts with an empty map and the onboarding flow. ─
// Years are British (7 to 13); student.grade is the US grade number, so Year = grade + 1.
// Passing an id that already exists returns that record unchanged (safe to repeat).
const AVATAR_COLOURS = ['#4F529B', '#008A60', '#E73C3E', '#FF8F1C', '#002855', '#FFB81C', '#78D5E1'];
const initialsOf = (name) => name.replace(/^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+/i, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const nextId = (prefix, list) => `${prefix}-${String(Math.max(0, ...list.map((x) => Number(x.id.slice(prefix.length + 1)) || 0)) + 1).padStart(2, '0')}`;
// A new student's presentations, one per audience, empty until they fill them in. Ids come from the
// student id, so a replay on the server makes the same ones.
const STARTER_PRES = [['general', 'metro', 'profile', 'my journey'], ['university', 'nist', 'narrative', 'portfolio'], ['specific', 'nist', 'letter', 'why this course'], ['employer', 'nist', 'cv', 'projects and experience'], ['scholarship', 'nist', 'impact', 'contribution and impact'], ['custom', 'metro', 'custom', 'my page']];
const starterDrafts = (s) => STARTER_PRES.map(([audience, theme, layout, t]) => ({ id: `pr-${s.id}-${audience}`, studentId: s.id, audience, targetName: null, tier: audience === 'custom' ? 'builder' : 'template', title: `${s.name}: ${t}`, filters: { hiddenLines: [] }, order: null, theme, layout, showMap: audience === 'general', narratives: {}, shareLinks: [],
  ...(audience === 'specific' ? { institution: '', focusLines: [], whyCourse: '' } : audience === 'employer' ? { intro: '', skills: [] } : audience === 'scholarship' ? { intro: '' } : audience === 'custom' ? { design: null } : {}) }));
const seedDrafts = (s) => { store.drafts ||= {}; if (!store.drafts[s.id]?.length) store.drafts[s.id] = starterDrafts(s); };
export function addStudent(f) {
  const { id, name, year, programme, homeroom = '', advisorId = null } = f;
  if (id && getStudent(id)) return getStudent(id);
  // A whole record copied from the server (it already has a grade) goes in as it is.
  if (id && Number.isInteger(f.grade)) { const copy = structuredClone(f); store.students.push(copy); (store.drafts ||= {})[id] ||= []; emit(); return copy; }
  const grade = Math.min(12, Math.max(6, Number(year) - 1));
  const s = { id: id || nextId('st', store.students), name, grade, startGrade: grade, programme: programme || (grade >= 11 ? 'IB Diploma' : 'IB MYP'),
    avatar: { initials: initialsOf(name), colour: AVATAR_COLOURS[store.students.length % AVATAR_COLOURS.length] },
    homeroom, advisorId, g9StartYear: 2026 - (grade - 9), laneOrder: [], lineLabels: {}, onboarding: true, pilot: true };
  store.students.push(s);
  (store.drafts ||= {})[s.id] ||= [];
  emit();
  return s;
}
export function addTeacher({ id, name, role = 'Teacher' }) {
  if (id && getTeacher(id)) return getTeacher(id);
  store.teachers ||= structuredClone(teachersData);
  const t = { id: id || nextId('t', store.teachers), name, role, pilot: true };
  store.teachers.push(t);
  emit();
  return t;
}
// ── Pilot: the school's class lists (src/imports/roster.js, docs/roster-format.md) ──
// Ids are the school's own (SIS) ids, so a new export updates the same records. Nobody is ever removed:
// people missing from the file are listed in the summary for an admin to deal with.
const rosterCurrent = () => ({ students: store.students, teachers: teacherList(), classes: store.classes || [], enrolments: store.enrolments || [] });
const rosterOpts = () => ({ lineIds: getSchoolLines().map((l) => l.id), today: TODAY, subjectLines: getSubjectLines() });
const checked = (r) => { const p = parseRoster(r); if (p.errors.length) throw Object.assign(new Error(`The roster has problems: ${p.errors.slice(0, 3).join(' ')}`), { status: 400, errors: p.errors }); return p.roster; };
export const previewRoster = (roster) => planRoster(checked(roster), rosterCurrent(), rosterOpts()).summary;
export function importRoster(parsed) {
  const roster = checked(parsed);
  const { writes, summary } = planRoster(roster, rosterCurrent(), rosterOpts());
  store.teachers ||= structuredClone(teachersData); store.classes ||= []; store.enrolments ||= []; store.drafts ||= {};
  const wasAdvisor = new Map(store.students.map((x) => [x.id, x.advisorId])), wasYear = store.rosterImport?.school?.academicYear; // year handover
  // Indexed, so a whole school (about 1,000 students and 10,000 class places) imports in well under a second.
  const upsert = (list, ws, key = (x) => x.id, wkey = (w) => w.id) => {
    const at = new Map(list.map((x) => [key(x), x]));
    for (const w of ws) { const old = at.get(wkey(w)); if (old) Object.assign(old, w.rec); else { list.push(w.rec); at.set(wkey(w), w.rec); } }
  };
  upsert(store.teachers, writes.teachers); upsert(store.students, writes.students); upsert(store.classes, writes.classes);
  for (const w of writes.students) store.drafts[w.id] ||= []; // presentations come at onboarding (completeOnboarding)
  const pair = (e) => `${e.studentId}|${e.classId}`;
  upsert(store.enrolments, writes.enrolments, pair, (w) => pair(w.rec));
  const ends = new Map(writes.endEnrolments.map((x) => [pair(x), x.to]));
  if (ends.size) for (const e of store.enrolments) if (ends.has(pair(e))) e.to = ends.get(pair(e));
  store.rosterImport = { school: roster.school, at: nowIso(), summary };
  noteHandovers(wasAdvisor, wasYear, roster);
  emit();
  return summary;
}
export const getClasses = () => store.classes || [];
export const getEnrolments = () => store.enrolments || [];
// The teachers a student works with this year: their classes' teachers (with each class's line), then their
// advisor. Empty for a student with no class list (the demo), so screens keep their own suggestions.
export function teachersOf(studentId) {
  const classes = new Map(getClasses().map((c) => [c.id, c]));
  const out = new Map();
  for (const e of getEnrolments()) {
    if (e.studentId !== studentId || (e.to && e.to < TODAY)) continue;
    const c = classes.get(e.classId);
    for (const tid of c?.teacherIds || []) if (getTeacher(tid) && !out.has(tid)) out.set(tid, { teacher: getTeacher(tid), lineId: c.lineId, className: c.name });
  }
  const adv = getStudent(studentId)?.advisorId;
  if (out.size && adv && getTeacher(adv) && !out.has(adv)) out.set(adv, { teacher: getTeacher(adv), lineId: null, className: 'Advisor' });
  return [...out.values()];
}
// Whom a student can ask (to endorse, to sponsor): the teachers they work with, else the screen's own
// list (the demo's), else every teacher. The first of them who teaches on one of lineIds comes first.
export function endorserChoices(studentId, fallbackIds = [], lineIds = []) {
  const mine = teachersOf(studentId);
  if (mine.length) return [...mine.filter((m) => lineIds.includes(m.lineId)), ...mine.filter((m) => !lineIds.includes(m.lineId))].map((m) => m.teacher).filter((t, i, a) => a.indexOf(t) === i);
  const fall = getTeachers().filter((t) => fallbackIds.includes(t.id));
  return fall.length ? fall : getTeachers();
}
// The school line a teacher mostly teaches on (from their classes), or null.
export function subjectLineOf(teacherId) {
  const n = new Map(); for (const c of getClasses()) if (c.lineId && c.teacherIds?.includes(teacherId)) n.set(c.lineId, (n.get(c.lineId) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
// An advisor's group, named after the homeroom most of their advisees share ("Advisory 12B").
export function advisoryOf(advisorId) {
  const kids = store.students.filter((s) => s.advisorId === advisorId);
  const count = new Map(); for (const s of kids) if (s.homeroom) count.set(s.homeroom, (count.get(s.homeroom) || 0) + 1);
  const homeroom = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
  const years = kids.map((s) => s.grade + 1);
  return { name: homeroom ? `Advisory ${homeroom}` : 'My advisory', minYear: Math.min(...years), maxYear: Math.max(...years), size: kids.length };
}
export const getLine = (id) => lineById(id);
export const getSchoolLines = () => store.lines.filter((l) => !l.studentId);
export const getAllLines = () => store.lines;
export const getEvent = (id) => store.events.find((e) => e.id === id);
export const getStore = () => store;

// The visibility levels each viewer may read. Enforced here, not in the UI.
export const VISIBLE_TO = {
  student: ['private', 'advisor', 'school', 'publishable'],
  advisor: ['advisor', 'school', 'publishable'],
  school: ['school', 'publishable'],
  public: ['publishable'],
};

// opts.family: a family's view. A moment a teacher hid after a report (moderateReport) stays only with the student and
// staff: families, the school-wide and public views leave it out.
export function getStudentMap(studentId, viewer = 'student', opts = {}) {
  const student = getStudent(studentId);
  const allowed = VISIBLE_TO[viewer];
  const noHidden = opts.family || viewer === 'school' || viewer === 'public';
  const events = store.events
    .filter((e) => e.studentId === studentId && allowed.includes(e.visibility) && !(noHidden && e.hidden) && !(e.type === 'goal' && e.closedOn))
    .map((e) => ({
      ...e,
      // Reflections carry their own visibility (private by default).
      reflections: store.reflections.filter((r) => r.eventId === e.id && allowed.includes(r.visibility || 'private')),
      endorsements: store.endorsements.filter((n) => n.eventId === e.id).map((n) => ({ ...n, teacher: teacherById[n.teacherId] })),
      tags: getTags(e),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lines = student.laneOrder.map((id) => { const l = lineById(id); return { ...l, name: student.lineLabels?.[id] || l.name, status: student.lineStatus?.[id] || l.status }; })
    .filter((l) => viewer === 'student' || l.status !== 'ended' || events.some((e) => e.lineIds.includes(l.id)));
  return { student, lines, events, signals: viewer === 'student' || viewer === 'advisor' ? getSignals(studentId, lines) : [] };
}

export const getPresentations = (studentId) => presentationsData.filter((p) => p.studentId === studentId);
export const getDrafts = () => store.drafts;
export function setStudentDrafts(studentId, list) { store.drafts[studentId] = list; emit(); }
export const getPresentation = (id) => presentationsData.find((p) => p.id === id);

// ── Lenses ────────────────────────────────────────────────────────────
// A lens only selects, orders and frames verified data. It returns which
// lines are full / thin / hidden and which stations are shown.
export const LENSES = {
  general: { label: 'General', blurb: 'All active lines, balanced.' },
  university: { label: 'University', blurb: 'Academic depth, independent projects and reflection. Minor clubs and routine classes collapse.' },
  specific: { label: 'Specific university', blurb: 'Lines that match the target course in full; everything else becomes thin context.' },
  employer: { label: 'Employer', blurb: 'Projects, skills and responsibility. Grades are hidden by default.' },
  scholarship: { label: 'Scholarship', blurb: 'Service, impact and leadership as a timeline. Unrelated activities drop out.' },
  custom: { label: 'Custom', blurb: 'Design your own page: pick a theme or make one, add blocks, drag them into place and resize them. Verified stations can be placed, never edited.' },
};
const IMPACT_TYPES = ['service', 'cas', 'award', 'competition'];

export function applyLens(map, pres, { hiddenLines = [] } = {}) {
  const lens = pres?.audience || 'general';
  const lineState = {};
  for (const l of map.lines) lineState[l.id] = hiddenLines.includes(l.id) ? 'hidden' : 'full';
  if (lens === 'university') {
    for (const l of map.lines) if (lineState[l.id] === 'full' && (l.parentLineId === 'sport' || l.id === 'sport')) lineState[l.id] = 'thin';
  }
  if (lens === 'scholarship') {
    for (const l of map.lines) if (lineState[l.id] === 'full' && l.id !== 'service' && l.id !== 'environment') lineState[l.id] = 'thin';
  }
  if (lens === 'specific') {
    const focus = pres.focusLines || [];
    for (const l of map.lines) if (lineState[l.id] === 'full' && !focus.includes(l.id)) lineState[l.id] = 'thin';
  }
  const visible = new Set();
  for (const e of map.events) {
    if (!e.lineIds.some((id) => lineState[id] && lineState[id] !== 'hidden')) continue;
    const isInterchange = e.lineIds.filter((id) => lineState[id] && lineState[id] !== 'hidden').length > 1;
    if (lens === 'university' && (e.type === 'club' || e.type === 'class') && !isInterchange && !e.reflections?.length) continue;
    if (lens === 'employer' && (e.type === 'assessment' || e.type === 'class')) continue;
    if (lens === 'scholarship' && !(IMPACT_TYPES.includes(e.type) || e.lineIds.includes('service') || e.endorsements?.length)) continue;
    visible.add(e.id);
  }
  let order = pres?.order || map.lines.map((l) => l.id);
  order = [...order.filter((id) => lineState[id]), ...map.lines.map((l) => l.id).filter((id) => !order.includes(id))];
  return { lineState, visible, order };
}

// The JSON a Tier 3 student gets from the read API for one presentation.
export function exportPresentation(pres, map, lensResult) {
  return {
    presentation: { id: pres.id, title: pres.title, audience: pres.audience, targetName: pres.targetName || null, theme: pres.theme, layout: pres.layout },
    student: { id: map.student.id, name: map.student.name, grade: map.student.grade, programme: map.student.programme },
    lines: lensResult.order.filter((id) => lensResult.lineState[id] !== 'hidden').map((id) => {
      const l = map.lines.find((x) => x.id === id);
      return { id, name: l.name, colour: l.colour, parentLineId: l.parentLineId, status: l.status, emphasis: lensResult.lineState[id], narrative: pres.narratives?.[id] || null };
    }),
    stations: map.events.filter((e) => lensResult.visible.has(e.id)).map((e) => ({
      id: e.id, title: e.title, date: e.date, lineIds: e.lineIds.filter((id) => lensResult.lineState[id] !== 'hidden'), type: e.type,
      summary: e.summary, about: e.about, verification: e.verification, evidence: e.evidence, source: e.source.system,
      endorsements: e.endorsements.map((n) => ({ teacher: n.teacher?.name, note: n.note, date: n.date })),
    })),
  };
}

// ── Integrations ──────────────────────────────────────────────────────
export const getIntegrations = (studentId) => store.integrations.map((i) => ({
  ...i, pendingForStudent: store.pending.filter((p) => p.sourceId === i.id && p.event.studentId === studentId && ghAllowed(p)).length,
}));

// Sync pulls new items into the student's inbox. Nothing reaches the map
// until the student accepts it and chooses its line(s).
export function sync(sourceIds, studentId) {
  const now = nowIso();
  const arrived = [];
  store.pending = store.pending.filter((p) => {
    if (sourceIds.includes(p.sourceId) && p.event.studentId === studentId && ghAllowed(p)) { arrived.push({ ...p.event, sourceId: p.sourceId, suggestedLineIds: p.event.lineIds }); return false; }
    return true;
  });
  store.inbox.push(...arrived);
  for (const i of store.integrations) if (sourceIds.includes(i.id)) {
    i.lastSynced = now;
    i.itemCount += arrived.filter((e) => e.sourceId === i.id).length;
  }
  emit();
  return arrived;
}
export const getInbox = (studentId) => store.inbox.filter((e) => e.studentId === studentId)
  .sort((a, b) => (b.suggestedLineIds.length > 0) - (a.suggestedLineIds.length > 0) || b.date.localeCompare(a.date));
export const getDismissed = (studentId) => store.dismissed.filter((e) => e.studentId === studentId);

export function acceptCandidate(id, lineIds, visibility = 'advisor') {
  const c = store.inbox.find((e) => e.id === id);
  if (!c || !lineIds.length) return null;
  store.inbox = store.inbox.filter((e) => e.id !== id);
  const { sourceId, suggestedLineIds, quickReflection, classEndorsement, ...event } = c;
  const added = { ...event, lineIds, visibility };
  store.events.push(added);
  // N12: a class task arrives already endorsed by the teacher; the endorsement joins the station when the student accepts it.
  if (classEndorsement) store.endorsements.push({ id: uid('en-x'), eventId: added.id, teacherId: classEndorsement.teacherId, note: classEndorsement.note, date: classEndorsement.date, live: true });
  if (quickReflection) store.reflections.push({ id: uid('rf-x'), eventId: added.id, text: quickReflection, prompt: 'Quick reflection', date: added.date, visibility: 'advisor' });
  log(added.studentId, getStudent(added.studentId).name, 'station', `Accepted “${added.title}” from the inbox`);
  emit();
  return added;
}
export function dismissCandidate(id) {
  const c = store.inbox.find((e) => e.id === id);
  if (!c) return;
  store.inbox = store.inbox.filter((e) => e.id !== id);
  store.dismissed.push(c);
  emit();
}
export function restoreCandidate(id) {
  const c = store.dismissed.find((e) => e.id === id);
  if (!c) return;
  store.dismissed = store.dismissed.filter((e) => e.id !== id);
  store.inbox.push(c);
  emit();
}

// ── Real imports: items parsed from an export file (src/imports/) land in the inbox, like a sync.
// Arguments are plain JSON so the server can replay the call. The student still decides each item.
const IMPORT_CARDS = {
  classroom: { name: 'Google Classroom', detail: 'Assignments and marks', mode: 'File import' },
  csv: { name: 'Spreadsheets', detail: 'Our template, filled in by staff', mode: 'File import' },
  calendar: { name: 'Calendars', detail: 'Fixtures and events (.ics)', mode: 'File import' },
};
// The most an import from each source can claim. A student's own file is never more than student-added.
const IMPORT_MAX = { mine: 'student-added', csv: 'teacher-endorsed', calendar: 'school-verified' };
const IMPORT_RANK = { 'student-added': 0, 'teacher-endorsed': 1, 'school-verified': 2 };
const IMPORT_TYPES = ['class', 'assessment', 'project', 'competition', 'cas', 'club', 'sport', 'service', 'award'];
const importKey = (studentId, src) => `${studentId}|${src?.system}|${src?.ref}`;
export function importCandidates(rows, { sourceId, by, file } = {}) {
  const max = IMPORT_RANK[IMPORT_MAX[sourceId] || 'school-verified'];
  const seen = new Set([...store.inbox, ...store.dismissed, ...store.events].flatMap((e) => [importKey(e.studentId, e.source), e.id, ...(e.mergedFrom || []).map((m) => importKey(e.studentId, m))]));
  const added = []; let duplicates = 0, refused = 0;
  for (const c of Array.isArray(rows) ? rows : []) {
    const st = getStudent(c?.studentId);
    if (!st || !c.title || !c.source?.ref || !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) { refused++; continue; }
    if (seen.has(importKey(st.id, c.source)) || seen.has(c.id)) { duplicates++; continue; }
    let verification = IMPORT_RANK[c.verification] <= max ? c.verification : Object.keys(IMPORT_RANK)[max];
    const endorsement = verification === 'teacher-endorsed' && teacherById[c.classEndorsement?.teacherId] ? { teacherId: c.classEndorsement.teacherId, note: String(c.classEndorsement.note || '').slice(0, 300), date: TODAY } : null;
    if (verification === 'teacher-endorsed' && !endorsement) verification = 'student-added';
    const e = {
      id: String(c.id || uid('ev-')), studentId: st.id, title: String(c.title).slice(0, 140), date: c.date, lineIds: [],
      suggestedLineIds: (c.suggestedLineIds || []).filter((id) => st.laneOrder.includes(id)),
      type: IMPORT_TYPES.includes(c.type) ? c.type : 'project', summary: String(c.summary || '').slice(0, 600),
      evidence: (c.evidence || []).filter((v) => v.kind === 'grade' || (v.kind === 'link' && /^https?:\/\//i.test(v.url || ''))).map((v) => ({ kind: v.kind, url: v.kind === 'link' ? String(v.url) : null, caption: String(v.caption || '').slice(0, 140) })),
      verification, visibility: 'advisor', source: { system: String(c.source.system || 'Import'), ref: String(c.source.ref) }, sourceId: sourceId || c.sourceId || 'import',
      ...(c.cas && ['C', 'A', 'S'].includes(c.cas.strand) ? { cas: { strand: c.cas.strand, outcomes: (c.cas.outcomes || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) } } : {}),
      ...(c.quickReflection ? { quickReflection: String(c.quickReflection).slice(0, 4000) } : {}),
      ...(endorsement ? { classEndorsement: endorsement } : {}),
    };
    seen.add(importKey(st.id, e.source)); seen.add(e.id);
    added.push(e);
  }
  store.inbox.push(...added);
  const byStudent = {};
  for (const e of added) byStudent[e.studentId] = (byStudent[e.studentId] || 0) + 1;
  const system = added[0]?.source.system || 'a file';
  const actor = by?.name || 'File import';
  for (const [sid, n] of Object.entries(byStudent)) {
    const items = `${n} item${n === 1 ? '' : 's'}`;
    if (sourceId === 'mine') log(sid, actor, 'sync', `Imported ${items} from ${file || 'a file'} into the inbox`);
    else {
      log(sid, actor, 'sync', `Imported ${items} from ${system}${file ? ` (${file})` : ''} into the inbox`);
      notify(toStudent(sid), `${items} from ${system} ${n === 1 ? 'is' : 'are'} in your inbox. You choose where ${n === 1 ? 'it goes' : 'they go'}.`, { persona: toStudent(sid), screen: 'inbox' });
    }
  }
  if (sourceId && sourceId !== 'mine') {
    let card = store.integrations.find((i) => i.id === sourceId);
    if (!card && IMPORT_CARDS[sourceId]) store.integrations.push(card = { id: sourceId, ...IMPORT_CARDS[sourceId], lastSynced: nowIso(), itemCount: 0 });
    if (card) { card.lastSynced = nowIso(); card.itemCount += added.length; }
  }
  emit();
  return { added: added.length, duplicates, refused, students: Object.keys(byStudent).length, byStudent };
}

// F11: GitHub is opt-in per repository, and "Simulate next week" gives every system something new to send.
const GH_SEED = {
  'st-01': { connected: true, user: 'mayachen-nist', repos: [
    { name: 'air-quality-dashboard', about: 'PM2.5 dashboard for the canteen roof sensors', ref: 'repo-aq', shared: true },
    { name: 'tmd-weather-api', about: 'Fork: Thai Meteorological Department feed reader', ref: 'fork-tmd-api', shared: true },
    { name: 'ee-algae-models', about: 'Extended Essay notebooks', ref: 'repo-ee', shared: false },
    { name: 'dotfiles', about: 'Editor settings', ref: 'repo-dot', shared: false },
  ] },
  'st-02': { connected: false, user: 'arun-makes-noise', repos: [
    { name: 'midi-looper', about: 'Arduino MIDI looper pedal', ref: 'repo-midi', shared: false },
    { name: 'french-flashcards', about: 'Spaced-repetition app for DELF vocab', ref: 'repo-fr', shared: false },
    { name: 'game-jam-2026', about: 'Global Game Jam entry', ref: 'repo-jam', shared: false },
  ] },
  'st-03': { connected: false, user: 'lenaf', repos: [
    { name: 'kanji-tracker', about: 'Tracks JLPT N4 kanji', ref: 'repo-kanji', shared: false },
    { name: 'glaze-log', about: 'Spreadsheet of kiln firings', ref: 'repo-glaze', shared: false },
  ] },
};
if (!store.github) store.github = structuredClone(GH_SEED);
const ghRepo = (studentId, ref) => store.github[studentId]?.repos.find((r) => ref?.startsWith(r.ref));
// A GitHub item only counts as pending once the student has shared its repository.
export const ghAllowed = (p) => p.sourceId !== 'github' || (store.github[p.event.studentId]?.connected && ghRepo(p.event.studentId, p.event.source.ref)?.shared);
export const getGithub = (studentId) => store.github[studentId] || null;
export function setGithub(studentId, shared) {
  const g = store.github[studentId]; if (!g) return;
  const was = g.connected;
  g.connected = true;
  for (const r of g.repos) r.shared = shared.includes(r.name);
  log(studentId, getStudent(studentId).name, 'sync', was ? `Changed shared GitHub repositories (${shared.length} shared)` : `Connected GitHub and shared ${shared.length} repositor${shared.length === 1 ? 'y' : 'ies'}`);
  emit();
}
export function disconnectGithub(studentId) {
  const g = store.github[studentId]; if (!g) return;
  g.connected = false; for (const r of g.repos) r.shared = false;
  store.pending = store.pending.filter((p) => !(p.sourceId === 'github' && p.event.studentId === studentId));
  log(studentId, getStudent(studentId).name, 'sync', 'Disconnected GitHub. Nothing more arrives from it.');
  emit();
}

const SIM = {
  sis: [
    { title: 'Term 1 report: effort grades', type: 'assessment', lines: ['science', 'languages', 'music'], summary: 'Term 1 effort grades published to the SIS.' },
    { title: 'Timetable change: new elective', type: 'class', lines: ['design', 'art', 'computing'], summary: 'Joined a new elective block from next week.' },
  ],
  lms: [
    { title: 'Lab report returned with feedback', type: 'assessment', lines: ['science', 'maya-datasci'], summary: 'Teacher feedback on the latest lab report.' },
    { title: 'Unit project submitted', type: 'project', lines: ['computing', 'design', 'art'], summary: 'Submitted the end-of-unit project on ManageBac.' },
    { title: 'Oral assessment recorded', type: 'assessment', lines: ['languages', 'arun-french', 'lena-japanese'], summary: 'Individual oral recorded and uploaded.' },
  ],
  cas: [
    { title: 'CAS: beach clean-up, 3 hours', type: 'cas', lines: ['service', 'environment'], summary: 'Logged 3 service hours with the Beach Guardians.' },
    { title: 'CAS: reading buddies session', type: 'cas', lines: ['service', 'languages'], summary: 'Read with Year 3 pupils for an hour.' },
  ],
  clubs: [
    { title: 'Fixture: inter-school match', type: 'sport', lines: ['sport', 'maya-swim'], summary: 'Played in the inter-school fixture on Saturday.' },
    { title: 'Club: robotics build night', type: 'club', lines: ['computing', 'design'], summary: 'Attended the after-school robotics build night.' },
    { title: 'Ensemble rehearsal: winter concert', type: 'club', lines: ['music', 'arun-musictech'], summary: 'Rehearsal for the winter concert set list.' },
  ],
  exams: [
    { title: 'Mock exam results released', type: 'assessment', lines: ['science', 'languages', 'computing'], summary: 'Results from the October mock series.' },
  ],
  github: [
    { title: 'Pushed {repo}: new release', type: 'project', lines: ['computing', 'maya-datasci', 'arun-musictech'], summary: 'Tagged a new release of {repo}.' },
    { title: 'Merged a pull request in {repo}', type: 'project', lines: ['computing', 'design'], summary: 'Reviewed and merged a contribution to {repo}.' },
  ],
};
const VER = { sis: 'school-verified', lms: 'school-verified', cas: 'school-verified', clubs: 'school-verified', exams: 'school-verified', github: 'student-added' };
const SYS = { sis: 'SIS', lms: 'ManageBac', cas: 'CAS log', clubs: 'Clubs & Sports', exams: 'Exam boards', github: 'GitHub' };
if (!store.simWeeks) store.simWeeks = {};
// One new item per system, dated in the past week, with lines suggested from the student's own lines.
export function simulateWeek(studentId) {
  const st = getStudent(studentId);
  const wk = store.simWeeks[studentId] = (store.simWeeks[studentId] || 0) + 1;
  const made = [];
  for (const [sys, pool] of Object.entries(SIM)) {
    const t = pool[(wk - 1) % pool.length];
    let repo = null;
    if (sys === 'github') { const shared = (store.github[studentId]?.connected && store.github[studentId].repos.filter((r) => r.shared)) || []; if (!shared.length) continue; repo = shared[(wk - 1) % shared.length]; }
    const date = new Date(new Date(TODAY).getTime() - ((made.length * 2 + wk) % 7) * 86400000).toISOString().slice(0, 10);
    const fill = (x) => x.replace('{repo}', repo?.name || '');
    const event = { id: `ev-sim-${studentId}-${wk}-${sys}`, studentId, title: fill(t.title), date, lineIds: t.lines.filter((l) => st.laneOrder.includes(l)).slice(0, 1), type: t.type, summary: fill(t.summary), evidence: [], verification: VER[sys], visibility: 'advisor', source: { system: SYS[sys], ref: repo ? `${repo.ref}@sim${wk}` : `sim-${sys}-${wk}` } };
    store.pending.push({ sourceId: sys, event });
    made.push(event);
  }
  emit();
  return made;
}

// F12: the CAS coordinator nudges a student about a gap, and keeps each CAS project's status.
if (!store.casProjects) store.casProjects = { 'st-01': { status: 'Complete', title: 'Friday STEM club for Y7 girls' }, 'st-02': { status: 'Planning', title: 'Sound desk crew for school events' }, 'st-04': { status: 'In progress', title: 'Coaching junior football' }, 'st-05': { status: 'Complete', title: 'Community art workshop' }, 'st-07': { status: 'Not started', title: '' }, 'st-08': { status: 'In progress', title: 'Campus garden' } };
if (!store.casNudges) store.casNudges = [];
export const CAS_STATUSES = ['Not started', 'Planning', 'In progress', 'Complete'];
export const getCasProject = (sid) => store.casProjects[sid] || { status: 'Not started', title: '' };
export function setCasProject(sid, status, title, by) {
  const was = getCasProject(sid).status;
  store.casProjects[sid] = { status, title, updated: TODAY };
  log(sid, by, 'goal', `CAS project${title ? ` “${title}”` : ''}: ${was} → ${status}`);
  if (was !== status) notify(toStudent(sid), `${by} marked your CAS project as ${status.toLowerCase()}`, { persona: toStudent(sid), screen: 'map' });
  emit();
}
export const getCasNudges = (sid) => store.casNudges.filter((n) => n.studentId === sid);
export function casNudge(sid, about, text, by) {
  store.casNudges.push({ id: uid('cn-'), studentId: sid, about, text, by, date: TODAY });
  notify(toStudent(sid), `${by}: ${text}`, { persona: toStudent(sid), screen: 'map' }, 'teacher');
  log(sid, by, 'prompt', `CAS nudge about ${about}: “${text}”`);
  emit();
}

// F13: reference letters are kept per student, with a status the application tracker can read.
if (!store.letters) store.letters = {};
export const LETTER_STATUSES = ['Draft', 'Ready', 'Sent'];
export const getLetter = (sid) => store.letters[sid] || null;
export function saveLetter(sid, text) {
  const l = store.letters[sid] || (store.letters[sid] = { status: 'Draft' });
  l.text = text; l.savedAt = nowIso();
  emit();
}
export function setLetterStatus(sid, status, by) {
  const l = store.letters[sid] || (store.letters[sid] = { status: 'Draft' });
  if (l.status === status) return;
  l.status = status; if (status === 'Sent') l.sentOn = TODAY;
  log(sid, by, 'link', `Reference letter marked ${status.toLowerCase()}`);
  emit();
}

// F15: two Clubs & Sports CSV rows that did not match a student. Leadership (or the registrar) matches them by hand.
if (!store.roster) store.roster = [
  { id: 'rm-1', raw: 'CHEN, M. · Swim U18 · 4x100 relay', file: 'fixtures-2026-10-24.csv', row: 41, suggest: 'st-01', title: 'Relay: inter-school gala, 2nd', type: 'sport', lines: ['maya-swim'], matched: null },
  { id: 'rm-2', raw: 'OKOYE S · Eco Club · term roster', file: 'clubs-roster-t1.csv', row: 12, suggest: 'st-08', title: 'Eco Club: term 1 roster', type: 'club', lines: ['environment'], matched: null },
];
export const getRoster = () => store.roster;
export function matchRoster(id, studentId, by) {
  const r = store.roster.find((x) => x.id === id); if (!r || r.matched) return;
  r.matched = studentId;
  const st = getStudent(studentId);
  store.pending.push({ sourceId: 'clubs', event: { id: `ev-rm-${id}`, studentId, title: r.title, date: '2026-10-24', lineIds: r.lines.filter((l) => st.laneOrder.includes(l)), type: r.type, summary: `From ${r.file}, row ${r.row}, matched by hand.`, evidence: [], verification: 'school-verified', visibility: 'advisor', source: { system: 'Clubs & Sports', ref: `${r.file}#${r.row}` } } });
  log(studentId, by, 'sync', `Matched roster row “${r.raw}” to ${st.name}`);
  emit();
}

// Q1: the rollout planner's choices, so the tour can end on that exact proposal.
if (!store.rollout) store.rollout = { systems: ['sis', 'mb'], years: [12, 13], start: '2027-08', devs: 2 };
export const getRollout = () => store.rollout;
export function setRollout(patch) { Object.assign(store.rollout, patch); emit(); }

// ── N1: families. Consent for Years 7 to 9, and what a family can see ──
if (!store.consentReqs) store.consentReqs = [
  { id: 'cr-1', studentId: 'st-09', kind: 'join', title: 'Pim’s record in Transit Portfolio', detail: 'Keep Pim’s school activities in one record. Pim, her advisor and you can see it; nothing leaves the school.', asked: '2026-10-20', status: 'pending' },
  { id: 'cr-2', studentId: 'st-09', kind: 'share', title: 'Share links outside the school', detail: 'Let Pim make share links, for example for a summer camp application. Every link expires, and each one appears in your weekly digest.', asked: '2026-10-20', status: 'pending' },
  { id: 'cr-3', studentId: 'st-09', kind: 'photos', title: 'Photos where Pim can be recognised', detail: 'Allow photos of Pim to appear as evidence on her stations. Off unless you say yes.', asked: '2026-10-20', status: 'pending' },
];
if (!store.family) store.family = { lang: 'en', email: true };
if (!store.tags) store.tags = {};
if (!store.intensity) store.intensity = {};
if (!store.classTasks) store.classTasks = [
  { id: 'ct-1', teacherId: 't-01', title: 'CS: algorithms problem set 3', ref: 'mb-cs-ps3', due: '2026-10-20', type: 'assessment', summary: 'Searching and sorting: complexity analysis and a timed implementation task.', submitted: ['st-01', 'st-02', 'st-07'], late: [] },
  { id: 'ct-2', teacherId: 't-01', title: 'CS: sorting visualiser project', ref: 'mb-cs-viz', due: '2026-10-24', type: 'project', summary: 'An interactive page that animates three sorting algorithms side by side.', submitted: ['st-01', 'st-02'], late: ['st-07'] },
];
// ── N9: life after Year 13. Maya in March 2029, two years after NIST, still adding to the record she took with her.
export const ALUM = { studentId: 'st-01', today: '2029-03-15', classOf: 2027, endGrade: 15 };
const after = (id, date, title, lineIds, type, summary, about, evidence = [], refl, extra = {}) => ({ id, studentId: 'st-01', date, title, lineIds, type, summary, about, evidence, verification: 'student-added', visibility: 'publishable', source: { system: 'Added after NIST', ref: null }, alum: true, reflections: refl ? [{ id: `rf-${id}`, eventId: id, prompt: refl[0], text: refl[1], date, visibility: 'publishable' }] : [], ...extra });
const doc = (kind, caption, url) => ({ kind, caption, url: url || (kind === 'grade' ? null : '#') });
if (!store.alumEvents) store.alumEvents = [
  { ...after('al-01', '2027-01-15', 'Extended Essay submitted', ['maya-datasci', 'science'], 'assessment', 'Final EE on dengue and weather, after a second draft and a viva.', 'Maya submitted her Extended Essay, “To what extent can rainfall and temperature predict weekly dengue cases in Bangkok?”, after rewriting the discussion around the six-week lag her supervisor had questioned.', [doc('grade', 'EE grade: A')]), verification: 'school-verified', source: { system: 'ManageBac', ref: 'ee-final' } },
  { ...after('al-02', '2027-06-12', 'Graduated from NIST', ['science', 'computing', 'environment', 'service'], 'award', 'Graduation, and a signed copy of the whole record to take away.', 'Maya graduated in June 2027. On her last day she downloaded her whole record: every station, line and reflection, with the school’s signature on each verified item, so anyone can still check them years later.', [doc('file', 'Signed graduation record')]), verification: 'school-verified', source: { system: 'SIS', ref: 'grad-2027' } },
  { ...after('al-03', '2027-07-06', 'IB Diploma: 41 points', ['science', 'maya-datasci'], 'assessment', 'Diploma results: 41 points, with 7 in Biology HL.', 'Maya’s IB Diploma results arrived in July: 41 points, including 7 in Biology HL and an A for the Extended Essay.', [doc('certificate', 'IB Diploma results')]), verification: 'school-verified', source: { system: 'Exam boards', ref: 'ibdp-2027' } },
  after('al-04', '2027-09-20', 'Started BSc Data Science', ['maya-datasci'], 'class', 'First year at Northbridge University (fictional).', 'Maya started a BSc in Data Science with an environmental modelling pathway, the target she had planned on her map in Year 12.', [doc('file', 'Enrolment confirmation')], ['How did it feel to arrive?', 'Strange and familiar. The first lecture was on cleaning messy data, and I had already done that 40,000 times with the air-quality sensors.']),
  after('al-05', '2027-12-08', 'First-year project: river-level forecasting', ['maya-datasci', 'environment'], 'project', 'Forecast river levels 24 hours ahead from upstream gauges.', 'For her first-year group project Maya’s team forecast river levels a day ahead from upstream rain gauges, the same idea as the flood chatbot she built at the Bangkok hackathon, now with a proper model.', [doc('link', 'Project repository', 'https://example.org/river-forecast'), doc('grade', 'Module mark: 78%')], ['What carried over from school?', 'The hackathon idea, and the habit of asking “how do I know this number is right?” that Mr Okafor drilled into me.']),
  after('al-06', '2028-02-14', 'Joined Data for Good society', ['service', 'computing'], 'club', 'Volunteer data projects for local charities.', 'Maya joined the university Data for Good society, which does pro-bono analysis for local charities. Her first project cleaned a food bank’s donation records.', [doc('link', 'Society project page', 'https://example.org/dfg')]),
  after('al-07', '2028-07-20', 'Summer internship: city air-quality team', ['environment', 'computing'], 'project', 'Ten weeks with a city council’s air-quality team.', 'A ten-week summer internship with a city council’s air-quality team. Maya recalibrated 40 street sensors and built the dashboard the team now uses for its weekly report, a grown-up version of her campus sensor network.', [doc('file', 'Internship reference'), doc('link', 'Dashboard (public version)', 'https://example.org/city-aq')], ['What did the interview ask about?', 'Almost only the campus sensor network. I opened my map on my phone and showed them the calibration notes from 2026.']),
  after('al-08', '2028-10-06', 'Online mentor for the NIST STEM club', ['service'], 'service', 'Monthly video calls with the Year 7 girls’ STEM club she co-founded.', 'Maya mentors the Friday STEM club she co-founded at NIST, joining a video call once a month to help the Year 7 girls with their micro:bit projects.', [], ['Why go back?', 'Because the club is still running, and three of the first members are now in Year 10 and running it themselves.']),
  after('al-09', '2029-02-10', 'Second-year project: dengue early warning, revisited', ['maya-datasci', 'science'], 'project', 'Her Extended Essay question, answered properly with five more years of data.', 'Maya returned to her Extended Essay question with fifteen years of data and a proper time-series model. Her early-warning model predicts dengue peaks in Bangkok six weeks ahead.', [doc('file', 'Project report'), doc('link', 'Notebook', 'https://example.org/dengue-v2')]),
  { ...after('al-10', '2029-07-01', 'Planned: industrial placement year', ['maya-datasci', 'environment'], 'goal', 'A placement year in environmental data.', 'Planned: a year in industry between second and third year, ideally in climate or public-health data.'), visibility: 'publishable' },
];
export const getAlumEvents = () => store.alumEvents;
// The record as an alum sees it: the school years exactly as they were, plus what came after.
export function getAlumMap(viewer = 'student') {
  const base = getStudentMap(ALUM.studentId, viewer);
  const allowed = VISIBLE_TO[viewer];
  const extra = store.alumEvents.filter((e) => allowed.includes(e.visibility)).map((e) => ({ ...e, endorsements: [], tags: getTags(e) }));
  const events = [...base.events.filter((e) => e.type !== 'goal'), ...extra].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { student: { ...base.student, endGrade: ALUM.endGrade, grade: 14 }, lines: base.lines, events, signals: [], today: ALUM.today, alum: true };
}
export function addAlumStation(f) {
  const e = after(uid('al-'), f.date, f.title, f.lineIds, f.type || 'project', f.summary || '', null, [...(f.link ? [doc('link', f.link.replace(/^https?:\/\//, '').slice(0, 40), f.link)] : []), ...(f.files || [])], f.reflection ? ['What did this teach you?', f.reflection] : null);
  store.alumEvents.push(e);
  log(ALUM.studentId, 'Maya Chen (alum)', 'station', `Added “${f.title}” after graduating`);
  emit();
  return e;
}

// ── Advisor ───────────────────────────────────────────────────────────
export function getCohort(advisorId) {
  return store.students.filter((s) => s.advisorId === advisorId).map((s) => {
    const map = getStudentMap(s.id, 'advisor');
    const reflectionCount = map.events.filter((e) => e.type === 'reflection').length + map.events.reduce((n, e) => n + e.reflections.length, 0);
    const last = map.events.filter((e) => e.date <= TODAY).at(-1);
    const openSignals = map.signals.filter((g) => g.open).length;
    return { ...map, reflectionCount, openSignals, lastActivity: last?.date, flagFewReflections: reflectionCount < 4 && map.events.some((e) => e.type !== 'goal' && e.date <= TODAY) }; // nothing to reflect on yet: no flag
  }).sort((a, b) => a.student.name.localeCompare(b.student.name));
}

// ── Signals: places on the map that ask for a reflection ──────────────
// A branch start, a terminus, or a prompt an advisor attached to a station.
export function getSignals(studentId, lines = getStudentMap(studentId).lines) {
  const evs = store.events.filter((e) => e.studentId === studentId && e.type !== 'goal' && e.date <= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const hasRefl = (id) => store.reflections.some((r) => r.eventId === id);
  const out = [];
  for (const l of lines) {
    const on = evs.filter((e) => e.lineIds.includes(l.id));
    if (!on.length) continue;
    if (l.parentLineId) out.push({ key: `${studentId}:${l.id}:branch`, kind: 'branch', lineId: l.id, eventId: on[0].id, prompt: `A new line has branched. Why ${l.name}, and why now?`, open: !hasRefl(on[0].id) && !store.answered[`${studentId}:${l.id}:branch`] });
    // A line the student ends during the demo always asks, even if its last station already has a reflection.
    const endedNow = getStudent(studentId).lineStatus?.[l.id] === 'ended';
    if (l.status === 'ended') out.push({ key: `${studentId}:${l.id}:end`, kind: 'terminus', lineId: l.id, eventId: on.at(-1).id, prompt: `A line is ending. What did ${l.name} give you?`, open: (endedNow || !hasRefl(on.at(-1).id)) && !store.answered[`${studentId}:${l.id}:end`] });
  }
  for (const p of store.prompts.filter((x) => x.studentId === studentId)) {
    out.push({ key: `prompt:${p.id}`, kind: 'prompt', promptId: p.id, eventId: p.eventId, prompt: p.text, from: teacherById[p.from], open: !p.answered, date: p.date });
  }
  return out;
}

// ── Personas: who receives notifications ──────────────────────────────
export const PERSONA_OF_STUDENT = { 'st-01': 'maya', 'st-02': 'arun', 'st-03': 'lena', 'st-09': 'pim' };
export const PERSONA_OF_TEACHER = { 't-07': 'whitfield', 't-01': 'nair', 't-09': 'adeyemi', 't-08': 'brandt', 't-10': 'principal' };
export const PERSONA_OF_FAMILY = { 'st-06': 'parent', 'st-09': 'parent' };
// Recipient keys. A record with a demo persona keeps that persona's id; everyone else (the pilot) is
// `st:<studentId>`, `t:<teacherId>`, `fam:<studentId>` (that child's family) or `role:<kind>` (whoever holds the role).
export const toStudent = (sid) => (sid ? PERSONA_OF_STUDENT[sid] || `st:${sid}` : null);
export const toTeacher = (tid) => (tid ? PERSONA_OF_TEACHER[tid] || `t:${tid}` : null);
export const toFamily = (sid) => (sid ? PERSONA_OF_FAMILY[sid] || `fam:${sid}` : null);
export const toRole = (kind) => `role:${kind}`;
const STAFF_KINDS = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
// Every key a person's bell reads: their persona id, their record's keys and their role's. Takes a persona or an account.
export function notifyKeys(p) {
  if (!p) return [];
  const k = [p.id && p.id !== 'me' ? p.id : null];
  if (p.kind === 'student' && p.studentId) k.push(`st:${p.studentId}`, toStudent(p.studentId));
  if (STAFF_KINDS.includes(p.kind)) { k.push(toRole(p.kind)); if (p.teacherId) k.push(`t:${p.teacherId}`, toTeacher(p.teacherId)); }
  if (p.kind === 'parent') for (const c of p.children || []) k.push(`fam:${c}`, toFamily(c));
  return [...new Set(k.filter(Boolean))];
}
// "Ms Clara Brandt" → "Ms Brandt" (Kru and Khun go with the first name); a name without a title stays whole.
export function shortName(n = '') {
  const m = /^(Mr|Mrs|Ms|Miss|Dr|Kru|Khun)\.?\s+(.+)$/.exec(n.trim()); if (!m) return n;
  const w = m[2].split(/\s+/); return `${m[1]} ${/^(Kru|Khun)$/.test(m[1]) ? w[0] : w.at(-1)}`;
}
const teacherName = (tid, fallback) => teacherById[tid]?.name || teacherById[fallback]?.name || '';
// Ids and the clock. Every value a change cannot repeat on its own comes from here, so the server
// can replay a browser's change and end with the same ids and times (see "Shared record" below).
// Ids carry a tag drawn once per page load, so two devices never both make `nt-5`.
let seq = 1;
const TAG = Math.random().toString(36).slice(2, 7);
let tape = null, replay = null; // values recorded by the change running now / to hand back when replaying one
const nd = (k, make) => { if (replay?.[0]?.[0] === k) return replay.shift()[1]; const v = make(); tape?.push([k, v]); return v; };
const uid = (p) => nd('i', () => `${p}${seq++}_${TAG}`);
const nowIso = () => nd('t', () => new Date().toISOString());
// Made during the demo (not seeded)? Only generated ids contain '_'.
export const isLiveId = (id) => id.includes('_');
// kind: what it is about, for notification settings (src/notify-kinds.js); named here when the words alone can't tell.
export function notify(to, text, go, kind) { if (!to) return; store.notifications.unshift({ id: uid('nt-'), to, text, go, ts: nowIso(), read: false, kind: kind || inferKind(text, go) }); }
export function log(studentId, actor, kind, text) { store.activity.unshift({ id: uid('ac-'), studentId, actor, kind, text, ts: nowIso() }); }
// The same two, as changes a screen can make on its own.
export function addLog(studentId, actor, kind, text) { log(studentId, actor, kind, text); emit(); }
export function addNotification(to, text, go) { notify(to, text, go); emit(); }
// `keys`: one recipient key or a list of them (notifyKeys(persona)).
const keySet = (keys) => new Set([].concat(keys || []));
export const getNotifications = (keys) => { const k = keySet(keys); return store.notifications.filter((n) => k.has(n.to)); };
export function markNotificationsRead(keys) { const k = keySet(keys); store.notifications.forEach((n) => { if (k.has(n.to)) n.read = true; }); emit(); }
// "Clear read" in the bell: read ones are kept in the record (This week, a PDPA copy) but leave the bell.
export function clearReadNotifications(keys) { const k = keySet(keys); store.notifications.forEach((n) => { if (k.has(n.to) && n.read) n.cleared = true; }); emit(); }

// ── Student actions ───────────────────────────────────────────────────
export function addReflection({ studentId, eventId, prompt, text, visibility = 'advisor', signal, files }) {
  const r = { id: uid('rf-x'), eventId, text, prompt, date: TODAY, visibility, ...(files?.length ? { files } : {}) };
  store.reflections.push(r);
  if (signal) {
    store.answered[signal.key] = r.id;
    if (signal.promptId) {
      const p = store.prompts.find((x) => x.id === signal.promptId);
      if (p) { p.answered = true; notify(toTeacher(p.from), `${getStudent(studentId).name.split(' ')[0]} answered your reflection prompt`, { persona: toTeacher(p.from), screen: 'student', param: studentId }); }
    }
  }
  log(studentId, getStudent(studentId).name, 'reflection', `Added a reflection on “${getEvent(eventId)?.title}” (${visibility})`);
  emit();
  return r;
}

export function addStation(studentId, f) {
  const e = {
    id: uid('ev-'), studentId, title: f.title, date: f.date || TODAY, lineIds: f.lineIds, type: f.type || 'project', summary: f.summary || '',
    about: f.about || '', evidence: f.evidence || [...(f.image ? [{ kind: 'image', url: f.image, caption: f.imageCaption || 'Photo' }] : []), ...(f.files || [])],
    verification: 'student-added', visibility: f.visibility || 'advisor', source: { system: f.via || 'Manual entry', ref: null },
    ...(f.cas ? { cas: f.cas } : {}),
    ...(f.promptId ? { promptId: String(f.promptId).slice(0, 80) } : {}), // written with subject prompts (getPromptsFor)
  };
  const se = f.schoolEvent ? linkSchoolEvent(e, f.schoolEvent) : null; // school events: a moment from one
  store.events.push(e);
  if (f.reflection) store.reflections.push({ id: uid('rf-x'), eventId: e.id, text: f.reflection, prompt: se?.question || 'Quick reflection', date: e.date, visibility: f.visibility || 'advisor' });
  const who = getStudent(studentId).name;
  log(studentId, who, 'station', `Added “${e.title}”${f.via ? ` from ${f.via}` : ''}`);
  if (f.requestFrom) requestEndorsement(e.id, f.requestFrom, f.requestNote);
  emit();
  return e;
}
export function requestEndorsement(eventId, teacherId, note) {
  const e = getEvent(eventId);
  const rq = { id: uid('rq-x'), eventId, studentId: e.studentId, teacherId, date: TODAY, source: 'student', note: note || null, status: 'pending', fresh: true };
  store.requests.unshift(rq);
  const name = getStudent(e.studentId).name;
  notify(toTeacher(teacherId), `${name.split(' ')[0]} asked you to endorse “${e.title}”`, { persona: toTeacher(teacherId), screen: 'queue' }, { 'Class question': 'answers', 'Class task': 'handin' }[e.source?.system]);
  log(e.studentId, name, 'request', `Asked ${teacherById[teacherId].name} to endorse “${e.title}”`);
  emit();
  return rq;
}

// ── Teacher actions ───────────────────────────────────────────────────
export const getRequests = (teacherId, status = 'pending') => store.requests.filter((r) => r.teacherId === teacherId && (!status || r.status === status))
  .map((r) => ({ ...r, event: getEvent(r.eventId), student: getStudent(r.studentId) }));
export function endorse(requestIds, teacherId, note) {
  const ids = [].concat(requestIds);
  for (const id of ids) {
    const r = store.requests.find((x) => x.id === id);
    if (!r || r.status !== 'pending') continue;
    r.status = 'endorsed'; r.decidedAt = nowIso();
    const e = getEvent(r.eventId);
    store.endorsements.push({ id: uid('en-x'), eventId: e.id, teacherId, note: note || 'Endorsed.', date: TODAY, live: true });
    e.verification = 'teacher-endorsed';
    const t = teacherById[teacherId];
    log(e.studentId, t.name, 'endorsement', `Endorsed “${e.title}”`);
    notify(toStudent(e.studentId), `${t.name} endorsed “${e.title}”`, { persona: toStudent(e.studentId), screen: 'map', param: e.id });
  }
  emit();
}
export function declineRequest(id, reason) {
  const r = store.requests.find((x) => x.id === id);
  if (!r) return;
  r.status = 'returned'; r.reason = reason;
  notify(toStudent(r.studentId), `${teacherById[r.teacherId].name} asked for more evidence on “${getEvent(r.eventId).title}”`, { persona: toStudent(r.studentId), screen: 'map', param: r.eventId });
  emit();
}

// ── Advisor actions ───────────────────────────────────────────────────
export const getNotes = (studentId) => store.notes[studentId] || [];
export function addNote(studentId, text) { (store.notes[studentId] ||= []).push({ date: TODAY, text }); emit(); }
export const getPrompts = (studentId) => store.prompts.filter((p) => p.studentId === studentId);
export function sendPrompt(studentId, eventId, text, from = 't-07') {
  const p = { id: uid('pm-x'), studentId, eventId, from, date: TODAY, text, answered: false };
  store.prompts.push(p);
  notify(toStudent(studentId), `${teacherById[from].name} sent you a reflection prompt`, { persona: toStudent(studentId), screen: 'map', param: eventId });
  log(studentId, teacherById[from].name, 'prompt', `Sent a reflection prompt on “${getEvent(eventId)?.title}”`);
  emit();
  return p;
}

// ── Share links: views logged ─────────────────────────────────────────
export function recordView(token, studentId, who = 'Anonymous viewer') {
  store.linkViews[token] = (store.linkViews[token] || 0) + 1;
  log(studentId, who, 'view', `Viewed share link /s/${token}`);
  emit();
}
export const extraViews = (token) => store.linkViews[token] || 0;

export const getApplications = () => store.applications;

// ── Student: lines (branch, end), onboarding, phone capture ───────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// P6: a sub-line is a lighter tint of its parent (a deeper shade for the light sky and gold, so it still reads on white).
const BRANCH_TINT = { science: '#8D8FBE', computing: '#3FA9BC', environment: '#4DAD8C', sport: '#E0A010', service: '#EE7B7D', music: '#FFB160', design: '#3FA9BC', languages: '#8D8FBE', art: '#E0A010' };

// A student names a sub-line under a fixed school line. It waits for the coordinator to approve the name.
export function addBranch(studentId, parentLineId, name, first) {
  const s = getStudent(studentId);
  const id = `${studentId}-${slug(name)}`;
  if (!lineById(id)) store.lines.push({ id, name, colour: BRANCH_TINT[parentLineId] || '#8D8FBE', parentLineId, status: 'active', studentId, approval: 'pending', requestedOn: TODAY });
  const at = s.laneOrder.indexOf(parentLineId);
  if (!s.laneOrder.includes(id)) s.laneOrder.splice(at < 0 ? s.laneOrder.length : at + 1, 0, id);
  const e = addStation(studentId, { ...first, lineIds: [parentLineId, id], visibility: first.visibility || 'advisor' });
  log(studentId, s.name, 'line', `Branched “${name}” from ${lineById(parentLineId)?.name}`);
  notify(toRole('coordinator'), `${s.name} asked for a new sub-line: “${name}” under ${lineById(parentLineId)?.name}`, { persona: toRole('coordinator'), screen: 'governance' });
  emit();
  return { line: lineById(id), event: e };
}
// Ending a line is a first-class event: a terminus bar, a quieter line, a signal asking what it gave.
export function endLine(studentId, lineId, keepVisible = false) {
  const s = getStudent(studentId);
  s.lineStatus = { ...(s.lineStatus || {}), [lineId]: 'ended' };
  if (!keepVisible) store.events.forEach((e) => { if (e.studentId === studentId && e.lineIds.length === 1 && e.lineIds[0] === lineId && e.visibility === 'publishable') e.visibility = 'advisor'; });
  log(studentId, s.name, 'line', `Ended the ${lineById(lineId)?.name} line${keepVisible ? '' : ' (its stations are now advisor-only)'}`);
  const adv = store.students.find((x) => x.id === studentId)?.advisorId;
  if (adv) notify(toTeacher(adv), `${s.name.split(' ')[0]} ended the ${lineById(lineId)?.name} line`, { persona: toTeacher(adv), screen: 'student', param: studentId });
  emit();
}
export function restartLine(studentId, lineId) {
  const s = getStudent(studentId);
  s.lineStatus = { ...(s.lineStatus || {}), [lineId]: 'active' };
  log(studentId, s.name, 'line', `Restarted the ${lineById(lineId)?.name} line`);
  emit();
}

// Year 7 starters: what arrives from school systems once a new student picks their interests.
export const STARTERS = {
  science: { title: 'Lab safety certificate', type: 'class', source: { system: 'ManageBac', ref: 'g6-sci-01' }, summary: 'Passed the Year 7 lab safety quiz.', ev: [['certificate', 'Lab safety certificate']], img: 'cert' },
  sport: { title: 'Joined the U12 swim squad', type: 'sport', source: { system: 'Clubs & Sports', ref: 'swim-u12' }, summary: 'Tuesday and Thursday training.', ev: [['file', 'U12 training timetable']], img: 'pool' },
  art: { title: 'First sketchbook page', type: 'project', source: { system: 'ManageBac', ref: 'g6-art-02' }, summary: 'Observational drawing of a shell.', ev: [['file', 'Art teacher feedback']], img: 'sketchbook' },
  music: { title: 'Joined the junior choir', type: 'club', source: { system: 'Clubs & Sports', ref: 'choir-jr' }, summary: 'Rehearsals on Wednesdays.', ev: [['file', 'Junior choir rehearsal schedule']], img: 'piano-stage' },
  computing: { title: 'Scratch: animated name', type: 'class', source: { system: 'ManageBac', ref: 'g6-cs-01' }, summary: 'First Scratch project in Design & Tech.', ev: [['link', 'Play my Scratch project', 'https://example.org/scratch-pim']], img: 'code' },
  environment: { title: 'Eco-club welcome walk', type: 'club', source: { system: 'Clubs & Sports', ref: 'eco-jr' }, summary: 'Mapped the recycling bins on campus.', ev: [['file', 'Campus recycling bin map']], img: 'compost-bin' },
  service: { title: 'Reading buddy for Year 2', type: 'service', source: { system: 'CAS log', ref: 'sa-g6-01' }, summary: 'Service as action: reading with a Year 2 class.', ev: [['file', 'Reading buddy log']], img: 'stem-club' },
  languages: { title: 'Thai placement: Level 2', type: 'assessment', source: { system: 'SIS', ref: 'thai-place' }, summary: 'Placed in Thai as an additional language, Level 2.', ev: [['grade', 'Thai placement: Level 2']], img: 'welcome-pack' },
  design: { title: 'Design cycle: pencil holder', type: 'project', source: { system: 'ManageBac', ref: 'g6-des-01' }, summary: 'First MYP design cycle project.', ev: [['file', 'Design cycle worksheet']], img: 'phone-stands' },
};
const STARTER_IMG = { cert: null, pool: null, code: null, sketchbook: 'sketchbook', 'piano-stage': 'piano-stage', 'compost-bin': 'compost-bin', 'stem-club': 'stem-club', 'welcome-pack': 'welcome-pack', 'phone-stands': 'phone-stands' };
// A clean pilot start has no made-up "already verified" starter stations.
export const hasStarters = () => !store.cleanStart;
export function completeOnboarding(studentId, lineIds, template) {
  const s = getStudent(studentId);
  s.laneOrder = [...lineIds];
  s.onboarding = false;
  seedDrafts(s); // a new pilot student's empty presentations
  s.template = template;
  lineIds.forEach((l, i) => {
    const st = hasStarters() && STARTERS[l]; if (!st) return;
    const img = STARTER_IMG[st.img];
    store.events.push({ id: uid('ev-'), studentId, title: st.title, date: `2026-08-${String(14 + i * 3).padStart(2, '0')}`, lineIds: [l], type: st.type, summary: st.summary,
      evidence: [...(img ? [{ kind: 'image', url: `evidence/${img}.svg`, caption: st.title }] : []), ...(st.ev || []).map(([kind, caption, url]) => ({ kind, caption, url: url || (kind === 'grade' ? null : '#') }))], verification: 'school-verified', visibility: 'advisor', source: st.source });
  });
  log(studentId, s.name, 'onboarding', `Picked ${lineIds.length} starter lines and the “${template}” template`);
  emit();
}

// A quick capture from the phone lands in the inbox, like any other import.
export function capturePhone(studentId, f) {
  const e = { id: uid('ev-'), studentId, title: f.title, date: TODAY, lineIds: f.lineIds || [], type: f.type || 'project', summary: f.summary || '',
    evidence: f.image ? [{ kind: 'image', url: f.image, caption: 'Photo from phone' }] : [], verification: 'student-added', visibility: 'advisor',
    source: { system: 'Phone capture', ref: null }, sourceId: 'phone', suggestedLineIds: f.lineIds || [], quickReflection: f.reflection };
  store.inbox.unshift(e);
  log(studentId, getStudent(studentId).name, 'capture', `Captured “${f.title}” on her phone`);
  emit();
  return e;
}

// ── Visibility and privacy ────────────────────────────────────────────
export function setVisibility(eventId, visibility) {
  const e = getEvent(eventId); if (!e) return;
  const from = e.visibility; e.visibility = visibility;
  log(e.studentId, getStudent(e.studentId).name, 'visibility', `Changed “${e.title}” from ${from} to ${visibility}`);
  emit();
}
const DEFAULT_PRIVACY = { reflections: 'private', added: 'advisor', imported: 'advisor', endedLines: 'advisor', linkDays: 90, emailGate: false };
export const getPrivacy = (studentId) => ({ ...DEFAULT_PRIVACY, ...(store.privacy?.[studentId] || {}) });
export function setPrivacy(studentId, patch) {
  store.privacy = store.privacy || {};
  store.privacy[studentId] = { ...getPrivacy(studentId), ...patch };
  log(studentId, getStudent(studentId).name, 'privacy', `Changed privacy defaults: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`);
  emit();
}
// Consent on file, by grade (mock). Under-18s need a parent's consent to publish.
export const CONSENT = [
  { grade: 6, students: 118, parent: 103, pending: 15 }, { grade: 7, students: 121, parent: 0, pending: 0 }, { grade: 8, students: 117, parent: 0, pending: 0 },
  { grade: 9, students: 124, parent: 116, pending: 8 }, { grade: 10, students: 119, parent: 115, pending: 4 }, { grade: 11, students: 112, parent: 110, pending: 2 }, { grade: 12, students: 108, parent: 108, pending: 0 },
];

// ── Activity log: seeded history plus everything done during the demo ─
const SYS_TIME = { SIS: '01:10', ManageBac: '03:20', 'CAS log': '04:00', 'Clubs & Sports': '05:30', GitHub: '09:12', 'Exam boards': '02:00' };
export function getActivity(studentId) {
  const s = getStudent(studentId);
  const hist = [];
  for (const e of store.events.filter((x) => x.studentId === studentId && x.date <= TODAY && x.type !== 'goal')) {
    const sys = e.source?.system;
    if (sys && sys !== 'Manual entry' && sys !== 'Phone capture') hist.push({ ts: `${e.date}T${SYS_TIME[sys] || '06:00'}:00`, actor: sys, kind: 'sync', text: `Imported “${e.title}”${e.source.ref ? ` (${e.source.ref})` : ''}` });
    else if (!isLiveId(e.id) && !e.wasGoal) hist.push({ ts: `${e.date}T18:30:00`, actor: s.name, kind: 'station', text: `Added “${e.title}”` });
  }
  for (const n of store.endorsements) { const e = getEvent(n.eventId); if (e?.studentId === studentId && !n.live) hist.push({ ts: `${n.date}T15:40:00`, actor: teacherById[n.teacherId]?.name, kind: 'endorse', text: `Endorsed “${e.title}”` }); }
  for (const p of presentationsData.filter((x) => x.studentId === studentId)) for (const l of p.shareLinks) {
    for (let i = 0; i < l.views; i++) { const end = l.revoked || l.expiresAt < TODAY ? (l.expiresAt < TODAY ? l.expiresAt : TODAY) : TODAY; const d = new Date(new Date(`${end}T12:00:00`).getTime() - ((l.revoked ? i + 1 : i) * 5 + (l.token.charCodeAt(3) % 4)) * 86400000 - i * 3600000); hist.push({ ts: d.toISOString().slice(0, 19), actor: SHARED_LABEL[l.token] || l.sharedWith || 'Anyone with the link', kind: 'view', text: `Viewed share link /s/${l.token}` }); }
    if (l.revoked) hist.push({ ts: `${l.expiresAt}T09:00:00`, actor: s.name, kind: 'link', text: `Revoked share link /s/${l.token}` });
  }
  const live = store.activity.filter((a) => a.studentId === studentId).map((a) => ({ ...a, live: true }));
  return [...live, ...hist.filter((h) => h.ts.slice(0, 10) <= TODAY).sort((a, b) => b.ts.localeCompare(a.ts))];
}
export const SHARED_LABEL = { 'tp-nb7d': 'Northbridge University admissions', 'tp-u8k4': 'University applications', 'tp-c7m1': 'Anyone with the link', 'tp-g3n2': 'Family and friends', 'tp-e1x9': 'Summer internship' };
// Links that ask the reader for an email before opening (the student turns this on per link).
export const EMAIL_GATED = ['tp-u8k4'];
export const isGated = (l) => l.emailGate ?? EMAIL_GATED.includes(l.token);
export function logLink(studentId, text) { log(studentId, getStudent(studentId).name, 'link', text); emit(); }

// Graduation export: the full record as the student sees it.
export function exportRecord(studentId) {
  const map = getStudentMap(studentId, 'student');
  return {
    exportedOn: TODAY, format: 'nist-transit-portfolio/v1',
    student: map.student, lines: map.lines,
    stations: map.events.map(({ reflections, endorsements, ...e }) => ({ ...e, reflections, endorsements: endorsements.map((n) => ({ teacher: n.teacher?.name, note: n.note, date: n.date })) })),
    presentations: presentationsData.filter((p) => p.studentId === studentId).map(({ shareLinks, ...p }) => p),
    activity: getActivity(studentId).slice(0, 200),
  };
}

// ── PDPA: everything the record holds about one student (a copy), and removing it (erasure) ─
// Generic, so collections added later are covered too. An item in a list is theirs when one of its own
// values (or one inside a plain object on it, like a notification's go) is their id, one of their
// stations, presentations, share links or other items, or their persona (to). An entry in a keyed
// collection is theirs by its key: their id, an id of theirs, or a key made of them ('st-01:line:end').
// Id lists inside other people's items (a class task's submitted list) only lose their id. A notification
// to someone else that names them or one of their stations ("Maya asked you to endorse …") is theirs too.
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
function pdpaRefs(sid, alsoTo = []) {
  const ids = new Set([sid]);
  const titles = [];
  for (const e of store.events) if (e.studentId === sid) { ids.add(e.id); titles.push(`“${e.title}”`); }
  for (const p of store.drafts?.[sid] || []) { ids.add(p.id); for (const l of p.shareLinks || []) ids.add(l.token); }
  const name = getStudent(sid)?.name || sid, first = new RegExp(`(^|\\s)${name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|’s|'s)`);
  return { sid, ids, to: new Set([PERSONA_OF_STUDENT[sid], `st:${sid}`, `fam:${sid}`, ...alsoTo, ...alsoTo.map((a) => `u:${a}`)].filter(Boolean)), names: (t) => t.includes(name) || titles.some((x) => t.includes(x)) || first.test(t) };
}
const ownsItem = (x, r, k) => isObj(x) && (r.to.has(x.to) || (k === 'notifications' && typeof x.text === 'string' && r.names(x.text)) || Object.entries(x).some(([k, v]) => k !== 'to' && (typeof v === 'string' ? r.ids.has(v) : isObj(v) && Object.values(v).some((w) => typeof w === 'string' && r.ids.has(w)))));
const ownsKey = (k, r) => r.ids.has(k) || String(k).split(/[:|]/).some((p) => r.ids.has(p));
// Another person's item that lists this student's id (or other students' ids): a copy with only theirs.
const otherIds = (sid) => new Set(store.students.map((s) => s.id).filter((id) => id !== sid));
const mentions = (x, sid) => isObj(x) && Object.values(x).some((v) => Array.isArray(v) && v.includes(sid));
const onlyMine = (x, sid, others) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Array.isArray(v) && v.every((s) => typeof s === 'string') ? v.filter((s) => !others.has(s)) : v]));
// The pass both share: each collection's own items, and the ids those items add (prompts → answered keys).
function pdpaWalk(sid, alsoTo) {
  const r = pdpaRefs(sid, alsoTo);
  const lists = Object.entries(store).filter(([, v]) => Array.isArray(v));
  for (let pass = 0; pass < 2; pass++) for (const [k, v] of lists) for (const x of v) if (ownsItem(x, r, k) && typeof x.id === 'string') r.ids.add(x.id);
  return { r, lists, keyed: Object.entries(store).filter(([, v]) => isObj(v)) };
}
export function studentData(sid, alsoTo = []) {
  const student = getStudent(sid); if (!student) return null;
  const { r, lists, keyed } = pdpaWalk(sid, alsoTo);
  const others = otherIds(sid);
  const own = {}, mentioned = {};
  for (const [k, v] of lists) {
    const mine = v.filter((x) => ownsItem(x, r, k));
    if (mine.length) own[k] = structuredClone(mine);
    const m = v.filter((x) => !ownsItem(x, r, k) && mentions(x, sid)).map((x) => onlyMine(x, sid, others));
    if (m.length) mentioned[k] = m;
  }
  for (const [k, v] of keyed) {
    const mine = Object.fromEntries(Object.entries(v).filter(([key]) => ownsKey(key, r)));
    if (Object.keys(mine).length) own[k] = structuredClone(mine);
    const m = Object.entries(v).filter(([key, x]) => !ownsKey(key, r) && mentions(x, sid)).map(([key, x]) => [key, onlyMine(x, sid, others)]);
    if (m.length) mentioned[k] = Object.fromEntries(m);
  }
  // Reports about them: reasons and outcomes, never who reported (moderateReport).
  if (own.reports) own.reports = own.reports.map(({ from, ...x }) => x);
  // Kind feedback they received: the classmate's first name, not their id.
  if (own.peerFeedback) own.peerFeedback = own.peerFeedback.map(({ fromId, ...x }) => (fromId === sid ? { fromId, ...x } : x));
  return { format: 'nist-transit-portfolio/pdpa-copy/v1', studentId: sid, recordDate: TODAY, student: structuredClone(student), own, mentioned, activity: getActivity(sid) };
}
// Removes the student and everything above from the record. Admin only (server/auth.mjs ADMIN_ONLY); the
// server runs it from POST /api/admin/students/:id/erase, which also removes their files and accounts.
export function eraseStudent(sid, alsoTo = []) {
  if (!getStudent(sid)) return null;
  const { r, lists, keyed } = pdpaWalk(sid, alsoTo);
  const removed = {};
  for (const [k, v] of lists) {
    for (let i = v.length - 1; i >= 0; i--) {
      if (ownsItem(v[i], r, k)) { v.splice(i, 1); removed[k] = (removed[k] || 0) + 1; }
      else if (mentions(v[i], sid)) for (const [f, a] of Object.entries(v[i])) if (Array.isArray(a)) v[i][f] = a.filter((s) => s !== sid);
    }
  }
  for (const [k, v] of keyed) for (const key of Object.keys(v)) {
    if (ownsKey(key, r)) { delete v[key]; removed[k] = (removed[k] || 0) + 1; }
    else if (isObj(v[key]) && mentions(v[key], sid)) for (const [f, a] of Object.entries(v[key])) if (Array.isArray(a)) v[key][f] = a.filter((s) => s !== sid);
  }
  emit();
  return removed;
}

// ── Whole-school reads (school viewer: school and publishable items only) ─
export const schoolEvents = () => store.events.filter((e) => VISIBLE_TO.school.includes(e.visibility) && !e.hidden && e.type !== 'goal' && e.date <= TODAY);
export function linePairs() {
  const pairs = {};
  for (const e of schoolEvents()) {
    const ls = [...new Set(e.lineIds.map((id) => lineById(id)?.parentLineId || id))].sort();
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) { const k = `${ls[i]}|${ls[j]}`; (pairs[k] ||= []).push(e); }
  }
  return Object.entries(pairs).map(([k, evs]) => ({ a: k.split('|')[0], b: k.split('|')[1], events: evs })).sort((x, y) => y.events.length - x.events.length);
}
// School line of a station's line (sub-lines roll up to their parent).
export const rootLine = (id) => lineById(id)?.parentLineId || id;
export function renameLine(id, patch) { const l = lineById(id); Object.assign(l, patch); emit(); }
// `by`: the coordinator's teacher id (the demo's Ms Brandt when left out).
export function decideBranch(id, ok, mergeInto, by) {
  const l = lineById(id); if (!l) return;
  if (ok) { l.approval = 'approved'; notify(toStudent(l.studentId), `${shortName(teacherName(by, 't-08'))} approved your new line “${l.name}”`, { persona: toStudent(l.studentId), screen: 'map' }); }
  else if (mergeInto) {
    const target = lineById(mergeInto);
    store.events.forEach((e) => { if (e.lineIds.includes(id)) e.lineIds = [...new Set(e.lineIds.map((x) => (x === id ? mergeInto : x)))]; });
    const s = getStudent(l.studentId); s.laneOrder = s.laneOrder.filter((x) => x !== id); if (!s.laneOrder.includes(mergeInto)) s.laneOrder.push(mergeInto);
    store.lines = store.lines.filter((x) => x.id !== id);
    notify(toStudent(l.studentId), `Your line “${l.name}” was merged into “${target.name}”`, { persona: toStudent(l.studentId), screen: 'map' });
  }
  emit();
}

// ── Wave 3 demo additions: a few more computing students, and sub-line names waiting for the coordinator ─
const SEED_LINES = [
  { id: 'st-04-robotics', name: 'Robotics', parentLineId: 'computing', studentId: 'st-04', requestedOn: '2026-10-05' },
  { id: 'st-08-marine-biology', name: 'Marine Biology', parentLineId: 'science', studentId: 'st-08', requestedOn: '2026-09-21' },
  { id: 'st-05-calligraphy', name: 'arabic calligraphy', parentLineId: 'art', studentId: 'st-05', requestedOn: '2026-10-18' },
];
const SEED_EVENTS = [
  ['ev-701', 'st-04', 'Started MYP Computer Science', '2025-08-21', ['computing'], 'class', 'school-verified', 'SIS', 'enrol-myp-cs', 'Enrolled in Year 11 Computer Science with Ms Nair.'],
  ['ev-702', 'st-04', 'Robot arm for the physics lab', '2026-05-12', ['computing', 'science'], 'project', 'teacher-endorsed', 'ManageBac', 'task-9120', 'A three-joint arm that pours reagents for the Year 10 titration practical, programmed in Python.'],
  ['ev-703', 'st-04', 'VEX robotics regional: 3rd', '2026-10-04', ['computing', 'st-04-robotics'], 'competition', 'school-verified', 'Clubs & Sports', 'vex-2610', 'Drove and coded the team robot at the Bangkok regional.'],
  ['ev-704', 'st-08', 'Started MYP Computer Science', '2025-08-21', ['computing'], 'class', 'school-verified', 'SIS', 'enrol-myp-cs', 'Enrolled in Year 11 Computer Science with Ms Nair.'],
  ['ev-705', 'st-08', 'Reef temperature logger', '2026-02-20', ['computing', 'environment'], 'project', 'teacher-endorsed', 'ManageBac', 'task-8840', 'A waterproof logger for the Koh Tao reef trip, with a dashboard the marine club still uses.'],
  ['ev-706', 'st-08', 'Canteen carbon calculator', '2026-06-02', ['computing', 'service'], 'project', 'student-added', 'Manual entry', 'self', 'A web form that estimates the carbon cost of each canteen menu.'],
  ['ev-707', 'st-08', 'Coral spawning survey', '2026-09-20', ['science', 'st-08-marine-biology'], 'project', 'school-verified', 'CAS log', 'cas-coral', 'Night dives counting spawning colonies with the marine club.'],
  ['ev-708', 'st-05', 'Calligraphy workshop series', '2026-10-17', ['art', 'st-05-calligraphy'], 'club', 'student-added', 'Manual entry', 'self', 'Six Saturday workshops in Arabic calligraphy, ending with a small exhibition.'],
  ['ev-709', 'st-07', 'Started IB Computer Science HL', '2025-08-21', ['computing'], 'class', 'school-verified', 'SIS', 'enrol-cshl', 'Enrolled in IB Computer Science HL with Ms Nair.'],
];
const SEED_EVIDENCE = { // opened as documents from src/evidence/
  'ev-701': [['file', 'Course outline']], 'ev-704': [['file', 'Course outline']], 'ev-709': [['file', 'Course outline']],
  'ev-702': [['link', 'Code on GitHub', 'https://example.org/robot-arm'], ['file', 'Build log']],
  'ev-703': [['certificate', 'Regional award certificate'], ['link', 'Match video', 'https://example.org/vex']],
  'ev-705': [['link', 'Logger dashboard', 'https://example.org/reeflog'], ['file', 'Build notes']],
  'ev-706': [['link', 'Live calculator', 'https://example.org/carbon']], 'ev-707': [['file', 'Spawning survey data']], 'ev-708': [['file', 'Workshop handout']],
};
for (const [id, studentId, title, date, lineIds, type, verification, system, ref, about] of SEED_EVENTS) {
  store.events.push({ id, studentId, title, date, lineIds, type, summary: about, about, evidence: (SEED_EVIDENCE[id] || []).map(([kind, caption, url]) => ({ kind, caption, url: url || '#' })), verification, visibility: 'publishable', source: { system, ref } });
  const s = getStudent(studentId); for (const lid of lineIds) if (!SEED_LINES.some((l) => l.id === lid) && !s.laneOrder.includes(lid)) s.laneOrder.push(lid);
  if (verification === 'teacher-endorsed') store.endorsements.push({ id: `en-${id}`, eventId: id, teacherId: 't-01', note: 'Independent work, well beyond the syllabus.', date });
}
for (const l of SEED_LINES) {
  store.lines.push({ ...l, colour: BRANCH_TINT[l.parentLineId], status: 'active', approval: 'pending' });
  const s = getStudent(l.studentId); const at = s.laneOrder.indexOf(l.parentLineId);
  s.laneOrder.splice(at < 0 ? s.laneOrder.length : at + 1, 0, l.id);
}

// ── Coordinator: school line list ─────────────────────────────────────
export function addSchoolLine(name, colour) {
  const id = slug(name);
  if (!id || lineById(id)) return null;
  store.lines.push({ id, name, colour, status: 'active' });
  emit();
  return lineById(id);
}
export const lineUse = (id) => {
  const evs = store.events.filter((e) => e.lineIds.some((x) => rootLine(x) === id));
  return { stations: evs.length, students: new Set(evs.map((e) => e.studentId)).size, subLines: store.lines.filter((l) => l.parentLineId === id).length };
};

// ── Coordinator: DP core milestones (from the LMS, mock) ──────────────
const DP_PLAN = {
  12: [['ee-prop', 'EE', 'Proposal', '2025-11-14'], ['tok-ex', 'TOK', 'Exhibition', '2026-02-27'], ['ee-draft', 'EE', 'First draft', '2026-03-20'], ['ia-1', 'IA', 'First IA draft', '2026-05-22'], ['ee-viva', 'EE', 'Viva voce', '2026-09-25'], ['tok-draft', 'TOK', 'Essay draft', '2026-10-16'], ['ee-final', 'EE', 'Final submission', '2027-01-15'], ['tok-final', 'TOK', 'Essay final', '2027-02-12']],
  11: [['tok-intro', 'TOK', 'Knowledge questions', '2026-10-09'], ['ee-topic', 'EE', 'Topic and supervisor', '2026-10-23'], ['ee-prop', 'EE', 'Proposal', '2026-11-13'], ['tok-ex', 'TOK', 'Exhibition', '2027-02-26']],
};
const DP_SUPERVISOR = { 'st-01': 't-02', 'st-02': 't-03', 'st-04': 't-01', 'st-05': 't-05', 'st-07': 't-01', 'st-08': 't-02' };
const DP_TOPIC = { 'st-01': 'Biology: dengue and weather', 'st-02': 'Music: rhythm in game audio', 'st-04': 'CS: path planning', 'st-05': 'Language A: exile poetry', 'st-07': 'CS: sorting on GPUs', 'st-08': 'Biology: reef bleaching' };
// Who handed in what, and when. Missing means not handed in yet.
const DP_DONE = {
  'st-01': { 'ee-prop': '2025-11-10', 'tok-ex': '2026-02-25', 'ee-draft': '2026-03-18', 'ia-1': '2026-04-20', 'ee-viva': '2026-09-15', 'tok-draft': '2026-10-15' },
  'st-05': { 'ee-prop': '2025-11-14', 'tok-ex': '2026-02-27', 'ee-draft': '2026-04-02', 'ia-1': '2026-05-20', 'ee-viva': '2026-09-24' },
  'st-07': { 'ee-prop': '2025-11-21', 'tok-ex': '2026-02-26', 'ee-draft': '2026-03-20', 'ia-1': '2026-06-05' },
  'st-02': { 'tok-intro': '2026-10-08', 'ee-topic': '2026-10-20' },
  'st-04': { 'tok-intro': '2026-10-09' },
  'st-08': { 'tok-intro': '2026-10-06', 'ee-topic': '2026-10-22' },
};
const DP_EVENT = { 'st-01': { 'ia-1': 'ev-030', 'ee-viva': 'ev-032', 'ee-final': 'ev-035' } };
export function getDpCore() {
  return store.students.filter((s) => s.programme === 'IB Diploma' && DP_PLAN[s.grade]).map((s) => ({
    student: s, supervisor: teacherById[DP_SUPERVISOR[s.id]], topic: DP_TOPIC[s.id],
    milestones: DP_PLAN[s.grade].map(([id, part, name, due]) => {
      const done = (store.dpDone?.[s.id]?.[id]) || DP_DONE[s.id]?.[id];
      const status = done ? (done > due ? 'done-late' : 'done') : due < TODAY ? 'late' : 'upcoming';
      return { id, part, name, due, done, status, eventId: DP_EVENT[s.id]?.[id], nudged: store.dpNudges?.[`${s.id}:${id}`] };
    }),
  })).sort((a, b) => b.student.grade - a.student.grade || a.student.name.localeCompare(b.student.name));
}
export function nudgeMilestone(studentId, milestone, by) {
  (store.dpNudges ||= {})[`${studentId}:${milestone.id}`] = TODAY;
  const s = getStudent(studentId); const who = teacherName(by, 't-08');
  notify(toStudent(studentId), `${shortName(who)}: your ${milestone.part} ${milestone.name.toLowerCase()} was due ${milestone.due}. Can you upload it this week?`, { persona: toStudent(studentId), screen: 'map' });
  log(studentId, who, 'prompt', `Reminded ${s.name.split(' ')[0]} about the ${milestone.part} ${milestone.name.toLowerCase()}`);
  emit();
}
export function markMilestone(studentId, id) { ((store.dpDone ||= {})[studentId] ||= {})[id] = TODAY; emit(); }

// ── Counsellor: activities list drafts (Common App style, 10 slots) ────
export const getActivityList = (studentId) => store.activityLists?.[studentId];
export function saveActivityList(studentId, list) { (store.activityLists ||= {})[studentId] = list; emit(); }

// ── Wave 4: goals, term in review, suggested interchanges ─────────────
// A goal is a dashed station with a target date. It turns solid when the student says it happened.
export function addGoal(studentId, f, by) {
  const e = { id: uid('ev-'), studentId, title: f.title, date: f.date, lineIds: [f.lineId], type: 'goal', summary: f.summary || 'Planned goal.', about: '', evidence: [], verification: 'student-added', visibility: 'advisor', source: { system: 'Manual entry', ref: null }, checkIn: f.checkIn || null, setBy: by || null, ...(f.sponsor ? { sponsor: { teacherId: f.sponsor, status: 'invited', note: f.sponsorNote || '', expectations: '', checkIns: [], invitedOn: TODAY } } : {}) };
  store.events.push(e);
  const s = getStudent(studentId);
  log(studentId, by ? teacherById[by]?.name : s.name, 'goal', `Planned “${e.title}” for ${e.date}${f.checkIn ? ', with an advisor check-in' : ''}`);
  if (by) notify(toStudent(studentId), `${teacherName(by)} added a goal you agreed together: “${e.title}”`, { persona: toStudent(studentId), screen: 'map', param: e.id });
  if (f.sponsor) notify(toTeacher(f.sponsor), `${s.name.split(' ')[0]} invited you to sponsor a planned project: “${e.title}”`, { persona: toTeacher(f.sponsor), screen: 'queue' });
  if (!by && f.checkIn && s.advisorId) notify(toTeacher(s.advisorId), `${s.name.split(' ')[0]} set a goal and asked for a check-in: “${e.title}”`, { persona: toTeacher(s.advisorId), screen: 'student', param: studentId });
  emit();
  return e;
}
export function completeGoal(id, type = 'project') {
  const e = getEvent(id); if (!e) return;
  e.type = type; e.date = e.date > TODAY ? TODAY : e.date; e.summary = e.summary === 'Planned goal.' ? 'A goal that became a station.' : e.summary; e.wasGoal = true;
  log(e.studentId, getStudent(e.studentId).name, 'goal', `Marked the goal “${e.title}” as done`);
  // A sponsored plan goes straight back to its sponsor for a one-click endorsement.
  if (e.sponsor?.status === 'accepted') { e.sponsor.status = 'done'; const rq = requestEndorsement(e.id, e.sponsor.teacherId, 'Finished the project you sponsored.'); rq.source = 'sponsor'; }
  emit();
}

export const TERM_START = '2026-08-17';
export function termReview(studentId) {
  const map = getStudentMap(studentId);
  const evs = map.events.filter((e) => e.date >= TERM_START && e.date <= TODAY && e.type !== 'goal');
  const prev = map.events.filter((e) => e.date >= '2026-04-20' && e.date < TERM_START && e.type !== 'goal');
  const roots = (e) => [...new Set(e.lineIds.map(rootLine))];
  const interchanges = evs.filter((e) => roots(e).length > 1);
  const grew = map.lines.map((l) => ({ l, n: evs.filter((e) => e.lineIds.includes(l.id)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const refl = store.reflections.filter((r) => r.date >= TERM_START && map.events.some((e) => e.id === r.eventId)).length + evs.filter((e) => e.type === 'reflection').length;
  const endorsed = store.endorsements.filter((n) => n.date >= TERM_START && evs.some((e) => e.id === n.eventId)).length;
  const goals = map.events.filter((e) => e.type === 'goal' && e.date > TODAY).sort((a, b) => a.date.localeCompare(b.date));
  return { stations: evs, prevCount: prev.length, interchanges, grew, reflections: refl, endorsed, goals, quiet: map.lines.filter((l) => l.status !== 'ended' && !evs.some((e) => e.lineIds.includes(l.id)) && map.events.some((e) => e.lineIds.includes(l.id))) };
}

// S10: two stations on different lines that look related. Words shared in title and summary, close in time.
const STOP = new Set(['about', 'after', 'their', 'there', 'which', 'while', 'with', 'from', 'into', 'class', 'first', 'school', 'students', 'student', 'project', 'started', 'joined', 'term', 'weeks', 'using', 'every', 'built']);
const words = (e) => new Set(`${e.title} ${e.summary}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/s$/, '')));
export function suggestInterchanges(studentId) {
  const ignored = store.ignoredSuggestions || {};
  const evs = store.events.filter((e) => e.studentId === studentId && e.type !== 'goal' && e.type !== 'reflection' && e.date <= TODAY);
  const out = [];
  for (let i = 0; i < evs.length; i++) for (let j = i + 1; j < evs.length; j++) {
    const a = evs[i], b = evs[j];
    const ra = new Set(a.lineIds.map(rootLine)), rb = new Set(b.lineIds.map(rootLine));
    if ([...rb].every((x) => ra.has(x)) || [...ra].every((x) => rb.has(x))) continue;
    const gap = Math.abs(new Date(a.date) - new Date(b.date)) / 86400000;
    if (gap > 500) continue;
    const wa = words(a), shared = [...words(b)].filter((w) => wa.has(w));
    if (shared.length < 2) continue;
    const key = `${a.id}|${b.id}`;
    if (ignored[key]) continue;
    // Join the later station to the earlier station's line.
    const [early, late] = a.date <= b.date ? [a, b] : [b, a];
    const lineId = early.lineIds.find((id) => !late.lineIds.map(rootLine).includes(rootLine(id)));
    if (!lineId) continue;
    out.push({ key, a: early, b: late, lineId, shared, score: shared.length * 10 - gap / 30 });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 3);
}
export function acceptInterchange(sug) {
  const e = getEvent(sug.b.id); if (!e.lineIds.includes(sug.lineId)) e.lineIds = [...e.lineIds, sug.lineId];
  (store.ignoredSuggestions ||= {})[sug.key] = 'accepted';
  log(e.studentId, getStudent(e.studentId).name, 'line', `Joined “${e.title}” to the ${lineById(sug.lineId)?.name} line (suggested interchange)`);
  emit();
}
export function ignoreInterchange(key) { (store.ignoredSuggestions ||= {})[key] = 'ignored'; emit(); }

// A4: a student measured only against their own past terms.
export function growth(studentId) {
  const map = getStudentMap(studentId, 'advisor');
  const inRange = (d, a, b) => d >= a && d < b;
  const count = (a, b) => ({
    stations: map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection' && inRange(e.date, a, b)).length,
    reflections: map.events.filter((e) => e.type === 'reflection' && inRange(e.date, a, b)).length + map.events.reduce((n, e) => n + e.reflections.filter((r) => inRange(r.date, a, b)).length, 0),
  });
  return { now: count(TERM_START, '2026-12-31'), before: count('2026-04-20', TERM_START) };
}

// ── C5: counsellor comments pinned on a student's draft presentation ───
export const getComments = (presentationId) => store.comments.filter((c) => c.presentationId === presentationId);
export function addComment(presentationId, studentId, text, eventId, by = 't-09') {
  const c = { id: uid('cm-'), presentationId, studentId, eventId: eventId || null, text, by, date: TODAY, resolved: false };
  store.comments.push(c);
  notify(toStudent(studentId), `${teacherName(by, 't-09')} commented on your draft`, { persona: toStudent(studentId), screen: 'studio' });
  emit();
  return c;
}
export function resolveComment(id) { const c = store.comments.find((x) => x.id === id); if (c) { c.resolved = !c.resolved; emit(); } }
store.comments.push(
  { id: 'cm-s1', presentationId: 'pr-02', studentId: 'st-01', eventId: 'ev-042', text: 'Lead with the sensor network. It is your strongest verified piece and it sets up the Data Science story.', by: 't-09', date: '2026-10-22', resolved: false },
  { id: 'cm-s2', presentationId: 'pr-02', studentId: 'st-01', eventId: null, text: 'Swimming can stay, but one station is enough. Admissions readers skim.', by: 't-09', date: '2026-10-22', resolved: false },
);

// ── E4: a reader asks for more evidence; the student decides ───────────
export function askEvidence(eventId, from, text) {
  const e = getEvent(eventId);
  const r = { id: uid('er-'), eventId, studentId: e.studentId, from, text, date: TODAY, status: 'open' };
  store.evidenceRequests.unshift(r);
  notify(toStudent(e.studentId), `${from} asked to see more on “${e.title}”`, { persona: toStudent(e.studentId), screen: 'inbox' });
  log(e.studentId, from, 'request', `Asked for more evidence on “${e.title}”`);
  emit();
  return r;
}
export const getEvidenceRequests = (studentId) => store.evidenceRequests.filter((r) => r.studentId === studentId);
export function answerEvidence(id, share) {
  const r = store.evidenceRequests.find((x) => x.id === id); if (!r) return;
  r.status = share ? 'shared' : 'declined';
  log(r.studentId, getStudent(r.studentId).name, 'link', share ? `Shared more evidence on “${getEvent(r.eventId).title}” with ${r.from}` : `Declined a request from ${r.from}`);
  emit();
}
store.evidenceRequests.push({ id: 'er-s1', eventId: 'ev-042', studentId: 'st-01', from: 'Northbridge University admissions', text: 'Could we see the code for the dashboard?', date: '2026-10-24', status: 'open' });

// ── K5: requirements appear on maps as dashed stations, automatically ──
const REQ_LINE = { 'st-01': 'science', 'st-02': 'music', 'st-04': 'computing', 'st-05': 'languages', 'st-07': 'computing', 'st-08': 'science' };
for (const r of getDpCore()) {
  const next = r.milestones.filter((m) => m.status === 'upcoming' && !m.eventId).slice(0, 2);
  for (const m of next) {
    const want = m.part === 'TOK' ? 'service' : REQ_LINE[r.student.id];
    const lineId = r.student.laneOrder.includes(want) ? want : r.student.laneOrder[0];
    store.events.push({ id: `ev-rq-${r.student.id}-${m.id}`, studentId: r.student.id, title: `${m.part}: ${m.name.toLowerCase()}`, date: m.due, lineIds: [lineId], type: 'goal', summary: `DP core requirement from ManageBac. Supervisor: ${r.supervisor?.name}.`, about: '', evidence: [], verification: 'school-verified', visibility: 'advisor', source: { system: 'ManageBac', ref: `dp-${m.id}` }, requirement: true });
  }
}
for (const [sid, lineId, title, date] of [['st-03', 'service', 'Service as Action: two more experiences', '2027-03-01'], ['st-06', 'music', 'MYP Personal Project: proposal', '2026-12-04']]) {
  if (getStudent(sid)?.laneOrder.includes(lineId)) store.events.push({ id: `ev-rq-${sid}-${lineId}`, studentId: sid, title, date, lineIds: [lineId], type: 'goal', summary: 'MYP requirement from ManageBac.', about: '', evidence: [], verification: 'school-verified', visibility: 'advisor', source: { system: 'ManageBac', ref: 'myp-req' }, requirement: true });
}

// ── L: school-wide audit log ──────────────────────────────────────────
export function auditLog() {
  return store.students.flatMap((s) => getActivity(s.id).map((a) => ({ ...a, studentId: s.id, student: s.name }))).sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.ts.localeCompare(a.ts));
}

// ── Sponsors: a teacher attached to planned work before it happens, even outside any school system ─
export const getSponsored = (teacherId) => store.events.filter((e) => e.sponsor?.teacherId === teacherId).map((e) => ({ ...e, student: getStudent(e.studentId) }));
export function answerSponsor(eventId, ok, expectations) {
  const e = getEvent(eventId); const t = teacherById[e.sponsor.teacherId];
  e.sponsor = { ...e.sponsor, status: ok ? 'accepted' : 'declined', expectations: expectations || '', answeredOn: TODAY };
  if (ok) e.visibility = e.visibility === 'private' ? 'advisor' : e.visibility;
  notify(toStudent(e.studentId), ok ? `${t.name} will sponsor “${e.title}”` : `${t.name} can't sponsor “${e.title}”`, { persona: toStudent(e.studentId), screen: 'map', param: e.id });
  log(e.studentId, t.name, 'endorse', ok ? `Agreed to sponsor “${e.title}”` : `Declined to sponsor “${e.title}”`);
  emit();
}
export function addCheckIn(eventId, text, by) {
  const e = getEvent(eventId);
  e.sponsor.checkIns = [...e.sponsor.checkIns, { date: TODAY, text, by }];
  const who = by === 'student' ? getStudent(e.studentId).name : teacherById[by]?.name;
  if (by === 'student') notify(toTeacher(e.sponsor.teacherId), `${who.split(' ')[0]} posted an update on “${e.title}”`, { persona: toTeacher(e.sponsor.teacherId), screen: 'queue' });
  else notify(toStudent(e.studentId), `${who} checked in on “${e.title}”`, { persona: toStudent(e.studentId), screen: 'map', param: e.id });
  log(e.studentId, who, 'prompt', `Check-in on “${e.title}”: ${text}`);
  emit();
}
store.events.push(
  { id: 'ev-sp-1', studentId: 'st-01', title: 'Water-quality buoy for Bang Krachao', date: '2027-02-20', lineIds: ['computing', 'environment'], type: 'goal', summary: 'An independent project: a solar buoy that logs canal water quality and posts it online.', about: '', evidence: [], verification: 'student-added', visibility: 'advisor', source: { system: 'Manual entry', ref: null },
    sponsor: { teacherId: 't-01', status: 'accepted', note: 'Could you supervise this? It builds on the sensor network.', expectations: 'Working prototype by January; a short write-up of the calibration.', invitedOn: '2026-10-02', answeredOn: '2026-10-03', checkIns: [{ date: '2026-10-17', text: 'Hull printed and sealed. Waiting on the turbidity sensor.', by: 'student' }, { date: '2026-10-18', text: 'Good progress. Test it in the pool before the canal.', by: 't-01' }] } },
  { id: 'ev-sp-2', studentId: 'st-02', title: 'Global Game Jam 2027', date: '2027-01-24', lineIds: ['computing', 'music'], type: 'goal', summary: 'A 48-hour game jam at a Bangkok site, outside school. Planning to write the audio engine.', about: '', evidence: [], verification: 'student-added', visibility: 'advisor', source: { system: 'Manual entry', ref: null },
    sponsor: { teacherId: 't-01', status: 'invited', note: 'Would you be my sponsor so it can count on my map? I will post a build after each day.', expectations: '', invitedOn: '2026-10-24', checkIns: [] } },
);

// ── F2 to F4: the demo survives a reload, can be reset, and stays in step across tabs ─
// Everything lives in this browser's localStorage. A new build version starts clean.
const SEED = JSON.stringify(store);
// The key carries a hash of the seed, so a deploy that changes the seed data starts everyone clean.
const STORE_KEY = `tp-store-${[...SEED].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(36)}`;
let saveTimer = null, applying = false, publicCopy = false, previewOnly = false;
function persist() {
  if (applying || publicCopy || previewOnly) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ store, seq, at: Date.now() })); } catch { /* storage full or blocked: the demo still works in memory */ }
  }, 150);
}
function apply(saved) {
  applying = true;
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, saved.store);
  // Saves from before the roster import have no class lists.
  store.classes ||= []; store.enrolments ||= [];
  seq = Math.max(seq, saved.seq || 0);
  listeners.forEach((fn) => fn());
  applying = false;
}
try { const raw = localStorage.getItem(STORE_KEY); if (raw) apply(JSON.parse(raw)); } catch { /* ignore a broken save */ }
// Another tab changed the record: take its copy. Endorse on the laptop, see the badge flip on the iPad.
// (With the pilot server, tabs keep in step through the server instead.)
try { addEventListener('storage', (e) => { if (!hook && !publicCopy && !previewOnly && e.key === STORE_KEY && e.newValue) { try { apply(JSON.parse(e.newValue)); } catch { /* ignore */ } } }); } catch { /* no window */ }
export const isSaved = () => { try { return !!localStorage.getItem(STORE_KEY); } catch { return false; } };
// F3: back to the seeded record, in every open tab.
export function resetDemo() {
  clearTimeout(saveTimer);
  try { Object.keys(localStorage).filter((k) => k.startsWith('tp-')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  apply({ store: JSON.parse(SEED), seq: 1 });
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ store, seq, at: Date.now() })); } catch { /* ignore */ }
}

// Pilot clean start (TP_START=empty, server/store.mjs): the school's lines and settings, and none of the
// fictional people, stations, reflections, drafts, requests, notes or applications. Every key stays, empty.
export function emptyStart() {
  const seed = JSON.parse(SEED);
  const keep = { lines: seed.lines.filter((l) => !l.studentId), integrations: seed.integrations.map((i) => ({ ...i, lastSynced: null, itemCount: 0 })), family: seed.family, rollout: seed.rollout };
  const out = {};
  for (const [k, v] of Object.entries(seed)) out[k] = k in keep ? keep[k] : Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : v;
  out.cleanStart = true; // no made-up starter stations at onboarding either
  apply({ store: out, seq: 1 });
}

// ── F9: undo. A copy of the record before a quick action; Undo puts it back. ─
// With the server, Undo instead takes back the changes made since the snapshot (src/sync.js undoSince):
// markOf(snap) is the change count when it was taken (the last few snapshots are remembered).
const marks = new Map();
export const snapshot = () => { const s = JSON.stringify({ store, seq }); marks.set(s, changeNo); if (marks.size > 8) marks.delete(marks.keys().next().value); return s; };
export const markOf = (snap) => marks.get(snap);
export function restore(snap) { apply(JSON.parse(snap)); persist(); }
// The server's copy of the record arrived (src/sync.js). Not a change of its own, so never sent back,
// and not saved here either: only changes made in this browser are kept here (for when the server is away).
export function load(saved) { publicCopy = false; apply(saved); }
// Public share and verify pages: show the pruned copy the server sent. It is never saved in this browser.
export const hasPublicCopy = () => publicCopy;
export function loadPublic(snap) { publicCopy = true; clearTimeout(saveTimer); apply(typeof snap === 'string' ? JSON.parse(snap) : snap); }

// ── F5: students act on their own stations ────────────────────────────
export function editStation(id, patch) {
  const e = getEvent(id); if (!e || e.verification !== 'student-added') return;
  const { hidden, ...rest } = patch || {}; // only moderateReport hides or shows a moment
  Object.assign(e, rest);
  log(e.studentId, getStudent(e.studentId).name, 'station', `Edited “${e.title}”`);
  emit();
}
export function deleteStation(id) {
  const e = getEvent(id); if (!e || e.verification !== 'student-added') return;
  store.events = store.events.filter((x) => x.id !== id);
  store.reflections = store.reflections.filter((r) => r.eventId !== id);
  store.requests = store.requests.filter((r) => r.eventId !== id || r.status !== 'pending');
  log(e.studentId, getStudent(e.studentId).name, 'station', `Deleted “${e.title}”`);
  emit();
}
export const requestFor = (eventId) => store.requests.find((r) => r.eventId === eventId && (r.status === 'pending' || r.status === 'returned'));
// ── F6: the "ask for more" loop. The student adds evidence and the item goes back to the teacher. ─
export function resubmit(requestId, evidence, note) {
  const r = store.requests.find((x) => x.id === requestId); if (!r) return;
  const e = getEvent(r.eventId);
  if (evidence) e.evidence = [...e.evidence, evidence];
  Object.assign(r, { status: 'pending', resubmitted: true, date: TODAY, note: note || r.note, fresh: true });
  const s = getStudent(r.studentId);
  notify(toTeacher(r.teacherId), `${s.name.split(' ')[0]} added evidence to “${e.title}” and resubmitted it`, { persona: toTeacher(r.teacherId), screen: 'queue' });
  log(r.studentId, s.name, 'request', `Added evidence to “${e.title}” and resubmitted it to ${teacherById[r.teacherId].name}`);
  emit();
}

// ── N1: families ──────────────────────────────────────────────────────
// Years 7 to 9 (grades 6 to 8) need a parent's consent; families see what the advisor sees.
// From Year 10 the student decides, and families see what the student shares with the school.
export const youngStudent = (s) => s.grade <= 8;
export const familyViewer = (studentId) => (youngStudent(getStudent(studentId)) ? 'advisor' : 'school');
export const getConsentReqs = (studentId) => store.consentReqs.filter((r) => r.studentId === studentId);
export const consentOnFile = (studentId) => !youngStudent(getStudent(studentId)) || store.consentReqs.some((r) => r.studentId === studentId && r.kind === 'join' && r.status === 'approved');
export function answerConsent(id, status, by) {
  const r = store.consentReqs.find((x) => x.id === id);
  if (!r) return;
  r.status = status; r.answered = TODAY;
  const s = getStudent(r.studentId);
  log(r.studentId, by, 'consent', `${status === 'approved' ? 'Gave' : status === 'declined' ? 'Declined' : 'Withdrew'} consent: ${r.title}`);
  notify(toStudent(r.studentId), status === 'approved' ? `Your parent said yes: ${r.title}` : `Your parent said no for now: ${r.title}`, { persona: toStudent(r.studentId), screen: 'privacy' });
  // The student's advisor hears; the demo's advisor persona also hears about every seeded student, as before.
  for (const to of new Set([toTeacher(s.advisorId), s.pilot ? null : 'whitfield'])) notify(to, `${s.name.split(' ')[0]}’s family answered a consent request`);
  emit();
}
export function remindParent(studentId) {
  const s = getStudent(studentId);
  notify(toFamily(studentId), `${s.name.split(' ')[0]} asked you to look at a consent request`, { persona: toFamily(studentId), screen: 'consent', param: studentId });
  log(studentId, s.name, 'consent', 'Sent a reminder to a parent about consent');
  emit();
}
export const getFamily = () => store.family;
// N2: one language setting for the app shell and the family screens.
// Thai for families: in a pilot each person has their own language (their account's `lang`, set by setOwnLang from
// src/auth.js); the demo keeps the one shared setting, store.family.lang.
let ownLang = null;
export const getLang = () => ownLang || store.family.lang;
export function setOwnLang(lang) { const l = lang === 'th' || lang === 'en' ? lang : null; if (l !== ownLang) { ownLang = l; listeners.forEach((fn) => fn()); } }
export function setLang(lang) { store.family.lang = lang; emit(); }
export function setFamily(patch) { Object.assign(store.family, patch); emit(); }
// A week of one child's record, as a family would see it.
export function getDigest(studentId, days = 7) {
  const from = new Date(new Date(`${TODAY}T12:00:00`).getTime() - days * 86400000).toISOString().slice(0, 10);
  const map = getStudentMap(studentId, familyViewer(studentId), { family: true });
  const inWeek = (d) => d > from && d <= TODAY;
  const stations = map.events.filter((e) => inWeek(e.date) && e.type !== 'goal' && e.type !== 'reflection');
  const reflections = map.events.filter((e) => inWeek(e.date) && e.type === 'reflection').length + map.events.flatMap((e) => e.reflections).filter((r) => r.date && inWeek(r.date)).length;
  const endorsed = map.events.flatMap((e) => e.endorsements.filter((n) => inWeek(n.date)).map((n) => ({ teacher: n.teacher?.name, title: e.title })));
  const views = getActivity(studentId).filter((a) => a.kind === 'view' && inWeek(a.ts.slice(0, 10))).length;
  const soon = new Date(new Date(`${TODAY}T12:00:00`).getTime() + 42 * 86400000).toISOString().slice(0, 10);
  const coming = map.events.filter((e) => e.type === 'goal' && e.date > TODAY && e.date <= soon);
  return { from, stations, reflections, endorsed, views, coming, map };
}

// ── N4: spot duplicates when a synced item matches a station the student already has ──
const DUP_STOP = new Set(['with', 'from', 'that', 'this', 'term', 'place', 'first', 'second', 'result', 'team', 'certificate']);
const titleWords = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !DUP_STOP.has(w)));
const RANK = { 'student-added': 0, 'teacher-endorsed': 1, 'school-verified': 2 };
export function findDuplicate(c) {
  const cw = titleWords(c.title);
  let best = null;
  for (const e of store.events) {
    if (e.studentId !== c.studentId || e.type === 'goal' || e.mergedFrom?.some((m) => m.ref === c.source?.ref)) continue;
    const days = Math.abs(new Date(e.date) - new Date(c.date)) / 86400000;
    if (days > 21) continue;
    const ew = titleWords(e.title);
    const shared = [...cw].filter((w) => ew.has(w)).length;
    const score = shared / Math.max(1, Math.min(cw.size, ew.size));
    if (shared >= 2 || score >= 0.5) if (!best || score > best.score) best = { event: e, score };
  }
  return best?.event || null;
}
export function mergeCandidate(candId, eventId) {
  const c = store.inbox.find((x) => x.id === candId);
  const e = getEvent(eventId);
  if (!c || !e) return null;
  store.inbox = store.inbox.filter((x) => x.id !== candId);
  const stronger = RANK[c.verification] > RANK[e.verification];
  const was = e.verification;
  if (stronger) { e.verification = c.verification; e.source = { ...c.source, original: e.source?.system }; }
  e.evidence = [...e.evidence, ...c.evidence.filter((v) => !e.evidence.some((x) => x.caption === v.caption))];
  e.mergedFrom = [...(e.mergedFrom || []), { system: c.source.system, ref: c.source.ref, date: TODAY, title: c.title }];
  // A school record now backs it, so an open endorsement request is no longer needed.
  if (stronger && c.verification === 'school-verified') store.requests.forEach((r) => { if (r.eventId === e.id && r.status === 'pending') r.status = 'withdrawn'; });
  log(e.studentId, getStudent(e.studentId).name, 'station', `Merged “${c.title}” from ${c.source.system} into “${e.title}”${stronger ? ` (${was} → ${e.verification})` : ''}`);
  emit();
  return { event: e, stronger };
}


// ── N6: IB learner profile attributes and ATL skills on stations ──────
export const LEARNER_PROFILE = ['Inquirer', 'Knowledgeable', 'Thinker', 'Communicator', 'Principled', 'Open-minded', 'Caring', 'Risk-taker', 'Balanced', 'Reflective'];
export const ATL = ['Thinking', 'Communication', 'Social', 'Self-management', 'Research'];
const LP_RULES = [
  ['Risk-taker', (e, t) => e.type === 'competition' || /hackathon|ab initio|solo|audition|first ep|first time|stepped up|new to/.test(t)],
  ['Caring', (e, t) => e.type === 'service' || /volunteer|tutor|buddy|buddies|mentor|community|girls|year 2|y7|y8/.test(t)],
  ['Inquirer', (e, t) => /research|investigat|question|explor|essay|\bia\b|science fair|survey/.test(t)],
  ['Thinker', (e, t) => /model|design|predict|analys|solv|algorithm|prototype|engine|sensor/.test(t)],
  ['Communicator', (e, t) => /present|perform|concert|debate|oral|commentary|exhibition|french|spanish|japanese|thai|chatbot|report/.test(t)],
  ['Principled', (e, t) => /lead|captain|organis|committee|integrity|commit/.test(t)],
  ['Open-minded', (e, t) => /exchange|culture|language|international|global|perspective/.test(t)],
  ['Balanced', (e, t) => ['sport', 'club'].includes(e.type) || /swim|football|choir|band|squad|club/.test(t)],
  ['Knowledgeable', (e, t) => ['assessment', 'class', 'award'].includes(e.type) || /exam|grade \d|certificate|course|unit/.test(t)],
  ['Reflective', (e) => e.type === 'reflection' || store.reflections.some((r) => r.eventId === e.id)],
];
const ATL_RULES = [
  ['Research', (e, t) => /research|data|essay|\bia\b|survey|investigat|report|microplastic/.test(t)],
  ['Thinking', (e, t) => /model|design|predict|analys|solv|prototype|algorithm|engine|code|game/.test(t)],
  ['Communication', (e, t) => /present|perform|concert|oral|commentary|exhibition|chatbot|language|writ/.test(t)],
  ['Social', (e, t) => /team|club|band|choir|buddy|buddies|group|squad|committee/.test(t)],
  ['Self-management', (e, t) => /deadline|training|practice|hours|submission|season|grade \d|marathon/.test(t)],
];
function autoTags(e) {
  const t = `${e.title} ${e.summary || ''} ${e.about || ''}`.toLowerCase();
  return { lp: LP_RULES.filter(([, f]) => f(e, t)).map(([k]) => k).slice(0, 3), atl: ATL_RULES.filter(([, f]) => f(e, t)).map(([k]) => k).slice(0, 2), auto: true };
}
export function getTags(e) { return store.tags[e.id] || autoTags(e); }
export function setTags(eventId, tags) {
  const e = getEvent(eventId); if (!e) return;
  store.tags[eventId] = { lp: tags.lp, atl: tags.atl, auto: false };
  log(e.studentId, getStudent(e.studentId).name, 'station', `Tagged “${e.title}”: ${[...tags.lp, ...tags.atl].join(', ') || 'no tags'}`);
  emit();
}
// Leadership sees counts only: how many students have at least one station showing each attribute.
export function profileCoverage() {
  const students = getStudents({ includeCohort: true }).filter((s) => store.events.some((e) => e.studentId === s.id));
  const has = (k, field) => students.filter((s) => store.events.some((e) => e.studentId === s.id && e.type !== 'goal' && getTags(e)[field].includes(k))).length;
  return { n: students.length, lp: LEARNER_PROFILE.map((k) => ({ k, n: has(k, 'lp') })), atl: ATL.map((k) => ({ k, n: has(k, 'atl') })),
    stations: (k, field) => store.events.filter((e) => e.type !== 'goal' && getTags(e)[field].includes(k)).length };
}

// ── N12: one ManageBac task, endorsed for the whole class at once ─────
export const getClassTasks = (teacherId) => store.classTasks.filter((t) => t.teacherId === teacherId);
export function endorseClassTask(taskId, studentIds, note) {
  const t = store.classTasks.find((x) => x.id === taskId);
  if (!t) return 0;
  const teacher = teacherById[t.teacherId];
  for (const sid of studentIds) {
    const st = getStudent(sid);
    const line = st.laneOrder.find((l) => l === 'computing' || lineById(l)?.parentLineId === 'computing') || 'computing';
    store.inbox.push({ id: uid('ev-'), studentId: sid, title: t.title, date: t.due, lineIds: [line], suggestedLineIds: [line], type: t.type, summary: t.summary, evidence: [],
      verification: 'teacher-endorsed', visibility: 'advisor', source: { system: 'ManageBac', ref: t.ref }, sourceId: 'lms', classEndorsement: { teacherId: t.teacherId, note, date: TODAY } });
    log(sid, teacher.name, 'endorsement', `Endorsed “${t.title}” for the whole class`);
    notify(toStudent(sid), `${teacher.name} endorsed “${t.title}”. It is in your inbox.`, { persona: toStudent(sid), screen: 'inbox' });
  }
  t.done = { count: studentIds.length, at: TODAY, note };
  emit();
  return studentIds.length;
}

// ── Interface intensity: how much of the student interface is showing. It never changes the record. ──
export const INTENSITY = [
  ['simple', 'Simple', 'Your map, add a moment, answer a question, share a page'],
  ['standard', 'Standard', 'Adds the inbox, lines and branches, the builder and audiences'],
  ['full', 'Full', 'Everything: code, time travel, search, comparisons and settings'],
];
// Default by Year: Years 7–8 Simple, 9–11 Standard, 12–13 Full.
export const defaultIntensity = (s) => (s.grade + 1 <= 8 ? 'simple' : s.grade + 1 <= 11 ? 'standard' : 'full');
export const getIntensity = (studentId) => store.intensity[studentId] || defaultIntensity(getStudent(studentId));
export function setIntensity(studentId, level) {
  store.intensity[studentId] = level;
  log(studentId, getStudent(studentId).name, 'privacy', `Set the interface to ${level}`);
  emit();
}
// Screens each level shows. The first is home.
export const INTENSITY_NAV = { simple: ['map', 'family'], standard: ['map', 'studio', 'inbox', 'links', 'privacy'], full: ['map', 'studio', 'shared', 'inbox', 'links', 'activity', 'privacy'] };
export const INTENSITY_LABEL = { simple: { map: 'My journey' } };

// ── Pilot: subjects on lines, and a teacher's classes (screens/SubjectLines.jsx, screens/MyClasses.jsx) ──
// A coordinator or admin puts a subject the class lists left off every line (Mathematics, TOK…) on a school
// line, or leaves it off the map (null). Every class of that subject changes, and later imports remember it.
export const getSubjectLines = () => store.subjectLines || {};
export function setSubjectLine(subject, lineId = null) {
  const s = String(subject ?? '').trim();
  if (!s) throw Object.assign(new Error('Say which subject'), { status: 400 });
  const id = lineId || null;
  if (id && !getSchoolLines().some((l) => l.id === id)) throw Object.assign(new Error(`Not a school line: ${id}`), { status: 400 });
  store.subjectLines = { ...getSubjectLines(), [s]: id };
  let n = 0;
  for (const c of getClasses()) if (c.subject === s && (c.lineId ?? null) !== id) { c.lineId = id; n++; }
  emit();
  return n;
}
// Subjects with a class on no line, and subjects already decided: [{ subject, classes, unlinked, decided, lineId }].
export function subjectsOffLines() {
  const by = new Map(), chosen = getSubjectLines();
  for (const c of getClasses()) {
    if (!c.subject) continue;
    const x = by.get(c.subject) || by.set(c.subject, { subject: c.subject, classes: 0, unlinked: 0 }).get(c.subject);
    x.classes++; if (!c.lineId) x.unlinked++;
  }
  return [...by.values()].filter((x) => x.unlinked || Object.hasOwn(chosen, x.subject))
    .map((x) => ({ ...x, decided: Object.hasOwn(chosen, x.subject), lineId: chosen[x.subject] ?? null }))
    .sort((a, b) => b.classes - a.classes || a.subject.localeCompare(b.subject));
}
// rootLine, indexed: a student's sub-line counts for its school line.
const rootIndex = () => { const m = new Map(store.lines.map((l) => [l.id, l.parentLineId || l.id])); return (id) => m.get(id) || id; };
const currentPlaces = (classIds) => {
  const out = new Map([...classIds].map((id) => [id, []])), known = new Set(store.students.map((s) => s.id)), had = new Set();
  for (const e of getEnrolments()) if (out.has(e.classId)) { had.add(e.classId); if (!(e.to && e.to < TODAY) && known.has(e.studentId)) out.get(e.classId).push(e.studentId); }
  return { out, had };
};
// A teacher's current classes: [{ ...class, line, studentIds, recent }], recent = moments its students added
// on the class's line in the last 30 days. A class whose places have all ended is left out.
export function classesOf(teacherId) {
  const mine = getClasses().filter((c) => c.teacherIds?.includes(teacherId));
  if (!mine.length) return [];
  const { out, had } = currentPlaces(new Set(mine.map((c) => c.id)));
  const since = daysBefore(30), root = rootIndex(), recent = new Map();
  for (const e of store.events) {
    if (e.type === 'goal' || e.date < since || e.date > TODAY) continue;
    for (const l of new Set(e.lineIds.map(root))) { const k = `${e.studentId}|${l}`; recent.set(k, (recent.get(k) || 0) + 1); }
  }
  return mine.filter((c) => out.get(c.id).length || !had.has(c.id))
    .map((c) => ({ ...c, line: (c.lineId && lineById(c.lineId)) || null, studentIds: out.get(c.id), recent: c.lineId ? out.get(c.id).reduce((n, sid) => n + (recent.get(`${sid}|${c.lineId}`) || 0), 0) : 0 }))
    .sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name));
}
// One class: its students, each with their last moment on the class's line and requests waiting for this teacher.
export function classRoster(classId, teacherId) {
  const c = getClasses().find((x) => x.id === classId);
  if (!c) return null;
  const sids = currentPlaces(new Set([c.id])).out.get(c.id), inClass = new Set(sids), root = rootIndex();
  const last = new Map(), pending = new Map();
  if (c.lineId) for (const e of store.events) {
    if (!inClass.has(e.studentId) || e.type === 'goal' || e.date > TODAY || !e.lineIds.some((l) => root(l) === c.lineId)) continue;
    const p = last.get(e.studentId);
    if (!p || e.date > p.date || (e.date === p.date && e.id > p.id)) last.set(e.studentId, e);
  }
  for (const r of store.requests) if (r.teacherId === teacherId && r.status === 'pending' && inClass.has(r.studentId)) pending.set(r.studentId, (pending.get(r.studentId) || 0) + 1);
  const students = sids.map(getStudent).map((s) => ({ student: s, last: last.get(s.id) || null, pending: pending.get(s.id) || 0 })).sort((a, b) => a.student.name.localeCompare(b.student.name));
  return { ...c, line: (c.lineId && lineById(c.lineId)) || null, students };
}

// ── Class prompts: a teacher asks a whole class one question (after the science fair, a trip) ──
// store.classPrompts: { id, classId, teacherId, question, context, asMoment, lineId, due, date, at, studentIds, reminded }
// (studentIds: the class's students when it was asked). store.classAnswers: { id, promptId, studentId, date, at,
// skipped } or { …, text, eventId }. An answer is a reflection station on the class's line, or with asMoment a moment
// there waiting for the asking teacher's endorsement. Both lists are made on first use, so older saves need nothing.
const cPrompts = () => (store.classPrompts ||= []);
const cAnswers = () => (store.classAnswers ||= []);
const classById = (id) => getClasses().find((c) => c.id === id);
const nowIn = (classId) => currentPlaces(new Set([classId])).out.get(classId);
export const getClassPrompt = (id) => cPrompts().find((p) => p.id === id);
const answerOf = (promptId, studentId) => cAnswers().find((a) => a.promptId === promptId && a.studentId === studentId);
// A class's prompts, newest first, each with its answers (skips counted apart) and who has not answered yet.
export function classPrompts(classId) {
  return cPrompts().filter((p) => p.classId === classId).map((p) => {
    const all = cAnswers().filter((a) => a.promptId === p.id);
    const answers = all.filter((a) => !a.skipped);
    const done = new Set(all.map((a) => a.studentId));
    return { ...p, answers, skipped: all.length - answers.length, waiting: p.studentIds.filter((sid) => !done.has(sid)) };
  }).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
// The prompts a student has not answered or skipped yet, oldest first.
export const openPromptsFor = (studentId) => cPrompts().filter((p) => p.studentIds.includes(studentId) && !answerOf(p.id, studentId))
  .sort((a, b) => a.at.localeCompare(b.at)).map((p) => ({ ...p, teacher: teacherById[p.teacherId] || null, className: classById(p.classId)?.name || '', line: (p.lineId && lineById(p.lineId)) || null }));
export function askClass(classId, teacherId, { question, context = '', asMoment = false, due = null } = {}) {
  const c = classById(classId);
  if (!c) throw Object.assign(new Error('No such class'), { status: 404 });
  if (!teacherById[teacherId]) throw Object.assign(new Error('No such teacher'), { status: 400 });
  const q = String(question || '').trim().slice(0, 300);
  if (q.length < 5) throw Object.assign(new Error('Write the question first'), { status: 400 });
  const studentIds = nowIn(classId);
  const p = { id: uid('cq-'), classId, teacherId, question: q, context: String(context || '').trim().slice(0, 200), asMoment: !!asMoment && !!c.lineId, lineId: c.lineId || null,
    due: /^\d{4}-\d{2}-\d{2}$/.test(due || '') ? due : null, date: TODAY, at: nowIso(), studentIds, reminded: null };
  cPrompts().push(p);
  const t = teacherById[teacherId];
  for (const sid of studentIds) notify(toStudent(sid), `${t.name} asked ${c.name} a question: “${q}”`, { persona: toStudent(sid), screen: 'map' });
  emit();
  return p;
}
// Once a day at most: a reminder to everyone who has neither answered nor skipped and is still in the class.
export function remindClass(promptId, teacherId) {
  const p = getClassPrompt(promptId);
  if (!p) throw Object.assign(new Error('No such question'), { status: 404 });
  if (p.reminded === TODAY) return 0;
  const still = new Set(nowIn(p.classId));
  const rest = p.studentIds.filter((sid) => still.has(sid) && !answerOf(p.id, sid));
  const t = teacherById[teacherId] || teacherById[p.teacherId];
  for (const sid of rest) notify(toStudent(sid), `Reminder from ${t?.name || 'your teacher'}: “${p.question}”`, { persona: toStudent(sid), screen: 'map' });
  p.reminded = TODAY;
  emit();
  return rest.length;
}
// The student's lane for a school line: the line itself or one of their sub-lines of it; added to their map if missing.
const laneFor = (s, lineId) => {
  const lane = s.laneOrder.find((l) => l === lineId || lineById(l)?.parentLineId === lineId);
  if (lane) return lane;
  if (!lineById(lineId)) return s.laneOrder[0] || null;
  s.laneOrder.push(lineId); return lineId;
};
export function answerPrompt(promptId, studentId, { text, image = null, imageCaption = 'Photo', title } = {}) {
  const p = getClassPrompt(promptId), s = getStudent(studentId);
  if (!p || !s || !p.studentIds.includes(studentId)) throw Object.assign(new Error('This question is not for you'), { status: 404 });
  if (answerOf(promptId, studentId)) throw Object.assign(new Error('You already answered this'), { status: 409 });
  const answer = String(text || '').trim().slice(0, 4000);
  if (!answer) throw Object.assign(new Error('Write an answer first'), { status: 400 });
  const lane = p.lineId ? laneFor(s, p.lineId) : s.laneOrder[0] || null;
  let e = null;
  if (lane) {
    const name = String(title || '').trim().slice(0, 120) || p.context || p.question;
    e = addStation(studentId, p.asMoment
      ? { title: name, lineIds: [lane], type: 'project', image, imageCaption, visibility: 'advisor', via: 'Class question', requestFrom: teacherById[p.teacherId] ? p.teacherId : null, requestNote: `Answer to “${p.question}”` }
      : { title: `Reflection: ${p.context || p.question}`, lineIds: [lane], type: 'reflection', image, imageCaption, visibility: 'advisor', via: 'Class question' });
    store.reflections.push({ id: uid('rf-x'), eventId: e.id, text: answer, prompt: p.question, date: e.date, visibility: 'advisor' });
  }
  const a = { id: uid('ca-'), promptId, studentId, date: TODAY, at: nowIso(), text: answer, eventId: e?.id || null };
  cAnswers().push(a);
  log(studentId, s.name, 'reflection', `Answered “${p.question}”`);
  emit();
  return a;
}
// "Not for me": hidden from the student; the teacher sees it as skipped.
export function skipPrompt(promptId, studentId) {
  const p = getClassPrompt(promptId);
  if (!p || !p.studentIds.includes(studentId)) throw Object.assign(new Error('This question is not for you'), { status: 404 });
  if (answerOf(promptId, studentId)) return null;
  const a = { id: uid('ca-'), promptId, studentId, date: TODAY, at: nowIso(), skipped: true };
  cAnswers().push(a);
  emit();
  return a;
}

// ── Reviewing a class question's answers (ClassAnswers.jsx): read only, endorsing uses endorse/declineRequest ──
// One row per student asked. status: waiting | endorsed | more (asked for more) | answered (a reflection, or not a
// moment: nothing to endorse) | skipped ("Not for me") | none (not answered yet). request: the moment's endorsement
// request to the asking teacher, if any.
export const REVIEW_ORDER = ['waiting', 'more', 'endorsed', 'answered', 'skipped', 'none'];
export const REVIEW_LABEL = { waiting: 'Waiting', endorsed: 'Endorsed', more: 'Asked for more', answered: 'Answered', skipped: 'Not for them', none: 'Not answered yet' };
export function promptReview(promptId) {
  const p = getClassPrompt(promptId);
  if (!p) return null;
  const rows = p.studentIds.map((sid) => {
    const a = answerOf(p.id, sid), student = getStudent(sid) || null;
    if (!a || a.skipped) return { studentId: sid, student, answer: a || null, status: a ? 'skipped' : 'none' };
    const e = (a.eventId && getEvent(a.eventId)) || null;
    const request = (e && store.requests.find((r) => r.eventId === e.id && r.teacherId === p.teacherId)) || null;
    const status = !p.asMoment || !e ? 'answered' : e.verification === 'teacher-endorsed' ? 'endorsed'
      : request?.status === 'pending' ? 'waiting' : request?.status === 'returned' ? 'more' : 'answered';
    return { studentId: sid, student, answer: a, event: e, request, photo: e?.evidence.find((x) => x.kind === 'image') || null, status };
  }).sort((x, y) => REVIEW_ORDER.indexOf(x.status) - REVIEW_ORDER.indexOf(y.status) || (x.student?.name || '~').localeCompare(y.student?.name || '~'));
  return { prompt: { ...p, className: classById(p.classId)?.name || '', teacher: teacherById[p.teacherId] || null }, rows };
}
// The asking teacher's pending requests that answer one class question, grouped (2 or more) for the Endorsements queue.
export function classAnswerGroups(teacherId) {
  const byEvent = new Map(cAnswers().filter((a) => a.eventId).map((a) => [a.eventId, a.promptId]));
  const out = new Map();
  for (const r of store.requests) {
    if (r.teacherId !== teacherId || r.status !== 'pending' || !byEvent.has(r.eventId)) continue;
    const p = getClassPrompt(byEvent.get(r.eventId));
    if (!p || p.teacherId !== teacherId) continue;
    if (!out.has(p.id)) out.set(p.id, { prompt: { ...p, className: classById(p.classId)?.name || '' }, requests: [] });
    out.get(p.id).requests.push({ ...r, student: getStudent(r.studentId), event: getEvent(r.eventId) });
  }
  return [...out.values()].filter((g) => g.requests.length > 1);
}
// "Download answers (CSV)": every student asked, with a status, from the record this browser holds. A UTF-8 BOM
// so Excel reads Thai names; cells starting = + - @ get a leading ' so a spreadsheet never runs them.
export function answersCsv(promptId) {
  const rv = promptReview(promptId);
  if (!rv) return '';
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const when = (iso) => { if (!iso) return ''; const d = new Date(iso), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };
  const head = ['Name', 'Homeroom', 'Status', 'Answered at', 'Answer', 'Endorsed'];
  const rows = rv.rows.map((r) => [r.student?.name || r.studentId, r.student?.homeroom || '', REVIEW_LABEL[r.status], r.answer && !r.answer.skipped ? when(r.answer.at) : '',
    r.answer?.text || '', rv.prompt.asMoment && r.answer && !r.answer.skipped ? (r.status === 'endorsed' ? 'yes' : 'no') : '']);
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

// ── Class tasks: a teacher sets a task for a class; each student hands it in as a moment on its line ──
// store.teacherTasks: { id: 'tk-…', classId, teacherId, title, brief, due, lineId, checklist: [text], needsFile, date, at,
// studentIds (the class when it was set), editedAt }. store.handIns: one row per student who has anything on a task:
// { id: 'hi-…', taskId, studentId, due (an extension, or null), reminded (the due date reminded for), date, at, eventId,
// ticked: [index], again } (eventId null until handed in). A hand-in is a station on the task's line with an endorsement
// request to the teacher who set it, so endorse/declineRequest decide it. Both lists are made on first use.
const tTasks = () => (store.teacherTasks ||= []);
const tRows = () => (store.handIns ||= []);
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const dayAfter = (d, n = 1) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "today", "tomorrow", "Friday" (within a week), else "6 Nov 2026".
export function dueWords(due) {
  if (!ymd.test(due || '')) return '';
  const n = Math.round((Date.parse(due) - Date.parse(TODAY)) / 864e5);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 && n < 7 ? WEEKDAY[new Date(Date.parse(due)).getUTCDay()] : `${Number(due.slice(8))} ${MON[Number(due.slice(5, 7)) - 1]} ${due.slice(0, 4)}`;
}
export const getTask = (id) => tTasks().find((t) => t.id === id);
const rowOf = (taskId, studentId) => tRows().find((r) => r.taskId === taskId && r.studentId === studentId);
const rowFor = (taskId, studentId) => rowOf(taskId, studentId) || (tRows().push({ id: uid('hi-'), taskId, studentId, due: null, reminded: null, date: null, at: null, eventId: null, ticked: [] }), tRows().at(-1));
export const taskDue = (t, studentId) => rowOf(t.id, studentId)?.due || t.due;
const handInRequest = (t, e) => (e && store.requests.find((r) => r.eventId === e.id && r.teacherId === t.teacherId)) || null;
// One student's state on a task. status: none | overdue (not handed in, past due) | handed | late (after the due date);
// check: waiting | more (asked for more) | endorsed | null.
export function taskStatus(t, studentId) {
  const row = rowOf(t.id, studentId) || null, due = row?.due || t.due;
  const event = (row?.eventId && getEvent(row.eventId)) || null;
  if (!event) return { row, due, event: null, request: null, status: TODAY > due ? 'overdue' : 'none', check: null };
  const request = handInRequest(t, event);
  const check = event.verification === 'teacher-endorsed' ? 'endorsed' : request?.status === 'returned' ? 'more' : request?.status === 'pending' ? 'waiting' : null;
  return { row, due, event, request, status: row.date > due ? 'late' : 'handed', check };
}
function taskFields(f, c, old = {}) {
  const title = String(f.title ?? old.title ?? '').trim().slice(0, 120);
  if (title.length < 3) throw Object.assign(new Error('Give the task a title'), { status: 400 });
  const due = f.due ?? old.due;
  if (!ymd.test(due || '')) throw Object.assign(new Error('Pick a due date'), { status: 400 });
  const lineId = f.lineId !== undefined ? f.lineId : old.lineId ?? c?.lineId ?? null;
  const l = lineId && lineById(lineId);
  if (!l || l.studentId) throw Object.assign(new Error('Pick a line for the hand-ins'), { status: 400 });
  const checklist = (Array.isArray(f.checklist) ? f.checklist : old.checklist || []).map((x) => String(x ?? '').trim().slice(0, 120)).filter(Boolean);
  if (checklist.length > 5) throw Object.assign(new Error('Up to 5 checklist items'), { status: 400 });
  return { title, brief: String(f.brief ?? old.brief ?? '').trim().slice(0, 600), due, lineId, checklist, needsFile: !!(f.needsFile ?? old.needsFile) };
}
const taskView = (t) => ({ ...t, teacher: teacherById[t.teacherId] || null, className: classById(t.classId)?.name || '', line: lineById(t.lineId) || null });
// A class's tasks, newest first, with counts: handed (on time), late, notYet (overdue among them), waiting (to look at), endorsed.
export function tasksForClass(classId) {
  return tTasks().filter((t) => t.classId === classId).map((t) => {
    const st = t.studentIds.map((sid) => taskStatus(t, sid));
    const n = (k, v) => st.filter((x) => x[k] === v).length;
    return { ...taskView(t), handed: n('status', 'handed'), late: n('status', 'late'), notYet: n('status', 'none') + n('status', 'overdue'), overdue: n('status', 'overdue'), waiting: n('check', 'waiting'), endorsed: n('check', 'endorsed') };
  }).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
// The hand-in grid: one row per student the task was set for; to look at first, then asked for more, overdue, not yet, endorsed.
const GRID_ORDER = ['waiting', 'more', 'overdue', 'none', 'endorsed', 'other'];
export function taskGrid(taskId) {
  const t = getTask(taskId);
  if (!t) return null;
  const rows = t.studentIds.map((sid) => ({ studentId: sid, student: getStudent(sid) || null, ...taskStatus(t, sid) })).map((r) => ({
    ...r, photo: r.event?.evidence.find((x) => x.kind === 'image') || null, files: r.event?.evidence.filter((x) => x.kind !== 'image') || [],
    text: (r.event && store.reflections.filter((x) => x.eventId === r.event.id && x.prompt === t.title).map((x) => x.text).join('\n\n')) || '', key: r.check || (r.event ? 'other' : r.status),
  })).sort((a, b) => GRID_ORDER.indexOf(a.key) - GRID_ORDER.indexOf(b.key) || (a.student?.name || '~').localeCompare(b.student?.name || '~'));
  return { task: taskView(t), rows };
}
// A student's tasks: open ones (not handed in, or asked for more) by due date, then ones handed in during the last week.
export function tasksFor(studentId) {
  return tTasks().filter((t) => t.studentIds.includes(studentId)).map((t) => ({ ...taskView(t), ...taskStatus(t, studentId) }))
    .map((x) => ({ ...x, open: !x.event || x.check === 'more', reason: x.check === 'more' ? x.request?.reason || '' : '' }))
    .filter((x) => x.open || (x.row?.date || '') >= daysBefore(7))
    .sort((a, b) => b.open - a.open || a.due.localeCompare(b.due) || a.at.localeCompare(b.at));
}
// "Waiting for you": the teacher's tasks with hand-ins to look at, and those requests.
export function taskHandInWaits(teacherId) {
  return tTasks().filter((t) => t.teacherId === teacherId).map((t) => ({ task: taskView(t), requests: t.studentIds.map((sid) => taskStatus(t, sid)).filter((x) => x.check === 'waiting').map((x) => x.request) }))
    .filter((g) => g.requests.length);
}
export function setTask(classId, teacherId, f = {}) {
  const c = classById(classId), tr = teacherById[teacherId];
  if (!c) throw Object.assign(new Error('No such class'), { status: 404 });
  if (!tr) throw Object.assign(new Error('No such teacher'), { status: 400 });
  const t = { id: uid('tk-'), classId, teacherId, ...taskFields(f, c), date: TODAY, at: nowIso(), studentIds: nowIn(classId) || [], editedAt: null };
  tTasks().push(t);
  for (const sid of t.studentIds) notify(toStudent(sid), `${shortName(tr.name)} set a task: “${t.title}”, due ${dueWords(t.due)}`, { persona: toStudent(sid), screen: 'map' });
  emit();
  return t;
}
export function editTask(taskId, teacherId, f = {}) {
  const t = getTask(taskId);
  if (!t) throw Object.assign(new Error('No such task'), { status: 404 });
  const was = t.due;
  Object.assign(t, taskFields(f, classById(t.classId), t), { editedAt: nowIso() });
  if (t.due !== was) for (const sid of t.studentIds) if (!rowOf(t.id, sid)?.eventId && !rowOf(t.id, sid)?.due) notify(toStudent(sid), `“${t.title}” is now due ${dueWords(t.due)}`, { persona: toStudent(sid), screen: 'map' });
  emit();
  return t;
}
// More time for one student (due: a date, or null to go back to the task's date). A new date is reminded again.
export function extendTask(taskId, studentId, due, teacherId) {
  const t = getTask(taskId);
  if (!t || !t.studentIds.includes(studentId)) throw Object.assign(new Error('This task is not for that student'), { status: 404 });
  if (due !== null && !ymd.test(due || '')) throw Object.assign(new Error('Pick a date'), { status: 400 });
  const row = rowFor(taskId, studentId);
  row.due = due && due !== t.due ? due : null; row.reminded = null;
  const tr = teacherById[teacherId] || teacherById[t.teacherId];
  notify(toStudent(studentId), `${tr ? shortName(tr.name) : 'Your teacher'} gave you until ${dueWords(row.due || t.due)} for “${t.title}”`, { persona: toStudent(studentId), screen: 'map' });
  emit();
  return row;
}
// Hand in: a station on the task's line (the student's sub-line of it if they have one), what they did as its reflection,
// and an endorsement request to the teacher who set it. Asked for more: the same station gets the new words and files,
// and the request is pending again.
export function handInTask(taskId, studentId, { text = '', ticked = [], image = null, imageCaption = 'Photo', files = [] } = {}) {
  const t = getTask(taskId), s = getStudent(studentId);
  if (!t || !s || !t.studentIds.includes(studentId)) throw Object.assign(new Error('This task is not for you'), { status: 404 });
  const words = String(text || '').trim().slice(0, 4000);
  const extra = (Array.isArray(files) ? files : []).filter((x) => x && typeof x.url === 'string').slice(0, 5);
  if (t.needsFile && !image && !extra.length) throw Object.assign(new Error('This task needs a photo or a file'), { status: 400 });
  if (!words && !image && !extra.length) throw Object.assign(new Error('Say what you did first'), { status: 400 });
  const tick = [...new Set((Array.isArray(ticked) ? ticked : []).filter((i) => Number.isInteger(i) && i >= 0 && i < t.checklist.length))].sort((a, b) => a - b);
  const now = taskStatus(t, studentId);
  if (now.event && now.check !== 'more') throw Object.assign(new Error('You already handed this in'), { status: 409 });
  const row = rowFor(taskId, studentId);
  if (now.event) {
    now.event.evidence = [...now.event.evidence, ...(image ? [{ kind: 'image', url: image, caption: imageCaption }] : []), ...extra];
    if (words) store.reflections.push({ id: uid('rf-x'), eventId: now.event.id, text: words, prompt: t.title, date: TODAY, visibility: now.event.visibility });
    Object.assign(now.request, { status: 'pending', resubmitted: true, date: TODAY, fresh: true });
    Object.assign(row, { again: nowIso(), ticked: tick });
    notify(toTeacher(t.teacherId), `${s.name.split(' ')[0]} handed in “${t.title}” again`, { persona: toTeacher(t.teacherId), screen: 'classes', param: `${t.classId}~task~${t.id}` });
    log(studentId, s.name, 'request', `Handed in “${t.title}” again`);
  } else {
    const lane = laneFor(s, t.lineId);
    const e = addStation(studentId, { title: t.title, lineIds: [lane], type: 'project', image, imageCaption, files: extra, visibility: 'advisor', via: 'Class task',
      requestFrom: teacherById[t.teacherId] ? t.teacherId : null, requestNote: `Hand-in for “${t.title}”` });
    e.task = t.id;
    if (words) store.reflections.push({ id: uid('rf-x'), eventId: e.id, text: words, prompt: t.title, date: e.date, visibility: 'advisor' });
    Object.assign(row, { date: TODAY, at: nowIso(), eventId: e.id, ticked: tick });
  }
  emit();
  return row;
}
// The day before a task is due: one notification to each student still in the class who has not handed it in (an
// extension's date counts, and is reminded once too). The server runs it (server/routes/68-tasks.mjs); nobody else may.
export function remindDueTasks() {
  const tomorrow = dayAfter(TODAY);
  let n = 0;
  for (const t of tTasks()) {
    const still = new Set(nowIn(t.classId) || []);
    for (const sid of t.studentIds) {
      if (!still.has(sid)) continue;
      const row = rowOf(t.id, sid), due = row?.due || t.due;
      if (due !== tomorrow || row?.eventId || row?.reminded === due) continue;
      rowFor(t.id, sid).reminded = due;
      notify(toStudent(sid), `Reminder: “${t.title}” is due tomorrow`, { persona: toStudent(sid), screen: 'map' });
      n++;
    }
  }
  if (n) emit();
  return n;
}

// ── School events: sports day, a trip, a concert. Students it was for get a card on their home afterwards ──
// store.schoolEvents [{ id: 'se-…', title, start, end, for: { kind: 'school' | 'years' | 'homerooms' | 'classes', years,
// homerooms, classIds }, lineId (a school line, or null), photo (url or null), question, by (teacher id or null), at,
// studentIds (who it was for, when it was saved), reminded: { date, at, by, n } | null, editedAt }].
// store.schoolEventAdds [{ id: 'sx-…', eventId, studentId, momentId, added, dismissed, date, at }]: one row per student who
// added a moment from it (addStation with schoolEvent) or dismissed its card. Both made on first use.
// Card: from the day after the event ends, for SE_CARD_DAYS days (and 3 days after a reminder). Coming up: from
// SE_SOON_DAYS before it starts until it ends.
export const SE_CARD_DAYS = 5, SE_SOON_DAYS = 28;
const seList = () => (store.schoolEvents ||= []);
const seRows = () => (store.schoolEventAdds ||= []);
const seErr = (message, status = 400) => Object.assign(new Error(message), { status });
const seDay = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
export const getSchoolEvent = (id) => seList().find((x) => x.id === id);
export const getSchoolEvents = () => seList();
export const SE_KINDS = { school: 'Whole school', years: 'Some Years', homerooms: 'Some homerooms', classes: 'Some classes' };
// Who an event is for, from the record now: students (never cohort-only records) by Year, homeroom or current class place.
export function schoolEventStudents(f = {}) {
  const kids = store.students.filter((s) => !s.cohortOnly);
  if (f.kind === 'years') { const ys = new Set((f.years || []).map(Number)); return kids.filter((s) => ys.has(s.grade + 1)).map((s) => s.id); }
  if (f.kind === 'homerooms') { const hs = new Set(f.homerooms || []); return kids.filter((s) => hs.has(s.homeroom)).map((s) => s.id); }
  if (f.kind === 'classes') { const { out } = currentPlaces(new Set(f.classIds || [])); const ids = new Set([...out.values()].flat()); return kids.filter((s) => ids.has(s.id)).map((s) => s.id); }
  return kids.map((s) => s.id);
}
export const homeroomsOf = () => [...new Set(store.students.filter((s) => !s.cohortOnly && s.homeroom).map((s) => s.homeroom))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
function seFor(f) {
  const kind = f?.kind || 'school';
  if (!SE_KINDS[kind]) throw seErr('Pick who it is for');
  const years = kind === 'years' ? [...new Set((f.years || []).map(Number).filter((y) => y >= 7 && y <= 13))].sort((a, b) => a - b) : [];
  const homerooms = kind === 'homerooms' ? [...new Set((f.homerooms || []).map((h) => String(h).trim()).filter(Boolean))].slice(0, 80) : [];
  const classIds = kind === 'classes' ? [...new Set((f.classIds || []).filter((id) => classById(id)))].slice(0, 80) : [];
  if ((kind === 'years' && !years.length) || (kind === 'homerooms' && !homerooms.length) || (kind === 'classes' && !classIds.length)) throw seErr('Pick who it is for');
  return { kind, years, homerooms, classIds };
}
function seFields(f = {}, old = {}) {
  const title = String(f.title ?? old.title ?? '').trim().slice(0, 80);
  if (title.length < 3) throw seErr('Give the event a name');
  const start = f.start ?? old.start, end = f.end || (f.start ? f.start : old.end);
  if (!ymd.test(start || '') || !ymd.test(end || '')) throw seErr('Pick the date');
  if (end < start) throw seErr('The last day is before the first');
  const lineId = f.lineId !== undefined ? f.lineId || null : old.lineId ?? null;
  if (lineId && (!lineById(lineId) || lineById(lineId).studentId)) throw seErr('Pick a school line');
  const photo = f.photo !== undefined ? f.photo || null : old.photo ?? null;
  if (photo && (typeof photo !== 'string' || photo.length > 300 || !/^(\/?api\/files\/|https:\/\/)/.test(photo))) throw seErr('That photo did not upload');
  return { title, start, end, for: seFor(f.for ?? old.for), lineId, photo, question: String(f.question ?? old.question ?? '').trim().slice(0, 200) };
}
export function addSchoolEvent(f = {}, by = null) {
  if (by && !teacherById[by]) throw seErr('No such teacher');
  const x = { id: uid('se-'), ...seFields(f), by: by || null, at: nowIso(), reminded: null, editedAt: null };
  x.studentIds = schoolEventStudents(x.for);
  if (!x.studentIds.length) throw seErr('No students match who it is for');
  seList().push(x);
  emit();
  return x;
}
export function editSchoolEvent(id, f = {}, by = null) {
  const x = getSchoolEvent(id);
  if (!x) throw seErr('No such event', 404);
  const next = seFields(f, x), ids = schoolEventStudents(next.for);
  if (!ids.length) throw seErr('No students match who it is for');
  Object.assign(x, next, { studentIds: ids, editedAt: nowIso(), editedBy: by || null });
  emit();
  return x;
}
// Moments added from it keep its name (their source), so a family still sees it after the event is removed.
export function removeSchoolEvent(id, by = null) { // eslint-disable-line no-unused-vars
  const i = seList().findIndex((x) => x.id === id);
  if (i < 0) throw seErr('No such event', 404);
  const [x] = seList().splice(i, 1);
  store.schoolEventAdds = seRows().filter((r) => r.eventId !== id);
  emit();
  return x;
}
// A CSV list (parseEventsCsv in the browser): every row is checked first, then all are added, or none.
export function importSchoolEvents(rows = [], by = null) {
  if (!Array.isArray(rows) || !rows.length) throw seErr('There are no events in the file');
  if (rows.length > 200) throw seErr('Up to 200 events at a time');
  rows.forEach((r, i) => { try { seFields(r); if (!schoolEventStudents(seFor(r.for)).length) throw seErr('No students match who it is for'); } catch (e) { throw seErr(`Row ${i + 2}: ${e.message}`); } });
  return rows.map((r) => addSchoolEvent(r, by));
}
// title,start,end,years,line (a header row first; columns in any order). Years: "8", "7-9", "8;9" or empty (whole school).
// Dates: 2026-11-20 or 20/11/2026. line: a school line's name, or empty. → { rows, errors }
export function parseEventsCsv(text) {
  const recs = [];
  let row = [], cell = '', q = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); recs.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); recs.push(row); }
  const lines = recs.filter((r) => r.some((x) => x.trim()));
  if (!lines.length) return { rows: [], errors: ['The file is empty'] };
  const head = lines[0].map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  if (col('title') < 0 || col('start') < 0) return { rows: [], errors: ['The first row needs the column names: title, start, end, years, line'] };
  const day = (v) => { const s = String(v || '').trim(); if (ymd.test(s)) return s; const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s ? null : ''; };
  const lineOf = (v) => { const n = String(v || '').trim().toLowerCase(); if (!n) return null; return getSchoolLines().find((l) => l.name.toLowerCase() === n)?.id; };
  const rows = [], errors = [];
  lines.slice(1).forEach((r, i) => {
    const at = (k) => (col(k) >= 0 ? String(r[col(k)] ?? '').trim() : '');
    const n = i + 2, title = at('title'), start = day(at('start')), endRaw = day(at('end')), end = endRaw || start, lineId = lineOf(at('line'));
    const ys = at('years').replace(/years?/gi, '').trim();
    let years = [];
    if (ys && !/^(all|whole school)$/i.test(ys)) {
      for (const part of ys.split(/[;|/ ]+|,/).filter(Boolean)) { const m = part.match(/^(\d{1,2})(?:-(\d{1,2}))?$/); if (!m) { years = null; break; } for (let y = Number(m[1]); y <= Number(m[2] || m[1]); y++) years.push(y); }
    }
    if (!title) errors.push(`Row ${n}: no title`);
    else if (!start) errors.push(`Row ${n}: the start date is not a date (use 2026-11-20)`);
    else if (endRaw === null) errors.push(`Row ${n}: the end date is not a date`);
    else if (end < start) errors.push(`Row ${n}: it ends before it starts`);
    else if (years === null || years.some((y) => y < 7 || y > 13)) errors.push(`Row ${n}: Years should be 7 to 13, like 8 or 7-9`);
    else if (lineId === undefined) errors.push(`Row ${n}: no school line called “${at('line')}”`);
    else rows.push({ title: title.slice(0, 80), start, end, for: years.length ? { kind: 'years', years: [...new Set(years)] } : { kind: 'school' }, lineId });
  });
  return { rows, errors };
}
const seRow = (eventId, studentId) => seRows().find((r) => r.eventId === eventId && r.studentId === studentId);
// addStation(…, { schoolEvent }): only for a student it was for; the moment keeps the event's name as its source.
function linkSchoolEvent(e, id) {
  const x = getSchoolEvent(id), s = getStudent(e.studentId);
  if (!x || !s || !x.studentIds.includes(e.studentId)) return null;
  e.schoolEvent = x.id;
  e.source = { system: 'School event', ref: x.title };
  e.lineIds = e.lineIds.map((l) => laneFor(s, l)).filter(Boolean);
  const r = seRow(x.id, e.studentId);
  if (r) Object.assign(r, { momentId: r.added && getEvent(r.momentId) ? r.momentId : e.id, added: true });
  else seRows().push({ id: uid('sx-'), eventId: x.id, studentId: e.studentId, momentId: e.id, added: true, dismissed: false, date: TODAY, at: nowIso() });
  return x;
}
export function dismissSchoolEvent(id, studentId) {
  const x = getSchoolEvent(id);
  if (!x || !x.studentIds.includes(studentId)) throw seErr('This event is not for you', 404);
  const r = seRow(id, studentId);
  if (r) r.dismissed = true;
  else seRows().push({ id: uid('sx-'), eventId: id, studentId, momentId: null, added: false, dismissed: true, date: TODAY, at: nowIso() });
  emit();
}
export const schoolEventName = (e) => (e?.schoolEvent && getSchoolEvent(e.schoolEvent)?.title) || (e?.source?.system === 'School event' ? e.source.ref : null);
const seUntil = (x) => [seDay(x.end, SE_CARD_DAYS), x.reminded ? seDay(x.reminded.date, 3) : ''].sort().at(-1);
// The student's lane for the event's line, without changing anything (addStation puts it on the map).
const seLane = (s, lineId) => (lineId && (s.laneOrder.find((l) => l === lineId || lineById(l)?.parentLineId === lineId) || lineId)) || null;
const sePrefill = (x, s) => ({ title: x.title, date: x.start <= TODAY ? x.start : TODAY, lineIds: x.lineId ? [seLane(s, x.lineId)] : [], schoolEvent: x.id, question: x.question || '' });
// A student's home: cards to add something from events that ended (not added or dismissed yet), and what is coming up.
export function schoolEventsFor(studentId) {
  const s = getStudent(studentId);
  if (!s) return { cards: [], coming: [] };
  const mine = seList().filter((x) => x.studentIds.includes(studentId));
  const cards = mine.filter((x) => TODAY > x.end && TODAY <= seUntil(x) && !seRow(x.id, studentId)).sort((a, b) => b.end.localeCompare(a.end)).map((x) => ({ ...x, prefill: sePrefill(x, s) }));
  const coming = mine.filter((x) => x.end >= TODAY && x.start <= seDay(TODAY, SE_SOON_DAYS)).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
    .map((x) => ({ ...x, now: x.start <= TODAY, line: lineById(x.lineId) || null, goal: { title: x.title, date: x.start, lineId: x.lineId ? seLane(s, x.lineId) : null } }));
  return { cards, coming };
}
// Staff: the students this teacher sees for events (advisees and current class places).
export function staffStudentsOf(teacherId) {
  const mine = getClasses().filter((c) => teacherId && c.teacherIds?.includes(teacherId)).map((c) => c.id);
  const ids = new Set([...currentPlaces(new Set(mine)).out.values()].flat());
  for (const s of store.students) if (teacherId && s.advisorId === teacherId) ids.add(s.id);
  return ids;
}
const seAdded = (r) => !!r?.added && (!r.momentId || !!getEvent(r.momentId));
// Per event: how many of the students it was for added something, by homeroom. whole: every student, else teacherId's.
export function schoolEventProgress(id, { teacherId = null, whole = true } = {}) {
  const x = getSchoolEvent(id);
  if (!x) return null;
  const see = whole ? null : staffStudentsOf(teacherId);
  const ids = x.studentIds.filter((sid) => getStudent(sid) && (!see || see.has(sid)));
  const groups = new Map();
  for (const sid of ids) {
    const s = getStudent(sid), r = seRow(id, sid), k = s.homeroom || '—', added = seAdded(r);
    const g = groups.get(k) || groups.set(k, { homeroom: k, total: 0, added: 0, dismissed: 0, students: [] }).get(k);
    g.total++; if (added) g.added++; else if (r?.dismissed) g.dismissed++;
    g.students.push({ id: sid, name: s.name, added, dismissed: !added && !!r?.dismissed, momentId: added ? r.momentId : null });
  }
  const homerooms = [...groups.values()].sort((a, b) => a.homeroom.localeCompare(b.homeroom, 'en', { numeric: true }));
  for (const g of homerooms) g.students.sort((a, b) => a.name.localeCompare(b.name));
  return { event: x, total: ids.length, added: homerooms.reduce((n, g) => n + g.added, 0), homerooms, ended: TODAY > x.end, open: TODAY > x.end && TODAY <= seUntil(x) };
}
// The list a member of staff sees: every event (whole school) or those with any of their students, newest first.
export function schoolEventsForStaff({ teacherId = null, whole = true } = {}) {
  const see = whole ? null : staffStudentsOf(teacherId);
  return seList().filter((x) => !see || x.studentIds.some((sid) => see.has(sid))).sort((a, b) => b.start.localeCompare(a.start) || a.title.localeCompare(b.title));
}
// One reminder per event, after it ends: to each student it was for who has not added something or dismissed it.
export function remindSchoolEvent(id, by = null) {
  const x = getSchoolEvent(id);
  if (!x) throw seErr('No such event', 404);
  if (TODAY <= x.end) throw seErr('You can send a reminder once the event is over');
  if (x.reminded) throw seErr('A reminder was already sent for this event', 409);
  const to = x.studentIds.filter((sid) => getStudent(sid) && !seRow(id, sid));
  for (const sid of to) notify(toStudent(sid), `Add something from “${x.title}” to your journey`, { persona: toStudent(sid), screen: 'map', param: `se~${x.id}` }, 'class');
  x.reminded = { date: TODAY, at: nowIso(), by: by || null, n: to.length };
  emit();
  return to.length;
}

// ── Advisor nudges: a friendly note to an advisee who has gone quiet ──
// store.nudges = [{ id, studentId, from (teacher id), text, date, ts }], made on first use. At most one per student per 7 days.
export const NUDGE_TEXT = "Your advisor would love to see what you've been up to. Add one thing from this week.";
export const QUIET_DAYS = 21, NUDGE_GAP = 7;
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
// The last day the student added something themselves: a moment, a reflection on one of theirs, or the log saying so.
export function lastOwnMoment(studentId) {
  const s = getStudent(studentId); if (!s) return null;
  let last = null; const see = (d) => { if (d && d <= TODAY && (!last || d > last)) last = d; };
  const mine = new Set();
  for (const e of store.events) if (e.studentId === studentId) { mine.add(e.id); if (e.verification === 'student-added' && e.type !== 'goal' && !e.alum) see(e.date); }
  for (const r of store.reflections) if (mine.has(r.eventId)) see(r.date);
  for (const a of store.activity) if (a.studentId === studentId && a.actor === s.name && (a.kind === 'station' || a.kind === 'reflection')) see(a.ts?.slice(0, 10));
  return last;
}
export const nudgesOf = (studentId) => (store.nudges || []).filter((n) => n.studentId === studentId).sort((a, b) => b.date.localeCompare(a.date) || String(b.ts).localeCompare(String(a.ts)));
export const lastNudge = (studentId) => nudgesOf(studentId)[0] || null;
export const nudgeAge = (n) => (n ? dayDiff(n.date, TODAY) : null);
export const canNudge = (studentId) => { const n = lastNudge(studentId); return !n || nudgeAge(n) >= NUDGE_GAP; };
// An advisor's advisees with nothing of their own for 3 weeks (or ever), alphabetically.
export function quietAdvisees(advisorId) {
  const since = daysBefore(QUIET_DAYS);
  return store.students.filter((s) => s.advisorId === advisorId && !s.cohortOnly).map((s) => ({ student: s, last: lastOwnMoment(s.id), nudge: lastNudge(s.id) }))
    .filter((q) => !q.last || q.last < since).sort((a, b) => a.student.name.localeCompare(b.student.name));
}
// about: what the nudge is for ('reflection:<windowId>': the notification opens the term reflection, not the add flow).
export function nudgeStudent(studentId, advisorId, text, about) {
  const s = getStudent(studentId), t = teacherById[advisorId];
  if (!s || !t) throw Object.assign(new Error('No such student or advisor.'), { status: 400 });
  if (!canNudge(studentId)) throw Object.assign(new Error(`${s.name.split(' ')[0]} was nudged in the last ${NUDGE_GAP} days.`), { status: 409 });
  const msg = String(text ?? '').trim().slice(0, 500) || NUDGE_TEXT;
  const n = { id: uid('nu-'), studentId, from: advisorId, text: msg, date: TODAY, ts: nowIso(), ...(about ? { about: String(about).slice(0, 60) } : {}) };
  (store.nudges ||= []).push(n);
  notify(toStudent(studentId), `${shortName(t.name)}: ${msg}`, { persona: toStudent(studentId), screen: 'map', param: about ? 'reflect' : 'add' }, 'teacher');
  log(studentId, t.name, 'nudge', 'Sent a nudge to add something');
  emit();
  return n;
}
// The student's side: the latest nudge from the last 14 days, until they add something after it.
export function openNudge(studentId) {
  const n = lastNudge(studentId), s = getStudent(studentId);
  if (!n || !s || nudgeAge(n) > 14) return null;
  const since = store.activity.some((a) => a.studentId === studentId && a.actor === s.name && (a.kind === 'station' || a.kind === 'reflection') && a.ts >= n.ts);
  return since ? null : { ...n, fromName: teacherById[n.from]?.name || '' };
}

// ── Moment comments: a conversation on one station between the student and the staff who can see it ──
// store.momentComments [{ id, eventId, studentId, by, text, at, edited? }] (by: 'student' or a teacher id) and
// store.commentReads [{ studentId, eventId, by, at }] (when each person last read a thread), both made on first use.
// Who writes (server/auth.mjs checks the role): the student; their advisor, a teacher asked about it or its sponsor
// (commentsAsked); whole-school staff and admins. Never on a private station. Families never see them (server/scope.mjs).
// The author edits within COMMENT_EDIT_MIN minutes of writing, and deletes any time.
export const COMMENT_EDIT_MIN = 15;
const cmErr = (message, status = 400) => Object.assign(new Error(message), { status });
export const getMomentComments = (eventId) => (store.momentComments || []).filter((c) => c.eventId === eventId);
export const getMomentComment = (id) => (store.momentComments || []).find((c) => c.id === id);
export function commentsAsked(eventId, tid) {
  const e = getEvent(eventId);
  return !!e && !!tid && (getStudent(e.studentId)?.advisorId === tid || e.sponsor?.teacherId === tid || store.requests.some((r) => r.eventId === eventId && r.teacherId === tid));
}
// The staff a thread involves: the advisor, teachers asked about it, its sponsor, and staff who wrote in it.
export function commentStaff(eventId) {
  const e = getEvent(eventId); if (!e) return [];
  const ids = [getStudent(e.studentId)?.advisorId, ...store.requests.filter((r) => r.eventId === eventId).map((r) => r.teacherId), e.sponsor?.teacherId, ...getMomentComments(eventId).map((c) => c.by)];
  return [...new Set(ids.filter((id) => id && id !== 'student' && teacherById[id]))];
}
// Comments by others since this person ('student' or a teacher id) last read the thread or wrote in it.
export function unreadComments(eventId, me) {
  if (!me) return 0;
  const list = getMomentComments(eventId);
  const seen = [(store.commentReads || []).find((r) => r.eventId === eventId && r.by === me)?.at || '', ...list.filter((c) => c.by === me).map((c) => c.at)].sort().at(-1);
  return list.filter((c) => c.by !== me && c.at > seen).length;
}
// What a viewer calls the writer: students say "Mr Coultas", staff read full names.
export function commentWho(c, me) {
  if (c.by === me) return 'You';
  if (c.by === 'student') return getStudent(c.studentId)?.name || 'The student';
  const n = teacherById[c.by]?.name || 'A teacher';
  return me === 'student' ? shortName(n) : n;
}
const readMark = (e, by, at) => {
  const list = (store.commentReads ||= []);
  const r = list.find((x) => x.eventId === e.id && x.by === by);
  if (r) r.at = at; else list.push({ studentId: e.studentId, eventId: e.id, by, at });
};
// Where a notification takes staff: an advisor to the student's map with the station open, anyone else to the queue's thread.
const commentGo = (tid, e) => (getStudent(e.studentId)?.advisorId === tid
  ? { persona: toTeacher(tid), screen: 'student', param: `${e.studentId}~${e.id}` }
  : { persona: toTeacher(tid), screen: 'queue', param: `c~${e.id}` });
export function addMomentComment(eventId, by, text) {
  const e = getEvent(eventId); if (!e) throw cmErr('No such moment.', 404);
  const t = String(text ?? '').trim().slice(0, 2000); if (!t) throw cmErr('Write something first.');
  if (e.visibility === 'private') throw cmErr('This moment is just for the student. Share it with the advisor first.');
  if (by !== 'student' && !teacherById[by]) throw cmErr('No such teacher.');
  const c = { id: uid('cm-'), eventId, studentId: e.studentId, by, text: t, at: nowIso() };
  (store.momentComments ||= []).push(c);
  readMark(e, by, c.at);
  const s = getStudent(e.studentId), who = by === 'student' ? s.name : teacherById[by].name;
  const quote = t.length > 60 ? `${t.slice(0, 57)}…` : t;
  if (by === 'student') for (const tid of commentStaff(eventId)) notify(toTeacher(tid), `${s.name.split(' ')[0]} wrote on “${e.title}”: ${quote}`, commentGo(tid, e));
  else notify(toStudent(e.studentId), `${shortName(who)} wrote on “${e.title}”: ${quote}`, { persona: toStudent(e.studentId), screen: 'map', param: e.id });
  log(e.studentId, who, 'comment', `Commented on “${e.title}”`);
  emit();
  return c;
}
const ownComment = (id, by) => {
  const c = getMomentComment(id); if (!c) throw cmErr('That comment is gone.', 404);
  if (c.by !== by) throw cmErr('Only the person who wrote a comment can change it.', 403);
  return c;
};
export function editMomentComment(id, by, text) {
  const c = ownComment(id, by);
  const t = String(text ?? '').trim().slice(0, 2000); if (!t) throw cmErr('Write something first.');
  const now = nowIso();
  if (Date.parse(now) - Date.parse(c.at) > COMMENT_EDIT_MIN * 60000) throw cmErr(`A comment can be changed for ${COMMENT_EDIT_MIN} minutes after writing it.`, 409);
  c.text = t; c.edited = now;
  emit();
  return c;
}
export function deleteMomentComment(id, by) {
  const c = ownComment(id, by);
  store.momentComments = store.momentComments.filter((x) => x.id !== id);
  emit();
}
export function markCommentsRead(eventId, by) {
  const e = getEvent(eventId); if (!e) return;
  readMark(e, by, nowIso());
  emit();
}

// ── Safeguarding: reporting a moment or a comment, and the moderators' queue ──
// store.reports [{ id, kind: 'station' | 'comment', eventId, commentId?, studentId (the owner), reason, note, at,
// from: { key, name, role }, status, history: [{ action, note, at, by }] }], made on first use. Who reported (from)
// reaches only moderators (server/scope.mjs); everyone else gets only the reports they made, without the history. The
// PDPA copy keeps reasons and outcomes, never who reported. Reporter keys: 'student' (the owner), a teacher id,
// 'fam:<studentId>' (a family member) or 'admin'. server/auth.mjs checks the key is the signed-in person's.
export const REPORT_REASONS = { inappropriate: 'Inappropriate content', personal: 'Personal information shown', unkind: 'Unkind or bullying', other: 'Something else' };
export const MODERATOR_KINDS = ['coordinator', 'counsellor', 'leadership'];
export const isModerator = (p) => !!p && (p.kind === 'admin' || !!p.admin || MODERATOR_KINDS.includes(p.kind));
export const REPORT_LIMIT = 20; // reports per person per hour
const REPORT_STATUS = { hide: 'hidden', unhide: 'shown', photo: 'photo-removed', none: 'no-action' };
export const getReports = () => [...(store.reports || [])].sort((a, b) => b.at.localeCompare(a.at));
export const getReport = (id) => (store.reports || []).find((r) => r.id === id);
const sameTarget = (a, b) => a.kind === b.kind && a.eventId === b.eventId && (a.commentId || null) === (b.commentId || null);
// The photos a moment carries (what "Remove photo" takes away).
export const isPhoto = (ev) => ev?.kind === 'image' || /^image\//.test(ev?.type || '');
// Who sees a hidden comment: staff, and the student when they wrote it.
export const commentShown = (c, staff) => !c.hidden || staff || c.by === 'student';
function reporter(from, e) {
  const key = String(from?.key ?? '');
  const name = String(from?.name ?? '').trim().slice(0, 80);
  if (key === 'student') return { key, name: getStudent(e.studentId)?.name || 'The student', role: 'Student' };
  if (key === `fam:${e.studentId}`) return { key, name: name || 'A family member', role: 'Family' };
  if (key === 'admin') return { key, name: name || 'Pilot admin', role: 'Pilot admin' };
  if (teacherById[key]) return { key, name: teacherById[key].name, role: teacherById[key].role || 'Staff' };
  throw cmErr('Who is reporting this?');
}
export function reportItem(target, reason, note, from) {
  const c = target?.commentId ? getMomentComment(target.commentId) : null;
  if (target?.commentId && !c) throw cmErr('That comment is gone.', 404);
  const e = getEvent(c ? c.eventId : target?.eventId); if (!e) throw cmErr('No such moment.', 404);
  if (e.visibility === 'private') throw cmErr('Only the student can see this moment.');
  if (!REPORT_REASONS[reason]) throw cmErr('Pick a reason.');
  const who = reporter(from, e);
  if (c && who.role === 'Family') throw cmErr('Families do not see comments.');
  const at = nowIso(), list = (store.reports ||= []);
  const t = { kind: c ? 'comment' : 'station', eventId: e.id, ...(c ? { commentId: c.id } : {}) };
  const open = list.find((r) => r.from.key === who.key && r.status === 'open' && sameTarget(r, t));
  if (open) return open;
  if (list.filter((r) => r.from.key === who.key && Date.parse(at) - Date.parse(r.at) < 3600e3).length >= REPORT_LIMIT) throw cmErr('You have sent a lot of reports. Try again later, or speak to a teacher.', 429);
  const r = { id: uid('rp-'), ...t, studentId: e.studentId, reason, note: String(note ?? '').trim().slice(0, 1000), at, from: who, status: 'open', history: [] };
  list.push(r);
  const s = getStudent(e.studentId);
  for (const k of MODERATOR_KINDS) notify(toRole(k), `New report: ${c ? 'a comment on ' : ''}“${e.title}” (${s.name}). ${REPORT_REASONS[reason]}.`, { persona: toRole(k), screen: 'reports', param: r.id });
  emit();
  return r;
}
// A moderator's answer: 'hide' (only the student and staff see it), 'unhide', 'photo' (the station's photos are taken
// off; nothing keeps their address), 'none'. Every report on the same item gets the answer in its history.
export function moderateReport(id, action, note, by) {
  const r = getReport(id); if (!r) throw cmErr('No such report.', 404);
  if (!REPORT_STATUS[action]) throw cmErr('Pick what to do.');
  if (by && !teacherById[by]) throw cmErr('No such teacher.');
  const name = by ? teacherById[by].name : 'Pilot admin';
  const e = getEvent(r.eventId), c = r.commentId ? getMomentComment(r.commentId) : null;
  const target = r.commentId ? c : e;
  if (action !== 'none' && !target) throw cmErr(r.commentId ? 'That comment is gone.' : 'That moment is gone.', 404);
  const at = nowIso(), to = toStudent(r.studentId), go = e ? { persona: to, screen: 'map', param: e.id } : undefined;
  const what = c ? `a comment on “${e.title}”` : `“${e?.title}”`;
  if (action === 'photo' && (c || !e.evidence.some(isPhoto))) throw cmErr(c ? 'A comment has no photo.' : 'This moment has no photo.');
  if (action === 'hide') { target.hidden = { at, by: name }; notify(to, `A teacher has hidden ${what} while they look at it.`, go); }
  if (action === 'unhide') { delete target.hidden; notify(to, `A teacher has finished looking at ${what}. It is shown again.`, go); }
  if (action === 'photo') { e.evidence = e.evidence.filter((x) => !isPhoto(x)); notify(to, `A teacher has removed the photo from “${e.title}”.`, go); }
  const entry = { action, note: String(note ?? '').trim().slice(0, 1000), at, by: name };
  for (const x of store.reports) if (sameTarget(x, r)) { x.history.push({ ...entry }); x.status = REPORT_STATUS[action]; }
  emit();
  return r;
}

// ── Spotted moments: a teacher saw a student do something worth keeping (src/components/Spotted.jsx) ──
// store.spotted: { id: 'sp-…', studentId, teacherId, classId, lineId, title, note, image, date, at, expires, status:
// 'open' | 'accepted' | 'declined', decidedAt, eventId }. A suggestion until the student accepts it; then a station on
// that line, marked spotted by the teacher and endorsed by them. Open ones expire SPOT_DAYS after they were made.
export const SPOT_DAYS = 30;
const spots = () => (store.spotted ||= []);
export const getSpotted = (id) => spots().find((x) => x.id === id);
const spotOpen = (x) => x.status === 'open' && x.expires >= TODAY;
// What the teacher sees: waiting, added, or "not added" (declined and expired look the same).
export const spotStatus = (x) => (x.status === 'accepted' ? 'added' : spotOpen(x) ? 'waiting' : 'not added');
const spotView = (x) => ({ ...x, teacher: teacherById[x.teacherId] || null, line: lineById(x.lineId) || null, className: (x.classId && classById(x.classId)?.name) || '' });
// A student's open suggestions, oldest first.
export const spottedFor = (studentId) => spots().filter((x) => x.studentId === studentId && spotOpen(x)).sort((a, b) => a.at.localeCompare(b.at)).map(spotView);
// The suggestions a teacher made, newest first; optionally only for one class or one student.
export const spottedBy = (teacherId, { classId, studentId } = {}) => spots().filter((x) => x.teacherId === teacherId && (!classId || x.classId === classId) && (!studentId || x.studentId === studentId))
  .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).map((x) => ({ ...spotView(x), student: getStudent(x.studentId) || null, shown: spotStatus(x) }));
// The line a spotted moment starts on: the class's line, else the teacher's subject line, else the first school line.
export const spotLineFor = (teacherId, classId) => (classId && classById(classId)?.lineId) || subjectLineOf(teacherId) || getSchoolLines()[0]?.id || null;
const spotErr = (m, status = 400) => Object.assign(new Error(m), { status });
export function spotMoment(studentIds, teacherId, { title, note = '', image = null, lineId, classId = null } = {}) {
  const t = teacherById[teacherId];
  if (!t) throw spotErr('No such teacher');
  const ids = [...new Set([].concat(studentIds || []))];
  if (!ids.length || ids.some((sid) => !getStudent(sid))) throw spotErr('Pick the students first');
  const name = String(title || '').trim().slice(0, 120);
  if (name.length < 3) throw spotErr('Give it a title');
  if (!getSchoolLines().some((l) => l.id === lineId)) throw spotErr('Pick a line');
  if (classId && !classById(classId)) throw spotErr('No such class', 404);
  const date = TODAY, at = nowIso(), expires = new Date(Date.parse(TODAY) + SPOT_DAYS * 864e5).toISOString().slice(0, 10);
  const out = ids.map((sid) => {
    const x = { id: uid('sp-'), studentId: sid, teacherId, classId: classId || null, lineId, title: name, note: String(note || '').trim().slice(0, 500),
      image: typeof image === 'string' && image ? image : null, date, at, expires, status: 'open' };
    spots().push(x);
    notify(toStudent(sid), `${shortName(t.name)} spotted something you did: “${name}”`, { persona: toStudent(sid), screen: 'map' });
    return x;
  });
  emit();
  return out;
}
const mySpot = (id, studentId) => {
  const x = getSpotted(id);
  if (!x || x.studentId !== studentId) throw spotErr('This is not for you', 404);
  if (x.status !== 'open') throw spotErr('You already answered this', 409);
  if (!spotOpen(x)) throw spotErr('This has expired', 410);
  return x;
};
// "Add to my journey": a station on the line, spotted by and endorsed by the teacher. The line joins the map if missing.
export function acceptSpotted(id, studentId) {
  const x = mySpot(id, studentId), s = getStudent(studentId), t = teacherById[x.teacherId];
  const e = addStation(studentId, { title: x.title, summary: x.note, lineIds: [laneFor(s, x.lineId)], type: 'project', image: x.image, imageCaption: 'Photo', visibility: 'school', via: 'Spotted by a teacher' });
  e.spotted = { id: x.id, teacherId: x.teacherId };
  if (t) {
    store.endorsements.push({ id: uid('en-x'), eventId: e.id, teacherId: x.teacherId, note: x.note || `Spotted by ${t.name}.`, date: TODAY, live: true });
    e.verification = 'teacher-endorsed';
    notify(toTeacher(x.teacherId), `${s.name.split(' ')[0]} added “${x.title}” to their journey`, { persona: toTeacher(x.teacherId), ...(x.classId ? { screen: 'classes', param: x.classId } : { screen: 'student', param: studentId }) });
  }
  Object.assign(x, { status: 'accepted', decidedAt: nowIso(), eventId: e.id });
  emit();
  return e;
}
// "Not for me": hidden from the student; the teacher only sees "not added".
export function declineSpotted(id, studentId) {
  const x = mySpot(id, studentId);
  Object.assign(x, { status: 'declined', decidedAt: nowIso() });
  emit();
  return x;
}
// ── Year handover: a new year's class lists move students to new advisors (docs/pilot-server.md) ──
// importRoster notes each change of advisor in store.handovers ({ id, studentId, from, to, date, at, fromYear, year,
// newYear }) and, when the academic year changes, store.yearStart ({ year, fromYear, date, at }). The outgoing
// advisor writes a handover note per student (store.handoverNotes: { id, studentId, by, text, at, year }), staff-only.
function noteHandovers(was, wasYear, roster) {
  const year = roster.school?.academicYear || null, newYear = !!(wasYear && year && wasYear !== year);
  store.handovers ||= [];
  const at = nowIso();
  for (const s of roster.students) {
    const from = was.get(s.id);
    if (!from || from === s.advisorId) continue;
    store.handovers.push({ id: uid('ho-'), studentId: s.id, from, to: s.advisorId, date: TODAY, at, fromYear: wasYear || null, year, newYear });
  }
  if (newYear) store.yearStart = { year, fromYear: wasYear, date: TODAY, at };
}
export const HANDOVER_PROMPT = ['Strengths: what they are good at and proud of', 'What helps: how they work best, what to say or do', 'What to watch: anything to keep an eye on'];
export const getHandovers = () => store.handovers || [];
export const latestHandover = (sid) => getHandovers().filter((h) => h.studentId === sid).at(-1) || null;
export const previousAdvisorOf = (sid) => latestHandover(sid)?.from || null;
export const getYearStart = () => store.yearStart || null;
export const getHandoverNote = (sid, by) => (store.handoverNotes || []).find((n) => n.studentId === sid && n.by === by) || null;
export const getHandoverNotes = (sid) => (store.handoverNotes || []).filter((n) => n.studentId === sid);
// Only the student's current or immediately previous advisor writes it (server/auth.mjs). An empty text removes it.
export function setHandoverNote(studentId, text, by) {
  if (!teacherById[by]) throw cmErr('No such teacher.');
  const t = String(text ?? '').trim().slice(0, 3000);
  store.handoverNotes ||= [];
  const old = getHandoverNote(studentId, by);
  if (!t) store.handoverNotes = store.handoverNotes.filter((n) => n !== old);
  else if (old) Object.assign(old, { text: t, at: nowIso() });
  else store.handoverNotes.push({ id: uid('hn-'), studentId, by, text: t, at: nowIso(), year: getStudent(studentId)?.advisorId === by ? store.rosterImport?.school?.academicYear || null : latestHandover(studentId)?.fromYear || null });
  emit();
  return getHandoverNote(studentId, by);
}
// "New to you": the advisor's students whose latest handover was to them.
export const newToAdvisor = (advisorId) => store.students.filter((s) => s.advisorId === advisorId && latestHandover(s.id)?.to === advisorId);
const yearFrom = (ay) => { const m = String(ay || '').match(/(\d{4})/); return m ? `${m[1]}-08-01` : null; };
// The "Last year" panel: the previous advisor, their note, last year's moments by line (as an advisor sees them),
// and the goals the student carried over.
export function lastYearOf(studentId) {
  const h = latestHandover(studentId);
  if (!h) return null;
  const map = getStudentMap(studentId, 'advisor');
  const since = yearFrom(h.fromYear) || '0000';
  const evs = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection' && e.date >= since && e.date < h.date);
  const byLine = map.lines.map((l) => ({ line: l, n: evs.filter((e) => e.lineIds.includes(l.id)).length })).filter((x) => x.n);
  return { handover: h, from: teacherById[h.from] || null, note: getHandoverNote(studentId, h.from), moments: evs.length, byLine, carried: map.events.filter((e) => e.type === 'goal' && e.carriedOver) };
}
// At the start of a new year: last year's goals whose date has passed, for the student to carry over or close.
export function goalsToReview(studentId) {
  const ys = getYearStart(); if (!ys) return [];
  return store.events.filter((e) => e.studentId === studentId && e.type === 'goal' && !e.requirement && !e.closedOn && !(e.carriedOver?.on >= ys.date) && e.date < ys.date && e.date < TODAY).sort((a, b) => a.date.localeCompare(b.date));
}
export const carryDate = (date) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + 1); const s = d.toISOString().slice(0, 10); return s > TODAY ? s : daysAfter(TODAY, 30); };
const daysAfter = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
export function carryOverGoal(id, date) {
  const e = getEvent(id); if (!e || e.type !== 'goal') throw cmErr('No such goal.', 404);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && date >= TODAY ? date : carryDate(e.date);
  e.carriedOver = { from: e.date, on: TODAY }; e.date = to;
  log(e.studentId, getStudent(e.studentId)?.name, 'goal', `Carried “${e.title}” over to this year (${to})`);
  emit();
  return e;
}
export function closeGoal(id) {
  const e = getEvent(id); if (!e || e.type !== 'goal') throw cmErr('No such goal.', 404);
  e.closedOn = TODAY;
  log(e.studentId, getStudent(e.studentId)?.name, 'goal', `Closed the goal “${e.title}”`);
  emit();
  return e;
}
// Accounts › Start of year: what a roster file would change, before importing it.
export function handoverPreview(parsed) {
  const roster = checked(parsed);
  const wasYear = store.rosterImport?.school?.academicYear || null, year = roster.school?.academicYear || null;
  const groups = new Map(); let changes = 0, notes = 0;
  for (const s of roster.students) {
    const cur = getStudent(s.id);
    if (!cur?.advisorId || cur.advisorId === s.advisorId) continue;
    changes++; if (getHandoverNote(s.id, cur.advisorId)) notes++;
    const k = `${cur.advisorId}|${s.advisorId}`;
    groups.set(k, { from: teacherById[cur.advisorId]?.name || cur.advisorId, to: roster.teachers.find((t) => t.id === s.advisorId)?.name || s.advisorId, n: (groups.get(k)?.n || 0) + 1 });
  }
  return { fromYear: wasYear, year, newYear: !!(wasYear && year && wasYear !== year), changes, notes, groups: [...groups.values()].sort((a, b) => b.n - a.n) };
}

// ── Term reflection: a guided look back at the end of a term (src/components/TermReflection.jsx) ──
// An advisor (their advisees) or whole-school staff (a whole Year) open a window; each student in it picks up to
// TR_PICKS moments of the term, answers three short questions on each and sets one goal. Kept as a draft until they
// finish; then it is a reflection station (reflectsOn: the moments) with one reflection per moment, plus the goal.
// store.reflectionWindows: { id: 'rw-…', title, opens, closes, from, studentIds, advisorId, year, by, at, closedOn? }
// store.termReflections: { id: 'tr-…', windowId, studentId, status: 'draft' | 'done', step, picks, answers: { [eventId |
// '_']: { did, learned, next } }, goal: { goalId } | { title, lineId, date } | null, visibility, startedAt, savedAt,
// doneAt, eventId, goalId }. Both made on first use.
export const TR_PICKS = 3;
const trErr = (m, status = 400) => Object.assign(new Error(m), { status });
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const trClip = (v, n) => String(v ?? '').slice(0, n);
export const getReflectionWindows = () => store.reflectionWindows || [];
export const getReflectionWindow = (id) => getReflectionWindows().find((w) => w.id === id) || null;
export const windowOpen = (w) => !!w && !w.closedOn && w.opens <= TODAY && TODAY <= w.closes;
const windowLive = (w) => !w.closedOn && w.closes >= TODAY; // open now or opening later
export const termRecord = (windowId, studentId) => (store.termReflections || []).find((r) => r.windowId === windowId && r.studentId === studentId) || null;
// Terms start in August, January and April (NIST's calendar, near enough to choose "this term's" moments).
export const termStartOf = (d) => { const y = d.slice(0, 4), m = +d.slice(5, 7); return m >= 8 ? `${y}-08-01` : m >= 4 ? `${y}-04-01` : `${y}-01-01`; };
export const termName = (d = TODAY) => { const m = +d.slice(5, 7); return `Term ${m >= 8 ? 1 : m >= 4 ? 3 : 2} reflection`; };
// The end of next term: a goal's date ("By the end of next term").
export const nextTermEnd = (d = TODAY) => { const y = +d.slice(0, 4) - (+d.slice(5, 7) < 8 ? 1 : 0); return [`${y}-12-11`, `${y + 1}-03-26`, `${y + 1}-06-11`, `${y + 1}-12-11`].filter((x) => x > d)[1]; };
// Students a spec covers: an advisor's advisees, or everyone in a British Year.
const trStudents = ({ advisorId, year }) => store.students.filter((s) => !s.cohortOnly && (advisorId ? s.advisorId === advisorId : s.grade + 1 === Number(year)));
export function openReflectionWindow({ title, opens = TODAY, closes, advisorId = null, year = null } = {}, by = null) {
  if (by && !teacherById[by]) throw trErr('No such teacher');
  if (!advisorId === !year) throw trErr('Pick an advisory or a Year');
  if (advisorId && !teacherById[advisorId]) throw trErr('No such advisor');
  const name = String(title || '').trim().slice(0, 80) || termName(opens);
  if (!isDay(opens) || !isDay(closes) || closes < opens || closes < TODAY) throw trErr('Pick when it opens and closes');
  const busy = new Set(getReflectionWindows().filter(windowLive).flatMap((w) => w.studentIds));
  const all = trStudents({ advisorId, year }), ids = all.map((s) => s.id).filter((id) => !busy.has(id));
  if (!ids.length) throw trErr(all.length ? 'These students already have a reflection open' : 'No students to ask', all.length ? 409 : 400);
  const w = { id: uid('rw-'), title: name, opens, closes, from: termStartOf(opens), studentIds: ids, advisorId: advisorId || null, year: year ? Number(year) : null, by: by || null, at: nowIso() };
  (store.reflectionWindows ||= []).push(w);
  if (opens <= TODAY) for (const sid of ids) notify(toStudent(sid), `${name} is open: look back on your term and pick what you are proud of`, { persona: toStudent(sid), screen: 'map', param: 'reflect' });
  emit();
  return w;
}
export function closeReflectionWindow(id) {
  const w = getReflectionWindow(id);
  if (!w) throw trErr('No such reflection', 404);
  w.closedOn = TODAY;
  emit();
  return w;
}
// A student's open window that they have not finished yet (the earliest to close), with their draft.
export function myReflection(studentId) {
  const w = getReflectionWindows().filter((x) => windowOpen(x) && x.studentIds.includes(studentId) && termRecord(x.id, studentId)?.status !== 'done').sort((a, b) => a.closes.localeCompare(b.closes))[0];
  return w ? { window: w, record: termRecord(w.id, studentId) } : null;
}
// The moments to look back on: this term's (newest first); with fewer than six, the latest earlier ones too (earlier: true).
export function termMoments(studentId, w) {
  const evs = getStudentMap(studentId, 'student').events.filter((e) => e.type !== 'goal' && e.type !== 'reflection' && e.date <= TODAY).sort((a, b) => b.date.localeCompare(a.date));
  const now = evs.filter((e) => e.date >= (w?.from || TERM_START));
  return [...now, ...evs.filter((e) => !now.includes(e)).slice(0, Math.max(0, 6 - now.length)).map((e) => ({ ...e, earlier: true }))];
}
function trClean(studentId, d = {}) {
  const mine = new Set(store.events.filter((e) => e.studentId === studentId && e.type !== 'goal' && e.type !== 'reflection').map((e) => e.id));
  const picks = [...new Set([].concat(d.picks || []))].filter((id) => mine.has(id)).slice(0, TR_PICKS);
  const answers = {};
  for (const k of [...picks, '_']) { const a = d.answers?.[k]; if (a && typeof a === 'object') answers[k] = { did: trClip(a.did, 1000), learned: trClip(a.learned, 1000), next: trClip(a.next, 1000) }; }
  const g = d.goal;
  const own = g?.goalId && store.events.find((e) => e.id === g.goalId && e.studentId === studentId && e.type === 'goal');
  const goal = own ? { goalId: own.id } : g && typeof g === 'object' && (g.title || g.lineId || g.date) ? { title: trClip(g.title, 120), lineId: typeof g.lineId === 'string' ? g.lineId : null, date: isDay(g.date) ? g.date : null } : null;
  return { picks, answers, goal, visibility: ['private', 'advisor', 'school'].includes(d.visibility) ? d.visibility : 'advisor', step: Number.isInteger(d.step) ? Math.max(0, Math.min(20, d.step)) : 0 };
}
function trOpenFor(windowId, studentId) {
  const w = getReflectionWindow(windowId), s = getStudent(studentId);
  if (!w || !s || !w.studentIds.includes(studentId)) throw trErr('This reflection is not for you', 404);
  if (!windowOpen(w)) throw trErr('This reflection is closed', 410);
  const r = termRecord(windowId, studentId);
  if (r?.status === 'done') throw trErr('You already finished this', 409);
  return { w, s, r };
}
// Keeps the student's progress so they can come back to it.
export function saveTermReflection(windowId, studentId, draft) {
  let { r } = trOpenFor(windowId, studentId);
  const at = nowIso();
  if (!r) (store.termReflections ||= []).push(r = { id: uid('tr-'), windowId, studentId, status: 'draft', startedAt: at });
  Object.assign(r, trClean(studentId, draft), { savedAt: at });
  emit();
  return r;
}
// "What I did. What I learned. What next." as one paragraph.
const trText = (a) => ['did', 'learned', 'next'].map((k) => String(a?.[k] || '').trim()).filter(Boolean).map((t) => (/[.!?…]$/.test(t) ? t : `${t}.`)).join(' ');
export function finishTermReflection(windowId, studentId, draft) {
  const { w, s } = trOpenFor(windowId, studentId);
  const f = trClean(studentId, draft);
  const keys = f.picks.length ? f.picks : ['_'];
  const texts = keys.map((k) => [k, trText(f.answers[k])]).filter(([, t]) => t);
  if (!texts.length) throw trErr('Write a little about what you did first');
  const g = f.goal;
  if (g && !g.goalId && (!g.title || g.title.trim().length < 3 || !g.date || g.date <= TODAY || !lineById(g.lineId))) throw trErr('Finish your goal, or skip it');
  const lanes = [...new Set(f.picks.map((id) => getEvent(id).lineIds.find((l) => s.laneOrder.includes(l))).filter(Boolean))];
  const e = addStation(studentId, { title: w.title, type: 'reflection', lineIds: lanes.length ? lanes : s.laneOrder.slice(0, 1), summary: trClip(texts[0][1], 200), visibility: f.visibility, via: 'Term reflection' });
  Object.assign(e, { reflectsOn: f.picks, termReflection: w.id });
  for (const [k, text] of texts) store.reflections.push({ id: uid('rf-x'), eventId: e.id, about: k === '_' ? null : k, prompt: k === '_' ? 'Looking back at this term' : `Looking back at “${getEvent(k).title}”`, text, parts: f.answers[k], date: TODAY, visibility: f.visibility });
  let goalId = g?.goalId || null;
  if (g && !goalId) goalId = addGoal(studentId, { title: g.title.trim(), date: g.date, lineId: laneFor(s, g.lineId), summary: `My goal for next term, from my ${w.title}.`, checkIn: true }).id;
  const r = saveTermReflection(windowId, studentId, f);
  Object.assign(r, { status: 'done', doneAt: nowIso(), eventId: e.id, goalId });
  log(studentId, s.name, 'reflection', `Finished “${w.title}”`);
  emit();
  return r;
}
// Who has finished: the students of one window (or only an advisor's advisees in it), alphabetically.
export function reflectionProgress(windowId, advisorId) {
  const w = getReflectionWindow(windowId); if (!w) return null;
  const rows = w.studentIds.map(getStudent).filter((s) => s && (!advisorId || s.advisorId === advisorId)).sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => { const r = termRecord(w.id, s.id); return { student: s, status: r?.status === 'done' ? 'done' : r ? 'started' : 'not started', doneAt: r?.doneAt || null }; });
  return { window: w, rows, total: rows.length, done: rows.filter((x) => x.status === 'done').length, started: rows.filter((x) => x.status === 'started').length };
}
// The advisory page: the latest window over this advisor's advisees, open now or closed in the last 30 days.
export function advisoryReflection(advisorId) {
  const mine = new Set(store.students.filter((s) => s.advisorId === advisorId).map((s) => s.id));
  const w = getReflectionWindows().filter((x) => x.studentIds.some((id) => mine.has(id)) && (x.closedOn || x.closes) >= daysBefore(30)).sort((a, b) => b.opens.localeCompare(a.opens) || b.at.localeCompare(a.at))[0];
  return w ? reflectionProgress(w.id, advisorId) : null;
}

// ── Kind feedback from classmates (pilot, Year 9 and up; src/components/PeerFeedback.jsx) ──
// A student opts a school-visible moment in (e.peerFeedback); classmates in a current class give feedback from set
// phrases. store.peerFeedback [{ id: 'pf-…', eventId, studentId (the owner), fromId, fromName, classId, parts:
// [{ phrase, text }], at, thanked?, hidden? }] and store.peerSettings { offYears: [British Years] }, made on first use.
// A pilot browser holds store.peerMoments (server/scope.mjs): the classmates' opted-in moments it may see.
export const PEER_PHRASES = { liked: 'I liked how…', think: 'This made me think about…', question: 'A question I have…', try: 'You could try…' };
export const PEER_MIN_GRADE = 8; // Year 9
export const PEER_NOTE_MAX = 200;
export const PEER_DAY_LIMIT = 10;
const PEER_VIS = ['school', 'publishable'];
const pfErr = (message, status = 400) => Object.assign(new Error(message), { status });
const bkkDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
export const peerYearOff = (year) => (store.peerSettings?.offYears || []).includes(Number(year));
export const peerEligible = (sid) => { const s = getStudent(sid); return !!s && s.grade >= PEER_MIN_GRADE && !peerYearOff(s.grade + 1); };
export const peerQualifies = (e) => !!e && e.type !== 'goal' && PEER_VIS.includes(e.visibility) && !e.hidden;
export const peerOpen = (e) => !!e?.peerFeedback && peerQualifies(e) && peerEligible(e.studentId);
const peerClasses = (sid) => new Set(getEnrolments().filter((n) => n.studentId === sid && !(n.to && n.to < TODAY)).map((n) => n.classId));
export function sharedClasses(a, b) { const mine = peerClasses(a); return a === b ? [] : [...peerClasses(b)].filter((c) => mine.has(c)).sort(); }
export const getPeerFeedback = (id) => (store.peerFeedback || []).find((f) => f.id === id);
export const peerFeedbackOn = (eventId) => (store.peerFeedback || []).filter((f) => f.eventId === eventId).sort((a, b) => a.at.localeCompare(b.at));
export const peerGivenBy = (sid) => (store.peerFeedback || []).filter((f) => f.fromId === sid);
export const peerText = (p) => `${PEER_PHRASES[p.phrase].replace(/…$/, '')} ${p.text}`;
export const peerGivenToday = (sid) => peerGivenBy(sid).filter((f) => bkkDay(f.at) === bkkDay(new Date().toISOString())).length;
// Classmates' opted-in moments a student may see: title, first photo, first name, the class they share.
export function peerMomentsFor(sid) {
  if (!peerEligible(sid)) return [];
  if (store.peerMoments) return store.peerMoments;
  const mine = peerClasses(sid); if (!mine.size) return [];
  const mates = new Map();
  for (const n of getEnrolments()) if (mine.has(n.classId) && n.studentId !== sid && !(n.to && n.to < TODAY) && !mates.has(n.studentId)) mates.set(n.studentId, n.classId);
  return store.events.filter((e) => mates.has(e.studentId) && peerOpen(e)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 40).map((e) => {
    const c = getClasses().find((x) => x.id === mates.get(e.studentId));
    return { eventId: e.id, studentId: e.studentId, name: getStudent(e.studentId).name.split(' ')[0], title: e.title, image: e.evidence?.find(isPhoto)?.url || null, classId: c?.id || null, className: c?.name || '', date: e.date };
  });
}
export function setPeerFeedback(eventId, on) {
  const e = getEvent(eventId); if (!e) throw pfErr('No such moment.', 404);
  if (on) {
    if (!peerEligible(e.studentId)) throw pfErr('Kind feedback is not on for your Year.', 409);
    if (!peerQualifies(e)) throw pfErr('Only moments the school can see can have feedback from classmates.');
    e.peerFeedback = true;
  } else delete e.peerFeedback;
  emit();
}
export function givePeerFeedback(eventId, fromId, parts) {
  const from = getStudent(fromId); if (!from) throw pfErr('No such student.', 404);
  if (!peerEligible(fromId)) throw pfErr('Kind feedback is not on for your Year.', 409);
  const e = getEvent(eventId);
  if (e?.studentId === fromId) throw pfErr('This is your own moment.');
  const m = e ? (peerOpen(e) ? { studentId: e.studentId, title: e.title, classId: sharedClasses(e.studentId, fromId)[0] } : null) : (store.peerMoments || []).find((x) => x.eventId === eventId);
  if (!m) throw pfErr('This moment is not open for feedback.', 409);
  if (!m.classId) throw pfErr('You can give feedback only to classmates in your classes.', 403);
  const list = [].concat(parts || []).map((p) => ({ phrase: p?.phrase, text: String(p?.text ?? '').replace(/\s+/g, ' ').trim() }));
  if (!list.length || list.length > 2 || new Set(list.map((p) => p.phrase)).size !== list.length || list.some((p) => !PEER_PHRASES[p.phrase] || !p.text)) throw pfErr('Pick one or two phrases and finish each one.');
  if (list.reduce((n, p) => n + p.text.length, 0) > PEER_NOTE_MAX) throw pfErr(`Keep it to ${PEER_NOTE_MAX} characters.`);
  const at = nowIso();
  if (peerGivenBy(fromId).filter((f) => bkkDay(f.at) === bkkDay(at)).length >= PEER_DAY_LIMIT) throw pfErr(`You have given ${PEER_DAY_LIMIT} pieces of feedback today. Try again tomorrow.`, 429);
  const f = { id: uid('pf-'), eventId, studentId: m.studentId, fromId, fromName: from.name.split(' ')[0], classId: m.classId, parts: list, at };
  (store.peerFeedback ||= []).push(f);
  notify(toStudent(m.studentId), `${f.fromName} gave you kind feedback on “${m.title}”.`, { persona: toStudent(m.studentId), screen: 'map', param: eventId });
  emit();
  return f;
}
const ownPeer = (id) => { const f = getPeerFeedback(id); if (!f) throw pfErr('That feedback is gone.', 404); return f; };
export function thankPeerFeedback(id) {
  const f = ownPeer(id);
  if (f.hidden) throw pfErr('That feedback is hidden.', 409);
  if (f.thanked) return f;
  f.thanked = nowIso();
  const e = getEvent(f.eventId);
  if (f.fromId) notify(toStudent(f.fromId), `${getStudent(f.studentId)?.name.split(' ')[0] || 'A classmate'} said thank you for your feedback on “${e?.title || 'a moment'}”.`, { persona: toStudent(f.fromId), screen: 'map' });
  emit();
  return f;
}
export function hidePeerFeedback(id) {
  const f = ownPeer(id);
  f.hidden = { at: nowIso(), by: 'student' };
  emit();
}
export function setPeerFeedbackYear(year, on, by) {
  const y = Number(year);
  if (!(y >= PEER_MIN_GRADE + 1 && y <= 13)) throw pfErr('Pick Year 9 to 13.');
  const s = (store.peerSettings ||= { offYears: [] }), off = new Set(s.offYears || []);
  if (on) off.delete(y); else off.add(y);
  s.offYears = [...off].sort((a, b) => a - b);
  s.by = by || null; s.at = nowIso();
  emit();
}
// Safeguarding: reportItem({ feedbackId }, …) and moderateReport on such a report (hide, unhide, none).
const reportItemBase = reportItem, moderateReportBase = moderateReport;
reportItem = function reportItem(target, reason, note, from) {
  if (!target?.feedbackId) return reportItemBase(target, reason, note, from);
  const f = ownPeer(target.feedbackId), e = getEvent(f.eventId); if (!e) throw pfErr('No such moment.', 404);
  if (!REPORT_REASONS[reason]) throw pfErr('Pick a reason.');
  const who = reporter(from, e);
  if (who.role === 'Family') throw pfErr('Families do not see feedback.');
  const at = nowIso(), list = (store.reports ||= []);
  const open = list.find((r) => r.from.key === who.key && r.status === 'open' && r.feedbackId === f.id);
  if (open) return open;
  if (list.filter((r) => r.from.key === who.key && Date.parse(at) - Date.parse(r.at) < 3600e3).length >= REPORT_LIMIT) throw pfErr('You have sent a lot of reports. Try again later, or speak to a teacher.', 429);
  const r = { id: uid('rp-'), kind: 'feedback', eventId: e.id, feedbackId: f.id, studentId: e.studentId, reason, note: String(note ?? '').trim().slice(0, 1000), at, from: who, status: 'open', history: [] };
  list.push(r);
  for (const k of MODERATOR_KINDS) notify(toRole(k), `New report: kind feedback on “${e.title}” (${getStudent(e.studentId).name}). ${REPORT_REASONS[reason]}.`, { persona: toRole(k), screen: 'reports', param: r.id });
  emit();
  return r;
};
moderateReport = function moderateReport(id, action, note, by) {
  const r = getReport(id);
  if (!r?.feedbackId) return moderateReportBase(id, action, note, by);
  if (!REPORT_STATUS[action]) throw pfErr('Pick what to do.');
  if (action === 'photo') throw pfErr('Feedback has no photo.');
  if (by && !teacherById[by]) throw pfErr('No such teacher.');
  const f = getPeerFeedback(r.feedbackId), e = getEvent(r.eventId);
  if (action !== 'none' && !f) throw pfErr('That feedback is gone.', 404);
  const at = nowIso(), name = by ? teacherById[by].name : 'Pilot admin', to = toStudent(r.studentId), go = e ? { persona: to, screen: 'map', param: e.id } : undefined;
  if (action === 'hide') { f.hidden = { at, by: name }; notify(to, `A teacher has hidden kind feedback on “${e?.title}”.`, go); }
  if (action === 'unhide') { delete f.hidden; notify(to, `A teacher has finished looking at kind feedback on “${e?.title}”. It is shown again.`, go); }
  const entry = { action, note: String(note ?? '').trim().slice(0, 1000), at, by: name };
  for (const x of store.reports) if (x.feedbackId === r.feedbackId) { x.history.push({ ...entry }); x.status = REPORT_STATUS[action]; }
  emit();
  return r;
};
// ── Milestones and celebrations (src/milestones.js, src/components/Milestones.jsx) ──
// Worked out from the map as each viewer reads it (a family or an advisor only from moments they can see), never stored.
// What is kept: store.milestonesSeen[studentId] = { [key]: at }, so a celebration shows once, on any device.
import { deriveMilestones, since as milestonesSince, RECENT_DAYS } from './milestones.js';
export function milestonesOf(studentId, viewer = 'student', opts = {}) {
  if (!getStudent(studentId)) return [];
  return deriveMilestones(getStudentMap(studentId, viewer, opts), { today: TODAY, root: rootLine, line: lineById });
}
export const familyMilestones = (studentId) => (getStudent(studentId) ? milestonesOf(studentId, familyViewer(studentId), { family: true }) : []);
export const recentMilestones = (studentId, viewer = 'advisor', days = RECENT_DAYS) => milestonesSince(milestonesOf(studentId, viewer), daysBefore(days));
export const milestonesSeen = (studentId) => store.milestonesSeen?.[studentId] || null;
export function markMilestonesSeen(studentId, keys) {
  if (!getStudent(studentId)) throw Object.assign(new Error('No such student'), { status: 404 });
  const at = nowIso(), seen = ((store.milestonesSeen ||= {})[studentId] ||= {});
  for (const k of [].concat(keys || []).slice(0, 100)) if (typeof k === 'string' && k && k.length <= 80 && !seen[k]) seen[k] = at;
  emit();
  return seen;
}

// ── Exhibition screens (open evenings, the library, a lobby TV; src/screens/Exhibitions.jsx, src/screens/Kiosk.jsx,
// server/routes/45-exhibition.mjs) ──
// store.exhibitions [{ id: 'ex-…', title, token (long and random, made by the browser: the screen's address), by
// (teacherId | null), at, from, to (moment dates, inclusive; null: open), seconds (per slide), years: [British Years],
// classIds, advisory (by's advisees), lineIds (school lines; none: every line), paused: { at, by } | null, revoked:
// { at, by } | null, removed: [{ eventId, by, at }] }], made on first use.
// A slide is a moment that is publishable, not hidden by safeguarding, not a goal, dated in the window, on a chosen line,
// of a chosen student, whose student has not turned school screens off (privacy.screens === false), and that was never
// removed from this exhibition. It carries the first name and Year only, and one line of a publishable reflection.
export const EXHIBIT_SECONDS = { min: 4, max: 60, standard: 10 };
const exErr = (message, status = 400) => Object.assign(new Error(message), { status });
export const getExhibitions = () => store.exhibitions || [];
export const getExhibition = (id) => getExhibitions().find((x) => x.id === id);
export const EXHIBIT_TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
export const exhibitionByToken = (t) => (typeof t === 'string' && EXHIBIT_TOKEN.test(t) ? getExhibitions().find((x) => x.token === t) : undefined);
export const screensAllowed = (sid) => getPrivacy(sid).screens !== false;
export function exhibitionStudents(x) {
  const years = new Set(x.years || []), classes = new Set(x.classIds || []);
  const any = years.size || classes.size || x.advisory;
  const inClass = new Set(getEnrolments().filter((n) => classes.has(n.classId) && !(n.to && n.to < TODAY)).map((n) => n.studentId));
  return new Set(getStudents().filter((s) => !any || years.has(s.grade + 1) || inClass.has(s.id) || (x.advisory && !!x.by && s.advisorId === x.by)).map((s) => s.id));
}
const oneLine = (t) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim(), first = s.match(/^.+?[.!?](?=\s|$)/)?.[0] || s;
  return first.length > 140 ? `${first.slice(0, 139).trimEnd()}…` : first;
};
export function exhibitionSlides(idOrX) {
  const x = typeof idOrX === 'string' ? getExhibition(idOrX) : idOrX;
  if (!x) return [];
  const who = exhibitionStudents(x), gone = new Set((x.removed || []).map((r) => r.eventId)), lines = new Set(x.lineIds || []);
  const onLine = (l) => !lines.size || lines.has(l) || lines.has(rootLine(l));
  return store.events.filter((e) => who.has(e.studentId) && e.visibility === 'publishable' && !e.hidden && e.type !== 'goal' && e.date <= TODAY
    && (!x.from || e.date >= x.from) && (!x.to || e.date <= x.to) && e.lineIds.some(onLine) && !gone.has(e.id) && screensAllowed(e.studentId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 200).map((e) => {
      const s = getStudent(e.studentId), l = lineById(e.lineIds.find(onLine));
      const r = store.reflections.find((f) => f.eventId === e.id && f.visibility === 'publishable' && String(f.text || '').trim());
      return { eventId: e.id, studentId: e.studentId, title: e.title, date: e.date, name: s.name.split(' ')[0], year: s.grade + 1,
        line: l ? { id: l.id, name: l.name, colour: l.colour } : null, photo: (e.evidence || []).find(isPhoto)?.url || null, quote: r ? oneLine(r.text) : null };
    });
}
export function createExhibition(spec, by, token) {
  if (typeof token !== 'string' || !EXHIBIT_TOKEN.test(token) || getExhibitions().some((x) => x.token === token)) throw exErr('Could not make an address for the screen. Try again.');
  if (by && !teacherById[by]) throw exErr('No such teacher.');
  const title = String(spec?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) throw exErr('Give the screen a title.');
  const day = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
  const from = day(spec.from), to = day(spec.to);
  if (from && to && from > to) throw exErr('The first day is after the last day.');
  const seconds = Math.round(Number(spec.seconds ?? EXHIBIT_SECONDS.standard));
  if (!(seconds >= EXHIBIT_SECONDS.min && seconds <= EXHIBIT_SECONDS.max)) throw exErr(`Show each slide for ${EXHIBIT_SECONDS.min} to ${EXHIBIT_SECONDS.max} seconds.`);
  const years = [...new Set([].concat(spec.years || []).map(Number))].filter((y) => Number.isInteger(y) && y >= 1 && y <= 13).sort((a, b) => a - b);
  const classIds = [...new Set([].concat(spec.classIds || []))].filter((c) => getClasses().some((k) => k.id === c));
  const lineIds = [...new Set([].concat(spec.lineIds || []))].filter((l) => lineById(l) && !lineById(l).studentId);
  const x = { id: uid('ex-'), title, token, by: by || null, at: nowIso(), from, to, seconds, years, classIds, advisory: !!spec.advisory && !!by, lineIds, paused: null, revoked: null, removed: [] };
  (store.exhibitions ||= []).push(x);
  emit();
  return x;
}
const liveExhibition = (id) => {
  const x = getExhibition(id);
  if (!x) throw exErr('No such screen.', 404);
  if (x.revoked) throw exErr('This screen has been turned off.', 409);
  return x;
};
// Removed slides never come back, whatever the student does with the moment later.
export function removeExhibitionSlide(id, eventId, by) {
  const x = liveExhibition(id);
  if (typeof eventId !== 'string' || !eventId) throw exErr('Pick a slide.');
  if (!(x.removed ||= []).some((r) => r.eventId === eventId)) x.removed.push({ eventId, by: by || null, at: nowIso() });
  emit();
}
export function pauseExhibition(id, paused, by) {
  const x = liveExhibition(id);
  x.paused = paused ? { at: nowIso(), by: by || null } : null;
  emit();
}
export function revokeExhibition(id, by) {
  const x = getExhibition(id);
  if (!x) throw exErr('No such screen.', 404);
  if (!x.revoked) x.revoked = { at: nowIso(), by: by || null };
  emit();
}
// ── Leaver portfolio (src/components/Leaver.jsx, server/routes/41-leaver.mjs) ──
// A Year 12 or 13 student (Year 11 as practice) builds one portfolio from their own record for applications.
// store.leaver { [studentId]: { profile: { name, statement, email, photo }, moments: [{ eventId, evidence: [index],
//   reflectionId, sentences: [index] | null }], skillsOff: [tag], endorsements: [endorsementId], template,
//   links: [{ token, at, expiresAt, revoked, label }], comments: [{ id, by, text, at, done? }], updatedAt } }
// Only the student changes it; their advisor (and whole-school staff) may comment. leaverView() is what any copy shows:
// it checks every item again, so a moment made private or hidden by a moderator later drops out by itself.
import { verifyCode as codeOf } from './format.js';
export const LEAVER_MAX = 8;
export const LEAVER_TEMPLATES = { classic: 'NIST navy classic', minimal: 'Minimal', 'two-column': 'Two columns' };
export const LEAVER_LINK_DAYS = [30, 90, 180, 365];
const LV_TEXT = { name: 80, statement: 1500, email: 120, label: 80, comment: 1000 };
const lvErr = (m, status = 400) => Object.assign(new Error(m), { status });
export const leaverAllowed = (sid) => { const s = getStudent(sid); return !!s && !s.cohortOnly && s.grade >= 10; };
export const leaverPractice = (sid) => getStudent(sid)?.grade === 10;
export const getLeaver = (sid) => store.leaver?.[sid] || null;
export const sentencesOf = (text = '') => (String(text).match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) || []).map((x) => x.trim()).filter(Boolean);
export const leaverMomentOk = (e, sid) => !!e && e.studentId === sid && e.type !== 'goal' && e.visibility !== 'private' && !e.hidden;
export const leaverReflectionOk = (r, e) => !!r && !!e && r.eventId === e.id && (r.visibility || 'private') !== 'private' && !r.hidden;
// Endorsements on moments the student shows the school or beyond (school, publishable); never on a hidden moment.
const LV_ENDORSE_VIS = ['school', 'publishable'];
export const leaverEndorsementOk = (n, sid) => { const e = n && getEvent(n.eventId); return !!e && e.studentId === sid && !e.hidden && LV_ENDORSE_VIS.includes(e.visibility) && (!n.visibility || LV_ENDORSE_VIS.includes(n.visibility)); };
export function leaverChoices(sid) {
  const moments = store.events.filter((e) => leaverMomentOk(e, sid)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((e) => ({ ...e, reflections: store.reflections.filter((r) => leaverReflectionOk(r, e)), tags: getTags(e) }));
  const endorsements = store.endorsements.filter((n) => leaverEndorsementOk(n, sid)).map((n) => ({ ...n, teacher: teacherById[n.teacherId], moment: getEvent(n.eventId) }));
  const blocked = store.events.filter((e) => e.studentId === sid && e.type !== 'goal' && (e.visibility === 'private' || e.hidden)).length;
  return { moments, endorsements, blocked };
}
const blankLeaver = (sid) => ({ profile: { name: getStudent(sid).name, statement: '', email: '', photo: null }, moments: [], skillsOff: [], endorsements: [], template: 'classic', links: [], comments: [], updatedAt: null });
const lvStr = (v, max) => String(v ?? '').replace(/\s+$/g, '').slice(0, max);
const LV_PHOTO = /^(\/?api\/files\/[a-f0-9]{32}\.[a-z0-9]{2,5}|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+|evidence\/[\w.-]+)$/;
const ints = (a, n) => [...new Set((Array.isArray(a) ? a : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n))].sort((x, y) => x - y);
export function saveLeaver(studentId, patch = {}) {
  if (!leaverAllowed(studentId)) throw lvErr('The leaver portfolio is for Years 11 to 13.', 403);
  const p = ((store.leaver ||= {})[studentId] ||= blankLeaver(studentId));
  if (patch.profile) {
    const f = { ...p.profile, ...patch.profile };
    const email = lvStr(f.email, LV_TEXT.email).trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw lvErr('That email does not look right.');
    if (f.photo && !LV_PHOTO.test(String(f.photo))) throw lvErr('Use a photo you uploaded.');
    p.profile = { name: lvStr(f.name, LV_TEXT.name).trim() || getStudent(studentId).name, statement: lvStr(f.statement, LV_TEXT.statement), email, photo: f.photo || null };
  }
  if (patch.moments) {
    if (!Array.isArray(patch.moments)) throw lvErr('Pick moments from your map.');
    const seen = new Set(), out = [];
    for (const m of patch.moments) {
      const e = getEvent(m?.eventId);
      if (!leaverMomentOk(e, studentId)) throw lvErr(e?.studentId === studentId && e.visibility === 'private' ? 'Private moments cannot go in a portfolio.' : 'That moment cannot go in a portfolio.');
      if (seen.has(e.id)) continue; seen.add(e.id);
      const r = m.reflectionId ? store.reflections.find((x) => x.id === m.reflectionId) : null;
      if (m.reflectionId && !leaverReflectionOk(r, e)) throw lvErr('Private reflections cannot go in a portfolio.');
      out.push({ eventId: e.id, evidence: ints(m.evidence, e.evidence?.length || 0), reflectionId: r?.id || null, sentences: r && Array.isArray(m.sentences) ? ints(m.sentences, sentencesOf(r.text).length) : null });
    }
    if (out.length > LEAVER_MAX) throw lvErr(`Pick up to ${LEAVER_MAX} moments.`);
    p.moments = out;
  }
  if (patch.skillsOff) p.skillsOff = [...new Set([].concat(patch.skillsOff).filter((k) => LEARNER_PROFILE.includes(k) || ATL.includes(k)))];
  if (patch.endorsements) {
    const ids = [...new Set([].concat(patch.endorsements))];
    if (ids.some((id) => !leaverEndorsementOk(store.endorsements.find((n) => n.id === id), studentId))) throw lvErr('Only endorsements on moments your school can see can go in.');
    p.endorsements = ids;
  }
  if (patch.template) { if (!LEAVER_TEMPLATES[patch.template]) throw lvErr('Pick a template.'); p.template = patch.template; }
  p.updatedAt = nowIso();
  emit();
  return p;
}
// A share link: the token comes from the browser (crypto, unguessable), never from uid().
export function shareLeaver(studentId, { token, days = 90, label = '' } = {}) {
  const p = getLeaver(studentId);
  if (!leaverAllowed(studentId) || !p) throw lvErr('Make your portfolio first.', 404);
  if (!leaverView(studentId).moments.length) throw lvErr('Pick at least one moment first.');
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(String(token || ''))) throw lvErr('That link could not be made.');
  const taken = Object.values(store.leaver).some((x) => x.links?.some((l) => l.token === token)) || Object.values(store.drafts || {}).flat().some((d) => d?.shareLinks?.some((l) => l.token === token));
  if (taken) throw lvErr('That link could not be made.', 409);
  if (!LEAVER_LINK_DAYS.includes(Number(days))) throw lvErr('Pick how long the link works.');
  const link = { token, at: nowIso(), expiresAt: daysBefore(-Number(days)), revoked: false, label: lvStr(label, LV_TEXT.label).trim() };
  (p.links ||= []).push(link);
  log(studentId, getStudent(studentId).name, 'link', `Made a leaver portfolio link${link.label ? ` for ${link.label}` : ''}, until ${link.expiresAt}`);
  emit();
  return link;
}
export function revokeLeaver(studentId, token) {
  const l = getLeaver(studentId)?.links?.find((x) => x.token === token);
  if (!l) throw lvErr('No such link.', 404);
  if (!l.revoked) { l.revoked = true; l.revokedAt = nowIso(); log(studentId, getStudent(studentId).name, 'link', `Withdrew a leaver portfolio link${l.label ? ` for ${l.label}` : ''}`); }
  emit();
  return l;
}
export function commentLeaver(studentId, by, text) {
  const p = getLeaver(studentId), t = teacherById[by], body = lvStr(text, LV_TEXT.comment).trim();
  if (!p) throw lvErr('There is no portfolio yet.', 404);
  if (!t) throw lvErr('No such teacher.');
  if (body.length < 2) throw lvErr('Write a comment first.');
  const c = { id: uid('lc-'), by, text: body, at: nowIso() };
  (p.comments ||= []).push(c);
  notify(toStudent(studentId), `${shortName(t.name)} left a comment on your leaver portfolio`, { persona: toStudent(studentId), screen: 'leaver' });
  emit();
  return c;
}
export function doneLeaverComment(studentId, id) {
  const c = getLeaver(studentId)?.comments?.find((x) => x.id === id);
  if (!c) throw lvErr('No such comment.', 404);
  c.done = c.done ? null : nowIso();
  emit();
  return c;
}
// What a portfolio shows, checked item by item: the draft view, the PDF and the public page all use it.
export function leaverView(sid) {
  const s = getStudent(sid), p = getLeaver(sid);
  if (!s || !p) return null;
  const lineOf = (id) => { const l = lineById(id); return l && { id, name: s.lineLabels?.[id] || l.name, colour: l.colour }; };
  const moments = (p.moments || []).flatMap((m) => {
    const e = getEvent(m.eventId);
    if (!leaverMomentOk(e, sid)) return [];
    const r = m.reflectionId && store.reflections.find((x) => x.id === m.reflectionId);
    const ok = leaverReflectionOk(r, e) ? r : null, parts = ok ? sentencesOf(ok.text) : [];
    const text = ok ? (Array.isArray(m.sentences) ? m.sentences.filter((i) => parts[i]).map((i) => parts[i]).join(' ') : ok.text) : '';
    const verified = e.verification && e.verification !== 'student-added';
    return [{ id: e.id, title: e.title, date: e.date, type: e.type, summary: e.summary || e.about || '', lines: (e.lineIds || []).map(lineOf).filter(Boolean),
      verification: e.verification, code: verified && e.visibility === 'publishable' ? codeOf(e.id) : null,
      evidence: (m.evidence || []).map((i) => e.evidence?.[i]).filter(Boolean).map(({ kind, url, caption }) => ({ kind, url: url || null, caption: caption || '' })),
      reflection: text ? { prompt: ok.prompt || '', text } : null, tags: getTags(e) }];
  }).slice(0, LEAVER_MAX);
  const off = new Set(p.skillsOff || []);
  const tally = (field, list) => list.map((k) => ({ k, n: moments.filter((m) => m.tags?.[field]?.includes(k)).length })).filter((x) => x.n && !off.has(x.k));
  const endorsements = (p.endorsements || []).map((id) => store.endorsements.find((n) => n.id === id)).filter((n) => leaverEndorsementOk(n, sid))
    .map((n) => ({ id: n.id, teacher: teacherById[n.teacherId]?.name || 'A teacher', role: teacherById[n.teacherId]?.role || '', note: n.note, date: n.date, moment: getEvent(n.eventId).title }));
  return { name: p.profile?.name || s.name, year: s.grade + 1, programme: s.programme || '', statement: p.profile?.statement || '', email: p.profile?.email || '', photo: p.profile?.photo || null,
    template: LEAVER_TEMPLATES[p.template] ? p.template : 'classic', moments: moments.map(({ tags, ...m }) => m), skills: { lp: tally('lp', LEARNER_PROFILE), atl: tally('atl', ATL) }, endorsements, practice: s.grade === 10 };
}
export const leaverLinkOpen = (l) => !!l && !l.revoked && l.expiresAt >= TODAY;

// ── Weekly goal check-ins (src/components/GoalCheckins.jsx) ──
// Once a week (Monday to Sunday, Bangkok) a student with an open goal is asked how it is going. Stored on the goal:
// e.checkins [{ id, week (its Monday), date, status, note, next, at }] (one per week: answering again replaces it),
// e.checkinSnooze (no questions before that day), e.encouragements [{ id, by, line, text, at }]. Stuck twice in a row
// flags the goal to the advisor and an accepted sponsor, who can send encouragement. No streaks, no scores.
export const CHECKIN_STATUS = { well: 'Going well', stuck: 'Stuck', none: 'Not started' };
export const ENCOURAGE_LINES = ['You’ve got this. Small steps still count.', 'Being stuck is part of it. Come and find me if you want to talk it through.', 'I’m proud of you for keeping at it.', 'Try one tiny step this week. I’m here to help.'];
export const CHECKIN_SNOOZE_DAYS = 14;
const ciClip = (v, n) => String(v ?? '').trim().slice(0, n);
const ciDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const isOpenGoal = (e) => e?.type === 'goal' && !e.requirement && !e.closedOn;
export const goalCheckins = (e) => e?.checkins || [];
export const checkinSnoozed = (e) => !!e?.checkinSnooze && e.checkinSnooze > TODAY;
export const checkedInThisWeek = (e) => goalCheckins(e).some((c) => c.week === weekOf(TODAY).from);
export const checkinsDue = (studentId) => store.events.filter((e) => e.studentId === studentId && isOpenGoal(e) && !checkinSnoozed(e) && !checkedInThisWeek(e)).sort((a, b) => a.date.localeCompare(b.date));
// The last two check-ins both "Stuck", the latest one this week or last.
export function stuckTwice(e) {
  const c = goalCheckins(e).slice(-2);
  return isOpenGoal(e) && c.length === 2 && c.every((x) => x.status === 'stuck') && c[1].week >= weekOf(TODAY, 1).from;
}
// Who may send encouragement on a goal: the student's advisor or the goal's accepted sponsor. Never a private goal.
export const canEncourage = (eventId, tid) => { const e = getEvent(eventId); return isOpenGoal(e) && !!tid && e.visibility !== 'private' && (getStudent(e.studentId)?.advisorId === tid || (e.sponsor?.teacherId === tid && e.sponsor.status === 'accepted')); };
// The stuck goals a teacher sees on My advisory and This week, from the part of the record they hold.
export const stuckFlags = (tid) => store.events.filter((e) => stuckTwice(e) && canEncourage(e.id, tid)).map((e) => {
  const last = goalCheckins(e).at(-1);
  return { event: e, student: getStudent(e.studentId), last, sent: (e.encouragements || []).find((x) => x.by === tid && x.at >= last.at) || null };
});
export function checkInGoal(goalId, f = {}) {
  const e = getEvent(goalId);
  if (!isOpenGoal(e)) throw cmErr('No such goal.', 404);
  if (!Object.hasOwn(CHECKIN_STATUS, f.status)) throw cmErr('Pick how it is going.');
  const week = weekOf(TODAY).from;
  const c = { id: uid('ci-'), week, date: TODAY, status: f.status, note: ciClip(f.note, 300), next: ciClip(f.next, 200), at: nowIso() };
  e.checkins = [...goalCheckins(e).filter((x) => x.week !== week), c];
  const s = getStudent(e.studentId);
  log(e.studentId, s?.name, 'goal', `Checked in on “${e.title}”: ${CHECKIN_STATUS[c.status]}`);
  if (stuckTwice(e) && e.visibility !== 'private') {
    const to = [s?.advisorId, e.sponsor?.status === 'accepted' ? e.sponsor.teacherId : null].filter((t, i, a) => t && a.indexOf(t) === i);
    for (const t of to) notify(toTeacher(t), `${s.name.split(' ')[0]} is stuck on “${e.title}”`, { persona: toTeacher(t), screen: 'week' });
  }
  emit();
  return c;
}
export function snoozeCheckins(goalId) {
  const e = getEvent(goalId);
  if (!isOpenGoal(e)) throw cmErr('No such goal.', 404);
  e.checkinSnooze = ciDays(TODAY, CHECKIN_SNOOZE_DAYS);
  log(e.studentId, getStudent(e.studentId)?.name, 'goal', `Paused check-ins on “${e.title}” until ${e.checkinSnooze}`);
  emit();
  return e.checkinSnooze;
}
export function sendEncouragement(goalId, by, line, text) {
  const e = getEvent(goalId);
  if (!isOpenGoal(e)) throw cmErr('No such goal.', 404);
  if (!ENCOURAGE_LINES.includes(line) && !ciClip(text, 300)) throw cmErr('Pick a line or write one.');
  const n = { id: uid('en-'), by, line: ENCOURAGE_LINES.includes(line) ? line : '', text: ciClip(text, 300), at: nowIso() };
  e.encouragements = [...(e.encouragements || []), n];
  const who = shortName(teacherName(by));
  notify(toStudent(e.studentId), `${who} sent you encouragement for “${e.title}”: ${[n.line, n.text].filter(Boolean).join(' ')}`, { persona: toStudent(e.studentId), screen: 'map', param: e.id });
  log(e.studentId, teacherName(by), 'goal', `Sent encouragement on “${e.title}”`);
  emit();
  return n;
}
// ── Conference booking: families pick a time with the advisor (src/components/ConferenceBooking.jsx) ──
// An advisor (their advisees) or whole-school staff (a whole Year: each student with their own advisor) open a round:
// days with hours, a slot length, breaks (every day), a room or an online link. Each family picks one slot per child and can
// change or cancel it until CONF_CHANGE_H hours before; the advisor sees the day grid, books for a family and blocks slots.
// store.confRounds: { id: 'cr-…', title, days: [{ date, from, to }], slot, breaks: [{ from, to }], online, location, link,
//   advisorId | null, year | null, advisorIds, studentIds, by, at, closedOn? }
// store.confBookings: { id: 'cb-…', roundId, advisorId, studentId, date, time, by ('family' | teacher id), at, reminded? }
// store.confBlocks: { id: 'ck-…', roundId, advisorId, date, time, by, at }. All three made on first use.
// Times are Bangkok wall-clock times (no daylight saving): a slot starts at confAt(date, time).
export const CONF_SLOTS = [10, 15, 20];
export const CONF_CHANGE_H = 24;
export const CONF_TZ = '+07:00';
const cfErr = (m, status = 400) => Object.assign(new Error(m), { status });
const isHm = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const hmMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const minHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
// "3 Nov 2026 at 15:20" (notifications are stored in English; src/i18n.js renders the family's in Thai).
export const confWhen = (date, time) => `${+date.slice(8)} ${MON[+date.slice(5, 7) - 1]} ${date.slice(0, 4)} at ${time}`;
export const confAt = (date, time) => Date.parse(`${date}T${time}:00${CONF_TZ}`);
export const confEnd = (r, time) => minHm(hmMin(time) + r.slot);
export const getConferenceRounds = () => store.confRounds || [];
export const getConferenceRound = (id) => getConferenceRounds().find((r) => r.id === id) || null;
export const getConfBookings = () => store.confBookings || [];
export const getConfBooking = (id) => getConfBookings().find((b) => b.id === id) || null;
const confBlocks = () => store.confBlocks || [];
export const roundLive = (r) => !!r && !r.closedOn && r.days.some((d) => d.date >= TODAY);
// Brothers and sisters: a pilot server sets this from the family accounts (server/routes/68-conference.mjs); the demo has
// its one family, by persona.
let siblingsOf = (sid) => (PERSONA_OF_FAMILY[sid] ? Object.keys(PERSONA_OF_FAMILY).filter((x) => x !== sid && PERSONA_OF_FAMILY[x] === PERSONA_OF_FAMILY[sid]) : []);
export const setSiblingsOf = (fn) => { siblingsOf = fn; };
export const confSiblings = (sid) => siblingsOf(sid);
// The start times of one day, leaving out the breaks.
export function confDayTimes(r, day) {
  const out = [], end = hmMin(day.to);
  for (let t = hmMin(day.from); t + r.slot <= end; t += r.slot) if (!r.breaks.some((b) => t < hmMin(b.to) && t + r.slot > hmMin(b.from))) out.push(minHm(t));
  return out;
}
const slotOk = (r, date, time) => r.days.some((d) => d.date === date && confDayTimes(r, d).includes(time));
const sameSlot = (x, roundId, advisorId, date, time) => x.roundId === roundId && x.advisorId === advisorId && x.date === date && x.time === time;
// One advisor's day grid in one round: booked, blocked or free. A family's copy has other families' bookings as
// { taken: true } with no student (server/scope.mjs).
export function confGrid(roundId, advisorId) {
  const r = getConferenceRound(roundId); if (!r) return null;
  return { round: r, days: r.days.map((d) => ({ ...d, slots: confDayTimes(r, d).map((time) => {
    const booking = getConfBookings().find((b) => sameSlot(b, r.id, advisorId, d.date, time)), block = confBlocks().find((b) => sameSlot(b, r.id, advisorId, d.date, time));
    return { date: d.date, time, end: confEnd(r, time), state: booking ? 'booked' : block ? 'blocked' : 'free', booking: booking || null, block: block || null };
  }) })) };
}
export const confBookingOf = (roundId, studentId) => getConfBookings().find((b) => b.roundId === roundId && b.studentId === studentId) || null;
// A brother's or sister's booking (any round, any advisor) that overlaps this slot.
export function confClash(studentId, date, time, slot, siblings = siblingsOf(studentId)) {
  const a = confAt(date, time), z = a + slot * 60000;
  return getConfBookings().find((b) => {
    if (!b.studentId || b.studentId === studentId || !siblings.includes(b.studentId)) return false;
    const r = getConferenceRound(b.roundId), s = confAt(b.date, b.time);
    return !!r && s < z && a < s + r.slot * 60000;
  }) || null;
}
// Families change or cancel until CONF_CHANGE_H hours before; a new booking needs that much notice too.
export const confTooSoon = (date, time, now = Date.now()) => confAt(date, time) - now < CONF_CHANGE_H * 3600e3;
const roundStudents = ({ advisorId, year }) => store.students.filter((s) => !s.cohortOnly && s.advisorId && (advisorId ? s.advisorId === advisorId : s.grade + 1 === Number(year)));
function confClean(spec, keep) {
  const title = String(spec.title ?? keep?.title ?? '').trim().slice(0, 80) || 'Conferences';
  const slot = Number(spec.slot ?? keep?.slot);
  if (!CONF_SLOTS.includes(slot)) throw cfErr('Pick 10, 15 or 20 minutes');
  const days = [].concat(spec.days ?? keep?.days ?? []).map((d) => ({ date: String(d?.date || ''), from: String(d?.from || ''), to: String(d?.to || '') }));
  if (!days.length || days.length > 10 || new Set(days.map((d) => d.date)).size !== days.length) throw cfErr('Pick between 1 and 10 different days');
  if (days.some((d) => !isDay(d.date) || !isHm(d.from) || !isHm(d.to) || d.from >= d.to)) throw cfErr('Each day needs a date and a start before its end');
  if (days.some((d) => d.date < TODAY && !keep?.days.some((k) => k.date === d.date))) throw cfErr('Pick days from today on');
  days.sort((a, b) => a.date.localeCompare(b.date));
  const breaks = [].concat(spec.breaks ?? keep?.breaks ?? []).map((b) => ({ from: String(b?.from || ''), to: String(b?.to || '') }));
  if (breaks.length > 6 || breaks.some((b) => !isHm(b.from) || !isHm(b.to) || b.from >= b.to)) throw cfErr('Each break needs a start before its end');
  const online = !!(spec.online ?? keep?.online);
  const location = String(spec.location ?? keep?.location ?? '').trim().slice(0, 80);
  const link = online ? String(spec.link ?? keep?.link ?? '').trim().slice(0, 300) : '';
  if (online ? !/^https:\/\/\S+$/.test(link) : !location) throw cfErr(online ? 'Add the meeting link (https://…)' : 'Say where it is');
  const r = { title, days, slot, breaks, online, location, link };
  if (!days.some((d) => confDayTimes(r, d).length)) throw cfErr('No times fit: check the hours and breaks');
  return r;
}
export function openConferenceRound(spec = {}, by = null) {
  if (by && !teacherById[by]) throw cfErr('No such teacher');
  const { advisorId = null, year = null } = spec;
  if (!advisorId === !year) throw cfErr('Pick an advisory or a Year');
  if (advisorId && !teacherById[advisorId]) throw cfErr('No such advisor');
  const c = confClean(spec);
  const busy = new Set(getConferenceRounds().filter(roundLive).flatMap((r) => r.studentIds));
  const all = roundStudents({ advisorId, year }), ids = all.map((s) => s.id).filter((id) => !busy.has(id));
  if (!ids.length) throw cfErr(all.length ? 'These students already have conference booking open' : 'No students to book', all.length ? 409 : 400);
  const advisorIds = [...new Set(ids.map((id) => getStudent(id).advisorId))];
  const r = { id: uid('cr-'), ...c, advisorId: advisorId || null, year: year ? Number(year) : null, advisorIds, studentIds: ids, by: by || null, at: nowIso() };
  (store.confRounds ||= []).push(r);
  for (const sid of ids) {
    const s = getStudent(sid);
    notify(toFamily(sid), `${shortName(teacherById[s.advisorId]?.name || '')} opened conference booking: “${r.title}”. Pick a time for ${s.name.split(' ')[0]}`, { persona: toFamily(sid), screen: 'family', param: sid });
  }
  if (by) for (const aid of advisorIds) if (aid !== by) notify(toTeacher(aid), `${shortName(teacherById[by].name)} opened conference booking for ${r.year ? `Year ${r.year}` : 'your advisory'}: “${r.title}”`, { persona: toTeacher(aid), screen: 'advisory' });
  emit();
  return r;
}
// Title, place, days, hours, slot length or breaks. Refused while a booking would lose its time; blocks that no longer fit go.
export function editConferenceRound(id, patch = {}, by = null) {
  const r = getConferenceRound(id);
  if (!r) throw cfErr('No such conference round', 404);
  if (r.closedOn) throw cfErr('This round is closed', 410);
  const c = confClean(patch, r);
  const lost = getConfBookings().filter((b) => b.roundId === id && !slotOk(c, b.date, b.time)).length;
  if (lost) throw cfErr(`${lost} booking${lost === 1 ? '' : 's'} would lose ${lost === 1 ? 'its' : 'their'} time: move or cancel ${lost === 1 ? 'it' : 'them'} first`, 409);
  Object.assign(r, c, { editedAt: nowIso(), editedBy: by || null });
  if (store.confBlocks) store.confBlocks = store.confBlocks.filter((k) => k.roundId !== id || slotOk(r, k.date, k.time));
  emit();
  return r;
}
export function closeConferenceRound(id, by = null) {
  const r = getConferenceRound(id);
  if (!r) throw cfErr('No such conference round', 404);
  Object.assign(r, { closedOn: TODAY, closedBy: by || null });
  emit();
  return r;
}
// One slot per child per round: booking again moves it. by: 'family', or the advisor's teacher id (booking for the family).
export function bookConference(roundId, studentId, { date, time } = {}, by = 'family') {
  const r = getConferenceRound(roundId), s = getStudent(studentId);
  if (!r || !s || !r.studentIds.includes(studentId)) throw cfErr('This conference is not for this student', 404);
  if (!roundLive(r)) throw cfErr('Booking for this conference is closed', 410);
  const advisorId = s.advisorId, fam = by === 'family';
  if (!r.advisorIds.includes(advisorId)) throw cfErr('No advisor to meet', 409);
  if (!fam && !teacherById[by]) throw cfErr('No such teacher');
  if (!slotOk(r, date, time)) throw cfErr('Pick one of the times');
  const now = Date.parse(nowIso());
  if (confAt(date, time) <= now) throw cfErr('That time has passed', 409);
  const mine = confBookingOf(roundId, studentId);
  if (mine && mine.date === date && mine.time === time) return mine;
  if (fam && mine && confTooSoon(mine.date, mine.time, now)) throw cfErr(`Less than ${CONF_CHANGE_H} hours to go: ask the advisor to change it`, 409);
  if (fam && confTooSoon(date, time, now)) throw cfErr(`Pick a time at least ${CONF_CHANGE_H} hours ahead`, 409);
  if (getConfBookings().some((b) => b !== mine && sameSlot(b, roundId, advisorId, date, time)) || confBlocks().some((k) => sameSlot(k, roundId, advisorId, date, time))) throw cfErr('That time was just taken. Pick another', 409);
  const clash = confClash(studentId, date, time, r.slot);
  if (clash) throw cfErr(`That clashes with ${getStudent(clash.studentId)?.name.split(' ')[0] || 'a brother or sister'}’s conference`, 409);
  const b = mine || { id: uid('cb-'), roundId, advisorId, studentId };
  Object.assign(b, { date, time, by, at: nowIso() }); delete b.reminded;
  if (!mine) (store.confBookings ||= []).push(b);
  const f = s.name.split(' ')[0], adv = shortName(teacherById[advisorId]?.name || '');
  if (fam) notify(toTeacher(advisorId), `${s.name}’s family ${mine ? 'moved their' : 'booked a'} conference: ${confWhen(date, time)}`, { persona: toTeacher(advisorId), screen: 'advisory', param: `conf~${r.id}~${date}` });
  else notify(toFamily(studentId), `${shortName(teacherById[by].name)} booked ${f}’s conference: ${confWhen(date, time)}`, { persona: toFamily(studentId), screen: 'family', param: studentId });
  notify(toStudent(studentId), `Your conference with ${adv} is on ${confWhen(date, time)}`, { persona: toStudent(studentId), screen: 'map' });
  emit();
  return b;
}
export function cancelConference(id, by = 'family') {
  const b = getConfBooking(id);
  if (!b) throw cfErr('No such booking', 404);
  const s = getStudent(b.studentId), fam = by === 'family';
  if (!fam && !teacherById[by]) throw cfErr('No such teacher');
  if (fam && confTooSoon(b.date, b.time, Date.parse(nowIso()))) throw cfErr(`Less than ${CONF_CHANGE_H} hours to go: ask the advisor to change it`, 409);
  store.confBookings = getConfBookings().filter((x) => x !== b);
  const f = s?.name.split(' ')[0] || 'the student';
  if (fam) notify(toTeacher(b.advisorId), `${s?.name || 'A student'}’s family cancelled their conference on ${confWhen(b.date, b.time)}`, { persona: toTeacher(b.advisorId), screen: 'advisory', param: `conf~${b.roundId}~${b.date}` });
  else notify(toFamily(b.studentId), `${shortName(teacherById[by].name)} cancelled ${f}’s conference on ${confWhen(b.date, b.time)}`, { persona: toFamily(b.studentId), screen: 'family', param: b.studentId });
  notify(toStudent(b.studentId), `Your conference on ${confWhen(b.date, b.time)} was cancelled`, { persona: toStudent(b.studentId), screen: 'map' });
  emit();
  return b;
}
// The advisor keeps a time free of bookings (on), or opens it again (off).
export function blockConferenceSlot(roundId, advisorId, date, time, on = true, by = null) {
  const r = getConferenceRound(roundId);
  if (!r || !r.advisorIds.includes(advisorId)) throw cfErr('No such conference round', 404);
  if (!slotOk(r, date, time)) throw cfErr('Pick one of the times');
  const k = confBlocks().find((x) => sameSlot(x, roundId, advisorId, date, time));
  if (on && !k) {
    if (getConfBookings().some((b) => sameSlot(b, roundId, advisorId, date, time))) throw cfErr('Someone booked this time: cancel it first', 409);
    (store.confBlocks ||= []).push({ id: uid('ck-'), roundId, advisorId, date, time, by: by || null, at: nowIso() });
  }
  if (!on && k) store.confBlocks = confBlocks().filter((x) => x !== k);
  emit();
  return !!on;
}
// Bookings tomorrow (Bangkok) that have not had their reminder yet.
export const confRemindersDue = (today = TODAY) => getConfBookings().filter((b) => b.studentId && b.date === dayAfter(today) && b.reminded !== b.date && getConferenceRound(b.roundId) && !getConferenceRound(b.roundId).closedOn);
// The day before: a reminder to the family for each booking, and one to each advisor for their day. The server runs it.
export function sendConferenceReminders(today = TODAY) {
  const due = confRemindersDue(today), per = new Map();
  for (const b of due) {
    const r = getConferenceRound(b.roundId), s = getStudent(b.studentId);
    b.reminded = b.date;
    if (!s) continue;
    notify(toFamily(b.studentId), `Reminder: ${s.name.split(' ')[0]}’s conference with ${shortName(teacherById[b.advisorId]?.name || '')} is tomorrow, ${confWhen(b.date, b.time)} · ${r.online ? 'online' : r.location}`, { persona: toFamily(b.studentId), screen: 'family', param: b.studentId });
    per.set(b.advisorId, [...(per.get(b.advisorId) || []), b]);
  }
  for (const [aid, list] of per) {
    const first = list.map((b) => b.time).sort()[0];
    notify(toTeacher(aid), `Reminder: ${list.length} conference${list.length === 1 ? '' : 's'} tomorrow, the first ${confWhen(list[0].date, first)}`, { persona: toTeacher(aid), screen: 'advisory', param: `conf~${list[0].roundId}~${list[0].date}` });
  }
  if (due.length) emit();
  return due.length;
}
// The rounds an advisor meets families in: live ones, and ones whose last day was in the past fortnight.
export const advisorConfRounds = (advisorId) => getConferenceRounds().filter((r) => r.advisorIds.includes(advisorId) && (roundLive(r) || (!r.closedOn && r.days.at(-1).date >= daysBefore(14))))
  .sort((a, b) => a.days[0].date.localeCompare(b.days[0].date) || a.at.localeCompare(b.at));
// What a family sees: each live round that covers one of their children, with each child's advisor and booking.
export const familyConfRounds = (childIds) => getConferenceRounds().filter((r) => roundLive(r) && childIds.some((id) => r.studentIds.includes(id)))
  .map((r) => ({ round: r, children: childIds.filter((id) => r.studentIds.includes(id) && getStudent(id)).map((id) => ({ student: getStudent(id), advisorId: getStudent(id).advisorId, advisor: teacherById[getStudent(id).advisorId] || null, booking: confBookingOf(r.id, id) })) }));
// A student's own conferences from today on.
export const studentConferences = (studentId) => getConfBookings().filter((b) => b.studentId === studentId && b.date >= TODAY)
  .map((b) => ({ booking: b, round: getConferenceRound(b.roundId), advisor: teacherById[b.advisorId] || null })).filter((x) => x.round && !x.round.closedOn)
  .sort((a, b) => a.booking.date.localeCompare(b.booking.date) || a.booking.time.localeCompare(b.booking.time));
// Booked so far in one round, for one advisor's students.
export function confProgress(roundId, advisorId) {
  const r = getConferenceRound(roundId);
  const kids = (r ? r.studentIds : []).map(getStudent).filter((s) => s && (!advisorId || s.advisorId === advisorId)).sort((a, b) => a.name.localeCompare(b.name));
  const waiting = kids.filter((s) => !confBookingOf(roundId, s.id));
  return { total: kids.length, booked: kids.length - waiting.length, waiting, students: kids };
}
// ── Subject prompts: what makes a good moment on a line, a few guiding questions, sentence starters and examples ──
// (src/components/SubjectPrompts.jsx). store.subjectPrompts [{ id: 'sp-…', lineId (a school line), classId (null: the whole
// line), by (teacherId | null), at, note, questions (3–6), starters, examples }], made on first use. One per class and one per
// line: writing again replaces it and keeps its id. An example is the teacher's own { id, title, text, status: 'teacher' } or
// a student's publishable moment { id, eventId, studentId, status: 'asked' | 'yes' | 'no', askedAt, answeredAt? }, shown to
// other students only once that student says yes (answerExampleAsk), and only while the moment stays publishable on the line.
// Which prompts a student sees on a line: their class's (a class on that line they are in now), else the line's, else the
// built-in defaults (DEFAULT_PROMPTS). A moment written with them carries promptId (addStation's f.promptId), for the counts.
export const SP_LIMITS = { note: 400, question: 200, starter: 80, minQuestions: 3, maxQuestions: 6, starters: 8, examples: 3 };
const D = (note, questions, starters) => ({ note, questions, starters });
export const DEFAULT_PROMPTS = {
  science: D('A good science moment says what you set out to find out, what you did and what the results showed, even when the experiment did not go to plan.',
    ['What were you trying to find out?', 'What did you do, step by step?', 'What happened? What did you notice or measure?', 'What does it show, and what surprised you?', 'What would you change if you did it again?'],
    ['I wanted to find out…', 'First we…', 'I noticed that…', 'This shows that…', 'Next time I would…']),
  computing: D('A good computing moment says what you built or solved, how it works and what you learnt when it went wrong.',
    ['What did you build, code or fix?', 'What problem was it solving, and for whom?', 'What went wrong, and how did you sort it out?', 'What would you add or improve next?'],
    ['I built…', 'The tricky part was…', 'I fixed it by…', 'Next I want to…']),
  environment: D('A good environment moment says what you did for the place around you, what changed and why it matters.',
    ['What did you do, and where?', 'Why does it matter for the environment?', 'What changed because of it?', 'What would you like to do next?'],
    ['We…', 'It matters because…', 'Afterwards…', 'Next I would like to…']),
  sport: D('A good sport moment says what you trained for or played, how you improved and how you worked with others.',
    ['What did you play, train for or compete in?', 'What did you get better at?', 'What was hard, and how did you keep going?', 'How did you help your team or others?'],
    ['I trained for…', 'I got better at…', 'It was hard when…', 'I helped the team by…']),
  service: D('A good service moment says who you worked with, what you did together and what you learnt about what they needed.',
    ['Who did you help or work with?', 'What did you do together?', 'What did you learn about what they needed?', 'What difference did it make, to them and to you?'],
    ['I worked with…', 'Together we…', 'I learnt that they needed…', 'It made a difference because…']),
  music: D('A good music moment says what you played, sang or wrote, how you practised and how it felt to perform or share it.',
    ['What did you play, sing or write?', 'How did you practise or prepare?', 'What went well, and what was tricky?', 'How did it feel to perform or share it?'],
    ['I played…', 'To get ready I…', 'The tricky part was…', 'Performing felt…']),
  design: D('A good design moment shows what you designed, who it was for and how it changed after you tested it.',
    ['What did you design or make?', 'Who was it for, and what did they need?', 'What did you test, and what did you change?', 'What would you improve next time?'],
    ['I designed…', 'It was for…', 'After testing I changed…', 'Next time I would…']),
  languages: D('A good languages moment says what you read, wrote, said or understood, and what you can do now that you could not before.',
    ['What did you read, write, say or listen to?', 'Which language, and who was it with or for?', 'What can you do now that you could not before?', 'What would you like to try next?'],
    ['I read…', 'I wrote…', 'Now I can…', 'Next I want to try…']),
  art: D('A good art moment shows what you made, the ideas behind it and the choices you made along the way.',
    ['What did you make?', 'Where did the idea come from?', 'What choices did you make, and why?', 'What would you try differently next time?'],
    ['I made…', 'My idea came from…', 'I chose to…', 'Next time I would try…']),
};
const spErr = (message, status = 400) => Object.assign(new Error(message), { status });
const sPrompts = () => (store.subjectPrompts ||= []);
export const getSubjectPrompts = () => store.subjectPrompts || [];
export const getSubjectPrompt = (id) => getSubjectPrompts().find((p) => p.id === id);
const schoolLine = (id) => { const l = lineById(id); return !!l && !l.studentId && !l.parentLineId; };
export const schoolLines = () => store.lines.filter((l) => !l.studentId && !l.parentLineId && l.status !== 'ended');
// The prompts written for exactly this class, or for exactly this line (not the ones it falls back to).
export const subjectPromptFor = ({ classId, lineId } = {}) => getSubjectPrompts().find((p) => (classId ? p.classId === classId : !p.classId && p.lineId === lineId)) || null;
// A moment that can be an example on a line: publishable, not hidden, not a goal, on that line or one of its sub-lines.
export const exampleOk = (e, lineId) => !!e && e.visibility === 'publishable' && !e.hidden && e.type !== 'goal' && e.lineIds.some((l) => rootLine(l) === lineId);
const exampleText = (e) => {
  const r = store.reflections.find((f) => f.eventId === e.id && f.visibility === 'publishable' && String(f.text || '').trim());
  const t = String(r?.text || e.summary || e.about || '').trim();
  return t.length > 300 ? `${t.slice(0, 299).trimEnd()}…` : t;
};
// What other students see of a student's example: the moment's title, a line of it and the Year, never the name or ids.
// null while the student has not said yes, or once the moment is no longer a publishable one on the line.
export function exampleView(x, lineId) {
  if (!x?.eventId || x.status !== 'yes') return null;
  const e = getEvent(x.eventId), s = e && getStudent(e.studentId);
  if (!s || !exampleOk(e, lineId)) return null;
  return { id: x.id, status: 'yes', title: e.title, text: exampleText(e), year: s.grade + 1 };
}
// A student's publishable moments a teacher may pick from: on the line, of the class's students now (classId) or anyone
// in this record (a line), newest first.
export function exampleChoices(lineId, classId = null) {
  const who = classId ? new Set(nowIn(classId) || []) : null;
  return store.events.filter((e) => exampleOk(e, lineId) && (!who || who.has(e.studentId)) && getStudent(e.studentId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 60)
    .map((e) => { const s = getStudent(e.studentId); return { eventId: e.id, studentId: s.id, title: e.title, date: e.date, name: s.name, year: s.grade + 1, text: exampleText(e) }; });
}
// How many moments were written with these prompts (in this person's record); a default's id is `sp-default-<line>`.
export const promptUses = (id) => store.events.filter((e) => e.promptId === id && e.type !== 'goal').length;
const shownExamples = (p) => (p.examples || []).flatMap((x) => {
  if (x.status === 'teacher') return x.title || x.text ? [{ id: x.id, title: x.title, text: x.text, year: null }] : [];
  if (!x.eventId) return x.status === 'yes' && x.title ? [{ id: x.id, title: x.title, text: x.text || '', year: x.year ?? null }] : []; // the server's copy for others
  const v = exampleView(x, p.lineId);
  return v ? [{ id: v.id, title: v.title, text: v.text, year: v.year }] : [];
});
// The prompts a student sees when adding a moment on a line (a sub-line counts for its school line). classId: a class's
// own (a class task); otherwise their current class on that line that has prompts, newest first. null off the school lines.
export function getPromptsFor(studentId, lineId, classId = null) {
  const root = rootLine(lineId);
  if (!schoolLine(root)) return null;
  const mine = classId ? [classId] : getEnrolments().filter((n) => n.studentId === studentId && !(n.to && n.to < TODAY)).map((n) => n.classId);
  const classes = new Set(mine.filter((id) => classById(id)?.lineId === root));
  const own = getSubjectPrompts().filter((p) => p.classId && classes.has(p.classId) && p.lineId === root).sort((a, b) => b.at.localeCompare(a.at))[0]
    || getSubjectPrompts().find((p) => !p.classId && p.lineId === root);
  const line = lineById(root);
  if (!own) return DEFAULT_PROMPTS[root] ? { id: `sp-default-${root}`, source: 'default', lineId: root, line, classId: null, className: '', by: null, teacher: null, ...structuredClone(DEFAULT_PROMPTS[root]), examples: [] } : null;
  return { id: own.id, source: own.classId ? 'class' : 'line', lineId: root, line, classId: own.classId || null, className: (own.classId && classById(own.classId)?.name) || '', by: own.by || null,
    teacher: (own.by && teacherById[own.by]) || null, note: own.note, questions: [...own.questions], starters: [...own.starters], examples: shownExamples(own) };
}
// A class's or a line's prompts as their writers manage them: the stored ones (or null), what students see, and the uses.
export function promptsAdmin({ classId, lineId } = {}) {
  const c = classId ? classById(classId) : null;
  const root = c ? c.lineId : lineId;
  const own = root ? subjectPromptFor(classId ? { classId } : { lineId: root }) : null;
  const fallback = classId && root ? subjectPromptFor({ lineId: root }) : null;
  const examples = (own?.examples || []).map((x) => {
    if (!x.eventId) return { ...x };
    const e = getEvent(x.eventId), s = getStudent(x.studentId);
    return { ...x, title: e?.title || x.title || 'A moment', name: s?.name || null, year: s ? s.grade + 1 : x.year ?? null, gone: !!e && !exampleOk(e, root) };
  });
  const effective = own || fallback;
  return { own, examples, fallback, source: own ? (classId ? 'class' : 'line') : fallback ? 'line' : 'default', lineId: root || null, line: (root && lineById(root)) || null,
    shown: effective ? { note: effective.note, questions: effective.questions, starters: effective.starters } : (DEFAULT_PROMPTS[root] || null),
    uses: own ? promptUses(own.id) : 0, defaultId: root ? `sp-default-${root}` : null };
}
// Example requests a student has not answered yet.
export const exampleAsksFor = (studentId) => getSubjectPrompts().flatMap((p) => (p.examples || []).filter((x) => x.studentId === studentId && x.status === 'asked')
  .map((x) => ({ promptId: p.id, exampleId: x.id, event: getEvent(x.eventId) || null, teacher: (p.by && teacherById[p.by]) || null, className: (p.classId && classById(p.classId)?.name) || '', line: lineById(p.lineId) || null })))
  .filter((a) => a.event);
// Write (or rewrite) a class's or a line's prompts. target: { classId } (a class on a line) or { lineId } (a school line).
// spec: { note, questions, starters, examples: [{ eventId } | { keep: exampleId } | { title, text }] }.
export function setSubjectPrompts(target = {}, spec = {}, by = null) {
  const c = target?.classId ? classById(target.classId) : null;
  if (target?.classId && !c) throw spErr('No such class', 404);
  const lineId = c ? c.lineId : target?.lineId;
  if (c && !lineId) throw spErr('This class is not on a line yet');
  if (!schoolLine(lineId)) throw spErr('Pick a school line');
  if (by && !teacherById[by]) throw spErr('No such teacher');
  const one = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const list = (xs, n) => [...new Set([].concat(xs || []).map((x) => one(x, n)).filter(Boolean))];
  const questions = list(spec?.questions, SP_LIMITS.question);
  if (questions.length < SP_LIMITS.minQuestions || questions.length > SP_LIMITS.maxQuestions) throw spErr(`Write ${SP_LIMITS.minQuestions} to ${SP_LIMITS.maxQuestions} questions`);
  const starters = list(spec.starters, SP_LIMITS.starter).slice(0, SP_LIMITS.starters);
  const note = String(spec.note ?? '').trim().slice(0, SP_LIMITS.note);
  const old = subjectPromptFor(c ? { classId: c.id } : { lineId });
  const inClass = c ? new Set(nowIn(c.id) || []) : null;
  const examples = [], fresh = [];
  for (const x of [].concat(spec.examples || [])) {
    if (examples.length >= SP_LIMITS.examples) break;
    if (x?.keep) { const was = old?.examples.find((o) => o.id === x.keep); if (was && !examples.some((o) => o.id === was.id)) examples.push({ ...was }); continue; }
    if (x?.eventId) {
      const e = getEvent(x.eventId);
      if (!exampleOk(e, lineId)) throw spErr('An example has to be a publishable moment on this line');
      if (inClass && !inClass.has(e.studentId)) throw spErr('An example has to be from a student in this class');
      if (examples.some((o) => o.eventId === e.id)) continue;
      const was = old?.examples.find((o) => o.eventId === e.id);
      const ex = was ? { ...was } : { id: uid('spx-'), eventId: e.id, studentId: e.studentId, status: 'asked', askedAt: nowIso() };
      if (!was) fresh.push(e);
      examples.push(ex);
      continue;
    }
    const title = one(x?.title, 120), text = String(x?.text ?? '').trim().slice(0, 1000);
    if (title || text) examples.push({ id: uid('spx-'), title, text, status: 'teacher' });
  }
  const p = old || { id: uid('sp-'), lineId, classId: c?.id || null };
  Object.assign(p, { by: by || null, at: nowIso(), note, questions, starters, examples });
  if (!old) sPrompts().push(p);
  const t = by && teacherById[by];
  for (const e of fresh) notify(toStudent(e.studentId), `${t?.name || 'Your teacher'} would like to show your moment “${e.title}” to other students as an example. Your name is not shown.`, { persona: toStudent(e.studentId), screen: 'map' });
  emit();
  return p;
}
// Back to the line's prompts (a class) or the built-in ones (a line). Moments written with them keep their promptId.
export function clearSubjectPrompts(promptId) {
  if (!getSubjectPrompt(promptId)) throw spErr('No such prompts', 404);
  store.subjectPrompts = sPrompts().filter((x) => x.id !== promptId);
  emit();
  return true;
}
// A student says yes or no to their moment being an example (and can change their mind later).
export function answerExampleAsk(promptId, exampleId, studentId, yes) {
  const p = getSubjectPrompt(promptId), x = p?.examples.find((o) => o.id === exampleId);
  if (!x || x.studentId !== studentId) throw spErr('This is not your moment', 404);
  x.status = yes ? 'yes' : 'no'; x.answeredAt = nowIso();
  const s = getStudent(studentId);
  if (p.by && s) notify(toTeacher(p.by), `${s.name.split(' ')[0]} said ${yes ? 'yes' : 'no'} to showing “${getEvent(x.eventId)?.title || 'their moment'}” as an example`, { persona: toTeacher(p.by), screen: p.classId ? 'classes' : 'prompts', ...(p.classId ? { param: p.classId } : {}) });
  emit();
  return x;
}
// ── CAS experiences and hours, Years 12 and 13 (src/components/Cas.jsx, src/screens/CasDashboard.jsx, server/routes/47-cas.mjs) ──
// An experience is a station on the CAS line (type 'cas', e.cas: { strand, outcomes, from, to }), so the map and the
// coordinator's grid read it as before. Hours are entries in store.casHours: { id, studentId, eventId, date, hours, note,
// supervisor: { kind: 'staff', teacherId } | { kind: 'outside', name, email } | null, status: pending | confirmed | returned,
// at, decided?: { via: supervisor | coordinator | code, by, name, at, comment }, code?: { hash, expires } }. A staff supervisor
// confirms from "CAS to confirm"; an outside one (no account, never emailed) with a one-time code the student shows; a CAS
// coordinator (role coordinator, or a teacher marked on Accounts: teacher.casCoordinator) on anyone's behalf.
export const CAS_STRANDS = { C: 'Creativity', A: 'Activity', S: 'Service' };
export const CAS_OUTCOMES = ['Strengths and growth', 'New challenges', 'Initiative and planning', 'Commitment', 'Collaboration', 'Global engagement', 'Ethics of choices'];
export const CAS_LINE = 'cas';
export const CAS_QUIET_DAYS = 42;
export const CAS_CODE_DAYS = 30;
export const CAS_MAX_HOURS = 24;
export const CAS_FLAGS = { nothing: 'Nothing logged yet', service: 'No Service yet', outcome: 'Outcome missing', reflection: 'No reflection in 6 weeks' };
const casErr = (m, status = 400) => Object.assign(new Error(m), { status });
const CAS_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAS_VIS = ['advisor', 'school', 'publishable'];
export const casHoursText = (n) => `${n} hour${n === 1 ? '' : 's'}`;
export const casAllowed = (sid) => { const s = getStudent(sid); return !!s && !s.cohortOnly && s.grade >= 11; };
export const isCasCoordinator = (p) => !!p && (p.kind === 'coordinator' || !!(p.teacherId && getTeacher(p.teacherId)?.casCoordinator));
export const getCasHours = () => store.casHours || [];
export const getCasEntry = (id) => getCasHours().find((x) => x.id === id) || null;
export const casHoursOf = (sid, eventId) => getCasHours().filter((x) => x.studentId === sid && (!eventId || x.eventId === eventId));
export const casExperiences = (sid) => store.events.filter((e) => e.studentId === sid && e.cas).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
export const casToConfirm = (tid) => getCasHours().filter((x) => x.supervisor?.kind === 'staff' && x.supervisor.teacherId === tid);
export const casSum = (list, status) => list.filter((x) => !status || x.status === status).reduce((n, x) => n + x.hours, 0);
export const casSupervisorName = (sup) => (sup?.kind === 'staff' ? getTeacher(sup.teacherId)?.name || 'A member of staff' : sup?.kind === 'outside' ? sup.name : '');
// What an entry is about. A supervisor's record holds only the entries naming them, so server/scope.mjs adds `about`.
export function casAbout(x) {
  const s = getStudent(x.studentId), e = getEvent(x.eventId);
  return { name: s?.name || x.about?.name || 'A student', year: s ? s.grade + 1 : x.about?.year ?? null, title: e?.title || x.about?.title || 'A CAS experience', strand: e?.cas?.strand || x.about?.strand || null };
}
const casDay = (d, what) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || Number.isNaN(Date.parse(d))) throw casErr(`Give the ${what}`); return d; };
function casSupervisor(sup) {
  if (!sup || !sup.kind || sup.kind === 'none') return null;
  if (sup.kind === 'staff') { if (!getTeacher(sup.teacherId)) throw casErr('Pick the member of staff who supervised'); return { kind: 'staff', teacherId: sup.teacherId }; }
  if (sup.kind !== 'outside') throw casErr('Pick who supervised');
  const name = String(sup.name || '').trim().slice(0, 80), email = String(sup.email || '').trim().toLowerCase().slice(0, 120);
  if (!name) throw casErr('Give the supervisor’s name');
  if (!CAS_EMAIL.test(email)) throw casErr('Give the supervisor’s email address');
  return { kind: 'outside', name, email };
}
function casHoursIn(h) {
  const hours = Math.round(Number(h?.hours) * 4) / 4;
  if (!(hours > 0) || hours > CAS_MAX_HOURS) throw casErr(`Hours must be more than 0 and at most ${CAS_MAX_HOURS} in one go`);
  const date = casDay(h.date, 'date of the hours');
  if (date > TODAY) throw casErr('Hours cannot be in the future');
  return { date, hours, note: String(h.note || '').trim().slice(0, 500), supervisor: casSupervisor(h.supervisor) };
}
function casEntry(s, e, h) {
  const x = { id: uid('ch-'), studentId: s.id, eventId: e.id, ...h, status: 'pending', at: nowIso() };
  (store.casHours ||= []).push(x);
  const sup = h.supervisor;
  log(s.id, s.name, 'station', `Logged ${casHoursText(h.hours)} of CAS on “${e.title}”${sup?.kind === 'staff' ? `, asked ${casSupervisorName(sup)} to confirm` : sup ? ', for an outside supervisor to confirm' : ''}`);
  if (sup?.kind === 'staff') notify(toTeacher(sup.teacherId), `${s.name.split(' ')[0]} asked you to confirm ${casHoursText(h.hours)} of CAS: “${e.title}”`, { persona: toTeacher(sup.teacherId), screen: 'casconfirm' });
  return x;
}
// The CAS line: one school line, made the first time anyone logs an experience, and put on that student's map.
function casLane(s) {
  if (!lineById(CAS_LINE)) store.lines.push({ id: CAS_LINE, name: 'CAS', colour: '#008A60', parentLineId: null, status: 'active', pattern: 'cased', code: 'CAS' });
  if (!s.laneOrder.includes(CAS_LINE)) s.laneOrder.push(CAS_LINE);
}
export function logCasExperience(studentId, f = {}) {
  const s = getStudent(studentId);
  if (!casAllowed(studentId)) throw casErr('CAS is for Years 12 and 13');
  const title = String(f.title || '').trim().slice(0, 120);
  if (!title) throw casErr('Give the experience a name');
  if (!CAS_STRANDS[f.strand]) throw casErr('Pick Creativity, Activity or Service');
  const from = casDay(f.from, 'start date');
  const to = f.to ? casDay(f.to, 'end date') : null;
  if (to && to < from) throw casErr('The end date is before the start date');
  const outcomes = [...new Set((Array.isArray(f.outcomes) ? f.outcomes : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b);
  const hours = f.hours ? casHoursIn(f.hours) : null;
  const evidence = (Array.isArray(f.evidence) ? f.evidence : []).filter((x) => x && typeof x.url === 'string' && x.url).slice(0, 10)
    .map((x) => ({ kind: ['image', 'file', 'link'].includes(x.kind) ? x.kind : 'link', url: x.url.slice(0, 2000), caption: String(x.caption || x.name || 'Evidence').slice(0, 120), ...(x.name ? { name: String(x.name).slice(0, 200) } : {}), ...(x.size ? { size: Number(x.size) || 0 } : {}), ...(x.type ? { type: String(x.type).slice(0, 100) } : {}) }));
  casLane(s);
  const e = addStation(studentId, { title, date: from, lineIds: [CAS_LINE], type: 'cas', summary: String(f.summary || '').trim().slice(0, 1000), evidence,
    visibility: CAS_VIS.includes(f.visibility) ? f.visibility : 'advisor', via: 'CAS log', cas: { strand: f.strand, outcomes, from, to } });
  const text = String(f.reflection || '').trim().slice(0, 4000);
  if (text) store.reflections.push({ id: uid('rf-x'), eventId: e.id, text, prompt: 'CAS reflection', date: TODAY, visibility: e.visibility });
  const entry = hours ? casEntry(s, e, hours) : null;
  emit();
  return { event: e, entry };
}
// More hours on an experience: any station of theirs marked for CAS (the CAS log, or "Counts for CAS?" on a station).
export function logCasHours(studentId, eventId, h = {}) {
  const s = getStudent(studentId), e = getEvent(eventId);
  if (!s || !e || e.studentId !== studentId || !e.cas) throw casErr('Pick one of your CAS experiences');
  if (!casAllowed(studentId)) throw casErr('CAS is for Years 12 and 13');
  const x = casEntry(s, e, casHoursIn(h));
  emit();
  return x;
}
export function withdrawCasHours(entryId, studentId) {
  const x = getCasEntry(entryId);
  if (!x || x.studentId !== studentId) throw casErr('No such hours');
  if (x.status === 'confirmed') throw casErr('Confirmed hours stay. Ask your CAS coordinator to change them.');
  store.casHours = getCasHours().filter((y) => y.id !== entryId);
  log(studentId, getStudent(studentId)?.name || '', 'station', `Took back ${casHoursText(x.hours)} of CAS on “${casAbout(x).title}”`);
  emit();
}
// Confirming or sending back: the staff supervisor ('supervisor'), a CAS coordinator for anyone ('coordinator'), or an
// outside supervisor through their one-time code (server only, 'code'; by is null, name is theirs).
function casDecide(entryId, by, opts, status) {
  const x = getCasEntry(entryId);
  if (!x) throw casErr('No such hours', 404);
  if (x.status !== 'pending') throw casErr('These hours have already been answered', 409);
  const via = ['supervisor', 'coordinator', 'code'].includes(opts?.via) ? opts.via : 'supervisor';
  const comment = String(opts?.comment || '').trim().slice(0, 500);
  if (status === 'returned' && via !== 'code' && !comment) throw casErr('Say what is not right, so the student can fix it');
  const name = via === 'code' ? String(opts?.name || casSupervisorName(x.supervisor) || 'The supervisor').slice(0, 80) : getTeacher(by)?.name || 'Pilot admin';
  x.status = status;
  x.decided = { via, by: by || null, name, at: nowIso(), ...(comment ? { comment } : {}) };
  delete x.code;
  const a = casAbout(x), sup = x.supervisor && via === 'coordinator' ? ` for ${casSupervisorName(x.supervisor)}` : '';
  const what = status === 'confirmed' ? `confirmed${sup} your ${casHoursText(x.hours)} of CAS on “${a.title}”` : `sent back your ${casHoursText(x.hours)} of CAS on “${a.title}”${comment ? `: ${comment}` : ''}`;
  notify(toStudent(x.studentId), `${shortName(name)} ${what}`, { persona: toStudent(x.studentId), screen: 'cas' });
  log(x.studentId, name, status === 'confirmed' ? 'endorse' : 'request', `${status === 'confirmed' ? 'Confirmed' : 'Sent back'} ${casHoursText(x.hours)} of CAS on “${a.title}”${via === 'code' ? ' (outside supervisor, by code)' : via === 'coordinator' ? ' (CAS coordinator)' : ''}`);
  emit();
  return x;
}
export function confirmCasHours(entryId, by, opts = {}) { return casDecide(entryId, by, opts, 'confirmed'); }
export function returnCasHours(entryId, by, opts = {}) { return casDecide(entryId, by, opts, 'returned'); }
// The server makes the code and keeps only its hash here (POST /api/cas/code); a new code replaces the old one, null ends it.
export function setCasCode(entryId, hash, expires) {
  const x = getCasEntry(entryId);
  if (!x || x.status !== 'pending' || x.supervisor?.kind !== 'outside') throw casErr('A code is only for hours waiting for an outside supervisor');
  if (hash) x.code = { hash: String(hash), expires: String(expires) }; else delete x.code;
  emit();
}
export const casByCode = (hash) => getCasHours().find((x) => x.code?.hash === hash && x.status === 'pending' && x.code.expires >= TODAY) || null;
export function setCasCoordinator(teacherId, on) {
  const t = getTeacher(teacherId);
  if (!t) throw casErr('No such member of staff');
  if (on) t.casCoordinator = true; else delete t.casCoordinator;
  emit();
}
export const casCoordinators = () => getTeachers().filter((t) => t.casCoordinator);
// The coordinator's cohort, Years 12 and 13: strands, the seven outcomes, hours confirmed and waiting, and flags.
export function casCohort({ advisorId = '' } = {}) {
  const since = daysBefore(CAS_QUIET_DAYS);
  return getStudents({ includeCohort: true }).filter((s) => s.grade >= 11 && (!advisorId || s.advisorId === advisorId)).sort((a, b) => a.name.localeCompare(b.name)).map((s) => {
    const ex = store.events.filter((e) => e.studentId === s.id && e.cas);
    const ids = new Set(ex.map((e) => e.id));
    const strands = Object.fromEntries(Object.keys(CAS_STRANDS).map((k) => [k, ex.filter((e) => e.cas.strand === k)]));
    const outcomes = CAS_OUTCOMES.map((_, i) => ex.filter((e) => (e.cas.outcomes || []).includes(i + 1)));
    const hrs = casHoursOf(s.id);
    const lastReflection = store.reflections.filter((r) => ids.has(r.eventId)).map((r) => r.date).sort().at(-1) || null;
    const flags = !ex.length && !hrs.length ? ['nothing'] : [!strands.S.length && 'service', outcomes.some((l) => !l.length) && 'outcome', !(lastReflection && lastReflection >= since) && 'reflection'].filter(Boolean);
    return { student: s, experiences: ex, strands, outcomes, covered: outcomes.filter((l) => l.length).length, hours: hrs, confirmed: casSum(hrs, 'confirmed'), pending: casSum(hrs, 'pending'), lastReflection, flags };
  });
}

// ── Shared record: with the pilot server, every change is replayed there ──
// A screen calls a change below; it runs here at once (instant UI) while recording the ids and
// times it made. The hook (src/sync.js) posts { fn, args, rec } to /api/action, and the server runs
// the same function with the same values (runAction), so both copies end identical, ids and all.
// Only the outermost call is sent: changes that call other changes (addBranch → addStation) replay whole.
let hook = null, depth = 0, changeNo = 0, guard = null;
export const setActionHook = (fn) => { hook = fn; };
export const changeCount = () => changeNo; // outermost changes made in this page so far
const ACTIONS = {};
const act = (name, fn) => {
  ACTIONS[name] = fn;
  return (...args) => {
    if (depth) return fn(...args);
    if (guard?.(name, args)) return undefined; // admin "See as" preview: refused before it runs (setActionGuard)
    const rec = tape = []; depth++;
    let out;
    try { out = fn(...args); } finally { depth--; tape = null; }
    changeNo++; hook?.(name, args, rec);
    return out;
  };
};
// The server side: run a change by name, handing back the recorded values in order.
export function runAction(name, args = [], rec = []) {
  if (!Object.hasOwn(ACTIONS, name)) throw Object.assign(new Error(`Not a change: ${name}`), { status: 400 });
  depth++; replay = [...rec];
  try { return ACTIONS[name](...args); } finally { depth--; replay = null; }
}
// Every change a screen may make. This is the server's allowlist too.
setStudentDrafts = act('setStudentDrafts', setStudentDrafts); sync = act('sync', sync); acceptCandidate = act('acceptCandidate', acceptCandidate);
dismissCandidate = act('dismissCandidate', dismissCandidate); restoreCandidate = act('restoreCandidate', restoreCandidate); mergeCandidate = act('mergeCandidate', mergeCandidate);
setGithub = act('setGithub', setGithub); disconnectGithub = act('disconnectGithub', disconnectGithub); simulateWeek = act('simulateWeek', simulateWeek);
setCasProject = act('setCasProject', setCasProject); casNudge = act('casNudge', casNudge); saveLetter = act('saveLetter', saveLetter); setLetterStatus = act('setLetterStatus', setLetterStatus);
matchRoster = act('matchRoster', matchRoster); setRollout = act('setRollout', setRollout); addAlumStation = act('addAlumStation', addAlumStation);
addLog = act('addLog', addLog); addNotification = act('addNotification', addNotification); markNotificationsRead = act('markNotificationsRead', markNotificationsRead); clearReadNotifications = act('clearReadNotifications', clearReadNotifications);
addReflection = act('addReflection', addReflection); addStation = act('addStation', addStation); requestEndorsement = act('requestEndorsement', requestEndorsement);
endorse = act('endorse', endorse); declineRequest = act('declineRequest', declineRequest); addNote = act('addNote', addNote); sendPrompt = act('sendPrompt', sendPrompt);
recordView = act('recordView', recordView); logLink = act('logLink', logLink);
addBranch = act('addBranch', addBranch); endLine = act('endLine', endLine); restartLine = act('restartLine', restartLine); renameLine = act('renameLine', renameLine);
decideBranch = act('decideBranch', decideBranch); addSchoolLine = act('addSchoolLine', addSchoolLine);
completeOnboarding = act('completeOnboarding', completeOnboarding); capturePhone = act('capturePhone', capturePhone);
setVisibility = act('setVisibility', setVisibility); setPrivacy = act('setPrivacy', setPrivacy); setIntensity = act('setIntensity', setIntensity); setTags = act('setTags', setTags);
nudgeMilestone = act('nudgeMilestone', nudgeMilestone); markMilestone = act('markMilestone', markMilestone); saveActivityList = act('saveActivityList', saveActivityList);
addGoal = act('addGoal', addGoal); completeGoal = act('completeGoal', completeGoal); acceptInterchange = act('acceptInterchange', acceptInterchange); ignoreInterchange = act('ignoreInterchange', ignoreInterchange);
addComment = act('addComment', addComment); resolveComment = act('resolveComment', resolveComment); askEvidence = act('askEvidence', askEvidence); answerEvidence = act('answerEvidence', answerEvidence);
answerSponsor = act('answerSponsor', answerSponsor); addCheckIn = act('addCheckIn', addCheckIn);
editStation = act('editStation', editStation); deleteStation = act('deleteStation', deleteStation); resubmit = act('resubmit', resubmit);
answerConsent = act('answerConsent', answerConsent); remindParent = act('remindParent', remindParent); setLang = act('setLang', setLang); setFamily = act('setFamily', setFamily);
endorseClassTask = act('endorseClassTask', endorseClassTask);
importCandidates = act('importCandidates', importCandidates); eraseStudent = act('eraseStudent', eraseStudent); importRoster = act('importRoster', importRoster); addStudent = act('addStudent', addStudent); addTeacher = act('addTeacher', addTeacher);
setSubjectLine = act('setSubjectLine', setSubjectLine);
askClass = act('askClass', askClass); remindClass = act('remindClass', remindClass); answerPrompt = act('answerPrompt', answerPrompt); skipPrompt = act('skipPrompt', skipPrompt);
nudgeStudent = act('nudgeStudent', nudgeStudent);
setTask = act('setTask', setTask); editTask = act('editTask', editTask); extendTask = act('extendTask', extendTask); handInTask = act('handInTask', handInTask); remindDueTasks = act('remindDueTasks', remindDueTasks);
addMomentComment = act('addMomentComment', addMomentComment); editMomentComment = act('editMomentComment', editMomentComment); deleteMomentComment = act('deleteMomentComment', deleteMomentComment); markCommentsRead = act('markCommentsRead', markCommentsRead);
reportItem = act('reportItem', reportItem); moderateReport = act('moderateReport', moderateReport);
spotMoment = act('spotMoment', spotMoment); acceptSpotted = act('acceptSpotted', acceptSpotted); declineSpotted = act('declineSpotted', declineSpotted);
setHandoverNote = act('setHandoverNote', setHandoverNote); carryOverGoal = act('carryOverGoal', carryOverGoal); closeGoal = act('closeGoal', closeGoal);
setPeerFeedback = act('setPeerFeedback', setPeerFeedback); givePeerFeedback = act('givePeerFeedback', givePeerFeedback); thankPeerFeedback = act('thankPeerFeedback', thankPeerFeedback); hidePeerFeedback = act('hidePeerFeedback', hidePeerFeedback); setPeerFeedbackYear = act('setPeerFeedbackYear', setPeerFeedbackYear);
openReflectionWindow = act('openReflectionWindow', openReflectionWindow); closeReflectionWindow = act('closeReflectionWindow', closeReflectionWindow); saveTermReflection = act('saveTermReflection', saveTermReflection); finishTermReflection = act('finishTermReflection', finishTermReflection);
markMilestonesSeen = act('markMilestonesSeen', markMilestonesSeen);
createExhibition = act('createExhibition', createExhibition); removeExhibitionSlide = act('removeExhibitionSlide', removeExhibitionSlide); pauseExhibition = act('pauseExhibition', pauseExhibition); revokeExhibition = act('revokeExhibition', revokeExhibition);
saveLeaver = act('saveLeaver', saveLeaver); shareLeaver = act('shareLeaver', shareLeaver); revokeLeaver = act('revokeLeaver', revokeLeaver); commentLeaver = act('commentLeaver', commentLeaver); doneLeaverComment = act('doneLeaverComment', doneLeaverComment);
checkInGoal = act('checkInGoal', checkInGoal); snoozeCheckins = act('snoozeCheckins', snoozeCheckins); sendEncouragement = act('sendEncouragement', sendEncouragement);
openConferenceRound = act('openConferenceRound', openConferenceRound); editConferenceRound = act('editConferenceRound', editConferenceRound); closeConferenceRound = act('closeConferenceRound', closeConferenceRound); bookConference = act('bookConference', bookConference); cancelConference = act('cancelConference', cancelConference); blockConferenceSlot = act('blockConferenceSlot', blockConferenceSlot); sendConferenceReminders = act('sendConferenceReminders', sendConferenceReminders);
setSubjectPrompts = act('setSubjectPrompts', setSubjectPrompts); clearSubjectPrompts = act('clearSubjectPrompts', clearSubjectPrompts); answerExampleAsk = act('answerExampleAsk', answerExampleAsk);
logCasExperience = act('logCasExperience', logCasExperience); logCasHours = act('logCasHours', logCasHours); withdrawCasHours = act('withdrawCasHours', withdrawCasHours); confirmCasHours = act('confirmCasHours', confirmCasHours); returnCasHours = act('returnCasHours', returnCasHours); setCasCode = act('setCasCode', setCasCode); setCasCoordinator = act('setCasCoordinator', setCasCoordinator);
addSchoolEvent = act('addSchoolEvent', addSchoolEvent); editSchoolEvent = act('editSchoolEvent', editSchoolEvent); removeSchoolEvent = act('removeSchoolEvent', removeSchoolEvent); importSchoolEvents = act('importSchoolEvents', importSchoolEvents); dismissSchoolEvent = act('dismissSchoolEvent', dismissSchoolEvent); remindSchoolEvent = act('remindSchoolEvent', remindSchoolEvent);
// Undo puts a whole earlier copy back, and reset goes back to the seed (sync.js sends it to /api/reset).
restore = act('restore', restore); resetDemo = act('resetDemo', resetDemo);
export const MUTATORS = Object.keys(ACTIONS);

// Admin "See as" (src/preview.js): another account's copy of the record, shown read-only. Never saved in this
// browser, never takes another tab's save, and every change is offered to the guard first (true: refused, not run).
export const setActionGuard = (fn) => { guard = fn; };
export function loadPreview(snap) { previewOnly = true; clearTimeout(saveTimer); apply(snap); }

// ── Thai for students (src/thai.js): every piece of text in the record, so Thai shown at display time never replaces
// someone's own words that happen to match an interface string. Machine fields and the app's own messages (activity,
// notifications) are left out, and so is `prompt` (the questions answered, mostly the app's own wording).
const NOT_WORDS = new Set(['activity', 'notifications', 'linkViews', 'rosterImport', 'answered', 'intensity', 'family']);
const NOT_WORD_KEYS = new Set(['id', 'type', 'kind', 'status', 'verification', 'visibility', 'role', 'audience', 'theme', 'layout', 'tier', 'prompt', 'phrase', 'url', 'token', 'date', 'at', 'ts', 'colour']);
export function recordWords() {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { const s = v.trim(); if (s && /[A-Za-z]/.test(s)) out.add(s); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const k in v) if (!NOT_WORD_KEYS.has(k)) walk(v[k]);
  };
  for (const k in store) if (!NOT_WORDS.has(k)) walk(store[k]);
  return out;
}
