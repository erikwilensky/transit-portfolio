// Evidence files. With the pilot server running, a file goes to POST api/upload and the record
// keeps only its address (api/files/<id>.<ext>). Without one (static hosting, vite preview),
// it falls back to a data URL kept in the browser, as the demo always did.
//
//   uploadFile(file, { onProgress }) → Promise<{ url, name, size, type, local? }>
//   evidenceFor(result, caption?) → an evidence item for the record ({ kind, url, caption, name, size, type })

import { holdUpload, serverMode } from './sync.js';

export const MAX_BYTES = 25 * 1024 * 1024;
// Without the server everything sits in browser storage, so keep it small.
export const MAX_LOCAL_BYTES = 4 * 1024 * 1024;
export const ACCEPT = 'image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,audio/*,video/*';

const OK_TYPE = /^(image\/(jpeg|png|gif|webp|heic|heif|avif)|application\/pdf|audio\/.+|video\/.+|text\/(plain|csv)|application\/(msword|rtf|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\..+|vnd\.oasis\.opendocument\..+))$/;
const OK_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|pdf|docx?|xlsx?|pptx?|od[tsp]|rtf|txt|csv|mp3|m4a|aac|wav|ogg|weba|flac|mp4|mov|webm|ogv|m4v)$/i;

export const fileKind = (type = '', url = '') => {
  if (/^image\//.test(type) || (!type && /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(url))) return 'image';
  if (/pdf/.test(type) || (!type && /\.pdf$/i.test(url))) return 'pdf';
  if (/^audio\//.test(type)) return 'audio';
  if (/^video\//.test(type)) return 'video';
  return 'doc';
};
export const fmtSize = (n) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

class UploadError extends Error {}
const fail = (msg) => { throw new UploadError(msg); };

// Remembered after the first try, so a static demo asks only once.
let noServer = false;

// purpose (a class photo drop, 'photo-drop:<draft>'): photos only, scaled to `max` pixels, never held for later.
export async function uploadFile(file, { onProgress, purpose, max = 2000 } = {}) {
  if (!file) fail('No file was chosen.');
  if (!OK_TYPE.test(file.type || '') && !OK_EXT.test(file.name || '')) fail('That kind of file cannot be added. Use a photo, PDF, office document, audio or video.');
  if (file.size > MAX_BYTES && !/^image\//.test(file.type)) fail(`That file is ${fmtSize(file.size)}. The limit is 25 MB.`);
  if (purpose && !/^image\//.test(file.type || '') && !/\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name || '')) fail('Only photos can be added here.');
  onProgress?.(0);
  if (!noServer) {
    const body = /^image\//.test(file.type) ? await shrink(file, max, 0.85) : file;
    if (body.size > MAX_BYTES) fail(`That file is ${fmtSize(body.size)}. The limit is 25 MB.`);
    const r = await send(body, body.name || file.name, onProgress, purpose);
    if (r.ok) { onProgress?.(1); return { ...r.data, url: r.data.url.replace(/^\//, '') }; }
    if (r.error) fail(r.error);
    // Nothing answered. If the server is there after all, say so rather than filling the shared record.
    if (!r.none && await serverIsUp()) fail('The file could not reach the school server. Check the connection and try again.');
    // Offline with the school server (src/outbox.js): kept on this device and uploaded when the connection is back.
    if (purpose && !r.none && serverMode()) fail('No connection to the school server. Try again when you are back online.');
    const held = !r.none && serverMode() && holdUpload(body, body.name || file.name || 'photo', body.type || file.type);
    if (held) { onProgress?.(1); return { url: held, name: body.name || file.name || 'file', size: body.size, type: body.type || file.type || 'application/octet-stream', pending: true }; }
    noServer = true;
  }
  // No server: keep it in the browser.
  const small = /^image\//.test(file.type) ? await shrink(file, 1200, 0.8, true) : file;
  if (small.size > MAX_LOCAL_BYTES) fail(`That file is ${fmtSize(small.size)}. Without the school server only files up to ${fmtSize(MAX_LOCAL_BYTES)} can be kept in this browser.`);
  const url = await readAsDataUrl(small);
  onProgress?.(1);
  return { url, name: small.name || file.name || 'file', size: small.size, type: small.type || file.type || 'application/octet-stream', local: true };
}

export const evidenceFor = (f, caption) => ({ kind: fileKind(f.type, f.url) === 'image' ? 'image' : 'file', url: f.url, caption: caption || f.name, name: f.name, size: f.size, type: f.type });

// POST the raw file. Resolves { ok, data } on success, { error } for a real refusal from the
// server, or {} when there is no server to talk to (network error, 404, an HTML page back).
function send(body, name, onProgress, purpose) {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('POST', new URL('api/upload', location.href).href);
    x.setRequestHeader('content-type', body.type || 'application/octet-stream');
    x.setRequestHeader('x-filename', encodeURIComponent(name || 'file'));
    if (purpose) x.setRequestHeader('x-purpose', purpose);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.min(0.99, e.loaded / e.total));
    x.onerror = () => resolve({});
    x.onload = () => {
      let data = null;
      if (/json/.test(x.getResponseHeader('content-type') || '')) { try { data = JSON.parse(x.responseText); } catch { /* not ours */ } }
      if (!data) return resolve({}); // an HTML page or nothing: no server here
      if (x.status === 404 || x.status === 405) return resolve({ none: true }); // a server without uploads
      if (x.status >= 200 && x.status < 300 && data.url) return resolve({ ok: true, data });
      if (x.status === 401 || x.status === 403) return resolve({ error: 'Please sign in again, then add the file.' });
      resolve({ error: data.error || 'The file could not be uploaded. Please try again.' });
    };
    x.send(body);
  });
}

const serverIsUp = () => fetch(new URL('api/health', location.href).href, { cache: 'no-store' })
  .then((r) => r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json().then((j) => !!j.ok) : false).catch(() => false);

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new UploadError('The file could not be read.'));
  r.readAsDataURL(blob);
});

// Big photos are scaled down to `max` pixels on the longest side and saved as JPEG.
// Small PNGs and GIFs (screenshots, diagrams, animations) stay as they are.
async function shrink(file, max, quality, forceSmall = false) {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return file;
  let img;
  try { img = await loadImage(file); } catch { return file; }
  const long = Math.max(img.width, img.height);
  const keepAsIs = long <= max && (/^image\/(png|gif)$/.test(file.type) ? file.size <= (forceSmall ? 600e3 : 2e6) : file.size <= (forceSmall ? 400e3 : 1.5e6));
  if (keepAsIs) { URL.revokeObjectURL(img.src); return file; }
  const k = Math.min(1, max / long);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); // transparent PNGs get a white page, not black
  g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file;
  const name = (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

// Data URLs open poorly in a new tab or frame (browsers block them); a blob URL works.
export function viewUrl(url) {
  if (!url?.startsWith('data:')) return url;
  try {
    const [head, b64] = url.split(',');
    const type = head.slice(5).split(';')[0];
    const bin = atob(b64); const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([a], { type }));
  } catch { return url; }
}
