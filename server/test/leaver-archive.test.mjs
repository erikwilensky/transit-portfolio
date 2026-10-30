// Leaver archive (server/archive.mjs, routes/52-archive.mjs) against a real pilot server. Run: npm run test:server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { Writable } from 'node:stream';
import { zipStream, unzip } from '../zip.mjs';
import { pdf, lost, pdfText } from '../pdf.mjs';
import { loadFont, shape } from '../ttf.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ROSTER = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/imports/fixtures/roster/roster.json'), 'utf8'));
ROSTER.students.find((s) => s.id === 'S2001').year = 13; // Fern is in Year 13; Gus stays in Year 12
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
function start(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    const t = setTimeout(() => reject(new Error(out)), 15000);
    p.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve({ p, setup: out.match(/#\/setup\/(\S+)/)?.[1] }); } });
    p.stderr.on('data', (d) => { out += d; });
  });
}
const files = (buf) => Object.fromEntries(unzip(buf).map((e) => [e.name, e.data]));
const HAS_UNZIP = spawnSync('unzip', ['-v']).status === 0;
function unzipOk(buf) { // the system unzip reads the central directory too
  if (!HAS_UNZIP) return true;
  const f = path.join(os.tmpdir(), `tp-la-${process.pid}-${Math.random().toString(36).slice(2)}.zip`);
  fs.writeFileSync(f, buf);
  try { return spawnSync('unzip', ['-tq', f]).status === 0; } finally { fs.unlinkSync(f); }
}

test('the streaming ZIP writer waits for a slow reader and writes a valid ZIP', async () => {
  const chunks = []; let most = 0;
  const out = new Writable({ highWaterMark: 16 * 1024, write(c, _e, cb) { chunks.push(c); most = Math.max(most, out.writableLength); setTimeout(cb, 1); } });
  const z = zipStream(out);
  const big = Buffer.alloc(64 * 1024, 7);
  for (let i = 0; i < 60; i++) await z.add(`student-${i}.zip`, Buffer.concat([big, Buffer.from(String(i))]));
  await z.end();
  const buf = Buffer.concat(chunks);
  const got = unzip(buf);
  assert.equal(got.length, 60);
  assert.equal(got[59].data.subarray(-2).toString(), '59');
  assert.ok(most <= 2 * big.length, `never more than one entry waiting (${most} bytes)`);
  assert.ok(unzipOk(buf));
});

test('the PDF writer: pages, A4, text, Thai with an embedded font, letters it cannot show', () => {
  const blocks = [{ t: 'h1', text: 'Fern (Gale)' }, ...Array.from({ length: 120 }, (_, i) => ({ t: 'p', text: `Moment ${i}: a long paragraph about the sea. `.repeat(3) }))];
  const buf = pdf({ title: 'T', footer: 'F', blocks }), b = buf.toString('latin1'), text = pdfText(buf);
  assert.ok(b.startsWith('%PDF-1.4') && b.trimEnd().endsWith('%%EOF'));
  assert.ok((b.match(/\/Type \/Page\b/g) || []).length > 2 && /\/MediaBox \[0 0 595\.28 841\.89\]/.test(b));
  assert.ok(text.startsWith('Fern (Gale)\n') && /Page 1 of \d+/.test(text) && text.includes('Moment 119: a long paragraph'));
  assert.equal(lost(blocks), false);
  assert.equal(lost([{ t: 'p', text: 'ฉันชอบทะเล ที่นี่ น้ำ' }]), false, 'Thai is in the font');
  assert.equal(lost([{ t: 'p', text: 'I liked it 😀' }]), true);

  // Thai: a subset of Sarabun embedded (with its ToUnicode map), shaped, and broken between words.
  const thai = 'ฉันเรียนรู้การวางแผนและการทำงานร่วมกับผู้อื่นที่ชายหาด น้ำใจ ปั้น ญุ ';
  const tb = pdf({ title: 'เส้นทางของฉัน', footer: 'ฟ้า · 2026', blocks: [{ t: 'h1', text: 'เส้นทางของฉัน' }, { t: 'p', text: thai.repeat(8) }, { t: 'small', text: 'Emoji 😀 here' }] });
  const ts = tb.toString('latin1'), tt = pdfText(tb);
  assert.ok(/\/BaseFont \/[A-Z]{6}\+Sarabun-Regular/.test(ts) && /\/FontFile2 \d+ 0 R/.test(ts) && /\/CIDToGIDMap \/Identity/.test(ts) && !/Helvetica/.test(ts));
  assert.ok(tb.length < 120000, `a subset, not the whole font (${tb.length} bytes)`);
  const lines = tt.split('\n');
  assert.equal(lines[0], 'เส้นทางของฉัน'.normalize('NFKC'));
  const para = lines.slice(1, -3);
  assert.ok(para.length >= 4, 'wrapped over several lines');
  assert.equal(para.join('').replace(/ /g, ''), thai.repeat(8).normalize('NFKC').replace(/ /g, ''));
  const words = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(thai.repeat(8))].map((x) => x.segment.normalize('NFKC'));
  for (const l of para) assert.ok(words.some((w) => l.startsWith(w)) && words.some((w) => l.trimEnd().endsWith(w)), `each line starts and ends on a whole word: ${l}`);
  assert.ok(lines.includes('Emoji [?] here') && tt.includes('ฟ้า · 2026'));
  // Shaped by the font's own rules: a tone mark over a vowel is its high form, placed on the consonant, marks beside
  // ป move left (a narrow form), ญ loses its tail over a vowel below, ำ is split (and its circle joins a tone mark).
  const f = loadFont(new URL('../fonts/Sarabun-Regular.ttf', import.meta.url)), gid = (c) => f.cmap.get(c.codePointAt(0));
  const tone = (s) => shape(f, s).find((g) => g.u === '่');
  assert.ok(tone('ที่').g !== tone('ท่').g && tone('ที่').at && tone('ที่').x > 0);
  assert.notEqual(shape(f, 'ป้')[1].g, gid('้'));
  assert.notEqual(shape(f, 'ญุ')[0].g, gid('ญ'));
  assert.deepEqual(shape(f, 'กำ').map((g) => g.u), ['ก', 'ํ', 'า']);
  assert.equal(shape(f, 'ค่ำ').length, 3, 'tone mark and nikhahit as one glyph');
});

