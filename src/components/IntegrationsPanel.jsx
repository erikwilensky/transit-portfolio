import { useEffect, useMemo, useRef, useState } from 'react';
import { acceptCandidate, dismissCandidate, getDismissed, getInbox, getIntegrations, restoreCandidate, sync } from '../api.js';
import { ago, fmtDate, TYPE_LABEL, VIS_LABEL } from '../format.js';
import MetroMap from './MetroMap.jsx';
import StationPanel from './StationPanel.jsx';
import { VerifyBadge } from './Badge.jsx';

const GLYPH = { sis: 'SIS', lms: 'LMS', cas: 'CAS', clubs: 'CLB', github: 'GH', exams: 'EXM' };

export default function IntegrationsPanel({ map, lens, newIds, onAdded, toast, version }) {
  const [syncing, setSyncing] = useState([]);
  const [selected, setSelected] = useState(null);
  const [, tick] = useState(0);
  const inboxRef = useRef(null);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const studentId = map.student.id;
  const first = map.student.name.split(' ')[0];
  const integrations = useMemo(() => getIntegrations(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const inbox = useMemo(() => getInbox(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismissed = useMemo(() => getDismissed(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPending = integrations.reduce((n, i) => n + i.pendingForStudent, 0);

  const run = (ids) => {
    setSyncing(ids);
    setTimeout(() => {
      const arrived = sync(ids, studentId);
      setSyncing([]);
      toast(arrived.length ? `${arrived.length} new item${arrived.length > 1 ? 's' : ''} in ${first}'s inbox` : 'Already up to date');
      inboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1300);
  };
  const event = map.events.find((e) => e.id === selected);

  return (
    <div className="integrations">
      <div className="flow" aria-label="Data flow">
        <div className={`flow-box${syncing.length ? ' busy' : ''}`}><b>School systems</b><small>one adapter each</small></div>
        <div className={`flow-pipe${syncing.length ? ' busy' : ''}`}><i /><i /><i /></div>
        <div className="flow-box core"><b>Student inbox</b><small>the student decides</small></div>
        <div className="flow-pipe"><i /><i /><i /></div>
        <div className="flow-box"><b>Metro map</b><small>verified record</small></div>
      </div>

      <div className="int-head">
        <h2>Connected systems</h2>
        <button className="primary" onClick={() => run(integrations.map((i) => i.id))} disabled={!!syncing.length || !totalPending}>
          {syncing.length ? 'Syncing…' : totalPending ? `Sync all (${totalPending} new)` : 'All synced'}
        </button>
      </div>
      <div className="int-grid">
        {integrations.map((i) => {
          const busy = syncing.includes(i.id);
          return (
            <article key={i.id} className={`int-card${busy ? ' busy' : ''}`}>
              <div className="int-top">
                <span className="int-glyph">{GLYPH[i.id]}</span>
                <div><h3>{i.name}</h3><small>{i.detail} · {i.mode}</small></div>
              </div>
              <dl>
                <dt>Last synced</dt><dd>{busy ? 'syncing…' : ago(i.lastSynced)}</dd>
                <dt>Items</dt><dd>{i.itemCount.toLocaleString()}</dd>
              </dl>
              <div className="int-foot">
                <span className={`pending${i.pendingForStudent ? ' has' : ''}`}>{i.pendingForStudent ? `${i.pendingForStudent} new for ${first}` : 'Up to date'}</span>
                <button onClick={() => run([i.id])} disabled={!!syncing.length || !i.pendingForStudent}>Sync</button>
              </div>
              <div className="int-progress"><i /></div>
            </article>
          );
        })}
      </div>

      <div className="int-work" ref={inboxRef}>
        <section className="inbox" aria-label={`${first}'s inbox`}>
          <div className="inbox-head">
            <h2>{first}'s inbox</h2>
            <span className="fineprint">Synced items wait here. {first} chooses which line each one joins, or skips it.</span>
          </div>
          {inbox.length === 0 && <div className="inbox-empty">{totalPending ? 'Press Sync to pull new items from the school systems.' : 'Inbox clear.'}</div>}
          {inbox.map((c) => <Candidate key={c.id} c={c} map={map} onAdd={(lineIds, vis) => { const e = acceptCandidate(c.id, lineIds, vis); if (e) onAdded(e); }} onSkip={() => dismissCandidate(c.id)} />)}
          {dismissed.length > 0 && (
            <details className="skipped">
              <summary>Skipped ({dismissed.length})</summary>
              {dismissed.map((c) => <div key={c.id} className="skipped-row"><span>{c.title}</span><button onClick={() => restoreCandidate(c.id)}>Undo</button></div>)}
            </details>
          )}
        </section>
        <div className="int-map-frame">
          <MetroMap map={map} lens={lens} newIds={newIds} selectedId={selected} onSelect={setSelected} fitKey={studentId} />
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}

function Candidate({ c, map, onAdd, onSkip }) {
  const [lines, setLines] = useState(c.suggestedLineIds.filter((id) => map.lines.some((l) => l.id === id)));
  const [vis, setVis] = useState('advisor');
  const toggle = (id) => setLines(lines.includes(id) ? lines.filter((x) => x !== id) : [...lines, id]);
  return (
    <article className="cand">
      <div className="cand-top"><span className="int-glyph sm">{GLYPH[c.sourceId]}</span><span>{c.source.system} · {fmtDate(c.date)}</span><span className="spacer" /><span className="cand-type">{TYPE_LABEL[c.type]}</span></div>
      <h3>{c.title}</h3>
      <p>{c.summary}</p>
      <VerifyBadge level={c.verification} />
      <div className="cand-label">{c.suggestedLineIds.length ? 'Line (suggested, change if you like)' : 'No line suggested: pick one, or skip it'}</div>
      <div className="chips">
        {map.lines.filter((l) => l.status !== 'ended').map((l) => (
          <button key={l.id} className={`line-chip${lines.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }} aria-pressed={lines.includes(l.id)} onClick={() => toggle(l.id)}><i />{l.name}</button>
        ))}
      </div>
      <div className="cand-foot">
        <label>Visible to <select value={vis} onChange={(e) => setVis(e.target.value)}>{Object.entries(VIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <span className="spacer" />
        <button onClick={onSkip}>Skip</button>
        <button className="primary" onClick={() => onAdd(lines, vis)} disabled={!lines.length}>{lines.length > 1 ? 'Add as interchange' : 'Add to map'}</button>
      </div>
    </article>
  );
}
