import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { advisee, changePassword, finishSetup, forgotPassword, getAuth, getSetup, sessionCount, signIn, signOut } from '../auth.js';
import { getLang } from '../api.js';
import { errText, savedLang, saveLang } from '../i18n.js';
import '../auth.css';

// Thai for families: the sign-in pages before anyone is signed in (the choice is remembered on this device, and a
// family account takes it on at sign-in), and the account menu after (the account's own language).
const AUTH_TH = {
  'Every student’s years at NIST, drawn as a metro map. Pilot.': 'เส้นทางการเรียนรู้ของนักเรียนแต่ละคนที่ NIST ในรูปแบบแผนที่รถไฟฟ้า (โครงการนำร่อง)',
  'Every student’s years at NIST, drawn as a metro map. For families.': 'เส้นทางการเรียนรู้ของนักเรียนแต่ละคนที่ NIST ในรูปแบบแผนที่รถไฟฟ้า สำหรับครอบครัว',
  'Sign in': 'เข้าสู่ระบบ', 'Signing in…': 'กำลังเข้าสู่ระบบ…', Email: 'อีเมล', Password: 'รหัสผ่าน',
  'Use your school email and the password you set from your setup link.': 'ใช้อีเมลและรหัสผ่านที่คุณตั้งไว้ ครอบครัวใช้อีเมลที่สมัครไว้จากจดหมายของโรงเรียน',
  'Forgot your password?': 'ลืมรหัสผ่าน?', 'Check your email': 'โปรดตรวจสอบอีเมล', 'Request sent': 'ส่งคำขอแล้ว',
  'Back to sign in': 'กลับไปหน้าเข้าสู่ระบบ', Back: 'ย้อนกลับ', 'Sending…': 'กำลังส่ง…', 'Ask for a new link': 'ขอลิงก์ใหม่',
  'Type your school email. You will get a new sign-in link to choose a new password.': 'กรอกอีเมลของคุณ แล้วคุณจะได้รับลิงก์ใหม่สำหรับตั้งรหัสผ่านใหม่',
  'Checking your link…': 'กำลังตรวจสอบลิงก์…', 'Link not valid': 'ลิงก์นี้ใช้ไม่ได้', 'Go to sign in': 'ไปหน้าเข้าสู่ระบบ',
  'Choose a password for your account. This link works once.': 'ตั้งรหัสผ่านสำหรับบัญชีของคุณ ลิงก์นี้ใช้ได้ครั้งเดียว',
  'New password': 'รหัสผ่านใหม่', 'Type it again': 'พิมพ์อีกครั้ง', 'Current password': 'รหัสผ่านปัจจุบัน',
  'At least 8 characters. A short sentence is easy to remember.': 'อย่างน้อย 8 ตัวอักษร ใช้ประโยคสั้น ๆ จะช่วยให้จำง่าย',
  'Saving…': 'กำลังบันทึก…', 'Save and sign in': 'บันทึกและเข้าสู่ระบบ', 'Change password': 'เปลี่ยนรหัสผ่าน', Cancel: 'ยกเลิก', Close: 'ปิด',
  Feedback: 'ความคิดเห็น', 'Something broken, confusing, or an idea': 'มีสิ่งที่ใช้ไม่ได้ ไม่ชัดเจน หรือมีข้อเสนอแนะ',
  'Sign out': 'ออกจากระบบ', 'Sign out everywhere': 'ออกจากระบบทุกอุปกรณ์',
};
export const authT = (lang) => (s) => (lang === 'th' && AUTH_TH[s]) || s;
const SAY_TH = {
  emailed: (e) => `หากมีบัญชีที่ใช้ ${e} ลิงก์เข้าสู่ระบบใหม่กำลังส่งไปทางอีเมล ใช้ได้ครั้งเดียวภายใน 7 วัน รหัสผ่านเดิมยังใช้ได้จนกว่าคุณจะใช้ลิงก์ หากไม่ได้รับภายใน 10 นาที โปรดขอลิงก์ใหม่จากครูหรือผู้ดูแลโครงการนำร่อง`,
  asked: (e) => `หากมีบัญชีที่ใช้ ${e} ผู้ดูแลโครงการนำร่องจะเห็นคำขอของคุณแล้ว โปรดติดต่อครูที่ปรึกษาของบุตรหลานหรือผู้ดูแลโครงการนำร่องเพื่อขอลิงก์เข้าสู่ระบบใหม่`,
  welcome: (f) => `ยินดีต้อนรับ ${f}`,
  devices: (n) => (n === 1 ? 'เข้าสู่ระบบบนอุปกรณ์นี้เท่านั้น' : `เข้าสู่ระบบอยู่บน ${n} อุปกรณ์`),
  all: (n) => `ทั้ง ${n} อุปกรณ์ รวมเครื่องนี้ด้วย`,
};
// English / ไทย, for the pages before signing in.
export function LangSwitch({ lang, onChange }) {
  return (
    <div className="seg small auth-lang" role="group" aria-label="Language / ภาษา">
      <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => onChange('en')} lang="en">English</button>
      <button type="button" className={lang === 'th' ? 'on' : ''} aria-pressed={lang === 'th'} onClick={() => onChange('th')} lang="th">ไทย</button>
    </div>
  );
}
export function useAuthLang() {
  const [lang, setLang] = useState(() => getAuth().user?.lang || savedLang() || 'en');
  return [lang, (l) => { saveLang(l); setLang(l); }];
}

