import { useMemo, useState } from 'react';
import { CAS_STATUSES, casNudge, getCasNudges, getCasProject, getStore, getStudentMap, getStudents, setCasProject, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { OUTCOMES } from '../components/AddStation.jsx';
import StationPanel from '../components/StationPanel.jsx';

const STRAND = { C: 'Creativity', A: 'Activity', S: 'Service' };

// The CAS coordinator's grid: the seven learning outcomes for every DP student, filled from tagged stations.
export default function CasDashboard({ version, persona, toast }) {
  const students = getStudents({ includeCohort: true }).filter((s) => s.grade >= 11).sort((a, b) => a.name.localeCompare(b.name));
  const events = getStore().events;
  const [cell, setCell] = useState(null); // { studentId, lo } | { studentId, strand } | { studentId, project }
  const [open, setOpen] = useState(null);
  const openMap = useMemo(() => open && getStudentMap(open.studentId, 'school'), [open, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = students.map((s) => {
    const cas = events.filter((e) => e.studentId === s.id && e.cas);
    const by = (lo) => cas.filter((e) => e.cas.outcomes.includes(lo));
    const strands = Object.fromEntries(Object.keys(STRAND).map((k) => [k, cas.filter((e) => e.cas.strand === k)]));
    return { s, cas, by, strands, covered: OUTCOMES.filter((_, i) => by(i + 1).length).length };
  });
  const list = cell && (() => {
    const r = rows.find((x) => x.s.id === cell.studentId);
    return cell.lo ? r.by(cell.lo) : cell.strand ? r.strands[cell.strand] : r.cas;
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
        <p className="swipe-hint" aria-hidden="true">Swipe the table sideways for all seven outcomes →</p>
        <div className="cas-table" role="table" aria-label="CAS learning outcomes by student">
          <div className="cas-row head" role="row">
            <span role="columnheader">Student</span>
            {OUTCOMES.map((o, i) => <span key={o} role="columnheader" title={o}><b>LO{i + 1}</b><small>{o}</small></span>)}
            <span role="columnheader">C · A · S balance</span>
            <span role="columnheader">CAS project</span>
          </div>
          {rows.map((r) => (
            <div key={r.s.id} className="cas-row" role="row">
              <span role="rowheader" className="cas-name"><span className="pres-avatar xs" style={{ background: r.s.avatar.colour }}>{r.s.avatar.initials}</span>{r.s.name}<small>Y{r.s.grade + 1} · {r.covered}/7</small></span>
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
              <button role="cell" className={`cas-proj${cell?.studentId === r.s.id && cell.project ? ' sel' : ''}`} onClick={() => setCell({ studentId: r.s.id, project: true })} aria-label={`${r.s.name}'s CAS project: ${getCasProject(r.s.id).status}. Update`}><span className={`proj proj-${getCasProject(r.s.id).status.replace(' ', '-').toLowerCase()}`}>{getCasProject(r.s.id).status}</span><small>{getCasProject(r.s.id).title}</small></button>
            </div>
          ))}
        </div>
        <aside className="cas-side">
          {!cell && <p className="fineprint">Tap a cell to see the evidence behind it.</p>}
          {cell && <Side key={`${cell.studentId}-${cell.lo || cell.strand || 'p'}`} cell={cell} student={students.find((s) => s.id === cell.studentId)} list={list} fresh={fresh} persona={persona} toast={toast} onOpen={(e) => setOpen({ studentId: cell.studentId, id: e.id })} />}
        </aside>
      </div>
      {open && <div className="cas-panel"><StationPanel event={openMap.events.find((e) => e.id === open.id)} map={openMap} onClose={() => setOpen(null)} readOnly /></div>}
    </div>
  );
}

// F12: the evidence opens; a gap gets a nudge; the project gets a status.
function Side({ cell, student, list, fresh, persona, toast, onOpen }) {
  const first = student.name.split(' ')[0];
  const about = cell.lo ? `LO${cell.lo} (${OUTCOMES[cell.lo - 1]})` : cell.strand ? `the ${STRAND[cell.strand]} strand` : 'the CAS project';
  const [text, setText] = useState(list.length ? `Nice work on ${about}. Could you add a reflection on what you learned?` : `I can’t see anything for ${about} yet. Is there something you did that counts? Tag it, or let’s talk about ideas.`);
  const proj = getCasProject(student.id);
  const [status, setStatus] = useState(proj.status);
  const [title, setTitle] = useState(proj.title);
  const nudges = getCasNudges(student.id);
  return (
    <>
      <h3>{student.name}</h3>
      <p className="kicker">{cell.lo ? `LO${cell.lo} · ${OUTCOMES[cell.lo - 1]}` : cell.strand ? `${STRAND[cell.strand]} strand` : 'CAS project'}</p>
      {cell.project ? (
        <div className="cas-form">
          <label>Project<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is the project?" /></label>
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>{CAS_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button className="primary small-btn" disabled={status === proj.status && title === proj.title} onClick={() => { setCasProject(student.id, status, title.trim(), persona.name); toast(`${first}’s CAS project is now ${status.toLowerCase()}`); }}>Save</button>
          {proj.updated && <p className="fineprint">Last updated {fmtDate(proj.updated)}.</p>}
          {list.length > 0 && <p className="fineprint">{list.length} CAS station{list.length === 1 ? '' : 's'} so far.</p>}
        </div>
      ) : (
        <>
          {!list.length && <p className="fineprint">No stations yet.</p>}
          <ul className="ev-list cas-evs">{list.map((e) => <li key={e.id} className={fresh(e) ? 'new' : ''}><button className="linkish-row" onClick={() => onOpen(e)}><b>{e.title}</b><small>{fmtDate(e.date)} · {STRAND[e.cas.strand]} · {e.verification.replace('-', ' ')}</small></button></li>)}</ul>
        </>
      )}
      <div className="cas-nudge">
        <h4>Nudge {first}</h4>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Message to ${first}`} />
        <button className="ghost small-btn" disabled={text.trim().length < 8} onClick={() => { casNudge(student.id, about, text.trim(), persona.name); toast(`Nudge sent to ${first}`); }}>Send nudge</button>
        {nudges.length > 0 && <ul className="nudge-hist">{nudges.map((n) => <li key={n.id}><small>{fmtDate(n.date)} · about {n.about}</small>{n.text}</li>)}</ul>}
      </div>
    </>
  );
}
