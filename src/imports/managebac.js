// ManageBac exports, saved as CSV.
//
// CAS: Year Group › CAS › Export to Excel gives a workbook whose "Experiences by Student" sheet has
// First Name, Last Name, Student ID, CAS Advisor, CAS Experience Name, CAS Experience Supervisor,
// Start Date, End Date, Status of the Activity, Completed Date (ManageBac help centre, 2026).
// Save that sheet as CSV. Columns some schools add or rename (Learning Outcomes, CAS Strands, Hours,
// Description, Reflection) are read when present, under flexible names.
//
// Tasks: ManageBac's gradebook export is one spreadsheet per class with a tab per term; its exact
// column names are not published, so both layouts are accepted: one row per student per task
// (Student…, Task, Due Date, Grade), or the gradebook grid (student columns, then one column per task).
import { parseCsv } from './csv.js';
import { STUDENT_COLS, mapColumns, cellOf, parseDate, studentMatcher, makeCandidate, rowResult, slug, readType, normHeader, safeUrl } from './common.js';
import { parseGrid } from './grid.js';

const CAS_COLS = {
  ...STUDENT_COLS,
  experience: ['CAS Experience Name', 'Experience Name', 'Experience', 'CAS Experience', 'Activity Name', 'Activity', 'Title'],
  supervisor: ['CAS Experience Supervisor', 'Supervisor', 'Supervisor Name'],
  start: ['Start Date', 'Start', 'Date', 'From'],
  end: ['End Date', 'End', 'To'],
  status: ['Status of the Activity', 'Status', 'Approval Status'],
  completed: ['Completed Date', 'Completed On', 'Completion Date'],
  outcomes: ['Learning Outcomes', 'Outcomes', 'LOs', 'Learning Outcome'],
  strands: ['CAS Strands', 'Strands', 'Strand', 'CAS Type', 'Type', 'Category'],
  hours: ['Hours', 'CAS Hours', 'Total Hours', 'Duration'],
  description: ['Description', 'Details', 'Summary', 'Goals'],
  reflection: ['Reflection', 'Reflections', 'Reflection Text', 'Latest Reflection'],
  link: ['Link', 'URL', 'Evidence'],
};

// The seven IB CAS learning outcomes, by number or by the words ManageBac shows.
const LO_WORDS = [/strength|growth/i, /challenge|new skill/i, /initiat|plan/i, /commitment|perseverance/i, /collaborat|working with others/i, /global|engage.*issue/i, /ethic/i];
export function readOutcomes(raw) {
  const s = String(raw || '');
  const nums = [...s.matchAll(/(?:lo|outcome)?\s*#?\s*([1-7])\b/gi)].map((m) => +m[1]);
  const words = LO_WORDS.map((re, i) => (re.test(s) ? i + 1 : 0)).filter(Boolean);
  return [...new Set([...nums, ...words])].sort((a, b) => a - b);
}
export function readStrand(raw, text = '') {
  const s = `${raw || ''}`.toLowerCase();
  const m = s.match(/creativ|activ|servic|\b[cas]\b/g);
  if (m) { const first = m[0]; return first.startsWith('creativ') || first === 'c' ? 'C' : first.startsWith('activ') || first === 'a' ? 'A' : 'S'; }
  const t = text.toLowerCase();
  return /volunteer|service|charity|tutor|community|clean/.test(t) ? 'S' : /sport|swim|run|football|team|fitness|dance/.test(t) ? 'A' : 'C';
}

export function parseManageBacCas(text, { students, lines, today, file = 'export.csv' }) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], problems: ['The file has no rows under the headings.'] };
  const cols = mapColumns(rows[0], CAS_COLS);
  const problems = [];
  if (cols.experience === undefined) problems.push('No experience column found. Expected a heading such as “CAS Experience Name”.');
  if (cols.studentId === undefined && cols.email === undefined && cols.name === undefined && cols.first === undefined) problems.push('No student column found. Expected “Student ID”, “Email” or “First Name” and “Last Name”.');
  if (problems.length) return { items: [], problems };
  const match = studentMatcher(students);
  const items = []; const byRef = new Map();
  rows.slice(1).forEach((r, i) => {
    const c = cellOf(r, cols); const rowNo = i + 2;
    const title = c('experience');
    const m = match({ studentId: c('studentId'), email: c('email'), name: c('name'), first: c('first'), last: c('last') });
    const label = title || '(no experience name)';
    if (!title) return items.push(rowResult(rowNo, label, m, null, 'No experience name'));
    if (!m.student) return items.push(rowResult(rowNo, label, m, null, m.problem));
    if (/reject|declin|cancel/i.test(c('status'))) return items.push(rowResult(rowNo, label, m, null, `Status is “${c('status')}” in ManageBac`));
    const start = parseDate(c('start')); const end = parseDate(c('end')) || parseDate(c('completed'));
    const date = start || end;
    if (!date) return items.push(rowResult(rowNo, label, m, null, c('start') ? `Cannot read the date “${c('start')}”` : 'No start date'));
    const warnings = date > today ? ['Starts after today'] : [];
    const ref = `mb-cas:${slug(title)}:${date}`;
    const prior = byRef.get(`${m.student.id}|${ref}`);
    const refl = c('reflection');
    if (prior) { // a second row for the same experience: usually another reflection
      if (refl && prior.candidate) prior.candidate.quickReflection = [prior.candidate.quickReflection, refl].filter(Boolean).join('\n\n');
      return;
    }
    const strand = readStrand(c('strands'), `${title} ${c('description')}`);
    const outcomes = readOutcomes(c('outcomes'));
    const hours = c('hours').match(/[\d.]+/)?.[0];
    const bits = [
      c('description'),
      end && end !== date ? `${start ? 'Ran' : 'Ended'} until ${end}` : '',
      hours ? `${hours} hours` : '',
      c('supervisor') ? `Supervisor: ${c('supervisor')}` : '',
      c('status') && !/approv|complete/i.test(c('status')) ? `ManageBac status: ${c('status')}` : '',
    ].filter(Boolean);
    const link = safeUrl(c('link'));
    const cand = makeCandidate({ student: m.student, lines, title: /^cas\b/i.test(title) ? title : `CAS: ${title}`, date, type: 'cas', summary: bits.join('. '),
      evidence: link ? [{ kind: 'link', url: link, caption: 'Evidence' }] : [], verification: 'school-verified', system: 'ManageBac CAS', ref, sourceId: 'cas',
      extra: { cas: { strand, outcomes }, ...(refl ? { quickReflection: refl } : {}) } });
    const res = rowResult(rowNo, cand.title, m, cand, null, warnings);
    byRef.set(`${m.student.id}|${ref}`, res);
    items.push(res);
  });
  return { items, problems: [], file };
}

