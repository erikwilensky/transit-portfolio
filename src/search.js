// Search (docs/pilot-server.md "Search"): over the part of the record this browser already holds, never anything else.
// Pure: the api is passed in, so the unit tests and the server can load it. collect(api, persona) reads what that person
// may read, exactly as getStudentMap(…, viewer) gives it; the index is small, built lazily, and only re-reads changed docs.
const THAI = /[฀-๿]/;
const WORD = /[\p{L}\p{N}\p{M}]/u;
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
export const norm = (s) => String(s ?? '').toLowerCase();
export const isThai = (s) => THAI.test(s);
export const WHOLE_SCHOOL = ['admin', 'leadership', 'coordinator', 'counsellor'];
export const KINDS = [['student', 'Students'], ['moment', 'Moments'], ['goal', 'Goals'], ['reflection', 'Reflections'], ['note', "Teachers' notes"], ['line', 'Lines']];
export const LIMIT = 50;

// Words of a text: Intl.Segmenter for Thai where the browser has it (Thai has no spaces), else runs of letters and digits
// (the segmenter is slow, and spaces already split the rest).
export function words(text, seg = SEG) {
  const t = norm(text);
  if (seg && isThai(t)) return [...seg.segment(t)].filter((s) => s.isWordLike ?? WORD.test(s.segment)).map((s) => s.segment);
  return t.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
}
// The needles of a query: each space-separated Thai run whole (matched as a substring), other runs split into words.
export function needles(q) {
  const out = [];
  for (const run of norm(q).trim().split(/\s+/).filter(Boolean)) {
    if (isThai(run)) out.push(run.replace(/[^\p{L}\p{N}\p{M}]+/gu, '') || run);
    else out.push(...run.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean));
  }
  return [...new Set(out)];
}
// Where a needle sits in a lowered text: at the start of a word (Latin script), or anywhere (Thai).
export function hits(low, n) {
  const out = [];
  for (let i = low.indexOf(n); i !== -1; i = low.indexOf(n, i + 1)) if (isThai(n) || i === 0 || !WORD.test(low[i - 1])) out.push(i);
  return out;
}
const has = (low, n) => hits(low, n).length > 0;
// A text cut into [part, matched] pieces, for <mark>.
export function marks(text, ns) {
  const s = String(text ?? ''); const low = norm(s);
  if (low.length !== s.length || !ns.length) return [[s, false]];
  const on = new Uint8Array(s.length);
  for (const n of ns) for (const i of hits(low, n)) on.fill(1, i, i + n.length);
  const out = [];
  for (let i = 0; i < s.length;) { let j = i; while (j < s.length && on[j] === on[i]) j++; out.push([s.slice(i, j), !!on[i]]); i = j; }
  return out;
}
// A short piece of a long text around its first match.
export function snippet(text, ns, room = 110) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim(); const low = norm(s);
  if (s.length <= room) return s;
  const at = Math.min(...ns.flatMap((n) => hits(low, n).slice(0, 1)), Infinity);
  if (at === Infinity) return `${s.slice(0, room - 1)}…`;
  const from = Math.max(0, Math.min(at - 30, s.length - room));
  return `${from ? '…' : ''}${s.slice(from, from + room).trim()}${from + room < s.length ? '…' : ''}`;
}

