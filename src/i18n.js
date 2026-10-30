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
