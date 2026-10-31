// Advisor year sign-off (api.signOffYear …; docs/pilot-server.md "Advisor year sign-off"): the advisor's checklist on My
// advisory, leadership's progress and settings on the School overview, and the student's gentle card on their home.
import { useMemo, useState } from 'react';
import { getHandoverNote, getStudents, markNotThisYear, mySignoff, schoolYearOf, setSignoffClose, setSignoffYear, shortName, signoffChecklist, signoffCloses, signoffCsv, signoffLocked, signoffProgress, signoffSettingsFor, signOffYear, snapshot, SIGNOFF_MANUAL_MAX, tickSignoff, undoSignoff, getSignoffSettings, TODAY } from '../api.js';
import { fmtDate, inkOn } from '../format.js';
import './year-signoff.css';

const Avatar = ({ s }) => <span className="pres-avatar sm" style={{ background: s.avatar?.colour || '#4F529B', color: inkOn(s.avatar?.colour || '#4F529B') }}>{s.avatar?.initials || '?'}</span>;
const lockText = (c, locked) => (c ? (locked ? `Closed after ${fmtDate(c.on)}: sign-offs are locked` : `Open until ${fmtDate(c.on)}`) : '');

// ── My advisory › Year sign-off ──
export function AdvisorSignoff({ advisorId, version, toast, onOpen }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => getStudents().filter((s) => s.advisorId === advisorId).sort((a, b) => a.name.localeCompare(b.name)).map((s) => signoffChecklist(s.id)), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return null;
  const signed = rows.filter((r) => r.record?.status === 'signed').length, notyet = rows.filter((r) => r.record?.status === 'notyet').length;
  const closes = signoffCloses(), locked = signoffLocked();
  return (
    <section className="card-sec ys-adv" aria-labelledby="ys-adv-h">
      <div className="ys-head">
        <div><h2 id="ys-adv-h">Year sign-off</h2>
          <small className="fineprint">{`Signed off: ${signed} of ${rows.length}${notyet ? ` · ${notyet} not this year` : ''}${closes ? ` · ${lockText(closes, locked)}` : ''}`}</small></div>
        <button className="ghost" aria-expanded={open} aria-controls="ys-adv-list" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Open year sign-off'}</button>
      </div>
      {open && <div id="ys-adv-list">
        <p className="fineprint">{`Look back at each advisee’s ${schoolYearOf()} school year against a short checklist, then sign it off. The checks come from the record, as you see it (never private moments); tick the ones it cannot show. A note goes to next year’s advisor as your handover note.`}</p>
        <span className="ys-meter" aria-hidden="true"><i style={{ width: `${(signed / rows.length) * 100}%` }} /></span>
        <ul className="ys-list">{rows.map((c) => <li key={c.student.id}><SignoffRow c={c} advisorId={advisorId} toast={toast} onOpen={onOpen} locked={locked} /></li>)}</ul>
      </div>}
    </section>
  );
}

