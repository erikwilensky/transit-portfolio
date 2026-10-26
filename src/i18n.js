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
