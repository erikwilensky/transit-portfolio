// School screens (exhibitions; api.createExhibition, server/routes/45-exhibition.mjs): make a screen for an open evening,
// the library or a lobby TV, copy its address, watch the queue of slides, remove any slide, pause it or turn it off.
// A teacher of a student's class sees the slides of their own students on other people's screens and may remove them.
import { useEffect, useState } from 'react';
import { createExhibition, EXHIBIT_SECONDS, getClasses, getExhibitions, getSchoolLines, getStudents, pauseExhibition, removeExhibitionSlide, revokeExhibition, getTeacher } from '../api.js';
import { appUrl } from '../format.js';
import './exhibitions.css';

const WHOLE = ['coordinator', 'counsellor', 'leadership'];
const SECONDS = [6, 8, 10, 15, 20, 30].filter((s) => s >= EXHIBIT_SECONDS.min && s <= EXHIBIT_SECONDS.max);
const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const day = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

export default function Exhibitions({ persona, toast, version }) {
  const me = persona.teacherId || null;
  const whole = !!persona.admin || WHOLE.includes(persona.kind);
  const [making, setMaking] = useState(false);
  const all = getExhibitions();
  const mine = all.filter((x) => !!x.token);
  const others = all.filter((x) => !x.token && !x.revoked);
  return (
    <div className="page exh-page" data-v={version}>
      <header className="exh-head">
        <div>
          <h1>School screens</h1>
          <p className="fineprint">A slideshow of students’ moments for an open evening, the library or a lobby TV. Only moments a student made publishable appear, with their first name and Year, never comments. Students can turn school screens off in Privacy.</p>
        </div>
        {!making && <button className="primary" onClick={() => setMaking(true)}>New school screen</button>}
      </header>
      {making && <NewScreen me={me} whole={whole} persona={persona} toast={toast} onDone={() => setMaking(false)} />}
      {!mine.length && !making && <p className="card-sec fineprint">You have not made a school screen yet.</p>}
      <ul className="exh-list">{mine.map((x) => <ScreenCard key={x.id} x={x} me={me} toast={toast} version={version} own />)}</ul>
      {others.length > 0 && <>
        <h2 className="exh-h2">Other school screens</h2>
        <p className="fineprint">Screens other staff made. You see the slides of students in your classes{whole ? ' (as a moderator, every slide)' : ''}, and you can remove any of them.</p>
        <ul className="exh-list">{others.map((x) => <ScreenCard key={x.id} x={x} me={me} toast={toast} version={version} />)}</ul>
      </>}
    </div>
  );
}

