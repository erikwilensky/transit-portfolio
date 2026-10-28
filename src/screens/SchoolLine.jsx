import { useState } from 'react';
import { getSchoolLines, getStudent, getLine, rootLine, schoolEvents, TODAY } from '../api.js';
import { fmtDate } from '../format.js';

const T0 = new Date('2023-08-01').getTime(), T1 = new Date('2026-11-15').getTime();
const YEARS = ['2023', '2024', '2025', '2026'];

// K2: one school line, every student's track stacked into one metro. Where and when the school's work on it happens.
export default function SchoolLine({ version }) {
  const lines = getSchoolLines();
  const [lineId, setLineId] = useState('environment');
  const [hover, setHover] = useState(null);
  const line = lines.find((l) => l.id === lineId);
  const evs = schoolEvents().filter((e) => e.lineIds.some((id) => rootLine(id) === lineId));
  const byStudent = {};
  for (const e of evs) (byStudent[e.studentId] ||= []).push(e);
  const rows = Object.entries(byStudent).map(([sid, list]) => ({ s: getStudent(sid), list: list.sort((a, b) => a.date.localeCompare(b.date)) })).sort((a, b) => a.list[0].date.localeCompare(b.list[0].date));
  const W = 1000, L = 150, R = 20, top = 40, rowH = 38, H = top + rows.length * rowH + 30;
  const x = (d) => L + ((new Date(d).getTime() - T0) / (T1 - T0)) * (W - L - R);
  const counts = lines.map((l) => ({ l, n: schoolEvents().filter((e) => e.lineIds.some((id) => rootLine(id) === l.id)).length }));
  const others = (e) => e.lineIds.map((id) => rootLine(id)).filter((id) => id !== lineId);

  return (
    <div className="page sline">
      <header className="page-head">
        <div>
          <div className="kicker">One line across the school</div>
          <h1>{line.name}, every student at once</h1>
          <p>Each track is one student's {line.name} line. White pills are interchanges with another line. Only items students made visible to the school appear.</p>
        </div>
      </header>
      <div className="chips">{counts.map(({ l, n }) => <button key={l.id} className={`line-chip${l.id === lineId ? '' : ' off'}`} style={{ '--c': l.colour }} aria-pressed={l.id === lineId} onClick={() => setLineId(l.id)}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name} <small>{n}</small></button>)}</div>
      <div className="sl-wrap card-sec">
        {!rows.length ? <p className="fineprint">No students have school-visible stations on this line yet.</p> : (
          <svg viewBox={`0 0 ${W} ${H}`} className="sl-svg" role="img" aria-label={`${line.name} line for ${rows.length} students`}>
            {YEARS.map((y) => <g key={y}><line x1={x(`${y}-08-01`)} x2={x(`${y}-08-01`)} y1={top - 18} y2={H - 20} className="sl-year" /><text x={x(`${y}-08-01`) + 4} y={top - 22} className="sl-axis">{y}–{String(+y + 1).slice(2)}</text></g>)}
            {rows.map(({ s, list }, i) => {
              const y = top + i * rowH + rowH / 2;
              return (
                <g key={s.id}>
                  <text x={L - 12} y={y + 4} textAnchor="end" className="sl-name">{s.name}<tspan className="sl-g"> Y{s.grade + 1}</tspan></text>
                  <path d={`M${x(list[0].date)} ${y} H${x(list.at(-1).date)}`} stroke={line.colour} strokeWidth="7" strokeLinecap="round" />
                  {list.map((e) => { const o = others(e); const cx = x(e.date); return o.length
                    ? <g key={e.id} onPointerEnter={() => setHover({ e, s, cx, y })} onPointerLeave={() => setHover(null)}><rect x={cx - 6} y={y - 10} width={12} height={20} rx={6} fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />{o.slice(0, 1).map((id) => <rect key={id} x={cx - 2} y={y + 12} width={4} height={8} rx={2} fill={getLine(id)?.colour} />)}</g>
                    : <circle key={e.id} cx={cx} cy={y} r={5.5} fill="var(--surface)" stroke={line.colour} strokeWidth="3" onPointerEnter={() => setHover({ e, s, cx, y })} onPointerLeave={() => setHover(null)} />; })}
                </g>
              );
            })}
            <line x1={x(TODAY)} x2={x(TODAY)} y1={top - 18} y2={H - 20} className="sl-today" />
            <text x={x(TODAY)} y={H - 6} textAnchor="middle" className="sl-axis">TODAY</text>
          </svg>
        )}
        {hover && <div className="tip sl-tip" style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}><b>{hover.e.title}</b><small>{hover.s.name} · {fmtDate(hover.e.date)}{others(hover.e).length ? ` · meets ${others(hover.e).map((id) => getLine(id)?.name).join(', ')}` : ''}</small></div>}
      </div>
      <p className="fineprint">{rows.length} students, {evs.length} stations, {evs.filter((e) => others(e).length).length} interchanges with other lines.</p>
    </div>
  );
}
