const TIERS = [
  ['template', '1 · Template', 'From Grade 6'],
  ['builder', '2 · Builder', 'Most students'],
  ['code', '3 · Code', 'Students who code'],
];
export default function TierToggle({ value, onChange }) {
  return (
    <div className="seg tier-toggle" role="radiogroup" aria-label="Skill tier">
      {TIERS.map(([id, label, sub]) => (
        <button key={id} role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          <b>{label}</b><small>{sub}</small>
        </button>
      ))}
    </div>
  );
}