// ── The index: term → doc ids, a sorted term list for prefix lookups, and each doc's lowered text ──
export function createIndex() { return { docs: new Map(), terms: new Map(), sorted: null }; }
const sig = (d) => JSON.stringify([d.title, d.sub, d.date, d.lineIds, d.fields, d.tags]);
function addDoc(ix, d) {
  d.sig ||= sig(d);
  // A field with weight 0 is context only (a reflection's moment title): shown, never matched.
  d.low = d.fields.map(([, t, w]) => (w === 0 ? '' : norm(t)));
  d.all = d.low.join('\n');
  d.terms = new Set(d.fields.flatMap(([, t, w]) => (w === 0 ? [] : words(t))));
  for (const t of d.terms) (ix.terms.get(t) || ix.terms.set(t, new Set()).get(t)).add(d.id);
  ix.docs.set(d.id, d);
}
function dropDoc(ix, d) {
  for (const t of d.terms) { const s = ix.terms.get(t); s?.delete(d.id); if (s && !s.size) ix.terms.delete(t); }
  ix.docs.delete(d.id);
}
// Puts the index in step with a fresh list of docs: only new, changed and removed ones are touched. → how many changed.
export function setDocs(ix, list) {
  let n = 0; const keep = new Set();
  for (const d of list) {
    keep.add(d.id); d.sig = sig(d);
    const old = ix.docs.get(d.id);
    if (old && old.sig === d.sig) { old.ref = d.ref; continue; }
    if (old) dropDoc(ix, old);
    addDoc(ix, d); n++;
  }
  for (const [id, d] of ix.docs) if (!keep.has(id)) { dropDoc(ix, d); n++; }
  if (n) ix.sorted = null;
  return n;
}
function prefixed(ix, n) {
  const a = ix.sorted ||= [...ix.terms.keys()].sort();
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < n) lo = m + 1; else hi = m; }
  const out = new Set();
  for (let i = lo; i < a.length && a[i].startsWith(n); i++) for (const id of ix.terms.get(a[i])) out.add(id);
  return out;
}
// Matching docs for one needle: by prefix in the index, plus a substring scan for Thai (word breaks differ between
// the segmenter's guess for the query and for the text, and some browsers have no segmenter at all).
function docsFor(ix, n) {
  const out = prefixed(ix, n);
  if (isThai(n)) for (const d of ix.docs.values()) if (d.all.includes(n)) out.add(d.id);
  return out;
}

const SINCE = { month: (today) => back(today, 30), term: (_, termStart) => termStart, year: (today) => `${Number(today.slice(0, 4)) - (today.slice(5) < '08-01' ? 1 : 0)}-08-01` };
const back = (d, n) => new Date(Date.parse(d) - n * 864e5).toISOString().slice(0, 10);
export const DATES = [['', 'Any time'], ['month', 'Last 30 days'], ['term', 'This term'], ['year', 'This school year'], ['older', 'Before this school year']];
function inDate(d, when, today, termStart) {
  if (!when) return true;
  if (!d.date) return false;
  if (when === 'older') return d.date < SINCE.year(today);
  return d.date >= SINCE[when](today, termStart) && d.date <= today;
}

// q: the typed words; filters: { kind, line, when, studentId }. An empty query with a filter lists what it names.
// → { results: [doc], total, groups: [[kind, label, docs]], needles }
export function search(ix, q, { kind = '', line = '', when = '', studentId = '', limit = LIMIT, today = '9999-12-31', termStart = '0000-00-00' } = {}) {
  const ns = needles(q);
  const filtered = !!(kind || line || when || studentId);
  let ids = null;
  if (ns.length) for (const n of ns) { const s = docsFor(ix, n); ids = ids ? new Set([...ids].filter((x) => s.has(x))) : s; if (!ids.size) break; }
  else if (!filtered) return { results: [], total: 0, groups: [], needles: ns };
  const pool = ids ? [...ids].map((id) => ix.docs.get(id)) : [...ix.docs.values()];
  const ok = (d) => (!kind || d.kind === kind) && (!line || d.lineIds?.includes(line)) && (!studentId || d.studentId === studentId) && inDate(d, when, today, termStart)
    && (ns.length || d.kind !== 'line');
  const scored = [];
  for (const d of pool) {
    if (!ok(d)) continue;
    let score = 0, best = -1, bestW = -1;
    for (const n of ns) {
      let w = 0;
      d.low.forEach((l, i) => { if (l && has(l, n)) { const fw = d.fields[i][2] || 1; if (fw > w) w = fw; if (i > 0 && fw > bestW) { bestW = fw; best = i; } } });
      score += w + (d.low[0].startsWith(n) ? 2 : 0);
    }
    scored.push({ d, score, best });
  }
  scored.sort((a, b) => b.score - a.score || String(b.d.date || '').localeCompare(String(a.d.date || '')) || a.d.title.localeCompare(b.d.title));
  const top = scored.slice(0, limit).map(({ d, best }) => ({ ...d, match: best > 0 ? d.fields[best] : null }));
  const groups = KINDS.map(([k, label]) => [k, label, top.filter((d) => d.kind === k)]).filter(([, , l]) => l.length);
  return { results: groups.flatMap(([, , l]) => l), total: scored.length, groups, needles: ns };
}

