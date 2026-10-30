// Pilot: who may see and change which students. reachOf(user) is the set of students a person works
// with (null: the whole school); scopedSnapshot(user) is the record that person downloads, in the
// shape api.snapshot() uses; touchedBy(fn, args) says which students (and which teacher it acts as)
// an api.js mutator call touches, for canAct in server/auth.mjs.
import { api } from './store.mjs';

export const WHOLE_SCHOOL = new Set(['admin', 'leadership', 'coordinator', 'counsellor']);
const isAdmin = (u) => !!u && (u.kind === 'admin' || !!u.admin);
const st = () => api.getStore();

// ── Reach ──
// Every link between a teacher and a student in the record: advisor, classes they teach (roster
// import: classes[].teacherIds, enrolments[]), endorsement and evidence requests sent to them,
// stations they sponsor or endorsed, prompts they sent, comments they wrote or were asked about,
// class tasks they set, class endorsements waiting in an inbox, and DP supervision.
export function teacherReach(tid) {
  const s = st(), out = new Set();
  if (!tid) return out;
  // Year handover: a student handed over from this teacher (their latest handover) is reached only by links made after it,
  // and an ended class place (a later class list without it) no longer counts.
  const cut = new Map();
  for (const h of s.handovers || []) cut.set(h.studentId, h);
  for (const [sid, h] of cut) if (h.from !== tid) cut.delete(sid); else cut.set(sid, h.date);
  // A new year (store.yearStart): every teacher's older links stop counting too; advising, a current class place or
  // DP supervision (NOW) still do.
  const year = s.yearStart?.date || '';
  const NOW = '9999';
  const add = (id, date) => { const d = String(date ?? ''); if (id && !(cut.has(id) && !(d > cut.get(id))) && !(year && !(d > year))) out.add(id); };
  const evStudent = new Map(s.events.map((e) => [e.id, e.studentId]));
  for (const x of s.students) if (x.advisorId === tid) add(x.id, NOW);
  const classes = new Set((s.classes || []).filter((c) => (c.teacherIds || []).includes(tid) || c.teacherId === tid).map((c) => c.id));
  for (const n of s.enrolments || []) if (classes.has(n.classId) && !(n.to && n.to < api.TODAY)) add(n.studentId, NOW);
  for (const r of s.requests || []) if (r.teacherId === tid) add(r.studentId, r.date);
  for (const r of s.evidenceRequests || []) if (r.teacherId === tid || r.from === tid) add(r.studentId, r.date);
  for (const e of s.events) if (e.sponsor?.teacherId === tid) add(e.studentId, e.sponsor.answeredOn || e.sponsor.invitedOn);
  for (const n of s.endorsements || []) if (n.teacherId === tid) add(evStudent.get(n.eventId), n.date);
  for (const p of s.prompts || []) if (p.from === tid) add(p.studentId, p.date);
  for (const c of s.comments || []) if ([c.by, c.to, c.teacherId].includes(tid) || (Array.isArray(c.asked) && c.asked.includes(tid))) add(c.studentId, c.date);
  for (const t of s.classTasks || []) if (t.teacherId === tid) [...(t.submitted || []), ...(t.late || [])].forEach((sid) => add(sid, t.date || t.due));
  for (const e of [...(s.inbox || []), ...(s.dismissed || [])]) if (e.classEndorsement?.teacherId === tid) add(e.studentId, e.classEndorsement.date);
  try { for (const r of api.getDpCore()) if (r.supervisor?.id === tid) add(r.student.id, NOW); } catch { /* partial record */ }
  // A teacher marked as CAS coordinator on Accounts (api.setCasCoordinator): every student in Years 12 and 13.
  if ((s.teachers || []).find((t) => t.id === tid)?.casCoordinator) for (const x of s.students) if (x.grade >= 11) add(x.id, NOW);
  return new Set([...out].filter((id) => api.getStudent(id)));
}

// null = everyone (whole-school roles), otherwise a Set of studentIds.
export function reachOf(user) {
  if (!user) return new Set();
  if (isAdmin(user) || WHOLE_SCHOOL.has(user.kind)) return null;
  if (user.kind === 'student') return new Set(user.studentId ? [user.studentId] : []);
  if (user.kind === 'parent') return new Set(user.children || []);
  if (user.kind === 'advisor' || user.kind === 'teacher') return teacherReach(user.teacherId);
  return new Set();
}

