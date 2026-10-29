// Pilot feedback: the dialog anyone signed in opens from their account menu (Simple level: a big button),
// and the list leadership and the pilot admin read on Pilot usage. Server: server/routes/65-feedback.mjs.
import { useEffect, useState } from 'react';
import { feedback } from '../auth.js';
import { uploadFile } from '../upload.js';
import { ago } from '../format.js';
import { getLang } from '../api.js';
import './feedback-nudges.css';

// The dialog in Thai for a family member who chose Thai (their account's language).
const FB_TH = {
  "Something's broken": 'มีบางอย่างใช้ไม่ได้', 'An idea': 'ข้อเสนอแนะ', "Something's confusing": 'มีบางอย่างไม่ชัดเจน', 'Send feedback': 'ส่งความคิดเห็น',
  'This goes to the pilot team, with the screen you are on and your browser. Your teachers do not see it.': 'ข้อความนี้จะส่งถึงทีมโครงการนำร่อง พร้อมหน้าจอที่คุณเปิดอยู่และข้อมูลเบราว์เซอร์ ครูจะไม่เห็นข้อความนี้',
  'Your idea': 'ข้อเสนอแนะของคุณ', 'What happened, and what did you expect?': 'เกิดอะไรขึ้น และคุณคาดว่าควรเป็นอย่างไร',
  'Remove picture': 'ลบรูปภาพ', 'Adding the picture…': 'กำลังเพิ่มรูปภาพ…', 'Attach a screenshot (optional)': 'แนบภาพหน้าจอ (ไม่บังคับ)',
  'Sending…': 'กำลังส่ง…', Send: 'ส่ง', Close: 'ปิด', 'Screen:': 'หน้าจอ:', 'Thanks. Your feedback was sent.': 'ขอบคุณ ส่งความคิดเห็นของคุณแล้ว',
};

export const FB_KINDS = [['broken', "Something's broken", '!'], ['idea', 'An idea', '+'], ['confusing', "Something's confusing", '?']];
const ROLE = { student: 'Student', parent: 'Family', advisor: 'Advisor', teacher: 'Subject teacher', counsellor: 'Counsellor', coordinator: 'Coordinator', leadership: 'Leadership', admin: 'Pilot admin' };

export function FeedbackDialog({ simple, onClose, toast }) {
  const t = (s) => (!simple && getLang() === 'th' && FB_TH[s]) || s;
  const [kind, setKind] = useState(null);
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState(null); // { url, name, preview }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const route = location.hash || '#/';
  const pick = async (file) => {
    if (!file) return;
    setErr(null); setBusy('photo');
    try { const r = await uploadFile(file); if (r.local) throw new Error('The picture could not reach the school server.'); setShot({ url: r.url, name: r.name, preview: URL.createObjectURL(file) }); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const submit = async () => {
    setErr(null); setBusy('send');
    try { await feedback.send({ kind, message, route, screenshot: shot?.url }); toast(simple ? 'Thank you! We got it.' : t('Thanks. Your feedback was sent.')); onClose(); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal fb-dialog${simple ? ' simple' : ''}`} role="dialog" aria-label={simple ? 'Tell us something' : t('Send feedback')} onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
        <h2>{simple ? 'Tell us something' : t('Send feedback')}</h2>
        <p className="fineprint">{simple ? 'This goes to the people who make the app. Your teachers do not see it.' : t('This goes to the pilot team, with the screen you are on and your browser. Your teachers do not see it.')}</p>
        <div className="fb-kinds" role="radiogroup" aria-label="What kind">
          {FB_KINDS.map(([k, label, ic]) => <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}><span aria-hidden="true">{ic}</span>{t(label)}</button>)}
        </div>
        <label className="fb-label" htmlFor="fb-msg">{simple ? 'What happened?' : t(kind === 'idea' ? 'Your idea' : 'What happened, and what did you expect?')}</label>
        <textarea id="fb-msg" rows={simple ? 4 : 5} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={simple ? 'Write it in your own words.' : ''} />
        <div className="fb-shot">
          {shot ? <><img src={shot.preview} alt="Your screenshot" /><button className="ghost" onClick={() => setShot(null)}>{t('Remove picture')}</button></>
            : <label className="ghost fb-file">{busy === 'photo' ? t('Adding the picture…') : simple ? 'Add a picture of the screen' : t('Attach a screenshot (optional)')}<input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} disabled={!!busy} hidden /></label>}
        </div>
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="fb-foot"><small className="fineprint">{t('Screen:')} {route}</small>
          <button className="primary" disabled={!kind || message.trim().length < 3 || !!busy} onClick={submit}>{busy === 'send' ? t('Sending…') : t('Send')}</button></div>
      </div>
    </div>
  );
}

// Pilot usage: everything people sent, newest first.
export function FeedbackList() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [kind, setKind] = useState('all');
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { feedback.list().then(setItems, (x) => setErr(x.message)); }, []);
  const mark = async (f) => { try { const item = await feedback.done(f.id, !f.done); setItems((l) => l.map((x) => (x.id === f.id ? item : x))); } catch (x) { setErr(x.message); } };
  const shown = (items || []).filter((f) => (kind === 'all' || f.kind === kind) && (showDone || !f.done));
  const open = (items || []).filter((f) => !f.done).length;
  return (
    <section className="card-sec fb-list">
      <div className="us-head"><h2>Feedback {items && <small className="fineprint">{open} open of {items.length}</small>}</h2>
        <div className="auth-row">
          <label className="us-filter">Show <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Every kind</option>{FB_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="us-filter"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Done too</label>
        </div></div>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {!items && !err && <p className="fineprint">Loading feedback…</p>}
      {items && !shown.length && <p className="fineprint">{items.length ? 'Nothing here with these filters.' : 'No feedback yet. Everyone has a Feedback button in their account menu.'}</p>}
      <ul className="fb-items">
        {shown.map((f) => (
          <li key={f.id} className={f.done ? 'done' : ''}>
            <div className="fb-top"><span className={`fb-kind k-${f.kind}`}>{FB_KINDS.find(([k]) => k === f.kind)?.[1] || f.kind}</span>
              <span className="fb-who"><b>{f.name}</b> · {ROLE[f.role] || f.role}{f.year ? `, Year ${f.year}` : ''}{f.gone ? ' (account removed)' : ''}</span>
              <small className="fineprint" title={new Date(f.at).toLocaleString('en-GB')}>{ago(f.at)}</small></div>
            <p className="fb-msg">{f.message}</p>
            {f.screenshot && <a className="fb-thumb" href={f.screenshot.url.replace(/^\//, '')} target="_blank" rel="noreferrer"><img src={f.screenshot.url.replace(/^\//, '')} alt={`Screenshot from ${f.name}`} loading="lazy" /></a>}
            <div className="fb-meta"><small className="fineprint">Screen <code>{f.route || '—'}</code>{f.ua ? ` · ${f.ua}` : ''}</small>
              <button className={f.done ? 'ghost' : 'primary'} onClick={() => mark(f)}>{f.done ? `Done by ${f.done.name}. Reopen` : 'Mark as done'}</button></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
