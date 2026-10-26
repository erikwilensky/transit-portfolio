import { useMemo } from 'react';
import MetroMap from './MetroMap.jsx';
import { VerifyBadge, VerifyLegend } from './Badge.jsx';
import { LENSES } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';

const CASE_TYPES = ['project', 'competition', 'service', 'cas', 'award'];

export default function PresentationView({ map, lens, pres, selectedId, onSelect }) {
  const visibleEvents = useMemo(() => map.events.filter((e) => lens.visible.has(e.id)), [map, lens]);
  const lineById = Object.fromEntries(map.lines.map((l) => [l.id, l]));
  const orderedLines = lens.order.filter((id) => lens.lineState[id] !== 'hidden').map((id) => lineById[id]);
  const layout = pres.layout;

  const header = (
    <header className="pres-head">
      <div className="pres-avatar" style={{ background: map.student.avatar.colour }}>{map.student.avatar.initials}</div>
      <div>
        <div className="pres-kicker">{LENSES[pres.audience].label} lens{pres.targetName ? ` · ${pres.targetName}` : ''}</div>
        <h1>{pres.title}</h1>
        <div className="pres-sub">{map.student.programme} · Grade {map.student.grade}{pres.institution ? ` · for ${pres.institution}` : ''}</div>
      </div>
    </header>
  );

  const chips = (e) => (
    <span className="chips small">
      {e.lineIds.filter((id) => lens.lineState[id] && lens.lineState[id] !== 'hidden').map((id) => (
        <span key={id} className="line-chip static" style={{ '--c': lineById[id].colour }}><i />{lineById[id].name}</span>
      ))}
    </span>
  );

  return (
    <div className={`pres layout-${layout}`}>
      {header}
      {pres.audience === 'specific' && pres.whyCourse && (
        <section className="why-course fade-in" key={`why-${pres.id}`}>
          <h2>Why {pres.targetName}</h2>
          <p>{pres.whyCourse}</p>
        </section>
      )}

      {(layout === 'metro' || layout === 'cards') && (
        <div className={`pres-map${layout === 'cards' ? ' compact' : ''}`}>
          <MetroMap map={map} lens={lens} selectedId={selectedId} onSelect={onSelect} fitKey={`${map.student.id}-${layout}`} />
        </div>
      )}

      {layout === 'cards' && (
        <div className="case-grid fade-in" key={`cards-${pres.id}`}>
          {visibleEvents.filter((e) => CASE_TYPES.includes(e.type)).reverse().map((e) => (
            <article key={e.id} className="case-card" style={{ '--c': lineById[e.lineIds[0]]?.colour }} onClick={() => onSelect?.(e.id)}>
              <div className="case-top"><span>{TYPE_LABEL[e.type]}</span><span>{fmtDate(e.date)}</span></div>
              <h3>{e.title}</h3>
              <p>{e.summary}</p>
              {e.endorsements[0] && <blockquote>“{e.endorsements[0].note}” <cite>{e.endorsements[0].teacher?.name}</cite></blockquote>}
              <div className="case-foot">{chips(e)}<VerifyBadge level={e.verification} /></div>
            </article>
          ))}
        </div>
      )}

      {layout === 'metro' && pres.audience === 'university' && (
        <div className="narratives fade-in" key={`nar-${pres.id}`}>
          {orderedLines.filter((l) => lens.lineState[l.id] === 'full').map((l) => {
            const evs = visibleEvents.filter((e) => e.lineIds.includes(l.id));
            if (!evs.length) return null;
            return (
              <section key={l.id} className="narrative" style={{ '--c': l.colour }}>
                <h2><i />{l.name}{l.status === 'ended' ? ' (ended)' : ''}</h2>
                {pres.narratives?.[l.id] && <p>{pres.narratives[l.id]}</p>}
                <ol className="stops">{evs.map((e) => <li key={e.id} onClick={() => onSelect?.(e.id)}><b>{e.title}</b> <span>{fmtDate(e.date)}</span></li>)}</ol>
              </section>
            );
          })}
        </div>
      )}

      {layout === 'timeline' && (
        <ol className="timeline fade-in" key={`tl-${pres.id}`}>
          {visibleEvents.map((e) => (
            <li key={e.id} style={{ '--c': lineById[e.lineIds.find((id) => lens.lineState[id] !== 'hidden')]?.colour }} className={e.type === 'goal' ? 'goal' : ''} onClick={() => onSelect?.(e.id)}>
              <span className="tl-date">{fmtDate(e.date)}</span>
              <span className="tl-dot" />
              <span className="tl-body"><b>{e.title}</b><span>{e.summary}</span><span className="tl-meta">{chips(e)}<VerifyBadge level={e.verification} /></span></span>
            </li>
          ))}
        </ol>
      )}

      {layout === 'story' && (
        <div className="story fade-in" key={`st-${pres.id}`}>
          {orderedLines.map((l) => {
            const evs = visibleEvents.filter((e) => e.lineIds.includes(l.id));
            if (!evs.length) return null;
            return (
              <section key={l.id} className={`story-ch${lens.lineState[l.id] === 'thin' ? ' thin' : ''}`} style={{ '--c': l.colour }}>
                <div className="story-rail" />
                <div>
                  <h2>{l.name}</h2>
                  {pres.narratives?.[l.id] && <p className="story-lede">{pres.narratives[l.id]}</p>}
                  {evs.map((e) => (
                    <div key={e.id} className="story-stop" onClick={() => onSelect?.(e.id)}>
                      <span className="tl-date">{fmtDate(e.date)}</span>
                      <b>{e.title}</b>
                      <p>{e.summary}</p>
                      <VerifyBadge level={e.verification} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <footer className="pres-foot"><VerifyLegend /><span>Every station shows how it was verified. Students can choose and order stations but cannot edit verified facts.</span></footer>
    </div>
  );
}
