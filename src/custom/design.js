// The Custom audience: a page the student designs from blocks on a 6-column
// grid, with a theme they can tune. Blocks only reference verified stations
// by id; the student's own words live in text, hero and skills blocks.

export const FONTS = {
  switzer: { label: 'Switzer (NIST)', body: '"Switzer", Arial, sans-serif', head: '"Switzer", Arial, sans-serif' },
  inter: { label: 'Inter', body: '"Inter", system-ui, sans-serif', head: '"Inter", system-ui, sans-serif' },
  editorial: { label: 'Fraunces + Inter', body: '"Inter", system-ui, sans-serif', head: '"Fraunces", Georgia, serif' },
  classic: { label: 'Playfair + Source Serif', body: '"Source Serif 4", Georgia, serif', head: '"Playfair Display", Georgia, serif' },
  grotesk: { label: 'Space Grotesk', body: '"Space Grotesk", system-ui, sans-serif', head: '"Space Grotesk", system-ui, sans-serif' },
  rounded: { label: 'Nunito', body: '"Nunito", system-ui, sans-serif', head: '"Nunito", system-ui, sans-serif' },
  mono: { label: 'JetBrains Mono + Inter', body: '"Inter", system-ui, sans-serif', head: '"JetBrains Mono", ui-monospace, monospace' },
};

export const PRESETS = {
  nist: { label: 'NIST', bg: '#f4f6fa', surface: '#ffffff', ink: '#002855', muted: '#56627a', accent: '#002855', accent2: '#FFB81C', font: 'switzer', radius: 10, pattern: 'none', card: 'outline' },
  metro: { label: 'Metro', bg: '#f7f6f2', surface: '#ffffff', ink: '#1b1d22', muted: '#646a73', accent: '#1E6FD9', accent2: '#E2343C', font: 'inter', radius: 12, pattern: 'none', card: 'outline' },
  ivy: { label: 'Ivy', bg: '#f6f1e7', surface: '#fffdf8', ink: '#2a2420', muted: '#7a6e63', accent: '#6B3FB0', accent2: '#2E9E4F', font: 'classic', radius: 6, pattern: 'none', card: 'outline' },
  slate: { label: 'Slate', bg: '#eef1f4', surface: '#ffffff', ink: '#111827', muted: '#5b6472', accent: '#00A39E', accent2: '#1E6FD9', font: 'grotesk', radius: 4, pattern: 'grid', card: 'flat' },
  night: { label: 'Night', bg: '#121418', surface: '#1c1f26', ink: '#eceef2', muted: '#9aa1ac', accent: '#F2A100', accent2: '#C152DB', font: 'inter', radius: 14, pattern: 'dots', card: 'outline' },
  sunset: { label: 'Sunset', bg: '#fff4ec', surface: '#ffffff', ink: '#2b1a14', muted: '#8a6a5c', accent: '#F06A1D', accent2: '#E0458B', font: 'editorial', radius: 18, pattern: 'gradient', card: 'shadow' },
  forest: { label: 'Forest', bg: '#eef4ec', surface: '#fbfdf9', ink: '#17251a', muted: '#5d6f60', accent: '#2E9E4F', accent2: '#8A5A44', font: 'rounded', radius: 16, pattern: 'lines', card: 'shadow' },
  neon: { label: 'Neon', bg: '#0d0b1a', surface: '#17142b', ink: '#f4f1ff', muted: '#a49cc7', accent: '#22d3ee', accent2: '#f472b6', font: 'mono', radius: 8, pattern: 'grid', card: 'glass' },
  paper: { label: 'Paper', bg: '#fbfaf7', surface: '#fbfaf7', ink: '#1a1a1a', muted: '#6b6b6b', accent: '#1a1a1a', accent2: '#E2343C', font: 'editorial', radius: 0, pattern: 'none', card: 'flat' },
};

export const BLOCKS = {
  hero: { label: 'Hero', icon: '★', hint: 'Name, headline and tagline' },
  text: { label: 'Text', icon: '¶', hint: 'Your own words' },
  map: { label: 'Metro map', icon: '⟿', hint: 'Your journey, all or some lines' },
  feature: { label: 'Feature station', icon: '◉', hint: 'One station, big, with image and reflection' },
  stations: { label: 'Stations', icon: '▦', hint: 'Cards or a list from a line' },
  gallery: { label: 'Gallery', icon: '▣', hint: 'Evidence images' },
  quote: { label: 'Quote', icon: '❝', hint: 'A reflection or endorsement' },
  stats: { label: 'Stats', icon: '#', hint: 'Numbers at a glance' },
  timeline: { label: 'Timeline', icon: '┆', hint: 'Stations in date order' },
  lines: { label: 'My lines', icon: '≡', hint: 'One card per line' },
  skills: { label: 'Skills', icon: '◇', hint: 'Tags you choose' },
  goals: { label: 'Next stops', icon: '→', hint: 'Planned goals' },
  divider: { label: 'Divider', icon: '—', hint: 'Space or a metro rule' },
};

