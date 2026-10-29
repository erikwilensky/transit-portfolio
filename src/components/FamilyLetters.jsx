import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Qr from './Qr.jsx';
import { admin, family } from '../auth.js';
import { usePrintTitle } from '../print.js';
import '../auth.css';
import './signin-cards.css';
import './family-letters.css';

// Family sign-in letters (server/routes/17-family.mjs): printed invitations, two to an A4 page.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const shortLink = (u) => u.replace(/^https?:\/\//, '');
const own = (n) => (/s$/i.test(n) ? `${n}’` : `${n}’s`);
const dayTh = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

// Each letter in Thai and English (the default), English only or Thai only. Many NIST families read Thai.
export const LETTER_LANGS = [['both', 'Thai and English'], ['en', 'English only'], ['th', 'Thai only']];
const TEXT = {
  en: (f, room) => ({
    dear: `Dear family of ${f}${room ? ` (${room})` : ''},`,
    body: [
      `${f} keeps a Transit Portfolio at school: an online record of what ${f} does and learns, drawn as a metro map. Each coloured line is something ${f} follows through school, such as a subject, a sport or a club, and each stop is something that happened along it.`,
      `With a family account you see only what ${f} chooses to share with family. Anything ${f} keeps private stays private.`,
      `To join, scan the code or type the link, then choose your own email and password. Two family members can each use this letter. Already have a family account for a brother or sister? Sign in with it and ${f} is added to it.`,
    ],
    exp: (iso) => `This letter works until ${day(iso)}. Lost it? Ask ${own(f)} advisor for a new one.`,
  }),
  th: (f, room) => ({
    dear: `ถึงครอบครัวของ ${f}${room ? ` (${room})` : ''}`,
    body: [
      `${f} มี Transit Portfolio ที่โรงเรียน เป็นบันทึกออนไลน์ของสิ่งที่ ${f} ทำและเรียนรู้ ในรูปแบบแผนที่รถไฟฟ้า เส้นแต่ละสีคือสิ่งที่ ${f} ทำต่อเนื่องตลอดช่วงที่เรียน เช่น รายวิชา กีฬา หรือชมรม และแต่ละสถานีคือสิ่งที่เกิดขึ้นบนเส้นนั้น`,
      `บัญชีครอบครัวจะเห็นเฉพาะสิ่งที่ ${f} เลือกแบ่งปันกับครอบครัว สิ่งที่ ${f} เก็บไว้เป็นส่วนตัวจะยังคงเป็นส่วนตัว`,
      `วิธีเข้าร่วม: สแกนคิวอาร์โค้ดหรือพิมพ์ลิงก์ แล้วตั้งอีเมลและรหัสผ่านของคุณเอง (เลือกภาษาไทยได้ที่มุมขวาบนของหน้า) สมาชิกครอบครัวใช้จดหมายฉบับนี้ได้สองคน หากมีบัญชีครอบครัวสำหรับพี่หรือน้องอยู่แล้ว ให้เข้าสู่ระบบด้วยบัญชีนั้น แล้ว ${f} จะถูกเพิ่มเข้าไป`,
    ],
    exp: (iso) => `จดหมายฉบับนี้ใช้ได้ถึงวันที่ ${dayTh(iso)} หากทำหาย โปรดขอฉบับใหม่จากครูที่ปรึกษาของ ${f}`,
  }),
};

