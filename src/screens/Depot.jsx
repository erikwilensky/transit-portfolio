import { useState } from 'react';
import { getLine, getStudent, rootLine, schoolEvents, TODAY } from '../api.js';
import { fmtDate, TYPE_LABEL } from '../format.js';
import { VerifyBadge } from '../components/Badge.jsx';

// A class is a depot: one building that many students' stations leave from.
const CLASSES = [
  { id: 'ibcs', name: 'Computer Science', sub: 'MYP 5, IB SL and HL', from: '2025-08-01', to: TODAY, enrol: /^Started (IB|MYP) Computer Science/ },
  { id: 'y10', name: 'Year 10 Computing', sub: 'MYP Design: digital · Year 10', from: '2023-08-01', to: '2025-07-31' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// T3: every station the class produced, across students, drawn as tracks leaving one depot.
export default function Depot({ version }) {
  const [classId, setClassId] = useState('ibcs');
  const [sel, setSel] = useState(null);
  const cls = CLASSES.find((c) => c.id === classId);
  const comp = getLine('computing');
  const evs = schoolEvents().filter((e) => e.lineIds.some((id) => rootLine(id) === 'computing') && e.date >= cls.from && e.date <= cls.to && e.type !== 'reflection');
  const enrolled = cls.enrol ? new Set(evs.filter((e) => cls.enrol.test(e.title)).map((e) => e.studentId)) : null;
  const byStudent = {};
  for (const e of evs) if (!enrolled || enrolled.has(e.studentId)) (byStudent[e.studentId] ||= []).push(e);
  const rows = Object.entries(byStudent).map(([sid, list]) => ({ s: getStudent(sid), list: list.sort((a, b) => a.date.localeCompare(b.date)) })).sort((a, b) => a.s.name.localeCompare(b.s.name));
  const count = rows.reduce((n, r) => n + r.list.length, 0);
  const W = 1000, DX = 180, L = 300, R = 30, top = 46, rowH = 54, H = Math.max(top + rows.length * rowH + 30, 260);
  const t0 = new Date(cls.from).getTime(), t1 = new Date(cls.to).getTime();
  const x = (d) => L + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const mid = top + (rows.length * rowH) / 2;
  const ticks = [];
  for (let d = new Date(cls.from); d <= new Date(cls.to); d.setMonth(d.getMonth() + 3)) ticks.push(d.toISOString().slice(0, 10));
  const selEv = sel && evs.find((e) => e.id === sel);
  return (
    <div className="page depot">
      <header className="page-head">
        <div>
          <div className="kicker">Class depot · Ms Priya Nair</div>
          <h1>Everything one class set in motion</h1>
          <p>Each track leaves the class and runs through the stations it produced on a student’s map. Where a track meets another subject, the station becomes an interchange.</p>
        </div>
        <div className="seg small" role="group" aria-label="Class">{CLASSES.map((c) => <button key={c.id} className={c.id === classId ? 'on' : ''} aria-pressed={c.id === classId} onClick={() => { setClassId(c.id); setSel(null); }}>{c.id === 'ibcs' ? 'Computer Science 2025–27' : c.name}</button>)}</div>
      </header>
      <div className="card-sec dp-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="dp-svg" role="img" aria-label={`${cls.name}: ${rows.length} students, ${count} stations`}>
          {ticks.map((d) => <g key={d}><line x1={x(d)} x2={x(d)} y1={top - 22} y2={H - 16} className="sl-year" /><text x={x(d) + 4} y={top - 26} className="sl-axis">{MONTHS[+d.slice(5, 7) - 1]} {d.slice(0, 4)}</text></g>)}
          <g className="dp-depot">
            <path className="dp-roof" d={`M20 ${mid - 40} L${DX / 2 + 10} ${mid - 78} L${DX} ${mid - 40} Z`} />
            <rect className="dp-house" x="20" y={mid - 40} width={DX - 20} height="86" rx="4" />
            <text x={DX / 2 + 10} y={mid - 14} textAnchor="middle" className="dp-name">{cls.name}</text>
            <text x={DX / 2 + 10} y={mid + 4} textAnchor="middle" className="dp-sub">{cls.sub}</text>
            <text x={DX / 2 + 10} y={mid + 26} textAnchor="middle" className="dp-sub">{rows.length} students · {count} stations</text>
          </g>
          {rows.map(({ s, list }, i) => {
            const y = top + i * rowH + rowH / 2, x0 = x(list[0].date);
            return (
              <g key={s.id}>
                <path d={`M${DX} ${mid} C${DX + 60} ${mid}, ${L - 60} ${y}, ${L} ${y} H${x0}`} stroke={comp.colour} strokeWidth={x0 - L > 30 ? 3 : 7} strokeDasharray={x0 - L > 30 ? '6 6' : undefined} fill="none" strokeLinecap="round" />
                <path d={`M${x0} ${y} H${x(list.at(-1).date)}`} stroke={comp.colour} strokeWidth="7" fill="none" strokeLinecap="round" />
                <text x={L + 2} y={y - 15} className="dp-who">{s.name.split(' ')[0]} <tspan className="sl-g">Y{s.grade + 1}</tspan></text>
                {list.map((e) => {
                  const others = [...new Set(e.lineIds.map(rootLine))].filter((r) => r !== 'computing');
                  const cx = Math.max(x(e.date), x0), on = sel === e.id;
                  return (
                    <g key={e.id} className="dp-stop" role="button" tabIndex={0} aria-label={`${e.title}, ${s.name}`} onClick={() => setSel(on ? null : e.id)} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), setSel(on ? null : e.id))}>
                      <circle cx={cx} cy={y} r="16" fill="transparent" />
                      {others.length
                        ? <><rect x={cx - 7} y={y - 11} width="14" height="22" rx="7" fill="var(--surface)" stroke="var(--ink)" strokeWidth={on ? 4 : 2.5} />{others.slice(0, 2).map((r, k) => <rect key={r} x={cx - 7 + k * 8} y={y + 14} width="6" height="5" rx="2" fill={getLine(r).colour} />)}</>
                        : <circle cx={cx} cy={y} r={on ? 8 : 6} fill="var(--surface)" stroke={comp.colour} strokeWidth="3.5" />}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {selEv ? (
        <div className="card-sec dp-detail">
          <div className="xl-top"><b>{selEv.title}</b><VerifyBadge level={selEv.verification} /></div>
          <small>{getStudent(selEv.studentId).name} · {TYPE_LABEL[selEv.type]} · {fmtDate(selEv.date)} · from {selEv.source?.system}</small>
          <p>{selEv.summary}</p>
          <div className="chips small">{[...new Set(selEv.lineIds.map(rootLine))].map((r) => <span key={r} className="line-chip static" style={{ '--c': getLine(r).colour }}><i className={getLine(r).pattern === 'cased' ? 'cased' : undefined} />{getLine(r).name}</span>)}</div>
        </div>
      ) : <p className="fineprint">Click a station to see what it is. White pills are interchanges, with a tick in the colour of the subject they meet. A dashed track means the student joined before their first station from this class.</p>}
    </div>
  );
}
