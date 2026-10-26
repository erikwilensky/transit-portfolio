import { useEffect, useMemo, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { computeLayout, lineSegments } from '../layout/metroLayout.js';
import { useTween } from '../hooks/useTween.js';
import { TODAY } from '../api.js';

// Station labels wrap onto up to three short rows instead of being cut off.
function wrap(text, max = 16) {
  const rows = [''];
  for (const w of text.split(' ')) {
    const cur = rows.at(-1);
    if (!cur || (cur + ' ' + w).length <= max) rows[rows.length - 1] = cur ? cur + ' ' + w : w;
    else if (rows.length < 3) rows.push(w);
    else { rows[2] = (rows[2] + ' ' + w).slice(0, max + 3) + '…'; break; }
  }
  return rows;
}
const CHAR_W = 6.9, ROW_H = 14;
const overlap = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

// Greedy label placement: try above/below and staggered offsets, keep the
// first spot that doesn't hit another label, a station, a signal or a line.
function placeLabels(map, target, lens) {
  const obstacles = [];
  const visible = map.events.filter((e) => target.stations[e.id].visible);
  for (const e of visible) {
    const s = target.stations[e.id];
    obstacles.push(s.interchange ? { x1: s.x - 12, x2: s.x + 12, y1: s.capsule.y1 - 3, y2: s.capsule.y2 + 3 } : { x1: s.x - 10, x2: s.x + 10, y1: s.y - 10, y2: s.y + 10 });
  }
  for (const l of map.lines) {
    const ln = target.lines[l.id];
    if (ln.state === 'hidden') continue;
    const xs = ln.stationIds.filter((id) => target.stations[id].visible).map((id) => target.stations[id].x);
    if (xs.length) obstacles.push({ x1: Math.min(...xs), x2: Math.max(...xs) + (ln.ended ? 40 : 0), y1: ln.y - 5, y2: ln.y + 5, line: true });
    if (ln.ended && xs.length) obstacles.push({ x1: Math.max(...xs) + 26, x2: Math.max(...xs) + 46, y1: ln.y - 22, y2: ln.y + 8 });
    const first = ln.stationIds.find((id) => target.stations[id].visible);
    if (ln.branchFrom && first && ln.state === 'full') {
      const a = target.stations[ln.branchFrom], b = target.stations[first];
      const ay = a.lineYs[ln.parentId] ?? a.y, by = b.lineYs[l.id] ?? b.y;
      const sx = a.x + Math.abs(by - ay) / 2 + 14, sy = (ay + by) / 2 + 6;
      obstacles.push({ x1: sx - 8, x2: sx + 8, y1: sy - 20, y2: sy + 8 });
    }
  }
  const placed = {};
  const boxes = [];
  const count = {};
  for (const e of [...visible].sort((a, b) => target.stations[a.id].x - target.stations[b.id].x)) {
    const s = target.stations[e.id];
    if (s.emphasis === 'thin') continue;
    const rows = wrap(e.title);
    const w = Math.max(...rows.map((r) => r.length)) * CHAR_W + 6;
    const h = rows.length * ROW_H + 2;
    const top = s.interchange ? s.capsule.y1 : s.y - 7;
    const bottom = s.interchange ? s.capsule.y2 : s.y + 7;
    const l = e.lineIds.find((id) => lens.lineState[id] !== 'hidden');
    count[l] = (count[l] || 0) + 1;
    const pref = s.interchange ? 'above' : count[l] % 2 ? 'below' : 'above';
    const alt = pref === 'above' ? 'below' : 'above';
    const box = (side, extra) => side === 'above'
      ? { x1: s.x - w / 2, x2: s.x + w / 2, y1: top - 8 - extra - h, y2: top - 6 - extra }
      : { x1: s.x - w / 2, x2: s.x + w / 2, y1: bottom + 6 + extra, y2: bottom + 8 + extra + h };
    let best = null;
    for (const [side, extra] of [[pref, 0], [alt, 0], [pref, 16], [alt, 16], [pref, 32], [alt, 32]]) {
      const b = box(side, extra);
      const cost = boxes.reduce((n, o) => n + overlap(b, o), 0) * 3 + obstacles.reduce((n, o) => n + overlap(b, o), 0) + extra * 2;
      if (!best || cost < best.cost) best = { side, extra, cost, b };
      if (cost === extra * 2) break;
    }
    boxes.push(best.b);
    placed[e.id] = { side: best.side, extra: best.extra, rows };
  }
  return placed;
}

export function VerificationMark({ level, x = 0, y = 0, r = 3.6 }) {
  if (level === 'school-verified') return <circle cx={x} cy={y} r={r} className="vmark vmark-solid" />;
  if (level === 'teacher-endorsed') return <circle cx={x} cy={y} r={r} className="vmark vmark-outline" />;
  return <circle cx={x} cy={y} r={r} className="vmark vmark-dotted" />;
}

const GRADE_YEARS = (start, g) => `${start + g - 9}–${String(start + g - 8).slice(2)}`;

export default function MetroMap({ map, lens, selectedId, onSelect, onSignal, mini = false, newIds, fitKey, duration = 450, showToday = true, className = '' }) {
  const target = useMemo(() => computeLayout(map, lens, TODAY, mini ? { laneH: 70, slotW: 40, colPad: 10, emptyW: 24, left: 20, top: 30, bottom: 30, right: 20 } : {}), [map, lens, mini]);
  const tweened = useTween(target, duration);
  // On the first frame after the data changes shape, the tween hasn't caught up yet.
  const L = Object.keys(target.lines).every((k) => k in tweened.lines) && Object.keys(target.stations).every((k) => k in tweened.stations) ? tweened : target;
  const eventsById = useMemo(() => Object.fromEntries(map.events.map((e) => [e.id, e])), [map]);
  const lineById = useMemo(() => Object.fromEntries(map.lines.map((l) => [l.id, l])), [map]);

  const labels = useMemo(() => placeLabels(map, target, lens), [map, target, lens]);

  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const [tr, setTr] = useState({ k: 1, x: 0, y: 0 });
  const k = tr.k;

  const fit = (animate = true) => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const { width: cw, height: ch } = svg.getBoundingClientRect();
    // Desktop: show the whole journey from Grade 9 when it can stay legible; phones keep a closer zoom.
    let s = Math.min(cw / target.width, ch / target.height);
    if (cw >= 900) s = Math.max(s, Math.min(cw / target.width, 1));
    s = Math.max(cw < 700 ? 0.6 : 0.5, Math.min(1.15, s));
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
      setTr({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y });
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

  // Keep the tapped station visible beside the side panel (or above the bottom sheet).
  useEffect(() => {
    if (mini || !selectedId || !zoomRef.current) return;
    const st = target.stations[selectedId];
    if (!st) return;
    const svg = svgRef.current;
    const { width: cw, height: ch } = svg.getBoundingClientRect();
    const phone = cw < 640;
    const visW = phone ? cw : cw - 410;
    const visH = phone ? ch * 0.28 : ch;
    const sx = tr.x + st.x * tr.k, sy = tr.y + st.y * tr.k;
    let dx = 0, dy = 0;
    if (sx < 60 || sx > visW - 60) dx = visW / 2 - sx;
    if (sy < 40 || sy > visH - 30) dy = visH / 2 - sy;
    if (dx || dy) select(svg).transition().duration(350).call(zoomRef.current.translateBy, dx / tr.k, dy / tr.k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
          {Array.from({ length: L.columns.length / 3 }, (_, g) => g).map((g) => {
            const a = L.columns[g * 3], b = L.columns[g * 3 + 2];
            const cx = (a.x + b.x + b.w) / 2;
            return (
              <g key={g}>
                <line x1={a.x} x2={a.x} y1={0} y2={L.height} className="grade-rule" />
                <text x={cx} y={30} textAnchor="middle" className="grade-label">Year {a.grade + 1}</text>
                <text x={cx} y={46} textAnchor="middle" className="year-label">{GRADE_YEARS(map.student.g9StartYear, a.grade)}</text>
              </g>
            );
          })}
          <line x1={L.columns[0].x} x2={L.columns.at(-1).x + L.columns.at(-1).w} y1={80} y2={80} className="grade-rule" />
        </g>
      )}
      {mini && L.columns.filter((c, i) => i % 3 === 0).map((c, i) => <line key={i} x1={c.x} x2={c.x} y1={0} y2={L.height} className="grade-rule" />)}

      {showToday && (
        <g className="today">
          <line x1={L.todayX} x2={L.todayX} y1={mini ? 0 : 84} y2={L.height} />
          {!mini && <text x={L.todayX} y={L.height - 12} textAnchor="middle">Today</text>}
        </g>
      )}

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
            {!mini && terminus && !map.signals && <Signal x={terminus.x + 16} y={terminus.y} />}
            {!mini && start && ln.state === 'full' && !map.signals && <Signal x={start.x} y={start.y} />}
            {!mini && map.signals?.filter((g) => g.lineId === l.id && g.kind !== 'prompt').map((g) => {
              const p = g.kind === 'branch' ? start : terminus && { x: terminus.x + 16, y: terminus.y };
              if (!p || (g.kind === 'branch' && ln.state !== 'full')) return null;
              return <Signal key={g.key} x={p.x} y={p.y} open={g.open} title={g.prompt} onClick={onSignal ? () => onSignal(g) : undefined} />;
            })}
          </g>
        );
      })}

      {/* Prompt signals an advisor attached to a station */}
      {!mini && map.signals?.filter((g) => g.kind === 'prompt').map((g) => {
        const s = L.stations[g.eventId];
        if (!s || s.opacity < 0.5) return null;
        const top = s.interchange ? s.capsule.y1 : s.y - 7;
        return <Signal key={g.key} x={s.x - 15} y={top - 2} open={g.open} title={g.prompt} onClick={onSignal ? () => onSignal(g) : undefined} />;
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
        const lp = labels[e.id] || { side: 'below', extra: 0, rows: wrap(e.title) };
        const labelRows = lp.rows;
        const above = lp.side === 'above';
        const top = s.interchange ? s.capsule.y1 : s.y - 7;
        const bottom = s.interchange ? s.capsule.y2 : s.y + 7;
        const labelY = above ? top - 10 - lp.extra - (labelRows.length - 1) * 14 : bottom + 18 + lp.extra;
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
              {!mini && !thin && !isGoal && <VerificationMark level={e.verification} x={s.x + (s.interchange ? 13 : 10)} y={top - 1} r={4.6} />}
              {isNew && !mini && <>
                <circle cx={s.x} cy={s.y} r={10} className="pulse" stroke={colour} />
                <circle cx={s.x} cy={s.y} r={14} className="new-ring" />
                <g className="new-tag" transform={`translate(${s.x - 18} ${s.y - 44})`}><rect width={36} height={18} rx={9} /><text x={18} y={13} textAnchor="middle">NEW</text></g>
              </>}
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
        {/* Line names stay pinned to the left edge while the map pans. */}
        <g className="gutter" transform={`translate(0 ${tr.y}) scale(${tr.k})`}>
          <rect x={0} y={0} width={172} height={L.height} className="gutter-bg" style={{ opacity: tr.x < -4 ? 1 : 0 }} />
      {map.lines.map((l) => {
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
        </g>
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

function Signal({ x, y, open = true, title, onClick }) {
  return (
    <g className={`signal${open ? ' open' : ' clear'}${onClick ? ' clickable' : ''}`} transform={`translate(${x} ${y})`}
      onClick={onClick ? (ev) => { ev.stopPropagation(); onClick(); } : undefined}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? `Reflection signal: ${title}` : undefined}
      onKeyDown={onClick ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick(); } } : undefined}>
      {title && <title>{title}</title>}
      {onClick && <circle cx={0} cy={-8} r={14} className="hit" />}
      <line x1={0} y1={6} x2={0} y2={-6} />
      <rect x={-4} y={-15} width={8} height={11} rx={3} />
      <circle cx={0} cy={-11.5} r={1.8} className="signal-lamp" />
      <circle cx={0} cy={-7.5} r={1.8} className="signal-lamp2" />
    </g>
  );
}
