import { useState } from 'react';
import { getActivity } from '../api.js';
import { ago, fmtDate } from '../format.js';

const KINDS = [['all', 'Everything'], ['view', 'Link views'], ['endorse', 'Endorsements'], ['sync', 'Imports'], ['change', 'My changes']];
const ICON = { view: '◉', endorse: '✓', endorsement: '✓', sync: '⇣', station: '＋', reflection: '¶', visibility: '◐', link: '⛓', line: '⟿', privacy: '◐', prompt: '?', capture: '▣', onboarding: '★' };
const group = (k) => (k === 'endorsement' ? 'endorse' : ['station', 'reflection', 'visibility', 'link', 'line', 'privacy', 'capture', 'onboarding'].includes(k) ? 'change' : k);

// X5: nothing happens to a student's record without a trace.
export default function Activity({ studentId, version }) {
  const [kind, setKind] = useState('all');
  const [n, setN] = useState(60);
  const all = getActivity(studentId);
  const rows = all.filter((a) => kind === 'all' || group(a.kind) === kind);
  const byDay = [];
  for (const a of rows.slice(0, n)) { const d = a.ts.slice(0, 10); const g = byDay.at(-1); if (g?.d === d) g.items.push(a); else byDay.push({ d, items: [a] }); }
  return (
    <div className="page activity">
      <header className="page-head">
        <div>
          <div className="kicker">Activity log</div>
          <h1>Everything that happened to my record</h1>
          <p>Every import, endorsement, visibility change and share-link view, with who and when. Only you and the school's data protection officer can see this page.</p>
        </div>
        <div className="seg small">{KINDS.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l} <small>{k === 'all' ? all.length : all.filter((a) => group(a.kind) === k).length}</small></button>)}</div>
      </header>
      <ol className="act-days">
        {byDay.map(({ d, items }) => (
          <li key={d}>
            <h3>{d === '2026-10-26' ? 'Today' : fmtDate(d)}</h3>
            <ul>{items.map((a, i) => (
              <li key={i} className={`act k-${group(a.kind)}${a.live ? ' live' : ''}`}>
                <span className="act-ic" aria-hidden="true">{ICON[a.kind] || '•'}</span>
                <span className="act-t"><b>{a.actor}</b> {a.text.charAt(0).toLowerCase() + a.text.slice(1)}</span>
                <time>{a.live ? ago(a.ts) : a.ts.slice(11, 16)}</time>
              </li>
            ))}</ul>
          </li>
        ))}
      </ol>
      {rows.length > n && <button className="ghost" onClick={() => setN(n + 60)}>Show older</button>}
    </div>
  );
}
