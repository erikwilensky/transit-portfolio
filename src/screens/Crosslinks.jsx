import { useState } from 'react';
import { getLine, getStudent, getTeacher, addLog, rootLine, schoolEvents, shortName } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';

// Which colleague teaches the other subject at an interchange.
const COLLEAGUE = { science: 't-02', music: 't-03', design: 't-04', languages: 't-05', art: 't-06', environment: 't-08', service: 't-08', sport: 't-07' };

const short = (n) => { const p = n.split(' '); return `${p[0]} ${p.at(-1)}`; };

// T2: the teacher's subject line where it meets other subjects, across every student who made it visible to the school.
export default function Crosslinks({ persona, toast, version }) {
  const subject = 'computing';
  const [other, setOther] = useState('all');
  const [shared, setShared] = useState({});
  const hits = schoolEvents()
    .map((e) => ({ e, roots: [...new Set(e.lineIds.map(rootLine))] }))
    .filter(({ roots }) => roots.includes(subject) && roots.length > 1)
    .sort((a, b) => b.e.date.localeCompare(a.e.date));
  const others = [...new Set(hits.flatMap((h) => h.roots.filter((r) => r !== subject)))];
  const shown = hits.filter((h) => other === 'all' || h.roots.includes(other));
  const students = new Set(hits.map((h) => h.e.studentId));
  const share = (e, lid) => {
    const t = getTeacher(COLLEAGUE[lid]);
    setShared({ ...shared, [`${e.id}:${lid}`]: true });
    addLog(e.studentId, persona.name, 'share', `${shortName(persona.name)} pointed ${t.name} to “${e.title}”`);
    toast(`Sent “${e.title}” to ${t.name}`);
  };
  return (
    <div className="page xlinks">
      <header className="page-head">
        <div>
          <div className="kicker">Cross-subject links · {getLine(subject).name}</div>
          <h1>Where your students’ computing meets other subjects</h1>
          <p>Every interchange on a student map where the Computing line joins another line. Only stations a student made visible to the school appear here.</p>
        </div>
        <div className="meter">
          <div><b>{hits.length}</b><span>interchanges</span></div>
          <div><b>{students.size}</b><span>students</span></div>
          <div><b>{others.length}</b><span>other subjects</span></div>
        </div>
      </header>
      <div className="chips xl-filter">
        <button className={`line-chip${other === 'all' ? '' : ' off'}`} style={{ '--c': getLine(subject).colour }} aria-pressed={other === 'all'} onClick={() => setOther('all')}><i className={getLine(subject).pattern === 'cased' ? 'cased' : undefined} />All subjects <small>{hits.length}</small></button>
        {others.map((id) => <button key={id} className={`line-chip${other === id ? '' : ' off'}`} style={{ '--c': getLine(id).colour }} aria-pressed={other === id} onClick={() => setOther(id)}><i className={getLine(id).pattern === 'cased' ? 'cased' : undefined} />{getLine(id).name} <small>{hits.filter((h) => h.roots.includes(id)).length}</small></button>)}
      </div>
      <div className="xl-list">
        {shown.map(({ e, roots }) => {
          const s = getStudent(e.studentId);
          const meets = roots.filter((r) => r !== subject);
          return (
            <article key={e.id} className="xl-card card-sec">
              <svg className="xl-glyph" width="58" height="44" viewBox="0 0 58 44" aria-hidden="true">
                <path d="M4 12 H54" stroke={getLine(subject).colour} strokeWidth="6" strokeLinecap="round" />
                {meets.slice(0, 2).map((r, i) => <path key={r} d={`M4 ${28 + i * 10} H18 L29 ${12} L40 ${28 + i * 10} H54`} stroke={getLine(r).colour} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
                <rect x="21" y="4" width="16" height={16} rx="8" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
              </svg>
              <div className="xl-main">
                <div className="xl-top"><b>{e.title}</b><VerifyBadge level={e.verification} /></div>
                <small>{s.name} · Year {s.grade + 1} · {TYPE_LABEL[e.type]} · {fmtDate(e.date)}</small>
                <p>{e.summary}</p>
                <div className="chips small">{roots.map((r) => <span key={r} className="line-chip static" style={{ '--c': getLine(r).colour }}><i className={getLine(r).pattern === 'cased' ? 'cased' : undefined} />{getLine(r).name}</span>)}</div>
              </div>
              <div className="xl-act">
                {meets.filter((r) => COLLEAGUE[r]).map((r) => { const t = getTeacher(COLLEAGUE[r]); const done = shared[`${e.id}:${r}`]; return (
                  <button key={r} className="ghost" disabled={done} onClick={() => share(e, r)}>{done ? `Sent to ${short(t.name)}` : `Tell ${short(t.name)}`}</button>
                ); })}
              </div>
            </article>
          );
        })}
      </div>
      <p className="fineprint">"Tell" sends your colleague a pointer to the station. It does not change what the student shared.</p>
    </div>
  );
}
