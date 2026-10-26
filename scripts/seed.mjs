// Generates the mock data in /data. Run with: node scripts/seed.mjs
// All people and records are fictional.
import { writeFileSync } from 'node:fs';
const out = (f, d) => writeFileSync(new URL(`../data/${f}`, import.meta.url), JSON.stringify(d, null, 2) + '\n');

const lines = [
  { id: 'science', name: 'Science', colour: '#6B3FB0', parentLineId: null, status: 'active' },
  { id: 'computing', name: 'Computing', colour: '#1E6FD9', parentLineId: null, status: 'active' },
  { id: 'environment', name: 'Environment', colour: '#2E9E4F', parentLineId: null, status: 'active' },
  { id: 'sport', name: 'Sport', colour: '#F2A100', parentLineId: null, status: 'active' },
  { id: 'service', name: 'Service', colour: '#E2343C', parentLineId: null, status: 'active' },
  { id: 'music', name: 'Music', colour: '#E0458B', parentLineId: null, status: 'active' },
  { id: 'design', name: 'Design', colour: '#00A39E', parentLineId: null, status: 'active' },
  { id: 'languages', name: 'Languages', colour: '#F06A1D', parentLineId: null, status: 'active' },
  { id: 'art', name: 'Art', colour: '#8A5A44', parentLineId: null, status: 'active' },
  // student sub-lines
  { id: 'maya-datasci', name: 'Data Science', colour: '#C152DB', parentLineId: 'science', status: 'active', studentId: 'st-01' },
  { id: 'maya-swim', name: 'Swimming', colour: '#F2A100', parentLineId: 'sport', status: 'ended', studentId: 'st-01' },
  { id: 'arun-musictech', name: 'Music Technology', colour: '#A23B72', parentLineId: 'music', status: 'active', studentId: 'st-02' },
  { id: 'arun-french', name: 'French', colour: '#F06A1D', parentLineId: 'languages', status: 'ended', studentId: 'st-02' },
  { id: 'lena-japanese', name: 'Japanese', colour: '#C2410C', parentLineId: 'languages', status: 'active', studentId: 'st-03' },
  { id: 'lena-ceramics', name: 'Ceramics', colour: '#8A5A44', parentLineId: 'art', status: 'ended', studentId: 'st-03' },
];

const teachers = [
  { id: 't-01', name: 'Ms Priya Nair', role: 'Computer Science' },
  { id: 't-02', name: 'Mr David Okafor', role: 'Biology' },
  { id: 't-03', name: 'Ms Sofia Marín', role: 'Music' },
  { id: 't-04', name: 'Mr Tom Hale', role: 'Design' },
  { id: 't-05', name: 'Kru Napat Srisuk', role: 'Languages' },
  { id: 't-06', name: 'Ms Hana Sato', role: 'Visual Arts' },
  { id: 't-07', name: 'Mr James Whitfield', role: 'Advisor, 4B' },
  { id: 't-08', name: 'Ms Clara Brandt', role: 'CAS Coordinator' },
];

const students = [
  { id: 'st-01', name: 'Maya Chen', grade: 12, programme: 'IB Diploma', avatar: { initials: 'MC', colour: '#6B3FB0' }, homeroom: '4B', advisorId: 't-07', g9StartYear: 2023,
    laneOrder: ['maya-swim', 'science', 'maya-datasci', 'computing', 'environment', 'service'], lineLabels: { science: 'Science · Biology' } },
  { id: 'st-02', name: 'Arun Mehta', grade: 11, programme: 'IB Diploma', avatar: { initials: 'AM', colour: '#E0458B' }, homeroom: '4B', advisorId: 't-07', g9StartYear: 2024,
    laneOrder: ['arun-french', 'music', 'arun-musictech', 'design', 'computing', 'languages'], lineLabels: { languages: 'Languages · Spanish' } },
  { id: 'st-03', name: 'Lena Fischer', grade: 10, programme: 'IB MYP', avatar: { initials: 'LF', colour: '#F06A1D' }, homeroom: '4B', advisorId: 't-07', g9StartYear: 2025,
    laneOrder: ['lena-japanese', 'languages', 'service', 'art', 'lena-ceramics'], lineLabels: { languages: 'Languages · Thai & English' } },
];

const events = [], reflections = [], endorsements = [];
const SRC = {
  sis: (ref) => ({ system: 'SIS', ref }), lms: (ref) => ({ system: 'ManageBac', ref }), cas: (ref) => ({ system: 'CAS log', ref }),
  clubs: (ref) => ({ system: 'Clubs & Sports', ref }), gh: (ref) => ({ system: 'GitHub', ref }), exam: (ref) => ({ system: 'Exam boards', ref }),
  manual: () => ({ system: 'Manual entry', ref: null }),
};
let rc = 1, ec = 1;
function ev(studentId, id, date, lineIds, type, title, summary, o = {}) {
  const verification = o.v || (o.src && !['Manual entry', 'GitHub'].includes(o.src.system) ? 'school-verified' : 'student-added');
  events.push({ id, studentId, title, date, lineIds, type, summary, evidence: o.evidence || [], verification: o.end ? 'teacher-endorsed' : verification,
    visibility: o.vis || 'publishable', source: o.src || SRC.manual() });
  if (o.refl) reflections.push({ id: `rf-${String(rc++).padStart(3, '0')}`, eventId: id, text: o.refl[1], date: o.refl[2] || date, prompt: o.refl[0] });
  if (o.end) endorsements.push({ id: `en-${String(ec++).padStart(3, '0')}`, eventId: id, teacherId: o.end[0], note: o.end[1], date: o.end[2] || date });
}
const link = (url, caption) => ({ kind: 'link', url, caption });
const file = (caption) => ({ kind: 'file', url: '#', caption });
const IMG = { 'Compost bin site': 'compost-bin', 'Volunteers sorting litter': 'beach-cleanup', Poster: 'sci-fair-poster', 'Sensor on the canteen roof': 'aq-sensor',
  'Prototype line-up': 'phone-stands', 'On stage': 'piano-stage', 'Arcade cabinet': 'arcade', 'Sketchbook spread': 'sketchbook', 'The bowl': 'bowl', 'Finished mural': 'mural' };
const img = (caption, name) => ({ kind: 'image', url: `evidence/${name || IMG[caption]}.svg`, caption });
const grade = (caption) => ({ kind: 'grade', url: null, caption });
const cert = (caption) => ({ kind: 'certificate', url: '#', caption });

