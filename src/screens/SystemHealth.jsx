import { useEffect, useState } from 'react';
import { systemHealth } from '../auth.js';
import '../auth.css';
import './system-health.css';

// System health (server/routes/69-health.mjs): is the pilot server well? Each part says OK, Check this or Problem in plain
// words, and what to do. Admins only. Diagnostics for support leave out paths and anything about people.
const LABEL = { ok: 'OK', check: 'Check this', problem: 'Problem' };
const MARK = { ok: '✓', check: '!', problem: '✕' };
const OVERALL = { ok: 'Everything looks fine.', check: 'Something needs a look. See the parts marked Check this.', problem: 'Something is wrong. See the parts marked Problem first.' };
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const bytes = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
function value(f) {
  if (f.value == null || f.value === '') return f.type === 'time' ? 'Never' : '—';
  if (f.type === 'bytes') return bytes(f.value);
  if (f.type === 'time') return when(f.value);
  if (f.type === 'count') return Number(f.value).toLocaleString('en-GB');
  return String(f.value);
}

export function Badge({ status }) {
  return <span className={`syh-badge syh-${status}`}><span aria-hidden="true">{MARK[status]}</span> {LABEL[status]}</span>;
}

export default function SystemHealth() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); systemHealth.get().then((j) => (setData(j), setErr(null)), (x) => setErr(x.message)).finally(() => setBusy(false)); };
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, []);
  return (
    <div className="acc syh">
      <div className="acc-head">
        <div><div className="kicker">Pilot</div><h1>System health</h1>
          <p className="auth-lede">How the pilot server is doing: backups, disk space, class list sync, reminders, errors and sign-ins.</p></div>
        <div className="syh-actions">
          <button type="button" className="ghost" onClick={load} disabled={busy}>{busy ? 'Checking…' : 'Check again'}</button>
          <a className="auth-btn syh-dl" href={systemHealth.diagnosticsUrl} download>Download diagnostics</a>
        </div>
      </div>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {!data && !err && <p className="auth-lede">Checking the server…</p>}
      {data && (
        <>
          <div className={`syh-overall syh-b-${data.overall}`} role="status">
            <Badge status={data.overall} /> <span>{OVERALL[data.overall]}</span>
            <small>Checked {when(data.at)} · version {data.version.label}</small>
          </div>
          <p className="fineprint">The diagnostics file is for sending to support. It holds these checks and recent errors, but no names, emails, folder paths or anything people wrote.</p>
          <div className="syh-grid">
            {data.sections.map((s) => (
              <section key={s.id} className={`card-sec syh-sec syh-b-${s.status}`} aria-labelledby={`syh-${s.id}`} data-section={s.id}>
                <div className="syh-sec-head"><h2 id={`syh-${s.id}`}>{s.title}</h2><Badge status={s.status} /></div>
                <p className="syh-summary">{s.summary}</p>
                {s.todo && <p className="syh-todo"><b>What to do:</b> {s.todo}</p>}
                {s.facts.length > 0 && <dl className="syh-facts">{s.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{value(f)}</dd></div>)}</dl>}
                {s.id === 'errors' && s.errors?.length > 0 && (
                  <details className="syh-errors">
                    <summary>Recent errors ({s.errors.length})</summary>
                    <div className="us-scroll">
                      <table className="us-table">
                        <thead><tr><th>When</th><th>Where</th><th>Message</th></tr></thead>
                        <tbody>{s.errors.map((e, i) => <tr key={`${e.at}-${i}`}><td>{when(e.at)}</td><td><code>{e.route}</code></td><td>{e.message}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </details>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
