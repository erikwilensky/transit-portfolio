import { useMemo, useRef, useState } from 'react';
import { getStudentMap, getStudents, getTeacher } from '../api.js';
import { fmtDate, verifyCode } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';

const DRAFTS = {
  'st-01': `I have known Maya Chen for four years as her university counsellor, and it is a pleasure to recommend her for Data Science.

Maya is at her best when a local problem can be measured. In Year 12 she built a network of six air-quality sensors around our campus and wrote the live dashboard that our facilities team still checks every day [ev-042]. She then cleaned 40,000 readings in Python and traced a lunchtime pollution spike to the canteen extractor, which the school has since moved [ev-029].

Her Biology internal assessment went well beyond what the course asks, fitting a growth model to twelve weeks of data [ev-030]. She co-founded a Friday STEM club for Year 7 girls that now has fourteen regular members [ev-025].

Maya is also a natural leader under pressure. She is one of the most curious students I have worked with.`,
};
const CLAIM = /\b(built|led|founded|co-founded|designed|won|placed|organi[sz]ed|created|wrote|ran|analy[sz]ed|calibrated|taught|tutored|traced|fitted|trained|managed|launched|natural leader|leader)\b|\d/i;

// The counsellor writes; every claim can cite a verified station.
export default function ReferenceLetter({ studentId, go, persona }) {
  const seniors = getStudents({ includeCohort: true }).filter((s) => s.grade === 12);
  const map = useMemo(() => getStudentMap(studentId, 'school'), [studentId]);
  const me = getTeacher(persona.teacherId);
  const [texts, setTexts] = useState({});
  const text = texts[studentId] ?? DRAFTS[studentId] ?? `I am pleased to recommend ${map.student.name}.\n\n`;
  const setText = (t) => setTexts({ ...texts, [studentId]: t });
  const [q, setQ] = useState('');
  const [view, setView] = useState('edit');
  const ta = useRef(null);
  const byId = Object.fromEntries(map.events.map((e) => [e.id, e]));
  const stations = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection' && (!q || e.title.toLowerCase().includes(q.toLowerCase()))).slice().reverse();

  const cited = [...new Set([...text.matchAll(/\[(ev-\d+)\]/g)].map((m) => m[1]))];
  const num = Object.fromEntries(cited.map((id, i) => [id, i + 1]));
  const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const unsupported = sentences.filter((x) => CLAIM.test(x.replace(/\[ev-\d+\]/g, '')) && !/\[ev-\d+\]/.test(x));
  const weak = cited.filter((id) => byId[id]?.verification === 'student-added');

  const insert = (id) => {
    const el = ta.current; const pos = el ? el.selectionStart : text.length;
    const before = text.slice(0, pos).replace(/\s+$/, '');
    setText(`${before} [${id}]${text.slice(pos)}`);
    setView('edit');
    setTimeout(() => { el?.focus(); }, 0);
  };
  const render = (para, k) => (
    <p key={k}>{para.split(/(\[ev-\d+\])/).map((part, i) => {
      const m = part.match(/\[(ev-\d+)\]/);
      if (!m) return <span key={i} className={unsupported.some((u) => u.includes(part.trim()) && part.trim().length > 20) ? 'unsup' : ''}>{part}</span>;
      const e = byId[m[1]];
      return <sup key={i} className={`cite v-${e?.verification}`} title={e ? `${e.title} · ${e.verification}` : 'Not found'}>{num[m[1]]}</sup>;
    })}</p>
  );

  return (
    <div className="page letter-page">
      <header className="page-head">
        <div>
          <div className="kicker">Reference letter</div>
          <h1>{map.student.name}</h1>
          <p>Every claim can cite a station from the student’s record. Readers see the citation and how it was verified.</p>
        </div>
        <div className="seg">
          {seniors.map((s) => <button key={s.id} className={s.id === studentId ? 'on' : ''} onClick={() => go(persona.id, 'letter', s.id)}>{s.name.split(' ')[0]}</button>)}
        </div>
      </header>
      <div className="letter-body">
        <div className="letter-main">
          <div className="letter-tools">
            <div className="seg small"><button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Write</button><button className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Preview with citations</button></div>
            <span className="spacer" />
            <span className={`check ${unsupported.length ? 'warn' : 'ok'}`}>{unsupported.length ? `${unsupported.length} claim${unsupported.length > 1 ? 's' : ''} without evidence` : 'Every claim has evidence'}</span>
          </div>
          {view === 'edit'
            ? <textarea ref={ta} className="letter-ta" value={text} onChange={(e) => setText(e.target.value)} spellCheck />
            : (
              <article className="letter-doc">
                <div className="lt-head">NIST International School · University Counselling</div>
                {text.split('\n\n').map(render)}
                <p className="lt-sign">{me.name}<br /><small>{me.role}</small></p>
                {cited.length > 0 && (
                  <ol className="lt-notes">
                    {cited.map((id) => { const e = byId[id]; return e && <li key={id}><b>{e.title}</b>, {fmtDate(e.date)}. <VerifyBadge level={e.verification} /> <code>{verifyCode(id)}</code></li>; })}
                  </ol>
                )}
              </article>
            )}
          {(unsupported.length > 0 || weak.length > 0) && (
            <div className="claims">
              <h3>Claim check</h3>
              <ul>
                {unsupported.map((u, i) => <li key={i} className="warn">No evidence cited: “{u.length > 120 ? `${u.slice(0, 120)}…` : u}”</li>)}
                {weak.map((id) => <li key={id} className="weak">“{byId[id].title}” is student-added and not yet endorsed. Consider asking a teacher to endorse it.</li>)}
              </ul>
            </div>
          )}
        </div>
        <aside className="letter-side">
          <h3>Evidence from the record</h3>
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stations…" />
          <ul className="ev-pick">
            {stations.map((e) => (
              <li key={e.id} className={num[e.id] ? 'cited' : ''}>
                <div><b>{e.title}</b><small>{fmtDate(e.date)}</small><VerifyBadge level={e.verification} /></div>
                <button onClick={() => insert(e.id)}>{num[e.id] ? `Cited [${num[e.id]}]` : 'Cite'}</button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
