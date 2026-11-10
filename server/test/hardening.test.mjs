// Cross-cutting hardening on a real demo server: an open share link cannot be used to flood a student, and a change that
// fails on malformed arguments answers in plain words, never the code's own error text. Run: npm run test:server.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = await new Promise((r) => { const s = net.createServer().listen(0, () => { const { port: p } = s.address(); s.close(() => r(p)); }); });
const U = `http://localhost:${port}`;
const srv = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'demo', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tp-hard-')), LOG_REQUESTS: '0' } });
await new Promise((resolve, reject) => {
  let out = '';
  const t = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 15000);
  srv.stdout.on('data', (d) => { out += d; if (/server on :/.test(out)) { clearTimeout(t); resolve(); } });
  srv.stderr.on('data', (d) => { out += d; });
});
after(() => srv.kill());
const views = async () => (await (await fetch(`${U}/api/state`)).json()).snapshot.store.linkViews['tp-g3n2'] || 0;

test('one address opening a share link over and over counts only the first views', async () => {
  const before = await views();
  for (let i = 0; i < 30; i++) assert.equal((await fetch(`${U}/api/public/share/tp-g3n2`)).status, 200, 'the page still opens');
  assert.equal(await views() - before, 20);
});

test('requests for more time from one address stop after a few', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await fetch(`${U}/api/public/share/tp-g3n2/extend`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});

test('a change with malformed arguments does not show the code\'s error text', async () => {
  const r = await fetch(`${U}/api/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn: 'addStation', args: ['st-01', null] }) });
  const j = await r.json();
  assert.equal(r.status, 422);
  assert.equal(j.error, 'That change could not be made.');
});