// ── What one person may search: the docs, from the part of the record this browser holds ──
const yearOf = (s) => (Number.isFinite(s?.grade) ? `Year ${s.grade + 1}` : '');
// The map a person reads for one student, as the screens they can open show it (AdvisorStudent, MyClasses, Family).
export function mapFor(api, persona, sid) {
  if (persona.kind === 'student') return sid === persona.studentId ? api.getStudentMap(sid, 'student') : null;
  if (persona.kind === 'parent') return (persona.children || []).includes(sid) ? api.getStudentMap(sid, api.familyViewer(sid), { family: true }) : null;
  const s = api.getStudent(sid); if (!s) return null;
  const m = api.getStudentMap(sid, 'advisor');
  if (persona.admin || WHOLE_SCHOOL.includes(persona.kind) || (persona.teacherId && s.advisorId === persona.teacherId)) return m;
  // A teacher who is not the advisor: school-level moments, and the ones the student asked them about or they sponsor.
  const school = api.VISIBLE_TO.school;
  const asked = new Set(persona.teacherId ? api.getRequests(persona.teacherId, null).map((r) => r.eventId) : []);
  const mine = (e) => asked.has(e.id) || (!!persona.teacherId && e.sponsor?.teacherId === persona.teacherId);
  return { ...m, signals: [], events: m.events.filter((e) => school.includes(e.visibility) || mine(e)).map((e) => (mine(e) ? e : { ...e, reflections: e.reflections.filter((r) => school.includes(r.visibility || 'private')) })) };
}
export const canSearch = (p) => !!p && (p.kind === 'student' || p.kind === 'parent' || p.admin || ['advisor', 'teacher', ...WHOLE_SCHOOL].includes(p.kind));