export const SPANS = [[6, 'Full'], [4, '⅔'], [3, '½'], [2, '⅓']];

let uid = 0;
export const newId = () => `b${Date.now().toString(36)}${(uid++).toString(36)}`;

export function newBlock(type, map) {
  const first = map.student.name.split(' ')[0];
  const featured = pickFeatured(map);
  const props = {
    hero: { title: map.student.name, subtitle: `${map.student.programme} · Year ${map.student.grade + 1}`, tagline: 'A short line about who you are.', layout: 'left', avatar: true },
    text: { heading: 'About me', body: `Write in your own voice, ${first}.` },
    map: { height: 'm', lines: [] },
    feature: { eventId: featured?.id, imageSide: 'left', showReflection: true, showEndorsement: true },
    stations: { heading: 'Projects', source: 'line', lineId: 'all', types: ['project', 'competition', 'award', 'service', 'cas'], eventIds: [], limit: 6, style: 'cards', columns: 3, showImages: true },
    gallery: { heading: 'Gallery', lineId: 'all', limit: 6, columns: 3 },
    quote: { source: 'reflection', eventId: [...map.events].filter((e) => e.reflections?.length).sort((a, b) => b.reflections[0].text.length - a.reflections[0].text.length)[0]?.id, size: 'l' },
    stats: { items: ['stations', 'lines', 'endorsements', 'reflections'] },
    timeline: { heading: 'Timeline', lineId: 'all', limit: 8 },
    lines: { heading: 'What I do' },
    skills: { heading: 'Skills', tags: ['Teamwork', 'Problem solving'] },
    goals: { heading: 'Next stops' },
    divider: { style: 'metro' },
  }[type];
  const span = { stats: 6, quote: 6, skills: 3, goals: 3 }[type] || 6;
  return { id: newId(), type, span, align: 'left', style: type === 'quote' ? 'accent' : 'plain', props };
}

export function pickFeatured(map) {
  const past = map.events.filter((e) => e.type !== 'goal');
  const score = (e) => e.lineIds.length * 2 + e.endorsements.length * 2 + (e.evidence.some((x) => x.kind === 'image') ? 1 : 0) + Math.min(3, (e.reflections?.[0]?.text.length || 0) / 300);
  return [...past].sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date))[0];
}

// A sensible starting page built from the student's own map.
export function defaultDesign(map) {
  const b = (type, span, patch = {}, extra = {}) => { const x = newBlock(type, map); x.span = span; Object.assign(x.props, patch); Object.assign(x, extra); return x; };
  const lineIds = map.lines.filter((l) => l.status !== 'ended').map((l) => l.id);
  const top = lineIds[0];
  const first = map.student.name.split(' ')[0];
  return {
    theme: { ...PRESETS.sunset, preset: 'sunset', spacing: 'cosy', width: 'normal', headerBand: true },
    blocks: [
      b('hero', 6, { tagline: TAGLINES[map.student.id] || `${first}'s journey so far.`, layout: 'split' }),
      b('stats', 6),
      b('feature', 4, {}, { style: 'card' }),
      b('quote', 2, {}, { style: 'accent' }),
      b('map', 6, { height: 'm' }),
      b('stations', 6, { heading: 'Things I made', lineId: 'all', limit: 6 }),
      b('gallery', 3, { heading: 'Along the way', lineId: top, limit: 4, columns: 2 }),
      b('timeline', 3, { heading: 'Recent stops', limit: 6 }),
      b('lines', 6),
      b('skills', 3, { tags: SKILLS[map.student.id] || ['Curiosity', 'Teamwork'] }),
      b('goals', 3),
    ],
  };
}
const TAGLINES = {
  'st-01': 'I turn local problems into data: canals, classrooms, beaches and air.',
  'st-02': 'Musician and developer. I build sound that reacts.',
  'st-03': 'New languages, new friends, and a sketchbook that goes everywhere.',
};
const SKILLS = {
  'st-01': ['Python', 'Raspberry Pi', 'Data visualisation', 'Field research', 'Leading volunteers'],
  'st-02': ['Unity & C#', 'Music production', 'Live sound', 'Piano', 'PCB design'],
  'st-03': ['German', 'English', 'Thai', 'Japanese (beginner)', 'Drawing', 'Peer tutoring'],
};

// Theme → CSS custom properties on the page wrapper.
export function themeVars(t) {
  const f = FONTS[t.font] || FONTS.inter;
  return {
    '--c-bg': t.bg, '--c-surface': t.surface, '--c-ink': t.ink, '--c-muted': t.muted, '--c-accent': t.accent, '--c-accent2': t.accent2,
    '--c-radius': `${t.radius}px`, '--c-body': f.body, '--c-head': f.head,
    '--c-gap': { compact: '10px', cosy: '18px', airy: '30px' }[t.spacing || 'cosy'],
    '--c-max': { narrow: '760px', normal: '1080px', wide: '1400px' }[t.width || 'normal'],
  };
}
