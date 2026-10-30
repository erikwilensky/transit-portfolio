import { useMemo, useState } from 'react';
import { ACCEPT, evidenceFor, fileKind, fmtSize, uploadFile, viewUrl } from '../upload.js';

// One upload at a time, with progress and a plain error.
export function useUpload() {
  const [state, setState] = useState({ busy: false, progress: 0, error: null });
  const run = async (file, then) => {
    if (!file) return null;
    setState({ busy: true, progress: 0, error: null, name: file.name });
    try {
      const r = await uploadFile(file, { onProgress: (p) => setState((s) => ({ ...s, progress: p })) });
      setState({ busy: false, progress: 1, error: null });
      then?.(r);
      return r;
    } catch (e) {
      setState({ busy: false, progress: 0, error: e?.message || 'The file could not be added. Please try again.' });
      return null;
    }
  };
  return { ...state, run, clear: () => setState({ busy: false, progress: 0, error: null }) };
}

// A file button that uploads what is chosen and hands back an evidence item.
// `capture` opens the camera on a phone ("environment" for the back camera).
export function AttachButton({ label = 'Attach a file', accept = ACCEPT, capture, onAdded, className = 'ghost file-btn', caption, disabled }) {
  const up = useUpload();
  return (
    <span className="attach">
      <label className={`${className}${up.busy || disabled ? ' busy' : ''}`}>
        {up.busy ? 'Uploading…' : label}
        <input type="file" accept={accept} capture={capture} disabled={up.busy || disabled}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; up.run(file, (r) => onAdded?.(evidenceFor(r, caption), r)); }} />
      </label>
      <UploadStatus up={up} />
    </span>
  );
}

export function UploadStatus({ up }) {
  if (up.busy) return <span className="up-status" role="status"><span className="up-bar" aria-hidden="true"><i style={{ width: `${Math.round(up.progress * 100)}%` }} /></span>{Math.round(up.progress * 100)}%</span>;
  if (up.error) return <span className="up-error" role="alert">{up.error}</span>;
  return null;
}

// An uploaded file (not one of the built-in evidence documents).
export const isUploaded = (ev) => !!ev && (!!ev.type || /^(\/?api\/files\/|data:|blob:)/.test(ev.url || ''));
export const evKind = (ev) => (ev.kind === 'image' ? 'image' : fileKind(ev.type, ev.url));
const KIND_NAME = { image: 'Photo', pdf: 'PDF', audio: 'Audio', video: 'Video', doc: 'Document' };
export const fileLabel = (ev) => {
  const k = evKind(ev);
  const ext = /\.([a-z0-9]{2,5})$/i.exec(ev.name || '')?.[1]?.toUpperCase();
  return [KIND_NAME[k] || 'File', k === 'image' || k === 'pdf' ? null : ext, fmtSize(ev.size)].filter(Boolean).join(' · ');
};
export const FILE_ICON = { image: '▣', pdf: '▤', audio: '♪', video: '▶', doc: '▤' };

// Shows an uploaded file the way it should be seen: a photo, a PDF in a frame, a player for
// audio and video, or a clear open link for documents a browser cannot show.
export function FileView({ ev, compact = false }) {
  // A data URL (no server) becomes a blob URL, which frames and new tabs will open.
  const url = useMemo(() => viewUrl(ev.url), [ev.url]);
  const k = evKind(ev);
  const name = ev.name || ev.caption || 'file';
  const open = <a className="ghost small-btn fv-open" href={url} target="_blank" rel="noopener noreferrer" download={k === 'doc' ? name : undefined}>{k === 'doc' ? 'Download' : 'Open in a new tab'}</a>;
  return (
    <div className={`fv fv-${k}${compact ? ' compact' : ''}`}>
      {k === 'image' && <img src={url} alt={ev.caption || ''} />}
      {k === 'pdf' && <iframe src={url} title={ev.caption || name} className="fv-frame" />}
      {k === 'audio' && <audio controls preload="metadata" src={url} aria-label={ev.caption || name} />}
      {k === 'video' && <video controls preload="metadata" playsInline src={url} aria-label={ev.caption || name} />}
      {k === 'doc' && <p className="fv-doc"><span aria-hidden="true">{FILE_ICON.doc}</span><span><b>{name}</b><small>A browser cannot show this kind of file. Download it to open it.</small></span></p>}
      <div className="fv-foot">{!compact && k !== 'doc' && <small>{fileLabel(ev)}</small>}{open}</div>
    </div>
  );
}

// Plain links to uploaded files, e.g. on a teacher's endorsement card.
export function FileLinks({ evidence = [] }) {
  const files = evidence.filter((ev) => isUploaded(ev) && ev.kind !== 'image');
  if (!files.length) return null;
  return <ul className="file-links">{files.map((ev, i) => <li key={i}><FileLink ev={ev} />{evKind(ev) === 'audio' && <audio className="vc-inline" controls preload="metadata" src={ev.url} aria-label={ev.caption || 'Voice note'} />}</li>)}</ul>;
}
function FileLink({ ev }) {
  const url = useMemo(() => viewUrl(ev.url), [ev.url]);
  return <a href={url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{FILE_ICON[evKind(ev)]}</span> {ev.caption} <small>{fileLabel(ev)}</small></a>;
}

// Files waiting to be saved with a form, each with a remove button.
export function PendingFiles({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <ul className="pending-files">
      {files.map((f, i) => (
        <li key={f.url.slice(0, 80) + i}>
          {f.kind === 'image' ? <img src={f.url} alt="" /> : <span className="pf-icon" aria-hidden="true">{FILE_ICON[evKind(f)]}</span>}
          <span><b>{f.caption}</b><small>{fileLabel(f)}</small></span>
          <button type="button" className="linkish" onClick={() => onRemove(i)} aria-label={`Remove ${f.caption}`}>Remove</button>
        </li>
      ))}
    </ul>
  );
}

// Record a short voice note with the microphone, then upload it like any other file.
export function VoiceNote({ onAdded, label = 'Record a voice note' }) {
  const up = useUpload();
  const [rec, setRec] = useState(null); // the MediaRecorder while recording
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState(null);
  const can = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  if (!can) return null;
  const start = async () => {
    setErr(null);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setErr('The microphone could not be used. Check that this page is allowed to use it.'); return; }
    const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    const t0 = Date.now();
    const timer = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 500);
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer); setRec(null);
      const mime = (r.mimeType || type || 'audio/webm').split(';')[0];
      const ext = { 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }[mime] || 'webm';
      const file = new File(chunks, `Voice note ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')}.${ext}`, { type: mime });
      up.run(file, (res) => onAdded?.(evidenceFor(res, 'Voice note'), res));
    };
    r.start();
    setSecs(0); setRec(r);
  };
  return (
    <span className="attach">
      {rec ? <button type="button" className="ghost small-btn rec-on" onClick={() => rec.stop()}>Stop recording · {secs}s</button>
        : <button type="button" className="ghost small-btn" disabled={up.busy} onClick={start}>{up.busy ? 'Uploading…' : label}</button>}
      {err ? <span className="up-error" role="alert">{err}</span> : <UploadStatus up={up} />}
    </span>
  );
}
