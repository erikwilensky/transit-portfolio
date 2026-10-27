// Shared helpers for every importer: header matching, dates, finding the student, suggesting a line,
// and building an inbox candidate. Pure functions; the caller passes the students and lines in.

// ── Headers ───────────────────────────────────────────────────────────
export const normHeader = (h) => String(h ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Finds the column for a field. Exact matches win; then a header that starts with or contains a
// longer alias ("Student Email Address" for "studentemail"). Returns -1 when there is none.
export function findCol(headers, aliases, taken = []) {
  const hs = headers.map(normHeader);
  const as = aliases.map(normHeader);
  for (const a of as) { const i = hs.findIndex((h, j) => h === a && !taken.includes(j)); if (i >= 0) return i; }
  for (const a of as.filter((x) => x.length >= 5)) { const i = hs.findIndex((h, j) => (h.startsWith(a) || h.includes(a)) && !taken.includes(j)); if (i >= 0) return i; }
  return -1;
}
// Maps a whole header row onto named fields: { field: index }.
export function mapColumns(headers, spec) {
  const out = {}; const taken = [];
  for (const [field, aliases] of Object.entries(spec)) { const i = findCol(headers, aliases, taken); if (i >= 0) { out[field] = i; taken.push(i); } }
  return out;
}
export const cellOf = (row, cols) => (field) => (cols[field] === undefined ? '' : String(row[cols[field]] ?? '').trim());

// The student columns every school export uses, under the names we have seen or expect.
export const STUDENT_COLS = {
  studentId: ['Student ID', 'Student Id', 'StudentID', 'Student Number', 'Student No', 'ID Number', 'Student Code', 'UID', 'Student'],
  email: ['Email', 'Email Address', 'Student Email', 'Student Email Address', 'E-mail', 'School Email'],
  name: ['Student Name', 'Full Name', 'Name', 'Student Full Name'],
  first: ['First Name', 'Given Name', 'Forename', 'First'],
  last: ['Last Name', 'Surname', 'Family Name', 'Last'],
};

// ── Dates ─────────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => {
  if (y < 100) y += 2000;
  if (y > 2400) y -= 543; // Thai Buddhist Era (B.E. 2569 = 2026)
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};
// Reads the dates school exports use. Slashed dates are read day first (as in Thailand and the UK)
// unless the first number cannot be a day... or the second cannot be a month.
export function parseDate(input, { dayFirst = true } = {}) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T.*)?$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,].*)?$/))) {
    let [a, b] = [+m[1], +m[2]];
    const swap = dayFirst ? (b > 12 && a <= 12) : !(a > 12 && b <= 12);
    if (swap) [a, b] = [b, a];
    return iso(+m[3], b, a);
  }
  const word = s.replace(/,/g, ' ').replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+/i, '');
  if ((m = word.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?\s+(\d{2,4})/i)) && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if ((m = word.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})/i)) && MONTHS[m[1].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  // A spreadsheet serial number (days since 30 Dec 1899), as Excel sometimes saves dates.
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 30000 && +s < 70000) { const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86400000); return t.toISOString().slice(0, 10); }
  return null;
}

// ── Students ──────────────────────────────────────────────────────────
// Demo stand-in until the SIS supplies real addresses: first.last@ this domain. A student's own
// `email` (or `emails`) field always wins when the record has one.
export const DEMO_EMAIL_DOMAIN = 'student.nist.ac.th';
export const normName = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[.​]/g, '').replace(/\s+/g, ' ').trim();
export const studentEmails = (s) => {
  const own = [s.email, ...(s.emails || [])].filter(Boolean);
  if (own.length) return own.map((e) => e.toLowerCase());
  const parts = normName(s.name).split(' ');
  return [`${parts[0]}.${parts.slice(1).join('')}@${DEMO_EMAIL_DOMAIN}`.replace(/[^a-z0-9.@-]/g, '')];
};

