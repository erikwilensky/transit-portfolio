import { useState } from 'react';

// Small, dependency-free charts. Series colours come from --dv1..3 (validated for light and dark).
export function BarChart({ data, unit = '', height = 180, max, label }) {
  const [hover, setHover] = useState(null);
  const m = max || Math.max(...data.map((d) => d.value)) * 1.1;
  const W = 520, H = height, pad = { l: 34, r: 8, t: 10, b: 26 };
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / m);
  const ticks = [0, m / 2, m].map((v) => Math.round(v));
  return (
    <div className="chart" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}{unit}</text></g>)}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.value), h = H - pad.b - top;
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <path d={`M${x},${H - pad.b} V${top + 4} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - pad.b} Z`} className={`bar${hover === i ? ' hot' : ''}`} />
              <text x={x + w / 2} y={H - 8} textAnchor="middle" className="axis">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && <div className="tip" style={{ left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%` }}><b>{data[hover].label}</b> {data[hover].value}{unit}{data[hover].note ? <small>{data[hover].note}</small> : null}</div>}
    </div>
  );
}

export function LineChart({ data, unit = '', height = 180, label }) {
  const [hover, setHover] = useState(null);
  const m = Math.max(...data.map((d) => d.value)) * 1.15;
  const W = 520, H = height, pad = { l: 34, r: 12, t: 12, b: 26 };
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / m);
  const ticks = [0, m / 2, m].map((v) => +v.toFixed(1));
  return (
    <div className="chart" role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))))); }}>
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}{unit}</text></g>)}
        <polyline points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')} className="line" />
        {data.map((d, i) => <text key={d.label} x={x(i)} y={H - 8} textAnchor="middle" className="axis">{i % Math.ceil(data.length / 7) === 0 || i === data.length - 1 ? d.label : ''}</text>)}
        {hover !== null && <><line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="cross" /><circle cx={x(hover)} cy={y(data[hover].value)} r={5} className="dot" /></>}
      </svg>
      {hover !== null && <div className="tip" style={{ left: `${(x(hover) / W) * 100}%` }}><b>{data[hover].label}</b> {data[hover].value}{unit}</div>}
    </div>
  );
}

// One stacked bar with a legend and direct labels.
export function StackBar({ parts, label }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div className="stackbar" role="img" aria-label={label}>
      <div className="sb-bar">{parts.map((p, i) => <span key={p.label} className={`sb-seg dv${i + 1}`} style={{ flex: p.value }} title={`${p.label}: ${Math.round((100 * p.value) / total)}%`} />)}</div>
      <ul className="sb-legend">{parts.map((p, i) => <li key={p.label}><i className={`dv${i + 1}`} />{p.label} <b>{Math.round((100 * p.value) / total)}%</b></li>)}</ul>
    </div>
  );
}
