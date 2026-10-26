import { useLayoutEffect, useRef, useState } from 'react';

// Screens in the top bar. At most four sit in the bar (five when there are only five); the rest,
// and whatever does not fit, go under "More", so nothing is hidden without a cue.
export default function NavBar({ items, isOn, onGo, hrefOf, moreLabel = 'More' }) {
  const wrap = useRef(null);
  const measure = useRef(null);
  const cap = items.length > 5 ? 4 : items.length;
  const [fit, setFit] = useState(cap);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const calc = () => {
      if (!wrap.current || !measure.current) return;
      const avail = wrap.current.clientWidth;
      const widths = [...measure.current.children].map((c) => c.getBoundingClientRect().width + 2);
      const more = widths.pop();
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= avail) { setFit(cap); return; }
      let used = more, n = 0;
      while (n < widths.length && used + widths[n] <= avail) used += widths[n++];
      setFit(Math.max(1, Math.min(cap, n)));
    };
    calc();
    const ro = new ResizeObserver(calc); ro.observe(wrap.current);
    document.fonts?.ready.then(calc);
    return () => ro.disconnect();
  }, [items, cap]);
  const shown = items.slice(0, fit), rest = items.slice(fit);
  const activeRest = rest.find(([id]) => isOn(id));
  const link = ([id, label], extra = {}) => (
    <a key={id} href={hrefOf(id)} className={isOn(id) ? 'on' : ''} aria-current={isOn(id) ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setOpen(false); onGo(id); }} {...extra}>{label}</a>
  );
  return (
    <nav aria-label="Screens" ref={wrap} className="navbar">
      <div className="nav-measure" ref={measure} aria-hidden="true">{items.map(([id, label]) => <a key={id}>{label}</a>)}<a>{moreLabel} ▾</a></div>
      {shown.map((it) => link(it))}
      {rest.length > 0 && (
        <div className="menu-wrap nav-more">
          <button className={activeRest ? 'on' : ''} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>{activeRest ? activeRest[1] : moreLabel} ▾</button>
          {open && <div className="menu nav-menu" role="menu" onMouseLeave={() => setOpen(false)}>{rest.map((it) => link(it, { role: 'menuitem' }))}</div>}
        </div>
      )}
    </nav>
  );
}
