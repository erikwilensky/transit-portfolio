import { ensureEndorsed, ensureMayaStory } from './tourStory.js';

// Pitch tours, built from one library of steps (Q4). Each step moves to a persona and screen;
// `say` is the presenter's line and `secs` a time hint. A step with `card` shows a full-screen card (Q1).
const S = {
  open: { title: 'Opening', sub: 'The problem, one record, seven roles', card: 'open', secs: 30, say: 'Today a student’s learning is scattered across six systems, and every year counsellors rebuild the story by hand. This is one verified record that every role reads from.', run: () => {} },
  dash: { title: 'Leadership home', sub: 'Adoption, verified share, hours saved', secs: 30, say: 'The Head of School opens on the school dashboard: who uses it, how much is verified automatically, and the time it saves.', run: (c) => c.go('principal', 'dashboard') },
  maya: { title: 'Maya, after the hackathon', sub: 'Answers a signal, adds a station from her phone', secs: 60, say: 'Maya answers her advisor’s reflection signal, then adds yesterday’s hackathon from her phone and asks Ms Nair to endorse it.', run: (c) => c.go('maya', 'map', 'tour') },
  nair: { title: 'Ms Nair endorses it', sub: 'One click from her queue', secs: 30, say: 'Ms Nair sees the request in her queue and endorses it in one click. The badge on Maya’s map changes from dotted to outlined.', run: (c) => { ensureMayaStory(); c.go('nair', 'queue'); } },
  sponsor: { title: 'Sponsoring a plan', sub: 'A teacher joins before it happens', secs: 40, say: 'Not everything lives in a school system. Maya invited Ms Nair to sponsor her water-quality buoy while it was still a plan; Ms Nair set expectations and checks in, and endorses it when it is done.', run: (c) => { ensureMayaStory(); c.go('nair', 'queue', 'sponsor'); } },
  whitfield: { title: 'Mr Whitfield’s advisory', sub: 'Signal cleared, new station on the grid', secs: 30, say: 'Her advisor sees the signal cleared and the new station on his advisory grid, without asking anyone for an update.', run: (c) => { ensureEndorsed(); c.go('whitfield', 'advisory'); } },
  signals: { title: 'Signals across the advisory', sub: 'Kind prompts, not chasing', secs: 30, say: 'The signal board lists every open reflection across the advisory, with prompt templates. One send puts a signal on the student’s map.', run: (c) => { ensureEndorsed(); c.go('whitfield', 'signals'); } },
  brandt: { title: 'Ms Brandt, CAS', sub: 'The hackathon ticks off a learning outcome', secs: 30, say: 'The CAS coordinator sees the hackathon count towards a CAS learning outcome Maya had not shown yet.', run: (c) => { ensureEndorsed(); c.go('brandt', 'cas'); } },
  adeyemi: { title: 'The counsellor’s reference', sub: 'Every claim cites a verified station', secs: 40, say: 'Ms Adeyemi writes Maya’s reference with each claim linked to a verified station. Unsupported claims are flagged.', run: (c) => { ensureEndorsed(); c.go('adeyemi', 'letter', 'st-01'); } },
  lenses: { title: 'One record, many formats', sub: 'University narrative from the same data', secs: 40, say: 'Same verified data, different audience: Maya’s general profile becomes a university narrative, a CV or a scholarship timeline.', run: (c) => { ensureEndorsed(); c.setTier('template'); c.setAudience('university'); c.go('maya', 'studio'); } },
  reader: { title: 'The admissions reader', sub: 'Opens the link, checks a badge', secs: 40, say: 'At Northbridge, the reader opens Maya’s link and clicks a badge to see exactly how that station was verified.', run: (c) => { ensureEndorsed(); c.go('reader', 'reader'); } },
  family: { title: 'A parent, in Thai', sub: 'Consent for Year 7, a weekly digest', secs: 40, say: 'Khun Nok has two children. She gives consent for Pim in Year 7, sees what Ploy shares, and reads a weekly digest in Thai.', run: (c) => c.go('parent', 'consent', 'st-09') },
  inbox: { title: 'Integrations inbox', sub: 'Systems sync, the student chooses', secs: 30, say: 'School systems sync new items into an inbox. Nothing reaches the map until Maya chooses, and GitHub only sends the repositories she shares.', run: (c) => c.go('maya', 'inbox') },
  pdpa: { title: 'Back to leadership', sub: 'Privacy: views logged, links expire', secs: 30, say: 'Back with leadership: every view was logged, the link expires, and the student can switch it off.', run: (c) => c.go('principal', 'pdpa') },
  rollout: { title: 'What it would take', sub: 'Systems, year groups, cost', secs: 40, say: 'The rollout planner turns the open questions into choices: which systems, which year groups, and what it costs to run.', run: (c) => c.go('principal', 'rollout') },
  ask: { title: 'The ask', sub: 'A pilot proposal from the planner', card: 'ask', secs: 30, say: 'The ask: approve this pilot. The numbers come straight from the rollout planner, so they change if we change the scope.', run: () => {} },
};

