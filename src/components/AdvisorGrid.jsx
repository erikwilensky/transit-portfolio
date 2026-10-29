import { useMemo, useState } from 'react';
import { advisoryOf, applyLens, getCohort, getTeacher, growth, sendPrompt, snapshot, TODAY, daysBefore } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import MetroMap from './MetroMap.jsx';
import { isPilot } from '../auth.js';
import { AdvisorCards } from './SignInCards.jsx';
import { AdvisorFamily } from './FamilyLetters.jsx';
import { QuietGroup } from './Nudges.jsx';
import { AdvisorProgress } from './SignupProgress.jsx';
import { AdvisoryConference } from './ConferenceSheets.jsx';
import { HandoverNotes, NewToYou, isNewTo } from './YearHandover.jsx';

export default function AdvisorGrid({ advisorId, onOpen, toast, version }) {
  const cohort = useMemo(() => getCohort(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prompted, setPrompted] = useState({});
  const [handover, setHandover] = useState(false);
  const advisor = getTeacher(advisorId);
  const flagged = cohort.filter((c) => c.flagFewReflections).length;
  const group = advisoryOf(advisorId);
  const years = group.minYear === group.maxYear ? `Year ${group.minYear}` : `vertical tutor group, Years ${group.minYear} to ${group.maxYear}`;
  return (
    <div className="advisor">
      <div className="adv-head">
        <div>
          <h1>{group.name}</h1>
          <p>{advisor.name} · {cohort.length} students{cohort.length ? ` · ${years}` : ''}</p>
        </div>
        <div className="adv-summary">
          <span className={flagged ? '' : 'zero'}><b>{flagged}</b> student{flagged === 1 ? '' : 's'} with few reflections</span>
          <span><b>{cohort.reduce((n, c) => n + c.openSignals, 0)}</b> open reflection signals</span>
        </div>
      </div>
      {isPilot() && <NewToYou advisorId={advisorId} version={version} onOpen={onOpen} />}
      {isPilot() && (handover ? <HandoverNotes advisorId={advisorId} version={version} toast={toast} onClose={() => setHandover(false)} /> : <div className="yh-open"><button className="ghost" onClick={() => setHandover(true)}>Write handover notes</button><small className="fineprint">For next year’s advisor. Staff only.</small></div>)}
      {isPilot() && <AdvisorProgress version={version} />}
      {isPilot() && <AdvisorCards toast={toast} />}
      {isPilot() && <AdvisorFamily toast={toast} />}
      <AdvisoryConference advisorId={advisorId} cohort={cohort} group={group.name} />
      <QuietGroup advisorId={advisorId} toast={toast} version={version} />
      <p className="fineprint">Advisor view shows advisor, school and publishable items. Students are listed alphabetically; the grid never ranks or compares them. Each card compares a student only with their own last term.</p>
      <div className="adv-grid">
        {cohort.map((c) => {
          const lens = applyLens(c, null);
          const fresh = c.events.filter((e) => e.date >= daysBefore(6) && e.date <= TODAY);
          return (
            <article key={c.student.id} className={`adv-card${c.flagFewReflections ? ' flagged' : ''}`}>
              <header>
                <span className="pres-avatar sm" style={{ background: c.student.avatar.colour, color: inkOn(c.student.avatar.colour) }}>{c.student.avatar.initials}</span>
                <div><h3>{c.student.name}{isPilot() && isNewTo(advisorId, c.student.id) && <span className="yh-tag">New to you</span>}</h3><small>Year {c.student.grade + 1} · {c.student.programme}</small></div>
              </header>
              <button className="adv-mini" onClick={() => onOpen(c.student.id)} aria-label={`Open ${c.student.name}'s map`}>
                <MetroMap map={c} lens={lens} mini />
              </button>
              <div className="adv-stats">
                <span><b>{c.events.length}</b> stations</span>
                <span><b>{c.lines.length}</b> lines</span>
                <span title="Reflections the student has shared with their advisor. Private reflections are not counted."><b>{c.reflectionCount}</b> shared with advisor</span>
              </div>
              {(() => { const g = growth(c.student.id); const d = g.now.reflections - g.before.reflections; const ds = g.now.stations - g.before.stations; if (!(g.now.stations || g.now.reflections || g.before.stations || g.before.reflections)) return <div className="adv-growth">Nothing on the map yet</div>; return (
                <div className="adv-growth">Against last term: {ds > 0 ? <b>{ds} more station{ds > 1 ? 's' : ''}</b> : ds < 0 ? `${-ds} fewer station${ds < -1 ? 's' : ''}` : 'same stations'}, {d > 0 ? <b>{d} more reflection{d > 1 ? 's' : ''}</b> : d < 0 ? `${-d} fewer reflection${d < -1 ? 's' : ''}` : 'same reflections'}</div>
              ); })()}
              {(fresh.length > 0 || c.openSignals > 0) && (
                <div className="adv-news">
                  {fresh.map((e) => <span key={e.id} className="news-new">New: {e.title}</span>)}
                  {c.openSignals > 0 ? <span className="news-sig"><i className="sig-dot" />{c.openSignals} open signal{c.openSignals > 1 ? 's' : ''}</span> : null}
                </div>
              )}
              <div className="adv-foot">
                {c.flagFewReflections ? (
                  <>
                    <span className="flag">Few reflections</span>
                    <button onClick={() => { const snap = snapshot(); const last = c.events.filter((e) => e.date <= TODAY && e.type !== 'goal').at(-1); if (last) sendPrompt(c.student.id, last.id, `What has “${last.title}” taught you so far?`, advisorId); setPrompted({ ...prompted, [c.student.id]: true }); toast(`Reflection prompt sent to ${c.student.name.split(' ')[0]}`, snap); }} disabled={prompted[c.student.id]}>
                      {prompted[c.student.id] ? 'Prompt sent' : 'Send reflection prompt'}
                    </button>
                  </>
                ) : <span className="ok">{c.lastActivity ? `Last activity ${fmtDate(c.lastActivity)}` : 'Not started yet'}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
