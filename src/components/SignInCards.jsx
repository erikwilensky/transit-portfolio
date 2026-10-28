import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Qr from './Qr.jsx';
import { signinCards } from '../auth.js';
import { usePrintTitle } from '../print.js';
import '../auth.css';
import './signin-cards.css';

const PER_PAGE = 10;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const shortLink = (u) => u.replace(/^https?:\/\//, '');

// The A4 sheet: 10 cards a page (2 × 5), cut along the dashed lines. On screen a full-page preview.
export function CardSheet({ school, cards, title, onClose }) {
  usePrintTitle(title);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const pages = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(cards.slice(i, i + PER_PAGE));
  return createPortal(
    <div className="sc-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sc-bar">
        <div><b>{plural(cards.length, 'sign-in card')}</b><small>{plural(pages.length, 'A4 page')}. Each link works once, so hand each card to its own person. The links are shown only now.</small></div>
        <div className="auth-row"><button className="auth-btn" onClick={() => print()}>Print</button><button className="ghost" onClick={onClose}>Close</button></div>
      </div>
      {pages.map((page, p) => (
        <section className="sc-page" key={p}>
          {page.map((c) => (
            <article className="sc-card" key={c.setupUrl}>
              <Qr text={c.setupUrl} size={128} className="sc-qr" />
              <div className="sc-text">
                <span className="sc-school">{school}</span>
                <b className="sc-name">{c.name}</b>
                <span className="sc-room">{c.homeroom ? (c.year ? `Homeroom ${c.homeroom} · Year ${c.year}` : c.homeroom) : c.year ? `Year ${c.year}` : 'Staff'}</span>
                <span className="sc-do">Scan, choose a password, done.</span>
                <span className="sc-link">{shortLink(c.setupUrl)}</span>
                <small className="sc-exp">Works once. Use it by {day(c.expiresAt)}.</small>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>,
    document.body,
  );
}

// "Print sign-in cards" on the advisor's advisory page (pilot only).
export function AdvisorCards({ toast }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null);
  useEffect(() => { if (open && !list) signinCards.advisees().then(setList, (x) => setErr(x.message)); }, [open, list]);
  const waiting = list?.filter((s) => s.hasAccount && !s.hasPassword) || [];
  const withAccount = list?.filter((s) => s.hasAccount) || [];
  const go = async () => {
    setBusy(true); setErr(null);
    try { const j = await signinCards.forAdvisees({ includeSignedUp: all }); if (!j.cards.length) setErr('Nobody needs a card.'); else setSheet(j); setList(null); }
    catch (x) { setErr(x.message); } finally { setBusy(false); setSure(false); }
  };
  if (!open) return <button className="ghost sc-open" onClick={() => setOpen(true)}>Print sign-in cards</button>;
  return (
    <section className="acc-form sc-panel" aria-labelledby="sc-h">
      <h2 id="sc-h">Print sign-in cards</h2>
      {!list && !err && <p className="auth-lede">Loading your advisees…</p>}
      {list && <>
        <p className="auth-lede">{waiting.length ? `${plural(waiting.length, 'advisee')} of ${withAccount.length} ${waiting.length === 1 ? 'has' : 'have'} not set a password yet. Each gets a card with a QR code: scan it, choose a password, done.` : `All ${plural(withAccount.length, 'advisee')} with an account have set a password.`} A new card replaces any earlier link for that student. Cards work once and for 7 days.</p>
        {list.length > withAccount.length && <p className="fineprint">{plural(list.length - withAccount.length, 'advisee')} {list.length - withAccount.length === 1 ? 'has' : 'have'} no sign-in account. Ask the pilot admin.</p>}
        <label className="acc-check"><input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setSure(false); }} /> Include everyone, also those who already have a password</label>
        {all && <p className="auth-err">This makes a new card for all {plural(withAccount.length, 'advisee')}. Anyone who already has a password loses it and is signed out on every device, until they use their new card.</p>}
      </>}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row">
        {list && (all && !sure
          ? <button className="auth-btn" onClick={() => setSure(true)} disabled={!withAccount.length}>Make cards for everyone…</button>
          : <button className="auth-btn" onClick={go} disabled={busy || !(all ? withAccount.length : waiting.length)}>{busy ? 'Making cards…' : all ? `Yes, end their passwords and make ${plural(withAccount.length, 'card')}` : `Make ${plural(waiting.length, 'card')}`}</button>)}
        <button className="ghost" onClick={() => { setOpen(false); setAll(false); setSure(false); setErr(null); }} disabled={busy}>Cancel</button>
      </div>
      {sheet && <CardSheet {...sheet} title="Sign-in cards" onClose={() => { setSheet(null); toast?.('Unused cards still work until they expire'); }} />}
    </section>
  );
}

// Accounts (admin): cards per homeroom, and for staff.
export function AdminCards({ toast, onClose, onMade }) {
  const [g, setG] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState(false);
  const [all, setAll] = useState(false);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sheet, setSheet] = useState(null);
  useEffect(() => { signinCards.groups().then(setG, (x) => setErr(x.message)); }, []);
  const chosen = g ? g.homerooms.filter((r) => rooms.includes(r.name)) : [];
  const n = chosen.reduce((s, r) => s + (all ? r.students : r.waiting), 0) + (staff ? (all ? g.staff.total : g.staff.waiting) : 0);
  const toggle = (name) => setRooms(rooms.includes(name) ? rooms.filter((r) => r !== name) : [...rooms, name]);
  const go = async () => {
    setBusy(true); setErr(null);
    try { const j = await signinCards.forAdmin({ homerooms: rooms, staff, includeSignedUp: all }); if (!j.cards.length) setErr('Nobody needs a card.'); else { setSheet(j); onMade?.(); } signinCards.groups().then(setG, () => {}); }
    catch (x) { setErr(x.message); } finally { setBusy(false); setSure(false); }
  };
  return (
    <section className="acc-form sc-panel" aria-labelledby="sca-h">
      <h2 id="sca-h">Print sign-in cards</h2>
      <p className="auth-lede">One card per person with a QR code: scan it, choose a password, done. A new card replaces any earlier link for that person. Cards work once and for 7 days. Paused accounts get none.</p>
      {g && <>
        <fieldset className="sc-rooms"><legend>Homerooms <button type="button" className="linkish" onClick={() => setRooms(rooms.length === g.homerooms.length ? [] : g.homerooms.map((r) => r.name))}>{rooms.length === g.homerooms.length ? 'None' : 'All'}</button></legend>
          {g.homerooms.map((r) => <label key={r.name}><input type="checkbox" checked={rooms.includes(r.name)} onChange={() => toggle(r.name)} /> {r.name} <small>{r.waiting} of {r.students} waiting</small></label>)}
          {!g.homerooms.length && <p className="fineprint">No student accounts yet. Import the class lists first.</p>}
        </fieldset>
        <label className="acc-check"><input type="checkbox" checked={staff} onChange={(e) => setStaff(e.target.checked)} /> Staff ({g.staff.waiting} of {g.staff.total} waiting)</label>
        <label className="acc-check"><input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setSure(false); }} /> Include everyone, also those who already have a password</label>
        {all && <p className="auth-err">Everyone chosen gets a new card. Anyone who already has a password loses it and is signed out on every device, until they use their new card.</p>}
      </>}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row">
        {g && (all && !sure
          ? <button className="auth-btn" onClick={() => setSure(true)} disabled={!n}>Make cards for everyone chosen…</button>
          : <button className="auth-btn" onClick={go} disabled={busy || !n}>{busy ? 'Making cards…' : all ? `Yes, end their passwords and make ${plural(n, 'card')}` : `Make ${plural(n, 'card')}`}</button>)}
        <button className="ghost" onClick={onClose} disabled={busy}>Close</button>
      </div>
      {sheet && <CardSheet {...sheet} title="Sign-in cards" onClose={() => { setSheet(null); toast?.('Unused cards still work until they expire'); }} />}
    </section>
  );
}
