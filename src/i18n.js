import { createContext, useContext } from 'react';
import { fmtDate } from './format.js';

// N1: Thai for family-facing pages. English stays the default everywhere else.
// Students' own words (titles, summaries, reflections) are never machine-translated.
export const LangContext = createContext('en');
export const useLang = () => useContext(LangContext);

const TH = {
  // map
  Today: 'วันนี้', ended: 'จบแล้ว', 'branch of': 'แยกจาก', Year: 'Year', T: 'ภาค ',
  // station types
  Class: 'รายวิชา', Assessment: 'การประเมิน', Project: 'โครงงาน', Competition: 'การแข่งขัน', CAS: 'CAS', Club: 'ชมรม', Sport: 'กีฬา',
  Service: 'บริการสังคม', Award: 'รางวัล', Reflection: 'บทสะท้อนคิด', 'Planned goal': 'เป้าหมายที่วางแผนไว้', Interchange: 'จุดเชื่อม',
  // verification
  'School-verified': 'ยืนยันโดยโรงเรียน', 'Teacher-endorsed': 'ครูรับรองแล้ว', 'Student-added': 'นักเรียนเพิ่มเอง', Verify: 'ตรวจสอบ',
  'Imported directly from a school system.': 'นำเข้าจากระบบของโรงเรียนโดยตรง',
  'A teacher has reviewed and endorsed this.': 'ครูตรวจดูและรับรองรายการนี้แล้ว',
  'Added by the student; not yet endorsed.': 'นักเรียนเพิ่มเอง ยังไม่ได้รับการรับรองจากครู',
  'See the verification record': 'ดูบันทึกการยืนยัน',
  // station panel
  Evidence: 'หลักฐาน', skills: 'ทักษะ', Inquirer: 'ผู้ใฝ่รู้', Knowledgeable: 'ผู้มีความรู้', Thinker: 'นักคิด', Communicator: 'นักสื่อสาร', Principled: 'ผู้มีหลักการ', 'Open-minded': 'ผู้เปิดใจกว้าง', Caring: 'ผู้มีน้ำใจ', 'Risk-taker': 'ผู้กล้าเสี่ยง', Balanced: 'ผู้มีความสมดุล', Reflective: 'ผู้ไตร่ตรอง', Thinking: 'การคิด', Communication: 'การสื่อสาร', Social: 'สังคม', 'Self-management': 'การจัดการตนเอง', Research: 'การค้นคว้า', 'Merged with': 'รวมกับ', 'Teacher endorsement': 'คำรับรองจากครู', 'Signal:': 'คำถามชวนคิด:', Source: 'แหล่งที่มา', 'View record': 'ดูบันทึก',
  image: 'รูปภาพ', open: 'เปิด', link: 'ลิงก์', file: 'ไฟล์', grade: 'ผลการเรียน', certificate: 'เกียรติบัตร', Close: 'ปิด',
  Planned: 'วางแผนไว้', 'Requirement from ManageBac': 'ข้อกำหนดจาก ManageBac', 'Sponsor:': 'ครูที่ปรึกษาโครงการ:', Expectations: 'สิ่งที่คาดหวัง',
  'Invitation sent': 'ส่งคำเชิญแล้ว', Sponsoring: 'กำลังดูแล', Declined: 'ปฏิเสธ', 'Waiting for endorsement': 'รอการรับรอง', You: 'นักเรียน',
  // parent page
  'Parent conference': 'การประชุมผู้ปกครอง', with: 'กับ', 'This term': 'ภาคเรียนนี้', 'Nothing public this term yet.': 'ภาคเรียนนี้ยังไม่มีรายการที่เปิดเผย',
  'Questions you might ask': 'คำถามที่อาจลองชวนคุย',
  'Which line are you most proud of?': 'ลูกภูมิใจกับเส้นไหนมากที่สุด',
  'Is there a line you want to start, or stop?': 'มีเส้นไหนที่อยากเริ่มใหม่ หรืออยากหยุดไหม',
  'What would you like help with next term?': 'ภาคเรียนหน้าอยากให้ช่วยเรื่องอะไร',
  'Advisor’s agenda': 'หัวข้อที่ครูที่ปรึกษาจะคุย',
  'My map': 'แผนที่ของฉัน', 'Presentation studio': 'สตูดิโองานนำเสนอ', 'Shared view': 'มุมมองที่แบ่งปัน', Inbox: 'กล่องรับเข้า', 'Share links': 'ลิงก์ที่แบ่งปัน',
  Activity: 'กิจกรรม', Privacy: 'ความเป็นส่วนตัว', 'Advisory 4B': 'ห้องที่ปรึกษา 4B', Signals: 'สัญญาณ', Endorsements: 'การรับรอง', 'Cross-subject': 'ข้ามวิชา',
  'Class depot': 'คลังของชั้นเรียน', Applications: 'การสมัครเรียน', 'Reference letter': 'จดหมายรับรอง', 'Activities list': 'รายการกิจกรรม', 'Cohort search': 'ค้นหาในรุ่น',
  'CAS outcomes': 'ผลลัพธ์ CAS', 'One line': 'เส้นเดียว', 'DP core': 'แกนหลัก DP', Lines: 'เส้นทาง', Dashboard: 'แดชบอร์ด', 'Privacy & PDPA': 'ความเป็นส่วนตัวและ PDPA',
  Rollout: 'แผนการใช้งาน', 'School metro': 'แผนที่ทั้งโรงเรียน', 'Learner profile': 'คุณลักษณะผู้เรียน', 'Pilot options': 'ทางเลือกโครงการนำร่อง', 'Audit log': 'บันทึกการตรวจสอบ',
  'Scan-in': 'สแกนเข้าชม', 'Shared portfolio': 'แฟ้มผลงานที่แบ่งปัน', More: 'เพิ่มเติม', 'Viewing as': 'ดูในฐานะ', 'Pitch tour': 'ทัวร์นำเสนอ', 'Notifications for': 'การแจ้งเตือนสำหรับ',
  'Nothing yet. Things other people do with this record will show up here.': 'ยังไม่มี สิ่งที่ผู้อื่นทำกับบันทึกนี้จะแสดงที่นี่',
  Students: 'นักเรียน', Advisor: 'ครูที่ปรึกษา', 'Subject teacher': 'ครูประจำวิชา', Counsellor: 'ครูแนะแนว', Coordinator: 'ผู้ประสานงาน', Leadership: 'ผู้บริหาร', Family: 'ครอบครัว', 'External viewer': 'ผู้ชมภายนอก',
  'Family view': 'มุมมองครอบครัว', Consent: 'การให้ความยินยอม', 'Weekly digest': 'สรุปประจำสัปดาห์',
  // the header, for a signed-in family
  'Signed in': 'เข้าสู่ระบบแล้ว', 'Seeing as': 'กำลังดูในฐานะ', 'Display settings': 'การแสดงผล', Language: 'ภาษา', Theme: 'ธีม', Light: 'สว่าง', Dark: 'มืด',
  // voice (src/components/Voice.jsx)
  'Read questions aloud': 'อ่านคำถามออกเสียง', Off: 'ปิด', On: 'เปิด', 'Questions will be read out loud.': 'จะอ่านคำถามออกเสียงให้ฟัง',
  // polish: what a family still met in English (spotted moments, the evidence viewer, reporting a moment)
  'Spotted by': 'สังเกตเห็นโดย', 'a teacher': 'ครู', 'Added by the student': 'นักเรียนเพิ่มเอง', Uploaded: 'อัปโหลด', 'attached to': 'แนบกับ',
  'Linked page': 'หน้าเว็บที่ลิงก์ไว้', 'Gradebook extract': 'ข้อมูลจากสมุดคะแนน', Certificate: 'เกียรติบัตร', Document: 'เอกสาร',
  Report: 'รายงาน', 'Report this moment': 'รายงานรายการนี้', 'Reported. A teacher will look at it.': 'รายงานแล้ว ครูจะตรวจดู',
  'Thank you. A teacher will look at it.': 'ขอบคุณ ครูจะตรวจดู', 'What is wrong': 'มีอะไรไม่ถูกต้อง',
  'The school’s safeguarding staff will look at it. The student is not told who reported it.': 'เจ้าหน้าที่ดูแลความปลอดภัยของโรงเรียนจะตรวจดู นักเรียนจะไม่ทราบว่าใครเป็นผู้รายงาน',
  'Anything else? (optional)': 'มีอะไรเพิ่มเติมไหม (ไม่บังคับ)', Cancel: 'ยกเลิก', 'Send report': 'ส่งรายงาน', 'That did not work.': 'ไม่สำเร็จ โปรดลองอีกครั้ง',
  // readability and accessibility (src/components/DisplaySettings.jsx, src/App.jsx)
  'Text size': 'ขนาดตัวอักษร', Normal: 'ปกติ', Large: 'ใหญ่', Larger: 'ใหญ่ขึ้น', 'High contrast': 'คอนทราสต์สูง',
  'Easy-read font': 'ตัวอักษรอ่านง่าย', 'Reduce motion': 'ลดการเคลื่อนไหว', 'Like this device': 'ตามอุปกรณ์นี้', 'Skip to content': 'ข้ามไปยังเนื้อหา',
  'Inappropriate content': 'เนื้อหาไม่เหมาะสม', 'Personal information shown': 'แสดงข้อมูลส่วนตัว', 'Unkind or bullying': 'ไม่สุภาพหรือกลั่นแกล้ง', 'Something else': 'เรื่องอื่น ๆ',
};

// The bars at the foot of every screen (src/main.jsx renders them outside LangContext, so they pass getLang()):
// a refused change (src/components/Refused.jsx), a new version (UpdateBar), and the sign-out warning (src/auth.js).
const BAR = {
  en: {
    nowAs: (who) => `This browser is now signed in as ${who}, from another window.`, out: 'This browser was signed out in another window.',
    early: 'Reload before changing anything.', kept: 'Your changes wait on this device until you sign in again.', lost: 'Your last change was not saved.',
    refused: (why) => `That change was not saved: ${why}.`, why: 'the server did not accept it', reload: 'Reload', ok: 'OK',
    update: 'A new version is ready', signOut: (n) => `${n} change${n === 1 ? ' is' : 's are'} not sent yet. Sign out anyway?`,
  },
  th: {
    nowAs: (who) => `เบราว์เซอร์นี้เข้าสู่ระบบในชื่อ ${who} จากอีกหน้าต่างหนึ่งแล้ว`, out: 'เบราว์เซอร์นี้ออกจากระบบจากอีกหน้าต่างหนึ่งแล้ว',
    early: 'โปรดโหลดหน้าใหม่ก่อนแก้ไขสิ่งใด', kept: 'สิ่งที่คุณแก้ไขจะรออยู่ในเครื่องนี้จนกว่าคุณจะเข้าสู่ระบบอีกครั้ง', lost: 'การแก้ไขล่าสุดของคุณยังไม่ได้บันทึก',
    refused: (why) => `การแก้ไขนั้นยังไม่ได้บันทึก: ${why}`, why: 'เซิร์ฟเวอร์ไม่รับการแก้ไขนี้', reload: 'โหลดใหม่', ok: 'ตกลง',
    update: 'มีเวอร์ชันใหม่พร้อมใช้งานแล้ว', signOut: (n) => `ยังมี ${n} รายการที่ยังไม่ได้ส่ง ต้องการออกจากระบบหรือไม่`,
  },
};
export const barWords = (lang) => BAR[lang === 'th' ? 'th' : 'en'];

// Line names, translated part by part ("Science · Biology").
const LINE_TH = {
  Science: 'วิทยาศาสตร์', Computing: 'คอมพิวเตอร์', Environment: 'สิ่งแวดล้อม', Sport: 'กีฬา', Service: 'บริการสังคม', Music: 'ดนตรี',
  Design: 'การออกแบบ', Languages: 'ภาษา', Art: 'ศิลปะ', Biology: 'ชีววิทยา', Chemistry: 'เคมี', Physics: 'ฟิสิกส์',
  'Data Science': 'วิทยาการข้อมูล', Swimming: 'ว่ายน้ำ', 'Music Technology': 'เทคโนโลยีดนตรี', French: 'ภาษาฝรั่งเศส', Spanish: 'ภาษาสเปน',
  Thai: 'ภาษาไทย', Mandarin: 'ภาษาจีนกลาง', Football: 'ฟุตบอล', Basketball: 'บาสเกตบอล', Drama: 'การละคร', Robotics: 'หุ่นยนต์',
};

