import { useEffect, useState } from 'react';
import { sisSync } from '../auth.js';
import { toCsv } from '../imports/csv.js';
import './sis-sync.css';

// Accounts › Class list sync (server/sis.mjs): the SIS is checked every night (or now); the change report waits here
// until an admin applies it (the same import as a roster file) or dismisses it. The token never reaches the browser.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const KINDS = [['students', 'Students', 'student'], ['teachers', 'Staff', 'staff member'], ['classes', 'Classes', 'class']];
const FIELD = { name: 'Name', year: 'Year', homeroom: 'Homeroom', advisor: 'Advisor', programme: 'Programme', email: 'Email', house: 'House', roles: 'Roles', department: 'Department', subject: 'Subject', level: 'Level', teachers: 'Teachers' };
const STATUS = {
  ready: 'Waiting for you', nothing: 'No changes', invalid: 'Problems in the feed', refused: 'Not applied: too many students left',
  applied: 'Applied', dismissed: 'Dismissed', replaced: 'Replaced by a newer check',
};
const byWho = (r) => (r.by ? r.by.name : 'Nightly check');
const tot = (o) => Object.values(o || {}).reduce((n, x) => n + x.n, 0);

export default function SisSync({ toast, onApplied }) {
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pause, setPause] = useState(false);
  const [done, setDone] = useState(null); // the apply's answer: setup links shown once
  useEffect(() => { sisSync.status().then(setV, (x) => x.status !== 403 && setErr(x.message)); }, []);
  const go = async (p, then) => { setBusy(true); setErr(null); try { const j = await p; then(j); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  if (!v) return err ? <p className="auth-err">{err}</p> : null;

  const head = <h2 id="sis-h">Class list sync</h2>;
  if (!v.configured) return (
    <section className="acc-form sis" aria-labelledby="sis-h">
      {head}
      <p className="fineprint">Not set up. To get the class lists from the school information system every night, add SIS_URL and SIS_TOKEN to the pilot’s settings (see docs/roster-format.md, “SIS sync”). Until then, import files with Import class lists.</p>
    </section>
  );
  const check = () => go(sisSync.check(), (j) => { setV(j); setDone(null); setPause(false); if (j.error) setErr(j.error); else toast(j.reports[0]?.status === 'ready' ? 'New change report' : 'Checked the SIS'); });
  const r = v.reports[0];
  const open = r && ['ready', 'refused', 'invalid'].includes(r.status) ? r : null;
  const apply = () => go(sisSync.apply(open.id, { pauseLeavers: pause && open.accounts.leavers > 0 }), (j) => { setV(j.sis); setDone(j); onApplied?.(j); toast('Class lists updated from the SIS'); });
  const dismiss = () => go(sisSync.dismiss(open.id), (j) => { setV(j.sis); toast('Change report dismissed'); });
  const download = () => {
    const rows = [['name', 'email', 'role', 'setup link'], ...done.newAccounts.created.map((a) => [a.name, a.email, a.role, a.setupUrl])];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `sign-in-links-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const failing = v.lastError && !v.connected;

  return (
    <section className="acc-form sis" aria-labelledby="sis-h">
      <div className="sis-head">
        <div>{head}
          <p className="sis-status" role="status">
            <span className={`sis-dot ${v.connected ? 'ok' : failing ? 'bad' : ''}`} aria-hidden="true" />
            {v.connected ? 'Connected' : failing ? 'Not connected' : 'Not checked yet'}
            {v.lastChecked && <> · last checked {ago(v.lastChecked)}</>}
            {v.syncAt ? <> · checks every night at {v.syncAt} (Bangkok time)</> : <> · no nightly check</>}
          </p>
        </div>
        <button className="ghost" onClick={check} disabled={busy}>{busy && !open ? 'Checking…' : 'Check now'}</button>
      </div>
      {v.lastError && <p className={failing ? 'auth-err' : 'fineprint'}>Last error ({when(v.lastError.at)}): {v.lastError.message}</p>}
      {err && err !== v.lastError?.message && <p className="auth-err" role="alert">{err}</p>}
      {done && <Applied done={done} download={download} />}
      {open && <Report r={open} pause={pause} setPause={setPause} />}
      {open?.status === 'ready' && <div className="auth-row">
        <button className="auth-btn" onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply these changes'}</button>
        <button className="ghost" onClick={dismiss} disabled={busy}>Dismiss</button>
      </div>}
      {!open && !done && r && <p className="fineprint">Nothing waiting. {r.status === 'nothing' ? `The last check (${when(r.at)}) found no changes.` : ''}</p>}
      {v.reports.length > 0 && <details className="sis-history">
        <summary>Last {plural(v.reports.length, 'check')}</summary>
        <ul>{v.reports.map((x) => (
          <li key={x.id}><span>{when(x.at)} · {byWho(x)}</span>
            <b className={`sis-st ${x.status}`}>{STATUS[x.status] || x.status}{x.applied ? ` by ${x.applied.by.name}, ${when(x.applied.at)}` : x.dismissed ? ` by ${x.dismissed.by.name}, ${when(x.dismissed.at)}` : ''}</b>
            {x.added && <small>{tot(x.added)} new, {tot(x.changed)} changed, {tot(x.leaving)} leaving</small>}</li>
        ))}</ul>
      </details>}
    </section>
  );
}

function Report({ r, pause, setPause }) {
  if (r.status === 'invalid') return (
    <div className="sis-report acc-problems" role="alert">
      <p className="auth-err">The feed from {when(r.at)} has {plural(r.errorCount, 'problem')}, so there is nothing to apply. Fix it in the SIS; the next check will try again.</p>
      {Object.entries(r.missing || {}).length > 0 && <p><b>Missing ids:</b> {Object.entries(r.missing).map(([k, ids]) => `${k}: ${ids.join(', ')}`).join('; ')}</p>}
      <ul>{r.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>
  );
  const s = r.school || {};
  return (
    <div className="sis-report">
      <h3>Change report · {when(r.at)}</h3>
      <p className="auth-lede">{s.name || 'The SIS'}{s.academicYear ? `, ${s.academicYear}` : ''}{r.mapped ? ' (mapped from the SIS’s own format)' : ''}. Checked by {byWho(r)}. Nothing has changed yet.</p>
      {r.status === 'refused' && <p className="auth-err sis-refused" role="alert">{r.warnings[0]}</p>}
      <table className="acc-counts">
        <thead><tr><th>In the feed</th><th>Count</th><th>New</th><th>Changed</th><th>Leaving</th></tr></thead>
        <tbody>{KINDS.map(([k, label]) => <tr key={k}><td>{label}</td><td>{r.counts[k]}</td><td>{r.added[k].n}</td><td>{r.changed[k].n}</td><td>{r.leaving[k].n}</td></tr>)}
          <tr><td>Class places</td><td>{r.counts.enrolments}</td><td>{r.enrolments.joins.n}</td><td>{r.enrolments.updated}</td><td>{r.enrolments.ends.n}</td></tr></tbody>
      </table>
      {KINDS.map(([k, label, one]) => <Group key={`a${k}`} title={`New ${label.toLowerCase()}`} list={r.added[k]} one={one} row={(x) => <><b>{x.name}</b> <small>{x.info}</small></>} />)}
      {KINDS.map(([k, label, one]) => <Group key={`c${k}`} title={`Changed ${label.toLowerCase()}`} list={r.changed[k]} one={one} row={(x) => <><b>{x.name}</b> <span className="sis-ch">{x.changes.map((c) => <span key={c.field}>{FIELD[c.field] || c.field} {c.from ?? '—'} → {c.to ?? '—'}</span>)}</span></>} />)}
      {KINDS.map(([k, label, one]) => <Group key={`l${k}`} title={`Leaving: ${label.toLowerCase()} no longer in the feed`} list={r.leaving[k]} one={one} row={(x) => <><b>{x.name}</b> <small>{x.info}</small></>} />)}
      <Group title="Joining a class" list={r.enrolments.joins} one="class place" row={(x) => <><b>{x.student}</b> <small>joins {x.class}</small></>} />
      <Group title="Leaving a class (kept as history)" list={r.enrolments.ends} one="class place" row={(x) => <><b>{x.student}</b> <small>leaves {x.class}</small></>} />
      {r.handover?.changes > 0 && <details className="sis-group" open>
        <summary>Advisor handovers: {plural(r.handover.changes, 'student')}{r.handover.newYear ? `, from ${r.handover.fromYear} to ${r.handover.year}` : ''}</summary>
        <ul>{r.handover.groups.map((g, i) => <li key={i}>{g.from} → {g.to} <b>{g.n}</b></li>)}</ul>
      </details>}
      <ul className="acc-notes">
        <li>{r.accounts.toCreate ? `${plural(r.accounts.toCreate, 'person', 'people')} with an email will get a sign-in account and a setup link.` : 'Nobody new needs a sign-in account.'}</li>
        <li>Nobody is removed: people who leave stay in the record. Their class places end and stay as history.</li>
        {r.warnings.slice(r.status === 'refused' ? 1 : 0, 20).map((w, i) => <li key={i}>{w}</li>)}
      </ul>
      {r.status === 'ready' && r.accounts.leavers > 0 && <label className="acc-check"><input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} /> Also pause the accounts of {plural(r.accounts.leavers, 'person', 'people')} no longer in the class lists</label>}
    </div>
  );
}

function Group({ title, list, one, row }) {
  if (!list?.n) return null;
  return (
    <details className="sis-group" open={list.n <= 12}>
      <summary>{title}: {plural(list.n, one)}</summary>
      <ul>{list.items.map((x, i) => <li key={x.id || i}>{row(x)}</li>)}</ul>
      {list.n > list.items.length && <p className="fineprint">And {list.n - list.items.length} more.</p>}
    </details>
  );
}

function Applied({ done, download }) {
  const { summary, newAccounts } = done;
  const n = (o) => KINDS.map(([k, l]) => `${o[k]} ${l.toLowerCase()}`).join(', ');
  return <>
    <p className="acc-ok" role="status">Applied. Added {n(summary.added)}. Updated {n(summary.updated)}.{summary.ended.enrolments ? ` Ended ${plural(summary.ended.enrolments, 'class place')}.` : ''}{done.paused?.length ? ` Paused ${plural(done.paused.length, 'account')}.` : ''}{done.unpaused?.length ? ` Unpaused ${plural(done.unpaused.length, 'account')}.` : ''}</p>
    {newAccounts.created.length > 0 && <>
      <p className="auth-lede">{plural(newAccounts.created.length, 'sign-in account')} made. The setup links are shown only now, so download them before you leave this page.</p>
      <button className="auth-btn acc-dl" onClick={download}>Download sign-in links (CSV)</button>
    </>}
  </>;
}
