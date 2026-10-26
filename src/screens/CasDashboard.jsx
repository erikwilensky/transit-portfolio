import { useState } from 'react';
import { getStore, getStudents, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { OUTCOMES } from '../components/AddStation.jsx';

const STRAND = { C: 'Creativity', A: 'Activity', S: 'Service' };
const PROJECT = { 'st-01': ['Complete', 'Friday STEM club for G6 girls'], 'st-02': ['Planning', 'Sound desk crew for school events'], 'st-04': ['In progress', 'Coaching junior football'], 'st-05': ['Complete', 'Community art workshop'], 'st-07': ['Not started', null], 'st-08': ['In progress', 'Campus garden'] };

// The CAS coordinator's grid: the seven learning outcomes for every DP student, filled from tagged stations.
export default function CasDashboard({ version }) {
  const students = getStudents({ includeCohort: true }).filter((s) => s.grade >= 11).sort((a, b) => a.name.localeCompare(b.name));
  const events = getStore().events;
  const [cell, setCell] = useState(null); // { studentId, lo } | { studentId, strand }
  const rows = students.map((s) => {
    const cas = events.filter((e) => e.studentId === s.id && e.cas);
    const by = (lo) => cas.filter((e) => e.cas.outcomes.includes(lo));
    const strands = Object.fromEntries(Object.keys(STRAND).map((k) => [k, cas.filter((e) => e.cas.strand === k)]));
    return { s, cas, by, strands, covered: OUTCOMES.filter((_, i) => by(i + 1).length).length };
  });
  const list = cell && (() => {
    const r = rows.find((x) => x.s.id === cell.studentId);
    return cell.lo ? r.by(cell.lo) : r.strands[cell.strand];
  })();
  const fresh = (e) => e.date >= '2026-10-24' && e.date <= TODAY;

  return (
    <div className="page cas">
      <header className="page-head">
        <div>
          <div className="kicker">CAS · Diploma Programme</div>
          <h1>Learning outcomes across the cohort</h1>
          <p>Each cell counts stations a student tagged with that outcome. Filled from the same record the students use, so nothing is logged twice.</p>
        </div>
        <div className="meter">
          <div><b>{rows.filter((r) => r.covered === 7).length}/{rows.length}</b><span>students showing all 7 outcomes</span></div>
          <div><b>{rows.filter((r) => !r.strands.A.length || !r.strands.C.length || !r.strands.S.length).length}</b><span>with a strand missing</span></div>
        </div>
      </header>
      <div className="cas-wrap">
        <div className="cas-table" role="table" aria-label="CAS learning outcomes by student">
          <div className="cas-row head" role="row">
            <span role="columnheader">Student</span>
            {OUTCOMES.map((o, i) => <span key={o} role="columnheader" title={o}><b>LO{i + 1}</b><small>{o}</small></span>)}
            <span role="columnheader">C · A · S balance</span>
            <span role="columnheader">CAS project</span>
          </div>
          {rows.map((r) => (
            <div key={r.s.id} className="cas-row" role="row">
              <span role="rowheader" className="cas-name"><span className="pres-avatar xs" style={{ background: r.s.avatar.colour }}>{r.s.avatar.initials}</span>{r.s.name}<small>G{r.s.grade} · {r.covered}/7</small></span>
              {OUTCOMES.map((o, i) => {
                const evs = r.by(i + 1);
                const isNew = evs.some(fresh);
                return (
                  <button key={o} role="cell" className={`cas-cell${evs.length ? ' on' : ''}${isNew ? ' new' : ''}${cell?.studentId === r.s.id && cell.lo === i + 1 ? ' sel' : ''}`}
                    onClick={() => setCell({ studentId: r.s.id, lo: i + 1 })} aria-label={`${r.s.name}, ${o}: ${evs.length} stations`}>
                    {evs.length ? <><i aria-hidden="true" />{evs.length}</> : <span className="nil">–</span>}
                    {isNew && <em>new</em>}
                  </button>
                );
              })}
              <span role="cell" className="cas-bal">
                {Object.keys(STRAND).map((k) => (
                  <button key={k} className={`bal bal-${k}${r.strands[k].length ? '' : ' none'}`} onClick={() => setCell({ studentId: r.s.id, strand: k })} title={`${STRAND[k]}: ${r.strands[k].length}`}>
                    <b>{k}</b>{r.strands[k].length}
                  </button>
                ))}
              </span>
              <span role="cell" className="cas-proj"><span className={`proj proj-${(PROJECT[r.s.id]?.[0] || 'Not started').replace(' ', '-').toLowerCase()}`}>{PROJECT[r.s.id]?.[0] || 'Not started'}</span><small>{PROJECT[r.s.id]?.[1] || ''}</small></span>
            </div>
          ))}
        </div>
        <aside className="cas-side">
          {!cell && <p className="fineprint">Tap a cell to see the evidence behind it.</p>}
          {cell && (
            <>
              <h3>{students.find((s) => s.id === cell.studentId).name}</h3>
              <p className="kicker">{cell.lo ? `LO${cell.lo} · ${OUTCOMES[cell.lo - 1]}` : `${STRAND[cell.strand]} strand`}</p>
              {!list.length && <p className="fineprint">No stations yet. A gentle prompt from the advisor may help.</p>}
              <ul className="ev-list">{list.map((e) => <li key={e.id} className={fresh(e) ? 'new' : ''}><b>{e.title}</b><small>{fmtDate(e.date)} · {STRAND[e.cas.strand]} · {e.verification.replace('-', ' ')}</small></li>)}</ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
