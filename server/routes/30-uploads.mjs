// Evidence files: a student's photo, PDF, document, recording or video.
// POST /api/upload   body = the raw file; headers content-type and x-filename (URL-encoded)
//                    → { url: '/api/files/<id>.<ext>', name, size, type }
// GET  /api/files/:name  streams it back (Range supported, for audio and video). Pilot: only to someone who may read a
//                    record that uses it, or its uploader (server/files.mjs); anyone else gets 404, and the answer is
//                    Cache-Control: private, no-cache, so each view is checked again. Demo: anyone with the address.
// Files live in DATA_DIR/uploads/ under a 128-bit random id, with a small .json beside each
// one holding the original name and type. Only the types below are accepted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, send, readBody } from '../lib.mjs';
import { MODE } from '../auth.mjs';
import { canSeeFile } from '../files.mjs';
import { fileRefused } from '../audit.mjs';

const DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DIR, { recursive: true });
const LIMIT = 25 * 1024 * 1024;

// Allowed types → extension. SVG and HTML are left out on purpose: they can carry script.
const TYPES = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt', 'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/rtf': 'rtf', 'text/plain': 'txt', 'text/csv': 'csv',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'weba', 'audio/flac': 'flac',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/x-m4v': 'm4v',
};
// Extension → the one type it is served as.
const SERVE = {};
for (const [t, e] of Object.entries(TYPES)) SERVE[e] ||= t;
SERVE.txt = 'text/plain; charset=utf-8'; SERVE.csv = 'text/csv; charset=utf-8';
const INLINE = /^(image|audio|video)\/|^application\/pdf$/;
// Browsers often send no type (or a vague one) for office files: infer it from the name.
const BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([t, e]) => [e, t]).reverse());
Object.assign(BY_EXT, { jpeg: 'image/jpeg', jpg: 'image/jpeg', m4a: 'audio/mp4', wav: 'audio/wav', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm' });

const fail = (status, error) => Object.assign(new Error(error), { status });
const NAME = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;

export default (app) => {
  app.post('/api/upload', async (req, res) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > LIMIT) { req.resume(); return send(res, 413, { error: 'That file is larger than 25 MB.' }, { connection: 'close' }); }
    let name = 'file';
    try { name = decodeURIComponent(String(req.headers['x-filename'] || 'file')); } catch { /* keep the default */ }
    name = name.replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 160) || 'file';
    let type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!TYPES[type]) type = BY_EXT[path.extname(name).slice(1).toLowerCase()] || type;
    if (!TYPES[type]) { req.resume(); throw fail(415, 'That kind of file cannot be added. Use a photo, PDF, office document, audio or video.'); }
    const body = await readBody(req, LIMIT);
    if (!body.length) throw fail(400, 'The file was empty.');
    const file = `${crypto.randomBytes(16).toString('hex')}.${TYPES[type]}`;
    fs.writeFileSync(path.join(DIR, file), body);
    const meta = { name, size: body.length, type, at: new Date().toISOString(), by: req.user?.id || null };
    fs.writeFileSync(path.join(DIR, `${file}.json`), JSON.stringify(meta));
    send(res, 201, { url: `/api/files/${file}`, name, size: body.length, type });
  });

  app.get('/api/files/:name', async (req, res, { name }) => {
    if (!NAME.test(name)) throw fail(404, 'Not found');
    const f = path.join(DIR, name);
    let st; try { st = fs.statSync(f); } catch { throw fail(404, 'Not found'); }
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(`${f}.json`, 'utf8')); } catch { /* serve without the original name */ }
    const pilot = MODE === 'pilot';
    if (pilot && !canSeeFile(req.user, name, meta)) { fileRefused(req, name); throw fail(404, 'Not found'); }
    const ext = name.split('.').pop();
    const type = SERVE[ext] || 'application/octet-stream';
    const fname = (meta.name || name).replace(/["\r\n]/g, '');
    const ascii = fname.replace(/[^\x20-\x7e]/g, '_');
    const headers = {
      'content-type': type,
      'content-disposition': `${INLINE.test(type) ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
      'cache-control': pilot ? 'private, no-cache' : 'private, max-age=31536000, immutable',
      ...(pilot ? { vary: 'Cookie' } : {}),
      'x-content-type-options': 'nosniff',
      'accept-ranges': 'bytes',
      etag: `"${name}"`,
    };
    if (req.headers['if-none-match'] === headers.etag) { res.writeHead(304, headers); return res.end(); }
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
    if (req.headers.range && range && (range[1] || range[2])) {
      let start = range[1] === '' ? Math.max(0, st.size - Number(range[2])) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
      return fs.createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'content-length': st.size });
    fs.createReadStream(f).pipe(res);
  });
};