// Pilot mode: the sign-in page, and the one-time setup page (#/setup/<token>) for new and reset accounts.
export default function SignIn({ setupToken, onDone }) {
  const [lang, setLang] = useAuthLang();
  const t = authT(lang);
  return (
    <div className="auth-page" lang={lang}>
      <div className="auth-band">
        <Logo className="auth-logo" />
        <div className="auth-title"><b>Transit</b> Portfolio</div>
        <p>{t('Every student’s years at NIST, drawn as a metro map. Pilot.')}</p>
        <LangSwitch lang={lang} onChange={setLang} />
      </div>
      <main className="auth-main">
        {setupToken ? <Setup token={setupToken} onDone={onDone} lang={lang} /> : <Login onDone={onDone} lang={lang} />}
      </main>
    </div>
  );
}

function Login({ onDone, lang }) {
  const t = authT(lang);
  const [email, setEmail] = useState('');
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await signIn(email, password); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (forgot) return <Forgot email={email} back={() => setForgot(false)} lang={lang} />;
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="signin-h">
      <h1 id="signin-h">{t('Sign in')}</h1>
      <p className="auth-lede">{t('Use your school email and the password you set from your setup link.')}</p>
      <label className="auth-field"><span>{t('Email')}</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
      <label className="auth-field"><span>{t('Password')}</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <p className="auth-err" role="alert">{errText(lang, err)}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</button>
      <button type="button" className="linkish auth-forgot" onClick={() => setForgot(true)}>{t('Forgot your password?')}</button>
    </form>
  );
}

