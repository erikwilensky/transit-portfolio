import { useRef, useState } from 'react';
import { appUrl, fmtDate } from '../format.js';
import Qr from './Qr.jsx';

// F7: a new link is something to hand over at once: copy it, open it, or show the QR.
export default function ShareDialog({ link, title, onClose }) {
  const url = appUrl(`s/${link.token}`);
  const [copied, setCopied] = useState(null); // 'yes', or 'manual' when the browser blocks the clipboard
  const input = useRef(null);
  // Without clipboard access (an http address, a blocked permission) the link is selected for the student to copy.
  const manual = () => { setCopied('manual'); input.current?.focus(); input.current?.select(); };
  const copy = () => { try { navigator.clipboard.writeText(url).then(() => setCopied('yes'), manual); } catch { manual(); } };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal share-dlg" role="dialog" aria-label="Share link ready" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Share link ready</div>
        <h2>{title}</h2>
        <div className="sd-row">
          <Qr text={url} size={140} />
          <div className="sd-main">
            <input ref={input} readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link" />
            <div className="sd-btns">
              <button className="primary" onClick={copy}>{copied === 'yes' ? 'Copied' : copied === 'manual' ? 'Selected: copy it now' : 'Copy link'}</button>
              <a className="ghost" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
            </div>
            <p className="fineprint">Read-only. Expires {fmtDate(link.expiresAt)}. Every view is logged, and you can switch it off any time under Share links.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
