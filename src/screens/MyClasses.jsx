import { useMemo, useState } from 'react';
import { applyLens, classesOf, classRoster, getRequests, getStudent, getStudentMap, VISIBLE_TO } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { AskClassDialog, ClassQuestions } from '../components/ClassPrompts.jsx';
import './classes.css';

// Pilot: a teacher's classes from the class lists. #/<persona>/classes, /classes/<classId>,
// /classes/<classId>~<studentId> (that student's map, read only).
export default function MyClasses({ teacherId, param, go, persona, version, toast }) {
  const [classId, studentId] = String(param || '').split('~');
  if (classId && studentId) return <StudentRead classId={classId} studentId={studentId} teacherId={teacherId} go={go} persona={persona} version={version} />;
  if (classId) return <ClassPage classId={classId} teacherId={teacherId} go={go} persona={persona} version={version} toast={toast} />;
  return <ClassList teacherId={teacherId} go={go} persona={persona} version={version} toast={toast} />;
}

const Line = ({ line }) => (line
  ? <span className="line-chip static" style={{ '--c': line.colour }}><i className={line.pattern === 'cased' ? 'cased' : undefined} />{line.name}</span>
  : <span className="line-chip static off"><i />Not on a line yet</span>);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Waiting({ teacherId, go, persona }) {
  const n = getRequests(teacherId).length;
  return (
    <div className="meter">
      <a className="mc-wait" href={`#/${persona.id}/queue`} onClick={(e) => { e.preventDefault(); go(persona.id, 'queue'); }}><b>{n}</b><span>Waiting for you</span></a>
    </div>
  );
}

