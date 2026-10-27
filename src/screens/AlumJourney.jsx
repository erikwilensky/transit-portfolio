import { useMemo, useState } from 'react';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { ALUM, addAlumStation, applyLens, getAlumMap } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import { AttachButton, PendingFiles } from '../components/FileAttach.jsx';

const TYPES = [['project', 'Project'], ['class', 'Course or module'], ['club', 'Society or club'], ['service', 'Volunteering'], ['award', 'Award'], ['assessment', 'Result']];

// Life after Year 13: the record goes with the student. School stations keep their signatures; what comes later is the alum's own.
export default function AlumJourney({ version, toast, go, persona }) {
  const map = useMemo(() => getAlumMap(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => applyLens(map, null), [map]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const s = map.student;
  const after = map.events.filter((e) => e.type !== 'goal' && e.date > '2027-06-12');
  const school = map.events.filter((e) => e.type !== 'goal' && e.date <= '2027-06-12');
  const verified = school.filter((e) => e.verification !== 'student-added').length;
  const event = map.events.find((e) => e.id === selected);

  return (
    <div className="home alum">
      <div className="home-head">
        <div className="who">
          <span className="pres-avatar" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>
          <div>
            <h1>{s.name}</h1>
            <p>NIST Class of {ALUM.classOf} · BSc Data Science, Northbridge University (fictional) · {fmtDate(ALUM.today)}</p>
          </div>
          <div className="stats">
            <span><b>{school.length}</b> from school</span>
            <span><b>{after.length}</b> since</span>
          </div>
          <div className="home-actions">
            <button className="ghost" onClick={() => go(persona.id, 'poster')}>Map poster</button>
            <button className="primary" onClick={() => setAdding(true)}>＋ Add a station</button>
          </div>
        </div>
        <p className="alum-note"><b>You left NIST in June {ALUM.classOf} and kept your map.</b> <span>The {verified} stations the school or a teacher verified keep their signatures, so their codes still check. Teachers and your advisor can no longer see it. What you add now is marked as added after NIST.</span></p>
      </div>
      <div className="home-map">
        <MetroMap map={map} lens={lens} selectedId={selected} onSelect={setSelected} fitKey="alum" />
        <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly toast={toast} />
      </div>
      {adding && <AlumAdd map={map} onClose={() => setAdding(false)} onDone={(e) => { setAdding(false); setSelected(e.id); toast(`Added “${e.title}”`); }} />}
    </div>
  );
}

function AlumAdd({ map, onClose, onDone }) {
  const lines = map.lines.filter((l) => !l.parentLineId);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(ALUM.today);
  const [lineId, setLineId] = useState('maya-datasci');
  const [type, setType] = useState('project');
  const [summary, setSummary] = useState('');
  const [link, setLink] = useState('');
  const [reflection, setReflection] = useState('');
  const [files, setFiles] = useState([]);
  const ok = title.trim().length >= 4 && date && date > '2027-06-12' && date <= ALUM.today;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Add a station after NIST" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">After NIST</div>
        <h2>Add a station</h2>
        <p className="fineprint">Anything since you graduated: a module, a job, a project, something you volunteered for. It goes on the same lines as your school years.</p>
        <div className="form-grid">
          <label className="span2">What happened?<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Won the department data challenge" /></label>
          <label>When<input type="date" value={date} min="2027-06-13" max={ALUM.today} onChange={(e) => setDate(e.target.value)} /></label>
          <label>What kind<select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="span2">On which line<select value={lineId} onChange={(e) => setLineId(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="span2">A sentence about it<input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What it was and what you did" /></label>
          <label className="span2">Link (optional)<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label>
          <div className="span2 field"><span>Photo or file (optional)</span>
            <PendingFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
            <AttachButton label={files.length ? 'Attach another' : 'Attach a photo or file'} onAdded={(ev) => setFiles((x) => [...x, ev])} />
          </div>
          <label className="span2">What did it teach you? (optional)<textarea rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} /></label>
        </div>
        <div className="composer-foot">
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!ok} onClick={() => onDone(addAlumStation({ title: title.trim(), date, lineIds: [lineId], type, summary: summary.trim(), link: link.trim(), reflection: reflection.trim(), files }))}>Add to my map</button>
        </div>
      </div>
    </div>
  );
}
