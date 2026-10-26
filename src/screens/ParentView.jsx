import { useMemo, useState } from 'react';
import { applyLens, getStudent, getStudentMap, getTeacher, TERM_START, TODAY } from '../api.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import Logo from '../components/Logo.jsx';
import { dateIn, LangContext, tr } from '../i18n.js';

// Family-facing sentences that need the student's or advisor's name in them.
const SAY = {
  en: {
    family: (f) => `For ${f}’s family`,
    until: (d) => `Link works until ${d}`,
    only: (f) => `Shows only what ${f} chose to make public`,
    title: (n) => `${n}’s map`,
    intro: (f) => `Each coloured line is something ${f} has followed through school. Dots are things that happened; tap one to see it.`,
    words: (f) => `Titles and reflections are in ${f}’s own words, in English.`,
  },
  th: {
    family: (f) => `สำหรับครอบครัวของ ${f}`,
    until: (d) => `ลิงก์ใช้ได้ถึง ${d}`,
    only: (f) => `แสดงเฉพาะสิ่งที่ ${f} เลือกเปิดเผย`,
    title: (n) => `แผนที่ของ ${n}`,
    intro: (f) => `เส้นแต่ละสีคือสิ่งที่ ${f} ทำต่อเนื่องมาตลอดช่วงที่เรียน จุดแต่ละจุดคือสิ่งที่เกิดขึ้น แตะที่จุดเพื่อดูรายละเอียด`,
    words: (f) => `ชื่อรายการและบทสะท้อนคิดเป็นคำของ ${f} เอง จึงเป็นภาษาอังกฤษ`,
  },
};
const QUESTIONS = ['Which line are you most proud of?', 'Is there a line you want to start, or stop?', 'What would you like help with next term?'];

const startLang = (fromLink) => {
  if (fromLink === 'th' || fromLink === 'en') return fromLink;
  try { const saved = localStorage.getItem('tp-parent-lang'); if (saved) return saved; } catch { /* storage blocked */ }
  return navigator.language?.startsWith('th') ? 'th' : 'en';
};

// A5 + N1: a short-lived, advisor-made link for parents, in English or Thai. Publishable items only.
export default function ParentView({ studentId, lang: linkLang }) {
  const s = getStudent(studentId);
  const map = useMemo(() => s && getStudentMap(studentId, 'public'), [studentId, s]);
  const lens = useMemo(() => map && applyLens(map, null), [map]);
  const [sel, setSel] = useState(null);
  const [lang, setLangState] = useState(() => startLang(linkLang));
  const setLang = (l) => { setLangState(l); try { localStorage.setItem('tp-parent-lang', l); } catch { /* storage blocked */ } };
  if (!map) return <div className="link-dead"><h2>This link does not exist</h2></div>;
  const t = (x) => tr(lang, x);
  const say = SAY[lang];
  const adv = getTeacher(s.advisorId);
  const first = s.name.split(' ')[0];
  const term = map.events.filter((e) => e.date >= TERM_START && e.date <= TODAY && e.type !== 'reflection');
  return (
    <LangContext.Provider value={lang}>
      <div className="landing parent" lang={lang}>
        <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Transit Portfolio</span><span className="spacer" />
          <span className="lb-meta">{say.family(first)}</span>
          <div className="seg small lang-seg" role="group" aria-label="Language / ภาษา">
            <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">English</button>
            <button className={lang === 'th' ? 'on' : ''} aria-pressed={lang === 'th'} onClick={() => setLang('th')} lang="th">ไทย</button>
          </div>
        </header>
        <div className="landing-banner"><span><b>{t('Parent conference')}</b> {t('with')} {adv?.name}</span><span>{say.until(dateIn(lang, '2026-11-02'))}</span><span className="spacer" /><span>{say.only(first)}</span></div>
        <div className="pv-body">
          <section className="pv-intro">
            <h1>{say.title(s.name)}</h1>
            <p>{say.intro(first)}</p>
            <h3>{t('This term')}</h3>
            {term.length ? <ul>{term.map((e) => <li key={e.id}><button className="linkish" lang="en" onClick={() => setSel(e.id)}>{e.title}</button> <small>{dateIn(lang, e.date)}</small></li>)}</ul> : <p className="fineprint">{t('Nothing public this term yet.')}</p>}
            <h3>{t('Questions you might ask')}</h3>
            <ul>{QUESTIONS.map((q) => <li key={q}>{t(q)}</li>)}</ul>
            {lang === 'th' && <p className="fineprint">{say.words(first)}</p>}
          </section>
          <div className="pv-map">
            <MetroMap recent map={map} lens={lens} selectedId={sel} onSelect={setSel} fitKey={`pv-${studentId}`} />
            {!map.events.some((e) => e.type !== 'goal') && <p className="pv-empty">{t(`Nothing on ${first}’s map is public yet. When ${first} shares something with the family, it appears here.`)}</p>}
            <StationPanel event={map.events.find((e) => e.id === sel)} map={map} onClose={() => setSel(null)} readOnly />
          </div>
        </div>
      </div>
    </LangContext.Provider>
  );
}
