import { useState } from 'react';
import { VerifyBadge } from './Badge.jsx';
import RecordInspector from './RecordInspector.jsx';
import { addCheckIn, completeGoal, getTeacher, setVisibility, TODAY } from '../api.js';
import { fmtDate, fmtTerm, TYPE_LABEL, VIS_LABEL, VERIFY_HELP } from '../format.js';

const KIND_ICON = { link: '↗', file: '▤', image: '▣', grade: '✓', certificate: '★' };

export default function StationPanel({ event, map, onClose, readOnly = false, onAsk }) {
  const open = !!event;
  const [inspect, setInspect] = useState(null);
  return (
    <aside className={`station-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Station details">
      {event && (
        <div className="panel-inner" key={event.id}>
          <div className="panel-grab" aria-hidden="true" />
          <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
          <div className="panel-type">{event.lineIds.length > 1 ? 'Interchange · ' : ''}{TYPE_LABEL[event.type]}</div>
          <h2>{event.title}</h2>
          <div className="panel-date">{fmtDate(event.date)} · {fmtTerm(event.date, map.student.g9StartYear, map.student.startGrade)}</div>
          <div className="chips">
            {event.lineIds.map((id) => {
              const l = map.lines.find((x) => x.id === id);
              return l && <span key={id} className="line-chip static" style={{ '--c': l.colour }}><i />{l.name}</span>;
            })}
          </div>
          <p className="panel-summary">{event.summary}</p>
          {event.about && <p className="panel-about">{event.about}</p>}
          {event.type === 'goal' && <GoalBox event={event} readOnly={readOnly} />}
          <VerifyBadge level={event.verification} large event={event} />
          <span className="vhelp">{VERIFY_HELP[event.verification]}</span>

          {event.evidence.length > 0 && (
            <section>
              <h3>Evidence</h3>
              <ul className="evidence">
                {event.evidence.filter((ev) => ev.kind === 'image').map((ev, i) => (
                  <li key={`img-${i}`} className="ev-image"><img src={ev.url} alt={ev.caption} loading="lazy" /><span><b>{ev.caption}</b><small>image</small></span></li>
                ))}
                {event.evidence.filter((ev) => ev.kind !== 'image').map((ev, i) => (
                  <li key={i}>
                    <span className="ev-icon" aria-hidden="true">{KIND_ICON[ev.kind]}</span>
                    <span><b>{ev.caption}</b><small>{ev.kind}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {event.endorsements?.map((n) => (
            <section key={n.id} className="endorsement">
              <h3>Teacher endorsement</h3>
              <blockquote>“{n.note}”</blockquote>
              <div className="who">{n.teacher?.name}, {n.teacher?.role} · {fmtDate(n.date)}</div>
            </section>
          ))}

          {event.reflections?.map((r) => (
            <section key={r.id} className="reflection">
              <h3>Reflection{!readOnly && <span className="vis-tag">· {VIS_LABEL[r.visibility || 'private']}</span>}</h3>
              <div className="prompt">Signal: {r.prompt}</div>
              {r.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
            </section>
          ))}

          <dl className="meta">
            <dt>Source</dt><dd>{event.source.system}{event.source.ref ? ` · ${event.source.ref}` : ''}</dd>
            {!readOnly && <><dt>Visibility</dt><dd>{event.type === 'goal' ? <span className={`vis vis-${event.visibility}`}>{VIS_LABEL[event.visibility]}</span> : (
              <select className="vis-select" value={event.visibility} onChange={(ev) => setVisibility(event.id, ev.target.value)} aria-label="Who can see this station">
                {Object.entries(VIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>)}</dd></>}
          </dl>
          <button className="ghost small-btn" onClick={() => setInspect(event.id)}>View record</button>
          {onAsk && <AskBox key={event.id} first={map.student.name.split(' ')[0]} onAsk={(t) => onAsk(event.id, t)} />}
          {!readOnly && <p className="fineprint">Verified facts can be included, excluded or reordered in a presentation, never edited.</p>}
        </div>
      )}
      {inspect && <RecordInspector eventId={inspect} onClose={() => setInspect(null)} />}
    </aside>
  );
}

const SP_STATUS = { invited: 'Invitation sent', accepted: 'Sponsoring', declined: 'Declined', done: 'Waiting for endorsement' };

// A planned station: its target, its sponsor and the check-ins along the way.
function GoalBox({ event, readOnly }) {
  const [text, setText] = useState('');
  const sp = event.sponsor;
  const t = sp && getTeacher(sp.teacherId);
  const days = Math.round((new Date(event.date) - new Date(TODAY)) / 86400000);
  return (
    <section className="goal-box">
      <div className="goal-when">{event.requirement ? 'Requirement from ManageBac' : 'Planned'} · {days >= 0 ? `in ${days} days` : `${-days} days ago`}</div>
      {sp && (
        <div className="sponsor">
          <div className="sp-top"><b>Sponsor: {t.name}</b><span className={`app-st sp-${sp.status}`}>{SP_STATUS[sp.status]}</span></div>
          {sp.expectations && <p className="sp-exp"><small>Expectations</small>{sp.expectations}</p>}
          {sp.checkIns.length > 0 && <ul className="sp-log">{sp.checkIns.map((c, i) => <li key={i}><small>{fmtDate(c.date)} · {c.by === 'student' ? 'You' : getTeacher(c.by)?.name}</small>{c.text}</li>)}</ul>}
          {!readOnly && sp.status === 'accepted' && (
            <div className="sp-add"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Post an update for ${t.name.split(' ')[0]} ${t.name.split(' ').at(-1)}`} aria-label="Update for your sponsor" /><button className="ghost" disabled={text.trim().length < 4} onClick={() => { addCheckIn(event.id, text.trim(), 'student'); setText(''); }}>Post</button></div>
          )}
        </div>
      )}
      {!readOnly && !event.requirement && <button className="primary small-btn" onClick={() => completeGoal(event.id)}>It happened: make it a station</button>}
      {!readOnly && sp?.status === 'accepted' && <p className="fineprint">Marking it done sends it to {t.name} to endorse in one click.</p>}
    </section>
  );
}

// E4 (reader side): ask the student for more evidence on one station.
function AskBox({ first, onAsk }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (sent) return <p className="ask-sent">Sent. {first} decides whether to share more.</p>;
  return (
    <section className="ask-box">
      <h3>Want to see more?</h3>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Could we see the code?" aria-label={`Ask ${first} for more evidence`} />
      <button className="ghost small-btn" disabled={text.trim().length < 4} onClick={() => { onAsk(text.trim()); setSent(true); }}>Ask {first}</button>
    </section>
  );
}
