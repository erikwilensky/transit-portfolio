// Conference booking (api.openConferenceRound … sendConferenceReminders): the advisor's round and day grid on My advisory,
// the printed day schedule, the whole-Year panel on the school overview, the family's card (Thai or English, children side
// by side) and the student's "Your conference" line. Times are Bangkok time.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { advisorConfRounds, advisoryOf, blockConferenceSlot, bookConference, cancelConference, closeConferenceRound, confBookingOf, confClash, confGrid,
  confProgress, confTooSoon, CONF_SLOTS, editConferenceRound, familyConfRounds, getConferenceRounds, getStudent, getTeacher, openConferenceRound, roundLive,
  shortName, snapshot, studentConferences, TODAY } from '../api.js';
import { fmtDate } from '../format.js';
import { printDate, printDocument, usePrintTitle } from '../print.js';
import { confDay, confSlotText, confWords, errText } from '../i18n.js';
import { conferenceSheetLink } from '../conference.js';
import Logo from './Logo.jsx';
import './conference-booking.css';

const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const first = (s) => s?.name.split(' ')[0] || '';
const placeOf = (r) => (r.online ? `Online${r.location ? ` · ${r.location}` : ''}` : r.location);
const whenEn = (d, t) => confSlotText('en', d, t);
const blankForm = (r) => r ? { title: r.title, slot: r.slot, days: r.days.map((d) => ({ ...d })), breaks: r.breaks.map((b) => ({ ...b })), online: r.online, location: r.location, link: r.link }
  : { title: 'Parent conferences', slot: 15, days: [{ date: addDays(TODAY, 7), from: '15:00', to: '18:00' }], breaks: [], online: false, location: '', link: '' };

