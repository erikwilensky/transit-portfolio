import { useState } from 'react';
import { auditLog } from '../api.js';
import { fmtDate } from '../format.js';

const KINDS = { view: 'Link views', link: 'Sharing', endorse: 'Endorsements', endorsement: 'Endorsements', sync: 'Imports', station: 'Stations', reflection: 'Reflections', prompt: 'Prompts', request: 'Requests', line: 'Lines', goal: 'Goals', share: 'Teacher pointers' };
const GROUPS = ['all', 'view', 'link', 'endorse', 'sync', 'station', 'reflection', 'prompt'];
const when = (ts) => `${fmtDate(ts.slice(0, 10))} ${ts.slice(11, 16)}`;

// Leadership: who did what to which student's record, across the school. Read-only.
export default function AuditLog({ version }) {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [n, setN] = useState(60);
  const all = auditLog();
  const norm = (k) => (k === 'endorsement' ? 'endorse' : k);
  const rows = all.filter((a) => (kind === 'all' || norm(a.kind) === kind) && (!q || `${a.actor} ${a.student} ${a.text}`.toLowerCase().includes(q.toLowerCase())));
  const csv = () => {
    const body = ['time,student,actor,kind,what', ...rows.map((a) => [a.ts, a.student, a.actor, a.kind, a.text].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); el.download = 'transit-portfolio-audit.csv'; el.click();
  };
  return (
    <div className="page audit">
      <header className="page-head">
        <div>
          <div className="kicker">Audit log</div>
          <h1>Nothing happens to a record without a trace</h1>
          <p>Every import, endorsement, visibility change and link view, for every student. Leadership can read this log but cannot open private stations from it.</p>
        </div>
        <div className="meter">
          <div><b>{all.length.toLocaleString()}</b><span>entries</span></div>
          <div><b>{all.filter((a) => a.kind === 'view').length}</b><span>share-link views</span></div>
          <div><b>{all.filter((a) => a.live).length}</b><span>during this demo</span></div>
        </div>
      </header>
      <div className="al-bar">
        <div className="seg small" role="group" aria-label="Kind">{GROUPS.map((k) => <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'All' : KINDS[k]}</button>)}</div>
        <input className="au-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or items" aria-label="Search the log" />
        <span className="spacer" />
        <button className="ghost" onClick={csv}>Export CSV</button>
      </div>
      <table className="health au-table">
        <thead><tr><th>When</th><th>Student</th><th>Who</th><th>What</th></tr></thead>
        <tbody>{rows.slice(0, n).map((a, i) => <tr key={a.id || i} className={a.live ? 'live' : ''}><td>{a.live ? 'Just now' : when(a.ts)}</td><td>{a.student}</td><td>{a.actor}</td><td><span className="au-kind">{KINDS[a.kind] || a.kind}</span>{a.text}</td></tr>)}</tbody>
      </table>
      {rows.length > n && <button className="ghost au-more" onClick={() => setN(n + 100)}>Show more ({rows.length - n} left)</button>}
      <p className="fineprint">Entries before today are generated from the demo record; entries marked “Just now” were made during this session.</p>
    </div>
  );
}
