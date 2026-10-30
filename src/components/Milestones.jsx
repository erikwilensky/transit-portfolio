import { useEffect, useMemo, useState } from 'react';
import { familyMilestones, getStudent, markMilestonesSeen, milestonesOf, milestonesSeen, daysBefore } from '../api.js';
import { RECENT_DAYS, milestoneCheer, milestoneTitle, newestFirst, since } from '../milestones.js';
import { inWeek } from '../week.js';
import { fmtDate } from '../format.js';
import { dateIn, lineName } from '../i18n.js';
import { inPreview } from '../preview.js';
import './milestones.css';

// Milestones and celebrations (src/milestones.js, docs/pilot-server.md). A new milestone is celebrated once: as soon as
// this page sees it, it is marked seen in the record (markMilestonesSeen), so a reload or another device never shows it
// again. What waits to be shown is kept for this page load, so moving between screens does not lose it.
const queue = new Map(); // studentId → milestones to celebrate on this page
const firstLook = new Map(); // studentId → keys the map already had when this page first looked, if the record had no seen state
const sent = new Map(); // studentId → keys this page has marked seen
const subs = new Set();
const ping = () => subs.forEach((f) => f());
function check(studentId) {
  if (inPreview() || !getStudent(studentId)) return;
  const all = milestonesOf(studentId, 'student'), seen = milestonesSeen(studentId);
  const mine = sent.get(studentId) || sent.set(studentId, new Set()).get(studentId);
  if (!firstLook.has(studentId)) firstLook.set(studentId, seen ? null : new Set(all.map((m) => m.key)));
  const base = firstLook.get(studentId);
  const mark = (keys) => { keys.forEach((k) => mine.add(k)); markMilestonesSeen(studentId, keys); };
  // A record from before milestones: what it already had is not news. Marked seen quietly, once.
  if (!seen && base?.size) { const ks = all.map((m) => m.key).filter((k) => !mine.has(k)); if (ks.length) mark(ks); return; }
  const fresh = all.filter((m) => !seen?.[m.key] && !mine.has(m.key) && !base?.has(m.key));
  if (!fresh.length) return;
  queue.set(studentId, [...(queue.get(studentId) || []), ...fresh]);
  mark(fresh.map((m) => m.key));
  ping();
}
const dismiss = (studentId) => { queue.delete(studentId); ping(); };
function useQueue(studentId) {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  return queue.get(studentId) || [];
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The student's own: watches for new milestones, celebrates them, and shows "My milestones". On the home at every level.
export function StudentMilestones({ studentId, version, simple }) {
  useEffect(() => { check(studentId); }, [studentId, version]);
  const list = useMemo(() => milestonesOf(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQueue(studentId);
  if (!q.length && !list.length) return null;
  return <div className={`ms-home${simple ? ' simple' : ''}`}>
    {q.length > 0 && (simple ? <BigCard list={q} onClose={() => dismiss(studentId)} /> : <Toast list={q} onClose={() => dismiss(studentId)} />)}
    {list.length > 0 && <Strip list={newestFirst(list)} title="My milestones" big={simple} limit={simple ? 4 : 6} />}
  </div>;
}

// A small station arriving on a line, in the milestone's colour. Still when the reader prefers less motion.
const Station = ({ colour, still }) => (
  <svg className={`ms-station${still ? ' still' : ''}`} viewBox="0 0 120 40" aria-hidden="true">
    <path d="M6 20H114" stroke={colour} strokeWidth="8" strokeLinecap="round" className="ms-track" />
    <circle cx="60" cy="20" r="15" className="ms-ring" stroke={colour} />
    <circle cx="60" cy="20" r="10" className="ms-dot" stroke={colour} strokeWidth="5" />
  </svg>
);

function BigCard({ list, onClose }) {
  const [m, ...more] = list, colour = m.colour || 'var(--navy)';
  return (
    <section className="ms-big" style={{ '--c': colour }} role="status" aria-live="polite">
      <Station colour={colour} still={reduced()} />
      <div className="ms-big-body">
        <small>New milestone</small>
        <h2>{milestoneTitle(m)}</h2>
        <p>{milestoneCheer(m)}</p>
        {more.length > 0 && <p className="ms-also">And: {more.map((x) => milestoneTitle(x)).join(', ')}</p>}
      </div>
      <button className="primary ms-thanks" onClick={onClose}>Yay!</button>
    </section>
  );
}

function Toast({ list, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [m, ...more] = list;
  return (
    <div className="ms-toast" style={{ '--c': m.colour || 'var(--navy)' }} role="status" aria-live="polite">
      <i aria-hidden="true" />
      <span><b>Milestone: {milestoneTitle(m)}</b><small>{milestoneCheer(m)}{more.length ? ` And ${more.length} more.` : ''}</small></span>
      <button className="ms-x" onClick={onClose} aria-label="Close">×</button>
    </div>
  );
}

// A row of milestones, newest first. Never a score: no totals, no comparison with anyone.
export function Strip({ list, title, big, lang = 'en', onOpen, limit = 6, empty }) {
  const [all, setAll] = useState(false);
  if (!list.length && !empty) return null;
  const shown = all ? list : list.slice(0, limit);
  const nameOf = (s) => lineName(lang, s);
  return (
    <section className={`ms-strip${big ? ' big' : ''}`} aria-label={title}>
      <h2>{title}</h2>
      {!list.length ? <p className="fineprint">{empty}</p> : <ul>{shown.map((m) => {
        const body = <><i style={{ background: m.colour || 'var(--navy)' }} aria-hidden="true" /><span><b>{milestoneTitle(m, lang, nameOf)}</b><small>{m.student ? `${m.student.name} · ` : ''}{dateIn(lang, m.date)}</small></span></>;
        return <li key={`${m.student?.id || ''}${m.key}`}>{onOpen ? <button onClick={() => onOpen(m)}>{body}</button> : <div>{body}</div>}</li>;
      })}</ul>}
      {list.length > limit && <button className="linkish ms-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
    </section>
  );
}

// The stations on the student's map that earned a milestone lately: a small badge on each.
export const milestoneBadges = (studentId) => new Set(since(milestonesOf(studentId, 'student'), daysBefore(RECENT_DAYS)).map((m) => m.eventId));

// My advisory: the advisees' milestones of the last two weeks, as the advisor may see them, newest first.
export function AdvisoryMilestones({ studentIds, version, onOpen }) {
  const list = useMemo(() => studentIds.flatMap((sid) => since(milestonesOf(sid, 'advisor'), daysBefore(RECENT_DAYS)).map((m) => ({ ...m, student: getStudent(sid) })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.student.name.localeCompare(b.student.name)), [studentIds.join(), version]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Strip list={list} title="Recent milestones" limit={8} empty="No new milestones in the last two weeks." onOpen={(m) => onOpen(m.student.id, m.eventId)} />;
}

// The advisor's student page: every milestone the advisor may see.
export function AdvisorStudentMilestones({ studentId, version, onOpen }) {
  const list = useMemo(() => newestFirst(milestonesOf(studentId, 'advisor')), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="card-sec ms-adv"><Strip list={list} title="Milestones" empty="None yet. They come with the first moments." onOpen={(m) => onOpen(m.eventId)} /></div>;
}

// This week: milestones the week brought to their advisees (as the advisor sees them) and class students (school level).
export function WeekMilestones({ summary, version, link }) {
  const list = useMemo(() => {
    const adv = new Set((summary.advisory?.students || []).map((s) => s.id));
    const ids = [...new Set([...adv, ...summary.classes.flatMap((c) => c.studentIds)])];
    return ids.flatMap((sid) => milestonesOf(sid, adv.has(sid) ? 'advisor' : 'school').filter((m) => inWeek(m.date, summary.week)).map((m) => ({ ...m, student: getStudent(sid), advisee: adv.has(sid) })))
      .filter((m) => m.student).sort((a, b) => b.date.localeCompare(a.date) || a.student.name.localeCompare(b.student.name));
  }, [summary, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  return (
    <div className="ms-week">
      <h3>Milestones</h3>
      <ul>{list.slice(0, 8).map((m) => { const l = link(m); const body = <><i style={{ background: m.colour || 'var(--navy)' }} aria-hidden="true" /><span><b>{milestoneTitle(m)}</b><small>{m.student.name} · {fmtDate(m.date)}</small></span></>; return <li key={`${m.student.id}${m.key}`}>{l ? <a {...l}>{body}</a> : <div>{body}</div>}</li>; })}</ul>
      {list.length > 8 && <p className="fineprint">And {list.length - 8} more.</p>}
    </div>
  );
}

// A family: only milestones from moments the family view shows.
export function FamilyMilestones({ childId, lang, version, onOpen }) {
  const list = useMemo(() => newestFirst(familyMilestones(childId)), [childId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Strip list={list} lang={lang} title={lang === 'th' ? 'ความสำเร็จสำคัญ' : 'Milestones'} onOpen={onOpen && ((m) => onOpen(m.eventId))} />;
}
