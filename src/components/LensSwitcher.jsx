import { LENSES } from '../api.js';
export default function LensSwitcher({ value, onChange, targetName, only }) {
  return (
    <div className="seg lens-switch" role="radiogroup" aria-label="Audience lens">
      {Object.entries(LENSES).filter(([id]) => !only || only.includes(id)).map(([id, l]) => (
        <button key={id} role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
          {id === 'specific' && targetName ? `Specific: ${targetName}` : l.label}
        </button>
      ))}
    </div>
  );
}
