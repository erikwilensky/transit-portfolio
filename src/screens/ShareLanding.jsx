import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLens, extraViews, getStudentMap, notify, recordView, TODAY, PERSONA_OF_STUDENT } from '../api.js';
import { fmtDate } from '../format.js';
import PresentationView from '../components/PresentationView.jsx';
import StationPanel from '../components/StationPanel.jsx';
import Logo from '../components/Logo.jsx';
import { VerifyScope } from '../components/VerifyModal.jsx';

const SHARED_WITH = { 'tp-nb7d': 'Northbridge University admissions', 'tp-u8k4': 'University applications', 'tp-c7m1': 'Anyone with the link' };

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

  useEffect(() => {
    if (!counted.current && link && !dead) { counted.current = true; recordView(token, pres.studentId, embedded ? 'Northbridge University admissions' : 'Anonymous viewer'); try { new BroadcastChannel('tp-views').postMessage({ token }); } catch { /* not supported */ } }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {dead ? (
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
            <button className="ghost" disabled={asked} onClick={() => { setAsked(true); notify(PERSONA_OF_STUDENT[pres.studentId], `${link.sharedWith || SHARED_WITH[token] || 'A viewer'} asked to extend link /s/${token}`, { persona: PERSONA_OF_STUDENT[pres.studentId], screen: 'links' }); }}>{asked ? 'Extension requested' : 'Request more time'}</button>
          </div>
          <div className={`landing-body theme-${pres.theme}`}>
            <VerifyScope.Provider value>
              <PresentationView map={map} lens={lens} pres={pres} selectedId={selected} onSelect={setSelected} />
              <StationPanel event={event} map={map} onClose={() => setSelected(null)} readOnly />
            </VerifyScope.Provider>
          </div>
          <footer className="landing-foot">Every badge links to its verification record. Items appear only if the student made them publishable. Views of this link are logged.</footer>
        </>
      )}
    </div>
  );
}
