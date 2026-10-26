import { useState } from 'react';
import { getCohort, getEvent, getPrompts, sendPrompt, snapshot } from '../api.js';
import { fmtDate, inkOn } from '../format.js';

const TEMPLATES = {
  branch: ['What made you start this?', 'Why this, and why now?', 'Who got you interested in it?'],
  terminus: ['What did this line give you?', 'What will you keep from it?', 'Would you start it again? Why or why not?'],
  quiet: ['Pick one station from this term. What did you learn there?', 'What are you proudest of since August?'],
};
const KIND = { branch: 'New branch', terminus: 'Line ended', quiet: 'Quiet map' };

// A2: open signals across the advisory, with a kind prompt ready to send.
export default function SignalBoard({ persona, toast, go, version }) {
  const cohort = getCohort(persona.teacherId);
  const rows = cohort.flatMap((c) => [
    ...c.signals.filter((g) => g.open && g.kind !== 'prompt').map((g) => ({ c, kind: g.kind, eventId: g.eventId, line: c.lines.find((l) => l.id === g.lineId), key: g.key })),
    ...(c.flagFewReflections ? [{ c, kind: 'quiet', eventId: c.events.filter((e) => e.type !== 'goal').at(-1)?.id, key: `quiet:${c.student.id}` }] : []),
  ]);
  const waiting = cohort.flatMap((c) => getPrompts(c.student.id).filter((p) => !p.answered).map((p) => ({ c, p })));
  const [text, setText] = useState({});
  const [sent, setSent] = useState([]);
  return (
    <div className="page signals">
      <header className="page-head">
        <div>
          <div className="kicker">Signals · Advisory 4B</div>
          <h1>Where a question would help</h1>
          <p>A signal appears when a line starts or ends without a reflection, or when a map has gone quiet. Send one kind question; it appears as a signal on the student's own map.</p>
        </div>
        <div className="meter"><div><b>{rows.length - sent.length}</b><span>signals to look at</span></div><div><b>{waiting.length}</b><span>prompts waiting for an answer</span></div></div>
      </header>
      <div className="sig-list">
        {rows.map((r) => {
          const done = sent.includes(r.key);
          const e = getEvent(r.eventId);
          const t = text[r.key] ?? TEMPLATES[r.kind][0];
          return (
            <article key={r.key} className={`sig-row k-${r.kind}${done ? ' done' : ''}`}>
              <span className="pres-avatar sm" style={{ background: r.c.student.avatar.colour, color: inkOn(r.c.student.avatar.colour) }}>{r.c.student.avatar.initials}</span>
              <div className="sr-main">
                <div className="sr-top"><b>{r.c.student.name}</b><span className={`sr-kind k-${r.kind}`}>{KIND[r.kind]}</span>{r.line && <span className="line-chip static" style={{ '--c': r.line.colour }}><i className={r.line.pattern === 'cased' ? 'cased' : undefined} />{r.line.name}</span>}</div>
                <p className="fineprint">{r.kind === 'quiet' ? `${r.c.reflectionCount} reflections shared with you. Latest station: “${e?.title}”.` : `At “${e?.title}”, ${fmtDate(e?.date)}`}</p>
                {done ? <p className="sr-sent">✓ Sent. It now shows as a signal on {r.c.student.name.split(' ')[0]}’s map.</p> : (
                  <>
                    <div className="q-chips">{TEMPLATES[r.kind].map((x) => <button key={x} className={t === x ? 'on' : ''} onClick={() => setText({ ...text, [r.key]: x })}>{x}</button>)}</div>
                    <div className="q-actions"><input value={t} onChange={(ev) => setText({ ...text, [r.key]: ev.target.value })} aria-label="Prompt" /><button className="primary" disabled={!e || t.trim().length < 6} onClick={() => { const snap = snapshot(); sendPrompt(r.c.student.id, r.eventId, t.trim(), persona.teacherId); setSent([...sent, r.key]); toast(`Prompt sent to ${r.c.student.name.split(' ')[0]}.`, snap); }}>Send</button></div>
                  </>
                )}
              </div>
              <button className="ghost" onClick={() => go(persona.id, 'student', r.c.student.id)}>Open map</button>
            </article>
          );
        })}
        {!rows.length && <div className="empty-state"><b>No open signals.</b> Every branch and terminus in your advisory has a reflection.</div>}
      </div>
      {waiting.length > 0 && (
        <section className="q-done"><h2>Waiting for an answer</h2>
          <ul>{waiting.map(({ c, p }) => <li key={p.id}><span className="st st-returned">Open</span>{p.text} <small>· {c.student.name}, sent {fmtDate(p.date)}</small></li>)}</ul>
        </section>
      )}
    </div>
  );
}
