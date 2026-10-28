import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { family, signOut } from '../auth.js';
import '../auth.css';

// Pilot: a family letter's link (#/family/<token>). Shows the child's first name only, then a parent makes
// their own account (or adds the child to the family account they are signed in with) and lands on the family view.
export default function FamilyJoin({ token, onDone }) {
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
    if (f.password.length < 8) return setErr('Use at least 8 characters.');
    if (f.password !== f.again) return setErr('The two passwords are not the same.');
    join({ name: f.name, email: f.email, password: f.password });
  };
  const n = info?.firstName;
  let body;
  if (!info) body = <div className="auth-card"><p className="auth-lede">Checking your letter…</p></div>;
  else if (info.broken) body = <div className="auth-card"><h1>This link does not work</h1><p className="auth-lede">{info.broken}</p><a className="auth-btn as-link" href="#/">Go to sign in</a></div>;
  else if (info.me && info.me.kind !== 'parent') body = (
    <div className="auth-card"><h1>Sign out first</h1><p className="auth-lede">You are signed in as {info.me.name} with a school account. A family account is separate: sign out, then open the link on the letter again.</p>
      <button className="auth-btn" onClick={() => signOut()}>Sign out</button></div>
  );
  else if (info.me) body = (
    <div className="auth-card"><h1 id="fj-h">{info.me.has ? `${n} is on your account` : `Add ${n} to your account`}</h1>
      <p className="auth-lede">{info.me.has ? `You already see ${n}’s map with your family account.` : `You are signed in as ${info.me.name}. ${n} (${info.homeroom}) joins the children on your family account.`}</p>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {info.me.has ? <button className="auth-btn" onClick={onDone}>Go to the family view</button>
        : <button className="auth-btn" onClick={() => join({})} disabled={busy}>{busy ? 'Adding…' : `Add ${n}`}</button>}
    </div>
  );
  else body = (
    <form className="auth-card" onSubmit={submit} aria-labelledby="fj-h">
      <h1 id="fj-h">Family of {n}{info.homeroom ? ` (${info.homeroom})` : ''}</h1>
      <p className="auth-lede">{have ? `Sign in with your family account and ${n} is added to it.` : `Make your own family account. You will see only what ${n} chooses to share with family.`}</p>
      {!have && <label className="auth-field"><span>Your name</span><input required autoComplete="name" value={f.name} onChange={up('name')} autoFocus /></label>}
      <label className="auth-field"><span>Your email</span><input type="email" required autoComplete="username" inputMode="email" value={f.email} onChange={up('email')} autoFocus={have} /></label>
      <label className="auth-field"><span>{have ? 'Password' : 'Choose a password'}</span><input type="password" required minLength={8} autoComplete={have ? 'current-password' : 'new-password'} value={f.password} onChange={up('password')} />{!have && <small>At least 8 characters. A short sentence is easy to remember.</small>}</label>
      {!have && <label className="auth-field"><span>Type it again</span><input type="password" required autoComplete="new-password" value={f.again} onChange={up('again')} /></label>}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <button className="auth-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : have ? `Sign in and add ${n}` : 'Make my account'}</button>
      <button type="button" className="linkish" onClick={() => { setHave(!have); setErr(null); }}>{have ? 'I need a new family account' : 'I already have a family account (for a brother or sister)'}</button>
      <p className="fineprint">This letter works until {new Date(info.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Two family members can each use it.</p>
    </form>
  );
  return (
    <div className="auth-page">
      <div className="auth-band">
        <Logo className="auth-logo" />
        <div className="auth-title"><b>Transit</b> Portfolio</div>
        <p>Every student’s years at NIST, drawn as a metro map. For families.</p>
      </div>
      <main className="auth-main">{body}</main>
    </div>
  );
}
