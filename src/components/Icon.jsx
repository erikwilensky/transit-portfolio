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
  // Activity list and small markers (replacing ◉ ⇣ ＋ ¶ ◐ ⟿ ▣ ★ ⛓)
  eye: <>{P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z')}<circle cx="12" cy="12" r="3" /></>,
  plus: P('M12 5v14M5 12h14'),
  sync: P('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'),
  note: P('M5 6.5h14M5 11h14M5 15.5h9'),
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" />{P('M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3')}</>,
  route: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" />{P('M8 16.5 16 7.5')}</>,
  question: <><circle cx="12" cy="12" r="8.5" />{P('M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2')}</>,
  camera: <><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><circle cx="12" cy="13" r="3.3" />{P('M9 7l1.5-2.5h3L15 7')}</>,
  star: P('M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z'),
};
export default function Icon({ name, className = 'icon', size = '1em' }) {
  const body = ICONS[name];
  if (!body) return null;
  return <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>;
}
