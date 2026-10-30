import { useMemo, useState } from 'react';
import { ATL, chooseSkills, chosenSkills, getIntensity, getStudentMap, LEARNER_PROFILE, SKILL_MAX, SKILL_WORDS, skillsGrowth } from '../api.js';
import { fmtDate } from '../format.js';
import { dateIn, SKILL_WORDS_TH, tr } from '../i18n.js';
import './skills-growth.css';

// Skills growth: which IB learner profile attributes and ATL skills a student's moments show this school year, from the
// skills the student picked (never the app's guesses). A picture, never a score or a comparison. Student text is English
// here and shown in Thai at display time (src/thai.js); the family words are in SAY below.
export const SKILL_ICON = { Inquirer: '❓', Knowledgeable: '📚', Thinker: '🧩', Communicator: '💬', Principled: '⚖️', 'Open-minded': '🌏', Caring: '💛',
  'Risk-taker': '🚀', Balanced: '🧘', Reflective: '🪞', Thinking: '💡', Communication: '✍️', Social: '👥', 'Self-management': '🗓️', Research: '🔎' };
const GROUPS = [['lp', LEARNER_PROFILE], ['atl', ATL]];
const GROUP_NAME = { simple: { lp: 'What kind of learner I was', atl: 'What I did' }, std: { lp: 'Learner profile', atl: 'Approaches to learning' } };

// Up to three skills. At Simple: big picture chips with plain words.
export function SkillPick({ value, onChange, simple = false }) {
  const full = value.length >= SKILL_MAX;
  return (
    <div className={`sk-pick${simple ? ' simple' : ''}`}>
      <p className="sk-max">{full ? `That is ${SKILL_MAX}. Tap one again to change it.` : `Pick up to ${SKILL_MAX}. You can skip this.`}</p>
      {GROUPS.map(([g, list]) => (
        <div key={g} className="sk-group" role="group" aria-label={GROUP_NAME[simple ? 'simple' : 'std'][g]}>
          <small>{GROUP_NAME[simple ? 'simple' : 'std'][g]}</small>
          <div className="sk-chips">{list.map((k) => { const on = value.includes(k); return (
            <button key={k} type="button" className={`sk-chip${on ? ' on' : ''}`} aria-pressed={on} disabled={!on && full} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>
              <span className="sk-ico" aria-hidden="true">{SKILL_ICON[k]}</span>
              {simple ? <b>{SKILL_WORDS[k]}</b> : <span><b>{k}</b><small>{SKILL_WORDS[k]}</small></span>}
            </button>); })}</div>
        </div>
      ))}
    </div>
  );
}

// In an add flow: closed until the student wants it.
export function SkillsStep({ value, onChange, simple = false }) {
  const [open, setOpen] = useState(value.length > 0);
  if (!open) return <button type="button" className="ghost sk-open" onClick={() => setOpen(true)}><span aria-hidden="true">✦</span> {simple ? 'Which skills did I use? (optional)' : 'Add skills (optional)'}</button>;
  return <div className="sk-step"><p className="sk-q">{simple ? 'Which skills did I use?' : 'Skills this moment shows'}</p><SkillPick value={value} onChange={onChange} simple={simple} /></div>;
}
// After addStation: only when the student picked some, so an untouched moment keeps its suggestions.
export const saveSkills = (e, keys) => { if (e?.id && keys?.length) chooseSkills(e.id, keys); };