const TASK_COLS = {
  ...STUDENT_COLS,
  task: ['Task', 'Task Name', 'Task Title', 'Assessment', 'Assignment', 'Title'],
  className: ['Class', 'Class Name', 'Subject', 'Course'],
  due: ['Due Date', 'Due', 'Date', 'Task Date', 'Deadline'],
  grade: ['Grade', 'Mark', 'Score', 'Result', 'Achievement Level', 'Points'],
  outOf: ['Out Of', 'Max', 'Max Points', 'Total Points', 'Possible'],
  kind: ['Task Type', 'Type', 'Category', 'Assessment Type'],
  criteria: ['Criteria', 'Criterion', 'Assessment Criteria'],
  comment: ['Comment', 'Comments', 'Feedback', 'Teacher Comment'],
  link: ['Link', 'URL'],
};

// One row per student per task, or the gradebook grid: detected from the headings.
export function parseManageBacTasks(text, { students, lines, today, file = 'tasks.csv' }) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], problems: ['The file has no rows under the headings.'] };
  const cols = mapColumns(rows[0], TASK_COLS);
  if (cols.task === undefined) return parseGrid(rows, { students, lines, today, file, system: 'ManageBac', sourceId: 'lms', refPrefix: 'mb-task' });
  if (cols.studentId === undefined && cols.email === undefined && cols.name === undefined && cols.first === undefined) return { items: [], problems: ['No student column found. Expected “Student ID”, “Email” or “Student Name”.'] };
  const match = studentMatcher(students);
  const items = [];
  rows.slice(1).forEach((r, i) => {
    const c = cellOf(r, cols); const rowNo = i + 2;
    const task = c('task');
    const m = match({ studentId: c('studentId'), email: c('email'), name: c('name'), first: c('first'), last: c('last') });
    if (!task) return items.push(rowResult(rowNo, '(no task name)', m, null, 'No task name'));
    if (!m.student) return items.push(rowResult(rowNo, task, m, null, m.problem));
    const date = parseDate(c('due'));
    if (!date) return items.push(rowResult(rowNo, task, m, null, c('due') ? `Cannot read the date “${c('due')}”` : 'No due date'));
    const grade = c('grade'); const outOf = c('outOf');
    if (/^(missing|not submitted|excused|n\/?a|-)$/i.test(grade)) return items.push(rowResult(rowNo, task, m, null, `Marked “${grade}”: nothing to add`));
    const gradeText = grade ? (outOf && !grade.includes('/') ? `${grade}/${outOf}` : grade) : '';
    const kind = c('kind');
    const type = readType(/summative|formative|assessment|test|exam/i.test(kind) || gradeText ? 'assessment' : kind, task, 'assessment');
    const summary = [c('className'), kind, c('criteria') && `Criteria ${c('criteria')}`, gradeText && `Grade ${gradeText}`, c('comment') && `Teacher’s comment: ${c('comment')}`].filter(Boolean).join(' · ');
    const link = safeUrl(c('link'));
    const evidence = [...(gradeText ? [{ kind: 'grade', url: null, caption: `${task}: ${gradeText}` }] : []), ...(link ? [{ kind: 'link', url: link, caption: 'Task in ManageBac' }] : [])];
    const cand = makeCandidate({ student: m.student, lines, title: task, date, type, summary, evidence, verification: 'school-verified', system: 'ManageBac', ref: `mb-task:${slug(c('className'))}:${slug(task)}:${date}`, sourceId: 'lms' });
    items.push(rowResult(rowNo, task, m, cand, null, date > today ? ['Due after today'] : []));
  });
  return { items, problems: [], file };
}

export const looksLikeManageBacCas = (headers) => headers.some((h) => /experience/i.test(h)) && !headers.some((h) => normHeader(h) === 'task');
