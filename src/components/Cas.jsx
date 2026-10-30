import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAS_CODE_DAYS, CAS_MAX_HOURS, CAS_OUTCOMES, CAS_STRANDS, TODAY, addReflection, casAbout, casCoordinators, casExperiences, casHoursOf, casHoursText, casSum,
  casSupervisorName, casToConfirm, confirmCasHours, getStore, getTeachers, logCasExperience, logCasHours, returnCasHours, setCasCoordinator, shortName, snapshot,
  teachersOf, withdrawCasHours } from '../api.js';
import { appUrl, fmtDate } from '../format.js';
import { usePrintTitle } from '../print.js';
import { AttachButton } from './FileAttach.jsx';
import Qr from './Qr.jsx';
import './cas.css';

// CAS experiences and hours (api.logCasExperience, logCasHours, confirmCasHours, returnCasHours). Student: CasLog (#/me/cas),
// with a one-time code for an outside supervisor (CasCodeCard; the supervisor opens CasCodePage, #/c/<code>). Staff named as
// supervisor: CasConfirm (#/me/casconfirm). CAS coordinators: CasDecide in the cohort grid (screens/CasDashboard.jsx).
// Admins: CasCoordinators on Accounts.

const STATUS = { pending: 'Waiting', confirmed: 'Confirmed', returned: 'Sent back' };
const tryIt = (fn, setErr) => { try { const r = fn(); setErr(null); return r ?? true; } catch (e) { setErr(e.message); return false; } };
const supText = (x) => (x.supervisor ? casSupervisorName(x.supervisor) : 'No supervisor named: your CAS coordinator confirms');

export function StatusChip({ status }) { return <span className={`cas-st ${status}`}>{STATUS[status] || status}</span>; }