// The skills on one moment, with Add / Change for the student (the Simple moment card, My skills).
export function MomentSkills({ e, simple = false, readOnly = false, toast, startOpen = false, onDone }) {
  const [edit, setEdit] = useState(startOpen);
  const mine = chosenSkills(e);
  const [picks, setPicks] = useState(mine);
  if (edit) return (
    <div className="sk-moment editing">
      <p className="sk-q">{simple ? 'Which skills did I use?' : 'Skills this moment shows'}</p>
      <SkillPick value={picks} onChange={setPicks} simple={simple} />
      <div className="sk-acts"><button type="button" className="ghost" onClick={() => { setPicks(mine); setEdit(false); onDone?.(); }}>Cancel</button>
        <button type="button" className="primary" onClick={() => { chooseSkills(e.id, picks); setEdit(false); onDone?.(); toast?.(picks.length ? 'Skills saved.' : 'Skills taken off.'); }}>Save skills</button></div>
    </div>
  );
  if (readOnly && !mine.length) return null;
  return (
    <div className="sk-moment">
      {mine.length > 0 && <ul className="sk-have" aria-label="Skills I used">{mine.map((k) => <li key={k}><span className="sk-ico" aria-hidden="true">{SKILL_ICON[k]}</span>{simple ? SKILL_WORDS[k] : k}</li>)}</ul>}
      {!readOnly && <button type="button" className="linkish sk-edit" onClick={() => { setPicks(mine); setEdit(true); }}>{mine.length ? 'Change skills' : simple ? 'Which skills did I use?' : 'Add skills'}</button>}
    </div>
  );
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const EN = {
  term: (i) => `Term ${i + 1}`, n: (n) => (n ? plural(n, 'moment') : 'Not yet'), lp: 'Learner profile', atl: 'Approaches to learning',
  table: 'Show as a table', chart: 'Show as a chart', skill: 'Skill', year: 'This school year', name: (k) => k, word: (k) => SKILL_WORDS[k],
  sr: (t) => `(${t[0]} in Term 1, ${t[1]} in Term 2, ${t[2]} in Term 3)`, seg: (i, n) => `Term ${i + 1}: ${plural(n, 'moment')}`, now: 'now',
  caption: 'Moments showing each skill, by term', legend: 'Terms',
};
const SAY = {
  en: { ...EN, title: 'Skills growth', none: (f) => `No skills on the moments you can see yet. ${f} picks them when adding a moment.`,
    lede: (f, y) => `The skills ${f} picked for moments you can see, this school year (${y}). Not a score.`, open: 'Moments behind it', date: fmtDate },
  th: { ...EN, title: 'ทักษะที่เติบโต', term: (i) => `ภาคเรียนที่ ${i + 1}`, n: (n) => (n ? `${n} เรื่องราว` : 'ยังไม่มี'), lp: 'คุณลักษณะผู้เรียน IB', atl: 'ทักษะการเรียนรู้ (ATL)',
    table: 'แสดงเป็นตาราง', chart: 'แสดงเป็นแผนภูมิ', skill: 'ทักษะ', year: 'ปีการศึกษานี้', name: (k) => tr('th', k), word: (k) => SKILL_WORDS_TH[k],
    sr: (t) => `(ภาคเรียนที่ 1: ${t[0]}, ภาคเรียนที่ 2: ${t[1]}, ภาคเรียนที่ 3: ${t[2]})`, seg: (i, n) => `ภาคเรียนที่ ${i + 1}: ${n} เรื่องราว`, now: 'ตอนนี้',
    caption: 'เรื่องราวที่แสดงแต่ละทักษะ แยกตามภาคเรียน', legend: 'ภาคเรียน',
    none: (f) => `ยังไม่มีทักษะในเรื่องราวที่คุณเห็น ${f} เลือกทักษะเมื่อเพิ่มเรื่องราว`,
    lede: (f, y) => `ทักษะที่ ${f} เลือกให้กับเรื่องราวที่คุณเห็นได้ ในปีการศึกษานี้ (${y}) ไม่ใช่คะแนน`, open: 'เรื่องราวที่เกี่ยวข้อง', date: (d) => dateIn('th', d) },
};

// A row per skill in the IB order (never sorted by count), its bar split by term (one hue, lighter = earlier), and a table.
export function SkillsChart({ g, sel, onPick, say = EN, idPrefix = 'sk' }) {
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...g.rows.map((r) => r.n));
  return (
    <div className="sk-chart">
      <div className="sk-bar-top">
        <ul className="sk-legend" aria-label={say.legend}>{[0, 1, 2].map((i) => <li key={i}><i className={`t${i + 1}`} />{`${say.term(i)}${i === g.term ? ` · ${say.now}` : ''}`}</li>)}</ul>
        <button type="button" className="linkish sk-tbl" aria-pressed={table} onClick={() => setTable(!table)}>{table ? say.chart : say.table}</button>
      </div>
      {table ? (
        <table className="sk-table">
          <caption className="sr-only">{say.caption}</caption>
          <thead><tr><th scope="col">{say.skill}</th>{[0, 1, 2].map((i) => <th key={i} scope="col">{say.term(i)}</th>)}<th scope="col">{say.year}</th></tr></thead>
          <tbody>{g.rows.map((r) => <tr key={r.k}><th scope="row">{say.name(r.k)}</th>{r.terms.map((n, i) => <td key={i}>{n}</td>)}<td>{r.n}</td></tr>)}</tbody>
        </table>
      ) : GROUPS.map(([gk]) => (
        <section key={gk} className="sk-grp" aria-labelledby={`${idPrefix}-${gk}`}>
          <h4 id={`${idPrefix}-${gk}`}>{say[gk]}</h4>
          <ul className="sk-rows">{g.rows.filter((r) => r.field === gk).map((r) => {
            const inner = <>
              <span className="sk-k"><b>{say.name(r.k)}</b><small>{say.word(r.k)}</small></span>
              <span className="sk-track" aria-hidden="true">{r.terms.map((n, i) => n > 0 && <i key={i} className={`t${i + 1}`} style={{ width: `${(n / max) * 100}%` }} title={say.seg(i, n)} />)}</span>
              <span className="sk-n">{say.n(r.n)}</span>
              {r.n > 0 && <span className="sr-only">{say.sr(r.terms)}</span>}
            </>;
            return <li key={r.k}>{r.n
              ? <button type="button" className={`sk-row${sel === r.k ? ' on' : ''}`} aria-pressed={sel === r.k} onClick={() => onPick(sel === r.k ? null : r.k)}>{inner}</button>
              : <div className="sk-row zero">{inner}</div>}</li>;
          })}</ul>
        </section>
      ))}
    </div>
  );
}

