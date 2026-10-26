import { setVisibility, snapshot } from '../api.js';
import { fmtDate, VIS_LABEL } from '../format.js';

// N11: before a link goes out, list what this presentation would show but cannot, because it is not publishable.
export default function ShareGaps({ pres, gaps, lines, onShare, onClose, toast }) {
  const fixAll = () => { const snap = snapshot(); gaps.forEach((e) => setVisibility(e.id, 'publishable')); toast(`${gaps.length} station${gaps.length === 1 ? '' : 's'} made publishable`, snap); };
  const colour = (e) => lines.find((l) => l.id === e.lineIds[0])?.colour;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal gaps-dlg" role="dialog" aria-label="Before you share" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Before you share “{pres.title}”</div>
        {gaps.length ? (
          <>
            <h2>{gaps.length} station{gaps.length === 1 ? '' : 's'} won’t be in this link</h2>
            <p>This presentation would include them, but readers outside the school only see publishable stations. Make any of them publishable now, or share without them.</p>
            <ul className="gap-list">{gaps.map((e) => (
              <li key={e.id}>
                <i style={{ background: colour(e) }} />
                <span><b>{e.title}</b><small>{fmtDate(e.date)} · now <span className={`vis vis-${e.visibility}`}>{VIS_LABEL[e.visibility]}</span></small></span>
                <button className="ghost small-btn" onClick={() => { const snap = snapshot(); setVisibility(e.id, 'publishable'); toast(`“${e.title}” is now publishable`, snap); }}>Make publishable</button>
              </li>
            ))}</ul>
            {gaps.some((e) => e.visibility === 'private') && <p className="fineprint">Private stations are ones you kept to yourself. Only publish them if you are happy for this reader to see them.</p>}
            <div className="composer-foot">
              <button className="ghost" onClick={() => onShare(true)}>Share without them</button>
              {gaps.length > 1 && <button className="ghost" onClick={fixAll}>Make all {gaps.length} publishable</button>}
            </div>
          </>
        ) : (
          <>
            <h2>Everything this presentation shows is publishable</h2>
            <p>The reader will see the whole story you built.</p>
            <div className="composer-foot"><button className="primary" onClick={() => onShare(true)}>Create share link</button></div>
          </>
        )}
      </div>
    </div>
  );
}
