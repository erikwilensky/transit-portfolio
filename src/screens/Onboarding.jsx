import { useEffect, useState } from 'react';
import { completeOnboarding, getSchoolLines, STARTERS, hasStarters } from '../api.js';

const TEMPLATES = [['postcard', 'Postcard', 'One photo and a sentence per line. Good for family.'], ['scrapbook', 'Scrapbook', 'Photos first, a few words under each.'], ['poster', 'Poster', 'Big title, your lines as colourful bands.']];
const INTEREST = { science: 'Experiments', computing: 'Coding and games', environment: 'Nature and animals', sport: 'Sport', service: 'Helping people', music: 'Music', design: 'Making things', languages: 'Languages', art: 'Art and drawing' };

// S9: a Year 7 student's first week. Pick interests, see starter lines, watch the first stations arrive, pick a look.
export default function Onboarding({ map, studentId, onDone }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState([]);
  const [arrived, setArrived] = useState(0);
  const [tpl, setTpl] = useState('postcard');
  const lines = getSchoolLines();
  const chosen = picked.map((id) => lines.find((l) => l.id === id));
  useEffect(() => {
    if (step !== 2) return undefined;
    setArrived(0);
    const t = setInterval(() => setArrived((n) => (n >= picked.length ? n : n + 1)), 700);
    return () => clearInterval(t);
  }, [step, picked.length]);
  const s = map.student;
  return (
    <div className="onboard">
      <div className="ob-card">
        <div className="ob-steps" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
        {step === 0 && (
          <>
            <div className="kicker">Welcome, {s.name.split(' ')[0]}</div>
            <h1>What do you enjoy?</h1>
            <p>Pick two to four. Each one becomes a line on your map. You can add or stop lines any time.</p>
            <div className="ob-picks">{lines.map((l) => { const on = picked.includes(l.id); return (
              <button key={l.id} className={`ob-pick${on ? ' on' : ''}`} style={{ '--c': l.colour }} aria-pressed={on} disabled={!on && picked.length >= 4} onClick={() => setPicked(on ? picked.filter((x) => x !== l.id) : [...picked, l.id])}>
                <i /><b>{INTEREST[l.id] || l.name}</b><small>{l.name} line</small>
              </button>
            ); })}</div>
            <div className="ob-foot"><span className="spacer" /><button className="primary" disabled={picked.length < 2} onClick={() => setStep(1)}>Next</button></div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="kicker">Your starter lines</div>
            <h1>This is your map</h1>
            <p>It starts in Year 7 and grows until you graduate. Every time you do something, a station appears on a line.</p>
            <svg className="ob-map" viewBox={`0 0 640 ${40 + chosen.length * 54}`} role="img" aria-label="Starter lines">
              {['Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'].map((g, i) => <text key={g} x={90 + i * 80} y={18} className="ob-g">{g}</text>)}
              {chosen.map((l, i) => { const y = 50 + i * 54; return (
                <g key={l.id}><path d={`M90 ${y} H150`} stroke={l.colour} strokeWidth="9" strokeLinecap="round" className="ob-line" style={{ animationDelay: `${i * 0.2}s` }} /><path d={`M150 ${y} H610`} stroke={l.colour} strokeWidth="5" strokeDasharray="2 10" strokeLinecap="round" opacity=".55" /><text x={8} y={y + 4} className="ob-l">{l.name}</text></g>
              ); })}
            </svg>
            <div className="ob-foot"><button className="ghost" onClick={() => setStep(0)}>Back</button><span className="spacer" /><button className="primary" onClick={() => setStep(hasStarters() ? 2 : 3)}>Next</button></div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="kicker">Your first stations</div>
            <h1>You have already started</h1>
            <p>The school's systems know a few things you did this term. They arrive on your lines by themselves, already verified.</p>
            <ul className="ob-arrive">{chosen.map((l, i) => { const st = STARTERS[l.id]; return (
              <li key={l.id} className={i < arrived ? 'in' : ''} style={{ '--c': l.colour }}><i /><span><b>{st.title}</b><small>from {st.source.system} · {l.name}</small></span>{i < arrived && <em>✓ verified</em>}</li>
            ); })}</ul>
            <div className="ob-foot"><button className="ghost" onClick={() => setStep(1)}>Back</button><span className="spacer" /><button className="primary" disabled={arrived < picked.length} onClick={() => setStep(3)}>Next</button></div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="kicker">How it looks to others</div>
            <h1>Pick a simple look</h1>
            <p>When you want to show your map to family, it uses this. Everything stays inside the school until a parent says yes.</p>
            <div className="ob-tpls">{TEMPLATES.map(([k, l, d]) => (
              <button key={k} className={`ob-tpl t-${k}${tpl === k ? ' on' : ''}`} onClick={() => setTpl(k)} aria-pressed={tpl === k}>
                <span className="ob-thumb">{chosen.map((c) => <i key={c.id} style={{ background: c.colour }} />)}</span><b>{l}</b><small>{d}</small>
              </button>
            ))}</div>
            <div className="ob-foot"><button className="ghost" onClick={() => setStep(hasStarters() ? 2 : 1)}>Back</button><span className="spacer" /><button className="primary" onClick={() => { completeOnboarding(studentId, picked, tpl); onDone(); }}>Go to my map</button></div>
          </>
        )}
      </div>
    </div>
  );
}
