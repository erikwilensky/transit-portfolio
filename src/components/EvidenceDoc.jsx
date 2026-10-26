import { fmtDate } from '../format.js';

// Realistic renderings of a piece of evidence: a certificate, a result slip, a code repository,
// a video or audio page, a web page or dashboard, a spreadsheet, a slide deck or a multi-page document.
// Content lives in src/evidence/*.js, keyed by station id and caption.

const first = (n) => n.split(' ')[0];

// `code` inside a paragraph.
const inline = (t) => t.split('`').map((x, i) => (i % 2 ? <code key={i}>{x}</code> : x));

// A small block language shared by documents, web pages and READMEs.
export function Blocks({ blocks = [] }) {
  return blocks.map((b, i) => {
    if (typeof b === 'string') return <p key={i}>{inline(b)}</p>;
    const [k, ...a] = b;
    if (k === 'h') return <h4 key={i}>{a[0]}</h4>;
    if (k === 'list') return <ul key={i}>{a[0].map((x, j) => <li key={j}>{x}</li>)}</ul>;
    if (k === 'ol') return <ol key={i}>{a[0].map((x, j) => <li key={j}>{x}</li>)}</ol>;
    if (k === 'quote') return <blockquote key={i}>{a[0]}</blockquote>;
    if (k === 'code') return <pre key={i}><code>{a[0]}</code></pre>;
    if (k === 'note') return <aside key={i} className="ed-note"><b>{a[0]}</b>{a[1]}</aside>;
    if (k === 'fig') return <figure key={i}>{a[1] ? <img src={a[1]} alt="" /> : <div className="ed-figph" aria-hidden="true" />}<figcaption>{a[0]}</figcaption></figure>;
    if (k === 'table') return <div key={i} className="ed-tablewrap"><table className="ed-table"><thead><tr>{a[0].map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{a[1].map((r, j) => <tr key={j}>{r.map((c, m) => <td key={m}>{c}</td>)}</tr>)}</tbody></table></div>;
    if (k === 'stats') return <div key={i} className="ed-stats">{a[0].map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}</div>;
    if (k === 'bars') {
      const max = Math.max(...a[1].map(([, v]) => v));
      return (
        <figure key={i} className="ed-bars"><figcaption>{a[0]}</figcaption>
          {a[1].map(([l, v]) => <div key={l} className="ed-bar"><span>{l}</span><i style={{ width: `${(v / max) * 100}%` }} /><b>{v}{a[2] || ''}</b></div>)}
        </figure>
      );
    }
    if (k === 'sign') return <div key={i} className="ed-sign"><span className="ed-scrawl" aria-hidden="true">{a[0]}</span><b>{a[0]}</b><small>{a[1]}</small></div>;
    return null;
  });
}

function Cert({ d, event, student }) {
  return (
    <div className="ed-cert" style={{ '--c': d.colour || 'var(--b-gold)' }}>
      <div className="ed-cert-in">
        <div className="ed-cert-org">{d.org}</div>
        <div className="ed-cert-kind">{d.kind || 'Certificate'}</div>
        <p className="ed-cert-pre">{d.pre || 'This is to certify that'}</p>
        <div className="ed-cert-name">{d.name || student.name}</div>
        <p className="ed-cert-line">{d.line}</p>
        {d.award && <div className="ed-cert-award">{d.award}</div>}
        <div className="ed-cert-foot">
          {(d.sign || []).map(([n, r]) => <div key={n} className="ed-sign"><span className="ed-scrawl" aria-hidden="true">{n}</span><b>{n}</b><small>{r}</small></div>)}
          <div className="ed-seal" aria-hidden="true"><span>{d.seal || '★'}</span></div>
        </div>
        <div className="ed-cert-meta">{fmtDate(d.date || event.date)}{d.no ? ` · No. ${d.no}` : ''}</div>
      </div>
    </div>
  );
}

function Result({ d, event, student }) {
  const total = d.rows.reduce((a, r) => a + (typeof r[1] === 'number' ? r[1] : 0), 0);
  const max = d.rows.reduce((a, r) => a + (typeof r[2] === 'number' ? r[2] : 0), 0);
  return (
    <div className="ed-paper ed-result">
      <header className="ed-lh"><b>{d.org || 'NIST International School'}</b><span>{d.system || 'ManageBac'} · Assessment record</span></header>
      <dl className="ed-kv">
        <dt>Student</dt><dd>{student.name}</dd><dt>Course</dt><dd>{d.course}</dd>
        <dt>Task</dt><dd>{d.task}</dd><dt>Date</dt><dd>{fmtDate(d.date || event.date)}</dd>
      </dl>
      <table className="ed-table ed-marks"><thead><tr><th>{d.colA || 'Criterion'}</th><th>Mark</th><th>Out of</th></tr></thead>
        <tbody>{d.rows.map(([c, m, o]) => <tr key={c}><td>{c}</td><td><b>{m}</b></td><td>{o}</td></tr>)}</tbody>
        {d.noTotal ? null : <tfoot><tr><td>Total</td><td><b>{total}</b></td><td>{max}</td></tr></tfoot>}
      </table>
      {d.grade && <div className="ed-grade"><span>{d.gradeLabel || 'Final grade'}</span><b>{d.grade}</b>{d.scale && <small>{d.scale}</small>}</div>}
      {d.comment && <div className="ed-comment"><h4>Teacher comment</h4><p>{d.comment}</p><small>{d.by}</small></div>}
    </div>
  );
}

function Repo({ d }) {
  return (
    <div className="ed-repo">
      <div className="ed-repo-head"><span className="ed-repo-icon" aria-hidden="true">⌥</span><b>{d.repo}</b><span className="ed-pill">{d.private ? 'Private' : 'Public'}</span><span className="spacer" /><small>★ {d.stars ?? 0} · {d.commitCount || d.commits.length} commits</small></div>
      <p className="ed-repo-about">{d.about}</p>
      {d.lang && <div className="ed-langbar" aria-label="Languages">{d.lang.map(([l, p], i) => <i key={l} style={{ width: `${p}%`, background: LANG_COL[l] || ['#3572A5', '#f1e05a', '#e34c26', '#563d7c'][i % 4] }} title={`${l} ${p}%`} />)}</div>}
      {d.lang && <div className="ed-langs">{d.lang.map(([l, p], i) => <span key={l}><i style={{ background: LANG_COL[l] || ['#3572A5', '#f1e05a', '#e34c26', '#563d7c'][i % 4] }} />{l} <small>{p}%</small></span>)}</div>}
      <div className="ed-repo-grid">
        <ul className="ed-files">{d.files.map((f) => <li key={f}><span aria-hidden="true">{f.endsWith('/') ? '▸' : '·'}</span>{f}</li>)}</ul>
        <div className="ed-commits"><h4>Recent commits</h4><ul>{d.commits.map(([m, when]) => <li key={m}><code>{hash(m)}</code><span>{m}</span><small>{when}</small></li>)}</ul></div>
      </div>
      <div className="ed-readme"><div className="ed-readme-h">README.md</div><Blocks blocks={d.readme} /></div>
    </div>
  );
}
const LANG_COL = { Python: '#3572A5', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#563d7c', 'C++': '#f34b7d', 'C#': '#178600', 'Jupyter Notebook': '#DA5B0B', Arduino: '#00979D', TypeScript: '#3178c6', Scratch: '#F7A21B', KiCad: '#314cb0', Shell: '#89e051' };
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).slice(0, 7).padStart(7, '0');

function Video({ d, poster }) {
  return (
    <div className="ed-video">
      <div className="ed-player">{d.img || poster ? <img src={d.img || poster} alt="" /> : <div className="ed-poster" aria-hidden="true"><b>{d.title}</b></div>}<span className="ed-play" aria-hidden="true">▶</span><span className="ed-dur">{d.dur}</span></div>
      <h3>{d.title}</h3>
      <small className="ed-sub">{d.host || 'NIST Media'} · {d.views} views</small>
      <Blocks blocks={[].concat(d.desc)} />
      {d.chapters && <ol className="ed-chapters">{d.chapters.map(([t, l]) => <li key={t}><code>{t}</code>{l}</li>)}</ol>}
    </div>
  );
}

function Audio({ d }) {
  return (
    <div className="ed-audio">
      <div className="ed-cover" style={{ '--c': d.colour || 'var(--b-purple)' }}><b>{d.title}</b><small>{d.artist}</small></div>
      <div className="ed-audio-body">
        <small className="ed-sub">{d.host || 'NIST Music'} · {d.year || ''}</small>
        <ol className="ed-tracks">{d.tracks.map(([t, dur], i) => <li key={t}><span className="ed-play-s" aria-hidden="true">▶</span><span>{i + 1}. {t}</span><i className="ed-wave" aria-hidden="true" /><small>{dur}</small></li>)}</ol>
        <Blocks blocks={[].concat(d.desc || [])} />
      </div>
    </div>
  );
}

function Web({ d }) {
  return (
    <div className="ed-web">
      <div className="ed-browser"><span className="ed-dots" aria-hidden="true"><i /><i /><i /></span><span className="ed-url">{d.url}</span></div>
      <div className="ed-web-body">
        <div className="ed-web-site">{d.site}</div>
        <Blocks blocks={d.blocks} />
      </div>
    </div>
  );
}

function Sheet({ d }) {
  const cols = 'ABCDEFGHIJ'.slice(0, d.cols.length).split('');
  // Keep decimals consistent down a column (8 → 8.0 beside 7.4).
  const dp = d.cols.map((_, j) => Math.max(0, ...[...d.rows, d.foot || []].map((r) => (typeof r[j] === 'number' && !Number.isInteger(r[j]) ? String(r[j]).split('.')[1].length : 0))));
  const num = (c, j) => (typeof c === 'number' ? (dp[j] ? c.toFixed(dp[j]) : c.toLocaleString('en-GB')) : c);
  return (
    <div className="ed-sheet">
      <div className="ed-sheet-bar"><b>{d.file}</b><small>{d.app || 'Google Sheets'}</small></div>
      <div className="ed-tablewrap">
        <table className="ed-grid"><thead><tr><th />{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            <tr className="hd"><th>1</th>{d.cols.map((c) => <td key={c}>{c}</td>)}</tr>
            {d.rows.map((r, i) => <tr key={i}><th>{i + 2}</th>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'n' : ''}>{num(c, j)}</td>)}</tr>)}
            {d.foot && <tr className="ft"><th>{d.rows.length + 2}</th>{d.foot.map((c, j) => <td key={j} className={typeof c === 'number' ? 'n' : ''}>{num(c, j)}</td>)}</tr>}
          </tbody>
        </table>
      </div>
      <div className="ed-tabs">{(d.tabs || [d.tab || 'Sheet1']).map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}>{t}</span>)}</div>
      {d.note && <p className="fineprint">{d.note}</p>}
    </div>
  );
}

