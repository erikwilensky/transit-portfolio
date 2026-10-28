import { inkOn } from '../format.js';
import { useMemo, useState } from 'react';
import { answerConsent, applyLens, consentOnFile, familyViewer, getConsentReqs, getDigest, getFamily, getLang, setLang, getStudent, getStudentMap, setFamily, TERM_START, TODAY, youngStudent } from '../api.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import { dateIn, LangContext, lineName, tr } from '../i18n.js';
import { exportUrl, isPilot } from '../auth.js';

// N1: a parent's own screens, in English or Thai. One parent, two children:
// Ploy (Year 11) decides what her family sees; Pim (Year 7) needs her parent's consent first.
const SAY = {
  en: {
    kicker: 'Family',
    homeT: (n) => `${n}’s map`,
    homeYoung: (f) => `${f} is in Years 7 to 9, so you see what ${f}’s advisor sees. Private reflections stay private.`,
    homeOld: (f) => `${f} decides what the family sees: everything ${f} shares with the school community.`,
    empty: (f) => `${f}’s map starts when ${f} picks a few interests in Transit Portfolio. The first stations then arrive from school systems.`,
    emptyConsent: (f) => `First, ${f} needs your consent to join.`,
    toConsent: 'Go to consent',
    thisTerm: 'This term', none: 'Nothing new this term yet.', ask: 'Questions you might ask',
    consentT: 'Consent', consentP: 'Under Thailand’s PDPA, students in Years 7 to 9 need a parent’s consent before their record is kept or shared. You can change any answer later.',
    asked: (d) => `Asked ${d}`, yes: 'Yes, I agree', no: 'Not now', change: 'Change my answer',
    st: { pending: 'Waiting for you', approved: 'You agreed', declined: 'You said not now' },
    olderT: (f) => `${f} manages sharing`,
    olderP: (f) => `Consent was recorded when ${f} joined in Year 7. From Year 10, ${f} decides what is shared and with whom; you can still ask the school for a copy of the record at any time.`,
    onFile: 'Consent on file', waiting: 'Waiting for consent',
    digestT: 'Weekly digest', digestP: 'A short summary each Friday of what changed in each child’s record, in the language you choose.',
    email: 'Email me this every Friday', lang: 'Language',
    week: (a, b) => `Your week · ${a} to ${b}`,
    newSt: 'New on the map', endorsed: (t, x) => `${t} endorsed “${x}”`, views: (n) => `${n} view${n === 1 ? '' : 's'} of a shared link`,
    refl: (n) => `${n} new reflection${n === 1 ? '' : 's'} (you see the shared ones only)`, coming: 'Coming up', nothing: (f) => `A quiet week for ${f}.`,
    starter: 'A question for the dinner table', open: 'Open the map',
    notJoined: (f) => `${f} has not joined yet. Answer the consent request to get started.`,
    copyT: (f) => `A copy of ${f}’s record`, copyP: 'Everything the school holds about your child in Transit Portfolio, as one ZIP file with a README. To have the record removed, ask the school’s pilot admin.', copyBtn: 'Download the copy (ZIP)',
  },
  th: {
    kicker: 'ครอบครัว',
    homeT: (n) => `แผนที่ของ ${n}`,
    homeYoung: (f) => `${f} อยู่ระดับ Year 7 ถึง 9 คุณจึงเห็นสิ่งเดียวกับที่ครูที่ปรึกษาของ ${f} เห็น บทสะท้อนคิดที่เป็นส่วนตัวจะไม่แสดง`,
    homeOld: (f) => `${f} เป็นผู้เลือกว่าครอบครัวจะเห็นอะไร คือทุกอย่างที่ ${f} เปิดให้ชุมชนโรงเรียนเห็น`,
    empty: (f) => `แผนที่ของ ${f} จะเริ่มเมื่อ ${f} เลือกความสนใจใน Transit Portfolio จากนั้นรายการแรกจะมาจากระบบของโรงเรียน`,
    emptyConsent: (f) => `ก่อนอื่น ${f} ต้องได้รับความยินยอมจากคุณ`,
    toConsent: 'ไปที่การให้ความยินยอม',
    thisTerm: 'ภาคเรียนนี้', none: 'ภาคเรียนนี้ยังไม่มีรายการใหม่', ask: 'คำถามที่อาจลองชวนคุย',
    consentT: 'การให้ความยินยอม', consentP: 'ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล นักเรียน Year 7 ถึง 9 ต้องได้รับความยินยอมจากผู้ปกครองก่อนจัดเก็บหรือแบ่งปันข้อมูล คุณเปลี่ยนคำตอบได้ทุกเมื่อ',
    asked: (d) => `ขอเมื่อ ${d}`, yes: 'ยินยอม', no: 'ยังไม่ยินยอม', change: 'เปลี่ยนคำตอบ',
    st: { pending: 'รอคำตอบจากคุณ', approved: 'คุณยินยอมแล้ว', declined: 'คุณยังไม่ยินยอม' },
    olderT: (f) => `${f} ดูแลการแบ่งปันเอง`,
    olderP: (f) => `บันทึกความยินยอมไว้แล้วตั้งแต่ ${f} เข้าเรียน Year 7 ตั้งแต่ Year 10 ${f} เป็นผู้ตัดสินใจว่าจะแบ่งปันอะไรกับใคร คุณยังขอสำเนาข้อมูลจากโรงเรียนได้ทุกเมื่อ`,
    onFile: 'มีความยินยอมแล้ว', waiting: 'รอความยินยอม',
    digestT: 'สรุปประจำสัปดาห์', digestP: 'สรุปสั้น ๆ ทุกวันศุกร์ว่ามีอะไรเปลี่ยนแปลงในบันทึกของลูกแต่ละคน ในภาษาที่คุณเลือก',
    email: 'ส่งอีเมลสรุปให้ฉันทุกวันศุกร์', lang: 'ภาษา',
    week: (a, b) => `สัปดาห์ของคุณ · ${a} ถึง ${b}`,
    newSt: 'รายการใหม่บนแผนที่', endorsed: (t, x) => `${t} รับรอง “${x}”`, views: (n) => `มีผู้เปิดดูลิงก์ที่แบ่งปัน ${n} ครั้ง`,
    refl: (n) => `บทสะท้อนคิดใหม่ ${n} รายการ (คุณเห็นเฉพาะที่แบ่งปัน)`, coming: 'สิ่งที่กำลังจะมาถึง', nothing: (f) => `สัปดาห์นี้ ${f} ยังไม่มีอะไรใหม่`,
    starter: 'คำถามชวนคุยบนโต๊ะอาหาร', open: 'เปิดแผนที่',
    notJoined: (f) => `${f} ยังไม่ได้เริ่มใช้ ตอบคำขอความยินยอมเพื่อเริ่มต้น`,
    copyT: (f) => `สำเนาบันทึกของ ${f}`, copyP: 'ข้อมูลทั้งหมดที่โรงเรียนเก็บเกี่ยวกับบุตรหลานของคุณใน Transit Portfolio เป็นไฟล์ ZIP ไฟล์เดียวพร้อมคำอธิบาย หากต้องการให้ลบบันทึก โปรดติดต่อผู้ดูแลโครงการนำร่องของโรงเรียน', copyBtn: 'ดาวน์โหลดสำเนา (ZIP)',
  },
};
const QUESTIONS = ['Which line are you most proud of?', 'Is there a line you want to start, or stop?', 'What would you like help with next term?'];
const first = (s) => s.name.split(' ')[0];

