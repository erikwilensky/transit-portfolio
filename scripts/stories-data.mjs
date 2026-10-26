// Real stories for the cohort students (Kai, Noor, Ploy, Mateo, Sienna), who were seeded
// with placeholder stations. Applied by scripts/stories.mjs; images drawn by illustrations.mjs.
// img: [template, caption, args] draws evidence/<id>.svg; ['@name', caption] reuses an existing drawing.
const SC = '#4F529B', CO = '#0072CE', EN = '#008A60', SP = '#FFB81C', SV = '#E73C3E', MU = '#D6457F', DE = '#1FA3A8', LA = '#FF8F1C', AR = '#8A5A44';
const f = (caption) => ['file', caption];
const l = (url, caption) => ['link', caption, url];
const c = (caption) => ['certificate', caption];
const g = (caption) => ['grade', caption];

export const STORIES = {
  // ── Kai Tanaka, Year 12 (climbing, sciences, service; robotics from the CS seed) ──────────
  'ev-300': { title: 'Reading buddies with Year 4', type: 'service', lines: ['service'], sys: ['CAS log', 'sa-y10-rb'],
    summary: 'Read with two Year 4 boys every Thursday lunchtime for a term.',
    about: 'Kai read with two Year 4 boys in the primary library every Thursday lunchtime for a term. Neither liked reading, so he started with football magazines and comics, and by the end both had finished a chapter book.',
    img: ['tutor', 'Thursday lunchtime in the primary library', { text: 'Chapter 6!', c: SV }], add: [f('Reading log, Term 2')],
    refl: ['What worked?', 'Letting them choose. When I brought the books I thought were good, they stared out of the window. When they chose football magazines, they read the match reports out loud to each other.'] },
  'ev-301': { title: 'Reflection: am I a science person?', lines: ['science'],
    summary: 'End-of-term reflection on choosing between the sciences.',
    about: 'A reflection written for Kai’s advisor in Year 10, when he was deciding which sciences to keep for the Diploma.',
    refl: ['Term check-in', `I always said I was “not a science person” because I am slow at memorising. This term I noticed that the parts of science I like are the experiments where something goes wrong and you have to work out why.

In the chemistry practical my titration kept overshooting. Instead of starting again I timed how long each drop took and worked out I was going too fast near the end point. Ms Lim said that is literally what chemists do.

So maybe I am a science person, just not a memorising person. I want to keep Physics and Chemistry and see if that holds.`] },
  'ev-302': { title: 'Animal shelter weekends', type: 'service', lines: ['service'], sys: ['CAS log', 'sa-y10-dogs'],
    summary: 'Walked and socialised dogs at a shelter in Bang Na on Saturday mornings.',
    about: 'Kai volunteered at a dog shelter in Bang Na on Saturday mornings for three months, walking and socialising dogs that were nervous of people so that they could be rehomed. Eleven of “his” dogs found homes.',
    img: ['forest', 'Saturday walk with Lucky', { c: SV, text: 'Saturday walks' }], add: [f('Volunteer hours sheet')],
    refl: ['What did the shelter teach you?', 'Patience. Some dogs took four Saturdays before they would walk next to me. You cannot rush trust, with dogs or with people.'] },
  'ev-303': { title: 'Chemistry titration lab', type: 'assessment', lines: ['science'], sys: ['ManageBac', 'y11-chem-t1'],
    summary: 'Acid–base titration practical; 6/8 on criterion B.',
    about: 'A Year 11 Chemistry practical: finding the concentration of an unknown sodium hydroxide solution by titration with hydrochloric acid. Kai planned the method himself and repeated until three titres agreed within 0.10 cm³.',
    img: ['paper', 'Titration results table', { title: 'Titration: NaOH', mark: '6/8', c: SC }], add: [g('MYP criterion B: 6/8'), f('Lab report (PDF)')] },
  'ev-304': { title: 'Biology field study: Bang Krachao', type: 'project', lines: ['science'], sys: ['ManageBac', 'y11-bio-fs'],
    summary: 'Kick-sampled stream invertebrates to compare water quality at three sites.',
    about: 'A Year 11 Biology field day in Bang Krachao, the green “lung” across the river. Kai’s group kick-sampled freshwater invertebrates at three sites and used a biotic index to compare water quality upstream and downstream of a market.',
    img: ['forest', 'Kick-sampling at site 2', { c: SC, text: 'Bang Krachao, site 2' }], add: [f('Field data sheet')] },
  'ev-305': { title: 'Physics pendulum investigation', type: 'assessment', lines: ['science'], sys: ['ManageBac', 'y11-phy-pend'],
    summary: 'Tested how length affects period; 7/8 on criterion C.',
    about: 'An independent Physics investigation into how the length of a pendulum affects its period. Kai measured 10 lengths with five repeats each, plotted T² against L and used the gradient to estimate g as 9.78 m s⁻².',
    img: ['chart', 'T² against length', { title: 'T² vs L', vals: [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1], c: SC, kind: 'line', note: 'Gradient → g = 9.78 m/s²' }], add: [g('Criterion C: 7/8'), f('Investigation report')] },
  'ev-306': { title: 'Light-gate timer for the physics lab', type: 'project', lines: ['science', 'computing'], sys: ['Manual entry', 'self'], verif: 'student-added',
    summary: 'Built an Arduino light gate so pendulum timings no longer depend on a stopwatch.',
    about: 'After the pendulum investigation Kai built a light gate from an infrared LED, a phototransistor and an Arduino, so the physics department could time swings to the millisecond. The department now uses two of them in Year 10 practicals.',
    img: ['workshop', 'Light gate on the pendulum stand', { title: 'Light gate v2', c: CO }], add: [l('https://example.org/lightgate', 'Code on GitHub')],
    refl: ['Why build it?', 'My biggest error in the pendulum work was me. My thumb on the stopwatch. I wanted to see what the data looked like without me in it, and the scatter almost disappeared.'] },
  'ev-307': { title: 'Climbing club', type: 'sport', lines: ['sport'], sys: ['Clubs & Sports', 'climb-sr'],
    summary: 'Joined the bouldering club; climbing V4 by the end of term.',
    about: 'Kai joined the senior climbing club, which trains twice a week on the school wall and once a month at a bouldering gym in Ekkamai. He started at V1 and was climbing V4 problems by the end of the term.',
    img: ['@climb', 'Working a V4 on the school wall'], add: [f('Grade progression log')],
    refl: ['What do you like about climbing?', 'Every problem is a puzzle you solve with your body. I fall off the same move twenty times, then one day it just works.'] },
  'ev-308': { title: 'Started IB Physics HL', type: 'class', lines: ['science'], sys: ['SIS', 'enrol-phy-hl'],
    summary: 'Depot: IB Physics HL.',
    about: 'Kai began IB Physics at Higher Level, alongside Chemistry SL and Computer Science HL, after the pendulum investigation convinced him to keep it.',
    img: ['depot', 'IB Physics HL', { text: 'Physics HL', sub: 'Year 12', c: SC }], add: [f('Course outline')] },

  // ── Noor Haddad, Year 13 (languages, art, service, environment) ──────────────────────
  'ev-309': { title: 'Thai poetry recital', type: 'competition', lines: ['languages'], sys: ['ManageBac', 'y10-thai-day'],
    summary: 'Recited an extract from Sunthorn Phu at Thai Language Day.',
    about: 'At Thai Language Day in Year 10, Noor recited an extract from Sunthorn Phu’s Phra Aphai Mani in the traditional chanted style, after six weeks of coaching from Kru Napat. She was the only non-native speaker to reach the final.',
    img: ['stage', 'Thai Language Day final', { text: 'วันภาษาไทย', c: LA, n: 1 }], add: [l('https://example.org/thai-day', 'Recital video'), f('Poem with my annotations')],
    end: ['t-05', 'Noor’s rhythm and tone were excellent. She practised the chanting until it sounded natural, not memorised.'] },
  'ev-310': { title: 'Reflection: three languages, one sketchbook', lines: ['art'],
    summary: 'Term reflection on drawing in Arabic, Thai and English.',
    about: 'A Year 10 term reflection for Noor’s advisor about the sketchbook she keeps in three scripts.',
    refl: ['Term check-in', `My sketchbook is the only place where my three languages sit on the same page. I write notes in English, label things in Thai because that is how I learned them at the market, and when I am upset I write in Arabic because that is the language my grandmother used.

This term Ms Sato asked why the Arabic always curls around the edges of my drawings. I had not noticed. I think the letters are doing what the drawing cannot: holding the feeling.

I want to try making a piece where the writing is the drawing.`] },
  'ev-311': { title: 'Portrait series: Faces of Soi 31', type: 'project', lines: ['art'], sys: ['ManageBac', 'y11-art-port'],
    summary: 'Six charcoal portraits of older neighbours, each with their own words.',
    about: 'For a Year 11 Visual Arts unit Noor drew six charcoal portraits of older people on her soi: a noodle seller, a motorbike-taxi driver, the man who fixes umbrellas. She recorded a sentence from each in their own language and lettered it under the portrait.',
    img: ['@sketchbook', 'Portrait 4: Khun Sompong'], add: [f('Artist statement')],
    refl: ['What did you notice drawing strangers?', 'Everyone wanted to know what I would do with the drawing. When I said it would hang in a school, two of them asked me to make them look younger. I didn’t.'] },
  'ev-312': { title: 'Reflection: what the canal looks like up close', lines: ['environment'],
    summary: 'Reflection after sketching Khlong Saen Saep for the printmaking unit.',
    about: 'A Year 11 reflection written after a sketching trip to Khlong Saen Saep.',
    refl: ['Term check-in', `We went to sketch the canal boats and I ended up drawing the rubbish instead. Polystyrene boxes, flip-flops, a whole fridge door caught on a pillar.

I thought art about the environment had to be a poster with a sad turtle. Drawing the canal properly, for two hours, made me angrier than any poster has.

I don’t know yet if that anger is useful. I want to find out how to make people look for longer, the way I had to.`] },
  'ev-313': { title: 'Printmaking workshop', type: 'club', lines: ['art'], sys: ['Clubs & Sports', 'art-print-w'],
    summary: 'Three-day linocut workshop at a print studio in Charoen Krung.',
    about: 'A three-day linocut workshop at a print studio in Charoen Krung during the December break. Noor carved a three-colour reduction print of a canal boat from her sketches and printed an edition of twelve.',
    img: ['workshop', 'Reduction print, third colour', { title: 'Linocut: canal boat', c: AR }], add: [f('Print edition record')] },
  'ev-314': { title: 'Reflection: listening before helping', lines: ['service'],
    summary: 'Reflection on the first term at the homework club.',
    about: 'A Year 11 reflection for Noor’s CAS adviser after her first weeks at a community homework club.',
    refl: ['Term check-in', `I joined the homework club because I speak Arabic and they needed someone who did. On my first day I tried to explain fractions to a boy called Yusuf and he would not look at me.

The coordinator told me to stop explaining and ask him what he already knew. It turned out he knew fractions perfectly in Arabic; he just had never heard the English words. We made a three-column word list, Arabic, Thai, English, and now he teaches the other kids.

I came to help, but most of the help was me learning to listen first.`] },
  'ev-315': { title: 'Homework club at a community learning centre', type: 'service', lines: ['service', 'languages'], sys: ['CAS log', 'cas-hw-club'],
    summary: 'Helped Arabic-speaking children with homework every Saturday for two terms.',
    about: 'Every Saturday for two terms Noor volunteered at a community learning centre in Bangkok, helping Arabic-speaking children aged 8–12 with English and maths homework. She made a trilingual word list that the centre now gives every new volunteer.',
    img: ['tutor', 'Saturday homework club', { text: 'كسر = เศษส่วน', c: SV }], add: [f('Session log'), f('Trilingual maths word list')],
    end: ['t-08', 'Noor’s word list changed how the centre welcomes children. A real, lasting contribution.'] },
  'ev-316': { title: 'Reflection: end of Year 11', lines: ['service'],
    summary: 'End-of-year reflection before starting the Diploma.',
    about: 'A reflection written at the end of Year 11 for Noor’s advisor, Mr Whitfield.',
    refl: ['Term check-in', `Looking back at this year, everything I am proud of involved more than one language: the Thai recital, the portraits, the homework club word list.

I used to think of my languages as a problem to manage, a different self for each one. This year they felt like a set of tools.

For the Diploma I want to take English A Literature, keep Thai and do Visual Arts HL. I would like my Extended Essay to be about writers who live between languages too.`] },
  'ev-317': { title: 'Exhibition piece: “Letters Home”', type: 'project', lines: ['art', 'languages'], sys: ['ManageBac', 'y12-va-exh'],
    summary: 'Mixed-media piece of layered Arabic and Thai script, shown in the Year 12 exhibition.',
    about: 'For the Year 12 group exhibition Noor made “Letters Home”, a 1.2 m mixed-media piece of layered tracing paper. Her grandmother’s letters in Arabic sit under Noor’s replies in Thai, so neither can be read on its own.',
    img: ['@mural', '“Letters Home”, installed'], add: [f('Exhibition label and statement'), l('https://example.org/letters-home', 'Exhibition walkthrough video')],
    end: ['t-06', 'The most ambitious piece in the show. Noor found a visual form for an idea most artists only write about.'] },
  'ev-318': { title: 'Reflection: making art about exile', lines: ['art'],
    summary: 'Summer reflection linking her art to the Extended Essay.',
    about: 'A reflection written over the summer before Year 13, connecting Noor’s art to her Extended Essay on exile poetry.',
    refl: ['Term check-in', `Reading Mahmoud Darwish for my Extended Essay, I recognised the feeling in “Letters Home”: a home that exists mostly in language.

My grandmother left Jaffa as a child and never went back. I have never been. But I have her handwriting, and that turned out to be enough to make something honest.

I am nervous that my art and my essay are too close, that I keep telling the same story. Ms Sato says that is called having a subject.`] },
  'ev-319': { title: 'CAS: community art workshop series', type: 'service', lines: ['service', 'environment', 'art'], sys: ['CAS log', 'cas-comm-art'],
    summary: 'Ran six printmaking workshops for families using recycled materials.',
    about: 'Noor’s CAS project: six Saturday workshops at the community learning centre where families made prints from recycled packaging, polystyrene trays and bottle caps. 46 children and parents took part, and the prints were shown at the centre’s open day.',
    img: ['board', 'Workshop 4: polystyrene prints', { lines: ['Print with what you throw away', 'Saturday 10:00 · all ages'], c: SV, n: 5 }], add: [f('Workshop plan'), f('CAS project report')],
    end: ['t-08', 'A complete CAS project: Noor planned, ran, adapted and evaluated it herself.'] },

  // ── Ploy Chaiyaporn, Year 11 (music, design, football) ───────────────────────────────
  'ev-320': { title: 'Songwriting project: “Ferry at Six”', type: 'assessment', lines: ['music'], sys: ['ManageBac', 'y10-mus-song'],
    summary: 'First song for MYP Music, about the evening ferry; 7/8 on criterion C.',
    about: 'For a Year 10 Music unit Ploy wrote and recorded “Ferry at Six”, a verse–chorus song about taking the Chao Phraya ferry home with her grandmother. She sang, played guitar and layered a second vocal harmony.',
    img: ['daw', 'Recording session', { title: 'Ferry at Six — final mix', c: MU }], add: [g('MYP Music criterion C: 7/8'), f('Lyrics and chord chart'), l('https://example.org/ferry', 'Recording')] },
  'ev-321': { title: 'Reflection: the youngest on the team', lines: ['sport'],
    summary: 'First-term reflection on joining the U16 girls’ football team.',
    about: 'A reflection written for Ploy’s advisor after her first half-term on the U16 girls’ team.',
    refl: ['Term check-in', `I am the youngest on the team and for the first month I said nothing in the huddle. I just ran where people pointed.

Then in the match against the league leaders the captain asked me why I kept drifting inside. I said because their winger always cuts in. She told me to say that out loud next time.

Now I call it when I see it. Being young does not mean I can’t see the game.`] },
  'ev-322': { title: 'Football: U16 girls’ season', type: 'sport', lines: ['sport'], sys: ['Clubs & Sports', 'fb-u16g-25'],
    summary: 'Started as a substitute and finished the season at left back.',
    about: 'Ploy joined the U16 girls’ football team in Year 10. She started the season as a substitute and played every minute of the last six league matches at left back. The team finished third in the Bangkok schools league.',
    img: ['@football', 'League match, left back'], add: [f('Season stats')],
    end: ['t-07', 'Ploy earned her place through reading the game, not just effort. Coaches noticed her organising the back line by mid-season.'] },
  'ev-323': { title: 'Reflection: writing songs in Thai or English?', lines: ['music'],
    summary: 'Reflection on which language her songs come out in.',
    about: 'A Year 10 reflection on songwriting, written for Ploy’s Music teacher and advisor.',
    refl: ['Term check-in', `When I wrote “Ferry at Six” I tried English first because the songs I listen to are in English. The words were fine but they felt like someone else’s.

The chorus only worked when I switched to Thai, because the ferry is a Thai place and my grandmother speaks Thai. Ms Marín said the Thai tones also changed my melody, and when I listened back she was right.

Next I want to try one song that moves between both, like we do at home.`] },
  'ev-324': { title: 'Choir concert and poster', type: 'club', lines: ['music', 'design'], sys: ['Clubs & Sports', 'choir-feb26'],
    summary: 'Sang alto in the February concert and designed its poster.',
    about: 'Ploy sang alto in the senior choir’s February concert and designed the concert poster, which was printed for the whole school and used on the school’s social media.',
    img: ['stage', 'February choir concert', { text: 'Senior Choir', c: MU, n: 4 }], add: [f('Concert poster'), l('https://example.org/choir-feb', 'Concert recording')] },
  'ev-325': { title: 'Reflection: the match I didn’t play', lines: ['sport'],
    summary: 'Reflection on being dropped for the cup quarter-final.',
    about: 'A reflection Ploy wrote after she was left out of the cup quarter-final.',
    refl: ['Term check-in', `I was dropped for the quarter-final and I was angry for two days. I had played every league game.

The coach explained that the other team had a very fast striker and she wanted Mai, who is quicker than me. We lost 2–1 anyway, and Mai was brilliant.

What I learned is that the team picks for the match, not to reward you. I have started doing sprint training on Saturdays.`] },
  'ev-326': { title: 'App mock-up for a client', type: 'project', lines: ['design'], sys: ['ManageBac', 'y10-des-app'],
    summary: 'Designed a practice-room booking app for the music department.',
    about: 'For a Year 10 Design unit Ploy interviewed Ms Marín about how students book practice rooms (a paper sheet on the door) and designed a mobile booking app prototype in Figma. She tested it with eight students and redesigned the calendar view twice.',
    img: ['code', 'Booking screen, version 3', { title: 'Practice Rooms · Figma', lines: ['Room 2 · Piano', 'Today 12:10–12:50', '✓ Booked by Ploy', 'Room 3 · Drums', 'Free after 15:30'], c: DE }],
    add: [g('MYP Design criterion B: 7/8'), l('https://example.org/rooms-figma', 'Figma prototype'), f('Client interview notes')] },
  'ev-327': { title: 'Reflection: end of Year 10', lines: ['music'],
    summary: 'End-of-year reflection across music, design and football.',
    about: 'An end-of-Year-10 reflection for Ploy’s advisor.',
    refl: ['Term check-in', `This year I did three things I had never done: wrote a song, designed an app and played competitive football.

They feel different, but I noticed they all start the same way, with listening. Listening to the ferry for the song, to Ms Marín for the app, to the captain on the pitch.

Next year I want to take Design further and maybe make the booking app real. My sister Pim starts Year 7, so I also want to help her find her clubs.`] },
  'ev-328': { title: 'Lamp design project', type: 'project', lines: ['design'], sys: ['ManageBac', 'y11-des-lamp'],
    summary: 'Year 11 Design: a bamboo pendant lamp, now in prototyping.',
    about: 'Ploy’s Year 11 Design project is a pendant lamp made from bamboo strips, inspired by fish traps from her grandfather’s village in Ayutthaya. She has tested three weaves for light pattern and strength and is building a full-size prototype.',
    img: ['@lamp', 'Weave test 3 under the light'], add: [f('Design folio (in progress)')] },
  'ev-306a': { add: [f('Match report'), l('https://example.org/semi', 'Match highlights')] },

  // ── Mateo Ruiz, Year 13 (computing, football, science) ───────────────────────────────
  'ev-329': { title: 'Year 10 CS: algorithms unit', type: 'assessment', lines: ['computing'], sys: ['ManageBac', 'y10-cs-alg'],
    summary: 'Built a sorting visualiser in Python; 7/8 on criterion B.',
    about: 'In the Year 10 algorithms unit Mateo implemented bubble, insertion and merge sort in Python and built a turtle-graphics visualiser that animates each one, then timed them on lists of up to 10,000 items.',
    img: ['code', 'Merge sort, mid-animation', { title: 'sort_vis.py', lines: ['def merge_sort(xs):', '    if len(xs) <= 1:', '        return xs', '    mid = len(xs) // 2', '    left = merge_sort(xs[:mid])'], c: CO }],
    add: [g('MYP criterion B: 7/8'), l('https://example.org/sortvis', 'Code on GitHub')] },
  'ev-330': { title: 'Reflection: why I like making things faster', lines: ['computing'],
    summary: 'Year 10 reflection on what draws him to algorithms.',
    about: 'A Year 10 reflection for Mateo’s advisor about the algorithms unit.',
    refl: ['Term check-in', `The moment I liked most this term was watching merge sort finish 10,000 numbers before bubble sort had done the first 500. Same computer, same numbers, completely different idea.

I like football for the same reason, honestly. Two teams with the same players, and the one with the better idea wins.

I want to find out why some ideas are faster. Ms Nair said that is called complexity theory and lent me a book. It is hard but I have read four chapters.`] },
  'ev-331': { title: 'Science fair: does music tempo change running pace?', type: 'competition', lines: ['science', 'sport'], sys: ['ManageBac', 'y11-scifair'],
    summary: 'Tested 12 teammates running to music at three tempos; Bronze.',
    about: 'For the Year 11 science fair Mateo had 12 teammates run 800 m three times, listening to music at 120, 150 and 180 beats per minute, with a GPS watch recording pace and cadence. Cadence followed tempo closely; pace barely changed. The project won Bronze.',
    img: ['chart', 'Cadence against music tempo', { title: 'Cadence vs tempo', vals: [.45, .62, .83], c: SC, note: '120 · 150 · 180 bpm' }], add: [f('Science fair poster (PDF)'), f('Run data')] },
  'ev-332': { title: 'Football passing networks in Python', type: 'project', lines: ['computing', 'sport'], sys: ['Manual entry', 'self'], verif: 'student-added',
    summary: 'Logged every pass in five of his team’s matches and drew the network.',
    about: 'Mateo logged every pass in five of the U18 boys’ matches from video, then used Python and networkx to draw passing networks. They showed the team relied on one central midfielder, and the coach changed the formation for the next match.',
    img: ['chart', 'Passes by player, match 3', { title: 'Passes per player', vals: [.3, .55, .95, .5, .4, .62, .35], c: CO }], add: [l('https://example.org/passnet', 'Notebook on GitHub'), f('Write-up for the coach')] },
  'ev-333': { title: 'IB Biology SL: osmosis lab', type: 'assessment', lines: ['science'], sys: ['ManageBac', 'dp-bio-osm'],
    summary: 'Potato cylinders in sucrose solutions; first Diploma lab report.',
    about: 'Mateo’s first IB Biology lab report: he measured the mass change of potato cylinders in six sucrose concentrations to estimate the water potential of potato tissue.',
    img: ['paper', 'Osmosis results', { title: 'Osmosis in potato', mark: '6', c: SC }], add: [g('IB Biology SL: 6'), f('Lab report')] },
  'ev-334': { title: 'Reflection: end of Year 12', lines: ['science'],
    summary: 'Year 12 reflection, and admitting CAS has stalled.',
    about: 'An end-of-Year-12 reflection for Mateo’s advisor.',
    refl: ['Term check-in', `Academically this year went well. The library app is nearly done and my EE question on GPU sorting finally makes sense.

The honest part: I have not started my CAS project. Every idea I had was “teach people to code”, and I kept putting it off because it felt like homework.

Mr Whitfield asked what I would do if nobody was marking it. The answer is football, with younger kids. So that is the plan for September.`] },
  'ev-335': { title: 'Summer research placement: GPU lab', type: 'project', lines: ['computing', 'science'], sys: ['Manual entry', 'self'], verif: 'student-added',
    summary: 'Two weeks in a university parallel-computing lab, benchmarking sorts on a GPU.',
    about: 'A two-week summer placement in a university parallel-computing lab in Bangkok. Mateo benchmarked radix sort and bitonic sort on a GPU against a CPU baseline, the data that became the starting point for his Extended Essay.',
    img: ['chart', 'GPU vs CPU sort time', { title: 'Sort time (ms), 10M keys', vals: [.95, .42, .18], c: CO, note: 'CPU quicksort · GPU bitonic · GPU radix' }], add: [c('Placement certificate'), f('Placement report')] },
  'ev-336': { title: 'Library reservation web app', type: 'project', lines: ['computing'], sys: ['ManageBac', 'dp-cs-ia'],
    summary: 'A web app the library now uses to reserve and renew books.',
    about: 'For his IB Computer Science internal assessment Mateo built a web app for the school library: students reserve books, get a LINE message when they are ready and renew from their phones. The library has used it since August, with 640 reservations so far.',
    img: ['code', 'Reservation screen', { title: 'library-app · reserve.js', lines: ['async function reserve(bookId) {', '  const r = await api.post(`/reserve/${bookId}`)', '  notify(r.student, "Ready to collect")', '}'], c: CO }],
    add: [l('https://example.org/library', 'Live app'), l('https://example.org/library-src', 'Source code'), f('Librarian feedback')],
    end: ['t-01', 'A real client, a real deployment and real users. Exactly what the IA should be.'] },
  'ev-337': { title: 'IB CS: algorithms problem sets', type: 'assessment', lines: ['computing'], sys: ['ManageBac', 'dp-cs-ps'],
    summary: 'Year 13 algorithms unit: graph search and dynamic programming.',
    about: 'Year 13 Computer Science HL unit on graph algorithms and dynamic programming. Mateo scored full marks on the timed implementation task and helped run the revision session for the SL class.',
    img: ['code', 'Dijkstra, timed task', { title: 'ps4_dijkstra.py', lines: ['dist = {v: inf for v in G}', 'dist[src] = 0', 'pq = [(0, src)]', 'while pq:', '    d, u = heappop(pq)'], c: CO }], add: [g('Problem set 4: 20/20')] },

  // ── Sienna Okoye, Year 12 (marine science, environment, service, art) ─────────────────
  'ev-338': { title: 'Underwater sketchbook', type: 'project', lines: ['art', 'science'], sys: ['Manual entry', 'self'], verif: 'student-added',
    summary: 'Ink drawings of reef fish from aquarium visits and snorkelling trips.',
    about: 'Over Year 10 Sienna filled a sketchbook with ink-and-wash drawings of reef fish, sketched at the aquarium and from memory after snorkelling. Each page has the species’ common, Thai and Latin names.',
    img: ['@sketchbook', 'Page 12: blue-ringed angelfish'], add: [f('Sketchbook scans')] },
  'ev-339': { title: 'Reflection: the bleached reef', lines: ['environment'],
    summary: 'Reflection after seeing coral bleaching on a family trip.',
    about: 'A reflection Sienna wrote for her advisor after a family snorkelling trip in Year 10.',
    refl: ['Term check-in', `Last year the reef off Koh Tao was full of colour. This April it was white, like bones. Our guide said the water had been 31 degrees for three weeks.

I cried in the boat, which was embarrassing. Then I asked the guide how they knew it was 31 degrees, and he said they didn’t really, someone had a thermometer on a string.

That stuck with me. If nobody is measuring properly, how do we know what is happening? I think that is the question I want to work on.`] },
  'ev-340': { title: 'Charity run organiser', type: 'service', lines: ['service'], sys: ['CAS log', 'sa-y10-run'],
    summary: 'Organised a 5 km fun run that raised ฿86,400 for a marine rescue centre.',
    about: 'Sienna organised a 5 km fun run around the school field and the neighbouring park. 212 runners took part and the event raised ฿86,400 for a marine animal rescue centre. She wrote the risk assessment, recruited 18 marshals and ran registration.',
    img: ['board', 'Start line, 7:00', { lines: ['Run for the Reef · 5 km', '212 runners · ฿86,400 raised'], c: SV, n: 5 }], add: [f('Budget and donations'), f('Risk assessment')],
    end: ['t-08', 'Sienna handled every part of this herself, including a difficult conversation with the park office. Superbly organised.'] },
  'ev-341': { title: 'Reflection: why marine biology', lines: ['science'],
    summary: 'Summer reflection on choosing a direction.',
    about: 'A reflection written over the summer before Year 11.',
    refl: ['Term check-in', `People keep asking what I want to be. This summer I worked it out, or at least the first part: I want to be the person with the proper thermometer.

Marine biology is half diving and half data. I love the diving. I am less sure about the data, but I am starting Computer Science in September partly because of it.

The run showed me I can organise people. Now I want to organise numbers too.`] },
  'ev-342': { title: 'Plastic-free week campaign', type: 'project', lines: ['environment', 'service'], sys: ['ManageBac', 'eco-pfw-25'],
    summary: 'Led a canteen plastic-free week; single-use plastic fell by 71%.',
    about: 'With the eco-committee Sienna ran a plastic-free week in the canteen: reusable cups, a container deposit scheme and a waste audit before and after. Single-use plastic collected from the canteen fell from 38 kg to 11 kg, and the canteen kept the cup scheme.',
    img: ['@beach-cleanup', 'Waste audit, Friday'], add: [f('Campaign plan'), f('Waste audit before and after')] },
  'ev-343': { title: 'Reflection: what the campaign changed', lines: ['service'],
    summary: 'Reflection on what lasted after plastic-free week.',
    about: 'A reflection written for Sienna’s CAS adviser in January of Year 11.',
    refl: ['Term check-in', `The headline number was great: 71% less plastic. But two weeks later most of it came back.

The thing that lasted was the cup scheme, and that was the one part the canteen staff designed, not us. They know the queue, we don’t.

Next time I will start by asking the people who have to live with the change what would actually work for them.`] },
  'ev-344': { title: 'Koh Tao clean-up dives', type: 'service', lines: ['service', 'environment'], sys: ['CAS log', 'cas-kt-dive'],
    summary: 'Four clean-up dives on the school reef trip, logging every item.',
    about: 'On the Year 11 reef trip to Koh Tao, Sienna joined four clean-up dives with a local dive school, removing 64 kg of debris, mostly fishing line, and logging every item for an ocean-debris database.',
    img: ['pool', 'Clean-up dive 3', { text: '64 KG REMOVED', c: SV }], add: [f('Debris log')] },
  'ev-345': { title: 'Reflection: first data of my own', lines: ['science'],
    summary: 'Reflection after the reef logger’s first download.',
    about: 'A reflection written after Sienna downloaded the first month of data from her reef temperature logger.',
    refl: ['Term check-in', `The logger worked! 31 days, one reading every ten minutes, 4,464 numbers.

The first thing I saw was a daily wobble I didn’t expect, about half a degree, warmest at 4 pm. The second thing was a spike on 9 March to 30.8 °C that lasted two days.

It is the first time I have had data nobody else has. It feels like a responsibility. I need to learn how to say what it means without saying more than it shows.`] },
  'ev-346': { title: 'Campus garden: first planting', type: 'service', lines: ['environment', 'service'], sys: ['CAS log', 'cas-garden'],
    summary: 'Started a CAS garden behind the science block; 14 raised beds.',
    about: 'Sienna’s CAS project: turning an unused strip behind the science block into a garden. During summer school she and nine volunteers built 14 raised beds from old pallets and planted herbs, lemongrass and morning glory for the canteen.',
    img: ['@compost-bin', 'Raised beds, week one'], add: [f('Garden plan'), f('Volunteer rota')] },
  'ev-347': { title: 'Reflection: choosing my EE topic', lines: ['environment'],
    summary: 'Reflection on narrowing an Extended Essay topic.',
    about: 'A reflection written for Sienna’s Extended Essay supervisor, Mr Okafor.',
    refl: ['Term check-in', `I started with “coral bleaching”, which Mr Okafor said is a topic for a whole career, not 4,000 words.

Then I tried “does temperature cause bleaching”, which is already known. Finally: does the daily temperature range on a reef predict how much coral bleaches? My logger data shows reefs with bigger daily swings might cope better.

It is small and specific and I can actually answer it. That feels like the first real research question I have asked.`] },
  'ev-348': { title: 'Marine club: water-quality testing', type: 'club', lines: ['science'], sys: ['Clubs & Sports', 'marine-wq'],
    summary: 'Started monthly water testing at three sites for the marine club.',
    about: 'Sienna set up monthly water-quality testing for the marine club: pH, nitrate, phosphate and turbidity at three sites on the Chao Phraya. Club members now rotate the sampling and she checks the data.',
    img: ['@aq-sensor', 'Sampling at site B'], add: [f('Water test results')] },
};

// Extra drawings, named so stations above can reuse them.
export const NAMED = {
  climb: ['board', { lines: ['V4 · overhang', 'Flash it next week'], c: SP, n: 2 }],
  football: ['forest', { c: SP, text: 'U16 girls · league match' }],
  lamp: ['workshop', { title: 'Bamboo weave test 3', c: DE }],
};