test('leaver archive: who is leaving, the ZIP, permissions, many at once, erasure on the day', async () => {
  const port = await freePort();
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-la-'));
  const srv = await start({ PORT: String(port), DATA_DIR: DIR, TP_MODE: 'pilot', TP_START: 'empty', LOG_REQUESTS: '0' });
  const U = `http://localhost:${port}`;
  const req = (method, url, body, cookie, headers = {}) => fetch(`${U}${url}`, { method, headers: { ...(Buffer.isBuffer(body) ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers }, body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined });
  const json = async (p) => { const r = await p; return { status: r.status, ...(await r.json().catch(() => ({}))), cookie: r.headers.get('set-cookie')?.split(';')[0] }; };
  const setup = (url, password) => json(req('POST', '/api/auth/setup', { token: url.split('/setup/')[1], password }));
  const act = (cookie, fn, args) => json(req('POST', '/api/action', { fn, args, rec: [] }, cookie));
  const zipOf = async (url, cookie) => { const r = await req('GET', url, null, cookie); return { status: r.status, headers: r.headers, buf: Buffer.from(await r.arrayBuffer()) }; };
  const logLines = () => fs.readdirSync(DIR).filter((f) => /^audit-.*\.jsonl$/.test(f)).flatMap((f) => fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n')).map((l) => JSON.parse(l));
  try {
    const ac = (await json(req('POST', '/api/auth/setup', { token: srv.setup, password: 'admin-pass-123', name: 'Pat Admin', email: 'pat@example.org' }))).cookie;
    const imp = await json(req('POST', '/api/admin/roster', { roster: ROSTER }, ac));
    const link = Object.fromEntries(imp.newAccounts.created.map((a) => [a.email, a.setupUrl]));
    const fern = (await setup(link['fern.gale@example.org'], 'fern-pass-123')).cookie;
    const gus = (await setup(link['gus.hale@example.org'], 'gus-pass-123')).cookie;
    const ben = (await setup(link['ben.carter@example.org'], 'ben-pass-123')).cookie;
    const ada = (await setup(link['ada.brook@example.org'], 'ada-pass-123')).cookie;

    // Fern's journey: a photo, a voice note, a private moment, a Thai reflection, a leaver portfolio.
    const up = async (name, type, body) => (await json(req('POST', '/api/upload', Buffer.from(body), fern, { 'content-type': type, 'x-filename': encodeURIComponent(name) })));
    const photo = await up('beach.png', 'image/png', 'PNGDATA'), voice = await up('voice-note.webm', 'audio/webm', 'VOICE'), doc = await up('essay.pdf', 'application/pdf', '%PDF-essay');
    assert.equal(photo.status, 201);
    assert.equal((await act(fern, 'completeOnboarding', ['S2001', ['science', 'service'], 'classic'])).status, 200);
    await act(fern, 'addStation', ['S2001', { title: 'FERN-BEACH-CLEANUP', lineIds: ['service'], date: '2026-03-02', visibility: 'school', summary: 'Forty volunteers.', reflection: 'ฉันเรียนรู้การวางแผน and planning', evidence: [{ kind: 'image', url: photo.url, caption: 'The beach' }, { kind: 'file', url: voice.url, caption: 'What I said', type: 'audio/webm' }] }]);
    await act(fern, 'addStation', ['S2001', { title: 'FERN-ESSAY', lineIds: ['science'], date: '2026-05-10', visibility: 'publishable', evidence: [{ kind: 'file', url: doc.url, caption: 'Essay' }] }]);
    await act(fern, 'addStation', ['S2001', { title: 'FERN-PRIVATE-NOTE', lineIds: ['science'], date: '2026-06-01', visibility: 'private' }]);
    const st = (await json(req('GET', '/api/state', null, fern))).snapshot.store;
    const essay = st.events.find((e) => e.title === 'FERN-ESSAY');
    assert.equal((await act(fern, 'saveLeaver', ['S2001', { profile: { statement: 'FERN-STATEMENT' }, moments: [{ eventId: essay.id }] }])).status, 200);

    // Hana is no longer in the class lists.
    await json(req('POST', '/api/admin/roster', { roster: { ...ROSTER, students: ROSTER.students.filter((s) => s.id !== 'S2003'), enrolments: ROSTER.enrolments.filter((e) => e.studentId !== 'S2003') } }, ac));
    const list = await json(req('GET', '/api/admin/leavers', null, ac));
    assert.deepEqual(list.students.map((s) => [s.id, s.why]), [['S2003', ['Not in the last class lists']], ['S2001', ['Year 13']]]);
    assert.ok(list.students.find((s) => s.id === 'S2001').leaverPortfolio && list.eraseDays === 90 && list.due.length === 0);

    // One archive.
    const one = await zipOf('/api/admin/students/S2001/archive', ac);
    assert.equal(one.status, 200);
    assert.match(one.headers.get('content-disposition'), /fern-gale-archive-\d{4}-\d{2}-\d{2}\.zip/);
    assert.ok(unzipOk(one.buf), 'unzip -t passes');
    const z = files(one.buf);
    for (const f of ['README.txt', 'my-journey.pdf', 'my-journey.html', 'leaver-portfolio.pdf', 'photos/beach.png', 'voice-notes/voice-note.webm', 'documents/essay.pdf', 'data/events.json', 'data/reflections.json', 'data/README.txt', 'data/manifest.json', 'data/student.json']) assert.ok(z[f], `has ${f}`);
    assert.ok(!Object.keys(z).some((n) => n.startsWith('data/files/')), 'files are not repeated in data/');
    assert.equal(z['photos/beach.png'].toString(), 'PNGDATA');
    const readme = z['README.txt'].toString();
    assert.ok(readme.includes('my-journey.pdf') && readme.includes('ในโฟลเดอร์นี้มีอะไรบ้าง') && !readme.includes('[?]') && readme.includes('leaver-portfolio.pdf'), 'Thai is in the PDF, so the README does not send them to the HTML for it');
    const jp = pdfText(z['my-journey.pdf']);
    assert.ok(jp.includes('ฉันเรียนรู้การวางแผน and planning'.normalize('NFKC')), 'the PDF has the Thai reflection');
    assert.ok(z['my-journey.pdf'].toString('latin1', 0, 5) === '%PDF-' && ['FERN-BEACH-CLEANUP', 'FERN-ESSAY', 'FERN-PRIVATE-NOTE', 'photos/beach.png', 'Service', 'Science'].every((t) => jp.includes(t)), 'the journey PDF has every moment (private too), by line, with where each file is');
    assert.ok(jp.indexOf('FERN-ESSAY') < jp.indexOf('FERN-PRIVATE-NOTE'), 'by date within a line');
    assert.ok(z['my-journey.html'].toString().includes('ฉันเรียนรู้การวางแผน and planning'), 'the HTML has the Thai reflection exactly');
    const lp = pdfText(z['leaver-portfolio.pdf']);
    assert.ok(lp.includes('FERN-STATEMENT') && lp.includes('FERN-ESSAY') && !lp.includes('FERN-PRIVATE-NOTE') && !lp.includes('FERN-BEACH'));
    assert.ok(JSON.parse(z['data/manifest.json']).uploads.some((u) => u.inArchive === 'photos/beach.png'));

    // Permissions.
    const self = await zipOf('/api/me/archive', fern);
    assert.equal(self.status, 200);
    assert.ok(files(self.buf)['my-journey.pdf']);
    assert.equal((await zipOf('/api/me/archive?student=S2002', fern)).status, 403, 'a student cannot download another student\'s');
    assert.equal((await zipOf('/api/admin/students/S2002/archive', fern)).status, 403);
    assert.equal((await zipOf('/api/me/archive', gus)).status, 200, 'any student may download their own, leaving or not');
    for (const c of [ben, ada]) {
      assert.equal((await zipOf('/api/me/archive', c)).status, 403, 'a teacher gets 403');
      assert.equal((await zipOf('/api/admin/students/S2001/archive', c)).status, 403);
      assert.equal((await zipOf('/api/admin/leavers/archive?ids=S2001', c)).status, 403);
      assert.equal((await json(req('GET', '/api/admin/leavers', null, c))).status, 403);
      assert.equal((await json(req('POST', '/api/admin/leavers/S2001/erasure', {}, c))).status, 403);
    }
    assert.equal((await zipOf('/api/me/archive')).status, 401);
    assert.equal((await zipOf('/api/me/archive?student=S2002', ac)).status, 200, 'an admin may use ?student');

    // Many at once, streamed.
    const many = await zipOf('/api/admin/leavers/archive?ids=S2001,S2002,S2003', ac);
    assert.equal(many.status, 200);
    assert.equal(many.headers.get('content-length'), null, 'streamed, not sized up front');
    assert.ok(unzipOk(many.buf));
    const m = files(many.buf);
    assert.deepEqual(Object.keys(m).sort(), ['README.txt', 'fern-gale-s2001.zip', 'gus-hale-s2002.zip', 'hana-ito-s2003.zip']);
    for (const k of Object.keys(m).filter((k) => k.endsWith('.zip'))) { assert.ok(unzipOk(m[k])); assert.ok(files(m[k])['my-journey.pdf']); }
    const all = files((await zipOf('/api/admin/leavers/archive?all=1', ac)).buf);
    assert.deepEqual(Object.keys(all).sort(), ['README.txt', 'fern-gale-s2001.zip', 'hana-ito-s2003.zip']);
    assert.equal((await zipOf('/api/admin/leavers/archive?ids=NOPE', ac)).status, 404);

    // Erasure: only after a download, due in 90 days, confirmed by an admin on the day.
    const gusFirst = await json(req('POST', '/api/admin/leavers/S2003/erasure', {}, ac));
    assert.equal(gusFirst.status, 200, 'Hana was downloaded in the combined ZIP');
    const due = gusFirst.students.find((s) => s.id === 'S2003').erasure.due;
    assert.equal(Math.round((Date.parse(due) - Date.parse(gusFirst.today)) / 864e5), 90);
    assert.equal(gusFirst.due.length, 0);
    assert.equal((await json(req('POST', '/api/admin/leavers/S2003/erase', { confirm: 'Hana Ito' }, ac))).status, 409, 'not before the day');
    const sch = await json(req('POST', '/api/admin/leavers/S2001/erasure', {}, ac));
    assert.equal(sch.status, 200);
    const cancel = await json(req('DELETE', '/api/admin/leavers/S2001/erasure', null, ac));
    assert.equal(cancel.students.find((s) => s.id === 'S2001').erasure, null);
    // The day comes (the file is the schedule; nothing ever erases by itself).
    const f = path.join(DIR, 'leaver-archive.json'); const state = JSON.parse(fs.readFileSync(f, 'utf8'));
    state.erasures.S2003.due = '2020-01-01'; fs.writeFileSync(f, JSON.stringify(state));
    const now = await json(req('GET', '/api/admin/leavers', null, ac));
    assert.deepEqual(now.due.map((s) => s.id), ['S2003']);
    assert.ok((await json(req('GET', '/api/state', null, ac))).snapshot.store.students.some((s) => s.id === 'S2003'), 'still there until an admin confirms');
    assert.equal((await json(req('POST', '/api/admin/leavers/S2003/erase', { confirm: 'Hana' }, ac))).status, 400);
    const er = await json(req('POST', '/api/admin/leavers/S2003/erase', { confirm: 'Hana Ito' }, ac));
    assert.equal(er.status, 200);
    assert.ok(er.erased.removed.students === 1 && !er.students.some((s) => s.id === 'S2003') && !er.due.length);
    assert.ok(!(await json(req('GET', '/api/state', null, ac))).snapshot.store.students.some((s) => s.id === 'S2003'));

    // Activity log.
    const L = logLines();
    const acts = (a) => L.filter((e) => e.action === a);
    assert.ok(acts('leaver-archive').some((e) => e.detail.how === 'self' && e.target.studentId === 'S2001' && e.actor.kind === 'student'));
    assert.equal(acts('leaver-archive').filter((e) => e.detail.combined === 3).length, 3, 'one line per student in a combined download');
    assert.ok(acts('erasure-schedule').length === 2 && acts('erasure-cancel').length === 1);
    assert.ok(acts('pdpa-erase').some((e) => e.detail.scheduled === '2020-01-01' && e.target.label === 'Erased student'));
    assert.ok(!JSON.stringify(L).includes('Hana Ito'), 'the erased student\'s name left the log');
  } finally { srv.p.kill(); }
});
