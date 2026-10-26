import { useEffect, useMemo, useRef, useState } from 'react';
import { snapshot, acceptCandidate, disconnectGithub, dismissCandidate, getDismissed, getGithub, getInbox, getIntegrations, restoreCandidate, setGithub, simulateWeek, sync } from '../api.js';
import { ago, fmtDate, TYPE_LABEL, VIS_LABEL } from '../format.js';
import MetroMap from './MetroMap.jsx';
import StationPanel from './StationPanel.jsx';
import { VerifyBadge } from './Badge.jsx';
import ReaderRequests from './ReaderRequests.jsx';

const GLYPH = { sis: 'SIS', lms: 'LMS', cas: 'CAS', clubs: 'CLB', github: 'GH', exams: 'EXM' };

export default function IntegrationsPanel({ map, lens, newIds, onAdded, toast, version }) {
  const [syncing, setSyncing] = useState([]);
  const [selected, setSelected] = useState(null);
  const [gh, setGh] = useState(false);
  const [, tick] = useState(0);
  const inboxRef = useRef(null);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const studentId = map.student.id;
  const first = map.student.name.split(' ')[0];
  const integrations = useMemo(() => getIntegrations(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const inbox = useMemo(() => getInbox(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const dismissed = useMemo(() => getDismissed(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalPending = integrations.reduce((n, i) => n + i.pendingForStudent, 0);
  const github = getGithub(studentId);
  const simulate = () => { const made = simulateWeek(studentId); toast(`A week passes: ${made.length} systems have something new for ${first}`); };

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
        <button className="ghost" onClick={simulate} disabled={!!syncing.length} title="Each connected system sends one new item, as if a school week had passed">Simulate next week</button>
        <button className="primary" onClick={() => run(integrations.map((i) => i.id))} disabled={!!syncing.length || !totalPending}>
          {syncing.length ? 'Syncing…' : `Sync all · ${totalPending} new`}
        </button>
      </div>
      <div className="int-grid">
        {integrations.map((i) => {
          const busy = syncing.includes(i.id);
          const isGh = i.id === 'github' && github;
          const off = isGh && !github.connected;
          return (
            <article key={i.id} className={`int-card${busy ? ' busy' : ''}${off ? ' off' : ''}`}>
              <div className="int-top">
                <span className="int-glyph">{GLYPH[i.id]}</span>
                <div><h3>{i.name}</h3><small>{i.detail} · {i.mode}</small></div>
              </div>
              <dl>
                <dt>Last synced</dt><dd>{off ? 'never' : busy ? 'syncing…' : ago(i.lastSynced)}</dd>
                <dt>Items</dt><dd>{i.itemCount.toLocaleString()}</dd>
              </dl>
              <div className="int-foot">
                {off ? <><span className="pending">Not connected for {first}</span><button className="primary" onClick={() => setGh(true)}>Connect</button></> : <>
                  <span className={`pending${i.pendingForStudent ? ' has' : ''}`}>{i.pendingForStudent ? `${i.pendingForStudent} new for ${first}` : 'Up to date'}</span>
                  {isGh && <button onClick={() => setGh(true)}>{github.repos.filter((r) => r.shared).length} of {github.repos.length} repos</button>}
                  <button onClick={() => run([i.id])} disabled={!!syncing.length || !i.pendingForStudent}>Sync</button></>}
              </div>
              <div className="int-progress"><i /></div>
            </article>
          );
        })}
      </div>

      {gh && github && <GithubDialog github={github} first={first} onClose={() => setGh(false)}
        onSave={(names) => { setGithub(studentId, names); setGh(false); toast(names.length ? `Sharing ${names.length} repositor${names.length === 1 ? 'y' : 'ies'}. Only those can send items.` : 'Connected, with nothing shared yet'); }}
        onDisconnect={() => { const snap = snapshot(); disconnectGithub(studentId); setGh(false); toast('GitHub disconnected', snap); }} />}
      <div className="int-work" ref={inboxRef}>
        <section className="inbox" aria-label={`${first}'s inbox`}>
          <div className="inbox-head">
            <h2>{first}'s inbox</h2>
            <span className="fineprint">Synced items wait here. {first} chooses which line each one joins, or skips it.</span>
          </div>
          <ReaderRequests studentId={studentId} toast={toast} />
          {inbox.length === 0 && <div className="inbox-empty">{totalPending ? 'Press Sync to pull new items from the school systems.' : 'Inbox clear.'}</div>}
          {inbox.map((c) => <Candidate key={c.id} c={c} map={map} onAdd={(lineIds, vis) => { const e = acceptCandidate(c.id, lineIds, vis); if (e) onAdded(e); }} onSkip={() => { const snap = snapshot(); dismissCandidate(c.id); toast(`Skipped “${c.title}”`, snap); }} />)}
          {dismissed.length > 0 && (
            <details className="skipped">
              <summary>Skipped ({dismissed.length})</summary>
              {dismissed.map((c) => <div key={c.id} className="skipped-row"><span>{c.title}</span><button onClick={() => restoreCandidate(c.id)}>Undo</button></div>)}
            </details>
          )}
        </section>
        <div className="int-map-frame">
          <MetroMap recent map={map} lens={lens} newIds={newIds} selectedId={selected} onSelect={setSelected} fitKey={studentId} />
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
          <button key={l.id} className={`line-chip${lines.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }} aria-pressed={lines.includes(l.id)} onClick={() => toggle(l.id)}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name}</button>
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

// F11: the student opts in per repository. Unshared repositories never send anything.
function GithubDialog({ github, first, onClose, onSave, onDisconnect }) {
  const [step, setStep] = useState(github.connected ? 'pick' : 'auth');
  const [picked, setPicked] = useState(github.repos.filter((r) => r.shared).map((r) => r.name));
  const toggle = (n) => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal gh-dlg" role="dialog" aria-label="GitHub" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">GitHub · opt-in</div>
        {step === 'auth' ? (
          <>
            <h2>Connect {first}’s GitHub</h2>
            <div className="gh-auth">
              <span className="int-glyph">GH</span>
              <div><b>Transit Portfolio wants to read</b>
                <ul><li>The names and descriptions of repositories you choose</li><li>Releases, merged pull requests and commit counts in those repositories</li></ul>
                <b>It can never</b><ul><li>Read code in repositories you did not choose</li><li>Write to GitHub, or see private repositories you leave unticked</li></ul>
              </div>
            </div>
            <p className="fineprint">Signed in as <b>@{github.user}</b> (demo account). Nothing appears on the map until {first} accepts it in the inbox.</p>
            <div className="composer-foot"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={() => setStep('pick')}>Authorise</button></div>
          </>
        ) : (
          <>
            <h2>Choose which repositories to share</h2>
            <p className="fineprint">Only ticked repositories can send items to {first}’s inbox. You can change this at any time.</p>
            <ul className="gh-repos">{github.repos.map((r) => (
              <li key={r.name}><label><input type="checkbox" checked={picked.includes(r.name)} onChange={() => toggle(r.name)} /><span><b>{r.name}</b><small>{r.about}</small></span></label></li>
            ))}</ul>
            <div className="composer-foot">
              {github.connected && <button className="ghost danger" onClick={onDisconnect}>Disconnect</button>}
              <span className="spacer" />
              <button className="primary" onClick={() => onSave(picked)}>{github.connected ? 'Save' : `Share ${picked.length} repositor${picked.length === 1 ? 'y' : 'ies'}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