// ── Maya Chen, Grade 12 ───────────────────────────────────────────────
const M = (...a) => ev('st-01', ...a);
M('ev-001', '2023-08-28', ['maya-swim'], 'sport', 'Joined varsity swim squad', 'Selected for the varsity squad; five sessions a week.', { src: SRC.clubs('roster-swim-23') });
M('ev-002', '2023-09-15', ['computing'], 'class', 'G9 Computing: intro to Python', 'First programming unit: loops, lists and a text adventure.', { src: SRC.lms('class-g9cs'), vis: 'school' });
M('ev-003', '2023-09-20', ['service'], 'club', 'Joined Beach Guardians', 'Student service club running monthly beach cleanups in Rayong.', { src: SRC.clubs('club-bg') });
M('ev-004', '2023-10-12', ['science'], 'assessment', 'Cell biology lab report', 'Microscopy of onion and cheek cells; scored 7/8 on criterion B.', { src: SRC.lms('task-2231'), evidence: [grade('MYP criterion B: 7/8')] });
M('ev-005', '2024-01-18', ['environment'], 'project', 'Campus composting audit', 'Weighed canteen food waste for six weeks and proposed a compost bin.', { evidence: [file('Audit spreadsheet'), img('Compost bin site')] });
M('ev-006', '2024-02-10', ['maya-swim'], 'competition', 'Regional champs: 200m IM, 4th', 'Personal best of 2:31 at the regional age-group championships.', { src: SRC.clubs('meet-2402'), evidence: [cert('Results sheet')] });
M('ev-007', '2024-03-05', ['computing'], 'project', 'Recycling quiz web app', 'First web app in HTML and JavaScript, used in a G6 assembly.', { evidence: [link('https://example.org/quiz', 'Live quiz')] });
M('ev-008', '2024-03-12', ['science'], 'class', 'Ecology field trip, Khao Yai', 'Quadrat sampling and species counts in the national park.', { src: SRC.lms('trip-khaoyai'), vis: 'school' });
M('ev-009', '2024-04-20', ['environment', 'service'], 'service', 'Beach cleanup + litter survey', 'Designed a tally sheet so 40 volunteers could log litter by type.', { end: ['t-08', 'Maya turned a cleanup into a data-collection exercise the club still uses.'], evidence: [img('Volunteers sorting litter'), file('Tally sheet template')] });
M('ev-010', '2024-05-15', ['science'], 'project', 'Science fair: microplastics', 'Filtered water from three canals and counted microplastic fibres.', { evidence: [img('Poster'), cert('Science fair: Silver')], refl: ['What surprised you?', 'Counting fibres by hand took forever. I wondered if a program could do it.'] });
M('ev-011', '2024-06-10', ['maya-swim'], 'sport', 'Swim training camp, Hua Hin', 'Week-long training camp; started to feel the time pressure.', { src: SRC.clubs('camp-2406') });
M('ev-012', '2024-06-20', ['science'], 'reflection', 'Reflection: why data keeps pulling me in', 'End-of-year reflection on the science fair and the composting audit.', { refl: ['What connected your projects this year?', 'Both projects were really about counting things carefully and finding a pattern. I liked the spreadsheet part best.'] });
M('ev-013', '2024-09-10', ['maya-swim'], 'sport', 'Cut to two sessions a week', 'Dropped to two sessions to make room for coursework and code club.', { src: SRC.clubs('roster-swim-24'), vis: 'advisor' });
M('ev-014', '2024-10-05', ['computing'], 'club', 'Arduino workshop', 'Wired a temperature sensor and logged readings to a laptop.', { src: SRC.clubs('club-maker') });
M('ev-015', '2024-10-20', ['service'], 'service', 'Tutoring G7 science', 'Weekly peer tutoring in the library for two terms.', { src: SRC.cas('svc-0412') });
M('ev-016', '2024-11-02', ['science'], 'assessment', 'Genetics unit test', 'Grade 10 genetics test.', { src: SRC.sis('grade-g10bio-t1'), evidence: [grade('Grade 7')] });
M('ev-017', '2025-01-20', ['environment'], 'project', 'Eco-committee energy audit', 'Read every classroom meter for a month; lights left on cost ฿18,000 a term.', { evidence: [file('Energy audit report')] });
M('ev-018', '2025-02-22', ['maya-swim'], 'competition', 'Last race: inter-school gala', 'Swam the 200m IM one last time, then left the squad.', { src: SRC.clubs('meet-2502'),
  refl: ['A line is ending. What are you taking with you?', 'Swimming taught me to train on a schedule. I stopped because I wanted my evenings for building things, not because I fell out of love with it.', '2025-03-01'] });
M('ev-019', '2025-03-10', ['science'], 'assessment', 'Enzyme kinetics investigation', 'Measured catalase activity across temperatures; first time graphing error bars.', { src: SRC.lms('task-3310'), evidence: [grade('MYP criterion C: 8/8')] });
M('ev-020', '2025-04-26', ['environment', 'service'], 'service', 'Led the litter survey team', 'Ran survey days for Beach Guardians and shared the results with the district office.', { src: SRC.cas('svc-0533'), evidence: [file('Survey summary for district office')] });
M('ev-021', '2025-05-10', ['computing'], 'award', 'Data visualisation course', 'Online course in pandas and matplotlib; 8 graded notebooks.', { src: SRC.manual(), evidence: [cert('Course certificate')] });
M('ev-022', '2025-06-15', ['environment'], 'cas', 'Mangrove planting trip', 'Three days planting and tagging mangroves in Chanthaburi.', { src: SRC.cas('cas-mangrove') });
M('ev-023', '2025-08-20', ['science'], 'class', 'Started IB Biology HL', 'Depot: IB Biology HL with Mr Okafor.', { src: SRC.sis('enrol-biohl') });
M('ev-024', '2025-08-21', ['computing'], 'class', 'Started IB Computer Science SL', 'Depot: IB CS SL with Ms Nair.', { src: SRC.sis('enrol-cssl') });
M('ev-025', '2025-10-01', ['service'], 'cas', 'CAS: STEM club for G6 girls', 'Co-founded a Friday STEM club; 14 regular members.', { src: SRC.cas('cas-stem'), end: ['t-08', 'A genuinely student-led CAS project with clear impact.'] });
M('ev-026', '2025-11-05', ['computing'], 'project', 'CO₂ sensor prototype', 'One classroom sensor on a Raspberry Pi, logging every minute.', { src: SRC.gh('repo-co2'), evidence: [link('https://example.org/co2', 'Source code')] });
M('ev-028', '2026-01-20', ['science'], 'assessment', 'Biology IA proposal', 'Proposal: algae growth against water temperature.', { src: SRC.lms('task-ia-bio') });
M('ev-042', '2026-03-14', ['computing', 'environment'], 'project', 'Air-quality sensor network', 'Built 6 Raspberry Pi sensors around campus and a live dashboard.',
  { src: SRC.lms('task-8812'), evidence: [link('https://example.org/aq', 'Dashboard'), img('Sensor on the canteen roof'), file('Calibration notes')],
    end: ['t-01', 'Maya designed the sensor housing, calibrated every unit against the school weather station and wrote the dashboard herself. Outstanding independent work.', '2026-03-20'],
    refl: ['This project touches two lines. What joined them?', 'I started it as an environment project, but the hard part was the data: cleaning gaps, spotting a broken sensor from its readings. That is when I realised I want to study data.', '2026-03-22'] });
