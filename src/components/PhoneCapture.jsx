import { useState } from 'react';
import { capturePhone } from '../api.js';

const SHOTS = [['hackathon-1st', 'Results board'], ['stem-club', 'Club session'], ['beach-cleanup', 'Beach cleanup'], ['mural', 'Mural']];

// A phone frame: snap a photo, add one line, and it lands in the inbox (X8).
export default function PhoneCapture({ map, studentId, onClose, onSent }) {
  const [step, setStep] = useState(0);
  const [shot, setShot] = useState(SHOTS[0][0]);
  const [title, setTitle] = useState('Smart City hackathon: we won');
  const [refl, setRefl] = useState('Splitting the work in the first hour made the difference.');
  const [lines, setLines] = useState(map.lines.some((l) => l.id === 'computing') ? ['computing'] : []);
  const [t0] = useState(() => Date.now());
  const secs = () => Math.max(12, Math.round((Date.now() - t0) / 1000));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="phone-wrap" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Capture on phone">
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-bar"><span>9:41</span><span>NIST Portfolio</span><span>●●●</span></div>
          {step === 0 && (
            <div className="ph-screen ph-cam">
              <img src={`evidence/${shot}.svg`} alt="" className="ph-view" />
              <div className="ph-thumbs">{SHOTS.map(([n, c]) => <button key={n} className={n === shot ? 'on' : ''} onClick={() => setShot(n)} aria-label={c}><img src={`evidence/${n}.svg`} alt="" /></button>)}</div>
              <button className="ph-snap" onClick={() => setStep(1)} aria-label="Take photo" />
            </div>
          )}
          {step === 1 && (
            <div className="ph-screen ph-form">
              <img src={`evidence/${shot}.svg`} alt="" className="ph-mini" />
              <label>What happened?<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label>One line about it<textarea rows={3} value={refl} onChange={(e) => setRefl(e.target.value)} /></label>
              <div className="ph-lines">{map.lines.filter((l) => l.status !== 'ended').map((l) => <button key={l.id} className={`line-chip${lines.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }} onClick={() => setLines(lines.includes(l.id) ? lines.filter((x) => x !== l.id) : [...lines, l.id])}><i />{l.name}</button>)}</div>
              <button className="primary ph-send" disabled={title.trim().length < 3} onClick={() => { capturePhone(studentId, { title: title.trim(), reflection: refl.trim(), image: `evidence/${shot}.svg`, lineIds: lines }); setStep(2); }}>Send to my inbox</button>
            </div>
          )}
          {step === 2 && (
            <div className="ph-screen ph-done">
              <div className="ph-tick">✓</div>
              <b>In your inbox</b>
              <p>Captured in {secs()} seconds. Choose its line on your laptop later; nothing reaches your map until you do.</p>
            </div>
          )}
        </div>
        <div className="phone-side">
          <div className="modal-kicker">Capture on a phone</div>
          <h2>Who is going to type all this?</h2>
          <p>Nobody. School systems bring most stations in. For the rest, a student snaps a photo and writes one line, in about 20 seconds.</p>
          <ol className="ph-steps">{['Snap a photo', 'Add one line', 'It lands in the inbox'].map((t, i) => <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>{t}</li>)}</ol>
          <div className="composer-foot">
            <button className="ghost" onClick={onClose}>Close</button>
            {step === 2 && <button className="primary" onClick={onSent}>Open my inbox</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
