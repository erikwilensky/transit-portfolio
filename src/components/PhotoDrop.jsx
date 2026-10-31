import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { acceptSpotted, declineSpotted, DROP_KEEP_DAYS, DROP_MAX, dropPhotos, editPhotoDrop, getReports, getStudent, getSchoolLines, photoDropsBy, REPORT_REASONS, reportItem, shortName, snapshot, spotLineFor, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { uploadFile } from '../upload.js';
import './photo-drop.css';

// Class photo drop (api.dropPhotos; docs/pilot-server.md "Class photo drop"). Teacher: PhotoDropDialog (My classes, class
// page) uploads many photos and gives each to students in the class; PhotoDropList shows each batch's answers. Student:
// DropOffer, inside the spotted card at the top of the home (Spotted.jsx): keep some photos with a sentence, or not.

const KEY = (tid, cid) => `tp-photo-drop:${tid}:${cid}`;
const newDraft = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const short = (name) => { const [f, ...r] = name.split(' '); return r.length ? `${f} ${r[r.length - 1][0]}.` : f; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const readDraft = (k) => {
  try {
    const d = JSON.parse(localStorage.getItem(k) || 'null');
    if (!d?.draft || Date.now() - d.at > DROP_KEEP_DAYS * 864e5) return null;
    return d;
  } catch { return null; }
};
const discard = (urls) => {
  const files = urls.filter((u) => /api\/files\//.test(u || ''));
  if (files.length) fetch(new URL('api/photo-drops/discard', location.href).href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files }) }).catch(() => {});
};

