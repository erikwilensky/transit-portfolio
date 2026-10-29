import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { family, signOut } from '../auth.js';
import { errText } from '../i18n.js';
import { LangSwitch, useAuthLang } from './SignIn.jsx';
import '../auth.css';

// The page in English or Thai (the switch at the top, remembered on this device; the new account keeps it).
const SAY = {
  en: {
    band: 'Every student’s years at NIST, drawn as a metro map. For families.',
    checking: 'Checking your letter…', broken: 'This link does not work', toSignIn: 'Go to sign in',
    outT: 'Sign out first', out: (me) => `You are signed in as ${me} with a school account. A family account is separate: sign out, then open the link on the letter again.`, signOut: 'Sign out',
    hasT: (n) => `${n} is on your account`, addT: (n) => `Add ${n} to your account`,
    has: (n) => `You already see ${n}’s map with your family account.`, add: (n, me, room) => `You are signed in as ${me}. ${n}${room ? ` (${room})` : ''} joins the children on your family account.`,
    toFamily: 'Go to the family view', adding: 'Adding…', addBtn: (n) => `Add ${n}`,
    title: (n, room) => `Family of ${n}${room ? ` (${room})` : ''}`,
    ledeHave: (n) => `Sign in with your family account and ${n} is added to it.`, ledeNew: (n) => `Make your own family account. You will see only what ${n} chooses to share with family.`,
    name: 'Your name', email: 'Your email', password: 'Password', choose: 'Choose a password', hint: 'At least 8 characters. A short sentence is easy to remember.', again: 'Type it again',
    saving: 'Saving…', signInAdd: (n) => `Sign in and add ${n}`, make: 'Make my account',
    toNew: 'I need a new family account', toHave: 'I already have a family account (for a brother or sister)',
    until: (d) => `This letter works until ${d}. Two family members can each use it.`, locale: 'en-GB',
    short: 'Use at least 8 characters.', differ: 'The two passwords are not the same.',
  },
  th: {
    band: 'เส้นทางการเรียนรู้ของนักเรียนแต่ละคนที่ NIST ในรูปแบบแผนที่รถไฟฟ้า สำหรับครอบครัว',
    checking: 'กำลังตรวจสอบจดหมาย…', broken: 'ลิงก์นี้ใช้ไม่ได้', toSignIn: 'ไปหน้าเข้าสู่ระบบ',
    outT: 'โปรดออกจากระบบก่อน', out: (me) => `ขณะนี้คุณเข้าสู่ระบบในชื่อ ${me} ด้วยบัญชีของโรงเรียน บัญชีครอบครัวเป็นบัญชีแยกต่างหาก โปรดออกจากระบบ แล้วเปิดลิงก์ในจดหมายอีกครั้ง`, signOut: 'ออกจากระบบ',
    hasT: (n) => `${n} อยู่ในบัญชีของคุณแล้ว`, addT: (n) => `เพิ่ม ${n} ในบัญชีของคุณ`,
    has: (n) => `คุณเห็นแผนที่ของ ${n} ด้วยบัญชีครอบครัวของคุณอยู่แล้ว`, add: (n, me, room) => `คุณเข้าสู่ระบบในชื่อ ${me} ${n}${room ? ` (${room})` : ''} จะถูกเพิ่มในบัญชีครอบครัวของคุณ`,
    toFamily: 'ไปที่มุมมองครอบครัว', adding: 'กำลังเพิ่ม…', addBtn: (n) => `เพิ่ม ${n}`,
    title: (n, room) => `ครอบครัวของ ${n}${room ? ` (${room})` : ''}`,
    ledeHave: (n) => `เข้าสู่ระบบด้วยบัญชีครอบครัวของคุณ แล้ว ${n} จะถูกเพิ่มในบัญชีนั้น`, ledeNew: (n) => `สร้างบัญชีครอบครัวของคุณเอง คุณจะเห็นเฉพาะสิ่งที่ ${n} เลือกแบ่งปันกับครอบครัว`,
    name: 'ชื่อของคุณ', email: 'อีเมลของคุณ', password: 'รหัสผ่าน', choose: 'ตั้งรหัสผ่าน', hint: 'อย่างน้อย 8 ตัวอักษร ใช้ประโยคสั้น ๆ จะช่วยให้จำง่าย', again: 'พิมพ์อีกครั้ง',
    saving: 'กำลังบันทึก…', signInAdd: (n) => `เข้าสู่ระบบและเพิ่ม ${n}`, make: 'สร้างบัญชีของฉัน',
    toNew: 'ฉันต้องการสร้างบัญชีครอบครัวใหม่', toHave: 'ฉันมีบัญชีครอบครัวอยู่แล้ว (สำหรับพี่หรือน้อง)',
    until: (d) => `จดหมายฉบับนี้ใช้ได้ถึงวันที่ ${d} สมาชิกครอบครัวใช้ได้สองคน`, locale: 'th-TH',
    short: 'ใช้อย่างน้อย 8 ตัวอักษร', differ: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
  },
};

