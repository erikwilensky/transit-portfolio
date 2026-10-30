import { useEffect, useRef, useState } from 'react';
import { leaverArchive } from '../auth.js';
import './leaver-archive.css';

// Accounts › End of year: leaver archive (server/routes/52-archive.mjs). Leaving students (Year 13, and anyone the last
// class lists or SIS sync no longer has), a ZIP each to give them, and erasure: scheduled after a download, never
// automatic, confirmed by an admin on the day with the student's name typed.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d) => (d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '');
const norm = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function LeaverArchive({ toast, onErased }) {
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [erasing, setErasing] = useState(null); // student id with the confirm open
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timers = useRef([]);
  const load = () => leaverArchive.list().then(setV, (x) => x.status !== 403 && setErr(x.message));
  useEffect(() => { load(); return () => timers.current.forEach(clearTimeout); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return err ? <p className="auth-err">{err}</p> : null;

  const go = async (p, then) => { setBusy(true); setErr(null); try { const j = await p; setV(j); then?.(j); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  const all = v.students.length > 0 && picked.size === v.students.length;
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // The browser saves the ZIP itself (streamed, never held in this page); the list then shows who was downloaded.
  const download = (ids) => {
    const a = document.createElement('a');
    a.href = ids.length > 1 && ids.length === v.students.length ? leaverArchive.allUrl : leaverArchive.url(ids);
    a.download = ''; document.body.append(a); a.click(); a.remove();
    toast(ids.length === 1 ? 'Downloading the archive' : `Downloading ${ids.length} archives in one ZIP`);
    timers.current.push(...[1500, 5000, 15000, 40000].map((ms) => setTimeout(load, ms)));
  };
  const s = erasing && v.due.find((x) => x.id === erasing);
  const erase = () => go(leaverArchive.erase(s.id, typed), (j) => { toast(`Removed ${s.name}: ${j.erased.files} files, ${plural(j.erased.accounts, 'account')}.`); setErasing(null); setTyped(''); setPicked((p) => { const n = new Set(p); n.delete(s.id); return n; }); onErased?.(); });

  return (
    <section className="acc-form la" aria-labelledby="la-h">
      <h2 id="la-h">End of year: leaver archive</h2>
      <p className="auth-lede">Each leaving student’s whole journey as a ZIP to give them: a PDF of every moment and reflection by line and date, their photos, documents and voice notes, their leaver portfolio if they made one, a copy of their data and a README in English and Thai. Students can also download their own from Privacy at any time.</p>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {v.due.length > 0 && (
        <div className="la-due" role="group" aria-labelledby="la-due-h">
          <h3 id="la-due-h">{plural(v.due.length, 'erasure')} due</h3>
          <p>Nothing is erased by itself. Check each student still wants it, then confirm.</p>
          <ul>{v.due.map((x) => (
            <li key={x.id}>
              <div><b>{x.name}</b><small>Year {x.year}{x.homeroom ? `, ${x.homeroom}` : ''} · due {day(x.erasure.due)} · archive downloaded {day(x.downloaded?.at.slice(0, 10))}</small></div>
              {erasing !== x.id && <div className="acc-actions"><button className="ghost danger" onClick={() => { setErasing(x.id); setTyped(''); }}>Erase…</button><button className="ghost" disabled={busy} onClick={() => go(leaverArchive.cancel(x.id), () => toast(`Erasure of ${x.name} withdrawn`))}aria-label={`Withdraw the erasure of ${x.name}`}>Withdraw</button></div>}
              {erasing === x.id && (
                <div className="acc-erase">
                  <p>This removes {x.name} and everything about them, as in “A student’s data”: their moments, reflections, files no other record uses, account and family link. It cannot be undone here.</p>
                  <label className="auth-field"><span>Type the student’s name to confirm</span><input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={x.name} autoComplete="off" /></label>
                  <div className="auth-row">
                    <button className="ghost danger" disabled={busy || norm(typed) !== norm(x.name)} onClick={erase}>{busy ? 'Removing…' : `Erase ${x.name} for good`}</button>
                    <button className="ghost" onClick={() => setErasing(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}</ul>
        </div>
      )}
      {!v.students.length ? <p className="fineprint">No one is leaving: there are no Year 13 students, and the last class lists left no one out.</p> : <>
        <div className="la-bar">
          <p className="la-sum">{plural(v.students.length, 'leaving student')} · {v.students.filter((x) => x.downloaded).length} downloaded · {plural(v.students.filter((x) => x.erasure).length, 'erasure')} scheduled</p>
          <button className="ghost" aria-expanded={open} aria-controls="la-list" onClick={() => setOpen(!open)}>{open ? 'Hide the list' : 'Show the list'}</button>
        </div>
      </>}
      {v.students.length > 0 && open && <div id="la-list" className="la-list">
        <div className="la-bar">
          <label className="la-all"><input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(v.students.map((x) => x.id)))} /> Choose all {v.students.length}</label>
          <button className="auth-btn" disabled={!picked.size} onClick={() => download(v.students.filter((x) => picked.has(x.id)).map((x) => x.id))}>Download archives{picked.size ? ` (${picked.size})` : ''}</button>
        </div>
        <div className="la-scroll">
          <table className="acc-table la-table">
            <caption className="sr-only">Leaving students</caption>
            <thead><tr><th><span className="sr-only">Choose</span></th><th>Student</th><th>Why</th><th>Archive</th><th>Erasure</th></tr></thead>
            <tbody>{v.students.map((x) => (
              <tr key={x.id}>
                <td><input type="checkbox" checked={picked.has(x.id)} onChange={() => toggle(x.id)} aria-label={`Choose ${x.name}`} /></td>
                <td><b>{x.name}</b><small>Year {x.year}{x.homeroom ? `, ${x.homeroom}` : ''} · {plural(x.moments, 'moment')}{x.leaverPortfolio ? ' · leaver portfolio' : ''}{x.hasAccount ? '' : ' · no account'}</small></td>
                <td>{x.why.join('; ')}</td>
                <td>{x.downloaded ? <span className="acc-tag ok">Downloaded {day(x.downloaded.at.slice(0, 10))}</span> : <small>Not yet</small>}</td>
                <td>{x.erasure ? <div className="la-er"><span className="acc-tag wait">Due {day(x.erasure.due)}</span><button className="linkish" disabled={busy} onClick={() => go(leaverArchive.cancel(x.id), () => toast(`Erasure of ${x.name} withdrawn`))} aria-label={`Withdraw the erasure of ${x.name}`}>Withdraw</button></div>
                  : x.downloaded ? <button className="ghost" disabled={busy} onClick={() => go(leaverArchive.schedule(x.id), (j) => toast(`${x.name}: erasure due ${day(j.students.find((y) => y.id === x.id)?.erasure?.due)}. An admin confirms it on the day.`))}>Schedule erasure in {v.eraseDays} days<span className="sr-only"> for {x.name}</span></button>
                    : <small>After a download</small>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="fineprint">Many archives come as one ZIP holding a ZIP per student. Every download, schedule and erasure goes in the activity log. A scheduled erasure only lists the student under “erasures due” on the day; an admin still confirms each one.</p>
      </div>}
    </section>
  );
}
