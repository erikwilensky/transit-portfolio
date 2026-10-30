import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from '../format.js';
import { inPreview } from '../preview.js';
import { DEFAULT_LIMITS, KIND_LABEL, charCount, checkComment, firstName, groupStudents, groupsOf, momentsFor, reportApi, reportHooks, termRange, wordCount } from '../report-comments.js';
import './classes.css';
import './report-comments.css';

// Report comments (pilot): #/<persona>/reportcomments, and /<kind>~<groupId> for one class or the advisory.
// The teacher writes; this screen only gathers the term's moments, counts and checks. Drafts are the writer's alone.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const Line = ({ line }) => (line ? <span className="line-chip static" style={{ '--c': line.colour }}><i />{line.name}</span> : null);
const canSeeProgress = (p) => p.admin || p.kind === 'coordinator' || p.kind === 'leadership';
const keyOf = (kind, group, sid) => `${kind}|${group}|${sid}`;

export default function ReportComments({ persona, go, version, toast, param }) {
  const preview = inPreview();
  const [mine, setMine] = useState(null);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [error, setError] = useState('');
  useEffect(() => {
    if (preview) { setMine(new Map()); return; }
    reportApi.mine().then((j) => { setLimits(j.limits); setMine(new Map(j.drafts.map((d) => [keyOf(d.kind, d.group, d.studentId), d]))); }, (e) => setError(e.message));
  }, [preview]);
  const groups = useMemo(() => groupsOf(persona), [persona, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, groupId] = (param || '').split('~');
  const group = groups.find((g) => g.kind === kind && g.id === groupId);
  const onSaved = (k, d) => setMine((m) => { const n = new Map(m); if (d) n.set(k, d); else n.delete(k); return n; });
  const doneIn = (g) => (mine ? [...mine.values()].filter((d) => d.kind === g.kind && d.group === g.id && d.done).length : 0);

  if (group) return <GroupView persona={persona} go={go} toast={toast} version={version} group={group} limit={limits[group.kind]} mine={mine} onSaved={onSaved} error={error} preview={preview} />;
  return (
    <div className="page rc">
      <header className="page-head">
        <div>
          <div className="kicker">End of term</div>
          <h1>Report comments</h1>
          <p>See what each student did this term while you write their comment, then copy it into the school's report system. Only you can see your drafts.</p>
        </div>
      </header>
      {error && <p className="rc-error" role="alert">{error}</p>}
      {preview && <p className="rc-note">Drafts belong to the person writing them, so See as does not show them.</p>}
      {persona.teacherId && (
        <section className="rc-sec" aria-labelledby="rc-mine">
          <h2 id="rc-mine">Your comments</h2>
          {!groups.length ? <p className="rc-none">No classes or advisees yet. They appear once the school imports its class lists.</p> : (
            <ul className="mc-list rc-groups">{groups.map((g) => {
              const done = doneIn(g);
              return (
                <li key={`${g.kind}~${g.id}`} data-group={g.id}>
                  <a href={`#/${persona.id}/reportcomments/${g.kind}~${g.id}`} onClick={(e) => { e.preventDefault(); go(persona.id, 'reportcomments', `${g.kind}~${g.id}`); }}>
                    <span className="mc-name"><b>{g.name}</b><small>{KIND_LABEL[g.kind]}{g.line ? <> · <Line line={g.line} /></> : null}</small></span>
                    <span className="mc-num"><b>{`${done} of ${g.total}`}</b><small>done</small></span>
                    <progress max={g.total || 1} value={done} aria-label={`${g.name}: ${done} of ${g.total} done`} />
                  </a>
                </li>
              );
            })}</ul>
          )}
        </section>
      )}
      {canSeeProgress(persona) && !preview && <ProgressPanel />}
      {persona.admin && !preview && <LimitsPanel limits={limits} onChange={setLimits} toast={toast} />}
    </div>
  );
}

function GroupView({ persona, go, toast, version, group, limit, mine, onSaved, error, preview }) {
  const [range, setRange] = useState(termRange);
  const [hideDone, setHideDone] = useState(false);
  const students = useMemo(() => groupStudents(group.kind, group.id), [group, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const drafts = students.map((s) => mine?.get(keyOf(group.kind, group.id, s.id)) || null);
  const done = drafts.filter((d) => d?.done).length, written = drafts.filter((d) => d?.text.trim()).length;
  const term = termRange();
  const isTerm = range.from === term.from && range.to === term.to;
  const back = <button className="cb-back" onClick={() => go(persona.id, 'reportcomments')}>‹ Report comments</button>;
  return (
    <div className="page rc">
      {back}
      <header className="page-head">
        <div>
          <div className="kicker">{KIND_LABEL[group.kind]}</div>
          <h1>{group.name}</h1>
          <p>{[limit.words && `Up to ${limit.words} words`, limit.chars && `${limit.chars} characters`].filter(Boolean).join(', ') || 'No length limit'}. Only you can see these drafts: students and families never do.</p>
        </div>
        <div className="rc-prog" aria-live="polite">
          <b>{`${done} of ${students.length} done`}</b>
          <progress max={students.length || 1} value={done} aria-label={`${done} of ${students.length} done`} />
          <small>{`${written} written`}</small>
        </div>
      </header>
      {error && <p className="rc-error" role="alert">{error}</p>}
      <div className="rc-bar">
        <label>From <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} /></label>
        <label>To <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} /></label>
        {!isTerm && <button className="ghost" onClick={() => setRange(term)}>This term</button>}
        <label className="rc-check"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done</label>
        <span className="rc-gap" />
        {!preview && <a className="ghost rc-csv" href={reportApi.exportUrl(group.kind, group.id)} download>Download all as CSV</a>}
      </div>
      {!students.length && <p className="rc-none">No students in this {group.kind === 'subject' ? 'class' : 'advisory'} now.</p>}
      <ol className="rc-rows">
        {students.map((s, i) => (hideDone && drafts[i]?.done ? null : (
          <StudentRow key={s.id} student={s} group={group} range={range} draft={drafts[i]} limit={limit} others={students} teacherId={persona.teacherId}
            ready={!!mine} preview={preview} toast={toast} version={version} onSaved={(d) => onSaved(keyOf(group.kind, group.id, s.id), d)} />
        )))}
      </ol>
    </div>
  );
}

function Moments({ m, kind }) {
  const [all, setAll] = useState(false);
  const shown = all ? m.events : m.events.slice(0, 5);
  const bits = [plural(m.events.length, 'moment'), m.endorsements && plural(m.endorsements, 'endorsement'), m.answers && plural(m.answers, 'class answer'),
    m.tasks && `${m.tasks.handedIn} of ${plural(m.tasks.set, 'task')} handed in`].filter(Boolean);
  return (
    <div className="rc-moments">
      <p className="rc-sum">{bits.join(' · ')}</p>
      {kind === 'advisor' && m.reflection && (
        <div className="rc-refl"><b>{`${m.reflection.title}: ${m.reflection.status === 'done' ? 'finished' : 'started, not finished'}`}</b>
          {m.reflection.words.map((w, i) => <q key={i}>{w}</q>)}</div>
      )}
      {kind === 'advisor' && m.goals?.length > 0 && (
        <ul className="rc-goals">{m.goals.map((g) => <li key={g.id}><span className="rc-tag">Goal</span>{`${g.title} · by ${fmtDate(g.date)}${g.closed ? ' · closed' : g.last ? ` · last check-in: ${{ well: 'going well', stuck: 'stuck', none: 'not started' }[g.last]}` : ''}`}</li>)}</ul>
      )}
      {!m.events.length && !m.spotted.length ? <p className="rc-empty">Nothing in these dates{kind === 'subject' ? ' for this class' : ''}.</p> : (
        <ul className="rc-list">
          {shown.map((e) => (
            <li key={e.id}>
              <div className="rc-mt"><time dateTime={e.date}>{fmtDate(e.date)}</time><b>{e.title}</b>{kind === 'advisor' && <Line line={e.line} />}{e.tag && <span className="rc-tag">{e.tag}</span>}{e.endorsed && <span className="rc-tag ok">Endorsed</span>}</div>
              {e.words.map((w, i) => <q key={i}>{w}</q>)}
              {!e.words.length && e.summary && <small>{e.summary}</small>}
              {e.endorsements.map((n, i) => <small key={i} className="rc-en">{`${n.by}: ${n.note}`}</small>)}
            </li>
          ))}
          {m.spotted.map((x) => <li key={x.id} className="rc-spot"><div className="rc-mt"><time dateTime={x.date}>{fmtDate(x.date)}</time><b>{x.title}</b><span className="rc-tag">You spotted (not on their map)</span></div>{x.note && <small>{x.note}</small>}</li>)}
        </ul>
      )}
      {m.events.length > 5 && <button className="ghost rc-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>{all ? 'Show fewer' : `Show all ${m.events.length}`}</button>}
    </div>
  );
}

function StudentRow({ student, group, range, draft, limit, others, teacherId, ready, preview, toast, version, onSaved }) {
  const m = useMemo(() => momentsFor(student.id, { kind: group.kind, classId: group.kind === 'subject' ? group.id : null, ...range, teacherId }), [student.id, group, range, teacherId, version]);
  const [text, setText] = useState(draft?.text || '');
  const [done, setDone] = useState(!!draft?.done);
  const [state, setState] = useState(''); // '' | saving | saved | error
  const box = useRef(null), timer = useRef(null), sent = useRef({ text: draft?.text || '', done: !!draft?.done });
  useEffect(() => { if (!timer.current && draft && draft.text !== sent.current.text) { setText(draft.text); setDone(draft.done); sent.current = { text: draft.text, done: draft.done }; } }, [draft]);
  const save = (t, d) => {
    clearTimeout(timer.current); timer.current = null;
    if (preview || (t === sent.current.text && d === sent.current.done)) return;
    setState('saving');
    reportApi.save(group.kind, group.id, student.id, { text: t, done: d }).then((x) => { sent.current = { text: t, done: d }; setState('saved'); onSaved(x); }, (e) => { setState('error'); toast(e.message); });
  };
  const edit = (t) => { setText(t); clearTimeout(timer.current); timer.current = setTimeout(() => save(t, done), 800); };
  const latest = useRef(null); latest.current = { text, done, save };
  useEffect(() => () => { if (timer.current) latest.current.save(latest.current.text, latest.current.done); }, []); // leaving with a change not sent yet
  const checks = checkComment(text, student, others, limit);
  const words = wordCount(text), chars = charCount(text);
  const first = firstName(student.name), id = `rc-${student.id}`;
  const over = (limit.words && words > limit.words) || (limit.chars && chars > limit.chars);
  const insert = (s) => {
    const el = box.current, at = el ? el.selectionStart : text.length, end = el ? el.selectionEnd : text.length;
    const t = text.slice(0, at) + s + text.slice(end); edit(t);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + s.length; } });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { box.current?.select(); document.execCommand?.('copy'); }
    toast(`Copied ${first}'s comment`);
  };
  const Picker = reportHooks.phrasePicker;
  return (
    <li className={`rc-row${done ? ' done' : ''}`} data-student={student.id}>
      <div className="rc-who">
        <h3>{student.name}</h3>
        <small>{[`Year ${student.grade + 1}`, student.homeroom].filter(Boolean).join(' · ')}</small>
        <Moments m={m} kind={group.kind} />
      </div>
      <div className="rc-draft">
        <label htmlFor={id}>{`Comment for ${first}`}</label>
        <textarea id={id} ref={box} rows={7} value={text} disabled={!ready || preview} onChange={(e) => edit(e.target.value)} onBlur={() => save(text, done)} aria-describedby={`${id}-n ${id}-c`} spellCheck />
        <p id={`${id}-n`} className={`rc-count${over ? ' over' : ''}`}>
          {limit.words ? `${words} / ${limit.words} words` : plural(words, 'word')}{' · '}{limit.chars ? `${chars} / ${limit.chars} characters` : plural(chars, 'character')}
          <span className="rc-state" aria-live="polite">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Not saved' : ''}</span>
        </p>
        <ul id={`${id}-c`} className="rc-checks">{checks.map((c) => <li key={c.key} className={c.level}><span aria-hidden="true">{c.level === 'ok' ? '✓' : c.level === 'problem' ? '!' : '·'}</span>{c.text}</li>)}</ul>
        {Picker && <div className="rc-hook"><Picker student={student} kind={group.kind} classId={group.kind === 'subject' ? group.id : null} text={text} insert={insert} /></div>}
        <div className="rc-acts">
          <button className="ghost" disabled={!text.trim()} onClick={copy}>Copy</button>
          <button className={done ? 'primary' : 'ghost'} aria-pressed={done} disabled={!ready || preview || (!done && !text.trim())} onClick={() => { const d = !done; setDone(d); save(text, d); }}>{done ? 'Done ✓' : 'Mark done'}</button>
        </div>
      </div>
    </li>
  );
}

