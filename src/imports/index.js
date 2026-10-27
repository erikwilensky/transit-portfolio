// Real imports from the export files staff can already download. Every format turns a file into
// inbox candidates (the same shape a sync produces) plus a row-by-row report for the preview.
// Nothing here touches the store: api.js importCandidates() adds the candidates to the inbox.
import { parseManageBacCas, parseManageBacTasks } from './managebac.js';
import { parseClassroomTakeout, parseClassroomGrades } from './classroom.js';
import { parseGeneric, templateCsv, TEMPLATE_HEADERS } from './generic.js';
import { parseIcs } from './ics.js';
import { parseCsv } from './csv.js';

export { parseCsv, templateCsv, TEMPLATE_HEADERS };
export { studentMatcher, suggestLines, parseDate, studentEmails, DEMO_EMAIL_DOMAIN } from './common.js';

// sourceId is the integration the items count towards (api.js adds a card for a new one).
export const FORMATS = [
  { id: 'mb-cas', label: 'ManageBac: CAS experiences', system: 'ManageBac', accept: '.csv', sourceId: 'cas', staff: true,
    help: 'Year Group › CAS › Export to Excel, then save the “Experiences by Student” sheet as CSV.' },
  { id: 'mb-tasks', label: 'ManageBac: tasks and grades', system: 'ManageBac', accept: '.csv', sourceId: 'lms', staff: true,
    help: 'A class gradebook export saved as CSV: one row per student and task, or the gradebook grid.' },
  { id: 'gc-takeout', label: 'Google Classroom: Takeout', system: 'Google Classroom', accept: '.json', multiple: true, sourceId: 'classroom', staff: true,
    help: 'Google Takeout › Classroom. Unzip it and drop the JSON files for the class (several at once is fine).' },
  { id: 'gc-grades', label: 'Google Classroom: grades', system: 'Google Classroom', accept: '.csv', sourceId: 'classroom', staff: true,
    help: 'In the class Grades tab, Settings › Download these grades as CSV.' },
  { id: 'generic', label: 'Spreadsheet (our template)', system: 'Spreadsheet', accept: '.csv', sourceId: 'csv', staff: true, student: true,
    help: 'One row per item: title, date, student email or id, type, summary, link. Download the template to start.' },
  { id: 'ics', label: 'Calendar (.ics)', system: 'Calendar', accept: '.ics', sourceId: 'calendar', staff: true, student: true,
    help: 'Export a calendar of fixtures or events as .ics, from the sports calendar, Google Calendar or Outlook.' },
];
export const formatById = (id) => FORMATS.find((f) => f.id === id);

// Guesses the format from the file, so a dropped file can pick the right reader.
export function detectFormat(name, text) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.ics') || /^﻿?BEGIN:VCALENDAR/i.test(text)) return 'ics';
  if (n.endsWith('.json') || /^﻿?\s*[[{]/.test(text)) return 'gc-takeout';
  const head = (parseCsv(String(text).split(/\r?\n/).slice(0, 3).join('\n'))[0] || []).map((h) => h.toLowerCase());
  if (head.some((h) => h.includes('experience'))) return 'mb-cas';
  if (head.includes('title') && head.some((h) => h.startsWith('student'))) return 'generic';
  if (head.some((h) => /^(task|task name|assessment|assignment)$/.test(h))) return 'mb-tasks';
  if (head.includes('email address') && head.includes('first name')) return 'gc-grades';
  return null;
}

// files: [{ name, text }]. ctx: { students, lines, today, selfId?, by?, forStudentIds? }.
// Returns { format, sourceId, items, problems, candidates, counts }.
export function parseImport(formatId, files, ctx) {
  const f = formatById(formatId);
  if (!f) return { format: formatId, items: [], problems: ['Choose which system the file came from.'], candidates: [], counts: { rows: 0, ready: 0, problems: 0, students: 0 } };
  const parts = f.id === 'gc-takeout' ? [parseClassroomTakeout(files, ctx)] : files.map((file) => {
    const c = { ...ctx, file: file.name };
    const r = f.id === 'mb-cas' ? parseManageBacCas(file.text, c) : f.id === 'mb-tasks' ? parseManageBacTasks(file.text, c) : f.id === 'gc-grades' ? parseClassroomGrades(file.text, c) : f.id === 'generic' ? parseGeneric(file.text, c) : parseIcs(file.text, c);
    return { ...r, problems: r.problems.map((p) => (files.length > 1 ? `${file.name}: ${p}` : p)) };
  });
  const items = parts.flatMap((p) => p.items);
  // The same item twice in one file (or across files): keep the first.
  const seen = new Set();
  for (const it of items) if (it.candidate) { if (seen.has(it.candidate.id)) { it.problem = 'Appears twice in this import'; it.candidate = null; } else seen.add(it.candidate.id); }
  const candidates = items.filter((i) => i.candidate).map((i) => i.candidate);
  const sourceId = ctx.selfId ? 'mine' : f.sourceId;
  return { format: f.id, sourceId, items, problems: parts.flatMap((p) => p.problems), candidates,
    counts: { rows: items.length, ready: candidates.length, problems: items.filter((i) => i.problem).length, students: new Set(candidates.map((c) => c.studentId)).size } };
}
