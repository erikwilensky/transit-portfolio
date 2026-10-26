import { useMemo, useState } from 'react';
import { applyLens, getCohort, getTeacher } from '../api.js';
import { fmtDate } from '../format.js';
import MetroMap from './MetroMap.jsx';

export default function AdvisorGrid({ advisorId, onOpen, toast, version }) {
  const cohort = useMemo(() => getCohort(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prompted, setPrompted] = useState({});
  const advisor = getTeacher(advisorId);
  const flagged = cohort.filter((c) => c.flagFewReflections).length;
  return (
    <div className="advisor">
      <div className="adv-head">
        <div>
          <h1>Advisory 4B</h1>
          <p>{advisor.name} · {cohort.length} students · vertical tutor group, Grades 10 to 12</p>
        </div>
        <div className="adv-summary">
          <span><b>{flagged}</b> students with few reflections</span>
        </div>
      </div>
      <p className="fineprint">Advisor view shows advisor, school and publishable items. Students are listed alphabetically; the grid never ranks or compares them.</p>
      <div className="adv-grid">
        {cohort.map((c) => {
          const lens = applyLens(c, null);
          const main = !c.student.cohortOnly;
          return (
            <article key={c.student.id} className={`adv-card${c.flagFewReflections ? ' flagged' : ''}`}>
              <header>
                <span className="pres-avatar sm" style={{ background: c.student.avatar.colour }}>{c.student.avatar.initials}</span>
                <div><h3>{c.student.name}</h3><small>Grade {c.student.grade} · {c.student.programme}</small></div>
              </header>
              <button className="adv-mini" onClick={main ? () => onOpen(c.student.id) : undefined} disabled={!main} aria-label={main ? `Open ${c.student.name}'s map` : `${c.student.name}'s mini map`}>
                <MetroMap map={c} lens={lens} mini />
              </button>
              <div className="adv-stats">
                <span><b>{c.events.length}</b> stations</span>
                <span><b>{c.lines.length}</b> lines</span>
                <span><b>{c.reflectionCount}</b> reflections</span>
              </div>
              <div className="adv-foot">
                {c.flagFewReflections ? (
                  <>
                    <span className="flag">Few reflections</span>
                    <button onClick={() => { setPrompted({ ...prompted, [c.student.id]: true }); toast(`Reflection prompt sent to ${c.student.name.split(' ')[0]}`); }} disabled={prompted[c.student.id]}>
                      {prompted[c.student.id] ? 'Prompt sent' : 'Send reflection prompt'}
                    </button>
                  </>
                ) : <span className="ok">Last activity {c.lastActivity ? fmtDate(c.lastActivity) : '—'}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