M('ev-029', '2026-03-28', ['maya-datasci', 'computing'], 'project', 'Air-quality data report', 'Cleaned 40,000 readings in Python and found the canteen PM2.5 spike at lunch.',
  { evidence: [file('Report (PDF)'), link('https://example.org/aq-notebook', 'Notebook')], refl: ['A new line has branched. Why now?', 'Biology gave me the questions; the sensor project showed me I enjoy the analysis even more. Data Science is where those meet.'] });
M('ev-030', '2026-04-20', ['science', 'maya-datasci'], 'assessment', 'Biology IA: modelling algae growth', 'Fitted a regression model to 12 weeks of growth data.', { src: SRC.lms('task-ia-bio-2'), end: ['t-02', 'Statistical treatment well beyond the usual IA.'], evidence: [grade('IA predicted: 7')] });
M('ev-031', '2026-07-10', ['maya-datasci'], 'award', 'Data Science summer school', 'Two-week online summer school; final project on bike-share demand.', { evidence: [cert('Certificate of completion')] });
M('ev-032', '2026-09-15', ['maya-datasci'], 'project', 'Extended Essay: dengue and weather', 'EE draft: can rainfall and temperature predict dengue cases in Bangkok?', { src: SRC.lms('ee-maya'), vis: 'school' });
M('ev-033', '2026-09-28', ['computing'], 'competition', 'Youth hackathon: 2nd place', 'Team of three built a flood-alert chatbot in 24 hours.', { src: SRC.clubs('hack-2609'), evidence: [cert('Runner-up certificate'), link('https://example.org/flood', 'Demo video')] });
M('ev-034', '2026-10-10', ['service'], 'reflection', 'Reflection: what service taught me', 'CAS mid-point reflection.', { refl: ['How has service changed what you want to study?', 'Every service project I loved ended with a dataset someone could act on.'], vis: 'advisor' });
M('ev-035', '2027-01-15', ['maya-datasci'], 'goal', 'Extended Essay final submission', 'Planned: submit the EE in January.', {});
M('ev-036', '2027-07-01', ['maya-datasci'], 'goal', 'Target: BSc Data Science', 'Planned: start a Data Science degree.', {});

// ── Arun Mehta, Grade 11 ──────────────────────────────────────────────
const A = (...a) => ev('st-02', ...a);
A('ev-101', '2024-09-05', ['design'], 'class', 'Design: product sketching', 'MYP Design unit on orthographic and perspective sketching.', { src: SRC.lms('class-g9des'), vis: 'school' });
A('ev-102', '2024-09-20', ['music'], 'award', 'Piano Grade 5: Merit', 'Graded piano exam.', { src: SRC.exam('pno-5'), evidence: [cert('Grade 5 certificate')] });
A('ev-103', '2024-10-08', ['arun-french'], 'assessment', 'French: oral presentation', 'Two-minute talk about my neighbourhood.', { src: SRC.lms('task-fr-1') });
A('ev-104', '2024-10-22', ['computing'], 'class', 'G9 Computing: Python basics', 'Moved from Scratch to Python.', { src: SRC.lms('class-g9cs'), vis: 'school' });
A('ev-105', '2024-12-02', ['music'], 'club', 'Joined jazz band on keys', 'Rehearses Tuesdays; first time improvising.', { src: SRC.clubs('club-jazz') });
A('ev-106', '2025-01-20', ['computing'], 'club', 'Code club: first Pygame game', 'A side-scroller with chiptune music I wrote myself.', { src: SRC.clubs('club-code'), evidence: [link('https://example.org/pygame', 'Play it')] });
A('ev-107', '2025-02-15', ['design'], 'project', '3D-printed phone stand', 'Iterated four prototypes in Fusion.', { evidence: [img('Prototype line-up')] });
A('ev-108', '2025-03-20', ['arun-french', 'music'], 'club', 'Francophonie night performance', 'Sang and played “La Vie en rose” at the Francophonie evening.', { end: ['t-05', 'Brave performance, excellent pronunciation.'], evidence: [img('On stage')] });
A('ev-109', '2025-05-12', ['music'], 'club', 'Spring concert solo', 'Solo arrangement of a Thai folk song for piano.', { src: SRC.clubs('concert-25') });
A('ev-110', '2025-06-10', ['arun-french'], 'award', 'DELF A2 passed', 'External French exam.', { src: SRC.exam('delf-a2'), evidence: [cert('DELF A2')] });
A('ev-111', '2025-07-15', ['arun-musictech'], 'award', 'DAW summer course', 'Two-week course in a digital audio workstation.', { evidence: [cert('Course certificate')],
  refl: ['A new line has branched. What started it?', 'Writing the music for my Pygame game made me want to understand production, not just playing.'] });
A('ev-112', '2025-09-12', ['arun-musictech'], 'project', 'First EP, “Monsoon Loops”', 'Four tracks produced at home, released on the school music page.', { evidence: [link('https://example.org/ep', 'Listen')] });
A('ev-113', '2025-10-06', ['design'], 'assessment', 'MYP Design: ergonomic controller', 'Designed a one-handed game controller for a classmate with a wrist injury.', { src: SRC.lms('task-des-ctrl'), evidence: [grade('MYP Design: 7')] });
A('ev-114', '2025-10-20', ['arun-french'], 'assessment', 'French: written commentary', 'Commentary on a short story.', { src: SRC.lms('task-fr-5'), vis: 'school' });
A('ev-115', '2025-11-15', ['music'], 'award', 'Piano Grade 6: Distinction', 'Graded piano exam.', { src: SRC.exam('pno-6'), evidence: [cert('Grade 6 certificate')] });
A('ev-116', '2025-12-10', ['computing'], 'award', 'Unity fundamentals course', 'Online course; built a small 3D level.', { evidence: [cert('Course certificate')] });
A('ev-117', '2026-02-14', ['arun-musictech', 'design', 'computing'], 'project', 'Game-audio project: “Rainfall”', 'An adaptive soundtrack that changes with the weather in a Unity game.',
  { src: SRC.gh('repo-rainfall'), evidence: [link('https://example.org/rainfall', 'Playable build'), file('Audio design document')],
    end: ['t-04', 'Arun designed the game, the interaction and the sound system together. A real cross-disciplinary piece.', '2026-02-25'],
    refl: ['This project joins three lines. What did each bring?', 'Design gave me the player’s view, code made the music react, and music technology made it sound right.'] });
