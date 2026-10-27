import { useState } from 'react';
import { addStation, getIntensity, getTeachers, TODAY } from '../api.js';
import { TYPE_LABEL, VIS_LABEL } from '../format.js';
import { AttachButton, PendingFiles, UploadStatus, useUpload } from './FileAttach.jsx';
import { evidenceFor } from '../upload.js';

const SUGGEST = { computing: 't-01', science: 't-02', music: 't-03', design: 't-04', languages: 't-05', art: 't-06', service: 't-08', environment: 't-08', 'maya-datasci': 't-01', 'arun-musictech': 't-03' };
const PHOTOS = [['hackathon-1st', 'Results board'], ['stem-club', 'Club session'], ['aq-dashboard', 'Screenshot'], ['mural', 'Finished work']];
export const OUTCOMES = ['Strengths and growth', 'New challenges', 'Initiative and planning', 'Commitment', 'Collaboration', 'Global engagement', 'Ethics of choices'];

// A student-added station: dotted until a teacher endorses it.
export default function AddStation({ map, studentId, onClose, onAdded, prefill = {}, compact = false }) {
  const lines = map.lines.filter((l) => l.status !== 'ended');
  const [f, setF] = useState({ title: '', date: TODAY, type: 'project', lineIds: [], summary: '', reflection: '', visibility: 'advisor', image: null, imageCaption: '', files: [], requestFrom: '', requestNote: '', cas: null, ...prefill });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const teachers = getTeachers().filter((t) => !['t-07', 't-09', 't-10'].includes(t.id));
  const dp = map.student.grade >= 11;
  // At the Simple level: what, which line, a photo and a sentence. Date, kind and who can see it keep their defaults.
  const simple = getIntensity(studentId) === 'simple';
  const toggleLine = (id) => {
    const lineIds = f.lineIds.includes(id) ? f.lineIds.filter((x) => x !== id) : [...f.lineIds, id];
    set({ lineIds, requestFrom: f.requestFrom || SUGGEST[lineIds[0]] || '' });
  };
  const photo = useUpload();
  const ok = f.title.trim() && f.lineIds.length && !photo.busy;
  const save = () => { const e = addStation(studentId, { ...f, requestFrom: f.requestFrom || null }); onAdded?.(e); };
  const pickPhoto = (file) => photo.run(file, (r) => { const ev = evidenceFor(r, file.name); if (ev.kind === 'image') set({ image: ev.url, imageCaption: file.name }); else set({ files: [...f.files, ev] }); });
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal add-station${compact ? ' compact' : ''}`} role="dialog" aria-label="Add a station" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">New station · student-added</div>
        <h2>{simple ? 'What did you do?' : 'Add something to your map'}</h2>
        <div className="form-grid">
          <label className="span2">What happened<input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Bangkok Smart City hackathon: 1st place" /></label>
          {!simple && <><label>When<input type="date" value={f.date} max={TODAY} onChange={(e) => set({ date: e.target.value })} /></label>
          <label>Kind<select value={f.type} onChange={(e) => set({ type: e.target.value })}>{Object.entries(TYPE_LABEL).filter(([k]) => k !== 'goal').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></>}
          <div className="span2 field"><span>{simple ? 'Which colour does it belong to?' : 'Which line, or lines (two or more makes an interchange)'}</span>
            <div className="chips">{lines.map((l) => <button key={l.id} type="button" className={`line-chip${f.lineIds.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }} aria-pressed={f.lineIds.includes(l.id)} onClick={() => toggleLine(l.id)}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name}</button>)}</div>
          </div>
          <label className="span2">One line about it<input value={f.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="What you did, and what came of it" /></label>
          <div className="span2 field"><span>Photo</span>
            <div className="photo-row">
              {f.image && <img src={f.image} alt="" className="photo-prev" />}
              <label className={`ghost file-btn${photo.busy ? ' busy' : ''}`}>{photo.busy ? 'Uploading…' : 'From this device'}<input type="file" accept="image/*" disabled={photo.busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; pickPhoto(file); }} /></label>
              {PHOTOS.map(([n, cap]) => <button key={n} type="button" className={`photo-pick${f.image?.includes(n) ? ' on' : ''}`} onClick={() => set({ image: `evidence/${n}.svg`, imageCaption: cap })}><img src={`evidence/${n}.svg`} alt={cap} /></button>)}
            </div>
            <UploadStatus up={photo} />
          </div>
          <div className="span2 field"><span>{simple ? 'Anything else? (optional)' : 'Files: a PDF, document, recording or video (optional)'}</span>
            <PendingFiles files={f.files} onRemove={(i) => set({ files: f.files.filter((_, j) => j !== i) })} />
            <AttachButton label={f.files.length ? 'Attach another file' : 'Attach a file'} onAdded={(ev) => setF((x) => ({ ...x, files: [...x.files, ev] }))} />
          </div>
          <label className="span2">{simple ? 'What did you learn? (optional)' : 'Quick reflection (optional)'}<textarea rows={2} value={f.reflection} onChange={(e) => set({ reflection: e.target.value })} placeholder="What did you learn?" /></label>
          {dp && !simple && (
            <div className="span2 field cas-field"><span>Counts for CAS?</span>
              <div className="seg small">{[[null, 'No'], ['C', 'Creativity'], ['A', 'Activity'], ['S', 'Service']].map(([v, l]) => <button type="button" key={l} className={(f.cas?.strand || null) === v ? 'on' : ''} onClick={() => set({ cas: v ? { strand: v, outcomes: f.cas?.outcomes || [] } : null })}>{l}</button>)}</div>
              {f.cas && <div className="cb-tags">{OUTCOMES.map((o, i) => { const on = f.cas.outcomes.includes(i + 1); return <button type="button" key={o} className={on ? 'on' : ''} onClick={() => set({ cas: { ...f.cas, outcomes: on ? f.cas.outcomes.filter((x) => x !== i + 1) : [...f.cas.outcomes, i + 1] } })}>LO{i + 1} {o}</button>; })}</div>}
            </div>
          )}
          {!simple && <><label>Who can see it<select value={f.visibility} onChange={(e) => set({ visibility: e.target.value })}>{['private', 'advisor', 'school', 'publishable'].map((v) => <option key={v} value={v}>{VIS_LABEL[v]}</option>)}</select></label>
          <label>Ask a teacher to endorse<select value={f.requestFrom} onChange={(e) => set({ requestFrom: e.target.value })}><option value="">No one yet</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role}</option>)}</select></label>
          {f.requestFrom && <label className="span2">Note to the teacher<input value={f.requestNote} onChange={(e) => set({ requestNote: e.target.value })} placeholder="Optional" /></label>}</>}
        </div>
        <div className="composer-foot">
          <span className="fineprint">{simple ? 'Only you and your advisor see it at first.' : 'It appears with a dotted badge until a teacher endorses it.'}</span>
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!ok} onClick={save}>Add to my map</button>
        </div>
      </div>
    </div>
  );
}
