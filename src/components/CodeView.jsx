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

const css = `section { border-left: 8px solid var(--c); padding-left: 1rem; }
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
      <pre className="code" tabIndex={0}><code>{tab === 'data.json' ? <Json text={json} /> : files[tab]}</code></pre>
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
