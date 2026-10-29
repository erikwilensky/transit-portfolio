import { useState } from 'react';
import { admin } from '../auth.js';
import { parseRoster } from '../imports/roster.js';
import { toCsv } from '../imports/csv.js';
import { StartOfYear } from '../components/YearHandover.jsx';

const PARTS = [['teachers', 'Staff'], ['students', 'Students'], ['classes', 'Classes'], ['enrolments', 'Class places']];
const readAll = (files) => Promise.all([...files].map((f) => f.text().then((text) => ({ name: f.name, text }))));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Pilot admin: the school's class lists in, then a sign-in link for everyone with an email (docs/roster-format.md).
export default function RosterImport({ onDone, onClose, startOfYear = false }) {
  const [step, setStep] = useState({ at: 'pick' }); // pick → preview → done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pause, setPause] = useState(false);

  const pick = async (e) => {
    setErr(null);
    const files = await readAll(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const p = parseRoster(files);
    if (p.errors.length) return setStep({ at: 'pick', files: files.map((f) => f.name), problems: p });
    setBusy(true);
    try { const j = await admin.roster(p.roster, true); setPause(false); setStep({ at: 'preview', files: files.map((f) => f.name), roster: p.roster, preview: j, warnings: p.warnings }); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setErr(null);
    try { const j = await admin.roster(step.roster, false, { pauseLeavers: pause && !!step.preview.leavers?.length }); setStep({ at: 'done', result: j, school: step.roster.school }); onDone?.(j); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const download = () => {
    const rows = [['name', 'email', 'role', 'setup link'], ...step.result.newAccounts.created.map((a) => [a.name, a.email, a.role, a.setupUrl])];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `sign-in-links-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="acc-form acc-roster" aria-labelledby="roster-h">
      <h2 id="roster-h">{startOfYear ? 'Start of year' : 'Import class lists'}</h2>
      {startOfYear && step.at === 'pick' && <StartOfYear />}
      {step.at === 'pick' && <>
        <p className="auth-lede">Pick the roster file from the school (.json), or the four CSV files together: teachers, students, classes and enrolments. Nothing changes until you confirm. Importing again later updates people; it never makes copies or removes anyone.</p>
        <label className="auth-btn acc-file">{busy ? 'Reading…' : 'Choose files'}<input type="file" accept=".json,.csv,application/json,text/csv" multiple onChange={pick} disabled={busy} /></label>
        {step.problems && <Problems files={step.files} p={step.problems} />}
      </>}
      {step.at === 'preview' && <Preview step={step} pause={pause} setPause={setPause} />}
      {step.at === 'preview' && (startOfYear || step.preview.handover?.changes > 0) && <StartOfYear preview={step.preview.handover} />}
      {step.at === 'done' && <Done result={step.result} school={step.school} download={download} />}
      {err && <p className="auth-err" role="alert">{err}</p>}
      <div className="auth-row">
        {step.at === 'preview' && <button className="auth-btn" onClick={confirm} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>}
        {step.at === 'preview' && <button className="ghost" onClick={() => setStep({ at: 'pick' })} disabled={busy}>Pick other files</button>}
        <button className="ghost" onClick={onClose} disabled={busy}>{step.at === 'done' ? 'Close' : 'Cancel'}</button>
      </div>
    </section>
  );
}

function Problems({ files, p }) {
  const missing = Object.entries(p.missing || {});
  return (
    <div className="acc-problems" role="alert">
      <p className="auth-err">{files.join(', ')}: {plural(p.errors.length, 'problem')}. Nothing was imported. Fix the file at the source and pick it again.</p>
      {missing.length > 0 && <p><b>Missing ids:</b> {missing.map(([k, ids]) => `${k}: ${ids.join(', ')}`).join('; ')}</p>}
      <ul>{p.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul>
      {p.errors.length > 30 && <p>And {p.errors.length - 30} more.</p>}
    </div>
  );
}

function Preview({ step, pause, setPause }) {
  const { roster, preview: { summary, newAccounts, leavers = [], returning = [] }, warnings } = step;
  const gone = Object.entries(summary.missingFromFile).flatMap(([k, xs]) => xs.map((x) => ({ ...x, k })));
  return <>
    <p className="auth-lede">{roster.school.name || step.files.join(', ')}{roster.school.academicYear ? `, ${roster.school.academicYear}` : ''}{roster.school.exportedAt ? `, exported ${roster.school.exportedAt.slice(0, 10)}` : ''}.</p>
    <table className="acc-counts">
      <thead><tr><th>In the file</th><th>Count</th><th>New</th><th>Changed</th></tr></thead>
      <tbody>{PARTS.map(([k, label]) => <tr key={k}><td>{label}</td><td>{roster[k].length}</td><td>{summary.added[k]}</td><td>{summary.updated[k]}</td></tr>)}</tbody>
    </table>
    <ul className="acc-notes">
      <li>{newAccounts.toCreate ? `${plural(newAccounts.toCreate, 'person', 'people')} with an email will get a sign-in account and a setup link.` : 'Nobody new needs a sign-in account.'}{newAccounts.skipped ? ` ${plural(newAccounts.skipped, 'person', 'people')} already have one.` : ''}</li>
      {summary.ended.enrolments > 0 && <li>{plural(summary.ended.enrolments, 'class place')} not in this file will end (kept as history).</li>}
      {summary.unmatchedClasses.length > 0 && <li>{plural(summary.unmatchedClasses.length, 'class', 'classes')} {summary.unmatchedClasses.length === 1 ? 'matches' : 'match'} no line on the map and will have none: {summary.unmatchedClasses.map((c) => c.name).join(', ')}.</li>}
      {gone.length > 0 && <li>{plural(gone.length, 'record')} in Transit Portfolio {gone.length === 1 ? 'is' : 'are'} not in this file. Nothing is removed; check them yourself: {gone.slice(0, 20).map((x) => x.name || x.id).join(', ')}{gone.length > 20 ? ` and ${gone.length - 20} more` : ''}.</li>}
      {returning.length > 0 && <li>{plural(returning.length, 'paused account')} {returning.length === 1 ? 'is' : 'are'} in this file again and will be unpaused: {returning.map((a) => a.name).join(', ')}.</li>}
      {warnings.map((w, i) => <li key={i}>{w}</li>)}
    </ul>
    {leavers.length > 0 && <div className="acc-leavers">
      <label className="acc-check"><input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} /> Pause the accounts of {plural(leavers.length, 'person', 'people')} who {leavers.length === 1 ? 'is' : 'are'} no longer in the class lists</label>
      <p className="fineprint">They cannot sign in until you unpause them on Accounts, or a later import has them again. Their record and map are kept. {leavers.slice(0, 40).map((a) => a.name).join(', ')}{leavers.length > 40 ? ` and ${leavers.length - 40} more` : ''}.</p>
    </div>}
  </>;
}

function Done({ result, school, download }) {
  const { summary, newAccounts } = result;
  const n = (o) => PARTS.map(([k, l]) => `${o[k]} ${l.toLowerCase()}`).join(', ');
  return <>
    <p className="acc-ok" role="status">Imported{school?.name ? ` ${school.name}` : ''}. Added {n(summary.added)}. Updated {n(summary.updated)}.{result.paused?.length ? ` Paused ${plural(result.paused.length, 'account')}.` : ''}{result.unpaused?.length ? ` Unpaused ${plural(result.unpaused.length, 'account')}.` : ''}</p>
    {newAccounts.created.length > 0 ? <>
      <p className="auth-lede">{plural(newAccounts.created.length, 'sign-in account')} made. Each person needs their own one-time setup link: it works once and expires in 7 days. The links are shown only now, so download them before you leave this page. You can also print sign-in cards per homeroom from Accounts (that makes new links).</p>
      <button className="auth-btn acc-dl" onClick={download}>Download sign-in links (CSV)</button>
    </> : <p className="auth-lede">No new sign-in accounts were needed.</p>}
    {summary.unmatchedClasses.length > 0 && <p className="auth-note">Classes with no line: {summary.unmatchedClasses.map((c) => c.name).join(', ')}.</p>}
  </>;
}