// Builds a matcher over the school's students. Matches by id, email or exact full name only:
// anything else is reported, never guessed.
export function studentMatcher(students) {
  const byId = new Map(); const byEmail = new Map(); const byName = new Map();
  const add = (map, k, s) => { if (!k) return; const l = map.get(k) || []; if (!l.includes(s)) l.push(s); map.set(k, l); };
  for (const s of students) {
    add(byId, String(s.id).toLowerCase(), s);
    for (const k of [s.schoolId, s.studentNumber].filter(Boolean)) add(byId, String(k).toLowerCase(), s);
    for (const e of studentEmails(s)) add(byEmail, e, s);
    const n = normName(s.name); add(byName, n, s);
    const parts = n.split(' '); if (parts.length > 1) add(byName, `${parts.slice(1).join(' ')}, ${parts[0]}`, s); // "Chen, Maya"
    if (s.nameTh) add(byName, normName(s.nameTh), s);
  }
  const one = (list, by, raw) => (!list ? null : list.length === 1 ? { student: list[0], by } : { problem: `${list.length} students share the ${by} “${raw}”` });
  return ({ studentId, email, name, first, last } = {}) => {
    const tries = [];
    if (studentId) tries.push(one(byId.get(String(studentId).trim().toLowerCase()), 'student id', studentId));
    if (email) tries.push(one(byEmail.get(String(email).trim().toLowerCase().replace(/^mailto:/, '')), 'email', email));
    const full = name || [first, last].filter(Boolean).join(' ');
    if (full) tries.push(one(byName.get(normName(full)), 'name', full));
    const hit = tries.find((t) => t?.student);
    if (hit) return hit;
    const clash = tries.find((t) => t?.problem);
    if (clash) return clash;
    const said = [studentId && `id ${studentId}`, email, full].filter(Boolean).join(', ');
    return { problem: said ? `No student found for ${said}` : 'No student named on this row' };
  };
}

// ── Lines ─────────────────────────────────────────────────────────────
// Keywords for each school line. The first school line that fits is suggested; the student can change it.
export const LINE_WORDS = {
  sport: /\b(sports?|swim\w*|gala|football|soccer|basketball|volleyball|badminton|tennis|athletic\w*|track|cross[- ]country|fixtures?|match|tournament|race|marathon|run(ning)?|rugby|netball|fitness|squad|team practice|training|muay thai|yoga|dance)\b|ฟุตบอล|ว่ายน้ำ|กีฬา/iu,
  service: /\b(service|volunteer\w*|charity|fundrais\w*|tutor\w*|mentor\w*|buddies|buddy|community|donat\w*|orphanage|food bank|beach clean|clean[- ]up|outreach)\b|จิตอาสา/iu,
  environment: /\b(environment\w*|eco|sustainab\w*|recycl\w*|climate|garden\w*|plastic|reef|carbon|energy|tree planting|conservation|air quality|pm2\.?5)\b/iu,
  science: /\b(science|biology|chemistry|physics|lab|experiment|ia|internal assessment|extended essay|ee|research|stem|genetic\w*|ecolog\w*)\b/iu,
  computing: /\b(comput\w*|coding|code|programm\w*|python|java|software|robot\w*|app|website|web|hackathon|arduino|raspberry|ai|data|github|cyber|digital)\b/iu,
  music: /\b(music\w*|band|choir|orchestra|ensemble|concert|recital|piano|violin|guitar|drum\w*|sing\w*|abrsm|trinity|composition|jazz)\b/iu,
  design: /\b(design\w*|dt|product|prototype|cad|3d print\w*|engineering|maker|woodwork|textiles)\b/iu,
  languages: /\b(languages?|english|french|spanish|mandarin|chinese|japanese|thai|german|korean|delf|dele|hsk|jlpt|debate|mun|model united nations|literature|poetry|writing)\b|ภาษา/iu,
  art: /\b(art|arts|painting|drawing|ceramics|pottery|sculpture|photograph\w*|film|theatre|theater|drama|exhibition|gallery|calligraphy|visual arts|creativity)\b/iu,
};
const CAS_STRAND_LINE = { S: 'service', A: 'sport', C: 'art' };