function Slides({ d }) {
  return (
    <div className="ed-slides">
      {d.slides.map(([title, pts], i) => (
        <div key={i} className={`ed-slide${i === 0 ? ' cover' : ''}`}>
          <small>{i + 1}</small><b>{title}</b>
          {pts && (Array.isArray(pts) ? <ul>{pts.map((p) => <li key={p}>{p}</li>)}</ul> : <p>{pts}</p>)}
        </div>
      ))}
    </div>
  );
}

function Doc({ d, event, student }) {
  return (
    <div className="ed-paper ed-docu">
      {d.letterhead !== false && <header className="ed-lh"><b>{d.org || 'NIST International School'}</b><span>{d.meta || `${student.name} · ${fmtDate(d.date || event.date)}`}</span></header>}
      {d.heading && <h3 className="ed-dtitle">{d.heading}</h3>}
      {d.sub && <p className="ed-dsub">{d.sub}</p>}
      <div className="ed-dbody"><Blocks blocks={d.blocks} /></div>
      {d.pages > 1 && <div className="ed-more">Page 1 of {d.pages}. {d.pages - 1} more page{d.pages > 2 ? 's' : ''} in the full {d.format || 'PDF'}.</div>}
    </div>
  );
}

const KIND = { cert: 'Certificate', result: 'Assessment record', repo: 'Code repository', video: 'Video', audio: 'Audio', web: 'Web page', sheet: 'Spreadsheet', slides: 'Slides', doc: 'Document' };
export const docLabel = (d) => d && (d.label || (d.t === 'doc' ? `${d.format || 'PDF'}${d.pages ? ` · ${d.pages} page${d.pages > 1 ? 's' : ''}` : ''}` : d.t === 'slides' ? `Slides · ${d.slides.length}` : d.t === 'video' ? `Video · ${d.dur}` : d.t === 'audio' ? `Audio · ${d.tracks.length} track${d.tracks.length > 1 ? 's' : ''}` : d.t === 'sheet' ? `Spreadsheet · ${d.rows.length} rows` : KIND[d.t]));

export default function EvidenceDoc({ d, event, student, poster }) {
  const Comp = { cert: Cert, result: Result, repo: Repo, video: Video, audio: Audio, web: Web, sheet: Sheet, slides: Slides, doc: Doc }[d.t] || Doc;
  return <div className={`ed ed-k-${d.t}`}><Comp d={d} event={event} student={student} poster={poster} first={first(student.name)} /></div>;
}
