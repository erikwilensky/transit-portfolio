import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLens, askEvidence, exportPresentation, extraViews, getStudentMap, isGated, notify, recordView, TODAY, PERSONA_OF_STUDENT, SHARED_LABEL } from '../api.js';
import { appUrl, fmtDate, TYPE_LABEL, verifyCode, inkOn } from '../format.js';
import Qr from '../components/Qr.jsx';
import { VerifyBadge } from '../components/Badge.jsx';
import PresentationView from '../components/PresentationView.jsx';
import { siteDoc, starterHtml } from '../components/CodeView.jsx';
import StationPanel from '../components/StationPanel.jsx';
import Logo from '../components/Logo.jsx';
import { PrintButton, PrintFooter, PrintHead } from '../components/PrintKit.jsx';
import { docName, presentationName } from '../print.js';
import { VerifyScope } from '../components/VerifyModal.jsx';

const SHARED_WITH = SHARED_LABEL;

// What someone outside the school sees when they open a share link.
export default function ShareLanding({ token, drafts, embedded = false }) {
  const all = Object.values(drafts).flat();
  const pres = all.find((p) => p.shareLinks.some((l) => l.token === token));
  const link = pres?.shareLinks.find((l) => l.token === token);
  const map = useMemo(() => pres && getStudentMap(pres.studentId, 'public'), [pres]);
  const lens = useMemo(() => pres && applyLens(map, pres, { hiddenLines: pres.filters.hiddenLines }), [map, pres]);
  const [selected, setSelected] = useState(null);
  const [asked, setAsked] = useState(false);
  const counted = useRef(false);
  const dead = !link || link.revoked || link.expiresAt < TODAY;
  const [view, setView] = useState('full');
  const [email, setEmail] = useState('');
  const [reader, setReader] = useState(null);
  const gated = link && !embedded && isGated(link) && !reader;

  useEffect(() => {
    if (!counted.current && link && !dead && !gated) { counted.current = true; recordView(token, pres.studentId, reader || (embedded ? 'Northbridge University admissions' : 'Anonymous viewer')); try { new BroadcastChannel('tp-views').postMessage({ token }); } catch { /* not supported */ } }
  }, [token, gated]); // eslint-disable-line react-hooks/exhaustive-deps

  const event = map && map.events.find((e) => e.id === selected && lens.visible.has(e.id));
  const daysLeft = link && Math.round((new Date(link.expiresAt) - new Date(TODAY)) / 86400000);
  return (
    <div className={`landing${embedded ? ' embedded' : ''}`}>
      <header className="landing-bar">
        <Logo className="landing-logo" />
        <span className="lb-title">Transit Portfolio</span>
        <span className="spacer" />
        {!dead && <span className="lb-meta">Shared read-only by {map.student.name}</span>}
      </header>
      {!dead && gated ? (
        <form className="link-gate" onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) setReader(email.trim()); }}>
          <div className="tri" aria-hidden="true" />
          <h2>{map.student.name} asked for your email first</h2>
          <p>This link was shared with <b>{link.sharedWith || SHARED_WITH[token] || 'a named reader'}</b>. Your email is shown to {map.student.name.split(' ')[0]} next to the view, and nowhere else.</p>
          <label>Work email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@university.ac.uk" /></label>
          <button className="primary" disabled={!/^\S+@\S+\.\S+$/.test(email)}>Open the portfolio</button>
        </form>
      ) : dead ? (
        <div className="link-dead">
          <div className="tri" aria-hidden="true" />
          <h2>{!link ? 'This link does not exist' : link.revoked ? 'This link has been withdrawn' : 'This link has expired'}</h2>
          <p>{!link ? 'Check the address, or ask the student for a new link.' : 'The student controls who can read their portfolio. Ask them for a new link.'}</p>
        </div>
      ) : (
        <>
          <div className="landing-banner">
            <span><b>Shared with:</b> {link.sharedWith || SHARED_WITH[token] || 'Anyone with the link'}</span>
            <span className={daysLeft < 21 ? 'soon' : ''}><b>Expires</b> {fmtDate(link.expiresAt)} ({daysLeft} days)</span>
            <span>{link.views + extraViews(token)} views logged</span>
            <span className="spacer" />
            {!link.site && <div className="seg small" role="group" aria-label="Reading mode"><button className={view === 'full' ? 'on' : ''} aria-pressed={view === 'full'} onClick={() => setView('full')}>Full portfolio</button><button className={view === 'skim' ? 'on' : ''} aria-pressed={view === 'skim'} onClick={() => setView('skim')}>60-second view</button></div>}
            {!link.site && <PrintButton title={view === 'skim' ? docName(map.student.name, 'Portfolio summary') : presentationName(map.student.name, pres)} />}
            <button className="ghost" disabled={asked} onClick={() => { setAsked(true); notify(PERSONA_OF_STUDENT[pres.studentId], `${link.sharedWith || SHARED_WITH[token] || 'A viewer'} asked to extend link /s/${token}`, { persona: PERSONA_OF_STUDENT[pres.studentId], screen: 'links' }); }}>{asked ? 'Extension requested' : 'Request more time'}</button>
          </div>
          {link.site ? (
            <div className="landing-site">
              <iframe title={`${map.student.name}'s own site`} sandbox="allow-scripts" srcDoc={siteDoc(pres.site?.html ?? starterHtml(pres.id), exportPresentation(pres, map, lens))} />
              <p className="fineprint">Built by {map.student.name.split(' ')[0]} on the school’s read API. It can only show what {map.student.name.split(' ')[0]} made publishable.</p>
            </div>
          ) : <div className={`landing-body theme-${pres.theme}`}>
            <PrintHead kicker={view === 'skim' ? 'Portfolio summary' : 'Shared portfolio'} />
            <VerifyScope.Provider value>
              {view === 'skim' ? <Skim map={map} lens={lens} pres={pres} onOpen={setSelected} /> : <PresentationView map={map} lens={lens} pres={pres} selectedId={selected} onSelect={setSelected} />}
              <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly onAsk={(id, t) => askEvidence(id, reader || link.sharedWith || SHARED_WITH[token] || 'A reader', t)} />
            </VerifyScope.Provider>
          </div>}
          {!link.site && <PrintFooter name={map.student.name} verifyUrl={appUrl(`s/${token}`)} />}
          <footer className="landing-foot">Every badge links to its verification record, and printed codes can be typed in at <a href="#/v">/v</a>. Items appear only if the student made them publishable. Views of this link are logged.</footer>
        </>
      )}
    </div>
  );
}

