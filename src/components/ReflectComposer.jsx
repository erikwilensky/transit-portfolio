import { useState } from 'react';
import { addReflection, getEvent } from '../api.js';
import { VIS_LABEL } from '../format.js';

// Opens from a signal on the map: the prompt, the student's words, and who may read them.
export default function ReflectComposer({ signal, studentId, onClose, onSaved, prefill = '' }) {
  const [text, setText] = useState(prefill);
  const [vis, setVis] = useState('advisor');
  const e = getEvent(signal.eventId);
  const save = () => { const r = addReflection({ studentId, eventId: signal.eventId, prompt: signal.prompt, text: text.trim(), visibility: vis, signal }); onSaved?.(r); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal composer" role="dialog" aria-label="Reflect at this signal" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker"><span className="sig-dot" aria-hidden="true" /> Reflection signal{signal.from ? ` from ${signal.from.name}` : ''}</div>
        <h2>{signal.prompt}</h2>
        <p className="fineprint">On “{e?.title}”. A few honest sentences are enough.</p>
        <textarea rows={6} autoFocus value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Write in your own words…" />
        <div className="composer-foot">
          <label>Who can read this
            <select value={vis} onChange={(ev) => setVis(ev.target.value)}>
              {['private', 'advisor', 'school', 'publishable'].map((v) => <option key={v} value={v}>{VIS_LABEL[v]}{v === 'advisor' ? ' (default)' : ''}</option>)}
            </select>
          </label>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Not now</button>
          <button className="primary" disabled={text.trim().length < 10} onClick={save}>Save reflection</button>
        </div>
      </div>
    </div>
  );
}