// Suggests up to two of the student's own lines for an item, best first. A student's sub-line wins
// over its school line when the item mentions the sub-line's name.
export function suggestLines(text, student, lines, { type, strand } = {}) {
  if (!student) return [];
  const own = student.laneOrder || [];
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const root = (id) => lineById.get(id)?.parentLineId || id;
  const t = ` ${String(text || '').toLowerCase()} `;
  const scored = [];
  for (const [schoolId, re] of Object.entries(LINE_WORDS)) {
    const hits = (t.match(new RegExp(re.source, 'giu')) || []).length;
    let score = hits * 2;
    if (type && ({ sport: 'sport', service: 'service' }[type] === schoolId)) score += 2;
    if (strand && CAS_STRAND_LINE[strand] === schoolId) score += 1;
    if (!score) continue;
    const subs = own.filter((id) => root(id) === schoolId && id !== schoolId);
    const named = subs.find((id) => normName(lineById.get(id)?.name).split(' ').some((w) => w.length >= 4 && t.includes(w)));
    const pick = named || (own.includes(schoolId) ? schoolId : subs[0]);
    if (pick) scored.push([pick, score + (named ? 1 : 0)]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.filter(([, s], i) => i === 0 || (i === 1 && s >= scored[0][1])).map(([id]) => id);
}

// ── Types ─────────────────────────────────────────────────────────────
export const TYPES = ['class', 'assessment', 'project', 'competition', 'cas', 'club', 'sport', 'service', 'award'];
export function guessType(text, fallback = 'project') {
  const t = String(text || '').toLowerCase();
  if (/\b(award|prize|certificate|medal|winner|honour|honor)\b/.test(t)) return 'award';
  if (/\b(competition|olympiad|hackathon|contest|championship|finals?)\b/.test(t)) return 'competition';
  if (/\b(fixture|match|gala|tournament|race|vs\.?|versus)\b/.test(t)) return 'sport';
  if (/\b(volunteer|service|charity|clean[- ]up)\b/.test(t)) return 'service';
  if (/\b(club|society|rehearsal|ensemble|choir|band)\b/.test(t)) return 'club';
  if (/\b(test|exam|quiz|assessment|essay|lab report|oral|mock)\b/.test(t)) return 'assessment';
  return fallback;
}
export function readType(raw, text, fallback) {
  const t = normHeader(raw);
  if (!t) return guessType(text, fallback);
  const alias = { lesson: 'class', course: 'class', test: 'assessment', exam: 'assessment', grade: 'assessment', summative: 'assessment', formative: 'assessment', sports: 'sport', fixture: 'sport', volunteering: 'service', prize: 'award', creativity: 'cas', activity: 'cas' };
  return TYPES.find((x) => x === t) || alias[t] || guessType(`${raw} ${text}`, fallback);
}

// ── Candidates ────────────────────────────────────────────────────────
export function hashId(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h.toString(36);
}
export const slug = (s) => normName(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
export const safeUrl = (u) => (/^https?:\/\/[^\s]+$/i.test(String(u || '').trim()) ? String(u).trim() : null);

// The inbox shape every importer produces. The id comes from the student and the source reference,
// so importing the same export twice gives the same ids (and the second import adds nothing).
export function makeCandidate({ student, title, date, type, summary = '', evidence = [], verification, system, ref, sourceId, lines, extra = {} }) {
  const suggestedLineIds = suggestLines(`${title} ${summary} ${extra.about || ''}`, student, lines, { type, strand: extra.cas?.strand });
  return {
    id: `ev-imp-${hashId(`${student.id}|${system}|${ref}`)}`, studentId: student.id, title: String(title).slice(0, 140), date, lineIds: [], suggestedLineIds,
    type, summary: String(summary).slice(0, 600), evidence, verification, visibility: 'advisor', source: { system, ref }, sourceId, ...extra,
  };
}

// The row-level result every parser returns, for the preview table.
// { row, label, studentId, studentName, matchedBy, candidate, problem, warnings }
export function rowResult(row, label, match, candidate, problem, warnings = []) {
  return { row, label, studentId: match?.student?.id || null, studentName: match?.student?.name || null, matchedBy: match?.by || null, candidate: problem ? null : candidate, problem: problem || null, warnings };
}