function NewScreen({ me, whole, persona, toast, onDone }) {
  const myClasses = getClasses().filter((c) => (c.teacherIds || []).includes(me)).sort((a, b) => a.name.localeCompare(b.name));
  const advises = !!me && getStudents().some((s) => s.advisorId === me);
  const years = [...new Set(getStudents().map((s) => s.grade + 1))].filter((y) => y >= 1 && y <= 13).sort((a, b) => a - b);
  const lines = getSchoolLines().filter((l) => l.status !== 'ended');
  const [f, setF] = useState({ title: '', years: [], classIds: [], advisory: false, lineIds: [], from: '', to: '', seconds: EXHIBIT_SECONDS.standard });
  const [err, setErr] = useState(null);
  const flip = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  const picked = f.years.length || f.classIds.length || f.advisory;
  const make = (e) => {
    e.preventDefault();
    if (!whole && !picked) return setErr('Pick at least one class or your advisory.');
    try {
      createExhibition({ ...f, from: f.from || null, to: f.to || null }, me, newToken());
      toast?.('School screen made. Copy its address to open it on the screen.');
      onDone();
    } catch (x) { setErr(x.message || 'That did not work.'); }
  };
  return (
    <form className="card-sec exh-new" onSubmit={make}>
      <h2>New school screen</h2>
      <label className="exh-field"><span>Title on the screen</span><input required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Open evening: Year 9 projects" /></label>
      <fieldset className="exh-field"><legend>Whose moments</legend>
        {whole && <div className="exh-chips">{years.map((y) => <label key={y} className={`exh-chip${f.years.includes(y) ? ' on' : ''}`}><input type="checkbox" checked={f.years.includes(y)} onChange={() => flip('years', y)} />Year {y}</label>)}</div>}
        {myClasses.length > 0 && <div className="exh-chips">{myClasses.map((c) => <label key={c.id} className={`exh-chip${f.classIds.includes(c.id) ? ' on' : ''}`}><input type="checkbox" checked={f.classIds.includes(c.id)} onChange={() => flip('classIds', c.id)} />{c.name}</label>)}</div>}
        {advises && <label className={`exh-chip${f.advisory ? ' on' : ''}`}><input type="checkbox" checked={f.advisory} onChange={() => setF({ ...f, advisory: !f.advisory })} />My advisory</label>}
        <p className="fineprint">{whole ? (picked ? 'Students in any of these.' : 'Nothing picked: the whole school.') : myClasses.length || advises ? 'Students in any of these.' : 'You have no classes or advisory in the class lists yet.'}</p>
      </fieldset>
      <fieldset className="exh-field"><legend>Lines</legend>
        <div className="exh-chips">{lines.map((l) => <label key={l.id} className={`line-chip${f.lineIds.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }}><input type="checkbox" className="exh-hide" checked={f.lineIds.includes(l.id)} onChange={() => flip('lineIds', l.id)} /><i />{l.name}</label>)}</div>
        <p className="fineprint">{f.lineIds.length ? 'Only moments on these lines.' : 'None picked: every line.'}</p>
      </fieldset>
      <div className="exh-row">
        <label className="exh-field"><span>Moments from</span><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="exh-field"><span>to</span><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="exh-field"><span>Each slide shows for</span><select value={f.seconds} onChange={(e) => setF({ ...f, seconds: Number(e.target.value) })}>{SECONDS.map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></label>
      </div>
      {err && <p className="exh-err" role="alert">{err}</p>}
      <div className="exh-actions"><button type="submit" className="primary">Make the screen</button><button type="button" className="ghost" onClick={onDone}>Cancel</button></div>
      <p className="fineprint">The screen opens at a long secret address, with no sign-in. Anyone with the address sees the slides, so open it only on school screens. You can turn it off at any time.</p>
    </form>
  );
}

function ScreenCard({ x, me, toast, version, own }) {
  const [q, setQ] = useState(null); // { slides, removed }
  const [gone, setGone] = useState(new Set());
  useEffect(() => {
    if (x.revoked) return undefined;
    let live = true;
    fetch(`/api/exhibitions/${encodeURIComponent(x.id)}/slides`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setQ(j); }).catch(() => {});
    return () => { live = false; };
  }, [x.id, x.revoked, version, (x.removed || []).length]);
  const url = x.token ? appUrl(`x/${x.token}`) : null;
  const status = x.revoked ? 'Turned off' : x.paused ? 'Paused' : 'Showing';
  const what = [x.years?.length ? `Years ${x.years.join(', ')}` : null, x.classIds?.length ? `${x.classIds.length} ${x.classIds.length === 1 ? 'class' : 'classes'}` : null, x.advisory ? 'an advisory' : null].filter(Boolean).join(', ') || 'The whole school';
  const span = x.from || x.to ? `moments from ${day(x.from) || 'the start'} to ${day(x.to) || 'today'}` : 'any date';
  const remove = (s) => {
    try { removeExhibitionSlide(x.id, s.eventId, me); setGone(new Set([...gone, s.eventId])); toast?.(`Removed “${s.title}”. It will not come back on this screen.`); } catch (e) { toast?.(e.message || 'That did not work.'); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast?.('Address copied.'); } catch { toast?.('Select the address and copy it.'); } };
  const slides = (q?.slides || []).filter((s) => !gone.has(s.eventId));
  return (
    <li className={`card-sec exh-card${x.revoked ? ' off' : ''}`} data-id={x.id}>
      <div className="exh-top">
        <span className={`exh-status s-${x.revoked ? 'off' : x.paused ? 'paused' : 'on'}`}>{status}</span>
        <h3>{x.title}</h3>
        {!own && <small className="fineprint">by {getTeacher(x.by)?.name || 'the pilot admin'}</small>}
      </div>
      <p className="fineprint">{what} · {x.lineIds?.length ? `${x.lineIds.length} ${x.lineIds.length === 1 ? 'line' : 'lines'}` : 'every line'} · {span} · {x.seconds} seconds a slide</p>
      {url && !x.revoked && <div className="exh-url">
        <input readOnly value={url} aria-label="Screen address" onFocus={(e) => e.target.select()} />
        <button className="ghost" onClick={copy}>Copy</button>
        <a className="ghost" href={url} target="_blank" rel="noreferrer">Open the screen</a>
      </div>}
      {own && !x.revoked && <div className="exh-actions">
        <button className="ghost" onClick={() => { try { pauseExhibition(x.id, !x.paused, me); toast?.(x.paused ? 'Showing again.' : 'Paused. The screen shows the school logo until you start it again.'); } catch (e) { toast?.(e.message); } }}>{x.paused ? 'Start again' : 'Pause'}</button>
        <button className="ghost danger" onClick={() => { if (confirm('Turn this screen off? Its address stops working for good.')) { try { revokeExhibition(x.id, me); toast?.('Turned off. The address no longer works.'); } catch (e) { toast?.(e.message); } } }}>Turn off</button>
      </div>}
      {!x.revoked && <>
        <h4 className="exh-h4">{own ? 'Slides in the queue' : 'Your students’ slides'} {q && <span className="fineprint">({slides.length})</span>}</h4>
        {!q ? <p className="fineprint">Loading…</p> : !slides.length ? <p className="fineprint">{own ? 'No slides yet. When students in this screen make a moment publishable, it appears here.' : 'None of your students’ moments are on this screen.'}</p> : (
          <ul className="exh-slides">{slides.map((s) => (
            <li key={s.eventId} className="exh-slide" data-event={s.eventId} style={{ '--c': s.line?.colour || '#002855' }}>
              {s.photo ? <img src={s.photo} alt="" loading="lazy" /> : <span className="exh-nophoto" aria-hidden="true" />}
              <div><b>{s.title}</b><small>{s.name} · Year {s.year}{s.line ? ` · ${s.line.name}` : ''}</small>{s.quote && <small className="exh-quote">“{s.quote}”</small>}</div>
              <button className="ghost danger" onClick={() => remove(s)} aria-label={`Remove “${s.title}” from this screen`}>Remove</button>
            </li>
          ))}</ul>
        )}
        {q?.removed?.length > 0 && <details className="exh-removed"><summary>Removed ({q.removed.length})</summary><ul>{q.removed.map((r) => <li key={r.eventId}>{r.title}{r.name ? ` (${r.name})` : ''}{r.byName ? `, by ${r.byName}` : ''}</li>)}</ul></details>}
      </>}
    </li>
  );
}
