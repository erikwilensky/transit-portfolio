import { useState } from 'react';
import { addSchoolLine, decideBranch, getAllLines, getLine, getSchoolLines, getStore, getStudent, lineUse, renameLine } from '../api.js';
import { fmtDate } from '../format.js';

// Colours a school line may use: the brand palette plus a few harmonised extras.
const SWATCHES = ['#002855', '#4F529B', '#78D5E1', '#008A60', '#E73C3E', '#FF8F1C', '#FFB81C'];
const MAX = 10;
const tidy = (s) => s.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// K4: the coordinator keeps the school line list short and approves the sub-lines students name.
export default function Governance({ toast, version }) {
  const lines = getSchoolLines();
  const pending = getAllLines().filter((l) => l.studentId && l.approval === 'pending');
  const approved = getAllLines().filter((l) => l.studentId && l.approval !== 'pending');
  const [colourFor, setColourFor] = useState(null);
  const [names, setNames] = useState({});
  const [adding, setAdding] = useState(null);
  const [mergeTo, setMergeTo] = useState({});
  const firstOf = (id) => getStore().events.filter((e) => e.lineIds.includes(id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="page gov">
      <header className="page-head">
        <div>
          <div className="kicker">Line governance</div>
          <h1>The school’s lines</h1>
          <p>School lines are fixed and few, so maps stay comparable. Students name their own sub-lines beneath them, and you approve the name or fold it into an existing line.</p>
        </div>
        <div className="meter">
          <div><b>{lines.length}/{MAX}</b><span>school lines</span></div>
          <div><b>{pending.length}</b><span>sub-lines waiting</span></div>
          <div><b>{approved.length}</b><span>approved sub-lines</span></div>
        </div>
      </header>

      <section className="card-sec gov-pending">
        <h3>Waiting for you</h3>
        {!pending.length && <p className="fineprint">Nothing waiting. New sub-lines from students appear here.</p>}
        {pending.map((l) => {
          const s = getStudent(l.studentId), parent = getLine(l.parentLineId), first = firstOf(l.id);
          const name = names[l.id] ?? l.name;
          const siblings = approved.filter((x) => x.parentLineId === l.parentLineId);
          const target = mergeTo[l.id] || l.parentLineId;
          return (
            <div key={l.id} className="gov-req">
              <span className="gov-branch" style={{ '--p': parent.colour, '--c': l.colour }} aria-hidden="true" />
              <div className="gov-main">
                <label className="gov-name">Sub-line name<input value={name} onChange={(e) => setNames({ ...names, [l.id]: e.target.value })} /></label>
                {name !== tidy(name) && <button className="linkish" onClick={() => setNames({ ...names, [l.id]: tidy(name) })}>Tidy to “{tidy(name)}”</button>}
                <small>{s.name}, Year {s.grade + 1} · under {parent.name} · asked {fmtDate(l.requestedOn || '2026-10-26')}{first ? ` · first station “${first.title}”` : ''}</small>
              </div>
              <div className="gov-act">
                <button className="primary" onClick={() => { if (name !== l.name) renameLine(l.id, { name: name.trim() }); decideBranch(l.id, true); toast(`Approved “${name.trim()}” for ${s.name.split(' ')[0]}`); }}>Approve</button>
                <div className="gov-merge">
                  <select aria-label="Fold into" value={target} onChange={(e) => setMergeTo({ ...mergeTo, [l.id]: e.target.value })}>
                    <option value={l.parentLineId}>{parent.name} (no sub-line)</option>
                    {siblings.map((x) => <option key={x.id} value={x.id} disabled={x.studentId !== l.studentId}>{x.name}{x.studentId !== l.studentId ? ` (${getStudent(x.studentId).name.split(' ')[0]}’s)` : ''}</option>)}
                  </select>
                  <button className="ghost" onClick={() => { decideBranch(l.id, false, target); toast(`Folded “${l.name}” into ${getLine(target).name}`); }}>Fold in</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card-sec">
        <h3>School lines</h3>
        <table className="health gov-table">
          <thead><tr><th>Colour</th><th>Name</th><th>Students</th><th>Stations</th><th>Sub-lines</th></tr></thead>
          <tbody>{lines.map((l) => { const u = lineUse(l.id); return (
            <tr key={l.id}>
              <td className="gov-sw-cell">
                <button className="gov-sw" style={{ background: l.colour }} aria-label={`Change colour of ${l.name}`} aria-expanded={colourFor === l.id} onClick={() => setColourFor(colourFor === l.id ? null : l.id)} />
                {colourFor === l.id && <div className="gov-pal" role="group" aria-label="Colours">{SWATCHES.map((c) => { const used = lines.find((x) => x.colour === c && x.id !== l.id); return <button key={c} style={{ background: c }} disabled={!!used} title={used ? `Used by ${used.name}` : c} aria-label={used ? `${c}, used by ${used.name}` : c} onClick={() => { renameLine(l.id, { colour: c }); setColourFor(null); }} />; })}</div>}
              </td>
              <td><input className="gov-in" defaultValue={l.name} aria-label={`Name of ${l.name}`} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== l.name) { renameLine(l.id, { name: v }); toast(`Renamed to ${v} on every map`); } }} /></td>
              <td>{u.students}</td><td>{u.stations}</td><td>{u.subLines}</td>
            </tr>
          ); })}</tbody>
        </table>
        {adding ? (
          <form className="gov-add" onSubmit={(e) => { e.preventDefault(); const l = addSchoolLine(adding.trim(), SWATCHES.find((c) => !lines.some((x) => x.colour === c))); if (l) { toast(`Added the ${l.name} line`); setAdding(null); } }}>
            <input autoFocus value={adding} placeholder="Line name, e.g. Entrepreneurship" onChange={(e) => setAdding(e.target.value)} />
            <button className="primary" disabled={!adding.trim()}>Add line</button><button type="button" className="ghost" onClick={() => setAdding(null)}>Cancel</button>
          </form>
        ) : <button className="ghost gov-addbtn" disabled={lines.length >= MAX} onClick={() => setAdding('')}>{lines.length >= MAX ? `The school has ${MAX} lines, the most allowed` : 'Add a school line'}</button>}
        <p className="fineprint">Renaming or recolouring a line changes it on every student’s map at once. The limit of {MAX} keeps maps readable.</p>
      </section>

      {approved.length > 0 && (
        <section className="card-sec">
          <h3>Approved sub-lines</h3>
          <div className="chips">{approved.map((l) => <span key={l.id} className="line-chip static" style={{ '--c': l.colour }}><i className={l.pattern === 'cased' ? 'cased' : undefined} />{l.name} <small>{getStudent(l.studentId).name.split(' ')[0]} · {getLine(l.parentLineId).name}</small></span>)}</div>
        </section>
      )}
    </div>
  );
}
