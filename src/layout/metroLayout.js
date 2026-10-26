// Turns a student's lines + events into map geometry.
// x: time axis snapped to term columns. y: each line has a home lane.
// Interchanges pull their lines to a shared y; the path builder draws
// 0/45/90-degree connectors between consecutive stations.

export const TERMS_PER_YEAR = 3;
export const GRADES = [9, 10, 11, 12];

export function termOf(date, g9StartYear) {
  const [y, m] = date.split('-').map(Number);
  const academicYear = m >= 8 ? y : y - 1;
  const t = m >= 8 && m <= 11 ? 0 : m === 12 || m <= 3 ? 1 : 2;
  return Math.max(0, Math.min(11, (academicYear - g9StartYear) * 3 + t));
}

const DEFAULTS = { laneH: 92, slotW: 60, colPad: 24, emptyW: 46, left: 196, top: 118, right: 70, bottom: 64, gap: 14 };

export function computeLayout(map, lens, today, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { lineState, visible, order } = lens;
  const lineById = Object.fromEntries(map.lines.map((l) => [l.id, l]));
  const shown = (id) => lineState[id] && lineState[id] !== 'hidden';

  // Lanes: visible lines stack; hidden lines collapse onto their neighbour.
  const lanes = {};
  let idx = -1;
  for (const id of order) {
    if (shown(id)) idx++;
    lanes[id] = Math.max(idx, 0);
  }
  const laneCount = Math.max(idx + 1, 1);
  const laneY = (id) => o.top + lanes[id] * o.laneH;

  const events = map.events;
  const term = Object.fromEntries(events.map((e) => [e.id, termOf(e.date, map.student.g9StartYear)]));

  // Slot assignment inside each term column.
  const slotOf = {};
  const slotsPerTerm = Array(12).fill(0);
  const firstOnLine = {};
  for (const e of events) for (const l of e.lineIds) if (visible.has(e.id) && !firstOnLine[l]) firstOnLine[l] = e.id;
  for (let t = 0; t < 12; t++) {
    const inTerm = events.filter((e) => term[e.id] === t && visible.has(e.id));
    const lastSlot = {};
    const slots = [];
    for (const e of inTerm) {
      const ls = e.lineIds.filter(shown).map((l) => lanes[l]);
      const span = [Math.min(...ls), Math.max(...ls)];
      let min = 0;
      for (let k = span[0]; k <= span[1]; k++) if (lastSlot[k] !== undefined) min = Math.max(min, lastSlot[k] + 1);
      // A branch needs room to peel away from its parent.
      for (const l of e.lineIds) {
        const line = lineById[l];
        if (firstOnLine[l] === e.id && line?.parentLineId && shown(line.parentLineId)) {
          const p = lastSlot[lanes[line.parentLineId]];
          if (p !== undefined) min = Math.max(min, p + 2);
        }
      }
      let s = min;
      while ((slots[s] || []).some((b) => Math.max(span[0] - b[1], b[0] - span[1]) < 2)) s++;
      (slots[s] = slots[s] || []).push(span);
      for (let k = span[0]; k <= span[1]; k++) lastSlot[k] = s;
      slotOf[e.id] = s;
    }
    slotsPerTerm[t] = slots.length;
  }

  // Columns.
  const columns = [];
  let x = o.left;
  for (let t = 0; t < 12; t++) {
    const n = slotsPerTerm[t];
    const w = n ? n * o.slotW + o.colPad : o.emptyW;
    columns.push({ x, w, grade: GRADES[Math.floor(t / 3)], term: (t % 3) + 1 });
    x += w;
  }
  const width = x + o.right;
  const height = o.top + (laneCount - 1) * o.laneH + o.bottom;

  // Stations.
  const stations = {};
  const lastXOnLine = {};
  for (const e of events) {
    const col = columns[term[e.id]];
    const isVisible = visible.has(e.id);
    const vis = e.lineIds.filter(shown).sort((a, b) => lanes[a] - lanes[b]);
    let sx;
    if (isVisible) sx = col.x + o.colPad / 2 + o.slotW / 2 + slotOf[e.id] * o.slotW;
    else sx = Math.max(col.x + 2, ...e.lineIds.map((l) => (lastXOnLine[l] ?? 0) + 0.5));
    for (const l of e.lineIds) lastXOnLine[l] = sx;
    const lineYs = {};
    for (const l of e.lineIds) lineYs[l] = laneY(l);
    const interchange = isVisible && vis.length > 1;
    let capsule = null;
    if (interchange) {
      const mean = vis.reduce((s, l) => s + laneY(l), 0) / vis.length;
      vis.forEach((l, j) => (lineYs[l] = mean + (j - (vis.length - 1) / 2) * o.gap));
      capsule = { y1: lineYs[vis[0]] - 10, y2: lineYs[vis.at(-1)] + 10 };
    }
    const emphasis = vis.some((l) => lineState[l] === 'full') ? 'full' : 'thin';
    stations[e.id] = {
      x: sx, y: interchange ? (capsule.y1 + capsule.y2) / 2 : laneY(vis[0] || e.lineIds[0]),
      lineYs, interchange, capsule: capsule || { y1: 0, y2: 0 },
      opacity: isVisible ? (emphasis === 'full' ? 1 : 0.55) : 0, emphasis, visible: isVisible,
    };
  }

  // Lines.
  const lines = {};
  for (const l of map.lines) {
    const evs = events.filter((e) => e.lineIds.includes(l.id));
    const st = lineState[l.id] || 'hidden';
    const ended = l.status === 'ended';
    let branchFrom = null;
    const firstVisible = evs.find((e) => visible.has(e.id)) || evs[0];
    if (l.parentLineId && lineById[l.parentLineId] && firstVisible) {
      const parentEvs = events.filter((e) => e.lineIds.includes(l.parentLineId) && e.date < firstVisible.date && !e.lineIds.includes(l.id));
      // Branch from the parent's last station before the split (a hidden one still sits on the parent's track).
      if (parentEvs.length) branchFrom = parentEvs.at(-1).id;
    }
    lines[l.id] = {
      y: laneY(l.id), state: st, ended, branchFrom, parentId: l.parentLineId, stationIds: evs.map((e) => e.id),
      width: st === 'full' ? (o.mini ? 16 : 8) : st === 'thin' ? (o.mini ? 6 : 3) : 0,
      opacity: st === 'hidden' ? 0 : (ended ? 0.42 : 1) * (st === 'thin' ? 0.45 : 1),
    };
  }

  // Today marker: between the last past station and the first future one.
  const vs = events.filter((e) => visible.has(e.id));
  const past = vs.filter((e) => e.date <= today).map((e) => stations[e.id].x);
  const future = vs.filter((e) => e.date > today).map((e) => stations[e.id].x);
  const a = past.length ? Math.max(...past) : o.left;
  const b = future.length ? Math.min(...future) : a + o.slotW;
  const todayX = b > a ? (a + b) / 2 : a + 24;

  return { width, height, columns, stations, lines, todayX, laneCount };
}

