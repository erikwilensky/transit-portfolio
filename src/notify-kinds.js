// Notification settings and quiet hours (docs/pilot-server.md, "Notification settings"). Pure, so the server bundle,
// the server tests and `npm test` can load it. A notification's `kind` is set once, by notify() in src/api.js
// (inferKind on its text and link, unless the call names one); older ones without it are inferred the same way here.
// Settings hide notifications from the bell and its count. They never delete one.

// Kinds that always arrive and cannot be turned off. Account-security notices are named by their notify() call.
export const ALWAYS = ['safeguarding', 'security'];
// Checked in order on the text with quoted titles emptied, so a title never decides the kind. Words a person typed
// that are not quoted (a comment, an encouragement) come after a fixed opening that is checked first.
const RULES = [
  ['safeguarding', /^A teacher has (hidden|finished looking|removed)\b/],
  ['report', /^New report:/],
  ['consent', /^Your parent said|consent request/],
  ['comment', / wrote on “”| commented on your draft| left a comment on | posted an update on “”/],
  ['encourage', /sent you encouragement/],
  ['kindfb', /gave you kind feedback|thank you for your feedback/],
  ['class', / asked .+ a question: “”|^Reminder from |^Reminder: “”| set a task: “”|^“” is now due | gave you until /],
  ['conference', /\bconference/i],
  ['stuck', / is stuck on “”/],
  ['checkin', / asked for a check-in/],
  ['spotted', /spotted something you did|“” to their journey$|said (yes|no) to showing/],
  ['handin', / handed in “”/],
  ['answers', /answered your reflection prompt/],
  ['endorse', /asked you to endorse|invited you to sponsor|and resubmitted it$/],
  ['digest', /weekly digest/i],
  ['milestone', /\bmilestone/i],
  ['system', /is open: look back on your term/],
  ['teacher', / endorsed “”| asked for more evidence| sent you a reflection prompt| approved your new line|^Your line “”| added a goal you agreed| will sponsor “”| can't sponsor “”| checked in on “”| would like to show your moment| marked your CAS project|was due .*Can you upload/],
];
// The kind of a notification from its words and where it leads ('system' when nothing fits).
export function inferKind(text = '', go) {
  const t = String(text || '').replace(/“[^”]*”/g, '“”');
  for (const [k, re] of RULES) if (re.test(t)) return k;
  if (go?.screen === 'reports') return 'report';
  if (go?.screen === 'queue') return 'endorse';
  if (/^[^:“]{2,60}: \S/.test(t)) return 'teacher'; // "Ms Nair: …", a nudge from a teacher
  return 'system';
}
export const noteKind = (n) => n?.kind || inferKind(n?.text, n?.go);

// What each person can choose, grouped plainly: [key, label, kinds, options]. A staff kind outside the other groups
// is System; a student's or family's outside them always arrives (there is nothing to choose).
export const GROUPS = {
  staff: [
    ['endorse', 'Endorsement requests', ['endorse']],
    ['answers', 'Class answers', ['answers']],
    ['handins', 'Task hand-ins', ['handin']],
    ['comments', 'Comments', ['comment']],
    ['reports', 'Reports (moderators)', ['report'], { noOff: true, moderators: true }],
    ['spotted', 'Spotted replies', ['spotted']],
    ['stuck', 'Stuck goals and check-ins', ['stuck', 'checkin']],
    ['conference', 'Conferences', ['conference']],
    ['system', 'System', []],
  ],
  student: [
    ['teacher', 'Teacher replies and endorsements', ['teacher', 'spotted', 'endorse']],
    ['comments', 'Comments', ['comment']],
    ['class', 'Class questions and tasks', ['class', 'handin', 'answers']],
    ['kindfb', 'Kind feedback', ['kindfb']],
    ['milestones', 'Milestones', ['milestone']],
    ['encourage', 'Encouragement', ['encourage']],
    ['conference', 'Conferences', ['conference']],
  ],
  // Families: no consent requests or conference times in the app since 30 October 2026 (the school uses email).
  family: [
    ['digest', 'Weekly digest', ['digest']],
    ['milestones', 'Your child’s milestones', ['milestone']],
  ],
};
export const CHOICES = { staff: ['on', 'off', 'week'], student: ['on', 'off'], family: ['on', 'off'] };
const KEYS = new Set(Object.values(GROUPS).flat().map(([k]) => k));
export const audienceOf = (kind) => (kind === 'student' ? 'student' : kind === 'parent' ? 'family' : 'staff');
export function groupOf(kind, audience) {
  const gs = GROUPS[audience] || [];
  return gs.find(([, , ks]) => ks.includes(kind)) || (audience === 'staff' ? gs.find(([k]) => k === 'system') : null) || null;
}

// Prefs: { kinds: { [group]: 'off' | 'week' }, quiet: { on, from: 'HH:MM', to: 'HH:MM' } }. 'on' is left out.
export const QUIET_DEFAULT = { on: false, from: '21:00', to: '07:00' };
export const QUIET_TZ = 'Asia/Bangkok';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function cleanNotify(p) {
  const kinds = {};
  for (const [k, v] of Object.entries(p?.kinds && typeof p.kinds === 'object' ? p.kinds : {})) if (KEYS.has(k) && (v === 'off' || v === 'week')) kinds[k] = v;
  const q = p?.quiet || {};
  return { kinds, quiet: { on: q.on === true, from: HHMM.test(q.from) ? q.from : QUIET_DEFAULT.from, to: HHMM.test(q.to) ? q.to : QUIET_DEFAULT.to } };
}
// The server's check (POST /api/auth/prefs { notify }): an error message or null.
export function notifyProblem(p, audience) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Those notification settings are not known.';
  if (Object.keys(p).some((k) => k !== 'kinds' && k !== 'quiet')) return 'Those notification settings are not known.';
  const k = p.kinds ?? {};
  if (typeof k !== 'object' || Array.isArray(k)) return 'Those notification settings are not known.';
  const mine = new Set((GROUPS[audience] || []).map(([g]) => g));
  for (const [g, v] of Object.entries(k)) {
    if (!mine.has(g) || !CHOICES[audience].includes(v)) return 'Those notification settings are not known.';
  }
  if (p.quiet !== undefined) {
    const q = p.quiet;
    if (!q || typeof q !== 'object' || Object.keys(q).some((x) => !['on', 'from', 'to'].includes(x)) || typeof q.on !== 'boolean' || !HHMM.test(q.from) || !HHMM.test(q.to)) return 'Pick quiet hours as two times, like 21:00 and 07:00.';
  }
  return null;
}