A('ev-118', '2026-03-08', ['music'], 'competition', 'Jazz band: schools festival', 'Band placed second at the Bangkok schools jazz festival.', { src: SRC.clubs('fest-26') });
A('ev-119', '2026-04-18', ['design', 'computing'], 'project', 'Arcade cabinet for open day', 'Built a cabinet with a Raspberry Pi running student games.', { evidence: [img('Arcade cabinet')] });
A('ev-120', '2026-05-20', ['arun-french'], 'assessment', 'Final French exam', 'MYP eAssessment; then left French.', { src: SRC.sis('eassess-fr'),
  refl: ['A line is ending. What are you taking with you?', 'I chose Spanish for the DP because my cousins speak it. French taught me how to learn a language, so I am not starting from zero.'] });
A('ev-121', '2026-06-12', ['arun-musictech'], 'project', 'Sound design for the school play', 'Designed and ran live sound for “The Tempest”.', { end: ['t-03', 'Calm and professional on the desk all week.'] });
A('ev-122', '2026-08-20', ['music'], 'class', 'Started IB Music HL', 'Depot: IB Music HL.', { src: SRC.sis('enrol-mushl') });
A('ev-123', '2026-08-20', ['computing'], 'class', 'Started IB Computer Science HL', 'Depot: IB CS HL.', { src: SRC.sis('enrol-cshl') });
A('ev-124', '2026-08-22', ['languages'], 'class', 'Started Spanish ab initio', 'New language for the Diploma.', { src: SRC.sis('enrol-spab') });
A('ev-125', '2026-10-01', ['design'], 'project', 'MIDI controller PCB', 'Designed my own 16-pad controller board.', { src: SRC.gh('repo-midi') });
A('ev-126', '2026-10-10', ['arun-musictech'], 'assessment', 'Music HL: composition draft', 'First composition draft for Music HL.', { src: SRC.lms('task-mus-c1'), vis: 'school' });
A('ev-127', '2026-10-15', ['languages'], 'assessment', 'Spanish: first oral', 'Introduced myself and my family.', { src: SRC.lms('task-sp-1'), vis: 'advisor' });
A('ev-128', '2027-06-01', ['music'], 'goal', 'Piano Grade 8', 'Planned: sit Grade 8 piano.', {});
A('ev-129', '2027-10-15', ['computing'], 'goal', 'CS IA: procedural music engine', 'Planned: IB CS internal assessment.', {});
A('ev-130', '2028-06-01', ['arun-musictech'], 'goal', 'Target: BMus Music Technology', 'Planned: study music technology.', {});

// ── Lena Fischer, Grade 10 ────────────────────────────────────────────
const L = (...a) => ev('st-03', ...a);
L('ev-201', '2025-09-02', ['lena-ceramics'], 'club', 'Joined ceramics club', 'Thursday after-school club.', { src: SRC.clubs('club-ceramics') });
L('ev-204', '2025-11-20', ['languages'], 'reflection', 'Reflection: arriving in a new school', 'First-term reflection.', { refl: ['What has been hardest, and what has helped?', 'Not understanding the canteen staff at first. Learning ten Thai phrases a week helped more than anything.'] });
L('ev-205', '2025-12-05', ['service'], 'service', 'Joined Language Buddies', 'Peer support for new students who speak little English.', { src: SRC.cas('svc-lb') });
L('ev-206', '2026-01-15', ['art'], 'project', '100 days of drawing', 'One sketch a day for 100 days.', { evidence: [img('Sketchbook spread')] });
L('ev-207', '2026-02-12', ['languages', 'service'], 'service', 'Welcome pack translation', 'Translated the new-family welcome pack into German and simple English.', { end: ['t-05', 'Thoughtful, accurate translation now used by admissions.'], evidence: [file('Welcome pack (DE)')],
  refl: ['This joins two lines. What joined them?', 'I knew what it felt like to arrive without the language.'] });
L('ev-208', '2026-02-26', ['lena-ceramics'], 'project', 'First wheel-thrown bowl', 'After six weeks of collapsed attempts.', { evidence: [img('The bowl')] });
L('ev-209', '2026-03-20', ['art'], 'reflection', 'Reflection: what 100 days taught me', 'Reflection on the drawing challenge.', { refl: ['What did repetition teach you?', 'The drawings got better after day 60, when I stopped drawing what I thought I should.'] });
L('ev-210', '2026-04-22', ['lena-ceramics'], 'club', 'Ceramics showcase', 'Showed three pieces, then left the club.', { src: SRC.clubs('show-26'),
  refl: ['A line is ending. What are you taking with you?', 'The club moved to Thursdays, which clashed with Language Buddies. I chose tutoring. I still love clay.'] });
L('ev-211', '2026-05-10', ['languages'], 'project', 'Started learning Japanese', 'Self-study with an app and anime subtitles.', {});
L('ev-212', '2026-06-05', ['art', 'service'], 'service', 'Community centre mural', 'Designed and led painting of a 6 m mural with 12 volunteers.', { src: SRC.cas('svc-mural'), end: ['t-06', 'Lena led the design process with real maturity.'], evidence: [img('Finished mural')] });
L('ev-213', '2026-06-20', ['lena-japanese'], 'award', 'Japanese club: kana certificate', 'Passed the club’s hiragana and katakana test.', { src: SRC.clubs('club-jp'), evidence: [cert('Kana certificate')],
  refl: ['A new line has branched. Why now?', 'Self-study got serious enough that I wanted a teacher and a test.'] });
L('ev-214', '2026-08-19', ['lena-japanese'], 'class', 'Started Japanese elective', 'Depot: G10 Japanese.', { src: SRC.sis('enrol-jp') });
L('ev-218', '2026-10-14', ['service'], 'reflection', 'Reflection: why tutoring matters', 'Term reflection.', { refl: ['What do you notice about yourself when you help others?', 'I am more patient with my buddies than with myself. I am trying to fix that.'] });
L('ev-219', '2026-12-06', ['lena-japanese'], 'goal', 'JLPT N5', 'Planned: sit the JLPT N5 in December.', {});
L('ev-220', '2027-03-15', ['art'], 'goal', 'Personal Project: bilingual zine', 'Planned: MYP Personal Project.', {});