export function collect(api, persona) {
  if (!canSearch(persona)) return [];
  const student = persona.kind === 'student', parent = persona.kind === 'parent', staff = !student && !parent;
  const whole = persona.admin || WHOLE_SCHOOL.includes(persona.kind);
  const docs = [];
  const people = student ? [api.getStudent(persona.studentId)].filter(Boolean) : parent ? (persona.children || []).map(api.getStudent).filter(Boolean) : api.getStudents();
  const withEvents = new Set(api.getStore().events.map((e) => e.studentId));
  const teacher = (id) => api.getTeacher(id)?.name || 'A teacher';
  const many = people.length > 1;
  for (const s of people) {
    const who = many ? s.name : '';
    if (staff) docs.push({ id: `st:${s.id}`, kind: 'student', studentId: s.id, title: s.name, sub: [yearOf(s), s.homeroom && `Homeroom ${s.homeroom}`, s.programme].filter(Boolean).join(' · '), date: null, lineIds: [],
      fields: [['Name', s.name, 4], ['Homeroom', s.homeroom ? `${s.homeroom} homeroom ${s.homeroom}` : '', 3], ['Year', yearOf(s), 1], ['Programme', s.programme || '', 1]] });
    if (staff && (whole || s.advisorId === persona.teacherId)) (api.getNotes(s.id) || []).forEach((n, i) => docs.push({ id: `an:${s.id}:${i}`, kind: 'note', studentId: s.id, title: `Advisor note on ${s.name}`, sub: 'Advisor note', date: n.date, lineIds: [], fields: [['Note', n.text, 2], ['Student', s.name, 1]] }));
    if (!withEvents.has(s.id)) continue;
    const map = mapFor(api, persona, s.id); if (!map) continue;
    const lines = new Map(map.lines.map((l) => [l.id, l]));
    const lineName = (id) => lines.get(id)?.name || api.getLine?.(id)?.name || id;
    const root = (id) => api.rootLine?.(id) || id;
    if (student) for (const l of map.lines) docs.push({ id: `ln:${s.id}:${l.id}`, kind: 'line', studentId: s.id, title: l.name, sub: l.status === 'ended' ? 'Line, ended' : 'Line', date: null, lineIds: [l.id, root(l.id)], colour: l.colour, fields: [['Line', l.name, 3]] });
    for (const e of map.events) {
      const lineIds = [...new Set(e.lineIds.flatMap((id) => [id, root(id)]))];
      const lineNames = e.lineIds.map(lineName).join(', ');
      const tags = [...(e.tags?.lp || []), ...(e.tags?.atl || [])];
      const base = { studentId: s.id, eventId: e.id, date: e.date, lineIds, colour: lines.get(e.lineIds[0])?.colour };
      const sub = [who, e.type === 'goal' ? 'Goal' : null, lineNames].filter(Boolean).join(' · ');
      docs.push({ ...base, id: `ev:${e.id}`, kind: e.type === 'goal' ? 'goal' : 'moment', title: e.title, sub, type: e.type, tags,
        fields: [['Title', e.title, 4], ['Summary', e.summary, 2], ['About', e.about, 1], ['Evidence', (e.evidence || []).map((x) => x.caption).filter(Boolean).join(' · '), 1],
          ['Tags', tags.join(' · '), 2], ['Line', lineNames, 1], ...(who ? [['Student', who, 2]] : []), ...(e.sponsor?.expectations ? [['Expectations', e.sponsor.expectations, 1]] : [])] });
      for (const r of e.reflections || []) docs.push({ ...base, id: `rf:${r.id}`, kind: 'reflection', title: e.title, sub: [who, r.prompt].filter(Boolean).join(' · '), date: r.date || e.date, fields: [['Moment', e.title, 0], ['Reflection', r.text, 3], ['Prompt', r.prompt, 1]] });
      for (const n of e.endorsements || []) if (n.note) docs.push({ ...base, id: `en:${n.id}`, kind: 'note', title: e.title, sub: [who, `Endorsed by ${n.teacher?.name || teacher(n.teacherId)}`].join(' · ').replace(/^ · /, ''), date: n.date || e.date, fields: [['Moment', e.title, 0], ['Note', n.note, 3], ['Teacher', n.teacher?.name || teacher(n.teacherId), 1]] });
      (e.sponsor?.checkIns || []).forEach((c, i) => { if (c.by !== 'student') docs.push({ ...base, id: `ci:${e.id}:${i}`, kind: 'note', title: e.title, sub: [who, `Check-in from ${teacher(c.by)}`].filter(Boolean).join(' · '), date: c.date, fields: [['Moment', e.title, 0], ['Note', c.text, 3], ['Teacher', teacher(c.by), 1]] }); });
      if (!parent) for (const c of api.getMomentComments?.(e.id) || []) if (c.by !== 'student' && api.commentShown(c, staff)) docs.push({ ...base, id: `cm:${c.id}`, kind: 'note', title: e.title, sub: [who, `Comment from ${teacher(c.by)}`].filter(Boolean).join(' · '), date: String(c.at || '').slice(0, 10) || e.date, fields: [['Moment', e.title, 0], ['Note', c.text, 3], ['Teacher', teacher(c.by), 1]] });
    }
    if (student) for (const p of map.signals || []) if (p.kind === 'prompt' && p.eventId && map.events.some((e) => e.id === p.eventId)) {
      const e = map.events.find((x) => x.id === p.eventId);
      docs.push({ id: `pr:${p.promptId}`, kind: 'note', studentId: s.id, eventId: e.id, title: e.title, sub: `Question from ${p.from?.name || 'a teacher'}`, date: p.date || e.date, lineIds: [...new Set(e.lineIds.flatMap((id) => [id, root(id)]))], fields: [['Moment', e.title, 0], ['Note', p.prompt, 3]] });
    }
  }
  return docs;
}
