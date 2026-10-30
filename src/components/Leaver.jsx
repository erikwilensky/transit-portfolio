// Leaver portfolio (api.saveLeaver … leaverView): the student's guided builder (#/<me>/leaver), the document in three
// templates (screen, A4 PDF and the public page), the advisor's read-only view with comments, and #/l/<token>.
import { useEffect, useMemo, useState } from 'react';
import { commentLeaver, doneLeaverComment, getLeaver, getStore, getStudent, getTeacher, leaverChoices, leaverLinkOpen, leaverPractice, leaverView,
  LEAVER_LINK_DAYS, LEAVER_MAX, LEAVER_TEMPLATES, revokeLeaver, saveLeaver, sentencesOf, shareLeaver, shortName, TODAY } from '../api.js';
import { appUrl, fmtDate, TYPE_LABEL, VERIFY_LABEL } from '../format.js';
import { docName } from '../print.js';
import { uploadFile } from '../upload.js';
import { PrintButton, PrintFooter, PrintHead } from './PrintKit.jsx';
import Logo from './Logo.jsx';
import Qr from './Qr.jsx';
import './leaver.css';

const STEPS = ['Profile', 'Moments', 'Skills', 'Endorsements', 'Look and share'];
const WHOLE_SCHOOL = ['leadership', 'coordinator', 'counsellor'];
const linkUrl = (token) => appUrl(`l/${token}`);
const newToken = () => { const b = new Uint8Array(18); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const imgUrl = (u) => u || '';
const linkState = (l) => (l.revoked ? 'Withdrawn' : l.expiresAt < TODAY ? `Expired ${fmtDate(l.expiresAt)}` : `Open until ${fmtDate(l.expiresAt)}`);

// ── The document: the same for the preview, the PDF, the advisor and the public page ──
export function LeaverDoc({ view, url }) {
  if (!view) return null;
  const head = (
    <header className="lv-head">
      {view.photo && <img className="lv-photo" src={imgUrl(view.photo)} alt="" />}
      <div>
        <h1>{view.name}</h1>
        <p className="lv-sub">Year {view.year}{view.programme ? ` · ${view.programme}` : ''} · NIST International School{view.practice ? ' · Practice portfolio' : ''}</p>
        {view.email && <p className="lv-contact">{view.email}</p>}
      </div>
    </header>
  );
  const statement = view.statement && <section className="lv-sec lv-statement"><h2>Personal statement</h2>{view.statement.split(/\n{2,}/).map((t, i) => <p key={i}>{t}</p>)}</section>;
  const skills = (view.skills.lp.length > 0 || view.skills.atl.length > 0) && (
    <section className="lv-sec lv-skills"><h2>Skills and qualities</h2>
      {view.skills.lp.length > 0 && <><h3>IB learner profile</h3><ul className="lv-chips">{view.skills.lp.map((x) => <li key={x.k}>{x.k}<small>{x.n}</small></li>)}</ul></>}
      {view.skills.atl.length > 0 && <><h3>Approaches to learning</h3><ul className="lv-chips">{view.skills.atl.map((x) => <li key={x.k}>{x.k}<small>{x.n}</small></li>)}</ul></>}
      <p className="lv-note">The number is how many of the moments below show it.</p>
    </section>
  );
  const moments = (
    <section className="lv-sec lv-moments"><h2>Best moments</h2>
      {!view.moments.length && <p className="lv-note">No moments picked yet.</p>}
      <ol>{view.moments.map((m) => (
        <li key={m.id} className="lv-moment">
          <div className="lv-m-head">
            <h3>{m.title}</h3>
            <span className="lv-m-meta">{fmtDate(m.date)}{m.lines.length ? ` · ${m.lines.map((l) => l.name).join(', ')}` : ''}{TYPE_LABEL[m.type] ? ` · ${TYPE_LABEL[m.type]}` : ''}</span>
            {m.verification && m.verification !== 'student-added' && <span className="lv-ver">{VERIFY_LABEL[m.verification]}{m.code ? ` · ${m.code}` : ''}</span>}
          </div>
          {m.summary && <p>{m.summary}</p>}
          {m.evidence.some((v) => v.kind === 'image' && v.url) && <div className="lv-ev-img">{m.evidence.filter((v) => v.kind === 'image' && v.url).slice(0, 3).map((v, i) => <figure key={i}><img src={imgUrl(v.url)} alt={v.caption} />{v.caption && <figcaption>{v.caption}</figcaption>}</figure>)}</div>}
          {m.evidence.some((v) => v.kind !== 'image') && <ul className="lv-ev">{m.evidence.filter((v) => v.kind !== 'image').map((v, i) => <li key={i}>{v.caption || 'Evidence'}{v.url && /^https?:/.test(v.url) ? <span className="lv-url"> {v.url.replace(/^https?:\/\//, '')}</span> : null}</li>)}</ul>}
          {m.reflection && <blockquote className="lv-refl">{m.reflection.prompt && <b>{m.reflection.prompt}</b>}<p>{m.reflection.text}</p></blockquote>}
        </li>))}
      </ol>
    </section>
  );
  const endorsements = view.endorsements.length > 0 && (
    <section className="lv-sec lv-endorse"><h2>Endorsements</h2>
      <ul>{view.endorsements.map((n) => <li key={n.id}><p>“{n.note}”</p><span><b>{n.teacher}</b>{n.role ? `, ${n.role}` : ''}<br />On “{n.moment}” · {fmtDate(n.date)}</span></li>)}</ul>
    </section>
  );
  return (
    <article className={`lv-doc lv-${view.template}`} aria-label={`${view.name}: leaver portfolio`}>
      <PrintHead kicker="Leaver portfolio" />
      {view.template === 'two-column'
        ? <div className="lv-cols"><aside className="lv-side">{head}{skills}{endorsements}</aside><div className="lv-main">{statement}{moments}</div></div>
        : <>{head}{statement}{skills}{moments}{endorsements}</>}
      <PrintFooter name={view.name} verifyUrl={url} />
    </article>
  );
}

// ── Student: the guided builder ──
export function LeaverBuilder({ studentId, version, toast }) {
  const p = getLeaver(studentId);
  const view = useMemo(() => (p ? leaverView(studentId) : null), [studentId, version, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const choices = useMemo(() => leaverChoices(studentId), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState(0);
  const save = (patch, msg) => { try { saveLeaver(studentId, patch); if (msg) toast(msg); return true; } catch (e) { toast(e.message); return false; } };
  const s = getStudent(studentId);
  const open = (p?.comments || []).filter((c) => !c.done);
  const title = docName(view?.name || s.name, 'Leaver portfolio');
  const live = (p?.links || []).find(leaverLinkOpen);
  return (
    <div className="page lv-page">
      <div className="lv-top">
        <div>
          <h1>Leaver portfolio{leaverPractice(studentId) && <span className="lv-practice">Practice</span>}</h1>
          <p className="lv-blurb">One clear page of your best moments for university, scholarship or job applications. Pick what to show; nothing else from your map goes in.{leaverPractice(studentId) ? ' In Year 11 this is a practice run: everything works, so you are ready next year.' : ''}</p>
        </div>
        {p && <PrintButton title={title} className="ghost" />}
      </div>
      {!p ? (
        <div className="lv-start card-sec">
          <h2>Start your portfolio</h2>
          <p>It takes five short steps: a short profile, up to {LEAVER_MAX} best moments, your skills, endorsements from teachers, and a look. Your advisor can read your draft and leave comments. Only you can change it.</p>
          <button className="primary" onClick={() => save({}, 'Portfolio started')}>Start</button>
        </div>
      ) : <>
        {open.length > 0 && (
          <section className="lv-comments card-sec" aria-labelledby="lv-cm-h">
            <h2 id="lv-cm-h">Comments on your draft</h2>
            <ul>{open.map((c) => <li key={c.id}><p>{c.text}</p><small>{shortName(getTeacher(c.by)?.name || 'A teacher')} · {fmtDate(c.at.slice(0, 10))}</small>
              <button className="ghost" onClick={() => { try { doneLeaverComment(studentId, c.id); toast('Marked done'); } catch (e) { toast(e.message); } }}>Done</button></li>)}</ul>
          </section>
        )}
        <nav className="lv-steps" aria-label="Steps">
          {STEPS.map((t, i) => <button key={t} className={i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}><span>{i + 1}</span>{t}</button>)}
        </nav>
        <div className="lv-body">
          <div className="lv-edit">
            {step === 0 && <ProfileStep p={p} save={save} toast={toast} />}
            {step === 1 && <MomentsStep p={p} choices={choices} save={save} />}
            {step === 2 && <SkillsStep p={p} view={view} choices={choices} save={save} />}
            {step === 3 && <EndorseStep p={p} choices={choices} save={save} />}
            {step === 4 && <LookStep p={p} studentId={studentId} view={view} save={save} toast={toast} />}
            <div className="lv-nav">
              {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {step < STEPS.length - 1 && <button className="primary" onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>}
            </div>
          </div>
          <div className="lv-preview" aria-label="Preview">
            <div className="lv-preview-bar"><b>Preview</b><span>{LEAVER_TEMPLATES[view.template]} · A4</span></div>
            <LeaverDoc view={view} url={live ? linkUrl(live.token) : null} />
          </div>
        </div>
      </>}
    </div>
  );
}

function ProfileStep({ p, save, toast }) {
  const [f, setF] = useState(p.profile);
  const [busy, setBusy] = useState(false);
  const blur = () => { if (JSON.stringify(f) !== JSON.stringify(p.profile)) save({ profile: f }); };
  const photo = async (file) => {
    if (!file) return;
    setBusy(true);
    try { const r = await uploadFile(file), next = { ...f, photo: r.url }; if (save({ profile: next })) { setF(next); toast('Photo added'); } } catch (e) { toast(e.message); }
    setBusy(false);
  };
  return (
    <section className="lv-step" aria-labelledby="lv-s1">
      <h2 id="lv-s1">1. A short profile</h2>
      <label>Your name<input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} onBlur={blur} /></label>
      <label>Personal statement <small>One paragraph: who you are, what you care about, what you want to do next.</small>
        <textarea rows={6} value={f.statement} maxLength={1500} onChange={(e) => setF({ ...f, statement: e.target.value })} onBlur={blur} placeholder="I am a Year 13 student who…" />
        <small className="lv-count">{f.statement.length} / 1500</small></label>
      <label>Contact email <small>Optional. Readers with the link will see it.</small><input type="email" value={f.email} maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={blur} placeholder="you@example.com" /></label>
      <div className="lv-photo-row">
        {f.photo ? <img className="lv-photo" src={f.photo} alt="Your photo" /> : <span className="lv-photo lv-ph" aria-hidden="true" />}
        <label className="ghost lv-file">{busy ? 'Uploading…' : f.photo ? 'Change photo' : 'Add a photo (optional)'}<input type="file" accept="image/*" onChange={(e) => photo(e.target.files?.[0])} disabled={busy} /></label>
        {f.photo && <button className="ghost" onClick={() => { const next = { ...f, photo: null }; if (save({ profile: next }, 'Photo removed')) setF(next); }}>Remove</button>}
      </div>
    </section>
  );
}

function MomentsStep({ p, choices, save }) {
  const byId = new Map(choices.moments.map((e) => [e.id, e]));
  const picked = p.moments.filter((m) => byId.has(m.eventId));
  const set = (list) => save({ moments: list });
  const add = (e) => set([...picked, { eventId: e.id, evidence: (e.evidence || []).map((_, i) => i), reflectionId: e.reflections[0]?.id || null, sentences: null }]);
  const patch = (i, x) => set(picked.map((m, j) => (j === i ? { ...m, ...x } : m)));
  const move = (i, d) => { const l = [...picked]; [l[i], l[i + d]] = [l[i + d], l[i]]; set(l); };
  const rest = choices.moments.filter((e) => !picked.some((m) => m.eventId === e.id));
  return (
    <section className="lv-step" aria-labelledby="lv-s2">
      <h2 id="lv-s2">2. Your best moments <small>{picked.length} of {LEAVER_MAX}</small></h2>
      <p className="lv-help">Pick up to {LEAVER_MAX}, put the strongest first, and choose what to show with each.{choices.blocked ? ` ${choices.blocked} private or hidden moment${choices.blocked === 1 ? ' is' : 's are'} left out: private moments never go in a portfolio.` : ''}</p>
      {picked.length > 0 && <ol className="lv-picked">{picked.map((m, i) => {
        const e = byId.get(m.eventId), r = e.reflections.find((x) => x.id === m.reflectionId), parts = r ? sentencesOf(r.text) : [];
        const shown = Array.isArray(m.sentences) ? m.sentences : parts.map((_, k) => k);
        return (
          <li key={m.eventId} className="lv-pick">
            <div className="lv-pick-head">
              <b>{i + 1}. {e.title}</b><small>{fmtDate(e.date)}</small>
              <span className="lv-order">
                <button className="ghost" aria-label={`Move “${e.title}” up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="ghost" aria-label={`Move “${e.title}” down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="ghost" aria-label={`Take “${e.title}” out`} onClick={() => set(picked.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </div>
            {e.evidence?.length > 0 && <fieldset><legend>Evidence to show</legend>{e.evidence.map((v, k) => (
              <label key={k} className="lv-check"><input type="checkbox" checked={m.evidence.includes(k)} onChange={(x) => patch(i, { evidence: x.target.checked ? [...m.evidence, k] : m.evidence.filter((y) => y !== k) })} />{v.caption || v.name || v.kind}</label>))}
            </fieldset>}
            {e.reflections.length > 0 && <fieldset><legend>Reflection</legend>
              <label className="lv-check"><input type="radio" name={`r-${m.eventId}`} checked={!m.reflectionId} onChange={() => patch(i, { reflectionId: null, sentences: null })} />No reflection</label>
              {e.reflections.map((x) => <label key={x.id} className="lv-check"><input type="radio" name={`r-${m.eventId}`} checked={m.reflectionId === x.id} onChange={() => patch(i, { reflectionId: x.id, sentences: null })} />{x.prompt || 'Reflection'}<small> · {fmtDate(x.date)}</small></label>)}
            </fieldset>}
            {parts.length > 1 && <fieldset className="lv-sents"><legend>Which part of the reflection</legend>{parts.map((t, k) => (
              <label key={k} className="lv-check"><input type="checkbox" checked={shown.includes(k)} onChange={(x) => patch(i, { sentences: x.target.checked ? [...shown, k] : shown.filter((y) => y !== k) })} />{t}</label>))}
            </fieldset>}
          </li>
        );
      })}</ol>}
      <h3>From your map</h3>
      {!rest.length ? <p className="lv-help">{choices.moments.length ? 'Every moment you can use is picked.' : 'Add moments to your map first. Moments you keep private do not show here.'}</p>
        : <ul className="lv-choices">{rest.map((e) => (
          <li key={e.id}><span><b>{e.title}</b><small>{fmtDate(e.date)}{e.verification !== 'student-added' ? ` · ${VERIFY_LABEL[e.verification]}` : ''}</small></span>
            <button className="ghost" disabled={picked.length >= LEAVER_MAX} onClick={() => add(e)} aria-label={`Add “${e.title}”`}>Add</button></li>))}
        </ul>}
    </section>
  );
}

function SkillsStep({ p, view, choices, save }) {
  const byId = new Map(choices.moments.map((e) => [e.id, e]));
  const tags = (field) => [...new Set(p.moments.flatMap((m) => byId.get(m.eventId)?.tags[field] || []))];
  const off = new Set(p.skillsOff || []);
  const toggle = (k) => save({ skillsOff: off.has(k) ? [...off].filter((x) => x !== k) : [...off, k] });
  const all = [['IB learner profile', tags('lp')], ['Approaches to learning', tags('atl')]];
  return (
    <section className="lv-step" aria-labelledby="lv-s3">
      <h2 id="lv-s3">3. Skills and qualities</h2>
      <p className="lv-help">These come from the tags on the moments you picked. Untick any you do not want to show. Change tags on your map.</p>
      {all.every(([, l]) => !l.length) && <p className="lv-help">No tags yet. Pick moments first, or tag them on your map.</p>}
      {all.map(([h, l]) => l.length > 0 && <fieldset key={h}><legend>{h}</legend>{l.map((k) => (
        <label key={k} className="lv-check"><input type="checkbox" checked={!off.has(k)} onChange={() => toggle(k)} />{k}<small> · {[...view.skills.lp, ...view.skills.atl].find((x) => x.k === k)?.n || 0} moments</small></label>))}</fieldset>)}
    </section>
  );
}

function EndorseStep({ p, choices, save }) {
  const on = new Set(p.endorsements || []);
  return (
    <section className="lv-step" aria-labelledby="lv-s4">
      <h2 id="lv-s4">4. Endorsements</h2>
      <p className="lv-help">What teachers wrote when they endorsed your moments. Only endorsements on moments you show the school or beyond can go in.</p>
      {!choices.endorsements.length ? <p className="lv-help">None yet. Ask a teacher to endorse a moment from your map.</p>
        : <ul className="lv-choices">{choices.endorsements.map((n) => (
          <li key={n.id}><label className="lv-check"><input type="checkbox" checked={on.has(n.id)} onChange={(x) => save({ endorsements: x.target.checked ? [...on, n.id] : [...on].filter((y) => y !== n.id) })} />
            <span><b>{n.teacher?.name || 'A teacher'}</b> on “{n.moment.title}”<small>“{n.note}”</small></span></label></li>))}
        </ul>}
    </section>
  );
}

function LookStep({ p, studentId, view, save, toast }) {
  const [days, setDays] = useState(90);
  const [label, setLabel] = useState('');
  const [made, setMade] = useState(null);
  const [copied, setCopied] = useState(null);
  const copy = (t) => { try { navigator.clipboard.writeText(linkUrl(t)).then(() => setCopied(t), () => setCopied(t)); } catch { setCopied(t); } };
  const make = () => {
    try { const l = shareLeaver(studentId, { token: newToken(), days, label }); setMade(l.token); setLabel(''); toast('Link ready'); } catch (e) { toast(e.message); }
  };
  return (
    <section className="lv-step" aria-labelledby="lv-s5">
      <h2 id="lv-s5">5. Look and share</h2>
      <fieldset className="lv-templates"><legend>Template</legend>
        {Object.entries(LEAVER_TEMPLATES).map(([k, t]) => (
          <label key={k} className={`lv-tpl${p.template === k ? ' on' : ''}`}><input type="radio" name="lv-tpl" checked={p.template === k} onChange={() => save({ template: k })} /><span className={`lv-thumb t-${k}`} aria-hidden="true"><i /><i /><i /></span>{t}</label>))}
      </fieldset>
      <p className="lv-help"><b>Download PDF</b> (top right) saves an A4 copy to attach to an application.</p>
      <h3>Web page</h3>
      <p className="lv-help">A link shows only this portfolio, never the rest of your map. Withdraw it any time and it stops working at once.</p>
      <div className="lv-make">
        <label>Who is it for? <small>Optional, only you see this</small><input value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. UCL admissions" /></label>
        <label>Works for<select value={days} onChange={(e) => setDays(Number(e.target.value))}>{LEAVER_LINK_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
        <button className="primary" disabled={!view.moments.length} onClick={make}>Make a link</button>
      </div>
      {!view.moments.length && <p className="lv-help">Pick at least one moment first.</p>}
      {made && <div className="lv-made"><Qr text={linkUrl(made)} size={96} /><div><input readOnly value={linkUrl(made)} onFocus={(e) => e.target.select()} aria-label="New link" /><button className="primary" onClick={() => copy(made)}>{copied === made ? 'Copied' : 'Copy link'}</button> <a className="ghost" href={linkUrl(made)} target="_blank" rel="noreferrer">Open</a></div></div>}
      {(p.links || []).length > 0 && <ul className="lv-links">{[...p.links].reverse().map((l) => (
        <li key={l.token} className={leaverLinkOpen(l) ? '' : 'off'}>
          <span><b>{l.label || 'Link'}</b><small>{linkState(l)}</small></span>
          {leaverLinkOpen(l) && <><button className="ghost" onClick={() => copy(l.token)}>{copied === l.token ? 'Copied' : 'Copy'}</button>
            <button className="ghost lv-revoke" onClick={() => { try { revokeLeaver(studentId, l.token); toast('Link withdrawn. It no longer opens.'); } catch (e) { toast(e.message); } }}>Withdraw</button></>}
        </li>))}</ul>}
    </section>
  );
}

// ── Staff: the advisor's read-only view of the draft, with comments ──
export function LeaverForStaff({ studentId, version, persona, toast }) {
  const p = getLeaver(studentId);
  const view = useMemo(() => (p ? leaverView(studentId) : null), [studentId, version, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const s = getStudent(studentId);
  if (!s || s.grade < 10) return null;
  const first = s.name.split(' ')[0];
  const canComment = !!persona.teacherId && (s.advisorId === persona.teacherId || WHOLE_SCHOOL.includes(persona.kind));
  const send = () => { try { commentLeaver(studentId, persona.teacherId, text); setText(''); toast(`Comment sent. ${first} sees it on the portfolio.`); } catch (e) { toast(e.message); } };
  return (
    <section className="card-sec lv-staff">
      <h3>Leaver portfolio</h3>
      {!p ? <p className="fineprint">{first} has not started a leaver portfolio yet.</p> : <>
        <p className="fineprint">{view.moments.length} moment{view.moments.length === 1 ? '' : 's'} · {LEAVER_TEMPLATES[view.template]}{p.updatedAt ? ` · changed ${fmtDate(p.updatedAt.slice(0, 10))}` : ''} · {(p.links || []).filter(leaverLinkOpen).length} open link{(p.links || []).filter(leaverLinkOpen).length === 1 ? '' : 's'}</p>
        <button className="ghost" onClick={() => setOpen(true)}>Read the draft</button>
      </>}
      {open && view && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal lv-modal" role="dialog" aria-label={`${s.name}: leaver portfolio draft`} onClick={(e) => e.stopPropagation()}>
            <button className="panel-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="modal-kicker">Leaver portfolio · draft · read only</div>
            <h2>{s.name}</h2>
            <div className="lv-modal-body">
              <LeaverDoc view={view} />
              <aside className="lv-cm">
                <h3>Comments</h3>
                {!(p.comments || []).length && <p className="fineprint">No comments yet.</p>}
                <ul>{(p.comments || []).map((c) => <li key={c.id} className={c.done ? 'done' : ''}><p>{c.text}</p><small>{shortName(getTeacher(c.by)?.name || '')} · {fmtDate(c.at.slice(0, 10))}{c.done ? ` · ${first} marked it done` : ''}</small></li>)}</ul>
                {canComment ? <><textarea rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={`A suggestion for ${first}`} aria-label="Comment" />
                  <button className="primary" disabled={text.trim().length < 2} onClick={send}>Add comment</button></>
                  : <p className="fineprint">{first}’s advisor can comment.</p>}
                <p className="fineprint">Only {first} can change the portfolio.</p>
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── #/l/<token>: what a university, scholarship panel or employer opens ──
async function fetchLeaver(token) {
  try {
    const res = await fetch(new URL(`api/public/leaver/${encodeURIComponent(token)}`, location.href), { cache: 'no-store' });
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
    return { status: res.status, body: await res.json() };
  } catch { return null; }
}
// No server (static demo): this browser's own copy.
function localLeaver(token) {
  for (const [sid, p] of Object.entries(getStore().leaver || {})) {
    const l = (p.links || []).find((x) => x.token === token);
    if (l) return leaverLinkOpen(l) ? { status: 200, body: { portfolio: leaverView(sid), expiresAt: l.expiresAt } } : { status: l.revoked ? 404 : 410, body: {} };
  }
  return { status: 404, body: {} };
}
export function PublicLeaver({ token }) {
  const [r, setR] = useState(null);
  useEffect(() => { let live = true; fetchLeaver(token).then((x) => { if (live) setR(x || localLeaver(token)); }); return () => { live = false; }; }, [token]);
  const v = r?.status === 200 ? r.body.portfolio : null;
  return (
    <div className="landing lv-public">
      <header className="landing-bar"><Logo className="landing-logo" /><span className="lb-title">Leaver portfolio</span>{v && <span className="lb-meta">Shared by the student · open until {fmtDate(r.body.expiresAt)}</span>}
        {v && <span className="lv-pub-print"><PrintButton title={docName(v.name, 'Leaver portfolio')} className="ghost" /></span>}</header>
      {!r ? <div className="link-dead" aria-busy="true"><p>Opening the portfolio…</p></div>
        : !v ? <div className="link-dead"><div className="tri" aria-hidden="true" /><h2>{r.status === 410 ? 'This link has expired' : 'This link does not work'}</h2><p>{r.status === 410 ? 'Ask the student for a new link.' : 'It may have been withdrawn, or the address is wrong. The student controls who can read their portfolio. Ask them for a new link.'}</p></div>
          : <main className="lv-pub-body"><LeaverDoc view={v} url={linkUrl(token)} /></main>}
    </div>
  );
}
