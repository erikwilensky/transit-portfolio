import { useState } from 'react';
import { addReflection, getEvent } from '../api.js';
import { VIS_LABEL } from '../format.js';
import { AttachButton, PendingFiles, VoiceNote } from './FileAttach.jsx';

// Opens from a signal on the map: the prompt, the student's words, and who may read them.
// A voice note, photo or file can go with the words.
export default function ReflectComposer({ signal, studentId, onClose, onSaved, prefill = '' }) {
  const [text, setText] = useState(prefill);
  const [vis, setVis] = useState('advisor');
  const [files, setFiles] = useState([]);
  const addFile = (ev) => setFiles((x) => [...x, ev]);
  const e = getEvent(signal.eventId);
  const save = () => { const r = addReflection({ studentId, eventId: signal.eventId, prompt: signal.prompt, text: text.trim(), visibility: vis, signal, files }); onSaved?.(r); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal composer" role="dialog" aria-label="Reflect at this signal" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker"><span className="sig-dot" aria-hidden="true" /> Reflection signal{signal.from ? ` from ${signal.from.name}` : ''}</div>
        <h2>{signal.prompt}</h2>
        <p className="fineprint">On “{e?.title}”. A few honest sentences are enough, or a voice note.</p>
        <textarea rows={6} autoFocus value={text} onChange={(ev) => setText(ev.target.value)} placeholder={files.length ? 'A line about what you attached…' : 'Write in your own words…'} />
        <PendingFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
        <div className="attach-row"><VoiceNote onAdded={addFile} /><AttachButton label="Attach a photo or file" className="ghost small-btn file-btn" onAdded={addFile} /></div>
        <div className="composer-foot">
          <label>Who can read this
            <select value={vis} onChange={(ev) => setVis(ev.target.value)}>
              {['private', 'advisor', 'school', 'publishable'].map((v) => <option key={v} value={v}>{VIS_LABEL[v]}{v === 'advisor' ? ' (default)' : ''}</option>)}
            </select>
          </label>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Not now</button>
          <button className="primary" disabled={!files.length && text.trim().length < 10} onClick={save}>Save reflection</button>
        </div>
      </div>
    </div>
  );
}
