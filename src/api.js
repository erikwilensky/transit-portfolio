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
const emit = () => { listeners.forEach((fn) => fn()); persist(); };

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
      tags: getTags(e),
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
  ...i, pendingForStudent: store.pending.filter((p) => p.sourceId === i.id && p.event.studentId === studentId && ghAllowed(p)).length,
}));

// Sync pulls new items into the student's inbox. Nothing reaches the map
// until the student accepts it and chooses its line(s).
export function sync(sourceIds, studentId) {
  const now = new Date().toISOString();
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
  if (classEndorsement) store.endorsements.push({ id: `en-x${seq++}`, eventId: added.id, teacherId: classEndorsement.teacherId, note: classEndorsement.note, date: classEndorsement.date, live: true });
  if (quickReflection) store.reflections.push({ id: `rf-x${seq++}`, eventId: added.id, text: quickReflection, prompt: 'Quick reflection', date: added.date, visibility: 'advisor' });
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
  if (was !== status) notify(PERSONA_OF_STUDENT[sid], `${by} marked your CAS project as ${status.toLowerCase()}`, { persona: PERSONA_OF_STUDENT[sid], screen: 'map' });
  emit();
}
export const getCasNudges = (sid) => store.casNudges.filter((n) => n.studentId === sid);
export function casNudge(sid, about, text, by) {
  store.casNudges.push({ id: `cn-${seq++}`, studentId: sid, about, text, by, date: TODAY });
  notify(PERSONA_OF_STUDENT[sid], `${by}: ${text}`, { persona: PERSONA_OF_STUDENT[sid], screen: 'map' });
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
  const e = after(`al-${Date.now().toString(36)}`, f.date, f.title, f.lineIds, f.type || 'project', f.summary || '', null, f.link ? [doc('link', f.link.replace(/^https?:\/\//, '').slice(0, 40), f.link)] : [], f.reflection ? ['What did this teach you?', f.reflection] : null);
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
    store.endorsements.push({ id: `en-x${seq++}`, eventId: e.id, teacherId, note: note || 'Endorsed.', date: TODAY, live: true });
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
  notify('brandt', `${s.name} asked for a new sub-line: “${name}” under ${lineById(parentLineId)?.name}`, { persona: 'brandt', screen: 'governance' });
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
  if (PERSONA_OF_TEACHER[adv]) notify(PERSONA_OF_TEACHER[adv], `${s.name.split(' ')[0]} ended the ${lineById(lineId)?.name} line`, { persona: PERSONA_OF_TEACHER[adv], screen: 'student', param: studentId });
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
export function completeOnboarding(studentId, lineIds, template) {
  const s = getStudent(studentId);
  s.laneOrder = [...lineIds];
  s.onboarding = false;
  s.template = template;
  lineIds.forEach((l, i) => {
    const st = STARTERS[l]; if (!st) return;
    const img = STARTER_IMG[st.img];
    store.events.push({ id: `ev-${evSeq++}`, studentId, title: st.title, date: `2026-08-${String(14 + i * 3).padStart(2, '0')}`, lineIds: [l], type: st.type, summary: st.summary,
      evidence: [...(img ? [{ kind: 'image', url: `evidence/${img}.svg`, caption: st.title }] : []), ...(st.ev || []).map(([kind, caption, url]) => ({ kind, caption, url: url || (kind === 'grade' ? null : '#') }))], verification: 'school-verified', visibility: 'advisor', source: st.source });
  });
  log(studentId, s.name, 'onboarding', `Picked ${lineIds.length} starter lines and the “${template}” template`);
  emit();
}

// A quick capture from the phone lands in the inbox, like any other import.
export function capturePhone(studentId, f) {
  const e = { id: `ev-${evSeq++}`, studentId, title: f.title, date: TODAY, lineIds: f.lineIds || [], type: f.type || 'project', summary: f.summary || '',
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
    else if (!e.id.startsWith('ev-9') && !e.wasGoal) hist.push({ ts: `${e.date}T18:30:00`, actor: s.name, kind: 'station', text: `Added “${e.title}”` });
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

// ── Whole-school reads (school viewer: school and publishable items only) ─
export const schoolEvents = () => store.events.filter((e) => VISIBLE_TO.school.includes(e.visibility) && e.type !== 'goal' && e.date <= TODAY);
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
export function decideBranch(id, ok, mergeInto) {
  const l = lineById(id); if (!l) return;
  if (ok) { l.approval = 'approved'; notify(PERSONA_OF_STUDENT[l.studentId], `Ms Brandt approved your new line “${l.name}”`, { persona: PERSONA_OF_STUDENT[l.studentId], screen: 'map' }); }
  else if (mergeInto) {
    const target = lineById(mergeInto);
    store.events.forEach((e) => { if (e.lineIds.includes(id)) e.lineIds = [...new Set(e.lineIds.map((x) => (x === id ? mergeInto : x)))]; });
    const s = getStudent(l.studentId); s.laneOrder = s.laneOrder.filter((x) => x !== id); if (!s.laneOrder.includes(mergeInto)) s.laneOrder.push(mergeInto);
    store.lines = store.lines.filter((x) => x.id !== id);
    notify(PERSONA_OF_STUDENT[l.studentId], `Your line “${l.name}” was merged into “${target.name}”`, { persona: PERSONA_OF_STUDENT[l.studentId], screen: 'map' });
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
export function nudgeMilestone(studentId, milestone) {
  (store.dpNudges ||= {})[`${studentId}:${milestone.id}`] = TODAY;
  const s = getStudent(studentId);
  notify(PERSONA_OF_STUDENT[studentId], `Ms Brandt: your ${milestone.part} ${milestone.name.toLowerCase()} was due ${milestone.due}. Can you upload it this week?`, { persona: PERSONA_OF_STUDENT[studentId], screen: 'map' });
  log(studentId, 'Ms Clara Brandt', 'prompt', `Reminded ${s.name.split(' ')[0]} about the ${milestone.part} ${milestone.name.toLowerCase()}`);
  emit();
}
export function markMilestone(studentId, id) { ((store.dpDone ||= {})[studentId] ||= {})[id] = TODAY; emit(); }

// ── Counsellor: activities list drafts (Common App style, 10 slots) ────
export const getActivityList = (studentId) => store.activityLists?.[studentId];
export function saveActivityList(studentId, list) { (store.activityLists ||= {})[studentId] = list; emit(); }

// ── Wave 4: goals, term in review, suggested interchanges ─────────────
// A goal is a dashed station with a target date. It turns solid when the student says it happened.
export function addGoal(studentId, f, by) {
  const e = { id: `ev-${evSeq++}`, studentId, title: f.title, date: f.date, lineIds: [f.lineId], type: 'goal', summary: f.summary || 'Planned goal.', about: '', evidence: [], verification: 'student-added', visibility: 'advisor', source: { system: 'Manual entry', ref: null }, checkIn: f.checkIn || null, setBy: by || null, ...(f.sponsor ? { sponsor: { teacherId: f.sponsor, status: 'invited', note: f.sponsorNote || '', expectations: '', checkIns: [], invitedOn: TODAY } } : {}) };
  store.events.push(e);
  const s = getStudent(studentId);
  log(studentId, by ? teacherById[by]?.name : s.name, 'goal', `Planned “${e.title}” for ${e.date}${f.checkIn ? ', with an advisor check-in' : ''}`);
  if (by && PERSONA_OF_STUDENT[studentId]) notify(PERSONA_OF_STUDENT[studentId], `${teacherById[by].name} added a goal you agreed together: “${e.title}”`, { persona: PERSONA_OF_STUDENT[studentId], screen: 'map', param: e.id });
  if (f.sponsor) notify(PERSONA_OF_TEACHER[f.sponsor], `${s.name.split(' ')[0]} invited you to sponsor a planned project: “${e.title}”`, { persona: PERSONA_OF_TEACHER[f.sponsor], screen: 'queue' });
  if (!by && f.checkIn && PERSONA_OF_TEACHER[s.advisorId]) notify(PERSONA_OF_TEACHER[s.advisorId], `${s.name.split(' ')[0]} set a goal and asked for a check-in: “${e.title}”`, { persona: PERSONA_OF_TEACHER[s.advisorId], screen: 'student', param: studentId });
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
  const c = { id: `cm-${seq++}`, presentationId, studentId, eventId: eventId || null, text, by, date: TODAY, resolved: false };
  store.comments.push(c);
  notify(PERSONA_OF_STUDENT[studentId], `${teacherById[by].name} commented on your draft`, { persona: PERSONA_OF_STUDENT[studentId], screen: 'studio' });
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
  const r = { id: `er-${seq++}`, eventId, studentId: e.studentId, from, text, date: TODAY, status: 'open' };
  store.evidenceRequests.unshift(r);
  notify(PERSONA_OF_STUDENT[e.studentId], `${from} asked to see more on “${e.title}”`, { persona: PERSONA_OF_STUDENT[e.studentId], screen: 'inbox' });
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
  notify(PERSONA_OF_STUDENT[e.studentId], ok ? `${t.name} will sponsor “${e.title}”` : `${t.name} can't sponsor “${e.title}”`, { persona: PERSONA_OF_STUDENT[e.studentId], screen: 'map', param: e.id });
  log(e.studentId, t.name, 'endorse', ok ? `Agreed to sponsor “${e.title}”` : `Declined to sponsor “${e.title}”`);
  emit();
}
export function addCheckIn(eventId, text, by) {
  const e = getEvent(eventId);
  e.sponsor.checkIns = [...e.sponsor.checkIns, { date: TODAY, text, by }];
  const who = by === 'student' ? getStudent(e.studentId).name : teacherById[by]?.name;
  if (by === 'student') notify(PERSONA_OF_TEACHER[e.sponsor.teacherId], `${who.split(' ')[0]} posted an update on “${e.title}”`, { persona: PERSONA_OF_TEACHER[e.sponsor.teacherId], screen: 'queue' });
  else notify(PERSONA_OF_STUDENT[e.studentId], `${who} checked in on “${e.title}”`, { persona: PERSONA_OF_STUDENT[e.studentId], screen: 'map', param: e.id });
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
let saveTimer = null, applying = false;
function persist() {
  if (applying) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ store, seq, evSeq, at: Date.now() })); } catch { /* storage full or blocked: the demo still works in memory */ }
  }, 150);
}
function apply(saved) {
  applying = true;
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, saved.store);
  seq = Math.max(seq, saved.seq || 0); evSeq = Math.max(evSeq, saved.evSeq || 0);
  listeners.forEach((fn) => fn());
  applying = false;
}
try { const raw = localStorage.getItem(STORE_KEY); if (raw) apply(JSON.parse(raw)); } catch { /* ignore a broken save */ }
// Another tab changed the record: take its copy. Endorse on the laptop, see the badge flip on the iPad.
try { addEventListener('storage', (e) => { if (e.key === STORE_KEY && e.newValue) { try { apply(JSON.parse(e.newValue)); } catch { /* ignore */ } } }); } catch { /* no window */ }
export const isSaved = () => { try { return !!localStorage.getItem(STORE_KEY); } catch { return false; } };
// F3: back to the seeded record, in every open tab.
export function resetDemo() {
  clearTimeout(saveTimer);
  try { Object.keys(localStorage).filter((k) => k.startsWith('tp-')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  apply({ store: JSON.parse(SEED), seq: 1, evSeq: 900 });
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ store, seq, evSeq, at: Date.now() })); } catch { /* ignore */ }
}

// ── F9: undo. A copy of the record before a quick action; Undo puts it back. ─
export const snapshot = () => JSON.stringify({ store, seq, evSeq });
export function restore(snap) { apply(JSON.parse(snap)); persist(); }

// ── F5: students act on their own stations ────────────────────────────
export function editStation(id, patch) {
  const e = getEvent(id); if (!e || e.verification !== 'student-added') return;
  Object.assign(e, patch);
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
  notify(PERSONA_OF_TEACHER[r.teacherId], `${s.name.split(' ')[0]} added evidence to “${e.title}” and resubmitted it`, { persona: PERSONA_OF_TEACHER[r.teacherId], screen: 'queue' });
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
  notify(PERSONA_OF_STUDENT[r.studentId], status === 'approved' ? `Your parent said yes: ${r.title}` : `Your parent said no for now: ${r.title}`, { persona: PERSONA_OF_STUDENT[r.studentId], screen: 'privacy' });
  notify('whitfield', `${s.name.split(' ')[0]}’s family answered a consent request`);
  emit();
}
export function remindParent(studentId) {
  const s = getStudent(studentId);
  notify('parent', `${s.name.split(' ')[0]} asked you to look at a consent request`, { persona: 'parent', screen: 'consent', param: studentId });
  log(studentId, s.name, 'consent', 'Sent a reminder to a parent about consent');
  emit();
}
export const getFamily = () => store.family;
// N2: one language setting for the app shell and the family screens.
export const getLang = () => store.family.lang;
export function setLang(lang) { store.family.lang = lang; emit(); }
export function setFamily(patch) { Object.assign(store.family, patch); emit(); }
// A week of one child's record, as a family would see it.
export function getDigest(studentId, days = 7) {
  const from = new Date(new Date(`${TODAY}T12:00:00`).getTime() - days * 86400000).toISOString().slice(0, 10);
  const map = getStudentMap(studentId, familyViewer(studentId));
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
    store.inbox.push({ id: `ev-${evSeq++}`, studentId: sid, title: t.title, date: t.due, lineIds: [line], suggestedLineIds: [line], type: t.type, summary: t.summary, evidence: [],
      verification: 'teacher-endorsed', visibility: 'advisor', source: { system: 'ManageBac', ref: t.ref }, sourceId: 'lms', classEndorsement: { teacherId: t.teacherId, note, date: TODAY } });
    log(sid, teacher.name, 'endorsement', `Endorsed “${t.title}” for the whole class`);
    notify(PERSONA_OF_STUDENT[sid], `${teacher.name} endorsed “${t.title}”. It is in your inbox.`, { persona: PERSONA_OF_STUDENT[sid], screen: 'inbox' });
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
