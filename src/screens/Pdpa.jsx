import { CONSENT, extraViews, getActivity, getStore, getStudents, TODAY, SHARED_LABEL } from '../api.js';
import { ago, fmtDate } from '../format.js';

const DATA_MAP = [
  ['Student record (stations, lines)', 'School data core, Bangkok', 'Student; advisor and staff by visibility', 'Until graduation + 1 year, then exported and deleted'],
  ['Reflections', 'School data core, Bangkok', 'Student only by default', 'Same as the record'],
  ['Imports from SIS, ManageBac, CAS log', 'Read from those systems; copies in the data core', 'Same as the station', 'Re-read nightly; never edited'],
  ['Share-link views', 'Audit log', 'Student, data protection officer', '2 years'],
  ['Evidence files and photos', 'School cloud storage (Singapore region)', 'Same as the station', 'Same as the record'],
  ['Parent consent', 'SIS', 'Admissions, data protection officer', 'Until the student turns 20'],
];
const days = (d) => Math.round((new Date(d) - new Date(TODAY)) / 86400000);

// L2: what is stored, where, who can read it, for how long, and proof that it is enforced.
export default function Pdpa({ drafts, version, go }) {
  const events = getStore().events;
  const vis = ['private', 'advisor', 'school', 'publishable'].map((k) => [k, events.filter((e) => e.visibility === k).length]);
  const maxVis = Math.max(...vis.map((v) => v[1]));
  const links = Object.values(drafts).flat().flatMap((p) => p.shareLinks.map((l) => ({ ...l, title: p.title, studentId: p.studentId })));
  const working = links.filter((l) => !l.revoked && l.expiresAt >= TODAY);
  const views = getStudents().flatMap((s) => getActivity(s.id).filter((a) => a.kind === 'view').map((a) => ({ ...a, student: s.name }))).sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.ts.localeCompare(a.ts));
  const changes = getStudents().flatMap((s) => getActivity(s.id)).filter((a) => ['visibility', 'link', 'privacy', 'line'].includes(a.kind)).length;
  return (
    <div className="page pdpa">
      <header className="page-head">
        <div>
          <div className="kicker">Privacy and PDPA</div>
          <h1>The answer before the board asks</h1>
          <p>Thailand's Personal Data Protection Act applies to every student record. This page shows what the portfolio stores, who can read it, and the log that proves it.</p>
        </div>
        <span className="mock-pill">Illustrative pilot data</span>
      </header>

      <div className="tiles">
        <div className="tile"><b>{working.length}</b><span>share links working; every one expires</span></div>
        <div className="tile"><b>{links.reduce((n, l) => n + l.views + extraViews(l.token), 0)}</b><span>link views logged, with who and when</span></div>
        <div className="tile"><b>{Math.round((100 * vis[3][1]) / events.length)}%</b><span>of stations publishable, each one by the student's own choice</span></div>
        <div className="tile"><b>0</b><span>open data requests (2 handled this year)</span></div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>Recent share-link views</h2>
          <ul className="views">{views.slice(0, 7).map((v, i) => (
            <li key={i} className={v.live ? 'live' : ''}><span className="act-ic">◉</span><span><b>{v.actor}</b> opened {v.student.split(' ')[0]}’s link {v.text.replace('Viewed share link ', '')}</span><time>{v.live ? ago(v.ts) : fmtDate(v.ts.slice(0, 10))}</time></li>
          ))}</ul>
          <p className="fineprint">Students see the same log on their own Activity page and can switch any link off.</p>
        </section>
        <section className="card">
          <h2>Links and when they expire</h2>
          <table className="health">
            <thead><tr><th>Link</th><th>Shared with</th><th>Expires</th></tr></thead>
            <tbody>{links.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)).slice(0, 7).map((l) => { const d = days(l.expiresAt); return (
              <tr key={l.token}><td><code>/s/{l.token}</code></td><td>{l.sharedWith || SHARED_LABEL[l.token] || 'Anyone with the link'}</td>
                <td>{l.revoked ? <span className="status s-off"><i>×</i>Switched off</span> : d < 0 ? <span className="status s-off"><i>×</i>Expired</span> : <span className={`status ${d <= 30 ? 's-warn' : 's-ok'}`}><i>{d <= 30 ? '!' : '✓'}</i>{d} days</span>}</td></tr>
            ); })}</tbody>
          </table>
        </section>
        <section className="card">
          <h2>Parent consent by year group</h2>
          <ul className="sb-legend"><li><i className="dv1" />Consent on file</li><li><i className="dv3" />Waiting for a parent</li></ul>
          <ul className="consent">{CONSENT.map((c) => (
            <li key={c.grade}><span>Y{c.grade + 1}</span>
              {c.parent ? <span className="cbar"><i className="ok" style={{ flex: c.parent }} />{c.pending > 0 && <i className="pend" style={{ flex: c.pending }} />}</span> : <span className="cbar none">Not onboarded yet</span>}
              <small>{c.parent ? `${c.parent}/${c.students}${c.pending ? ` · ${c.pending} waiting` : ''}` : ''}</small></li>
          ))}</ul>
          <p className="fineprint">Without consent, nothing can be made publishable; the record stays inside the school.</p>
        </section>
        <section className="card">
          <h2>Who can read each station</h2>
          <ul className="visbars">{vis.map(([k, n]) => <li key={k}><span>{k === 'publishable' ? 'Publishable' : k === 'school' ? 'School staff' : k === 'advisor' ? 'Advisor only' : 'Private'}</span><span className="vb"><i style={{ width: `${(100 * n) / maxVis}%` }} /></span><b>{n}</b></li>)}</ul>
          <p className="fineprint">New items start advisor-only; students chose to publish the rest. {changes} visibility, link and line changes made by students during this demo are in the audit log.</p>
        </section>
      </div>

      <section className="card datamap">
        <h2>Data map</h2>
        <table className="health">
          <thead><tr><th>What</th><th>Where it lives</th><th>Who can read it</th><th>How long</th></tr></thead>
          <tbody>{DATA_MAP.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{i === 0 ? <b>{c}</b> : c}</td>)}</tr>)}</tbody>
        </table>
        <p className="fineprint">Students can download everything (JSON and a static copy of each presentation) at any time and on graduation. Data subject requests go to the school's data protection officer.</p>
      </section>
      <div className="dash-foot"><span>Ask a student to show you their own view of this.</span><button className="ghost" onClick={() => go('maya', 'activity')}>Open Maya’s activity log</button></div>
    </div>
  );
}
