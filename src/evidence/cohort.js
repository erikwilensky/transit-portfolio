// Kai, Noor, Ploy, Mateo and Sienna: every non-image piece of evidence on their maps.
const outline = (heading, sub, rows, note) => ({ t: 'doc', heading, sub, pages: 3, blocks: [['table', ['Term', 'Content', 'Assessment'], rows], note] });

export default {
  // ── Kai Tanaka ───────────────────────────────────────────────────────────────
  'ev-300': {
    'Reading log, Term 2': { t: 'sheet', file: 'Reading buddies · Kai T. · Year 4B', tab: 'Term 2',
      cols: ['Week', 'Buddy', 'Book / magazine', 'Pages', 'Read aloud?', 'Note'],
      rows: [[1, 'Nat & Ben', 'Shoot! football magazine', 6, 'Kai read', 'Bored by the book I brought'], [2, 'Nat & Ben', 'Shoot! (their choice)', 10, 'Ben read', 'Argued about Messi'], [3, 'Nat & Ben', 'Football comic: “Striker”', 14, 'Both', ''], [5, 'Nat & Ben', 'Football Academy ch. 1', 12, 'Both', 'First chapter book!'], [8, 'Nat & Ben', 'Football Academy ch. 4–5', 22, 'Nat alone', 'Asked to take it home'], [11, 'Nat & Ben', 'Football Academy ch. 6–8', 30, 'Both', 'Finished the book 🎉']],
      foot: ['11 weeks', '', '1 chapter book finished', 186, '', ''] },
  },
  'ev-302': {
    'Volunteer hours sheet': { t: 'sheet', file: 'Shelter volunteer hours · Kai Tanaka', tab: 'Hours',
      cols: ['Date', 'Arrive', 'Leave', 'Hours', 'Dogs walked', 'Signed (shelter)'],
      rows: [['15 Feb', '08:00', '11:00', 3, 'Lucky, Moo, Toffee', 'P. Wanna'], ['22 Feb', '08:00', '11:30', 3.5, 'Lucky, Som, Toffee', 'P. Wanna'], ['1 Mar', '08:00', '11:00', 3, 'Lucky (on lead first time!)', 'K. Daeng'], ['8 Mar', '08:00', '11:00', 3, 'Som, Oreo, Pepper', 'P. Wanna'], ['…', '', '', '', '', ''], ['10 May', '08:00', '12:00', 4, 'Farewell walk with Pepper', 'P. Wanna']],
      foot: ['12 Saturdays', '', '', 39.5, '11 dogs rehomed', ''] },
  },
  'ev-303': {
    'MYP criterion B: 6/8': { t: 'result', course: 'Year 11 Chemistry', task: 'Practical: concentration of NaOH by titration', rows: [['B: Inquiring and designing', 6, 8]], noTotal: true, grade: '6/8', gradeLabel: 'Criterion B',
      comment: 'A sensible, safe method with clear variables. You noticed the end-point problem yourself; write that reasoning into your method next time.', by: 'Ms Lim, Chemistry' },
    'Lab report (PDF)': { t: 'doc', heading: 'Finding the concentration of sodium hydroxide by titration', sub: 'Year 11 Chemistry · Kai Tanaka · October 2025', pages: 6, blocks: [
      ['h', 'Results'], ['table', ['Run', 'Initial (cm³)', 'Final (cm³)', 'Titre (cm³)', 'Concordant?'], [['Rough', '0.00', '24.60', '24.60', ''], ['1', '0.00', '23.85', '23.85', '✓'], ['2', '0.20', '24.10', '23.90', '✓'], ['3', '0.10', '23.95', '23.85', '✓']]],
      'Mean titre = 23.87 cm³. n(HCl) = 0.100 × 0.02387 = 2.387 × 10⁻³ mol. NaOH : HCl = 1 : 1, so [NaOH] = 2.387 × 10⁻³ / 0.0250 = 0.0955 mol dm⁻³.',
      ['h', 'Evaluation'], 'My rough titre overshot because I added the acid too quickly near the end point. In runs 1–3 I added the last 2 cm³ dropwise, swirling between drops, and the titres agreed within 0.05 cm³.' ] },
  },
  'ev-304': {
    'Field data sheet': { t: 'sheet', file: 'Bang Krachao kick samples · Group 3', tab: 'Counts', tabs: ['Counts', 'Biotic index'],
      cols: ['Taxon', 'Sensitivity', 'Site 1 (upstream)', 'Site 2 (market)', 'Site 3 (downstream)'],
      rows: [['Mayfly nymphs', 'High', 14, 1, 4], ['Caddisfly larvae', 'High', 9, 0, 2], ['Freshwater shrimp', 'Medium', 22, 6, 11], ['Water snails', 'Medium', 17, 12, 15], ['Bloodworms', 'Tolerant', 3, 41, 18], ['Rat-tailed maggots', 'Very tolerant', 0, 12, 3]],
      foot: ['Biotic index', '', 7.4, 2.9, 5.1], note: 'Site 2 is just downstream of the market drain. Recovery by site 3 suggests dilution and the reed bed help.' },
  },
  'ev-305': {
    'Criterion C: 7/8': { t: 'result', course: 'Year 11 Physics', task: 'Investigation: length and period of a simple pendulum', rows: [['C: Processing and evaluating', 7, 8]], noTotal: true, grade: '7/8', gradeLabel: 'Criterion C',
      comment: 'Very careful treatment of uncertainty. Linearising with T² was exactly right and your value of g is within 0.3% of the accepted value.', by: 'Physics department' },
    'Investigation report': { t: 'doc', heading: 'How does the length of a pendulum affect its period?', sub: 'Year 11 Physics · Kai Tanaka · March 2026', pages: 9, blocks: [
      ['h', 'Theory'], 'For small angles, T = 2π√(L/g), so a graph of T² against L should be a straight line through the origin with gradient 4π²/g.',
      ['table', ['L (m)', 'Mean 10T (s)', 'T (s)', 'T² (s²)', '±T² (s²)'], [['0.20', '8.98', '0.898', '0.806', '0.018'], ['0.40', '12.70', '1.270', '1.613', '0.026'], ['0.60', '15.54', '1.554', '2.415', '0.031'], ['0.80', '17.95', '1.795', '3.222', '0.036'], ['1.00', '20.08', '2.008', '4.032', '0.040']]],
      'Gradient = 4.035 s² m⁻¹, so g = 4π² / 4.035 = 9.78 m s⁻² (accepted 9.81).',
      ['h', 'Evaluation'], 'Timing ten oscillations reduced my reaction-time uncertainty, but it was still the largest source of error. An automatic light gate would remove it, which is what I built next.' ] },
  },
  'ev-306': {
    'Code on GitHub': { t: 'repo', repo: 'kaitanaka/light-gate', about: 'Arduino light gate for timing pendulums to the millisecond.', lang: [['Arduino', 78], ['Python', 22]], files: ['firmware/', 'firmware/light_gate.ino', 'case/', 'case/gate_bracket.stl', 'tools/plot_periods.py', 'README.md'], commitCount: 19,
      commits: [['Debounce: ignore beam breaks < 40 ms apart', 'Apr 6, 2026'], ['Report period of every full swing', 'Apr 3, 2026'], ['3D-printed bracket for the clamp stand', 'Mar 30, 2026'], ['IR LED + phototransistor on pin 2 interrupt', 'Mar 27, 2026']],
      readme: [['h', 'light-gate'], 'An infrared beam across the bottom of the swing. Every second beam break is one full period. Prints periods to serial, accurate to about 1 ms.', ['code', 'volatile unsigned long last = 0; volatile int breaks = 0;\nvoid onBreak() {\n  unsigned long now = millis();\n  if (now - last < 40) return;   // debounce\n  if (++breaks % 2 == 0) Serial.println(now - last2);\n  ...\n}'], ['h', 'Used in'], 'Year 10 pendulum practicals since April 2026 (two gates).'] },
  },
  'ev-307': {
    'Grade progression log': { t: 'sheet', file: 'Climbing log · Kai', tab: 'Sends',
      cols: ['Date', 'Wall', 'Problem', 'Grade', 'Attempts', 'Note'],
      rows: [['14 Jan', 'School', 'Yellow 3', 'V1', 2, ''], ['28 Jan', 'School', 'Green slab', 'V2', 6, 'Trust the feet'], ['17 Feb', 'Ekkamai gym', 'Blue 12', 'V2', 3, ''], ['3 Mar', 'School', 'Red overhang', 'V3', 14, 'Heel hook finally clicked'], ['24 Mar', 'Ekkamai gym', 'Purple 7', 'V3', 5, ''], ['10 Apr', 'School', 'Black crimps', 'V4', 21, 'First V4!!']] },
  },
  'ev-308': { 'Course outline': outline('IB Physics HL · course outline 2026–28', 'Physics department', [['Y12 T1', 'Space, time and motion', 'Topic test'], ['Y12 T2', 'The particulate nature of matter', 'Lab portfolio'], ['Y12 T3', 'Wave behaviour; fields', 'IA proposal'], ['Y13', 'Nuclear and quantum physics; IA', 'Internal assessment (20%)']], 'The internal assessment is an individual investigation. Kai has asked to build on his light-gate work.') },
  'ev-701': { 'Course outline': outline('MYP Computer Science · Year 11', 'Ms Priya Nair', [['T1', 'Python fundamentals, functions', 'Coding tasks'], ['T2', 'Data and files; physical computing', 'Project'], ['T3', 'Algorithms and testing', 'MYP criteria A–D']], 'Students build one physical-computing project each term.') },
  'ev-702': {
    'Code on GitHub': { t: 'repo', repo: 'kaitanaka/titration-arm', about: 'A three-joint robot arm that pours reagents for the Year 10 titration practical.', lang: [['Python', 88], ['Shell', 12]], files: ['arm/', 'arm/kinematics.py', 'arm/servos.py', 'routines/pour.py', 'calibrate.sh', 'README.md'], commitCount: 34,
      commits: [['Slow pour near the end point (0.5 ml steps)', 'May 10, 2026'], ['Inverse kinematics for 3 joints', 'May 2, 2026'], ['Calibrate servo angles with a protractor jig', 'Apr 26, 2026'], ['PCA9685 servo driver on the Pi', 'Apr 20, 2026']],
      readme: [['h', 'titration-arm'], 'Raspberry Pi + PCA9685 + three MG996R servos. The arm picks up the measuring cylinder, pours to a set volume and returns it.', ['code', 'from arm import Arm\narm = Arm.load_calibration("cal.json")\narm.move_to(x=180, y=40, z=90)\narm.pour(ml=25.0, slow_last=2.0)']] },
    'Build log': { t: 'doc', format: 'Google Doc', heading: 'Robot arm build log', sub: 'Kai Tanaka · April–May 2026', pages: 5, blocks: [
      ['table', ['Date', 'What I did', 'Problem', 'Fix'], [['20 Apr', 'Wired 3 servos to the Pi', 'Pi browned out', 'Separate 6 V supply'], ['26 Apr', 'Calibrated angles', 'Servos 4° off', 'Protractor jig + offsets'], ['2 May', 'Inverse kinematics', 'Elbow flipped upside down', 'Choose elbow-up solution'], ['8 May', 'First pour', 'Spilled 3 ml', 'Slow last 2 ml'], ['12 May', 'Demo to Year 10', '—', '—']]],
      ['note', 'Ms Nair', 'Independent work, well beyond the syllabus.'] ] },
  },
  'ev-703': {
    'Regional award certificate': { t: 'cert', org: 'VEX Robotics Bangkok Regional 2026 (demo)', kind: 'Third Place', pre: 'Awarded to Team 4521B', name: 'NIST Gearheads', line: 'Driver: Kai Tanaka · Programmer: Kai Tanaka · Builders: Ton S., Mia R.', award: '3rd place · Teamwork Challenge', sign: [['Event Partner', 'VEX Bangkok']], seal: '3', colour: '#E73C3E' },
    'Match video': { t: 'video', title: 'Semi-final, match 2: 4521B + 8800A', dur: '2:14', views: '389', desc: 'Our best match of the day: 142 points. Kai drives; the autonomous routine in the first 15 seconds scores 4 rings.', chapters: [['0:00', 'Autonomous (15 s)'], ['0:15', 'Driver control'], ['1:45', 'Endgame climb']] },
  },

  // ── Noor Haddad ──────────────────────────────────────────────────────────────
  'ev-309': {
    'Recital video': { t: 'video', title: 'Thai Language Day 2023: poetry recital final', dur: '6:48', views: '940', desc: 'Year 10 finalists recite classical Thai poetry. Noor Haddad performs an extract from Phra Aphai Mani by Sunthorn Phu (from 3:12).', chapters: [['0:00', 'Welcome from Kru Napat'], ['0:40', 'Finalist 1'], ['3:12', 'Noor Haddad: พระอภัยมณี'], ['5:30', 'Judges’ comments']] },
    'Poem with my annotations': { t: 'doc', format: 'Scanned page', letterhead: false, heading: 'พระอภัยมณี (extract)', sub: 'Sunthorn Phu · Noor’s copy with chanting marks', pages: 2, blocks: [
      ['quote', '“…แล้วสอนว่าอย่าไว้ใจมนุษย์ มันแสนสุดลึกล้ำเหลือกำหนด…”'],
      ['note', 'Noor (pencil)', 'Rise on แสน, hold สุด for two beats, breathe after กำหนด. Kru Napat: “tone first, then rhythm”.'],
      ['table', ['Line', 'Meaning (my translation)', 'Chanting note'], [['1', 'And he taught: do not trust people', 'Low, slow'], ['2', 'They are deeper than anyone can measure', 'Rise, hold'], ['3', 'Even a winding vine is not as crooked', 'Fast, lighter'], ['4', 'As the human heart', 'Fall, long final syllable']]] ] },
  },
  'ev-311': {
    'Artist statement': { t: 'doc', heading: 'Faces of Soi 31', sub: 'Artist statement · Noor Haddad · Year 11 Visual Arts · charcoal on paper, 6 portraits, 42 × 59 cm', pages: 1, blocks: [
      'These are the people I pass every morning on the way to the bus. I knew their voices before I knew their names. For each portrait I asked one question, “What do you want people to know about this street?”, and lettered the answer under the drawing in the language they gave it.',
      ['table', ['Portrait', 'Sitter', 'Their words'], [['1', 'Khun Malee, noodle seller', '“Forty years, same corner, same broth.”'], ['2', 'Phi Lek, motorbike taxi', '“I know every shortcut. Ask me.”'], ['3', 'Uncle Somchai, umbrella repair', '“Nothing is broken forever.”'], ['4', 'Khun Sompong, retired teacher', '“The street was a canal when I was young.”']]],
      'Charcoal is forgiving and unforgiving at once. You can wipe it away, but you can always see where it was. That seemed right for faces that hold a lot of history.' ] },
  },
  'ev-313': {
    'Print edition record': { t: 'sheet', file: 'Linocut edition record · “Canal Boat”', tab: 'Edition',
      cols: ['Print', 'Colour 1 (ochre)', 'Colour 2 (teal)', 'Colour 3 (black)', 'Status'],
      rows: [['1/12', '✓', '✓', '✓', 'Kept (artist)'], ['2/12', '✓', '✓', '✓', 'Given to grandmother'], ['3/12', '✓', '✓', 'smudged', 'Proof (A/P)'], ['4/12', '✓', '✓', '✓', 'Exhibition'], ['…', '', '', '', ''], ['12/12', '✓', '✓', '✓', 'Studio archive']],
      note: 'Reduction print: one block, carved away between colours, so the edition cannot be reprinted.' },
  },
  'ev-315': {
    'Session log': { t: 'sheet', file: 'Saturday homework club · Noor’s sessions', tab: 'Log',
      cols: ['Date', 'Children', 'Subjects', 'Language used', 'Note'],
      rows: [['12 Oct', 3, 'Maths: fractions', 'Arabic → English', 'Yusuf knows it already in Arabic!'], ['19 Oct', 4, 'English reading', 'English', 'Started the word list'], ['26 Oct', 5, 'Maths: decimals', 'Arabic, Thai, English', 'Word list v2'], ['2 Nov', 4, 'Science: plants', 'English', 'Yusuf explained to Rana'], ['…', '', '', '', ''], ['5 Apr', 6, 'Revision', 'All three', 'Last session; certificates']],
      foot: ['24 Saturdays', 'avg 4.6', '', '', ''] },
    'Trilingual maths word list': { t: 'doc', heading: 'Maths words · كلمات الرياضيات · คำศัพท์คณิตศาสตร์', sub: 'Made by Noor Haddad and Yusuf, for new volunteers and children', pages: 2, blocks: [
      ['table', ['English', 'العربية', 'ไทย'], [['fraction', 'كسر', 'เศษส่วน'], ['numerator', 'بسط', 'ตัวเศษ'], ['denominator', 'مقام', 'ตัวส่วน'], ['decimal', 'عدد عشري', 'ทศนิยม'], ['percent', 'نسبة مئوية', 'ร้อยละ'], ['multiply', 'ضرب', 'คูณ'], ['divide', 'قسمة', 'หาร'], ['equals', 'يساوي', 'เท่ากับ']]],
      ['note', 'Centre coordinator', 'Now given to every new volunteer.'] ] },
  },
  'ev-317': {
    'Exhibition label and statement': { t: 'doc', format: 'Exhibition label', letterhead: false, heading: 'Letters Home', sub: 'Noor Haddad, Year 12 · ink, graphite and photocopy transfer on layered tracing paper · 120 × 80 cm', pages: 1, blocks: [
      'My grandmother wrote to her sister in Arabic for fifty years. I found the letters after she died. I cannot read most of them; my Arabic is spoken, not written.',
      'I copied her letters onto the bottom layers and wrote my replies in Thai, the language I dream in, on the top layers. You can see both, but you cannot read either clearly. That is what home feels like to me.',
      ['quote', 'Year 12 Visual Arts group exhibition · September 2025'] ] },
    'Exhibition walkthrough video': { t: 'video', title: 'Year 12 exhibition walkthrough: Noor Haddad, “Letters Home”', dur: '3:05', views: '1,077', desc: 'Noor talks through how the piece was made: 11 layers, 4 weeks, and one very patient photocopier.', chapters: [['0:00', 'The letters'], ['1:10', 'Layering'], ['2:20', 'Why it is unreadable']], img: 'evidence/mural.svg' },
  },
  'ev-319': {
    'Workshop plan': { t: 'doc', heading: 'Print with What You Throw Away', sub: 'Community art workshops · Noor Haddad · CAS project plan', pages: 3, blocks: [
      ['table', ['Saturday', 'Theme', 'Material', 'Age'], [['1', 'Stamps from bottle caps', 'caps, foam', 'All ages'], ['2', 'Polystyrene tray prints', 'clean food trays, pencils', '6+'], ['3', 'Cardboard collagraphs', 'boxes, glue', '8+'], ['4', 'Two-colour prints', 'trays', '8+'], ['5', 'Group banner', 'all', 'All ages'], ['6', 'Open-day exhibition', '—', '—']]],
      ['h', 'Risks'], ['list', ['Craft knives: only Noor and adult helpers use them.', 'Water-based ink only.']] ] },
    'CAS project report': { t: 'doc', heading: 'CAS project report: community art workshops', sub: 'Noor Haddad · CAS coordinator: Ms Clara Brandt · August 2026', pages: 5, blocks: [
      ['stats', [['Workshops', '6'], ['Participants', '46'], ['Prints made', '210+'], ['Kg of packaging reused', '18']]],
      ['h', 'What changed'], 'After workshop 2 I realised the parents were watching, not printing. From workshop 3 every family worked at one table together, and adult participation went from 4 to 19.',
      ['h', 'Learning outcomes'], ['list', ['LO 2: new challenge (teaching mixed ages)', 'LO 3: initiated and planned a CAS experience', 'LO 5: collaborated with the centre staff', 'LO 6: engaged with an issue of global importance (waste)']],
      ['note', 'Ms Brandt', 'A complete CAS project: planned, run, adapted and evaluated.'] ] },
  },
  'ev-708': {
    'Workshop handout': { t: 'doc', heading: 'Arabic calligraphy: six Saturdays', sub: 'Community workshop series · handout · October 2026', pages: 2, blocks: [
      ['table', ['Week', 'Script', 'Practice'], [['1', 'Naskh: the alphabet', 'Letter shapes with a qalam'], ['2', 'Naskh: joining', 'Short words'], ['3', 'Thuluth: introduction', 'Single letters, large'], ['4', 'Diwani', 'Flowing lines'], ['5', 'Composition', 'A word in a circle'], ['6', 'Exhibition piece', 'Your own phrase']]],
      'Bring: bamboo qalam (provided), ink, smooth paper. Noor’s phrase for her final piece: بيتي حيث لغتي (“My home is where my language is”).' ] },
  },

  // ── Ploy Chaiyaporn ─────────────────────────────────────────────────────────
  'ev-320': {
    'MYP Music criterion C: 7/8': { t: 'result', course: 'MYP Year 10 Music', task: 'Songwriting: a song about a place', rows: [['C: Thinking creatively', 7, 8]], noTotal: true, grade: '7/8', gradeLabel: 'Criterion C',
      comment: 'Switching the chorus into Thai was a brave and musical choice; the tones shape the melody beautifully. Lovely harmony vocal.', by: 'Ms Sofia Marín, Music' },
    'Lyrics and chord chart': { t: 'doc', format: 'PDF', pages: 1, heading: 'Ferry at Six', sub: 'Words and music by Ploy Chaiyaporn · capo 2 · 84 bpm', blocks: [
      ['code', 'Verse 1\nG              D\nOrange water, engines hum\nEm             C\nGrandma counts the piers to come\nG              D\nTha Tien, Tha Chang, the temple light\nEm       C        D\nEvery evening, same as tonight\n\nChorus (Thai)\nC          G\nเรือหกโมง พาเรากลับบ้าน\nEm         D\nแม่น้ำยังไหล ไม่เคยเปลี่ยน\n\n(The six o’clock boat takes us home / the river still flows, never changes)'],
      ['note', 'Ms Marín', 'The Thai line rises where the English fell. Keep that contrast in the bridge.'] ] },
    'Recording': { t: 'audio', title: 'Ferry at Six', artist: 'Ploy Chaiyaporn', year: 2025, tracks: [['Ferry at Six', '3:24']], desc: 'Recorded in the music department studio. Voice, acoustic guitar, second harmony vocal; ferry horn recorded at Tha Tien pier.', colour: '#D6457F' },
  },
  'ev-322': {
    'Season stats': { t: 'sheet', file: 'U16 girls · 2025–26 league · player stats', tab: 'Ploy',
      cols: ['Match', 'Opponent', 'Result', 'Minutes', 'Position', 'Tackles', 'Interceptions'],
      rows: [[1, 'Riverside', 'W 2–0', 15, 'Sub', 1, 0], [2, 'Garden Intl', 'L 0–1', 0, '—', '', ''], [3, 'Bangkok Prep', 'D 1–1', 30, 'Sub (LB)', 2, 1], [5, 'League leaders', 'L 1–2', 70, 'LB', 4, 3], [6, 'Harbour Intl', 'W 3–1', 70, 'LB', 3, 2], [9, 'Riverside', 'W 1–0', 70, 'LB', 5, 4], [10, 'Garden Intl', 'W 2–1', 70, 'LB', 4, 2]],
      foot: ['10 matches', '3rd in league', '', 535, '', 24, 15] },
  },
  'ev-306a': {
    'Match report': { t: 'doc', heading: 'U16 girls: league semi-final report', sub: 'NIST 1–1 Riverside (NIST win 4–3 on penalties) · 23 October 2026', pages: 1, blocks: [
      'A tense semi-final. Riverside scored early from a corner, but NIST stayed organised. Ploy Chaiyaporn at left back kept their fastest winger quiet all afternoon and started the move for Mai’s equaliser with a long ball down the line.',
      ['stats', [['Possession', '48%'], ['Shots', '9 – 7'], ['Ploy: tackles', '6'], ['Ploy: penalty', 'Scored (4th)']]],
      ['quote', '“Ploy read the game brilliantly. She called the switch before it happened.” — Coach'] ] },
    'Match highlights': { t: 'video', title: 'U16 girls semi-final highlights', dur: '2:40', views: '734', desc: 'Goals, saves and the penalty shoot-out from the league semi-final.', chapters: [['0:00', 'Riverside goal'], ['0:50', 'Mai equalises'], ['1:30', 'Penalties']], img: 'evidence/football.svg' },
  },
  'ev-324': {
    'Concert poster': { t: 'web', url: 'nist.example/events/choir-feb26', site: 'Voices of the River · Senior Choir in Concert', blocks: [
      ['fig', 'Poster by Ploy Chaiyaporn (Year 10): a choir silhouette reflected in the river, in the school’s purple and gold.', 'evidence/ev-324.svg'],
      ['stats', [['Date', '12 Feb 2026'], ['Time', '18:30'], ['Venue', 'Auditorium'], ['Tickets', 'Free']]],
      'Programme: Loi Krathong (arr. for SATB), Bridge Over Troubled Water, Siyahamba, and a new piece by the Year 12 composers.' ] },
    'Concert recording': { t: 'audio', title: 'Voices of the River (live)', artist: 'NIST Senior Choir', year: 2026, tracks: [['Loi Krathong (SATB)', '3:48'], ['Siyahamba', '2:55'], ['Bridge Over Troubled Water', '4:41']], desc: 'Live recording, 12 February 2026. Ploy sings alto.', colour: '#6B3FB0' },
  },
  'ev-326': {
    'MYP Design criterion B: 7/8': { t: 'result', course: 'MYP Year 10 Design', task: 'Digital design: an app for a real client', rows: [['B: Developing ideas', 7, 8]], noTotal: true, grade: '7/8', gradeLabel: 'Criterion B',
      comment: 'Your user-testing rounds drove real changes to the calendar view. Clear design specification linked to the client interview.', by: 'Mr Tom Hale, Design' },
    'Figma prototype': { t: 'web', url: 'figma.example/proto/practice-rooms', site: 'Practice Rooms · prototype v3', blocks: [
      ['code', '┌─────────────────────────────┐\n│  Practice Rooms        ☰    │\n│  Today, Fri 1 May           │\n├─────────────────────────────┤\n│ Room 1  Piano   ■■□□■■■□    │\n│ Room 2  Piano   □■■■□□■■    │\n│ Room 3  Drums   ■□□□□■■■    │\n│ Room 4  Band    □□■■■■□□    │\n├─────────────────────────────┤\n│   [ Book 12:10–12:50 ]      │\n└─────────────────────────────┘'],
      ['h', 'What changed in v3'], ['list', ['Rooms in rows, time in columns (testers found the old list view slow)', 'One tap to book the next free slot', 'Your bookings shown in your own colour']] ] },
    'Client interview notes': { t: 'doc', format: 'Google Doc', heading: 'Client interview: Ms Marín (Music)', sub: '14 April 2026 · 20 minutes · music office', pages: 2, blocks: [
      ['h', 'Current system'], 'A paper sheet on each practice-room door. Students cross out slots. Problems: sheets go missing, people book every lunch, nobody knows if a room is free without walking there.',
      ['h', 'What she wants'], ['list', ['See all four rooms at once', 'Limit: two bookings per student per week', 'Teachers can block rooms for lessons']],
      ['quote', '“If it takes more than three taps, they will just go back to the paper.”'] ] },
  },
  'ev-328': {
    'Design folio (in progress)': { t: 'doc', heading: 'Bamboo pendant lamp: design folio', sub: 'MYP Year 11 Design · Ploy Chaiyaporn · in progress (pages 1–14 of about 30)', pages: 14, blocks: [
      ['h', 'Inspiration'], 'My grandfather in Ayutthaya still weaves bamboo fish traps (ไซ). The open weave throws beautiful shadows when the sun is behind it.',
      ['h', 'Weave tests'], ['table', ['Test', 'Weave', 'Strip width', 'Light pattern', 'Strength'], [['1', 'Plain (over-under)', '8 mm', 'Grid, harsh', 'Strong'], ['2', 'Hexagonal (ตาหกเหลี่ยม)', '6 mm', 'Soft stars', 'Medium'], ['3', 'Twill', '5 mm', 'Diagonal ripples ✓', 'Strong']]],
      ['note', 'Mr Hale', 'Test 3 is lovely. Check the heat from the bulb: LED only, and test at 30 minutes.'] ] },
  },

  // ── Mateo Ruiz ──────────────────────────────────────────────────────────────
  'ev-329': {
    'MYP criterion B: 7/8': { t: 'result', course: 'MYP Year 10 Computing', task: 'Algorithms unit: sorting visualiser', rows: [['B: Developing ideas', 7, 8]], noTotal: true, grade: '7/8', gradeLabel: 'Criterion B',
      comment: 'Excellent. Timing the three sorts on growing lists and plotting the results went well beyond the brief.', by: 'Ms Priya Nair, Computer Science' },
    'Code on GitHub': { t: 'repo', repo: 'mateoruiz/sort-vis', about: 'Watch bubble, insertion and merge sort race, in Python turtle.', lang: [['Python', 100]], files: ['sort_vis.py', 'sorts.py', 'benchmark.py', 'results.csv', 'README.md'],
      commits: [['Benchmark up to n = 10,000', 'Sep 16, 2023'], ['Merge sort animation (recursive colours)', 'Sep 12, 2023'], ['Insertion sort', 'Sep 8, 2023'], ['Bubble sort with turtle bars', 'Sep 5, 2023']],
      readme: [['h', 'sort-vis'], ['table', ['n', 'Bubble (s)', 'Insertion (s)', 'Merge (s)'], [['100', '0.002', '0.001', '0.0004'], ['1,000', '0.21', '0.09', '0.004'], ['10,000', '22.4', '9.8', '0.05']]], 'Merge sort is 450× faster than bubble sort at n = 10,000. Same computer, better idea.'] },
  },
  'ev-331': {
    'Science fair poster (PDF)': { t: 'doc', heading: 'Does music tempo change how fast you run?', sub: 'Science fair 2025 · Mateo Ruiz · Bronze award', pages: 1, blocks: [
      ['h', 'Method'], '12 teammates ran 800 m three times on separate days, listening to the same playlist at 120, 150 or 180 bpm (order randomised). A GPS watch recorded pace and cadence.',
      ['table', ['Tempo (bpm)', 'Mean cadence (steps/min)', 'Mean pace (min/km)'], [['120', '158', '4:52'], ['150', '167', '4:47'], ['180', '176', '4:45']]],
      ['h', 'Conclusion'], 'Cadence followed the music closely (r = 0.81), but pace changed by only 7 seconds per km, which is within day-to-day variation. Runners take shorter, quicker steps, not faster ones.' ] },
    'Run data': { t: 'sheet', file: 'Tempo runs · raw data', tab: 'Runs',
      cols: ['Runner', 'Tempo', 'Time (800 m)', 'Cadence', 'Temp (°C)'],
      rows: [['R01', 120, '3:54', 156, 29], ['R01', 150, '3:51', 166, 30], ['R01', 180, '3:50', 175, 28], ['R02', 120, '3:41', 161, 29], ['R02', 150, '3:42', 169, 31], ['R02', 180, '3:38', 179, 29], ['…', '', '', '', '']],
      foot: ['36 runs', '', '', '', ''] },
  },
  'ev-332': {
    'Notebook on GitHub': { t: 'repo', repo: 'mateoruiz/passing-networks', about: 'Passing networks for our U18 team from hand-logged match video.', lang: [['Jupyter Notebook', 90], ['Python', 10]], files: ['data/match1.csv', 'data/match2.csv', '…', 'passing.ipynb', 'draw.py', 'README.md'], commitCount: 28,
      commits: [['Betweenness centrality per player', 'Aug 24, 2025'], ['Draw networks on a pitch background', 'Aug 20, 2025'], ['Load 5 matches, 1,412 passes', 'Aug 15, 2025']],
      readme: [['h', 'passing-networks'], 'I logged every pass in five matches from video: passer, receiver, minute and pitch zone.', ['code', 'G = nx.DiGraph()\nfor p in passes.itertuples():\n    G.add_edge(p.passer, p.receiver, weight=G.get_edge_data(p.passer, p.receiver, {"weight": 0})["weight"] + 1)\ncentrality = nx.betweenness_centrality(G, weight="weight")'], ['h', 'Finding'], 'Our number 8 had a betweenness of 0.41, more than double anyone else. When he was marked, we stopped completing passes into the final third.'] },
    'Write-up for the coach': { t: 'doc', heading: 'How we pass: five matches in numbers', sub: 'For Coach Ramos · Mateo Ruiz · August 2025', pages: 3, blocks: [
      ['bars', 'Passes received per match (mean)', [['#8 Diego', 61], ['#6 Arthit', 38], ['#4 Sam', 34], ['#10 Mateo', 29], ['#2 Ken', 22], ['#7 Joon', 18]], ''],
      ['h', 'Suggestion'], 'Move to a 4-2-3-1 with two holding midfielders, so that the team has a second route forward when Diego is marked.',
      ['note', 'Coach Ramos', 'We tried it in the next match and won 3–1. Keep logging!'] ] },
  },
  'ev-333': {
    'IB Biology SL: 6': { t: 'result', course: 'IB Biology SL', task: 'Lab report: osmosis in potato tissue', colA: 'Criterion', rows: [['Research design', 5, 6], ['Data analysis', 5, 6], ['Conclusion', 4, 6], ['Evaluation', 5, 6]], grade: 6, scale: 'IB 1–7',
      comment: 'Good graph and a sensible interpolation for the isotonic point. Your conclusion should discuss why the curve flattens at high concentration.', by: 'Mr David Okafor, Biology' },
    'Lab report': { t: 'doc', heading: 'Estimating the water potential of potato tissue', sub: 'IB Biology SL · Mateo Ruiz · October 2025', pages: 7, blocks: [
      ['table', ['Sucrose (mol dm⁻³)', 'Mean % mass change', 'SD'], [['0.0', '+21.4', '1.9'], ['0.1', '+11.8', '1.4'], ['0.2', '+3.9', '1.1'], ['0.3', '−4.2', '1.3'], ['0.4', '−11.0', '1.6'], ['0.6', '−18.7', '2.2']]],
      'Interpolating, the isotonic point is about 0.25 mol dm⁻³, so the water potential of the potato tissue is approximately −0.68 MPa.' ] },
  },
  'ev-335': {
    'Placement certificate': { t: 'cert', org: 'University Parallel Computing Laboratory (demo)', kind: 'Certificate of Placement', line: 'completed a two-week summer research placement (60 hours), benchmarking GPU sorting algorithms under the supervision of the laboratory.', sign: [['Dr Somsak T.', 'Laboratory head']], seal: 'GPU', colour: '#0072CE' },
    'Placement report': { t: 'doc', heading: 'Sorting ten million keys: CPU versus GPU', sub: 'Summer placement report · Mateo Ruiz · July 2026', pages: 8, blocks: [
      ['bars', 'Time to sort 10 million 32-bit keys (ms)', [['CPU std::sort', 812], ['GPU bitonic', 356], ['GPU radix', 149]], ' ms'],
      'The GPU radix sort was 5.4× faster than the single-threaded CPU baseline, but only after the data was already on the GPU. Copying the keys there and back took 96 ms, which wiped out most of the advantage for lists under a million keys.',
      ['h', 'Next'], 'This crossover point is what my Extended Essay will investigate: at what list size does a GPU sort become worth it, including transfer time?' ] },
  },
  'ev-336': {
    'Live app': { t: 'web', url: 'library.nist.example', site: 'NIST Library · reserve a book', blocks: [
      ['stats', [['Reservations since August', '640'], ['Ready to collect', '23'], ['Average wait', '2.1 days']]],
      ['table', ['Title', 'Status', 'Action'], [['The Hate U Give', 'On loan, due 30 Oct', 'Reserve'], ['Sapiens (graphic)', 'Ready at the desk', 'Collect by 1 Nov'], ['Sunthorn Phu: selected poems', 'Available', 'Borrow']]],
      'You get a LINE message as soon as your book is ready. Renew from your phone up to twice.' ] },
    'Source code': { t: 'repo', repo: 'mateoruiz/library-app', private: true, about: 'Book reservations and renewals for the NIST library (IB CS IA).', lang: [['TypeScript', 61], ['HTML', 14], ['CSS', 11], ['Python', 14]], files: ['web/', 'api/', 'api/reservations.py', 'api/line_notify.py', 'db/schema.sql', 'docs/criterion-A.md', 'README.md'], commitCount: 212,
      commits: [['Renewal limit of 2 (librarian request)', 'Sep 3, 2026'], ['LINE notification when a book is ready', 'Aug 18, 2026'], ['Import catalogue from Destiny CSV', 'Jul 30, 2026'], ['Reservation queue per title', 'Jul 22, 2026']],
      readme: [['h', 'library-app'], 'Client: Ms Ratana, school librarian. Built for the IB Computer Science internal assessment.', ['list', ['React front end, FastAPI back end, PostgreSQL', 'Sign in with school Google accounts', 'LINE Notify for “ready to collect” messages']]] },
    'Librarian feedback': { t: 'doc', format: 'Letter', heading: 'Feedback on the library reservation app', sub: 'From Ms Ratana, Librarian · to Ms Nair · 10 October 2026', pages: 1, blocks: [
      'I am writing to say how much the library reservation app has changed our work. Before August, reservations were on a paper list and students often missed their books. Since the app launched we have handled 640 reservations and uncollected holds have fallen from about a third to under 5%.',
      'Mateo listened carefully to what we needed, came back three times to test with us, and changed the renewal rules when I asked. He has also written a short guide so that we can keep it running after he graduates.',
      ['sign', 'Ratana Boonmee', 'Librarian'] ] },
  },
  'ev-337': {
    'Problem set 4: 20/20': { t: 'result', course: 'IB Computer Science HL', task: 'Problem set 4: graph algorithms (timed)', colA: 'Question', rows: [['1. BFS shortest path', 4, 4], ['2. Dijkstra implementation', 8, 8], ['3. Complexity analysis', 4, 4], ['4. DP: minimum coin change', 4, 4]], grade: '20/20', gradeLabel: 'Score', comment: 'Flawless, and your complexity explanations were the clearest in the class.', by: 'Ms Priya Nair, Computer Science' },
  },
  'ev-709': { 'Course outline': outline('IB Computer Science HL · course outline 2025–27', 'Ms Priya Nair', [['Y12 T1', 'Computer fundamentals, networks', 'Unit tests'], ['Y12 T2–3', 'OOP, algorithms, databases', 'Problem sets'], ['Y13 T1', 'Machine learning (HL); IA', 'Internal assessment (20%)'], ['Y13 T2', 'Case study, revision', 'Mock exams']], 'Internal assessment: a computational solution for a real client.') },

  // ── Sienna Okoye ────────────────────────────────────────────────────────────
  'ev-338': {
    'Sketchbook scans': { t: 'slides', label: 'Sketchbook · 32 pages', slides: [['Underwater sketchbook', 'Sienna Okoye · Year 10 · ink and wash'], ['Clownfish · ปลาการ์ตูน · Amphiprion ocellaris', 'Aquarium, 3 Feb. They never stay still.'], ['Moorish idol · ปลาผีเสื้อเทวรูป · Zanclus cornutus', 'From memory after snorkelling'], ['Blue-ringed angelfish · Pomacanthus annularis', 'Page 12. My favourite.'], ['Brain coral · Platygyra', 'Sketched before and after bleaching'], ['Whale shark (dream page)', 'Have not seen one. Yet.']] },
  },
  'ev-340': {
    'Budget and donations': { t: 'sheet', file: 'Run for the Reef · budget', tab: 'Budget', tabs: ['Budget', 'Donations', 'Runners'],
      cols: ['Item', 'Type', 'Amount (฿)', 'Note'],
      rows: [['Entry fees (212 × ฿300)', 'Income', 63600, ''], ['Sponsorship: dive school', 'Income', 15000, ''], ['Bake sale', 'Income', 11200, ''], ['Water and ice', 'Cost', -1800, 'Canteen at cost'], ['Medals (recycled card)', 'Cost', -1100, 'Art club made them'], ['First-aid cover', 'Cost', 0, 'School nurse volunteered'], ['Park permit', 'Cost', -500, '']],
      foot: ['Net raised', '', 86400, 'Transferred 20 May 2025'] },
    'Risk assessment': { t: 'doc', heading: 'Risk assessment: Run for the Reef 5 km', sub: 'Event lead: Sienna Okoye · approved by the PE department and the school nurse', pages: 3, blocks: [
      ['table', ['Hazard', 'Who', 'Likelihood', 'Control', 'Residual'], [['Heat exhaustion', 'Runners', 'Medium', 'Start 07:00; water every 1.25 km; nurse at finish', 'Low'], ['Road crossing in park', 'Runners', 'Low', 'Two marshals with flags, park security', 'Low'], ['Lost child', 'Families', 'Low', 'Wristbands with a phone number', 'Low'], ['Trips on uneven path', 'Runners', 'Medium', 'Course walked the day before; cones on roots', 'Low']]],
      ['note', 'Nurse Pim', 'Approved. Please add a cool-down tent at the finish.'] ] },
  },
  'ev-342': {
    'Campaign plan': { t: 'slides', label: 'Plan · 6 slides', slides: [['Plastic-free week', 'Eco-committee · 8–12 December 2025'], ['Why', ['The canteen throws away 38 kg of single-use plastic a week', 'Most of it is cups and takeaway boxes']], ['What we will do', ['Reusable cups, ฿20 deposit', 'Bring your own box: ฿5 off', 'No plastic straws or bags']], ['Who', ['Canteen staff: designed the cup return station', 'Year 7: posters', 'Eco-committee: audit before and after']], ['How we measure', 'Weigh the canteen plastic bins every day, the week before and the week of'], ['Then what?', 'Keep whatever works. Ask the canteen staff.']] },
    'Waste audit before and after': { t: 'sheet', file: 'Plastic-free week · waste audit', tab: 'Daily kg',
      cols: ['Day', 'Week before (kg)', 'Plastic-free week (kg)', 'Change'],
      rows: [['Mon', 7.9, 2.6, '−67%'], ['Tue', 7.4, 2.1, '−72%'], ['Wed', 7.8, 2.0, '−74%'], ['Thu', 8.6, 2.4, '−72%'], ['Fri', 6.3, 1.9, '−70%']],
      foot: ['Total', 38.0, 11.0, '−71%'], note: 'Two weeks later: 29 kg. The cup scheme stayed; takeaway boxes came back.' },
  },
  'ev-344': {
    'Debris log': { t: 'sheet', file: 'Koh Tao clean-up dives · debris log', tab: 'Dives',
      cols: ['Dive', 'Site', 'Depth (m)', 'Fishing line (kg)', 'Plastic (kg)', 'Other', 'Total (kg)'],
      rows: [[1, 'Twins', 12, 6.1, 2.4, 'flip-flop, can', 9.0], [2, 'Japanese Gardens', 9, 9.8, 3.1, 'tyre', 21.4], [3, 'Shark Island', 16, 11.2, 1.9, 'net float', 14.6], [4, 'Aow Leuk', 8, 4.3, 6.8, 'chair (!)', 19.0]],
      foot: ['4 dives', '', '', 31.4, 14.2, '', 64.0], note: 'Every item logged for the dive school’s ocean-debris database.' },
  },
  'ev-346': {
    'Garden plan': { t: 'doc', heading: 'Campus garden: plan', sub: 'CAS project · Sienna Okoye · strip behind the science block, 24 × 4 m', pages: 3, blocks: [
      ['table', ['Beds', 'Crop', 'For', 'Water'], [['1–4', 'Thai basil, coriander, mint', 'Canteen', 'Daily'], ['5–7', 'Lemongrass, galangal', 'Canteen', '2× week'], ['8–10', 'Morning glory (ผักบุ้ง)', 'Canteen stir-fry', 'Daily'], ['11–12', 'Marigolds', 'Pollinators', '2× week'], ['13–14', 'Compost', 'Everything', '—']]],
      ['h', 'Materials'], 'Pallets from the delivery bay (free), soil from the facilities team, seeds donated by the canteen.' ] },
    'Volunteer rota': { t: 'sheet', file: 'Garden volunteer rota · Term 1', tab: 'Rota',
      cols: ['Week', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      rows: [[1, 'Sienna', 'Noor', 'Ken', 'Sienna', 'Mai'], [2, 'Ploy', 'Sienna', 'Joon', 'Ken', 'Sienna'], [3, 'Mai', 'Ploy', 'Sienna', 'Noor', 'Joon'], [4, 'Sienna', 'Ken', 'Mai', 'Ploy', 'Noor']], note: 'Watering 07:30. Harvest goes to the canteen kitchen by 09:00 on Fridays.' },
  },
  'ev-348': {
    'Water test results': { t: 'sheet', file: 'Marine club · Chao Phraya water tests', tab: 'Oct 2026', tabs: ['Oct 2026', 'Sep 2026', 'Method'],
      cols: ['Site', 'pH', 'Nitrate (mg/L)', 'Phosphate (mg/L)', 'Turbidity (NTU)', 'Temp (°C)'],
      rows: [['A · Pak Kret', 7.2, 2.1, 0.18, 38, 29.8], ['B · Rama VIII bridge', 7.0, 4.6, 0.42, 61, 30.4], ['C · Samut Prakan', 7.4, 3.8, 0.35, 52, 30.1]],
      note: 'Site B is below a canal outfall. Nitrate up from 3.2 in September, after heavy rain.' },
  },
  'ev-704': { 'Course outline': outline('MYP Computer Science · Year 11', 'Ms Priya Nair', [['T1', 'Python fundamentals, functions', 'Coding tasks'], ['T2', 'Data and files; physical computing', 'Project'], ['T3', 'Algorithms and testing', 'MYP criteria A–D']], 'Students build one physical-computing project each term.') },
  'ev-705': {
    'Logger dashboard': { t: 'web', url: 'example.org/reeflog', site: 'Koh Tao reef temperature · 3 loggers', blocks: [
      ['stats', [['Readings', '13,392'], ['Max (9 Mar)', '30.8 °C'], ['Mean daily range', '0.52 °C'], ['Battery', '71%']]],
      ['bars', 'Mean temperature by hour (°C)', [['04:00', 28.9], ['08:00', 29.0], ['12:00', 29.3], ['16:00', 29.5], ['20:00', 29.2]], ' °C'],
      'Loggers at 5 m, 10 m and 15 m on Twins reef. Readings every 10 minutes since 6 February 2026.' ] },
    'Build notes': { t: 'doc', format: 'Google Doc', heading: 'Reef logger: build notes', sub: 'Sienna Okoye · February 2026', pages: 4, blocks: [
      ['list', ['DS18B20 waterproof probe + Arduino Pro Mini (3.3 V) + SD card', 'Sleeps between readings: 7 weeks on 2 × AA', 'Housing: PVC pipe with two O-ring end caps, tested to 20 m in the dive school’s pressure pot']],
      ['note', 'Lesson learned', 'The first housing leaked at 12 m. Silicone grease on the O-rings fixed it.'] ] },
  },
  'ev-706': {
    'Live calculator': { t: 'web', url: 'example.org/carbon', site: 'What does lunch cost the planet?', blocks: [
      ['table', ['Today’s menu', 'kg CO₂e per portion', ''], [['Chicken green curry + rice', '1.4', '●●○'], ['Pork basil (ka-prao) + egg', '1.9', '●●●'], ['Vegetable pad thai', '0.6', '●○○'], ['Beef noodle soup', '4.8', '●●●●●']]],
      'Estimates use published emission factors per ingredient and the canteen’s recipes. Built with HTML and JavaScript by Sienna Okoye.' ] },
  },
  'ev-707': {
    'Spawning survey data': { t: 'sheet', file: 'Coral spawning survey · September 2026', tab: 'Night dives',
      cols: ['Night', 'Site', 'Colonies checked', 'Spawning', 'Genus (most)', 'Water (°C)'],
      rows: [['18 Sep', 'Twins', 64, 11, 'Acropora', 29.1], ['19 Sep', 'Twins', 71, 23, 'Acropora', 29.0], ['20 Sep', 'Japanese Gardens', 58, 17, 'Montipora', 29.2], ['21 Sep', 'Japanese Gardens', 60, 6, 'Platygyra', 29.3]],
      foot: ['4 nights', '', 253, 57, '', ''] },
  },
};