const STATUS = { signed: 'Signed off', notyet: 'Not this year' };
function SignoffRow({ c, advisorId, toast, onOpen, locked }) {
  const s = c.student, r = c.record, status = r?.status === 'signed' || r?.status === 'notyet' ? r.status : null;
  const first = s.name.split(' ')[0];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [why, setWhy] = useState(null);
  const run = (f, msg) => { const snap = snapshot(); try { f(); toast(msg, snap); } catch (x) { toast(x.message); } };
  const noteText = note ?? getHandoverNote(s.id, advisorId)?.text ?? '';
  const id = `ys-${s.id}`;
  return (
    <div className={`ys-row${status ? ` ${status}` : ''}`}>
      <div className="ys-who">
        <Avatar s={s} />
        <span><b>{s.name}</b><small>{`Year ${c.year}${s.homeroom ? ` · ${s.homeroom}` : ''} · ${c.met} of ${c.total} checks`}</small></span>
        <span className={`ys-chip${status ? ` ${status}` : ''}`}>{status ? `${STATUS[status]}${status === 'signed' ? ` ${fmtDate(r.at.slice(0, 10))}` : ''}` : 'Not yet'}</span>
        <button className="ghost" aria-expanded={open} aria-controls={id} aria-label={`${open ? 'Hide' : 'Check'} ${s.name}’s year`} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Check'}</button>
      </div>
      {open && <div className="ys-body" id={id}>
        <ul className="ys-items">{c.items.map((i) => (
          <li key={i.id} className={i.met ? 'met' : ''}>
            {i.manual
              ? <label className="ys-tick"><input type="checkbox" checked={i.met} disabled={locked || !!status} onChange={(e) => run(() => tickSignoff(s.id, i.id, e.target.checked, advisorId), e.target.checked ? `Ticked “${i.label}”` : `Unticked “${i.label}”`)} /><span><b>{i.label}</b><small>{i.what}</small></span></label>
              : <><span className="ys-mark" aria-hidden="true">{i.met ? '✓' : '○'}</span>
                <span className="ys-what"><b>{`${i.label}${i.met ? '' : ' (not yet)'}`}</b><small>{i.what}</small><span className="ys-detail">{i.detail}</span></span>
                <button className="linkish" onClick={() => onOpen(i.eventId ? `${s.id}~${i.eventId}` : s.id)} aria-label={`${i.eventId ? 'Open it' : 'Open the map'}: ${i.label}, ${s.name}`}>{i.eventId ? 'Open it' : 'Open the map'}</button></>}
          </li>))}</ul>
        {status === 'signed' && <p className="ys-done">{`Signed off on ${fmtDate(r.at.slice(0, 10))}. ${first} sees “Your advisor has signed off your year” with what went well, never the checklist.`}</p>}
        {status === 'notyet' && <p className="ys-done">{`Not this year${r.reason ? `: ${r.reason}` : ''}`}<small>Only you see the reason.</small></p>}
        {!status && !locked && <>
          <label className="ys-note" htmlFor={`${id}-note`}>Note for next year’s advisor (optional)</label>
          <textarea id={`${id}-note`} rows={3} maxLength={3000} value={noteText} onChange={(e) => setNote(e.target.value)} placeholder="Strengths, what helps, what to watch" />
          <small className="fineprint">Kept as your handover note: staff only, never the student or their family.</small>
          {why !== null && <div className="ys-why">
            <label htmlFor={`${id}-why`}>Why not this year? Only you see this.</label>
            <textarea id={`${id}-why`} rows={2} maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>}
          <div className="ys-foot">
            {c.met < c.total && why === null && <small className="fineprint">{`${c.total - c.met} not met yet. You can still sign off.`}</small>}
            {why === null
              ? <><button className="ghost" onClick={() => setWhy('')}>Not this year</button>
                <button className="primary" onClick={() => run(() => signOffYear(s.id, advisorId, note === null ? {} : { note }), `Signed off ${first}’s year`)}>Sign off</button></>
              : <><button className="ghost" onClick={() => setWhy(null)}>Cancel</button>
                <button className="primary" onClick={() => run(() => markNotThisYear(s.id, advisorId, why), `${first}: not this year`)}>Save</button></>}
          </div>
        </>}
        {status && !locked && <div className="ys-foot"><button className="ghost" onClick={() => run(() => undoSignoff(s.id, advisorId), status === 'signed' ? `Sign-off taken back for ${first}` : `Taken back for ${first}`)}>{status === 'signed' ? 'Undo sign-off' : 'Undo'}</button></div>}
      </div>}
    </div>
  );
}

