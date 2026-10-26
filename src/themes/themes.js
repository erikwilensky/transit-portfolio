// Presentation themes. Each maps to a CSS class that sets colour tokens.
export const THEMES = {
  metro: { label: 'Metro', note: 'Bright, balanced', swatch: ['#f7f6f2', '#1b1d22', '#1E6FD9'] },
  ivy: { label: 'Ivy', note: 'Calm, for universities', swatch: ['#f6f1e7', '#2a2420', '#6B3FB0'] },
  slate: { label: 'Slate', note: 'Crisp, for employers', swatch: ['#eef1f4', '#111827', '#00A39E'] },
  night: { label: 'Night', note: 'Dark', swatch: ['#14161b', '#eceef2', '#F2A100'] },
};
export const LAYOUTS = {
  metro: 'Metro map',
  timeline: 'Timeline',
  story: 'Story scroll',
  cards: 'Cards',
};
export const DEFAULT_LAYOUT = { general: 'metro', university: 'metro', specific: 'metro', employer: 'cards' };