function ClassList({ teacherId, go, persona, version, toast }) {
  const classes = useMemo(() => classesOf(teacherId), [teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [asking, setAsking] = useState(null);
  const students = new Set(classes.flatMap((c) => c.studentIds)).size;
  return (
    <div className="page mc">
      <header className="page-head">
        <div>
          <div className="kicker">My classes</div>
          <h1>{plural(classes.length, 'class', 'classes')}, {plural(students, 'student')}</h1>
          <p>From the school’s class lists. Moments count what students added on the class’s line in the last 30 days.</p>
        </div>
        <Waiting teacherId={teacherId} go={go} persona={persona} />
      </header>
      {!classes.length && <div className="empty-state"><b>No classes yet.</b> Your classes appear here once the school imports its class lists.</div>}
      {classes.length > 0 && (
        <ul className="mc-list">
          {classes.map((c) => (
            <li key={c.id}>
              <a href={`#/${persona.id}/classes/${c.id}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'classes', c.id); }}>
                <span className="mc-name"><b>{c.name}</b><small>Year {c.year}{c.subject ? ` · ${c.subject}` : ''}</small></span>
                <Line line={c.line} />
                <span className="mc-num"><b>{c.studentIds.length}</b><small>{c.studentIds.length === 1 ? 'student' : 'students'}</small></span>
                <span className="mc-num"><b>{c.line ? c.recent : '–'}</b><small>{c.recent === 1 ? 'moment' : 'moments'}, 30 days</small></span>
              </a>
              <button className="ghost cp-askbtn" disabled={!c.studentIds.length} onClick={() => setAsking(c)}>Ask the class</button>
            </li>
          ))}
        </ul>
      )}
      {asking && <AskClassDialog c={asking} teacherId={teacherId} toast={toast} onClose={() => setAsking(null)} />}
    </div>
  );
}

function ClassPage({ classId, teacherId, go, persona, version, toast }) {
  const c = useMemo(() => classRoster(classId, teacherId), [classId, teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [asking, setAsking] = useState(false);
  const back = <button className="cb-back" onClick={() => go(persona.id, 'classes')}>‹ My classes</button>;
  if (!c || !c.teacherIds?.includes(teacherId)) return <div className="page mc">{back}<div className="empty-state"><b>This class is not one of yours.</b></div></div>;
  return (
    <div className="page mc">
      {back}
      <header className="page-head">
        <div>
          <div className="kicker">Year {c.year}{c.subject ? ` · ${c.subject}` : ''}</div>
          <h1>{c.name}</h1>
          <p><Line line={c.line} /> {plural(c.students.length, 'student')}{!c.line && ' · moments show here once a coordinator puts this subject on a line'}</p>
        </div>
        <div className="cp-head-acts">
          <button className="primary" disabled={!c.students.length} onClick={() => setAsking(true)}>Ask the class</button>
          <Waiting teacherId={teacherId} go={go} persona={persona} />
        </div>
      </header>
      {asking && <AskClassDialog c={c} teacherId={teacherId} toast={toast} onClose={() => setAsking(false)} />}
      <ClassQuestions c={c} teacherId={teacherId} go={go} persona={persona} version={version} toast={toast} />
      {!c.students.length && <div className="empty-state"><b>No students in this class right now.</b></div>}
      {c.students.length > 0 && (
        <table className="mc-table">
          <thead><tr><th>Student</th><th>Year</th><th>Homeroom</th><th>Last moment{c.line ? ` on ${c.line.name}` : ''}</th><th>Asked you</th></tr></thead>
          <tbody>
            {c.students.map(({ student: s, last, pending }) => (
              <tr key={s.id}>
                <td><a href={`#/${persona.id}/classes/${c.id}~${s.id}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'classes', `${c.id}~${s.id}`); }}>{s.name}</a></td>
                <td>Year {s.grade + 1}</td>
                <td>{s.homeroom || '–'}</td>
                <td>{last ? <>{last.title} <small>{fmtDate(last.date)}</small></> : <small>None yet</small>}</td>
                <td>{pending ? <a href={`#/${persona.id}/queue`} onClick={(e) => { e.preventDefault(); go(persona.id, 'queue'); }}>{plural(pending, 'request')}</a> : <small>–</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// A student's map as a teacher reads it: school-level stations, plus any the student asked this teacher about or
// that they sponsor (their advisor also sees advisor-level ones).
function StudentRead({ classId, studentId, teacherId, go, persona, version }) {
  const s = getStudent(studentId);
  const viewer = s?.advisorId === teacherId ? 'advisor' : 'school';
  const map = useMemo(() => {
    if (!s) return null;
    const m = getStudentMap(studentId, 'advisor');
    if (viewer === 'advisor') return m;
    const asked = new Set(getRequests(teacherId, null).map((r) => r.eventId));
    return { ...m, signals: [], events: m.events.filter((e) => VISIBLE_TO.school.includes(e.visibility) || asked.has(e.id) || e.sponsor?.teacherId === teacherId) };
  }, [studentId, viewer, teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => map && applyLens(map, null), [map]);
  const [sel, setSel] = useState(null);
  const c = useMemo(() => classRoster(classId, teacherId), [classId, teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = <button className="cb-back" onClick={() => go(persona.id, 'classes', classId)}>‹ {c?.name || 'My classes'}</button>;
  if (!s || !c?.students.some((x) => x.student.id === studentId)) return <div className="page mc">{back}<div className="empty-state"><b>This student is not in this class.</b></div></div>;
  return (
    <div className="adv-student mc-read">
      <div className="as-head">
        {back}
        <span className="pres-avatar" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>
        <div><h1>{s.name}</h1><p>Year {s.grade + 1} · {s.programme}{s.homeroom ? ` · ${s.homeroom}` : ''} · {viewer === 'advisor' ? 'advisor view' : 'teacher view (school items, and what they asked you about)'}</p></div>
      </div>
      {map.events.length ? (
        <div className="as-body">
          <div className="as-map">
            <MetroMap recent map={map} lens={lens} selectedId={sel} onSelect={setSel} fitKey={`mc-${studentId}`} />
            <StationPanel event={map.events.find((e) => e.id === sel)} map={map} onClose={() => setSel(null)} readOnly />
          </div>
        </div>
      ) : <div className="page"><div className="empty-state"><b>Nothing on {s.name.split(' ')[0]}’s map that you can see yet.</b></div></div>}
    </div>
  );
}
