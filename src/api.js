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
  notify(toStudent(sid), `${by}: ${text}`, { persona: toStudent(sid), screen: 'map' });
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
export function notify(to, text, go) { if (!to) return; store.notifications.unshift({ id: uid('nt-'), to, text, go, ts: nowIso(), read: false }); }
export function log(studentId, actor, kind, text) { store.activity.unshift({ id: uid('ac-'), studentId, actor, kind, text, ts: nowIso() }); }
// The same two, as changes a screen can make on its own.
export function addLog(studentId, actor, kind, text) { log(studentId, actor, kind, text); emit(); }
export function addNotification(to, text, go) { notify(to, text, go); emit(); }
// `keys`: one recipient key or a list of them (notifyKeys(persona)).
const keySet = (keys) => new Set([].concat(keys || []));
export const getNotifications = (keys) => { const k = keySet(keys); return store.notifications.filter((n) => k.has(n.to)); };
export function markNotificationsRead(keys) { const k = keySet(keys); store.notifications.forEach((n) => { if (k.has(n.to)) n.read = true; }); emit(); }

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
  };
  store.events.push(e);
  if (f.reflection) store.reflections.push({ id: uid('rf-x'), eventId: e.id, text: f.reflection, prompt: 'Quick reflection', date: e.date, visibility: f.visibility || 'advisor' });
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
  notify(toTeacher(teacherId), `${name.split(' ')[0]} asked you to endorse “${e.title}”`, { persona: toTeacher(teacherId), screen: 'queue' });
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
export function nudgeStudent(studentId, advisorId, text) {
  const s = getStudent(studentId), t = teacherById[advisorId];
  if (!s || !t) throw Object.assign(new Error('No such student or advisor.'), { status: 400 });
  if (!canNudge(studentId)) throw Object.assign(new Error(`${s.name.split(' ')[0]} was nudged in the last ${NUDGE_GAP} days.`), { status: 409 });
  const msg = String(text ?? '').trim().slice(0, 500) || NUDGE_TEXT;
  const n = { id: uid('nu-'), studentId, from: advisorId, text: msg, date: TODAY, ts: nowIso() };
  (store.nudges ||= []).push(n);
  notify(toStudent(studentId), `${shortName(t.name)}: ${msg}`, { persona: toStudent(studentId), screen: 'map', param: 'add' });
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
addLog = act('addLog', addLog); addNotification = act('addNotification', addNotification); markNotificationsRead = act('markNotificationsRead', markNotificationsRead);
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
addMomentComment = act('addMomentComment', addMomentComment); editMomentComment = act('editMomentComment', editMomentComment); deleteMomentComment = act('deleteMomentComment', deleteMomentComment); markCommentsRead = act('markCommentsRead', markCommentsRead);
reportItem = act('reportItem', reportItem); moderateReport = act('moderateReport', moderateReport);
setHandoverNote = act('setHandoverNote', setHandoverNote); carryOverGoal = act('carryOverGoal', carryOverGoal); closeGoal = act('closeGoal', closeGoal);
// Undo puts a whole earlier copy back, and reset goes back to the seed (sync.js sends it to /api/reset).
restore = act('restore', restore); resetDemo = act('resetDemo', resetDemo);
export const MUTATORS = Object.keys(ACTIONS);

// Admin "See as" (src/preview.js): another account's copy of the record, shown read-only. Never saved in this
// browser, never takes another tab's save, and every change is offered to the guard first (true: refused, not run).
export const setActionGuard = (fn) => { guard = fn; };
export function loadPreview(snap) { previewOnly = true; clearTimeout(saveTimer); apply(snap); }