function Behind({ k, g, events, say, onOpen }) {
  const ids = g.rows.find((r) => r.k === k)?.ids || [];
  const list = events.filter((e) => ids.includes(e.id)).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="sk-behind" aria-live="polite">
      <h4>{`${say.name(k)} · ${say.open}`}</h4>
      <ul>{list.map((e) => <li key={e.id}><button type="button" className="linkish" lang="en" onClick={() => onOpen(e.id)}>{e.title}</button> <small>{say.date(e.date)}</small></li>)}</ul>
    </div>
  );
}

// Staff (an advisee's page, a pupil in a teacher's class) and families: from the events that viewer's map already shows.
export function SkillsGrowthCard({ events, first, onOpen, lang = 'en' }) {
  const say = SAY[lang] || SAY.en;
  const g = useMemo(() => skillsGrowth(events), [events]);
  const [sel, setSel] = useState(null);
  return (
    <section className="card-sec sk-card" lang={lang}>
      <h3>{say.title}</h3>
      {g.tagged ? <>
        <p className="fineprint">{say.lede(first, g.year.label)}</p>
        <SkillsChart g={g} sel={sel} onPick={setSel} say={say} idPrefix={`skc-${lang}`} />
        {sel && <Behind k={sel} g={g} events={events} say={say} onOpen={onOpen} />}
      </> : <p className="fineprint">{say.none(first)}</p>}
    </section>
  );
}

