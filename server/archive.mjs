// Leaver archive: one ZIP per student to take with them at the end of school (routes/52-archive.mjs, docs/pilot-server.md).
// my-journey.pdf (every moment and reflection the student can see, by line and date; api.getStudentMap(sid, 'student')),
// my-journey.html (the same, every letter exactly), photos/ documents/ voice-notes/ (their files, by original name),
// data/ (the PDPA copy, routes/50-pdpa.mjs buildCopy, without its files), leaver-portfolio.pdf (api.leaverView, if
// they made one) and README.txt (English and Thai).
// Who is leaving: Year 13, and students the last class-list import or SIS sync no longer has (leavers()).
// DATA_DIR/leaver-archive.json { downloads: { sid: { at, by } }, erasures: { sid: { due, at, by, name } } }: outside the
// replayed record, admin only. An erasure is never automatic: an admin confirms each one on or after its day.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, writeAtomic } from './lib.mjs';
import { api } from './store.mjs';
import * as A from './auth.mjs';
import * as S from './sis.mjs';
import { buildCopy } from './routes/50-pdpa.mjs';
import { pdf, lost } from './pdf.mjs';

export const ERASE_DAYS = 90;
const FILE = path.join(DATA_DIR, 'leaver-archive.json');
export function loadState() { try { return { downloads: {}, erasures: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { return { downloads: {}, erasures: {} }; } }
export const saveState = (s) => writeAtomic(FILE, JSON.stringify(s, null, 1));
export const today = () => api.TODAY;
export const plusDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export const slug = (s) => String(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'student';
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || '') ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '');
const VIS = { private: 'Only me', advisor: 'Me and my advisor', school: 'School staff', publishable: 'Anyone with a link' };
const VERIFY = { 'school-verified': 'Checked by the school', 'teacher-endorsed': 'Endorsed by a teacher', 'student-added': 'Added by me' };
const TYPE = { goal: 'Goal', reflection: 'Reflection', project: 'Project', award: 'Award', course: 'Course', activity: 'Activity', service: 'Service' };

// ── Who is leaving ──
export function leavers() {
  const why = new Map();
  const mark = (id, w) => { if (!api.getStudent(id)) return; (why.get(id) || why.set(id, []).get(id)).includes(w) || why.get(id).push(w); };
  for (const s of api.getStudents()) if (s.grade === 12) mark(s.id, 'Year 13');
  for (const x of api.getStore().rosterImport?.summary?.missingFromFile?.students || []) mark(x.id, 'Not in the last class lists');
  const sis = S.load();
  for (const id of sis.gone || []) mark(id, 'Left in the SIS sync');
  const waiting = (sis.reports || []).find((r) => r.status === 'ready');
  for (const x of waiting?.leaving?.students?.items || []) mark(x.id, 'Leaving in the SIS sync (not applied yet)');
  return why;
}

export function leaverRows() {
  const st = loadState(), why = leavers();
  const acc = new Map(A.allAccounts().filter((a) => a.studentId).map((a) => [a.studentId, a]));
  return [...why].map(([id, w]) => {
    const s = api.getStudent(id);
    return { id, name: s.name, year: s.grade + 1, homeroom: s.homeroom || '', why: w, hasAccount: !!acc.get(id),
      moments: api.getStore().events.filter((e) => e.studentId === id).length, leaverPortfolio: !!api.leaverView(id),
      downloaded: st.downloads[id] || null, erasure: st.erasures[id] || null };
  }).sort((a, b) => a.year - b.year || a.homeroom.localeCompare(b.homeroom) || a.name.localeCompare(b.name));
}

// ── The journey: blocks for the PDF and the HTML ──
export function journeyBlocks(sid, fileRef = () => 'not in this archive') {
  const map = api.getStudentMap(sid, 'student');
  const s = map.student, adv = s.advisorId && api.getTeacher(s.advisorId);
  const events = map.events;
  const refl = events.reduce((n, e) => n + e.reflections.length, 0);
  const blocks = [
    { t: 'h1', text: `${s.name}: my journey` },
    { t: 'small', text: [`Year ${s.grade + 1}`, s.programme, s.homeroom && `Homeroom ${s.homeroom}`, adv && `Advisor ${adv.name}`].filter(Boolean).join(' · ') },
    { t: 'p', text: `Every moment and reflection on my NIST Transit Portfolio map, private ones too, by line and date. ${events.length} moment${events.length === 1 ? '' : 's'} and ${refl} reflection${refl === 1 ? '' : 's'} on ${map.lines.length} line${map.lines.length === 1 ? '' : 's'}. Made on ${longDate(today())}.` },
  ];
  const lineName = new Map(map.lines.map((l) => [l.id, l.name]));
  const placed = new Set();
  const moment = (e) => {
    const out = [{ t: 'h3', text: e.title || 'Untitled' }];
    out.push({ t: 'small', text: [longDate(e.date), TYPE[e.type] || (e.type ? e.type[0].toUpperCase() + e.type.slice(1) : ''), VERIFY[e.verification], `Seen by: ${VIS[e.visibility] || e.visibility}`, e.hidden && 'Hidden by a teacher'].filter(Boolean).join(' · ') });
    const also = (e.lineIds || []).map((id) => lineName.get(id)).filter(Boolean);
    if (also.length > 1) out.push({ t: 'small', text: `Lines: ${also.join(', ')}` });
    for (const x of [e.summary, e.about && e.about !== e.summary && e.about]) if (x) out.push({ t: 'p', text: x });
    for (const f of e.evidence || []) out.push({ t: 'small', text: `${f.kind === 'image' ? 'Photo' : /^audio\//.test(f.type || '') ? 'Voice note' : 'File'}: ${f.caption || f.name || 'Untitled'}${f.url && /\/api\/files\//.test(f.url) ? ` (in this archive: ${fileRef(f.url)})` : f.url && /^https?:/.test(f.url) ? ` (${f.url})` : ''}` });
    for (const n of e.endorsements || []) out.push({ t: 'quote', text: `Endorsed by ${n.teacher?.name || 'a teacher'}${n.date ? ` on ${longDate(n.date)}` : ''}${n.note ? `: ${n.note}` : ''}` });
    for (const r of e.reflections) {
      out.push({ t: 'small', text: `Reflection${r.date ? `, ${longDate(r.date)}` : ''} · Seen by: ${VIS[r.visibility || 'private']}${r.prompt && r.prompt !== 'Quick reflection' ? ` · ${r.prompt}` : ''}` });
      out.push({ t: 'quote', text: r.text || '' });
    }
    return out;
  };
  for (const l of map.lines) {
    const here = events.filter((e) => !placed.has(e.id) && (e.lineIds || []).includes(l.id));
    if (!here.length) continue;
    blocks.push({ t: 'h2', text: `${l.name}${l.status === 'ended' ? ' (ended)' : ''}`, colour: l.colour });
    for (const e of here) { placed.add(e.id); blocks.push(...moment(e)); }
  }
  const rest = events.filter((e) => !placed.has(e.id));
  if (rest.length) { blocks.push({ t: 'h2', text: 'Other moments' }); for (const e of rest) blocks.push(...moment(e)); }
  if (!events.length) blocks.push({ t: 'p', text: 'There are no moments on this map yet.' });
  return blocks;
}

export function leaverBlocks(sid) {
  const v = api.leaverView(sid); if (!v) return null;
  const blocks = [
    { t: 'h1', text: v.name },
    { t: 'small', text: [`Year ${v.year}`, v.programme, v.email, 'NIST International School, Bangkok'].filter(Boolean).join(' · ') },
  ];
  if (v.practice) blocks.push({ t: 'small', text: 'Practice version (Year 11).' });
  if (v.statement) blocks.push({ t: 'p', text: v.statement });
  if (v.moments.length) blocks.push({ t: 'h2', text: 'Moments' });
  for (const m of v.moments) {
    blocks.push({ t: 'h3', text: m.title }, { t: 'small', text: [longDate(m.date), m.lines.map((l) => l.name).join(', '), m.code && `Check code ${m.code}`].filter(Boolean).join(' · ') });
    if (m.summary) blocks.push({ t: 'p', text: m.summary });
    if (m.reflection) blocks.push({ t: 'quote', text: m.reflection.text });
    for (const f of m.evidence) blocks.push({ t: 'small', text: `${f.kind === 'image' ? 'Photo' : 'File'}: ${f.caption || 'Untitled'}` });
  }
  const skills = [...v.skills.lp, ...v.skills.atl];
  if (skills.length) blocks.push({ t: 'h2', text: 'Skills and qualities' }, { t: 'p', text: skills.map((x) => `${x.k} (${x.n})`).join(', ') });
  if (v.endorsements.length) blocks.push({ t: 'h2', text: 'What teachers said' });
  for (const n of v.endorsements) blocks.push({ t: 'quote', text: n.note || '' }, { t: 'small', text: [n.teacher, n.role, `on “${n.moment}”`, longDate(n.date)].filter(Boolean).join(' · ') });
  return blocks;
}

const escHtml = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function html(title, blocks) {
  const tag = { h1: 'h1', h2: 'h2', h3: 'h3', p: 'p', small: 'p class="s"', quote: 'blockquote' };
  const body = blocks.map((b) => { const t = tag[b.t] || 'p'; const close = t.split(' ')[0]; const style = b.t === 'h2' && b.colour ? ` style="border-left:6px solid ${escHtml(b.colour)};padding-left:10px"` : ''; return `<${t}${style}>${escHtml(b.text).replace(/\n/g, '<br>')}</${close}>`; }).join('\n');
  return `<!doctype html>\n<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(title)}</title>
<style>body{font:16px/1.55 Arial,"Noto Sans Thai",sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#1a1f29;background:#fff}h1{color:#002855;border-bottom:2px solid #002855;padding-bottom:6px}h2{color:#002855;margin-top:32px}h3{margin:20px 0 2px}.s{color:#56627a;font-size:13px;margin:2px 0}blockquote{margin:6px 0;padding-left:12px;border-left:2px solid #56627a}</style>
${body}\n</html>\n`;
}

// Stored upload name → the path it gets in the archive (photos/…, documents/…, voice-notes/…).
const folderOf = (type = '') => (/^image\//.test(type) ? 'photos' : /^audio\//.test(type) ? 'voice-notes' : 'documents');
const safeName = (n) => String(n || 'file').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 120) || 'file';

const README = (s, { pdfLost, leaver, counts, when }) => [
  `NIST Transit Portfolio: ${s.name}'s archive`,
  `Made on ${longDate(when.slice(0, 10))}. Everything here is yours to keep.`,
  '',
  'What is in this folder',
  '  my-journey.pdf        Your whole journey: every moment and reflection on your map, private ones too, by line and date.',
  pdfLost ? '                        Thai and English show as written; a few characters the PDF has no letters for (emoji, Chinese, for example) appear as [?]. my-journey.html has every one exactly.' : null,
  '  my-journey.html       The same journey as a web page. Open it in any browser; it works without the internet.',
  leaver ? '  leaver-portfolio.pdf  The leaver portfolio you made for universities, scholarships and employers.' : null,
  counts.photos ? `  photos/               Your photos (${counts.photos}).` : null,
  counts.documents ? `  documents/            Your documents and other files (${counts.documents}).` : null,
  counts['voice-notes'] ? `  voice-notes/          Your voice notes (${counts['voice-notes']}).` : null,
  '  data/                 A copy of everything the school holds about you, as .json files (plain text). data/README.txt explains each file.',
  '',
  'Your share links and leaver portfolio links stop working when your account is closed. Keep this archive somewhere safe.',
  'Questions, or something to correct: ask the pilot admin or the school\'s data protection officer.',
  '',
  '----',
  '',
  `NIST Transit Portfolio: ที่เก็บผลงานของ ${s.name}`,
  `จัดทำเมื่อ ${when.slice(0, 10)} ทุกอย่างในโฟลเดอร์นี้เป็นของคุณ เก็บไว้ได้ตลอด`,
  '',
  'ในโฟลเดอร์นี้มีอะไรบ้าง',
  '  my-journey.pdf        เส้นทางทั้งหมดของคุณ: ทุกช่วงเวลาและทุกบันทึกสะท้อนคิดบนแผนที่ของคุณ รวมถึงที่เป็นส่วนตัว เรียงตามสายและวันที่',
  pdfLost ? '                        ภาษาไทยและภาษาอังกฤษแสดงครบตามที่เขียน แต่อักขระบางตัวที่ PDF ไม่มี (เช่น อีโมจิ ภาษาจีน) จะเป็น [?] ไฟล์ my-journey.html มีครบทุกตัว' : null,
  '  my-journey.html       เส้นทางเดียวกันในรูปแบบหน้าเว็บ เปิดได้ด้วยเบราว์เซอร์ใดก็ได้ ไม่ต้องใช้อินเทอร์เน็ต',
  leaver ? '  leaver-portfolio.pdf  แฟ้มผลงานสำหรับผู้จบการศึกษาที่คุณทำไว้สำหรับมหาวิทยาลัย ทุนการศึกษา และนายจ้าง' : null,
  counts.photos ? `  photos/               รูปภาพของคุณ (${counts.photos})` : null,
  counts.documents ? `  documents/            เอกสารและไฟล์อื่น ๆ ของคุณ (${counts.documents})` : null,
  counts['voice-notes'] ? `  voice-notes/          บันทึกเสียงของคุณ (${counts['voice-notes']})` : null,
  '  data/                 สำเนาข้อมูลทั้งหมดที่โรงเรียนเก็บเกี่ยวกับคุณ เป็นไฟล์ .json (ข้อความธรรมดา) ไฟล์ data/README.txt อธิบายแต่ละไฟล์',
  '',
  'ลิงก์แชร์และลิงก์แฟ้มผลงานจะใช้ไม่ได้เมื่อปิดบัญชีของคุณ โปรดเก็บโฟลเดอร์นี้ไว้ในที่ปลอดภัย',
  'หากมีคำถามหรือต้องการแก้ไขข้อมูล ติดต่อผู้ดูแลระบบหรือเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลของโรงเรียน',
].filter((l) => l !== null).join('\r\n') + '\r\n';

// One student's archive: { student, entries: [{ name, data }] } or null.
export function buildArchive(sid) {
  const copy = buildCopy(sid); if (!copy) return null;
  const s = copy.student, when = new Date().toISOString();
  const manifest = JSON.parse(copy.entries.find((e) => e.name === 'manifest.json').data);
  const byStored = new Map(), used = new Set(), counts = {}, files = [];
  for (const u of manifest.uploads) {
    if (!u.file) continue;
    const folder = folderOf(u.type), base = safeName(u.name);
    let name = `${folder}/${base}`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${folder}/${base.replace(/(\.[^.]*)?$/, (x) => ` (${i})${x}`)}`;
    used.add(name.toLowerCase()); counts[folder] = (counts[folder] || 0) + 1;
    byStored.set(u.file.slice('files/'.length), name); u.inArchive = name;
    files.push({ name, data: copy.entries.find((e) => e.name === u.file).data });
  }
  const ref = (url) => byStored.get(url.split('/api/files/')[1]) || 'not in this archive';
  const journey = journeyBlocks(sid, ref), leaver = leaverBlocks(sid);
  const footer = `${s.name} · NIST Transit Portfolio · ${longDate(today())}`;
  const data = copy.entries.filter((e) => !e.name.startsWith('files/') && e.name !== 'manifest.json').map((e) => ({ name: `data/${e.name}`, data: e.data }));
  data.push({ name: 'data/manifest.json', data: JSON.stringify({ ...manifest, note: 'Each upload\'s inArchive is where it is in this archive (the data copy\'s files/ folder is not repeated).' }, null, 2) });
  const entries = [
    { name: 'README.txt', data: README(s, { pdfLost: lost(journey), leaver: !!leaver, counts, when }) },
    { name: 'my-journey.pdf', data: pdf({ title: `${s.name}: my journey`, footer, blocks: journey }) },
    { name: 'my-journey.html', data: html(`${s.name}: my journey`, journey) },
    ...(leaver ? [{ name: 'leaver-portfolio.pdf', data: pdf({ title: `${s.name} – Leaver portfolio`, footer, blocks: leaver }) }] : []),
    ...files, ...data,
  ];
  return { student: s, entries };
}
export const archiveName = (s) => `${slug(s.name)}-archive-${today()}.zip`;
