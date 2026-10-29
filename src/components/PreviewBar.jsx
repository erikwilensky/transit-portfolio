import { useEffect, useState } from 'react';
import { PREVIEW_MSG, exitPreview, preview } from '../preview.js';
import './preview.css';

// Admin "See as" (src/preview.js): who this is, that it is read-only, and the way back. A refused change says so.
export function PreviewBar() {
  const [said, setSaid] = useState(0);
  const [err, setErr] = useState(() => preview()?.error || null);
  useEffect(() => {
    let t; const on = () => { setSaid((n) => n + 1); clearTimeout(t); t = setTimeout(() => setSaid(0), 3500); };
    addEventListener('tp-preview-refused', on); return () => { removeEventListener('tp-preview-refused', on); clearTimeout(t); };
  }, []);
  const p = preview();
  if (err) return <div className="pv-bar pv-err" role="alert"><span>{err}</span><button onClick={() => setErr(null)}>OK</button></div>;
  if (!p?.persona) return null;
  return (
    <>
      <div className="pv-bar" role="region" aria-label="Preview">
        <span>Seeing the portfolio as <b>{p.user.name}</b>{p.label ? ` (${p.label})` : ''}. Read-only.</span>
        <button onClick={exitPreview}>Exit preview</button>
      </div>
      {said > 0 && <div className="pv-said" role="status">{PREVIEW_MSG}</div>}
    </>
  );
}