// ── Extra illustrated evidence (drawn by scripts/illustrations.mjs) ─────
const EXTRA_IMAGES = {
  'ev-042': ['aq-dashboard', 'Live dashboard'], 'ev-029': ['aq-dashboard', 'PM2.5 by location'], 'ev-022': ['mangroves', 'Tagged seedlings'],
  'ev-025': ['stem-club', 'Friday STEM club'], 'ev-033': ['hackathon', 'Results board'], 'ev-109': ['piano-stage', 'Spring concert'],
  'ev-117': ['rainfall-game', 'In-game storm sequence'], 'ev-125': ['pcb', 'PCB layout'], 'ev-207': ['welcome-pack', 'Welcome pack cover'],
};
for (const [id, [name, caption]] of Object.entries(EXTRA_IMAGES)) events.find((e) => e.id === id).evidence.push(img(caption, name));

// ── Full reflections, in the students' own voices ────────────────────────
const FULL = {
  'ev-010': `Counting fibres by hand took forever. I had three jars of canal water, a cheap microscope from the science store and a tally sheet, and every session ended with sore eyes and numbers I didn't fully trust.

Halfway through, Mr Okafor asked how I knew I hadn't counted the same fibre twice. I didn't. So I started photographing each slide and marking fibres on the photo instead, which was slower but meant someone else could check me.

What surprised me most wasn't the result (canal B was much worse) but how much of science is bookkeeping. I kept thinking a program could do the counting. I didn't know how to write one yet.`,
  'ev-012': `Looking back at Grade 9, my projects look unrelated on paper: a composting audit, a science fair, a quiz website. But they were all really about counting things carefully and finding a pattern.

The best part of the composting audit wasn't the bin we eventually got. It was the spreadsheet: six weeks of canteen waste, and the moment the chart showed Mondays were twice as bad as Fridays. I sat with it for an hour trying to work out why (it was the weekend fridge clear-out).

I want next year to have fewer projects and deeper ones. And I want to learn enough code to stop doing the boring parts by hand.`,
  'ev-018': `Swimming taught me to train on a schedule. Five mornings a week for three years builds a kind of discipline I don't think I would have found anywhere else, and I'm proud of the 2:31.

I stopped because I wanted my evenings for building things, not because I fell out of love with it. That was a hard conversation with my coach and with my parents, who had driven me to 6 a.m. sessions for years.

Ending a line doesn't feel like failing anymore. It feels like choosing. I still swim on Sundays, just without a stopwatch.`,
  'ev-042': `I started this as an environment project: the canteen felt smoky at lunch and I wanted proof. Building the six sensors was the fun part. The hard part was everything after.

Two sensors drifted. One died for four days when a cleaner unplugged it, and the gap made the dashboard lie. I spent more time cleaning data than soldering: spotting the broken unit from its readings alone, deciding how to fill gaps honestly, checking every unit against the school weather station.

That's when I realised the part I enjoy most isn't the hardware or even the environment question. It's turning messy readings into something someone can trust and act on. Ms Nair said the calibration notes were the most impressive part, and I think she's right. That's why I want to study data.`,
  'ev-029': `Biology gave me the questions; the sensor project showed me I enjoy the analysis even more. Data Science is where those meet, so I've started treating it as its own line.

This report was the first time I wrote Python that someone else depended on. Forty thousand readings, a lunch-time PM2.5 spike in the canteen, and a recommendation the facilities team actually followed (they moved the extractor fan schedule).

I'm nervous about calling it a "line" when it's only a few months old. But the map shows it clearly: everything I've done since March has run along it.`,
  'ev-034': `When I joined Beach Guardians in Grade 9 I thought service meant picking up rubbish. It does, but the cleanups that changed anything were the ones where we counted what we found and sent it to the district office.

The STEM club taught me the same lesson from the other side. The girls stayed when they could see their sensor readings change in real time, not when I explained theory.

Every service project I loved ended with a dataset someone could act on. I think that is what I want my degree, and my work after it, to be about.`,
  'ev-111': `Writing the music for my Pygame game made me want to understand production, not just playing. My piano teacher can tell me why a chord works; she can't tell me why my game music sounded thin through laptop speakers.

The DAW course was two weeks of headphones and frustration. I learned that most of what makes music sound "finished" is invisible: levels, space, removing things rather than adding them.

It's strange to see this branch off my Music line on the map, because it doesn't feel separate to me. But I play differently now. I listen for the room, not just the notes.`,
  'ev-117': `This project joins three lines and it's the first time all of me was useful at once. Design gave me the player's view: what should a storm feel like, and when should the music get out of the way? Code made the music react to the weather system in real time. Music technology made it sound right.

The hardest bug was musical, not technical: transitions between calm and storm sounded like someone changing the radio station. I rewrote the system three times before it crossfaded on the beat.

Mr Hale asked me which subject this was for. I didn't have an answer, and I think that's the point. I want to keep doing work that doesn't fit in one box.`,
  'ev-120': `I chose Spanish for the Diploma because my cousins in Madrid speak it, and I want to talk to them without my mum translating. Dropping French felt like quitting something I'd been good at.

But French taught me how to learn a language: flashcards every night, speaking before I felt ready, singing in front of people at Francophonie night. So I'm not starting from zero with Spanish, even if the vocabulary is new.

I'm keeping the DELF certificate on my map. It's a finished line, not a failed one.`,
  'ev-204': `Not understanding the canteen staff at first was the hardest part. I had moved from Munich in July and spoke no Thai, and ordering lunch became a small daily test I kept failing.

Learning ten Thai phrases a week helped more than anything. Kru Napat gave me a list, and I practised them on the bus. By November I could order, say thank you properly and make the auntie at the noodle stall laugh.

I'm writing this down because I want to remember how it felt. Someone else will arrive next year feeling exactly the same.`,
  'ev-207': `I knew what it felt like to arrive without the language, so when admissions asked for volunteers to translate the welcome pack into German, I said yes straight away.

It was harder than I expected. Some phrases don't translate, like "uniform shop" or "house points", and I had to explain them rather than translate them. I added a page of the phrases I wished someone had given me.

Two families have already used it. One mum found me at pick-up to say thank you. That moment is the reason this station sits where my Languages and Service lines meet.`,
  'ev-209': `The drawings got better after day 60, when I stopped drawing what I thought I should and started drawing what was in front of me: my shoes, the bus window, my brother asleep.

The first 59 days weren't wasted, though. They were how I got there. Some days I drew for two minutes because I had a test; I still counted them.

What I learned is that repetition is boring until suddenly it isn't. I think that's true for languages too.`,
  'ev-210': `The ceramics club moved to Thursdays, which clashed with Language Buddies. I had to choose, and I chose tutoring.

I was sad about it. Clay is the one thing that makes my brain completely quiet, and my wheel-thrown bowl took six weeks of collapsed attempts. But Language Buddies is where I feel most useful, and the new students rely on me being there.

The line ends here on my map, but I still love clay. Maybe it will come back as a branch later.`,
  'ev-213': `Self-study got serious enough that I wanted a teacher and a test. I'd been learning Japanese from an app and anime subtitles since May, mostly for fun.

Passing the kana test proved to me that this wasn't just a phase. It also helped that learning a third script made Thai feel less scary in hindsight.

I like seeing Japanese branch off Languages on my map. It started as a hobby and now it's going somewhere: I want to take it in the Diploma.`,
  'ev-218': `I am more patient with my buddies than with myself. When a Grade 6 student mixes up words, I tell them it's normal. When I mix up Thai tones, I get angry.

This term I have two new buddies, one from Korea and one from Brazil. We use a mix of English, gestures and translation apps, and somehow it works.

I'm trying to talk to myself the way I talk to them. That might be the most useful thing tutoring has taught me.`,
};
for (const r of reflections) if (FULL[r.eventId]) r.text = FULL[r.eventId];
// Reflections are private by default; these are the ones each student chose to publish.
const PUBLISHED_REFLECTIONS = ['ev-010', 'ev-012', 'ev-042', 'ev-029', 'ev-111', 'ev-117', 'ev-207', 'ev-209', 'ev-213', 'ev-218'];
for (const r of reflections) r.visibility = PUBLISHED_REFLECTIONS.includes(r.eventId) ? 'publishable' : r.eventId === 'ev-034' ? 'advisor' : 'private';