// ── School overview › Year sign-off: progress by Year and homeroom (counts only), CSV, the closing date, the checklist ──
export function SignoffProgress({ persona, version, toast }) {
  const p = useMemo(() => signoffProgress(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shown, setShown] = useState({});
  const [edit, setEdit] = useState(false);
  const by = persona?.teacherId || null;
  const [close, setClose] = useState(p.closes?.on || '');
  const csv = () => {
    const url = URL.createObjectURL(new Blob([signoffCsv()], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `year-signoff-${p.schoolYear}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveClose = (d) => { const snap = snapshot(); try { setSignoffClose(d || null, by); setClose(d || ''); toast?.(d ? `Sign-offs lock after ${fmtDate(d)}` : 'No closing date', snap); } catch (x) { toast?.(x.message); } };
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  return (
    <section className="card-sec ys-prog" aria-labelledby="ys-prog-h">
      <div className="ys-head">
        <div><h2 id="ys-prog-h">{`Year sign-off ${p.schoolYear}`}</h2>
          <small className="fineprint">{`Advisors check each advisee’s year and sign it off. Counts only: no notes, no reasons. Signed off: ${p.total.signed} of ${p.total.students}.${p.closes ? ` ${lockText(p.closes, p.locked)}.` : ''}`}</small></div>
        <span className="ys-acts"><button className="ghost" onClick={csv}>Download as CSV</button><button className="ghost" aria-expanded={edit} onClick={() => setEdit(!edit)}>{edit ? 'Close settings' : 'Checklist and closing date'}</button></span>
      </div>
      {edit && <div className="ys-settings">
        <div className="ys-close">
          <label htmlFor="ys-close">Sign-offs lock after</label>
          <input id="ys-close" type="date" value={close} min={TODAY} onChange={(e) => setClose(e.target.value)} />
          <button className="primary" disabled={!close || close === p.closes?.on} onClick={() => saveClose(close)}>Save date</button>
          {p.closes && <button className="ghost" onClick={() => saveClose(null)}>No closing date</button>}
          <small className="fineprint">Until then advisors can take a sign-off back. After it, every sign-off for this school year stays as it is.</small>
        </div>
        <YearChecklist by={by} toast={toast} />
      </div>}
      <div className="ys-scroll">
        <table className="us-table ys-table">
          <thead><tr><th scope="col">Year</th><th scope="col">Students</th><th scope="col">Signed off</th><th scope="col">Not this year</th><th scope="col">Not yet</th><th scope="col"><span className="sr-only">Progress</span></th></tr></thead>
          <tbody>
            {p.years.map((y) => [
              <tr key={y.year} className="ys-year">
                <th scope="row"><button className="linkish" aria-expanded={!!shown[y.year]} onClick={() => setShown({ ...shown, [y.year]: !shown[y.year] })}>{`Year ${y.year}`}</button></th>
                <td>{y.students}</td><td><b>{y.signed}</b></td><td>{y.notyet}</td><td>{y.students - y.signed - y.notyet}</td>
                <td><span className="ys-meter" aria-hidden="true"><i style={{ width: `${pct(y.signed, y.students)}%` }} /></span></td>
              </tr>,
              ...(shown[y.year] ? y.homerooms.map((h) => (
                <tr key={`${y.year}|${h.homeroom}`} className="ys-hr">
                  <th scope="row">{h.homeroom || 'No homeroom'}</th>
                  <td>{h.students}</td><td><b>{h.signed}</b></td><td>{h.notyet}</td><td>{h.students - h.signed - h.notyet}</td>
                  <td><span className="ys-hr-n">{`${h.homeroom || 'No homeroom'}: ${h.signed} of ${h.students}`}</span></td>
                </tr>)) : []),
            ])}
            <tr className="ov-total"><th scope="row">All Years</th><td>{p.total.students}</td><td><b>{p.total.signed}</b></td><td>{p.total.notyet}</td><td>{p.total.students - p.total.signed - p.total.notyet}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function YearChecklist({ by, toast }) {
  const [year, setYear] = useState(8);
  const custom = !!getSignoffSettings().years?.[year];
  const [f, setF] = useState(() => signoffSettingsFor(8));
  const pick = (y) => { setYear(y); setF(signoffSettingsFor(y)); };
  const save = (v) => { const snap = snapshot(); try { setF(setSignoffYear(year, v, by)); toast?.(v ? `Checklist saved for Year ${year}` : `Year ${year} is back to the usual checklist`, snap); } catch (x) { toast?.(x.message); } };
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <fieldset className="ys-check">
      <legend>Checklist</legend>
      <label className="ys-inline">Year <select value={year} onChange={(e) => pick(Number(e.target.value))}>{[7, 8, 9, 10, 11, 12, 13].map((y) => <option key={y} value={y}>{`Year ${y}`}</option>)}</select></label>
      <small className="fineprint">{custom ? 'This Year has its own checklist.' : 'This Year uses the usual checklist.'}</small>
      <label className="ys-inline">Moments on at least <input type="number" min={0} max={9} value={f.lines} onChange={(e) => set('lines', Number(e.target.value))} /> lines this year (0: leave out)</label>
      <label className="ys-inline"><input type="checkbox" checked={f.endorsed} onChange={(e) => set('endorsed', e.target.checked)} />At least one endorsed moment</label>
      <label className="ys-inline"><input type="checkbox" checked={f.reflection} onChange={(e) => set('reflection', e.target.checked)} />A term reflection done</label>
      <label className="ys-inline"><input type="checkbox" checked={f.goal} onChange={(e) => set('goal', e.target.checked)} />A goal set or met</label>
      {(year === 9 || year === 11) && <label className="ys-inline"><input type="checkbox" checked={f.movingUp} onChange={(e) => set('movingUp', e.target.checked)} />Moving-up summary (shows once moving-up summaries are in use)</label>}
      {year >= 12 && <label className="ys-inline"><input type="checkbox" checked={f.cas} onChange={(e) => set('cas', e.target.checked)} />CAS on track: all three strands and at least <input type="number" min={0} max={500} value={f.casHours} onChange={(e) => set('casHours', Number(e.target.value))} aria-label="Confirmed CAS hours" /> confirmed hours</label>}
      <div className="ys-manual">
        <b>Ticked by the advisor</b>
        {f.manual.map((m, i) => <span key={m.id || i} className="ys-inline">
          <input aria-label={`Item ${i + 1} ticked by the advisor`} value={m.label} maxLength={100} onChange={(e) => set('manual', f.manual.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <button className="ghost" onClick={() => set('manual', f.manual.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`}>Remove</button></span>)}
        {f.manual.length < SIGNOFF_MANUAL_MAX && <button className="ghost" onClick={() => set('manual', [...f.manual, { label: '' }])}>Add an item</button>}
      </div>
      <div className="ys-foot">
        {custom && <button className="ghost" onClick={() => save(null)}>Back to the usual</button>}
        <button className="primary" onClick={() => save(f)}>{`Save for Year ${year}`}</button>
      </div>
    </fieldset>
  );
}

