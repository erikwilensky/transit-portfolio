import { useMemo, useState } from 'react';
import { exportPresentation } from '../api.js';

const starter = (id) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>My portfolio</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main id="app"></main>
  <script type="module">
    // Same read API, same visibility rules as Template and Builder.
    const res = await fetch('https://portfolio.school.example/api/v1/presentations/${id}/data');
    const { student, lines, stations } = await res.json();

    document.title = student.name;
    const app = document.querySelector('#app');
    app.innerHTML = \`<h1>\${student.name}</h1><p class="sub">\${student.programme} · Grade \${student.grade}</p>\`;
    for (const line of lines) {
      const stops = stations.filter((s) => s.lineIds.includes(line.id));
      app.insertAdjacentHTML('beforeend', \`
        <section style="--c:\${line.colour}">
          <h2>\${line.name}</h2>
          <ol>\${stops.map((s) => \`<li data-v="\${s.verification}">\${s.title}</li>\`).join('')}</ol>
        </section>\`);
    }
  </script>
</body>
</html>`;

const css = `body { font-family: system-ui, sans-serif; margin: 2rem; color: #1b1d22; }
h1 { margin: 0 0 .25rem; } .sub { color: #646a73; margin: 0 0 1.5rem; }
section { border-left: 8px solid var(--c); padding-left: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0 0 .4rem; font-size: 1.1rem; } ol { margin: 0; padding-left: 1.2rem; } li { margin: .2rem 0; }
li[data-v="school-verified"]::after  { content: " ●"; }
li[data-v="teacher-endorsed"]::after { content: " ○"; }
li[data-v="student-added"]::after    { content: " ◌"; }`;

export default function CodeView({ pres, map, lens }) {
  const data = useMemo(() => exportPresentation(pres, map, lens), [pres, map, lens]);
  const json = JSON.stringify(data, null, 2);
  const [tab, setTab] = useState('data.json');
  const files = { 'data.json': json, 'index.html': starter(pres.id), 'style.css': css };
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(files[tab]); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${pres.id}.json` });
    a.click(); URL.revokeObjectURL(url);
  };
  // The same starter files, rendered live with this presentation's data.
  const previewDoc = useMemo(() => starter(pres.id)
    .replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
    .replace(/const res = await fetch\([^)]*\);\n\s*const \{ student, lines, stations \} = await res\.json\(\);/, () => `const { student, lines, stations } = ${JSON.stringify(data).replace(/</g, '\\u003c')};`), [pres.id, data]);
  return (
    <div className="code-view fade-in">
      <div className="code-head">
        <code className="endpoint">GET /api/v1/presentations/{pres.id}/data</code>
        <span>{data.lines.length} lines · {data.stations.length} stations · publishable items only</span>
      </div>
      <div className="code-tabs" role="tablist">
        {Object.keys(files).map((f) => <button key={f} role="tab" aria-selected={tab === f} className={tab === f ? 'on' : ''} onClick={() => setTab(f)}>{f}</button>)}
        <span className="spacer" />
        <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button onClick={download}>Download JSON</button>
      </div>
      <div className="code-split">
        <pre className="code" tabIndex={0}><code>{tab === 'data.json' ? <Json text={json} /> : files[tab]}</code></pre>
        <div className="code-preview">
          <div className="code-preview-bar">Live preview: index.html rendered with this data</div>
          <iframe title="Rendered preview" sandbox="allow-scripts" srcDoc={previewDoc} />
        </div>
      </div>
    </div>
  );
}

function Json({ text }) {
  // Tiny syntax colouring: keys, strings, numbers.
  const parts = text.split(/("(?:[^"\\]|\\.)*"(?:\s*:)?|\b\d+\b|\bnull\b|\btrue\b|\bfalse\b)/g);
  return parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const cls = p.endsWith(':') ? 'k' : p.startsWith('"') ? 's' : 'n';
    return <span key={i} className={`j-${cls}`}>{p}</span>;
  });
}
