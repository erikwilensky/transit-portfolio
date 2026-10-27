import { useEffect, useMemo, useRef, useState } from 'react';
import { getLetter, getStudentMap, getStudents, getTeacher, LETTER_STATUSES, saveLetter, setLetterStatus } from '../api.js';
import { ago, fmtDate, verifyCode } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';
import { useVerify } from '../components/VerifyModal.jsx';
import Logo from '../components/Logo.jsx';
import { PrintButton, PrintFooter } from '../components/PrintKit.jsx';
import { docName, printDate } from '../print.js';

const DRAFTS = {
  'st-01': `I have known Maya Chen for four years as her university counsellor, and it is a pleasure to recommend her for Data Science.

Maya is at her best when a local problem can be measured. In Year 12 she built a network of six air-quality sensors around our campus and wrote the live dashboard that our facilities team still checks every day [ev-042]. She then cleaned 40,000 readings in Python and traced a lunchtime pollution spike to the canteen extractor, which the school has since moved [ev-029].

Her Biology internal assessment went well beyond what the course asks, fitting a growth model to twelve weeks of data [ev-030]. She co-founded a Friday STEM club for Year 7 girls that now has fourteen regular members [ev-025].

Maya is also a natural leader under pressure. She is one of the most curious students I have worked with.`,
};
const CLAIM = /\b(built|led|founded|co-founded|designed|won|placed|organi[sz]ed|created|wrote|ran|analy[sz]ed|calibrated|taught|tutored|traced|fitted|trained|managed|launched|natural leader|leader)\b|\d/i;

// The counsellor writes; every claim can cite a verified station.
export default function ReferenceLetter({ studentId, go, persona, version, toast }) {
  const seniors = getStudents({ includeCohort: true }).filter((s) => s.grade === 12);
  const map = useMemo(() => getStudentMap(studentId, 'school'), [studentId]);
  const me = getTeacher(persona.teacherId);
  // F13: one draft per student, autosaved into the record, with a status.
  const saved = getLetter(studentId);
  const [texts, setTexts] = useState({});
  const text = texts[studentId] ?? saved?.text ?? DRAFTS[studentId] ?? `I am pleased to recommend ${map.student.name}.\n\n`;
  const setText = (t) => setTexts({ ...texts, [studentId]: t });
  const dirty = texts[studentId] !== undefined && texts[studentId] !== saved?.text;
  useEffect(() => {
    if (!dirty) return undefined;
    const t = setTimeout(() => saveLetter(studentId, texts[studentId]), 700);
    return () => clearTimeout(t);
  }, [texts, studentId, dirty]);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 20000); return () => clearInterval(t); }, []);
  const status = saved?.status || 'Draft';
  const locked = status === 'Sent';
  const openVerify = useVerify();
  const [q, setQ] = useState('');
  const [view, setView] = useState('edit');
  const ta = useRef(null);
  const byId = Object.fromEntries(map.events.map((e) => [e.id, e]));
  const stations = map.events.filter((e) => e.type !== 'goal' && e.type !== 'reflection' && (!q || e.title.toLowerCase().includes(q.toLowerCase()))).slice().reverse();

  const cited = [...new Set([...text.matchAll(/\[(ev-[\w-]+)\]/g)].map((m) => m[1]))];
  const num = Object.fromEntries(cited.map((id, i) => [id, i + 1]));
  const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const unsupported = sentences.filter((x) => CLAIM.test(x.replace(/\[ev-[\w-]+\]/g, '')) && !/\[ev-[\w-]+\]/.test(x));
  const weak = cited.filter((id) => byId[id]?.verification === 'student-added');

  const insert = (id) => {
    const el = ta.current; const pos = el ? el.selectionStart : text.length;
    const before = text.slice(0, pos).replace(/\s+$/, '');
    setText(`${before} [${id}]${text.slice(pos)}`);
    setView('edit');
    setTimeout(() => { el?.focus(); }, 0);
  };
  const render = (para, k) => (
    <p key={k}>{para.split(/(\[ev-[\w-]+\])/).map((part, i) => {
      const m = part.match(/\[(ev-[\w-]+)\]/);
      if (!m) return <span key={i} className={unsupported.some((u) => u.includes(part.trim()) && part.trim().length > 20) ? 'unsup' : ''}>{part}</span>;
      const e = byId[m[1]];
      return <sup key={i} className={`cite v-${e?.verification}`}>{e && openVerify ? <button className="cite-btn" onClick={() => openVerify(e.id)} title={`${e.title} · ${e.verification}. Open the verification record`}>{num[m[1]]}</button> : num[m[1]]}</sup>;
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
          {seniors.map((s) => <button key={s.id} className={s.id === studentId ? 'on' : ''} onClick={() => go(persona.id, 'letter', s.id)}>{s.name.split(' ')[0]}{getLetter(s.id) && <small className={`lt-pill st-${getLetter(s.id).status.toLowerCase()}`}>{getLetter(s.id).status}</small>}</button>)}
        </div>
      </header>
      <div className="letter-body">
        <div className="letter-main">
          <div className="letter-tools">
            <div className="seg small"><button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Write</button><button className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Preview with citations</button></div>
            <span className="lt-save" role="status">{locked ? `Sent ${fmtDate(saved.sentOn)}` : dirty ? 'Saving…' : saved?.savedAt ? `Saved ${ago(saved.savedAt)}` : 'Not edited yet'}</span>
            <span className="spacer" />
            <label className="lt-status">Status <select value={status} onChange={(e) => { setLetterStatus(studentId, e.target.value, persona.name); if (!saved?.text) saveLetter(studentId, text); toast(`${map.student.name.split(' ')[0]}’s letter: ${e.target.value.toLowerCase()}`); }}>{LETTER_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <span className={`check ${unsupported.length ? 'warn' : 'ok'}`}>{unsupported.length ? `${unsupported.length} claim${unsupported.length > 1 ? 's' : ''} without evidence` : 'Every claim has evidence'}</span>
            <PrintButton title={docName(map.student.name, 'Reference letter')} />
          </div>
          {view === 'edit' && <textarea ref={ta} className="letter-ta" value={text} onChange={(e) => setText(e.target.value)} spellCheck readOnly={locked} aria-label="Letter text" />}
          {/* While writing, the finished letter is still what goes to paper. */}
          <article className={`letter-doc${view === 'edit' ? ' lt-paper-only' : ''}`}>
            <div className="lt-head"><Logo className="lt-logo" /><span>NIST International School · University Counselling</span></div>
            <p className="lt-date">{locked && saved?.sentOn ? fmtDate(saved.sentOn) : printDate()}</p>
            {text.split('\n\n').map(render)}
            <p className="lt-sign">{me.name}<br /><small>{me.role}</small></p>
            {cited.length > 0 && (
              <ol className="lt-notes">
                {cited.map((id) => { const e = byId[id]; return e && <li key={id}><b>{e.title}</b>, {fmtDate(e.date)}. <VerifyBadge level={e.verification} event={e} verifiable /> <code>{verifyCode(id)}</code></li>; })}
              </ol>
            )}
          </article>
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
                <button disabled={locked} onClick={() => insert(e.id)}>{num[e.id] ? `Cited [${num[e.id]}]` : 'Cite'}</button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <PrintFooter name={`Reference for ${map.student.name}`} />
    </div>
  );
}