// ── The round form: title, days with hours, slot length, breaks, a room or an online link ──
function RoundForm({ start, label, onSave, onCancel, children, idp }) {
  const [f, setF] = useState(() => blankForm(start));
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setRow = (k, i, p) => set({ [k]: f[k].map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <form className="cb-form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      {children}
      <label>Title<input value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
      <label>Each conference<select value={f.slot} onChange={(e) => set({ slot: Number(e.target.value) })}>{CONF_SLOTS.map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></label>
      <fieldset className="cb-rows"><legend>Days and hours <small>(Bangkok time)</small></legend>
        {f.days.map((d, i) => (
          <div className="cb-row" key={i}>
            <label>Day<input type="date" value={d.date} min={start ? undefined : TODAY} onChange={(e) => setRow('days', i, { date: e.target.value })} /></label>
            <label>From<input type="time" step={300} value={d.from} onChange={(e) => setRow('days', i, { from: e.target.value })} /></label>
            <label>To<input type="time" step={300} value={d.to} onChange={(e) => setRow('days', i, { to: e.target.value })} /></label>
            {f.days.length > 1 && <button type="button" className="linkish" onClick={() => set({ days: f.days.filter((_, j) => j !== i) })}>Remove<span className="sr-only"> day {i + 1}</span></button>}
          </div>
        ))}
        {f.days.length < 10 && <button type="button" className="ghost small-btn" onClick={() => set({ days: [...f.days, { ...f.days.at(-1), date: addDays(f.days.at(-1).date || TODAY, 1) }] })}>Add a day</button>}
      </fieldset>
      <fieldset className="cb-rows"><legend>Breaks <small>(every day, optional)</small></legend>
        {f.breaks.map((b, i) => (
          <div className="cb-row" key={i}>
            <label>From<input type="time" step={300} value={b.from} onChange={(e) => setRow('breaks', i, { from: e.target.value })} /></label>
            <label>To<input type="time" step={300} value={b.to} onChange={(e) => setRow('breaks', i, { to: e.target.value })} /></label>
            <button type="button" className="linkish" onClick={() => set({ breaks: f.breaks.filter((_, j) => j !== i) })}>Remove<span className="sr-only"> break {i + 1}</span></button>
          </div>
        ))}
        {f.breaks.length < 6 && <button type="button" className="ghost small-btn" onClick={() => set({ breaks: [...f.breaks, { from: '16:30', to: '16:45' }] })}>Add a break</button>}
      </fieldset>
      <fieldset className="cb-where"><legend>Where</legend>
        <label className="cb-radio"><input type="radio" name={`${idp}-where`} checked={!f.online} onChange={() => set({ online: false })} /> In a room</label>
        <label className="cb-radio"><input type="radio" name={`${idp}-where`} checked={f.online} onChange={() => set({ online: true })} /> Online (link)</label>
        {f.online
          ? <label>Meeting link<input type="url" value={f.link} placeholder="https://" onChange={(e) => set({ link: e.target.value })} /></label>
          : <label>Room<input value={f.location} maxLength={80} placeholder="e.g. Room 214" onChange={(e) => set({ location: e.target.value })} /></label>}
      </fieldset>
      <div className="cb-form-foot"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button type="submit" className="primary">{label}</button></div>
    </form>
  );
}

// ── My advisory: open a round, then the day grid ──
export function AdvisoryBooking({ advisorId, persona, version, toast, focus }) {
  const rounds = useMemo(() => advisorConfRounds(advisorId), [advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const group = advisoryOf(advisorId);
  const [, fr, fd] = /^conf~([^~]+)~?(.*)$/.exec(focus || '') || [];
  if (!group.size && !rounds.length) return null;
  const open = (f) => {
    const snap = snapshot();
    try { const r = openConferenceRound({ ...f, advisorId }, advisorId); setOpening(false); toast(`Conference booking is open for ${plural(r.studentIds.length, 'family', 'families')}`, snap); } catch (e) { toast(e.message); }
  };
  const live = rounds.some(roundLive);
  return (
    <section className="card-sec cb-adv" aria-labelledby="cb-adv-h">
      <div className="nd-head"><div><h2 id="cb-adv-h">Conference booking</h2>
        <small className="fineprint">Families pick a time in the app (no email). They can change or cancel until 24 hours before; you can book for a family and block times.</small></div>
        {!opening && !live && <button className="ghost" onClick={() => setOpening(true)}>Open conference booking</button>}</div>
      {opening && <RoundForm idp="cb-new" label={`Open for ${plural(group.size, 'family', 'families')}`} onSave={open} onCancel={() => setOpening(false)} />}
      {rounds.map((r) => <AdvisorRound key={r.id} r={r} advisorId={advisorId} persona={persona} version={version} toast={toast} startDay={r.id === fr ? fd : null} />)}
    </section>
  );
}

function AdvisorRound({ r, advisorId, persona, version, toast, startDay }) {
  const p = useMemo(() => confProgress(r.id, advisorId), [r, advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [grid, setGrid] = useState(!!startDay || roundLive(r));
  const [day, setDay] = useState(r.days.some((d) => d.date === startDay) ? startDay : (r.days.find((d) => d.date >= TODAY) || r.days[0]).date);
  const [editing, setEditing] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [print, setPrint] = useState(false);
  const mine = r.advisorId === advisorId || r.by === advisorId;
  const by = r.by && r.by !== advisorId ? getTeacher(r.by)?.name : null;
  const edit = (f) => { const snap = snapshot(); try { editConferenceRound(r.id, f, advisorId); setEditing(false); toast('Conference details saved', snap); } catch (e) { toast(e.message); } };
  return (
    <div className="cb-round">
      <div className="cb-round-head">
        <div><h3>{r.title}</h3>
          <small className="fineprint">{r.days.map((d) => `${confDay('en', d.date)} ${d.from}–${d.to}`).join(' · ')} · {r.slot} minutes · {placeOf(r)}{by ? ` · opened by ${by}${r.year ? ` for Year ${r.year}` : ''}` : ''}{r.closedOn ? ` · closed ${fmtDate(r.closedOn)}` : ''}</small></div>
        <b className="cb-count">Booked: {p.booked} of {p.total}</b>
      </div>
      <div className="cb-actions">
        <button className="ghost" aria-expanded={grid} onClick={() => setGrid(!grid)}>{grid ? 'Hide the day grid' : 'Day grid'}</button>
        {p.waiting.length > 0 && <button className="linkish" aria-expanded={waiting} onClick={() => setWaiting(!waiting)}>Not booked yet ({p.waiting.length})</button>}
        {mine && !r.closedOn && !editing && <button className="ghost" onClick={() => setEditing(true)}>Edit</button>}
        {mine && !r.closedOn && <button className="ghost" onClick={() => { const snap = snapshot(); closeConferenceRound(r.id, advisorId); toast(`Booking for ${r.title} is closed`, snap); }}>Close booking</button>}
      </div>
      {waiting && <ul className="cb-waiting">{p.waiting.map((s) => <li key={s.id}>{s.name}</li>)}</ul>}
      {editing && <RoundForm idp={`cb-ed-${r.id}`} start={r} label="Save" onSave={edit} onCancel={() => setEditing(false)} />}
      {grid && <>
        <div className="seg small cb-days" role="group" aria-label="Day">
          {r.days.map((d) => <button key={d.date} className={d.date === day ? 'on' : ''} aria-pressed={d.date === day} onClick={() => setDay(d.date)}>{confDay('en', d.date)}</button>)}
        </div>
        <DayGrid r={r} advisorId={advisorId} date={day} students={p.students} version={version} toast={toast} />
        <button className="ghost" onClick={() => setPrint(true)}>Print the day’s schedule</button>
      </>}
      {print && <DaySchedule r={r} advisorId={advisorId} date={day} persona={persona} onClose={() => setPrint(false)} />}
    </div>
  );
}

function DayGrid({ r, advisorId, date, students, version, toast }) {
  const g = useMemo(() => confGrid(r.id, advisorId), [r, advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pick, setPick] = useState({});
  const slots = g?.days.find((d) => d.date === date)?.slots || [];
  const free = [...students].sort((a, b) => !!confBookingOf(r.id, a.id) - !!confBookingOf(r.id, b.id));
  const run = (fn, msg) => { const snap = snapshot(); try { fn(); toast(msg, snap); } catch (e) { toast(e.message); } };
  const n = { booked: 0, free: 0, blocked: 0 }; for (const x of slots) n[x.state]++;
  return (
    <>
      <p className="cb-legend" aria-live="polite"><span className="cb-k booked">{n.booked} booked</span><span className="cb-k free">{n.free} free</span><span className="cb-k blocked">{n.blocked} blocked</span><small className="fineprint">Bangkok time</small></p>
      <ul className="cb-grid" aria-label={`Times on ${confDay('en', date)}`}>
        {slots.map((x) => {
          const s = x.booking && getStudent(x.booking.studentId);
          const id = `cb-pick-${r.id}-${date}-${x.time}`.replace(/[^\w-]/g, '');
          const passed = Date.parse(`${date}T${x.end}:00+07:00`) < Date.now();
          return (
            <li key={x.time} className={`cb-slot ${x.state}`}>
              <span className="cb-time">{x.time}<small>–{x.end}</small></span>
              {x.state === 'booked' && <><span className="cb-who"><b>{s?.name || 'Booked'}</b><small>{x.booking.by === 'family' ? 'Booked by the family' : x.booking.by === advisorId ? 'Booked by you' : `Booked by ${getTeacher(x.booking.by)?.name || 'staff'}`}</small></span>
                {!passed && <button className="linkish" onClick={() => run(() => cancelConference(x.booking.id, advisorId), `Cancelled ${first(s)}’s conference. The family is told.`)}>Cancel<span className="sr-only"> {s?.name}’s booking at {x.time}</span></button>}</>}
              {x.state === 'blocked' && <><span className="cb-who"><b>Blocked</b><small>Families cannot book it</small></span>
                <button className="linkish" onClick={() => run(() => blockConferenceSlot(r.id, advisorId, date, x.time, false, advisorId), `${x.time} is free again`)}>Unblock<span className="sr-only"> {x.time}</span></button></>}
              {x.state === 'free' && <><span className="cb-who"><b>Free</b></span>
                {!passed && !r.closedOn && <span className="cb-book">
                  <label className="sr-only" htmlFor={id}>Book {x.time} for</label>
                  <select id={id} value={pick[x.time] || ''} onChange={(e) => setPick({ ...pick, [x.time]: e.target.value })}>
                    <option value="">Book for…</option>
                    {free.map((st) => <option key={st.id} value={st.id}>{st.name}{confBookingOf(r.id, st.id) ? ' (moves their time)' : ''}</option>)}
                  </select>
                  <button className="ghost small-btn" disabled={!pick[x.time]} onClick={() => run(() => { bookConference(r.id, pick[x.time], { date, time: x.time }, advisorId); setPick({ ...pick, [x.time]: '' }); }, `Booked ${first(getStudent(pick[x.time]))} at ${x.time}. The family is told.`)}>Book<span className="sr-only"> {x.time}</span></button>
                  <button className="linkish" onClick={() => run(() => blockConferenceSlot(r.id, advisorId, date, x.time, true, advisorId), `${x.time} is blocked`)}>Block<span className="sr-only"> {x.time}</span></button>
                </span>}</>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ── The printed day schedule: A4, one advisor's day, each student with the link to their conference sheet ──
function DaySchedule({ r, advisorId, date, persona, onClose }) {
  const g = confGrid(r.id, advisorId);
  const slots = g.days.find((d) => d.date === date)?.slots || [];
  const day = g.days.find((d) => d.date === date);
  const adv = getTeacher(advisorId)?.name || '';
  const name = `${r.title} – ${adv} – ${confDay('en', date)}`;
  usePrintTitle(name);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const booked = slots.filter((x) => x.state === 'booked').length;
  return createPortal(
    <div className="cbp-overlay" role="dialog" aria-modal="true" aria-label={name}>
      <div className="cbp-bar">
        <div><b>Day schedule</b><small>One A4 page: {plural(booked, 'conference')} on {confDay('en', date)}. Each student has the link to their conference sheet.</small></div>
        <div className="cf-actions"><button className="primary" onClick={() => printDocument(name)}>Print</button><button className="ghost" onClick={onClose}>Close</button></div>
      </div>
      <article className="cbp-sheet">
        <header className="cbp-head"><Logo className="cbp-logo" /><div><h1>{r.title}</h1><p>{adv} · {new Date(`${date}T12:00:00+07:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })} · {day.from}–{day.to} (Bangkok time) · {placeOf(r)}</p>{r.online && <p className="cbp-link">{r.link}</p>}</div></header>
        <table className="cbp-table">
          <thead><tr><th scope="col">Time</th><th scope="col">Student</th><th scope="col">Booked by</th><th scope="col">Conference sheet</th></tr></thead>
          <tbody>{slots.map((x) => { const s = x.booking && getStudent(x.booking.studentId); const url = s ? conferenceSheetLink(persona.id, s.id) : ''; return (
            <tr key={x.time} className={x.state}>
              <td className="cbp-t">{x.time}–{x.end}</td>
              <td>{s ? <><b>{s.name}</b><small>Year {s.grade + 1}{s.homeroom ? ` · ${s.homeroom}` : ''}</small></> : x.state === 'blocked' ? 'Blocked' : 'Free'}</td>
              <td>{s ? (x.booking.by === 'family' ? 'Family' : shortName(getTeacher(x.booking.by)?.name || '')) : ''}</td>
              <td className="cbp-url">{s && <a href={url}>{url.replace(/^https?:\/\//, '')}</a>}</td>
            </tr>); })}</tbody>
        </table>
        <footer className="cbp-foot">Printed {printDate()} · confidential to the student, family and school</footer>
      </article>
    </div>,
    document.body,
  );
}

// ── School overview: a coordinator opens booking for a whole Year (each student meets their own advisor) ──
export function YearBooking({ persona, version, toast }) {
  const rounds = useMemo(() => getConferenceRounds().filter((r) => r.year && (roundLive(r) || r.days.at(-1).date >= addDays(TODAY, -30))), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [opening, setOpening] = useState(false);
  const [year, setYear] = useState(7);
  const tid = persona?.teacherId || null;
  const open = (f) => {
    const snap = snapshot();
    try { const r = openConferenceRound({ ...f, year }, tid); setOpening(false); toast?.(`Conference booking is open for ${plural(r.studentIds.length, 'family', 'families')} in Year ${year}, with ${plural(r.advisorIds.length, 'advisor')}`, snap); } catch (e) { toast?.(e.message); }
  };
  return (
    <section className="card-sec cb-adv cb-year" aria-labelledby="cb-year-h">
      <div className="nd-head"><div><h2 id="cb-year-h">Conference booking</h2>
        <small className="fineprint">Open booking for a whole Year: each family books with their child’s advisor, at the same days and hours. Students already in an open round are left out.</small></div>
        {!opening && <button className="ghost" onClick={() => setOpening(true)}>Open for a Year</button>}</div>
      {opening && <RoundForm idp="cb-year" label="Open it" onSave={open} onCancel={() => setOpening(false)}>
        <label>Year<select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[7, 8, 9, 10, 11, 12, 13].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
      </RoundForm>}
      {rounds.length > 0 && <ul className="tr-wins">{rounds.map((r) => { const p = confProgress(r.id); return (
        <li key={r.id}><span><b>{r.title}</b><small>Year {r.year} · {plural(r.advisorIds.length, 'advisor')} · {confDay('en', r.days[0].date)}{r.days.length > 1 ? ` to ${confDay('en', r.days.at(-1).date)}` : ''}{r.closedOn ? ` · closed ${fmtDate(r.closedOn)}` : ''}</small></span>
          <span className="tr-count">{p.booked} of {p.total} booked</span>
          {!r.closedOn && <button className="ghost" onClick={() => { const snap = snapshot(); closeConferenceRound(r.id, tid); toast?.(`Booking for ${r.title} is closed`, snap); }}>Close</button>}
        </li>); })}</ul>}
    </section>
  );
}

// ── The family's card: one column per child, side by side, so brothers' and sisters' times never clash ──
export function FamilyBooking({ persona, lang, version, toast }) {
  const list = useMemo(() => familyConfRounds(persona.children), [persona.children, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const w = confWords(lang);
  if (!list.length) return null;
  return list.map(({ round: r, children }) => (
    <section key={r.id} className="card-sec cb-fam" aria-labelledby={`cb-fam-${r.id}`}>
      <h2 id={`cb-fam-${r.id}`}>{w.head}: <span lang="en">{r.title}</span></h2>
      <p>{w.intro}</p>
      <p className="cb-where-line"><b>{r.online ? w.online : <span lang="en">{r.location}</span>}</b>{r.online && <> · <a href={r.link} target="_blank" rel="noreferrer">{w.join}</a></>} · {w.mins(r.slot)} · <small>{w.tz}</small></p>
      <div className="cb-kids">{children.map((c) => <ChildPicker key={c.student.id} r={r} c={c} siblings={persona.children.filter((x) => x !== c.student.id)} lang={lang} toast={toast} version={version} />)}</div>
    </section>
  ));
}

function ChildPicker({ r, c, siblings, lang, toast, version }) {
  const w = confWords(lang);
  const [changing, setChanging] = useState(false);
  const [sure, setSure] = useState(false);
  const g = useMemo(() => confGrid(r.id, c.advisorId), [r, c.advisorId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = first(c.student), b = c.booking;
  const adv = shortName(c.advisor?.name || '');
  const locked = b && confTooSoon(b.date, b.time);
  const run = (fn, msg) => { try { fn(); toast(msg); setChanging(false); setSure(false); } catch (e) { toast(errText(lang, e.message)); } };
  const days = g.days.filter((d) => d.date >= TODAY);
  return (
    <div className="cb-kid">
      <h3>{c.student.name} <small>{w.with(adv)}</small></h3>
      {b && !changing ? (
        <div className="cb-mine">
          <span className="status s-ok"><i>✓</i>{w.booked}</span>
          <b className="cb-when">{confSlotText(lang, b.date, b.time)}</b>
          {b.by !== 'family' && <small>{w.by(adv)}</small>}
          {locked ? <p className="fineprint">{w.locked}</p> : sure ? (
            <div className="cb-btns"><span>{w.sure}</span><button className="primary" onClick={() => run(() => cancelConference(b.id, 'family'), w.gone(f))}>{w.yes}</button><button className="ghost" onClick={() => setSure(false)}>{w.keep}</button></div>
          ) : (
            <div className="cb-btns"><button className="ghost" onClick={() => setChanging(true)}>{w.change}</button><button className="ghost" onClick={() => setSure(true)}>{w.cancel}</button></div>
          )}
        </div>
      ) : (
        <>
          <p className="cb-pick-h">{w.pick(f)}</p>
          {days.map((d) => (
            <div key={d.date} className="cb-day">
              <h4>{confDay(lang, d.date)}</h4>
              <ul className="cb-times" aria-label={w.times(f, confDay(lang, d.date))}>
                {d.slots.map((x) => {
                  const own = x.booking?.studentId === c.student.id;
                  const clash = !own && x.state === 'free' && confClash(c.student.id, d.date, x.time, r.slot, siblings);
                  const soon = confTooSoon(d.date, x.time);
                  const why = own ? w.booked : x.state !== 'free' ? w.taken : clash ? w.clash(first(getStudent(clash.studentId))) : soon ? w.soon : null;
                  return <li key={x.time}>{why
                    ? <span className={`cb-t off${own ? ' own' : ''}`}>{x.time}<small>{why}</small></span>
                    : <button className="cb-t" aria-label={`${w.book(x.time)} · ${confDay(lang, d.date)} · ${f}`} onClick={() => run(() => bookConference(r.id, c.student.id, { date: d.date, time: x.time }, 'family'), w.saved(f, confSlotText(lang, d.date, x.time)))}>{x.time}</button>}</li>;
                })}
              </ul>
            </div>
          ))}
          {!days.some((d) => d.slots.some((x) => x.state === 'free')) && <p className="fineprint">{w.none}</p>}
          {b && <button className="linkish" onClick={() => setChanging(false)}>{w.keep}: {confSlotText(lang, b.date, b.time)}</button>}
        </>
      )}
    </div>
  );
}

// ── The student: when their conference is ──
export function StudentConference({ studentId, version, simple }) {
  const list = useMemo(() => studentConferences(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  const { booking: b, round: r, advisor } = list[0];
  return (
    <section className={`cb-student${simple ? ' simple' : ''}`} aria-labelledby="cb-st-h">
      <h2 id="cb-st-h">Your conference</h2>
      <p><b>{whenEn(b.date, b.time)}</b> with {shortName(advisor?.name || 'your advisor')} and your family · {r.online ? 'online' : r.location}</p>
      {list.length > 1 && <small>Then {list.slice(1).map((x) => whenEn(x.booking.date, x.booking.time)).join(', ')}</small>}
    </section>
  );
}