// ── Cohort sample (advisor grid only), generated deterministically ──────
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const cohort = [
  ['st-04', 'Kai Tanaka', 11, ['sport', 'science', 'service'], 1],
  ['st-05', 'Noor Haddad', 12, ['languages', 'art', 'service', 'environment'], 5],
  ['st-06', 'Ploy Srisai', 10, ['music', 'design', 'sport'], 4],
  ['st-07', 'Mateo Ruiz', 12, ['computing', 'sport', 'science'], 2],
  ['st-08', 'Sienna Okoye', 11, ['science', 'environment', 'service', 'art'], 6],
];
let gc = 300;
for (const [id, name, grade, ls, nRefl] of cohort) {
  const start = 2026 - (grade - 9) - 0;
  students.push({ id, name, grade, programme: grade >= 11 ? 'IB Diploma' : 'IB MYP', avatar: { initials: name.split(' ').map((p) => p[0]).join(''), colour: '#6b7280' },
    homeroom: '4B', advisorId: 't-07', g9StartYear: start, laneOrder: ls, lineLabels: {}, cohortOnly: true });
  const n = 9 + Math.floor(rnd() * 8);
  const today = new Date('2026-10-20').getTime(), t0 = new Date(`${start}-08-25`).getTime();
  const dates = Array.from({ length: n }, () => new Date(t0 + rnd() * (today - t0)).toISOString().slice(0, 10)).sort();
  dates.forEach((d, i) => {
    const l = ls[Math.floor(rnd() * ls.length)];
    const isRefl = i % Math.max(2, Math.floor(n / Math.max(nRefl, 1))) === 1 && nRefl > 0;
    const lineIds = !isRefl && rnd() < 0.15 ? [l, ls[(ls.indexOf(l) + 1) % ls.length]].sort((a, b) => ls.indexOf(a) - ls.indexOf(b)) : [l];
    ev(id, `ev-${gc++}`, d, lineIds, isRefl ? 'reflection' : ['class', 'project', 'club', 'service', 'assessment'][Math.floor(rnd() * 5)],
      isRefl ? 'Reflection' : `${lines.find((x) => x.id === l).name} activity`, 'Cohort sample record.', { src: isRefl ? SRC.manual() : SRC.lms(`gen-${gc}`),
        refl: isRefl ? ['Term check-in', 'Sample reflection.'] : undefined });
  });
}