// Pilot: a family letter's link (#/family/<token>). Shows the child's first name only, then a parent makes
// their own account (or adds the child to the family account they are signed in with) and lands on the family view.
export default function FamilyJoin({ token, onDone }) {
  const [lang, setLang] = useAuthLang();
  const say = SAY[lang];
  const [info, setInfo] = useState(null);
  const [have, setHave] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', again: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { family.invite(token).then(setInfo, (x) => setInfo({ broken: x.message })); }, [token]);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const join = async (body) => {
    setErr(null); setBusy(true);
    try { await family.join({ token, ...body }); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (have) return join({ email: f.email, password: f.password });
    if (f.password.length < 8) return setErr(SAY.en.short);
    if (f.password !== f.again) return setErr(SAY.en.differ);
    join({ name: f.name, email: f.email, password: f.password });
  };
  const n = info?.firstName;
  const error = err && <p className="auth-err" role="alert">{errText(lang, err)}</p>;
  let body;
  if (!info) body = <div className="auth-card"><p className="auth-lede">{say.checking}</p></div>;
  else if (info.broken) body = <div className="auth-card"><h1>{say.broken}</h1><p className="auth-lede">{errText(lang, info.broken)}</p><a className="auth-btn as-link" href="#/">{say.toSignIn}</a></div>;
  else if (info.me && info.me.kind !== 'parent') body = (
    <div className="auth-card"><h1>{say.outT}</h1><p className="auth-lede">{say.out(info.me.name)}</p>
      <button className="auth-btn" onClick={() => signOut()}>{say.signOut}</button></div>
  );
  else if (info.me) body = (
    <div className="auth-card"><h1 id="fj-h">{info.me.has ? say.hasT(n) : say.addT(n)}</h1>
      <p className="auth-lede">{info.me.has ? say.has(n) : say.add(n, info.me.name, info.homeroom)}</p>
      {error}
      {info.me.has ? <button className="auth-btn" onClick={onDone}>{say.toFamily}</button>
        : <button className="auth-btn" onClick={() => join({})} disabled={busy}>{busy ? say.adding : say.addBtn(n)}</button>}
    </div>
  );
  else body = (
    <form className="auth-card" onSubmit={submit} aria-labelledby="fj-h">
      <h1 id="fj-h">{say.title(n, info.homeroom)}</h1>
      <p className="auth-lede">{have ? say.ledeHave(n) : say.ledeNew(n)}</p>
      {!have && <label className="auth-field"><span>{say.name}</span><input required autoComplete="name" value={f.name} onChange={up('name')} autoFocus /></label>}
      <label className="auth-field"><span>{say.email}</span><input type="email" required autoComplete="username" inputMode="email" value={f.email} onChange={up('email')} autoFocus={have} /></label>
      <label className="auth-field"><span>{have ? say.password : say.choose}</span><input type="password" required minLength={8} autoComplete={have ? 'current-password' : 'new-password'} value={f.password} onChange={up('password')} />{!have && <small>{say.hint}</small>}</label>
      {!have && <label className="auth-field"><span>{say.again}</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>}
      {error}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? say.saving : have ? say.signInAdd(n) : say.make}</button>
      <button type="button" className="linkish" onClick={() => { setHave(!have); setErr(null); }}>{have ? say.toNew : say.toHave}</button>
      <p className="fineprint">{say.until(new Date(info.expiresAt).toLocaleDateString(say.locale, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    </form>
  );
  return (
    <div className="auth-page" lang={lang}>
      <div className="auth-band">
        <Logo className="auth-logo" />
        <div className="auth-title"><b>Transit</b> Portfolio</div>
        <p>{say.band}</p>
        <LangSwitch lang={lang} onChange={setLang} />
      </div>
      <main className="auth-main">{body}</main>
    </div>
  );
}