// ── Teacher: drop photos on a class ──
// c: classRoster(classId, teacherId) ({ id, name, line, students: [{ student }] }).
export function PhotoDropDialog({ c, teacherId, toast, onClose }) {
  const k = KEY(teacherId, c.id);
  const saved = useMemo(() => readDraft(k), [k]);
  const lines = useMemo(() => getSchoolLines().filter((l) => l.status !== 'ended'), []);
  const kids = c.students.map((x) => x.student);
  const [draft] = useState(() => saved?.draft || newDraft());
  const [startedAt] = useState(() => saved?.at || Date.now());
  const [f, setF] = useState(() => saved?.form || { title: '', date: TODAY, lineId: spotLineFor(teacherId, c.id) || '', note: '' });
  const [photos, setPhotos] = useState(() => (saved?.photos || []).map((p, i) => ({ ...p, key: `s${i}`, state: 'ok' })));
  const [err, setErr] = useState(null);
  const [over, setOver] = useState(false);
  const pick = useRef(null);
  const seq = useRef(0);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const upd = (key, p) => setPhotos((l) => l.map((x) => (x.key === key ? { ...x, ...(typeof p === 'function' ? p(x) : p) } : x)));
  // Kept on this device as a draft (the photos are on the server already, readable only by this teacher).
  useEffect(() => {
    const done = photos.filter((p) => p.state === 'ok' && !/^data:/.test(p.url));
    try { localStorage.setItem(k, JSON.stringify({ draft, at: startedAt, form: f, photos: done.map(({ url, name, studentIds }) => ({ url, name, studentIds })) })); } catch { /* storage full or blocked */ }
  }, [photos, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (files) => {
    const list = [...files].filter((x) => /^image\//.test(x.type) || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(x.name));
    if (list.length < files.length) setErr('Only photos can be added here.');
    const room = DROP_MAX - photos.length;
    if (list.length > room) setErr(`At most ${DROP_MAX} photos at once.`);
    const items = list.slice(0, Math.max(0, room)).map((file) => ({ key: `n${seq.current++}`, name: file.name, url: null, preview: URL.createObjectURL(file), studentIds: [], state: 'up', progress: 0, file }));
    if (!items.length) return;
    setPhotos((l) => [...l, ...items.map(({ file, ...x }) => x)]);
    // Three at a time.
    const queue = [...items];
    const work = async () => {
      for (let it = queue.shift(); it; it = queue.shift()) {
        try {
          const r = await uploadFile(it.file, { purpose: `photo-drop:${draft}`, max: 1600, onProgress: (p) => upd(it.key, { progress: p }) });
          upd(it.key, { url: r.url, name: r.name || it.name, state: 'ok' });
        } catch (e) { upd(it.key, { state: 'err', error: e?.message || 'The photo could not be added.' }); }
      }
    };
    await Promise.all([work(), work(), work()]);
  };
  const toggle = (key, sid) => upd(key, (x) => ({ studentIds: x.studentIds.includes(sid) ? x.studentIds.filter((s) => s !== sid) : [...x.studentIds, sid] }));
  const remove = (p) => { if (p.url) discard([p.url]); setPhotos((l) => l.filter((x) => x.key !== p.key)); };
  const given = photos.filter((p) => p.state === 'ok' && p.studentIds.length);
  const unused = photos.filter((p) => p.state === 'ok' && !p.studentIds.length);
  const busy = photos.some((p) => p.state === 'up');
  const who = new Set(given.flatMap((p) => p.studentIds));
  const send = () => {
    setErr(null);
    try {
      const snap = snapshot();
      dropPhotos(c.id, teacherId, { ...f, photos: given.map(({ url, name, studentIds }) => ({ url, name, studentIds })), draft });
      try { localStorage.removeItem(k); } catch { /* nothing kept */ }
      toast?.(`Sent ${plural(given.length, 'photo')} to ${plural(who.size, 'student')}. Each one picks what to keep.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  const throwAway = () => { discard(photos.map((p) => p.url)); try { localStorage.removeItem(k); } catch { /* nothing kept */ } onClose(); };
  const onDrop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files?.length) add(e.dataTransfer.files); };

  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal pd-dialog" role="dialog" aria-modal="true" aria-label={`Drop photos on ${c.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Class photos</div>
        <h2>{c.name}</h2>
        <p className="pd-safe" role="note"><b>Before you send:</b> {`each student sees every photo you give them. If other students’ faces are in a photo, everyone you give it to sees them. Give a photo only to the students in it, and leave out any that should not be shared.`}</p>
        <div className="pd-form">
          <label>Title <small>optional</small><input value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Electricity practical" /></label>
          <label>Date<input type="date" value={f.date} max={TODAY} onChange={(e) => set({ date: e.target.value })} /></label>
          <label>Line<select value={f.lineId} onChange={(e) => set({ lineId: e.target.value })}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="pd-note">A short note <small>optional, they will read it</small><input value={f.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Great teamwork wiring the circuits." /></label>
        </div>
        <div className={`pd-drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <span>{photos.length ? `${plural(photos.length, 'photo')}. Drop more here, or` : 'Drop photos here, or'}</span>
          <button type="button" className="ghost" onClick={() => pick.current?.click()} disabled={photos.length >= DROP_MAX}>Choose photos</button>
          <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { const l = e.target.files; if (l?.length) add(l); e.target.value = ''; }} />
          <small>{`Up to ${DROP_MAX}. Big photos are made smaller on this device first.`}</small>
        </div>
        {photos.length > 0 && <ol className="pd-grid" aria-label="Photos">
          {photos.map((p, i) => {
            const prev = photos[i - 1];
            return (
              <li key={p.key} className={`pd-photo${p.studentIds.length ? ' given' : ''}`}>
                <div className="pd-thumb">
                  {(p.preview || p.url) && <img src={p.preview || p.url} alt={`Photo ${i + 1}: ${p.name}`} />}
                  {p.state === 'up' && <span className="pd-prog" role="status">{`Uploading ${Math.round((p.progress || 0) * 100)}%`}</span>}
                  {p.state === 'err' && <span className="pd-prog err" role="alert">{p.error}</span>}
                </div>
                <div className="pd-who" role="group" aria-label={`Students in photo ${i + 1}`}>
                  {kids.map((s) => <button key={s.id} type="button" className={`pd-chip${p.studentIds.includes(s.id) ? ' on' : ''}`} aria-pressed={p.studentIds.includes(s.id)} title={s.name} disabled={p.state !== 'ok'} onClick={() => toggle(p.key, s.id)}>{short(s.name)}</button>)}
                </div>
                <div className="pd-row">
                  <small>{p.studentIds.length ? `Given to ${plural(p.studentIds.length, 'student')}` : 'Not given to anyone yet'}</small>
                  {prev && <button type="button" className="linkish" disabled={p.state !== 'ok' || !prev.studentIds.length} onClick={() => upd(p.key, { studentIds: [...prev.studentIds] })}>Same students as previous</button>}
                  {p.studentIds.length > 0 && <button type="button" className="linkish" onClick={() => upd(p.key, { studentIds: [] })}>Clear</button>}
                  <button type="button" className="linkish" onClick={() => remove(p)}>{`Remove photo ${i + 1}`}</button>
                </div>
              </li>
            );
          })}
        </ol>}
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot pd-foot">
          <span>{given.length ? `${plural(given.length, 'photo')} for ${plural(who.size, 'student')}.` : 'Give each photo to the students in it.'}{unused.length ? ` ${plural(unused.length, 'photo')} given to nobody ${unused.length === 1 ? 'is' : 'are'} deleted when you send.` : ''}</span>
          {photos.length > 0 && <button className="ghost" onClick={throwAway}>Discard all</button>}
          <button className="primary" disabled={busy || !given.length || !f.lineId} onClick={send}>Send photos</button>
        </div>
        <p className="fineprint">{`Closing keeps this as a draft on this device for ${DROP_KEEP_DAYS} days; photos not sent by then are deleted.`}</p>
      </div>
    </div>,
    document.body,
  );
}

const SHOWN = { added: 'Added', waiting: 'Waiting', 'not for me': 'Not for me', 'not added': 'Not added' };
export function PhotoDropList({ teacherId, classId, version, c = null, toast }) {
  const list = useMemo(() => photoDropsBy(teacherId, classId), [teacherId, classId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null);
  const now = editing && list.find((d) => d.id === editing);
  if (!list.length) return null;
  return (
    <section className="pd-list" aria-label="Class photos">
      <h2>Class photos</h2>
      <ul>{list.map((d) => (
        <li key={d.id}>
          <details>
            <summary>
              <span><b>{d.title}</b><small>{`${fmtDate(d.date)} · ${plural(d.photos.length, 'photo')}${d.line ? ` · ${d.line.name}` : ''}`}</small></span>
              <span className="pd-counts">{`${d.counts.added} added · ${d.counts.waiting} waiting · ${d.counts.no} said no${d.counts.expired ? ` · ${d.counts.expired} not added` : ''}`}</span>
            </summary>
            <div className="pd-strip">{d.photos.map((p, i) => (p.url ? <img key={p.id} src={p.url} alt={`Photo ${i + 1}`} /> : <span key={p.id} className="pd-gone">{p.removed ? 'Removed after a report' : 'Removed'}</span>))}</div>
            {c && d.photos.some((p) => p.url) && <button type="button" className="ghost small-btn pd-edit" onClick={() => setEditing(d.id)}>{`Edit “${d.title}”`}</button>}
            <ul className="pd-rows">{d.rows.map((r) => (
              <li key={r.spot.id}>
                <span>{r.student?.name || 'A student'}</span>
                <small>{r.shown === 'added' ? `Kept ${r.kept} of ${plural(r.photos, 'photo')}` : plural(r.photos, 'photo')}</small>
                <span className={`spot-st ${r.shown.replace(/ /g, '-')}`}>{SHOWN[r.shown]}</span>
              </li>
            ))}</ul>
          </details>
        </li>
      ))}</ul>
      {now && <EditDrop d={now} c={c} teacherId={teacherId} toast={toast} onClose={() => setEditing(null)} />}
    </section>
  );
}

// Editing a sent batch (api.editPhotoDrop): the title and note, a student added to a photo, or a photo taken back from a
// student who has not kept it. A kept photo stays with the student (its chip is locked).
function EditDrop({ d, c, teacherId, toast, onClose }) {
  const photos = d.photos.filter((p) => p.url);
  const [title, setTitle] = useState(d.title);
  const [note, setNote] = useState(d.note || '');
  const [who, setWho] = useState(() => Object.fromEntries(photos.map((p) => [p.id, p.studentIds])));
  const [err, setErr] = useState(null);
  const kids = c.students.map((x) => x.student);
  const left = [...new Set(photos.flatMap((p) => p.studentIds))].filter((sid) => !kids.some((k) => k.id === sid)).map(getStudent).filter(Boolean);
  const kept = (pid, sid) => (d.kept[pid] || []).includes(sid);
  const toggle = (pid, sid) => setWho((w) => ({ ...w, [pid]: w[pid].includes(sid) ? w[pid].filter((x) => x !== sid) : [...w[pid], sid] }));
  const add = photos.flatMap((p) => who[p.id].filter((sid) => !p.studentIds.includes(sid)).map((sid) => ({ photoId: p.id, studentId: sid })));
  const withdraw = photos.flatMap((p) => p.studentIds.filter((sid) => !who[p.id].includes(sid)).map((sid) => ({ photoId: p.id, studentId: sid })));
  const changed = add.length + withdraw.length + (title.trim() !== d.title ? 1 : 0) + (note.trim() !== (d.note || '') ? 1 : 0);
  const nobody = photos.filter((p) => !who[p.id].length).length;
  const save = () => {
    setErr(null);
    try {
      const snap = snapshot();
      editPhotoDrop(d.id, teacherId, { title, note, add, withdraw });
      const said = [add.length ? `${plural(new Set(add.map((x) => x.studentId)).size, 'student')} sent new photos` : '', withdraw.length ? `${plural(withdraw.length, 'photo')} taken back` : ''].filter(Boolean).join(', ');
      toast?.(`Saved “${title.trim() || d.title}”${said ? `: ${said}` : ''}.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal pd-dialog" role="dialog" aria-modal="true" aria-label={`Edit the photos from ${d.title}`} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Class photos · sent {fmtDate(d.date)}</div>
        <h2>{`Edit “${d.title}”`}</h2>
        <p className="pd-safe" role="note">{'Adding a student sends them that photo to keep or not. Taking a photo back works only for students who have not kept it: photos already kept stay with the student.'}</p>
        <div className="pd-form">
          <label>Title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="pd-note">A short note <small>students still deciding see the new words</small><input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <ol className="pd-grid" aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.id} className={`pd-photo${who[p.id].length ? ' given' : ''}`}>
              <div className="pd-thumb"><img src={p.url} alt={`Photo ${i + 1}: ${p.name}`} /></div>
              <div className="pd-who" role="group" aria-label={`Students in photo ${i + 1}`}>
                {[...kids, ...left].map((s) => {
                  const on = who[p.id].includes(s.id), lock = kept(p.id, s.id), gone = !kids.includes(s);
                  return <button key={s.id} type="button" className={`pd-chip${on ? ' on' : ''}${lock ? ' kept' : ''}`} aria-pressed={on} disabled={lock || (gone && !on)} title={lock ? `${s.name} kept this photo: it stays with them` : s.name} onClick={() => toggle(p.id, s.id)}>{lock ? `${short(s.name)} · kept` : short(s.name)}</button>;
                })}
              </div>
              <div className="pd-row"><small>{who[p.id].length ? `Given to ${plural(who[p.id].length, 'student')}${(d.kept[p.id] || []).length ? `, kept by ${(d.kept[p.id] || []).length}` : ''}` : 'Given to nobody: it leaves the batch and is deleted'}</small></div>
            </li>
          ))}
        </ol>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot pd-foot">
          <span>{changed ? `${plural(add.length, 'student')} added to photos, ${plural(withdraw.length, 'photo')} taken back.${nobody ? ` ${plural(nobody, 'photo')} given to nobody ${nobody === 1 ? 'is' : 'are'} deleted.` : ''}` : 'Nothing changed yet.'}</span>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!changed} onClick={save}>Save changes</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Student: the photos a teacher gave them (x: a spottedFor() item with dropId) ──
export function DropOffer({ x, more, studentId, simple, toast }) {
  const who = x.teacher ? shortName(x.teacher.name) : 'A teacher';
  const [keep, setKeep] = useState(() => x.photos.map((p) => p.id));
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const [reporting, setReporting] = useState(null);
  const reported = new Set(getReports().filter((r) => r.photoId && r.from?.key === 'student').map((r) => r.photoId));
  const one = x.photos.length === 1;
  const flip = (id) => setKeep((k) => (k.includes(id) ? k.filter((y) => y !== id) : [...k, id]));
  const add = () => { try { acceptSpotted(x.id, studentId, { photos: keep, text }); setErr(null); toast?.(`Added to your journey${x.line ? ` on ${x.line.name}` : ''}.`); } catch (e) { setErr(e.message); } };
  const no = () => { try { declineSpotted(x.id, studentId); setErr(null); toast?.('Okay, it is not added.'); } catch (e) { setErr(e.message); } };
  return (
    <div className={`spot-me pd-offer${simple ? ' big' : ''}`} role="region" aria-label={`${who} added photos from ${x.title}`}>
      <div className="spot-card">
        <span className="spot-ic" aria-hidden="true">★</span>
        <div className="spot-body">
          <small>{`${who} added photos from ${x.title}`}</small>
          <b>{x.title}</b>
          {x.note && <p>“{x.note}”</p>}
          <span className="pd-when"><small>{fmtDate(x.on || x.date)}</small>{x.line && <small>{`On ${x.line.name}`}</small>}{more > 1 && <small>{`${more - 1} more after this`}</small>}</span>
        </div>
      </div>
      <p className="pd-ask">{one ? 'Keep this photo?' : 'Tap the photos you want to keep.'}</p>
      <ul className="pd-picks">{x.photos.map((p, i) => {
        const on = keep.includes(p.id);
        return (
          <li key={p.id}>
            <button type="button" className={`pd-pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => flip(p.id)}>
              <img src={p.url} alt={`Photo ${i + 1} from your teacher`} />
              <span>{on ? '✓ Keeping' : 'Not keeping'}</span>
            </button>
            {reported.has(p.id) ? <small className="sg-sent">You told a teacher about this</small>
              : <button type="button" className="linkish pd-report" onClick={() => setReporting(p)}>Something wrong with this photo?</button>}
          </li>
        );
      })}</ul>
      <label className="pd-say">Say what you did<input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="e.g. I wired the circuit and the bulb lit up." /></label>
      <div className="spot-acts pd-acts">
        <button className="primary" disabled={!keep.length} onClick={add}>{keep.length === 1 ? 'Keep 1 photo' : `Keep ${keep.length} photos`}</button>
        <button className="ghost" onClick={no}>Not for me</button>
      </div>
      {err && <p className="up-error" role="alert">{err}</p>}
      {reporting && createPortal(<PhotoReport photo={reporting} studentId={studentId} simple={simple} onClose={() => setReporting(null)} onSent={() => { setReporting(null); toast?.('Thank you. A teacher will look at it.'); }} />, document.body)}
    </div>
  );
}

function PhotoReport({ photo, studentId, simple, onClose, onSent }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const send = () => { try { reportItem({ photoId: photo.id, studentId }, reason, note, { key: 'student' }); onSent(); } catch (x) { setErr(x.message || 'That did not work.'); } };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal sg-dialog${simple ? ' simple' : ''}`} role="dialog" aria-modal="true" aria-label="Tell a teacher about this photo" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <h2>Tell a teacher about this photo</h2>
        <img className="pd-report-img" src={photo.url} alt="The photo" />
        <p className="fineprint">A teacher who looks after safety will see it. The teacher who took the photo is not told it was you.</p>
        <div className="sg-reasons" role="radiogroup" aria-label="What is wrong">
          {Object.entries(REPORT_REASONS).map(([k, l]) => <button key={k} role="radio" aria-checked={reason === k} className={reason === k ? 'on' : ''} onClick={() => setReason(k)}>{l}</button>)}
        </div>
        <label className="fb-label" htmlFor="pd-sg-note">Anything else? (optional)</label>
        <textarea id="pd-sg-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="sg-foot"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!reason} onClick={send}>Send report</button></div>
      </div>
    </div>
  );
}
