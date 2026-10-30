import { useMemo, useState } from 'react';
import { getTeacher, momentTemplates, MT_LIMITS, saveMomentTemplate, schoolLines, setMomentTemplateOff, snapshot, templateFits, templatesFor, templateUses } from '../api.js';
import { fmtDate } from '../format.js';
import { shown } from '../thai.js';
import { Said, SayIt } from './Voice.jsx';
import './moment-templates.css';

// Moment templates (api.saveMomentTemplate, templatesFor, templateText): guided shapes for common kinds of moment. Students:
// GuideOffer ("Use a guide" after choosing a line), GuideStep (Simple: one part per screen), GuideFields (Standard and Full:
// labelled fields). Teachers: GuideSelect (a class task or class question). Coordinators, leadership and admins:
// MomentTemplatesScreen (#/<persona>/prompts/templates), with PromptTabs beside Subject prompts.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const addStarter = (val, s) => `${val ? `${val.trimEnd()} ` : ''}${shown(s).replace(/…$/, ' ')}`;

// ── Students ──
export function GuideOffer({ lineId, onPick, simple = false, className = '' }) {
  const list = useMemo(() => templatesFor(lineId), [lineId]);
  if (!list.length) return null;
  return (
    <div className={`mt-offer${simple ? ' big' : ''} ${className}`} role="group" aria-labelledby={`mt-offer-${lineId}`}>
      <span className="mt-offer-h" id={`mt-offer-${lineId}`}>Use a guide</span>
      <div className="mt-offer-list">{list.map((t) => <button type="button" key={t.id} onClick={() => onPick(t)}><b>{t.name}</b>{t.about && <small>{t.about}</small>}</button>)}</div>
    </div>
  );
}

// Simple: one part per screen, its question read aloud, sentence starters, speak to type.
export function GuideStep({ t, i, value = '', onChange }) {
  const f = t.fields[i];
  return (
    <div className="mt-step">
      <p className="mt-from"><b>{t.name}</b><span>{`Question ${i + 1} of ${t.fields.length}`}</span></p>
      <Said text={f.ask} />
      {f.starters.length > 0 && <div className="sh-starters" role="group" aria-label="Ways to start">{f.starters.map((s) => <button type="button" key={s} onClick={() => onChange(addStarter(value, s))}>{s}</button>)}</div>}
      <textarea className="sh-input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} aria-label={f.ask} />
      <SayIt value={value} onChange={onChange} />
    </div>
  );
}

// Standard and Full: every part as a labelled field.
export function GuideFields({ t, answers, onChange, onDrop, className = '' }) {
  const put = (i, v) => onChange(t.fields.map((_, j) => (j === i ? v : answers[j] || '')));
  return (
    <fieldset className={`mt-fields ${className}`}>
      <legend><span>{t.name}</span>{onDrop && <button type="button" className="linkish" onClick={onDrop}>Stop using the guide</button>}</legend>
      {t.fields.map((f, i) => (
        <div key={f.label} className="mt-field">
          <label htmlFor={`mt-f-${i}`}>{f.label}</label>
          <small id={`mt-a-${i}`}>{f.ask}</small>
          <textarea id={`mt-f-${i}`} rows={2} value={answers[i] || ''} aria-describedby={`mt-a-${i}`} onChange={(e) => put(i, e.target.value)} />
          {f.starters.length > 0 && <div className="sp-starters" role="group" aria-label={`Ways to start: ${f.label}`}>{f.starters.map((s) => <button type="button" key={s} onClick={() => put(i, addStarter(answers[i], s))}>{s}</button>)}</div>}
        </div>
      ))}
    </fieldset>
  );
}

// ── Teachers: a guide on a class task or class question; the ones that fit its line first ──
export function GuideSelect({ value, lineId, onChange }) {
  const all = useMemo(() => momentTemplates().filter((t) => !t.off || t.id === value), [value]);
  const fit = all.filter((t) => lineId && templateFits(t, lineId)), rest = all.filter((t) => !fit.includes(t));
  return (
    <label>Guide for students <small>optional; students fill in its parts instead of a blank box</small>
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">No guide</option>
        {fit.length > 0 && <optgroup label="Fits this line">{fit.map((t) => <option key={t.id} value={t.id}>{t.name}{t.off ? ' (turned off)' : ''}</option>)}</optgroup>}
        {rest.length > 0 && <optgroup label={fit.length ? 'Other guides' : 'Guides'}>{rest.map((t) => <option key={t.id} value={t.id}>{t.name}{t.off ? ' (turned off)' : ''}</option>)}</optgroup>}
      </select>
    </label>
  );
}

