import { useEffect, useState } from 'react';
import { addMomentComment, COMMENT_EDIT_MIN, commentsAsked, commentStaff, commentWho, deleteMomentComment, editMomentComment, getMomentComments, getStudent, getTeacher, hasPublicCopy, markCommentsRead, shortName, TODAY, unreadComments } from '../api.js';
import { personaById } from '../personas.js';
import { fmtDate } from '../format.js';
import './moment-comments.css';

// Comments on one moment (api.addMomentComment): the student and the staff who can see it. In the station panel,
// the Simple moment card and the Endorsements queue. Families, readers and public pages never get it.
const WHOLE = ['counsellor', 'coordinator', 'leadership'];
const STAFF = ['advisor', 'teacher', ...WHOLE];
// Who is looking: 'student' (their own station), a teacher id, or null (staff without a staff record: read only).
export function commentViewer(event) {
  if (!event || hasPublicCopy() || /^#\/?(s|v|p)\//.test(location.hash)) return null;
  const p = personaById(location.hash.replace(/^#\/?/, '').split('/')[0]);
  if (p.kind === 'student') return p.studentId === event.studentId ? { me: 'student', write: event.visibility !== 'private' } : null;
  if (!STAFF.includes(p.kind) && p.kind !== 'admin' && !p.admin) return null;
  const whole = WHOLE.includes(p.kind) || p.kind === 'admin' || !!p.admin;
  return { me: p.teacherId || null, write: !!p.teacherId && event.visibility !== 'private' && (whole || commentsAsked(event.id, p.teacherId)) };
}
const when = (at) => (at.slice(0, 10) === TODAY ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fmtDate(at.slice(0, 10)));
const editable = (c) => Date.now() - Date.parse(c.at) < COMMENT_EDIT_MIN * 60000;

// The count a card shows (Simple "My moments", the queue).
export const useUnread = (event) => { const v = commentViewer(event); return v?.me ? unreadComments(event.id, v.me) : 0; };
export const NewBadge = ({ n }) => (n ? <em className="mc-new" aria-label={`${n} new comment${n === 1 ? '' : 's'}`}>{n} new</em> : null);

export default function MomentComments({ event, simple = false, collapsible = false, open: openAtStart = false, toast = () => {} }) {
  const v = commentViewer(event);
  const list = event ? getMomentComments(event.id) : [];
  const unread = v?.me ? unreadComments(event.id, v.me) : 0;
  const [since] = useState(() => (unread ? list.filter((c) => c.by !== v.me).slice(-unread).map((c) => c.id) : []));
  const [open, setOpen] = useState(openAtStart || !collapsible);
  const [text, setText] = useState('');
  const [writing, setWriting] = useState(!simple);
  const [editing, setEditing] = useState(null); // { id, text }
  useEffect(() => { if (open && unread && v?.me) { try { markCommentsRead(event.id, v.me); } catch { /* refused: the bar says */ } } }, [open, unread, event?.id, v?.me]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v || (!list.length && !v.write)) return null;
  const s = getStudent(event.studentId);
  const first = s?.name.split(' ')[0] || 'the student';
  const staff = commentStaff(event.id).map((id) => getTeacher(id)?.name).filter(Boolean);
  const to = v.me === 'student' ? (staff.length ? staff.slice(0, 2).map(shortName).join(' and ') : 'your advisor') : first;
  const run = (fn, ok) => { try { fn(); ok?.(); return true; } catch (e) { toast(e.message || 'That did not work.'); return false; } };
  const send = () => run(() => addMomentComment(event.id, v.me, text), () => { setText(''); if (simple) setWriting(false); toast(simple ? `Sent to ${to}` : 'Comment sent'); });
  if (collapsible && !open) {
    return <button className="ghost small-btn mc-toggle" onClick={() => setOpen(true)} aria-expanded="false">{list.length ? `Comments (${list.length})` : 'Comment'}<NewBadge n={unread} /></button>;
  }
  return (
    <section className={`mc-thread${simple ? ' simple' : ''}`} aria-label="Comments">
      <h3>Comments{collapsible && <button className="linkish" onClick={() => setOpen(false)}>Hide</button>}</h3>
      {!list.length && !simple && <p className="fineprint">{v.me === 'student' ? `Ask a question or say more about it. ${to} can read it.` : `Nothing yet. ${first} and the staff who can see this moment read what you write. Families do not.`}</p>}
      {list.length > 0 && (
        <ul className="mc-list">
          {list.map((c) => (
            <li key={c.id} className={`${c.by === v.me ? 'mine' : ''}${since.includes(c.id) ? ' fresh' : ''}`}>
              <div className="mc-who"><b>{commentWho(c, v.me)}</b><small>{when(c.at)}{c.edited ? ' · edited' : ''}</small></div>
              {editing?.id === c.id ? (
                <div className="mc-edit">
                  <textarea rows={2} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Change your comment" />
                  <div className="mc-row"><button className="ghost small-btn" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="primary small-btn" disabled={!editing.text.trim()} onClick={() => run(() => editMomentComment(c.id, v.me, editing.text), () => setEditing(null))}>Save</button></div>
                </div>
              ) : <p>{c.text}</p>}
              {c.by === v.me && editing?.id !== c.id && (
                <div className="mc-own">
                  {editable(c) && <button className="linkish" onClick={() => setEditing({ id: c.id, text: c.text })}>Edit</button>}
                  <button className="linkish" onClick={() => run(() => deleteMomentComment(c.id, v.me), () => toast('Comment deleted'))}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {v.write && (writing ? (
        <div className="mc-write">
          <textarea rows={simple ? 3 : 2} value={text} onChange={(e) => setText(e.target.value)} autoFocus={simple}
            placeholder={v.me === 'student' ? (simple ? `Write back to ${to}` : `Write to ${to}`) : `Write to ${first}`} aria-label={v.me === 'student' ? `Write to ${to}` : `Comment for ${first}`} />
          <div className="mc-row">
            {simple && <button className="ghost" onClick={() => { setWriting(false); setText(''); }}>Not now</button>}
            <button className="primary" disabled={!text.trim()} onClick={send}>{simple ? 'Send' : 'Send comment'}</button>
          </div>
        </div>
      ) : <button className="primary mc-reply" onClick={() => setWriting(true)}>{list.length ? 'Reply' : `Write to ${to}`}</button>)}
      {!simple && <p className="fineprint mc-note">{v.me === 'student' ? 'Your family does not see comments.' : 'Families do not see comments.'}</p>}
    </section>
  );
}
