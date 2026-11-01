// Evidence and file icons, drawn in the same line style as the skill icons (src/components/SkillIcon.jsx):
// 24px grid, 2px round strokes, currentColor. Replaces the text glyphs (▣ ▤ ♪ ↗ ★) that rendered differently per device.
const P = (d) => <path d={d} />;
const DOC = P('M7 3.5h7l4.5 4.5v12.5H7zM14 3.5V8h4.5');
const ICONS = {
  link: P('M10 14l10-10M14 4h6v6M18 14v5.5H4.5V6H10'),
  file: DOC,
  doc: <>{DOC}{P('M9.5 12.5h6M9.5 16h6')}</>,
  pdf: <>{DOC}{P('M9.5 12.5h6M9.5 16h4')}</>,
  image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" />{P('M4 17l4.5-4.5 3.5 3.5 2.5-2.5 5.5 4.5')}</>,
  audio: P('M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'),
  video: <><rect x="3.5" y="6" width="12" height="12" rx="2" />{P('M15.5 10.5l5-3v9l-5-3z')}</>,
  grade: P('M5 12.5l4.5 4.5L19 7.5'),
  certificate: <><circle cx="12" cy="9.5" r="5.5" />{P('M9 14.2 7.5 21l4.5-2.3 4.5 2.3-1.5-6.8')}</>,
};
export default function Icon({ name, className = 'icon', size = '1em' }) {
  const body = ICONS[name];
  if (!body) return null;
  return <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>;
}