// Notification recipient keys for this person: the seeded persona id (accounts linked to a seeded
// record keep it), and the record keys 'st:<studentId>' / 't:<teacherId>' / 'u:<accountId>'.
export function recipientKeys(user) {
  if (!user) return new Set();
  // The same keys the person's bell reads (api.notifyKeys: st:, t:, fam:, role:, demo persona ids), plus u:<accountId>.
  return new Set([...api.notifyKeys({ kind: user.kind, studentId: user.studentId, teacherId: user.teacherId, children: user.children }), user.id && `u:${user.id}`].filter(Boolean));
}

// ── The record one person downloads ──
const pickBy = (obj, ok) => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => ok(k, v)));
// A store key another feature adds: arrays of { studentId } and objects keyed by studentId follow
// reach; anything else is school-level and stays.
function generic(v, inReach) {
  if (Array.isArray(v)) return v.filter((x) => !x || typeof x !== 'object' || !('studentId' in x) || inReach(x.studentId));
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length && keys.every((k) => /^st-/.test(k))) return pickBy(v, (k) => inReach(k));
  }
  return v;
}

export function scopedSnapshot(user) {
  const full = st();
  const reach = reachOf(user);
  const all = reach === null;
  const self = user?.kind === 'student' ? user.studentId : null;
  const parent = user?.kind === 'parent';
  const staff = !self && !parent;
  const tid = staff ? user?.teacherId : null;
  const inReach = (sid) => !!sid && (all || reach.has(sid));
  const near = (sid) => inReach(sid) && !parent; // students whose working record (requests, prompts, comments) this person may read
  // The visibility levels this person may read on each student's record, as getStudentMap(viewer) applies them:
  // their own record in full; a child as the family view shows it; staff at most what an advisor reads, never 'private'.
  const levels = (sid) => api.VISIBLE_TO[sid === self ? 'student' : parent ? api.familyViewer(sid) : 'advisor'];
  // A station a student explicitly sent to this teacher (an endorsement request or a sponsor invitation) reaches them.
  const askedMe = new Set(tid ? full.requests.filter((r) => r.teacherId === tid).map((r) => r.eventId) : []);
  // A moment a moderator hid (api.moderateReport) stays with the student and staff only.
  const showEvent = (e) => inReach(e.studentId) && !(parent && e.hidden) && (levels(e.studentId).includes(e.visibility) || (!!tid && (askedMe.has(e.id) || e.sponsor?.teacherId === tid)));

  const store = {};
  store.students = full.students.filter((s) => inReach(s.id));
  // The staff directory: names and roles only.
  store.teachers = (full.teachers || []).map((t) => ({ id: t.id, name: t.name, role: t.role, ...(t.pilot ? { pilot: true } : {}), ...(t.casCoordinator ? { casCoordinator: true } : {}) }));
  store.lines = full.lines.filter((l) => !l.studentId || inReach(l.studentId));
  store.events = full.events.filter(showEvent);
  const shown = new Map(store.events.map((e) => [e.id, e.studentId]));
  store.reflections = full.reflections.filter((r) => shown.has(r.eventId) && levels(shown.get(r.eventId)).includes(r.visibility || 'private'));
  store.endorsements = full.endorsements.filter((n) => shown.has(n.eventId));
  store.alumEvents = (full.alumEvents || []).filter((e) => inReach(e.studentId) && levels(e.studentId).includes(e.visibility));
  const tagged = new Set([...shown.keys(), ...store.alumEvents.map((e) => e.id)]);
  store.tags = pickBy(full.tags, (id) => tagged.has(id));
  // Waiting items (not on the map yet): the student's own, or whole-school roles at the levels they may read.
  const waiting = (e) => !!e && (e.studentId === self || (all && levels(e.studentId).includes(e.visibility || 'advisor')));
  store.pending = full.pending.filter((p) => waiting(p.event));
  store.inbox = full.inbox.filter(waiting);
  store.dismissed = full.dismissed.filter(waiting);
  // Requests and comments: the student's own, whole-school roles, or an advisor or teacher they involve.
  const advises = (sid) => !!tid && api.getStudent(sid)?.advisorId === tid;
  const mine = (sid, ...who) => near(sid) && (all || sid === self || (!!tid && who.includes(tid)));
  store.requests = full.requests.filter((r) => shown.has(r.eventId) && (mine(r.studentId, r.teacherId) || (near(r.studentId) && advises(r.studentId))));
  store.evidenceRequests = full.evidenceRequests.filter((r) => shown.has(r.eventId) && mine(r.studentId, r.teacherId, r.from));
  store.prompts = full.prompts.filter((p) => near(p.studentId));
  store.comments = full.comments.filter((c) => mine(c.studentId, c.by, c.to, c.teacherId, ...(Array.isArray(c.asked) ? c.asked : [])));
  store.consentReqs = (full.consentReqs || []).filter((r) => inReach(r.studentId));
  store.casNudges = (full.casNudges || []).filter((n) => near(n.studentId));
  const keptPrompts = new Set(store.prompts.map((p) => p.id));
  store.answered = pickBy(full.answered, (k) => (k.startsWith('prompt:') ? keptPrompts.has(k.slice(7)) : near(k.split(':')[0])));
  // Advisor notes: the advisor (and whole-school roles), never the student or family.
  store.notes = pickBy(full.notes, (sid) => all || (!!tid && api.getStudent(sid)?.advisorId === tid && inReach(sid)));
  // A student's own working files: themselves and whole-school roles.
  const ownOrAll = (sid) => all || sid === self;
  store.drafts = pickBy(full.drafts, ownOrAll);
  store.github = pickBy(full.github, ownOrAll);
  store.privacy = pickBy(full.privacy, (sid) => near(sid));
  store.intensity = pickBy(full.intensity, ownOrAll);
  store.simWeeks = pickBy(full.simWeeks, ownOrAll);
  store.activityLists = pickBy(full.activityLists, ownOrAll);
  store.letters = all ? full.letters : {}; // reference letters are confidential to the school
  store.applications = (full.applications || []).filter((a) => ownOrAll(a.studentId));
  store.casProjects = pickBy(full.casProjects, (sid) => near(sid));
  store.dpDone = pickBy(full.dpDone, (sid) => near(sid));
  store.dpNudges = pickBy(full.dpNudges, (k) => near(k.split(':')[0]));
  store.ignoredSuggestions = pickBy(full.ignoredSuggestions, (k) => shown.has(k.split('|')[0]));
  const tokens = new Set(Object.values(store.drafts).flat().flatMap((p) => (p?.shareLinks || []).map((l) => l.token)));
  store.linkViews = all ? full.linkViews : pickBy(full.linkViews, (t) => tokens.has(t));
  store.roster = all ? full.roster : [];
  store.classTasks = (full.classTasks || []).filter((t) => all || (!!tid && t.teacherId === tid));
  store.enrolments = (full.enrolments || []).filter((n) => inReach(n.studentId));
  // Class prompts: the class's teachers (and whole-school roles) see the prompt and every answer; a student sees
  // the prompts asked of them (without the classmates' ids) and their own answers. Nobody else.
  const teaches = new Set(tid ? (full.classes || []).filter((c) => (c.teacherIds || []).includes(tid)).map((c) => c.id) : []);
  const askedMine = (p) => all || (!!tid && (p.teacherId === tid || teaches.has(p.classId)));
  store.classPrompts = (full.classPrompts || []).flatMap((p) => (askedMine(p) ? [p] : self && p.studentIds.includes(self) ? [{ ...p, studentIds: [self] }] : []));
  const keptAsked = new Set(store.classPrompts.filter(askedMine).map((p) => p.id));
  store.classAnswers = (full.classAnswers || []).filter((a) => keptAsked.has(a.promptId) || (!!self && a.studentId === self));
  // Moment comments: on stations this person receives, never for families; read marks, only their own.
  const meKey = self ? 'student' : tid;
  store.momentComments = parent ? [] : (full.momentComments || []).filter((c) => shown.has(c.eventId) && api.commentShown(c, staff));
  store.commentReads = parent || !meKey ? [] : (full.commentReads || []).filter((r) => shown.has(r.eventId) && r.by === meKey);
  // Reports (safeguarding): moderators get them whole; anyone else only the ones they made, without who else or the history.
  const moderator = isAdmin(user) || api.MODERATOR_KINDS.includes(user?.kind);
  const myKeys = new Set([self && 'student', tid, ...(parent ? (user.children || []).map((c) => `fam:${c}`) : [])].filter(Boolean));
  store.reports = moderator ? (full.reports || []) : (full.reports || []).filter((r) => inReach(r.studentId) && myKeys.has(r.from?.key) && (r.from.key !== 'student' || r.studentId === self))
    .map(({ id, kind, eventId, commentId, studentId, reason, at, status }) => ({ id, kind, eventId, ...(commentId ? { commentId } : {}), studentId, reason, at, status, from: { key: tid || (self ? 'student' : `fam:${studentId}`) }, history: [] }));
  // Spotted moments: the student gets their own; the teacher who made them gets theirs, a declined one only as closed.
  const closed = ({ decidedAt, ...x }) => ({ ...x, status: 'closed' });
  store.spotted = (full.spotted || []).flatMap((x) => (self && x.studentId === self ? [x] : tid && x.teacherId === tid ? [x.status === 'declined' ? closed(x) : x] : []));
  const keys = recipientKeys(user);
  store.notifications = full.notifications.filter((n) => keys.has(n.to));
  // The activity log, without lines that name a station this person does not receive. Families: views and consent only.
  const hidden = new Map();
  const sent = new Set([...shown.keys(), ...store.inbox.map((e) => e.id), ...store.dismissed.map((e) => e.id), ...store.pending.map((p) => p.event.id)]);
  for (const e of [...full.events, ...full.inbox, ...full.dismissed, ...full.pending.map((p) => p.event)]) {
    if (e && inReach(e.studentId) && !sent.has(e.id)) (hidden.get(e.studentId) || hidden.set(e.studentId, []).get(e.studentId)).push(`“${e.title}”`);
  }
  store.activity = full.activity.filter((a) => inReach(a.studentId) && (!parent || ['view', 'consent'].includes(a.kind)) && !(hidden.get(a.studentId) || []).some((t) => a.text?.includes(t)));
  // Year handover (api.setHandoverNote): staff only. Notes go to the student's advisor, the note's author and whole-school
  // roles; the previous advisor also gets a short list of the students they handed over, to finish their notes.
  store.handovers = staff ? (full.handovers || []).filter((h) => inReach(h.studentId)) : [];
  store.handoverNotes = staff ? (full.handoverNotes || []).filter((n) => all || (!!tid && (n.by === tid || (inReach(n.studentId) && api.getStudent(n.studentId)?.advisorId === tid)))) : [];
  store.handedOver = tid ? handedOverBy(tid).filter((h) => !inReach(h.studentId)) : [];
  // Term reflection (api.openReflectionWindow): a window goes to whole-school roles whole, to staff when it covers a student
  // in reach (only those ids), and to a student it covers (only their own id); never to families. A student gets their own
  // reflection whole; staff in reach only whether it is started or done (what they read is the station, by its visibility).
  store.reflectionWindows = parent ? [] : (full.reflectionWindows || []).flatMap((w) => { const ids = w.studentIds.filter((x) => (self ? x === self : inReach(x))); return all ? [w] : ids.length ? [{ ...w, studentIds: ids }] : []; });
  store.termReflections = parent ? [] : (full.termReflections || []).filter((r) => (self ? r.studentId === self : inReach(r.studentId)))
    .map((r) => (self ? r : { id: r.id, windowId: r.windowId, studentId: r.studentId, status: r.status, startedAt: r.startedAt, doneAt: r.doneAt || null, eventId: r.eventId || null }));
  // Kind feedback from classmates (api.givePeerFeedback): a student gets the classmates' opted-in moments they may see
  // (title, first photo, first name, shared class: store.peerMoments), the feedback they gave (without whether the owner
  // hid it) and the feedback on their own moments that is not hidden (the classmate's first name, never their id). Staff:
  // the class's teachers, either student's advisor and whole-school roles get it whole. Families never.
  const pfStaff = (f) => all || (!!tid && (teaches.has(f.classId) || [f.studentId, f.fromId].some((sid) => api.getStudent(sid)?.advisorId === tid)));
  store.peerMoments = self ? api.peerMomentsFor(self) : [];
  store.peerFeedback = parent ? [] : (full.peerFeedback || []).flatMap((f) => {
    if (!self) return pfStaff(f) ? [f] : [];
    const { hidden, fromId, ...x } = f;
    return f.fromId === self ? [{ ...x, fromId }] : f.studentId === self && !hidden ? [x] : [];
  });
  if (!moderator) { const fb = new Map((full.reports || []).filter((r) => r.feedbackId).map((r) => [r.id, r.feedbackId])); store.reports = store.reports.map((r) => (fb.has(r.id) ? { ...r, feedbackId: fb.get(r.id) } : r)); }
  // Milestones (api.markMilestonesSeen): which celebrations a student has seen, for that student only.
  store.milestonesSeen = self ? pickBy(full.milestonesSeen, (sid) => sid === self) : {};
  // Exhibition screens (api.createExhibition): whoever made one and admins get it whole; other staff without its address
  // (the token) and with only the removed slides of students in reach; students and families never.
  store.exhibitions = !user || !staff ? [] : (full.exhibitions || []).map((x) => (isAdmin(user) || (!!tid && x.by === tid) ? x : { ...x, token: null, removed: (x.removed || []).filter((r) => inReach(ev(r.eventId))) }));
  // Leaver portfolio (api.saveLeaver): the student's own whole; staff in reach without the share links' tokens; never families
  // (they read it only through a link the student gives them).
  store.leaver = parent ? {} : Object.fromEntries(Object.entries(full.leaver || {}).filter(([sid]) => inReach(sid))
    .map(([sid, p]) => [sid, sid === self ? p : { ...p, links: (p.links || []).map(({ token, ...l }) => l) }]));
  // Weekly goal check-ins (api.checkInGoal): on the goal for the student and staff who receive it; never for families.
  if (parent) store.events = store.events.map((e) => (e.checkins || e.encouragements || e.checkinSnooze ? (({ checkins, encouragements, checkinSnooze, ...x }) => x)(e) : e));
  // Class tasks (api.setTask, handInTask): the class's teachers, the teacher who set it and whole-school roles get a task
  // and its hand-in rows whole; a student gets the tasks set for them (studentIds: just themselves) and their own rows.
  // Families and other staff get neither (a hand-in is a station: it reaches them by its visibility like any other).
  const taskMine = (t) => all || (!!tid && (t.teacherId === tid || teaches.has(t.classId)));
  store.teacherTasks = parent ? [] : (full.teacherTasks || []).flatMap((t) => (taskMine(t) ? [t] : self && t.studentIds.includes(self) ? [{ ...t, studentIds: [self] }] : []));
  const keptTasks = new Set(store.teacherTasks.filter(taskMine).map((t) => t.id));
  store.handIns = parent ? [] : (full.handIns || []).filter((r) => (self ? r.studentId === self : keptTasks.has(r.taskId) && inReach(r.studentId)));
  Object.assign(store, confScope(full, { user, all, self, parent, tid, inReach }));
  // Subject prompts (api.setSubjectPrompts): school guidance every student and member of staff receives, families never. An
  // example from a student's moment goes whole (ids, status) to that student and to staff who reach them; anyone else gets
  // it only once the student said yes and while it is still publishable, as its title, a line of it and the Year.
  store.subjectPrompts = parent ? [] : (full.subjectPrompts || []).map((p) => ({ ...p, examples: (p.examples || []).flatMap((x) => {
    if (!x.eventId || x.studentId === self || (staff && inReach(x.studentId))) return [x];
    const v = api.exampleView(x, p.lineId); return v ? [v] : [];
  }) }));
  // CAS hours (api.logCasHours): the student's own; CAS coordinators (role coordinator or marked on Accounts) and admins every
  // one; a staff supervisor only the entries naming them, with what each is about (`about`), even for a student outside
  // their reach. Never families or other staff. A code's hash never leaves the server (only when it expires).
  const casCoord = isAdmin(user) || (staff && api.isCasCoordinator({ kind: user?.kind, teacherId: tid }));
  const casOut = ({ code, ...x }) => ({ ...x, ...(code ? { code: { expires: code.expires } } : {}), ...(self ? {} : { about: api.casAbout(x) }) });
  store.casHours = parent ? [] : (full.casHours || []).filter((x) => (self ? x.studentId === self : casCoord || (!!tid && x.supervisor?.kind === 'staff' && x.supervisor.teacherId === tid))).map(casOut);
  // Everything else (school lines' settings, integrations, rollout, family language, classes, keys other features add).
  for (const [k, v] of Object.entries(full)) if (!(k in store)) store[k] = generic(v, inReach);
  // Counts the whole-school screens show for what they may not open.
  store.scope = { school: all, privateStations: all ? full.events.filter((e) => e.visibility === 'private').length : 0 };
  return { store, seq: 1 };
}

