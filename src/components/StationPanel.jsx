import { useState } from 'react';
import { VerifyBadge } from './Badge.jsx';
import RecordInspector from './RecordInspector.jsx';
import { ATL, LEARNER_PROFILE, setTags, addCheckIn, addReflection, completeGoal, deleteStation, editStation, getTeacher, getTeachers, requestEndorsement, getEvent, requestFor, resubmit, setVisibility, snapshot, TODAY, endorserChoices } from '../api.js';
import { createPortal } from 'react-dom';
import EvidenceDoc, { docLabel } from './EvidenceDoc.jsx';
import { AttachButton, FileView, FILE_ICON, PendingFiles, VoiceNote, evKind, fileLabel, isUploaded } from './FileAttach.jsx';
import { docFor, useEvidenceDocs } from '../evidence/load.js';
import { fmtDate, fmtTerm, TYPE_LABEL, VIS_LABEL, VERIFY_HELP } from '../format.js';
import { dateIn, daysIn, lineName, termText, tr, useLang } from '../i18n.js';

const KIND_ICON = { link: '↗', file: '▤', image: '▣', grade: '✓', certificate: '★' };

export default function StationPanel({ event, map, onClose, readOnly = false, onAsk, toast }) {
  const open = !!event;
  const [inspect, setInspect] = useState(null);
  const [view, setView] = useState(null); // evidence item open in the lightbox
  const lang = useLang();
  const t = (s) => tr(lang, s);
  const fmtDate = (d) => dateIn(lang, d);
  const docs = useEvidenceDocs();
  return (
    <aside className={`station-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Station details">
      {event && (
        <div className="panel-inner" key={event.id}>
          <div className="panel-grab" aria-hidden="true" />
          <button className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
          <div className="panel-type">{event.lineIds.length > 1 ? `${t('Interchange')} · ` : ''}{t(TYPE_LABEL[event.type])}</div>
          <h2>{event.title}</h2>
          <div className="panel-date">{fmtDate(event.date)} · {termText(lang, fmtTerm(event.date, map.student.g9StartYear, map.student.startGrade, map.student.endGrade))}</div>
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
          {event.type !== 'goal' && event.tags && <TagBox key={`t-${event.id}`} event={event} readOnly={readOnly} t={t} />}
          <VerifyBadge level={event.verification} large event={event} />
          <span className="vhelp">{t(VERIFY_HELP[event.verification])}{event.alum && event.verification === 'student-added' ? ' Added after leaving NIST.' : ''}</span>

          {event.evidence.length > 0 && (
            <section>
              <h3>{t('Evidence')}</h3>
              <ul className="evidence">
                {event.evidence.filter((ev) => ev.kind === 'image').map((ev, i) => (
                  <li key={`img-${i}`} className="ev-image"><button className="ev-open" onClick={() => setView(ev)} aria-label={`Open ${ev.caption} full size`}><img src={ev.url} alt={ev.caption} loading="lazy" /></button><span><b>{ev.caption}</b><small>{t('image')}</small></span></li>
                ))}
                {event.evidence.filter((ev) => ev.kind !== 'image').map((ev, i) => (
                  <li key={i}>
                    {isUploaded(ev) ? <FileRow ev={ev} onOpen={() => setView(ev)} t={t} /> : (
                    <button className="ev-open ev-row" onClick={() => setView(ev)}>
                      <span className="ev-icon" aria-hidden="true">{KIND_ICON[ev.kind]}</span>
                      <span><b>{ev.caption}</b><small>{docLabel(docFor(docs, event, ev, map.student)) || t(ev.kind)} · {t('open')}</small></span>
                    </button>)}
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
              {r.text && r.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
              {r.files?.length > 0 && <ul className="evidence rf-files">{r.files.map((ev, i) => <li key={i}>{ev.kind === 'image'
                ? <button className="ev-open" onClick={() => setView(ev)} aria-label={`Open ${ev.caption} full size`}><img src={ev.url} alt={ev.caption} loading="lazy" /></button>
                : <FileRow ev={ev} onOpen={() => setView(ev)} t={t} />}</li>)}</ul>}
            </section>
          ))}

          <dl className="meta">
            <dt>{t('Source')}</dt><dd>{event.source.system}{event.source.ref ? ` · ${event.source.ref}` : ''}</dd>
            {event.mergedFrom?.length > 0 && <><dt>{t('Merged with')}</dt><dd>{event.mergedFrom.map((m) => `${m.system} · ${m.ref}`).join(', ')}{event.source.original ? ` (first added by ${event.source.original === 'Manual entry' ? 'the student' : event.source.original})` : ''}</dd></>}
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
      {view && event && <EvidenceView ev={view} event={event} student={map.student} doc={isUploaded(view) ? null : docFor(docs, event, view, map.student)} onClose={() => setView(null)} />}
    </aside>
  );
}

// N6: IB learner profile attributes and ATL skills, suggested from the station and confirmed by the student.
function TagBox({ event, readOnly, t }) {
  const [edit, setEdit] = useState(false);
  const tags = event.tags;
  const flip = (field, k) => setTags(event.id, { ...tags, [field]: tags[field].includes(k) ? tags[field].filter((x) => x !== k) : [...tags[field], k] });
  if (!edit) {
    if (!tags.lp.length && !tags.atl.length && readOnly) return null;
    return (
      <div className="tag-box">
        {tags.lp.map((k) => <span key={k} className="lp-tag">{t(k)}</span>)}
        {tags.atl.map((k) => <span key={k} className="atl-tag">{t(k)} {t('skills')}</span>)}
        {!readOnly && <button className="linkish" onClick={() => setEdit(true)}>{tags.auto ? 'Suggested · check the tags' : 'Edit tags'}</button>}
      </div>
    );
  }
  return (
    <div className="tag-box editing">
      <small>Learner profile</small>
      <div>{LEARNER_PROFILE.map((k) => <button key={k} className={`lp-tag${tags.lp.includes(k) ? ' on' : ''}`} aria-pressed={tags.lp.includes(k)} onClick={() => flip('lp', k)}>{k}</button>)}</div>
      <small>Approaches to learning</small>
      <div>{ATL.map((k) => <button key={k} className={`atl-tag${tags.atl.includes(k) ? ' on' : ''}`} aria-pressed={tags.atl.includes(k)} onClick={() => flip('atl', k)}>{k}</button>)}</div>
      <button className="ghost small-btn" onClick={() => { if (tags.auto) setTags(event.id, tags); setEdit(false); }}>Done</button>
    </div>
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

// A file a student uploaded: a recording plays right here, anything else opens in the viewer.
function FileRow({ ev, onOpen, t }) {
  const k = evKind(ev);
  return (
    <div className="file-row">
      <button className="ev-open ev-row" onClick={onOpen}>
        <span className="ev-icon" aria-hidden="true">{FILE_ICON[k]}</span>
        <span><b>{ev.caption}</b><small>{fileLabel(ev)} · {t('open')}</small></span>
      </button>
      {k === 'audio' && <audio controls preload="none" src={ev.url} aria-label={ev.caption} />}
    </div>
  );
}

// F8: evidence opens. Images full size; everything else as the real thing it stands for
// (a certificate, a result slip, a repository, a report), stamped with where it came from.
function EvidenceView({ ev, event, student, doc, onClose }) {
  const poster = event.evidence.find((x) => x.kind === 'image')?.url;
  return createPortal(
    <div className="modal-back ev-back" onClick={onClose} onKeyDown={(k) => k.key === 'Escape' && onClose()}>
      <div className={`ev-view ${ev.kind === 'image' ? 'img' : 'doc'}${doc ? ` wide-${doc.t}` : ''}${isUploaded(ev) && ev.kind !== 'image' ? ` wide-file fk-${evKind(ev)}` : ''}`} role="dialog" aria-label={ev.caption} onClick={(x) => x.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close" autoFocus>×</button>
        {ev.kind === 'image' ? <img src={ev.url} alt={ev.caption} /> : isUploaded(ev) ? (
          <div className="ev-doc">
            <div className="ev-doc-stamp">{event.verification === 'student-added' ? 'Added by the student' : 'Uploaded'} · {fmtDate(event.date)}</div>
            <h2>{ev.caption}</h2>
            <p className="fineprint">{fileLabel(ev)} attached to “{event.title}”</p>
            <FileView ev={ev} />
          </div>
        ) : (
          <div className="ev-doc">
            <div className="ev-doc-stamp">{event.source?.system || 'Uploaded'}{event.source?.ref ? ` · ${event.source.ref}` : ''} · {fmtDate(event.date)}</div>
            <h2>{ev.caption}</h2>
            <p className="fineprint">{docLabel(doc) || (ev.kind === 'link' ? 'Linked page' : ev.kind === 'grade' ? 'Gradebook extract' : ev.kind === 'certificate' ? 'Certificate' : 'Document')} attached to “{event.title}”{ev.kind === 'link' && ev.url && ev.url !== '#' ? <> · <span className="ev-url">{ev.url.replace(/^https?:\/\//, '')}</span></> : null}</p>
            {doc ? <EvidenceDoc d={doc} event={event} student={student} poster={poster} /> : (
              <div className="ev-doc-body">{(event.about || event.summary).split('. ').map((x, i) => <p key={i}>{x.replace(/\.$/, '')}.</p>)}</div>
            )}
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
  const choices = endorserChoices(event.studentId, STAFF, event.lineIds || []);
  const [teacher, setTeacher] = useState(choices[0]?.id || '');
  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary);
  const [link, setLink] = useState('');
  const [files, setFiles] = useState([]);
  const own = event.verification === 'student-added';
  const rq = requestFor(event.id);
  const t = rq && getTeacher(rq.teacherId);
  const done = (msg, snap) => { setMode(null); setText(''); setFiles([]); toast(msg, snap); };
  return (
    <section className="st-actions">
      {rq?.status === 'returned' && (
        <div className="returned">
          <b>{t.name} asked for more</b>
          <p>“{rq.reason || 'More evidence please.'}”</p>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to the code, a photo or a file" aria-label="Evidence link" />
          <button className="primary small-btn" disabled={link.trim().length < 4} onClick={() => { const snap = snapshot(); resubmit(rq.id, { kind: 'link', url: link.trim(), caption: link.trim().replace(/^https?:\/\//, '').slice(0, 48) }); setLink(''); toast(`Resubmitted to ${t.name}`, snap); }}>Add evidence and resubmit</button>
          <div className="attach-row"><span className="fineprint">or</span><AttachButton label="Attach a file and resubmit" className="ghost small-btn file-btn" onAdded={(ev) => { const snap = snapshot(); resubmit(rq.id, ev); toast(`Resubmitted to ${t.name}`, snap); }} /></div>
        </div>
      )}
      {rq?.status === 'pending' && <p className="pending-note">Waiting for {t.name} to endorse{rq.resubmitted ? ' (resubmitted with more evidence)' : ''}.</p>}
      <div className="st-btns">
        <button className="ghost small-btn" aria-pressed={mode === 'reflect'} onClick={() => setMode(mode === 'reflect' ? null : 'reflect')}>Add a reflection</button>
        {own && !rq && <button className="ghost small-btn" aria-pressed={mode === 'request'} onClick={() => setMode(mode === 'request' ? null : 'request')}>Ask for an endorsement</button>}
        {own && <AttachButton label="Add a file" className="ghost small-btn file-btn" onAdded={(ev) => { const snap = snapshot(); editStation(event.id, { evidence: [...(getEvent(event.id) || event).evidence, ev] }); toast(`Added ${ev.caption}`, snap); }} />}
        {own && <button className="ghost small-btn" aria-pressed={mode === 'edit'} onClick={() => setMode(mode === 'edit' ? null : 'edit')}>Edit</button>}
        {own && <button className="ghost small-btn danger" onClick={() => { const snap = snapshot(); deleteStation(event.id); onClose(); toast(`Deleted “${event.title}”`, snap); }}>Delete</button>}
      </div>
      {mode === 'reflect' && (
        <div className="st-form">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did this give you? What would you do differently?" aria-label="Reflection" />
          <PendingFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
          <div className="attach-row"><VoiceNote onAdded={(ev) => setFiles((x) => [...x, ev])} /><AttachButton label="Attach a photo or file" className="ghost small-btn file-btn" onAdded={(ev) => setFiles((x) => [...x, ev])} /></div>
          <div className="st-row"><select value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Who can read it">{Object.entries(VIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button className="primary small-btn" disabled={!files.length && text.trim().length < 8} onClick={() => { const snap = snapshot(); addReflection({ studentId: event.studentId, eventId: event.id, prompt: 'My own reflection', text: text.trim(), visibility: vis, files }); done('Reflection saved', snap); }}>Save reflection</button></div>
        </div>
      )}
      {mode === 'request' && (
        <div className="st-form">
          <div className="st-row"><select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher">{choices.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.role}</option>)}</select></div>
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
