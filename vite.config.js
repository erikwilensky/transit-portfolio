import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Phone app: dist/sw.js gets this build's version and its entry scripts and styles to cache (public/sw.js).
function serviceWorker() {
  let cfg, files = [], shell = [];
  return {
    name: 'tp-service-worker',
    apply: 'build',
    configResolved(c) { cfg = c; },
    generateBundle(_, bundle) {
      files = Object.keys(bundle).sort();
      shell = Object.values(bundle).filter((f) => (f.type === 'chunk' ? f.isEntry : f.fileName.endsWith('.css'))).map((f) => f.fileName);
    },
    closeBundle() {
      if (cfg.build.ssr) return;
      const src = fs.readFileSync(path.resolve(cfg.root, 'public/sw.js'), 'utf8');
      const version = crypto.createHash('sha256').update(files.join('\n') + src).digest('hex').slice(0, 12);
      fs.writeFileSync(path.resolve(cfg.root, cfg.build.outDir, 'sw.js'), src.replace("const VERSION = 'dev';", `const VERSION = '${version}';`).replace('const SHELL = [];', `const SHELL = ${JSON.stringify(shell)};`));
    },
  };
}

// Display options (src/a11y.js): every CSS font size in px scales with --ts, set on <html> by the text-size choice.
function textScale() {
  return { name: 'tp-text-scale', enforce: 'pre', transform(code, id) { if (/\.css($|\?)/.test(id)) return { code: code.replace(/font-size:\s*([\d.]+)px/g, 'font-size: calc($1px * var(--ts, 1))'), map: null }; } };
}

// base './' keeps asset paths relative so dist/ works from any folder or URL path.
// In dev, /api goes to the pilot server (npm run server, port 8787).
// `vite preview` stands for plain static hosting (no server), so it does not proxy /api.
export default defineConfig({ base: './', plugins: [react(), serviceWorker(), textScale()], server: { proxy: { '/api': 'http://localhost:8787' } }, preview: { proxy: {} } });
