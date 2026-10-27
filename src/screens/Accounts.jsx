import { useEffect, useState } from 'react';
import { admin } from '../auth.js';
import '../auth.css';

const ROLES = [['student', 'Student'], ['parent', 'Parent or carer'], ['advisor', 'Advisor'], ['teacher', 'Subject teacher'], ['counsellor', 'University counsellor'], ['coordinator', 'Coordinator'], ['leadership', 'Leadership'], ['admin', 'Pilot admin (no record)']];
const ROLE_NAME = Object.fromEntries(ROLES);
const STAFF = ['advisor', 'teacher', 'counsellor', 'coordinator', 'leadership'];
const YEARS = [7, 8, 9, 10, 11, 12, 13];
const PROGRAMMES = ['IB MYP', 'IB Diploma', 'IB Career-related'];
const progFor = (y) => (y >= 12 ? 'IB Diploma' : 'IB MYP');
const blank = { name: '', email: '', kind: 'student', how: 'new', studentId: '', teacherId: '', children: [], year: 7, programme: 'IB MYP', staffRole: '', admin: false };

// Pilot admin: who can sign in, and which record each account is linked to.
export default function Accounts({ toast, persona }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState(null); // { ...blank, editing?: id }
  const [link, setLink] = useState(null); // { name, url } shown once
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { admin.list().then(setData, (x) => setErr(x.message)); }, []);
  if (err && !data) return <div className="acc"><p className="auth-err">{err}</p></div>;
  if (!data) return <div className="acc"><p className="auth-lede">Loading accounts…</p></div>;
  const sName = (id) => data.students.find((s) => s.id === id);
  const tName = (id) => data.teachers.find((t) => t.id === id);
  const linkText = (a) => (a.studentId ? `${sName(a.studentId)?.name || a.studentId} · Year ${(sName(a.studentId)?.grade ?? 0) + 1}`
    : a.teacherId ? `${tName(a.teacherId)?.name || a.teacherId} · ${tName(a.teacherId)?.role || ''}`
      : a.children ? a.children.map((c) => sName(c)?.name || c).join(', ') : '—');
  const run = async (p, done) => { setErr(null); try { const j = await p; setData(j); done?.(j); } catch (x) { setErr(x.message); } };

  const save = (e) => {
    e.preventDefault();
    const f = form;
    const body = { name: f.name, email: f.email, kind: f.kind, admin: f.kind === 'leadership' && f.admin };
    if (f.kind === 'student') Object.assign(body, f.how === 'new' ? { newStudent: { name: f.name, year: Number(f.year), programme: f.programme } } : { studentId: f.studentId });
    if (STAFF.includes(f.kind)) Object.assign(body, f.how === 'new' ? { newTeacher: { name: f.name, role: f.staffRole } } : { teacherId: f.teacherId });
    if (f.kind === 'parent') body.children = f.children;
    if (f.editing) return run(admin.update(f.editing, body), () => { setForm(null); toast(`Saved ${f.name}`); });
    run(admin.create(body), (j) => { setForm(null); setLink({ name: j.account.name, url: j.setupUrl, fresh: true }); });
  };
  const edit = (a) => setForm({ ...blank, editing: a.id, name: a.name, email: a.email, kind: a.kind, how: 'existing', studentId: a.studentId || '', teacherId: a.teacherId || '', children: a.children || [], admin: !!a.admin });

  return (
    <div className="acc">
      <div className="acc-head">
        <div><h1>Accounts</h1><p className="auth-lede">Everyone in the pilot signs in with their own account and sees only their own role’s screens. Each account is linked to a student, staff or family record.</p></div>
        {!form && <button className="auth-btn" onClick={() => { setLink(null); setForm({ ...blank }); }}>Add an account</button>}
      </div>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {link && (
        <section className="acc-link" aria-live="polite">
          <h2>{link.fresh ? 'Account created.' : 'New setup link made.'} Send {link.name} this link</h2>
          <p>It works once and expires in 7 days. It is shown only now, so copy it before you leave this page.</p>
          <div className="acc-copy"><input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Setup link" /><button className="auth-btn" onClick={() => { navigator.clipboard?.writeText(link.url).then(() => toast('Link copied'), () => toast('Select the link and copy it')); }}>Copy</button></div>
          <button className="linkish" onClick={() => setLink(null)}>Done</button>
        </section>
      )}
      {form && <AccountForm form={form} setForm={setForm} data={data} onSubmit={save} />}
      <table className="acc-table">
        <thead><tr><th>Name</th><th>Role</th><th>Linked to</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {data.accounts.map((a) => (
            <tr key={a.id}>
              <td><b>{a.name}</b><small>{a.email}</small></td>
              <td>{ROLE_NAME[a.kind] || a.kind}{a.admin && a.kind !== 'admin' && <small>Can manage accounts</small>}</td>
              <td>{linkText(a)}</td>
              <td>{a.setupPending ? <span className="acc-tag wait">Waiting for setup</span> : <span className="acc-tag ok">Active</span>}</td>
              <td><div className="acc-actions">
                {a.id !== persona.account?.id && <>
                  <button className="ghost" onClick={() => edit(a)}>Edit</button>
                  <button className="ghost" onClick={() => run(admin.reset(a.id), (j) => setLink({ name: a.name, url: j.setupUrl }))}>New setup link</button>
                  {confirm === a.id ? <button className="ghost danger" onClick={() => run(admin.remove(a.id), () => { setConfirm(null); toast(`Removed ${a.name}. Their record stays.`); })}>Yes, remove</button>
                    : <button className="ghost danger" onClick={() => setConfirm(a.id)}>Remove</button>}
                </>}
                {a.id === persona.account?.id && <small>You</small>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fineprint">Removing an account stops that person signing in. Their record and map stay. A new setup link signs them out everywhere and ends their old password.</p>
    </div>
  );
}

function AccountForm({ form: f, setForm, data, onSubmit }) {
  const up = (k) => (e) => setForm({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isStaff = STAFF.includes(f.kind);
  const toggleChild = (id) => setForm({ ...f, children: f.children.includes(id) ? f.children.filter((c) => c !== id) : [...f.children, id] });
  return (
    <form className="acc-form" onSubmit={onSubmit} aria-labelledby="accf-h">
      <h2 id="accf-h">{f.editing ? `Edit ${f.name}` : 'Add an account'}</h2>
      <div className="acc-grid">
        <label className="auth-field"><span>Full name</span><input required value={f.name} onChange={up('name')} autoFocus /></label>
        <label className="auth-field"><span>School email</span><input type="email" required value={f.email} onChange={up('email')} disabled={!!f.editing} /></label>
        <label className="auth-field"><span>Role</span><select value={f.kind} onChange={(e) => setForm({ ...f, kind: e.target.value, how: e.target.value === 'parent' || e.target.value === 'admin' ? 'existing' : f.how })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      {(f.kind === 'student' || isStaff) && (
        <fieldset className="acc-how">
          <legend>Record</legend>
          <label><input type="radio" name="how" checked={f.how === 'new'} onChange={() => setForm({ ...f, how: 'new' })} /> {f.kind === 'student' ? 'New student (starts with an empty map)' : 'New staff record'}</label>
          <label><input type="radio" name="how" checked={f.how === 'existing'} onChange={() => setForm({ ...f, how: 'existing' })} /> {f.kind === 'student' ? 'A student already in the record' : 'Someone already in the record'}</label>
        </fieldset>
      )}
      <div className="acc-grid">
        {f.kind === 'student' && f.how === 'new' && <>
          <label className="auth-field"><span>Year</span><select value={f.year} onChange={(e) => setForm({ ...f, year: Number(e.target.value), programme: progFor(Number(e.target.value)) })}>{YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
          <label className="auth-field"><span>Programme</span><select value={f.programme} onChange={up('programme')}>{PROGRAMMES.map((p) => <option key={p}>{p}</option>)}</select></label>
        </>}
        {f.kind === 'student' && f.how === 'existing' && (
          <label className="auth-field wide"><span>Student</span><select required value={f.studentId} onChange={up('studentId')}><option value="">Choose a student</option>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · Year {s.grade + 1} · {s.programme}</option>)}</select></label>
        )}
        {isStaff && f.how === 'new' && <label className="auth-field wide"><span>Subject or job</span><input value={f.staffRole} onChange={up('staffRole')} placeholder="For example: Chemistry, or Advisor 3A" /></label>}
        {isStaff && f.how === 'existing' && (
          <label className="auth-field wide"><span>Staff record</span><select required value={f.teacherId} onChange={up('teacherId')}><option value="">Choose a person</option>{data.teachers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.role}</option>)}</select></label>
        )}
      </div>
      {f.kind === 'parent' && (
        <fieldset className="acc-kids"><legend>Their children</legend>
          {data.students.map((s) => <label key={s.id}><input type="checkbox" checked={f.children.includes(s.id)} onChange={() => toggleChild(s.id)} /> {s.name} · Year {s.grade + 1}</label>)}
        </fieldset>
      )}
      {f.kind === 'leadership' && <label className="acc-check"><input type="checkbox" checked={f.admin} onChange={up('admin')} /> Can manage accounts</label>}
      <div className="auth-row">
        <button className="auth-btn" type="submit" disabled={f.kind === 'parent' && !f.children.length}>{f.editing ? 'Save' : 'Create and make a setup link'}</button>
        <button type="button" className="ghost" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </form>
  );
}
