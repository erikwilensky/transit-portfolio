import { useEffect, useRef, useState } from 'react';

// Eases any nested object of numbers from its last value to a new target.
// Keys that are new start from the target with opacity 0, so they fade in.
function lerp(a, b, t) {
  if (typeof b === 'number') return typeof a === 'number' ? a + (b - a) * t : b;
  if (Array.isArray(b)) return b.map((v, i) => lerp(a?.[i], v, t));
  if (b && typeof b === 'object') {
    const out = {};
    for (const k in b) {
      if (a && k in a) out[k] = lerp(a[k], b[k], t);
      else if (b[k] && typeof b[k] === 'object' && 'opacity' in b[k]) out[k] = lerp({ ...b[k], opacity: 0 }, b[k], t);
      else out[k] = b[k];
    }
    return out;
  }
  return b;
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useTween(target, duration = 450) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduced || !duration) { current.current = target; setValue(target); return; }
    const from = current.current;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = t >= 1 ? target : lerp(from, target, ease(t));
      current.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