function ProgressPanel() {
  const [p, setP] = useState(null), [err, setErr] = useState(''), [only, setOnly] = useState(false);
  useEffect(() => { reportApi.progress().then(setP, (e) => setErr(e.message)); }, []);
  const rows = (p?.teachers || []).filter((t) => !only || t.subject.drafted || t.advisor?.drafted || t.subject.done || t.advisor?.done);
  const cell = (c) => (c ? <><b>{`${c.done} of ${c.students}`}</b><small>{` done · ${c.drafted} written`}</small></> : <small>None</small>);
  return (
    <section className="rc-sec" aria-labelledby="rc-progress">
      <div className="rc-head"><h2 id="rc-progress">Progress by teacher</h2>
        <label className="rc-check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Only those who have started</label></div>
      <p className="fineprint">Counts only. Nobody but the writer can read a draft.</p>
      {err && <p className="rc-error" role="alert">{err}</p>}
      {!p ? !err && <p className="rc-none">Loading…</p> : !rows.length ? <p className="rc-none">Nobody has started yet.</p> : (
        <table className="mc-table rc-ptable">
          <thead><tr><th>Teacher</th><th>Subject comments</th><th>Advisor comments</th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.teacherId} data-teacher={t.teacherId}>
              <td><b>{t.name}</b>{t.classes.length > 0 && <details><summary>{plural(t.classes.length, 'class', 'classes')}</summary><ul>{t.classes.map((c) => <li key={c.id}>{`${c.name}: ${c.done} of ${c.students} done`}</li>)}</ul></details>}</td>
              <td>{t.subject.classes ? cell(t.subject) : <small>None</small>}</td>
              <td>{cell(t.advisor)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

function LimitsPanel({ limits, onChange, toast }) {
  const [f, setF] = useState(limits);
  useEffect(() => setF(limits), [limits]);
  const save = async (kind) => {
    try { onChange(await reportApi.setLimits(kind, f[kind].words, f[kind].chars)); toast(`${KIND_LABEL[kind]} length saved`); } catch (e) { toast(e.message); }
  };
  const set = (kind, k, v) => setF((x) => ({ ...x, [kind]: { ...x[kind], [k]: v === '' ? '' : Number(v) } }));
  return (
    <section className="rc-sec" aria-labelledby="rc-limits">
      <h2 id="rc-limits">Comment length</h2>
      <p className="fineprint">What the report system allows. Teachers see their count against it. Leave a box at 0 for no limit.</p>
      <div className="rc-limits">{Object.keys(KIND_LABEL).map((kind) => (
        <fieldset key={kind}>
          <legend>{KIND_LABEL[kind]}</legend>
          <label>Words <input type="number" min="0" max="5000" value={f[kind]?.words ?? ''} onChange={(e) => set(kind, 'words', e.target.value)} /></label>
          <label>Characters <input type="number" min="0" max="5000" value={f[kind]?.chars ?? ''} onChange={(e) => set(kind, 'chars', e.target.value)} /></label>
          <button className="ghost" onClick={() => save(kind)}>Save</button>
        </fieldset>
      ))}</div>
    </section>
  );
}
