import { createContext, useContext, useState } from 'react';
import { getEvent, getStore, getStudent, getTeacher } from '../api.js';
import { fmtDate, verifyCode, appUrl, VERIFY_LABEL } from '../format.js';
import Qr from './Qr.jsx';

const Ctx = createContext(null);
// Shared and public views wrap their content in a scope where badges become verifiable.
export const VerifyScope = createContext(false);
export const useVerify = () => useContext(Ctx);

// Any verification badge in a shared view opens the station's verification record.
export function VerifyProvider({ children }) {
  const [eventId, setEventId] = useState(null);
  return (
    <Ctx.Provider value={setEventId}>
      {children}
      {eventId && <VerifyDialog eventId={eventId} onClose={() => setEventId(null)} />}
    </Ctx.Provider>
  );
}

export function verificationRecord(eventId) {
  const e = getEvent(eventId);
  if (!e) return null;
  const s = getStudent(e.studentId);
  const endorsements = getStore().endorsements.filter((n) => n.eventId === e.id).map((n) => ({ ...n, teacher: getTeacher(n.teacherId) }));
  return buildRecord(e, s, endorsements);
}

// The same record from the server's public answer for one code (GET /api/public/verify/:code).
export const recordFromPublic = ({ event, student, endorsements }) => buildRecord(event, student, endorsements.map((n) => ({ ...n, teacher: n.teacher || { name: 'A teacher', role: 'NIST' } })));

function buildRecord(e, s, endorsements) {
  const chain = [];
  if (e.source.system === 'Manual entry') chain.push(['Added by the student', s.name, e.date]);
  else chain.push([`Imported from ${e.source.system}`, e.source.ref ? `record ${e.source.ref}` : 'school system', e.date]);
  for (const n of endorsements) chain.push([`Endorsed by ${n.teacher.name}`, n.teacher.role, n.date]);
  chain.push(['Published by the student', `${s.name} chose to make this publishable`, e.date]);
  return { e, s, endorsements, chain, code: verifyCode(e.id) };
}

export function VerifyRecord({ eventId, record, compact }) {
  const r = record || verificationRecord(eventId);
  if (!r) return <p>No record found for this code.</p>;
  const { e, s, endorsements, chain, code } = r;
  const confirmed = e.verification !== 'student-added';
  return (
    <div className={`vrec v-${e.verification}`}>
      <div className={`vrec-status${confirmed ? ' ok' : ''}`}>
        <span className="vrec-mark" aria-hidden="true">{confirmed ? '✓' : '…'}</span>
        <div>
          <b>{confirmed ? (e.verification === 'teacher-endorsed' ? 'Endorsed by a teacher' : 'Confirmed by the school') : 'Added by the student, not yet endorsed'}</b>
          <span>NIST International School · {VERIFY_LABEL[e.verification]}</span>
        </div>
      </div>
      <h3>{e.title}</h3>
      <p className="vrec-who">{s.name} · {fmtDate(e.date)}</p>
      {endorsements[0] && <blockquote>“{endorsements[0].note}”<cite>{endorsements[0].teacher.name}, {endorsements[0].teacher.role}</cite></blockquote>}
      <ol className="vrec-chain">{chain.map(([what, detail, d], i) => <li key={i}><b>{what}</b><span>{detail} · {fmtDate(d)}</span></li>)}</ol>
      {!compact && (
        <div className="vrec-code">
          <Qr text={appUrl(`v/${code}`)} size={112} />
          <div><small>Verification code</small><b>{code}</b><span>Print this code or QR on a CV. Anyone can check it at the school's verification page.</span></div>
        </div>
      )}
    </div>
  );
}

function VerifyDialog({ eventId, onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Verification record" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Verification record</div>
        <VerifyRecord eventId={eventId} />
      </div>
    </div>
  );
}
