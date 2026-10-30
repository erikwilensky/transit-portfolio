import { useEffect, useState } from 'react';
import { activityLog } from '../auth.js';
import '../auth.css';
import './activity-log.css';

// Activity log (server/audit.mjs, GET /api/audit): who did what in the pilot, for accountability. Admins and leadership.
// Never any text people wrote: ids, a name, and what kind of thing happened.
const ACTIONS = {
  change: 'Changed the record', undo: 'Undid a change', 'report-decision': 'Safeguarding decision',
  'sign-in': 'Signed in', 'sign-in-failed': 'Sign-in failed', 'sign-in-locked': 'Sign-in blocked (too many tries)', 'sign-out': 'Signed out',
  'password-set': 'Set a password', 'setup-link': 'Made a sign-in link', 'reset-request': 'Asked for a new password', 'reset-dismissed': 'Cleared a password request',
  'account-create': 'Made an account', 'account-edit': 'Edited an account', 'role-change': 'Changed a role', 'account-pause': 'Paused an account', 'account-unpause': 'Unpaused an account', 'account-remove': 'Removed an account',
  'roster-import': 'Imported class lists', 'see-as-start': 'Started See as', 'see-as-stop': 'Stopped See as',
  'pdpa-copy': 'Downloaded a data copy', 'pdpa-erase': 'Erased a student',
  'leaver-archive': 'Downloaded a leaver archive', 'erasure-schedule': 'Scheduled an erasure', 'erasure-cancel': 'Withdrew an erasure',
  'file-refused': 'Files refused', 'family-join': 'Family joined', 'family-remove': 'Family member removed', 'family-letters': 'Made family letters',
  'report-export': 'Downloaded report comments', 'report-limits': 'Set report comment length',
  'cas-code': 'Made a CAS confirmation code', 'cas-confirm': 'Outside supervisor answered CAS hours',
};
const KIND = { student: 'Student', advisor: 'Advisor', teacher: 'Teacher', counsellor: 'Counsellor', coordinator: 'Coordinator', leadership: 'Leadership', parent: 'Family', admin: 'Admin' };
const SIZE = 50;
const EMPTY = { person: '', student: '', action: '', result: '', from: '', to: '' };
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const words = (fn) => String(fn || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

function detailText(e) {
  const d = e.detail || {};
  if (e.action === 'change') return words(e.fn);
  if (e.action === 'report-decision') return d.decision ? `decision: ${d.decision}` : '';
  if (e.action === 'roster-import') return `${d.students ?? 0} students, ${d.teachers ?? 0} staff, ${d.classes ?? 0} classes · ${d.accountsCreated ?? 0} new accounts${d.paused ? ` · ${d.paused} paused` : ''}`;
  if (e.action === 'file-refused') return `${d.count} in the hour from ${String(d.hour).slice(11, 13)}:00`;
  if (e.action === 'role-change') return `${d.from} → ${d.to}`;
  if (e.action === 'undo') return d.revs?.length ? `change ${d.revs.join(', ')}` : '';
  if (e.action === 'leaver-archive') return d.how === 'self' ? 'their own' : d.combined ? `one of ${d.combined} in a ZIP` : '';
  if (e.action === 'erasure-schedule' || e.action === 'erasure-cancel') return d.due ? `due ${d.due}` : '';
  if (d.count != null) return `${d.count}`;
  return [d.why, d.how, d.kind && KIND[d.kind]].filter(Boolean).join(' · ');
}

export default function ActivityLog() {
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState(EMPTY); // the filters in use (text fields wait a moment)
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { const t = setTimeout(() => { setQ(f); setPage(0); }, f.person !== q.person || f.student !== q.student ? 300 : 0); return () => clearTimeout(t); }, [f]);
  useEffect(() => {
    let live = true;
    const people = data?.people || [];
    const person = people.find((p) => p.name === q.person)?.id || q.person;
    activityLog.list({ ...q, person, page, size: SIZE }).then((j) => live && (setData(j), setErr(null)), (x) => live && setErr(x.message));
    return () => { live = false; };
  }, [q, page]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;
  const csvQ = { ...q, person: data?.people.find((p) => p.name === q.person)?.id || q.person };
  return (
    <div className="acc al">
      <div className="acc-head">
        <div><div className="kicker">Pilot</div><h1>Activity log</h1>
          <p className="auth-lede">Who did what in the pilot, and whether it was allowed. Kept for 400 days for safeguarding. It never holds passwords, links, or anything people wrote.</p></div>
        <a className="auth-btn al-dl" href={activityLog.csvUrl(csvQ)} download>Download as CSV</a>
      </div>
      <form className="al-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter the log">
        <label className="auth-field">Person<input value={f.person} onChange={set('person')} list="al-people" placeholder="Name or account id" /></label>
        <datalist id="al-people">{(data?.people || []).map((p) => <option key={p.id} value={p.name}>{KIND[p.kind] || p.kind}</option>)}</datalist>
        <label className="auth-field">Student<input value={f.student} onChange={set('student')} placeholder="Name or student id" /></label>
        <label className="auth-field">What<select value={f.action} onChange={set('action')}><option value="">Everything</option>{(data?.actions || []).map((a) => <option key={a} value={a}>{ACTIONS[a] || a}</option>)}</select></label>
        <label className="auth-field">Result<select value={f.result} onChange={set('result')}><option value="">Any</option><option value="ok">Done</option><option value="refused">Refused</option></select></label>
        <label className="auth-field">From<input type="date" value={f.from} onChange={set('from')} /></label>
        <label className="auth-field">To<input type="date" value={f.to} onChange={set('to')} /></label>
        {Object.values(f).some(Boolean) && <button type="button" className="ghost al-clear" onClick={() => setF(EMPTY)}>Clear filters</button>}
      </form>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {!data && !err && <p className="auth-lede">Loading the activity log…</p>}
      {data && (
        <section className="card-sec us-scroll" aria-label="Entries">
          <p className="fineprint al-count" aria-live="polite">{data.total.toLocaleString()} {data.total === 1 ? 'entry' : 'entries'}{data.total > SIZE ? `, page ${page + 1} of ${pages}` : ''}</p>
          {data.entries.length ? (
            <table className="us-table al-table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>About</th><th>Result</th><th>From</th></tr></thead>
              <tbody>{data.entries.map((e, i) => (
                <tr key={`${e.at}-${i}`} className={e.result === 'refused' ? 'al-refused' : ''}>
                  <td>{when(e.at)}</td>
                  <td>{e.actor ? <><b>{e.actor.name}</b><small>{KIND[e.actor.kind] || e.actor.kind}</small></> : <span className="al-none">Not signed in</span>}</td>
                  <td>{ACTIONS[e.action] || e.action}<small>{detailText(e)}</small></td>
                  <td>{e.target?.label || e.target?.studentId || e.target?.accountId || ''}<small>{[e.target?.studentId, e.target?.id].filter((x) => x && x !== e.target?.label).join(' · ')}</small></td>
                  <td>{e.result === 'ok' ? 'Done' : <span className="al-no">Refused</span>}<small>{e.status}</small></td>
                  <td><small>{e.ip || ''}</small></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="auth-lede">Nothing matches these filters.</p>}
          {data.total > SIZE && (
            <div className="al-pages">
              <button className="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
              <span>Page {page + 1} of {pages}</span>
              <button className="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Older</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
