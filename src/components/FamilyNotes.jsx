// Family encouragement (api.addFamilyNote): pilot only. A family member leaves one short kind note (and maybe a reaction) on
// a child's moment the family view shows, and can change or delete it. The student reads it on the moment (and big on the
// Simple home), says thank you, hides it from their own view or reports it. The advisor, the student's current teachers and
// whole-school roles read it (server/scope.mjs sends it to nobody else). Family words in English or Thai; the student's
// screens are shown in Thai by src/thai.js.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { deleteFamilyNote, editFamilyNote, addFamilyNote, FAMILY_NOTE_MAX, FAMILY_REACTIONS, familyNoteReader, familyNotesFor, familyNotesOf, familyNotesOn, familyShows, getEvent, getReports, getStudent, hasPublicCopy, setFamilyNoteHidden, snapshot, thankFamilyNote } from '../api.js';
import { isPilot } from '../auth.js';
import { personaById } from '../personas.js';
import { fmtDate } from '../format.js';
import { dateIn, errText, useLang } from '../i18n.js';
import { ReportDialog } from './Report.jsx';
import './family-notes.css';

const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
const WHOLE = ['counsellor', 'coordinator', 'leadership'];
const viewer = () => personaById(location.hash.replace(/^#\/?/, '').split('/')[0]);
const off = () => !isPilot() || hasPublicCopy() || /^#\/?(s|v|p|preview)\//.test(location.hash);
const first = (sid) => getStudent(sid)?.name.split(' ')[0] || '';
const run = (toast, fn, msg, snap) => { try { fn(); if (msg) toast?.(msg, snap); return true; } catch (e) { toast?.(e.message || 'That did not work.'); return false; } };

// What a family reads, in English or Thai.
const W = {
  en: {
    h: 'Notes from family', react: 'Add a reaction (optional)', write: (f) => `A few kind words for ${f}`, send: 'Send note', save: 'Save', cancel: 'Cancel',
    edit: 'Change', del: 'Delete', count: (n) => `${n} of ${FAMILY_NOTE_MAX} characters`, who: (f) => `${f} sees your name and your note. Their advisor and teachers can read it too.`,
    sent: (f) => `Sent. ${f} will see it.`, saved: 'Saved.', deleted: 'Note deleted.', you: 'You', thanked: (f) => `${f} said thank you`,
    offNow: (f) => `${f} has turned notes from family off for now.`, held: 'A teacher is looking at this note. Only you and school staff can see it now.',
    edited: 'changed', R: FAMILY_REACTIONS,
  },
  th: {
    h: 'ข้อความจากครอบครัว', react: 'เลือกคำให้กำลังใจ (ไม่บังคับ)', write: (f) => `เขียนให้กำลังใจ ${f} สั้น ๆ`, send: 'ส่งข้อความ', save: 'บันทึก', cancel: 'ยกเลิก',
    edit: 'แก้ไข', del: 'ลบ', count: (n) => `${n} จาก ${FAMILY_NOTE_MAX} ตัวอักษร`, who: (f) => `${f} จะเห็นชื่อและข้อความของคุณ ครูที่ปรึกษาและครูผู้สอนอ่านได้ด้วย`,
    sent: (f) => `ส่งแล้ว ${f} จะได้เห็น`, saved: 'บันทึกแล้ว', deleted: 'ลบข้อความแล้ว', you: 'คุณ', thanked: (f) => `${f} ขอบคุณแล้ว`,
    offNow: (f) => `${f} ปิดรับข้อความจากครอบครัวไว้ชั่วคราว`, held: 'ครูกำลังตรวจดูข้อความนี้ ตอนนี้มีเพียงคุณและบุคลากรของโรงเรียนที่เห็น',
    edited: 'แก้ไขแล้ว', R: { proud: 'ภูมิใจในตัวลูกนะ', welldone: 'เก่งมาก', dinner: 'มื้อเย็นนี้เล่าให้ฟังหน่อยนะ', keepgoing: 'สู้ต่อไปนะ' },
  },
};

// Who is looking at this moment: { as: 'family' | 'student' | 'staff', from? (a family member's key and name), report? }.
function whoFor(event) {
  if (!event || off()) return null;
  const p = viewer();
  if (p.kind === 'parent' && (p.children || []).includes(event.studentId) && p.account?.id) return { as: 'family', from: { key: `u:${p.account.id}`, name: p.name } };
  if (p.kind === 'student') return p.studentId === event.studentId ? { as: 'student', report: { key: 'student' } } : null;
  const admin = p.kind === 'admin' || !!p.admin;
  if (admin || (STAFF.includes(p.kind) && (WHOLE.includes(p.kind) || familyNoteReader(p.teacherId, event.studentId)))) return { as: 'staff', report: p.teacherId ? { key: p.teacherId } : admin ? { key: 'admin', name: p.name } : null };
  return null;
}

// ── On a moment (station panel, the Simple moment card) ──
export function FamilyNotesOn({ event: shown, simple = false, toast }) {
  const [, bump] = useState(0);
  const lang = useLang();
  const event = shown && (getEvent(shown.id) || shown);
  const v = whoFor(event);
  if (!v || event.type === 'goal') return null;
  const all = familyNotesFor(event.id);
  const redo = () => bump((n) => n + 1);
  if (v.as === 'family') {
    const w = W[lang === 'th' ? 'th' : 'en'], f = first(event.studentId);
    const mine = all.find((n) => n.by === v.from.key), on = familyNotesOn(event.studentId);
    return (
      <section className="fn-on fam" aria-label={w.h} lang={lang}>
        <h3>{w.h}</h3>
        <NoteList list={all} w={w} lang={lang} mineKey={v.from.key} toast={toast} onChange={redo} />
        {!on && <p className="fineprint">{w.offNow(f)}</p>}
        {on && !mine && familyShows(event) && <Composer event={event} from={v.from} w={w} lang={lang} toast={toast} onDone={redo} />}
      </section>
    );
  }
  if (v.as === 'student') {
    if (!familyNotesOn(event.studentId) || !all.length) return null;
    return (
      <section className={`fn-on${simple ? ' big' : ''}`} aria-label="Notes from your family">
        <h3>Notes from your family</h3>
        <StudentNotes list={all} simple={simple} toast={toast} onChange={redo} />
      </section>
    );
  }
  if (!all.length) return null;
  return (
    <section className="fn-on" aria-label="Notes from family">
      <h3>Notes from family</h3>
      <StaffNotes list={all} from={v.report} toast={toast} onChange={redo} />
    </section>
  );
}

function Composer({ event, from, w, lang, toast, onDone, note }) {
  const [reaction, setReaction] = useState(note?.reaction || null);
  const [text, setText] = useState(note?.text || '');
  const [err, setErr] = useState(null);
  const f = first(event.studentId);
  const ready = (reaction || text.trim()) && text.trim().length <= FAMILY_NOTE_MAX;
  const send = () => {
    setErr(null);
    try {
      if (note) editFamilyNote(note.id, from.key, text, reaction); else addFamilyNote(event.id, from, text, reaction);
      toast?.(note ? w.saved : w.sent(f)); onDone?.();
    } catch (x) { setErr(errText(lang, x.message) || 'That did not work.'); }
  };
  return (
    <div className="fn-compose">
      <div className="fn-reacts" role="group" aria-label={w.react}>
        {Object.keys(FAMILY_REACTIONS).map((k) => <button key={k} type="button" aria-pressed={reaction === k} className={reaction === k ? 'on' : ''} onClick={() => setReaction(reaction === k ? null : k)}>{w.R[k]}</button>)}
      </div>
      <textarea rows={3} maxLength={FAMILY_NOTE_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={w.write(f)} aria-label={w.write(f)} />
      <div className="fn-foot">
        <small className="fn-count" aria-live="polite">{w.count(text.trim().length)}</small>
        {note && <button className="ghost small-btn" onClick={onDone}>{w.cancel}</button>}
        <button className="primary small-btn" disabled={!ready} onClick={send}>{note ? w.save : w.send}</button>
      </div>
      {err && <p className="up-error" role="alert">{err}</p>}
      {!note && <p className="fineprint">{w.who(f)}</p>}
    </div>
  );
}

// A family's list: everyone's notes on this moment; your own with Change and Delete.
function NoteList({ list, w, lang, mineKey, toast, onChange }) {
  const [editing, setEditing] = useState(null);
  if (!list.length) return null;
  return (
    <ul className="fn-list">
      {list.map((n) => {
        const mine = n.by === mineKey;
        return (
          <li key={n.id} className="fn-note">
            {editing === n.id ? <Composer event={getEvent(n.eventId)} from={{ key: mineKey }} w={w} lang={lang} note={n} toast={toast} onDone={() => { setEditing(null); onChange(); }} /> : <>
              {n.reaction && <b className="fn-react">{w.R[n.reaction]}</b>}
              {n.text && <p>{n.text}</p>}
              <small className="fn-who">{mine ? w.you : n.name} · {dateIn(lang, n.at.slice(0, 10))}{n.edited ? ` · ${w.edited}` : ''}{n.thanked ? ` · ${w.thanked(first(n.studentId))}` : ''}</small>
              {mine && n.hidden && <p className="sg-hidden small" role="status">{w.held}</p>}
              {mine && <div className="fn-acts">
                <button className="ghost small-btn" onClick={() => setEditing(n.id)}>{w.edit}</button>
                <button className="linkish" onClick={() => { run(toast, () => deleteFamilyNote(n.id, mineKey), w.deleted); onChange(); }}>{w.del}</button>
              </div>}
            </>}
          </li>
        );
      })}
    </ul>
  );
}

function StudentNotes({ list, simple, toast, onChange, onOpen, titled = false }) {
  const [showHidden, setShowHidden] = useState(false);
  const [reporting, setReporting] = useState(null);
  const hidden = list.filter((n) => n.studentHidden), shown = list.filter((n) => !n.studentHidden || showHidden);
  return (
    <>
      <ul className={`fn-list${simple ? ' big' : ''}`}>
        {shown.map((n) => {
          const e = getEvent(n.eventId);
          const reported = getReports().some((r) => r.familyNoteId === n.id && r.status === 'open');
          return (
            <li key={n.id} className={`fn-note${n.studentHidden ? ' muted' : ''}`}>
              {n.reaction && <b className="fn-react">{FAMILY_REACTIONS[n.reaction]}</b>}
              {n.text && <p>{n.text}</p>}
              <small className="fn-who">{`From ${n.name}`}{titled && e ? <> · <span>{`on “${e.title}”`}</span></> : null} · {fmtDate(n.at.slice(0, 10))}</small>
              <div className="fn-acts">
                {n.thanked ? <span className="fn-thanked">You said thank you</span> : <button className={simple ? 'primary' : 'ghost small-btn'} onClick={() => { run(toast, () => thankFamilyNote(n.id), `${n.name} will see your thank you.`); onChange?.(); }}>Say thank you</button>}
                {onOpen && e && <button className="ghost small-btn" onClick={() => onOpen(e.id)}>Open the moment</button>}
                {n.studentHidden
                  ? <button className="linkish" onClick={() => { run(toast, () => setFamilyNoteHidden(n.id, false)); onChange?.(); }}>Show again</button>
                  : <button className="linkish" onClick={() => { const snap = snapshot(); run(toast, () => setFamilyNoteHidden(n.id, true), 'Hidden. You will not see it here.', snap); onChange?.(); }}>Hide</button>}
                {reported ? <span className="sg-sent">You told a teacher about this</span> : <button className="linkish sg-report" onClick={() => setReporting(n)}>Report</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {hidden.length > 0 && !showHidden && <button className="linkish fn-more" onClick={() => setShowHidden(true)}>{hidden.length === 1 ? 'Show 1 hidden note' : `Show ${hidden.length} hidden notes`}</button>}
      {reporting && createPortal(<ReportDialog event={getEvent(reporting.eventId)} from={{ key: 'student' }} simple={simple} target={{ familyNoteId: reporting.id }} what="this note" quote={reporting.text || FAMILY_REACTIONS[reporting.reaction]}
        onClose={() => setReporting(null)} onSent={() => { setReporting(null); toast?.('Thank you. A teacher will look at it.'); onChange?.(); }} />, document.body)}
    </>
  );
}

function StaffNotes({ list, from, toast, onChange }) {
  const [reporting, setReporting] = useState(null);
  return (
    <>
      <ul className="fn-list">
        {list.map((n) => {
          const reported = from && getReports().some((r) => r.familyNoteId === n.id && r.from?.key === from.key && r.status === 'open');
          return (
            <li key={n.id} className="fn-note">
              {n.reaction && <b className="fn-react">{FAMILY_REACTIONS[n.reaction]}</b>}
              {n.text && <p>{n.text}</p>}
              <small className="fn-who">{n.name} (family) · {fmtDate(n.at.slice(0, 10))}{n.thanked ? ' · thanked' : ''}{n.studentHidden ? ` · ${first(n.studentId)} hid it` : ''}</small>
              {n.hidden && <p className="sg-hidden small" role="status">Hidden after a report by {n.hidden.by}: only staff and its writer see it.</p>}
              {from && !n.hidden && <div className="fn-acts">{reported ? <span className="sg-sent">Reported. A teacher will look at it.</span> : <button className="linkish sg-report" onClick={() => setReporting(n)}>Report</button>}</div>}
            </li>
          );
        })}
      </ul>
      {reporting && createPortal(<ReportDialog event={getEvent(reporting.eventId)} from={from} target={{ familyNoteId: reporting.id }} what="this note" quote={reporting.text || FAMILY_REACTIONS[reporting.reaction]}
        onClose={() => setReporting(null)} onSent={() => { setReporting(null); toast?.('Thank you. A teacher will look at it.'); onChange?.(); }} />, document.body)}
    </>
  );
}

// ── The Simple home: notes from family, big and warm (newest first, ones not thanked yet before the rest) ──
export function FamilyNotesHome({ studentId, toast, version, onOpen }) {
  const [, bump] = useState(0);
  const [all, setAll] = useState(false);
  const list = useMemo(() => (off() || !familyNotesOn(studentId) ? [] : familyNotesOf(studentId).filter((n) => !n.studentHidden && !n.hidden && getEvent(n.eventId))
    .sort((a, b) => (!a.thanked === !b.thanked ? 0 : a.thanked ? 1 : -1))), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 3);
  return (
    <section className="fn-home" aria-labelledby="fn-home-h">
      <h2 id="fn-home-h">From your family</h2>
      <StudentNotes list={shown} simple titled toast={toast} onOpen={onOpen} onChange={() => bump((n) => n + 1)} />
      {list.length > shown.length && <button className="linkish fn-more" onClick={() => setAll(true)}>{`Show all ${list.length}`}</button>}
    </section>
  );
}

// ── The family view: where notes go ──
export function FamilyNotesHint({ childId, lang }) {
  if (off()) return null;
  const f = first(childId);
  if (!familyNotesOn(childId)) return <p className="fineprint fn-hint">{W[lang === 'th' ? 'th' : 'en'].offNow(f)}</p>;
  return <p className="fineprint fn-hint">{lang === 'th' ? `เปิดดูรายการใดก็ได้ เพื่อเขียนข้อความให้กำลังใจ ${f}` : `Open any moment to leave ${f} a kind note.`}</p>;
}

// ── Privacy: the student turns notes from family off or on ──
export function FamilyNotesSwitch({ studentId, onChange }) {
  if (!isPilot()) return null;
  const on = familyNotesOn(studentId);
  return (
    <label className="pv-row fn-switch"><span>Let my family leave kind notes on moments they can see</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
