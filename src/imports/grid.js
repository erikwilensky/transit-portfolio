// A gradebook grid: one row per student, one column per task, as Google Classroom's
// "Download grades as CSV" and ManageBac's gradebook export lay it out. Optional rows under
// the headings give each task's date or points possible. Each filled cell becomes one item.
import { STUDENT_COLS, mapColumns, cellOf, parseDate, studentMatcher, makeCandidate, rowResult, slug, normHeader } from './common.js';

const SKIP_COL = /^(average|overall|overallgrade|total|totalgrade|classaverage|percent|percentage|section|homeroom|advisor|casadvisor|gradelevel|year|yeargroup|class|status|comments?|notes?|\d+)$/;
const EMPTY_GRADE = /^(|-|—|missing|notsubmitted|notturnedin|excused|exempt|na|n\/a|ungraded|draft)$/i;
const META_LABEL = /^(points?|pointspossible|maxpoints|maximum|outof|total|possible|date|duedate|due|classaverage|average|median)/;

export function parseGrid(rows, { students, lines, today, file, system, sourceId, refPrefix }) {
  const head = rows[0];
  const cols = mapColumns(head, STUDENT_COLS);
  const studentIdx = new Set(Object.values(cols));
  if (!studentIdx.size) return { items: [], problems: ['No student column found. Expected “Email Address”, “Student ID” or “First Name” and “Last Name”.'] };
  const tasks = head.map((h, i) => ({ i, title: String(h || '').trim() })).filter((t) => t.title && !studentIdx.has(t.i) && !SKIP_COL.test(normHeader(t.title)));
  if (!tasks.length) return { items: [], problems: ['No task columns found after the student columns.'] };
  const match = studentMatcher(students);
  const dates = {}; const points = {};
  // A date written into the heading, e.g. "Lab report (12/10/2026)".
  for (const t of tasks) { const m = t.title.match(/[([]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]{2,8} \d{4})\s*[)\]]?\s*$/); if (m && parseDate(m[1])) { dates[t.i] = parseDate(m[1]); t.title = t.title.slice(0, m.index).replace(/[\s:–-]+$/, ''); } }
  const items = [];
  rows.slice(1).forEach((r, k) => {
    const rowNo = k + 2;
    const c = cellOf(r, cols);
    const who = { studentId: c('studentId'), email: c('email'), name: c('name'), first: c('first'), last: c('last') };
    const label = [...studentIdx].map((i) => r[i]).filter(Boolean).join(' ').trim();
    const taskCells = tasks.map((t) => String(r[t.i] ?? '').trim());
    // Rows under the headings that describe the tasks rather than a student.
    if (!who.email && (META_LABEL.test(normHeader(label)) || !label)) {
      if (taskCells.filter(Boolean).length && taskCells.filter(Boolean).every((v) => parseDate(v) && !/^\d+(\.\d+)?$/.test(v))) { tasks.forEach((t, j) => { if (parseDate(taskCells[j])) dates[t.i] = parseDate(taskCells[j]); }); return; }
      if (taskCells.filter(Boolean).length && taskCells.filter(Boolean).every((v) => /^\d+(\.\d+)?$/.test(v))) { tasks.forEach((t, j) => { if (taskCells[j]) points[t.i] = taskCells[j]; }); return; }
      if (META_LABEL.test(normHeader(label))) return; // class average and the like
    }
    const m = match(who);
    if (!m.student) return items.push(rowResult(rowNo, label || '(blank row)', m, null, m.problem));
    tasks.forEach((t, j) => {
      const grade = taskCells[j];
      if (EMPTY_GRADE.test(normHeader(grade)) || EMPTY_GRADE.test(grade)) return;
      const date = dates[t.i] || today;
      const warnings = dates[t.i] ? [] : ['No date in the file: dated today'];
      const g = points[t.i] && !grade.includes('/') && !grade.includes('%') ? `${grade}/${points[t.i]}` : grade;
      const cand = makeCandidate({ student: m.student, lines, title: t.title, date, type: 'assessment', summary: `${system} gradebook · Grade ${g}`,
        evidence: [{ kind: 'grade', url: null, caption: `${t.title}: ${g}` }], verification: 'school-verified', system, ref: `${refPrefix}:${slug(t.title)}:${dates[t.i] || 'undated'}`, sourceId });
      items.push(rowResult(rowNo, t.title, m, cand, null, warnings));
    });
  });
  return { items, problems: [], file };
}
