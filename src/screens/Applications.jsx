import { extraViews, getApplications, getStudent, getStudents, TODAY } from '../api.js';
import { fmtDate } from '../format.js';

const days = (d) => Math.round((new Date(d) - new Date(TODAY)) / 86400000);
const STATUS = { draft: ['Draft', 'st-draft'], shared: ['Shared', 'st-shared'], viewed: ['Viewed', 'st-viewed'] };

// C1: one record, many tailored applications. Each row says which presentation goes where and whether it was opened.
export default function Applications({ go, persona, drafts, version }) {
  const apps = getApplications();
  const seniors = getStudents({ includeCohort: true }).filter((s) => s.grade === 12).sort((a, b) => a.name.localeCompare(b.name));
  const presFor = (a) => a.presentationId && Object.values(drafts).flat().find((p) => p.id === a.presentationId);
  const live = (a) => { const p = presFor(a); const l = p?.shareLinks.find((x) => !x.revoked); return { p, l, views: (l ? l.views + extraViews(l.token) : a.views) }; };
  const status = (a) => { const { l, views } = live(a); return views > 0 ? 'viewed' : l || a.status === 'shared' ? 'shared' : 'draft'; };
  const soon = apps.filter((a) => days(a.deadline) <= 35 && days(a.deadline) >= 0);
  return (
    <div className="page apps">
      <header className="page-head">
        <div>
          <div className="kicker">University applications · Year 13</div>
          <h1>Who is applying where</h1>
          <p>Each application points at one of the student's own presentations, built from the same verified record. You see whether it has been opened.</p>
        </div>
        <div className="meter">
          <div><b>{apps.length}</b><span>applications</span></div>
          <div><b>{soon.length}</b><span>deadlines in the next 5 weeks</span></div>
          <div><b>{apps.filter((a) => status(a) === 'viewed').length}</b><span>already opened by the university</span></div>
        </div>
      </header>
      {seniors.map((s) => {
        const mine = apps.filter((a) => a.studentId === s.id).sort((a, b) => a.deadline.localeCompare(b.deadline));
        return (
          <section key={s.id} className="app-student">
            <div className="as-row-head">
              <span className="pres-avatar sm" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span>
              <div><h2>{s.name}</h2><small>{s.programme} · {mine.length ? `${mine.length} application${mine.length > 1 ? 's' : ''}` : 'No applications yet'}</small></div>
              <span className="spacer" />
              <button className="ghost" onClick={() => go(persona.id, 'letter', s.id)}>Reference letter</button>
            </div>
            {mine.length > 0 && (
              <table className="app-table">
                <thead><tr><th>University and course</th><th>Deadline</th><th>Presentation sent</th><th>Status</th></tr></thead>
                <tbody>{mine.map((a) => { const { p, l, views } = live(a); const st = status(a); const d = days(a.deadline); return (
                  <tr key={a.uni + a.course}>
                    <td><b>{a.uni}</b><small>{a.course}</small></td>
                    <td className={d <= 35 ? 'due-soon' : ''}>{fmtDate(a.deadline)}<small>{d < 0 ? 'passed' : `in ${d} days`}</small></td>
                    <td>{p ? <>{p.title}<small>{l ? `/s/${l.token}` : 'no link yet'}</small></> : <span className="muted">{getStudent(a.studentId)?.cohortOnly ? 'From the student’s own draft' : 'Not chosen yet'}</span>}</td>
                    <td><span className={`app-st ${STATUS[st][1]}`}>{STATUS[st][0]}</span>{views > 0 && <small>{views} view{views > 1 ? 's' : ''}</small>}
                      {l && <button className="linkish" onClick={() => { location.hash = `#/s/${l.token}`; }}>Open as reader</button>}</td>
                  </tr>
                ); })}</tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
