import { acceptInterchange, getLine, ignoreInterchange, rootLine, suggestInterchanges, termReview } from '../api.js';
import { fmtDate } from '../format.js';

// S7: a calm summary of the term, compared only with the student's own last term. No points, no ranks.
// S10: stations that look related, offered as interchanges the student can accept or ignore.
export default function TermReview({ map, studentId, onClose, onOpen, toast }) {
  const r = termReview(studentId);
  const sug = suggestInterchanges(studentId);
  const first = map.student.name.split(' ')[0];
  const diff = r.stations.length - r.prevCount;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal tr-modal" role="dialog" aria-label="Term in review" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Term 1 · since {fmtDate('2026-08-17')}</div>
        <h2>Your term in review, {first}</h2>
        <ul className="tr-list">
          <li><b>{r.stations.length} new station{r.stations.length === 1 ? '' : 's'}</b>{diff !== 0 && <span> ({Math.abs(diff)} {diff > 0 ? 'more' : 'fewer'} than last term)</span>}</li>
          {r.interchanges.map((e) => <li key={e.id}><b>A new interchange</b> where {[...new Set(e.lineIds.map(rootLine))].map((id) => getLine(id)?.name).join(' and ')} meet: <button className="linkish" onClick={() => onOpen(e.id)}>{e.title}</button></li>)}
          {r.grew.slice(0, 2).map(({ l, n }) => <li key={l.id}><i className="tr-dot" style={{ background: l.colour }} aria-hidden="true" />Your <b>{l.name}</b> line grew by {n}</li>)}
          {r.reflections > 0 && <li><b>{r.reflections} reflection{r.reflections === 1 ? '' : 's'}</b> written</li>}
          {r.endorsed > 0 && <li><b>{r.endorsed} endorsement{r.endorsed === 1 ? '' : 's'}</b> from teachers</li>}
          {r.quiet.slice(0, 2).map((l) => <li key={l.id} className="muted">{l.name} was quiet this term. That is fine; you can also end it.</li>)}
          {r.goals[0] && <li>Next up: <button className="linkish" onClick={() => onOpen(r.goals[0].id)}>{r.goals[0].title}</button> on {fmtDate(r.goals[0].date)}</li>}
        </ul>
        {sug.length > 0 && (
          <section className="tr-sug">
            <h3>These might be connected</h3>
            <p className="fineprint">They share words and happened close together. Joining them makes an interchange on your map.</p>
            {sug.map((x) => (
              <div key={x.key} className="tr-pair">
                <span><b>{x.a.title}</b><small>{getLine(rootLine(x.a.lineIds[0]))?.name} · {fmtDate(x.a.date)}</small></span>
                <span className="tr-join" aria-hidden="true">⟷</span>
                <span><b>{x.b.title}</b><small>{getLine(rootLine(x.b.lineIds[0]))?.name} · {fmtDate(x.b.date)}</small></span>
                <small className="tr-why">Both mention {x.shared.slice(0, 3).join(', ')}</small>
                <div className="tr-act">
                  <button className="primary" onClick={() => { acceptInterchange(x); toast(`“${x.b.title}” now also sits on ${getLine(x.lineId)?.name}`); }}>Join them</button>
                  <button className="ghost" onClick={() => ignoreInterchange(x.key)}>Not related</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