export function LetterSheet({ school, letters, onClose }) {
  usePrintTitle('Family letters');
  const [lang, setLang] = useState('both');
  const langs = lang === 'both' ? ['th', 'en'] : [lang];
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const pages = [];
  for (let i = 0; i < letters.length; i += 2) pages.push(letters.slice(i, i + 2));
  return createPortal(
    <div className="sc-overlay fl-overlay" role="dialog" aria-modal="true" aria-label="Family letters">
      <div className="sc-bar">
        <div><b>{plural(letters.length, 'family letter')}</b><small>{plural(pages.length, 'A4 page')}, two letters a page: cut along the dashed line. Each letter belongs to one student. The links are shown only now.</small></div>
        <div className="auth-row">
          <label className="fl-lang">Language <select value={lang} onChange={(e) => setLang(e.target.value)}>{LETTER_LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <button className="auth-btn" onClick={() => print()}>Print</button><button className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      {pages.map((page, p) => (
        <section className="fl-page" key={p}>
          {page.map((l) => {
            const t = langs.map((k) => [k, TEXT[k](l.firstName, l.homeroom)]);
            return (
              <article className={`fl-letter fl-${lang}`} key={l.url} lang={langs[0]}>
                <header className="fl-school" lang="en">{school} · Transit Portfolio</header>
                <h2 className="fl-dear">{t.map(([k, x]) => <span key={k} lang={k}>{x.dear}</span>)}</h2>
                <div className="fl-body">
                  <div className="fl-text">
                    {t.map(([k, x]) => <div key={k} className="fl-part" lang={k}>{x.body.map((p, i) => <p key={i}>{p}</p>)}</div>)}
                  </div>
                  <div className="fl-code">
                    <Qr text={l.url} size={150} className="fl-qr" />
                    <span className="fl-link">{shortLink(l.url)}</span>
                  </div>
                </div>
                <footer className="fl-exp">{t.map(([k, x]) => <span key={k} lang={k}>{x.exp(l.expiresAt)}</span>)}</footer>
              </article>
            );
          })}
        </section>
      ))}
    </div>,
    document.body,
  );
}

// One student's family: who joined, and "Remove a family member" (the admin can also delete the account).
function FamilyRow({ s, isAdmin, onChange, toast }) {
  const [ask, setAsk] = useState(null); // { id, del }
  const [err, setErr] = useState(null);
  const first = s.name.split(' ')[0];
  const remove = async (m, del) => {
    setErr(null);
    try {
      if (del) { await admin.remove(m.id); toast?.(`Deleted ${m.name}’s family account`); }
      else { const r = await family.unlink(s.id, m.id); toast?.(r.removed ? `Removed ${m.name}. Their account had no other child, so it is gone too.` : `${m.name} can no longer see ${first}`); }
      setAsk(null); onChange();
    } catch (x) { setErr(x.message); }
  };
  return (
    <li className="fl-row">
      <div><b>{s.name}</b><small>{s.homeroom ? `${s.homeroom} · ` : ''}Year {s.year}{s.paused ? ' · Paused' : ''}{s.invite ? ` · Letter out until ${day(s.invite.expiresAt)}${s.invite.uses ? `, used ${s.invite.uses} of 2` : ''}` : ''}</small></div>
      <div className="fl-fam">
        <span className={`acc-tag ${s.family.length ? 'ok' : 'wait'}`}>{s.family.length ? `${plural(s.family.length, 'family member')} joined` : 'No family account yet'}</span>
        {s.family.map((m) => (
          <span key={m.id} className="fl-member">{m.name} <small>{m.email}</small>
            {ask?.id === m.id
              ? <><button className="ghost danger" onClick={() => remove(m, ask.del)}>{ask.del ? 'Yes, delete their account' : `Yes, remove from ${first}`}</button><button className="linkish" onClick={() => setAsk(null)}>Cancel</button></>
              : <><button className="linkish" onClick={() => setAsk({ id: m.id })}>Remove a family member</button>{isAdmin && <button className="linkish danger" onClick={() => setAsk({ id: m.id, del: true })}>Delete account</button>}</>}
          </span>
        ))}
        {err && <span className="auth-err" role="alert">{err}</span>}
      </div>
    </li>
  );
}

// "Print family letters" on the advisor's advisory page (pilot only).
export function AdvisorFamily({ toast }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [onlyNew, setOnlyNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null);
  const load = () => family.advisees().then(setList, (x) => setErr(x.message));
  useEffect(() => { if (open && !list) load(); }, [open, list]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = list?.filter((s) => !s.paused) || [];
  const n = onlyNew ? active.filter((s) => !s.family.length).length : active.length;
  const joined = list?.filter((s) => s.family.length).length || 0;
  const go = async () => {
    setBusy(true); setErr(null);
    try { const j = await family.forAdvisees({ onlyNew }); if (!j.letters.length) setErr('Nobody needs a letter.'); else setSheet(j); load(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  if (!open) return <button className="ghost sc-open" onClick={() => setOpen(true)}>Print family letters</button>;
  return (
    <section className="acc-form sc-panel fl-panel" aria-labelledby="fl-h">
      <h2 id="fl-h">Family letters</h2>
      <p className="auth-lede">The class lists hold no parents, so families join with a printed letter. Each letter has a QR code that two family members can use to make their own account, for 30 days. They see only what the student chooses to share with family. A new letter replaces any earlier one for that student.</p>
      {!list && !err && <p className="auth-lede">Loading your advisees…</p>}
      {list && <>
        <p className="fineprint">{joined} of {plural(list.length, 'advisee')} {joined === 1 ? 'has' : 'have'} a family account.</p>
        <ul className="fl-list">{list.map((s) => <FamilyRow key={s.id} s={s} onChange={load} toast={toast} />)}</ul>
        <label className="acc-check"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only students with no family account yet</label>
      </>}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row">
        {list && <button className="auth-btn" onClick={go} disabled={busy || !n}>{busy ? 'Making letters…' : `Make ${plural(n, 'letter')}`}</button>}
        <button className="ghost" onClick={() => { setOpen(false); setErr(null); }} disabled={busy}>Close</button>
      </div>
      {sheet && <LetterSheet {...sheet} onClose={() => { setSheet(null); toast?.('Letters work for 30 days'); }} />}
    </section>
  );
}

// Accounts (admin): letters per homeroom, and each homeroom's families.
export function AdminFamily({ toast, onClose, onChange }) {
  const [g, setG] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [onlyNew, setOnlyNew] = useState(true);
  const [look, setLook] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null);
  const load = (h = look) => family.groups(h).then(setG, (x) => setErr(x.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = g ? g.homerooms.filter((r) => rooms.includes(r.name)) : [];
  const n = chosen.reduce((s, r) => s + (onlyNew ? r.waiting : r.students - r.paused), 0);
  const toggle = (name) => setRooms(rooms.includes(name) ? rooms.filter((r) => r !== name) : [...rooms, name]);
  const go = async () => {
    setBusy(true); setErr(null);
    try { const j = await family.forAdmin({ homerooms: rooms, onlyNew }); if (!j.letters.length) setErr('Nobody needs a letter.'); else setSheet(j); load(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <section className="acc-form sc-panel fl-panel" aria-labelledby="fla-h">
      <h2 id="fla-h">Family letters</h2>
      <p className="auth-lede">One letter per student, two to an A4 page, with a QR code that two family members can use to make their own account, for 30 days. A new letter replaces any earlier one for that student. Paused students get none.</p>
      {g && <>
        <fieldset className="sc-rooms"><legend>Homerooms <button type="button" className="linkish" onClick={() => setRooms(rooms.length === g.homerooms.length ? [] : g.homerooms.map((r) => r.name))}>{rooms.length === g.homerooms.length ? 'None' : 'All'}</button></legend>
          {g.homerooms.map((r) => <label key={r.name}><input type="checkbox" checked={rooms.includes(r.name)} onChange={() => toggle(r.name)} /> {r.name} <small>{r.withFamily} of {r.students} with family</small></label>)}
          {!g.homerooms.length && <p className="fineprint">No students yet. Import the class lists first.</p>}
        </fieldset>
        <label className="acc-check"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Only students with no family account yet</label>
      </>}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row">
        {g && <button className="auth-btn" onClick={go} disabled={busy || !n}>{busy ? 'Making letters…' : `Make ${plural(n, 'letter')}`}</button>}
        <button className="ghost" onClick={onClose} disabled={busy}>Close</button>
      </div>
      {g && g.homerooms.length > 0 && <>
        <label className="auth-field fl-look"><span>See the families in a homeroom</span>
          <select value={look} onChange={(e) => { setLook(e.target.value); load(e.target.value); }}><option value="">Choose a homeroom</option>{g.homerooms.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}</select></label>
        {look && g.students && <ul className="fl-list">{g.students.map((s) => <FamilyRow key={s.id} s={s} isAdmin onChange={() => { load(); onChange?.(); }} toast={toast} />)}</ul>}
      </>}
      {sheet && <LetterSheet {...sheet} onClose={() => { setSheet(null); toast?.('Letters work for 30 days'); }} />}
    </section>
  );
}
