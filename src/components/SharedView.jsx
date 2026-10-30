import { useMemo, useState } from 'react';
import { applyLens, TODAY } from '../api.js';
import { appUrl, fmtDate } from '../format.js';
import PresentationView from './PresentationView.jsx';
import StationPanel from './StationPanel.jsx';
import { VerifyScope } from './VerifyModal.jsx';
import { PrintButton, PrintFooter, PrintHead } from './PrintKit.jsx';
import { presentationName } from '../print.js';

export default function SharedView({ publicMap, drafts, links }) {
  const [token, setToken] = useState(links.find((l) => !l.revoked)?.token || links[0]?.token);
  const link = links.find((l) => l.token === token);
  const pres = drafts.find((p) => p.id === link?.presentationId);
  const lens = useMemo(() => pres && applyLens(publicMap, pres, { hiddenLines: pres.filters.hiddenLines }), [publicMap, pres]);
  const [selected, setSelected] = useState(null);
  const expired = link && link.expiresAt < TODAY;
  const event = lens && publicMap.events.find((e) => e.id === selected && lens.visible.has(e.id));

  if (!links.length) return <div className="empty">No share links yet. Create one in the Presentation studio.</div>;
  return (
    <div className="shared">
      <div className="shared-picker">
        <label htmlFor="link-pick">Viewing link</label>
        <select id="link-pick" value={token} onChange={(e) => { setToken(e.target.value); setSelected(null); }}>
          {links.map((l) => {
            const p = drafts.find((d) => d.id === l.presentationId);
            return <option key={l.token} value={l.token}>{p?.title} ({l.revoked ? 'revoked' : l.expiresAt < TODAY ? 'expired' : `expires ${fmtDate(l.expiresAt)}`})</option>;
          })}
        </select>
        <span className="fineprint">This is what an external viewer sees: read-only, publishable items only.</span>
        {pres && !link.revoked && !expired && <PrintButton title={presentationName(publicMap.student.name, pres)} />}
      </div>
      <div className="browser">
        <div className="browser-bar">
          <span className="dots"><i /><i /><i /></span>
          <span className="url">portfolio.school.example/s/{link.token}</span>
        </div>
        {link.revoked || expired ? (
          <div className="link-dead">
            <h2>{link.revoked ? 'This link has been revoked' : 'This link has expired'}</h2>
            <p>The student has withdrawn access. Ask them for a new link.</p>
          </div>
        ) : (
          <div className={`browser-body theme-${pres.theme}`} translate="no" lang="en">
            <div className="share-note">
              <span>Shared read-only by {publicMap.student.name}</span>
              <span>Link expires {fmtDate(link.expiresAt)}</span>
              <span>{link.views} views logged</span>
            </div>
            <PrintHead kicker="Shared portfolio" />
            <VerifyScope.Provider value><PresentationView map={publicMap} lens={lens} pres={pres} selectedId={selected} onSelect={setSelected} />
            <StationPanel event={event} map={publicMap} onClose={() => setSelected(null)} readOnly /></VerifyScope.Provider>
            <PrintFooter name={publicMap.student.name} verifyUrl={appUrl(`s/${link.token}`)} />
          </div>
        )}
      </div>
    </div>
  );
}
