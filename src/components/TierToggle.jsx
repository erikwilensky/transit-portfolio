const TIERS = [
  ['template', '1 · Template', 'From Year 7'],
  ['builder', '2 · Builder', 'Most students'],
  ['code', '3 · Code', 'Students who code'],
];
export default function TierToggle({ value, onChange, only }) {
  return (
    <div className="seg tier-toggle" role="radiogroup" aria-label="Skill tier">
      {TIERS.filter(([id]) => !only || only.includes(id)).map(([id, label, sub]) => (
        <button key={id} role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          <b>{label}</b><small>{sub}</small>
        </button>
      ))}
    </div>
  );
}