function Head({ persona, childId, screen, go, title, lede, lang }) {
  return (
    <header className="page-head fam-head">
      <div>
        <div className="kicker">{SAY[lang].kicker}</div>
        <h1>{title}</h1>
        {lede && <p>{lede}</p>}
      </div>
      <div className="fam-ctl">
        <div className="fam-kids" role="group" aria-label="Child">
          {persona.children.map((id) => { const s = getStudent(id); return (
            <button key={id} className={id === childId ? 'on' : ''} aria-pressed={id === childId} onClick={() => go(persona.id, screen, id)}>
              <span className="av" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span><span><b>{first(s)}</b><small>Year {s.grade + 1}</small></span>
              {youngStudent(s) && !consentOnFile(id) && <i className="fam-dot" aria-label={SAY[lang].waiting} />}
            </button>
          ); })}
        </div>
        <div className="seg small" role="group" aria-label="Language / ภาษา">
          <button className={getLang() === 'en' ? 'on' : ''} aria-pressed={getLang() === 'en'} onClick={() => setLang('en')} lang="en">English</button>
          <button className={getLang() === 'th' ? 'on' : ''} aria-pressed={getLang() === 'th'} onClick={() => setLang('th')} lang="th">ไทย</button>
        </div>
      </div>
    </header>
  );
}

