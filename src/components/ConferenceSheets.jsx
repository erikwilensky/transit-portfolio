import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTeacher, TERM_START, TODAY } from '../api.js';
import { conferenceSheet } from '../conference.js';
import { fmtDate, inkOn, VERIFY_LABEL } from '../format.js';
import { printDate, printDocument, usePrintTitle } from '../print.js';
import Logo from './Logo.jsx';
import './conference.css';

// Conference sheets: an A4 one-pager per student for a parent-student-advisor conference (src/conference.js).
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const span = Math.max(1, Date.parse(TODAY) - Date.parse(TERM_START));
const at = (d) => Math.min(100, Math.max(0, ((Date.parse(d) - Date.parse(TERM_START)) / span) * 100));
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

function Strip({ line }) {
  return (
    <li className={`cf-strip${line.count ? '' : ' quiet'}`}>
      <span className="cf-ln"><i style={{ background: line.colour }} />{line.name}</span>
      <span className="cf-track">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <line x1="1" y1="5" x2="99" y2="5" stroke={line.count ? line.colour : '#9aa6b8'} strokeWidth={line.count ? 2.4 : 1} strokeDasharray={line.count ? '' : '2 2'} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="cf-dots" aria-hidden="true">{line.moments.map((e) => <i key={e.id} style={{ left: `${at(e.date)}%`, borderColor: line.colour }} />)}</span>
      </span>
      <b className="cf-n">{line.count}</b>
    </li>
  );
}

export function ConferenceSheet({ d, by }) {
  const s = d.student;
  // More lines (or the student's prep, or the next steps after the conference), fewer rows, so the page always fits.
  const max = Math.max(d.prep && d.steps ? 2 : d.prep || d.steps ? 3 : 4, Math.min(10, 14 - d.lines.length) - (d.prep ? 4 : 0) - (d.steps ? (d.steps.staff ? 4 : 3) : 0));
  const extra = d.moments.length - max;
  const colour = (e) => d.lines.find((l) => e.lineIds.includes(l.id))?.colour || '#9aa6b8';
  return (
    <article className={`cf-sheet${d.family ? ' family' : ''}`} data-student={s.id}>
      <header className="cf-head">
        <Logo className="cf-logo" />
        <span className="cf-school">NIST International School<small>Transit Portfolio</small></span>
        <span className="cf-kicker">{d.family ? 'Conference sheet · family copy' : 'Conference sheet'}</span>
      </header>
      <div className="cf-who">
        {s.photo ? <img className="cf-avatar" src={s.photo} alt="" /> : <span className="cf-avatar" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>}
        <div><h2>{s.name}</h2><p>Year {d.year}{d.homeroom ? ` · Homeroom ${d.homeroom}` : ''} · This term since {fmtDate(TERM_START)}</p></div>
        <dl className="cf-counts">
          <div><dt>Moments</dt><dd>{d.moments.length}</dd></div>
          <div><dt>Reflections</dt><dd>{d.termRefl}</dd></div>
          <div><dt>Endorsements</dt><dd>{d.termEndorse}</dd></div>
          <div><dt>Class questions</dt><dd>{d.answers.length}</dd></div>
          {d.staff && <div className="cf-staff"><dt>Comments</dt><dd>{d.staff.comments}</dd></div>}
        </dl>
      </div>

      <section className="cf-sec">
        <h3>This term, line by line</h3>
        {d.lines.length ? <ul className="cf-strips">{d.lines.map((l) => <Strip key={l.id} line={l} />)}</ul> : <p className="cf-none">No lines on the map yet.</p>}
        {d.moments.length > 0 && (
          <ol className="cf-moments">
            {d.moments.slice(-max).reverse().map((e) => (
              <li key={e.id} data-event={e.id}><i style={{ background: colour(e) }} /><span className="cf-t">{clip(e.title, 70)}</span><small>{fmtDate(e.date)}</small><span className={`cf-v ${e.verification}`}>{VERIFY_LABEL[e.verification]}</span></li>
            ))}
            {extra > 0 && <li className="cf-more">and {plural(extra, 'earlier moment')} this term</li>}
          </ol>
        )}
        {!d.moments.length && <p className="cf-none">Nothing added this term yet.</p>}
      </section>

      {d.prep && (
        <section className="cf-sec cf-prep">
          <h3>{`In ${d.first}’s words`}<small>{d.prep.ready ? 'ready for the conference' : 'getting ready'}</small></h3>
          {d.prep.picks.length > 0 && <p><b>To show:</b> {d.prep.picks.map((x) => `“${clip(x.title, 40)}”`).join(', ')}</p>}
          {d.prep.proud && <p><b>Proud of:</b> {clip(d.prep.proud, 140)}</p>}
          {d.prep.hard && <p><b>Was hard:</b> {clip(d.prep.hard, 140)}</p>}
          {d.prep.goal && <p><b>Goal:</b> {clip(d.prep.goal, 90)}</p>}
        </section>
      )}

      {d.steps && (
        <section className="cf-sec cf-steps">
          <h3>Our next steps<small>{`after the conference · ${d.steps.round}`}</small></h3>
          {d.steps.family && <p><b>What we will try at home:</b> {clip(d.steps.family, 200)}</p>}
          {d.steps.student && <p><b>What I will do next:</b> {clip(d.steps.student, 200)}</p>}
          {d.steps.staff && <p className="cf-staff"><b>Private staff note</b> <small>(advisor copy only)</small> {clip(d.steps.staff, 200)}</p>}
        </section>
      )}

      <div className="cf-cols">
        <section className="cf-sec">
          <h3>Latest reflections</h3>
          {d.reflections.length ? <ul className="cf-refl">{d.reflections.slice(0, 3).map((r) => <li key={r.id}><q>{clip(r.text, 200)}</q><small>{r.title} · {fmtDate(r.date)}</small></li>)}</ul> : <p className="cf-none">No reflections shared yet.</p>}
        </section>
        <section className="cf-sec">
          <h3>Goals</h3>
          {d.goals.length ? <><ul className="cf-goals">{d.goals.slice(0, 3).map((g) => <li key={g.id}><span className="cf-t">{clip(g.title, 60)}</span><small>{fmtDate(g.date)}{g.sponsor ? ` · sponsor ${getTeacher(g.sponsor)?.name || ''}` : ''}</small><span className={`cf-st ${g.status.replace(/\W+/g, '-').toLowerCase()}`}>{g.status}</span></li>)}</ul>{d.goals.length > 3 && <p className="cf-more">and {plural(d.goals.length - 3, 'more goal')}</p>}</> : <p className="cf-none">No goals planned yet.</p>}
          <h3>Endorsements received</h3>
          {d.endorsements.length ? <ul className="cf-end">{d.endorsements.slice(0, 2).map((n) => <li key={n.id}><b>{n.teacher}</b> on “{clip(n.title, 50)}”<small>{fmtDate(n.date)}</small></li>)}{d.endorsements.length > 2 && <li className="cf-more">and {plural(d.endorsements.length - 2, 'more')}</li>}</ul> : <p className="cf-none">None yet.</p>}
          <h3>Class questions answered</h3>
          {d.answers.length ? <ul className="cf-end">{d.answers.slice(-3).reverse().map((a) => <li key={a.id}>“{clip(a.question, 70)}”<small>{fmtDate(a.date)}</small></li>)}</ul> : <p className="cf-none">None this term.</p>}
        </section>
      </div>

      {d.staff && (d.staff.notes.length > 0 || d.staff.signals > 0) && (
        <section className="cf-sec cf-staff">
          <h3>For the advisor only</h3>
          {d.staff.signals > 0 && <p>{plural(d.staff.signals, 'open reflection signal')}.</p>}
          {d.staff.notes.map((n, i) => <p key={i} className="cf-note"><small>{fmtDate(n.date)}</small> {clip(n.text, 200)}</p>)}
        </section>
      )}

      <section className="cf-talk">
        <h3>Talking points</h3>
        <ol>{d.points.map((p) => <li key={p}>{p}</li>)}</ol>
        <div className="cf-lines" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} />)}</div>
      </section>

      <footer className="cf-foot">Prepared by {by} on {printDate()} · confidential to the student, family and school</footer>
    </article>
  );
}

