import { useState } from 'react';
import { getActivityList, getStudentMap, getStudents, rootLine, saveActivityList, TODAY } from '../api.js';
import { termOf } from '../layout/metroLayout.js';
import { VerifyBadge } from '../components/Badge.jsx';
import { fmtDate } from '../format.js';

const TYPES = ['Academic', 'Art', 'Athletics: Club', 'Athletics: JV/Varsity', 'Career-Oriented', 'Community Service (Volunteer)', 'Computer/Technology', 'Environmental', 'Foreign Language', 'Music: Instrumental', 'Research', 'Robotics', 'Science/Math', 'Other Club/Activity'];
const TYPE_BY_ROOT = { science: 'Science/Math', computing: 'Computer/Technology', environment: 'Environmental', sport: 'Athletics: JV/Varsity', service: 'Community Service (Volunteer)', music: 'Music: Instrumental', design: 'Other Club/Activity', languages: 'Foreign Language', art: 'Art' };
// Hand-tuned wording for Maya so the demo reads like a real list. Everyone else gets the generated draft.
const TUNED = {
  'maya-swim': ['Varsity swimmer, IM and relay anchor', 'NIST Varsity Swim Squad', 'Trained five mornings a week; 4th in the regional 200m IM. Cut back in Year 11 to make room for research and swam a last gala that spring.'],
  science: ['Independent Biology researcher', 'IB Biology HL, NIST International School', 'Designed an enzyme kinetics study and an IA modelling algae growth over 12 weeks; now writing an Extended Essay on dengue and weather.'],
  'maya-datasci': ['Self-taught data analyst', 'Online courses and school projects', 'Cleaned 40,000 sensor readings in Python and traced a lunchtime pollution spike to the canteen extractor, which the school then moved.'],
  computing: ['Lead developer, campus sensor network', 'NIST Computer Science and Youth Hackathon', 'Built six CO₂ and particulate sensors and the live dashboard facilities still check daily. Placed 2nd at a national youth hackathon.'],
  environment: ['Founder, campus air-quality project', 'Beach Guardians and NIST sustainability team', 'Led a litter survey team, planted mangroves, and turned sensor data into a report that changed where the canteen vents its air.'],
  service: ['Co-founder, STEM club for Year 7 girls', 'NIST CAS', 'Started a Friday club with a friend that now has 14 regular members; plan the sessions and tutor Year 8 science on Tuesdays.'],
};
const LIMIT = { position: 50, org: 100, desc: 150 };
const clip = (s, n) => { if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, c.lastIndexOf(' ')).replace(/[;,]$/, '') + '.'; };

function build(map) {
  const s = map.student;
  const evs = map.events.filter((e) => e.type !== 'reflection' && e.type !== 'goal' && e.date <= TODAY);
  return map.lines.map((l) => {
    const on = evs.filter((e) => e.lineIds.includes(l.id));
    if (!on.length) return null;
    const years = [...new Set(on.map((e) => 10 + Math.floor(termOf(e.date, s.g9StartYear, 9) / 3)))].filter((y) => y >= 10 && y <= 13).sort();
    const [position, org, desc] = TUNED[l.id] || [`${l.name} member`, 'NIST International School', clip(on.slice(-4).map((e) => e.title).join('; ') + '.', 150)];
    return { id: l.id, include: true, type: TYPE_BY_ROOT[rootLine(l.id)] || 'Other Club/Activity', position, org, desc, years, hours: Math.min(10, 1 + Math.ceil(on.length / 2)), weeks: l.status === 'ended' ? 20 : 32, stations: on.map((e) => e.id) };
  }).filter(Boolean).sort((a, b) => b.stations.length - a.stations.length).slice(0, 10);
}
const asText = (list) => list.filter((a) => a.include).map((a, i) => `${i + 1}. ${a.type}\n${a.position}\n${a.org}\n${a.desc}\nYears ${a.years.join(', ')} · ${a.hours} hr/wk · ${a.weeks} wk/yr`).join('\n\n');