export default function Family({ persona, screen, param, go, toast, version }) {
  const lang = getLang();
  const childId = persona.children.includes(param) ? param : persona.children[0];
  const props = { persona, childId, go, toast, lang, version };
  return (
    <LangContext.Provider value={lang}>
      <div className="page family" lang={lang}>
        {screen === 'family' && <FamilyMap {...props} />}
        {screen === 'consent' && <Consent {...props} />}
        {screen === 'digest' && <Digest {...props} />}
      </div>
    </LangContext.Provider>
  );
}

function FamilyMap({ persona, childId, go, lang, version }) {
  const s = getStudent(childId);
  const say = SAY[lang];
  const map = useMemo(() => getStudentMap(childId, familyViewer(childId)), [childId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lens = useMemo(() => applyLens(map, null), [map]);
  const [sel, setSel] = useState(null);
  const f = first(s);
  const term = map.events.filter((e) => e.date >= TERM_START && e.date <= TODAY && e.type !== 'reflection' && e.type !== 'goal');
  const empty = !map.events.length;
  return (
    <>
      <Head persona={persona} childId={childId} screen="family" go={go} lang={lang} title={say.homeT(s.name)} lede={youngStudent(s) ? say.homeYoung(f) : say.homeOld(f)} />
      {empty ? (
        <div className="card-sec fam-empty">
          <p>{say.empty(f)}</p>
          {!consentOnFile(childId) && <><p><b>{say.emptyConsent(f)}</b></p><button className="primary" onClick={() => go(persona.id, 'consent', childId)}>{say.toConsent}</button></>}
        </div>
      ) : (
        <div className="fam-body">
          <section className="pv-intro">
            <h3>{say.thisTerm}</h3>
            {term.length ? <ul>{term.map((e) => <li key={e.id}><button className="linkish" lang="en" onClick={() => setSel(e.id)}>{e.title}</button> <small>{dateIn(lang, e.date)} · {e.lineIds.map((id) => lineName(lang, map.lines.find((l) => l.id === id)?.name || id)).join(', ')}</small></li>)}</ul> : <p className="fineprint">{say.none}</p>}
            <h3>{say.ask}</h3>
            <ul>{QUESTIONS.map((q) => <li key={q}>{tr(lang, q)}</li>)}</ul>
          </section>
          <div className="pv-map fam-map">
            <MetroMap recent map={map} lens={lens} selectedId={sel} onSelect={setSel} fitKey={`fam-${childId}`} />
            <StationPanel event={map.events.find((e) => e.id === sel)} map={map} onClose={() => setSel(null)} readOnly />
          </div>
        </div>
      )}
    </>
  );
}

function Consent({ persona, childId, go, toast, lang }) {
  const s = getStudent(childId);
  const say = SAY[lang];
  const f = first(s);
  const reqs = getConsentReqs(childId);
  const [editing, setEditing] = useState(null);
  return (
    <>
      <Head persona={persona} childId={childId} screen="consent" go={go} lang={lang} title={say.consentT} lede={say.consentP} />
      {!youngStudent(s) ? (
        <div className="card-sec fam-older"><span className="status s-ok"><i>✓</i>{say.onFile}</span><h3>{say.olderT(f)}</h3><p>{say.olderP(f)}</p></div>
      ) : (
        <ul className="consent-list">
          {reqs.map((r) => {
            const open = r.status === 'pending' || editing === r.id;
            return (
              <li key={r.id} className={`consent-req st-${r.status}`}>
                <div className="cr-top"><span className={`status ${r.status === 'approved' ? 's-ok' : r.status === 'declined' ? 's-off' : 's-warn'}`}><i>{r.status === 'approved' ? '✓' : r.status === 'declined' ? '–' : '!'}</i>{say.st[r.status]}</span><small>{say.asked(dateIn(lang, r.asked))}</small></div>
                <h3 lang="en">{r.title}</h3>
                <p lang="en">{r.detail}</p>
                {open ? (
                  <div className="cr-btns">
                    <button className="primary" onClick={() => { answerConsent(r.id, 'approved', persona.name); setEditing(null); toast(lang === 'th' ? `บันทึกแล้ว ${f} จะได้รับแจ้ง` : `Saved. ${f} has been told.`); }}>{say.yes}</button>
                    <button className="ghost" onClick={() => { answerConsent(r.id, 'declined', persona.name); setEditing(null); toast(lang === 'th' ? 'บันทึกแล้ว' : 'Saved.'); }}>{say.no}</button>
                  </div>
                ) : <button className="linkish" onClick={() => setEditing(r.id)}>{say.change}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {isPilot() && <div className="card-sec fam-older"><h3>{say.copyT(f)}</h3><p>{say.copyP}</p><button className="ghost" onClick={() => { location.href = exportUrl(childId); }}>{say.copyBtn}</button></div>}
    </>
  );
}

function Digest({ persona, go, lang }) {
  const say = SAY[lang];
  const fam = getFamily();
  const kids = persona.children.map((id) => ({ s: getStudent(id), d: getDigest(id), joined: consentOnFile(id) }));
  const from = kids[0].d.from;
  return (
    <>
      <Head persona={persona} childId={null} screen="digest" go={go} lang={lang} title={say.digestT} lede={say.digestP} />
      <div className="digest-wrap">
        <article className="digest" aria-label={say.digestT}>
          <header><span className="dg-tri" aria-hidden="true" /><small>NIST Transit Portfolio</small><h2>{say.week(dateIn(lang, from), dateIn(lang, TODAY))}</h2></header>
          {kids.map(({ s, d, joined }) => {
            const f = first(s);
            const quiet = !d.stations.length && !d.endorsed.length && !d.views && !d.reflections && !d.coming.length;
            const nameOf = (id) => lineName(lang, d.map.lines.find((l) => l.id === id)?.name || id);
            return (
              <section key={s.id} className="dg-kid">
                <h3><span className="av" style={{ background: s.avatar.colour, color: inkOn(s.avatar.colour) }}>{s.avatar.initials}</span>{s.name} <small>Year {s.grade + 1}</small></h3>
                {!joined ? <p>{say.notJoined(f)} <button className="linkish" onClick={() => go(persona.id, 'consent', s.id)}>{say.toConsent}</button></p> : quiet ? <p className="fineprint">{say.nothing(f)}</p> : (
                  <>
                    {d.stations.length > 0 && <><h4>{say.newSt}</h4><ul>{d.stations.map((e) => <li key={e.id}><b lang="en">{e.title}</b> <small>{dateIn(lang, e.date)} · {e.lineIds.map(nameOf).join(', ')}</small></li>)}</ul></>}
                    <ul className="dg-facts">
                      {d.endorsed.map((n, i) => <li key={i}>{say.endorsed(n.teacher, n.title)}</li>)}
                      {d.reflections > 0 && <li>{say.refl(d.reflections)}</li>}
                      {d.views > 0 && <li>{say.views(d.views)}</li>}
                    </ul>
                    {d.coming.length > 0 && <><h4>{say.coming}</h4><ul>{d.coming.map((e) => <li key={e.id}><b lang="en">{e.title}</b> <small>{dateIn(lang, e.date)}</small></li>)}</ul></>}
                  </>
                )}
                {joined && <p className="dg-starter"><small>{say.starter}</small>{tr(lang, QUESTIONS[s.id.charCodeAt(s.id.length - 1) % QUESTIONS.length])}</p>}
                {joined && <button className="ghost small-btn" onClick={() => go(persona.id, 'family', s.id)}>{say.open}</button>}
              </section>
            );
          })}
        </article>
        <aside className="card-sec dg-set">
          <label className="cb-check"><input type="checkbox" checked={fam.email} onChange={() => setFamily({ email: !fam.email })} /> {say.email}</label>
        </aside>
      </div>
    </>
  );
}
