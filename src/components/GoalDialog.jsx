import { useState } from 'react';
import { addGoal, getTeachers, TODAY } from '../api.js';

const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);

// S5: plan a goal as a dashed station. Optionally invite a teacher to sponsor it before it starts,
// so work outside any school system can still end up endorsed.
export default function GoalDialog({ map, studentId, by, onClose, onDone }) {
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const teachers = getTeachers().filter((t) => ['t-01', 't-02', 't-03', 't-04', 't-05', 't-06', 't-07', 't-08'].includes(t.id));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(addDays(TODAY, 90));
  const [lineId, setLineId] = useState(lines[0]?.id || '');
  const [summary, setSummary] = useState('');
  const [checkIn, setCheckIn] = useState(!by);
  const [sponsor, setSponsor] = useState('');
  const [note, setNote] = useState('');
  const first = map.student.name.split(' ')[0];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Plan a goal" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Planned track</div>
        <h2>{by ? `Set a goal with ${first}` : 'Plan something ahead'}</h2>
        <p className="fineprint">It shows as a dashed station on the map and turns solid when it happens. It does not need to come from a school system.</p>
        <div className="form-grid">
          <label className="span2">What is the goal?<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Enter the Bangkok climate hackathon" /></label>
          <label>Target date<input type="date" value={date} min={TODAY} onChange={(e) => setDate(e.target.value)} /></label>
          <label>On which line<select value={lineId} onChange={(e) => setLineId(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="span2">A sentence about it (optional)<input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you want to come out of it" /></label>
          {!by && <label className="span2 cb-check"><input type="checkbox" checked={checkIn} onChange={() => setCheckIn(!checkIn)} /> Ask my advisor to check in on it</label>}
          <label className="span2">Invite a teacher to sponsor it (optional)<select value={sponsor} onChange={(e) => setSponsor(e.target.value)}><option value="">No sponsor</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role}</option>)}</select></label>
          {sponsor && <label className="span2">Message to the sponsor<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why them, and what you will share along the way" /></label>}
        </div>
        {sponsor && <p className="fineprint sp-help">A sponsor agrees in advance, can add expectations and check in along the way, and endorses it in one click when you mark it done.</p>}
        <div className="composer-foot">
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={title.trim().length < 4 || !date || date < TODAY} onClick={() => { const e = addGoal(studentId, { title: title.trim(), date, lineId, summary: summary.trim(), checkIn: checkIn || !!by, sponsor: sponsor || null, sponsorNote: note.trim() }, by); onDone(e, sponsor ? `Planned “${e.title}”. Sponsor invited.` : `Planned “${e.title}”`); }}>{by ? `Add to ${first}’s map` : 'Add to my map'}</button>
        </div>
      </div>
    </div>
  );
}
