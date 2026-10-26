import Logo from './Logo.jsx';
import { useMemo } from 'react';
import MetroMap from './MetroMap.jsx';
import { VerifyBadge, VerifyLegend } from './Badge.jsx';
import { LENSES } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';
import CustomView from '../custom/CustomView.jsx';
import { defaultDesign } from '../custom/design.js';

// Each audience reads a different format. The metro map is the student's
// own tool; here it is optional (a small overview) or one format among many.
const SHOWCASE = ['project', 'competition', 'award', 'service', 'cas'];
const VERIFY_RANK = { 'school-verified': 1, 'teacher-endorsed': 2, 'student-added': 0 };
const year = (d) => d.slice(0, 4);
const month = (d) => fmtDate(d).split(' ').slice(1).join(' ');

export default function PresentationView({ map, lens, pres, selectedId, onSelect }) {
  const visibleEvents = useMemo(() => map.events.filter((e) => lens.visible.has(e.id)), [map, lens]);
  if (pres.layout === 'custom') return <CustomView map={map} lens={lens} design={pres.design || defaultDesign(map)} onOpenStation={onSelect} />;
  const lineById = Object.fromEntries(map.lines.map((l) => [l.id, l]));
  const shownLines = lens.order.filter((id) => lens.lineState[id] !== 'hidden').map((id) => lineById[id]);
  const fullLines = shownLines.filter((l) => lens.lineState[l.id] === 'full');
  const thinLines = shownLines.filter((l) => lens.lineState[l.id] === 'thin');
  const onLine = (l) => visibleEvents.filter((e) => e.lineIds.includes(l.id));
  const past = visibleEvents.filter((e) => e.type !== 'goal');
  const goals = visibleEvents.filter((e) => e.type === 'goal');
  const open = (id) => onSelect?.(id);
  const layout = pres.layout;

  const chips = (e) => (
    <span className="chips small">
      {e.lineIds.filter((id) => lens.lineState[id] && lens.lineState[id] !== 'hidden').map((id) => (
        <span key={id} className="line-chip static" style={{ '--c': lineById[id].colour }}><i className={lineById[id].pattern === 'cased' ? 'cased' : undefined} />{lineById[id].name}</span>
      ))}
    </span>
  );
  const quote = (e) => e.endorsements?.[0] && (
    <blockquote className="endorse-quote">“{e.endorsements[0].note}” <cite>{e.endorsements[0].teacher?.name}, {e.endorsements[0].teacher?.role}</cite></blockquote>
  );
  const firstImage = (e) => e.evidence.find((x) => x.kind === 'image');
  const Item = ({ e, detail = true }) => (
    <div className={`p-item${selectedId === e.id ? ' sel' : ''}`} onClick={() => open(e.id)} style={{ '--c': lineById[e.lineIds[0]]?.colour }}>
      {detail && firstImage(e) && <img className="p-img" src={firstImage(e).url} alt={firstImage(e).caption} loading="lazy" />}
      <div className="p-item-head"><b>{e.title}</b><span className="p-date">{fmtDate(e.date)}</span></div>
      {detail && <p>{e.summary}</p>}
      {detail && quote(e)}
      <div className="p-item-foot">{chips(e)}<VerifyBadge level={e.verification} event={e} /></div>
    </div>
  );
  const highlights = [...past].filter((e) => SHOWCASE.includes(e.type))
    .sort((a, b) => (b.endorsements.length - a.endorsements.length) || (VERIFY_RANK[b.verification] - VERIFY_RANK[a.verification]) || b.date.localeCompare(a.date))
    .slice(0, 3);
  const reflections = visibleEvents.flatMap((e) => e.reflections.map((r) => ({ ...r, event: e })));

  return (
    <div className={`pres layout-${layout}`}>
      <header className="pres-head">
        <div className="pres-avatar" style={{ background: map.student.avatar.colour }}>{map.student.avatar.initials}</div>
        <div>
          <div className="pres-kicker">{LENSES[pres.audience].label}{pres.targetName ? ` · ${pres.targetName}` : ''}</div>
          <h1>{pres.title}</h1>
          <div className="pres-sub">{map.student.programme} · Year {map.student.grade + 1}{pres.institution ? ` · for ${pres.institution}` : ''}</div>
        </div>
      </header>

      {layout === 'map' ? (
        <div className="pres-map"><MetroMap map={map} lens={lens} selectedId={selectedId} onSelect={onSelect} fitKey={`${map.student.id}-map`} /></div>
      ) : pres.showMap && (
        <figure className="pres-minimap">
          <MetroMap map={map} lens={lens} mini />
          <figcaption>Journey overview: {shownLines.length} lines, {past.length} stations</figcaption>
        </figure>
      )}

      <div className="fade-in" key={`${pres.id}-${layout}`}>
        {pres.intro && layout !== 'cv' && <p className="pres-intro">{pres.intro}</p>}

        {layout === 'profile' && (
          <>
            <h2 className="p-h2">Highlights</h2>
            <div className="case-grid">{highlights.map((e) => <Item key={e.id} e={e} />)}</div>
            <h2 className="p-h2">What I do</h2>
            <div className="chapter-grid">
              {fullLines.map((l) => {
                const evs = onLine(l).filter((e) => e.type !== 'goal');
                if (!evs.length) return null;
                return (
                  <section key={l.id} className="chapter" style={{ '--c': l.colour }}>
                    <h3><i />{l.name}{l.status === 'ended' && <small> · ended</small>}</h3>
                    <p className="p-muted">{year(evs[0].date)}–{l.status === 'ended' ? year(evs.at(-1).date) : 'now'} · {evs.length} stations</p>
                    <ul>{evs.slice(-3).reverse().map((e) => <li key={e.id} onClick={() => open(e.id)}>{e.title}</li>)}</ul>
                  </section>
                );
              })}
            </div>
            {reflections.at(-1) && <blockquote className="pull">“{reflections.at(-1).text.split('\n\n')[0]}”<cite>From a reflection on “{reflections.at(-1).event.title}”</cite></blockquote>}
            {goals.length > 0 && <><h2 className="p-h2">Next</h2><ul className="goal-list">{goals.map((e) => <li key={e.id} onClick={() => open(e.id)}><b>{e.title}</b> <span>{month(e.date)}</span></li>)}</ul></>}
          </>
        )}

        {layout === 'narrative' && (
          <div className="narr">
            <aside className="narr-side">
              <h3>At a glance</h3>
              <dl>
                <dt>Programme</dt><dd>{map.student.programme}</dd>
                <dt>Lines followed</dt><dd>{fullLines.map((l) => l.name.split(' ·')[0]).join(', ')}</dd>
                <dt>Teacher endorsements</dt><dd>{past.filter((e) => e.endorsements.length).length}</dd>
                <dt>Reflections</dt><dd>{reflections.length}</dd>
              </dl>
              {thinLines.length > 0 && <p className="p-muted">Also on my map: {thinLines.map((l) => l.name).join(', ')}.</p>}
            </aside>
            <article className="narr-body">
              {fullLines.map((l) => {
                const evs = onLine(l);
                if (!evs.length) return null;
                return (
                  <section key={l.id} className="narr-sec" style={{ '--c': l.colour }}>
                    <h2>{l.name}{l.status === 'ended' ? ' (ended)' : ''}</h2>
                    {pres.narratives?.[l.id] && <p className="narr-lede">{pres.narratives[l.id]}</p>}
                    <ol className="narr-stops">
                      {evs.map((e) => (
                        <li key={e.id} className={e.type === 'goal' ? 'goal' : ''} onClick={() => open(e.id)}>
                          <span className="p-date">{month(e.date)}</span>
                          <div>
                            <b>{e.title}</b> <VerifyBadge level={e.verification} event={e} />
                            <p>{e.about || e.summary}</p>
                            {firstImage(e) && <img className="narr-img" src={firstImage(e).url} alt={firstImage(e).caption} loading="lazy" />}
                            {e.reflections.map((r) => <blockquote key={r.id} className="refl-quote"><span className="refl-prompt">Reflection: {r.prompt}</span>{r.text.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}</blockquote>)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </article>
          </div>
        )}

        {layout === 'letter' && (
          <>
            <section className="letter">
              <p className="p-muted">To the admissions team{pres.institution ? `, ${pres.institution}` : ''}</p>
              <h2>Why {pres.targetName}</h2>
              <p>{pres.whyCourse}</p>
              {fullLines.map((l) => pres.narratives?.[l.id] && <p key={l.id}>{pres.narratives[l.id]}</p>)}
              <p className="sig">{map.student.name}</p>
            </section>
            <h2 className="p-h2">Evidence for this course</h2>
            {fullLines.map((l) => {
              const evs = onLine(l).filter((e) => e.type !== 'goal');
              if (!evs.length) return null;
              return (
                <section key={l.id} className="evidence-line" style={{ '--c': l.colour }}>
                  <h3><i />{l.name}</h3>
                  <div className="case-grid">{[...evs].reverse().map((e) => <Item key={e.id} e={e} />)}</div>
                </section>
              );
            })}
            {thinLines.length > 0 && (
              <section className="context">
                <h2 className="p-h2">Other context</h2>
                <div className="chips">{thinLines.map((l) => <span key={l.id} className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name} · {onLine(l).length}</span>)}</div>
              </section>
            )}
          </>
        )}

        {layout === 'cv' && <Cv map={map} pres={pres} past={past} fullLines={fullLines} shownLines={shownLines} Item={Item} />}

        {layout === 'cards' && (
          <div className="case-grid">
            {past.filter((e) => SHOWCASE.includes(e.type)).reverse().map((e) => (
              <article key={e.id} className="case-card" style={{ '--c': lineById[e.lineIds[0]]?.colour }} onClick={() => open(e.id)}>
                <div className="case-top"><span>{TYPE_LABEL[e.type]}</span><span>{fmtDate(e.date)}</span></div>
                {firstImage(e) && <img className="p-img" src={firstImage(e).url} alt={firstImage(e).caption} loading="lazy" />}
                <h3>{e.title}</h3>
                <p>{e.about || e.summary}</p>
                {quote(e)}
                <div className="case-foot">{chips(e)}<VerifyBadge level={e.verification} event={e} /></div>
              </article>
            ))}
          </div>
        )}

        {layout === 'impact' && (
          <>
            <div className="impact-stats">
              <span><b>{past.length}</b> contributions</span>
              <span><b>{past.length ? new Set(past.map((e) => year(e.date))).size : 0}</b> years active</span>
              <span><b>{past.filter((e) => e.endorsements.length).length}</b> teacher endorsements</span>
              <span><b>{past.filter((e) => e.verification === 'school-verified').length}</b> school-verified</span>
            </div>
            <ol className="timeline">
              {past.map((e, i) => (
                <li key={e.id} style={{ '--c': lineById[e.lineIds.find((id) => lens.lineState[id] !== 'hidden')]?.colour }} onClick={() => open(e.id)}>
                  <span className="tl-date">{i === 0 || year(past[i - 1].date) !== year(e.date) ? <b>{year(e.date)}</b> : null}{month(e.date).split(' ')[0]}</span>
                  <span className="tl-dot" />
                  <span className="tl-body"><b>{e.title}</b><span>{e.summary}</span>{firstImage(e) && <img className="tl-img" src={firstImage(e).url} alt={firstImage(e).caption} loading="lazy" />}{quote(e)}<span className="tl-meta">{chips(e)}<VerifyBadge level={e.verification} event={e} /></span></span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <footer className="pres-foot"><VerifyLegend /><span>Every item shows how it was verified. Students choose and order items but cannot edit verified facts.</span>{pres.theme === 'nist' && <Logo className="pres-mark" />}</footer>
    </div>
  );
}

function Cv({ map, pres, past, fullLines, shownLines, Item }) {
  const sections = [
    ['Projects', past.filter((e) => e.type === 'project')],
    ['Leadership and service', past.filter((e) => ['service', 'cas', 'club'].includes(e.type))],
    ['Competitions and awards', past.filter((e) => ['competition', 'award'].includes(e.type))],
  ];
  return (
    <div className="cv">
      <aside className="cv-side">
        <h2>{map.student.name}</h2>
        <p>{pres.intro}</p>
        {pres.skills && <><h3>Skills</h3><ul>{pres.skills.map((s) => <li key={s}>{s}</li>)}</ul></>}
        <h3>Interests</h3>
        <div className="chips small">{shownLines.map((l) => <span key={l.id} className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name.split(' ·')[0]}</span>)}</div>
        <h3>Education</h3>
        <p>{map.student.programme}, Year {map.student.grade + 1}</p>
        <p className="p-muted">Grades are not shown in this version.</p>
      </aside>
      <div className="cv-main">
        {sections.map(([title, evs]) => evs.length > 0 && (
          <section key={title}>
            <h3 className="cv-h">{title}</h3>
            {[...evs].reverse().map((e) => <Item key={e.id} e={e} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
