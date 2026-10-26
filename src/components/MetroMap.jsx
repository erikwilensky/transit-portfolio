import { useEffect, useMemo, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { computeLayout, lineSegments } from '../layout/metroLayout.js';
import { useTween } from '../hooks/useTween.js';
import { TODAY } from '../api.js';

function wrap(text, max = 17) {
  const words = text.split(' ');
  const rows = [''];
  for (const w of words) {
    const cur = rows.at(-1);
    if (!cur || (cur + ' ' + w).length <= max) rows[rows.length - 1] = cur ? cur + ' ' + w : w;
    else if (rows.length < 2) rows.push(w);
    else { rows[1] = (rows[1] + ' ' + w).slice(0, max - 1) + '…'; break; }
  }
  return rows;
}

export function VerificationMark({ level, x = 0, y = 0, r = 3.6 }) {
  if (level === 'school-verified') return <circle cx={x} cy={y} r={r} className="vmark vmark-solid" />;
  if (level === 'teacher-endorsed') return <circle cx={x} cy={y} r={r} className="vmark vmark-outline" />;
  return <circle cx={x} cy={y} r={r} className="vmark vmark-dotted" />;
}

const GRADE_YEARS = (start, g) => `${start + g - 9}–${String(start + g - 8).slice(2)}`;

export default function MetroMap({ map, lens, selectedId, onSelect, mini = false, newIds, fitKey, duration = 450, showToday = true, className = '' }) {
  const target = useMemo(() => computeLayout(map, lens, TODAY, mini ? { laneH: 70, slotW: 40, colPad: 10, emptyW: 24, left: 20, top: 30, bottom: 30, right: 20 } : {}), [map, lens, mini]);
  const tweened = useTween(target, duration);
  // On the first frame after the data changes shape, the tween hasn't caught up yet.
  const L = Object.keys(target.lines).every((k) => k in tweened.lines) && Object.keys(target.stations).every((k) => k in tweened.stations) ? tweened : target;
  const eventsById = useMemo(() => Object.fromEntries(map.events.map((e) => [e.id, e])), [map]);
  const lineById = useMemo(() => Object.fromEntries(map.lines.map((l) => [l.id, l])), [map]);

  // Alternate labels above/below along each line (from the target, so they don't flicker).
  const labelSide = useMemo(() => {
    const side = {};
    const count = {};
    for (const e of map.events) {
      const s = target.stations[e.id];
      if (!s.visible) continue;
      if (s.interchange) { side[e.id] = 'above'; continue; }
      const l = e.lineIds.find((id) => lens.lineState[id] !== 'hidden');
      count[l] = (count[l] || 0) + 1;
      side[e.id] = count[l] % 2 ? 'below' : 'above';
    }
    return side;
  }, [map, target, lens]);

  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const [k, setK] = useState(1);

  const fit = (animate = true) => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const { width: cw, height: ch } = svg.getBoundingClientRect();
    let s = Math.min(cw / target.width, ch / target.height);
    s = Math.max(0.6, Math.min(1.15, s));
    // Too wide to fit: start with the most recent stretch (around Today) in view.
    const tx = target.width * s < cw ? (cw - target.width * s) / 2 : Math.max(cw - target.width * s, Math.min(0, cw * 0.7 - target.todayX * s));
    const ty = target.height * s < ch ? (ch - target.height * s) / 2 : 0;
    const t = zoomIdentity.translate(tx, ty).scale(s);
    const sel = select(svg);
    (animate ? sel.transition().duration(400) : sel).call(zoomRef.current.transform, t);
  };

  useEffect(() => {
    if (mini) return;
    const z = d3zoom().scaleExtent([0.3, 3]).on('zoom', (ev) => {
      gRef.current?.setAttribute('transform', ev.transform.toString());
      setK(ev.transform.k);
    });
    zoomRef.current = z;
    select(svgRef.current).call(z).on('dblclick.zoom', null);
    fit(false);
    const ro = new ResizeObserver(() => fit(false));
    ro.observe(svgRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mini]);
  useEffect(() => { if (!mini) fit(false); /* refit on student change */ // eslint-disable-next-line
  }, [fitKey]);

  const zoomBy = (f) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, f);

  const stationsInOrder = map.events;
  const content = (
    <>
      {/* Timetable */}
      {!mini && (
        <g className="timetable">
          {L.columns.map((c, i) => (
            <g key={i}>
              <rect x={c.x} y={0} width={c.w} height={L.height} className={c.grade % 2 ? 'col col-a' : 'col col-b'} />
              <text x={c.x + c.w / 2} y={66} className="term-label" textAnchor="middle">T{c.term}</text>
            </g>
          ))}
          {[0, 1, 2, 3].map((g) => {
            const a = L.columns[g * 3], b = L.columns[g * 3 + 2];
            const cx = (a.x + b.x + b.w) / 2;
            return (
              <g key={g}>
                <line x1={a.x} x2={a.x} y1={0} y2={L.height} className="grade-rule" />
                <text x={cx} y={30} textAnchor="middle" className="grade-label">Grade {9 + g}</text>
                <text x={cx} y={46} textAnchor="middle" className="year-label">{GRADE_YEARS(map.student.g9StartYear, 9 + g)}</text>
              </g>
            );
          })}
          <line x1={L.columns[0].x} x2={L.columns[11].x + L.columns[11].w} y1={80} y2={80} className="grade-rule" />
        </g>
      )}
      {mini && L.columns.filter((c, i) => i % 3 === 0).map((c, i) => <line key={i} x1={c.x} x2={c.x} y1={0} y2={L.height} className="grade-rule" />)}

      {showToday && (
        <g className="today">
          <line x1={L.todayX} x2={L.todayX} y1={mini ? 0 : 84} y2={L.height} />
          {!mini && <text x={L.todayX} y={L.height - 12} textAnchor="middle">Today</text>}
        </g>
      )}

      {/* Line names */}
      {!mini && map.lines.map((l) => {
        const ln = L.lines[l.id];
        return (
          <g key={l.id} className="line-name" style={{ opacity: ln.state === 'hidden' ? 0 : ln.state === 'thin' ? 0.5 : 1 }} transform={`translate(16 ${ln.y})`}>
            <rect x={0} y={-11} width={22} height={22} rx={11} fill={l.colour} opacity={l.status === 'ended' ? 0.5 : 1} />
            <text x={30} y={l.status === 'ended' ? -1 : 4} className="line-name-text">{l.name}</text>
            {l.status === 'ended' && <text x={30} y={12} className="line-name-sub">ended</text>}
            {l.parentLineId && l.status !== 'ended' && <text x={30} y={17} className="line-name-sub">branch of {lineById[l.parentLineId]?.name.split(' ·')[0] || l.parentLineId}</text>}
          </g>
        );
      })}

      {/* Lines */}
      {map.lines.map((l) => {
        const ln = L.lines[l.id];
        if (ln.opacity < 0.01 || ln.width < 0.2) return null;
        const { segs, terminus, start } = lineSegments(l.id, L, eventsById);
        return (
          <g key={l.id} className="line" style={{ opacity: ln.opacity }}>
            {segs.map((s, i) => (
              <path key={i} d={s.d} stroke={l.colour} strokeWidth={ln.width} fill="none" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={s.dashed ? `${ln.width * 1.4} ${ln.width * 1.3}` : undefined} />
            ))}
            {terminus && <line x1={terminus.x} x2={terminus.x} y1={terminus.y - ln.width * 1.8} y2={terminus.y + ln.width * 1.8} stroke={l.colour} strokeWidth={ln.width} strokeLinecap="round" />}
            {!mini && terminus && <Signal x={terminus.x + 16} y={terminus.y} />}
            {!mini && start && ln.state === 'full' && <Signal x={start.x} y={start.y} />}
          </g>
        );
      })}

      {/* Stations */}
      {stationsInOrder.map((e) => {
        const s = L.stations[e.id];
        if (!s || s.opacity < 0.02) return null;
        const isNew = newIds?.has(e.id);
        const firstLine = e.lineIds.find((id) => lens.lineState[id] !== 'hidden') || e.lineIds[0];
        const colour = lineById[firstLine]?.colour;
        const isGoal = e.type === 'goal';
        const thin = s.emphasis === 'thin';
        const r = mini ? 9 : thin ? 4 : 6.5;
        const labelRows = wrap(e.title);
        const above = labelSide[e.id] === 'above';
        const top = s.interchange ? s.capsule.y1 : s.y - r;
        const bottom = s.interchange ? s.capsule.y2 : s.y + r;
        const labelY = above ? top - 10 - (labelRows.length - 1) * 14 : bottom + 17;
        return (
          <g key={e.id} className={`station${isNew ? ' station-enter' : ''}${selectedId === e.id ? ' selected' : ''}`} style={{ opacity: s.opacity }}
            onClick={onSelect ? (ev) => { ev.stopPropagation(); onSelect(e.id); } : undefined}
            onKeyDown={onSelect ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(e.id); } } : undefined}
            tabIndex={onSelect && !mini ? 0 : undefined} role={onSelect && !mini ? 'button' : undefined} aria-label={onSelect ? `${e.title}, ${e.date}` : undefined}>
            <g className="station-body">
              {selectedId === e.id && (s.interchange
                ? <rect x={s.x - 15} y={s.capsule.y1 - 6} width={30} height={s.capsule.y2 - s.capsule.y1 + 12} rx={15} className="sel-ring" />
                : <circle cx={s.x} cy={s.y} r={r + 7} className="sel-ring" />)}
              {!mini && <circle cx={s.x} cy={s.y} r={22} className="hit" />}
              {s.interchange
                ? <rect x={s.x - 9} y={s.capsule.y1} width={18} height={s.capsule.y2 - s.capsule.y1} rx={9} className="interchange" />
                : <circle cx={s.x} cy={s.y} r={r} className={isGoal ? 'stop goal' : 'stop'} stroke={colour} strokeWidth={mini ? 5 : thin ? 2 : 3.5} />}
              {!mini && !thin && !isGoal && <VerificationMark level={e.verification} x={s.x + (s.interchange ? 12 : 9)} y={top - 1} />}
              {isNew && !mini && <circle cx={s.x} cy={s.y} r={10} className="pulse" stroke={colour} />}
            </g>
            {!mini && !thin && (
              <text className={`station-label${isGoal ? ' goal-label' : ''}`} textAnchor="middle" x={s.x} y={labelY}>
                {labelRows.map((row, i) => <tspan key={i} x={s.x} dy={i ? 14 : 0}>{row}</tspan>)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );

  if (mini) {
    return (
      <svg className={`metro mini ${className}`} viewBox={`0 0 ${L.width} ${L.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Mini map for ${map.student.name}`}>
        {content}
      </svg>
    );
  }
  return (
    <div className={`metro-wrap ${className}`}>
      <svg ref={svgRef} className="metro" onClick={() => onSelect?.(null)} role="group" aria-label={`Metro map for ${map.student.name}`}>
        <g ref={gRef}>{content}</g>
      </svg>
      <div className="zoom-ctl" aria-label="Zoom">
        <button onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button>
        <button onClick={() => fit()} aria-label="Fit map" className="fit">Fit</button>
      </div>
      <span className="sr-only">Zoom {Math.round(k * 100)}%</span>
    </div>
  );
}

function Signal({ x, y }) {
  return (
    <g className="signal" transform={`translate(${x} ${y})`} aria-hidden="true">
      <line x1={0} y1={6} x2={0} y2={-6} />
      <rect x={-4} y={-15} width={8} height={11} rx={3} />
      <circle cx={0} cy={-11.5} r={1.8} className="signal-lamp" />
      <circle cx={0} cy={-7.5} r={1.8} className="signal-lamp2" />
    </g>
  );
}