// ── Presentations (saved lenses) ──────────────────────────────────────
const presentations = [
  { id: 'pr-01', studentId: 'st-01', audience: 'general', targetName: null, tier: 'template', title: 'Maya Chen: my journey', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'profile', showMap: true, narratives: {},
    intro: 'I am a Grade 12 IB student in Bangkok who likes turning local problems into data: canals, classrooms, beaches and air.',
    shareLinks: [{ token: 'tp-g3n2', presentationId: 'pr-01', expiresAt: '2026-11-30', revoked: false, views: 9 }] },
  { id: 'pr-02', studentId: 'st-01', audience: 'university', targetName: null, tier: 'builder', title: 'Maya Chen: university portfolio', intro: 'My map has six lines, but one question runs through all of them: what can careful measurement tell us about the place we live? This page follows how that question grew from a Grade 9 science fair into a plan to study Data Science.', filters: { hiddenLines: [] }, order: ['maya-datasci', 'science', 'computing', 'environment', 'service', 'maya-swim'], theme: 'ivy', layout: 'narrative', showMap: false,
    narratives: {
      'maya-datasci': 'Data Science branched off my Biology line in Grade 11, when an air-quality project showed me I enjoy the analysis more than the collection. Since then I have modelled algae growth for my IA and I am predicting dengue outbreaks from weather data for my Extended Essay.',
      science: 'Biology gave me my questions: microplastics in canals, enzyme kinetics, algae growth. Each project pushed me toward more careful measurement.',
      computing: 'I learned to code in Grade 9 and use it as a tool: sensors, dashboards and a hackathon chatbot.',
      environment: 'Most of my projects start with a local environmental problem I can measure.',
      service: 'Beach Guardians and the STEM club taught me that data is only useful when someone can act on it.',
      'maya-swim': 'Four years of competitive swimming taught me to train on a schedule.' },
    shareLinks: [{ token: 'tp-u8k4', presentationId: 'pr-02', expiresAt: '2026-12-15', revoked: false, views: 14 }] },
  { id: 'pr-03', studentId: 'st-01', audience: 'specific', targetName: 'Data Science', institution: 'Northbridge University (fictional), BSc Data Science', tier: 'builder', title: 'Maya Chen: why Data Science', filters: { hiddenLines: [] }, order: null, theme: 'ivy', layout: 'letter', showMap: false, focusLines: ['maya-datasci', 'computing', 'science'],
    whyCourse: 'Every line on my map that kept growing ended in a dataset. Data Science is the course that joins the questions I learned to ask in Biology with the tools I taught myself in Computing.',
    narratives: {}, shareLinks: [{ token: 'tp-nb7d', presentationId: 'pr-03', expiresAt: '2027-01-31', revoked: false, views: 3 }] },
  { id: 'pr-04', studentId: 'st-01', audience: 'employer', targetName: null, tier: 'template', title: 'Maya Chen: projects and experience', intro: 'Student builder with hands-on experience in sensors, Python data analysis and running volunteer teams.', skills: ['Python (pandas, matplotlib)', 'Raspberry Pi and sensors', 'Dashboards and data visualisation', 'Team leadership', 'Public speaking'], filters: { hiddenLines: [] }, order: null, theme: 'slate', layout: 'cv', showMap: false, narratives: {},
    shareLinks: [{ token: 'tp-e1x9', presentationId: 'pr-04', expiresAt: '2026-09-30', revoked: true, views: 2 }] },

  { id: 'pr-11', studentId: 'st-02', audience: 'general', targetName: null, tier: 'template', title: 'Arun Mehta: my journey', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'profile', showMap: true, narratives: {}, shareLinks: [{ token: 'tp-a1g0', presentationId: 'pr-11', expiresAt: '2026-12-01', revoked: false, views: 5 }] },
  { id: 'pr-12', studentId: 'st-02', audience: 'university', targetName: null, tier: 'builder', title: 'Arun Mehta: university portfolio', filters: { hiddenLines: [] }, order: null, theme: 'ivy', layout: 'narrative', showMap: false,
    narratives: { music: 'Music has been my steadiest line: graded piano, jazz band and now Music HL.', 'arun-musictech': 'Music Technology branched off when I started writing music for my own games.', design: 'Design taught me to start from the person using the thing.', computing: 'Code is how I make music react.' },
    shareLinks: [{ token: 'tp-a2u1', presentationId: 'pr-12', expiresAt: '2027-01-15', revoked: false, views: 2 }] },
  { id: 'pr-13', studentId: 'st-02', audience: 'specific', targetName: 'Music Technology', institution: 'Lakeside Conservatoire (fictional), BMus Music Technology', tier: 'builder', title: 'Arun Mehta: why Music Technology', filters: { hiddenLines: [] }, order: null, theme: 'ivy', layout: 'letter', showMap: false, focusLines: ['arun-musictech', 'music', 'computing'],
    whyCourse: 'My Music line never stopped, and every time it met Design or Computing something new happened. Music Technology is the course where all three are the point.', narratives: {}, shareLinks: [] },
  { id: 'pr-14', studentId: 'st-02', audience: 'employer', targetName: null, tier: 'template', title: 'Arun Mehta: projects and experience', intro: 'Musician and developer who builds interactive audio for games and live events.', skills: ['Unity and C#', 'Digital audio workstations', 'Live sound', '3D printing and PCB design', 'Piano (Grade 7)'], filters: { hiddenLines: [] }, order: null, theme: 'slate', layout: 'cv', showMap: false, narratives: {}, shareLinks: [] },

  { id: 'pr-21', studentId: 'st-03', audience: 'general', targetName: null, tier: 'template', title: 'Lena Fischer: my journey', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'profile', showMap: true, narratives: {}, shareLinks: [{ token: 'tp-l5g2', presentationId: 'pr-21', expiresAt: '2026-12-20', revoked: false, views: 4 }] },
  { id: 'pr-22', studentId: 'st-03', audience: 'university', targetName: null, tier: 'template', title: 'Lena Fischer: portfolio', filters: { hiddenLines: [] }, order: null, theme: 'ivy', layout: 'narrative', showMap: false,
    narratives: { languages: 'I arrived in Bangkok in Grade 9 speaking no Thai. Languages became the line everything else hangs from.', service: 'Language Buddies is where my languages turned into something useful for other people.', art: 'Art is where I slow down.' }, shareLinks: [] },
  { id: 'pr-23', studentId: 'st-03', audience: 'specific', targetName: 'Japanese', institution: 'IB Diploma course choice: Japanese ab initio', tier: 'template', title: 'Lena Fischer: why Japanese', filters: { hiddenLines: [] }, order: null, theme: 'ivy', layout: 'letter', showMap: false, focusLines: ['lena-japanese', 'languages'],
    whyCourse: 'Japanese started as a hobby and became a branch of my Languages line within a year. I want to take it further in the Diploma.', narratives: {}, shareLinks: [] },
  { id: 'pr-24', studentId: 'st-03', audience: 'employer', targetName: null, tier: 'template', title: 'Lena Fischer: volunteering and experience', intro: 'Multilingual volunteer who helps new families settle in, with experience in translation and community art.', skills: ['German, English, Thai', 'Translation', 'Peer tutoring', 'Mural design', 'Workshop leading'], filters: { hiddenLines: [] }, order: null, theme: 'slate', layout: 'cv', showMap: false, narratives: {}, shareLinks: [] },

  { id: 'pr-05', studentId: 'st-01', audience: 'scholarship', targetName: null, tier: 'template', title: 'Maya Chen: service and impact', intro: 'Four years of service, from beach cleanups to a STEM club for younger girls, and the data that made each one useful.', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'impact', showMap: false, narratives: {}, shareLinks: [] },
  { id: 'pr-15', studentId: 'st-02', audience: 'scholarship', targetName: null, tier: 'template', title: 'Arun Mehta: contribution and impact', intro: 'Music and technology used for the school community: concerts, the school play and an arcade for open day.', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'impact', showMap: false, narratives: {}, shareLinks: [] },
  { id: 'pr-25', studentId: 'st-03', audience: 'scholarship', targetName: null, tier: 'template', title: 'Lena Fischer: service and impact', intro: 'Since arriving in Bangkok without the language, I have helped other new students do the same.', filters: { hiddenLines: [] }, order: null, theme: 'metro', layout: 'impact', showMap: false, narratives: {}, shareLinks: [] },
];

// Ended lines are private by default: hide them in every presentation unless the
// student chose to publish (Maya keeps Swimming in her university portfolio).
const ENDED = { 'st-01': ['maya-swim'], 'st-02': ['arun-french'], 'st-03': ['lena-ceramics'] };
for (const p of presentations) if (p.id !== 'pr-02') p.filters.hiddenLines = [...ENDED[p.studentId]];