export const tr = (lang, s) => (lang === 'th' && TH[s]) || s;
// A school line's Thai, as a gloss beside its English name (src/thai.js), or null for a line of the student's own.
export const lineGloss = (name) => { const p = name.split(' · '); return p.every((x) => LINE_TH[x]) ? p.map((x) => LINE_TH[x]).join(' · ') : null; };
export const lineName = (lang, name) => (lang === 'th' ? name.split(' · ').map((p) => LINE_TH[p] || p).join(' · ') : name);
export const dateIn = (lang, d) => (lang === 'th' ? new Date(`${d}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate(d));
export const termText = (lang, s) => (lang === 'th' ? s.replace(/, Term (\d)/, ' ภาคเรียนที่ $1') : s);
export const daysIn = (lang, days) => (lang === 'th' ? (days >= 0 ? `อีก ${days} วัน` : `เมื่อ ${-days} วันก่อน`) : days >= 0 ? `in ${days} days` : `${-days} days ago`);
export function useT() {
  const lang = useLang();
  return (s) => tr(lang, s);
}

// ── Per person: the language chosen before signing in (sign-in page, family letter link), remembered on this device.
// Not a `tp-` key, so signing out keeps it: it says nothing about anyone.
const LANG_KEY = 'transit-lang';
export function savedLang() { try { const l = localStorage.getItem(LANG_KEY); return l === 'th' || l === 'en' ? l : null; } catch { return null; } }
export function saveLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked */ } }

// Notifications are stored in English; the ones a family gets are rendered in Thai from their known templates.
// Names and quoted titles (people's own words) stay as they are.
const NOTE_TH = [
  [/^(.+) asked you to look at a consent request$/, (m) => `${m[1]} ขอให้คุณดูคำขอความยินยอม`],
  [/^(.+)’s family answered a consent request$/, (m) => `ครอบครัวของ ${m[1]} ตอบคำขอความยินยอมแล้ว`],
  [/^Your parent said yes: (.+)$/, (m) => `ผู้ปกครองของคุณยินยอมแล้ว: ${m[1]}`],
  [/^Your parent said no for now: (.+)$/, (m) => `ผู้ปกครองของคุณยังไม่ยินยอม: ${m[1]}`],
];
export function noteText(lang, text) {
  if (lang !== 'th' || typeof text !== 'string') return text;
  for (const [re, f] of NOTE_TH) { const m = text.match(re); if (m) return f(m); }
  return text;
}
export function agoIn(lang, iso, now = Date.now()) {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (lang !== 'th') return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  return m < 1 ? 'เมื่อสักครู่' : m < 60 ? `${m} นาทีที่แล้ว` : m < 1440 ? `${Math.round(m / 60)} ชั่วโมงที่แล้ว` : `${Math.round(m / 1440)} วันที่แล้ว`;
}

// The server's answers on the sign-in and family letter pages, in Thai.
const ERR_TH = {
  'That email and password do not match.': 'อีเมลและรหัสผ่านไม่ตรงกัน',
  'Too many tries. Wait 15 minutes or ask your teacher.': 'ลองหลายครั้งเกินไป โปรดรอ 15 นาที หรือติดต่อโรงเรียน',
  'Too many tries. Wait a few minutes.': 'ลองหลายครั้งเกินไป โปรดรอสักครู่',
  'Something went wrong. Try again.': 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง',
  'Your account is paused. Ask your teacher.': 'บัญชีของคุณถูกระงับชั่วคราว โปรดติดต่อโรงเรียน',
  'Use at least 8 characters.': 'ใช้อย่างน้อย 8 ตัวอักษร',
  'That password is too long.': 'รหัสผ่านยาวเกินไป',
  'The two passwords are not the same.': 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
  'The two new passwords are not the same.': 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน',
  'Your current password is not right.': 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
  'Password changed. Other devices are signed out.': 'เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นออกจากระบบแล้ว',
  'Add your name.': 'โปรดกรอกชื่อของคุณ',
  'Add a valid email address.': 'โปรดกรอกอีเมลให้ถูกต้อง',
  'Sign in first.': 'โปรดเข้าสู่ระบบก่อน',
  'This setup link has expired or was already used. Ask an admin for a new one.': 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว โปรดขอลิงก์ใหม่จากผู้ดูแลระบบ',
  'This letter has already been used by two family members. Ask your child’s advisor for a new one.': 'จดหมายฉบับนี้ถูกใช้โดยสมาชิกครอบครัวครบสองคนแล้ว โปรดขอฉบับใหม่จากครูที่ปรึกษาของบุตรหลาน',
  'This letter’s link has expired or was replaced by a newer letter. Ask your child’s advisor for a new one.': 'ลิงก์ในจดหมายนี้หมดอายุ หรือมีจดหมายฉบับใหม่มาแทนแล้ว โปรดขอฉบับใหม่จากครูที่ปรึกษาของบุตรหลาน',
  'This student’s account is paused. Ask the school.': 'บัญชีของนักเรียนคนนี้ถูกระงับชั่วคราว โปรดติดต่อโรงเรียน',
  'There is already a school account with that email. Use another email for your family account.': 'อีเมลนี้เป็นบัญชีของโรงเรียนอยู่แล้ว โปรดใช้อีเมลอื่นสำหรับบัญชีครอบครัว',
  'There is already a family account with that email, and that is not its password. Sign in first, then open the link again.': 'มีบัญชีครอบครัวที่ใช้อีเมลนี้อยู่แล้ว แต่รหัสผ่านไม่ถูกต้อง โปรดเข้าสู่ระบบก่อน แล้วเปิดลิงก์อีกครั้ง',
  'You are signed in with a school account. Sign out first, then open the link again.': 'คุณเข้าสู่ระบบด้วยบัญชีของโรงเรียนอยู่ โปรดออกจากระบบก่อน แล้วเปิดลิงก์อีกครั้ง',
  // why a change was refused (src/components/Refused.jsx)
  'Not allowed for your account': 'บัญชีของคุณทำสิ่งนี้ไม่ได้',
  'this browser is signed in as someone else': 'เบราว์เซอร์นี้เข้าสู่ระบบในชื่อของคนอื่นอยู่',
  'a photo could not be uploaded': 'อัปโหลดรูปภาพไม่สำเร็จ',
};
export const errText = (lang, msg) => (lang === 'th' && ERR_TH[msg]) || msg;

// Consent requests written from the school's templates (the seeds in src/api.js), in Thai. Other wording stays as written.
const CONSENT = {
  join: { en: (f) => [`${f}’s record in Transit Portfolio`, `Keep ${f}’s school activities in one record. ${f}, her advisor and you can see it; nothing leaves the school.`], th: (f) => [`บันทึกของ ${f} ใน Transit Portfolio`, `เก็บกิจกรรมที่โรงเรียนของ ${f} ไว้ในบันทึกเดียว ${f} ครูที่ปรึกษา และคุณเห็นได้ ไม่มีข้อมูลใดออกนอกโรงเรียน`] },
  share: { en: (f) => ['Share links outside the school', `Let ${f} make share links, for example for a summer camp application. Every link expires, and each one appears in your weekly digest.`], th: (f) => ['ลิงก์แบ่งปันนอกโรงเรียน', `อนุญาตให้ ${f} สร้างลิงก์แบ่งปัน เช่น สำหรับสมัครค่ายภาคฤดูร้อน ทุกลิงก์มีวันหมดอายุ และจะแสดงในสรุปประจำสัปดาห์ของคุณ`] },
  photos: { en: (f) => [`Photos where ${f} can be recognised`, `Allow photos of ${f} to appear as evidence on her stations. Off unless you say yes.`], th: (f) => [`รูปถ่ายที่เห็นหน้า ${f} ได้ชัดเจน`, `อนุญาตให้ใช้รูปถ่ายของ ${f} เป็นหลักฐานในรายการต่าง ๆ บนแผนที่ จะไม่แสดงจนกว่าคุณจะยินยอม`] },
};
// → [title, detail, lang of the text]
export function consentText(lang, r, first) {
  const c = CONSENT[r.kind];
  if (lang !== 'th' || !c) return [r.title, r.detail, 'en'];
  const [t, d] = c.en(first);
  if (r.title !== t || r.detail !== d) return [r.title, r.detail, 'en'];
  return [...c.th(first), 'th'];
}

// ── Conference booking, as a family reads it (src/components/ConferenceBooking.jsx). Times are Bangkok time. ──
const CONF = {
  en: {
    head: 'Book a conference', intro: 'Pick one time for each child with their advisor. You can change or cancel until 24 hours before.',
    tz: 'All times are Bangkok time.', with: (a) => `with ${a}`, online: 'Online', join: 'Join link', mins: (n) => `${n} minutes`,
    pick: (f) => `Pick a time for ${f}`, booked: 'Booked', change: 'Change time', cancel: 'Cancel booking', keep: 'Keep this time',
    sure: 'Cancel this booking?', yes: 'Yes, cancel', locked: 'Less than 24 hours to go. To change it, contact the advisor.',
    taken: 'Taken', clash: (f) => `${f}’s time`, soon: 'Too soon', book: (t) => `Book ${t}`, none: 'No times are free. Contact the advisor.',
    saved: (f, w) => `Booked ${f}’s conference: ${w}`, gone: (f) => `${f}’s booking is cancelled`, by: (a) => `Booked by ${a}`,
    at: (d, t) => `${d}, ${t}`, times: (f, d) => `Times for ${f} on ${d}`,
  },
  th: {
    head: 'จองเวลาประชุมผู้ปกครอง', intro: 'เลือกเวลาหนึ่งช่วงสำหรับบุตรหลานแต่ละคนกับครูที่ปรึกษา เปลี่ยนหรือยกเลิกได้จนถึง 24 ชั่วโมงก่อนเวลานัด',
    tz: 'เวลาทั้งหมดเป็นเวลาประเทศไทย', with: (a) => `กับ ${a}`, online: 'ออนไลน์', join: 'ลิงก์เข้าร่วม', mins: (n) => `${n} นาที`,
    pick: (f) => `เลือกเวลาสำหรับ ${f}`, booked: 'จองแล้ว', change: 'เปลี่ยนเวลา', cancel: 'ยกเลิกการจอง', keep: 'ใช้เวลาเดิม',
    sure: 'ต้องการยกเลิกการจองนี้หรือไม่', yes: 'ยืนยันการยกเลิก', locked: 'เหลือเวลาน้อยกว่า 24 ชั่วโมง หากต้องการเปลี่ยน โปรดติดต่อครูที่ปรึกษา',
    taken: 'ไม่ว่าง', clash: (f) => `ตรงกับเวลาของ ${f}`, soon: 'กระชั้นเกินไป', book: (t) => `จอง ${t} น.`, none: 'ไม่มีเวลาว่าง โปรดติดต่อครูที่ปรึกษา',
    saved: (f, w) => `จองเวลาประชุมของ ${f} แล้ว: ${w}`, gone: (f) => `ยกเลิกการจองของ ${f} แล้ว`, by: (a) => `จองโดย ${a}`,
    at: (d, t) => `${d} เวลา ${t} น.`, times: (f, d) => `เวลาสำหรับ ${f} วัน${d}`,
  },
};
export const confWords = (lang) => CONF[lang === 'th' ? 'th' : 'en'];
// "Tue 3 Nov" / "อ. 3 พ.ย." for a conference day (Bangkok dates).
export const confDay = (lang, d) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
export const confSlotText = (lang, d, t) => confWords(lang).at(confDay(lang, d), t);
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const thWhen = (d, mon, y, t) => `${dateIn('th', `${y}-${String(MON_EN.indexOf(mon) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)} เวลา ${t} น.`;
const WHEN = '(\\d{1,2}) (\\w{3}) (\\d{4}) at (\\d{2}:\\d{2})';
NOTE_TH.push(
  [/^(.+) opened conference booking: “(.+)”\. Pick a time for (.+)$/, (m) => `${m[1]} เปิดให้จองเวลาประชุมผู้ปกครอง: “${m[2]}” เลือกเวลาสำหรับ ${m[3]}`],
  [new RegExp(`^(.+) booked (.+)’s conference: ${WHEN}$`), (m) => `${m[1]} จองเวลาประชุมของ ${m[2]} แล้ว: ${thWhen(m[3], m[4], m[5], m[6])}`],
  [new RegExp(`^(.+) cancelled (.+)’s conference on ${WHEN}$`), (m) => `${m[1]} ยกเลิกการประชุมของ ${m[2]} ${thWhen(m[3], m[4], m[5], m[6])}`],
  [new RegExp(`^Reminder: (.+)’s conference with (.+) is tomorrow, ${WHEN} · (.+)$`), (m) => `เตือนความจำ: พรุ่งนี้ ${m[1]} มีนัดประชุมกับ ${m[2]} ${thWhen(m[3], m[4], m[5], m[6])} · ${m[7] === 'online' ? 'ออนไลน์' : m[7]}`],
);
Object.assign(ERR_TH, {
  'That time was just taken. Pick another': 'มีผู้จองเวลานี้ไปแล้ว โปรดเลือกเวลาอื่น',
  'Pick a time at least 24 hours ahead': 'โปรดเลือกเวลาที่ห่างจากตอนนี้อย่างน้อย 24 ชั่วโมง',
  'Less than 24 hours to go: ask the advisor to change it': 'เหลือเวลาน้อยกว่า 24 ชั่วโมง โปรดติดต่อครูที่ปรึกษาเพื่อเปลี่ยนเวลา',
  'That time has passed': 'เลยเวลานี้ไปแล้ว',
  'Booking for this conference is closed': 'ปิดการจองแล้ว',
});

// ── Thai for students (src/thai.js): what a student reads at Simple, Standard and Full, shown in Thai at display time.
// Plain, friendly Thai for 11–13 year olds. Keys are the English exactly as the screens write it. Students' and
// teachers' own words, line names and proper names are never here. Years stay Gregorian unless the student picks พ.ศ.
const MON_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DAY_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], DAY_TH_FULL = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
// พ.ศ. years: a choice on this device (the display menu, in Thai only). Gregorian otherwise.
const BE_KEY = 'tp-thai-be';
export const thaiBE = () => { try { return localStorage.getItem(BE_KEY) === '1'; } catch { return false; } };
export const setThaiBE = (on) => { try { localStorage.setItem(BE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ } };
const yearTh = (y) => String(Number(y) + (thaiBE() ? 543 : 0));
const mon = (m) => (MON_EN.includes(m) ? MON_TH[MON_EN.indexOf(m)] : MON_TH_FULL[MON_FULL.indexOf(m)]);
const MON_RE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)';
const DAY_RE = '(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)';
const dayTh = (d) => (DAY_EN.includes(d) ? DAY_TH[DAY_EN.indexOf(d)] : DAY_TH_FULL[DAY_FULL.indexOf(d)]);
// "12 Oct 2026" → "12 ต.ค. 2026", also without the day or the year, with a weekday, and inside a longer sentence.
export function thaiDates(s) {
  return s
    .replace(new RegExp(`\\b${DAY_RE},? (\\d{1,2}) ${MON_RE}(?: (\\d{4}))?\\b`, 'g'), (_, w, d, m, y) => `${dayTh(w)} ${d} ${mon(m)}${y ? ` ${yearTh(y)}` : ''}`)
    .replace(new RegExp(`\\b(\\d{1,2}) ${MON_RE}(?: (\\d{4}))?\\b`, 'g'), (_, d, m, y) => `${d} ${mon(m)}${y ? ` ${yearTh(y)}` : ''}`)
    .replace(new RegExp(`\\b${MON_RE} (\\d{4})\\b`, 'g'), (_, m, y) => `${mon(m)} ${yearTh(y)}`);
}

const STU = {
  // the header, navigation and display menu (src/App.jsx)
  'My journey': 'เส้นทางของฉัน', 'Show my family': 'ให้ครอบครัวดู', 'Leaver portfolio': 'แฟ้มผลงานก่อนจบ', 'Presentation studio': 'สตูดิโองานนำเสนอ', 'Shared view': 'มุมมองที่แบ่งปัน',
  'Share links': 'ลิงก์แบ่งปัน', Inbox: 'กล่องรับเข้า', Activity: 'ประวัติการใช้งาน', Privacy: 'ความเป็นส่วนตัว', 'My map': 'แผนที่ของฉัน', 'Map poster': 'โปสเตอร์แผนที่',
  'NIST Transit Portfolio home': 'หน้าแรก NIST Transit Portfolio', 'NIST International School': 'โรงเรียนนานาชาติ NIST', Screens: 'หน้าจอ', Notifications: 'การแจ้งเตือน',
  'Jump to anything (Ctrl+K)': 'ไปที่ใดก็ได้ (Ctrl+K)', 'Jump to anything (/ or Ctrl+K)': 'ไปที่ใดก็ได้ (/ หรือ Ctrl+K)', 'Display settings': 'การแสดงผล',
  'How much to show': 'แสดงมากแค่ไหน', Simple: 'แบบง่าย', Standard: 'แบบมาตรฐาน', Full: 'แบบเต็ม', 'Interface': 'หน้าตาแอป',
  'Your map, add a moment, answer a question, share a page': 'แผนที่ของคุณ เพิ่มเรื่องราว ตอบคำถาม และแบ่งปันหน้า',
  'Adds the inbox, lines and branches, the builder and audiences': 'เพิ่มกล่องรับเข้า สายและสายย่อย ตัวสร้างหน้า และผู้ชมแต่ละกลุ่ม',
  'Everything: code, time travel, search, comparisons and settings': 'ทุกอย่าง: โค้ด ย้อนดูตามเวลา ค้นหา เปรียบเทียบ และการตั้งค่า',
  'Something not working? Tell us': 'มีอะไรใช้ไม่ได้ไหม บอกเราได้เลย', 'Signed in': 'เข้าสู่ระบบแล้ว', 'Years as พ.ศ.': 'ปีแบบ พ.ศ.', Undo: 'เลิกทำ', 'Undoing…': 'กำลังเลิกทำ…', Undone: 'เลิกทำแล้ว',
  'Your map is ready.': 'แผนที่ของคุณพร้อมแล้ว', 'Put Transit on your home screen': 'เพิ่ม Transit ไว้บนหน้าจอหลัก', 'Add the app to your home screen': 'เพิ่มแอปไว้บนหน้าจอหลัก',
  'Open your browser menu': 'เปิดเมนูของเบราว์เซอร์', 'and choose': 'แล้วเลือก', 'Install app': 'ติดตั้งแอป', or: 'หรือ', 'Add to Home screen': 'เพิ่มไปยังหน้าจอหลัก', 'Not now': 'ไว้ทีหลัง',
  // onboarding (src/screens/Onboarding.jsx)
  'Welcome,': 'ยินดีต้อนรับ', 'What do you enjoy?': 'คุณชอบทำอะไร', 'Pick two to four. Each one becomes a line on your map. You can add or stop lines any time.': 'เลือก 2 ถึง 4 อย่าง แต่ละอย่างจะเป็นสายหนึ่งบนแผนที่ของคุณ เพิ่มหรือหยุดสายได้ทุกเมื่อ',
  Experiments: 'การทดลอง', 'Coding and games': 'เขียนโค้ดและเกม', 'Nature and animals': 'ธรรมชาติและสัตว์', 'Helping people': 'ช่วยเหลือผู้อื่น', 'Making things': 'ประดิษฐ์ของ', 'Art and drawing': 'ศิลปะและการวาดรูป',
  Music: 'ดนตรี', Languages: 'ภาษา', line: '', Next: 'ถัดไป', Back: 'ย้อนกลับ', 'Your starter lines': 'สายแรกของคุณ', 'This is your map': 'นี่คือแผนที่ของคุณ',
  'It starts in Year 7 and grows until you graduate. Every time you do something, a station appears on a line.': 'แผนที่เริ่มตั้งแต่ Year 7 และเติบโตไปจนคุณเรียนจบ ทุกครั้งที่คุณทำอะไรสักอย่าง จะมีสถานีใหม่ขึ้นบนสาย',
  'Starter lines': 'สายแรกเริ่ม', 'Your first stations': 'สถานีแรกของคุณ', 'You have already started': 'คุณเริ่มต้นไปแล้ว',
  "The school's systems know a few things you did this term. They arrive on your lines by themselves, already verified.": 'ระบบของโรงเรียนรู้จักบางอย่างที่คุณทำในภาคเรียนนี้แล้ว สิ่งเหล่านั้นจะขึ้นบนสายของคุณเองและได้รับการยืนยันแล้ว',
  from: 'จาก', '✓ verified': '✓ ยืนยันแล้ว', 'How it looks to others': 'คนอื่นจะเห็นแบบไหน', 'Pick a simple look': 'เลือกหน้าตาง่าย ๆ',
  'When you want to show your map to family, it uses this. Everything stays inside the school until a parent says yes.': 'เมื่อคุณอยากให้ครอบครัวดูแผนที่ จะใช้แบบนี้ ทุกอย่างอยู่ภายในโรงเรียนจนกว่าผู้ปกครองจะยินยอม',
  'Go to my map': 'ไปที่แผนที่ของฉัน', Postcard: 'โปสการ์ด', 'One photo and a sentence per line. Good for family.': 'หนึ่งรูปกับหนึ่งประโยคต่อสาย เหมาะสำหรับครอบครัว',
  Scrapbook: 'สมุดภาพ', 'Photos first, a few words under each.': 'รูปภาพมาก่อน มีคำอธิบายสั้น ๆ ใต้แต่ละรูป', Poster: 'โปสเตอร์', 'Big title, your lines as colourful bands.': 'หัวเรื่องใหญ่ สายของคุณเป็นแถบสีสดใส',
  // Simple home (src/screens/SimpleHome.jsx)
  Hi: 'สวัสดี', 'What have you been up to?': 'ช่วงนี้ทำอะไรมาบ้าง', 'Your journey starts here.': 'เส้นทางของคุณเริ่มที่นี่',
  'Add something I did': 'เพิ่มสิ่งที่ฉันทำ', 'A club, a project, a match, anything': 'ชมรม โครงงาน การแข่งขัน หรืออะไรก็ได้', 'Something I want to do': 'สิ่งที่ฉันอยากทำ',
  'Plan it, and tick it off when it happens': 'วางแผนไว้ แล้วติ๊กเมื่อทำได้แล้ว', 'Answer a question': 'ตอบคำถาม', 'Your advisor asked you something': 'ครูที่ปรึกษาถามคุณ',
  'My journey map': 'แผนที่เส้นทางของฉัน', 'Coming up': 'สิ่งที่กำลังจะมา', 'My moments': 'เรื่องราวของฉัน', 'Your colours appear here once you pick what you are into.': 'สีของคุณจะขึ้นที่นี่ เมื่อคุณเลือกสิ่งที่ชอบแล้ว',
  'Add your first': 'เพิ่มเรื่องราว', moment: 'เรื่องแรกของคุณ', 'From school': 'จากโรงเรียน', 'Checked by a teacher': 'ครูตรวจแล้ว', 'Added by me': 'ฉันเพิ่มเอง',
  'I learned that…': 'ฉันได้เรียนรู้ว่า…', 'I was proud when…': 'ฉันภูมิใจตอนที่…', 'It was hard when…': 'มันยากตอนที่…', 'Next time I will…': 'ครั้งหน้าฉันจะ…',
  'Nice one!': 'เยี่ยมเลย!', 'Great work!': 'เก่งมาก!', 'Added!': 'เพิ่มแล้ว!', Drawing: 'ภาพวาด', Event: 'กิจกรรม', Art: 'ศิลปะ', Club: 'ชมรม',
  'What are you looking forward to next?': 'ต่อไปคุณตั้งตารออะไรอยู่', 'Saved. Your advisor can read it.': 'บันทึกแล้ว ครูที่ปรึกษาอ่านได้',
  'Remove voice note': 'ลบข้อความเสียง', 'Take a photo': 'ถ่ายรูป', 'Of something you did, made or took part in. Then say what it was.': 'ถ่ายสิ่งที่คุณทำ สร้าง หรือได้ร่วม แล้วบอกว่ามันคืออะไร',
  'Open the camera': 'เปิดกล้อง', 'Choose a photo': 'เลือกรูป', 'No photo, just write it': 'ไม่มีรูป ขอเขียนอย่างเดียว', 'What did you do?': 'คุณทำอะไร',
  'e.g. Joined the robotics club': 'เช่น เข้าชมรมหุ่นยนต์', 'Add a photo if you have one': 'ถ้ามีรูปก็เพิ่มได้เลย', 'Wait for the photo…': 'รอรูปสักครู่…',
  'Which colour does it go with?': 'เรื่องนี้เข้ากับสีไหน', 'What did you learn?': 'คุณได้เรียนรู้อะไร', 'One or two sentences is plenty. You can skip this.': 'หนึ่งหรือสองประโยคก็พอแล้ว จะข้ามก็ได้',
  'Help me with questions': 'ช่วยด้วยคำถามหน่อย', 'Only you and your advisor can see it at first.': 'ตอนแรกมีแค่คุณกับครูที่ปรึกษาที่เห็น', 'Skip': 'ข้าม', 'Add it': 'เพิ่มเลย',
  'Skip and add it': 'ข้ามแล้วเพิ่มเลย', 'Next question': 'คำถามถัดไป', 'Skip this one': 'ข้ามข้อนี้', 'That is enough, carry on': 'พอแล้ว ไปต่อ', 'Skip the questions': 'ข้ามคำถาม',
  'Ways to start': 'ลองเริ่มแบบนี้', 'Ask a teacher to check it?': 'ขอให้ครูตรวจไหม', 'A teacher can say it really happened. You can skip this.': 'ครูยืนยันได้ว่าเรื่องนี้เกิดขึ้นจริง จะข้ามก็ได้',
  Ask: 'ขอ', 'Someone else': 'คนอื่น', 'Other teachers': 'ครูคนอื่น', 'Not now, just add it': 'ไว้ทีหลัง เพิ่มเลย', 'Only you, your advisor and the teacher you ask can see it at first.': 'ตอนแรกมีแค่คุณ ครูที่ปรึกษา และครูที่คุณขอเท่านั้นที่เห็น',
  'Your photo': 'รูปของคุณ', 'Remove photo': 'ลบรูป', 'Uploading your photo…': 'กำลังอัปโหลดรูป…', 'Take or choose a photo': 'ถ่ายหรือเลือกรูป', 'Use the camera': 'ใช้กล้อง',
  'Something I want to do ': 'สิ่งที่ฉันอยากทำ', 'What do you want to do?': 'คุณอยากทำอะไร', 'e.g. Enter the science fair': 'เช่น ส่งงานประกวดวิทยาศาสตร์', 'Some ideas': 'ไอเดียบางส่วน',
  'Enter the science fair': 'ส่งงานประกวดวิทยาศาสตร์', 'Grow a plant from seed and track it': 'ปลูกต้นไม้จากเมล็ดแล้วจดบันทึกการเติบโต', 'Play a song at the concert': 'เล่นเพลงในคอนเสิร์ต',
  'Learn a new piece on my instrument': 'ฝึกเพลงใหม่กับเครื่องดนตรีของฉัน', 'Get a part in the school play': 'ได้บทในละครของโรงเรียน', 'Help backstage at a show': 'ช่วยงานหลังเวทีในการแสดง',
  'Finish a sketchbook': 'วาดสมุดสเก็ตช์ให้เต็มเล่ม', 'Put a piece in the art show': 'ส่งผลงานเข้านิทรรศการศิลปะ', 'Make a school team': 'ติดทีมของโรงเรียน', 'Run 5 km without stopping': 'วิ่ง 5 กม. โดยไม่หยุด',
  'Build a robot that moves on its own': 'สร้างหุ่นยนต์ที่เคลื่อนที่ได้เอง', 'Make a simple game': 'ทำเกมง่าย ๆ', 'Read five books this term': 'อ่านหนังสือให้ได้ห้าเล่มในภาคเรียนนี้',
  'Write a story for the school magazine': 'เขียนเรื่องลงนิตยสารของโรงเรียน', 'Take part in a maths competition': 'ร่วมแข่งขันคณิตศาสตร์', 'Learn my times tables up to 15': 'ท่องสูตรคูณให้ได้ถึงแม่ 15',
  'Help at a beach clean-up': 'ช่วยเก็บขยะชายหาด', 'Start a recycling bin in our classroom': 'ตั้งถังรีไซเคิลในห้องเรียน', 'Join a new club': 'เข้าชมรมใหม่', 'Try something I have never done': 'ลองทำสิ่งที่ไม่เคยทำ',
  'When do you want to do it by?': 'อยากทำให้ได้ภายในเมื่อไร', 'In a few weeks': 'อีกไม่กี่สัปดาห์', 'By the end of this term': 'ภายในสิ้นภาคเรียนนี้', 'This year': 'ภายในปีนี้',
  'Pick a date': 'เลือกวันที่', 'On a calendar': 'จากปฏิทิน', 'Want a teacher to help you with it?': 'อยากให้ครูช่วยไหม', 'They can give you tips along the way, and say it really happened when you do it.': 'ครูให้คำแนะนำระหว่างทางได้ และยืนยันได้ว่าคุณทำสำเร็จจริง',
  'Your advisor can see it too.': 'ครูที่ปรึกษาก็เห็นด้วย', 'your teacher': 'ครูของคุณ', 'Take it off your journey?': 'เอาออกจากเส้นทางไหม', 'Yes, take it off': 'ใช่ เอาออก', 'Keep it': 'เก็บไว้',
  'I did it!': 'ฉันทำได้แล้ว!', 'I did it': 'ฉันทำได้แล้ว', 'Not doing this any more': 'ไม่ทำแล้ว', 'You did it! Add a photo?': 'คุณทำได้แล้ว! เพิ่มรูปไหม', 'Of “': 'ของ “', '”. You can skip this.': '” จะข้ามก็ได้',
  'How did it go?': 'เป็นอย่างไรบ้าง', 'One sentence is plenty.': 'ประโยคเดียวก็พอ', Save: 'บันทึก', 'Skip and finish': 'ข้ามแล้วจบเลย', 'About “': 'เกี่ยวกับ “', 'Save my answer': 'บันทึกคำตอบ',
  'Your answer': 'คำตอบของคุณ', 'Or say it: record a voice note': 'หรือพูดเอา: อัดข้อความเสียง', 'Add a voice note': 'เพิ่มข้อความเสียง', 'Your voice note is on this moment.': 'ข้อความเสียงของคุณอยู่ในเรื่องนี้แล้ว',
  'Add another thought': 'เพิ่มความคิดอีก', 'What did I learn?': 'ฉันได้เรียนรู้อะไร', 'Your family can see the moments you share with your advisor. Keep anything you like just for you,': 'ครอบครัวของคุณเห็นเรื่องราวที่คุณแบ่งปันกับครูที่ปรึกษา เรื่องไหนอยากเก็บไว้ดูคนเดียวก็ทำได้นะ',
  'Just me': 'แค่ฉัน', 'My advisor and family': 'ครูที่ปรึกษาและครอบครัว', 'When you add moments, you can choose here who sees them.': 'เมื่อคุณเพิ่มเรื่องราว เลือกได้ที่นี่ว่าใครเห็นบ้าง',
  'Just for you now': 'ตอนนี้เห็นแค่คุณ', 'Your advisor and family can see it': 'ครูที่ปรึกษาและครอบครัวเห็นได้', New: 'ใหม่', new: 'ใหม่', Photo: 'รูปภาพ',
  'Add something I did ': 'เพิ่มสิ่งที่ฉันทำ', 'Answer your teacher\'s question': 'ตอบคำถามของครู',
  // the full map (src/screens/StudentMap.jsx, src/components/MetroMap.jsx)
  '· Advisory': '· ห้องที่ปรึกษา', stations: 'สถานี', lines: 'สาย', reflections: 'บทสะท้อนคิด', 'Plan & review': 'วางแผนและทบทวน', 'Term in review': 'ทบทวนภาคเรียน',
  'What changed this term, and links to make': 'อะไรเปลี่ยนไปในภาคเรียนนี้ และสิ่งที่ควรเชื่อมโยง', 'Capture on phone': 'บันทึกด้วยโทรศัพท์', 'Snap it now, sort it later': 'ถ่ายไว้ก่อน ค่อยจัดทีหลัง',
  'Your whole journey, ready to print': 'เส้นทางทั้งหมดของคุณ พร้อมพิมพ์', Plan: 'วางแผน', 'Plan a goal': 'วางแผนเป้าหมาย', 'A dashed station, with a sponsor if you like': 'สถานีเส้นประ มีครูช่วยดูแลได้ถ้าต้องการ',
  'Start a branch': 'เริ่มสายย่อย', 'A sub-line under a school line': 'สายย่อยภายใต้สายของโรงเรียน', 'End a line': 'จบสาย', 'Terminus, then a reflection': 'สถานีปลายทาง แล้วเขียนบทสะท้อนคิด',
  'Each colour is something you do. Tap a dot to see it, or add something new.': 'แต่ละสีคือสิ่งที่คุณทำ แตะจุดเพื่อดู หรือเพิ่มเรื่องใหม่', 'See as': 'ดูในฐานะ', Filters: 'ตัวกรอง', Map: 'แผนที่', List: 'รายการ',
  'Any kind': 'ทุกประเภท', 'Any verification': 'การยืนยันทุกแบบ', 'Any year': 'ทุกปี', 'Any learner profile': 'คุณลักษณะผู้เรียนทุกข้อ', Clear: 'ล้าง',
  'Tap a station or a signal · drag to pan · pinch or scroll to zoom': 'แตะสถานีหรือสัญญาณ · ลากเพื่อเลื่อน · บีบหรือเลื่อนเพื่อซูม', 'No stations match. Try fewer words or clear the filters.': 'ไม่พบสถานีที่ตรงกัน ลองใช้คำให้น้อยลงหรือล้างตัวกรอง',
  Me: 'ฉัน', School: 'โรงเรียน', Public: 'สาธารณะ', 'Add a station': 'เพิ่มสถานี', '❚❚ Pause': '❚❚ หยุด', '▶ Replay': '▶ เล่นย้อน', 'anyone with a link': 'ทุกคนที่มีลิงก์', 'school staff': 'บุคลากรของโรงเรียน',
  'your advisor': 'ครูที่ปรึกษาของคุณ', Pause: 'หยุด', 'Play the journey': 'เล่นเส้นทาง', 'Reflection saved. The signal is clear.': 'บันทึกบทสะท้อนคิดแล้ว สัญญาณหายไปแล้ว',
  'See my map as': 'ดูแผนที่ของฉันในฐานะ', Search: 'ค้นหา', 'Search stations, reflections and lines': 'ค้นหาสถานี บทสะท้อนคิด และสาย', 'Show as': 'แสดงเป็น', Kind: 'ประเภท', Verification: 'การยืนยัน',
  'Learner profile': 'คุณลักษณะผู้เรียน', 'Show or hide lines': 'แสดงหรือซ่อนสาย', 'Travel through time': 'ย้อนดูตามเวลา', 'Close the time scrubber': 'ปิดแถบย้อนเวลา',
  'A new milestone': 'ความสำเร็จใหม่', NEW: 'ใหม่', Fit: 'พอดีจอ', Zoom: 'ซูม', 'Zoom in': 'ขยาย', 'Zoom out': 'ย่อ', 'Fit map': 'ปรับแผนที่ให้พอดีจอ', Station: 'สถานี', Ended: 'จบแล้ว',
  'Reflection signal': 'สัญญาณให้สะท้อนคิด', 'Station details': 'รายละเอียดสถานี', 'Map legend': 'คำอธิบายแผนที่', 'Verification legend': 'คำอธิบายการยืนยัน', ' and ': ' และ ', and: 'และ',
  // the station panel (src/components/StationPanel.jsx)
  Visibility: 'การมองเห็น', 'Verified facts can be included, excluded or reordered in a presentation, never edited.': 'ข้อมูลที่ยืนยันแล้วเลือกใส่ ไม่ใส่ หรือจัดลำดับในงานนำเสนอได้ แต่แก้ไขไม่ได้',
  'Approaches to learning': 'ทักษะการเรียนรู้', Done: 'เสร็จแล้ว', Post: 'โพสต์', 'It happened: make it a station': 'เกิดขึ้นแล้ว: ทำให้เป็นสถานี', 'Marking it done sends it to': 'เมื่อทำเครื่องหมายว่าเสร็จ จะส่งให้',
  'to endorse in one click.': 'รับรองได้ในคลิกเดียว', 'Sent.': 'ส่งแล้ว', 'decides whether to share more.': 'จะตัดสินใจว่าจะแบ่งปันเพิ่มหรือไม่', 'Want to see more?': 'อยากดูเพิ่มไหม',
  'asked for more': 'ขอข้อมูลเพิ่ม', 'Add evidence and resubmit': 'เพิ่มหลักฐานแล้วส่งใหม่', 'Waiting for': 'กำลังรอ', 'to endorse': 'รับรอง', 'Add a reflection': 'เพิ่มบทสะท้อนคิด',
  'Ask for an endorsement': 'ขอการรับรอง', Edit: 'แก้ไข', Delete: 'ลบ', 'Save reflection': 'บันทึกบทสะท้อนคิด', 'Send request': 'ส่งคำขอ', 'Save changes': 'บันทึกการแก้ไข',
  'Manual entry': 'กรอกเอง', 'the student': 'นักเรียน', 'Suggested · check the tags': 'แนะนำให้ · ตรวจดูแท็ก', 'Edit tags': 'แก้ไขแท็ก', 'More evidence please.': 'ขอหลักฐานเพิ่มหน่อย',
  'My own reflection': 'บทสะท้อนคิดของฉันเอง', 'Reflection saved': 'บันทึกบทสะท้อนคิดแล้ว', Saved: 'บันทึกแล้ว', 'Who can see this station': 'ใครเห็นสถานีนี้ได้บ้าง', 'Update for your sponsor': 'อัปเดตให้ครูผู้ดูแล',
  'e.g. Could we see the code?': 'เช่น ขอดูโค้ดได้ไหม', 'Link to the code, a photo or a file': 'ลิงก์ไปยังโค้ด รูป หรือไฟล์', 'Evidence link': 'ลิงก์หลักฐาน', 'Attach a file and resubmit': 'แนบไฟล์แล้วส่งใหม่',
  'Add a file': 'เพิ่มไฟล์', 'What did this give you? What would you do differently?': 'เรื่องนี้ให้อะไรกับคุณ ถ้าทำใหม่จะทำอะไรต่างไปบ้าง', 'Attach a photo or file': 'แนบรูปหรือไฟล์', 'Who can read it': 'ใครอ่านได้บ้าง',
  Teacher: 'ครู', 'A note for the teacher (optional)': 'ข้อความถึงครู (ไม่บังคับ)', 'Note for the teacher': 'ข้อความถึงครู', Title: 'ชื่อเรื่อง', Summary: 'สรุป', Reflection: 'บทสะท้อนคิด',
  ' (resubmitted with more evidence)': ' (ส่งใหม่พร้อมหลักฐานเพิ่ม)', 'Added after leaving NIST.': 'เพิ่มหลังจากออกจาก NIST แล้ว', Private: 'ส่วนตัว', 'Advisor only': 'เฉพาะครูที่ปรึกษา', Publishable: 'เผยแพร่ได้',
  'Student-added': 'นักเรียนเพิ่มเอง', goal: 'เป้าหมาย', 'Planned goal.': 'เป้าหมายที่วางแผนไว้',
  // adding a station and a goal (src/components/AddStation.jsx, GoalDialog.jsx)
  'New station · student-added': 'สถานีใหม่ · นักเรียนเพิ่มเอง', 'What happened': 'เกิดอะไรขึ้น', When: 'เมื่อไร', 'One line about it': 'บอกสั้น ๆ หนึ่งบรรทัด', 'Counts for CAS?': 'นับเป็น CAS ไหม',
  'Who can see it': 'ใครเห็นได้บ้าง', 'Ask a teacher to endorse': 'ขอให้ครูรับรอง', 'No one yet': 'ยังไม่ขอใคร', 'Note to the teacher': 'ข้อความถึงครู', Cancel: 'ยกเลิก', 'Add to my map': 'เพิ่มลงแผนที่ของฉัน',
  'Results board': 'กระดานผลการแข่งขัน', 'Club session': 'กิจกรรมชมรม', Screenshot: 'ภาพหน้าจอ', 'Finished work': 'ผลงานที่เสร็จแล้ว', 'Strengths and growth': 'จุดแข็งและการเติบโต', 'New challenges': 'ความท้าทายใหม่',
  'Initiative and planning': 'การริเริ่มและวางแผน', Commitment: 'ความมุ่งมั่น', Collaboration: 'การทำงานร่วมกัน', 'Global engagement': 'การมีส่วนร่วมระดับโลก', 'Ethics of choices': 'จริยธรรมในการเลือก',
  'Add something to your map': 'เพิ่มบางอย่างลงแผนที่', 'Which colour does it belong to?': 'เรื่องนี้อยู่สีไหน', 'Which line, or lines (two or more makes an interchange)': 'สายไหน (เลือกสองสายขึ้นไปจะเป็นจุดเชื่อม)',
  'Uploading…': 'กำลังอัปโหลด…', 'From this device': 'จากเครื่องนี้', 'Anything else? (optional)': 'มีอะไรอีกไหม (ไม่บังคับ)', 'Files: a PDF, document, recording or video (optional)': 'ไฟล์: PDF เอกสาร เสียงบันทึก หรือวิดีโอ (ไม่บังคับ)',
  'Attach another file': 'แนบไฟล์อีก', 'Attach a file': 'แนบไฟล์', 'What did you learn? (optional)': 'คุณได้เรียนรู้อะไร (ไม่บังคับ)', 'Quick reflection (optional)': 'สะท้อนคิดสั้น ๆ (ไม่บังคับ)', No: 'ไม่',
  Creativity: 'ความคิดสร้างสรรค์', 'Only you and your advisor see it at first.': 'ตอนแรกมีแค่คุณกับครูที่ปรึกษาที่เห็น', 'It appears with a dotted badge until a teacher endorses it.': 'จะมีป้ายจุดไข่ปลาจนกว่าครูจะรับรอง',
  'e.g. Bangkok Smart City hackathon: 1st place': 'เช่น แฮกกาธอน Bangkok Smart City: รางวัลที่ 1', 'What you did, and what came of it': 'คุณทำอะไร และได้ผลอย่างไร', Optional: 'ไม่บังคับ',
  'Planned track': 'เส้นทางที่วางแผนไว้', 'It shows as a dashed station on the map and turns solid when it happens. It does not need to come from a school system.': 'จะแสดงเป็นสถานีเส้นประบนแผนที่ และเป็นเส้นทึบเมื่อเกิดขึ้นจริง ไม่ต้องมาจากระบบของโรงเรียน',
  'What is the goal?': 'เป้าหมายคืออะไร', 'Target date': 'วันที่ตั้งเป้า', 'On which line': 'อยู่บนสายไหน', 'A sentence about it (optional)': 'หนึ่งประโยคเกี่ยวกับเป้าหมาย (ไม่บังคับ)', 'Ask my advisor to check in on it': 'ให้ครูที่ปรึกษาคอยติดตาม',
  'Invite a teacher to sponsor it (optional)': 'เชิญครูมาช่วยดูแล (ไม่บังคับ)', 'No sponsor': 'ไม่มีครูผู้ดูแล', 'Message to the sponsor': 'ข้อความถึงครูผู้ดูแล',
  'A sponsor agrees in advance, can add expectations and check in along the way, and endorses it in one click when you mark it done.': 'ครูผู้ดูแลตกลงไว้ล่วงหน้า บอกสิ่งที่คาดหวังและติดตามระหว่างทางได้ และรับรองได้ในคลิกเดียวเมื่อคุณทำเสร็จ',
  'Plan something ahead': 'วางแผนล่วงหน้า', 'e.g. Enter the Bangkok climate hackathon': 'เช่น ร่วมแฮกกาธอนเรื่องสภาพอากาศในกรุงเทพฯ', 'What you want to come out of it': 'สิ่งที่อยากได้จากเป้าหมายนี้',
  'Why them, and what you will share along the way': 'ทำไมถึงเลือกครูคนนี้ และคุณจะเล่าอะไรระหว่างทาง',
  // goal check-ins (src/components/GoalCheckins.jsx)
  'How is your goal going?': 'เป้าหมายของคุณเป็นอย่างไรบ้าง', 'Goal check-ins': 'อัปเดตเป้าหมาย', 'Going well': 'ไปได้ดี', Stuck: 'ติดอยู่', 'Not started': 'ยังไม่ได้เริ่ม',
  'Want to say a bit more?': 'อยากเล่าเพิ่มอีกนิดไหม', 'e.g. I don’t know where to start': 'เช่น ไม่รู้จะเริ่มตรงไหน', 'What’s one next step?': 'ขั้นต่อไปหนึ่งอย่างคืออะไร', 'e.g. Ask my coach about a plan': 'เช่น ถามโค้ชเรื่องแผนการซ้อม',
  'Your advisor and teachers can see your check-ins.': 'ครูที่ปรึกษาและครูของคุณเห็นการอัปเดตของคุณได้', 'A sentence about it': 'เล่าสักประโยค', '(optional)': '(ไม่บังคับ)', 'Check-ins': 'การอัปเดต', 'Next step:': 'ขั้นต่อไป:',
  'One sentence, if you like': 'ประโยคเดียวก็ได้ ถ้าอยากเล่า', until: 'จนถึง', 'A teacher': 'ครู', ' (you)': ' (คุณ)', 'No check-ins': 'ยังไม่มีการอัปเดต', 'Check-ins paused': 'พักการอัปเดตไว้', 'How is “': 'เป้าหมาย “', '” going?': '” เป็นอย่างไรบ้าง',
  // class tasks and class questions (src/components/ClassTasks.jsx, ClassPrompts.jsx)
  'Tasks from your teachers': 'งานจากครูของคุณ', Tasks: 'งานที่ได้รับ', 'Hand it in': 'ส่งงาน', 'Hand in': 'ส่งงาน', 'Add more': 'เพิ่มเติม', Overdue: 'เลยกำหนด', 'Asked for more': 'ครูขอเพิ่ม',
  Endorsed: 'รับรองแล้ว', 'Handed in late': 'ส่งช้า', 'Handed in': 'ส่งแล้ว', 'Late.': 'ส่งช้า', 'Tick each one you did': 'ติ๊กทุกข้อที่คุณทำแล้ว', 'What did you add?': 'คุณเพิ่มอะไรไป',
  'What you did': 'สิ่งที่คุณทำ', 'Add a photo or a file': 'เพิ่มรูปหรือไฟล์', 'Add a photo or a file?': 'เพิ่มรูปหรือไฟล์ไหม', 'You can skip this.': 'จะข้ามก็ได้', 'Add another': 'เพิ่มอีก',
  'Choose a file': 'เลือกไฟล์', 'Wait for the upload…': 'รออัปโหลดสักครู่…', 'Skip and hand it in': 'ข้ามแล้วส่งงานเลย', 'Handed in!': 'ส่งแล้ว!', Start: 'เริ่ม', 'your class': 'ชั้นเรียนของคุณ',
  ' You need a photo or a file.': ' ต้องมีรูปหรือไฟล์ด้วย', 'Your teacher': 'ครูของคุณ', 'A question from your teacher': 'คำถามจากครู', 'Read the question out loud': 'อ่านคำถามออกเสียง',
  Answer: 'ตอบ', 'Answer it': 'ตอบเลย', 'Not for me': 'ไม่ใช่สำหรับฉัน', 'Add a photo?': 'เพิ่มรูปไหม', 'Done!': 'เสร็จแล้ว!', 'Send my answer': 'ส่งคำตอบ', 'Skip and send': 'ข้ามแล้วส่งเลย',
  'Okay, it is hidden.': 'ได้เลย ซ่อนแล้ว', asked: 'ถาม',
  // term reflection (src/components/TermReflection.jsx)
  'Term reflection': 'ทบทวนภาคเรียน', 'Look back on this term: pick what you are proud of, say what you learned, and set one goal.': 'มองย้อนกลับไปในภาคเรียนนี้ เลือกสิ่งที่คุณภูมิใจ เล่าว่าได้เรียนรู้อะไร และตั้งเป้าหมายหนึ่งอย่าง',
  'Open until': 'เปิดถึง', 'You started this. Carry on where you left off.': 'คุณเริ่มไว้แล้ว ทำต่อจากที่ค้างไว้ได้เลย', 'Carry on': 'ทำต่อ', 'Look back at this term': 'มองย้อนภาคเรียนนี้',
  'Tap up to': 'แตะเลือกได้สูงสุด', 'things you are proud of.': 'อย่างที่คุณภูมิใจ', 'Nothing on your journey yet this term. That is fine: you can still write about your term.': 'ภาคเรียนนี้ยังไม่มีอะไรบนเส้นทาง ไม่เป็นไรนะ ยังเขียนถึงภาคเรียนของคุณได้',
  'Well done,': 'เก่งมาก', Your: '', 'is on your journey': 'ของคุณอยู่บนเส้นทางแล้ว', 'Keep going:': 'ทำต่อไป:', 'By the end of next term (': 'ภายในสิ้นภาคเรียนหน้า (', 'Look at what you wrote': 'ดูสิ่งที่คุณเขียน',
  'My goal': 'เป้าหมายของฉัน', Finish: 'เสร็จสิ้น', 'Saved on your journey as a reflection station': 'บันทึกบนเส้นทางของคุณเป็นสถานีบทสะท้อนคิดแล้ว', 'Check it over, then finish.': 'ตรวจดูอีกครั้ง แล้วกดเสร็จสิ้น',
  'Goal for next term': 'เป้าหมายสำหรับภาคเรียนหน้า', 'Back to edit': 'กลับไปแก้ไข', '. Your progress is kept: save and come back any time.': ' สิ่งที่ทำไว้จะถูกเก็บไว้ บันทึกแล้วกลับมาทำต่อได้ทุกเมื่อ',
  '1. Look back': '1. มองย้อนกลับไป', 'Pick up to': 'เลือกได้สูงสุด', 'moments from this term you are proud of.': 'เรื่องราวในภาคเรียนนี้ที่คุณภูมิใจ', '2. What it meant': '2. เรื่องนั้นมีความหมายอย่างไร',
  '. One goal for next term': '. เป้าหมายหนึ่งอย่างสำหรับภาคเรียนหน้า', 'Keep going with a goal I have': 'ทำเป้าหมายเดิมที่มีอยู่ต่อ', 'A new goal': 'เป้าหมายใหม่', 'No goal for now': 'ยังไม่ตั้งเป้าหมายตอนนี้',
  '. Who can see it': '. ใครเห็นได้บ้าง', 'Me and my advisor': 'ฉันกับครูที่ปรึกษา', 'My teachers too': 'ครูของฉันด้วย', 'Only me': 'แค่ฉันคนเดียว', 'Save and finish later': 'บันทึกไว้ ทำต่อทีหลัง',
  Review: 'ตรวจทาน', 'I made…': 'ฉันได้สร้าง…', 'I helped…': 'ฉันได้ช่วย…', 'I took part in…': 'ฉันได้ร่วม…', 'I tried…': 'ฉันได้ลอง…', 'I got better at…': 'ฉันเก่งขึ้นเรื่อง…', 'What next?': 'ต่อไปจะทำอะไร',
  'I want to try…': 'ฉันอยากลอง…', 'I will keep…': 'ฉันจะทำต่อไป…', 'What you did, in a sentence or two': 'สิ่งที่คุณทำ เล่าสักหนึ่งหรือสองประโยค', 'A skill, something about yourself, or something that surprised you': 'ทักษะ เรื่องเกี่ยวกับตัวคุณเอง หรือสิ่งที่ทำให้คุณประหลาดใจ',
  'What you will do differently, or try next': 'สิ่งที่คุณจะทำต่างไป หรือจะลองต่อไป', 'Only you can see it.': 'มีแค่คุณที่เห็น', 'Your teachers and your family can see it.': 'ครูและครอบครัวของคุณเห็นได้',
  'Your advisor and your family can see it.': 'ครูที่ปรึกษาและครอบครัวของคุณเห็นได้', 'Your advisor can see it.': 'ครูที่ปรึกษาของคุณเห็นได้', ' · earlier': ' · ก่อนหน้านี้', ', and so is your goal': ' และเป้าหมายของคุณด้วย',
  'Your term': 'ภาคเรียนของคุณ', 'Or something new:': 'หรือเรื่องใหม่:', 'My term': 'ภาคเรียนของฉัน', ', with your goal for next term': ' พร้อมเป้าหมายสำหรับภาคเรียนหน้า', 'This term': 'ภาคเรียนนี้',
  'Saved. Come back to it any time.': 'บันทึกแล้ว กลับมาทำต่อได้ทุกเมื่อ', 'Which goal': 'เป้าหมายไหน', Goal: 'เป้าหมาย', 'e.g. Lead a club session': 'เช่น นำกิจกรรมชมรมหนึ่งครั้ง', Line: 'สาย', 'Open it': 'เปิดดู',
  // milestones (src/components/Milestones.jsx, src/milestones.js)
  'New milestone': 'ความสำเร็จใหม่', 'And:': 'และ:', 'Yay!': 'เย้!', 'Milestone:': 'ความสำเร็จ:', Milestones: 'ความสำเร็จ', 'My milestones': 'ความสำเร็จของฉัน', 'Recent milestones': 'ความสำเร็จล่าสุด',
  'Show fewer': 'แสดงน้อยลง', 'First moment': 'เรื่องราวแรก', 'First endorsement': 'การรับรองครั้งแรก', 'First goal done': 'ทำเป้าหมายแรกสำเร็จ', 'Term reflection finished': 'ทบทวนภาคเรียนเสร็จแล้ว',
  'First spotted moment added': 'เพิ่มเรื่องที่ครูสังเกตเห็นเป็นครั้งแรก', 'Your journey has started!': 'เส้นทางของคุณเริ่มต้นแล้ว!', 'You looked back on your term and finished your reflection.': 'คุณมองย้อนภาคเรียนและเขียนบทสะท้อนคิดเสร็จแล้ว',
  // kind feedback (src/components/PeerFeedback.jsx)
  'From your classes': 'จากชั้นเรียนของคุณ', 'Classmates asked for kind feedback on these moments.': 'เพื่อนร่วมชั้นอยากได้คำติชมดี ๆ ในเรื่องเหล่านี้', 'You said:': 'คุณบอกว่า:', 'said thank you': 'ขอบคุณแล้ว',
  'Show all': 'แสดงทั้งหมด', 'You have given': 'วันนี้คุณให้คำติชมไปแล้ว', 'pieces of feedback today. You can give more tomorrow.': 'ครั้ง พรุ่งนี้ให้เพิ่มได้อีก', 'Kind feedback for': 'คำติชมดี ๆ ถึง',
  'Pick one or two, and finish the sentence.': 'เลือกหนึ่งหรือสองข้อ แล้วเขียนประโยคให้จบ', 'sees your first name. Your teachers can read it too.': 'จะเห็นชื่อจริงของคุณ ครูก็อ่านได้ด้วย', characters: 'ตัวอักษร',
  'Be kind and helpful.': 'พูดดี ๆ และให้ประโยชน์นะ', Send: 'ส่ง', 'Kind feedback from classmates': 'คำติชมดี ๆ จากเพื่อน', 'Let classmates in my classes give kind feedback': 'ให้เพื่อนในชั้นเรียนของฉันให้คำติชมดี ๆ ได้',
  'Only for moments the school can see. Change who can see it first.': 'ใช้ได้เฉพาะเรื่องที่โรงเรียนเห็นได้ เปลี่ยนการมองเห็นก่อนนะ', 'No feedback yet.': 'ยังไม่มีคำติชม', 'Hidden by': 'ซ่อนโดย',
  'You said thank you': 'คุณขอบคุณแล้ว', 'Say thank you': 'กล่าวขอบคุณ', Hide: 'ซ่อน', 'Report this feedback': 'รายงานคำติชมนี้', 'Give more': 'ให้เพิ่ม', 'Give kind feedback': 'ให้คำติชมดี ๆ',
  'Classmates in your classes can now give kind feedback on this.': 'ตอนนี้เพื่อนในชั้นเรียนให้คำติชมดี ๆ ในเรื่องนี้ได้แล้ว', 'Classmates can no longer give feedback on this.': 'เพื่อนให้คำติชมในเรื่องนี้ไม่ได้แล้ว',
  'Hidden. Only your teachers can see it now.': 'ซ่อนแล้ว ตอนนี้มีแค่ครูที่เห็น', 'a classmate': 'เพื่อนร่วมชั้น', Hidden: 'ซ่อนอยู่', Thanked: 'ขอบคุณแล้ว', 'Pick one or two': 'เลือกหนึ่งหรือสองข้อ',
  'I liked how…': 'ฉันชอบที่…', 'This made me think about…': 'เรื่องนี้ทำให้ฉันคิดถึง…', 'A question I have…': 'คำถามที่ฉันมีคือ…', 'You could try…': 'ลอง…ดูไหม',
  // comments, spotted moments, voice, reporting (MomentComments, Spotted, Voice, Report, FileAttach)
  Comments: 'ความคิดเห็น', Reply: 'ตอบกลับ', Comment: 'ความคิดเห็น', 'Comment sent': 'ส่งความคิดเห็นแล้ว', 'Comment deleted': 'ลบความคิดเห็นแล้ว', 'Send comment': 'ส่งความคิดเห็น',
  'Your family does not see comments.': 'ครอบครัวของคุณไม่เห็นความคิดเห็น', 'Change your comment': 'แก้ไขความคิดเห็นของคุณ', ' · edited': ' · แก้ไขแล้ว',
  'spotted something you did': 'สังเกตเห็นสิ่งที่คุณทำ', 'Add to my journey': 'เพิ่มลงเส้นทางของฉัน', 'Okay, it is not added.': 'ได้เลย ไม่เพิ่มแล้ว', 'Photo from your teacher': 'รูปจากครู',
  'Your browser turns what you say into words. This app does not record or keep your voice.': 'เบราว์เซอร์จะแปลงเสียงพูดของคุณเป็นตัวหนังสือ แอปนี้ไม่ได้อัดหรือเก็บเสียงของคุณ', OK: 'ตกลง',
  Record: 'อัดเสียง', Stop: 'หยุด', 'Play again': 'เล่นอีกครั้ง', 'Record again': 'อัดใหม่', 'No voice note': 'ไม่ใช้ข้อความเสียง', 'Say it instead of typing': 'พูดแทนการพิมพ์',
  'Speaking to type does not work in this browser. You can type instead.': 'เบราว์เซอร์นี้พูดแทนการพิมพ์ไม่ได้ พิมพ์แทนได้นะ', 'The microphone is not allowed here. You can type instead.': 'หน้านี้ยังไม่ได้รับอนุญาตให้ใช้ไมโครโฟน พิมพ์แทนได้นะ',
  'I did not hear anything. Try again, a bit closer.': 'ไม่ได้ยินเสียงเลย ลองอีกครั้ง พูดใกล้ ๆ หน่อย', 'The microphone could not start. You can type instead.': 'เปิดไมโครโฟนไม่ได้ พิมพ์แทนได้นะ',
  'Stop listening': 'หยุดฟัง', 'Listening… tap to stop': 'กำลังฟัง… แตะเพื่อหยุด', 'Say it': 'พูดเลย', 'Read this out loud': 'อ่านออกเสียง', 'Stop reading': 'หยุดอ่าน',
  'The microphone could not be used. Check that this page is allowed to use it.': 'ใช้ไมโครโฟนไม่ได้ ตรวจดูว่าหน้านี้ได้รับอนุญาตให้ใช้ไมโครโฟนแล้ว', 'Recording does not work in this browser.': 'เบราว์เซอร์นี้อัดเสียงไม่ได้',
  'Voice note': 'ข้อความเสียง', 'Saving…': 'กำลังบันทึก…', 'Use this': 'ใช้อันนี้', 'Your voice note': 'ข้อความเสียงของคุณ', 'Record a voice note': 'อัดข้อความเสียง',
  'You told a teacher about this': 'คุณบอกครูเรื่องนี้แล้ว', 'Something wrong? Tell a teacher': 'มีอะไรไม่ถูกต้องไหม บอกครูได้', 'Tell a teacher': 'บอกครู', 'A teacher who looks after safety will see it.': 'ครูที่ดูแลความปลอดภัยจะเห็นเรื่องนี้',
  'this comment': 'ความคิดเห็นนี้', 'this moment': 'เรื่องนี้', 'A browser cannot show this kind of file. Download it to open it.': 'เบราว์เซอร์แสดงไฟล์แบบนี้ไม่ได้ ดาวน์โหลดเพื่อเปิดดูนะ', Remove: 'ลบ',
  'The file could not be added. Please try again.': 'เพิ่มไฟล์ไม่สำเร็จ ลองอีกครั้งนะ', Audio: 'เสียง', Video: 'วิดีโอ', File: 'ไฟล์', Download: 'ดาวน์โหลด', 'Open in a new tab': 'เปิดในแท็บใหม่',
  // nudges and last year's goals (src/components/Nudges.jsx, YearHandover.jsx)
  'Your advisor says hello': 'ครูที่ปรึกษาทักทายคุณ', 'Add something': 'เพิ่มบางอย่าง', 'A new year: carry over or close': 'ปีใหม่แล้ว: ทำต่อหรือปิดไว้', 'from last year': 'จากปีที่แล้ว', passed: 'ผ่านไปแล้ว',
  'date. Keep going with it this year, or close it.': 'ทำต่อในปีนี้ หรือปิดไว้ก็ได้', 'was for': 'ตั้งไว้สำหรับ', 'Carry over': 'ทำต่อ', 'This goal': 'เป้าหมายนี้', 'These goals': 'เป้าหมายเหล่านี้',
  By: 'ภายใน', "'s inbox": ': กล่องรับเข้า', match: 'รายการที่ตรงกัน', 'code controls': 'ตัวควบคุมโค้ด', 'builder controls': 'ตัวควบคุมตัวสร้าง', the: '', 'custom page controls': 'ตัวควบคุมหน้าแบบกำหนดเอง',
  'stations for': 'สถานีสำหรับ', for: 'สำหรับ', '. Same verified record:': ' บันทึกที่ยืนยันแล้วชุดเดียวกัน:', 'IB learner profile': 'คุณลักษณะผู้เรียน IB', of: 'จาก', 'Anyone with a link': 'ทุกคนที่มีลิงก์', 'new station': 'สถานีใหม่', s: '', es: '', 'Opens the print dialog. Choose “Save as PDF” to keep a copy.': 'เปิดหน้าต่างพิมพ์ เลือก “บันทึกเป็น PDF” เพื่อเก็บสำเนาไว้',
  'e.g. Bangkok Smart City hackathon: 1st place': 'เช่น แฮกกาธอนเมืองอัจฉริยะกรุงเทพฯ: รางวัลที่ 1',
  // term in review, capture on a phone, branches and ending a line (TermReview, PhoneCapture, LineDialog)
  'Your term in review,': 'ทบทวนภาคเรียนของคุณ', 'than last term)': 'กว่าภาคเรียนที่แล้ว)', more: 'มากกว่า', fewer: 'น้อยกว่า', 'A new interchange': 'จุดเชื่อมใหม่', where: 'ที่', 'meet:': 'มาบรรจบกัน:',
  'line grew by': 'เติบโตขึ้น', reflection: 'บทสะท้อนคิด', written: 'ที่เขียนแล้ว', endorsement: 'การรับรอง', endorsements: 'การรับรอง', 'from teachers': 'จากครู',
  'was quiet this term. That is fine; you can also end it.': 'เงียบไปในภาคเรียนนี้ ไม่เป็นไรนะ จะจบสายนี้ก็ได้', 'Next up:': 'ต่อไป:', on: 'วันที่', 'These might be connected': 'เรื่องเหล่านี้อาจเชื่อมโยงกัน',
  'They share words and happened close together. Joining them makes an interchange on your map.': 'มีคำที่เหมือนกันและเกิดขึ้นใกล้ ๆ กัน ถ้ารวมกันจะเป็นจุดเชื่อมบนแผนที่ของคุณ', 'Both mention': 'ทั้งสองเรื่องพูดถึง', 'Join them': 'รวมกัน', 'Not related': 'ไม่เกี่ยวกัน',
  'NIST Portfolio': 'NIST Portfolio', 'What happened?': 'เกิดอะไรขึ้น', 'Send to my inbox': 'ส่งไปที่กล่องรับเข้าของฉัน', 'In your inbox': 'อยู่ในกล่องรับเข้าแล้ว', 'Captured in': 'บันทึกเสร็จใน',
  'seconds. Choose its line on your laptop later; nothing reaches your map until you do.': 'วินาที เลือกสายทีหลังบนแล็ปท็อปได้ จะยังไม่มีอะไรขึ้นแผนที่จนกว่าคุณจะเลือก', 'Capture on a phone': 'บันทึกด้วยโทรศัพท์',
  'Who is going to type all this?': 'ใครจะพิมพ์ทั้งหมดนี้', 'Nobody. School systems bring most stations in. For the rest, a student snaps a photo and writes one line, in about 20 seconds.': 'ไม่ต้องมีใครพิมพ์เลย ระบบของโรงเรียนนำสถานีส่วนใหญ่เข้ามาให้ ที่เหลือนักเรียนแค่ถ่ายรูปแล้วเขียนหนึ่งบรรทัด ใช้เวลาประมาณ 20 วินาที',
  'Open my inbox': 'เปิดกล่องรับเข้าของฉัน', 'Beach cleanup': 'เก็บขยะชายหาด', Mural: 'ภาพจิตรกรรมฝาผนัง', 'Smart City hackathon: we won': 'แฮกกาธอนเมืองอัจฉริยะ: เราชนะ',
  'Splitting the work in the first hour made the difference.': 'การแบ่งงานกันในชั่วโมงแรกทำให้ต่างจริง ๆ', 'Snap a photo': 'ถ่ายรูป', 'Add one line': 'เขียนหนึ่งบรรทัด', 'It lands in the inbox': 'เข้าไปอยู่ในกล่องรับเข้า', 'Take photo': 'ถ่ายรูป',
  'New branch': 'สายย่อยใหม่', 'Branch from a school line': 'แยกจากสายของโรงเรียน', 'School lines are fixed so every map reads the same way. Your branch sits beneath one of them, with its own name.': 'สายของโรงเรียนตั้งไว้แน่นอนเพื่อให้ทุกแผนที่อ่านแบบเดียวกัน สายย่อยของคุณจะอยู่ใต้สายใดสายหนึ่ง และมีชื่อของตัวเอง',
  'Branch from': 'แยกจาก', 'Name your branch': 'ตั้งชื่อสายย่อย', 'First station on it': 'สถานีแรกบนสายนี้', Date: 'วันที่', 'your branch': 'สายย่อยของคุณ', 'Your coordinator approves': 'ผู้ประสานงานจะอนุมัติ',
  "new branch names so the school's list stays tidy.": 'ชื่อสายย่อยใหม่ เพื่อให้รายการของโรงเรียนเป็นระเบียบ', 'Start branch': 'เริ่มสายย่อย', 'e.g. Marine Biology': 'เช่น ชีววิทยาทางทะเล', 'e.g. Robotics': 'เช่น หุ่นยนต์', 'What started it?': 'อะไรทำให้เริ่ม',
  'Stopping is part of the story': 'การหยุดก็เป็นส่วนหนึ่งของเรื่องราว', 'The line gets a terminus bar and goes quiet. It stays on your map, and a signal asks what it gave you.': 'สายจะมีแถบสถานีปลายทางและเงียบลง แต่ยังอยู่บนแผนที่ และจะมีสัญญาณถามว่าสายนี้ให้อะไรกับคุณ',
  'Which line': 'สายไหน', 'Keep its stations publishable (by default an ended line becomes advisor-only)': 'ให้สถานีบนสายนี้ยังเผยแพร่ได้ (ปกติสายที่จบแล้วจะเห็นได้เฉพาะครูที่ปรึกษา)', 'Ended already:': 'จบไปแล้ว:',
  '(restart)': '(เริ่มใหม่)', 'End this line': 'จบสายนี้', 'Line ended. Reflect at its terminus when you are ready.': 'จบสายแล้ว เขียนบทสะท้อนคิดที่สถานีปลายทางเมื่อพร้อมนะ',
  // the map poster (src/screens/Poster.jsx)
  'Your whole journey on one sheet': 'เส้นทางทั้งหมดของคุณในแผ่นเดียว', 'Print it at A3 or larger, frame it, or save it as a PDF.': 'พิมพ์ขนาด A3 หรือใหญ่กว่า ใส่กรอบ หรือบันทึกเป็น PDF', 'Publishable only': 'เฉพาะที่เผยแพร่ได้',
  Everything: 'ทั้งหมด', White: 'ขาว', Navy: 'กรมท่า', 'Print or save as PDF': 'พิมพ์หรือบันทึกเป็น PDF', Stations: 'สถานี', Lines: 'สาย', Verified: 'ยืนยันแล้ว', Reflections: 'บทสะท้อนคิด',
  station: 'สถานี', 'verified by the school': 'ยืนยันโดยโรงเรียน', 'endorsed by a teacher': 'รับรองโดยครู', 'added by': 'เพิ่มโดย', 'It shows only what you have made publishable, so it is safe to pin up anywhere.': 'แสดงเฉพาะสิ่งที่คุณตั้งให้เผยแพร่ได้ จึงติดไว้ที่ไหนก็ได้อย่างปลอดภัย',
  'This version includes private stations: keep it for yourself.': 'ฉบับนี้มีสถานีส่วนตัวด้วย เก็บไว้ดูเองนะ', 'Choose A3 landscape, no margins, and turn on background graphics.': 'เลือก A3 แนวนอน ไม่มีขอบ และเปิดการพิมพ์ภาพพื้นหลัง',
  'Scan for the full portfolio': 'สแกนเพื่อดูแฟ้มผลงานทั้งหมด', 'Check any station': 'ตรวจสอบสถานีใดก็ได้', 'Every station, with its evidence and who verified it.': 'ทุกสถานี พร้อมหลักฐานและผู้ยืนยัน',
  'Each verified station has a code the school can confirm.': 'สถานีที่ยืนยันแล้วแต่ละแห่งมีรหัสที่โรงเรียนตรวจสอบได้', 'What to include': 'สิ่งที่จะใส่', Paper: 'กระดาษ', 'NIST International School · Transit Portfolio': 'โรงเรียนนานาชาติ NIST · Transit Portfolio',
  // share links and the shared view (ShareLinks, SharedView, ShareDialog, ShareGaps)
  'Who can read my story': 'ใครอ่านเรื่องราวของฉันได้บ้าง', 'Each link opens one presentation, read-only. Views are logged, links expire, and you can switch any of them off at once.': 'แต่ละลิงก์เปิดงานนำเสนอหนึ่งชิ้นแบบอ่านอย่างเดียว ระบบบันทึกการเปิดดู ลิงก์มีวันหมดอายุ และคุณปิดลิงก์ไหนก็ได้ทันที',
  link: 'ลิงก์', working: 'ใช้งานได้', 'views in total': 'ครั้งที่เปิดดูทั้งหมด', For: 'สำหรับ', '· expires': '· หมดอายุ', views: 'ครั้งที่เปิดดู', Open: 'เปิด', '+30 days': '+30 วัน', 'Switch on': 'เปิดใช้', 'Switch off': 'ปิดใช้',
  'Print it on a CV or show it on a screen. It stops working when the link does.': 'พิมพ์ลงในประวัติย่อหรือแสดงบนจอได้ จะใช้ไม่ได้เมื่อลิงก์หยุดทำงาน', 'No links yet.': 'ยังไม่มีลิงก์', 'Make one below when you are ready to share.': 'สร้างลิงก์ด้านล่างเมื่อพร้อมแบ่งปัน',
  'New link': 'ลิงก์ใหม่', 'Choose a presentation…': 'เลือกงานนำเสนอ…', days: 'วัน', 'Ask for an email': 'ขออีเมลผู้อ่าน', 'Create link': 'สร้างลิงก์', 'Anyone with the link': 'ทุกคนที่มีลิงก์', 'Switched off': 'ปิดใช้แล้ว',
  Expired: 'หมดอายุแล้ว', 'Not opened yet': 'ยังไม่มีใครเปิด', 'Hide QR': 'ซ่อน QR', 'Drop email check': 'เลิกขออีเมล', 'Ask for email': 'ขออีเมล', Presentation: 'งานนำเสนอ', 'Who is it for? (optional)': 'สำหรับใคร (ไม่บังคับ)', 'Expires after': 'หมดอายุหลังจาก',
  'No share links yet. Create one in the Presentation studio.': 'ยังไม่มีลิงก์แบ่งปัน สร้างได้ในสตูดิโองานนำเสนอ', 'Viewing link': 'ลิงก์ที่กำลังดู', 'This is what an external viewer sees: read-only, publishable items only.': 'นี่คือสิ่งที่ผู้ชมภายนอกเห็น อ่านได้อย่างเดียว เฉพาะรายการที่เผยแพร่ได้',
  'The student has withdrawn access. Ask them for a new link.': 'นักเรียนยกเลิกการเข้าถึงแล้ว ขอลิงก์ใหม่จากนักเรียน', 'Shared read-only by': 'แบ่งปันแบบอ่านอย่างเดียวโดย', 'Link expires': 'ลิงก์หมดอายุ', 'views logged': 'ครั้งที่บันทึกการเปิดดู',
  'This link has been revoked': 'ลิงก์นี้ถูกยกเลิกแล้ว', 'This link has expired': 'ลิงก์นี้หมดอายุแล้ว', 'Share link ready': 'ลิงก์แบ่งปันพร้อมแล้ว', 'Read-only. Expires': 'อ่านได้อย่างเดียว หมดอายุ',
  '. Every view is logged, and you can switch it off any time under Share links.': ' ระบบบันทึกทุกครั้งที่เปิดดู และคุณปิดได้ทุกเมื่อที่หน้าลิงก์แบ่งปัน', Copied: 'คัดลอกแล้ว', 'Copy link': 'คัดลอกลิงก์', Link: 'ลิงก์',
  'Before you share “': 'ก่อนแบ่งปัน “', "won’t be in this link": 'จะไม่อยู่ในลิงก์นี้', 'This presentation would include them, but readers outside the school only see publishable stations. Make any of them publishable now, or share without them.': 'งานนำเสนอนี้มีสถานีเหล่านี้ แต่ผู้อ่านนอกโรงเรียนเห็นเฉพาะสถานีที่เผยแพร่ได้ ตั้งให้เผยแพร่ได้ตอนนี้ หรือแบ่งปันโดยไม่มีสถานีเหล่านี้ก็ได้',
  '· now': '· ตอนนี้', 'Make publishable': 'ตั้งให้เผยแพร่ได้', 'Private stations are ones you kept to yourself. Only publish them if you are happy for this reader to see them.': 'สถานีส่วนตัวคือสิ่งที่คุณเก็บไว้คนเดียว เผยแพร่เฉพาะเมื่อคุณยินดีให้ผู้อ่านคนนี้เห็น',
  'Share without them': 'แบ่งปันโดยไม่มีสถานีเหล่านี้', 'Make all': 'ตั้งทั้งหมด', publishable: 'ให้เผยแพร่ได้', 'Everything this presentation shows is publishable': 'ทุกอย่างในงานนำเสนอนี้เผยแพร่ได้', 'The reader will see the whole story you built.': 'ผู้อ่านจะเห็นเรื่องราวทั้งหมดที่คุณสร้าง',
  'Create share link': 'สร้างลิงก์แบ่งปัน', 'Before you share': 'ก่อนแบ่งปัน',
  // privacy and the activity log (src/screens/Privacy.jsx, Activity.jsx)
  'Privacy centre': 'ศูนย์ความเป็นส่วนตัว', 'You decide who reads what': 'คุณเป็นคนเลือกว่าใครอ่านอะไรได้', 'New items start advisor-only. Reflections start private. Nothing becomes public unless you make it publishable.': 'รายการใหม่จะเห็นได้เฉพาะครูที่ปรึกษาก่อน บทสะท้อนคิดเริ่มเป็นส่วนตัว ไม่มีอะไรเป็นสาธารณะจนกว่าคุณจะตั้งให้เผยแพร่ได้',
  'Preview on my map with “See as”': 'ดูตัวอย่างบนแผนที่ด้วย “ดูในฐานะ”', 'Who can see my map right now': 'ตอนนี้ใครเห็นแผนที่ของฉันได้บ้าง', Viewer: 'ผู้ดู', 'My advisor': 'ครูที่ปรึกษาของฉัน', 'School staff': 'บุคลากรของโรงเรียน',
  'These rules are applied before anything reaches a screen, a share link or an export.': 'กฎเหล่านี้ใช้ก่อนที่ข้อมูลใดจะไปถึงหน้าจอ ลิงก์แบ่งปัน หรือไฟล์ส่งออก', 'Defaults for new things': 'ค่าเริ่มต้นสำหรับสิ่งใหม่', 'New reflections': 'บทสะท้อนคิดใหม่',
  'Stations I add': 'สถานีที่ฉันเพิ่ม', 'Items from school systems': 'รายการจากระบบของโรงเรียน', 'Stations on a line I end': 'สถานีบนสายที่ฉันจบ', 'New share links expire after': 'ลิงก์แบ่งปันใหม่หมดอายุหลังจาก', 'By line': 'ตามสาย',
  'Set every station on a line at once. You can still change single stations on the map.': 'ตั้งค่าทุกสถานีบนสายพร้อมกัน ยังเปลี่ยนทีละสถานีบนแผนที่ได้', Mixed: 'หลายแบบ', 'Waiting for a parent': 'รอผู้ปกครอง',
  "Students in Years 7 to 9 need a parent's consent before anything can be made publishable. Until then, everything stays inside the school.": 'นักเรียน Year 7 ถึง 9 ต้องได้รับความยินยอมจากผู้ปกครองก่อนจึงจะเผยแพร่ได้ จนถึงตอนนั้นทุกอย่างจะอยู่ภายในโรงเรียน',
  'Send a reminder to my parent': 'ส่งข้อความเตือนผู้ปกครอง', 'Parent consent on file': 'มีการยินยอมจากผู้ปกครองแล้ว', "Recorded in the SIS when you joined. Under Thailand's PDPA you can ask the school to correct or delete your data at any time": 'บันทึกไว้ใน SIS ตอนที่คุณเข้าเรียน ตาม PDPA ของประเทศไทย คุณขอให้โรงเรียนแก้ไขหรือลบข้อมูลของคุณได้ทุกเมื่อ',
  ': ask the pilot admin, who can remove your record': ' โดยแจ้งผู้ดูแลระบบของโครงการนำร่อง ซึ่งลบบันทึกของคุณได้', 'School screens': 'จอของโรงเรียน',
  'At open evenings, in the library or on a lobby TV, the school may show moments you made publishable, with your first name and Year.': 'ในงานเปิดบ้าน ห้องสมุด หรือจอทีวีที่ล็อบบี้ โรงเรียนอาจแสดงเรื่องราวที่คุณตั้งให้เผยแพร่ได้ พร้อมชื่อจริงและ Year ของคุณ',
  "Don't show my moments on school screens": 'ไม่ต้องแสดงเรื่องราวของฉันบนจอของโรงเรียน', 'Take your map with you': 'นำแผนที่ติดตัวไปด้วย', 'When you graduate, or whenever you like, download your whole record. It is yours.': 'เมื่อเรียนจบ หรือเมื่อไรก็ได้ ดาวน์โหลดบันทึกทั้งหมดของคุณได้ เพราะเป็นของคุณ',
  'Download everything the school holds about me (ZIP)': 'ดาวน์โหลดทุกอย่างที่โรงเรียนมีเกี่ยวกับฉัน (ZIP)', 'Download my record (JSON)': 'ดาวน์โหลดบันทึกของฉัน (JSON)', 'Download my presentations (HTML)': 'ดาวน์โหลดงานนำเสนอของฉัน (HTML)', 'Make a map poster': 'ทำโปสเตอร์แผนที่',
  "Under Thailand's PDPA you have the right to a copy of your data and to have it removed. For removal, ask the pilot admin or the school's data protection officer.": 'ตาม PDPA ของประเทศไทย คุณมีสิทธิ์ขอสำเนาข้อมูลของคุณและขอให้ลบข้อมูลได้ หากต้องการลบ แจ้งผู้ดูแลระบบของโครงการนำร่องหรือเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลของโรงเรียน',
  'After you graduate the map keeps going.': 'หลังเรียนจบ แผนที่ยังไปต่อได้', 'Default saved.': 'บันทึกค่าเริ่มต้นแล้ว', 'Your moments will not be shown on school screens.': 'เรื่องราวของคุณจะไม่แสดงบนจอของโรงเรียน',
  'Your publishable moments may be shown on school screens.': 'เรื่องราวที่เผยแพร่ได้ของคุณอาจแสดงบนจอของโรงเรียน',
  'Saved: your record, every station and reflection, endorsements, presentations and share links, inbox, activity, requests, comments, notifications and your uploaded files, with a README explaining each file.': 'บันทึกแล้ว: บันทึกของคุณ ทุกสถานีและบทสะท้อนคิด การรับรอง งานนำเสนอและลิงก์แบ่งปัน กล่องรับเข้า ประวัติการใช้งาน คำขอ ความคิดเห็น การแจ้งเตือน และไฟล์ที่อัปโหลด พร้อมไฟล์ README อธิบายแต่ละไฟล์',
  'Saved: every station, line, reflection and endorsement, plus your activity log.': 'บันทึกแล้ว: ทุกสถานี สาย บทสะท้อนคิด และการรับรอง พร้อมประวัติการใช้งานของคุณ', 'Saved: a static copy of each presentation that works offline.': 'บันทึกแล้ว: สำเนาของงานนำเสนอแต่ละชิ้นที่เปิดได้แม้ไม่มีอินเทอร์เน็ต',
  'Activity log': 'ประวัติการใช้งาน', 'Everything that happened to my record': 'ทุกอย่างที่เกิดขึ้นกับบันทึกของฉัน', "Every import, endorsement, visibility change and share-link view, with who and when. Only you and the school's data protection officer can see this page.": 'ทุกการนำเข้า การรับรอง การเปลี่ยนการมองเห็น และการเปิดลิงก์แบ่งปัน พร้อมว่าใครทำและเมื่อไร มีแค่คุณกับเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลของโรงเรียนที่เห็นหน้านี้',
  'link views': 'การเปิดลิงก์', imports: 'การนำเข้า', 'Show older': 'แสดงที่เก่ากว่า', 'Link views': 'การเปิดลิงก์', Endorsements: 'การรับรอง', Imports: 'การนำเข้า', 'My changes': 'สิ่งที่ฉันเปลี่ยน', 'just now': 'เมื่อสักครู่',
  // the presentation studio (src/components/Studio.jsx, TierToggle, LensCompare, src/themes/themes.js, api LENSES); the preview itself stays English
  'No presentations yet.': 'ยังไม่มีงานนำเสนอ', 'Ask your advisor or the pilot admin to set up your presentations.': 'ขอให้ครูที่ปรึกษาหรือผู้ดูแลระบบของโครงการนำร่องตั้งค่างานนำเสนอให้',
  Audience: 'ผู้ชม', Mode: 'โหมด', Design: 'การออกแบบ', Preview: 'ตัวอย่าง', 'Skill tier': 'ระดับทักษะ', Theme: 'ธีม', 'Include a small journey map': 'ใส่แผนที่เส้นทางขนาดเล็ก', 'Lines to show': 'สายที่จะแสดง',
  'Three choices and a link: a polished page in about two minutes. Ended lines and reflections stay private unless': 'เลือกสามอย่างแล้วได้ลิงก์ ได้หน้าสวย ๆ ในราวสองนาที สายที่จบแล้วและบทสะท้อนคิดจะเป็นส่วนตัว เว้นแต่', 'publishes them.': 'จะเผยแพร่เอง',
  Layout: 'รูปแบบหน้า', 'Line order and narrative': 'ลำดับสายและการเล่าเรื่อง', 'Why this course': 'ทำไมถึงเลือกหลักสูตรนี้', 'Build your own site': 'สร้างเว็บไซต์ของคุณเอง',
  "Export this presentation's data through the read API and build any site you like with the starter files.": 'ส่งออกข้อมูลของงานนำเสนอนี้ผ่าน API สำหรับอ่าน แล้วสร้างเว็บไซต์แบบไหนก็ได้ด้วยไฟล์เริ่มต้น', Copy: 'คัดลอก', 'or call the endpoint.': 'หรือเรียก endpoint',
  'Start from': 'เริ่มจาก', 'Publish through the share system so links expire and log views.': 'เผยแพร่ผ่านระบบแบ่งปัน เพื่อให้ลิงก์มีวันหมดอายุและบันทึกการเปิดดู',
  'Tier 3 uses the same read API and visibility rules as Templates and Builder, so a hand-built site can never expose private data. The site itself becomes a portfolio station on the Computing line.': 'ระดับที่ 3 ใช้ API สำหรับอ่านและกฎการมองเห็นเดียวกับแม่แบบและตัวสร้าง เว็บไซต์ที่สร้างเองจึงไม่มีทางเปิดเผยข้อมูลส่วนตัว และเว็บไซต์นั้นจะเป็นสถานีหนึ่งบนสาย Computing',
  Publish: 'เผยแพร่', 'Your site is live': 'เว็บไซต์ของคุณออนไลน์แล้ว', at: 'ที่', '. Edits to index.html show up there straight away.': ' การแก้ไข index.html จะขึ้นที่นั่นทันที', 'Open my site': 'เปิดเว็บไซต์ของฉัน',
  'under a share link that expires and logs views.': 'ภายใต้ลิงก์แบ่งปันที่มีวันหมดอายุและบันทึกการเปิดดู', 'Publish my site': 'เผยแพร่เว็บไซต์ของฉัน', 'Back to editing': 'กลับไปแก้ไข', 'Compare two audiences': 'เปรียบเทียบผู้ชมสองกลุ่ม',
  'Show controls': 'แสดงตัวควบคุม', 'Hide controls': 'ซ่อนตัวควบคุม', 'custom page': 'หน้าแบบกำหนดเอง', 'Ended line: private by default': 'สายที่จบแล้ว: เป็นส่วนตัวโดยค่าเริ่มต้น', 'ended · private by default': 'จบแล้ว · เป็นส่วนตัวโดยค่าเริ่มต้น',
  Show: 'แสดง', 'Replace with a draft from my stations': 'แทนที่ด้วยฉบับร่างจากสถานีของฉัน', 'Draft from my stations': 'ร่างจากสถานีของฉัน', 'Publishes your index.html': 'เผยแพร่ index.html ของคุณ',
  'Publishes the starter index.html (edit or upload your own first if you like)': 'เผยแพร่ index.html เริ่มต้น (แก้ไขหรืออัปโหลดของคุณเองก่อนก็ได้)', 'template controls': 'ตัวควบคุมแม่แบบ',
  General: 'ทั่วไป', University: 'มหาวิทยาลัย', 'Specific university': 'มหาวิทยาลัยที่เจาะจง', Employer: 'นายจ้าง', Scholarship: 'ทุนการศึกษา', Custom: 'กำหนดเอง',
  'All active lines, balanced.': 'ทุกสายที่ยังดำเนินอยู่ อย่างสมดุล', 'Academic depth, independent projects and reflection. Minor clubs and routine classes collapse.': 'เน้นความลึกทางวิชาการ โครงงานที่ทำเอง และการสะท้อนคิด ชมรมเล็ก ๆ และวิชาประจำจะถูกย่อไว้',
  'Lines that match the target course in full; everything else becomes thin context.': 'สายที่ตรงกับหลักสูตรเป้าหมายแสดงเต็ม ที่เหลือเป็นบริบทแบบบาง', 'Projects, skills and responsibility. Grades are hidden by default.': 'โครงงาน ทักษะ และความรับผิดชอบ ซ่อนผลการเรียนไว้โดยค่าเริ่มต้น',
  'Service, impact and leadership as a timeline. Unrelated activities drop out.': 'บริการสังคม ผลกระทบ และภาวะผู้นำเป็นลำดับเวลา กิจกรรมที่ไม่เกี่ยวข้องจะไม่แสดง',
  'Design your own page: pick a theme or make one, add blocks, drag them into place and resize them. Verified stations can be placed, never edited.': 'ออกแบบหน้าของคุณเอง เลือกหรือสร้างธีม เพิ่มบล็อก ลากไปวางและปรับขนาด สถานีที่ยืนยันแล้ววางได้แต่แก้ไขไม่ได้',
  'School brand, for outside readers': 'แบรนด์โรงเรียน สำหรับผู้อ่านภายนอก', 'Bright, balanced': 'สดใส สมดุล', 'Calm, for universities': 'สงบ เหมาะกับมหาวิทยาลัย', 'Crisp, for employers': 'คมชัด เหมาะกับนายจ้าง', Dark: 'มืด',
  Profile: 'โปรไฟล์', Narrative: 'เล่าเรื่อง', CV: 'ประวัติย่อ', 'Project cards': 'การ์ดโครงงาน', 'Impact timeline': 'ลำดับเวลาผลกระทบ', 'Metro map': 'แผนที่รถไฟ',
  '1 · Template': '1 · แม่แบบ', 'From Year 7': 'ตั้งแต่ Year 7', '2 · Builder': '2 · ตัวสร้าง', 'Most students': 'นักเรียนส่วนใหญ่', '3 · Code': '3 · โค้ด', 'Students who code': 'นักเรียนที่เขียนโค้ด',
  'What changes': 'อะไรเปลี่ยนไป', 'that stay the same': 'รายการที่เหมือนเดิม', Grew: 'มากขึ้น', 'full on the right, thin on the left': 'เต็มทางขวา บางทางซ้าย', 'Only on the right': 'มีเฉพาะทางขวา', Faded: 'จางลง',
  'full on the left, thin on the right': 'เต็มทางซ้าย บางทางขวา', 'Only on the left': 'มีเฉพาะทางซ้าย', Moved: 'ย้ายที่', 'its line sits higher or lower': 'สายอยู่สูงขึ้นหรือต่ำลง', 'What changes between the two': 'อะไรต่างกันระหว่างสองแบบ',
  'Audience lens': 'มุมมองผู้ชม', 'Upload index.html': 'อัปโหลด index.html', 'Back to the starter': 'กลับไปที่ไฟล์เริ่มต้น', 'Download JSON': 'ดาวน์โหลด JSON', 'Live preview:': 'ตัวอย่างสด:',
  'index.html, sandboxed, with this data': 'index.html ในพื้นที่ปลอดภัย พร้อมข้อมูลนี้', 'the starter': 'ไฟล์เริ่มต้น', 'Rendered preview': 'ตัวอย่างที่แสดงผล', 'stations · publishable items only': 'สถานี · เฉพาะรายการที่เผยแพร่ได้', 'lines ·': 'สาย ·',
  // the inbox (src/components/IntegrationsPanel.jsx)
  'School systems': 'ระบบของโรงเรียน', 'one adapter each': 'ระบบละหนึ่งตัวเชื่อม', 'Student inbox': 'กล่องรับเข้าของนักเรียน', 'the student decides': 'นักเรียนเป็นคนเลือก', 'verified record': 'บันทึกที่ยืนยันแล้ว',
  'Connected systems': 'ระบบที่เชื่อมต่อ', 'Import a file': 'นำเข้าไฟล์', 'Simulate next week': 'จำลองสัปดาห์หน้า', 'Last synced': 'ซิงก์ล่าสุด', Items: 'รายการ', 'Not connected for': 'ยังไม่ได้เชื่อมต่อสำหรับ', Connect: 'เชื่อมต่อ',
  repos: 'คลังโค้ด', Sync: 'ซิงก์', 'Synced items wait here.': 'รายการที่ซิงก์มาจะรออยู่ที่นี่', 'chooses which line each one joins, or skips it.': 'เลือกว่าแต่ละรายการจะไปอยู่สายไหน หรือข้ามไป', 'Looks like a station you already have': 'ดูเหมือนสถานีที่คุณมีอยู่แล้ว',
  'Merging keeps your title, words and visibility, adds this record as evidence': 'การรวมจะเก็บชื่อเรื่อง ข้อความ และการมองเห็นของคุณไว้ และเพิ่มบันทึกนี้เป็นหลักฐาน', 'Merge them': 'รวมกัน', 'or add it as a separate station below': 'หรือเพิ่มเป็นสถานีแยกด้านล่าง',
  'Visible to': 'เห็นได้โดย', 'GitHub · opt-in': 'GitHub · เลือกเปิดเอง', 'Transit Portfolio wants to read': 'Transit Portfolio ขออ่าน', 'The names and descriptions of repositories you choose': 'ชื่อและคำอธิบายของคลังโค้ดที่คุณเลือก',
  'Releases, merged pull requests and commit counts in those repositories': 'รุ่นที่ออก pull request ที่รวมแล้ว และจำนวน commit ในคลังโค้ดเหล่านั้น', 'It can never': 'ไม่มีทาง', 'Read code in repositories you did not choose': 'อ่านโค้ดในคลังที่คุณไม่ได้เลือก',
  'Write to GitHub, or see private repositories you leave unticked': 'เขียนลง GitHub หรือดูคลังส่วนตัวที่คุณไม่ได้ติ๊ก', 'Signed in as': 'เข้าสู่ระบบในชื่อ', Authorise: 'อนุญาต', 'Choose which repositories to share': 'เลือกคลังโค้ดที่จะแบ่งปัน',
  'Only ticked repositories can send items to': 'เฉพาะคลังที่ติ๊กไว้เท่านั้นที่ส่งรายการไปยัง', Disconnect: 'ยกเลิกการเชื่อมต่อ', 'Syncing…': 'กำลังซิงก์…', 'syncing…': 'กำลังซิงก์…', 'Up to date': 'เป็นปัจจุบันแล้ว',
  'Connected, with nothing shared yet': 'เชื่อมต่อแล้ว แต่ยังไม่ได้แบ่งปันอะไร', 'GitHub disconnected': 'ยกเลิกการเชื่อมต่อ GitHub แล้ว', 'Press Sync to pull new items from the school systems.': 'กดซิงก์เพื่อดึงรายการใหม่จากระบบของโรงเรียน', 'Inbox clear.': 'กล่องรับเข้าว่างแล้ว',
  'Line (suggested, change if you like)': 'สาย (แนะนำให้ เปลี่ยนได้)', 'No line suggested: pick one, or skip it': 'ไม่มีสายที่แนะนำ เลือกเองหรือข้ามไป', 'Add as interchange': 'เพิ่มเป็นจุดเชื่อม', 'Add to map': 'เพิ่มลงแผนที่', 'Data flow': 'การไหลของข้อมูล',
  'Bring in your own records from a spreadsheet or a calendar file': 'นำบันทึกของคุณเองเข้ามาจากสเปรดชีตหรือไฟล์ปฏิทิน', 'Each connected system sends one new item, as if a school week had passed': 'ระบบที่เชื่อมต่อแต่ละระบบส่งรายการใหม่มาหนึ่งรายการ เหมือนผ่านไปหนึ่งสัปดาห์',
  LMS: 'LMS', CLB: 'CLB', GH: 'GH', EXM: 'EXM',
  // the leaver portfolio builder (src/components/Leaver.jsx); the portfolio itself stays English
  'One clear page of your best moments for university, scholarship or job applications. Pick what to show; nothing else from your map goes in.': 'หน้าเดียวที่รวมเรื่องราวดีที่สุดของคุณ สำหรับสมัครมหาวิทยาลัย ทุนการศึกษา หรืองาน เลือกเองว่าจะแสดงอะไร สิ่งอื่นบนแผนที่จะไม่ถูกใส่',
  'Start your portfolio': 'เริ่มทำแฟ้มผลงาน', 'It takes five short steps: a short profile, up to': 'มีห้าขั้นตอนสั้น ๆ: โปรไฟล์สั้น ๆ เรื่องราวดีที่สุดได้สูงสุด',
  'best moments, your skills, endorsements from teachers, and a look. Your advisor can read your draft and leave comments. Only you can change it.': 'เรื่อง ทักษะของคุณ คำรับรองจากครู และหน้าตาของแฟ้ม ครูที่ปรึกษาอ่านฉบับร่างและแสดงความคิดเห็นได้ มีแค่คุณที่แก้ไขได้',
  Practice: 'ฝึกทำ', 'Comments on your draft': 'ความคิดเห็นในฉบับร่างของคุณ', 'Next:': 'ถัดไป:', '· A4': '· A4', '1. A short profile': '1. โปรไฟล์สั้น ๆ', 'Your name': 'ชื่อของคุณ', 'Personal statement': 'เรียงความแนะนำตัว',
  'One paragraph: who you are, what you care about, what you want to do next.': 'หนึ่งย่อหน้า: คุณเป็นใคร ใส่ใจเรื่องอะไร และอยากทำอะไรต่อไป', 'Contact email': 'อีเมลติดต่อ', 'Optional. Readers with the link will see it.': 'ไม่บังคับ ผู้อ่านที่มีลิงก์จะเห็นอีเมลนี้',
  '2. Your best moments': '2. เรื่องราวดีที่สุดของคุณ', ', put the strongest first, and choose what to show with each.': ' เรียงเรื่องที่ดีที่สุดไว้ก่อน แล้วเลือกว่าจะแสดงอะไรกับแต่ละเรื่อง', 'Evidence to show': 'หลักฐานที่จะแสดง', 'No reflection': 'ไม่มีบทสะท้อนคิด',
  'Which part of the reflection': 'ส่วนไหนของบทสะท้อนคิด', 'From your map': 'จากแผนที่ของคุณ', Add: 'เพิ่ม', '3. Skills and qualities': '3. ทักษะและคุณลักษณะ',
  'These come from the tags on the moments you picked. Untick any you do not want to show. Change tags on your map.': 'มาจากแท็กของเรื่องราวที่คุณเลือก เอาติ๊กออกถ้าไม่อยากแสดง เปลี่ยนแท็กได้ที่แผนที่ของคุณ', 'No tags yet. Pick moments first, or tag them on your map.': 'ยังไม่มีแท็ก เลือกเรื่องราวก่อน หรือติดแท็กบนแผนที่ของคุณ',
  moments: 'เรื่องราว', '4. Endorsements': '4. คำรับรอง', 'What teachers wrote when they endorsed your moments. Only endorsements on moments you show the school or beyond can go in.': 'สิ่งที่ครูเขียนตอนรับรองเรื่องราวของคุณ ใส่ได้เฉพาะคำรับรองในเรื่องที่โรงเรียนหรือคนนอกเห็นได้',
  'None yet. Ask a teacher to endorse a moment from your map.': 'ยังไม่มี ขอให้ครูรับรองเรื่องราวจากแผนที่ของคุณ', '5. Look and share': '5. หน้าตาและการแบ่งปัน', Template: 'แม่แบบ', 'Download PDF': 'ดาวน์โหลด PDF',
  '(top right) saves an A4 copy to attach to an application.': '(มุมขวาบน) บันทึกสำเนาขนาด A4 ไว้แนบกับใบสมัคร', 'Web page': 'หน้าเว็บ', 'A link shows only this portfolio, never the rest of your map. Withdraw it any time and it stops working at once.': 'ลิงก์จะแสดงเฉพาะแฟ้มผลงานนี้ ไม่แสดงส่วนอื่นของแผนที่ ยกเลิกเมื่อไรก็ได้และจะใช้ไม่ได้ทันที',
  'Who is it for?': 'สำหรับใคร', 'Optional, only you see this': 'ไม่บังคับ มีแค่คุณที่เห็น', 'Works for': 'ใช้ได้', 'Make a link': 'สร้างลิงก์', 'Pick at least one moment first.': 'เลือกอย่างน้อยหนึ่งเรื่องก่อนนะ', Withdraw: 'ยกเลิก',
  Moments: 'เรื่องราว', Skills: 'ทักษะ', 'Look and share': 'หน้าตาและการแบ่งปัน', Withdrawn: 'ยกเลิกแล้ว', 'Portfolio started': 'เริ่มทำแฟ้มผลงานแล้ว', 'Marked done': 'ทำเครื่องหมายว่าเสร็จแล้ว', 'Photo added': 'เพิ่มรูปแล้ว',
  'Change photo': 'เปลี่ยนรูป', 'Add a photo (optional)': 'เพิ่มรูป (ไม่บังคับ)', 'Photo removed': 'ลบรูปแล้ว', 'Every moment you can use is picked.': 'เลือกทุกเรื่องที่ใช้ได้แล้ว', 'Add moments to your map first. Moments you keep private do not show here.': 'เพิ่มเรื่องราวลงแผนที่ก่อน เรื่องที่เป็นส่วนตัวจะไม่แสดงที่นี่',
  'Link ready': 'ลิงก์พร้อมแล้ว', 'Link withdrawn. It no longer opens.': 'ยกเลิกลิงก์แล้ว เปิดไม่ได้อีก', Steps: 'ขั้นตอน', 'I am a Year 13 student who…': 'ฉันเป็นนักเรียน Year 13 ที่…', 'e.g. UCL admissions': 'เช่น ฝ่ายรับสมัคร UCL',
  'NIST navy classic': 'NIST สีกรมท่าคลาสสิก', Minimal: 'เรียบง่าย', 'Two columns': 'สองคอลัมน์', 'Best moments': 'เรื่องราวดีที่สุด', 'No moments picked yet.': 'ยังไม่ได้เลือกเรื่องราว', '· NIST International School': '· โรงเรียนนานาชาติ NIST',
  'Leaver portfolio · draft · read only': 'แฟ้มผลงานก่อนจบ · ฉบับร่าง · อ่านอย่างเดียว', 'No comments yet.': 'ยังไม่มีความคิดเห็น',
  // subject prompts a student meets (src/components/SubjectPrompts.jsx)
  'Ideas for this line': 'ไอเดียสำหรับสายนี้', 'Ideas for every student': 'ไอเดียสำหรับนักเรียนทุกคน', 'See an example': 'ดูตัวอย่าง', 'Written by a teacher': 'เขียนโดยครู', 'Starters:': 'ประโยคเริ่มต้น:',
  'They would see its title, what you wrote about it and your Year, never your name. You can say no.': 'นักเรียนคนอื่นจะเห็นชื่อเรื่อง สิ่งที่คุณเขียน และ Year ของคุณ แต่ไม่เห็นชื่อคุณ คุณปฏิเสธได้', 'Yes, show it': 'ได้ แสดงเลย', 'No thanks': 'ไม่เป็นไร',
  // the archive download on Privacy (src/screens/Privacy.jsx)
  'Download my archive: my journey as a PDF, my files and my data (ZIP)': 'ดาวน์โหลดคลังของฉัน: เส้นทางของฉันเป็น PDF ไฟล์ของฉัน และข้อมูลของฉัน (ZIP)',
  'Saved: a ZIP with my-journey.pdf (every moment and reflection, by line and date), your photos, documents and voice notes, your leaver portfolio if you made one, a copy of your data and a README.': 'บันทึกแล้ว: ไฟล์ ZIP ที่มี my-journey.pdf (ทุกเรื่องราวและการสะท้อนคิด เรียงตามสายและวันที่) รูปภาพ เอกสาร และบันทึกเสียงของคุณ แฟ้มผลงานก่อนจบถ้าคุณทำไว้ สำเนาข้อมูลของคุณ และไฟล์ README',
  // CAS hours, Years 12 and 13 (src/components/Cas.jsx); LO stays as the IB writes it
  'CAS · Creativity, Activity, Service': 'CAS · ความคิดสร้างสรรค์ กิจกรรม การบริการ', 'My CAS': 'CAS ของฉัน',
  'Log each experience once, then add hours as you go. Name who supervised, so they can confirm your hours. Each experience is a station on your CAS line.': 'บันทึกแต่ละประสบการณ์ครั้งเดียว แล้วเพิ่มชั่วโมงไปเรื่อย ๆ ระบุผู้ดูแล เพื่อให้เขายืนยันชั่วโมงของคุณได้ แต่ละประสบการณ์เป็นสถานีหนึ่งบนสาย CAS ของคุณ',
  'hours confirmed': 'ชั่วโมงที่ยืนยันแล้ว', 'hours waiting': 'ชั่วโมงที่รอยืนยัน', 'What you have covered': 'สิ่งที่คุณทำครบแล้ว', ': not yet': ': ยังไม่ครบ', ': covered': ': ครบแล้ว',
  'Creativity (C)': 'ความคิดสร้างสรรค์ (C)', 'Activity (A)': 'กิจกรรม (A)', 'Service (S)': 'การบริการ (S)',
  'Log a new experience': 'บันทึกประสบการณ์ใหม่', 'Nothing yet. Log your first experience: a club, a sport, a project, or helping in the community.': 'ยังไม่มีอะไร บันทึกประสบการณ์แรกของคุณ: ชมรม กีฬา โครงงาน หรือการช่วยเหลือชุมชน',
  'A new CAS experience': 'ประสบการณ์ CAS ใหม่', Name: 'ชื่อ', Strand: 'ด้าน', Started: 'เริ่ม', Ends: 'สิ้นสุด', optional: 'ไม่บังคับ', 'Learning outcomes it shows': 'ผลการเรียนรู้ที่แสดง', 'pick any': 'เลือกได้หลายข้อ',
  'What is it?': 'คืออะไร', 'what did you learn or notice?': 'คุณได้เรียนรู้หรือสังเกตเห็นอะไร', Evidence: 'หลักฐาน', 'Add a photo or file': 'เพิ่มรูปภาพหรือไฟล์',   'A link': 'ลิงก์', 'Log hours now': 'บันทึกชั่วโมงตอนนี้', 'Save experience': 'บันทึกประสบการณ์',   'Your advisor, your CAS coordinator and the supervisor you name can see this. It is never private.': 'ครูที่ปรึกษา ผู้ประสานงาน CAS และผู้ดูแลที่คุณระบุจะเห็นสิ่งนี้ ไม่เป็นส่วนตัว',
  'e.g. Coaching junior football': 'เช่น สอนฟุตบอลให้น้อง ๆ', 'e.g. Coached the Under-11s on Saturday': 'เช่น ฝึกทีมรุ่นอายุไม่เกิน 11 ปีเมื่อวันเสาร์', 'e.g. Khun Somchai Dee': 'เช่น คุณสมชาย ดี',
  Hours: 'ชั่วโมง', 'Who supervised?': 'ใครเป็นผู้ดูแล', 'A member of staff': 'บุคลากรของโรงเรียน', 'Someone outside school': 'บุคคลภายนอกโรงเรียน',
  'Nobody to name': 'ไม่มีผู้ให้ระบุ', 'Member of staff': 'บุคลากร', 'Choose a person': 'เลือกบุคคล', 'Their name': 'ชื่อของเขา', 'Their email': 'อีเมลของเขา',
  'They get no email. When you meet them, show them your confirmation code (or print it). They confirm with this email address.': 'เขาจะไม่ได้รับอีเมล เมื่อพบกัน ให้แสดงรหัสยืนยันของคุณ (หรือพิมพ์ออกมา) เขายืนยันด้วยอีเมลนี้',
  'Your CAS coordinator will check and confirm these hours.': 'ผู้ประสานงาน CAS จะตรวจและยืนยันชั่วโมงเหล่านี้',
  'No supervisor named: your CAS coordinator confirms': 'ไม่ได้ระบุผู้ดูแล: ผู้ประสานงาน CAS เป็นผู้ยืนยัน', Waiting: 'รอยืนยัน', Confirmed: 'ยืนยันแล้ว', 'Sent back': 'ส่งกลับ',
  'On my map': 'บนแผนที่ของฉัน', 'Show code': 'แสดงรหัส', 'Take back': 'ถอนคืน', 'Hours taken back': 'ถอนชั่วโมงคืนแล้ว', 'Log more hours': 'บันทึกชั่วโมงเพิ่ม',
  'Log hours': 'บันทึกชั่วโมง', 'Add reflection': 'เพิ่มการสะท้อนคิด', 'Reflection added': 'เพิ่มการสะท้อนคิดแล้ว', 'Reflection on': 'การสะท้อนคิดเรื่อง',
  'Last reflection': 'การสะท้อนคิดล่าสุด', 'CAS reflection': 'การสะท้อนคิด CAS', Print: 'พิมพ์', Close: 'ปิด', 'Making a code…': 'กำลังสร้างรหัส…',
  // search (src/components/Search.jsx)
  'Search your portfolio': 'ค้นหาในแฟ้มผลงานของฉัน', 'Find something I did': 'หาสิ่งที่ฉันเคยทำ', 'Find something I did (/)': 'หาสิ่งที่ฉันเคยทำ (/)',
  'Nothing matches': 'ไม่พบสิ่งที่ค้นหา', Goals: 'เป้าหมาย', "Teachers' notes": 'บันทึกจากครู',   'Any type': 'ทุกประเภท', 'Any line': 'ทุกสาย', 'Any time': 'ทุกช่วงเวลา', Lately: 'ช่วงนี้', 'My lines': 'สายของฉัน',
  'Nothing on your map yet. Add your first thing and it will show up here.': 'ยังไม่มีอะไรบนแผนที่ของคุณ เพิ่มเรื่องแรกแล้วจะแสดงที่นี่',
  'Type a word instead': 'พิมพ์คำแทน', '‹ All my things': '‹ ทุกอย่างของฉัน', 'Nothing on this line yet.': 'สายนี้ยังไม่มีอะไร', 'Type a word': 'พิมพ์คำ',
  'Type a word to find': 'พิมพ์คำที่จะค้นหา', '‹ Back to my recent things': '‹ กลับไปที่เรื่องล่าสุดของฉัน', 'Add a word or a filter to narrow it.': 'เพิ่มคำหรือตัวกรองเพื่อให้แคบลง',
  'OK, it stays as it was.': 'ได้เลย ยังเหมือนเดิม', 'Can your moment be an example?': 'ขอใช้เรื่องราวของคุณเป็นตัวอย่างได้ไหม', 'would like to show your moment “': 'อยากแสดงเรื่องราว “', '” to other students': '” ของคุณให้นักเรียนคนอื่นดู', 'as an example.': 'เป็นตัวอย่าง',
};
const D = (s) => thaiDates(s);
const CAS_TH = { Creativity: 'ความคิดสร้างสรรค์', Activity: 'กิจกรรม', Service: 'การบริการ' }; // the CAS strands (not the Activity page)
// [pattern, (match, t) => Thai]; t() gives the Thai of a part that is itself interface text, else the part as written.
const STU_RE = [
  [/^([\d.]+) hours?$/, (m) => `${m[1]} ชั่วโมง`],
  [/^([\d.]+) hours? logged, waiting to be confirmed$/, (m) => `บันทึก ${m[1]} ชั่วโมงแล้ว รอการยืนยัน`],
  [/^Added “(.+)” to your CAS line(?:, with ([\d.]+) hours? waiting to be confirmed)?$/, (m) => `เพิ่ม “${m[1]}” ในสาย CAS แล้ว${m[2] ? ` มี ${m[2]} ชั่วโมงรอการยืนยัน` : ''}`],
  [/^(Creativity|Activity|Service) · (.+?)(?: to (.+?))? · ([\d.]+) hours confirmed(?:, ([\d.]+) waiting)?$/, (m) => `${CAS_TH[m[1]]} · ${D(m[2])}${m[3] ? ` ถึง ${D(m[3])}` : ''} · ยืนยันแล้ว ${m[4]} ชั่วโมง${m[5] ? ` รอ ${m[5]} ชั่วโมง` : ''}`],
  [/^(Creativity|Activity|Service): (\d+)$/, (m) => `${CAS_TH[m[1]]}: ${m[2]}`],
  [/^LO\d .+( · LO\d .+)*$/, (m, t) => m[0].split(' · ').map((x) => { const [, n, o] = x.match(/^(LO\d) (.+)$/); return `${n} ${t(o)}`; }).join(' · ')],
  [/^Show this to (.+), or print it\.$/, (m) => `แสดงสิ่งนี้ให้ ${m[1]} ดู หรือพิมพ์ออกมา`],
  [/^More hours for (.+)$/, (m) => `ชั่วโมงเพิ่มสำหรับ ${m[1]}`],
  [/^Showing the best (\d+) of (\d+)\. Add a word or a filter to narrow it\.$/, (m) => `แสดง ${m[1]} รายการที่ตรงที่สุดจาก ${m[2]} รายการ เพิ่มคำหรือตัวกรองเพื่อให้แคบลง`],
  [/^Your journey has (\d+) moments? so far\.$/, (m) => `ตอนนี้เส้นทางของคุณมี ${m[1]} เรื่องราวแล้ว`],
  [/^What was the best part of “(.+)”\?$/, (m) => `ส่วนที่ดีที่สุดของ “${m[1]}” คืออะไร`],
  [/^What did “(.+)” teach you\?$/, (m) => `“${m[1]}” สอนอะไรคุณบ้าง`],
  [/^“(.+)” is on your journey as a dashed stop\.(?: You asked (.+) to help\.)?$/, (m) => `“${m[1]}” อยู่บนเส้นทางของคุณเป็นจุดเส้นประแล้ว${m[2] ? ` คุณขอให้ ${m[2]} ช่วยแล้ว` : ''}`],
  [/^(Nice one!|Great work!|Added!) “(.+)” is on your journey\.(?: You asked (.+) to check it\.)?$/, (m, t) => `${t(m[1])} “${m[2]}” อยู่บนเส้นทางของคุณแล้ว${m[3] ? ` คุณขอให้ ${m[3]} ตรวจแล้ว` : ''}`],
  [/^(Nice one!|Great work!|Added!) “(.+)” is a real stop on your journey now\.(?: (.+) can check it\.)?$/, (m, t) => `${t(m[1])} ตอนนี้ “${m[2]}” เป็นสถานีจริงบนเส้นทางของคุณแล้ว${m[3] ? ` ${m[3]} ตรวจได้เลย` : ''}`],
  [/^“(.+)” is off your journey\.$/, (m) => `เอา “${m[1]}” ออกจากเส้นทางแล้ว`],
  [/^Waiting for (.+) to say yes$/, (m) => `รอ ${m[1]} ตอบรับ`],
  [/^(.+) is helping you$/, (m) => `${m[1]} กำลังช่วยคุณ`],
  [/^(.+) can't help this time$/, (m) => `ครั้งนี้ ${m[1]} ช่วยไม่ได้`],
  [/^Waiting for (.+)$/, (m) => `รอ ${m[1]}`],
  [/^(.+) asked for more$/, (m) => `${m[1]} ขอข้อมูลเพิ่ม`],
  [/^You planned it for (.+)$/, (m) => `คุณวางแผนไว้วันที่ ${D(m[1])}`],
  [/^By (\d.+)$/, (m) => `ภายใน ${D(m[1])}`],
  [/^Who sees (.+)$/, (m) => `ใครเห็น ${m[1]} ได้บ้าง`],
  [/^Planned: (.+), by (\d.+)$/, (m) => `วางแผนไว้: ${m[1]} ภายใน ${D(m[2])}`],
  [/^Planned: (.+)$/, (m) => `วางแผนไว้: ${m[1]}`],
  [/^Step (\d+) of (\d+)$/, (m) => `ขั้นที่ ${m[1]} จาก ${m[2]}`],
  [/^Question (\d+) of (\d+)$/, (m) => `คำถามที่ ${m[1]} จาก ${m[2]}`],
  [/^Notifications, (\d+) unread$/, (m) => `การแจ้งเตือน ยังไม่ได้อ่าน ${m[1]} รายการ`],
  [/^Interface set to (simple|standard|full)\. Your map and everything on it stay the same\.$/, (m, t) => `เปลี่ยนเป็น${t(m[1][0].toUpperCase() + m[1].slice(1))}แล้ว แผนที่และทุกอย่างบนแผนที่ยังเหมือนเดิม`],
  [/^Undone, but (\d+) later changes? could not be kept\.$/, (m) => `เลิกทำแล้ว แต่เก็บการแก้ไขที่ทำทีหลังไว้ไม่ได้ ${m[1]} รายการ`],
  [/^(.+), (\d{1,2} \w{3} \d{4})$/, (m) => `${m[1]}, ${D(m[2])}`],
  [/^(.+), (.+), (\d{4})-(\d\d)-(\d\d), (Student-added|Teacher-endorsed|School-verified|goal)((?:, [^,]+)*)$/, (m, t) => `${m[1]}, ${m[2]}, ${D(`${+m[5]} ${MON_EN[+m[4] - 1]} ${m[3]}`)}, ${t(m[6])}${m[7].split(', ').slice(1).map((x) => `, ${t(x)}`).join('')}`],
  [/^Metro map for (.+)$/, (m) => `แผนที่รถไฟของ ${m[1]}`], [/^Mini map for (.+)$/, (m) => `แผนที่ย่อของ ${m[1]}`], [/^Metro map poster for (.+)$/, (m) => `โปสเตอร์แผนที่ของ ${m[1]}`],
  [/^Reflection signal: (.+)$/, (m) => `สัญญาณให้สะท้อนคิด: ${m[1]}`],
  [/^Year (\d+), Term (\d)$/, (m) => `Year ${m[1]} ภาคเรียนที่ ${m[2]}`], [/^University year (\d+), Term (\d)$/, (m) => `มหาวิทยาลัยปี ${m[1]} ภาคเรียนที่ ${m[2]}`],
  [/^in (\d+) days?$/, (m) => `อีก ${m[1]} วัน`], [/^(\d+) days? ago$/, (m) => `เมื่อ ${m[1]} วันก่อน`],
  [/^Added “(.+)”\. Endorsement requested\.$/, (m) => `เพิ่ม “${m[1]}” แล้ว ส่งคำขอรับรองแล้ว`], [/^Added “(.+)”$/, (m) => `เพิ่ม “${m[1]}” แล้ว`],
  [/^Added “(.+)” to the map$/, (m) => `เพิ่ม “${m[1]}” ลงแผนที่แล้ว`],
  [/^Planned “(.+)”\. Sponsor invited\.$/, (m) => `วางแผน “${m[1]}” แล้ว เชิญครูผู้ดูแลแล้ว`], [/^Planned “(.+)”\.?$/, (m) => `วางแผน “${m[1]}” แล้ว`],
  [/^(\d+) open signals?$/, (m) => `สัญญาณที่ยังเปิดอยู่ ${m[1]} รายการ`], [/^(\d+) match(es)?$/, (m) => `ตรงกัน ${m[1]} รายการ`],
  [/^Filters · (\d+)$/, (m) => `ตัวกรอง · ${m[1]}`], [/^(Inquirer|Knowledgeable|Thinker|Communicator|Principled|Open-minded|Caring|Risk-taker|Balanced|Reflective) moments$/, (m, t) => `เรื่องราวที่แสดงความเป็น${t(m[1])}`],
  [/^Open (.+) full size$/, (m) => `เปิด ${m[1]} แบบเต็มจอ`], [/^Post an update for (.+)$/, (m) => `โพสต์อัปเดตถึง ${m[1]}`],
  [/^Resubmitted to (.+)$/, (m) => `ส่งใหม่ถึง ${m[1]} แล้ว`], [/^Asked (.+) to endorse it$/, (m) => `ขอให้ ${m[1]} รับรองแล้ว`],
  [/^\(first added by (.+)\)$/, (m, t) => `(เพิ่มครั้งแรกโดย ${t(m[1])})`],
  // check-ins
  [/^Check in on (.+)$/, (m) => `อัปเดตเป้าหมาย ${m[1]}`], [/^Ask me again in (\d+) weeks$/, (m) => `ถามฉันอีกครั้งในอีก ${m[1]} สัปดาห์`],
  [/^Thanks\. Being stuck is normal\. Your advisor can see “(.+)” and can help\.$/, (m) => `ขอบคุณนะ การติดอยู่เป็นเรื่องปกติ ครูที่ปรึกษาเห็น “${m[1]}” และช่วยคุณได้`],
  [/^Saved your check-in on “(.+)”\.$/, (m) => `บันทึกการอัปเดต “${m[1]}” แล้ว`], [/^No more check-ins on “(.+)” for (\d+) weeks\.$/, (m) => `จะไม่ถามเรื่อง “${m[1]}” อีก ${m[2]} สัปดาห์`],
  [/^· Next step: (.+)$/, (m) => `· ขั้นต่อไป: ${m[1]}`], [/^Next step: (.+)$/, (m) => `ขั้นต่อไป: ${m[1]}`],
  // tasks and class questions
  [/^due (today|tomorrow|\w+day|\d.+)$/, (m) => `ส่ง${dueTh(m[1])}`], [/^Due (today|tomorrow|\w+day|\d.+)$/, (m) => `ส่ง${dueTh(m[1])}`], [/^was due (.+)$/, (m) => `ครบกำหนดเมื่อ ${D(m[1])}`],
  [/^Late: (?:was due|due) (.+)$/, (m) => `ส่งช้า: ครบกำหนด ${dueTh(m[1])}`], [/^It (?:was due|is due) (.+?)\.?$/, (m) => `ครบกำหนดส่ง${dueTh(m[1])}`], [/^It is due (.+)\.$/, (m) => `ครบกำหนดส่ง${dueTh(m[1])}`],
  [/^(.+) set a task$/, (m) => `${m[1]} มอบหมายงาน`], [/^set a task for$/, () => 'มอบหมายงานให้'], [/^Hand in (.+)$/, (m) => `ส่งงาน ${m[1]}`], [/^Add more to (.+)$/, (m) => `เพิ่มเติมงาน ${m[1]}`],
  [/^Handed in\. (.+) can see it now\.$/, (m) => `ส่งแล้ว ตอนนี้ ${m[1]} เห็นงานแล้ว`], [/^(.+) asked for one\.$/, (m) => `${m[1]} ขอให้แนบด้วย`], [/^And (\d+) more tasks?\.$/, (m) => `และงานอีก ${m[1]} ชิ้น`],
  [/^It is on your (.*) line now, waiting for (.+) to check it\.$/, (m) => `ตอนนี้อยู่บนสาย ${m[1]} ของคุณแล้ว รอ ${m[2]} ตรวจ`],
  [/^Sent\. (.+) can read your answer\.$/, (m) => `ส่งแล้ว ${m[1]} อ่านคำตอบของคุณได้`], [/^(.+) can read your answer\. It is on your journey too\.$/, (m) => `${m[1]} อ่านคำตอบของคุณได้ และคำตอบอยู่บนเส้นทางของคุณด้วย`],
  [/^· answer by (.+)$/, (m) => `· ตอบภายใน ${D(m[1])}`],
  // term reflection
  [/^Your (.+) is waiting\. Pick the moments you are proud of: it takes about 10 minutes\.$/, (m) => `${m[1]} รอคุณอยู่ เลือกเรื่องราวที่คุณภูมิใจ ใช้เวลาประมาณ 10 นาที`],
  [/^(.+) reminded you · $/, (m) => `${m[1]} เตือนคุณ · `], [/^\(by (.+)\)$/, (m) => `(ภายใน ${D(m[1])})`], [/^Opens (\d.+)$/, (m) => `เปิด ${D(m[1])}`],
  // milestones
  [/^First moment on (.+)$/, (m) => `เรื่องราวแรกบนสาย ${m[1]}`], [/^(\d+) moments$/, (m) => `${m[1]} เรื่องราว`], [/^Steady on (.+)$/, (m) => `ทำต่อเนื่องบนสาย ${m[1]}`],
  [/^Your first moment on (.+)\.$/, (m) => `เรื่องราวแรกของคุณบนสาย ${m[1]}`], [/^(\d+) moments on your journey!$/, (m) => `มี ${m[1]} เรื่องราวบนเส้นทางของคุณแล้ว!`],
  [/^(.+) checked “(.+)”\.$/, (m, t) => `${t(m[1])} ตรวจ “${m[2]}” แล้ว`], [/^You did “(.+)”, the first goal you planned\.$/, (m) => `คุณทำ “${m[1]}” ได้แล้ว เป็นเป้าหมายแรกที่คุณวางแผนไว้`],
  [/^You added to (.+) in (\d+) different months\.$/, (m) => `คุณเพิ่มเรื่องราวบนสาย ${m[1]} มาแล้ว ${m[2]} เดือน`], [/^You added “(.+)”, which a teacher spotted\.$/, (m) => `คุณเพิ่ม “${m[1]}” ที่ครูสังเกตเห็นแล้ว`],
  [/^Show all (\d+)$/, (m) => `แสดงทั้งหมด ${m[1]} รายการ`], [/^And (\d+) more\.$/, (m) => `และอีก ${m[1]} รายการ`],
  // kind feedback, comments, spotted, reports
  [/^(I liked how|This made me think about|A question I have|You could try) (.+)$/, (m) => `${{ 'I liked how': 'ฉันชอบที่', 'This made me think about': 'เรื่องนี้ทำให้ฉันคิดถึง', 'A question I have': 'คำถามที่ฉันมีคือ', 'You could try': 'ลองดูไหม:' }[m[1]]} ${m[2]}`],
  [/^Sent to (.+)\.$/, (m) => `ส่งถึง ${m[1]} แล้ว`], [/^Sent to (.+)$/, (m) => `ส่งถึง ${m[1]} แล้ว`], [/^Kind feedback for (.+)$/, (m) => `คำติชมดี ๆ ถึง ${m[1]}`], [/^(.+) will see your thank you\.$/, (m) => `${m[1]} จะเห็นคำขอบคุณของคุณ`],
  [/^(\d+) new comments?$/, (m) => `ความคิดเห็นใหม่ ${m[1]} รายการ`], [/^Ask a question or say more about it\. (.+) can read it\.$/, (m) => `ถามคำถามหรือเล่าเพิ่มเติมได้ ${m[1]} อ่านได้`],
  [/^Write back to (.+)$/, (m) => `ตอบกลับ ${m[1]}`], [/^Write to (.+)$/, (m) => `เขียนถึง ${m[1]}`], [/^Comment for (.+)$/, (m) => `ความคิดเห็นถึง ${m[1]}`],
  [/^(.+) spotted something you did$/, (m) => `${m[1]} สังเกตเห็นสิ่งที่คุณทำ`], [/^On (.+)$/, (m) => `บนสาย ${m[1]}`], [/^Added to your journey(?: on (.+))?\.?$/, (m) => `เพิ่มลงเส้นทางของคุณแล้ว${m[1] ? ` บนสาย ${m[1]}` : ''}`],
  [/^A teacher has hidden this (comment|moment) while they look at it\. Only you and school staff can see it now\.$/, (m) => `ครูซ่อน${m[1] === 'comment' ? 'ความคิดเห็น' : 'เรื่อง'}นี้ไว้ระหว่างตรวจดู ตอนนี้มีแค่คุณกับบุคลากรของโรงเรียนที่เห็น`],
  [/^Voice note (\d\d\.\d\d)/, (m) => `ข้อความเสียง ${m[1]}`], [/^Stop recording · (.+)$/, (m) => `หยุดอัด · ${m[1]}`], [/^Remove (.+)$/, (m) => `ลบ ${m[1]}`],
  [/^(.+) says hello$/, (m) => `${m[1]} ทักทายคุณ`], [/^“(.+)” is now on for (.+)$/, (m) => `ตอนนี้ “${m[1]}” ตั้งไว้ถึง ${D(m[2])}`],
  // term in review, branches, poster, share links
  [/^Term (\d) · since$/, (m) => `ภาคเรียนที่ ${m[1]} · ตั้งแต่`], [/^(\d+) new stations?$/, (m) => `สถานีใหม่ ${m[1]} แห่ง`], [/^(\d+) reflections?$/, (m) => `บทสะท้อนคิด ${m[1]} บท`],
  [/^“(.+)” now also sits on (.+)$/, (m) => `ตอนนี้ “${m[1]}” อยู่บนสาย ${m[2]} ด้วย`], [/^Branched “(.+)”\. A signal asks why you started it\.$/, (m) => `แยกสายย่อย “${m[1]}” แล้ว จะมีสัญญาณถามว่าทำไมคุณถึงเริ่ม`],
  [/^(.+) approves$/, (m) => `${m[1]} จะอนุมัติ`],
  [/^Year (\d+) to Year 13(, and after)? · (\d{4})–(\d{4})$/, (m) => `Year ${m[1]} ถึง Year 13${m[2] ? ' และหลังจากนั้น' : ''} · ${yearTh(m[3])}–${yearTh(m[4])}`], [/^· Class of (\d{4})$/, (m) => `· รุ่นปี ${yearTh(m[1])}`],
  [/^QR code for (.+)$/, (m) => `คิวอาร์โค้ดสำหรับ ${m[1]}`],
  [/^(\d+) days left$/, (m) => `เหลือ ${m[1]} วัน`], [/^Created share link (\/s\/\S+) for “(.+)”$/, (m) => `สร้างลิงก์แบ่งปัน ${m[1]} สำหรับ “${m[2]}” แล้ว`], [/^Link created: (\S+)$/, (m) => `สร้างลิงก์แล้ว: ${m[1]}`],
  [/^Extended (\S+) by 30 days$/, (m) => `ต่ออายุ ${m[1]} อีก 30 วันแล้ว`], [/^Switched (\S+) back on$/, (m) => `เปิดใช้ ${m[1]} อีกครั้งแล้ว`], [/^Switched off (\S+)$/, (m) => `ปิดใช้ ${m[1]} แล้ว`],
  [/^(\S+) no longer asks for an email$/, (m) => `${m[1]} ไม่ขออีเมลแล้ว`], [/^(\S+) now asks readers for an email$/, (m) => `ตอนนี้ ${m[1]} ขออีเมลผู้อ่านแล้ว`],
  [/^(\d+) stations? made publishable$/, (m) => `ตั้งให้เผยแพร่ได้ ${m[1]} สถานีแล้ว`], [/^“(.+)” is now publishable$/, (m) => `ตอนนี้ “${m[1]}” เผยแพร่ได้แล้ว`], [/^(\d+) stations?$/, (m) => `${m[1]} สถานี`],
  [/^Every station on (.+) is now (private|advisor only|school|publishable)\.$/, (m) => `ทุกสถานีบนสาย ${m[1]} ตอนนี้${{ private: 'เป็นส่วนตัว', 'advisor only': 'เห็นได้เฉพาะครูที่ปรึกษา', school: 'เห็นได้ทั้งโรงเรียน', publishable: 'เผยแพร่ได้' }[m[2]]}แล้ว`],
  [/^(.+)'s inbox$/, (m) => `กล่องรับเข้าของ ${m[1]}`], [/^Preview (.+) in (\d{4}), two years after NIST$/, (m) => `ดูตัวอย่าง ${m[1]} ในปี ${yearTh(m[2])} สองปีหลังจาก NIST`],
  // the activity log (src/api.js log(), shown with a small first letter)
  [/^[Aa]dded “(.+)”(?: \((.+)\))?$/, (m) => `เพิ่ม “${m[1]}”${m[2] ? ` (${m[2]})` : ''}`], [/^[Ee]dited “(.+)”$/, (m) => `แก้ไข “${m[1]}”`], [/^[Dd]eleted “(.+)”$/, (m) => `ลบ “${m[1]}”`],
  [/^[Pp]icked (\d+) starter lines and the “(.+)” template$/, (m) => `เลือกสายแรกเริ่ม ${m[1]} สาย และแบบ “${m[2]}”`], [/^[Ss]et the interface to (\w+)$/, (m, t) => `เปลี่ยนหน้าตาแอปเป็น${t(m[1][0].toUpperCase() + m[1].slice(1))}`],
  [/^[Cc]hanged “(.+)” from (\w+) to (\w+)$/, (m) => `เปลี่ยนการมองเห็น “${m[1]}” จาก ${VIS_TH[m[2]] || m[2]} เป็น ${VIS_TH[m[3]] || m[3]}`],
  [/^[Aa]sked (.+) to endorse “(.+)”$/, (m) => `ขอให้ ${m[1]} รับรอง “${m[2]}”`], [/^[Ee]ndorsed “(.+)”$/, (m) => `รับรอง “${m[1]}”`], [/^[Cc]ommented on “(.+)”$/, (m) => `แสดงความคิดเห็นใน “${m[1]}”`],
  [/^[Aa]dded a reflection on “(.+)” \((\w+)\)$/, (m) => `เพิ่มบทสะท้อนคิดใน “${m[1]}” (${VIS_TH[m[2]] || m[2]})`], [/^[Pp]lanned “(.+)” for (\d{4}-\d\d-\d\d)(, with an advisor check-in)?$/, (m) => `วางแผน “${m[1]}” ไว้วันที่ ${D(fmtDate(m[2]))}${m[3] ? ' โดยให้ครูที่ปรึกษาติดตาม' : ''}`],
  [/^[Cc]hecked in on “(.+)”: (.+)$/, (m, t) => `อัปเดต “${m[1]}”: ${t(m[2])}`], [/^[Mm]arked the goal “(.+)” as done$/, (m) => `ทำเป้าหมาย “${m[1]}” สำเร็จ`], [/^[Cc]losed the goal “(.+)”$/, (m) => `ปิดเป้าหมาย “${m[1]}”`],
  [/^[Aa]nswered “(.+)”$/, (m) => `ตอบ “${m[1]}”`], [/^[Ff]inished “(.+)”$/, (m) => `ทำ “${m[1]}” เสร็จ`], [/^[Hh]anded in “(.+)” again$/, (m) => `ส่ง “${m[1]}” อีกครั้ง`], [/^[Vv]iewed share link (\S+)$/, (m) => `เปิดดูลิงก์แบ่งปัน ${m[1]}`],
  [/^[Aa]ccepted “(.+)” from the inbox$/, (m) => `รับ “${m[1]}” จากกล่องรับเข้า`], [/^[Bb]ranched “(.+)” from (.+)$/, (m) => `แยกสายย่อย “${m[1]}” จาก ${m[2]}`], [/^[Ee]nded the (.+) line( \(its stations are now advisor-only\))?$/, (m) => `จบสาย ${m[1]}${m[2] ? ' (สถานีบนสายนี้เห็นได้เฉพาะครูที่ปรึกษาแล้ว)' : ''}`],
  [/^[Rr]estarted the (.+) line$/, (m) => `เริ่มสาย ${m[1]} ใหม่`], [/^[Tt]agged “(.+)”: (.+)$/, (m) => `ติดแท็ก “${m[1]}”: ${m[2]}`], [/^[Ss]ent a reminder to a parent about consent$/, () => 'ส่งข้อความเตือนผู้ปกครองเรื่องการยินยอม'],
  [/^[Mm]ade a leaver portfolio link(.*)$/, (m) => `สร้างลิงก์แฟ้มผลงานก่อนจบ${m[1]}`], [/^[Ww]ithdrew a leaver portfolio link(.*)$/, (m) => `ยกเลิกลิงก์แฟ้มผลงานก่อนจบ${m[1]}`],
  [/^[Cc]reated share link (\S+) for “(.+)”$/, (m) => `สร้างลิงก์แบ่งปัน ${m[1]} สำหรับ “${m[2]}”`], [/^[Cc]arried “(.+)” over to this year \((.+)\)$/, (m) => `นำ “${m[1]}” มาทำต่อในปีนี้ (${D(m[2])})`],
  [/^[Pp]aused check-ins on “(.+)” until (.+)$/, (m) => `พักการอัปเดต “${m[1]}” ถึง ${D(fmtDate(m[2]))}`],
  // notifications a student gets (stored in English, src/api.js notify())
  [/^(.+) sent you encouragement for “(.+)”: (.+)$/, (m, t) => `${m[1]} ส่งกำลังใจให้คุณเรื่อง “${m[2]}”: ${t(m[3])}`], [/^(.+) wrote on “(.+)”: (.+)$/, (m) => `${m[1]} เขียนถึงเรื่อง “${m[2]}”: ${m[3]}`],
  [/^(.+) is open: look back on your term and pick what you are proud of$/, (m) => `${m[1]} เปิดแล้ว มองย้อนภาคเรียนของคุณและเลือกสิ่งที่คุณภูมิใจ`], [/^(.+) spotted something you did: “(.+)”$/, (m) => `${m[1]} สังเกตเห็นสิ่งที่คุณทำ: “${m[2]}”`],
  [/^(.+) asked (.+) a question: “(.+)”$/, (m) => `${m[1]} ถามชั้นเรียน ${m[2]}: “${m[3]}”`], [/^(.+) set a task: “(.+)”, due (.+)$/, (m) => `${m[1]} มอบหมายงาน: “${m[2]}” ส่ง${dueTh(m[3])}`],
  [/^“(.+)” is now due (.+)$/, (m) => `ตอนนี้ “${m[1]}” กำหนดส่ง${dueTh(m[2])}`], [/^(.+) gave you until (.+) for “(.+)”$/, (m) => `${m[1]} ให้เวลาคุณถึง${dueTh(m[2])} สำหรับ “${m[3]}”`],
  [/^Reminder: “(.+)” is due tomorrow$/, (m) => `เตือนความจำ: “${m[1]}” ต้องส่งพรุ่งนี้`], [/^Reminder from (.+): “(.+)”$/, (m, t) => `${t(m[1]) === m[1] ? m[1] : t(m[1])} เตือน: “${m[2]}”`],
  [/^(.+) gave you kind feedback on “(.+)”\.$/, (m) => `${m[1]} ให้คำติชมดี ๆ ในเรื่อง “${m[2]}”`], [/^(.+) said thank you for your feedback on “(.+)”\.$/, (m) => `${m[1]} ขอบคุณสำหรับคำติชมของคุณในเรื่อง “${m[2]}”`],
  [/^(.+) endorsed “(.+)”\. It is in your inbox\.$/, (m) => `${m[1]} รับรอง “${m[2]}” แล้ว อยู่ในกล่องรับเข้าของคุณ`], [/^(.+) endorsed “(.+)”$/, (m) => `${m[1]} รับรอง “${m[2]}” แล้ว`],
  [/^(.+) asked for more evidence on “(.+)”$/, (m) => `${m[1]} ขอหลักฐานเพิ่มในเรื่อง “${m[2]}”`], [/^(.+) asked to see more on “(.+)”$/, (m) => `${m[1]} ขอดูเพิ่มเติมในเรื่อง “${m[2]}”`],
  [/^(.+) sent you a reflection prompt$/, (m) => `${m[1]} ส่งคำถามชวนสะท้อนคิดให้คุณ`], [/^(.+) commented on your draft$/, (m) => `${m[1]} แสดงความคิดเห็นในฉบับร่างของคุณ`],
  [/^(.+) added a goal you agreed together: “(.+)”$/, (m) => `${m[1]} เพิ่มเป้าหมายที่คุณตกลงกันไว้: “${m[2]}”`], [/^(.+) checked in on “(.+)”$/, (m) => `${m[1]} ติดตามเรื่อง “${m[2]}”`],
  [/^(.+) approved your new line “(.+)”$/, (m) => `${m[1]} อนุมัติสายใหม่ “${m[2]}” ของคุณแล้ว`], [/^Your line “(.+)” was merged into “(.+)”$/, (m) => `สาย “${m[1]}” ของคุณถูกรวมเข้ากับ “${m[2]}” แล้ว`],
  [/^(.+) from (.+) (?:is|are) in your inbox\. You choose where (?:it goes|they go)\.$/, (m) => `${m[1].replace(/^(\d+) items?$/, '$1 รายการ')} จาก ${m[2]} อยู่ในกล่องรับเข้าของคุณ คุณเลือกเองว่าจะไปอยู่ที่ไหน`],
  [/^(.+) left a comment on your leaver portfolio$/, (m) => `${m[1]} แสดงความคิดเห็นในแฟ้มผลงานก่อนจบของคุณ`], [/^Your conference with (.+) is on (.+)$/, (m) => `การประชุมของคุณกับ ${m[1]} คือ ${thaiDates(m[2]).replace(/ at (\d\d:\d\d)$/, ' เวลา $1 น.')}`],
  [/^Your conference on (.+) was cancelled$/, (m) => `การประชุมวันที่ ${thaiDates(m[1]).replace(/ at (\d\d:\d\d)$/, ' เวลา $1 น.')} ถูกยกเลิกแล้ว`],
  [/^(.+) would like to show your moment “(.+)” to other students as an example\. Your name is not shown\.$/, (m) => `${m[1]} อยากนำเรื่อง “${m[2]}” ของคุณไปให้นักเรียนคนอื่นดูเป็นตัวอย่าง โดยไม่แสดงชื่อของคุณ`],
  [/^A teacher has hidden (.+) while they look at it\.$/, (m, t) => `ครูซ่อน${t(m[1])}ไว้ระหว่างตรวจดู`], [/^A teacher has finished looking at (.+)\. It is shown again\.$/, (m, t) => `ครูตรวจดู${t(m[1])}เสร็จแล้ว แสดงอีกครั้งแล้ว`],
  [/^A teacher has removed the photo from “(.+)”\.$/, (m) => `ครูลบรูปออกจาก “${m[1]}” แล้ว`], [/^A teacher has hidden kind feedback on “(.+)”\.$/, (m) => `ครูซ่อนคำติชมในเรื่อง “${m[1]}” แล้ว`],
  [/^(.+): your (.+) was due (.+)\. Can you upload it this week\?$/, (m) => `${m[1]}: ${m[2]} ของคุณครบกำหนดเมื่อ ${D(m[3])} อัปโหลดภายในสัปดาห์นี้ได้ไหม`],
];
// The header's menus and dialogs, the save status, jump-to, verification and reflection signals, as a student meets them.
Object.assign(STU, {
  'Change password': 'เปลี่ยนรหัสผ่าน', Feedback: 'ข้อเสนอแนะ', 'Something broken, confusing, or an idea': 'มีอะไรเสีย สับสน หรือมีไอเดีย', 'Sign out': 'ออกจากระบบ', 'Sign out everywhere': 'ออกจากระบบทุกอุปกรณ์',
  'Current password': 'รหัสผ่านปัจจุบัน', 'New password': 'รหัสผ่านใหม่', 'Type it again': 'พิมพ์อีกครั้ง',
  'Tell us something': 'บอกเราหน่อย', 'This goes to the people who make the app. Your teachers do not see it.': 'ข้อความนี้จะส่งถึงคนที่ทำแอป ครูของคุณจะไม่เห็น', 'What happened?': 'เกิดอะไรขึ้น', 'Write it in your own words.': 'เขียนด้วยคำพูดของคุณเอง',
  'Add a picture of the screen': 'เพิ่มภาพหน้าจอ', 'Thank you! We got it.': 'ขอบคุณนะ! เราได้รับแล้ว', 'Send feedback': 'ส่งข้อเสนอแนะ', 'This goes to the pilot team, with the screen you are on and your browser. Your teachers do not see it.': 'ข้อความนี้จะส่งถึงทีมโครงการนำร่อง พร้อมหน้าจอที่คุณอยู่และเบราว์เซอร์ของคุณ ครูของคุณจะไม่เห็น',
  'Your idea': 'ไอเดียของคุณ', 'What happened, and what did you expect?': 'เกิดอะไรขึ้น และคุณคาดว่าจะเป็นอย่างไร', 'Remove picture': 'ลบภาพ', 'Adding the picture…': 'กำลังเพิ่มภาพ…', 'Attach a screenshot (optional)': 'แนบภาพหน้าจอ (ไม่บังคับ)',
  'Sending…': 'กำลังส่ง…', 'Screen:': 'หน้าจอ:', 'Thanks. Your feedback was sent.': 'ขอบคุณ ส่งข้อเสนอแนะแล้ว', 'The picture could not reach the school server.': 'ส่งภาพไปยังเซิร์ฟเวอร์ของโรงเรียนไม่ได้', 'What kind': 'ประเภท',
  "Something's broken": 'มีบางอย่างใช้ไม่ได้', 'An idea': 'ไอเดีย', "Something's confusing": 'มีบางอย่างไม่ชัดเจน', 'Your screenshot': 'ภาพหน้าจอของคุณ', Student: 'นักเรียน',
  'Saved on the school server. Every device sees it.': 'บันทึกบนเซิร์ฟเวอร์ของโรงเรียนแล้ว ทุกอุปกรณ์เห็นเหมือนกัน', 'Offline, saving here': 'ออฟไลน์อยู่ บันทึกไว้ในเครื่องนี้', 'Sending your change to the school server': 'กำลังส่งการแก้ไขไปยังเซิร์ฟเวอร์ของโรงเรียน',
  'Cannot reach the server. Changes are kept in this browser and sent when it is back.': 'ติดต่อเซิร์ฟเวอร์ไม่ได้ การแก้ไขจะเก็บไว้ในเบราว์เซอร์นี้และส่งเมื่อกลับมาออนไลน์', 'Saved on this phone': 'บันทึกในโทรศัพท์เครื่องนี้แล้ว',
  'Jump to anything': 'ไปที่ใดก็ได้', 'Jump to a person, student, station or screen': 'ไปที่บุคคล นักเรียน สถานี หรือหน้าจอ', 'Jump to': 'ไปที่', 'to move ·': 'เพื่อเลื่อน ·', 'to open ·': 'เพื่อเปิด ·', 'to close': 'เพื่อปิด',
  Page: 'หน้า', 'Your screens': 'หน้าจอของคุณ', 'Verify a printed code': 'ตรวจสอบรหัสที่พิมพ์ไว้', 'Public verification page': 'หน้าตรวจสอบสาธารณะ', 'Nothing matches “': 'ไม่พบสิ่งที่ตรงกับ “',
  'No record found for this code.': 'ไม่พบบันทึกของรหัสนี้', 'Verification code': 'รหัสยืนยัน', "Print this code or QR on a CV. Anyone can check it at the school's verification page.": 'พิมพ์รหัสหรือ QR นี้ลงในประวัติย่อ ใครก็ตรวจสอบได้ที่หน้าตรวจสอบของโรงเรียน',
  'Verification record': 'บันทึกการยืนยัน', 'school system': 'ระบบของโรงเรียน', 'Published by the student': 'นักเรียนเผยแพร่เอง', 'Endorsed by a teacher': 'ครูรับรองแล้ว', 'Confirmed by the school': 'โรงเรียนยืนยันแล้ว', 'Added by the student, not yet endorsed': 'นักเรียนเพิ่มเอง ยังไม่ได้รับการรับรอง',
  '”. A few honest sentences are enough, or a voice note.': '” เขียนตามจริงสักสองสามประโยคก็พอ หรือจะอัดข้อความเสียงก็ได้', 'A line about what you attached…': 'บอกสั้น ๆ ว่าแนบอะไรไว้…', 'Write in your own words…': 'เขียนด้วยคำพูดของคุณเอง…', 'Reflect at this signal': 'สะท้อนคิดที่สัญญาณนี้',
  'On “': 'เรื่อง “', 'Open it like an app, and add a photo in two taps.': 'เปิดได้เหมือนแอป และเพิ่มรูปได้ในสองแตะ', 'In Safari, tap Share': 'ใน Safari แตะแชร์', ', then': ' แล้วแตะ', 'Add to Home Screen': 'เพิ่มไปยังหน้าจอโฮม', Install: 'ติดตั้ง',
  'Sign-in link': 'ลิงก์เข้าสู่ระบบ', 'Comments on': 'ความคิดเห็นใน', '’s draft': ' ฉบับร่าง', 'Your expectations': 'สิ่งที่ครูคาดหวัง', 'Check in with a note': 'ติดตามพร้อมข้อความ',
});
STU_RE.push(
  [/^Finish: (.+)$/, (m, t) => `เขียนต่อ: ${t(m[1])}`], [/^Student · Year (\d+)$/, (m) => `นักเรียน · Year ${m[1]}`],
  [/^(\d+) changes? waiting$/, (m) => `การแก้ไข ${m[1]} รายการรออยู่`], [/^Imported from (.+)$/, (m) => `นำเข้าจาก ${m[1]}`], [/^Endorsed by (.+)$/, (m) => `รับรองโดย ${m[1]}`],
  [/^(.+) chose to make this publishable$/, (m) => `${m[1]} เลือกให้เรื่องนี้เผยแพร่ได้`], [/^(.+) · switch to their view$/, (m) => `${m[1]} · สลับไปดูในมุมมองของเขา`],
  [/^(\d+) comments? from (.+)$/, (m) => `ความคิดเห็น ${m[1]} รายการจาก ${m[2]}`], [/^Due in (\d+) days$/, (m) => `ครบกำหนดในอีก ${m[1]} วัน`], [/^You are sponsoring “(.+)”$/, (m) => `คุณกำลังดูแล “${m[1]}”`],
);
// The built-in subject prompts (api.DEFAULT_PROMPTS), line by line: the note, the questions, the sentence starters.
Object.assign(STU, {
  'A good science moment says what you set out to find out, what you did and what the results showed, even when the experiment did not go to plan.': 'เรื่องราววิทยาศาสตร์ที่ดีจะบอกว่าคุณอยากรู้อะไร ทำอะไรไป และผลออกมาเป็นอย่างไร แม้การทดลองจะไม่เป็นไปตามแผนก็ตาม',
  'What were you trying to find out?': 'คุณอยากรู้เรื่องอะไร', 'What did you do, step by step?': 'คุณทำอะไรบ้าง ทีละขั้น', 'What happened? What did you notice or measure?': 'เกิดอะไรขึ้น คุณสังเกตเห็นหรือวัดอะไรได้บ้าง',
  'What does it show, and what surprised you?': 'ผลนั้นบอกอะไร และอะไรทำให้คุณประหลาดใจ', 'What would you change if you did it again?': 'ถ้าทำอีกครั้ง คุณจะเปลี่ยนอะไร',
  'I wanted to find out…': 'ฉันอยากรู้ว่า…', 'First we…': 'อย่างแรกเรา…', 'I noticed that…': 'ฉันสังเกตว่า…', 'This shows that…': 'สิ่งนี้แสดงว่า…', 'Next time I would…': 'ครั้งหน้าฉันจะ…',
  'A good computing moment says what you built or solved, how it works and what you learnt when it went wrong.': 'เรื่องราวคอมพิวเตอร์ที่ดีจะบอกว่าคุณสร้างหรือแก้ปัญหาอะไร มันทำงานอย่างไร และได้เรียนรู้อะไรเมื่อมีอะไรผิดพลาด',
  'What did you build, code or fix?': 'คุณสร้าง เขียนโค้ด หรือแก้อะไร', 'What problem was it solving, and for whom?': 'มันแก้ปัญหาอะไร และช่วยใคร', 'What went wrong, and how did you sort it out?': 'มีอะไรผิดพลาด และคุณแก้อย่างไร',
  'What would you add or improve next?': 'ต่อไปคุณจะเพิ่มหรือปรับปรุงอะไร', 'I built…': 'ฉันสร้าง…', 'The tricky part was…': 'ส่วนที่ยากคือ…', 'I fixed it by…': 'ฉันแก้โดย…', 'Next I want to…': 'ต่อไปฉันอยาก…',
  'A good environment moment says what you did for the place around you, what changed and why it matters.': 'เรื่องราวสิ่งแวดล้อมที่ดีจะบอกว่าคุณทำอะไรให้สถานที่รอบตัว อะไรเปลี่ยนไป และทำไมจึงสำคัญ',
  'What did you do, and where?': 'คุณทำอะไร และทำที่ไหน', 'Why does it matter for the environment?': 'ทำไมเรื่องนี้จึงสำคัญต่อสิ่งแวดล้อม', 'What changed because of it?': 'มีอะไรเปลี่ยนไปเพราะสิ่งนี้', 'What would you like to do next?': 'ต่อไปคุณอยากทำอะไร',
  'We…': 'เรา…', 'It matters because…': 'เรื่องนี้สำคัญเพราะ…', 'Afterwards…': 'หลังจากนั้น…', 'Next I would like to…': 'ต่อไปฉันอยาก…',
  'A good sport moment says what you trained for or played, how you improved and how you worked with others.': 'เรื่องราวกีฬาที่ดีจะบอกว่าคุณซ้อมหรือเล่นอะไร พัฒนาขึ้นอย่างไร และทำงานร่วมกับคนอื่นอย่างไร',
  'What did you play, train for or compete in?': 'คุณเล่น ซ้อม หรือแข่งอะไร', 'What did you get better at?': 'คุณเก่งขึ้นเรื่องอะไร', 'What was hard, and how did you keep going?': 'อะไรยาก และคุณทำต่อไปได้อย่างไร', 'How did you help your team or others?': 'คุณช่วยทีมหรือคนอื่นอย่างไร',
  'I trained for…': 'ฉันซ้อมเพื่อ…', 'I got better at…': 'ฉันเก่งขึ้นเรื่อง…', 'I helped the team by…': 'ฉันช่วยทีมโดย…',
  'A good service moment says who you worked with, what you did together and what you learnt about what they needed.': 'เรื่องราวบริการสังคมที่ดีจะบอกว่าคุณทำงานกับใคร ทำอะไรด้วยกัน และได้เรียนรู้อะไรเกี่ยวกับสิ่งที่พวกเขาต้องการ',
  'Who did you help or work with?': 'คุณช่วยหรือทำงานกับใคร', 'What did you do together?': 'คุณทำอะไรด้วยกัน', 'What did you learn about what they needed?': 'คุณได้เรียนรู้อะไรเกี่ยวกับสิ่งที่พวกเขาต้องการ', 'What difference did it make, to them and to you?': 'สิ่งนี้สร้างความแตกต่างอะไรให้พวกเขาและตัวคุณ',
  'I worked with…': 'ฉันทำงานกับ…', 'Together we…': 'เราช่วยกัน…', 'I learnt that they needed…': 'ฉันได้รู้ว่าพวกเขาต้องการ…', 'It made a difference because…': 'สิ่งนี้สร้างความแตกต่างเพราะ…',
  'A good music moment says what you played, sang or wrote, how you practised and how it felt to perform or share it.': 'เรื่องราวดนตรีที่ดีจะบอกว่าคุณเล่น ร้อง หรือแต่งอะไร ฝึกซ้อมอย่างไร และรู้สึกอย่างไรตอนแสดงหรือแบ่งปัน',
  'What did you play, sing or write?': 'คุณเล่น ร้อง หรือแต่งอะไร', 'How did you practise or prepare?': 'คุณฝึกซ้อมหรือเตรียมตัวอย่างไร', 'What went well, and what was tricky?': 'อะไรไปได้ดี และอะไรยาก', 'How did it feel to perform or share it?': 'รู้สึกอย่างไรตอนแสดงหรือแบ่งปัน',
  'I played…': 'ฉันเล่น…', 'To get ready I…': 'เพื่อเตรียมตัว ฉัน…', 'Performing felt…': 'ตอนแสดงรู้สึก…',
  'A good design moment shows what you designed, who it was for and how it changed after you tested it.': 'เรื่องราวการออกแบบที่ดีจะแสดงว่าคุณออกแบบอะไร ทำให้ใคร และเปลี่ยนไปอย่างไรหลังจากทดสอบ',
  'What did you design or make?': 'คุณออกแบบหรือทำอะไร', 'Who was it for, and what did they need?': 'ทำให้ใคร และพวกเขาต้องการอะไร', 'What did you test, and what did you change?': 'คุณทดสอบอะไร และเปลี่ยนอะไรบ้าง', 'What would you improve next time?': 'ครั้งหน้าคุณจะปรับปรุงอะไร',
  'I designed…': 'ฉันออกแบบ…', 'It was for…': 'ทำให้…', 'After testing I changed…': 'หลังทดสอบ ฉันเปลี่ยน…',
  'A good languages moment says what you read, wrote, said or understood, and what you can do now that you could not before.': 'เรื่องราวภาษาที่ดีจะบอกว่าคุณอ่าน เขียน พูด หรือเข้าใจอะไร และตอนนี้ทำอะไรได้ที่ก่อนหน้านี้ทำไม่ได้',
  'What did you read, write, say or listen to?': 'คุณอ่าน เขียน พูด หรือฟังอะไร', 'Which language, and who was it with or for?': 'ภาษาอะไร และใช้กับใครหรือเพื่อใคร', 'What can you do now that you could not before?': 'ตอนนี้คุณทำอะไรได้ที่ก่อนหน้านี้ทำไม่ได้', 'What would you like to try next?': 'ต่อไปคุณอยากลองอะไร',
  'I read…': 'ฉันอ่าน…', 'I wrote…': 'ฉันเขียน…', 'Now I can…': 'ตอนนี้ฉัน…ได้', 'Next I want to try…': 'ต่อไปฉันอยากลอง…',
  'A good art moment shows what you made, the ideas behind it and the choices you made along the way.': 'เรื่องราวศิลปะที่ดีจะแสดงว่าคุณสร้างอะไร มีแนวคิดอะไรอยู่เบื้องหลัง และคุณเลือกอะไรระหว่างทาง',
  'What did you make?': 'คุณสร้างอะไร', 'Where did the idea come from?': 'ไอเดียมาจากไหน', 'What choices did you make, and why?': 'คุณเลือกอะไร และทำไม', 'What would you try differently next time?': 'ครั้งหน้าคุณจะลองทำอะไรต่างไป',
  'My idea came from…': 'ไอเดียของฉันมาจาก…', 'I chose to…': 'ฉันเลือกที่จะ…', 'Next time I would try…': 'ครั้งหน้าฉันจะลอง…',
});
STU_RE.push(
  [/^Move “(.+)” up$/, (m) => `เลื่อน “${m[1]}” ขึ้น`], [/^Move “(.+)” down$/, (m) => `เลื่อน “${m[1]}” ลง`], [/^Take “(.+)” out$/, (m) => `เอา “${m[1]}” ออก`], [/^Add “(.+)”$/, (m) => `เพิ่ม “${m[1]}”`],
  // studio, inbox, leaver
  [/^What does your (.+) line say about you\?$/, (m) => `สาย ${m[1]} บอกอะไรเกี่ยวกับตัวคุณบ้าง`], [/^No (.+) stations in this presentation yet$/, (m) => `ยังไม่มีสถานีสาย ${m[1]} ในงานนำเสนอนี้`],
  [/^Ended line: (.+) chose to publish it$/, (m) => `สายที่จบแล้ว: ${m[1]} เลือกเผยแพร่`], [/^ended · published by (.+)$/, (m) => `จบแล้ว · เผยแพร่โดย ${m[1]}`], [/^Hide (.+)$/, (m) => `ซ่อน ${m[1]}`],
  [/^(\d+) appear in only one$/, (m) => `${m[1]} รายการมีเฉพาะฝั่งเดียว`], [/^(\d+) stay as they are$/, (m) => `${m[1]} รายการเหมือนเดิม`],
  [/^A week passes: (\d+) systems have something new for (.+)$/, (m) => `ผ่านไปหนึ่งสัปดาห์: ${m[1]} ระบบมีของใหม่สำหรับ ${m[2]}`], [/^(\d+) new items? in (.+)'s inbox$/, (m) => `รายการใหม่ ${m[1]} รายการในกล่องรับเข้าของ ${m[2]}`],
  [/^Sync all · (\d+) new$/, (m) => `ซิงก์ทั้งหมด · ใหม่ ${m[1]} รายการ`], [/^(\d+) new for (.+)$/, (m) => `ใหม่ ${m[1]} รายการสำหรับ ${m[2]}`], [/^Sharing (\d+) repositor(?:y|ies)\. Only those can send items\.$/, (m) => `แบ่งปัน ${m[1]} คลังโค้ด เฉพาะคลังเหล่านี้ที่ส่งรายการได้`],
  [/^Merged into “(.+)”$/, (m) => `รวมเข้ากับ “${m[1]}” แล้ว`], [/^Skipped \((.+)\)$/, (m) => `ข้ามแล้ว (${m[1]})`],
  [/^Open until (.+)$/, (m) => `เปิดถึง ${D(m[1])}`], [/^(\d+) private or hidden moments? (?:is|are) left out: private moments never go in a portfolio\.$/, (m) => `เรื่องที่เป็นส่วนตัวหรือถูกซ่อน ${m[1]} เรื่องไม่ได้ถูกใส่ เรื่องส่วนตัวจะไม่อยู่ในแฟ้มผลงาน`],
  [/^(.+): leaver portfolio$/, (m) => `${m[1]}: แฟ้มผลงานก่อนจบ`], [/^(\d+) moments?$/, (m) => `${m[1]} เรื่องราว`], [/^(\d+) days$/, (m) => `${m[1]} วัน`],
  [/^Thank you\. “(.+)” can now help other students\.$/, (m) => `ขอบคุณนะ ตอนนี้ “${m[1]}” ช่วยนักเรียนคนอื่นได้แล้ว`], [/^From the (.+) teachers$/, (m) => `จากครูสาย ${m[1]}`],
);
const VIS_TH = { private: 'ส่วนตัว', advisor: 'ครูที่ปรึกษา', school: 'โรงเรียน', publishable: 'เผยแพร่ได้' };
// The server's answers a student can meet (a refused change, a toast, an error under a form), in Thai through errText.
Object.assign(ERR_TH, {
  'Families do not see comments.': 'ครอบครัวไม่เห็นความคิดเห็น', 'Finish your goal, or skip it': 'เขียนเป้าหมายให้เสร็จ หรือข้ามไป', 'Give it a title': 'ตั้งชื่อเรื่องก่อนนะ',
  'Kind feedback is not on for your Year.': 'Year ของคุณยังไม่ได้เปิดใช้คำติชมดี ๆ', 'Make your portfolio first.': 'สร้างแฟ้มผลงานก่อนนะ', 'No such comment.': 'ไม่พบความคิดเห็นนี้', 'No such goal.': 'ไม่พบเป้าหมายนี้',
  'No such link.': 'ไม่พบลิงก์นี้', 'No such moment.': 'ไม่พบเรื่องนี้', 'No such reflection': 'ไม่พบการทบทวนนี้', 'No such task': 'ไม่พบงานนี้', 'No such question': 'ไม่พบคำถามนี้',
  'Only endorsements on moments your school can see can go in.': 'ใส่ได้เฉพาะคำรับรองในเรื่องที่โรงเรียนเห็นได้', 'Only moments the school can see can have feedback from classmates.': 'เฉพาะเรื่องที่โรงเรียนเห็นได้เท่านั้นที่เพื่อนให้คำติชมได้',
  'Only the person who wrote a comment can change it.': 'มีแค่คนที่เขียนความคิดเห็นเท่านั้นที่แก้ไขได้', 'Only the student can see this moment.': 'มีแค่นักเรียนที่เห็นเรื่องนี้', 'Pick a line': 'เลือกสายก่อนนะ', 'Pick a line or write one.': 'เลือกประโยคหรือเขียนเองหนึ่งประโยค',
  'Pick a reason.': 'เลือกเหตุผลก่อนนะ', 'Pick a template.': 'เลือกแม่แบบก่อนนะ', 'Pick at least one moment first.': 'เลือกอย่างน้อยหนึ่งเรื่องก่อนนะ', 'Pick how it is going.': 'เลือกว่าเป็นอย่างไรบ้าง', 'Pick how long the link works.': 'เลือกว่าลิงก์จะใช้ได้นานแค่ไหน',
  'Pick moments from your map.': 'เลือกเรื่องราวจากแผนที่ของคุณ', 'Pick one or two phrases and finish each one.': 'เลือกหนึ่งหรือสองข้อแล้วเขียนให้จบ', 'Pick a date': 'เลือกวันที่', 'Private reflections cannot go in a portfolio.': 'บทสะท้อนคิดส่วนตัวใส่ในแฟ้มผลงานไม่ได้',
  'That comment is gone.': 'ความคิดเห็นนี้ไม่มีแล้ว', 'That email does not look right.': 'อีเมลนี้ดูไม่ถูกต้อง', 'That feedback is gone.': 'คำติชมนี้ไม่มีแล้ว', 'That feedback is hidden.': 'คำติชมนี้ถูกซ่อนอยู่', 'That link could not be made.': 'สร้างลิงก์นั้นไม่ได้',
  'The leaver portfolio is for Years 11 to 13.': 'แฟ้มผลงานก่อนจบมีสำหรับ Year 11 ถึง 13', 'There is no portfolio yet.': 'ยังไม่มีแฟ้มผลงาน', 'This class is not on a line yet': 'ชั้นเรียนนี้ยังไม่อยู่บนสายใด', 'This has expired': 'หมดอายุแล้ว',
  'This is not for you': 'อันนี้ไม่ใช่ของคุณ', 'This is not your moment': 'เรื่องนี้ไม่ใช่ของคุณ', 'This is your own moment.': 'นี่เป็นเรื่องของคุณเอง', 'This moment is just for the student. Share it with the advisor first.': 'เรื่องนี้เป็นของนักเรียนคนเดียว แบ่งปันกับครูที่ปรึกษาก่อนนะ',
  'This moment is not open for feedback.': 'เรื่องนี้ยังไม่เปิดรับคำติชม', 'This reflection is closed': 'การทบทวนนี้ปิดแล้ว', 'This reflection is not for you': 'การทบทวนนี้ไม่ใช่ของคุณ', 'Use a photo you uploaded.': 'ใช้รูปที่คุณอัปโหลดไว้',
  'Write a comment first.': 'เขียนความคิดเห็นก่อนนะ', 'Write a little about what you did first': 'เล่าสักนิดก่อนว่าคุณทำอะไร', 'Write something first.': 'เขียนอะไรสักอย่างก่อนนะ', 'You already answered this': 'คุณตอบไปแล้ว',
  'You already finished this': 'คุณทำเสร็จไปแล้ว', 'You can give feedback only to classmates in your classes.': 'คุณให้คำติชมได้เฉพาะเพื่อนในชั้นเรียนของคุณ', 'You have sent a lot of reports. Try again later, or speak to a teacher.': 'คุณส่งรายงานไปหลายครั้งแล้ว ลองใหม่ทีหลัง หรือคุยกับครู',
  'Say what you did first': 'บอกก่อนว่าคุณทำอะไร', 'This question is not for you': 'คำถามนี้ไม่ใช่ของคุณ', 'This task is not for you': 'งานนี้ไม่ใช่ของคุณ', 'This task needs a photo or a file': 'งานนี้ต้องมีรูปหรือไฟล์',
  'Write an answer first': 'เขียนคำตอบก่อนนะ', 'You already handed this in': 'คุณส่งงานนี้ไปแล้ว', 'Who is reporting this?': 'ใครเป็นคนรายงาน', 'Pick a reason': 'เลือกเหตุผลก่อนนะ',
  'the server did not accept it': 'เซิร์ฟเวอร์ไม่รับการแก้ไขนี้',
});
const DUE_TH = { today: 'วันนี้', tomorrow: 'พรุ่งนี้' };
const dueTh = (w) => DUE_TH[w] || (DAY_FULL.includes(w) ? DAY_TH_FULL[DAY_FULL.indexOf(w)] : ` ${D(w)}`);
Object.assign(STU, {
  'helped with this, so it goes to them to check.': 'ช่วยดูแลเรื่องนี้ จึงส่งไปให้ตรวจ', And: 'และอีก', 'more.': 'รายการ', '”. A teacher who looks after safety will see it.': '” ครูที่ดูแลความปลอดภัยจะเห็นเรื่องนี้',
  'In Year 11 this is a practice run: everything works, so you are ready next year.': 'ใน Year 11 เป็นการฝึกทำ ทุกอย่างใช้ได้จริง ปีหน้าคุณจะพร้อม', 'It is on your': 'ตอนนี้อยู่บนสาย', 'line now, waiting for': 'ของคุณแล้ว รอ', 'to check it.': 'ตรวจ',
  'One or two sentences is plenty.': 'หนึ่งหรือสองประโยคก็พอแล้ว', You: 'คุณ', 'Started, not finished': 'เริ่มแล้ว ยังไม่เสร็จ',
});
// ── Family encouragement (src/components/FamilyNotes.jsx): the student's side, and the family's thank-you notice. Only keys
// not already known are added. The family's own screens carry their Thai in the component. ──
for (const [k, v] of Object.entries({
  'Notes from your family': 'ข้อความจากครอบครัว', 'From your family': 'จากครอบครัวของคุณ', 'Notes from family': 'ข้อความจากครอบครัว',
  'Proud of you': 'ภูมิใจในตัวลูกนะ', 'Well done': 'เก่งมาก', 'Tell me more at dinner': 'มื้อเย็นนี้เล่าให้ฟังหน่อยนะ', 'Keep going': 'สู้ต่อไปนะ',
  'Open the moment': 'เปิดดูเรื่องนี้', 'Show again': 'แสดงอีกครั้ง', 'Show 1 hidden note': 'แสดงข้อความที่ซ่อนไว้ 1 ข้อความ',
  'Hidden. You will not see it here.': 'ซ่อนแล้ว คุณจะไม่เห็นข้อความนี้ที่นี่', 'Report this note': 'รายงานข้อความนี้', 'Tell a teacher': 'บอกครู',
  'Send report': 'ส่งรายงาน', 'Cancel': 'ยกเลิก', 'What is wrong': 'มีอะไรไม่ถูกต้อง',
  'Let my family leave kind notes on moments they can see': 'ให้ครอบครัวเขียนข้อความให้กำลังใจในเรื่องที่ครอบครัวเห็นได้',
  'Your family can leave a short kind note on moments they can see. Your advisor and teachers can read them too.': 'ครอบครัวเขียนข้อความสั้น ๆ ให้กำลังใจในเรื่องที่เห็นได้ ครูที่ปรึกษาและครูผู้สอนอ่านได้ด้วย',
  'Your family can leave notes again.': 'ครอบครัวเขียนข้อความถึงคุณได้อีกครั้งแล้ว',
  'Notes from family are off. You can turn them on again here.': 'ปิดข้อความจากครอบครัวแล้ว เปิดอีกครั้งได้ที่นี่',
})) STU[k] ??= v;
STU_RE.push(
  [/^From (.+)$/, (m) => `จาก ${m[1]}`], [/^on “(.+)”$/, (m) => `ในเรื่อง “${m[1]}”`],
  [/^Show (\d+) hidden notes$/, (m) => `แสดงข้อความที่ซ่อนไว้ ${m[1]} ข้อความ`],
  [/^A teacher has hidden a note from your family on “(.+)”\.$/, (m) => `ครูซ่อนข้อความจากครอบครัวในเรื่อง “${m[1]}” ไว้ชั่วคราว`],
  [/^A teacher has finished looking at a note from your family on “(.+)”\. It is shown again\.$/, (m) => `ครูตรวจดูข้อความจากครอบครัวในเรื่อง “${m[1]}” เสร็จแล้ว ข้อความแสดงอีกครั้ง`],
);
NOTE_TH.push([/^(.+) said thank you for your note on “(.+)”\.$/, (m) => `${m[1]} ขอบคุณสำหรับข้อความของคุณในเรื่อง “${m[2]}”`]);
for (const [k, v] of Object.entries({
  'This moment is not shared with the family.': 'เรื่องนี้ไม่ได้แบ่งปันให้ครอบครัวเห็น', 'Notes from family are turned off for now.': 'ปิดรับข้อความจากครอบครัวไว้ชั่วคราว',
  'You already left a note on this moment. You can change it.': 'คุณเขียนข้อความในเรื่องนี้แล้ว แก้ไขได้', 'Keep it to 280 characters.': 'เขียนได้ไม่เกิน 280 ตัวอักษร',
  'Write a few words or pick a reaction.': 'เขียนสักสองสามคำ หรือเลือกคำให้กำลังใจ', 'Only the person who wrote a note can change it.': 'เฉพาะผู้เขียนข้อความเท่านั้นที่แก้ไขได้',
  'That note is gone.': 'ไม่มีข้อความนี้แล้ว', 'Pick one of the reactions.': 'เลือกคำให้กำลังใจหนึ่งคำ',
})) ERR_TH[k] ??= v;
// Keys written with the spaces JSX leaves around them: the page is matched without them (src/thai.js keeps the spaces).
for (const k of Object.keys(STU)) if (k !== k.trim()) { STU[k.trim()] ??= STU[k].trim(); delete STU[k]; }
const plainTh = (s) => STU[s] ?? (Object.hasOwn(TH, s) && !['Year', 'T'].includes(s) ? TH[s] : null) ?? (ERR_TH[s] || null);
// The Thai for one whole piece of student interface text, or null when it is not known (then it stays as written).
export function studentThai(s) {
  const p = plainTh(s); if (p != null) return p;
  const t = (x) => studentThai(x) ?? x;
  for (const [re, f] of STU_RE) { const m = s.match(re); if (m) return f(m, t); }
  const n = noteText('th', s); if (n !== s) return n;
  const parts = s.split(', '); // a list of interface strings, as in a label
  if (parts.length > 1 && parts.every((x) => plainTh(x) != null)) return parts.map(plainTh).join(', ');
  const d = thaiDates(s); if (d !== s && !/[A-Za-z]{2,}/.test(d)) return d;
  return null;
}

// ── School events (src/components/SchoolEvents.jsx): the cards after an event, Coming up, the event's name on a moment ──
for (const [k, v] of Object.entries({ 'School event': 'กิจกรรมของโรงเรียน' })) TH[k] ??= v;
for (const [k, v] of Object.entries({
  'School event': 'กิจกรรมของโรงเรียน', 'From a school event': 'จากกิจกรรมของโรงเรียน', 'Not for me': 'ไม่ใช่สำหรับฉัน', 'Add it': 'เพิ่มเลย',
  'After school events': 'หลังกิจกรรมของโรงเรียน', 'On now': 'กำลังจัดอยู่', 'Set a goal': 'ตั้งเป้าหมาย', today: 'วันนี้', tomorrow: 'พรุ่งนี้',
  'Hidden. You can still add it any time.': 'ซ่อนแล้ว คุณยังเพิ่มได้ทุกเมื่อ', 'Coming up': 'สิ่งที่กำลังจะมา',
})) STU[k] ??= v;
for (const [k, v] of DAY_FULL.map((d, i) => [d, DAY_TH_FULL[i]])) STU[k] ??= v;
ERR_TH['This event is not for you'] ??= 'กิจกรรมนี้ไม่ใช่สำหรับคุณ';
STU_RE.push(
  [/^Add something from “(.+)” to your journey$/, (m) => `เพิ่มเรื่องราวจาก “${m[1]}” ลงในเส้นทางของคุณ`],
  [/^Add something from (.+)$/, (m) => `เพิ่มเรื่องราวจาก ${m[1]}`],
  [/^(\d{1,2} \w{3} \d{4}) to (\d{1,2} \w{3} \d{4})$/, (m) => `${D(m[1])} ถึง ${D(m[2])}`],
  [/^(.+\?) \(optional\)$/, (m) => `${m[1]} (ไม่บังคับ)`],
);
// ── Student-led conferences (src/components/StudentLed.jsx): the family's line in Thai or English, the student's screens and
// Conference mode in Thai, and the notifications. Keys are written trimmed (this block comes after the trim above).
const SLC = {
  en: {
    head: (f) => `After ${f}’s conference`, intro: (f) => `One line each, kept on ${f}’s conference note. ${f} and the advisor see it too.`,
    home: 'What we will try at home', next: (f) => `What ${f} will do next`, none: 'Not written yet.', notYet: (f) => `${f} has not written theirs yet.`,
    by: (a) => `Written by ${a}`, ph: 'e.g. Read together for 20 minutes after dinner', write: 'Write our line', change: 'Change our line',
    save: 'Save', cancel: 'Cancel', saved: 'Saved on the conference note',
  },
  th: {
    head: (f) => `หลังการประชุมของ ${f}`, intro: (f) => `เขียนคนละหนึ่งบรรทัด เก็บไว้ในบันทึกการประชุมของ ${f} ซึ่ง ${f} และครูที่ปรึกษาจะเห็นด้วย`,
    home: 'สิ่งที่เราจะลองทำที่บ้าน', next: (f) => `สิ่งที่ ${f} จะทำต่อไป`, none: 'ยังไม่ได้เขียน', notYet: (f) => `${f} ยังไม่ได้เขียน`,
    by: (a) => `เขียนโดย ${a}`, ph: 'เช่น อ่านหนังสือด้วยกัน 20 นาทีหลังอาหารเย็น', write: 'เขียนบรรทัดของเรา', change: 'แก้ไขบรรทัดของเรา',
    save: 'บันทึก', cancel: 'ยกเลิก', saved: 'บันทึกในบันทึกการประชุมแล้ว',
  },
};
export const slcWords = (lang) => SLC[lang === 'th' ? 'th' : 'en'];
NOTE_TH.push(
  [/^Your family wrote on your conference note$/, () => 'ครอบครัวของคุณเขียนในบันทึกการประชุมของคุณแล้ว'],
  [/^(.+) wrote on your conference note$/, (m) => `${m[1]} เขียนในบันทึกการประชุมของคุณแล้ว`],
  [/^(.+) wrote on (.+)’s conference note$/, (m) => `${m[1]} เขียนในบันทึกการประชุมของ ${m[2]} แล้ว`],
);
Object.assign(ERR_TH, {
  'Write one line first': 'โปรดเขียนหนึ่งบรรทัดก่อน', 'Pick something to show, or say what you are proud of': 'เลือกสิ่งที่จะนำเสนอ หรือบอกว่าคุณภูมิใจในเรื่องอะไร',
  'This conference has finished': 'การประชุมนี้จบแล้ว', 'This conference is not for you': 'การประชุมนี้ไม่ใช่ของคุณ', 'This conference is not for this student': 'การประชุมนี้ไม่ใช่ของนักเรียนคนนี้',
});
Object.assign(STU, {
  'Today is your conference': 'วันนี้เป็นวันประชุมของคุณ', 'Get ready for my conference': 'เตรียมตัวสำหรับการประชุมของฉัน',
  'You are ready. You can still change it before the day.': 'คุณพร้อมแล้ว ยังแก้ไขได้ก่อนถึงวันประชุม',
  'Pick a few things to show your family and say what you are proud of. It takes about 5 minutes.': 'เลือกสิ่งที่อยากให้ครอบครัวดูสักสองสามอย่าง และบอกว่าคุณภูมิใจในเรื่องอะไร ใช้เวลาประมาณ 5 นาที',
  'No time booked yet. Your family picks one.': 'ยังไม่ได้จองเวลา ครอบครัวของคุณจะเป็นคนเลือก', 'Start my conference': 'เริ่มการประชุมของฉัน', 'Change it': 'แก้ไข', 'Get ready': 'เตรียมตัว',
  'My conference note': 'บันทึกการประชุมของฉัน', 'What we will try at home': 'สิ่งที่เราจะลองทำที่บ้าน', 'What I will do next': 'สิ่งที่ฉันจะทำต่อไป',
  'Your family adds this on their Family page.': 'ครอบครัวของคุณเขียนส่วนนี้ในหน้าครอบครัวของพวกเขา', 'Not written yet.': 'ยังไม่ได้เขียน', 'What will you do next?': 'คุณจะทำอะไรต่อไป',
  'Change my line': 'แก้ไขบรรทัดของฉัน', 'Write what I will do next': 'เขียนสิ่งที่ฉันจะทำต่อไป', 'Open my conference': 'เปิดการประชุมของฉัน', 'Saved on your conference note': 'บันทึกในบันทึกการประชุมของคุณแล้ว',
  'This shows…': 'สิ่งนี้แสดงว่า…', 'I am proud of it because…': 'ฉันภูมิใจเพราะ…', 'I learned…': 'ฉันได้เรียนรู้ว่า…', 'I am proud that…': 'ฉันภูมิใจที่…', 'I am proud of how I…': 'ฉันภูมิใจที่ฉัน…',
  'I found it tricky to…': 'ฉันรู้สึกว่ายากที่จะ…', 'I kept going by…': 'ฉันไม่ยอมแพ้โดย…', 'I will try to…': 'ฉันจะพยายาม…', 'Next I will…': 'ต่อไปฉันจะ…',
  'What do you want to show?': 'คุณอยากนำเสนออะไร',
  'Nothing on your journey to show yet. That is fine: you can still say what you are proud of.': 'ยังไม่มีอะไรบนเส้นทางให้นำเสนอ ไม่เป็นไร คุณยังบอกได้ว่าภูมิใจในเรื่องอะไร',
  'What do you want to say about it?': 'คุณอยากพูดถึงเรื่องนี้ว่าอย่างไร', 'What are you proud of?': 'คุณภูมิใจในเรื่องอะไร', 'What was hard?': 'อะไรที่ยาก', 'One thing is enough.': 'แค่เรื่องเดียวก็พอ',
  'What is your goal?': 'เป้าหมายของคุณคืออะไร', 'A goal I have': 'เป้าหมายที่ฉันมีอยู่', 'One thing you want to do next.': 'สิ่งหนึ่งที่คุณอยากทำต่อไป',
  'I am proud of': 'ฉันภูมิใจใน', 'Something that was hard': 'สิ่งที่ยาก', 'Your advisor can see it. You show it to your family at the conference.': 'ครูที่ปรึกษาเห็นได้ คุณนำเสนอให้ครอบครัวดูในวันประชุม',
  'I am ready': 'ฉันพร้อมแล้ว', 'You are ready for your conference. On the day, open it and show your family.': 'คุณพร้อมสำหรับการประชุมแล้ว ในวันประชุมเปิดขึ้นมาแล้วนำเสนอให้ครอบครัวดู', 'Try it now': 'ลองดูตอนนี้',
  'You are ready. On the day, open Conference mode and show it, one screen at a time. You can still change it before then.': 'คุณพร้อมแล้ว ในวันประชุมเปิดโหมดการประชุมแล้วนำเสนอทีละหน้าจอ ยังแก้ไขได้ก่อนถึงวันนั้น',
  'Try Conference mode': 'ลองโหมดการประชุม', 'Short is fine: this is a chat with your family, not a speech.': 'สั้น ๆ ก็พอ นี่คือการคุยกับครอบครัว ไม่ใช่การกล่าวสุนทรพจน์',
  'Your progress is kept: save and come back any time.': 'ระบบเก็บสิ่งที่ทำไว้ บันทึกแล้วกลับมาทำต่อได้ทุกเมื่อ', 'You lead the conference: these are your notes for it.': 'คุณเป็นผู้นำการประชุม นี่คือโน้ตของคุณสำหรับการประชุม',
  '1. What to show': '1. สิ่งที่จะนำเสนอ', '2. In your words': '2. ด้วยคำพูดของคุณ', 'What you want to say about it': 'สิ่งที่คุณอยากพูดถึงเรื่องนี้', '3. Looking back': '3. มองย้อนกลับ', '2. Looking back': '2. มองย้อนกลับ',
  'What I am proud of': 'สิ่งที่ฉันภูมิใจ', 'One thing that was hard': 'สิ่งหนึ่งที่ยาก', '4. One goal': '4. เป้าหมายหนึ่งอย่าง', '3. One goal': '3. เป้าหมายหนึ่งอย่าง', 'One goal': 'เป้าหมายหนึ่งอย่าง',
  'e.g. Read five books this term': 'เช่น อ่านหนังสือห้าเล่มในภาคเรียนนี้',
  'Conference mode': 'โหมดการประชุม', 'Offline: this still works. What you write is kept here and sent when you are back online.': 'ออฟไลน์: ยังใช้งานได้ สิ่งที่เขียนจะเก็บไว้ในเครื่องนี้และส่งเมื่อกลับมาออนไลน์',
  'Full screen': 'เต็มจอ', 'I picked a few things to show you.': 'ฉันเลือกบางอย่างมาให้ดู', 'What I will show you': 'สิ่งที่ฉันจะนำเสนอ', 'Let’s talk about my journey together.': 'มาคุยเรื่องเส้นทางของฉันด้วยกัน',
  'Nothing prepared yet. You can still talk through the journey together.': 'ยังไม่ได้เตรียมอะไร ยังคุยเรื่องเส้นทางด้วยกันได้', 'Our next steps': 'ก้าวต่อไปของเรา',
  'One line each, to keep on the conference note.': 'คนละหนึ่งบรรทัด เก็บไว้ในบันทึกการประชุม', 'Saved on the conference note': 'บันทึกในบันทึกการประชุมแล้ว',
});
STU_RE.push(
  [/^Pick up to (\d+) moments to show, say what you are proud of, one thing that was hard and one goal\.$/, (m) => `เลือกช่วงเวลาที่อยากนำเสนอได้สูงสุด ${m[1]} อย่าง บอกว่าคุณภูมิใจในเรื่องอะไร เรื่องหนึ่งที่ยาก และเป้าหมายหนึ่งอย่าง`],
  [/^Pick up to (\d+) moments\. Private moments are not here\.$/, (m) => `เลือกได้สูงสุด ${m[1]} ช่วงเวลา ช่วงเวลาส่วนตัวไม่แสดงที่นี่`],
  [/^Tap up to (\d+) things\.$/, (m) => `แตะเลือกได้สูงสุด ${m[1]} อย่าง`],
  [/^Your conference: (.+)$/, (m) => `การประชุมของคุณ: ${thaiDates(m[1]).replace(/, (\d\d:\d\d)$/, ' เวลา $1 น.')}`],
  [/^Written by (.+)$/, (m) => `เขียนโดย ${m[1]}`],
  [/^A goal I have · (.+)$/, (m) => `เป้าหมายที่ฉันมีอยู่ · ${thaiDates(m[1])}`],
  [/^Well done, (.+)!$/, (m) => `เก่งมาก ${m[1]}!`],
  [/^Screen (\d+) of (\d+)$/, (m) => `หน้าจอ ${m[1]} จาก ${m[2]}`],
  [/^Moment (\d+) of (\d+)$/, (m) => `ช่วงเวลาที่ ${m[1]} จาก ${m[2]}`],
  [/^Hi, I’m (.+)!$/, (m) => `สวัสดี ฉันชื่อ ${m[1]}!`],
  [/^(.+)’s conference$/, (m) => `การประชุมของ ${m[1]}`],
);
// Class photo drop (src/components/PhotoDrop.jsx): the photos a teacher gave a student, keeping them, reporting one.
Object.assign(STU, {
  'Keep this photo?': 'เก็บรูปนี้ไหม', 'Tap the photos you want to keep.': 'แตะรูปที่คุณอยากเก็บไว้', '✓ Keeping': '✓ เก็บไว้', 'Not keeping': 'ไม่เก็บ',
  'Something wrong with this photo?': 'รูปนี้มีอะไรไม่ถูกต้องไหม', 'Say what you did': 'เล่าว่าคุณทำอะไร', 'e.g. I wired the circuit and the bulb lit up.': 'เช่น ฉันต่อวงจรแล้วหลอดไฟก็สว่าง',
  'Keep 1 photo': 'เก็บ 1 รูป', 'Pick at least one photo to keep': 'เลือกอย่างน้อยหนึ่งรูปที่จะเก็บ', 'Tell a teacher about this photo': 'บอกครูเรื่องรูปนี้', 'The photo': 'รูปนี้',
  'A teacher who looks after safety will see it. The teacher who took the photo is not told it was you.': 'ครูที่ดูแลความปลอดภัยจะเห็นเรื่องนี้ ครูที่ถ่ายรูปจะไม่รู้ว่าเป็นคุณ',
  'This photo is not for you.': 'รูปนี้ไม่ใช่ของคุณ', 'That photo is gone.': 'รูปนี้ไม่มีแล้ว',
});
STU_RE.push(
  [/^(.+) added photos from “(.+)”$/, (m) => `${m[1]} เพิ่มรูปจาก “${m[2]}”`], [/^(.+) added photos from (.+)$/, (m) => `${m[1]} เพิ่มรูปจาก ${m[2]}`],
  [/^Keep (\d+) photos$/, (m) => `เก็บ ${m[1]} รูป`], [/^Photo (\d+) from your teacher$/, (m) => `รูปที่ ${m[1]} จากครู`], [/^(\d+) more after this$/, (m) => `มีอีก ${m[1]} รายการ`],
  [/^A teacher has removed a photo from “(.+)”\.$/, (m) => `ครูลบรูปหนึ่งออกจาก “${m[1]}” แล้ว`],
);
STU_RE.push(
  // A second spotted card or a class photos card waiting (Spotted.jsx), and a label listing interface strings some of which
  // are patterns ("First spotted moment added, 5 moments"): every part must be known, else it stays as written.
  [/^· (\d+) to look at$/, (m) => `· ดูอีก ${m[1]} รายการ`],
  [/^[A-Z0-9][A-Za-z0-9 ]+(, [A-Z0-9][A-Za-z0-9 ]+)+$/, (m) => { const p = m[0].split(', ').map((x) => studentThai(x)); return p.every((x) => x != null) ? p.join(', ') : null; }],
);
// ── Advisor year sign-off (src/components/YearSignoff.jsx): the student's card and its notification ──
for (const [k, v] of Object.entries({
  'Your advisor has signed off your year': 'ครูที่ปรึกษารับรองปีการศึกษานี้ของคุณแล้ว', 'Well done on your year.': 'ปีนี้คุณทำได้ดีมาก',
  'Your term reflection': 'การทบทวนภาคเรียนของคุณ', 'A goal to work towards': 'เป้าหมายที่กำลังมุ่งไป', 'Your moving-up summary': 'สรุปก่อนเลื่อนชั้นของคุณ',
  'Moments on 1 line': 'เรื่องราวบน 1 สาย', '1 endorsed moment': 'เรื่องราวที่ครูรับรอง 1 เรื่อง', '1 goal met': 'ทำเป้าหมายสำเร็จ 1 อย่าง',
  '1 hour of CAS confirmed': 'ชั่วโมง CAS ที่ยืนยันแล้ว 1 ชั่วโมง', Hide: 'ซ่อน',
})) STU[k] ??= v;
STU_RE.push(
  [/^(.+) looked back at your year\. What stood out:$/, (m) => `${m[1]} มองย้อนดูปีนี้ของคุณแล้ว สิ่งที่โดดเด่นคือ:`],
  [/^Moments on (\d+) lines$/, (m) => `เรื่องราวบน ${m[1]} สาย`],
  [/^(\d+) endorsed moments$/, (m) => `เรื่องราวที่ครูรับรอง ${m[1]} เรื่อง`],
  [/^(\d+) goals met$/, (m) => `ทำเป้าหมายสำเร็จ ${m[1]} อย่าง`],
  [/^(\d+) hours of CAS confirmed$/, (m) => `ชั่วโมง CAS ที่ยืนยันแล้ว ${m[1]} ชั่วโมง`],
);
NOTE_TH.push([/^(.+) signed off your year\. Well done!$/, (m) => `${m[1]} รับรองปีการศึกษานี้ของคุณแล้ว เก่งมาก!`]);
// ── Moment templates (src/components/MomentTemplates.jsx, api.MT_BUILTIN): "Use a guide", every built-in template's name,
// what it is for, its headings, questions and sentence starters, and the guide a teacher put on a task or question. ──
for (const [k, v] of Object.entries({
  'Use a guide': 'ใช้ตัวช่วยเขียน', 'Stop using the guide': 'เลิกใช้ตัวช่วยเขียน', 'Sentence starters': 'ประโยคเริ่มต้น', // the last: Ideas for this line, beside a guide
  'Lab write-up': 'บันทึกการทดลอง', 'For an experiment or investigation.': 'สำหรับการทดลองหรือการสืบค้น',
  'The question': 'คำถาม', 'What I did': 'สิ่งที่ฉันทำ', 'What I found': 'สิ่งที่ฉันพบ', 'What I’d change': 'สิ่งที่ฉันจะเปลี่ยน', 'Then I…': 'จากนั้นฉัน…',
  'Reading log': 'บันทึกการอ่าน', 'For a book you read, in any language.': 'สำหรับหนังสือที่คุณอ่าน ภาษาอะไรก็ได้',
  Book: 'หนังสือ', Author: 'ผู้เขียน', 'What stayed with me': 'สิ่งที่ฉันยังจำได้', 'What book did you read?': 'คุณอ่านหนังสืออะไร', 'Who wrote it?': 'ใครเป็นคนเขียน',
  'What stayed with you after reading it?': 'อ่านจบแล้ว อะไรยังติดอยู่ในใจคุณ', 'It was written by…': 'หนังสือเล่มนี้เขียนโดย…', 'The part I remember most is…': 'ตอนที่ฉันจำได้มากที่สุดคือ…', 'It made me think about…': 'มันทำให้ฉันคิดถึง…',
  'Match or competition': 'การแข่งขัน', 'For a game, race, contest or competition.': 'สำหรับเกม การวิ่งแข่ง การประกวด หรือการแข่งขัน',
  Event: 'รายการแข่งขัน', Result: 'ผลการแข่งขัน', 'What went well': 'สิ่งที่ทำได้ดี', 'Next time': 'ครั้งหน้า',
  'What was the match or competition?': 'เป็นการแข่งขันอะไร', 'What was the result?': 'ผลออกมาเป็นอย่างไร', 'What went well?': 'อะไรที่ทำได้ดี', 'What will you work on next time?': 'ครั้งหน้าคุณจะฝึกเรื่องอะไร',
  'We played against…': 'เราแข่งกับ…', 'I took part in…': 'ฉันเข้าร่วม…', 'We won…': 'เราชนะ…', 'We lost…': 'เราแพ้…', 'I came…': 'ฉันได้อันดับ…', 'I was proud of…': 'ฉันภูมิใจที่…', 'We played well when…': 'เราเล่นได้ดีตอนที่…',
  'Performance or exhibition': 'การแสดงหรือนิทรรศการ', 'For a concert, a show, a display or an exhibition.': 'สำหรับคอนเสิร์ต การแสดง การจัดแสดง หรือนิทรรศการ',
  'What I showed': 'สิ่งที่ฉันแสดง', 'Getting ready': 'การเตรียมตัว', 'On the day': 'ในวันจริง', 'What people said': 'คนอื่นพูดว่าอย่างไร',
  'What did you perform or show?': 'คุณแสดงหรือนำเสนออะไร', 'How did you get ready?': 'คุณเตรียมตัวอย่างไร', 'How did it go on the day?': 'ในวันจริงเป็นอย่างไรบ้าง', 'What did people say about it?': 'คนอื่นพูดถึงมันว่าอย่างไร',
  'What would you do differently next time?': 'ครั้งหน้าคุณจะทำอะไรต่างไป', 'I performed…': 'ฉันแสดง…', 'I showed…': 'ฉันนำเสนอ…', 'On the day…': 'ในวันจริง…', 'I felt…': 'ฉันรู้สึก…', 'People said…': 'คนอื่นบอกว่า…',
  'Trip or service day': 'ทัศนศึกษาหรือวันจิตอาสา', 'For a school trip, a visit or a day helping others.': 'สำหรับทัศนศึกษา การไปเยี่ยมชม หรือวันที่ไปช่วยเหลือผู้อื่น',
  'Where we went': 'ที่ที่เราไป', 'What I learnt': 'สิ่งที่ฉันได้เรียนรู้', 'Why it mattered': 'ทำไมจึงสำคัญ',
  'Where did you go, and why?': 'คุณไปที่ไหน และไปทำไม', 'What did you do there?': 'คุณทำอะไรที่นั่น', 'What did you learn or notice?': 'คุณได้เรียนรู้หรือสังเกตเห็นอะไร', 'Why did it matter, to others or to you?': 'ทำไมเรื่องนี้จึงสำคัญ ต่อคนอื่นหรือต่อตัวคุณ',
  'We went to…': 'เราไปที่…', 'I helped…': 'ฉันช่วย…', 'I learnt that…': 'ฉันได้เรียนรู้ว่า…', 'It mattered because…': 'เรื่องนี้สำคัญเพราะ…',
  'Project milestone': 'ความคืบหน้าของโครงงาน', 'For a step along the way in a longer project.': 'สำหรับก้าวหนึ่งระหว่างทางของโครงงานที่ใช้เวลานาน',
  'The project': 'โครงงาน', 'Where I am now': 'ตอนนี้ฉันอยู่ตรงไหน', 'What was hard': 'สิ่งที่ยาก', 'Next step': 'ขั้นต่อไป',
  'What is the project?': 'โครงงานนี้คืออะไร', 'What have you finished so far?': 'ตอนนี้คุณทำอะไรเสร็จไปแล้วบ้าง', 'What was hard, and how did you deal with it?': 'อะไรยาก และคุณจัดการอย่างไร', 'What is your next step?': 'ขั้นต่อไปของคุณคืออะไร',
  'My project is…': 'โครงงานของฉันคือ…', 'So far I have…': 'ตอนนี้ฉัน…ไปแล้ว',
})) STU[k] ??= v;
STU_RE.push(
  [/^Ways to start: (.+)$/, (m, t) => `ลองเริ่มแบบนี้: ${t(m[1])}`],
  [/^(.+) gave you a guide:$/, (m) => `${m[1]} ให้ตัวช่วยเขียนกับคุณ:`],
);
// Skills growth (src/components/SkillsGrowth.jsx): My skills and picking skills for a moment; the family card uses SKILL_WORDS_TH.
export const SKILL_WORDS_TH = { Inquirer: 'ตั้งคำถาม', Knowledgeable: 'เรียนรู้สิ่งใหม่', Thinker: 'แก้ปัญหา', Communicator: 'แบ่งปันความคิดของฉัน',
  Principled: 'ทำในสิ่งที่ถูกต้อง', 'Open-minded': 'มองจากมุมของคนอื่น', Caring: 'ช่วยเหลือผู้อื่น', 'Risk-taker': 'ลองสิ่งใหม่', Balanced: 'ดูแลตัวเอง',
  Reflective: 'มองย้อนกลับและเรียนรู้', Thinking: 'คิดไอเดียใหม่', Communication: 'พูดและเขียน', Social: 'ทำงานร่วมกับผู้อื่น', 'Self-management': 'จัดการตัวเอง',
  Research: 'ค้นหาคำตอบ' };
for (const [k, v] of Object.entries({ Inquirer: 'Asking questions', Knowledgeable: 'Learning new things', Thinker: 'Solving problems', Communicator: 'Sharing my ideas',
  Principled: 'Doing the right thing', 'Open-minded': 'Seeing other points of view', Caring: 'Helping others', 'Risk-taker': 'Trying something new',
  Balanced: 'Looking after myself', Reflective: 'Looking back and learning', Thinking: 'Coming up with ideas', Communication: 'Speaking and writing',
  Social: 'Working with others', 'Self-management': 'Organising myself', Research: 'Finding things out' })) STU[v] ??= SKILL_WORDS_TH[k];
for (const [k, v] of Object.entries({
  'My skills': 'ทักษะของฉัน', 'Skills I’ve used': 'ทักษะที่ฉันใช้', 'When you add a moment, pick the skills you used. They collect here.': 'เมื่อเพิ่มเรื่องราว ให้เลือกทักษะที่คุณใช้ ทักษะจะมารวมกันที่นี่',
  'No skills here yet. Pick some for a moment below.': 'ยังไม่มีทักษะ ลองเลือกให้เรื่องราวด้านล่าง', 'When I used it': 'ตอนที่ฉันใช้ทักษะนี้',
  'Add skills to a moment': 'เพิ่มทักษะให้เรื่องราว', 'Skills to look out for': 'ทักษะที่น่าลองสังเกต', 'Moments with no skills yet': 'เรื่องราวที่ยังไม่มีทักษะ',
  'Every moment this school year has skills. Well done.': 'ทุกเรื่องราวในปีการศึกษานี้มีทักษะแล้ว เก่งมาก', 'Add a moment and pick the skills you used.': 'เพิ่มเรื่องราวแล้วเลือกทักษะที่คุณใช้',
  'How my skills are growing': 'ทักษะของฉันเติบโตอย่างไร', 'Skills by term': 'ทักษะแยกตามภาคเรียน',
  'No skills picked yet. Add skills to a moment and they show up here.': 'ยังไม่ได้เลือกทักษะ เพิ่มทักษะให้เรื่องราวแล้วจะแสดงที่นี่',
  'Moments behind it': 'เรื่องราวที่เกี่ยวข้อง', 'Learner profile': 'คุณลักษณะผู้เรียน IB', 'Approaches to learning': 'ทักษะการเรียนรู้ (ATL)',
  'What kind of learner I was': 'ฉันเป็นผู้เรียนแบบไหน', 'What I did': 'สิ่งที่ฉันทำ', 'Show as a table': 'แสดงเป็นตาราง', 'Show as a chart': 'แสดงเป็นแผนภูมิ',
  'Skill': 'ทักษะ', 'This school year': 'ปีการศึกษานี้', 'Terms': 'ภาคเรียน', 'Not yet': 'ยังไม่มี', 'Moments showing each skill, by term': 'เรื่องราวที่แสดงแต่ละทักษะ แยกตามภาคเรียน',
  'Which skills did I use? (optional)': 'ฉันใช้ทักษะอะไรบ้าง (ไม่บังคับ)', 'Which skills did I use?': 'ฉันใช้ทักษะอะไรบ้าง', 'Add skills (optional)': 'เพิ่มทักษะ (ไม่บังคับ)',
  'Skills this moment shows': 'ทักษะที่เรื่องราวนี้แสดง', 'Pick up to 3. You can skip this.': 'เลือกได้สูงสุด 3 อย่าง ข้ามได้', 'That is 3. Tap one again to change it.': 'ครบ 3 อย่างแล้ว แตะอีกครั้งเพื่อเปลี่ยน',
  'Change skills': 'เปลี่ยนทักษะ', 'Add skills': 'เพิ่มทักษะ', 'Save skills': 'บันทึกทักษะ', 'Skills saved.': 'บันทึกทักษะแล้ว', 'Skills taken off.': 'เอาทักษะออกแล้ว',
  'Skills I used': 'ทักษะที่ฉันใช้',
})) STU[k] ??= v;
STU_RE.push(
  [/^Term (\d)$/, (m) => `ภาคเรียนที่ ${m[1]}`], [/^Term (\d) · now$/, (m) => `ภาคเรียนที่ ${m[1]} · ตอนนี้`],
  [/^Term (\d): (\d+) moments?$/, (m) => `ภาคเรียนที่ ${m[1]}: ${m[2]} เรื่องราว`],
  [/^\((\d+) in Term 1, (\d+) in Term 2, (\d+) in Term 3\)$/, (m) => `(ภาคเรียนที่ 1: ${m[1]}, ภาคเรียนที่ 2: ${m[2]}, ภาคเรียนที่ 3: ${m[3]})`],
  [/^(.+) · (When I used it|Moments behind it)$/, (m) => { const a = studentThai(m[1]); return a ? `${a} · ${STU[m[2]]}` : null; }],
  [/^This school year \((\d{4})–(\d\d)\), from the skills you picked for your moments\. It is your own picture: no scores, and nobody is compared\.$/,
    (m) => `ปีการศึกษานี้ (${m[1]}–${m[2]}) จากทักษะที่คุณเลือกให้กับเรื่องราวของคุณ เป็นภาพของคุณเอง ไม่มีคะแนน และไม่มีการเปรียบเทียบกับใคร`],
  [/^(\d+) moments? this school year (?:has|have) no skills picked\. Suggestions the app made are not counted until you pick them\.$/,
    (m) => `เรื่องราว ${m[1]} รายการในปีการศึกษานี้ยังไม่ได้เลือกทักษะ ทักษะที่แอปแนะนำจะยังไม่นับจนกว่าคุณจะเลือก`],
);
// Not seen lately (src/components/NotSeen.jsx): a subject teacher's nudge, on the student's banner and in their bell.
Object.assign(STU, { 'Add one thing you did for this subject.': 'เพิ่มสิ่งหนึ่งที่คุณทำในวิชานี้' });
STU_RE.push(
  [/^(.+) would love to see something from (.+): “(.+)”$/, (m) => `${m[1]} อยากเห็นผลงานของคุณในวิชา ${m[2]}: “${m[3]}”`],
  [/^(.+) would love to see something from (.+)$/, (m) => `${m[1]} อยากเห็นผลงานของคุณในวิชา ${m[2]}`],
);
