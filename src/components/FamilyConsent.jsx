// Family consent on file (api.recordFamilyConsent): families no longer answer consent in the app (removed on 30 October
// 2026), so the school records the consent it holds for a student in Years 7 to 9: an admin (Accounts, "A student's
// data") or the student's advisor (My advisory). Date, how it was given (email, paper, in person) and a short note.
import { useMemo, useState } from 'react';
import { consentOnFile, CONSENT_HOW, familyConsentOf, getStudent, TODAY, youngStudent, recordFamilyConsent } from '../api.js';
import { fmtDate } from '../format.js';
import './family-consent.css';

export function ConsentRow({ studentId, by, toast }) {
  const s = getStudent(studentId);
  const rec = familyConsentOf(studentId);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  if (!s || !youngStudent(s)) return null;
  const on = consentOnFile(studentId);
  const save = (f) => {
    setErr(null);
    try { recordFamilyConsent(studentId, f, by); setForm(null); toast?.(f.on ? `Family consent recorded for ${s.name}` : `Recorded: no family consent on file for ${s.name}`); }
    catch (x) { setErr(x.message); }
  };
  const id = `fc-${studentId}`;
  return (
    <div className="fc-row">
      <span className="fc-who"><b>{s.name}</b>
        <small>{on ? (rec?.on ? `Family consent on file · ${fmtDate(rec.date)} · ${CONSENT_HOW[rec.how]}` : 'Family consent on file') : rec ? `No family consent on file (since ${fmtDate(rec.date)})` : 'No family consent on file yet'}</small>
      </span>
      {!form ? <span className="fc-btns">
        <button className="ghost small-btn" onClick={() => setForm({ on: true, date: TODAY, how: 'email', note: '' })}>{on ? 'Change' : 'Family consent on file'}<span className="sr-only"> for {s.name}</span></button>
        {on && <button className="linkish" onClick={() => save({ on: false })}>Withdrawn<span className="sr-only"> for {s.name}</span></button>}
      </span> : (
        <div className="fc-form" role="group" aria-label={`Family consent for ${s.name}`}>
          <label><span>Date given</span><input id={`${id}-d`} type="date" max={TODAY} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span>How</span><select value={form.how} onChange={(e) => setForm({ ...form, how: e.target.value })}>{Object.entries(CONSENT_HOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="fc-note"><span>Note (optional)</span><input maxLength={200} value={form.note} placeholder="e.g. Email from Khun Maria, kept in the student file" onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <span className="fc-btns"><button className="primary small-btn" onClick={() => save(form)}>Save</button><button className="ghost small-btn" onClick={() => { setForm(null); setErr(null); }}>Cancel</button></span>
        </div>
      )}
      {err && <p className="auth-err" role="alert">{err}</p>}
    </div>
  );
}

// My advisory: each advisee in Years 7 to 9.
export function AdvisoryConsent({ studentIds, by, toast, version }) {
  const [open, setOpen] = useState(false);
  const young = useMemo(() => studentIds.filter((id) => { const s = getStudent(id); return s && youngStudent(s); }), [studentIds, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!young.length) return null;
  const waiting = young.filter((id) => !consentOnFile(id)).length;
  if (!open) return <div className="yh-open"><button className="ghost" onClick={() => setOpen(true)}>Family consent</button><small className="fineprint">{waiting ? `${waiting} of ${young.length} without family consent on file` : 'Every advisee in Years 7 to 9 has family consent on file'}</small></div>;
  return (
    <section className="card-sec fc-panel" aria-labelledby="fc-h">
      <div className="nd-head"><div><h2 id="fc-h">Family consent</h2>
        <small className="fineprint">Students in Years 7 to 9 need a parent’s consent before anything can be made publishable. Families give it to the school by email or on paper; record it here. Families see it, read only, on their Consent page.</small></div>
        <button className="ghost small-btn" onClick={() => setOpen(false)}>Close</button></div>
      {young.map((id) => <ConsentRow key={id} studentId={id} by={by} toast={toast} />)}
    </section>
  );
}
