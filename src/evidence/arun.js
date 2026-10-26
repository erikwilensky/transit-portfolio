// Arun Mehta (Year 12): every non-image piece of evidence on his map.
const outline = (heading, sub, rows, note) => ({ t: 'doc', heading, sub, pages: 3, blocks: [['table', ['Term', 'Content', 'Assessment'], rows], note] });
const pianoCert = (grade, result, marks, no) => ({ t: 'cert', org: 'Associated Board of Music Examinations (demo)', kind: `Grade ${grade} Piano`, line: `has passed the Grade ${grade} Piano practical examination`, award: `${result} · ${marks}/150`, sign: [['M. Harrington', 'Chief Executive']], seal: '♪', colour: '#D6457F', no });
const markSheet = (grade, rows, total, comment) => ({ t: 'result', org: 'Associated Board of Music Examinations (demo)', system: 'Exam board', course: `Grade ${grade} Piano · practical`, task: 'Examiner’s mark form', colA: 'Section', rows, grade: total, gradeLabel: 'Result', comment, by: 'Examiner: Ms R. Fielding' });

export default {
  'ev-101': {
    'Sketch portfolio': { t: 'slides', label: 'Portfolio · 8 pages', slides: [['Desk organiser: sketch portfolio', 'MYP Design · Year 10 · Arun Mehta'], ['Orthographic: front, side, plan', ['Third-angle projection', 'Scale 1:2, dimensions in mm']], ['Two-point perspective', ['Vanishing points on the horizon', 'Construction lines kept light']], ['Ideation: 12 thumbnails in 10 minutes', 'Quantity first, judge later'], ['Three ideas developed', ['A: stepped trays', 'B: rotating carousel', 'C: modular cubes']], ['Chosen idea: modular cubes', ['Clip together any way', 'Fits my messy desk']], ['Exploded view', 'How the clips work'], ['Teacher feedback', '“Confident line work. Push the rendering next time.” — Mr Hale']] },
  },
  'ev-102': {
    'Grade 5 certificate': pianoCert(5, 'Merit', 121, 'P5-2409-55120'),
    'Examiner\'s mark sheet': markSheet(5, [['Piece A: Clementi, Sonatina Op. 36 No. 3', 25, 30], ['Piece B: Grieg, Waltz', 24, 30], ['Piece C: Blues for Bea', 26, 30], ['Scales and arpeggios', 16, 21], ['Sight-reading', 14, 21], ['Aural tests', 16, 18]], 'Merit', 'A confident, musical performance. The blues piece had real swing. Scales were secure but sometimes hurried; sight-reading would benefit from steadier pulse.'),
  },
  'ev-103': {
    'Criterion C: 6/8': { t: 'result', course: 'MYP Year 10 French (Phase 3)', task: 'Oral presentation: mon quartier', rows: [['C: Communicating in response to spoken/written text', 6, 8]], noTotal: true, grade: '6/8', gradeLabel: 'Criterion C',
      comment: 'Très bien, Arun. Good range of vocabulary about your neighbourhood. When you lost a word you recovered well, using a phrase you knew. Work on past tenses.', by: 'Kru Napat Srisuk, Languages' },
  },
  'ev-104': {
    'Code on GitHub': { t: 'repo', repo: 'arunmehta/maze-py', about: 'My old Scratch maze game, rebuilt in Python to learn the syntax.', lang: [['Python', 100]], files: ['levels/', 'levels/level1.txt', 'levels/level2.txt', 'maze.py', 'README.md'],
      commits: [['Add level 2 and a move counter', 'Oct 22, 2024'], ['Read mazes from text files', 'Oct 19, 2024'], ['Fix: walls were walkable (missing colon!)', 'Oct 15, 2024'], ['First version: move with WASD', 'Oct 14, 2024']],
      readme: [['h', 'maze-py'], 'A text maze. `#` is a wall, `@` is you, `X` is the exit.', ['code', '##########\n#@   #   #\n# ## # # #\n#    #   X\n##########\n\nMove (w/a/s/d): d'], 'Rewriting this from Scratch taught me that Python cares about every colon.'] },
  },
  'ev-105': {
    'Band setlist': { t: 'doc', format: 'PDF', pages: 1, heading: 'NIST Jazz Band · Winter Concert setlist', sub: '2 December 2024 · Auditorium · 18:30', blocks: [
      ['table', ['#', 'Tune', 'Key', 'Solos'], [['1', 'Take the “A” Train', 'C', 'Tpt 1, Alto'], ['2', 'Blue Bossa', 'Cm', 'Tenor, Keys (Arun, 8 bars)'], ['3', 'Autumn Leaves', 'Gm', 'Trombone'], ['4', 'Cantaloupe Island', 'Fm', 'Keys (Arun, open), Drums'], ['5', 'Sing, Sing, Sing', 'Dm', 'Clarinet, Drums']]],
      ['note', 'Ms Marín (pencil note)', 'Arun: Dorian over Cantaloupe. Leave space! Two bars of rest are a phrase too.'] ] },
  },
  'ev-106': {
    'Play it': { t: 'web', url: 'example.org/pygame', site: 'Soi Cat: Flood Escape', blocks: [
      ['fig', 'Level 2: the flooded soi.', 'evidence/ev-106.svg'],
      'Help Mali the cat escape the rising water. Jump between motorbike seats, food carts and awnings. Collect fish for extra lives.',
      ['list', ['Arrow keys to move, space to jump', '3 levels and a boss (the street sweeper)', 'Original 8-bit soundtrack by me, made in a free tracker']],
      ['stats', [['Plays at code club', '37'], ['Best score', '12,840 (Ms Nair)']]] ] },
  },
  'ev-107': {
    'Fusion 360 file': { t: 'doc', format: 'Fusion 360 export', pages: 1, letterhead: false, heading: 'phone_stand_v4.f3d', sub: 'Exported drawing · PLA · 0.2 mm layers · 2 h 14 min print', blocks: [
      ['table', ['Version', 'Angle', 'Change', 'Why'], [['v1', '60°', 'First print', ''], ['v2', '70°', 'Steeper', 'Screen glare in v1'], ['v3', '70°', 'Wider base', 'Tipped over with a big phone'], ['v4', '68°', 'Cable slot, rounded edges', 'User testing: needed to charge while standing']]],
      ['fig', 'Side elevation, v4. Base 82 × 70 mm, cable slot 12 mm.'] ] },
    'User testing notes': { t: 'doc', format: 'Google Doc', heading: 'Phone stand: user testing', sub: '6 classmates · each used v3 for one school day', pages: 2, blocks: [
      ['table', ['Tester', 'Phone', 'Rating /5', 'Comment'], [['Ploy', 'iPhone 14', 4, 'Nice angle, but I need to charge it'], ['Tee', 'Samsung A54', 3, 'Wobbles when I type'], ['Mai', 'iPhone SE', 5, 'Perfect'], ['Jun', 'Pixel 8', 4, 'Cable has nowhere to go'], ['Kai', 'iPhone 15 Pro', 3, 'Edges a bit sharp'], ['Lena', 'Samsung S23', 4, 'Good for video calls']]],
      ['h', 'Changes for v4'], ['list', ['Cable slot through the base (3 of 6 asked).', 'Rounded all edges with a 2 mm fillet.', 'Angle down 2° to reduce wobble.']] ] },
  },
  'ev-108': {
    'Performance video': { t: 'video', title: '“La Vie en rose”, Francophonie Night 2025', dur: '3:21', views: '488', desc: 'Arun Mehta (Year 10), voice and piano, at the Francophonie evening in the school auditorium.', chapters: [['0:00', 'Introduction (en français)'], ['0:25', 'Verse'], ['1:40', 'Piano interlude'], ['2:20', 'Final chorus']] },
  },
  'ev-109': {
    'Arrangement score (PDF)': { t: 'doc', heading: 'Lao Duang Duean (ลาวดวงเดือน)', sub: 'Thai folk song, arranged for solo piano by Arun Mehta · 4 pages', pages: 4, blocks: [
      ['fig', 'Bars 1–8: the melody in the right hand over a pentatonic drone.'],
      ['h', 'Arranger’s note'], 'I kept the melody almost exactly as my grandmother sings it, but moved it between the hands so it sounds like two people answering each other. The middle section borrows a jazz left-hand voicing I learned in band.',
      ['table', ['Section', 'Bars', 'Idea'], [['Intro', '1–8', 'Drone in fifths, like a khaen'], ['A', '9–24', 'Melody in right hand'], ['B', '25–40', 'Melody moves to left hand, jazz voicings above'], ['A′', '41–56', 'Melody in octaves, slower'], ['Coda', '57–64', 'Fade on the drone']]] ] },
    'Concert recording': { t: 'audio', title: 'Spring Concert 2025', artist: 'NIST Music Department', year: 2025, tracks: [['Lao Duang Duean (arr. Arun Mehta)', '4:12']], desc: 'Recorded live in the auditorium, 12 May 2025.', colour: '#D6457F' },
  },
  'ev-110': {
    'DELF A2': { t: 'cert', org: 'France Éducation international (demo)', kind: 'Diplôme d’études en langue française', pre: 'Le diplôme DELF A2 est délivré à', line: 'Niveau A2 du Cadre européen commun de référence pour les langues.', award: 'Note globale : 78 / 100', sign: [['Le Directeur', 'France Éducation international']], seal: 'A2', colour: '#0055A4', no: 'DELF-A2-TH-25-03317' },
    'Score report': { t: 'result', system: 'Exam board', org: 'DELF A2 · Alliance Française Bangkok (demo)', course: 'DELF A2 · June 2025 session', task: 'Résultats', colA: 'Épreuve', rows: [['Compréhension de l’oral', 19, 25], ['Compréhension des écrits', 20, 25], ['Production écrite', 17, 25], ['Production orale', 22, 25]], grade: 'Admis', gradeLabel: 'Résultat', scale: 'Seuil de réussite : 50/100, minimum 5/25 par épreuve' },
  },
  'ev-111': {
    'Course certificate': { t: 'cert', org: 'Bangkok Music Production Academy (demo)', kind: 'Certificate', line: 'has completed the two-week Summer DAW Intensive: recording, MIDI, mixing, EQ and compression (30 hours).', sign: [['Nok Prasert', 'Course tutor']], seal: '♫', colour: '#A23B72' },
    'Course tracks': { t: 'audio', title: 'Summer DAW Intensive · final tracks', artist: 'Arun Mehta', year: 2025, tracks: [['Sukhumvit 6 AM', '2:48'], ['Tuk-Tuk Shuffle', '3:15']], desc: 'Both tracks recorded, programmed and mixed during the course. “Sukhumvit 6 AM” uses a field recording of the BTS platform.', colour: '#A23B72' },
  },
  'ev-112': {
    'Listen': { t: 'audio', title: 'Monsoon Loops', artist: 'Arun Mehta', year: 2025, host: 'NIST Music page', tracks: [['Afternoon Storm', '3:02'], ['Ferry Horn', '2:41'], ['Wet Soi', '3:30'], ['After the Rain', '4:05']], desc: 'A lo-fi EP built from field recordings of Bangkok rain and street sounds. Recorded and produced at home on a laptop and a borrowed microphone.', colour: '#3b5b8a' },
    'Track notes': { t: 'doc', format: 'Google Doc', heading: 'Monsoon Loops · track notes', sub: 'How each track was made', pages: 2, blocks: [
      ['table', ['Track', 'Tempo', 'Key', 'Field recording', 'Trick I am proud of'], [['Afternoon Storm', '78', 'D♭', 'Rain on the condo roof', 'Sidechained the rain to the kick'], ['Ferry Horn', '84', 'F', 'Chao Phraya express boat', 'Horn pitched into the chord'], ['Wet Soi', '72', 'A♭m', 'Motorbikes in the rain', 'Tape-stop on every 8th bar'], ['After the Rain', '68', 'E♭', 'Birds + dripping gutter', 'Piano recorded with the window open']]],
      'Mastered to −14 LUFS for streaming. Cover art by my sister.' ] },
  },
  'ev-113': {
    'MYP Design: 7': { t: 'result', course: 'MYP Year 11 Design', task: 'Ergonomic one-handed game controller', colA: 'MYP Design criterion', rows: [['A: Inquiring and analysing', 8, 8], ['B: Developing ideas', 7, 8], ['C: Creating the solution', 7, 8], ['D: Evaluating', 7, 8]], grade: 7, scale: 'MYP 1–7',
      comment: 'A genuinely client-centred project. Your interviews with Tee shaped every decision, and the working prototype is impressive.', by: 'Mr Tom Hale, Design' },
    'Design folio': { t: 'doc', heading: 'One-handed controller: design folio', sub: 'MYP Design · Year 11 · client: Tee (wrist injury) · 28 pages', pages: 28, blocks: [
      ['h', 'Design brief'], 'Design a game controller that Tee can use with his left hand only for at least six weeks while his right wrist heals.',
      ['h', 'Specification (extract)'], ['table', ['Requirement', 'How tested', 'Met?'], [['All buttons reachable without moving the wrist', 'Tee plays for 20 min', '✓'], ['Weight under 200 g', 'Kitchen scale: 164 g', '✓'], ['Works with the school PCs', 'USB HID test', '✓'], ['Costs under ฿900', 'Bill of materials: ฿740', '✓']]],
      ['fig', 'Cardboard mock-up v2 and the final 3D-printed shell.'],
      ['quote', '“I beat my brother at Mario Kart with my wrong hand.” — Tee, client feedback'] ] },
  },
  'ev-114': {
    'Commentary with feedback': { t: 'doc', heading: 'Commentaire : « La Ronde » de J.M.G. Le Clézio', sub: 'MYP French · Year 11 · 650 mots', pages: 3, blocks: [
      'Dans « La Ronde », Le Clézio raconte une course de mobylette qui finit en tragédie. Le narrateur reste à distance, comme une caméra, et cette froideur rend la fin encore plus choquante.',
      ['note', 'Kru Napat', 'Excellente idée, la caméra ! Développe avec un exemple précis du texte.'],
      'Les phrases courtes accélèrent le rythme au moment de la course : « Elles roulent. Le vent. Le soleil. » On a l’impression d’entendre le moteur.',
      ['note', 'Kru Napat', 'Très bonne analyse du rythme : tu écoutes le texte comme de la musique. Attention aux accords (« elles sont parties »).'],
      ['h', 'Note'], 'Critère B : 6/8 · Critère D : 6/8' ] },
  },
  'ev-115': {
    'Grade 6 certificate': pianoCert(6, 'Distinction', 132, 'P6-2511-61874'),
    'Examiner\'s mark sheet': markSheet(6, [['Piece A: J.S. Bach, Invention No. 8 in F', 27, 30], ['Piece B: Satie, Gymnopédie No. 1', 26, 30], ['Piece C: Autumn Leaves (arr.)', 28, 30], ['Scales and arpeggios', 18, 21], ['Sight-reading', 16, 21], ['Aural tests', 17, 18]], 'Distinction', 'A mature performance. The Bach was clear and buoyant, and the jazz standard showed real stylistic understanding and an assured rhythmic feel.'),
  },
  'ev-116': {
    'Course certificate': { t: 'cert', org: 'Unity Learn (demo)', kind: 'Certificate of Completion', line: 'has completed Unity Fundamentals: scenes, physics, triggers, prefabs and spatial audio (24 hours, 6 projects).', sign: [['Unity Learn', 'Online course']], seal: 'U', colour: '#222c37' },
  },
  'ev-117': {
    'Playable build': { t: 'web', url: 'example.org/rainfall', site: 'Rainfall · an adaptive-music game', blocks: [
      ['fig', 'The market level as the storm arrives.', 'evidence/rainfall-game.svg'],
      'Walk through a Bangkok market as the weather changes. The music changes with it: drizzle brings in the hand drums, a downpour brings in the low brass, and the sun returns with a solo piano.',
      ['stats', [['Music stems', '14'], ['Weather states', '5'], ['Levels', '3'], ['Build size', '86 MB']]],
      ['list', ['WebGL build, runs in Chrome or Edge', 'Headphones recommended']] ] },
    'Audio design document': { t: 'doc', heading: 'Rainfall: audio design document', sub: 'Arun Mehta · v1.3 · February 2026', pages: 9, blocks: [
      ['h', 'Concept'], 'The soundtrack is one piece in D Dorian at 92 bpm, split into 14 stems. The weather system sets a target “intensity” from 0 to 4, and the engine crossfades stems on the next bar line so changes are always in time.',
      ['table', ['Weather', 'Intensity', 'Stems playing'], [['Clear', 0, 'Piano, pad'], ['Cloudy', 1, '+ bass, light percussion'], ['Drizzle', 2, '+ hand drums, rain foley'], ['Rain', 3, '+ strings, khim ostinato'], ['Storm', 4, '+ low brass, taiko, thunder']]],
      ['code', '// AudioDirector.cs (extract)\nvoid OnWeatherChanged(int target) {\n    double nextBar = AudioSettings.dspTime + TimeToNextBar();\n    foreach (var stem in stems)\n        stem.FadeTo(stem.level <= target ? 1f : 0f, nextBar, fadeBars: 2);\n}'] ] },
  },
  'ev-118': {
    'Festival certificate': { t: 'cert', org: 'Bangkok Schools Jazz Festival 2026', kind: 'Second Place', pre: 'Awarded to', name: 'NIST Jazz Band', line: 'in the Senior Big Band category, with special mention for the keyboard solo in “Watermelon Man” (Arun Mehta).', award: '2nd of 11 bands', sign: [['Pornthip S.', 'Adjudicator'], ['Sofia Marín', 'Band director']], seal: '2', colour: '#D6457F' },
    'Festival recording': { t: 'audio', title: 'Bangkok Schools Jazz Festival 2026', artist: 'NIST Jazz Band', year: 2026, tracks: [['Watermelon Man', '5:44'], ['Blue Bossa', '4:10'], ['Moanin’', '5:02']], desc: 'Live recording, 8 March 2026. Arun’s 16-bar keyboard solo in “Watermelon Man” starts at 2:31.', colour: '#D6457F' },
  },
  'ev-119': {
    'Build plans': { t: 'doc', heading: 'Open-day arcade cabinet: build plans', sub: 'Arun Mehta, Jun P. & Ben K. · April 2026', pages: 6, blocks: [
      ['h', 'Cut list (18 mm MDF)'], ['table', ['Part', 'Qty', 'Size (mm)'], [['Side panel', 2, '1700 × 600'], ['Control deck', 1, '700 × 300'], ['Monitor shelf', 1, '700 × 450'], ['Base', 1, '700 × 600'], ['Back panel', 1, '1500 × 700']]],
      ['h', 'Electronics'], ['list', ['Raspberry Pi 4 (4 GB) running RetroPie', '24″ monitor (donated by IT)', '2 joysticks, 12 buttons, USB encoder', 'Speakers from the music department']],
      ['h', 'Budget'], ['stats', [['Wood and paint', '฿2,100'], ['Controls', '฿1,450'], ['Pi and cables', '฿2,600'], ['Total', '฿6,150']]] ] },
    'Games list': { t: 'web', url: 'example.org/arcade', site: 'Open Day Arcade · now playing', blocks: [
      ['table', ['Game', 'Made by', 'Plays'], [['Soi Cat: Flood Escape', 'Arun M. (Y11)', 84], ['Tuk-Tuk Rush', 'Jun P. (Y11)', 71], ['Canteen Chaos', 'Y8 code club', 58], ['Gecko Jump', 'Mia R. (Y9)', 44], ['Space Mangoes', 'Ben K. (Y11)', 33], ['Quiz Bowl', 'Y7 Computing', 22]]],
      ['stats', [['Total plays', '312'], ['High score wall', '41 names']]] ] },
  },
  'ev-120': {
    'MYP French: 6': { t: 'result', system: 'SIS', course: 'MYP Language Acquisition: French (Phase 4)', task: 'MYP eAssessment · on-screen examination', colA: 'Criterion', rows: [['A: Listening', 6, 8], ['B: Reading', 7, 8], ['C: Speaking', 7, 8], ['D: Writing', 5, 8]], grade: 6, scale: 'MYP 1–7 · externally moderated' },
  },
  'ev-121': {
    'Cue sheet': { t: 'sheet', file: 'The Tempest · sound cue sheet', tab: 'Cues', tabs: ['Cues', 'Patch list', 'Show notes'],
      cols: ['Cue', 'Act/Sc', 'Go on', 'Sound', 'Level', 'Fade'],
      rows: [['SQ 1', 'I.1', 'House lights out', 'Storm build: wind, rope creak, thunder', '−6 dB', '8 s in'], ['SQ 2', 'I.1', '“We split!”', 'Ship crack + wave hit', '0 dB', 'snap'], ['SQ 3', 'I.2', 'Miranda enters', 'Island ambience: birds, surf', '−18 dB', '10 s'], ['SQ 7', 'II.2', 'Caliban: “Be not afeard”', 'Music box + reverse cymbal', '−12 dB', '4 s'], ['SQ 14', 'IV.1', 'Masque begins', 'Harp + choir loop', '−10 dB', '6 s'], ['SQ 22', 'V.1', 'Prospero breaks staff', 'Silence (cut everything)', '—', 'snap']],
      foot: ['22 cues', '', '', '5 performances, 0 missed cues', '', ''] },
  },
  'ev-122': { 'Course outline': outline('IB Music HL · course outline 2026–28', 'Ms Sofia Marín', [['Y12', 'Exploring music in context; creating; performing', 'Portfolio of exploration'], ['Y12 T3', 'Experimenting with music', 'Experimentation report'], ['Y13', 'Presenting music; the contemporary music-maker (HL)', 'Collaborative project (HL)']], 'HL students complete a collaborative multimedia project. Arun has been approved to use music technology for his performing component.') },
  'ev-123': { 'Course outline': outline('IB Computer Science HL · course outline 2026–28', 'Ms Priya Nair', [['Y12 T1', 'Computer fundamentals, networks, databases', 'Unit tests'], ['Y12 T2–3', 'Computational thinking, OOP, algorithms', 'Problem sets'], ['Y13 T1', 'Machine learning (HL), IA development', 'Internal assessment (20%)'], ['Y13 T2', 'Case study and revision', 'Mock exams']], 'Internal assessment: a computational solution for a real client.') },
  'ev-124': { 'Course outline': outline('Spanish ab initio · course outline 2026–28', 'Languages department', [['Y12', 'Identities, experiences', 'Speaking and writing tasks'], ['Y12 T3', 'Human ingenuity', 'Reading test'], ['Y13', 'Social organisation, sharing the planet', 'Individual oral (25%)']], 'Ab initio is for beginners. By the end students can hold everyday conversations and write short texts.') },
  'ev-125': {
    'KiCad project': { t: 'repo', repo: 'arunmehta/pad16-midi', about: '16-pad velocity-sensitive MIDI controller, USB-C, RP2040.', lang: [['KiCad', 58], ['C++', 37], ['Shell', 5]], files: ['hardware/', 'hardware/pad16.kicad_pcb', 'hardware/pad16.kicad_sch', 'firmware/', 'firmware/main.cpp', 'gerbers/', 'BOM.csv', 'README.md'], commitCount: 57,
      commits: [['Gerbers for JLC order, rev C', 'Sep 28, 2026'], ['Move USB-C ESD diodes closer to connector', 'Sep 24, 2026'], ['Velocity curve: log instead of linear', 'Sep 15, 2026'], ['4×4 FSR matrix scanning at 1 kHz', 'Sep 2, 2026']],
      readme: [['h', 'pad16-midi'], 'A 16-pad MIDI controller I designed because the ones I could afford had no velocity sensitivity.', ['list', ['RP2040 microcontroller, USB-C, class-compliant MIDI (no drivers)', 'Force-sensitive resistor pads scanned at 1 kHz', '2-layer board, 120 × 120 mm']], ['h', 'Status'], 'Rev C boards ordered (5 pcs). Rev B worked except one shorted row; see issue #4.'] },
    'Bill of materials': { t: 'sheet', file: 'BOM.csv', app: 'CSV', tab: 'BOM',
      cols: ['Ref', 'Part', 'Package', 'Qty', 'Unit (฿)', 'Total (฿)'],
      rows: [['U1', 'RP2040', 'QFN-56', 1, 38, 38], ['U2', 'W25Q16 flash', 'SOIC-8', 1, 14, 14], ['J1', 'USB-C receptacle', 'SMD', 1, 12, 12], ['FSR1–16', 'FSR pad 20 mm', 'custom', 16, 45, 720], ['D1–2', 'ESD protection', 'SOT-23', 2, 6, 12], ['Y1', '12 MHz crystal', '3225', 1, 9, 9], ['C, R', 'passives', '0603', 34, 0.5, 17], ['PCB', '2-layer board', '120 × 120', 1, 90, 90]],
      foot: ['', '', '', '', 'Total', 912] },
  },
  'ev-126': {
    'Score and audio draft': { t: 'audio', title: 'Afternoon, Window (draft 1)', artist: 'Arun Mehta', year: 2026, tracks: [['Afternoon, Window, for piano and electronics', '3:04']], desc: ['IB Music HL composition, first draft. The electronics are recordings from my bedroom window, processed in real time and triggered by the pianist with a foot pedal.', ['note', 'Ms Marín', 'Lovely opening. The middle section loses direction; what is the piano doing that the window cannot?']], colour: '#A23B72' },
  },
  'ev-127': {
    'Criterion B: 5/8': { t: 'result', course: 'Spanish ab initio', task: 'Oral 1: presentarme a mí y a mi familia', rows: [['B: Message', 5, 8]], noTotal: true, grade: '5/8', gradeLabel: 'Criterion B', comment: '¡Muy bien para la primera! Clear and confident. Use more connectors (también, pero, porque) to link your ideas.', by: 'Languages department' },
  },
  'ev-128': {
    'Practice plan': { t: 'sheet', file: 'Grade 8 piano · practice plan', tab: 'Weekly',
      cols: ['Day', 'Scales (min)', 'Piece A: Bach Prelude & Fugue', 'Piece B: Chopin Nocturne', 'Piece C: jazz own-choice', 'Sight-reading'],
      rows: [['Mon', 10, 'Fugue bars 1–24 hands separate', '', '', '5 min'], ['Tue', 10, '', 'Pedalling, bars 1–16', 'Lead sheet: Stella by Starlight', ''], ['Wed', 10, 'Prelude, slow', '', '', '5 min'], ['Thu', 10, '', '', 'Comping + solo chorus', '5 min'], ['Fri', 'Off', 'Off', 'Off', 'Off', 'Off'], ['Sat', 15, 'Run-through', 'Run-through', 'Run-through', '10 min'], ['Sun', 10, '', 'Record and listen back', '', '']],
      note: 'Exam June 2027. Lessons fortnightly with Ms Marín.' },
  },
  'ev-129': {
    'IA idea notes': { t: 'doc', format: 'Notebook', heading: 'CS IA idea: procedural music engine', sub: 'Notes for Ms Nair · October 2026', pages: 2, blocks: [
      ['h', 'Client'], 'Jun, who makes Unity games at code club and cannot afford music.',
      ['h', 'Idea'], 'A tool that reads a level file (length, danger zones, boss) and generates a soundtrack: chord progression, tempo map and stems, exported as MIDI.',
      ['list', ['Markov chain for chord progressions, trained on 40 game tracks I have transcribed', 'Tempo rises near danger zones', 'Export: MIDI + a JSON tempo map for Unity']],
      ['note', 'Ms Nair', 'Strong idea with a real client. Keep the scope small: start with chords and tempo only.'] ] },
  },
  'ev-130': {
    'University shortlist': { t: 'sheet', file: 'University shortlist · Arun Mehta', tab: 'Shortlist',
      cols: ['University', 'Course', 'Country', 'Audition/portfolio', 'Why'],
      rows: [['University A', 'BMus Music Technology', 'UK', 'Portfolio + interview', 'Studios + programming modules'], ['University B', 'BSc Music & Computer Science', 'UK', 'Portfolio', 'Joint degree'], ['University C', 'BMus Music Production', 'Netherlands', 'Audition', 'Game-audio track'], ['University D', 'BA Music Technology', 'USA', 'Portfolio', 'Interactive media minor']],
      note: 'Planned with Ms Adeyemi. Build portfolio: EP, Rainfall, Tempest sound design, PCB.' },
  },
};
