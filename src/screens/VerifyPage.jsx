import { getStore } from '../api.js';
import { verifyCode } from '../format.js';
import { VerifyRecord } from '../components/VerifyModal.jsx';
import Logo from '../components/Logo.jsx';

// Public verification page for a printed code or QR: #/v/NIST-XXXXXX
export default function VerifyPage({ code }) {
  const e = getStore().events.find((x) => verifyCode(x.id) === code);
  const ok = e && e.visibility === 'publishable';
  return (
    <div className="landing verify-page">
      <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Transit Portfolio · Verification</span></header>
      <main className="verify-main">
        <div className="tri" aria-hidden="true" />
        <p className="kicker">Code {code}</p>
        {ok ? <VerifyRecord eventId={e.id} compact /> : (
          <div className="vrec"><h3>No public record for this code</h3><p>The code may be mistyped, or the student has not made this item publishable.</p></div>
        )}
        <p className="fineprint">NIST International School confirms records imported from school systems or endorsed by its teachers. Students choose what is public.</p>
      </main>
    </div>
  );
}
