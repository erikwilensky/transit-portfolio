import { INTENSITY } from '../api.js';

// A three-step slider: how much of the interface a student wants to see.
export default function IntensityControl({ value, onChange, compact = false }) {
  const i = INTENSITY.findIndex(([k]) => k === value);
  return (
    <div className={`intensity${compact ? ' compact' : ''}`} role="radiogroup" aria-label="How much to show">
      {!compact && <span className="int-label">Interface</span>}
      <div className="int-track" style={{ '--i': i }}>
        <span className="int-fill" aria-hidden="true" />
        {INTENSITY.map(([k, label, note]) => (
          <button key={k} role="radio" aria-checked={k === value} className={k === value ? 'on' : ''} title={note} onClick={() => onChange(k)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
