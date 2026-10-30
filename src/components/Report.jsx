// Safeguarding (api.reportItem): "Report" on a moment or a moment comment, and the notice on a hidden one.
// Anyone signed in who can see the item: staff, the student who owns it, a family member on what the family view
// shows (moments only). The person reported never learns who reported; moderators do (src/screens/Reports.jsx).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getReports, getStudent, hasPublicCopy, REPORT_REASONS, reportItem } from '../api.js';
import { personaById } from '../personas.js';
import { useT } from '../i18n.js';
import './safeguarding.css';

const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
const viewer = () => personaById(location.hash.replace(/^#\/?/, '').split('/')[0]);
// The reporter key for whoever is looking (server/auth.mjs checks it), or null when they cannot report this.
export function reporterFor(event, comment) {
  if (!event || event.visibility === 'private' || hasPublicCopy() || /^#\/?(s|v|p|preview)\//.test(location.hash)) return null;
  const p = viewer();
  if (p.kind === 'student') return p.studentId === event.studentId ? { key: 'student' } : null;
  if (STAFF.includes(p.kind) && p.teacherId) return { key: p.teacherId };
  if (p.kind === 'admin' || p.admin) return { key: p.teacherId || 'admin', name: p.name };
  if (p.kind === 'parent' && !comment && !event.hidden && (p.children || []).includes(event.studentId)) return { key: `fam:${event.studentId}`, name: p.name };
  return null;
}
const isStaff = (p) => STAFF.includes(p.kind) || p.kind === 'admin' || !!p.admin;
const sameItem = (r, event, comment) => r.eventId === event.id && (r.commentId || null) === (comment?.id || null);

export function ReportButton({ event, comment, simple = false, toast }) {
  const from = reporterFor(event, comment);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useT();
  if (!from || (comment && comment.by === (from.key === 'student' ? 'student' : from.key))) return null;
  const mine = getReports().find((r) => r.from?.key === from.key && r.status === 'open' && sameItem(r, event, comment));
  if (mine || sent) return <span className="sg-sent">{simple ? 'You told a teacher about this' : t('Reported. A teacher will look at it.')}</span>;
  return (
    <>
      <button className={simple ? 'ghost sg-report simple' : 'linkish sg-report'} onClick={() => setOpen(true)}>{simple ? 'Something wrong? Tell a teacher' : t('Report')}</button>
      {open && createPortal(<ReportDialog event={event} comment={comment} from={from} simple={simple} onClose={() => setOpen(false)} onSent={() => { setSent(true); setOpen(false); toast?.(t('Thank you. A teacher will look at it.')); }} />, document.body)}
    </>
  );
}

function ReportDialog({ event, comment, from, simple, onClose, onSent }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const t = useT();
  const send = () => {
    setErr(null);
    try { reportItem(comment ? { commentId: comment.id } : { eventId: event.id }, reason, note, from); onSent(); } catch (x) { setErr(x.message || t('That did not work.')); }
  };
  const what = comment ? 'this comment' : 'this moment';
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal sg-dialog${simple ? ' simple' : ''}`} role="dialog" aria-label={comment ? `Report ${what}` : t('Report this moment')} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
        <h2>{simple ? 'Tell a teacher' : comment ? `Report ${what}` : t('Report this moment')}</h2>
        <p className="fineprint">“{comment ? (comment.text.length > 80 ? `${comment.text.slice(0, 77)}…` : comment.text) : event.title}”. {from.key === 'student' ? 'A teacher who looks after safety will see it.' : t('The school’s safeguarding staff will look at it. The student is not told who reported it.')}</p>
        <div className="sg-reasons" role="radiogroup" aria-label={t('What is wrong')}>
          {Object.entries(REPORT_REASONS).map(([k, l]) => <button key={k} role="radio" aria-checked={reason === k} className={reason === k ? 'on' : ''} onClick={() => setReason(k)}>{t(l)}</button>)}
        </div>
        <label className="fb-label" htmlFor="sg-note">{t('Anything else? (optional)')}</label>
        <textarea id="sg-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="sg-foot"><button className="ghost" onClick={onClose}>{t('Cancel')}</button><button className="primary" disabled={!reason} onClick={send}>{t('Send report')}</button></div>
      </div>
    </div>
  );
}

// On a hidden moment or comment: what the student and staff read (nobody else receives it).
export function HiddenNotice({ item, comment = false }) {
  if (!item?.hidden) return null;
  const p = viewer();
  const first = getStudent(item.studentId)?.name.split(' ')[0] || 'the student';
  const text = p.kind === 'student'
    ? `A teacher has hidden this ${comment ? 'comment' : 'moment'} while they look at it. Only you and school staff can see it now.`
    : isStaff(p) ? `Hidden after a report: only ${first} and staff can see it.` : null;
  return text ? <p className={`sg-hidden${comment ? ' small' : ''}`} role="status">{text}</p> : null;
}
