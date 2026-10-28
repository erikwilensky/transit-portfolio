import { NAV } from '../personas.js';
const BUILT = {
  student: ['poster', 'map', 'studio', 'shared', 'inbox', 'links', 'activity', 'privacy', 'family', 'add', 'snap'], advisor: ['advisory', 'student', 'signals'], teacher: ['queue', 'classes', 'crosslinks', 'depot', 'import'], counsellor: ['letter', 'applications', 'activities', 'search'],
  coordinator: ['cas', 'schoolline', 'core', 'governance', 'import'], leadership: ['dashboard', 'scan', 'pdpa', 'schoolmetro', 'profile', 'rollout', 'pilot', 'audit'], parent: ['family', 'consent', 'digest'], alum: ['journey', 'poster'], external: ['reader'],
};
// Screens from the roadmap that are not in this build yet.
export default function ComingSoon({ screen, kind, persona }) {
  if ([kind, ...(persona?.also || [])].some((k) => BUILT[k]?.includes(screen))) return null;
  const label = NAV[kind].find(([id]) => id === screen)?.[1] || screen;
  return (
    <div className="soon">
      <div className="tri" aria-hidden="true" />
      <h1>{label}</h1>
      <p>This screen is on the build list and arrives in the next update of the demo.</p>
    </div>
  );
}
