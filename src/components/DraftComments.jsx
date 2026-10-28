import { useMemo, useState } from 'react';
import { addComment, applyLens, getComments, getEvent, getStudentMap, resolveComment, getTeacher, shortName } from '../api.js';
import { fmtDate } from '../format.js';
import PresentationView from './PresentationView.jsx';

// C5 (counsellor side): pin comments on a student's draft. Guidance only; the counsellor never edits the student's work.
export function CommentDialog({ pres, by, onClose, toast }) {
  const map = useMemo(() => getStudentMap(pres.studentId, 'school'), [pres.studentId]);
  const lens = useMemo(() => applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines }), [map, pres]);
  const [on, setOn] = useState(null);
  const [text, setText] = useState('');
  const list = getComments(pres.id);
  const first = map.student.name.split(' ')[0];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal cm-modal" role="dialog" aria-label="Comment on a draft" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Comments on {first}’s draft</div>
        <h2>{pres.title}</h2>
        <div className="cm-body">
          <div className={`cm-prev theme-${pres.theme}`}><PresentationView map={map} lens={lens} pres={pres} selectedId={on} onSelect={setOn} /></div>
          <aside className="cm-side">
            <p className="fineprint">Click a station in the draft to pin a comment to it, or leave it general. {first} sees your comments in the Presentation studio.</p>
            <div className="cm-pin">{on ? <>Pinned to <b>{getEvent(on)?.title}</b> <button className="linkish" onClick={() => setOn(null)}>unpin</button></> : 'General comment'}</div>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Lead with the sensor network" />
            <button className="primary" disabled={text.trim().length < 4} onClick={() => { addComment(pres.id, pres.studentId, text.trim(), on, by || undefined); setText(''); toast(`Comment sent to ${first}`); }}>Add comment</button>
            <ul className="cm-list">{list.map((c) => <li key={c.id} className={c.resolved ? 'done' : ''}><small>{fmtDate(c.date)}{c.eventId ? ` · on “${getEvent(c.eventId)?.title}”` : ''}{c.resolved ? ' · done' : ''}</small>{c.text}</li>)}</ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

// C5 (student side): comments shown above the draft in the studio. The student marks them done.
export function CommentStrip({ presId, onPick }) {
  const list = getComments(presId);
  const [open, setOpen] = useState(true);
  if (!list.length) return null;
  const left = list.filter((c) => !c.resolved).length;
  return (
    <div className="cm-strip">
      <button className="cm-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><b>{left ? `${left} comment${left === 1 ? '' : 's'} from ${[...new Set(list.filter((c) => !c.resolved).map((c) => shortName(getTeacher(c.by || 't-09')?.name || 'your counsellor')))].join(' and ')}` : 'All comments done'}</b> {open ? '▴' : '▾'}</button>
      {open && <ul>{list.map((c) => (
        <li key={c.id} className={c.resolved ? 'done' : ''}>
          <span>{c.text}{c.eventId && <> <button className="linkish" onClick={() => onPick(c.eventId)}>on “{getEvent(c.eventId)?.title}”</button></>}</span>
          <button className="ghost" onClick={() => resolveComment(c.id)}>{c.resolved ? 'Reopen' : 'Done'}</button>
        </li>
      ))}</ul>}
    </div>
  );
}
