// "Viewing as": one record, seen through each role's own screens.
export const PERSONAS = [
  { id: 'maya', kind: 'student', studentId: 'st-01', name: 'Maya Chen', role: 'Student · Year 13', initials: 'MC', colour: '#4F529B' },
  { id: 'arun', kind: 'student', studentId: 'st-02', name: 'Arun Mehta', role: 'Student · Year 12', initials: 'AM', colour: '#E73C3E' },
  { id: 'lena', kind: 'student', studentId: 'st-03', name: 'Lena Fischer', role: 'Student · Year 11', initials: 'LF', colour: '#FF8F1C' },
  { id: 'pim', kind: 'student', studentId: 'st-09', name: 'Pim Chaiyaporn', role: 'Student · Year 7', initials: 'PC', colour: '#008A60' },
  { id: 'whitfield', kind: 'advisor', teacherId: 't-07', name: 'Mr James Whitfield', role: 'Advisor · 4B', initials: 'JW', colour: '#008A60' },
  { id: 'nair', kind: 'teacher', teacherId: 't-01', name: 'Ms Priya Nair', role: 'Computer Science teacher', initials: 'PN', colour: '#002855' },
  { id: 'adeyemi', kind: 'counsellor', teacherId: 't-09', name: 'Ms Ruth Adeyemi', role: 'University counsellor', initials: 'RA', colour: '#E73C3E' },
  { id: 'brandt', kind: 'coordinator', teacherId: 't-08', name: 'Ms Clara Brandt', role: 'CAS coordinator', initials: 'CB', colour: '#FF8F1C' },
  { id: 'principal', kind: 'leadership', teacherId: 't-10', name: 'Dr Anan Wongsakul', role: 'Head of School', initials: 'AW', colour: '#002855' },
  { id: 'parent', kind: 'parent', children: ['st-06', 'st-09'], name: 'Khun Nok Chaiyaporn', role: 'Parent · Ploy (Year 11) and Pim (Year 7)', initials: 'NC', colour: '#FFB81C' },
  { id: 'maya-alum', kind: 'alum', studentId: 'st-01', name: 'Maya Chen', role: 'Alumna · Class of 2027 · March 2029', initials: 'MC', colour: '#4F529B' },
  { id: 'reader', kind: 'external', name: 'Admissions reader', role: 'Northbridge University (fictional)', initials: 'NU', colour: '#4F529B', token: 'tp-nb7d' },
];
export const KIND_LABEL = { student: 'Students', advisor: 'Advisor', teacher: 'Subject teacher', counsellor: 'Counsellor', coordinator: 'Coordinator', leadership: 'Leadership', parent: 'Family', alum: 'After NIST', external: 'External viewer' };

// Each kind of persona gets its own navigation. The first item is home.
export const NAV = {
  student: [['map', 'My map'], ['studio', 'Presentation studio'], ['shared', 'Shared view'], ['inbox', 'Inbox'], ['links', 'Share links'], ['activity', 'Activity'], ['privacy', 'Privacy'], ['family', 'Show my family']],
  advisor: [['advisory', 'Advisory 4B'], ['signals', 'Signals']],
  teacher: [['queue', 'Endorsements'], ['crosslinks', 'Cross-subject'], ['depot', 'Class depot'], ['import', 'Import a file']],
  counsellor: [['applications', 'Applications'], ['letter', 'Reference letter'], ['activities', 'Activities list'], ['search', 'Cohort search']],
  coordinator: [['cas', 'CAS outcomes'], ['schoolline', 'One line'], ['core', 'DP core'], ['governance', 'Lines'], ['import', 'Import a file']],
  leadership: [['dashboard', 'Dashboard'], ['schoolmetro', 'School metro'], ['profile', 'Learner profile'], ['pdpa', 'Privacy & PDPA'], ['rollout', 'Rollout'], ['pilot', 'Pilot options'], ['audit', 'Audit log'], ['scan', 'Scan-in']],
  parent: [['family', 'Family view'], ['consent', 'Consent'], ['digest', 'Weekly digest']],
  alum: [['journey', 'My record'], ['poster', 'Map poster']],
  external: [['reader', 'Shared portfolio']],
  admin: [['accounts', 'Accounts']], // pilot only: an admin account with no record of its own
};
// Pilot mode (src/auth.js): the signed-in person's own persona. Every route resolves to it,
// so nobody can switch to someone else's screens by editing the address.
let pilot = null;
export const setPilotPersona = (p) => { pilot = p; };
export const pilotPersona = () => pilot;
export const personaById = (id) => pilot || PERSONAS.find((p) => p.id === id) || PERSONAS[0];
// A persona may carry its own navigation (a pilot admin gets Accounts added to their role's screens).
export const navOf = (p) => p.nav || NAV[p.kind];
export const home = (p) => navOf(p)[0][0];