// ── Integrations (adapters) and items waiting at the next sync ──────────
const integrations = [
  { id: 'sis', name: 'SIS', detail: 'Enrolment, classes, grades', lastSynced: '2026-10-26T01:10:00Z', mode: 'Nightly pull', itemCount: 1284 },
  { id: 'lms', name: 'LMS · ManageBac', detail: 'Assignments, IA milestones', lastSynced: '2026-10-26T03:20:00Z', mode: 'Webhook', itemCount: 3912 },
  { id: 'cas', name: 'CAS log', detail: 'CAS and service hours', lastSynced: '2026-10-25T22:00:00Z', mode: 'Hourly pull', itemCount: 641 },
  { id: 'clubs', name: 'Clubs & Sports', detail: 'Rosters, fixtures, results', lastSynced: '2026-10-24T09:00:00Z', mode: 'CSV import', itemCount: 488 },
  { id: 'github', name: 'GitHub', detail: 'Student-linked repositories (opt-in)', lastSynced: '2026-10-25T18:45:00Z', mode: 'Webhook', itemCount: 97 },
  { id: 'exams', name: 'Exam boards', detail: 'Music, language and external exams', lastSynced: '2026-10-01T00:00:00Z', mode: 'Monthly pull', itemCount: 156 },
];
// Items waiting at the next sync. They land in the student's inbox as
// candidates; the student decides which line (if any) each joins.
const P = (sourceId, id, studentId, date, lineIds, type, title, summary, ref, verification = 'school-verified') =>
  ({ sourceId, event: { id, studentId, title, date, lineIds, type, summary, evidence: [], verification, visibility: 'advisor', source: { system: SYSTEM[sourceId], ref } } });
const SYSTEM = { sis: 'SIS', lms: 'ManageBac', cas: 'CAS log', clubs: 'Clubs & Sports', github: 'GitHub', exams: 'Exam boards' };
const pending = [
  P('github', 'ev-037', 'st-01', '2026-10-20', ['computing'], 'project', 'Air-quality dashboard v2', 'Pushed v2: alerts when PM2.5 crosses the WHO limit.', 'repo-aq@v2.0', 'student-added'),
  P('github', 'ev-040', 'st-01', '2026-10-12', ['computing'], 'project', 'Forked a weather-API library', 'Forked a library to read the Thai Meteorological Department feed.', 'fork-tmd-api', 'student-added'),
  P('lms', 'ev-038', 'st-01', '2026-10-22', ['maya-datasci'], 'assessment', 'EE: research question approved', 'Supervisor approved the Extended Essay research question.', 'ee-maya-rq'),
  P('lms', 'ev-041', 'st-01', '2026-10-16', ['computing'], 'assessment', 'CS IA: proposal submitted', 'Proposal for a flood-alert app for the school bus routes.', 'task-cs-ia-1'),
  P('cas', 'ev-039', 'st-01', '2026-10-24', ['service'], 'cas', 'STEM club: 20th session', 'Logged the 20th session of the G6 STEM club.', 'cas-stem-20'),
  P('sis', 'ev-043', 'st-01', '2026-10-25', ['science'], 'assessment', 'Term 1 report: Biology HL', 'Term 1 report published: predicted 7.', 'rpt-t1-bio'),
  P('sis', 'ev-044', 'st-01', '2026-10-25', [], 'award', 'Attendance: 100% in Term 1', 'Full attendance recorded for Term 1.', 'att-t1'),
  P('clubs', 'ev-045', 'st-01', '2026-10-08', [], 'club', 'Joined Model UN', 'Added to the Model UN roster for the November conference.', 'club-mun'),
  P('exams', 'ev-046', 'st-01', '2026-10-05', [], 'award', 'IELTS Academic: 8.0', 'External English test result received.', 'ielts-8'),
  P('github', 'ev-131', 'st-02', '2026-10-21', ['computing'], 'project', 'MIDI controller firmware', 'First firmware release for the 16-pad controller.', 'repo-midi@v0.1', 'student-added'),
  P('exams', 'ev-132', 'st-02', '2026-10-18', ['music'], 'award', 'Piano Grade 7: Merit', 'Graded piano exam result received.', 'pno-7'),
  P('lms', 'ev-133', 'st-02', '2026-10-19', ['music'], 'assessment', 'Music HL: listening paper', 'First practice listening paper.', 'task-mus-l1'),
  P('cas', 'ev-134', 'st-02', '2026-10-23', ['arun-musictech'], 'cas', 'Sound desk for G6 assembly', 'Ran sound for the Grade 6 assembly.', 'cas-sound-1'),
  P('sis', 'ev-135', 'st-02', '2026-10-25', ['languages'], 'assessment', 'Term 1 report: Spanish ab initio', 'Term 1 report published.', 'rpt-t1-sp'),
  P('clubs', 'ev-136', 'st-02', '2026-10-09', ['music'], 'club', 'Jazz band: new season', 'Re-registered for jazz band, now as band captain.', 'club-jazz-26'),
  P('cas', 'ev-222', 'st-03', '2026-10-23', ['service'], 'service', 'Language Buddies: 30 hours', 'Passed 30 logged hours of peer support.', 'svc-lb-30'),
  P('lms', 'ev-223', 'st-03', '2026-10-21', ['lena-japanese'], 'assessment', 'Japanese: first quiz', 'Vocabulary quiz, unit 2.', 'task-jp-2'),
  P('clubs', 'ev-224', 'st-03', '2026-10-11', ['art'], 'club', 'Art club: exhibition helper', 'Helped hang the Grade 12 art exhibition.', 'club-art-ex'),
  P('sis', 'ev-225', 'st-03', '2026-10-25', ['languages'], 'assessment', 'Term 1 report: Thai B', 'Term 1 report published.', 'rpt-t1-th'),
  P('exams', 'ev-226', 'st-03', '2026-10-15', ['lena-japanese'], 'goal', 'JLPT N5: registration confirmed', 'Registered for the December JLPT sitting.', 'jlpt-reg'),
];

out('lines.json', lines); out('students.json', students); out('teachers.json', teachers); out('events.json', events);
out('reflections.json', reflections); out('endorsements.json', endorsements); out('presentations.json', presentations);
out('integrations.json', { integrations, pending });
for (const s of students.filter((s) => !s.cohortOnly)) {
  const es = events.filter((e) => e.studentId === s.id);
  console.log(s.name, es.length, 'stations,', es.filter((e) => e.lineIds.length > 1).length, 'interchanges,', es.filter((e) => e.type === 'goal').length, 'goals');
}
