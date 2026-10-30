// The display menu's readability options (src/a11y.js): text size, high contrast, easy-read font, reduce motion.
import { useEffect, useState } from 'react';
import { MOTION, SIZES, getDisplay, onDisplay, setDisplay } from '../a11y.js';

const Seg = ({ label, value, options, onPick, T }) => <>
  <div className="menu-title" aria-hidden="true">{T(label)}</div>
  <div className="vm-row seg" role="radiogroup" aria-label={T(label)}>
    {options.map(([k, l]) => <button key={String(k)} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onPick(k)}>{T(l)}</button>)}
  </div>
</>;
const OFF_ON = [[false, 'Off'], [true, 'On']];

export default function DisplaySettings({ T = (s) => s }) {
  const [d, setD] = useState(getDisplay);
  useEffect(() => onDisplay(setD), []);
  return <div className="a11y-opts">
    <Seg T={T} label="Text size" value={d.size} options={SIZES} onPick={(size) => setDisplay({ size })} />
    <Seg T={T} label="High contrast" value={d.contrast} options={OFF_ON} onPick={(contrast) => setDisplay({ contrast })} />
    <Seg T={T} label="Easy-read font" value={d.font} options={OFF_ON} onPick={(font) => setDisplay({ font })} />
    <Seg T={T} label="Reduce motion" value={d.motion} options={MOTION} onPick={(motion) => setDisplay({ motion })} />
  </div>;
}
