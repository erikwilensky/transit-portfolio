import { useMemo, useState } from 'react';
import { answersCsv, declineRequest, endorse, promptReview, REVIEW_LABEL, snapshot } from '../api.js';
import { fmtDate } from '../format.js';
import { CHIPS } from '../screens/TeacherQueue.jsx';
import './class-answers.css';

// Review answers: one class question's answers, endorsed in bulk with one shared note (api.endorse with many ids,
// one change), "Ask for more" per answer (api.declineRequest), and a CSV of every student asked. #/<p>/classes/<class>~answers~<prompt>.
const DEFAULT_MORE = 'Could you add a little more, such as a photo or an example?';
const slug = (s) => String(s || 'answers').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'answers';

export default function ClassAnswers({ promptId, teacherId, back, version, toast }) {
  const rv = useMemo(() => promptReview(promptId), [promptId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [chips, setChips] = useState([]);
  const [more, setMore] = useState({}); // requestId → note text ('' while open)
  if (!rv) return <div className="page mc">{back}<div className="empty-state"><b>This question is not in the record.</b></div></div>;
  const { prompt: p, rows } = rv;
  const mine = p.asMoment && p.teacherId === teacherId;
  const answered = rows.filter((r) => r.answer && !r.answer.skipped);
  const waiting = mine ? rows.filter((r) => r.status === 'waiting') : [];
  const rest = rows.filter((r) => !r.answer || r.answer.skipped);
  const n = (s) => rows.filter((r) => r.status === s).length;
  const sel = picked.filter((id) => waiting.some((r) => r.request.id === id));
  const shared = () => [...chips, note.trim()].filter(Boolean).join('. ') || 'Endorsed.';
  const toggle = (id) => setPicked(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const doEndorse = (ids) => {
    if (!ids.length) return;
    const snap = snapshot();
    endorse(ids, teacherId, shared());
    setPicked([]);
    toast?.(ids.length > 1 ? `${ids.length} answers endorsed. Students were notified.` : 'Endorsed. The student was notified.', snap);
  };
  const askMore = (r) => {
    const snap = snapshot();
    declineRequest(r.request.id, (more[r.request.id] || '').trim() || DEFAULT_MORE);
    setMore(({ [r.request.id]: _, ...m }) => m);
    toast?.(`Sent back to ${r.student?.name.split(' ')[0] || 'the student'} with your note.`, snap);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([answersCsv(p.id)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${slug(p.className)}-${slug(p.context || p.question)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // J/K (or arrows) move between answers, X selects, E endorses, A writes what you need.
  const key = (ev, r) => {
    if (ev.target !== ev.currentTarget) return;
    const cards = [...document.querySelectorAll('.ca-card')];
    const i = cards.indexOf(ev.currentTarget), k = ev.key.toLowerCase(), can = r.status === 'waiting' && mine;
    if (k === 'j' || k === 'arrowdown') { ev.preventDefault(); cards[Math.min(cards.length - 1, i + 1)]?.focus(); }
    else if (k === 'k' || k === 'arrowup') { ev.preventDefault(); cards[Math.max(0, i - 1)]?.focus(); }
    else if (k === 'x' && can) { ev.preventDefault(); toggle(r.request.id); }
    else if (k === 'e' && can) { ev.preventDefault(); doEndorse([r.request.id]); setTimeout(() => document.querySelectorAll('.ca-card')[i]?.focus(), 50); }
    else if (k === 'a' && can) { ev.preventDefault(); setMore((m) => ({ ...m, [r.request.id]: m[r.request.id] || '' })); setTimeout(() => ev.target.querySelector('.ca-more input')?.focus(), 30); }
  };

  return (
    <div className="page mc ca">
      {back}
      <header className="page-head">
        <div>
          <div className="kicker">Review answers · {p.className}</div>
          <h1>{p.question}</h1>
          <p>{p.context ? `${p.context} · ` : ''}Asked {fmtDate(p.date)}{p.teacher && p.teacherId !== teacherId ? ` by ${p.teacher.name}` : ''}{p.asMoment ? '' : ' · answers are reflections, nothing to endorse'}</p>
        </div>
        <div className="cp-head-acts"><button className="ghost" onClick={download}>Download answers (CSV)</button></div>
      </header>
      <p className="ca-count" aria-label="Answers so far">
        <b>{answered.length} of {rows.length}</b> answered
        {['waiting', 'endorsed', 'more', 'skipped', 'none'].filter((s) => n(s)).map((s) => <span key={s} className={`ca-st ca-${s}`}>{n(s)} {REVIEW_LABEL[s].toLowerCase()}</span>)}
      </p>
      {p.asMoment && p.teacherId !== teacherId && <p className="ca-info">These answers came to {p.teacher?.name || 'the teacher who asked'} to endorse. You can read them and download them.</p>}

      {waiting.length > 0 && (
        <div className="ca-bar" role="group" aria-label="Endorse answers">
          <div className="ca-bar-row">
            <label><input type="checkbox" checked={sel.length === waiting.length} onChange={() => setPicked(sel.length === waiting.length ? [] : waiting.map((r) => r.request.id))} /> Select all waiting</label>
            <input className="ca-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for every answer you endorse (optional)" aria-label="Shared note" />
          </div>
          <div className="q-chips">{CHIPS.map((c) => { const on = chips.includes(c); return <button key={c} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setChips(on ? chips.filter((x) => x !== c) : [...chips, c])}>{c}</button>; })}</div>
          <div className="ca-bar-row">
            <details className="kbd-hint"><summary>Keyboard shortcuts</summary><kbd>Tab</kbd> to an answer, then <kbd>J</kbd> <kbd>K</kbd> to move, <kbd>X</kbd> to select, <kbd>E</kbd> to endorse, <kbd>A</kbd> to ask for more.</details>
            <span className="spacer" />
            <button className="ghost" disabled={!sel.length} onClick={() => doEndorse(sel)}>Endorse selected{sel.length ? ` (${sel.length})` : ''}</button>
            <button className="primary" onClick={() => doEndorse(waiting.map((r) => r.request.id))}>Endorse all waiting ({waiting.length})</button>
          </div>
        </div>
      )}
      {!answered.length && <div className="empty-state"><b>No answers yet.</b> They appear here as students answer.</div>}

      <div className="ca-list">
        {answered.map((r) => {
          const can = r.status === 'waiting' && mine, rid = r.request?.id, open = rid && rid in more;
          return (
            <article key={r.studentId} className={`ca-card${can && sel.includes(rid) ? ' on' : ''}`} tabIndex={0} aria-label={`${r.student?.name || 'A student'}: ${REVIEW_LABEL[r.status]}`} onKeyDown={(ev) => key(ev, r)}>
              {can ? <label className="q-pick"><input type="checkbox" checked={sel.includes(rid)} onChange={() => toggle(rid)} aria-label={`Select ${r.student?.name || 'this answer'}`} /></label> : <span />}
              {r.photo ? <a href={r.photo.url} target="_blank" rel="noreferrer"><img className="ca-img" src={r.photo.url} alt={r.photo.caption || 'Photo'} /></a> : <span className="ca-img none" aria-hidden="true" />}
              <div className="ca-body">
                <div className="ca-meta"><b>{r.student?.name || 'A student'}</b>{r.student?.homeroom && <span>{r.student.homeroom}</span>}<small>{fmtDate(r.answer.date)}</small><span className={`ca-st ca-${r.status}`}>{REVIEW_LABEL[r.status]}</span></div>
                <p>{r.answer.text}</p>
                {r.status === 'more' && r.request?.reason && <blockquote className="q-note">You asked: “{r.request.reason}”</blockquote>}
                {can && (open
                  ? <div className="q-actions ca-more">
                    <input value={more[rid]} onChange={(e) => setMore({ ...more, [rid]: e.target.value })} placeholder={DEFAULT_MORE} aria-label={`What you need from ${r.student?.name || 'the student'}`} onKeyDown={(e) => { if (e.key === 'Enter') askMore(r); if (e.key === 'Escape') setMore(({ [rid]: _, ...m }) => m); }} />
                    <button className="ghost" onClick={() => setMore(({ [rid]: _, ...m }) => m)}>Cancel</button>
                    <button className="primary" onClick={() => askMore(r)}>Send</button>
                  </div>
                  : <div className="q-actions"><span className="spacer" /><button className="ghost" onClick={() => setMore({ ...more, [rid]: '' })}>Ask for more</button><button className="primary" onClick={() => doEndorse([rid])}>Endorse</button></div>)}
              </div>
            </article>
          );
        })}
      </div>
      {rest.length > 0 && (
        <section className="ca-rest">
          <h2>No answer</h2>
          <ul>{rest.map((r) => <li key={r.studentId}><span>{r.student?.name || 'A student who has left the class'}</span>{r.student?.homeroom && <small>{r.student.homeroom}</small>}<span className={`ca-st ca-${r.status}`}>{REVIEW_LABEL[r.status]}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