// ── Which students a mutator call touches, and which teacher it acts as ──
const ev = (id) => api.getEvent(id)?.studentId;
const req = (id) => st().requests.find((r) => r.id === id);
const inboxItem = (id) => (st().inbox.find((e) => e.id === id) || st().dismissed.find((e) => e.id === id))?.studentId;
const lineOwner = (id) => api.getLine(id)?.studentId;
const T = (students, as = []) => ({ students, as: as.filter((x) => x !== undefined && x !== null && x !== '') });
const own0 = (a) => T([a[0]]);
export const TOUCHES = {
  setStudentDrafts: own0, setGithub: own0, disconnectGithub: own0, simulateWeek: own0, addStation: own0, addBranch: own0,
  endLine: own0, restartLine: own0, completeOnboarding: own0, capturePhone: own0, setPrivacy: own0, logLink: own0,
  setIntensity: own0, remindParent: own0, addNote: own0, nudgeMilestone: own0, markMilestone: own0, saveActivityList: own0,
  saveLetter: own0, setLetterStatus: own0, setCasProject: own0, casNudge: own0, addLog: own0,
  addGoal: (a) => T([a[0]], [a[2]]),
  sync: (a) => T([a[1]]),
  importCandidates: (a) => T(Array.isArray(a[0]) ? a[0].map((r) => r?.studentId) : [], [a[1]?.by?.teacherId]),
  addReflection: (a) => T([a[0]?.studentId, ev(a[0]?.eventId)]),
  setVisibility: (a) => T([ev(a[0])]), editStation: (a) => T([ev(a[0])]), deleteStation: (a) => T([ev(a[0])]), completeGoal: (a) => T([ev(a[0])]),
  setTags: (a) => T([ev(a[0])]), requestEndorsement: (a) => T([ev(a[0])]), askEvidence: (a) => T([ev(a[0])]),
  addCheckIn: (a) => T([ev(a[0])], [a[2] !== 'student' ? a[2] ?? '?' : null]),
  answerSponsor: (a) => T([ev(a[0])], [api.getEvent(a[0])?.sponsor?.teacherId ?? '?']),
  acceptCandidate: (a) => T([inboxItem(a[0])]), dismissCandidate: (a) => T([inboxItem(a[0])]), restoreCandidate: (a) => T([inboxItem(a[0])]),
  mergeCandidate: (a) => T([inboxItem(a[0]), ev(a[1])]),
  resubmit: (a) => T([req(a[0])?.studentId]),
  answerEvidence: (a) => T([st().evidenceRequests.find((r) => r.id === a[0])?.studentId]),
  acceptInterchange: (a) => T([ev(a[0]?.b?.id)]),
  ignoreInterchange: (a) => T(String(a[0] ?? '').split('|').slice(0, 1).map(ev)),
  endorse: (a) => { const ids = [].concat(a[0] ?? []); return T(ids.map((id) => req(id)?.studentId), [a[1] ?? '?', ...ids.map((id) => req(id)?.teacherId ?? '?')]); },
  declineRequest: (a) => T([req(a[0])?.studentId], [req(a[0])?.teacherId ?? '?']),
  sendPrompt: (a) => T([a[0], ev(a[1])], [a[3] ?? 't-07']),
  addComment: (a) => T([a[1], ...(a[3] ? [ev(a[3])] : [])], [a[4] ?? 't-09']),
  resolveComment: (a) => T([st().comments.find((c) => c.id === a[0])?.studentId]),
  answerConsent: (a) => T([(st().consentReqs || []).find((r) => r.id === a[0])?.studentId]),
  endorseClassTask: (a) => T(Array.isArray(a[1]) ? a[1] : [], [(st().classTasks || []).find((t) => t.id === a[0])?.teacherId ?? '?']),
  matchRoster: (a) => T([a[1]]),
  addAlumStation: () => T([api.ALUM.studentId]),
  addNotification: (a) => T(Object.entries(api.PERSONA_OF_STUDENT).filter(([, p]) => p === a[0]).map(([sid]) => sid)),
  renameLine: (a) => T(lineOwner(a[0]) ? [lineOwner(a[0])] : []),
  decideBranch: (a) => T([lineOwner(a[0])]),
  // Class prompts: askClass and remindClass touch the class's students, as the asking teacher (auth.mjs also checks
  // that a subject teacher teaches the class); answerPrompt and skipPrompt touch only a student the prompt was asked of.
  askClass: (a) => T((st().enrolments || []).filter((n) => n.classId === a[0] && !(n.to && n.to < api.TODAY) && api.getStudent(n.studentId)).map((n) => n.studentId), [a[1] ?? '?']),
  remindClass: (a) => { const p = api.getClassPrompt(a[0]); return T(p ? p.studentIds.filter((sid) => api.getStudent(sid)) : ['?'], [a[1] ?? '?']); },
  answerPrompt: (a) => T([api.getClassPrompt(a[0])?.studentIds.includes(a[1]) ? a[1] : '?']),
  skipPrompt: (a) => T([api.getClassPrompt(a[0])?.studentIds.includes(a[1]) ? a[1] : '?']),
  addMomentComment: (a) => T([ev(a[0])], [a[1] !== 'student' ? a[1] ?? '?' : null]),
  markCommentsRead: (a) => T([ev(a[0])], [a[1] !== 'student' ? a[1] ?? '?' : null]),
  editMomentComment: (a) => T([api.getMomentComment(a[0])?.studentId], [a[1] !== 'student' ? a[1] ?? '?' : null]),
  deleteMomentComment: (a) => T([api.getMomentComment(a[0])?.studentId], [a[1] !== 'student' ? a[1] ?? '?' : null]),
  spotMoment: (a) => T([].concat(a[0] ?? []), [a[1] ?? '?']),
  acceptSpotted: (a) => T([api.getSpotted(a[0])?.studentId === a[1] ? a[1] : '?']),
  declineSpotted: (a) => T([api.getSpotted(a[0])?.studentId === a[1] ? a[1] : '?']),
  addSchoolLine: () => T([]), setSubjectLine: () => T([]), setRollout: () => T([]), setFamily: () => T([]), setLang: () => T([]), markNotificationsRead: () => T([]), recordView: () => T([]),
};
// A mutator not listed: any student or station id found in its arguments counts as touched.
function scan(args) {
  const found = [];
  const walk = (x, d) => {
    if (d > 4 || x == null) return;
    if (typeof x === 'string') { if (api.getStudent(x)) found.push(x); else { const s = ev(x); if (s) found.push(s); } return; }
    if (typeof x === 'object') for (const v of Object.values(x)) walk(v, d + 1);
  };
  walk(args, 0);
  return T(found);
}
export const touchedBy = (fn, args = []) => (Object.hasOwn(TOUCHES, fn) ? TOUCHES[fn](args) : scan(args));

