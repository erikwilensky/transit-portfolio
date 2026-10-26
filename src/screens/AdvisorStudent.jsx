import { useMemo, useState } from 'react';
import { addNote, applyLens, getNotes, getPrompts, getStudentMap, sendPrompt, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Advisor drill-down: the student's map as the advisor may see it, notes and a meeting agenda.
export default function AdvisorStudent({ studentId, version, toast, go, persona }) {
  const map = useMemo(() => getStudentMap(studentId, 'advisor'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => applyLens(map, null), [map]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [promptText, setPromptText] = useState('');
  const notes = getNotes(studentId);
  const prompts = getPrompts(studentId);
  const s = map.student;
  const first = s.name.split(' ')[0];
  const lastMeeting = notes.at(-1)?.date || '2026-09-01';
  const since = map.events.filter((e) => e.date > lastMeeting && e.date <= TODAY);
  const ended = map.lines.filter((l) => l.status === 'ended');
  const soon = map.events.filter((e) => e.type === 'goal' && daysBetween(TODAY, e.date) <= 120 && e.date >= TODAY);
  const open = map.signals.filter((g) => g.open);
  const event = map.events.find((e) => e.id === selected);
  const agenda = [
    since.length ? `${since.length} new station${since.length > 1 ? 's' : ''} since ${fmtDate(lastMeeting)}: ${since.slice(-3).map((e) => e.title).join('; ')}` : `No new stations since ${fmtDate(lastMeeting)}`,
    ...ended.map((l) => `${l.name} has ended. Ask what it gave ${first}.`),
    ...soon.map((e) => `${e.title}: due in ${Math.round(daysBetween(TODAY, e.date) / 7)} weeks`),
    open.length ? `${open.length} open reflection signal${open.length > 1 ? 's' : ''}` : 'All reflection signals answered',
  ];

  return (
    <div className="adv-student">
      <div className="as-head">
        <button className="cb-back" onClick={() => go(persona.id, 'advisory')}>‹ Advisory 4B</button>
        <span className="pres-avatar" style={{ background: s.avatar.colour }}>{s.avatar.initials}</span>
        <div><h1>{s.name}</h1><p>Grade {s.grade} · {s.programme} · advisor view (advisor, school and publishable items)</p></div>
      </div>
      <div className="as-body">
        <div className="as-map">
          <MetroMap map={map} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => setSelected(g.eventId)} fitKey={studentId} />
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly />
        </div>
        <aside className="as-side">
          <section className="card-sec">
            <h3>Meeting agenda</h3>
            <ol className="agenda">{agenda.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </section>
          <section className="card-sec">
            <h3>Send a reflection prompt</h3>
            <p className="fineprint">{event ? `Attached to “${event.title}”.` : 'Tap a station on the map to attach the prompt to it.'}</p>
            <textarea rows={2} value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder={`e.g. What did this teach you, ${first}?`} />
            <button className="primary" disabled={!event || promptText.trim().length < 8} onClick={() => { sendPrompt(studentId, event.id, promptText.trim(), persona.teacherId); setPromptText(''); toast(`Prompt sent. A signal now shows on ${first}'s map.`); }}>Send prompt</button>
            {prompts.length > 0 && <ul className="prompt-hist">{prompts.map((p) => <li key={p.id}><span className={`ph-dot${p.answered ? ' ok' : ''}`} />{p.text}<small>{fmtDate(p.date)} · {p.answered ? 'answered' : 'open'}</small></li>)}</ul>}
          </section>
          <section className="card-sec">
            <h3>Advisor notes <small>only advisors see these</small></h3>
            <ul className="notes">{notes.map((n, i) => <li key={i}><small>{fmtDate(n.date)}</small>{n.text}</li>)}</ul>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note from today’s meeting" />
            <button className="ghost" disabled={!note.trim()} onClick={() => { addNote(studentId, note.trim()); setNote(''); }}>Save note</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
