// Safeguarding: the moderators' queue (api.moderateReport). Coordinators, counsellors, leadership and admins.
// Each report: the item (title, photo, text), the student, who reported it and why, and what was done.
import { useEffect, useState } from 'react';
import { getEvent, getMomentComment, getPeerFeedback, getReports, getStudent, getTeacher, peerText, isPhoto, moderateReport, REPORT_REASONS } from '../api.js';
import { ago } from '../format.js';
import '../components/safeguarding.css';

const STATUS = { open: 'Open', hidden: 'Hidden', shown: 'Shown again', 'photo-removed': 'Photo removed', 'no-action': 'No action needed' };
const ACTION = { hide: 'Hid it from everyone but the student and staff', unhide: 'Showed it again', photo: 'Removed the photo', none: 'No action needed' };
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Reports({ persona, toast, version, focus }) {
  const [done, setDone] = useState(false);
  const all = getReports();
  const open = all.filter((r) => r.status === 'open');
  const shown = done ? all.filter((r) => r.status !== 'open') : open;
  useEffect(() => { if (focus) document.getElementById(`rp-${focus}`)?.scrollIntoView({ block: 'center' }); }, [focus]);
  return (
    <div className="page sg-page" data-v={version}>
      <div className="sg-head">
        <div><h1>Reports</h1><p className="fineprint">Moments and comments someone reported. The student never sees who reported them. Families, share links and other students stop seeing a hidden item at once.</p></div>
        <div className="sg-tabs" role="tablist">
          <button role="tab" aria-selected={!done} className={!done ? 'on' : ''} onClick={() => setDone(false)}>Open ({open.length})</button>
          <button role="tab" aria-selected={done} className={done ? 'on' : ''} onClick={() => setDone(true)}>Done ({all.length - open.length})</button>
        </div>
      </div>
      {!shown.length && <p className="card-sec fineprint">{done ? 'Nothing answered yet.' : 'No open reports.'}</p>}
      <ul className="sg-list">{shown.map((r) => <ReportCard key={r.id} r={r} persona={persona} toast={toast} focus={focus === r.id} />)}</ul>
    </div>
  );
}

function ReportCard({ r, persona, toast, focus }) {
  const [note, setNote] = useState('');
  const e = getEvent(r.eventId), c = r.commentId ? getMomentComment(r.commentId) : null;
  const f = r.feedbackId ? getPeerFeedback(r.feedbackId) : null;
  const target = r.photoId ? null : r.feedbackId ? f : r.commentId ? c : e;
  const s = getStudent(r.studentId);
  const photo = r.photoId ? (r.url ? { url: r.url, caption: 'The reported photo' } : null) : !c && !r.feedbackId && e?.evidence?.find(isPhoto);
  const act = (action) => {
    try { moderateReport(r.id, action, note, persona.teacherId || null); setNote(''); toast?.(ACTION[action]); } catch (x) { toast?.(x.message || 'That did not work.'); }
  };
  return (
    <li id={`rp-${r.id}`} className={`sg-card${focus ? ' focus' : ''}`}>
      <div className="sg-top">
        <span className={`sg-status s-${r.status}`}>{STATUS[r.status] || r.status}</span>
        <b>{REPORT_REASONS[r.reason] || r.reason}</b>
        <small className="fineprint" title={when(r.at)}>{ago(r.at)}</small>
      </div>
      <div className="sg-item">
        {photo && <img src={photo.url} alt={photo.caption || 'Photo'} />}
        <div>
          <span className="sg-kind">{r.photoId ? `Class photo from ${getTeacher(r.teacherId)?.name || 'a teacher'}` : r.feedbackId ? `Kind feedback from a classmate${f ? ` (${getStudent(f.fromId)?.name || f.fromName})` : ''}` : c || r.commentId ? 'Comment on a moment' : 'Moment'}</span>
          <h3>{r.photoId ? r.title : e?.title || 'This moment was deleted'}</h3>
          {r.photoId && !r.url && <p className="fineprint">The photo was removed.</p>}
          {r.photoId ? null : r.feedbackId ? (f ? <p className="sg-text">“{f.parts.map(peerText).join(' ')}”</p> : <p className="fineprint">The feedback was removed.</p>) : c ? <p className="sg-text">“{c.text}”</p> : e?.summary ? <p className="sg-text">{e.summary}</p> : null}
          {r.commentId && !c && <p className="fineprint">The comment was deleted.</p>}
          {e?.visibility === 'private' && <p className="fineprint">The student has made it private since.</p>}
          {target?.hidden && <p className="fineprint">Hidden {when(target.hidden.at)} by {target.hidden.by}.</p>}
        </div>
      </div>
      <dl className="sg-meta">
        <dt>Student</dt><dd>{s ? `${s.name} (Year ${s.grade + 1}${s.homeroom ? `, ${s.homeroom}` : ''})` : 'No longer in the record'}</dd>
        <dt>Reported by</dt><dd>{r.from?.name} · {r.from?.role}</dd>
        <dt>When</dt><dd>{when(r.at)}</dd>
        {r.note && <><dt>Their note</dt><dd className="sg-text">{r.note}</dd></>}
      </dl>
      {r.history.length > 0 && (
        <ol className="sg-history">{r.history.map((h, i) => <li key={i}><b>{ACTION[h.action] || h.action}</b> · {h.by} · {when(h.at)}{h.note && <span className="sg-text">“{h.note}”</span>}</li>)}</ol>
      )}
      <div className="sg-act">
        <label className="fb-label" htmlFor={`sg-n-${r.id}`}>Note (kept with the report)</label>
        <textarea id={`sg-n-${r.id}`} rows={2} maxLength={1000} value={note} onChange={(ev) => setNote(ev.target.value)} />
        <div className="sg-buttons">
          {target && (target.hidden ? <button className="ghost" onClick={() => act('unhide')}>Show it again</button>
            : <button className="primary" onClick={() => act('hide')}>Hide from everyone but the student and staff</button>)}
          {photo && <button className="ghost" onClick={() => act('photo')}>Remove photo</button>}
          {r.status === 'open' && <button className="ghost" onClick={() => act('none')}>No action needed</button>}
        </div>
      </div>
    </li>
  );
}
