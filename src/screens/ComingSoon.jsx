import { NAV } from '../personas.js';
const BUILT = {
  student: ['map', 'studio', 'shared', 'inbox', 'links', 'activity', 'privacy'], advisor: ['advisory', 'student', 'signals'], teacher: ['queue'], counsellor: ['letter', 'applications'],
  coordinator: ['cas', 'schoolline'], leadership: ['dashboard', 'scan', 'pdpa', 'schoolmetro'], external: ['reader'],
};
// Screens from the roadmap that are not in this build yet.
export default function ComingSoon({ screen, kind }) {
  if (BUILT[kind]?.includes(screen)) return null;
  const label = NAV[kind].find(([id]) => id === screen)?.[1] || screen;
  return (
    <div className="soon">
      <div className="tri" aria-hidden="true" />
      <h1>{label}</h1>
      <p>This screen is on the build list and arrives in the next update of the demo.</p>
    </div>
  );
}
