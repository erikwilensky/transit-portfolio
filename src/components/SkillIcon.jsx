// Skill icons: one line-drawn set (24px grid, 2px round strokes, currentColor) for the IB learner profile and the
// ATL skills, so they match the rest of the interface in light and dark instead of varying by device emoji.
const P = (d) => <path d={d} />;
const ICONS = {
  Inquirer: <><circle cx="12" cy="12" r="9" />{P('M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.4')}<circle cx="12" cy="16.8" r=".4" fill="currentColor" /></>,
  Knowledgeable: P('M12 6.5C10.5 5 8.3 4.5 4 4.5v13c4.3 0 6.5.5 8 2 1.5-1.5 3.7-2 8-2v-13c-4.3 0-6.5.5-8 2zM12 6.5v13'),
  Thinker: P('M5 8h3.2a2.3 2.3 0 1 1 4.6 0H16v3.2a2.3 2.3 0 1 1 0 4.6V19h-3.2a2.3 2.3 0 1 0-4.6 0H5v-3.2a2.3 2.3 0 1 0 0-4.6z'),
  Communicator: P('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4h0.5A2.5 2.5 0 0 1 4 13.5z'),
  Principled: P('M12 4v15M7.5 19.5h9M5 7.5h14M5 7.5 2.5 13a2.5 2.5 0 0 0 5 0zM19 7.5 16.5 13a2.5 2.5 0 0 0 5 0z'),
  'Open-minded': <><circle cx="12" cy="12" r="9" />{P('M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z')}</>,
  Caring: P('M12 19.5s-7.5-4.3-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.7-7.5 10-7.5 10z'),
  'Risk-taker': <>{P('M12 3c3 2 4.7 5 4.7 9l-1.9 4H9.2l-1.9-4C7.3 8 9 5 12 3zM9.2 16 7.5 20M14.8 16l1.7 4M12 16v4')}<circle cx="12" cy="10" r="1.6" /></>,
  Balanced: P('M6.5 20h11a2.5 2.5 0 0 0 0-5h-11a2.5 2.5 0 0 0 0 5zM8.5 15h7a2 2 0 0 0 0-4h-7a2 2 0 0 0 0 4zM10.5 11h3a1.6 1.6 0 0 0 0-3.2h-3a1.6 1.6 0 0 0 0 3.2z'),
  Reflective: <><ellipse cx="12" cy="9.5" rx="5.5" ry="6.5" />{P('M12 16v4.5M9 20.5h6M9.8 7.3l1.8-1.8')}</>,
  Thinking: P('M9 17.5h6M10 20.5h4M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.4.3.6.7.6 1.2v.8h5.6v-.8c0-.5.2-.9.6-1.2A5.8 5.8 0 0 0 12 3.5z'),
  Communication: P('M4.5 19.5l3.8-.9L19 7.9a2.1 2.1 0 0 0-3-3L5.4 15.7zM14.5 6.5l3 3'),
  Social: <><circle cx="9" cy="8" r="3" />{P('M3.5 19.5a5.5 5.5 0 0 1 11 0')}<circle cx="16.5" cy="9" r="2.4" />{P('M15.5 14.1a4.6 4.6 0 0 1 5 4.6')}</>,
  'Self-management': <><rect x="4" y="5" width="16" height="15" rx="2.5" />{P('M4 10h16M8.5 3v4M15.5 3v4M9.3 15l2 2 3.7-3.7')}</>,
  Research: <><circle cx="10.5" cy="10.5" r="6" />{P('M15 15l5 5')}</>,
};
export default function SkillIcon({ k, className = 'sk-ico' }) {
  const body = ICONS[k];
  if (!body) return null;
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
  );
}
export const hasSkillIcon = (k) => k in ICONS;
