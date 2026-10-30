// My phrases (api.addPhrase … movePhrase): each member of staff's own comment bank, and the school bank that
// coordinators, leadership and admins publish for everyone. The picker beside the writing boxes is components/Phrases.jsx.
import { useState } from 'react';
import { addPhrase, canPublishPhrases, deletePhrase, editPhrase, FIRST_NAME, getLine, getSchoolLines, movePhrase, phraseBank, PHRASE_KINDS, PHRASE_MAX, snapshot } from '../api.js';
import '../components/phrases.css';

const KIND = Object.fromEntries(PHRASE_KINDS);

export default function Phrases({ persona, toast, version }) {
  const tid = persona.teacherId || null;
  const publish = canPublishPhrases(persona);
  const { mine, school, uses } = phraseBank(tid);
  const by = tid; // as yourself (an admin with no staff record: null)
  const run = (fn, ok) => { const snap = snapshot(); try { fn(); if (ok) toast(ok, snap); return true; } catch (e) { toast(e.message || 'That did not work.'); return false; } };
  return (
    <div className="page ph-page" data-v={version}>
      <h1>My phrases</h1>
      <p className="fineprint">Words you write often, ready to drop into an endorsement note, a comment or a request for more. Choose <b>Phrases</b> next to a box to put one in; nothing is sent until you send it. Write {FIRST_NAME} where the student’s first name goes. Students and families never see your phrases.</p>
      {tid ? (
        <section aria-labelledby="ph-mine">
          <h2 id="ph-mine">Your phrases</h2>
          <PhraseForm label="Add a phrase" onSave={(f) => run(() => addPhrase(tid, by, f), 'Phrase saved')} />
          {mine.length ? <PhraseList list={mine} uses={uses} run={run} by={by} /> : <p className="fineprint">None yet. Add one above, or choose “Save this as a phrase” under any box you write in.</p>}
        </section>
      ) : <p className="fineprint">Your account is not linked to a staff record, so you have no phrases of your own.</p>}
      <section aria-labelledby="ph-school">
        <h2 id="ph-school">School phrases</h2>
        <p className="fineprint">{publish ? 'Everyone on the staff sees these in their picker. Changes are kept in the activity log.' : 'Shared by the school’s coordinators for everyone on the staff.'}</p>
        {publish && <PhraseForm label="Publish a school phrase" lines onSave={(f) => run(() => addPhrase('school', by, f), 'Published to the school bank')} />}
        {PHRASE_KINDS.map(([k, name]) => { const list = school.filter((p) => p.kind === k); return list.length > 0 && (
          <div key={k}><h3>{name}</h3>{publish ? <PhraseList list={list} uses={uses} run={run} by={by} lines /> : <PhraseList list={list} uses={uses} readOnly />}</div>
        ); })}
        {!school.length && <p className="fineprint">No school phrases yet.</p>}
      </section>
    </div>
  );
}

function PhraseForm({ label, init = {}, lines = false, onSave, onCancel }) {
  const [f, setF] = useState({ text: init.text || '', kind: init.kind || 'praise', lineId: init.lineId || '' });
  const set = (x) => setF({ ...f, ...x });
  const save = (e) => { e.preventDefault(); if (onSave({ ...f, lineId: f.lineId || null }) && !onCancel) setF({ ...f, text: '' }); };
  return (
    <form className="ph-form" onSubmit={save} aria-label={label}>
      <label>{label}<textarea rows={2} maxLength={PHRASE_MAX} value={f.text} onChange={(e) => set({ text: e.target.value })} placeholder={`e.g. Great work, ${FIRST_NAME}! You explained it clearly.`} /></label>
      <div className="ph-row">
        <label>Kind<select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{PHRASE_KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        {lines && <label>Line <small>optional</small><select value={f.lineId} onChange={(e) => set({ lineId: e.target.value })}><option value="">Any line</option>{getSchoolLines().map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
        <button className="primary" type="submit" disabled={f.text.trim().length < 2}>{onCancel ? 'Save' : 'Add'}</button>
      </div>
    </form>
  );
}

function PhraseList({ list, uses, run, by, lines = false, readOnly = false }) {
  const [editing, setEditing] = useState(null);
  return (
    <ul className="ph-items">
      {list.map((p, i) => (editing === p.id ? (
        <li key={p.id}><PhraseForm label="Change this phrase" init={p} lines={lines} onCancel={() => setEditing(null)} onSave={(f) => run(() => editPhrase(p.id, by, f), 'Phrase changed') && (setEditing(null), true)} /></li>
      ) : (
        <li key={p.id}>
          <p>{p.text}</p>
          <span className="ph-kind">{KIND[p.kind]}</span>
          {p.lineId && getLine(p.lineId) && <small>{getLine(p.lineId).name}</small>}
          {uses[p.id] > 0 && <small>Used {uses[p.id] === 1 ? 'once' : `${uses[p.id]} times`}</small>}
          {!readOnly && (
            <span className="ph-acts">
              <button type="button" className="ghost" disabled={i === 0} aria-label={`Move up: ${p.text}`} onClick={() => run(() => movePhrase(p.id, by, -1))}>Up</button>
              <button type="button" className="ghost" disabled={i === list.length - 1} aria-label={`Move down: ${p.text}`} onClick={() => run(() => movePhrase(p.id, by, 1))}>Down</button>
              <button type="button" className="ghost" aria-label={`Edit: ${p.text}`} onClick={() => setEditing(p.id)}>Edit</button>
              <button type="button" className="ghost" aria-label={`Delete: ${p.text}`} onClick={() => run(() => deletePhrase(p.id, by), 'Phrase deleted')}>Delete</button>
            </span>
          )}
        </li>
      )))}
    </ul>
  );
}