// 'on' (the bell), 'week' (only This week, staff) or 'off', for this person's prefs.
export function settingOf(n, prefs, audience) {
  const kind = noteKind(n);
  if (ALWAYS.includes(kind)) return 'on';
  const g = groupOf(kind, audience);
  if (!g) return 'on';
  let v = prefs?.kinds?.[g[0]] || 'on';
  if (v === 'week' && audience !== 'staff') v = 'off';
  if (v === 'off' && g[3]?.noOff) v = 'week';
  return v;
}

// Minutes since midnight in Bangkok.
const minutesIn = (at, tz) => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)).split(':').map(Number); return h * 60 + m; };
const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
// Is `at` inside quiet hours? From 21:00 to 07:00 runs over midnight; the same two times mean never.
export function quietNow(quiet, at = Date.now(), tz = QUIET_TZ) {
  if (!quiet?.on) return false;
  const t = minutesIn(at, tz), a = mins(quiet.from), b = mins(quiet.to);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

// The bell: what it lists (not cleared, set to 'on'), how many of those are unread, and the number on it (0 in quiet hours).
export function bellView(notes, prefs, audience, at = Date.now()) {
  const shown = (notes || []).filter((n) => !n.cleared && settingOf(n, prefs, audience) === 'on');
  const unread = shown.filter((n) => !n.read).length;
  const quiet = quietNow(prefs?.quiet, at);
  return { shown, unread, quiet, badge: quiet ? 0 : unread, hidden: (notes || []).length - shown.length };
}
// The notifications a staff member keeps for This week instead of the bell.
export const weekOnly = (notes, prefs, audience) => (notes || []).filter((n) => settingOf(n, prefs, audience) === 'week');
