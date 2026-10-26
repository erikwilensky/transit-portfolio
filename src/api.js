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

export const TODAY = '2026-10-26';

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
};
const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn());

const lineById = (id) => store.lines.find((l) => l.id === id);
const teacherById = Object.fromEntries(teachersData.map((t) => [t.id, t]));

export const getStudents = ({ includeCohort = false } = {}) => store.students.filter((s) => includeCohort || !s.cohortOnly);
export const getStudent = (id) => store.students.find((s) => s.id === id);
export const getTeacher = (id) => teacherById[id];
export const getTeachers = () => teachersData;
export const getLine = (id) => lineById(id);
export const getSchoolLines = () => store.lines.filter((l) => !l.studentId);
export const getAllLines = () => store.lines;
export const getEvent = (id) => store.events.find((e) => e.id === id);
export const getStore = () => store;

// The visibility levels each viewer may read. Enforced here, not in the UI.
const VISIBLE_TO = {
  student: ['private', 'advisor', 'school', 'publishable'],
  advisor: ['advisor', 'school', 'publishable'],
  school: ['school', 'publishable'],
  public: ['publishable'],
};

export function getStudentMap(studentId, viewer = 'student') {
  const student = getStudent(studentId);
  const allowed = VISIBLE_TO[viewer];
  const events = store.events
    .filter((e) => e.studentId === studentId && allowed.includes(e.visibility))
    .map((e) => ({
      ...e,
      // Reflections carry their own visibility (private by default).
      reflections: store.reflections.filter((r) => r.eventId === e.id && allowed.includes(r.visibility || 'private')),
      endorsements: store.endorsements.filter((n) => n.eventId === e.id).map((n) => ({ ...n, teacher: teacherById[n.teacherId] })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lines = student.laneOrder.map((id) => { const l = lineById(id); return { ...l, name: student.lineLabels?.[id] || l.name, status: student.lineStatus?.[id] || l.status }; })
    .filter((l) => viewer === 'student' || l.status !== 'ended' || events.some((e) => e.lineIds.includes(l.id)));
  return { student, lines, events, signals: viewer === 'student' || viewer === 'advisor' ? getSignals(studentId, lines) : [] };
}

export const getPresentations = (studentId) => presentationsData.filter((p) => p.studentId === studentId);
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
  ...i, pendingForStudent: store.pending.filter((p) => p.sourceId === i.id && p.event.studentId === studentId).length,
}));

// Sync pulls new items into the student's inbox. Nothing reaches the map
// until the student accepts it and chooses its line(s).
export function sync(sourceIds, studentId) {
  const now = new Date().toISOString();
  const arrived = [];
  store.pending = store.pending.filter((p) => {
    if (sourceIds.includes(p.sourceId) && p.event.studentId === studentId) { arrived.push({ ...p.event, sourceId: p.sourceId, suggestedLineIds: p.event.lineIds }); return false; }
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
  const { sourceId, suggestedLineIds, ...event } = c;
  const added = { ...event, lineIds, visibility };
  store.events.push(added);
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

// ── Advisor ───────────────────────────────────────────────────────────
export function getCohort(advisorId) {
  return store.students.filter((s) => s.advisorId === advisorId).map((s) => {
    const map = getStudentMap(s.id, 'advisor');
    const reflectionCount = map.events.filter((e) => e.type === 'reflection').length + map.events.reduce((n, e) => n + e.reflections.length, 0);
    const last = map.events.filter((e) => e.date <= TODAY).at(-1);
    const openSignals = map.signals.filter((g) => g.open).length;
    return { ...map, reflectionCount, openSignals, lastActivity: last?.date, flagFewReflections: reflectionCount < 4 };
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
    if (l.status === 'ended') out.push({ key: `${studentId}:${l.id}:end`, kind: 'terminus', lineId: l.id, eventId: on.at(-1).id, prompt: `A line is ending. What did ${l.name} give you?`, open: !hasRefl(on.at(-1).id) && !store.answered[`${studentId}:${l.id}:end`] });
  }
  for (const p of store.prompts.filter((x) => x.studentId === studentId)) {
    out.push({ key: `prompt:${p.id}`, kind: 'prompt', promptId: p.id, eventId: p.eventId, prompt: p.text, from: teacherById[p.from], open: !p.answered, date: p.date });
  }
  return out;
}

// ── Personas: who receives notifications ──────────────────────────────
export const PERSONA_OF_STUDENT = { 'st-01': 'maya', 'st-02': 'arun', 'st-03': 'lena', 'st-09': 'pim' };
export const PERSONA_OF_TEACHER = { 't-07': 'whitfield', 't-01': 'nair', 't-09': 'adeyemi', 't-08': 'brandt', 't-10': 'principal' };
let seq = 1;
const nowIso = () => new Date().toISOString();
export function notify(to, text, go) { if (!to) return; store.notifications.unshift({ id: `nt-${seq++}`, to, text, go, ts: nowIso(), read: false }); }
export function log(studentId, actor, kind, text) { store.activity.unshift({ id: `ac-${seq++}`, studentId, actor, kind, text, ts: nowIso() }); }
export const getNotifications = (persona) => store.notifications.filter((n) => n.to === persona);
export function markNotificationsRead(persona) { store.notifications.forEach((n) => { if (n.to === persona) n.read = true; }); emit(); }

// ── Student actions ───────────────────────────────────────────────────
export function addReflection({ studentId, eventId, prompt, text, visibility = 'advisor', signal }) {
  const r = { id: `rf-x${seq++}`, eventId, text, prompt, date: TODAY, visibility };
  store.reflections.push(r);
  if (signal) {
    store.answered[signal.key] = r.id;
    if (signal.promptId) {
      const p = store.prompts.find((x) => x.id === signal.promptId);
      if (p) { p.answered = true; notify(PERSONA_OF_TEACHER[p.from], `${getStudent(studentId).name.split(' ')[0]} answered your reflection prompt`, { persona: PERSONA_OF_TEACHER[p.from], screen: 'student', param: studentId }); }
    }
  }
  log(studentId, getStudent(studentId).name, 'reflection', `Added a reflection on “${getEvent(eventId)?.title}” (${visibility})`);
  emit();
  return r;
}

let evSeq = 900;
export function addStation(studentId, f) {
  const e = {
    id: `ev-${evSeq++}`, studentId, title: f.title, date: f.date || TODAY, lineIds: f.lineIds, type: f.type || 'project', summary: f.summary || '',
    about: f.about || '', evidence: f.image ? [{ kind: 'image', url: f.image, caption: f.imageCaption || 'Photo' }] : [],
    verification: 'student-added', visibility: f.visibility || 'advisor', source: { system: f.via || 'Manual entry', ref: null },
    ...(f.cas ? { cas: f.cas } : {}),
  };
  store.events.push(e);
  if (f.reflection) store.reflections.push({ id: `rf-x${seq++}`, eventId: e.id, text: f.reflection, prompt: 'Quick reflection', date: e.date, visibility: f.visibility || 'advisor' });
  const who = getStudent(studentId).name;
  log(studentId, who, 'station', `Added “${e.title}”${f.via ? ` from ${f.via}` : ''}`);
  if (f.requestFrom) requestEndorsement(e.id, f.requestFrom, f.requestNote);
  emit();
  return e;
}
export function requestEndorsement(eventId, teacherId, note) {
  const e = getEvent(eventId);
  const rq = { id: `rq-x${seq++}`, eventId, studentId: e.studentId, teacherId, date: TODAY, source: 'student', note: note || null, status: 'pending', fresh: true };
  store.requests.unshift(rq);
  const name = getStudent(e.studentId).name;
  notify(PERSONA_OF_TEACHER[teacherId], `${name.split(' ')[0]} asked you to endorse “${e.title}”`, { persona: PERSONA_OF_TEACHER[teacherId], screen: 'queue' });
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
    store.endorsements.push({ id: `en-x${seq++}`, eventId: e.id, teacherId, note: note || 'Endorsed.', date: TODAY });
    e.verification = 'teacher-endorsed';
    const t = teacherById[teacherId];
    log(e.studentId, t.name, 'endorsement', `Endorsed “${e.title}”`);
    notify(PERSONA_OF_STUDENT[e.studentId], `${t.name} endorsed “${e.title}”`, { persona: PERSONA_OF_STUDENT[e.studentId], screen: 'map', param: e.id });
  }
  emit();
}
export function declineRequest(id, reason) {
  const r = store.requests.find((x) => x.id === id);
  if (!r) return;
  r.status = 'returned'; r.reason = reason;
  notify(PERSONA_OF_STUDENT[r.studentId], `${teacherById[r.teacherId].name} asked for more evidence on “${getEvent(r.eventId).title}”`, { persona: PERSONA_OF_STUDENT[r.studentId], screen: 'map', param: r.eventId });
  emit();
}

// ── Advisor actions ───────────────────────────────────────────────────
export const getNotes = (studentId) => store.notes[studentId] || [];
export function addNote(studentId, text) { (store.notes[studentId] ||= []).push({ date: TODAY, text }); emit(); }
export const getPrompts = (studentId) => store.prompts.filter((p) => p.studentId === studentId);
export function sendPrompt(studentId, eventId, text, from = 't-07') {
  const p = { id: `pm-x${seq++}`, studentId, eventId, from, date: TODAY, text, answered: false };
  store.prompts.push(p);
  notify(PERSONA_OF_STUDENT[studentId], `${teacherById[from].name} sent you a reflection prompt`, { persona: PERSONA_OF_STUDENT[studentId], screen: 'map', param: eventId });
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
