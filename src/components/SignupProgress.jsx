import { Fragment, useEffect, useState } from 'react';
import { getAuth, progress, signinCards } from '../auth.js';
import { CardSheet } from './SignInCards.jsx';
import '../auth.css';
import './signup-progress.css';

// Sign-up progress (server/routes/62-progress.mjs): by homeroom on Pilot usage, and a strip on the advisory page.
const ROLE = { advisor: 'Advisors', teacher: 'Subject teachers', counsellor: 'Counsellors', coordinator: 'Coordinators', leadership: 'Leadership' };
const COLS = [['signedUp', 'Signed up'], ['active', 'Active, last 7 days'], ['moments', 'Added a moment'], ['families', 'Families joined']];
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);

function Count({ n, of }) {
  return <td className="sp-n"><span>{n}</span><i className="sp-bar" aria-hidden="true"><i style={{ width: `${pct(n, of)}%` }} /></i></td>;
}
export function Status({ s }) {
  return !s.signedUp ? <span className="acc-tag wait">{s.hasAccount ? 'Not signed up' : 'No account'}</span> : s.active ? <span className="acc-tag ok">Active this week</span> : <span className="acc-tag sp-up">Signed up</span>;
}

// Pilot usage (leadership and the admin): a row per homeroom, Year then homeroom, with totals and staff.
export function SchoolProgress({ toast }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const [sheet, setSheet] = useState(null);
  const isAdmin = !!getAuth().user?.admin;
  const load = () => progress.school().then(setData, (x) => setErr(x.message));
  useEffect(() => { load(); }, []);
  useEffect(() => { setList(null); if (open) progress.school(open).then((j) => setList(j.students), (x) => setErr(x.message)); }, [open]);
  const cards = async (room) => {
    setBusy(room); setErr(null);
    try { const j = await signinCards.forAdmin({ homerooms: [room] }); if (!j.cards.length) setErr('Nobody in that homeroom needs a card.'); else setSheet(j); }
    catch (x) { setErr(x.message); } finally { setBusy(null); }
  };
  if (err && !data) return <section className="card-sec"><h2>Sign-up progress</h2><p className="auth-err">{err}</p></section>;
  if (!data) return <section className="card-sec"><h2>Sign-up progress</h2><p className="auth-lede">Loading…</p></section>;
  const t = data.totals, st = data.staff;
  return (
    <section className="card-sec us-scroll sp" aria-labelledby="sp-h">
      <h2 id="sp-h">Sign-up progress</h2>
      <p className="auth-lede">{t.signedUp} of {t.students} students have set a password, {t.active} were here in the last 7 days, and {t.families} have a family account. Staff: {st.total.signedUp} of {st.total.total} signed up. Pick a homeroom to see its students.</p>
      {err && <p className="auth-err" role="alert">{err}</p>}
      <table className="us-table sp-table">
        <thead><tr><th>Homeroom</th><th>Students</th>{COLS.map(([k, l]) => <th key={k}>{l}</th>)}{isAdmin && <th><span className="sr-only">Sign-in cards</span></th>}</tr></thead>
        <tbody>
          {data.homerooms.map((r) => (
            <Fragment key={r.name}>
              <tr className={open === r.name ? 'on' : ''}>
                <td><button className="linkish sp-room" aria-expanded={open === r.name} onClick={() => setOpen(open === r.name ? null : r.name)}>{r.name}</button><small>Year {r.year}</small></td>
                <td>{r.students}</td>
                {COLS.map(([k]) => <Count key={k} n={r[k]} of={r.students} />)}
                {isAdmin && <td>{r.waiting > 0 && <button className="ghost sp-cards" disabled={!!busy} onClick={() => cards(r.name)} title="A new card replaces any earlier link for that student">{busy === r.name ? 'Making…' : `Print ${r.waiting} sign-in card${r.waiting === 1 ? '' : 's'}`}</button>}</td>}
              </tr>
              {open === r.name && (
                <tr className="sp-list"><td colSpan={COLS.length + 2 + (isAdmin ? 1 : 0)}>
                  {!list ? <p className="fineprint">Loading…</p> : (
                    <ul>{list.map((s) => <li key={s.id}><b>{s.name}</b><Status s={s} /><small>{s.lastSignIn ? `Last here ${fmtDay(s.lastSignIn)}` : 'Never signed in'}{s.moment ? ' · has a moment' : ''}{s.families ? ` · family joined` : ''}</small></li>)}</ul>
                  )}
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
        <tbody className="sp-total"><tr><td><b>All homerooms</b></td><td>{t.students}</td>{COLS.map(([k]) => <Count key={k} n={t[k]} of={t.students} />)}{isAdmin && <td />}</tr></tbody>
        <tbody className="sp-staff">
          <tr><th>Staff</th><th>People</th><th>Signed up</th><th>Active, last 7 days</th><th colSpan={2 + (isAdmin ? 1 : 0)} /></tr>
          {st.rows.map((r) => <tr key={r.kind}><td>{ROLE[r.kind] || r.kind}</td><td>{r.total}</td><Count n={r.signedUp} of={r.total} /><Count n={r.active} of={r.total} /><td colSpan={2 + (isAdmin ? 1 : 0)} /></tr>)}
          <tr className="sp-sum"><td><b>All staff</b></td><td>{st.total.total}</td><Count n={st.total.signedUp} of={st.total.total} /><Count n={st.total.active} of={st.total.total} /><td colSpan={2 + (isAdmin ? 1 : 0)} /></tr>
        </tbody>
      </table>
      <p className="fineprint">Signed up: set a password. Active: signed up and here in the last 7 days. Families joined: students with at least one family account. Leavers with a paused account are not counted.{isAdmin ? ' A printed card replaces any earlier link for that student.' : ''}</p>
      {sheet && <CardSheet {...sheet} title="Sign-in cards" onClose={() => { setSheet(null); load(); toast?.('Unused cards still work until they expire'); }} />}
    </section>
  );
}

// The advisory page (pilot): a compact strip, and who is missing.
export function AdvisorProgress({ version }) {
  const [p, setP] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => { progress.advisees().then(setP, () => setP(null)); }, [version]);
  if (!p) return null;
  const notUp = p.students.filter((s) => !s.signedUp), noFam = p.students.filter((s) => !s.families);
  return (
    <section className="sp-strip" aria-label="Sign-up progress">
      <p><span>Signed up <b>{p.signedUp}</b> of {p.total}</span><span>Families <b>{p.families}</b> of {p.total}</span><span>Active this week <b>{p.active}</b></span>
        {(notUp.length > 0 || noFam.length > 0) && <button className="linkish" aria-expanded={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Who’s missing'}</button>}</p>
      {show && <div className="sp-missing">
        {notUp.length > 0 && <div><h3>Not signed up ({notUp.length})</h3><ul>{notUp.map((s) => <li key={s.id}>{s.name}</li>)}</ul></div>}
        {noFam.length > 0 && <div><h3>No family account ({noFam.length})</h3><ul>{noFam.map((s) => <li key={s.id}>{s.name}</li>)}</ul></div>}
      </div>}
    </section>
  );
}
