import { getClasses, getSchoolLines, setSubjectLine, snapshot, subjectsOffLines } from '../api.js';
import './classes.css';

// Pilot: subjects the class lists left off every line. A coordinator or admin picks a school line for each,
// or leaves it off the map; every class of the subject follows, and later imports remember it.
export default function SubjectLines({ toast }) {
  if (!getClasses().length) return null;
  const rows = subjectsOffLines();
  const lines = getSchoolLines();
  const waiting = rows.filter((r) => !r.decided).length;
  const pick = (r, v) => {
    const snap = snapshot();
    const lineId = v === 'off' ? null : v;
    const n = setSubjectLine(r.subject, lineId);
    toast(lineId ? `${r.subject}: ${n} ${n === 1 ? 'class' : 'classes'} now on ${lines.find((l) => l.id === lineId)?.name}` : `${r.subject} stays off the map`, snap);
  };
  return (
    <section className="card-sec sl" aria-labelledby="sl-h">
      <h3 id="sl-h">Subjects and lines</h3>
      <p className="fineprint">{waiting ? `${waiting} ${waiting === 1 ? 'subject has' : 'subjects have'} classes on no line, so their moments have nowhere to go on students’ maps.` : 'Every subject is on a line or left off the map on purpose.'} A choice applies to every class of that subject, and to new classes in later imports.</p>
      {rows.length > 0 && (
        <table className="sl-table">
          <thead><tr><th>Subject</th><th>Classes</th><th>Line</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subject}>
                <td>{r.subject}</td>
                <td>{r.classes}</td>
                <td>
                  <select aria-label={`Line for ${r.subject}`} value={r.decided ? r.lineId || 'off' : ''} onChange={(e) => e.target.value && pick(r, e.target.value)}>
                    {!r.decided && <option value="">Choose a line…</option>}
                    {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    <option value="off">Leave off the map</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