// ── Year handover ──
// The students whose latest handover was from this teacher: who they went to, for the "Write handover notes" view.
export function handedOverBy(tid) {
  const latest = new Map(); for (const h of st().handovers || []) latest.set(h.studentId, h);
  return [...latest.values()].filter((h) => h.from === tid).map((h) => { const s = api.getStudent(h.studentId); return s && { studentId: s.id, name: s.name, grade: s.grade, homeroom: s.homeroom, to: api.getTeacher(h.to)?.name || h.to, date: h.date }; }).filter(Boolean);
}
Object.assign(TOUCHES, { carryOverGoal: (a) => T([ev(a[0])]), closeGoal: (a) => T([ev(a[0])]), setHandoverNote: (a) => T([a[0]], [a[2] ?? '?']) });
Object.assign(TOUCHES, { openReflectionWindow: (a) => T([], [a[1]]), closeReflectionWindow: () => T([]), saveTermReflection: (a) => T([a[1]]), finishTermReflection: (a) => T([a[1]]) });
Object.assign(TOUCHES, {
  setPeerFeedback: (a) => T([ev(a[0])]), givePeerFeedback: (a) => T([a[1]]), setPeerFeedbackYear: (a) => T([], [a[2]]),
  thankPeerFeedback: (a) => T([api.getPeerFeedback(a[0])?.studentId ?? '?']), hidePeerFeedback: (a) => T([api.getPeerFeedback(a[0])?.studentId ?? '?']),
});
Object.assign(TOUCHES, { markMilestonesSeen: (a) => T([a[0]]) });
Object.assign(TOUCHES, {
  createExhibition: (a) => T([], [a[1]]), removeExhibitionSlide: (a) => T([ev(a[1])].filter(Boolean), [a[2]]),
  pauseExhibition: (a) => T([], [a[2]]), revokeExhibition: (a) => T([], [a[1]]),
});
Object.assign(TOUCHES, { saveLeaver: own0, shareLeaver: own0, revokeLeaver: own0, doneLeaverComment: own0, commentLeaver: (a) => T([a[0]], [a[1] ?? '?']) });
Object.assign(TOUCHES, { checkInGoal: (a) => T([ev(a[0])]), snoozeCheckins: (a) => T([ev(a[0])]), sendEncouragement: (a) => T([ev(a[0])], [a[1] ?? '?']) });
// Class tasks (canAct's own rules are taskOk in auth.mjs; these name the students for the activity log).
const taskKids = (id) => (api.getTask(id)?.studentIds || []).filter((sid) => api.getStudent(sid));
Object.assign(TOUCHES, {
  setTask: (a) => T((st().enrolments || []).filter((n) => n.classId === a[0] && !(n.to && n.to < api.TODAY) && api.getStudent(n.studentId)).map((n) => n.studentId), [a[1] ?? '?']),
  editTask: (a) => T(taskKids(a[0]), [a[1] ?? '?']), extendTask: (a) => T([a[1]], [a[3] ?? '?']),
  handInTask: (a) => T([api.getTask(a[0])?.studentIds.includes(a[1]) ? a[1] : '?']), remindDueTasks: () => T([]),
});

