import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getEvent, getStore } from '../api.js';
import { fmtDate } from '../format.js';
import { verificationRecord } from './VerifyModal.jsx';

const SYNC = { SIS: 'Nightly pull', ManageBac: 'Webhook', 'CAS log': 'Hourly pull', 'Clubs & Sports': 'CSV import', GitHub: 'Webhook', 'Exam boards': 'Monthly pull', 'Manual entry': 'Typed by the student', 'Phone capture': 'Phone app' };

// The "track bed": the raw event in the data core, where it came from, and its verification chain.
export default function RecordInspector({ eventId, onClose }) {
  const [tab, setTab] = useState('record');
  const e = getEvent(eventId);
  if (!e) return null;
  const r = verificationRecord(eventId);
  const store = getStore();
  const raw = { ...e, reflections: store.reflections.filter((x) => x.eventId === e.id).map(({ id, visibility, date }) => ({ id, visibility, date })), endorsements: store.endorsements.filter((n) => n.eventId === e.id).map(({ id, teacherId, date }) => ({ id, teacherId, date })) };
  const sys = e.source.system;
  const syncs = sys === 'Manual entry' || sys === 'Phone capture'
    ? [[e.date, 'Created in the portfolio', 'student-added']]
    : [[e.date, `First imported from ${sys}`, `ref ${e.source.ref || '–'}`], ...(e.verification === 'school-verified' ? [[e.date, 'Matched to the student by SIS id', 'auto']] : []), ['2026-10-26', `Last checked against ${sys}`, 'unchanged']];
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className="modal inspector" role="dialog" aria-label="Record inspector" onClick={(ev) => ev.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Data core · one record, read by every view</div>
        <h2>{e.title}</h2>
        <div className="seg small" role="tablist">
          {[['record', 'Record'], ['source', 'Source and sync'], ['chain', 'Verification chain']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'record' && <pre className="raw">{JSON.stringify(raw, null, 2)}</pre>}
        {tab === 'source' && (
          <div className="insp-src">
            <dl className="meta"><dt>System</dt><dd>{sys}</dd><dt>Reference</dt><dd>{e.source.ref || '–'}</dd><dt>How it arrives</dt><dd>{SYNC[sys] || 'Import'}</dd><dt>Event id</dt><dd><code>{e.id}</code></dd></dl>
            <ol className="vrec-chain">{syncs.map(([d, what, note], i) => <li key={i}><b>{what}</b><span>{fmtDate(d)} · {note}</span></li>)}</ol>
            <p className="fineprint">Presentations never copy this record. Each lens, share link and export reads it, so a correction here shows up everywhere.</p>
          </div>
        )}
        {tab === 'chain' && <ol className="vrec-chain">{r.chain.map(([what, detail, d], i) => <li key={i}><b>{what}</b><span>{detail} · {fmtDate(d)}</span></li>)}</ol>}
      </div>
    </div>,
    document.body,
  );
}
