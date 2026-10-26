import { useState } from 'react';
import { VerifyBadge } from './Badge.jsx';
import RecordInspector from './RecordInspector.jsx';
import { addCheckIn, addReflection, completeGoal, deleteStation, editStation, getTeacher, getTeachers, requestEndorsement, requestFor, resubmit, setVisibility, snapshot, TODAY } from '../api.js';
import { createPortal } from 'react-dom';
import { fmtTerm, TYPE_LABEL, VIS_LABEL, VERIFY_HELP } from '../format.js';
import { dateIn, daysIn, lineName, termText, tr, useLang } from '../i18n.js';

const KIND_ICON = { link: '↗', file: '▤', image: '▣', grade: '✓', certificate: '★' };

export default function StationPanel({ event, map, onClose, readOnly = false, onAsk, toast }) {
  const open = !!event;
  const [inspect, setInspect] = useState(null);
  const [view, setView] = useState(null); // evidence item open in the lightbox
  const lang = useLang();
  const t = (s) => tr(lang, s);
  const fmtDate = (d) => dateIn(lang, d);
  return (
    <aside className={`station-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Station details">
      {event && (
        <div className="panel-inner" key={event.id}>
          <div className="panel-grab" aria-hidden="true" />
          <button className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
          <div className="panel-type">{event.lineIds.length > 1 ? `${t('Interchange')} · ` : ''}{t(TYPE_LABEL[event.type])}</div>
          <h2>{event.title}</h2>
          <div className="panel-date">{fmtDate(event.date)} · {termText(lang, fmtTerm(event.date, map.student.g9StartYear, map.student.startGrade))}</div>
          <div className="chips">
            {event.lineIds.map((id) => {
              const l = map.lines.find((x) => x.id === id);
              return l && <span key={id} className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{lineName(lang, l.name)}</span>;
            })}
          </div>
          <p className="panel-summary">{event.summary}</p>
          {event.about && <p className="panel-about">{event.about}</p>}
          {event.type === 'goal' && <GoalBox event={event} readOnly={readOnly} lang={lang} />}
          {!readOnly && event.type !== 'goal' && <StudentActions key={event.id} event={event} onClose={onClose} toast={toast} />}
          <VerifyBadge level={event.verification} large event={event} />
          <span className="vhelp">{t(VERIFY_HELP[event.verification])}</span>

          {event.evidence.length > 0 && (
            <section>
              <h3>{t('Evidence')}</h3>
              <ul className="evidence">
                {event.evidence.filter((ev) => ev.kind === 'image').map((ev, i) => (
                  <li key={`img-${i}`} className="ev-image"><button className="ev-open" onClick={() => setView(ev)} aria-label={`Open ${ev.caption} full size`}><img src={ev.url} alt={ev.caption} loading="lazy" /></button><span><b>{ev.caption}</b><small>{t('image')}</small></span></li>
                ))}
                {event.evidence.filter((ev) => ev.kind !== 'image').map((ev, i) => (
                  <li key={i}>
                    <button className="ev-open ev-row" onClick={() => setView(ev)}>
                      <span className="ev-icon" aria-hidden="true">{KIND_ICON[ev.kind]}</span>
                      <span><b>{ev.caption}</b><small>{t(ev.kind)} · {t('open')}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {event.endorsements?.map((n) => (
            <section key={n.id} className="endorsement">
              <h3>{t('Teacher endorsement')}</h3>
              <blockquote>“{n.note}”</blockquote>
              <div className="who">{n.teacher?.name}, {n.teacher?.role} · {fmtDate(n.date)}</div>
            </section>
          ))}

          {event.reflections?.map((r) => (
            <section key={r.id} className="reflection">
              <h3>{t('Reflection')}{!readOnly && <span className="vis-tag">· {VIS_LABEL[r.visibility || 'private']}</span>}</h3>
              <div className="prompt">{t('Signal:')} {r.prompt}</div>
              {r.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
            </section>
          ))}

          <dl className="meta">
            <dt>{t('Source')}</dt><dd>{event.source.system}{event.source.ref ? ` · ${event.source.ref}` : ''}</dd>
            {!readOnly && <><dt>Visibility</dt><dd>{event.type === 'goal' ? <span className={`vis vis-${event.visibility}`}>{VIS_LABEL[event.visibility]}</span> : (
              <select className="vis-select" value={event.visibility} onChange={(ev) => setVisibility(event.id, ev.target.value)} aria-label="Who can see this station">
                {Object.entries(VIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>)}</dd></>}
          </dl>
          <button className="ghost small-btn" onClick={() => setInspect(event.id)}>{t('View record')}</button>
          {onAsk && <AskBox key={event.id} first={map.student.name.split(' ')[0]} onAsk={(t) => onAsk(event.id, t)} />}
          {!readOnly && <p className="fineprint">Verified facts can be included, excluded or reordered in a presentation, never edited.</p>}
        </div>
      )}
      {inspect && <RecordInspector eventId={inspect} onClose={() => setInspect(null)} />}
      {view && event && <EvidenceView ev={view} event={event} onClose={() => setView(null)} />}
    </aside>
  );
}

const SP_STATUS = { invited: 'Invitation sent', accepted: 'Sponsoring', declined: 'Declined', done: 'Waiting for endorsement' };

// A planned station: its target, its sponsor and the check-ins along the way.
function GoalBox({ event, readOnly, lang = 'en' }) {
  const L = (s) => tr(lang, s);
  const fmtDate = (d) => dateIn(lang, d);
  const [text, setText] = useState('');
  const sp = event.sponsor;
  const t = sp && getTeacher(sp.teacherId);
  const days = Math.round((new Date(event.date) - new Date(TODAY)) / 86400000);
  return (
    <section className="goal-box">
      <div className="goal-when">{L(event.requirement ? 'Requirement from ManageBac' : 'Planned')} · {daysIn(lang, days)}</div>
      {sp && (
        <div className="sponsor">
          <div className="sp-top"><b>{L('Sponsor:')} {t.name}</b><span className={`app-st sp-${sp.status}`}>{L(SP_STATUS[sp.status])}</span></div>
          {sp.expectations && <p className="sp-exp"><small>{L('Expectations')}</small>{sp.expectations}</p>}
          {sp.checkIns.length > 0 && <ul className="sp-log">{sp.checkIns.map((c, i) => <li key={i}><small>{fmtDate(c.date)} · {c.by === 'student' ? L('You') : getTeacher(c.by)?.name}</small>{c.text}</li>)}</ul>}
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

// F8: evidence opens. Images full size; files and links as a document stamped with where and when it came from.
function EvidenceView({ ev, event, onClose }) {
  return createPortal(
    <div className="modal-back ev-back" onClick={onClose} onKeyDown={(k) => k.key === 'Escape' && onClose()}>
      <div className={`ev-view ${ev.kind === 'image' ? 'img' : 'doc'}`} role="dialog" aria-label={ev.caption} onClick={(x) => x.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close" autoFocus>×</button>
        {ev.kind === 'image' ? <img src={ev.url} alt={ev.caption} /> : (
          <div className="ev-doc">
            <div className="ev-doc-stamp">{event.source?.system || 'Uploaded'}{event.source?.ref ? ` · ${event.source.ref}` : ''} · {fmtDate(event.date)}</div>
            <h2>{ev.caption}</h2>
            <p className="fineprint">{ev.kind === 'link' ? 'Linked page' : ev.kind === 'grade' ? 'Gradebook extract' : ev.kind === 'certificate' ? 'Certificate' : 'Document'} attached to “{event.title}”.</p>
            <div className="ev-doc-body">{(event.about || event.summary).split('. ').map((x, i) => <p key={i}>{x.replace(/\.$/, '')}.</p>)}<div className="ev-doc-lines" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ width: `${92 - (i * 13) % 40}%` }} />)}</div></div>
            <p className="fineprint">Demo document. In the real product this opens the file from {event.source?.system || 'the student’s upload'}.</p>
          </div>
        )}
        <div className="ev-cap">{ev.caption}</div>
      </div>
    </div>, document.body);
}

const STAFF = ['t-01', 't-02', 't-03', 't-04', 't-05', 't-06', 't-07', 't-08'];

// F5 and F6: what a student can do with one of their stations. Verified facts stay read-only.
function StudentActions({ event, onClose, toast = () => {} }) {
  const [mode, setMode] = useState(null); // 'reflect' | 'request' | 'edit'
  const [text, setText] = useState('');
  const [vis, setVis] = useState('advisor');
  const [teacher, setTeacher] = useState('t-01');
  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary);
  const [link, setLink] = useState('');
  const own = event.verification === 'student-added';
  const rq = requestFor(event.id);
  const t = rq && getTeacher(rq.teacherId);
  const done = (msg, snap) => { setMode(null); setText(''); toast(msg, snap); };
  return (
    <section className="st-actions">
      {rq?.status === 'returned' && (
        <div className="returned">
          <b>{t.name} asked for more</b>
          <p>“{rq.reason || 'More evidence please.'}”</p>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to the code, a photo or a file" aria-label="Evidence link" />
          <button className="primary small-btn" disabled={link.trim().length < 4} onClick={() => { const snap = snapshot(); resubmit(rq.id, { kind: 'link', url: link.trim(), caption: link.trim().replace(/^https?:\/\//, '').slice(0, 48) }); setLink(''); toast(`Resubmitted to ${t.name}`, snap); }}>Add evidence and resubmit</button>
        </div>
      )}
      {rq?.status === 'pending' && <p className="pending-note">Waiting for {t.name} to endorse{rq.resubmitted ? ' (resubmitted with more evidence)' : ''}.</p>}
      <div className="st-btns">
        <button className="ghost small-btn" aria-pressed={mode === 'reflect'} onClick={() => setMode(mode === 'reflect' ? null : 'reflect')}>Add a reflection</button>
        {own && !rq && <button className="ghost small-btn" aria-pressed={mode === 'request'} onClick={() => setMode(mode === 'request' ? null : 'request')}>Ask for an endorsement</button>}
        {own && <button className="ghost small-btn" aria-pressed={mode === 'edit'} onClick={() => setMode(mode === 'edit' ? null : 'edit')}>Edit</button>}
        {own && <button className="ghost small-btn danger" onClick={() => { const snap = snapshot(); deleteStation(event.id); onClose(); toast(`Deleted “${event.title}”`, snap); }}>Delete</button>}
      </div>
      {mode === 'reflect' && (
        <div className="st-form">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did this give you? What would you do differently?" aria-label="Reflection" />
          <div className="st-row"><select value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Who can read it">{Object.entries(VIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button className="primary small-btn" disabled={text.trim().length < 8} onClick={() => { const snap = snapshot(); addReflection({ studentId: event.studentId, eventId: event.id, prompt: 'My own reflection', text: text.trim(), visibility: vis }); done('Reflection saved', snap); }}>Save reflection</button></div>
        </div>
      )}
      {mode === 'request' && (
        <div className="st-form">
          <div className="st-row"><select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher">{getTeachers().filter((x) => STAFF.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.role}</option>)}</select></div>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="A note for the teacher (optional)" aria-label="Note for the teacher" />
          <button className="primary small-btn" onClick={() => { const snap = snapshot(); requestEndorsement(event.id, teacher, text.trim() || null); done(`Asked ${getTeacher(teacher).name} to endorse it`, snap); }}>Send request</button>
        </div>
      )}
      {mode === 'edit' && (
        <div className="st-form">
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="Summary" />
          <button className="primary small-btn" disabled={title.trim().length < 3} onClick={() => { const snap = snapshot(); editStation(event.id, { title: title.trim(), summary: summary.trim() }); done('Saved', snap); }}>Save changes</button>
        </div>
      )}
    </section>
  );
}
