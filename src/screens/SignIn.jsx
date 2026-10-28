import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { advisee, changePassword, finishSetup, forgotPassword, getSetup, sessionCount, signIn, signOut } from '../auth.js';
import '../auth.css';

// Pilot mode: the sign-in page, and the one-time setup page (#/setup/<token>) for new and reset accounts.
export default function SignIn({ setupToken, onDone }) {
  return (
    <div className="auth-page">
      <div className="auth-band">
        <Logo className="auth-logo" />
        <div className="auth-title"><b>Transit</b> Portfolio</div>
        <p>Every student’s years at NIST, drawn as a metro map. Pilot.</p>
      </div>
      <main className="auth-main">
        {setupToken ? <Setup token={setupToken} onDone={onDone} /> : <Login onDone={onDone} />}
      </main>
    </div>
  );
}

function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await signIn(email, password); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (forgot) return <Forgot email={email} back={() => setForgot(false)} />;
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="signin-h">
      <h1 id="signin-h">Sign in</h1>
      <p className="auth-lede">Use your school email and the password you set from your setup link.</p>
      <label className="auth-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
      <label className="auth-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <button type="button" className="linkish auth-forgot" onClick={() => setForgot(true)}>Forgot your password?</button>
    </form>
  );
}

// Asks for a new sign-in link. The answer is the same whether or not the email has an account.
function Forgot({ email: start, back }) {
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
      <h1 id="forgot-h">{done.emailed ? 'Check your email' : 'Request sent'}</h1>
      {done.emailed
        ? <p className="auth-lede" role="status">If an account uses {email}, a new sign-in link is on its way. It works once, for 7 days. Your old password works until you use it. Nothing after 10 minutes? Ask your teacher or the pilot admin for a new link.</p>
        : <p className="auth-lede" role="status">If an account uses {email}, the pilot admin can now see your request. Ask your teacher or the pilot admin for a new sign-in link. Students can also ask their advisor.</p>}
      <button type="button" className="auth-btn" onClick={back}>Back to sign in</button>
    </div>
  );
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="forgot-h">
      <h1 id="forgot-h">Forgot your password?</h1>
      <p className="auth-lede">Type your school email. You will get a new sign-in link to choose a new password.</p>
      <label className="auth-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row"><button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Ask for a new link'}</button><button type="button" className="ghost" onClick={back}>Back</button></div>
    </form>
  );
}

function Setup({ token, onDone }) {
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
  if (!info) return <div className="auth-card"><p className="auth-lede">Checking your link…</p></div>;
  if (info.broken) return <div className="auth-card"><h1>Link not valid</h1><p className="auth-lede">{info.broken}</p><a className="auth-btn as-link" href="#/">Go to sign in</a></div>;
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="setup-h">
      <h1 id="setup-h">{info.firstRun ? 'Set up the pilot' : `Welcome, ${info.name.split(' ')[0]}`}</h1>
      <p className="auth-lede">{info.firstRun ? 'Create the first admin account. You can then add everyone else from Accounts.' : 'Choose a password for your account. This link works once.'}</p>
      {info.firstRun ? <>
        <label className="auth-field"><span>Your name</span><input required autoComplete="name" value={f.name} onChange={up('name')} autoFocus /></label>
        <label className="auth-field"><span>Email</span><input type="email" required autoComplete="username" value={f.email} onChange={up('email')} /></label>
      </> : <div className="auth-field"><span>Email</span><output className="auth-out">{info.email}</output><input type="hidden" autoComplete="username" value={info.email} readOnly /></div>}
      <label className="auth-field"><span>New password</span><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={up('password')} autoFocus={!info.firstRun} /><small>At least 8 characters. A short sentence is easy to remember.</small></label>
      <label className="auth-field"><span>Type it again</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : info.firstRun ? 'Create admin account' : 'Save and sign in'}</button>
    </form>
  );
}

// Change your own password, from the account menu.
export function PasswordDialog({ onClose, toast }) {
  const [f, setF] = useState({ current: '', password: '', again: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (f.password.length < 8) return setErr('Use at least 8 characters.');
    if (f.password !== f.again) return setErr('The two new passwords are not the same.');
    setBusy(true);
    try { await changePassword(f.current, f.password); toast('Password changed. Other devices are signed out.'); onClose(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal auth-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pw-h">
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="pw-h">Change password</h2>
        <label className="auth-field"><span>Current password</span><input type="password" required autoComplete="current-password" value={f.current} onChange={up('current')} /></label>
        <label className="auth-field"><span>New password</span><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={up('password')} /></label>
        <label className="auth-field"><span>Type it again</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="auth-row"><button className="auth-btn" type="submit" disabled={busy}>Change password</button><button type="button" className="ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </div>
  );
}

// The signed-in person's own menu: who, how many devices, password, sign out (here or everywhere).
export function AccountMenu({ persona, onPassword, onFeedback }) {
  const [devices, setDevices] = useState(null);
  useEffect(() => { sessionCount().then(setDevices, () => {}); }, []);
  return (
    <div className="menu persona-menu acct-menu" role="menu">
      <div className="acct-who"><b>{persona.name}</b><small>{persona.role}</small><small>{persona.account?.email}</small></div>
      {devices > 0 && <div className="acct-devices">Signed in on {devices === 1 ? 'this device only' : `${devices} devices`}</div>}
      <button role="menuitem" onClick={onPassword}><span><b>Change password</b></span></button>
      {onFeedback && <button role="menuitem" className="fb-menu" onClick={onFeedback}><span><b>Feedback</b><small>Something broken, confusing, or an idea</small></span></button>}
      <button role="menuitem" className="sign-out" onClick={() => signOut()}><span><b>Sign out</b></span></button>
      {devices > 1 && <button role="menuitem" className="sign-out-all" onClick={() => signOut(true)}><span><b>Sign out everywhere</b><small>On all {devices} devices, this one too</small></span></button>}
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