// ── The student's home: a gentle note once their advisor signed off the year, with what went well ──
const HIDE = (id) => `tp-ys-hide:${id}`;
const hidden = (id) => { try { return localStorage.getItem(HIDE(id)) === '1'; } catch { return false; } };
const n1 = (n, one, many) => (n === 1 ? one : many);
export function celebratedLines(c = {}) {
  return [
    c.lines && n1(c.lines, 'Moments on 1 line', `Moments on ${c.lines} lines`),
    c.endorsed && n1(c.endorsed, '1 endorsed moment', `${c.endorsed} endorsed moments`),
    c.reflection && 'Your term reflection',
    c.goalsMet && n1(c.goalsMet, '1 goal met', `${c.goalsMet} goals met`),
    !c.goalsMet && c.goalsSet && 'A goal to work towards',
    c.movingUp && 'Your moving-up summary',
    c.casHours && n1(c.casHours, '1 hour of CAS confirmed', `${c.casHours} hours of CAS confirmed`),
  ].filter(Boolean);
}
export function YearSignoffCard({ studentId, version, simple }) {
  const r = useMemo(() => mySignoff(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [gone, setGone] = useState(false);
  if (!r || gone || hidden(r.id)) return null;
  const lines = celebratedLines(r.celebrated || {});
  const who = r.advisor ? shortName(r.advisor.name) : 'Your advisor';
  const hide = () => { try { localStorage.setItem(HIDE(r.id), '1'); } catch { /* storage blocked */ } setGone(true); };
  return (
    <section className={`ys-card${simple ? ' simple' : ''}`} aria-labelledby="ys-card-h">
      <div className="ys-card-text">
        <h2 id="ys-card-h">Your advisor has signed off your year</h2>
        <p>{lines.length ? `${who} looked back at your year. What stood out:` : 'Well done on your year.'}</p>
        {lines.length > 0 && <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>}
      </div>
      <button className="ghost" onClick={hide}>Hide</button>
    </section>
  );
}
