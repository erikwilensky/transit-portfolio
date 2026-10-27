import { useMemo, useState } from 'react';
import { getAllLines, getStudent, getStudents, importCandidates, PERSONA_OF_STUDENT, TODAY } from '../api.js';
import { FORMATS, formatById, detectFormat, parseImport, templateCsv } from '../imports/index.js';
import { toCsv } from '../imports/csv.js';
import { DropZone, PreviewTable, readFiles, downloadText, readyOf } from '../components/ImportPreview.jsx';
import sampleCas from '../imports/fixtures/managebac-cas.csv?raw';
import sampleTasks from '../imports/fixtures/managebac-tasks.csv?raw';
import sampleGrades from '../imports/fixtures/classroom-grades.csv?raw';
import sampleGeneric from '../imports/fixtures/generic.csv?raw';
import sampleIcs from '../imports/fixtures/fixtures.ics?raw';
import sampleCourse from '../imports/fixtures/takeout/Grade 10 Biology.json?raw';
import sampleSubs from '../imports/fixtures/takeout/submissions.json?raw';

const SAMPLES = {
  'mb-cas': [{ name: 'cas-experiences-sample.csv', text: sampleCas }],
  'mb-tasks': [{ name: 'tasks-sample.csv', text: sampleTasks }],
  'gc-grades': [{ name: 'Grade 10 Biology grades.csv', text: sampleGrades }],
  'gc-takeout': [{ name: 'Grade 10 Biology.json', text: sampleCourse }, { name: 'submissions.json', text: sampleSubs }],
  generic: [{ name: 'items-sample.csv', text: sampleGeneric }],
  ics: [{ name: 'fixtures-sample.ics', text: sampleIcs }],
};

