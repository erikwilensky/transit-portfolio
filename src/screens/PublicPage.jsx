import { useEffect, useState } from 'react';
import { getDrafts, loadPublic } from '../api.js';
import ShareLanding, { LinkDead } from './ShareLanding.jsx';
import VerifyPage from './VerifyPage.jsx';
import Logo from '../components/Logo.jsx';
import { VerifyProvider } from '../components/VerifyModal.jsx';

// Talks to the pilot server's /api/public/*. Resolves to { status, body }, or null when there is no
// server (static hosting, vite preview): then the page falls back to this browser's own copy.
async function call(path, body) {
  try {
    const res = await fetch(new URL(`api/public/${path}`, location.href), body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
    return { status: res.status, body: await res.json() };
  } catch { return null; }
}
const deadReason = (r) => (r.status === 404 ? 'missing' : /withdrawn/i.test(r.body?.error || '') ? 'revoked' : 'expired');

function Shell({ children }) {
  return (
    <div className="landing">
      <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Transit Portfolio</span></header>
      {children}
    </div>
  );
}
const Loading = () => <Shell><div className="link-dead" aria-busy="true"><p>Opening the portfolio…</p></div></Shell>;

// #/s/<token>: the server sends only this link's record; the existing share page renders it.
export function PublicShare({ token, version }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    call(`share/${encodeURIComponent(token)}`).then((r) => {
      if (!live) return;
      if (!r) return setState({ status: 'local' });
      if (r.status !== 200) return setState({ status: 'dead', reason: deadReason(r) });
      loadPublic(r.body);
      setState({ status: 'ready', gated: r.body.gated });
    });
    return () => { live = false; };
  }, [token]);

  if (state.status === 'local') return <VerifyProvider><ShareLanding token={token} drafts={getDrafts()} version={version} /></VerifyProvider>;
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'dead') return <Shell><LinkDead reason={state.reason} /></Shell>;
  const remote = {
    gated: state.gated,
    open: async (email) => {
      const r = await call(`share/${encodeURIComponent(token)}/open`, { email });
      if (!r) throw new Error('The school server could not be reached. Try again.');
      if (r.status !== 200) throw new Error(r.body?.error || 'Could not open the portfolio.');
      loadPublic(r.body);
      setState({ status: 'ready', gated: false });
    },
    extend: (email) => call(`share/${encodeURIComponent(token)}/extend`, { email }),
    ask: (eventId, text, email) => call(`share/${encodeURIComponent(token)}/ask`, { eventId, text, email }),
  };
  return <VerifyProvider><ShareLanding token={token} drafts={getDrafts()} version={version} remote={remote} /></VerifyProvider>;
}

// #/v/<code>: the server answers for that one station only.
export function PublicVerify({ code }) {
  const [state, setState] = useState({ status: code ? 'loading' : 'ready' });
  useEffect(() => {
    if (!code) return undefined;
    let live = true;
    setState({ status: 'loading' });
    call(`verify/${encodeURIComponent(code)}`).then((r) => {
      if (!live) return;
      if (!r) return setState({ status: 'local' });
      setState({ status: 'ready', record: r.status === 200 ? r.body : null });
    });
    return () => { live = false; };
  }, [code]);
  if (state.status === 'local') return <VerifyPage code={code} />;
  if (state.status === 'loading') return <Shell><div className="link-dead" aria-busy="true"><p>Checking the code…</p></div></Shell>;
  return <VerifyPage code={code} remote={code ? { record: state.record } : null} />;
}
