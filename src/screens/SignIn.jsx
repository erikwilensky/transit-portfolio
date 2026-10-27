import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { changePassword, finishSetup, getSetup, signIn } from '../auth.js';
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
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await signIn(email, password); onDone(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <form className="auth-card" onSubmit={submit} aria-labelledby="signin-h">
      <h1 id="signin-h">Sign in</h1>
      <p className="auth-lede">Use your school email and the password you set from your setup link.</p>
      <label className="auth-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
      <label className="auth-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="auth-note">Forgotten your password? Ask the pilot admin for a new setup link.</p>
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
