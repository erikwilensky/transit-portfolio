// Presentation themes. Each maps to a CSS class that sets colour tokens.
export const THEMES = {
  // P10: the school's own look, used by default for presentations that leave the school.
  nist: { label: 'NIST', note: 'School brand, for outside readers', swatch: ['#ffffff', '#002855', '#78D5E1'] },
  metro: { label: 'Metro', note: 'Bright, balanced', swatch: ['#f7f6f2', '#1b1d22', '#1E6FD9'] },
  ivy: { label: 'Ivy', note: 'Calm, for universities', swatch: ['#f6f1e7', '#2a2420', '#6B3FB0'] },
  slate: { label: 'Slate', note: 'Crisp, for employers', swatch: ['#eef1f4', '#111827', '#00A39E'] },
  night: { label: 'Night', note: 'Dark', swatch: ['#14161b', '#eceef2', '#F2A100'] },
};
// Presentation formats. The metro map is the student's own tool; each
// audience gets a format that suits how that reader reads.
export const LAYOUTS = {
  profile: 'Profile',
  narrative: 'Narrative',
  letter: 'Why this course',
  cv: 'CV',
  cards: 'Project cards',
  impact: 'Impact timeline',
  map: 'Metro map',
};
export const DEFAULT_LAYOUT = { general: 'profile', university: 'narrative', specific: 'letter', employer: 'cv', scholarship: 'impact', custom: 'custom' };
