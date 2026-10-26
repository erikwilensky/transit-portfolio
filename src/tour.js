import { ensureEndorsed, ensureMayaStory } from './tourStory.js';

// Pitch tours. Each step moves to a persona and screen; `say` is the presenter's line.
export const TOURS = {
  roles: {
    title: 'One record, every role (8 stops)',
    steps: [
      { title: 'Leadership home', sub: 'Adoption, verified share, hours saved', say: 'The Head of School opens on the school dashboard: who uses it, how much is verified automatically, and the time it saves.', run: (c) => c.go('principal', 'dashboard') },
      { title: 'Maya, after the hackathon', sub: 'Answers a signal, adds a station from her phone', say: 'Maya answers her advisor’s reflection signal, then adds yesterday’s hackathon from her phone and asks Ms Nair to endorse it.', run: (c) => c.go('maya', 'map', 'tour') },
      { title: 'Ms Nair endorses it', sub: 'One click from her queue', say: 'Ms Nair sees the request in her queue and endorses it in one click. The badge on Maya’s map changes from dotted to outlined.', run: (c) => { ensureMayaStory(); c.go('nair', 'queue'); } },
      { title: 'Mr Whitfield’s advisory', sub: 'Signal cleared, new station on the grid', say: 'Her advisor sees the signal cleared and the new station on his advisory grid, without asking anyone for an update.', run: (c) => { ensureEndorsed(); c.go('whitfield', 'advisory'); } },
      { title: 'Ms Brandt, CAS', sub: 'The hackathon ticks off a learning outcome', say: 'The CAS coordinator sees the hackathon count towards a CAS learning outcome Maya had not shown yet.', run: (c) => { ensureEndorsed(); c.go('brandt', 'cas'); } },
      { title: 'The counsellor’s reference', sub: 'Every claim cites a verified station', say: 'Ms Adeyemi writes Maya’s reference with each claim linked to a verified station. Unsupported claims are flagged.', run: (c) => { ensureEndorsed(); c.go('adeyemi', 'letter', 'st-01'); } },
      { title: 'The admissions reader', sub: 'Opens the link, checks a badge', say: 'At Northbridge, the reader opens Maya’s link and clicks a badge to see exactly how that station was verified.', run: (c) => { ensureEndorsed(); c.go('reader', 'reader'); } },
      { title: 'Back to leadership', sub: 'Privacy: views logged, links expire', say: 'Back with leadership: every view was logged, the link expires, and the student can switch it off.', run: (c) => c.go('principal', 'pdpa') },
    ],
  },
  student: {
    title: 'The student’s map (7 stops)',
    steps: [
      { title: 'Maya’s interchange', sub: 'Air-quality sensor network', say: 'Maya’s map: each line is a strand of her life, and the air-quality project is where Computing meets Environment.', run: (c) => c.go('maya', 'map', 'ev-042') },
      { title: 'Lens: General → University', sub: 'Same data, a new format', say: 'Same verified data, different audience: the general profile becomes a university narrative.', run: (c) => { c.setTier('template'); c.setAudience('university'); c.go('maya', 'studio'); } },
      { title: 'Lens: Specific university', sub: '“Why Data Science”', say: 'For one course, matching lines stay full and everything else becomes thin context.', run: (c) => { c.setTier('builder'); c.setAudience('specific'); c.go('maya', 'studio'); } },
      { title: 'Employer and Scholarship', sub: 'A CV, then an impact timeline', say: 'An employer gets a CV; a scholarship panel gets an impact timeline.', run: (c) => { c.setTier('template'); c.setAudience('employer'); c.go('maya', 'studio'); } },
      { title: 'Custom page', sub: 'Themes, blocks, drag and resize', say: 'Students who want to can design their own page from blocks, with verified stations they can place but never edit.', run: (c) => { c.setAudience('custom'); c.go('maya', 'studio'); } },
      { title: 'Tier: Code', sub: 'The JSON behind the view', say: 'Students who code can build their own site from the same read API and privacy rules.', run: (c) => { c.setAudience('general'); c.setTier('code'); c.go('maya', 'studio'); } },
      { title: 'Integrations inbox', sub: 'Sync, then choose', say: 'School systems sync new items into an inbox. Nothing reaches the map until Maya chooses.', run: (c) => c.go('maya', 'inbox') },
    ],
  },
};