// Asks for a new sign-in link. The answer is the same whether or not the email has an account.
function Forgot({ email: start, back, lang }) {
  const t = authT(lang);
  const [email, setEmail] = useState(start);
  const [done, setDone] = useState(null); // { emailed }
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { setDone(await forgotPassword(email)); } catch (x) { setErr(x.message); } setBusy(false);
  };
  if (done) return (
    <div className="auth-card" aria-labelledby="forgot-h">
      <h1 id="forgot-h">{t(done.emailed ? 'Check your email' : 'Request sent')}</h1>
      {lang === 'th' ? <p className="auth-lede" role="status">{SAY_TH[done.emailed ? 'emailed' : 'asked'](email)}</p> : done.emailed
        ? <p className="auth-lede" role="status">If an account uses {email}, a new sign-in link is on its way. It works once, for 7 days. Your old password works until you use it. Nothing after 10 minutes? Ask your teacher or the pilot admin for a new link.</p>
        : <p className="auth-lede" role="status">If an account uses {email}, the pilot admin can now see your request. Ask your teacher or the pilot admin for a new sign-in link. Students can also ask their advisor.</p>}
      <button type="button" className="auth-btn" onClick={back}>{t('Back to sign in')}</button>
    </div>
  );
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="forgot-h">
      <h1 id="forgot-h">{t('Forgot your password?')}</h1>
      <p className="auth-lede">{t('Type your school email. You will get a new sign-in link to choose a new password.')}</p>
      <label className="auth-field"><span>{t('Email')}</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
      {err && <p className="auth-err" role="alert">{errText(lang, err)}</p>}
      <div className="auth-row"><button className="auth-btn" type="submit" disabled={busy}>{busy ? t('Sending…') : t('Ask for a new link')}</button><button type="button" className="ghost" onClick={back}>{t('Back')}</button></div>
    </form>
  );
}

function Setup({ token, onDone, lang }) {
  const t = authT(lang);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  const [f, setF] = useState({ name: '', email: '', password: '', again: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSetup(token).then(setInfo, (x) => setInfo({ broken: x.message })); }, [token]);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (f.password.length < 8) return setErr('Use at least 8 characters.');
    if (f.password !== f.again) return setErr('The two passwords are not the same.');
    setBusy(true);
    try { await finishSetup({ token, password: f.password, name: f.name, email: f.email }); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (!info) return <div className="auth-card"><p className="auth-lede">{t('Checking your link…')}</p></div>;
  if (info.broken) return <div className="auth-card"><h1>{t('Link not valid')}</h1><p className="auth-lede">{errText(lang, info.broken)}</p><a className="auth-btn as-link" href="#/">{t('Go to sign in')}</a></div>;
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="setup-h">
      <h1 id="setup-h">{info.firstRun ? 'Set up the pilot' : lang === 'th' ? SAY_TH.welcome(info.name.split(' ')[0]) : `Welcome, ${info.name.split(' ')[0]}`}</h1>
      <p className="auth-lede">{info.firstRun ? 'Create the first admin account. You can then add everyone else from Accounts.' : t('Choose a password for your account. This link works once.')}</p>
      {info.firstRun ? <>
        <label className="auth-field"><span>Your name</span><input required autoComplete="name" value={f.name} onChange={up('name')} autoFocus /></label>
        <label className="auth-field"><span>Email</span><input type="email" required autoComplete="username" value={f.email} onChange={up('email')} /></label>
      </> : <div className="auth-field"><span>{t('Email')}</span><output className="auth-out">{info.email}</output><input type="hidden" autoComplete="username" value={info.email} readOnly /></div>}
      <label className="auth-field"><span>{t('New password')}</span><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={up('password')} autoFocus={!info.firstRun} /><small>{t('At least 8 characters. A short sentence is easy to remember.')}</small></label>
      <label className="auth-field"><span>{t('Type it again')}</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>
      {err && <p className="auth-err" role="alert">{errText(lang, err)}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? t('Saving…') : info.firstRun ? 'Create admin account' : t('Save and sign in')}</button>
    </form>
  );
}

