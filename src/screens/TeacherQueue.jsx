import { useEffect, useState } from 'react';
import ClassTask from '../components/ClassTask.jsx';
import { declineRequest, endorse, getRequests, getStore, getTeacher, getLine, snapshot } from '../api.js';
import { fmtDate, TYPE_LABEL, inkOn } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';
import SponsorPanel from '../components/SponsorPanel.jsx';
import { getSponsored } from '../api.js';
import { FileLinks } from '../components/FileAttach.jsx';
import { isPilot } from '../auth.js';
import { classAnswerGroups } from '../api.js';
import '../components/class-answers.css';
import MomentComments from '../components/MomentComments.jsx';
import { commentStaff, getEvent, getMomentComments, getStudent } from '../api.js';
import PhraseTools from '../components/Phrases.jsx';

export const CHIPS = ['Independent work', 'Beyond the syllabus', 'Strong collaboration', 'Real-world impact', 'Clear progress'];

// A subject teacher's home: items waiting for an endorsement, one click each.
export default function TeacherQueue({ teacherId, toast, version, focus, go, persona }) {
  // #/nair/queue/sponsor scrolls to the sponsored plans (used by the deep-dive tour).
  useEffect(() => { if (focus === 'sponsor') setTimeout(() => document.getElementById('sponsor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, [focus]);
  const t = getTeacher(teacherId);
  // Answers to one class question (2 or more) wait as one card that opens Review answers (ClassAnswers.jsx).
  const groups = classAnswerGroups(teacherId);
  const inGroup = new Set(groups.flatMap((g) => g.requests.map((r) => r.id)));
  const waitingAll = getRequests(teacherId);
  const pending = waitingAll.filter((r) => !inGroup.has(r.id));
  const review = (g) => go?.(persona.id, 'classes', `${g.prompt.classId}~answers~${g.prompt.id}`);
  const done = getRequests(teacherId, null).filter((r) => r.status !== 'pending');
  const [classTask, setClassTask] = useState(false);
  const [picked, setPicked] = useState([]);
  const [notes, setNotes] = useState({});
  const [chips, setChips] = useState({});
  // The demo's teachers come with a term's worth of earlier endorsements; a pilot counts only real ones.
  const termEndorsed = (isPilot() ? 0 : 14) + done.filter((r) => r.status === 'endorsed').length;
  const autoShare = (() => { const ev = getStore().events.filter((e) => e.date >= '2026-08-15'); return Math.round(100 * ev.filter((e) => e.verification === 'school-verified').length / Math.max(1, ev.length)); })();
  const noteFor = (r) => [...(chips[r.id] || []), notes[r.id]].filter(Boolean).join('. ') || 'Endorsed.';
  // F18: J and K (or the arrow keys) move between cards, E endorses, A asks for more, X selects.
  const cardKey = (ev, r) => {
    if (ev.target !== ev.currentTarget) return;
    const cards = [...document.querySelectorAll('.q-card')];
    const i = cards.indexOf(ev.currentTarget);
    const k = ev.key.toLowerCase();
    if (k === 'j' || k === 'arrowdown') { ev.preventDefault(); cards[Math.min(cards.length - 1, i + 1)]?.focus(); }
    else if (k === 'k' || k === 'arrowup') { ev.preventDefault(); cards[Math.max(0, i - 1)]?.focus(); }
    else if (k === 'e') { ev.preventDefault(); doEndorse([r.id]); setTimeout(() => document.querySelectorAll('.q-card')[Math.min(i, cards.length - 2)]?.focus(), 50); }
    else if (k === 'a') { ev.preventDefault(); ev.currentTarget.querySelector('.q-actions input')?.focus(); }
    else if (k === 'x') { ev.preventDefault(); setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id]); }
  };
  const doEndorse = (ids) => {
    const snap = snapshot();
    ids.forEach((id) => endorse(id, teacherId, noteFor(pending.find((r) => r.id === id))));
    setPicked([]);
    toast(ids.length > 1 ? `${ids.length} items endorsed. Students were notified.` : 'Endorsed. The badge on the student’s map is now outlined.', snap);
  };

  return (
    <div className="page queue">
      {classTask && <ClassTask teacherId={teacherId} toast={toast} onClose={() => setClassTask(false)} />}
      <header className="page-head">
        <div>
          <div className="kicker">Endorsement queue</div>
          <h1>{t.name}</h1>
          <p>{t.role} · items that need a teacher’s eye.{isPilot() ? '' : ` About 3 minutes each; ${autoShare}% of stations verify themselves with no teacher needed.`}</p>
          <button className="ghost ct-open" onClick={() => setClassTask(true)}>Endorse a whole-class task</button>
          {getSponsored(teacherId).some((e) => e.sponsor.status === 'invited') && <a className="sp-jump" href="#sponsor" onClick={(ev) => { ev.preventDefault(); document.getElementById('sponsor')?.scrollIntoView({ behavior: 'smooth' }); }}>{getSponsored(teacherId).filter((e) => e.sponsor.status === 'invited').length} new sponsor invitation ↓</a>}
        </div>
        <div className="meter" aria-label="Workload this term">
          <div><b>{waitingAll.length}</b><span>waiting</span></div>
          <div><b>{termEndorsed}</b><span>endorsed this term</span></div>
        </div>
      </header>

      {pending.length > 1 && (
        <div className="batch-bar">
          <label><input type="checkbox" checked={picked.length === pending.length} onChange={() => setPicked(picked.length === pending.length ? [] : pending.map((r) => r.id))} /> Select all</label>
          <details className="kbd-hint"><summary>Keyboard shortcuts</summary><kbd>Tab</kbd> to a card, then <kbd>J</kbd> <kbd>K</kbd> to move, <kbd>E</kbd> to endorse, <kbd>A</kbd> to write what you need, <kbd>X</kbd> to select.</details>
          <span className="spacer" />
          <button className="primary" disabled={!picked.length} onClick={() => doEndorse(picked)}>Endorse {picked.length || ''} selected</button>
        </div>
      )}
      {!waitingAll.length && <div className="empty-state"><b>All caught up.</b> New requests will appear here and in your notifications.</div>}

      <h2 className="sr-only">Waiting for you</h2>
      <div className="queue-list">
        {groups.map((g) => (
          <article key={g.prompt.id} className="q-group" tabIndex={0} aria-label={`Answers to ${g.prompt.question}`} onKeyDown={(ev) => { if (ev.target === ev.currentTarget && ev.key === 'Enter') review(g); }}>
            <div className="q-meta"><span>{g.prompt.className || 'Your class'}</span><span>Asked {fmtDate(g.prompt.date)}</span>{g.requests.some((r) => r.fresh) && <span className="new-pill">NEW</span>}</div>
            <h3>Answers to “{g.prompt.question}” · {g.requests.length} waiting</h3>
            <div className="q-who">{g.requests.slice(0, 6).map((r) => <span key={r.id} className="pres-avatar xs" title={r.student?.name} style={{ background: r.student?.avatar.colour, color: inkOn(r.student?.avatar.colour || '#002855') }}>{r.student?.avatar.initials}</span>)}
              <span>{g.requests.slice(0, 3).map((r) => r.student?.name.split(' ')[0]).filter(Boolean).join(', ')}{g.requests.length > 3 ? ` and ${g.requests.length - 3} more` : ''}</span></div>
            <div className="q-actions"><button className="primary" onClick={() => review(g)}>Review all</button></div>
          </article>
        ))}
        {pending.map((r) => {
          const e = r.event;
          const img = e.evidence.find((x) => x.kind === 'image');
          return (
            <article key={r.id} className={`q-card${r.fresh ? ' fresh' : ''}`} tabIndex={0} aria-label={`${r.student.name}: ${e.title}`} onKeyDown={(ev) => cardKey(ev, r)}>
              <label className="q-pick"><input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked(picked.includes(r.id) ? picked.filter((x) => x !== r.id) : [...picked, r.id])} aria-label={`Select ${e.title}`} /></label>
              {img ? <img src={img.url} alt={img.caption} className="q-img" /> : <div className="q-img none">{TYPE_LABEL[e.type]}</div>}
              <div className="q-body">
                <div className="q-meta">
                  <span className="pres-avatar xs" style={{ background: r.student.avatar.colour, color: inkOn(r.student.avatar.colour) }}>{r.student.avatar.initials}</span>
                  <b>{r.student.name}</b><span>Year {r.student.grade + 1}</span>
                  <span className="q-src">{r.source === 'lms' ? 'From ManageBac' : r.source === 'sponsor' ? 'Finished project you sponsored' : 'Requested by the student'} · {fmtDate(r.date)}</span>
                  {r.resubmitted ? <span className="new-pill">RESUBMITTED</span> : r.fresh && <span className="new-pill">NEW</span>}
                </div>
                <h3>{e.title}</h3>
                <p>{e.about || e.summary}</p>
                <div className="q-tags">
                  {e.lineIds.map((id) => { const l = getLine(id); return l && <span key={id} className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name}</span>; })}
                  <VerifyBadge level={e.verification} />
                  <span className="q-src">{e.source.system}{e.source.ref ? ` · ${e.source.ref}` : ''}</span>
                </div>
                {r.note && <blockquote className="q-note">“{r.note}”</blockquote>}
                <FileLinks evidence={e.evidence} />
                <div className="q-chips">{CHIPS.map((c) => { const on = (chips[r.id] || []).includes(c); return <button key={c} className={on ? 'on' : ''} onClick={() => setChips({ ...chips, [r.id]: on ? chips[r.id].filter((x) => x !== c) : [...(chips[r.id] || []), c] })}>{c}</button>; })}</div>
                <div className="q-actions">
                  <input value={notes[r.id] || ''} onChange={(ev) => setNotes({ ...notes, [r.id]: ev.target.value })} placeholder="A note for the record, or what you need to see" aria-label="Note" />
                  <button className="ghost" title="Sends your note to the student as what you need to see" onClick={() => { const snap = snapshot(); declineRequest(r.id, (notes[r.id] || '').trim() || 'Could you add more evidence, such as the code or a photo?'); toast(`Sent back to ${r.student.name.split(' ')[0]} with your request.`, snap); }}>Ask for more</button>
                  <button className="primary" onClick={() => doEndorse([r.id])}>Endorse</button>
                </div>
                <PhraseTools value={notes[r.id] || ''} onChange={(v) => setNotes({ ...notes, [r.id]: v })} first={r.student.name.split(' ')[0]} kind="praise" />
                <MomentComments key={`c-${e.id}`} event={e} collapsible open={focus === `c~${e.id}`} toast={toast} />
              </div>
            </article>
          );
        })}
      </div>

      <Conversations teacherId={teacherId} skip={new Set(pending.map((r) => r.eventId))} focus={focus} toast={toast} />

      <SponsorPanel teacherId={teacherId} toast={toast} />

      {done.length > 0 && (
        <section className="q-done">
          <h2>Done today</h2>
          <ul>{done.map((r) => <li key={r.id}><span className={`st st-${r.status}`}>{r.status === 'endorsed' ? 'Endorsed' : 'Sent back'}</span>{r.event.title} <small>· {r.student.name}</small></li>)}</ul>
        </section>
      )}
    </div>
  );
}