// C3: a Common App style list of 10 activities, drafted from the map, with the character limits enforced as you type.
export default function ActivitiesList({ toast, version }) {
  const seniors = getStudents({ includeCohort: true }).filter((s) => s.grade === 12).sort((a, b) => a.name.localeCompare(b.name));
  const [sid, setSid] = useState('st-01');
  const [open, setOpen] = useState(null);
  const map = getStudentMap(sid, 'school');
  const list = getActivityList(sid) || build(map);
  const set = (i, patch) => saveActivityList(sid, list.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const move = (i, d) => { const l = [...list]; [l[i], l[i + d]] = [l[i + d], l[i]]; saveActivityList(sid, l); };
  const over = list.filter((a) => a.include && (a.desc.length > LIMIT.desc || a.position.length > LIMIT.position || a.org.length > LIMIT.org)).length;
  const byId = Object.fromEntries(map.events.map((e) => [e.id, e]));
  const copy = () => { try { navigator.clipboard.writeText(asText(list)); } catch { /* clipboard blocked */ } toast('Copied the activities list'); };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([asText(list)], { type: 'text/plain' })); a.download = `${map.student.name.replace(/\s+/g, '-')}-activities.txt`; a.click(); };
  const Count = ({ v, n }) => <small className={`cc${v.length > n ? ' over' : v.length > n * 0.9 ? ' near' : ''}`}>{v.length}/{n}</small>;
  return (
    <div className="page actlist">
      <header className="page-head">
        <div>
          <div className="kicker">Activities list · Common App format</div>
          <h1>Ten activities, drafted from the map</h1>
          <p>Each activity is one line on the student’s map, with its stations as the evidence. Edit the wording, reorder, and copy it straight into the application.</p>
        </div>
        <label className="al-pick">Student <select value={sid} onChange={(e) => setSid(e.target.value)}>{seniors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </header>
      <div className="al-bar">
        <span>{list.filter((a) => a.include).length} of 10 slots used</span>
        {over > 0 ? <span className="warn">{over} over the character limit</span> : <span className="ok">All within the limits</span>}
        <span className="spacer" />
        <button className="ghost" onClick={() => saveActivityList(sid, build(map))}>Rebuild from map</button>
        <button className="ghost" onClick={download}>Download .txt</button>
        <button className="primary" onClick={copy}>Copy list</button>
      </div>
      <ol className="al-list">
        {list.map((a, i) => {
          const evs = a.stations.map((id) => byId[id]).filter(Boolean);
          const verified = evs.filter((e) => e.verification !== 'student-added').length;
          return (
            <li key={a.id} className={`card-sec al-item${a.include ? '' : ' off'}`}>
              <div className="al-num">{i + 1}</div>
              <div className="al-fields">
                <div className="al-row">
                  <select aria-label="Activity type" value={a.type} onChange={(e) => set(i, { type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  <label className="al-inc"><input type="checkbox" checked={a.include} onChange={(e) => set(i, { include: e.target.checked })} /> Include</label>
                  <span className="spacer" />
                  <button className="ghost icon" aria-label="Move up" disabled={!i} onClick={() => move(i, -1)}>↑</button>
                  <button className="ghost icon" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
                </div>
                <label>Position or leadership<input value={a.position} onChange={(e) => set(i, { position: e.target.value })} /><Count v={a.position} n={LIMIT.position} /></label>
                <label>Organisation<input value={a.org} onChange={(e) => set(i, { org: e.target.value })} /><Count v={a.org} n={LIMIT.org} /></label>
                <label>Description<textarea rows={2} value={a.desc} onChange={(e) => set(i, { desc: e.target.value })} /><Count v={a.desc} n={LIMIT.desc} /></label>
                <div className="al-row al-small">
                  <span>Years</span>{[10, 11, 12, 13].map((y) => <label key={y} className="al-y"><input type="checkbox" checked={a.years.includes(y)} onChange={(e) => set(i, { years: e.target.checked ? [...a.years, y].sort() : a.years.filter((x) => x !== y) })} />{y}</label>)}
                  <label>Hours per week<input type="number" min="0" max="40" value={a.hours} onChange={(e) => set(i, { hours: +e.target.value })} /></label>
                  <label>Weeks per year<input type="number" min="0" max="52" value={a.weeks} onChange={(e) => set(i, { weeks: +e.target.value })} /></label>
                </div>
                <button className="linkish al-ev" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>Built from {evs.length} station{evs.length === 1 ? '' : 's'}, {verified} verified</button>
                {open === a.id && <ul className="al-evs">{evs.map((e) => <li key={e.id}><span>{e.title} <small>{fmtDate(e.date)}</small></span><VerifyBadge level={e.verification} /></li>)}</ul>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="fineprint">Drafted only from stations the student made visible to the school. Common App counts Grades 9 to 12, which are Years 10 to 13 here.</p>
    </div>
  );
}
