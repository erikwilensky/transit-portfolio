// Maya Chen (Year 13): every non-image piece of evidence on her map.
export default {
  'ev-001': {
    'Training schedule, Term 1': { t: 'sheet', file: 'Varsity swim · Term 1 schedule', tab: 'Week plan', tabs: ['Week plan', 'Meets', 'Squad list'],
      cols: ['Day', 'Time', 'Session', 'Main set', 'Volume'],
      rows: [['Mon', '06:00–07:30', 'Aerobic', '10 × 200 free on 3:00', '4.2 km'], ['Tue', '06:00–07:30', 'IM technique', '8 × 100 IM, drill/swim', '3.6 km'], ['Wed', '06:00–07:15', 'Kick + pull', '6 × 300 pull with paddles', '3.8 km'], ['Thu', '06:00–07:30', 'Race pace', '12 × 50 @ 200 pace on 1:00', '3.4 km'], ['Fri', '06:00–07:00', 'Recovery', '2,000 easy choice', '2.5 km'], ['Sat', '08:00–12:00', 'Meet or time trial', 'See Meets tab', '—']],
      foot: ['Week', '', '', '', '17.5 km'], note: 'Coach Dan · Maya is in lane 4 (IM group).' },
  },
  'ev-002': {
    'MYP Design cycle: 6/8': { t: 'result', course: 'MYP Year 10 Computing', task: 'Unit 1: text adventure in Python', colA: 'MYP Design criterion',
      rows: [['A: Inquiring and analysing', 6, 8], ['B: Developing ideas', 6, 8], ['C: Creating the solution', 7, 8], ['D: Evaluating', 5, 8]], grade: 6, scale: 'MYP 1–7',
      comment: 'A playable, well-structured adventure with six rooms and a working inventory. Your flowchart planning paid off. To reach the top band in D, test with real users and say what you would change.', by: 'Ms Priya Nair, Computer Science' },
    'Play the adventure': { t: 'web', url: 'example.org/adventure', site: 'The Lost Lab Key', blocks: [
      ['code', '> look\nYou are in the Science corridor. Doors lead NORTH (Lab 3) and EAST (Library).\nA poster says: "Goggles on!"\n\n> go north\nLab 3 is dark. Something glints under the fume cupboard.\n\n> take key\nYou picked up: lab key (1/3)\n\n> inventory\nYou carry: timetable, lab key\n\n> _'],
      'A text adventure set in our school. Find three keys to unlock the prep room before the bell. Commands: look, go <direction>, take <item>, use <item>, inventory, help.',
      ['note', 'Made with', 'Python 3 · 214 lines · runs in the browser with Trinket'] ] },
  },
  'ev-003': {
    'Club charter': { t: 'doc', heading: 'Beach Guardians: club charter', sub: 'Adopted September 2023 · revised by the committee each August', pages: 2, blocks: [
      ['h', '1. Purpose'], 'Beach Guardians keeps Mae Ramphueng beach in Rayong clean, and measures what we remove so that our work can change what arrives there.',
      ['h', '2. Activities'], ['list', ['A cleanup on the first Saturday of every month, 07:30–11:00.', 'A litter survey at every cleanup, using the club tally sheet.', 'One awareness event per term in school.']],
      ['h', '3. Roles'], ['table', ['Role', 'Holder 2023–24', 'Responsibilities'], [['President', 'Ava S. (Y12)', 'Chairs meetings, liaises with the school'], ['Logistics', 'Pond K. (Y11)', 'Bus booking, gloves, sacks, first aid'], ['Data lead', 'vacant', 'Tally sheets, survey results, newsletter chart'], ['Volunteer', 'Maya Chen (Y10)', '']]],
      ['h', '4. Safety'], 'No volunteer handles sharps, syringes or glass. These are marked with a flag and reported to the beach office.', ['sign', 'Ava S.', 'President'] ] },
  },
  'ev-004': {
    'MYP criterion B: 7/8': { t: 'result', course: 'MYP Year 10 Sciences (Biology)', task: 'Lab report: plant and animal cells under the microscope',
      rows: [['B: Inquiring and designing', 7, 8]], noTotal: true, grade: '7/8', gradeLabel: 'Criterion B',
      comment: 'Excellent slide preparation and a clear, testable aim. Labelled diagrams at ×400 are accurate and well scaled. Consider why your cheek cells appear smaller than the textbook values.', by: 'Mr David Okafor, Biology' },
    'Lab report (PDF)': { t: 'doc', heading: 'Comparing plant and animal cells', sub: 'MYP Sciences · Year 10 · Maya Chen', pages: 5, blocks: [
      ['h', 'Aim'], 'To prepare and observe onion epidermis and human cheek cells under a light microscope, and to compare their structures.',
      ['h', 'Method (summary)'], ['ol', ['Peel a single layer of onion epidermis and mount it in a drop of iodine solution.', 'Gently scrape the inside of the cheek with a sterile cotton bud, smear on a slide and stain with methylene blue.', 'Lower the coverslip at 45° to avoid air bubbles.', 'Observe at ×100, then ×400, and draw three representative cells of each.']],
      ['h', 'Results'], ['table', ['Feature', 'Onion epidermis', 'Cheek cell'], [['Shape', 'Rectangular, regular', 'Irregular, flattened'], ['Cell wall', 'Visible', 'Absent'], ['Nucleus', 'Visible, near edge', 'Visible, central'], ['Mean length (µm)', '210', '58'], ['Vacuole', 'Large, central', 'Not seen']]],
      ['fig', 'Figure 1. Onion epidermis cells at ×400, stained with iodine.'],
      ['note', 'Mr Okafor', 'Good. How did you calibrate the eyepiece graticule? Say so in the method.'] ] },
  },
  'ev-005': {
    'Audit spreadsheet': { t: 'sheet', file: 'Canteen food waste audit', tab: 'Daily weights', tabs: ['Daily weights', 'Weekly totals', 'Chart'],
      cols: ['Week', 'Mon (kg)', 'Tue (kg)', 'Wed (kg)', 'Thu (kg)', 'Fri (kg)', 'Total (kg)'],
      rows: [[1, 7.4, 8.1, 6.9, 8.8, 6.2, 37.4], [2, 7.9, 7.6, 7.2, 9.1, 5.8, 37.6], [3, 8.3, 8.0, 7.5, 8.4, 6.6, 38.8], [4, 7.1, 8.5, 7.9, 8.7, 6.4, 38.6], [5, 7.6, 7.8, 7.0, 9.4, 6.1, 37.9], [6, 8.0, 7.7, 7.3, 8.9, 6.3, 38.2]],
      foot: ['Mean', 7.7, 8.0, 7.3, 8.9, 6.2, 38.1], note: 'Weighed with the kitchen scales at 13:15 each day. Thursday is curry day, which explains the peak.' },
    'Proposal slides': { t: 'slides', slides: [['A compost bin for the canteen', 'Maya Chen, Pim T. & Joss W. · January 2024'], ['What we measured', ['Food waste weighed every lunch for 6 weeks', '30 school days, 1,140 kg in total']], ['What we found', ['38 kg a week on average', 'Rice and curry are the biggest share', 'Thursday is the worst day']], ['Where it goes now', ['General waste skip → landfill', 'Collected twice a week']], ['Our proposal', ['One 400 L hot composter behind the kitchen', 'Eco-club rota to turn it weekly', 'Compost goes to the primary garden']], ['Cost', ['฿14,500 for the bin', 'Pays back in about 2 years of skip fees']], ['Questions?', 'Thank you, Khun Somchai and the kitchen team']] },
  },
  'ev-006': {
    'Results sheet': { t: 'cert', org: 'Thailand Age Group Swimming · Bangkok Region', kind: 'Results', pre: 'Official result', line: 'Girls 15–16 · 200 m Individual Medley · Final', award: '4th place · 2:31.40 (PB)', sign: [['K. Phromsuwan', 'Meet Referee']], seal: '4', colour: '#0072CE', no: 'BKK-AG-2402-117' },
    'Full meet results': { t: 'web', url: 'example.org/meet2402', site: 'Bangkok Regional Age Group Championships 2024', blocks: [
      ['h', 'Event 14 · Girls 15–16 200 m IM · Final'],
      ['table', ['Place', 'Swimmer', 'Club', 'Time'], [['1', 'Napasorn W.', 'Bangkok SC', '2:26.18'], ['2', 'Emily R.', 'Harbour Aquatics', '2:28.04'], ['3', 'Thitima K.', 'Nonthaburi SC', '2:30.77'], ['4', 'Maya Chen', 'NIST', '2:31.40'], ['5', 'Lin Y.', 'Bangkok SC', '2:32.95'], ['6', 'Sara P.', 'Pattaya Dolphins', '2:34.11']]],
      ['stats', [['Fly split', '33.9'], ['Back split', '39.2'], ['Breast split', '43.6'], ['Free split', '34.7']]] ] },
  },
  'ev-007': {
    'Live quiz': { t: 'web', url: 'example.org/quiz', site: 'Which bin? ♻', blocks: [
      ['stats', [['Question', '4 of 10'], ['Players', '180'], ['Correct so far', '71%']]],
      ['h', 'A greasy pizza box goes in…'], ['list', ['A. Recycling (paper)', 'B. General waste ✓', 'C. Compost', 'D. Plastics']],
      'Grease soaks into the cardboard fibres and spoils a whole bale of paper recycling. Tear off the clean lid and recycle that part!',
      ['bars', 'Answers from the hall', [['A', 92], ['B', 61], ['C', 22], ['D', 5]]] ] },
    'Assembly feedback form': { t: 'sheet', file: 'Year 7 assembly feedback (Google Form responses)', tab: 'Form responses 1',
      cols: ['Timestamp', 'Was the quiz fun? (1–5)', 'Did you learn something new?', 'What surprised you?'],
      rows: [['05/03 09:12', 5, 'Yes', 'pizza boxes!!'], ['05/03 09:12', 4, 'Yes', 'that crisp packets are not recyclable'], ['05/03 09:13', 5, 'Yes', 'coffee cups have plastic inside'], ['05/03 09:13', 3, 'A bit', 'nothing, I knew most'], ['05/03 09:14', 5, 'Yes', 'the batteries one'], ['05/03 09:15', 4, 'Yes', 'glass is separate']],
      foot: ['142 responses', 4.4, '89% yes', ''] },
  },
  'ev-008': {
    'Field notebook scans': { t: 'doc', format: 'Scanned notebook', pages: 9, letterhead: false, heading: 'Khao Yai field notebook', sub: '12–14 March 2024 · Group C · quadrat sampling', blocks: [
      ['h', 'Day 1 · Site A (lowland, 250 m)'], 'Overcast, 29 °C, humid. Leaf litter thick. 10 quadrats (1 m²) placed with random-number table.',
      ['table', ['Quadrat', 'Species', 'Ground cover %', 'Notes'], [['A1', 4, 65, 'ferns, seedling of Dipterocarp?'], ['A2', 6, 80, 'moss on log'], ['A3', 3, 40, 'path edge, trampled'], ['A4', 7, 85, ''], ['A5', 5, 70, 'ants everywhere!']]],
      ['h', 'Day 2 · Site B (mid, 700 m)'], 'Cooler, 24 °C. Fewer ferns, more grasses near the clearing. Hornbill heard at 10:40.',
      ['note', 'Maya, later', 'Simpson’s index: A = 0.71, B = 0.78, C = 0.64. Diversity peaks at mid altitude. Ask Mr Okafor why.'] ] },
  },
  'ev-009': {
    'Tally sheet template': { t: 'doc', format: 'PDF', pages: 1, heading: 'Beach Guardians litter survey · tally sheet', sub: 'One sheet per pair · 20 m stretch of beach · tick every item', blocks: [
      ['table', ['Category', 'Examples', 'Tally', 'Total'], [['Plastic bottles', 'water, soda, oil', '', ''], ['Bottle caps', 'any colour', '', ''], ['Food wrappers', 'crisps, sweets, noodles', '', ''], ['Bags', 'shopping, rubbish', '', ''], ['Polystyrene', 'boxes, pieces', '', ''], ['Straws & cutlery', '', '', ''], ['Fishing gear', 'line, net, floats', '', ''], ['Cigarette ends', '', '', ''], ['Glass', 'DO NOT TOUCH, flag it', '', ''], ['Rubber', 'flip-flops, gloves', '', ''], ['Cloth', '', '', ''], ['Other', 'write it in', '', '']]],
      'Pair names: ______________   Stretch no.: ____   Start time: ____',
      ['note', 'How to use it', 'One person picks up, one person ticks. Five ticks make a gate: ||||/. Hand your sheet to Maya at the bus.'] ] },
  },
  'ev-010': {
    'Science fair: Silver': { t: 'cert', org: 'NIST International School · Secondary Science Fair 2024', kind: 'Silver Award', line: 'for the project “Microplastics in three Bangkok canals”, judged for scientific method, data quality and communication.', sign: [['David Okafor', 'Head of Science'], ['Anan Wongsakul', 'Head of School']], seal: 'Ag', colour: '#9aa5b1', no: 'SF24-031' },
  },
  'ev-011': {
    'Camp training log': { t: 'sheet', file: 'Hua Hin camp log · June 2024', tab: 'Maya',
      cols: ['Day', 'AM session', 'PM session', 'Km', 'RPE (1–10)', 'Sleep (h)', 'Note'],
      rows: [['Sun', 'Travel', 'Easy 2 km', 2, 3, 8, ''], ['Mon', 'Aerobic 5 km', 'IM drills 3 km', 8, 6, 7.5, 'shoulder tight'], ['Tue', 'Threshold 5.5 km', 'Open water 1.5 km', 7, 8, 6, 'revision until 23:00'], ['Wed', 'Recovery 3 km', 'Off', 3, 3, 7, ''], ['Thu', 'Race pace 4.5 km', 'IM 3.5 km', 8, 8, 5.5, 'chem test next week…'], ['Fri', 'Time trial 200 IM', 'Easy 2 km', 3, 9, 6, '2:32.1'], ['Sat', 'Relay games', 'Travel', 2, 4, 8, '']],
      foot: ['Total', '', '', 33, '', '', ''] },
  },
  'ev-012': {
    'Advisor meeting notes': { t: 'doc', format: 'Google Doc', meta: 'Advisor meeting · Mr Whitfield & Maya Chen · 20 June 2024', heading: 'End-of-year check-in', blocks: [
      ['h', 'What went well'], ['list', ['Science fair Silver. Maya most proud of re-designing the counting method mid-project.', 'Composting audit led to a real bin. Facilities have ordered it.', 'Quiz app used in a Y7 assembly.']],
      ['h', 'What was hard'], ['list', ['Swim camp in revision week. Maya was tired and anxious, slept 5–6 hours.', 'Feels “spread thin”.']],
      ['h', 'Noticing'], 'All three proud moments involve careful counting and a chart at the end. Maya: “I keep wanting a program to do the boring part.”',
      ['h', 'Actions'], ['ol', ['Maya to talk to Coach Dan and her parents about cutting sessions.', 'Try the Thursday code club in September.', 'JW to send the link to the free data visualisation course.']] ] },
  },
  'ev-013': {
    'Revised timetable': { t: 'sheet', file: 'Maya · weekly plan · from 10 Sept 2024', tab: 'Week',
      cols: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      rows: [['06:00', '', 'Swim', '', '', 'Swim', ''], ['15:30', 'Homework', 'Homework', 'Tutoring Y8', 'Code club', 'Free!', ''], ['17:00', 'Project time', 'Homework', 'Homework', 'Code club', '', 'Beach Guardians (1st Sat)'], ['19:30', 'Revision', 'Revision', 'Project time', 'Revision', '', '']],
      note: 'Down from five swim sessions to two (Tue and Fri). Agreed with Coach Dan, 6 Sept.' },
  },
  'ev-014': {
    'Sketch on GitHub': { t: 'repo', repo: 'mayachen/dht22-logger', about: 'Log temperature and humidity from a DHT22 to a laptop over serial.', lang: [['Arduino', 71], ['Python', 29]], files: ['data/', 'logger/', 'logger/logger.ino', 'plot.py', 'README.md'],
      commits: [['Plot readings with matplotlib', 'Oct 7, 2024'], ['Log to CSV with timestamps', 'Oct 6, 2024'], ['Read DHT22 every 10 s', 'Oct 5, 2024'], ['Initial commit', 'Oct 5, 2024']],
      readme: [['h', 'DHT22 logger'], 'Made at the maker club Arduino workshop. An Arduino Uno reads a DHT22 sensor every ten seconds and prints `temp,humidity` over serial. `plot.py` saves the readings to CSV and draws a chart.', ['code', '// logger.ino\n#include <DHT.h>\nDHT dht(2, DHT22);\nvoid setup() { Serial.begin(9600); dht.begin(); }\nvoid loop() {\n  Serial.print(dht.readTemperature()); Serial.print(",");\n  Serial.println(dht.readHumidity());\n  delay(10000);\n}'], ['h', 'What I learned'], ['list', ['The first reading is often NaN, so skip it.', 'Breathing on the sensor makes a great test spike.']]] },
  },
  'ev-015': {
    'Tutoring log (24 sessions)': { t: 'sheet', file: 'Peer tutoring log · Y8 science', tab: '2024–25',
      cols: ['#', 'Date', 'Students', 'Topic', 'Went well', 'Next time'],
      rows: [[1, '16 Oct', 'Ploy, Tee, Arthit', 'States of matter', 'Particle drawings', 'Bring ice + kettle demo'], [2, '23 Oct', 'Ploy, Tee, Arthit', 'Changes of state', 'Kettle demo!', 'Quiz at start'], [3, '30 Oct', 'Tee, Arthit', 'Density', 'Floating eggs', 'Ploy absent, send notes'], [4, '6 Nov', 'all 3', 'Forces & arrows', 'Tug-of-war example', 'More practice questions'], ['…', '', '', '', '', ''], [24, '23 Apr', 'all 3', 'Revision: forces', 'All 3 passed the unit test', 'End of programme']],
      foot: ['24', 'sessions', '3 students', '', 'Attendance 92%', ''] },
  },
  'ev-016': {
    'Grade 7': { t: 'result', system: 'SIS', course: 'Year 11 Biology', task: 'Unit test: Mendelian genetics', colA: 'Section',
      rows: [['A: Multiple choice', 19, 20], ['B: Punnett squares', 14, 14], ['C: Pedigree analysis', 11, 12], ['D: Extended response', 9, 10]], grade: 7, scale: 'MYP 1–7 · top of the year group',
      comment: 'Outstanding. Every cross is correct and your pedigree reasoning is clear and complete.', by: 'Mr David Okafor, Biology' },
    'Revision Punnett square sheet': { t: 'doc', format: 'PDF', pages: 2, heading: 'Punnett practice: TV families', sub: 'Maya’s revision sheet, Year 11', blocks: [
      'To practise, I gave every family in a TV series a gene for eye colour (B = brown, dominant; b = blue) and worked out the crosses.',
      ['table', ['Cross', 'Parents', 'Offspring ratio'], [['1', 'Bb × bb', '1 brown : 1 blue'], ['2', 'Bb × Bb', '3 brown : 1 blue'], ['3', 'BB × bb', 'all brown (Bb)'], ['4 (sex-linked)', 'XᴴXʰ × XᴴY', 'sons 1:1 affected'], ['5 (dihybrid)', 'BbTt × BbTt', '9 : 3 : 3 : 1']]],
      ['note', 'Note to self', 'Always write the gametes first. Every mistake I made in Year 10 was a skipped gamete step.'] ] },
  },
  'ev-017': {
    'Energy audit report': { t: 'doc', heading: 'Eco-committee energy audit', sub: 'Classroom electricity use after school, January 2025 · report to Facilities', pages: 6, blocks: [
      ['h', 'Summary'], 'We read the electricity meter in 42 classrooms at 07:30 and 16:30 every school day for four weeks. Lights and air-conditioning left on after school used about 1,950 kWh a month, costing roughly ฿18,000 a term.',
      ['bars', 'After-school use by building (kWh per week)', [['Science', 168], ['Humanities', 121], ['Arts', 96], ['Maths', 72], ['Languages', 31]], ' kWh'],
      ['h', 'Recommendations'], ['ol', ['Fit timer switches to air-conditioning in the 12 worst rooms (cost ฿2,400 each).', 'Add “last out, lights out” stickers made by Year 7.', 'Repeat the audit in May to measure the change.']],
      ['note', 'Facilities, reply', 'Timers approved for 12 rooms. Installation over February half-term. Thank you, eco-committee.'] ] },
    'Energy dashboard (spreadsheet)': { t: 'sheet', file: 'Energy audit · dashboard', tab: 'By room', tabs: ['By room', 'Raw readings', 'Chart'],
      cols: ['Room', 'Building', 'Mean after-hours kWh/day', 'Lights left on (days)', 'AC left on (days)', 'Est. ฿/term'],
      rows: [['S12', 'Science', 9.8, 14, 17, 2160], ['S08', 'Science', 8.9, 11, 16, 1960], ['H03', 'Humanities', 7.1, 15, 9, 1560], ['A02', 'Arts', 6.4, 18, 6, 1410], ['M05', 'Maths', 5.2, 9, 8, 1140], ['L01', 'Languages', 1.2, 3, 1, 260]],
      foot: ['42 rooms', '', '', '', 'Total', 18050] },
  },
  'ev-018': {
    'Gala results': { t: 'web', url: 'example.org/gala25', site: 'Inter-School Swimming Gala 2025 · Results', blocks: [
      ['h', 'Girls U18 200 m IM'], ['table', ['Place', 'Swimmer', 'School', 'Time'], [['1', 'Hannah L.', 'Riverside Intl', '2:27.80'], ['2', 'Pimchanok S.', 'Bangkok Prep', '2:30.15'], ['3', 'Maya Chen', 'NIST', '2:33.02'], ['4', 'Ines M.', 'Garden Intl', '2:35.47']]],
      ['h', 'Team scores'], ['stats', [['1st · Riverside', '412'], ['2nd · NIST', '389'], ['3rd · Bangkok Prep', '351']]] ] },
  },
  'ev-019': {
    'MYP criterion C: 8/8': { t: 'result', course: 'Year 11 Biology', task: 'Investigation: temperature and catalase activity', rows: [['C: Processing and evaluating', 8, 8]], noTotal: true, grade: '8/8', gradeLabel: 'Criterion C',
      comment: 'Exemplary processing: means, standard deviations and error bars all correct, and your evaluation of the 60 °C anomaly is genuinely scientific.', by: 'Mr David Okafor, Biology' },
    'Investigation report': { t: 'doc', heading: 'How does temperature affect the activity of catalase in potato?', sub: 'Year 11 Biology investigation · Maya Chen · March 2025', pages: 11, blocks: [
      ['h', 'Hypothesis'], 'Catalase activity will rise with temperature up to around 40 °C, then fall sharply as the enzyme denatures.',
      ['h', 'Variables'], ['table', ['Independent', 'Dependent', 'Controlled'], [['Temperature: 10, 20, 30, 40, 50, 60 °C', 'Volume of O₂ in 60 s (cm³)', 'Potato mass 2.0 g, H₂O₂ 3%, 10 cm³, same potato, pH 7 buffer']]],
      ['h', 'Results'], ['table', ['Temp (°C)', 'Mean O₂ (cm³)', 'SD', 'n'], [['10', '4.2', '0.4', '5'], ['20', '7.9', '0.6', '5'], ['30', '12.6', '0.8', '5'], ['40', '15.1', '1.1', '5'], ['50', '9.3', '1.7', '5'], ['60', '3.0', '2.4', '5']]],
      ['bars', 'Mean oxygen produced in 60 s', [['10 °C', 4.2], ['20 °C', 7.9], ['30 °C', 12.6], ['40 °C', 15.1], ['50 °C', 9.3], ['60 °C', 3.0]], ' cm³'],
      ['h', 'Evaluation (extract)'], 'The large SD at 60 °C comes from the water bath drifting by up to 3 °C. A thermostatic bath, or a datalogger probe, would reduce this.' ] },
  },
  'ev-020': {
    'Survey summary for district office': { t: 'doc', heading: 'Mae Ramphueng beach litter: two-year summary', sub: 'Prepared for the Rayong District Environment Office by Beach Guardians, NIST · April 2025', pages: 2, blocks: [
      ['stats', [['Survey days', '18'], ['Items counted', '24,318'], ['Volunteers', '146'], ['Weight removed', '1.9 t']]],
      ['bars', 'Share of items by category, 2023–25', [['Food wrappers', 27], ['Bottle caps', 19], ['Plastic bottles', 14], ['Polystyrene', 12], ['Fishing gear', 9], ['Cigarette ends', 8], ['Other', 11]], '%'],
      ['h', 'Findings'], ['list', ['Food wrappers rise by 40% in the months after long weekends.', 'Fishing gear is concentrated at the northern 200 m, near the pier.', 'Polystyrene fell by a third after the market switched to paper boxes in 2024.']],
      ['h', 'Request'], 'We would welcome extra bins at the northern car park and would be glad to share data every term.', ['sign', 'Maya Chen', 'Survey lead, Beach Guardians'] ] },
  },
  'ev-021': {
    'Course certificate': { t: 'cert', org: 'DataCamp-style online academy', kind: 'Certificate of Completion', line: 'has completed Data Analysis with Python: pandas, cleaning, grouping and visualisation, with 8 graded notebooks (average 94%).', sign: [['R. Mendes', 'Course lead']], seal: '✓', colour: '#00A39E', no: 'DA-PY-882140' },
  },
  'ev-022': {
    'Seedling tag register': { t: 'sheet', file: 'Chanthaburi mangroves · tag register', tab: 'Tags', tabs: ['Tags', '6-month check'],
      cols: ['Tag', 'Species', 'Plot', 'Planted', 'Height (cm)', 'Planted by'],
      rows: [['M-001', 'Rhizophora apiculata', 'P1', '13 Jun', 32, 'Maya C.'], ['M-002', 'R. apiculata', 'P1', '13 Jun', 29, 'Maya C.'], ['M-003', 'Avicennia alba', 'P1', '13 Jun', 18, 'Ken T.'], ['M-014', 'R. mucronata', 'P2', '14 Jun', 41, 'Ploy S.'], ['M-027', 'A. alba', 'P3', '14 Jun', 22, 'Maya C.'], ['…', '', '', '', '', ''], ['M-050', 'R. apiculata', 'P4', '15 Jun', 35, 'Dao N.']],
      foot: ['50 tagged', '3 species', '4 plots', '600 planted', 'mean 31', ''], note: '6-month survival check booked for December with the Chanthaburi mangrove centre.' },
    'Trip photo album': { t: 'web', url: 'example.org/mangroves', site: 'CAS trip · Chanthaburi mangroves · June 2025', blocks: [
      ['stats', [['Students', '30'], ['Seedlings', '600'], ['Tagged', '50'], ['Days', '3']]],
      ['fig', 'Day 1: carrying seedlings across the mudflat at low tide.', 'evidence/mangroves.svg'],
      'Album shared with families. 86 photos · captions by the trip team.' ] },
  },
  'ev-023': {
    'Course outline': { t: 'doc', heading: 'IB Biology HL · course outline 2025–27', sub: 'Mr David Okafor · 6 lessons per fortnight + 1 lab', pages: 4, blocks: [
      ['table', ['Term', 'Themes', 'Assessment'], [['Y12 T1', 'Unity and diversity: molecules, cells, organisms', 'Lab skills portfolio'], ['Y12 T2', 'Form and function', 'Topic test'], ['Y12 T3', 'Interaction and interdependence', 'IA proposal'], ['Y13 T1', 'Continuity and change; IA data collection', 'Internal assessment (20%)'], ['Y13 T2', 'Revision and mocks', 'Mock exams']]],
      ['h', 'External assessment'], 'Paper 1 (multiple choice and data), Paper 2 (data-based and extended response). Internal assessment: an individual scientific investigation, 3,000 words.' ] },
  },
  'ev-024': {
    'Course outline': { t: 'doc', heading: 'IB Computer Science SL · course outline 2025–27', sub: 'Ms Priya Nair', pages: 3, blocks: [
      ['table', ['Unit', 'Content', 'Weeks'], [['A1–A2', 'Computer fundamentals, networks', 8], ['A3', 'Databases', 5], ['B1–B2', 'Computational thinking, programming in Python', 14], ['B3', 'Object-oriented programming', 6], ['IA', 'Computational solution for a real client', 12]]],
      'Internal assessment: a product for a real client with documentation, worth 30% at SL.' ] },
  },
  'ev-025': {
    'Session plans (12 weeks)': { t: 'doc', heading: 'Friday STEM club for Year 7 girls · session plans', sub: 'Maya Chen & Lily W. · Term 1–2, 2025–26', pages: 7, blocks: [
      ['table', ['Week', 'Build', 'Big idea', 'Kit'], [['1', 'Light-up bookmark', 'Circuits need a loop', 'coin cell, LED, copper tape'], ['2', 'Squishy circuits', 'Conductors vs insulators', 'play-dough, battery pack'], ['3–4', 'Light sensor night-light', 'Sensors turn the world into numbers', 'micro:bit'], ['5–6', 'micro:bit pet', 'Inputs → decisions → outputs', 'micro:bit, servo'], ['7–9', 'Class weather station', 'Data over time', 'micro:bit, BME280'], ['10–11', 'Showcase prep', 'Explaining your work', 'laptops'], ['12', 'Showcase for families', '', '']]],
      ['note', 'After week 4', 'Two girls bored by the bookmark were the fastest coders. Added a “stretch card” to every session.'] ] },
    'Club showcase video': { t: 'video', title: 'Friday STEM Club showcase 2026', dur: '4:38', views: '612', desc: '14 Year 7 girls show what they built this year, from a micro:bit pet that sulks when you ignore it to a weather station that tweets the canteen temperature.', chapters: [['0:00', 'Welcome from Maya and Lily'], ['0:42', 'Light-up bookmarks'], ['1:30', 'micro:bit pets'], ['2:55', 'The weather station'], ['4:05', 'What we want to build next']] },
  },
  'ev-026': {
    'Source code': { t: 'repo', repo: 'mayachen/classroom-co2', about: 'A Raspberry Pi CO₂ logger for one classroom, with a tiny chart page.', lang: [['Python', 84], ['HTML', 16]], files: ['sensor/', 'sensor/scd30.py', 'web/', 'web/index.html', 'log.py', 'requirements.txt', 'README.md'], commitCount: 23,
      commits: [['Add 1,500 ppm warning line to chart', 'Nov 12, 2025'], ['Rotate log file daily', 'Nov 9, 2025'], ['Serve chart with Flask', 'Nov 6, 2025'], ['Log SCD30 every 60 s', 'Nov 3, 2025']],
      readme: [['h', 'classroom-co2'], 'A first prototype for measuring air quality in my classroom. An SCD30 sensor on a Raspberry Pi 4 logs CO₂, temperature and humidity every minute.', ['h', 'What it showed'], 'CO₂ climbs above 1,500 ppm by the end of a double lesson with the door shut. Opening the door for five minutes brings it under 800.', ['code', '$ pip install -r requirements.txt\n$ python log.py --interval 60 --out data/\n$ flask --app web run']] },
  },
  'ev-028': {
    'Proposal with teacher comments': { t: 'doc', heading: 'Biology IA proposal', sub: 'How does water temperature affect the growth rate of Chlorella vulgaris?', pages: 2, blocks: [
      ['h', 'Research question'], 'How does water temperature (15, 20, 25, 30, 35 °C) affect the population growth rate of Chlorella vulgaris over twelve weeks, measured by cell density with a haemocytometer?',
      ['note', 'Mr Okafor', 'Good, clear and measurable. Twelve weeks is ambitious; plan your counting schedule now.'],
      ['h', 'Method outline'], ['list', ['Five aquarium heaters in insulated tanks, 3 flasks per temperature.', 'Count cells every 4 days with a haemocytometer, 5 squares per sample.', 'Fit a logistic growth model in Python.']],
      ['note', 'Mr Okafor', 'Light is your biggest uncontrolled variable. Add a light-intensity control (same lamp distance, check with a lux meter). Approved with this change.'],
      ['h', 'Safety and ethics'], 'Chlorella is non-pathogenic. Waste culture is autoclaved before disposal.' ] },
  },
  'ev-042': {
    'Dashboard': { t: 'web', url: 'example.org/aq', site: 'Campus air quality · live', blocks: [
      ['stats', [['Canteen PM2.5', '41 µg/m³'], ['Library', '12 µg/m³'], ['Gym', '15 µg/m³'], ['Field', '22 µg/m³'], ['Science block CO₂', '780 ppm'], ['Sensors online', '6 / 6']]],
      ['fig', 'PM2.5 today. The dashed line is the WHO 24-hour guideline (15 µg/m³).', 'evidence/aq-dashboard.svg'],
      ['note', 'Facilities', 'We check this every morning at 07:45. The canteen alert is set at 35 µg/m³.'] ] },
    'Calibration notes': { t: 'doc', format: 'Google Doc', heading: 'Sensor calibration notes', sub: 'Six units against the school weather station · 2–9 March 2026', pages: 3, blocks: [
      'Each unit sat beside the reference station for 48 hours. I fitted a linear correction (reference = a × raw + b) for PM2.5 and CO₂.',
      ['table', ['Unit', 'Location', 'PM2.5 a', 'PM2.5 b', 'R²', 'CO₂ offset (ppm)'], [['AQ-1', 'Canteen', 0.91, 1.8, 0.97, -22], ['AQ-2', 'Library', 0.88, 2.1, 0.96, -15], ['AQ-3', 'Gym', 0.94, 0.9, 0.98, -31], ['AQ-4', 'Field', 1.02, -0.4, 0.95, 'n/a'], ['AQ-5', 'Science', 0.89, 1.5, 0.97, -18], ['AQ-6', 'Car park', 0.97, 0.6, 0.94, 'n/a']]],
      ['note', 'Problem', 'AQ-4 drifted after rain. The housing vent faced up. Reprinted the housing with a downward vent.'] ] },
  },
  'ev-029': {
    'Report (PDF)': { t: 'doc', heading: 'Where does our bad air come from?', sub: 'Analysis of 40,214 readings from the campus sensor network · Maya Chen · March 2026', pages: 14, blocks: [
      ['h', 'Key finding'], 'PM2.5 in the canteen rises from about 12 to over 60 µg/m³ between 11:45 and 12:40 every school day, four times the WHO guideline. It does not happen on days when the grill is not used.',
      ['bars', 'Mean PM2.5 by hour, canteen (µg/m³)', [['10:00', 11], ['11:00', 14], ['11:30', 23], ['12:00', 58], ['12:30', 61], ['13:00', 34], ['14:00', 15]], ''],
      ['h', 'Cleaning'], ['list', ['Removed 1,180 readings when a sensor was offline (gaps > 5 min).', 'Dropped 212 spikes above 500 µg/m³ caused by someone vaping next to AQ-6.', 'Applied calibration corrections from the March notes.']],
      ['h', 'Recommendation'], 'Move the grill extractor outlet, which currently vents beside the canteen air intake.',
      ['note', 'Outcome', 'Facilities moved the vent in April. Lunchtime peak is now 19 µg/m³.'] ] },
    'Notebook': { t: 'repo', repo: 'mayachen/campus-aq-analysis', about: 'Jupyter notebooks for the campus air-quality report.', lang: [['Jupyter Notebook', 92], ['Python', 8]], files: ['data/raw/', 'data/clean/', '01_clean.ipynb', '02_explore.ipynb', '03_canteen.ipynb', 'aq.py', 'README.md'], commitCount: 41,
      commits: [['Hourly canteen means with bootstrap CIs', 'Mar 26, 2026'], ['Compare grill vs no-grill days', 'Mar 22, 2026'], ['Drop vape spikes at AQ-6', 'Mar 19, 2026'], ['Apply calibration coefficients', 'Mar 17, 2026']],
      readme: [['h', 'campus-aq-analysis'], 'Run the notebooks in order. `aq.py` holds the cleaning helpers.', ['code', 'df = load_readings("data/raw/")\ndf = drop_gaps(df, max_gap="5min")\ndf = calibrate(df, COEFFS)\ncanteen = df.query("unit == \'AQ-1\'").groupby(df.ts.dt.floor("30min")).pm25.mean()']] },
  },
  'ev-030': {
    'IA predicted: 7': { t: 'result', course: 'IB Biology HL', task: 'Internal assessment: modelling algae growth (draft)', colA: 'IA criterion',
      rows: [['Research design', 6, 6], ['Data analysis', 5, 6], ['Conclusion', 5, 6], ['Evaluation', 5, 6]], grade: 7, gradeLabel: 'Predicted grade', scale: 'IB 1–7',
      comment: 'The logistic model is beyond what we usually see. Make sure your conclusion explains what r and K mean biologically at each temperature.', by: 'Mr David Okafor, Biology' },
    'IA report (PDF)': { t: 'doc', heading: 'The effect of water temperature on the growth rate of Chlorella vulgaris', sub: 'IB Biology HL internal assessment · draft 2 · 2,940 words', pages: 12, blocks: [
      ['h', '1. Research question'], 'How does water temperature (15–35 °C) affect the intrinsic growth rate r and carrying capacity K of Chlorella vulgaris over 12 weeks?',
      ['h', '3. Results'], ['table', ['Temp (°C)', 'r (day⁻¹)', 'K (×10⁶ cells/mL)', 'R²'], [['15', '0.11', '4.2', '0.96'], ['20', '0.19', '6.8', '0.98'], ['25', '0.27', '8.9', '0.99'], ['30', '0.31', '8.1', '0.97'], ['35', '0.14', '3.5', '0.91']]],
      ['code', 'from scipy.optimize import curve_fit\nlogistic = lambda t, K, r, N0: K / (1 + ((K - N0) / N0) * np.exp(-r * t))\n(K, r, N0), _ = curve_fit(logistic, days, density, p0=[8e6, 0.2, 2e5])'],
      ['h', '4. Conclusion (extract)'], 'Growth rate peaks near 30 °C but carrying capacity peaks at 25 °C, suggesting that warmer water speeds growth while reducing the population a flask can sustain.' ] },
  },
  'ev-031': {
    'Certificate of completion': { t: 'cert', org: 'University Summer School in Data Science', kind: 'Certificate of Completion', line: 'has completed the two-week Summer School in Data Science (40 contact hours), including a team project on bike-share demand presented to faculty.', sign: [['Dr Kanya Rattanapong', 'Programme Director']], seal: 'DS', colour: '#6B3FB0', no: 'SSDS-2026-0447' },
    'Final presentation': { t: 'slides', slides: [['Will it rain on your ride?', 'Bike-share demand and weather · Team 4: Maya, Jun, Aditi, Tom'], ['The question', 'How much does rain and heat reduce daily bike-share trips?'], ['Data', ['2 years of daily trips (731 days)', 'Hourly weather from the national met service']], ['What we found', ['Each mm of rain cuts trips by ~2.1%', 'Above 33 °C, trips drop 18%']], ['Model', ['Poisson regression with day-of-week and holiday terms', 'Test MAE: 312 trips/day']], ['Limits', ['No data on station closures', 'One city only']], ['Thank you', 'Questions?']] },
  },
  'ev-032': {
    'EE draft 1 (3,200 words)': { t: 'doc', heading: 'To what extent can rainfall and temperature predict weekly dengue cases in Bangkok (2014–2023)?', sub: 'Extended Essay · Biology · draft 1 · 3,200 words · supervisor: Mr David Okafor', pages: 19, blocks: [
      ['h', 'Introduction (extract)'], 'Dengue fever is transmitted by Aedes aegypti, whose breeding depends on standing water and whose development speeds up in warm conditions. Bangkok reports between 5,000 and 25,000 cases a year, yet public warnings are issued only after cases rise.',
      ['h', 'Method'], ['list', ['Weekly case counts from the Department of Disease Control (520 weeks).', 'Daily rainfall and mean temperature from the Thai Meteorological Department, aggregated to weeks.', 'Cross-correlation to find the lag, then a negative binomial regression.']],
      ['bars', 'Correlation of cases with rainfall at each lag', [['0 wk', 0.08], ['2 wk', 0.21], ['4 wk', 0.38], ['6 wk', 0.44], ['8 wk', 0.31], ['10 wk', 0.17]], ''],
      ['note', 'Mr Okafor', 'Strong analysis. Your discussion needs to engage with why the 6-week lag makes biological sense (egg → adult → infection → symptoms).'] ] },
  },
  'ev-033': {
    'Runner-up certificate': { t: 'cert', org: 'Youth Climate Hack Bangkok 2026', kind: 'Runner-up', pre: 'Awarded to Team FloodFlow:', name: 'Maya Chen, Ton S. & Priya R.', line: 'for “FloodFlow”, a LINE chatbot that sends district-level flood alerts from live rainfall data, built in 24 hours.', award: '2nd place of 22 teams', sign: [['Jirapat L.', 'Head judge']], seal: '2', colour: '#0072CE' },
    'Demo video': { t: 'video', title: 'FloodFlow: flood alerts in your LINE chat (hackathon demo)', dur: '2:59', views: '1,204', host: 'YouTube', desc: 'Our 3-minute pitch from Youth Climate Hack Bangkok. Type your district and FloodFlow warns you when rainfall upstream means your soi is likely to flood within three hours.', chapters: [['0:00', 'The problem: flooding with no warning'], ['0:35', 'Live demo in LINE'], ['1:40', 'How it works: rain gauges + drainage map'], ['2:30', 'What we would build next']] },
  },
  'ev-034': {
    'CAS portfolio summary': { t: 'doc', heading: 'CAS portfolio summary', sub: 'Maya Chen · mid-point review · October 2026 · CAS coordinator: Ms Clara Brandt', pages: 4, blocks: [
      ['table', ['Strand', 'Experience', 'Hours', 'Learning outcomes'], [['Service', 'Friday STEM club for Y7 girls (CAS project)', 52, 'LO 3, 4, 5, 6'], ['Service', 'Beach Guardians survey lead', 30, 'LO 2, 5, 6'], ['Activity', 'Mangrove planting trip', 24, 'LO 1, 6, 7'], ['Creativity', 'Youth climate hackathon', 24, 'LO 2, 3'], ['Creativity', 'Air-quality dashboard', 40, 'LO 1, 2, 3']]],
      ['stats', [['Experiences', '9'], ['Learning outcomes met', '7 / 7'], ['Reflections', '14']]],
      ['note', 'Ms Brandt', 'All seven learning outcomes evidenced. A model portfolio. Please keep reflecting through Year 13.'] ] },
  },
  'ev-035': {
    'EE timeline': { t: 'sheet', file: 'Extended Essay · timeline to submission', tab: 'Plan',
      cols: ['Milestone', 'Due', 'Status', 'Notes'],
      rows: [['Proposal', '14 Nov 2025', '✓ Done', 'Approved'], ['Data collection', 'Feb 2026', '✓ Done', '520 weeks of cases'], ['First draft', '20 Mar 2026', '✓ Done', '3,200 words'], ['Interim reflection', 'Sep 2026', '✓ Done', 'Viva 15 Sep'], ['Second draft', '30 Nov 2026', 'In progress', 'Rewrite discussion'], ['Final viva', '10 Jan 2027', '', ''], ['Submission', '15 Jan 2027', '', '']] },
  },
  'ev-036': {
    'University shortlist': { t: 'sheet', file: 'University shortlist · Maya Chen', tab: 'Shortlist', tabs: ['Shortlist', 'Deadlines', 'Notes from Ms Adeyemi'],
      cols: ['University', 'Course', 'Country', 'Typical offer', 'Why', 'Deadline'],
      rows: [['University A', 'BSc Data Science', 'UK', 'IB 38, HL 6 6 6', 'Environmental data modules', '15 Jan'], ['University B', 'BSc Environmental Data Science', 'UK', 'IB 36', 'Field + data mix', '15 Jan'], ['University C', 'BSc Statistics & Data Science', 'Netherlands', 'IB 33', 'Public-health track', '1 May'], ['University D', 'Bachelor of Data Science', 'Australia', 'IB 34', 'Co-op year', '30 Sep'], ['University E', 'BSc Data Science', 'Singapore', 'IB 40', 'Close to home', '15 Mar']] },
  },
};
