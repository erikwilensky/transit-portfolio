import { useMemo, useRef, useState } from 'react';
import { acceptSpotted, declineSpotted, getSchoolLines, shortName, snapshot, spotLineFor, spotMoment, spottedBy, spottedFor, SPOT_DAYS } from '../api.js';
import { fmtDate } from '../format.js';
import { evidenceFor } from '../upload.js';
import { UploadStatus, useUpload } from './FileAttach.jsx';
import { DropOffer } from './PhotoDrop.jsx';
import './spotted.css';
import PhraseTools, { phraseBox } from './Phrases.jsx';

// Spotted moments (api.spotMoment, acceptSpotted, declineSpotted): a teacher saw a student do something worth keeping
// and suggests it for their journey. Teacher side: SpotDialog (My classes, advisor's student page) and SpottedList.
// Student side: SpottedForMe, at the top of the home at every level. Only an accepted one goes on the map.

// ── Teacher ──
// students: [{ id, name }]. classId (optional): the class it was spotted in; its line is the default.
export function SpotDialog({ students, teacherId, classId = null, onClose, toast }) {
  const lines = useMemo(() => getSchoolLines().filter((l) => l.status !== 'ended'), []);
  const [f, setF] = useState({ title: '', note: '', lineId: spotLineFor(teacherId, classId) || '' });
  const [image, setImage] = useState(null);
  const noteBox = useRef(null);
  const [err, setErr] = useState(null);
  const photo = useUpload();
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const n = students.length, one = n === 1 ? students[0].name.split(' ')[0] : null;
  const pickPhoto = (e) => { const file = e.target.files?.[0]; e.target.value = ''; photo.run(file, (r) => setImage(evidenceFor(r, file.name).url)); };
  const send = () => {
    try {
      const snap = snapshot();
      spotMoment(students.map((s) => s.id), teacherId, { title: f.title, note: f.note, image, lineId: f.lineId, classId });
      toast?.(one ? `Sent to ${one}. It goes on their journey only if they add it.` : `Sent to ${n} students. Each one decides whether to add it.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal spot-dialog" role="dialog" aria-label="I spotted something" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">I spotted something</div>
        <h2>{one ? students[0].name : `${n} students`}</h2>
        {!one && <p className="spot-who">{students.map((s) => s.name).join(', ')}</p>}
        <label>What you saw<input autoFocus value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Led the group through the hard part" /></label>
        <label>A short note <small>optional, they will read it</small><textarea rows={3} value={f.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. You kept everyone calm and found the fix." {...phraseBox(noteBox)} /></label>
        <PhraseTools value={f.note} onChange={(note) => set({ note })} first={one ? students[0].name.split(' ')[0] : null} kind="praise" box={noteBox} />
        <label>Line<select value={f.lineId} onChange={(e) => set({ lineId: e.target.value })}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <div className="spot-photo">
          {image && !photo.busy
            ? <><img src={image} alt="Your photo" /><button type="button" className="ghost" onClick={() => setImage(null)}>Remove photo</button></>
            : <label className="ghost spot-photo-btn">{photo.busy ? 'Uploading…' : 'Add a photo (optional)'}<input type="file" accept="image/*" disabled={photo.busy} onChange={pickPhoto} /></label>}
          <UploadStatus up={photo} />
        </div>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{one ? `${one} decides` : 'Each student decides'} whether to add it. Open for {SPOT_DAYS} days.</span><button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={f.title.trim().length < 3 || !f.lineId || photo.busy || !n} onClick={send}>Send</button></div>
      </div>
    </div>
  );
}

const SHOWN = { waiting: 'Waiting', added: 'Added', 'not added': 'Not added' };
// Class photos (dropId) are listed by PhotoDropList instead.
export function SpottedList({ teacherId, classId, studentId, version, title = 'Spotted moments' }) {
  const list = useMemo(() => spottedBy(teacherId, { classId, studentId }).filter((x) => !x.dropId), [teacherId, classId, studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  return (
    <section className="spot-list" aria-label={title}>
      <h2>{title}</h2>
      <ul>{list.map((x) => (
        <li key={x.id}>
          <span><b>{x.title}</b><small>{studentId ? '' : `${x.student?.name || 'A student'} · `}{fmtDate(x.date)}{x.line ? ` · ${x.line.name}` : ''}</small></span>
          <span className={`spot-st ${x.shown.replace(' ', '-')}`}>{SHOWN[x.shown]}</span>
        </li>
      ))}</ul>
    </section>
  );
}

// ── Student: suggestions at the top of their home ──
export function SpottedForMe({ studentId, simple, toast, version }) {
  const list = useMemo(() => spottedFor(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [err, setErr] = useState(null);
  if (!list.length) return null;
  const x = list[0], who = x.teacher ? shortName(x.teacher.name) : 'A teacher';
  if (x.dropId) return <DropOffer key={x.id} x={x} more={list.length} studentId={studentId} simple={simple} toast={toast} />;
  const add = () => { try { acceptSpotted(x.id, studentId); setErr(null); toast?.(`Added to your journey${x.line ? ` on ${x.line.name}` : ''}.`); } catch (e) { setErr(e.message); } };
  const no = () => { try { declineSpotted(x.id, studentId); setErr(null); toast?.('Okay, it is not added.'); } catch (e) { setErr(e.message); } };
  return (
    <div className={`spot-me${simple ? ' big' : ''}`} role="region" aria-label={`${who} spotted something you did`}>
      <div className="spot-card">
        <span className="spot-ic" aria-hidden="true">★</span>
        <div className="spot-body">
          <small>{who} spotted something you did{list.length > 1 ? ` · ${list.length} to look at` : ''}</small>
          <b>{x.title}</b>
          {x.note && <p>“{x.note}”</p>}
          {x.image && <img src={x.image} alt="Photo from your teacher" />}
          <small>{x.line ? `On ${x.line.name}` : ''}{x.className ? ` · ${x.className}` : ''}</small>
        </div>
        <div className="spot-acts"><button className="primary" onClick={add}>Add to my journey</button><button className="ghost" onClick={no}>Not for me</button></div>
      </div>
      {err && <p className="up-error" role="alert">{err}</p>}
    </div>
  );
}