// The sheets, full screen, with Print and the family-copy switch.
export function ConferenceSheets({ studentIds, advisorId, title = 'Conference sheets', family: startFamily = false, onClose }) {
  const [family, setFamily] = useState(startFamily);
  const sheets = useMemo(() => studentIds.map((id) => conferenceSheet(id, { family })), [studentIds, family]);
  const by = getTeacher(advisorId)?.name || 'the advisor';
  const name = `${title}${family ? ' (family copy)' : ''}`;
  usePrintTitle(name);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="cf-overlay" role="dialog" aria-modal="true" aria-label={name}>
      <div className="cf-bar">
        <div><b>{plural(sheets.length, 'conference sheet')}</b><small>One A4 page per student. {family ? 'Family copy: only what the family can see, without comments, notes or signals.' : 'Advisor copy: never shows private moments or reflections.'}</small></div>
        <label className="cf-check"><input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} /> Family copy</label>
        <div className="cf-actions"><button className="primary" onClick={() => printDocument(name)}>Print</button><button className="ghost" onClick={onClose}>Close</button></div>
      </div>
      {sheets.map((d) => <ConferenceSheet key={d.student.id} d={d} by={by} />)}
    </div>,
    document.body,
  );
}

// "Print conference sheets" on the advisory page: everyone, or the students ticked.
export function AdvisoryConference({ advisorId, cohort, group }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState([]);
  const [family, setFamily] = useState(false);
  const [sheet, setSheet] = useState(null);
  const ids = all ? cohort.map((c) => c.student.id) : cohort.map((c) => c.student.id).filter((id) => picked.includes(id));
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  if (!cohort.length) return null;
  if (!open) return <button className="ghost cf-open" onClick={() => setOpen(true)}>Print conference sheets</button>;
  return (
    <section className="cf-panel" aria-labelledby="cf-h">
      <h2 id="cf-h">Conference sheets</h2>
      <p className="fineprint">One A4 page per student for the parent-student-advisor conference: this term’s moments by line, latest reflections, goals, endorsements and three talking points, with space for notes. Private moments and reflections never appear.</p>
      <div className="cf-choose" role="radiogroup" aria-label="Which students">
        <label><input type="radio" name="cf-who" checked={all} onChange={() => setAll(true)} /> All {plural(cohort.length, 'student')}</label>
        <label><input type="radio" name="cf-who" checked={!all} onChange={() => setAll(false)} /> Choose students</label>
      </div>
      {!all && <fieldset className="cf-pick"><legend className="sr-only">Students</legend>{cohort.map((c) => <label key={c.student.id}><input type="checkbox" checked={picked.includes(c.student.id)} onChange={() => toggle(c.student.id)} /> {c.student.name}</label>)}</fieldset>}
      <label className="cf-check"><input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} /> Family copy: only what the family can see, to hand over</label>
      <div className="cf-actions">
        <button className="primary" disabled={!ids.length} onClick={() => setSheet(ids)}>{`Make ${plural(ids.length, 'sheet')}`}</button>
        <button className="ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
      {sheet && <ConferenceSheets studentIds={sheet} advisorId={advisorId} title={`Conference sheets – ${group}`} family={family} onClose={() => setSheet(null)} />}
    </section>
  );
}
