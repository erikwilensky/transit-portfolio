import { useState } from 'react';
import { addBranch, endLine, restartLine, getSchoolLines, TODAY } from '../api.js';

// Start a branch under a school line (S3), or end a line well (S4).
export default function LineDialog({ mode, map, studentId, onClose, onDone }) {
  const school = getSchoolLines().filter((l) => map.lines.some((x) => x.id === l.id));
  const [parent, setParent] = useState(school[0]?.id || '');
  const [name, setName] = useState('');
  const [first, setFirst] = useState('');
  const [date, setDate] = useState(TODAY);
  const active = map.lines.filter((l) => l.status !== 'ended' && map.events.some((e) => e.lineIds.includes(l.id)));
  const ended = map.lines.filter((l) => l.status === 'ended');
  const [lineId, setLineId] = useState(active[0]?.id || '');
  const [keep, setKeep] = useState(false);
  const parentLine = school.find((l) => l.id === parent);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={mode === 'branch' ? 'Start a branch' : 'End a line'} onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        {mode === 'branch' ? (
          <>
            <div className="modal-kicker">New branch</div>
            <h2>Branch from a school line</h2>
            <p className="fineprint">School lines are fixed so every map reads the same way. Your branch sits beneath one of them, with its own name.</p>
            <div className="form-grid">
              <label>Branch from<select value={parent} onChange={(e) => setParent(e.target.value)}>{school.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <label>Name your branch<input value={name} onChange={(e) => setName(e.target.value)} placeholder={parent === 'science' ? 'e.g. Marine Biology' : 'e.g. Robotics'} /></label>
              <label className="span2">First station on it<input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="What started it?" /></label>
              <label>Date<input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} /></label>
            </div>
            <div className="branch-prev" aria-hidden="true">
              <svg viewBox="0 0 260 60" width="260" height="60"><path d="M10 20 H250" stroke={parentLine?.colour} strokeWidth="6" strokeLinecap="round" /><path d="M110 20 H130 L160 48 H250" stroke={parentLine?.colour} strokeOpacity=".6" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="130" cy="20" r="6" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" /></svg>
              <span>{parentLine?.name} → <b>{name || 'your branch'}</b></span>
            </div>
            <div className="composer-foot">
              <span className="fineprint">Ms Brandt approves new branch names so the school's list stays tidy.</span><span className="spacer" />
              <button className="ghost" onClick={onClose}>Cancel</button>
              <button className="primary" disabled={name.trim().length < 3 || first.trim().length < 3} onClick={() => { const r = addBranch(studentId, parent, name.trim(), { title: first.trim(), date, type: 'project' }); onDone(r.event, `Branched “${name.trim()}”. A signal asks why you started it.`); }}>Start branch</button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-kicker">End a line</div>
            <h2>Stopping is part of the story</h2>
            <p className="fineprint">The line gets a terminus bar and goes quiet. It stays on your map, and a signal asks what it gave you.</p>
            <div className="form-grid">
              <label className="span2">Which line<select value={lineId} onChange={(e) => setLineId(e.target.value)}>{active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <label className="span2 cb-check"><input type="checkbox" checked={keep} onChange={() => setKeep(!keep)} /> Keep its stations publishable (by default an ended line becomes advisor-only)</label>
            </div>
            {ended.length > 0 && <p className="fineprint">Ended already: {ended.map((l) => <button key={l.id} className="linkish" onClick={() => { restartLine(studentId, l.id); onDone(null, `${l.name} restarted.`); }}>{l.name} (restart)</button>)}</p>}
            <div className="composer-foot">
              <span className="spacer" />
              <button className="ghost" onClick={onClose}>Cancel</button>
              <button className="primary" disabled={!lineId} onClick={() => { endLine(studentId, lineId, keep); onDone({ endedLine: lineId }, 'Line ended. Reflect at its terminus when you are ready.'); }}>End this line</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