const RANK = { 'school-verified': 3, 'teacher-endorsed': 3, 'student-added': 0 };
const BIG = { project: 2, competition: 2, award: 2, service: 1, assessment: 1 };

// E2: a skim layout for a busy admissions reader. Three highlights, one line per line, and a way into the evidence.
function Skim({ map, lens, pres, onOpen }) {
  const evs = map.events.filter((e) => lens.visible.has(e.id) && e.type !== 'goal' && e.type !== 'reflection');
  const score = (e) => RANK[e.verification] + (BIG[e.type] || 0) + e.endorsements.length * 2 + e.lineIds.length + (e.date >= '2025-08-01' ? 1 : 0);
  const top = [...evs].sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date)).slice(0, 3);
  const words = evs.reduce((n, e) => n + `${e.title} ${e.summary}`.split(/\s+/).length, 0);
  const verified = evs.filter((e) => e.verification !== 'student-added').length;
  const lines = map.lines.map((l) => ({ l, on: evs.filter((e) => e.lineIds.includes(l.id)) })).filter((x) => x.on.length);
  const yr = (d) => d.slice(0, 4);
  const mins = Math.max(1, Math.round(words / 200));
  return (
    <div className="skim">
      <div className="skim-head">
        <span className="pres-avatar" style={{ background: map.student.avatar.colour, color: inkOn(map.student.avatar.colour) }}>{map.student.avatar.initials}</span>
        <div>
          <h1>{map.student.name}</h1>
          <p>{pres.intro || pres.title}</p>
          <small>Year {map.student.grade + 1} · {map.student.programme} · {evs.length} stations, {verified} verified by the school or a teacher · the full portfolio reads in about {mins} minute{mins === 1 ? '' : 's'}</small>
        </div>
      </div>
      <h2 className="skim-h">Three highlights</h2>
      <div className="skim-top">{top.map((e, i) => (
        <article key={e.id} className="skim-card">
          <span className="skim-n">{i + 1}</span>
          <b>{e.title}</b>
          <small>{TYPE_LABEL[e.type]} · {fmtDate(e.date)}</small>
          <p>{e.summary}</p>
          {e.endorsements[0] && <blockquote>“{e.endorsements[0].note}” <cite>{e.endorsements[0].teacher?.name}</cite></blockquote>}
          <div className="skim-foot"><VerifyBadge level={e.verification} event={e} /><button className="linkish" onClick={() => onOpen(e.id)}>See the evidence</button></div>
          <div className="print-only skim-qr"><Qr text={appUrl(`v/${verifyCode(e.id)}`)} size={64} /><span>Verify: {verifyCode(e.id)}</span></div>
        </article>
      ))}</div>
      <h2 className="skim-h">Each line in one sentence</h2>
      <ul className="skim-lines">{lines.map(({ l, on }) => (
        <li key={l.id} style={{ '--c': l.colour }}>
          <i aria-hidden="true" />
          <span><b>{l.name}</b> {yr(on[0].date) === yr(on.at(-1).date) ? yr(on[0].date) : `${yr(on[0].date)}–${yr(on.at(-1).date)}`} · {on.length} station{on.length === 1 ? '' : 's'}{l.status === 'ended' ? ' · ended' : ''}. Most recent: <button className="linkish" onClick={() => onOpen(on.at(-1).id)}>{on.at(-1).title}</button></span>
        </li>
      ))}</ul>
    </div>
  );
}