const tour = (title, use, keys) => ({ title, use, steps: keys.map((k) => ({ key: k, ...S[k] })) });

export const TOURS = {
  short: tour('Five-minute pitch', 'For the board: under five minutes', ['open', 'maya', 'nair', 'adeyemi', 'reader', 'pdpa', 'ask']),
  roles: tour('One record, every role', 'The full role walk-through', ['open', 'dash', 'maya', 'nair', 'whitfield', 'brandt', 'adeyemi', 'reader', 'pdpa', 'ask']),
  deep: tour('Deep dive for staff', 'A staff session, with time for questions', ['open', 'dash', 'maya', 'nair', 'sponsor', 'whitfield', 'signals', 'brandt', 'adeyemi', 'lenses', 'reader', 'family', 'inbox', 'pdpa', 'rollout', 'ask']),
  student: {
    title: 'The student’s map',
    use: 'Formats and tiers for one student',
    steps: [
      { title: 'Maya’s interchange', sub: 'Air-quality sensor network', secs: 30, say: 'Maya’s map: each line is a strand of her life, and the air-quality project is where Computing meets Environment.', run: (c) => c.go('maya', 'map', 'ev-042') },
      { title: 'Lens: General → University', sub: 'Same data, a new format', secs: 30, say: 'Same verified data, different audience: the general profile becomes a university narrative.', run: (c) => { c.setTier('template'); c.setAudience('university'); c.go('maya', 'studio'); } },
      { title: 'Lens: Specific university', sub: '“Why Data Science”', secs: 30, say: 'For one course, matching lines stay full and everything else becomes thin context.', run: (c) => { c.setTier('builder'); c.setAudience('specific'); c.go('maya', 'studio'); } },
      { title: 'Employer and Scholarship', sub: 'A CV, then an impact timeline', secs: 30, say: 'An employer gets a CV; a scholarship panel gets an impact timeline.', run: (c) => { c.setTier('template'); c.setAudience('employer'); c.go('maya', 'studio'); } },
      { title: 'Custom page', sub: 'Themes, blocks, drag and resize', secs: 40, say: 'Students who want to can design their own page from blocks, with verified stations they can place but never edit.', run: (c) => { c.setAudience('custom'); c.go('maya', 'studio'); } },
      { title: 'Tier: Code', sub: 'Their own site, same rules', secs: 40, say: 'Students who code can build and publish their own site from the same read API and privacy rules.', run: (c) => { c.setAudience('general'); c.setTier('code'); c.go('maya', 'studio'); } },
      { title: 'Integrations inbox', sub: 'Sync, then choose', secs: 30, say: 'School systems sync new items into an inbox. Nothing reaches the map until Maya chooses.', run: (c) => c.go('maya', 'inbox') },
    ],
  },
};
export const tourMinutes = (t) => Math.max(1, Math.round(t.steps.reduce((n, s) => n + (s.secs || 30), 0) / 60));
export const stopCount = (t) => t.steps.filter((s) => !s.card).length;

// Q2: what a board usually asks, each answered with a screen that shows it.
export const QA = [
  { q: 'Who can see a student’s record?', a: 'Only who the student chooses. Defaults are advisor-only, shares expire and every view is logged. Leadership sees counts, never private stations.', go: (c) => c.go('principal', 'pdpa'), show: 'Privacy & PDPA' },
  { q: 'What does it cost, and how long does it take?', a: 'It depends on scope. A DP pilot with two systems is a few months of build and a small running cost; the planner shows each choice.', go: (c) => c.go('principal', 'rollout'), show: 'Rollout planner' },
  { q: 'Is this more work for teachers?', a: 'Most stations arrive verified from school systems. Endorsing the rest takes about three minutes, and a class can be done as a batch.', go: (c) => c.go('nair', 'queue'), show: 'Ms Nair’s queue' },
  { q: 'Are we locked in to a vendor?', a: 'No. Everything sits behind a read API, and the full record exports as JSON. Students who code already build on the same API.', go: (c) => { c.setAudience('general'); c.setTier('code'); c.go('maya', 'studio'); }, show: 'The read API' },
  { q: 'What happens when a student leaves?', a: 'They take their map with them: a full export of the record and a static copy of every presentation. School access ends on a retention schedule.', go: (c) => c.go('maya', 'privacy'), show: 'Maya’s privacy page' },
  { q: 'Could a student make things up?', a: 'They can add anything, but it shows as student-added until a teacher endorses it. Readers see how each station was verified.', go: (c) => { ensureEndorsed(); c.go('reader', 'reader'); }, show: 'The reader’s view' },
  { q: 'Does it replace ManageBac or the SIS?', a: 'No. It reads from them through one adapter each and the student chooses what joins their map.', go: (c) => c.go('maya', 'inbox'), show: 'Integrations inbox' },
  { q: 'What about Years 7 to 9?', a: 'They start with simple templates. A parent gives consent in the family view, in Thai or English, before anything is kept or shared.', go: (c) => c.go('parent', 'consent', 'st-09'), show: 'A parent’s consent page' },
];