// Comment threads on moments this teacher is part of (asked, sponsor, advisor, or wrote in), beyond the cards above.
// A comment notification links here: #/<persona>/queue/c~<eventId>.
function Conversations({ teacherId, skip, focus, toast }) {
  const ids = [...new Set((getStore().momentComments || []).map((c) => c.eventId))].filter((id) => !skip.has(id) && getEvent(id) && commentStaff(id).includes(teacherId));
  const last = (id) => getMomentComments(id).at(-1)?.at || '';
  const list = ids.sort((a, b) => last(b).localeCompare(last(a)));
  useEffect(() => { if (focus?.startsWith('c~')) setTimeout(() => document.getElementById(`talk-${focus.slice(2)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }, [focus]);
  if (!list.length) return null;
  return (
    <section className="q-talk">
      <h2>Comments on moments</h2>
      <ul>{list.map((id) => { const e = getEvent(id); const s = getStudent(e.studentId); return (
        <li key={id} id={`talk-${id}`} className={focus === `c~${id}` ? 'focus' : ''}>
          <div className="q-talk-top"><b>{e.title}</b><small>{s?.name}</small></div>
          <MomentComments event={e} collapsible open={focus === `c~${id}`} toast={toast} />
        </li>
      ); })}</ul>
    </section>
  );
}