// ── Path building (runs every animation frame on tweened geometry) ─────
function connector(p, q) {
  const dy = q.y - p.y;
  if (Math.abs(dy) < 0.5) return `L${q.x},${q.y}`;
  const d = Math.abs(dy);
  const dx = q.x - p.x;
  if (dx <= d + 2) return `L${q.x},${q.y}`;
  const pad = Math.min(14, (dx - d) / 2);
  if (q.bent && !p.bent) return `L${q.x - pad - d},${p.y}L${q.x - pad},${q.y}L${q.x},${q.y}`;
  if (p.bent && !q.bent) return `L${p.x + pad},${p.y}L${p.x + pad + d},${q.y}L${q.x},${q.y}`;
  if (p.branch) return `L${p.x + d},${q.y}L${q.x},${q.y}`;
  const mid = (p.x + q.x) / 2;
  return `L${mid - d / 2},${p.y}L${mid + d / 2},${q.y}L${q.x},${q.y}`;
}

// Returns [{d, dashed}] segments for one line.
export function lineSegments(lineId, layout, eventsById) {
  const line = layout.lines[lineId];
  const pts = line.stationIds.map((id) => {
    const s = layout.stations[id];
    const y = s.lineYs[lineId] ?? line.y;
    return { x: s.x, y, bent: Math.abs(y - line.y) > 0.5, goal: eventsById[id]?.type === 'goal' };
  });
  if (line.branchFrom && layout.stations[line.branchFrom]) {
    const s = layout.stations[line.branchFrom];
    pts.unshift({ x: s.x, y: s.lineYs[line.parentId] ?? s.y, bent: false, branch: true });
  }
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    segs.push({ d: `M${pts[i - 1].x},${pts[i - 1].y}${connector(pts[i - 1], pts[i])}`, dashed: pts[i].goal });
  }
  const last = pts.at(-1);
  const terminus = line.ended && last ? { x: last.x + 20, y: last.y } : null;
  if (terminus) segs.push({ d: `M${last.x},${last.y}L${terminus.x},${terminus.y}`, dashed: false });
  const start = line.branchFrom && pts[1] ? { x: pts[0].x + Math.abs(pts[1].y - pts[0].y) / 2 + 14, y: (pts[0].y + pts[1].y) / 2 + 6 } : null;
  return { segs, terminus, start };
}
