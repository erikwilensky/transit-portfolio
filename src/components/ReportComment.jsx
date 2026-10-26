import { useState } from 'react';
import { getReportComment, saveReportComment, snapshot, TERM_START, TODAY } from '../api.js';
import { fmtDate } from '../format.js';

const LIMIT = 900;
const WEIGHT = { competition: 5, project: 5, award: 4, service: 4, cas: 3, assessment: 2, sport: 2, club: 1, class: 1 };
const RANK = { 'school-verified': 2, 'teacher-endorsed': 1, 'student-added': 0 };

// N5: a first draft written from this term's stations and shared reflections, prepared on the spot with no outside calls.
// Each claim carries a citation number that points back to a station.
export function draftComment(map) {
  const first = map.student.name.split(' ')[0];
  const term = map.events.filter((e) => e.date >= TERM_START && e.date <= TODAY && e.type !== 'goal');
  const stations = term.filter((e) => e.type !== 'reflection').sort((a, b) => (WEIGHT[b.type] || 1) + RANK[b.verification] - ((WEIGHT[a.type] || 1) + RANK[a.verification]));
  const cites = [];
  const cite = (e) => { let i = cites.findIndex((c) => c.id === e.id); if (i < 0) { cites.push(e); i = cites.length - 1; } return `[${i + 1}]`; };
  const lineName = (id) => map.lines.find((l) => l.id === id)?.name.split(' ·')[0].toLowerCase();
  const out = [];
  if (!stations.length) out.push(`${first} has had a quieter term on the map, and we have talked about what to add next.`);
  else {
    const [top, second] = stations;
    const nLines = new Set(stations.flatMap((e) => e.lineIds)).size;
    out.push(`${first} has had a ${stations.length >= 4 ? 'busy' : 'steady'} term, with ${stations.length} new station${stations.length > 1 ? 's' : ''} on the map${nLines > 1 ? ` across ${nLines} lines` : ''}.`);
    out.push(`The highlight was “${top.title}”${top.lineIds.length > 1 ? `, which brought together ${top.lineIds.map(lineName).join(' and ')}` : ''} ${cite(top)}.`);
    if (second) out.push(`${first} also ${second.type === 'competition' ? 'competed in' : second.type === 'service' || second.lineIds.includes('service') ? 'gave time to' : 'made progress on'} “${second.title}” ${cite(second)}.`);
  }
  const refl = term.flatMap((e) => (e.reflections || []).map((r) => ({ e, r }))).concat(term.filter((e) => e.type === 'reflection').map((e) => ({ e, r: { text: e.summary } })));
  // Quote one whole sentence from a shared reflection, never a heading or a fragment.
  const quote = refl.map(({ e, r }) => ({ e, line: (r.text || '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).find((x) => x.length >= 40 && x.length <= 170 && /[.!?]$/.test(x)) })).find((q) => q.line);
  if (quote) out.push(`In a reflection this term, ${first} wrote: “${quote.line.replace(/[.!?]$/, '')}” ${cite(quote.e)}. That kind of honest look back is worth building on.`);
  const goal = map.events.find((e) => e.type === 'goal' && e.date > TODAY);
  if (goal) out.push(`Next, ${first} is working towards “${goal.title.replace(/^Target: /, '')}” by ${fmtDate(goal.date)} ${cite(goal)}.`);
  out.push(`I look forward to seeing where ${first}’s map goes next.`);
  return { text: out.join(' '), cites: cites.map((e) => e.id) };
}

export default function ReportComment({ map, persona, onClose, onOpen, toast }) {
  const sid = map.student.id;
  const saved = getReportComment(sid);
  const [text, setText] = useState(saved?.text || '');
  const [cites, setCites] = useState(saved?.cites || []);
  const first = map.student.name.split(' ')[0];
  const sent = saved?.status === 'sent';
  const draft = () => { const d = draftComment(map); setText(d.text); setCites(d.cites); };
  const used = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const evOf = (n) => map.events.find((e) => e.id === cites[n - 1]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal report-dlg" role="dialog" aria-label="End-of-term report comment" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">End-of-term report · Term 1, 2026–27</div>
        <h2>Advisor comment for {map.student.name}</h2>
        {!text && <div className="rc-empty"><p>Start from {first}’s stations and shared reflections this term. The draft is written here, from the record, and you edit every word.</p><button className="primary" onClick={draft}>Draft from {first}’s map</button></div>}
        {text && (
          <>
            <textarea className="rc-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} aria-label="Report comment" disabled={sent} />
            <div className="rc-meta"><span className={text.length > LIMIT ? 'over' : ''}>{text.length} / {LIMIT} characters (SIS limit)</span><button className="linkish" onClick={draft} disabled={sent}>Draft again</button></div>
            {cites.length > 0 && <ol className="rc-cites">{cites.map((id, i) => { const e = evOf(i + 1); return e && <li key={id} className={used.includes(i + 1) ? '' : 'unused'}><button className="linkish" onClick={() => onOpen(e.id)}>{e.title}</button> <small>{fmtDate(e.date)}{used.includes(i + 1) ? '' : ' · no longer cited'}</small></li>; })}</ol>}
            <p className="fineprint">Citation numbers stay in your copy here and are removed in the SIS, where parents read the comment.</p>
            <div className="composer-foot">
              {sent ? <><span className="status s-ok"><i>✓</i>Sent to the SIS {fmtDate(saved.sentAt.slice(0, 10))}</span><button className="ghost" onClick={() => saveReportComment(sid, { status: 'draft' }, persona.name)}>Reopen to edit</button></>
                : <>
                  <button className="ghost" onClick={() => { saveReportComment(sid, { text, cites, status: 'draft' }, persona.name); toast('Draft saved'); }}>Save draft</button>
                  <button className="primary" disabled={text.length > LIMIT || text.length < 40} onClick={() => { const snap = snapshot(); saveReportComment(sid, { text, cites, status: 'sent', sentAt: new Date().toISOString(), sisText: text.replace(/\s*\[\d+\]/g, '') }, persona.name); toast(`Sent to the SIS. ${first} has been told.`, snap); }}>Send to the SIS</button>
                </>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