// ── Coordinators, leadership and admins ──
export function PromptTabs({ persona, go, at }) {
  const tab = (id, label, param) => <a href={`#/${persona.id}/prompts${param ? `/${param}` : ''}`} aria-current={at === id ? 'page' : undefined} className={at === id ? 'on' : ''}
    onClick={(e) => { e.preventDefault(); go?.(persona.id, 'prompts', param); }}>{label}</a>;
  return <nav className="mt-tabs" aria-label="Writing help for students">{tab('prompts', 'Line prompts', undefined)}{tab('templates', 'Moment templates', 'templates')}</nav>;
}

export function MomentTemplatesScreen({ persona, go, toast, version }) {
  const list = useMemo(() => momentTemplates(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => schoolLines(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(null); // { t?, copy?, linesOnly? }
  const teacherId = persona.teacherId || null;
  const turn = (t) => { const snap = snapshot(); try { setMomentTemplateOff(t.id, !t.off, teacherId); toast?.(t.off ? `“${t.name}” is on. Students can use it again.` : `“${t.name}” is off. Students are no longer offered it.`, snap); } catch (e) { toast?.(e.message); } };
  const lineName = (id) => lines.find((l) => l.id === id)?.name || id;
  return (
    <div className="page sp-page mt-page">
      <PromptTabs persona={persona} go={go} at="templates" />
      <header className="page-head"><div>
        <div className="kicker">Moment templates</div>
        <h1>Guides for common kinds of moment</h1>
        <p>After choosing a line, students can pick a guide: a few short parts to fill in, one per screen at the Simple level. Their answers are saved as the moment’s words, each under its heading. Teachers can put a guide on a class task or a class question.</p>
      </div>
      <button className="primary" onClick={() => setEditing({})}>Add a template</button></header>
      <div className="mt-list">
        {list.map((t) => {
          const by = t.by && getTeacher(t.by), uses = templateUses(t.id);
          return (
            <section key={t.id} className={`sp-card mt-card${t.off ? ' off' : ''}`} aria-labelledby={`mt-h-${t.id}`}>
              <header>
                <div>
                  <h2 id={`mt-h-${t.id}`}>{t.name}{t.off && <em className="mt-badge">Off</em>}</h2>
                  <small>{t.builtIn ? 'Built in' : 'The school’s own'}{t.at ? ` · changed by ${by ? by.name : 'an admin'}, ${fmtDate(t.at.slice(0, 10))}` : ''} · {plural(uses, 'moment')} written with it</small>
                  {t.about && <small>{t.about}</small>}
                </div>
                <div className="mt-acts">
                  {t.builtIn ? <><button className="ghost" onClick={() => setEditing({ t, linesOnly: true })}>Change lines</button><button className="ghost" onClick={() => setEditing({ t, copy: true })}>Make a copy</button></>
                    : <button className="ghost" onClick={() => setEditing({ t })}>Edit</button>}
                  <button className={t.off ? 'primary' : 'ghost'} onClick={() => turn(t)}>{t.off ? 'Turn on' : 'Turn off'}</button>
                </div>
              </header>
              <p className="sp-classes"><span>Shown on:</span> {t.lineIds.length ? t.lineIds.map(lineName).join(' · ') : 'every line'}</p>
              <details className="sp-preview"><summary>What students fill in</summary>
                <ol className="mt-parts">{t.fields.map((f) => <li key={f.label}><b>{f.label}</b> <span>{f.ask}</span>{f.starters.length > 0 && <small> · {f.starters.join(' · ')}</small>}</li>)}</ol>
              </details>
            </section>
          );
        })}
      </div>
      {editing && <TemplateEditor {...editing} lines={lines} teacherId={teacherId} toast={toast} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateEditor({ t, copy, linesOnly, lines, teacherId, toast, onClose }) {
  const [f, setF] = useState(() => ({
    name: t ? (copy ? `${t.name} (our version)` : t.name) : '', about: t?.about || '', lineIds: [...(t?.lineIds || [])],
    fields: t ? t.fields.map((x) => ({ label: x.label, ask: x.ask, starters: x.starters.join(' / ') })) : [{ label: '', ask: '', starters: '' }, { label: '', ask: '', starters: '' }],
  }));
  const [err, setErr] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const part = (i, p) => set({ fields: f.fields.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const toggle = (id) => set({ lineIds: f.lineIds.includes(id) ? f.lineIds.filter((x) => x !== id) : [...f.lineIds, id] });
  const filled = f.fields.filter((x) => x.label.trim()).length;
  const save = () => {
    try {
      const snap = snapshot();
      const spec = linesOnly ? { id: t.id, lineIds: f.lineIds }
        : { ...(t && !copy ? { id: t.id } : {}), ...(copy ? { from: t.id } : {}), name: f.name, about: f.about, lineIds: f.lineIds,
          fields: f.fields.map((x) => ({ label: x.label, ask: x.ask, starters: x.starters.split('/').map((s) => s.trim()).filter(Boolean) })) };
      const out = saveMomentTemplate(spec, teacherId);
      toast?.(linesOnly ? `“${out.name}” now shows on ${out.lineIds.length ? plural(out.lineIds.length, 'line') : 'every line'}.` : `Saved “${out.name}”. Students see it after choosing ${out.lineIds.length ? 'one of its lines' : 'any line'}.`, snap);
      onClose();
    } catch (e) { setErr(e.message); }
  };
  const title = linesOnly ? `Lines for “${t.name}”` : copy ? `A copy of “${t.name}”` : t ? `Edit “${t.name}”` : 'A new template';
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal sp-edit mt-edit" role="dialog" aria-labelledby="mt-edit-h" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-kicker">Moment templates</div>
        <h2 id="mt-edit-h">{title}</h2>
        {!linesOnly && <>
          <label>Name<input value={f.name} maxLength={MT_LIMITS.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Field trip report" /></label>
          <label>What it is for <small>a few words students see under the name</small><input value={f.about} maxLength={MT_LIMITS.about} onChange={(e) => set({ about: e.target.value })} placeholder="e.g. For a day out of school with your class." /></label>
          <fieldset>
            <legend>Parts <small>{MT_LIMITS.minFields} to {MT_LIMITS.maxFields}. Each answer is saved under its heading. At the Simple level students get one per screen.</small></legend>
            {f.fields.map((x, i) => (
              <div key={i} className="mt-part">
                <div className="sp-row">
                  <input value={x.label} maxLength={MT_LIMITS.label} aria-label={`Part ${i + 1} heading`} placeholder={i === 0 ? 'Heading, e.g. Where we went' : 'Heading'} onChange={(e) => part(i, { label: e.target.value })} />
                  {f.fields.length > MT_LIMITS.minFields && <button type="button" className="ghost" aria-label={`Remove part ${i + 1}`} onClick={() => set({ fields: f.fields.filter((_, j) => j !== i) })}>Remove</button>}
                </div>
                <input value={x.ask} maxLength={MT_LIMITS.ask} aria-label={`Part ${i + 1} question`} placeholder="The question students see, e.g. Where did you go, and why?" onChange={(e) => part(i, { ask: e.target.value })} />
                <input value={x.starters} aria-label={`Part ${i + 1} sentence starters`} placeholder="Sentence starters, separated by / (optional), e.g. We went to… / First we…" onChange={(e) => part(i, { starters: e.target.value })} />
              </div>
            ))}
            {f.fields.length < MT_LIMITS.maxFields && <button type="button" className="ghost sp-add" onClick={() => set({ fields: [...f.fields, { label: '', ask: '', starters: '' }] })}>Add a part</button>}
          </fieldset>
        </>}
        <fieldset>
          <legend>Shown on <small>{f.lineIds.length ? plural(f.lineIds.length, 'line') : 'none picked: every line'}</small></legend>
          <div className="chips">{lines.map((l) => <button key={l.id} type="button" className={`line-chip${f.lineIds.includes(l.id) ? '' : ' off'}`} style={{ '--c': l.colour }} aria-pressed={f.lineIds.includes(l.id)} onClick={() => toggle(l.id)}><i />{l.name}</button>)}</div>
        </fieldset>
        {err && <p className="up-error" role="alert">{err}</p>}
        <div className="cp-foot"><span>{linesOnly ? 'Only its lines change; the built-in wording stays.' : `${plural(filled, 'part')}`}</span><button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!linesOnly && (f.name.trim().length < 3 || filled < MT_LIMITS.minFields)} onClick={save}>Save</button></div>
      </div>
    </div>
  );
}
