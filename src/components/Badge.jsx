import { VERIFY_LABEL, VERIFY_HELP } from '../format.js';
import { useContext } from 'react';
import { useVerify, VerifyScope } from './VerifyModal.jsx';
import { useT } from '../i18n.js';
export function VerifyBadge({ level, large = false, event, verifiable }) {
  const open = useVerify();
  const t = useT();
  const scoped = useContext(VerifyScope);
  if (event && (verifiable ?? scoped) && open) {
    return (
      <button type="button" className={`vbadge vbadge-${level}${large ? ' large' : ''} as-btn`} title={t('See the verification record')} onClick={(ev) => { ev.stopPropagation(); open(event.id); }}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2" className={`vmark ${level === 'school-verified' ? 'vmark-solid' : level === 'teacher-endorsed' ? 'vmark-outline' : 'vmark-dotted'}`} /></svg>
        {t(VERIFY_LABEL[level])} <span className="vb-check">{t('Verify')}</span>
      </button>
    );
  }
  return (
    <span className={`vbadge vbadge-${level}${large ? ' large' : ''}`} title={t(VERIFY_HELP[level])}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2" className={`vmark ${level === 'school-verified' ? 'vmark-solid' : level === 'teacher-endorsed' ? 'vmark-outline' : 'vmark-dotted'}`} /></svg>
      {t(VERIFY_LABEL[level])}
    </span>
  );
}
export function VerifyLegend() {
  return (
    <div className="legend" aria-label="Verification legend">
      {['school-verified', 'teacher-endorsed', 'student-added'].map((l) => <VerifyBadge key={l} level={l} />)}
    </div>
  );
}
export function MapLegend() {
  return (
    <div className="legend map-legend" aria-label="Map legend">
      <span><svg width="26" height="12"><line x1="2" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><circle cx="13" cy="6" r="4" className="stop" stroke="currentColor" strokeWidth="2" /></svg>Station</span>
      <span><svg width="18" height="22"><rect x="4" y="2" width="10" height="18" rx="5" className="interchange" /></svg>Interchange</span>
      <span><svg width="26" height="12"><line x1="2" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="5" strokeDasharray="6 5" /></svg>Planned</span>
      <span><svg width="26" height="16" style={{ opacity: 0.45 }}><line x1="2" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="5" /><line x1="21" y1="2" x2="21" y2="14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>Ended</span>
      <span><svg width="12" height="20" className="signal-legend"><g className="signal" transform="translate(6 17)"><line x1="0" y1="2" x2="0" y2="-6" /><rect x="-4" y="-15" width="8" height="11" rx="3" /><circle cx="0" cy="-11.5" r="1.8" className="signal-lamp" /><circle cx="0" cy="-7.5" r="1.8" className="signal-lamp2" /></g></svg>Reflection signal</span>
    </div>
  );
}