// ── Who supervised: a member of staff from the class lists, someone outside school, or nobody named ──
export function SupervisorField({ studentId, value, onChange }) {
  const mine = useMemo(() => teachersOf(studentId).map((m) => m.teacher), [studentId]);
  const rest = useMemo(() => getTeachers().filter((t) => !mine.includes(t)).sort((a, b) => a.name.localeCompare(b.name)), [mine]);
  const set = (p) => onChange({ ...value, ...p });
  const kinds = [['staff', 'A member of staff'], ['outside', 'Someone outside school'], ['none', 'Nobody to name']];
  return (
    <fieldset className="cas-sup">
      <legend>Who supervised?</legend>
      <div className="cas-radios">{kinds.map(([k, l]) => <label key={k}><input type="radio" name={`sup-${studentId}`} checked={value.kind === k} onChange={() => set({ kind: k })} /> {l}</label>)}</div>
      {value.kind === 'staff' && (
        <label>Member of staff
          <select value={value.teacherId || ''} onChange={(e) => set({ teacherId: e.target.value })}>
            <option value="">Choose a person</option>
            {mine.length > 0 && <optgroup label="Your teachers and advisor">{mine.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
            <optgroup label={mine.length ? 'All staff' : 'Staff'}>{rest.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
          </select>
        </label>
      )}
      {value.kind === 'outside' && <>
        <label>Their name<input value={value.name || ''} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Khun Somchai Dee" /></label>
        <label>Their email<input type="email" value={value.email || ''} maxLength={120} onChange={(e) => set({ email: e.target.value })} placeholder="name@example.org" /></label>
        <p className="fineprint">They get no email. When you meet them, show them your confirmation code (or print it). They confirm with this email address.</p>
      </>}
      {value.kind === 'none' && <p className="fineprint">Your CAS coordinator will check and confirm these hours.</p>}
    </fieldset>
  );
}
const supOk = (s) => (s.kind === 'staff' ? !!s.teacherId : s.kind === 'outside' ? s.name?.trim() && /\S+@\S+\.\S+/.test(s.email || '') : s.kind === 'none');

function HoursFields({ h, set }) {
  return (
    <div className="cas-grid">
      <label>Date<input type="date" value={h.date} max={TODAY} onChange={(e) => set({ date: e.target.value })} /></label>
      <label>Hours<input type="number" min="0.25" max={CAS_MAX_HOURS} step="0.25" value={h.hours} onChange={(e) => set({ hours: e.target.value })} /></label>
      <label className="span2">What you did <small>optional</small><input value={h.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Coached the Under-11s on Saturday" /></label>
    </div>
  );
}
const blankHours = () => ({ date: TODAY, hours: '', note: '', supervisor: { kind: 'staff' } });

// ── Student ──
export function CasLog({ studentId, version, toast, go, persona }) {
  const list = useMemo(() => casExperiences(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const hours = useMemo(() => casHoursOf(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState(null); // entry
  const strands = Object.keys(CAS_STRANDS).map((k) => [k, list.filter((e) => e.cas.strand === k).length]);
  const covered = CAS_OUTCOMES.map((_, i) => list.some((e) => (e.cas.outcomes || []).includes(i + 1)));
  return (
    <div className="page cas-log">
      <header className="page-head">
        <div>
          <div className="kicker">CAS · Creativity, Activity, Service</div>
          <h1>My CAS</h1>
          <p>Log each experience once, then add hours as you go. Name who supervised, so they can confirm your hours. Each experience is a station on your CAS line.</p>
        </div>
        <div className="meter">
          <div><b>{casSum(hours, 'confirmed')}</b><span>hours confirmed</span></div>
          <div><b>{casSum(hours, 'pending')}</b><span>hours waiting</span></div>
        </div>
      </header>
      <section className="cas-cover" aria-label="What you have covered">
        <div className="cas-strands">{strands.map(([k, n]) => <span key={k} className={`cas-strand${n ? ' on' : ''}`}><b>{k}</b>{`${CAS_STRANDS[k]}: ${n}`}</span>)}</div>
        <ul className="cas-los">{CAS_OUTCOMES.map((o, i) => <li key={o} className={covered[i] ? 'on' : ''}><b>LO{i + 1}</b> {o}<span className="sr-only">{covered[i] ? ': covered' : ': not yet'}</span></li>)}</ul>
      </section>
      {!adding && <button className="primary" onClick={() => setAdding(true)}>Log a new experience</button>}
      {adding && <NewExperience studentId={studentId} toast={toast} onDone={() => setAdding(false)} />}
      {!list.length && !adding && <p className="cas-empty">Nothing yet. Log your first experience: a club, a sport, a project, or helping in the community.</p>}
      <div className="cas-exps">
        {list.map((e) => <Experience key={e.id} e={e} hours={hours.filter((x) => x.eventId === e.id)} studentId={studentId} toast={toast} onCode={setCode} onMap={() => go(persona.id, 'map', e.id)} />)}
      </div>
      {code && <CasCodeCard entry={code} onClose={() => setCode(null)} />}
    </div>
  );
}

function NewExperience({ studentId, toast, onDone }) {
  const [f, setF] = useState({ title: '', strand: '', from: TODAY, to: '', outcomes: [], summary: '', reflection: '', evidence: [], link: '' });
  const [h, setH] = useState(blankHours);
  const [withHours, setWithHours] = useState(true);
  const [err, setErr] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const toggle = (n) => set({ outcomes: f.outcomes.includes(n) ? f.outcomes.filter((x) => x !== n) : [...f.outcomes, n] });
  const ready = f.title.trim() && f.strand && f.from && (!withHours || (Number(h.hours) > 0 && supOk(h.supervisor)));
  const save = (ev) => {
    ev.preventDefault();
    const evidence = [...f.evidence, ...(/^https?:\/\/\S+$/.test(f.link.trim()) ? [{ kind: 'link', url: f.link.trim(), caption: 'Link' }] : [])];
    const snap = snapshot();
    const r = tryIt(() => logCasExperience(studentId, { ...f, evidence, to: f.to || null, hours: withHours ? { ...h, hours: Number(h.hours) } : null }), setErr);
    if (r) { toast(`Added “${f.title.trim()}” to your CAS line${withHours ? `, with ${casHoursText(Number(h.hours))} waiting to be confirmed` : ''}`, snap); onDone(); }
  };
  return (
    <form className="cas-form-card" onSubmit={save} aria-labelledby="cas-new-h">
      <h2 id="cas-new-h">A new CAS experience</h2>
      <label>Name<input autoFocus value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Coaching junior football" /></label>
      <fieldset className="cas-radios-set"><legend>Strand</legend>
        <div className="cas-radios">{Object.entries(CAS_STRANDS).map(([k, l]) => <label key={k}><input type="radio" name="cas-strand" checked={f.strand === k} onChange={() => set({ strand: k })} /> {`${l} (${k})`}</label>)}</div>
      </fieldset>
      <div className="cas-grid">
        <label>Started<input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label>Ends <small>optional</small><input type="date" value={f.to} min={f.from} onChange={(e) => set({ to: e.target.value })} /></label>
      </div>
      <fieldset className="cas-outcomes"><legend>Learning outcomes it shows <small>pick any</small></legend>
        {CAS_OUTCOMES.map((o, i) => <label key={o}><input type="checkbox" checked={f.outcomes.includes(i + 1)} onChange={() => toggle(i + 1)} /> <b>{`LO${i + 1}`}</b> {o}</label>)}
      </fieldset>
      <label>What is it? <small>optional</small><textarea rows={2} value={f.summary} maxLength={1000} onChange={(e) => set({ summary: e.target.value })} /></label>
      <label>Reflection <small>what did you learn or notice?</small><textarea rows={3} value={f.reflection} maxLength={4000} onChange={(e) => set({ reflection: e.target.value })} /></label>
      <div className="cas-evidence">
        <span className="cas-lab">Evidence <small>optional</small></span>
        <AttachButton label="Add a photo or file" onAdded={(x) => set({ evidence: [...f.evidence, x] })} />
        {f.evidence.map((x, i) => <span key={x.url} className="cas-file">{x.caption}<button type="button" className="linkish" onClick={() => set({ evidence: f.evidence.filter((_, j) => j !== i) })} aria-label={`Remove ${x.caption}`}>Remove</button></span>)}
        <label>A link <small>optional</small><input type="url" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></label>
      </div>
      <label className="cas-check"><input type="checkbox" checked={withHours} onChange={(e) => setWithHours(e.target.checked)} /> Log hours now</label>
      {withHours && <><HoursFields h={h} set={(p) => setH((x) => ({ ...x, ...p }))} /><SupervisorField studentId={studentId} value={h.supervisor} onChange={(supervisor) => setH((x) => ({ ...x, supervisor }))} /></>}
      <p className="fineprint">Your advisor, your CAS coordinator and the supervisor you name can see this. It is never private.</p>
      {err && <p className="up-error" role="alert">{err}</p>}
      <div className="cas-foot"><button type="button" className="ghost" onClick={onDone}>Cancel</button><button className="primary" type="submit" disabled={!ready}>Save experience</button></div>
    </form>
  );
}

function Experience({ e, hours, studentId, toast, onCode, onMap }) {
  const [more, setMore] = useState(false);
  const [reflect, setReflect] = useState(false);
  const [h, setH] = useState(blankHours);
  const [text, setText] = useState('');
  const [err, setErr] = useState(null);
  const refl = getStore().reflections.filter((r) => r.eventId === e.id).sort((a, b) => b.date.localeCompare(a.date));
  const addHours = (ev) => {
    ev.preventDefault();
    const snap = snapshot();
    if (tryIt(() => logCasHours(studentId, e.id, { ...h, hours: Number(h.hours) }), setErr)) { toast(`${casHoursText(Number(h.hours))} logged, waiting to be confirmed`, snap); setMore(false); setH(blankHours()); }
  };
  const addRefl = (ev) => {
    ev.preventDefault();
    if (tryIt(() => addReflection({ studentId, eventId: e.id, prompt: 'CAS reflection', text: text.trim(), visibility: e.visibility === 'private' ? 'advisor' : e.visibility }), setErr)) { toast('Reflection added'); setReflect(false); setText(''); }
  };
  return (
    <article className="cas-exp" aria-labelledby={`cx-${e.id}`}>
      <div className="cas-exp-head">
        <span className={`cas-badge s-${e.cas.strand}`} aria-hidden="true">{e.cas.strand}</span>
        <div><h2 id={`cx-${e.id}`}>{e.title}</h2>
          <small>{`${CAS_STRANDS[e.cas.strand]} · ${fmtDate(e.cas.from || e.date)}${e.cas.to ? ` to ${fmtDate(e.cas.to)}` : ''} · ${casSum(hours, 'confirmed')} hours confirmed${casSum(hours, 'pending') ? `, ${casSum(hours, 'pending')} waiting` : ''}`}</small></div>
        <button className="ghost small-btn" onClick={onMap}>On my map</button>
      </div>
      {(e.cas.outcomes || []).length > 0 && <p className="cas-exp-los">{e.cas.outcomes.map((n) => `LO${n} ${CAS_OUTCOMES[n - 1]}`).join(' · ')}</p>}
      {hours.length > 0 && (
        <ul className="cas-hours">{hours.map((x) => (
          <li key={x.id}>
            <span><b>{casHoursText(x.hours)}</b> · {fmtDate(x.date)}{x.note ? ` · ${x.note}` : ''}<small>{supText(x)}{x.decided?.comment ? ` · “${x.decided.comment}”` : ''}</small></span>
            <span className="cas-acts"><StatusChip status={x.status} />
              {x.status === 'pending' && x.supervisor?.kind === 'outside' && <button className="ghost small-btn" onClick={() => onCode(x)}>Show code</button>}
              {x.status !== 'confirmed' && <button className="linkish" onClick={() => { const snap = snapshot(); if (tryIt(() => withdrawCasHours(x.id, studentId), setErr)) toast('Hours taken back', snap); }}>Take back</button>}
            </span>
          </li>
        ))}</ul>
      )}
      {refl.length > 0 && <p className="cas-last">Last reflection {fmtDate(refl[0].date)}: “{refl[0].text.length > 140 ? `${refl[0].text.slice(0, 140)}…` : refl[0].text}”</p>}
      <div className="cas-row-btns">
        {!more && <button className="ghost small-btn" onClick={() => { setMore(true); setReflect(false); }}>Log more hours</button>}
        {!reflect && <button className="ghost small-btn" onClick={() => { setReflect(true); setMore(false); }}>Add a reflection</button>}
      </div>
      {more && (
        <form className="cas-inline" onSubmit={addHours} aria-label={`More hours for ${e.title}`}>
          <HoursFields h={h} set={(p) => setH((x) => ({ ...x, ...p }))} />
          <SupervisorField studentId={studentId} value={h.supervisor} onChange={(supervisor) => setH((x) => ({ ...x, supervisor }))} />
          <div className="cas-foot"><button type="button" className="ghost" onClick={() => setMore(false)}>Cancel</button><button className="primary" type="submit" disabled={!(Number(h.hours) > 0) || !supOk(h.supervisor)}>Log hours</button></div>
        </form>
      )}
      {reflect && (
        <form className="cas-inline" onSubmit={addRefl}>
          <label>Reflection on {e.title}<textarea rows={3} autoFocus value={text} maxLength={4000} onChange={(ev) => setText(ev.target.value)} /></label>
          <div className="cas-foot"><button type="button" className="ghost" onClick={() => setReflect(false)}>Cancel</button><button className="primary" type="submit" disabled={text.trim().length < 3}>Add reflection</button></div>
        </form>
      )}
      {err && <p className="up-error" role="alert">{err}</p>}
    </article>
  );
}

// The page a student shows (or prints) for an outside supervisor: the code, its QR and what it confirms. Made on the server.
async function newCode(entryId) {
  for (let i = 0; ; i++) {
    const r = await fetch('/api/cas/code', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entryId }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) return j;
    // Just logged: the server may not have the hours yet.
    if (r?.status === 404 && i < 4) { await new Promise((res) => setTimeout(res, 700)); continue; }
    throw new Error(r ? j.error || 'The code could not be made. Try again.' : 'A code needs the school server. Try again when you are online, or ask your CAS coordinator.');
  }
}
export function CasCodeCard({ entry, onClose }) {
  const [c, setC] = useState(null);
  const [err, setErr] = useState(null);
  const a = casAbout(entry);
  usePrintTitle(`CAS confirmation – ${a.name}`);
  useEffect(() => { let on = true; newCode(entry.id).then((j) => on && setC(j), (e) => on && setErr(e.message)); return () => { on = false; }; }, [entry.id]);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const url = c && appUrl(`c/${c.code}`);
  return createPortal(
    <div className="cas-code-overlay" role="dialog" aria-modal="true" aria-labelledby="cas-code-h">
      <div className="cas-code-bar"><span>{`Show this to ${entry.supervisor.name}, or print it.`}</span><div className="auth-row"><button className="primary" disabled={!c} onClick={() => print()}>Print</button><button className="ghost" onClick={onClose}>Close</button></div></div>
      <article className="cas-code">
        <div className="kicker">NIST · CAS hours to confirm</div>
        <h1 id="cas-code-h">{a.name}</h1>
        <dl>
          <dt>Experience</dt><dd>{a.title} ({CAS_STRANDS[a.strand] || 'CAS'})</dd>
          <dt>Hours</dt><dd>{casHoursText(entry.hours)} on {fmtDate(entry.date)}</dd>
          {entry.note && <><dt>What they did</dt><dd>{entry.note}</dd></>}
          <dt>Supervisor</dt><dd>{entry.supervisor.name}</dd>
        </dl>
        {err && <p className="up-error" role="alert">{err}</p>}
        {!c && !err && <p role="status">Making a code…</p>}
        {c && <div className="cas-code-main">
          <Qr text={url} size={168} className="cas-qr" />
          <div>
            <p>Scan the code, or go to <b className="cas-url">{appUrl('c')}</b> and type:</p>
            <p className="cas-the-code" aria-label={`Code ${c.code.split('').join(' ')}`}>{c.code}</p>
            <p className="fineprint">You confirm with your email address. The code works once, until {fmtDate(c.expires)} ({CAS_CODE_DAYS} days). No account is needed and you get no emails.</p>
          </div>
        </div>}
      </article>
    </div>,
    document.body,
  );
}

// ── The outside supervisor's page (#/c/<code>): no sign-in, never the record ──
export function CasCodePage({ code: start }) {
  const [code, setCode] = useState(start || '');
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const call = async (method, body) => {
    const r = await fetch(`/api/public/cas/${encodeURIComponent(code.trim())}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(r ? j.error || 'Something went wrong. Try again.' : 'No connection. Try again in a moment.');
    return j;
  };
  const open = async (ev) => { ev?.preventDefault(); setErr(null); setBusy(true); try { setD(await call('GET')); } catch (e) { setErr(e.message); } setBusy(false); };
  useEffect(() => { if (start) open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = async (ok) => { setErr(null); setBusy(true); try { setDone((await call('POST', { email, ok, comment })).status); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <main className="cas-public">
      <div className="kicker">NIST International School · CAS</div>
      {!d && !done && (
        <form onSubmit={open} className="cas-public-card">
          <h1>Confirm a student’s CAS hours</h1>
          <p>A student asked you to confirm the hours they spent with you. Type the code they showed you.</p>
          <label>Code<input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="ABCD-2345" /></label>
          {err && <p className="up-error" role="alert">{err}</p>}
          <button className="primary" type="submit" disabled={busy || code.replace(/[^a-z0-9]/gi, '').length < 8}>Open</button>
        </form>
      )}
      {d && !done && (
        <div className="cas-public-card">
          <h1>{d.student}{d.year ? ` (Year ${d.year})` : ''} asks you to confirm CAS hours</h1>
          <dl>
            <dt>Experience</dt><dd>{d.title}{d.strand ? ` (${CAS_STRANDS[d.strand]})` : ''}</dd>
            <dt>Hours</dt><dd>{casHoursText(d.hours)} on {fmtDate(d.date)}</dd>
            {d.note && <><dt>What they did</dt><dd>{d.note}</dd></>}
            <dt>Supervisor</dt><dd>{d.supervisor}</dd>
          </dl>
          <label>Your email address <small>the one {d.student} gave for you</small><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>A note for {d.student} <small>optional</small><textarea rows={2} value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} /></label>
          {err && <p className="up-error" role="alert">{err}</p>}
          <div className="cas-foot"><button className="ghost" disabled={busy || !email} onClick={() => answer(false)}>These are not right</button><button className="primary" disabled={busy || !email} onClick={() => answer(true)}>Confirm these hours</button></div>
          <p className="fineprint">Only your answer, your name and the note are kept, with the student’s CAS record. We never email you.</p>
        </div>
      )}
      {done && <div className="cas-public-card" role="status"><h1>{done === 'confirmed' ? 'Thank you. The hours are confirmed.' : `Thank you. We told ${d?.student || 'the student'} the hours are not right.`}</h1><p>You can close this page.</p></div>}
    </main>
  );
}

// ── Confirm or send back, as the named staff supervisor ('supervisor') or a CAS coordinator ('coordinator') ──
export function CasDecide({ x, by, via, toast }) {
  const [back, setBack] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const a = casAbout(x), first = a.name.split(' ')[0];
  const ok = () => { const snap = snapshot(); if (tryIt(() => confirmCasHours(x.id, by, { via }), setErr)) toast(`Confirmed ${casHoursText(x.hours)} for ${first}`, snap); };
  const no = (ev) => { ev.preventDefault(); const snap = snapshot(); if (tryIt(() => returnCasHours(x.id, by, { via, comment: note }), setErr)) toast(`Sent back to ${first}`, snap); };
  return (
    <div className="cas-decide">
      {!back && <div className="cas-acts"><button className="primary small-btn" onClick={ok}>{via === 'coordinator' && x.supervisor ? `Confirm for ${shortName(casSupervisorName(x.supervisor))}` : 'Confirm'}</button><button className="ghost small-btn" onClick={() => setBack(true)}>Not right</button></div>}
      {back && <form onSubmit={no} className="cas-inline"><label>What is not right?<input autoFocus value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. It was 2 hours, not 3" /></label>
        <div className="cas-foot"><button type="button" className="ghost small-btn" onClick={() => setBack(false)}>Cancel</button><button className="primary small-btn" type="submit" disabled={note.trim().length < 3}>Send back</button></div></form>}
      {err && <p className="up-error" role="alert">{err}</p>}
    </div>
  );
}
export function CasEntryLine({ x, who = true }) {
  const a = casAbout(x);
  return <span className="cas-entry"><b>{who ? `${a.name}${a.year ? `, Year ${a.year}` : ''}` : a.title}</b><small>{who ? `${a.title} · ` : ''}{CAS_STRANDS[a.strand] || 'CAS'} · {casHoursText(x.hours)} on {fmtDate(x.date)}{x.note ? ` · ${x.note}` : ''}</small></span>;
}

// ── Staff named as supervisor: "CAS to confirm" ──
export function CasConfirm({ persona, version, toast }) {
  const all = useMemo(() => casToConfirm(persona.teacherId), [persona.teacherId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = all.filter((x) => x.status === 'pending').sort((a, b) => a.at.localeCompare(b.at));
  const answered = all.filter((x) => x.status !== 'pending').sort((a, b) => (b.decided?.at || '').localeCompare(a.decided?.at || '')).slice(0, 30);
  return (
    <div className="page cas-confirm">
      <header className="page-head"><div><div className="kicker">CAS</div><h1>CAS hours to confirm</h1>
        <p>Students in Years 12 and 13 named you as the supervisor of their CAS hours. Confirm the hours you saw, or send them back with a short note.</p></div></header>
      <section aria-labelledby="cc-wait-h">
        <h2 id="cc-wait-h">Waiting for you ({waiting.length})</h2>
        {!waiting.length && <p className="cas-empty">Nothing to confirm.</p>}
        <ul className="cas-list">{waiting.map((x) => <li key={x.id}><CasEntryLine x={x} /><CasDecide x={x} by={persona.teacherId} via="supervisor" toast={toast} /></li>)}</ul>
      </section>
      {answered.length > 0 && <section aria-labelledby="cc-done-h">
        <h2 id="cc-done-h">Answered</h2>
        <ul className="cas-list">{answered.map((x) => <li key={x.id}><CasEntryLine x={x} /><span className="cas-acts"><StatusChip status={x.status} /><small>{x.decided?.at ? fmtDate(x.decided.at.slice(0, 10)) : ''}</small></span></li>)}</ul>
      </section>}
    </div>
  );
}

// ── Accounts (admins): which teachers are CAS coordinators, besides the class lists' coordinators ──
export function CasCoordinators({ toast }) {
  const [pick, setPick] = useState('');
  const [err, setErr] = useState(null);
  const marked = casCoordinators();
  const staff = getTeachers().filter((t) => !t.casCoordinator).sort((a, b) => a.name.localeCompare(b.name));
  const set = (id, on) => { if (tryIt(() => setCasCoordinator(id, on), setErr)) { toast(on ? 'Marked as CAS coordinator' : 'No longer a CAS coordinator'); setPick(''); } };
  return (
    <section className="acc-cas" aria-labelledby="acc-cas-h">
      <h2 id="acc-cas-h">CAS coordinators</h2>
      <p className="fineprint">Coordinators from the class lists see the CAS cohort already. Mark any other member of staff here: they see Years 12 and 13 in CAS outcomes and can confirm hours for an outside supervisor.</p>
      {marked.length > 0 && <ul>{marked.map((t) => <li key={t.id}><span>{t.name}</span><button className="ghost" onClick={() => set(t.id, false)}>Remove</button></li>)}</ul>}
      <div className="auth-row">
        <label className="auth-field"><span>Member of staff</span><select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose a person</option>{staff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <button className="auth-btn" disabled={!pick} onClick={() => set(pick, true)}>Mark as CAS coordinator</button>
      </div>
      {err && <p className="auth-err" role="alert">{err}</p>}
    </section>
  );
}
