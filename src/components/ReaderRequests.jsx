import { answerEvidence, getEvent, getEvidenceRequests } from '../api.js';
import { fmtDate } from '../format.js';

// E4 (student side): readers of a share link asked to see more. The student decides; nothing is shared automatically.
export default function ReaderRequests({ studentId, toast }) {
  const list = getEvidenceRequests(studentId);
  if (!list.length) return null;
  return (
    <div className="rr-list">
      <h3>Requests from readers</h3>
      {list.map((r) => (
        <div key={r.id} className={`rr ${r.status}`}>
          <div><b>{r.from}</b> <small>{fmtDate(r.date)} · on “{getEvent(r.eventId)?.title}”</small><p>“{r.text}”</p></div>
          {r.status === 'open' ? (
            <div className="rr-act">
              <button className="primary" onClick={() => { answerEvidence(r.id, true); toast(`Shared with ${r.from}. It shows on their link.`); }}>Share it</button>
              <button className="ghost" onClick={() => { answerEvidence(r.id, false); toast('Declined. They were told politely.'); }}>Decline</button>
            </div>
          ) : <span className={`app-st ${r.status === 'shared' ? 'st-viewed' : 'st-draft'}`}>{r.status === 'shared' ? 'Shared' : 'Declined'}</span>}
        </div>
      ))}
    </div>
  );
}
