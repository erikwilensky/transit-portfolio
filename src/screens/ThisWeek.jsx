import { useEffect, useMemo, useState } from 'react';
import { weeklySummary, weekSignups } from '../weekly.js';
import { weekLabel } from '../week.js';
import { progress } from '../auth.js';
import { fmtDate, inkOn } from '../format.js';
import { QuietGroup } from '../components/Nudges.jsx';
import { WeekMilestones } from '../components/Milestones.jsx';
import './classes.css';
import './this-week.css';

// "This week" (pilot): what waits for a teacher or advisor, their classes and advisory this week, and moments to
// celebrate. Made from the part of the record they already hold (src/weekly.js). #/<persona>/week, #/<persona>/week/last.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const Line = ({ line }) => (line
  ? <span className="line-chip static" style={{ '--c': line.colour }}><i className={line.pattern === 'cased' ? 'cased' : undefined} />{line.name}</span>
  : <span className="line-chip static off"><i />Not on a line yet</span>);

export default function ThisWeek({ persona, go, version, toast, param }) {
  const back = param === 'last' ? 1 : 0;
  const s = useMemo(() => weeklySummary(persona, back), [persona, back, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prog, setProg] = useState(null);
  useEffect(() => { if (s.advises) progress.advisees().then(setProg, () => setProg(null)); }, [s.advises, version]);
  const su = weekSignups(prog, back);
  const to = (screen, p) => ({ href: `#/${persona.id}/${screen}${p ? `/${p}` : ''}`, onClick: (e) => { e.preventDefault(); go(persona.id, screen, p); } });
  const { requests, groups, reports, spotted, threads } = s.waiting;
  const studentLink = (sid, eid, classId) => (s.advises && persona.teacherId && s.advisory?.students.some((x) => x.id === sid) ? to('student', `${sid}${eid ? `~${eid}` : ''}`) : classId ? to('classes', `${classId}~${sid}`) : null);
  const threadLink = (t) => (s.advisory?.students.some((x) => x.id === t.student?.id) ? to('student', `${t.student.id}~${t.event.id}`) : s.teaches ? to('queue', `c~${t.event.id}`) : null);
  const waits = [
    s.teaches && requests.length > 0 && { k: 'rq', n: requests.length, label: requests.length === 1 ? 'Endorsement request' : 'Endorsement requests', sub: 'Students asked you to check a moment', link: to('queue') },
    ...groups.map((g) => ({ k: g.prompt.id, n: g.requests.length, label: `Answers to “${g.prompt.question}”`, sub: `${g.prompt.className} · class answers to review`, link: to('classes', `${g.prompt.classId}~answers~${g.prompt.id}`) })),
    reports?.length > 0 && { k: 'rp', n: reports.length, label: reports.length === 1 ? 'Open report' : 'Open reports', sub: 'Reported moments or comments to look at', link: to('reports') },
    spotted.length > 0 && { k: 'sp', n: spotted.length, label: `Spotted ${spotted.length === 1 ? 'moment' : 'moments'} waiting`, sub: `For ${[...new Set(spotted.map((x) => x.student?.name.split(' ')[0]).filter(Boolean))].slice(0, 3).join(', ')}${spotted.length > 3 ? '…' : ''} to add or not`, link: s.teaches ? to('classes', spotted.every((x) => x.classId && x.classId === spotted[0].classId) ? spotted[0].classId : undefined) : studentLink(spotted[0].studentId) },
    ...threads.slice(0, 5).map((t) => ({ k: `c-${t.event.id}`, n: t.unread, label: `New ${t.unread === 1 ? 'comment' : 'comments'} on “${t.event.title}”`, sub: t.student?.name || '', link: threadLink(t) })),
  ].filter(Boolean);
  return (
    <div className="page tw">
      <header className="page-head">
        <div>
          <div className="kicker">{back ? 'Last week' : 'This week'}</div>
          <h1>{weekLabel(s.week)}</h1>
          <p>Monday to Sunday. Counts what your students added{back ? ' that week' : ' so far this week'}.</p>
        </div>
        <div className="tw-tabs" role="tablist" aria-label="Week">
          <a role="tab" aria-selected={!back} className={!back ? 'on' : ''} {...to('week')}>This week</a>
          <a role="tab" aria-selected={!!back} className={back ? 'on' : ''} {...to('week', 'last')}>Last week</a>
        </div>
      </header>

      <section className="tw-sec" aria-labelledby="tw-wait">
        <h2 id="tw-wait">Waiting for you</h2>
        {!waits.length ? <p className="tw-none">Nothing is waiting for you.</p> : (
          <ul className="tw-wait">{waits.map((x) => (
            <li key={x.k}>{x.link ? <a {...x.link}><b>{x.n}</b><span><strong>{x.label}</strong><small>{x.sub}</small></span><i aria-hidden="true">›</i></a>
              : <div><b>{x.n}</b><span><strong>{x.label}</strong><small>{x.sub}</small></span></div>}</li>
          ))}</ul>
        )}
        {threads.length > 5 && <p className="fineprint">And {plural(threads.length - 5, 'more thread')} with new comments.</p>}
      </section>

      {s.teaches && (
        <section className="tw-sec" aria-labelledby="tw-classes">
          <h2 id="tw-classes">In your classes</h2>
          {!s.classes.length ? <p className="tw-none">No classes yet. They appear once the school imports its class lists.</p> : (
            <table className="mc-table tw-classes">
              <thead><tr><th>Class</th><th>Moments added</th><th>Students who added something</th><th>Class question</th></tr></thead>
              <tbody>{s.classes.map((c) => (
                <tr key={c.id} data-class={c.id}>
                  <td><a {...to('classes', c.id)}>{c.name}</a><small className="tw-line"><Line line={c.line} /></small></td>
                  <td><span className="tw-k">Moments added</span><span><b>{c.moments}</b>{c.line ? <small> on {c.line.name}</small> : null}</span></td>
                  <td><span className="tw-k">Students who added something</span><span><b>{c.students}</b><small> of {c.studentIds.length}</small></span></td>
                  <td><span className="tw-k">Class question</span><span>{c.questions ? <><b>{c.rate}%</b><small> answered ({c.answered} of {c.asked}{c.questions > 1 ? `, ${c.questions} questions` : ''})</small></> : <small>None asked</small>}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}

      {s.advisory && (
        <section className="tw-sec" aria-labelledby="tw-adv">
          <div className="tw-head"><h2 id="tw-adv">Your advisory</h2><a className="linkish" {...to('advisory')}>Open my advisory ›</a></div>
          <div className="tiles tw-tiles">
            <div className="tile"><b>{s.advisory.moments}</b><span>new {s.advisory.moments === 1 ? 'moment' : 'moments'}</span></div>
            <div className="tile"><b>{s.advisory.active}</b><span>of {s.advisory.students.length} added something</span></div>
            {su && <div className="tile"><b>{su.signedUpWeek}</b><span>signed up{back ? ' that week' : ' this week'} · {su.signedUp} of {su.total} in all</span></div>}
            {su && <div className="tile"><b>{su.familiesWeek}</b><span>{su.familiesWeek === 1 ? 'family' : 'families'} joined · {su.families} of {su.total} in all</span></div>}
          </div>
          {s.advisory.list.length > 0 && (
            <ul className="tw-moments">{s.advisory.list.map(({ event: e, student: st }) => (
              <li key={e.id}><a {...to('student', `${st.id}~${e.id}`)}><b>{e.title}</b><small>{st.name} · {fmtDate(e.date)}</small></a></li>
            ))}</ul>
          )}
          <QuietGroup advisorId={persona.teacherId} toast={toast} version={version} />
        </section>
      )}

      <section className="tw-sec" aria-labelledby="tw-cel">
        <h2 id="tw-cel">Celebrate</h2>
        {!s.celebrate.length ? <p className="tw-none">No moments shared with the school {back ? 'last week' : 'yet this week'}.</p> : (
          <ul className="tw-cel">{s.celebrate.map(({ event: e, student: st, line, photo, advisee, classId }) => {
            const link = advisee ? to('student', `${st.id}~${e.id}`) : classId ? to('classes', `${classId}~${st.id}`) : null;
            const body = <>
              {photo ? <img src={photo.url} alt={photo.caption || ''} loading="lazy" /> : <span className="tw-av" style={{ background: st.avatar?.colour || '#4F529B', color: inkOn(st.avatar?.colour || '#4F529B') }}>{st.avatar?.initials}</span>}
              <span><b>{e.title}</b><small>{st.name} · {fmtDate(e.date)}</small>{line && <Line line={line} />}</span>
            </>;
            return <li key={e.id}>{link ? <a {...link}>{body}</a> : <div>{body}</div>}</li>;
          })}</ul>
        )}
        <p className="fineprint">Up to five moments your students shared with the school, photos and endorsed ones first.</p>
        <WeekMilestones summary={s} version={version} link={(m) => studentLink(m.student.id, m.eventId, s.classes.find((c) => c.studentIds.includes(m.student.id))?.id)} />
      </section>
    </div>
  );
}
