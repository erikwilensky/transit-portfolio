import { useMemo, useState } from 'react';
import { addNote, applyLens, getNotes, getPrompts, getStudentMap, growth, addLog, sendPrompt, snapshot, TODAY, advisoryOf } from '../api.js';
import { appUrl, fmtDate, inkOn } from '../format.js';
import MeetingMode from '../components/MeetingMode.jsx';
import Qr from '../components/Qr.jsx';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { SignInHelp } from './SignIn.jsx';
import { isPilot } from '../auth.js';
import { ConferenceSheets } from '../components/ConferenceSheets.jsx';

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Advisor drill-down: the student's map as the advisor may see it, notes and a meeting agenda.
export default function AdvisorStudent({ studentId, version, toast, go, persona, focus }) {
  const map = useMemo(() => getStudentMap(studentId, 'advisor'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => applyLens(map, null), [map]);
  const [selected, setSelected] = useState(focus || null); // a comment notification opens its station
  const [note, setNote] = useState('');
  const [promptText, setPromptText] = useState('');
  const notes = getNotes(studentId);
  const [meeting, setMeeting] = useState(false);
  const [parent, setParent] = useState(false);
  const [sheet, setSheet] = useState(false);
  const one = useMemo(() => [studentId], [studentId]);
  const g = growth(studentId);
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
    since.length ? `${since.length} new station${since.length > 1 ? 's' : ''} since ${fmtDate(lastMeeting)}: ${since.slice(-3).map((e) => `“${e.title}”`).join(', ')}` : `No new stations since ${fmtDate(lastMeeting)}`,
    ...ended.map((l) => `${l.name} has ended. Ask what it gave ${first}.`),
    ...soon.map((e) => `${e.title}: due in ${Math.round(daysBetween(TODAY, e.date) / 7)} weeks`),
    open.length ? `${open.length} open reflection signal${open.length > 1 ? 's' : ''}` : 'All reflection signals answered',
  ];

  return (
    <div className="adv-student">
      <div className="as-head">
        <button className="cb-back" onClick={() => go(persona.id, 'advisory')}>‹ {advisoryOf(persona.teacherId).name}</button>
        <span className="pres-avatar" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>
        <div><h1>{s.name}</h1><p>Year {s.grade + 1} · {s.programme} · advisor view (advisor, school and publishable items)</p></div>
        <span className="spacer" />
        <button className="ghost" onClick={() => setSheet(true)}>Conference sheet</button>
        <button className="primary" onClick={() => setMeeting(true)}>Start meeting mode</button>
      </div>
      <div className="as-body">
        <div className="as-map">
          <MetroMap recent map={map} lens={lens} selectedId={selected} onSelect={setSelected} onSignal={(g) => setSelected(g.eventId)} fitKey={studentId} />
          <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly toast={toast} />
        </div>
        <aside className="as-side">
          <section className="card-sec">
            <h3>Meeting agenda</h3>
            <ol className="agenda">{agenda.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </section>
          <details className="card-sec growth">
            <summary><h3>This term against last term</h3></summary>
            <div className="gr-row">
              {[['stations', 'stations'], ['reflections', 'reflections']].map(([k, l]) => { const d = g.now[k] - g.before[k]; return <div key={k}><b>{g.now[k]}</b><span>{l} this term</span><small className={d > 0 ? 'up' : ''}>{d === 0 ? 'same as last term' : `${Math.abs(d)} ${d > 0 ? 'more' : 'fewer'} than last term`}</small></div>; })}
            </div>
            <p className="fineprint">Progress is only ever compared with the student’s own past, never with classmates.</p>
          </details>
          <details className="card-sec" open={!!event}>
            <summary><h3>Send a reflection prompt</h3></summary>
            <p className="fineprint">{event ? `Attached to “${event.title}”.` : 'Tap a station on the map to attach the prompt to it.'}</p>
            <textarea rows={2} value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder={`e.g. What did this teach you, ${first}?`} />
            <button className="primary" disabled={!event || promptText.trim().length < 8} onClick={() => { const snap = snapshot(); sendPrompt(studentId, event.id, promptText.trim(), persona.teacherId); setPromptText(''); toast(`Prompt sent. A signal now shows on ${first}'s map.`, snap); }}>Send prompt</button>
            {prompts.length > 0 && <ul className="prompt-hist">{prompts.map((p) => <li key={p.id}><span className={`ph-dot${p.answered ? ' ok' : ''}`} />{p.text}<small>{fmtDate(p.date)} · {p.answered ? 'answered' : 'open'}</small></li>)}</ul>}
          </details>
          <details className="card-sec">
            <summary><h3>Parent conference link</h3></summary>
            {parent ? (
              <div className="pc-link">
                <Qr text={appUrl(`p/${studentId}`)} size={96} />
                <div><code>/p/{studentId}</code><small>Works for 7 days, in English or Thai. Shows only what {first} made publishable.</small>
                  <span className="pc-open"><a className="ghost" href={appUrl(`p/${studentId}`)} target="_blank" rel="noreferrer">Open in English</a><a className="ghost" href={appUrl(`p/${studentId}/th`)} target="_blank" rel="noreferrer" lang="th">เปิดเป็นภาษาไทย</a></span></div>
              </div>
            ) : (
              <><p className="fineprint">A short-lived link for parents before the conference. It shows what {first} chose to share publicly, never advisor notes or private reflections.</p>
                <button className="ghost" onClick={() => { setParent(true); addLog(studentId, persona.name, 'link', 'Made a 7-day parent conference link'); toast('Parent link ready for 7 days'); }}>Make a parent link</button></>
            )}
          </details>
          <details className="card-sec">
            <summary><h3>Advisor notes <small>only advisors see these</small></h3></summary>
            <ul className="notes">{notes.map((n, i) => <li key={i}><small>{fmtDate(n.date)}</small>{n.text}</li>)}</ul>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note from today’s meeting" />
            <button className="ghost" disabled={!note.trim()} onClick={() => { addNote(studentId, note.trim()); setNote(''); }}>Save note</button>
          </details>
          {isPilot() && <SignInHelp studentId={studentId} first={first} />}
        </aside>
      </div>
      {sheet && <ConferenceSheets studentIds={one} advisorId={persona.teacherId} title={`${s.name} – Conference sheet`} onClose={() => setSheet(false)} />}
      {meeting && <MeetingMode studentId={studentId} agenda={agenda} advisorId={persona.teacherId} version={version} toast={toast} onClose={() => setMeeting(false)} />}
    </div>
  );
}