// ── Conference booking (api.openConferenceRound, bookConference): rounds go to whole-school roles whole, to anyone else
// when they cover a student in reach (only those ids). Bookings and blocks: whole-school roles and admins all; an advisor
// their own grid; a student their own bookings; a family their children's bookings in full, and every other booking or block
// in their children's advisors' grids only as a taken time (no student, no id, nobody's name). ──
function confScope(full, { user, all, self, parent, tid, inReach }) {
  const rounds = (full.confRounds || []).flatMap((r) => { const ids = r.studentIds.filter((x) => (self ? x === self : inReach(x))); return all ? [r] : ids.length ? [{ ...r, studentIds: ids }] : []; });
  const kids = new Set(parent ? user.children || [] : []);
  const grids = new Set([...kids].flatMap((sid) => { const a = api.getStudent(sid)?.advisorId; return rounds.filter((r) => r.studentIds.includes(sid)).map((r) => `${r.id}|${a}`); }));
  const taken = ({ roundId, advisorId, date, time }) => ({ roundId, advisorId, date, time, taken: true });
  const bookings = (full.confBookings || []).flatMap((b) => {
    if (all || (!!tid && b.advisorId === tid) || (!!self && b.studentId === self) || kids.has(b.studentId)) return [b];
    return grids.has(`${b.roundId}|${b.advisorId}`) ? [taken(b)] : [];
  });
  const blocks = (full.confBlocks || []).flatMap((k) => (all || (!!tid && k.advisorId === tid) ? [k] : grids.has(`${k.roundId}|${k.advisorId}`) ? [taken(k)] : []));
  return { confRounds: rounds, confBookings: bookings, confBlocks: blocks };
}
Object.assign(TOUCHES, {
  openConferenceRound: (a) => T([], [a[1]]), editConferenceRound: (a) => T([], [a[2]]), closeConferenceRound: (a) => T([], [a[1]]),
  bookConference: (a) => T([a[1]], [a[3] !== 'family' ? a[3] ?? '?' : null]), cancelConference: (a) => T([api.getConfBooking(a[0])?.studentId ?? '?'], [a[1] !== 'family' ? a[1] ?? '?' : null]),
  blockConferenceSlot: (a) => T([], [a[5]]), sendConferenceReminders: () => T([]),
});
Object.assign(TOUCHES, {
  setSubjectPrompts: (a) => T([].concat(a[1]?.examples || []).filter((x) => x?.eventId).map((x) => ev(x.eventId) ?? '?'), [a[2]]),
  clearSubjectPrompts: (a) => T([], [a[1]]), answerExampleAsk: (a) => T([a[2]]),
});
const casOwner = (id) => (st().casHours || []).find((x) => x.id === id)?.studentId ?? '?';
Object.assign(TOUCHES, {
  logCasExperience: own0, logCasHours: (a) => T([a[0], ev(a[1])]), withdrawCasHours: (a) => T([casOwner(a[0])]), setCasCode: (a) => T([casOwner(a[0])]),
  confirmCasHours: (a) => T([casOwner(a[0])], [a[1]]), returnCasHours: (a) => T([casOwner(a[0])], [a[1]]), setCasCoordinator: (a) => T([], [a[0]]),
});
// Notification settings: "Clear read" in your own bell (canAct checks the keys).
Object.assign(TOUCHES, { clearReadNotifications: () => T([]) });
