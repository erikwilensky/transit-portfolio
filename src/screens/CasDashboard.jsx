import { useMemo, useRef, useState } from 'react';
import { CAS_FLAGS, CAS_STATUSES, casCohort, casNudge, getCasNudges, getCasProject, getStudentMap, getTeacher, setCasProject, TODAY, daysBefore } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import { OUTCOMES } from '../components/AddStation.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { CasDecide, CasEntryLine, StatusChip } from '../components/Cas.jsx';
import PhraseTools, { phraseBox } from '../components/Phrases.jsx';
import '../components/cas.css';

const STRAND = { C: 'Creativity', A: 'Activity', S: 'Service' };

// The CAS coordinator's grid: the seven learning outcomes for every DP student, filled from tagged stations, with hours
// confirmed and waiting (api.casCohort) and flags. A coordinator confirms hours on a supervisor's behalf here.
export default function CasDashboard({ version, persona, toast }) {
  const [advisor, setAdvisor] = useState('');
  const all = useMemo(() => casCohort(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const advisors = useMemo(() => [...new Set(all.map((r) => r.student.advisorId).filter(Boolean))].map((id) => ({ id, name: getTeacher(id)?.name || id })).sort((a, b) => a.name.localeCompare(b.name)), [all]);
  const rows = advisor ? all.filter((r) => r.student.advisorId === advisor) : all;
  const students = rows.map((r) => r.student);
  const [cell, setCell] = useState(null); // { studentId, lo } | { studentId, strand } | { studentId, project } | { studentId, hours }
  const [open, setOpen] = useState(null);
  const openMap = useMemo(() => open && getStudentMap(open.studentId, 'school'), [open, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = cell && all.find((x) => x.student.id === cell.studentId);
  const list = row && (cell.lo ? row.outcomes[cell.lo - 1] : cell.strand ? row.strands[cell.strand] : row.experiences);
  const fresh = (e) => e.date >= daysBefore(2) && e.date <= TODAY;
  const waiting = rows.flatMap((r) => r.hours.filter((x) => x.status === 'pending')).sort((a, b) => a.at.localeCompare(b.at));
  const by = persona.teacherId || null;

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
          <div><b>{rows.reduce((n, r) => n + r.confirmed, 0)}</b><span>hours confirmed, {rows.reduce((n, r) => n + r.pending, 0)} waiting</span></div>
        </div>
      </header>
      <div className="cas-tools">
        <label>Advisor<select value={advisor} onChange={(e) => { setAdvisor(e.target.value); setCell(null); }}><option value="">All advisors</option>{advisors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <span className="cas-ok" role="status">{rows.length} student{rows.length === 1 ? '' : 's'}, {rows.filter((r) => r.flags.length).length} with a flag</span>
      </div>
      <div className="cas-wrap">
        <p className="swipe-hint" aria-hidden="true">Swipe the table sideways for all seven outcomes →</p>
        <div className="cas-table" role="table" aria-label="CAS learning outcomes by student">
          <div className="cas-row head wide" role="row">
            <span role="columnheader">Student</span>
            <span role="columnheader">Hours</span>
            <span role="columnheader">Flags</span>
            {OUTCOMES.map((o, i) => <span key={o} role="columnheader" title={o}><b>LO{i + 1}</b><small>{o}</small></span>)}
            <span role="columnheader">C · A · S balance</span>
            <span role="columnheader">CAS project</span>
          </div>
          {rows.map((r) => (
            <div key={r.student.id} className="cas-row wide" role="row">
              <span role="rowheader" className="cas-name"><span className="pres-avatar xs" style={{ background: r.student.avatar.colour, color: inkOn(r.student.avatar.colour) }}>{r.student.avatar.initials}</span>{r.student.name}<small>Y{r.student.grade + 1} · {r.covered}/7</small></span>
              <button role="cell" className={`cas-hrs${cell?.studentId === r.student.id && cell.hours ? ' sel' : ''}`} onClick={() => setCell({ studentId: r.student.id, hours: true })} aria-label={`${r.student.name}: ${r.confirmed} hours confirmed, ${r.pending} waiting`}>
                <b>{r.confirmed} h</b><small>{r.pending ? `${r.pending} h waiting` : 'none waiting'}</small>
              </button>
              <span role="cell" className="cas-flags">{r.flags.length ? r.flags.map((f) => <span key={f} className="cas-flag" title={f === 'outcome' ? `Missing: ${r.outcomes.map((l, i) => (l.length ? null : `LO${i + 1}`)).filter(Boolean).join(', ')}` : undefined}>{CAS_FLAGS[f]}</span>) : <span className="cas-ok">On track</span>}</span>
              {OUTCOMES.map((o, i) => {
                const evs = r.outcomes[i];
                const isNew = evs.some(fresh);
                return (
                  <button key={o} role="cell" className={`cas-cell${evs.length ? ' on' : ''}${isNew ? ' new' : ''}${cell?.studentId === r.student.id && cell.lo === i + 1 ? ' sel' : ''}`}
                    onClick={() => setCell({ studentId: r.student.id, lo: i + 1 })} aria-label={`${r.student.name}, ${o}: ${evs.length} stations`}>
                    {evs.length ? <><i aria-hidden="true" />{evs.length}</> : <span className="nil">–</span>}
                    {isNew && <em>new</em>}
                  </button>
                );
              })}
              <span role="cell" className="cas-bal">
                {Object.keys(STRAND).map((k) => (
                  <button key={k} className={`bal bal-${k}${r.strands[k].length ? '' : ' none'}`} onClick={() => setCell({ studentId: r.student.id, strand: k })} title={`${STRAND[k]}: ${r.strands[k].length}`}>
                    <b>{k}</b>{r.strands[k].length}
                  </button>
                ))}
              </span>
              <button role="cell" className={`cas-proj${cell?.studentId === r.student.id && cell.project ? ' sel' : ''}`} onClick={() => setCell({ studentId: r.student.id, project: true })} aria-label={`${r.student.name}’s CAS project: ${getCasProject(r.student.id).status}. Update`}><span className={`proj proj-${getCasProject(r.student.id).status.replace(' ', '-').toLowerCase()}`}>{getCasProject(r.student.id).status}</span><small>{getCasProject(r.student.id).title}</small></button>
            </div>
          ))}
        </div>
        <aside className="cas-side">
          {!cell && <p className="fineprint">Tap a cell to see the evidence behind it.</p>}
          {cell && row && <Side key={`${cell.studentId}-${cell.lo || cell.strand || (cell.hours ? 'h' : 'p')}`} cell={cell} row={row} list={list} fresh={fresh} persona={persona} by={by} toast={toast} onOpen={(e) => setOpen({ studentId: cell.studentId, id: e.id })} />}
        </aside>
      </div>
      <section className="cas-waiting" aria-labelledby="cas-wait-h">
        <h2 id="cas-wait-h">Hours waiting for confirmation ({waiting.length})</h2>
        <p className="fineprint">Staff supervisors confirm their own from “CAS to confirm”; outside supervisors with the student’s code. You can confirm for any supervisor, for example after a phone call.</p>
        {!waiting.length && <p className="cas-ok">Nothing waiting.</p>}
        <ul className="cas-list">{waiting.slice(0, 100).map((x) => <li key={x.id}><CasEntryLine x={x} /><span className="cas-ok">{x.supervisor ? `${x.supervisor.kind === 'outside' ? 'Outside' : 'Staff'}: ${x.supervisor.kind === 'outside' ? `${x.supervisor.name} (${x.supervisor.email})` : getTeacher(x.supervisor.teacherId)?.name || ''}` : 'No supervisor named'}</span><CasDecide x={x} by={by} via="coordinator" toast={toast} /></li>)}</ul>
      </section>
      {open && <div className="cas-panel"><StationPanel event={openMap.events.find((e) => e.id === open.id)} map={openMap} onClose={() => setOpen(null)} readOnly /></div>}
    </div>
  );
}

// F12: the evidence opens; a gap gets a nudge; the project gets a status; hours are confirmed for a supervisor.
function Side({ cell, row, list, fresh, persona, by, toast, onOpen }) {
  const student = row.student;
  const first = student.name.split(' ')[0];
  const about = cell.lo ? `LO${cell.lo} (${OUTCOMES[cell.lo - 1]})` : cell.strand ? `the ${STRAND[cell.strand]} strand` : cell.hours ? 'your CAS hours' : 'the CAS project';
  const [text, setText] = useState(cell.hours ? (row.flags.includes('reflection') ? 'I can’t see a CAS reflection from you in the last six weeks. Could you add one to an experience?' : `You have ${row.confirmed} CAS hours confirmed. Keep logging them as you go.`)
    : list.length ? `Nice work on ${about}. Could you add a reflection on what you learned?` : `I can’t see anything for ${about} yet. Is there something you did that counts? Tag it, or let’s talk about ideas.`);
  const proj = getCasProject(student.id);
  const [status, setStatus] = useState(proj.status);
  const [title, setTitle] = useState(proj.title);
  const nudges = getCasNudges(student.id);
  const box = useRef(null);
  return (
    <>
      <h3>{student.name}</h3>
      <p className="kicker">{cell.lo ? `LO${cell.lo} · ${OUTCOMES[cell.lo - 1]}` : cell.strand ? `${STRAND[cell.strand]} strand` : cell.hours ? 'CAS hours' : 'CAS project'}</p>
      {cell.project ? (
        <div className="cas-form">
          <label>Project<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is the project?" /></label>
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>{CAS_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button className="primary small-btn" disabled={status === proj.status && title === proj.title} onClick={() => { setCasProject(student.id, status, title.trim(), persona.name); toast(`${first}’s CAS project is now ${status.toLowerCase()}`); }}>Save</button>
          {proj.updated && <p className="fineprint">Last updated {fmtDate(proj.updated)}.</p>}
          {list.length > 0 && <p className="fineprint">{list.length} CAS station{list.length === 1 ? '' : 's'} so far.</p>}
        </div>
      ) : cell.hours ? (
        <>
          <p className="fineprint">{row.confirmed} hours confirmed, {row.pending} waiting.{row.lastReflection ? ` Last reflection ${fmtDate(row.lastReflection)}.` : ' No reflection yet.'}</p>
          {!row.hours.length && <p className="fineprint">No hours logged yet.</p>}
          <ul className="cas-list">{[...row.hours].sort((a, b) => b.date.localeCompare(a.date)).map((x) => (
            <li key={x.id}><CasEntryLine x={x} who={false} /><StatusChip status={x.status} />{x.status === 'pending' && <CasDecide x={x} by={by} via="coordinator" toast={toast} />}
              {x.decided && <small>{x.decided.name}{x.decided.via === 'code' ? ' (by code)' : x.decided.via === 'coordinator' ? ' (CAS coordinator)' : ''}{x.decided.comment ? `: “${x.decided.comment}”` : ''}</small>}</li>
          ))}</ul>
        </>
      ) : (
        <>
          {!list.length && <p className="fineprint">No stations yet.</p>}
          <ul className="ev-list cas-evs">{list.map((e) => <li key={e.id} className={fresh(e) ? 'new' : ''}><button className="linkish-row" onClick={() => onOpen(e)}><b>{e.title}</b><small>{fmtDate(e.date)} · {STRAND[e.cas.strand]} · {e.verification.replace('-', ' ')}</small></button></li>)}</ul>
        </>
      )}
      <div className="cas-nudge">
        <h4>Nudge {first}</h4>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Message to ${first}`} {...phraseBox(box)} />
        <PhraseTools value={text} onChange={setText} first={first} kind="next" box={box} />
        <button className="ghost small-btn" disabled={text.trim().length < 8} onClick={() => { casNudge(student.id, about, text.trim(), persona.name); toast(`Nudge sent to ${first}`); }}>Send nudge</button>
        {nudges.length > 0 && <ul className="nudge-hist">{nudges.map((n) => <li key={n.id}><small>{fmtDate(n.date)} · about {n.about}</small>{n.text}</li>)}</ul>}
      </div>
    </>
  );
}
