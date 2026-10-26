import { VerifyBadge } from './Badge.jsx';
import { fmtDate, fmtTerm, TYPE_LABEL, VIS_LABEL, VERIFY_HELP } from '../format.js';

const KIND_ICON = { link: '↗', file: '▤', image: '▣', grade: '✓', certificate: '★' };

export default function StationPanel({ event, map, onClose, readOnly = false }) {
  const open = !!event;
  return (
    <aside className={`station-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Station details">
      {event && (
        <div className="panel-inner" key={event.id}>
          <div className="panel-grab" aria-hidden="true" />
          <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
          <div className="panel-type">{event.lineIds.length > 1 ? 'Interchange · ' : ''}{TYPE_LABEL[event.type]}</div>
          <h2>{event.title}</h2>
          <div className="panel-date">{fmtDate(event.date)} · {fmtTerm(event.date, map.student.g9StartYear)}</div>
          <div className="chips">
            {event.lineIds.map((id) => {
              const l = map.lines.find((x) => x.id === id);
              return l && <span key={id} className="line-chip static" style={{ '--c': l.colour }}><i />{l.name}</span>;
            })}
          </div>
          <p className="panel-summary">{event.summary}</p>
          <VerifyBadge level={event.verification} large />
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
            {!readOnly && <><dt>Visibility</dt><dd><span className={`vis vis-${event.visibility}`}>{VIS_LABEL[event.visibility]}</span></dd></>}
          </dl>
          {!readOnly && <p className="fineprint">Verified facts can be included, excluded or reordered in a presentation, never edited.</p>}
        </div>
      )}
    </aside>
  );
}
