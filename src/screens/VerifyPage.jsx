import { useState } from 'react';
import { getStore } from '../api.js';
import { verifyCode } from '../format.js';
import { VerifyRecord } from '../components/VerifyModal.jsx';
import Logo from '../components/Logo.jsx';

// F14: people holding a printed CV type the code; anything close to NIST-XXXXXX is accepted.
const normalise = (raw) => { const x = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^NIST/, ''); return x ? `NIST-${x}` : ''; };

// Public verification page for a printed code or QR: #/v/NIST-XXXXXX, or #/v to type one.
export default function VerifyPage({ code }) {
  const [typed, setTyped] = useState('');
  const e = code && getStore().events.find((x) => verifyCode(x.id) === code);
  const ok = e && e.visibility === 'publishable';
  const go = (ev) => { ev.preventDefault(); const c = normalise(typed); if (c) { location.hash = `#/v/${c}`; setTyped(''); } };
  return (
    <div className="landing verify-page">
      <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Transit Portfolio · Verification</span></header>
      <main className="verify-main">
        <div className="tri" aria-hidden="true" />
        <form className="code-form" onSubmit={go}>
          <label htmlFor="vcode">{code ? 'Check another code' : 'Type the code printed on the CV or certificate'}</label>
          <div><input id="vcode" value={typed} onChange={(x) => setTyped(x.target.value)} placeholder="NIST-XXXXXX" autoComplete="off" spellCheck={false} autoFocus={!code} />
            <button className="primary" disabled={normalise(typed).length < 11}>Verify</button></div>
        </form>
        {code && <p className="kicker">Code {code}</p>}
        {code && (ok ? <VerifyRecord eventId={e.id} compact /> : (
          <div className="vrec"><h3>No public record for this code</h3><p>The code may be mistyped, or the student has not made this item publishable.</p></div>
        ))}
        <p className="fineprint">NIST International School confirms records imported from school systems or endorsed by its teachers. Students choose what is public.</p>
      </main>
    </div>
  );
}
