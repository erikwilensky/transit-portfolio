import { useState } from 'react';
import { addCheckIn, answerSponsor, getLine, getSponsored } from '../api.js';
import { fmtDate } from '../format.js';

const days = (d) => Math.round((new Date(d) - new Date('2026-10-26')) / 86400000);

// Planned work a student invited this teacher to sponsor, before it happens and outside any school system.
export default function SponsorPanel({ teacherId, toast }) {
  const all = getSponsored(teacherId);
  const invites = all.filter((e) => e.sponsor.status === 'invited');
  const active = all.filter((e) => e.sponsor.status === 'accepted');
  const [exp, setExp] = useState({});
  const [msg, setMsg] = useState({});
  if (!invites.length && !active.length) return null;
  const Lines = ({ e }) => <span className="sp-lines">{e.lineIds.map((id) => <i key={id} style={{ background: getLine(id)?.colour }} aria-hidden="true" />)}</span>;
  return (
    <section className="sponsor-panel" id="sponsor">
      <h2>Planned work you sponsor</h2>
      <p className="fineprint">Students can plan things that no school system knows about, such as an outside hackathon or an independent build, and ask you to sponsor them in advance. When they mark it done, it comes back here to endorse in one click.</p>
      {invites.map((e) => (
        <article key={e.id} className="sp-card invite">
          <div className="sp-top"><Lines e={e} /><b>{e.title}</b><span className="app-st sp-invited">New invitation</span></div>
          <small>{e.student.name} · Year {e.student.grade + 1} · planned for {fmtDate(e.date)} · invited {fmtDate(e.sponsor.invitedOn)}</small>
          <p>{e.summary}</p>
          {e.sponsor.note && <blockquote>“{e.sponsor.note}”</blockquote>}
          <label className="sp-field">What you expect along the way (optional)<input value={exp[e.id] || ''} onChange={(ev) => setExp({ ...exp, [e.id]: ev.target.value })} placeholder="e.g. A playable build after each day, and the audio code on GitHub" /></label>
          <div className="q-actions">
            <button className="primary" onClick={() => { answerSponsor(e.id, true, (exp[e.id] || '').trim()); toast(`You are sponsoring “${e.title}”`); }}>Sponsor it</button>
            <button className="ghost" onClick={() => { answerSponsor(e.id, false); toast('Declined. The student was told kindly.'); }}>Not this time</button>
          </div>
        </article>
      ))}
      {active.map((e) => (
        <article key={e.id} className="sp-card">
          <div className="sp-top"><Lines e={e} /><b>{e.title}</b><span className="app-st sp-accepted">{days(e.date) >= 0 ? `Due in ${days(e.date)} days` : 'Past its date'}</span></div>
          <small>{e.student.name} · Year {e.student.grade + 1} · sponsoring since {fmtDate(e.sponsor.answeredOn)}</small>
          {e.sponsor.expectations && <p className="sp-exp"><small>Your expectations</small>{e.sponsor.expectations}</p>}
          {e.sponsor.checkIns.length > 0 && <ul className="sp-log">{e.sponsor.checkIns.map((c, i) => <li key={i}><small>{fmtDate(c.date)} · {c.by === 'student' ? e.student.name.split(' ')[0] : 'You'}</small>{c.text}</li>)}</ul>}
          <div className="q-actions"><input value={msg[e.id] || ''} onChange={(ev) => setMsg({ ...msg, [e.id]: ev.target.value })} placeholder="Check in with a note" aria-label="Check-in note" /><button className="ghost" disabled={(msg[e.id] || '').trim().length < 4} onClick={() => { addCheckIn(e.id, msg[e.id].trim(), teacherId); setMsg({ ...msg, [e.id]: '' }); toast('Check-in sent'); }}>Send</button></div>
        </article>
      ))}
    </section>
  );
}