// The student's own "My skills" (#/<persona>/skills).
export default function MySkills({ studentId, version, go, persona, toast }) {
  const map = useMemo(() => getStudentMap(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = useMemo(() => skillsGrowth(map.events), [map]);
  const simple = getIntensity(studentId) === 'simple';
  const [sel, setSel] = useState(null);
  const [tagging, setTagging] = useState(null);
  const open = (id) => go(persona.id, 'map', id);
  const byId = (id) => map.events.find((e) => e.id === id);
  const used = g.rows.filter((r) => r.n), unused = g.rows.filter((r) => !r.n);
  const say = { ...EN, date: fmtDate, open: simple ? 'When I used it' : 'Moments behind it', ...(simple ? { name: (k) => SKILL_WORDS[k] } : {}) };
  const untagged = g.untagged.map(byId).filter(Boolean);
  const toTag = untagged.slice(0, simple ? 4 : 8);
  const tagBox = (
    <section className={simple ? 'sk-more sk-more-simple' : 'card-sec sk-more'}>
      <h2>{simple ? 'Add skills to a moment' : 'Moments with no skills yet'}</h2>
      {untagged.length ? <>
        {!simple && <p className="fineprint">{`${plural(untagged.length, 'moment')} this school year ${untagged.length === 1 ? 'has' : 'have'} no skills picked. Suggestions the app made are not counted until you pick them.`}</p>}
        <ul className="sk-totag">{toTag.map((e) => <li key={e.id}>{tagging === e.id
          ? <div><b lang="en">{e.title}</b><MomentSkills key={e.id} e={e} simple={simple} toast={toast} startOpen onDone={() => setTagging(null)} /></div>
          : <button type="button" className={simple ? 'sk-tag-btn' : 'ghost'} onClick={() => setTagging(e.id)}><b lang="en">{e.title}</b><small>{fmtDate(e.date)}</small></button>}</li>)}</ul>
      </> : <p className="fineprint">{g.moments ? 'Every moment this school year has skills. Well done.' : 'Add a moment and pick the skills you used.'}</p>}
    </section>
  );
  if (simple) return (
    <div className="page sk-page sk-simple">
      <header className="sk-head"><h1>Skills I’ve used</h1><p>When you add a moment, pick the skills you used. They collect here.</p></header>
      {used.length ? <ul className="sk-collect">{used.map((r) => (
        <li key={r.k}><button type="button" className={`sk-big${sel === r.k ? ' on' : ''}`} aria-pressed={sel === r.k} onClick={() => setSel(sel === r.k ? null : r.k)}>
          <span className="sk-ico" aria-hidden="true">{SKILL_ICON[r.k]}</span><b>{SKILL_WORDS[r.k]}</b></button></li>))}</ul>
        : <p className="sk-empty">No skills here yet. Pick some for a moment below.</p>}
      {sel && <Behind k={sel} g={g} events={map.events} say={say} onOpen={open} />}
      {tagBox}
      {unused.length > 0 && <section className="sk-later"><h2>Skills to look out for</h2>
        <ul>{unused.map((r) => <li key={r.k}><span className="sk-ico" aria-hidden="true">{SKILL_ICON[r.k]}</span>{SKILL_WORDS[r.k]}</li>)}</ul></section>}
    </div>
  );
  return (
    <div className="page sk-page">
      <header className="page-head"><div>
        <div className="kicker">My skills</div>
        <h1>How my skills are growing</h1>
        <p>{`This school year (${g.year.label}), from the skills you picked for your moments. It is your own picture: no scores, and nobody is compared.`}</p>
      </div></header>
      <div className="sk-grid">
        <section className="card-sec">
          <h2 className="sr-only">Skills by term</h2>
          {g.tagged ? <SkillsChart g={g} sel={sel} onPick={setSel} say={say} /> : <p className="sk-empty">No skills picked yet. Add skills to a moment and they show up here.</p>}
          {sel && <Behind k={sel} g={g} events={map.events} say={say} onOpen={open} />}
        </section>
        {tagBox}
      </div>
    </div>
  );
}
