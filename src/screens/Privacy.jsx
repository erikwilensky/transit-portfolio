import { useMemo, useState } from 'react';
import { applyLens, consentOnFile, exportRecord, getPrivacy, remindParent, getStudentMap, setPrivacy, setVisibility, TODAY } from '../api.js';
import { VIS_LABEL } from '../format.js';

const VIEWERS = [['advisor', 'My advisor'], ['school', 'School staff'], ['public', 'Anyone with a link']];
const count = (m) => ({ st: m.events.length, rf: m.events.reduce((n, e) => n + e.reflections.length, 0) + m.events.filter((e) => e.type === 'reflection').length });
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// S11 + X2 + S8: what each viewer can read, the defaults, and leaving with your own record.
export default function Privacy({ studentId, drafts, toast, go, persona, version }) {
  const me = useMemo(() => getStudentMap(studentId, 'student'), [studentId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = getPrivacy(studentId);
  const [done, setDone] = useState(null);
  const s = me.student;
  const consent = consentOnFile(s.id) ? 'on-file' : 'pending';
  const mine = count(me);
  const lineVis = (id) => { const v = [...new Set(me.events.filter((e) => e.lineIds.includes(id) && e.type !== 'goal').map((e) => e.visibility))]; return v.length === 1 ? v[0] : 'mixed'; };
  const setLine = (id, vis) => { me.events.filter((e) => e.lineIds.includes(id) && e.type !== 'goal').forEach((e) => setVisibility(e.id, vis)); toast(`Every station on ${me.lines.find((l) => l.id === id).name} is now ${VIS_LABEL[vis].toLowerCase()}.`); };
  const exportJson = () => { download(`${s.name.replace(/\s+/g, '-').toLowerCase()}-record.json`, JSON.stringify(exportRecord(studentId), null, 2), 'application/json'); setDone('json'); };
  const exportHtml = () => {
    const pub = getStudentMap(studentId, 'public');
    const body = drafts.map((d) => { const L = applyLens(pub, d, { hiddenLines: d.filters?.hiddenLines || [] }); return `<section><h2>${esc(d.title)}</h2><p><i>${esc(d.audience)}${d.targetName ? ` · ${esc(d.targetName)}` : ''}</i></p><ul>${pub.events.filter((e) => L.visible.has(e.id)).map((e) => `<li><b>${esc(e.title)}</b> (${e.date}) · ${esc(e.verification)}<br>${esc(e.summary)}</li>`).join('')}</ul></section>`; }).join('');
    download(`${s.name.replace(/\s+/g, '-').toLowerCase()}-presentations.html`, `<!doctype html><meta charset="utf-8"><title>${esc(s.name)}: presentations</title><style>body{font:16px/1.5 Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#002855}section{border-top:3px solid #002855;margin-top:32px}</style><h1>${esc(s.name)}</h1><p>Exported from NIST Transit Portfolio on ${TODAY}.</p>${body}`, 'text/html');
    setDone('html');
  };

  return (
    <div className="page privacy">
      <header className="page-head">
        <div>
          <div className="kicker">Privacy centre</div>
          <h1>You decide who reads what</h1>
          <p>New items start advisor-only. Reflections start private. Nothing becomes public unless you make it publishable.</p>
        </div>
        <button className="ghost" onClick={() => go(persona.id, 'map')}>Preview on my map with “See as”</button>
      </header>

      <section className="pv-grid">
        <div className="card-sec pv-who">
          <h3>Who can see my map right now</h3>
          <table className="health">
            <thead><tr><th>Viewer</th><th>Stations</th><th>Reflections</th></tr></thead>
            <tbody>
              <tr><td>Me</td><td>{mine.st}</td><td>{mine.rf}</td></tr>
              {VIEWERS.map(([v, l]) => { const c = count(getStudentMap(studentId, v)); return <tr key={v}><td>{l}</td><td><Meter n={c.st} of={mine.st} /></td><td><Meter n={c.rf} of={mine.rf} /></td></tr>; })}
            </tbody>
          </table>
          <p className="fineprint">These limits are applied by the data core before anything reaches a screen, a share link or an export.</p>
        </div>

        <div className="card-sec pv-defaults">
          <h3>Defaults for new things</h3>
          {[['reflections', 'New reflections'], ['added', 'Stations I add'], ['imported', 'Items from school systems'], ['endedLines', 'Stations on a line I end']].map(([k, l]) => (
            <label key={k} className="pv-row"><span>{l}</span>
              <select value={p[k]} onChange={(e) => { setPrivacy(studentId, { [k]: e.target.value }); toast('Default saved.'); }}>{Object.entries(VIS_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </label>
          ))}
          <label className="pv-row"><span>New share links expire after</span>
            <select value={p.linkDays} onChange={(e) => setPrivacy(studentId, { linkDays: +e.target.value })}>{[14, 30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          </label>
        </div>

        <div className="card-sec pv-lines">
          <h3>By line</h3>
          <p className="fineprint">Set every station on a line at once. You can still change single stations on the map.</p>
          {me.lines.map((l) => { const v = lineVis(l.id); return (
            <label key={l.id} className="pv-row"><span className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name}{l.status === 'ended' ? ' (ended)' : ''}</span>
              <select value={v} onChange={(e) => setLine(l.id, e.target.value)}>{v === 'mixed' && <option value="mixed">Mixed</option>}{Object.entries(VIS_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            </label>
          ); })}
        </div>

        <div className="card-sec pv-consent">
          <h3>Consent</h3>
          {consent === 'pending'
            ? <><p><span className="status s-warn"><i>!</i>Waiting for a parent</span></p><p className="fineprint">Students in Years 7 to 9 need a parent's consent before anything can be made publishable. Until then, everything stays inside the school.</p><button className="ghost" onClick={() => { remindParent(s.id); toast('Reminder sent to your parent.'); }}>Send a reminder to my parent</button></>
            : <><p><span className="status s-ok"><i>✓</i>Parent consent on file</span></p><p className="fineprint">Recorded in the SIS when you joined. Under Thailand's PDPA you can ask the school to correct or delete your data at any time.</p></>}
        </div>

        <div className="card-sec pv-export">
          <h3>Take your map with you</h3>
          <p>When you graduate, or whenever you like, download your whole record. It is yours.</p>
          <div className="pv-btns">
            <button className="primary" onClick={exportJson}>Download my record (JSON)</button>
            <button className="ghost" onClick={exportHtml}>Download my presentations (HTML)</button>
          </div>
          {done && <p className="fineprint">{done === 'json' ? 'Saved: every station, line, reflection and endorsement, plus your activity log.' : 'Saved: a static copy of each presentation that works offline.'}</p>}
        </div>
      </section>
    </div>
  );
}
function Meter({ n, of }) {
  return <span className="mini-meter"><b>{n}</b><i style={{ '--w': `${of ? (100 * n) / of : 0}%` }} /></span>;
}