// Staff bring the export files they can already download. Every item lands in a student's inbox,
// and the student decides where it goes on the map (or skips it).
export default function ImportFile({ persona, go, toast }) {
  const [fmt, setFmt] = useState(persona.kind === 'coordinator' ? 'mb-cas' : 'mb-tasks');
  const [files, setFiles] = useState(null);
  const [picked, setPicked] = useState([]);
  const [done, setDone] = useState(null);
  const f = formatById(fmt);
  const ctx = useMemo(() => ({ students: getStudents({ includeCohort: true }), lines: getAllLines(), today: TODAY, by: { name: persona.name, teacherId: persona.teacherId }, forStudentIds: picked }), [persona, picked]);
  const result = useMemo(() => (files ? parseImport(fmt, files, ctx) : null), [files, fmt, ctx]);
  const detected = files && files.length && detectFormat(files[0].name, files[0].text);
  const ready = result ? readyOf(result) : [];
  const needsPeople = fmt === 'ics' && result?.items.some((i) => /choose students/.test(i.problem || ''));
  const reset = () => { setFiles(null); setDone(null); setPicked([]); };

  const confirm = () => {
    const r = importCandidates(ready, { sourceId: result.sourceId, by: { name: persona.name, teacherId: persona.teacherId, persona: persona.id }, file: files.map((x) => x.name).join(', ') });
    setDone({ ...r, file: files.map((x) => x.name).join(', ') });
    toast(`${r.added} item${r.added === 1 ? '' : 's'} sent to ${r.students} inbox${r.students === 1 ? '' : 'es'}`);
  };
  const problemsCsv = () => toCsv([['row', 'what', 'problem'], ...result.items.filter((i) => i.problem).map((i) => [i.row, i.label, i.problem])]);

  if (done) return (
    <div className="page imp">
      <header className="page-head"><div><div className="kicker">Import a file</div><h1>Done: {done.added} item{done.added === 1 ? '' : 's'} in {done.students} inbox{done.students === 1 ? '' : 'es'}</h1>
        <p>Each student has been told. Nothing is on anyone’s map until they accept it and choose the line.</p></div></header>
      <section className="card-sec imp-done">
        <ul className="imp-done-list">
          {Object.entries(done.byStudent).map(([sid, n]) => {
            const s = getStudent(sid); const p = PERSONA_OF_STUDENT[sid];
            return <li key={sid}><span><b>{s.name}</b><small>{n} new in the inbox</small></span>{p && <button className="ghost" onClick={() => go(p, 'inbox')}>Open {s.name.split(' ')[0]}’s inbox</button>}</li>;
          })}
        </ul>
        {(done.duplicates > 0 || done.refused > 0) && <p className="fineprint">{done.duplicates > 0 && `${done.duplicates} already imported, so left alone. `}{done.refused > 0 && `${done.refused} could not be added.`}</p>}
        <div className="composer-foot"><button className="primary" onClick={reset}>Import another file</button></div>
      </section>
    </div>
  );

  return (
    <div className="page imp">
      <header className="page-head">
        <div>
          <div className="kicker">Import a file</div>
          <h1>Bring in records from a school system</h1>
          <p>Use the export files you can already download. Each row goes to the student’s inbox, and they choose where it goes on their map. Rows we cannot match to a student are listed, never guessed.</p>
        </div>
      </header>

      <section className="card-sec imp-step">
        <h3><span className="imp-n">1</span>Where is the file from?</h3>
        <div className="imp-formats" role="radiogroup" aria-label="Where the file is from">
          {FORMATS.filter((x) => x.staff).map((x) => (
            <button key={x.id} role="radio" aria-checked={fmt === x.id} className={`imp-format${fmt === x.id ? ' on' : ''}`} onClick={() => { setFmt(x.id); setPicked([]); }}>
              <b>{x.label}</b><small>{x.help}</small>
            </button>
          ))}
        </div>
        {fmt === 'generic' && <p className="fineprint imp-tpl">Starting from scratch? <button className="linkish" onClick={() => downloadText('transit-portfolio-template.csv', templateCsv())}>Download the template</button> (opens in Excel, Numbers or Google Sheets).</p>}
      </section>

      <section className="card-sec imp-step">
        <h3><span className="imp-n">2</span>Add the file</h3>
        {!files ? (
          <>
            <DropZone accept={f.accept} multiple={!!f.multiple} hint={`${f.accept} file${f.multiple ? 's' : ''} · ${f.help}`} onFiles={async (list) => setFiles(await readFiles(list))} />
            <p className="fineprint">No file to hand? <button className="linkish" onClick={() => setFiles(SAMPLES[fmt])}>Try a sample {f.label} file</button></p>
          </>
        ) : (
          <div className="imp-file">
            <span><b>{files.map((x) => x.name).join(', ')}</b><small>{result.counts.rows} row{result.counts.rows === 1 ? '' : 's'} read</small></span>
            <button className="ghost" onClick={reset}>Choose a different file</button>
          </div>
        )}
        {detected && detected !== fmt && <p className="imp-hint" role="note">This looks like a {formatById(detected).label} file. <button className="linkish" onClick={() => setFmt(detected)}>Read it as that</button></p>}
      </section>

      {result && (
        <section className="card-sec imp-step">
          <h3><span className="imp-n">3</span>Check what will be sent</h3>
          {result.problems.map((p) => <p key={p} className="imp-flag bad block">{p}</p>)}
          {fmt === 'ics' && (needsPeople || picked.length > 0) && (
            <div className="imp-people">
              <b>Who took part?</b> <small>The calendar does not list students for some events. Pick them, and you vouch that they took part.</small>
              <div className="chips">{getStudents({ includeCohort: true }).map((s) => (
                <button key={s.id} className={`imp-person${picked.includes(s.id) ? ' on' : ''}`} aria-pressed={picked.includes(s.id)} onClick={() => setPicked(picked.includes(s.id) ? picked.filter((x) => x !== s.id) : [...picked, s.id])}>{s.name}</button>
              ))}</div>
            </div>
          )}
          {result.items.length > 0 && (
            <>
              <div className="meter imp-meter">
                <div><b>{ready.length}</b><span>ready to send</span></div>
                <div><b>{new Set(ready.map((c) => c.studentId)).size}</b><span>students</span></div>
                <div><b>{result.counts.problems}</b><span>rows with a problem</span></div>
              </div>
              <PreviewTable result={result} />
            </>
          )}
          <div className="composer-foot">
            {result.counts.problems > 0 && <button className="ghost" onClick={() => downloadText('rows-with-problems.csv', problemsCsv())}>Download the problem rows</button>}
            <span className="spacer" />
            <button className="ghost" onClick={reset}>Cancel</button>
            <button className="primary" disabled={!ready.length} onClick={confirm}>{ready.length ? `Send ${ready.length} item${ready.length === 1 ? '' : 's'} to ${new Set(ready.map((c) => c.studentId)).size} inbox${new Set(ready.map((c) => c.studentId)).size === 1 ? '' : 'es'}` : 'Nothing to send'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