// Change your own password, from the account menu.
export function PasswordDialog({ onClose, toast }) {
  const lang = getLang();
  const t = authT(lang);
  const [f, setF] = useState({ current: '', password: '', again: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (f.password.length < 8) return setErr('Use at least 8 characters.');
    if (f.password !== f.again) return setErr('The two new passwords are not the same.');
    setBusy(true);
    try { await changePassword(f.current, f.password); toast(errText(lang, 'Password changed. Other devices are signed out.')); onClose(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal auth-modal" lang={lang} onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pw-h">
        <button type="button" className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
        <h2 id="pw-h">{t('Change password')}</h2>
        <label className="auth-field"><span>{t('Current password')}</span><input type="password" required autoComplete="current-password" value={f.current} onChange={up('current')} /></label>
        <label className="auth-field"><span>{t('New password')}</span><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={up('password')} /></label>
        <label className="auth-field"><span>{t('Type it again')}</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>
        {err && <p className="auth-err" role="alert">{errText(lang, err)}</p>}
        <div className="auth-row"><button className="auth-btn" type="submit" disabled={busy}>{t('Change password')}</button><button type="button" className="ghost" onClick={onClose}>{t('Cancel')}</button></div>
      </form>
    </div>
  );
}

// The signed-in person's own menu: who, how many devices, password, sign out (here or everywhere).
export function AccountMenu({ persona, onPassword, onFeedback }) {
  const [devices, setDevices] = useState(null);
  useEffect(() => { sessionCount().then(setDevices, () => {}); }, []);
  const th = getLang() === 'th';
  const t = authT(getLang());
  return (
    <div className="menu persona-menu acct-menu" role="menu">
      <div className="acct-who"><b>{persona.name}</b><small>{th && persona.kind === 'parent' ? persona.role.replace(/^Family · /, 'ครอบครัว · ') : persona.role}</small><small>{persona.account?.email}</small></div>
      {devices > 0 && <div className="acct-devices">{th ? SAY_TH.devices(devices) : `Signed in on ${devices === 1 ? 'this device only' : `${devices} devices`}`}</div>}
      <button role="menuitem" onClick={onPassword}><span><b>{t('Change password')}</b></span></button>
      {onFeedback && <button role="menuitem" className="fb-menu" onClick={onFeedback}><span><b>{t('Feedback')}</b><small>{t('Something broken, confusing, or an idea')}</small></span></button>}
      <button role="menuitem" className="sign-out" onClick={() => signOut()}><span><b>{t('Sign out')}</b></span></button>
      {devices > 1 && <button role="menuitem" className="sign-out-all" onClick={() => signOut(true)}><span><b>{t('Sign out everywhere')}</b><small>{th ? SAY_TH.all(devices) : `On all ${devices} devices, this one too`}</small></span></button>}
    </div>
  );
}

// Advisor, pilot only: a new sign-in link for a student in their own advisory who forgot their password.
export function SignInHelp({ studentId, first }) {
  const [acc, setAcc] = useState(undefined); // undefined loading, null no account
  const [link, setLink] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { setLink(null); setErr(null); advisee.account(studentId).then(setAcc, (x) => { setAcc(x.status === 403 ? undefined : null); if (x.status !== 403) setErr(x.message); }); }, [studentId]);
  if (acc === undefined) return null;
  const make = async () => { setErr(null); try { const j = await advisee.reset(studentId); setAcc(j.account); setLink(j); } catch (x) { setErr(x.message); } };
  return (
    <details className="card-sec signin-help" open={!!acc?.resetRequest || !!link}>
      <summary><h3>Sign-in help {acc?.resetRequest && <small className="acc-tag wait">asked for a new link</small>}</h3></summary>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {!acc ? <p className="fineprint">{first} has no account yet. The pilot admin makes accounts.</p>
        : link ? <div className="acc-link">
          <p>{link.emailed ? `Emailed to ${acc.email}. ` : ''}Give {first} this link. It works once, for 7 days, and is shown only now.</p>
          <div className="acc-copy"><input readOnly value={link.setupUrl} onFocus={(e) => e.target.select()} aria-label="Sign-in link" /><button className="ghost" onClick={() => navigator.clipboard?.writeText(link.setupUrl)}>Copy</button></div>
        </div>
          : <><p className="fineprint">{acc.resetRequest ? `${first} forgot their password and asked for a new link.` : `If ${first} forgets their password, make a new sign-in link here.`} It ends the old password and signs {first} out everywhere.</p>
            <button className="ghost" onClick={make}>Make a new sign-in link</button></>}
    </details>
  );
}
