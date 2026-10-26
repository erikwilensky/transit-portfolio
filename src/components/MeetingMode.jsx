import { inkOn } from '../format.js';
import { useMemo, useState } from 'react';
import { addNote, applyLens, getStudentMap } from '../api.js';
import MetroMap from './MetroMap.jsx';
import StationPanel from './StationPanel.jsx';
import GoalDialog from './GoalDialog.jsx';

// A3: a full-screen 1:1. The map is the conversation; goals agreed on the spot become dashed track.
export default function MeetingMode({ studentId, agenda, advisorId, onClose, toast, version }) {
  const map = useMemo(() => getStudentMap(studentId, 'advisor'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => applyLens(map, null), [map]);
  const [selected, setSelected] = useState(null);
  const [ticked, setTicked] = useState({});
  const [note, setNote] = useState('');
  const [goal, setGoal] = useState(false);
  const [agreed, setAgreed] = useState([]);
  const first = map.student.name.split(' ')[0];
  const end = () => {
    const parts = [note.trim(), agreed.length ? `Agreed goals: ${agreed.join('; ')}` : '', `Covered ${Object.values(ticked).filter(Boolean).length} of ${agenda.length} agenda points.`].filter(Boolean);
    addNote(studentId, parts.join(' '));
    toast('Meeting notes saved to advisor notes');
    onClose();
  };
  return (
    <div className="meeting" role="dialog" aria-label={`Meeting with ${first}`}>
      <header className="mt-head">
        <span className="pres-avatar sm" style={{ background: map.student.avatar.colour, color: inkOn(map.student.avatar.colour) }}>{map.student.avatar.initials}</span>
        <div><b>1:1 with {map.student.name}</b><small>Year {map.student.grade + 1} · showing what {first} shares with an advisor</small></div>
        <span className="spacer" />
        <button className="ghost" onClick={() => setGoal(true)}>＋ Set a goal together</button>
        <button className="primary" onClick={end}>End meeting</button>
        <button className="ghost" onClick={onClose} aria-label="Close without saving">×</button>
      </header>
      <div className="mt-body">
        <div className="mt-map">
          <MetroMap map={map} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => setSelected(g.eventId)} fitKey={`mt-${studentId}`} />
          <StationPanel event={map.events.find((e) => e.id === selected)} map={map} onClose={() => setSelected(null)} readOnly />
        </div>
        <aside className="mt-side">
          <h3>Talking points</h3>
          <ul className="mt-agenda">{agenda.map((a, i) => <li key={i}><label><input type="checkbox" checked={!!ticked[i]} onChange={() => setTicked({ ...ticked, [i]: !ticked[i] })} /><span>{a}</span></label></li>)}</ul>
          {agreed.length > 0 && <><h3>Agreed today</h3><ul className="mt-agreed">{agreed.map((g) => <li key={g}>{g}</li>)}</ul></>}
          <h3>Notes</h3>
          <textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you talked about. Only advisors see these." />
        </aside>
      </div>
      {goal && <GoalDialog map={map} studentId={studentId} by={advisorId} onClose={() => setGoal(false)} onDone={(e, msg) => { setGoal(false); setAgreed([...agreed, e.title]); setSelected(e.id); toast(`${msg}. ${first} was notified.`); }} />}
    </div>
  );
}
