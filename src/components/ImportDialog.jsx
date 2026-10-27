import { useMemo, useState } from 'react';
import { getAllLines, getStudents, importCandidates, TODAY } from '../api.js';
import { FORMATS, formatById, detectFormat, parseImport, templateCsv } from '../imports/index.js';
import { DropZone, PreviewTable, readFiles, downloadText, readyOf } from './ImportPreview.jsx';

// A student brings their own records: our spreadsheet template or a calendar (.ics).
// Everything arrives as student-added, in their own inbox, like any other import.
export default function ImportDialog({ student, onClose, toast }) {
  const first = student.name.split(' ')[0];
  const [fmt, setFmt] = useState('generic');
  const [files, setFiles] = useState(null);
  const f = formatById(fmt);
  const ctx = useMemo(() => ({ students: getStudents({ includeCohort: true }), lines: getAllLines(), today: TODAY, selfId: student.id }), [student.id]);
  const result = useMemo(() => (files ? parseImport(fmt, files, ctx) : null), [files, fmt, ctx]);
  const ready = result ? readyOf(result) : [];
  const take = async (list) => { const got = await readFiles(list); const d = detectFormat(got[0]?.name, got[0]?.text || ''); if (d === 'ics' || d === 'generic') setFmt(d); setFiles(got); };
  const confirm = () => {
    const r = importCandidates(ready, { sourceId: 'mine', by: { name: student.name, studentId: student.id }, file: files.map((x) => x.name).join(', ') });
    toast(r.added ? `${r.added} item${r.added === 1 ? '' : 's'} in ${first}'s inbox` : 'Nothing new in that file');
    onClose(r);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal imp-dlg" role="dialog" aria-label="Import a file" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Import a file</div>
        <h2>Bring in your own records</h2>
        <p className="fineprint">Items land in your inbox as student-added. You choose where each one goes, or skip it. Ask a teacher to endorse anything you want verified.</p>
        <div className="imp-formats two" role="radiogroup" aria-label="Kind of file">
          {FORMATS.filter((x) => x.student).map((x) => (
            <button key={x.id} role="radio" aria-checked={fmt === x.id} className={`imp-format${fmt === x.id ? ' on' : ''}`} onClick={() => { setFmt(x.id); setFiles(null); }}>
              <b>{x.id === 'generic' ? 'Spreadsheet (.csv)' : x.label}</b><small>{x.id === 'generic' ? 'One row per item: title, date, type, summary, link.' : 'Fixtures, rehearsals or trips from your calendar.'}</small>
            </button>
          ))}
        </div>
        {fmt === 'generic' && <p className="fineprint"><button className="linkish" onClick={() => downloadText('my-records-template.csv', templateCsv())}>Download the template</button> and leave the student column blank.</p>}
        {!files ? <DropZone accept={`${f.accept}`} hint={f.accept} onFiles={take} /> : (
          <>
            <div className="imp-file"><span><b>{files.map((x) => x.name).join(', ')}</b><small>{result.counts.ready} ready · {result.counts.problems} with a problem</small></span><button className="ghost" onClick={() => setFiles(null)}>Choose another</button></div>
            {result.problems.map((p) => <p key={p} className="imp-flag bad block">{p}</p>)}
            {result.items.length > 0 && <PreviewTable result={result} showStudent={false} />}
          </>
        )}
        <div className="composer-foot">
          <span className="spacer" />
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!ready.length} onClick={confirm}>{ready.length ? `Add ${ready.length} to my inbox` : 'Add to my inbox'}</button>
        </div>
      </div>
    </div>
  );
}
