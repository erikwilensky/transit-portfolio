import { useMemo, useState } from 'react';
import { applyLens, getStudent, getStudentMap, getTeacher, TERM_START, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import MetroMap from '../components/MetroMap.jsx';
import StationPanel from '../components/StationPanel.jsx';
import Logo from '../components/Logo.jsx';

// A5: a short-lived, advisor-made link for parents. Publishable items only.
export default function ParentView({ studentId }) {
  const s = getStudent(studentId);
  const map = useMemo(() => s && getStudentMap(studentId, 'public'), [studentId, s]);
  const lens = useMemo(() => map && applyLens(map, null), [map]);
  const [sel, setSel] = useState(null);
  if (!map) return <div className="link-dead"><h2>This link does not exist</h2></div>;
  const adv = getTeacher(s.advisorId);
  const first = s.name.split(' ')[0];
  const term = map.events.filter((e) => e.date >= TERM_START && e.date <= TODAY && e.type !== 'reflection');
  return (
    <div className="landing parent">
      <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Transit Portfolio</span><span className="spacer" /><span className="lb-meta">For {first}’s family</span></header>
      <div className="landing-banner"><span><b>Parent conference</b> with {adv?.name}</span><span>Link works until {fmtDate('2026-11-02')}</span><span className="spacer" /><span>Shows only what {first} chose to make public</span></div>
      <div className="pv-body">
        <section className="pv-intro">
          <h1>{s.name}’s map</h1>
          <p>Each coloured line is something {first} has followed through school. Dots are things that happened; tap one to see it.</p>
          <h3>This term</h3>
          {term.length ? <ul>{term.map((e) => <li key={e.id}><button className="linkish" onClick={() => setSel(e.id)}>{e.title}</button> <small>{fmtDate(e.date)}</small></li>)}</ul> : <p className="fineprint">Nothing public this term yet.</p>}
          <h3>Questions you might ask</h3>
          <ul><li>Which line are you most proud of?</li><li>Is there a line you want to start, or stop?</li><li>What would you like help with next term?</li></ul>
        </section>
        <div className="pv-map">
          <MetroMap map={map} lens={lens} selectedId={sel} onSelect={setSel} fitKey={`pv-${studentId}`} />
          <StationPanel event={map.events.find((e) => e.id === sel)} map={map} onClose={() => setSel(null)} readOnly />
        </div>
      </div>
    </div>
  );
}
