import { useState } from 'react';
import { extraViews, getActivity, getPrivacy, isGated, logLink, SHARED_LABEL, TODAY } from '../api.js';
import { appUrl, fmtDate, ago } from '../format.js';
import Qr from '../components/Qr.jsx';

const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const days = (d) => Math.round((new Date(d) - new Date(TODAY)) / 86400000);

// S6: every link the student has made, who it was for, whether anyone opened it, and the off switch.
export default function ShareLinks({ studentId, drafts, updateDraft, toast, version }) {
  const [qr, setQr] = useState(null);
  const [pres, setPres] = useState('');
  const [who, setWho] = useState('');
  const [len, setLen] = useState(getPrivacy(studentId).linkDays);
  const [gate, setGate] = useState(false);
  const activity = getActivity(studentId);
  const rows = drafts.flatMap((p) => p.shareLinks.map((l) => ({ p, l })));
  const lastView = (token) => activity.find((a) => a.kind === 'view' && a.text.endsWith(`/s/${token}`));
  const patch = (p, token, ch, msg) => { updateDraft(p.id, { shareLinks: p.shareLinks.map((x) => (x.token === token ? { ...x, ...ch } : x)) }); logLink(studentId, msg); toast(msg); };
  const create = () => {
    const p = drafts.find((d) => d.id === pres); if (!p) return;
    const token = `tp-${Math.random().toString(36).slice(2, 6)}`;
    updateDraft(p.id, { shareLinks: [...p.shareLinks, { token, presentationId: p.id, expiresAt: addDays(TODAY, +len), revoked: false, views: 0, sharedWith: who.trim() || 'Anyone with the link', emailGate: gate }] });
    logLink(studentId, `Created share link /s/${token} for “${p.title}”`);
    setQr(token); setWho(''); toast(`Link created: /s/${token}`);
  };
  const status = (l) => (l.revoked ? ['off', 'Switched off'] : l.expiresAt < TODAY ? ['exp', 'Expired'] : days(l.expiresAt) <= 21 ? ['soon', `${days(l.expiresAt)} days left`] : ['on', `${days(l.expiresAt)} days left`]);

  return (
    <div className="page links">
      <header className="page-head">
        <div>
          <div className="kicker">Share links</div>
          <h1>Who can read my story</h1>
          <p>Each link opens one presentation, read-only. Views are logged, links expire, and you can switch any of them off at once.</p>
        </div>
        <div className="meter">
          {(() => { const n = rows.filter(({ l }) => !l.revoked && l.expiresAt >= TODAY).length; return <div><b>{n}</b><span>link{n === 1 ? '' : 's'} working</span></div>; })()}
          <div><b>{rows.reduce((n, { l }) => n + l.views + extraViews(l.token), 0)}</b><span>views in total</span></div>
        </div>
      </header>
      <div className="link-list">
        {rows.map(({ p, l }) => {
          const [k, label] = status(l);
          const lv = lastView(l.token);
          const working = !l.revoked && l.expiresAt >= TODAY;
          return (
            <article key={l.token} className={`link-row st-${k}`}>
              <div className="lr-main">
                <div className="lr-top"><code>/s/{l.token}</code><span className={`lr-status s-${k}`}>{label}</span></div>
                <h3>{p.title}</h3>
                <p>For <b>{l.sharedWith || SHARED_LABEL[l.token] || 'Anyone with the link'}</b> · expires {fmtDate(l.expiresAt)}{isGated(l) ? ' · asks for an email' : ''}</p>
              </div>
              <div className="lr-stats"><b>{l.views + extraViews(l.token)}</b><span>views</span><small>{lv ? `Last: ${lv.live ? ago(lv.ts) : fmtDate(lv.ts.slice(0, 10))}` : 'Not opened yet'}</small></div>
              <div className="lr-actions">
                <button className="ghost" onClick={() => setQr(qr === l.token ? null : l.token)}>{qr === l.token ? 'Hide QR' : 'QR'}</button>
                <a className="ghost" href={appUrl(`s/${l.token}`)} target="_blank" rel="noreferrer">Open</a>
                {working && <button className="ghost" onClick={() => patch(p, l.token, { expiresAt: addDays(l.expiresAt, 30) }, `Extended /s/${l.token} by 30 days`)}>+30 days</button>}
                {!working && <button className="ghost" onClick={() => patch(p, l.token, { revoked: false, expiresAt: l.expiresAt < TODAY ? addDays(TODAY, 30) : l.expiresAt }, `Switched /s/${l.token} back on`)}>Switch on</button>}
                {working && <button className="ghost" aria-pressed={isGated(l)} onClick={() => patch(p, l.token, { emailGate: !isGated(l) }, isGated(l) ? `/s/${l.token} no longer asks for an email` : `/s/${l.token} now asks readers for an email`)}>{isGated(l) ? 'Drop email check' : 'Ask for email'}</button>}
                {working && <button className="ghost danger" onClick={() => patch(p, l.token, { revoked: true }, `Switched off /s/${l.token}`)}>Switch off</button>}
              </div>
              {qr === l.token && <div className="lr-qr"><Qr text={appUrl(`s/${l.token}`)} size={132} /><span>Print it on a CV or show it on a screen. It stops working when the link does.</span></div>}
            </article>
          );
        })}
        {!rows.length && <div className="empty-state"><b>No links yet.</b> Make one below when you are ready to share.</div>}
      </div>
      <section className="card-sec new-link">
        <h3>New link</h3>
        <div className="nl-row">
          <select value={pres} onChange={(e) => setPres(e.target.value)} aria-label="Presentation"><option value="">Choose a presentation…</option>{drafts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Who is it for? (optional)" />
          <select value={len} onChange={(e) => setLen(e.target.value)} aria-label="Expires after">{[14, 30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          <label className="nl-gate"><input type="checkbox" checked={gate} onChange={(e) => setGate(e.target.checked)} /> Ask for an email</label>
          <button className="primary" disabled={!pres} onClick={create}>Create link</button>
        </div>
      </section>
    </div>
  );
}
