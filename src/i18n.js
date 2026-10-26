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
  Evidence: 'หลักฐาน', 'Merged with': 'รวมกับ', 'Teacher endorsement': 'คำรับรองจากครู', 'Signal:': 'คำถามชวนคิด:', Source: 'แหล่งที่มา', 'View record': 'ดูบันทึก',
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
  'Family view': 'มุมมองครอบครัว', Consent: 'การให้ความยินยอม', 'Weekly digest': 'สรุปประจำสัปดาห์',
};

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
