// Sign-in behind cloudflared, "forgot password", sessions, advisor links and the SMTP client.
// Starts real pilot servers on free ports. Run: npm run test:server (after npm run build:server).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
process.env.DATA_DIR = tmp('tp-auth-unit-');
const { sendMail } = await import('../mail.mjs');
const freePort = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
const kids = [];
after(() => kids.forEach((p) => p.kill()));

async function start(env = {}) {
  const port = await freePort();
  const p = spawn(process.execPath, ['server/index.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), TP_MODE: 'pilot', DATA_DIR: tmp('tp-auth-'), LOG_REQUESTS: '1', ...env } });
  kids.push(p);
  let log = '';
  await new Promise((resolve, reject) => {
    p.stdout.on('data', (d) => { log += d; if (/server on :/.test(log)) resolve(); });
    p.stderr.on('data', (d) => { log += d; });
    p.on('exit', (c) => reject(new Error(`server exited ${c}: ${log}`)));
  });
  const U = `http://localhost:${port}`;
  const call = async (method, url, body, { cookie, ip } = {}) => {
    const r = await fetch(U + url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(ip ? { 'cf-connecting-ip': ip } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get('set-cookie');
    return { status: r.status, json: await r.json().catch(() => ({})), cookie: set?.split(';')[0], setCookie: set };
  };
  // First admin, from the one-time link in the log.
  const first = log.match(/#\/setup\/(\S+)/)[1];
  const adm = await call('POST', '/api/auth/setup', { token: first, password: 'admin-pass-123', name: 'Pat Admin', email: 'admin@nist.ac.th' });
  const tokenOf = (url) => url.split('#/setup/')[1];
  const account = async (body, password) => {
    const c = await call('POST', '/api/admin/accounts', body, { cookie: adm.cookie });
    assert.equal(c.status, 201, JSON.stringify(c.json));
    const s = await call('POST', '/api/auth/setup', { token: tokenOf(c.json.setupUrl), password });
    return { id: c.json.account.id, cookie: s.cookie };
  };
  return { p, U, call, admin: adm.cookie, account, tokenOf, log: () => log };
}

test('failed sign-ins are counted per visitor (CF-Connecting-IP) and per email, not per gateway', async () => {
  const S = await start({ AUTH_IP_LIMIT: '20' });
  const login = (email, password, ip) => S.call('POST', '/api/auth/login', { email, password }, { ip });
  for (let i = 0; i < 20; i++) assert.equal((await login(`nobody${i}@nist.ac.th`, 'wrong', '198.51.100.7')).status, 401);
  const blocked = await login('admin@nist.ac.th', 'admin-pass-123', '198.51.100.7');
  assert.equal(blocked.status, 429, 'the one address that failed 20 times is blocked');
  assert.equal(blocked.json.error, 'Too many tries. Wait 15 minutes or ask your teacher.');
  assert.equal((await login('admin@nist.ac.th', 'admin-pass-123', '198.51.100.8')).status, 200, 'another visitor through the same tunnel signs in');
  assert.equal((await login('admin@nist.ac.th', 'admin-pass-123')).status, 200, 'and so does the gateway itself');
  assert.ok(S.log().includes(' 198.51.100.7 POST /api/auth/login 429'), 'the log shows the visitor, not the gateway');
});

test('the per-email limit stays strict, and a new link lifts it', async () => {
  const A = await import('../auth.mjs');
  for (let i = 0; i < 9; i++) A.noteFailure('ploy@nist.ac.th', `203.0.113.${i}`);
  assert.equal(A.throttle('ploy@nist.ac.th', '203.0.113.99').blocked, undefined);
  assert.ok(A.throttle('ploy@nist.ac.th', '203.0.113.99').delay > 0, 'slowed after 3');
  A.noteFailure('ploy@nist.ac.th', '203.0.113.9');
  assert.equal(A.throttle('ploy@nist.ac.th', '203.0.113.99').blocked, true, '10 failures from anywhere lock that email');
  assert.equal(A.throttle('other@nist.ac.th', '203.0.113.1').delay, 0, 'other emails on those addresses are not slowed');
  for (let i = 0; i < 299; i++) A.noteFailure(`x${i}@nist.ac.th`, '192.0.2.1');
  assert.ok(!A.throttle('fresh@nist.ac.th', '192.0.2.1').blocked, '299 failures from one school address: still open');
  A.noteFailure('x@nist.ac.th', '192.0.2.1');
  assert.equal(A.throttle('fresh@nist.ac.th', '192.0.2.1').blocked, true, '300 block that address');
  const a = A.createAccount({ email: 'ploy@nist.ac.th', name: 'Ploy', kind: 'admin' });
  A.newSetup(a);
  assert.ok(!A.throttle('ploy@nist.ac.th', '203.0.113.99').blocked, 'a new sign-in link lifts the email block');
});

test('cookies are Secure behind cloudflared over https', async () => {
  const S = await start();
  const r = await fetch(`${S.U}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-visitor': '{"scheme":"https"}' }, body: JSON.stringify({ email: 'admin@nist.ac.th', password: 'admin-pass-123' }) });
  assert.match(r.headers.get('set-cookie'), /; Secure/);
  const plain = await S.call('POST', '/api/auth/login', { email: 'admin@nist.ac.th', password: 'admin-pass-123' });
  assert.doesNotMatch(plain.setCookie, /Secure/);
});

test('forgot password never says whether an account exists, and an admin answers it', async () => {
  const S = await start();
  const ploy = await S.account({ email: 'ploy@nist.ac.th', name: 'Ploy Srisuk', kind: 'student', studentId: 'st-01' }, 'ploy-pass-123');
  const known = await S.call('POST', '/api/auth/forgot', { email: 'Ploy@nist.ac.th ' });
  const unknown = await S.call('POST', '/api/auth/forgot', { email: 'nobody@nist.ac.th' });
  const junk = await S.call('POST', '/api/auth/forgot', {});
  assert.equal(known.status, 200);
  assert.deepEqual(known, unknown); assert.deepEqual(known, junk);
  assert.deepEqual(known.json, { ok: true, emailed: false });
  for (let i = 0; i < 5; i++) assert.deepEqual(await S.call('POST', '/api/auth/forgot', { email: 'ploy@nist.ac.th' }), known, 'same answer past the per-email limit');
  await new Promise((r) => setTimeout(r, 100));
  const list = (await S.call('GET', '/api/admin/accounts', null, { cookie: S.admin })).json.accounts;
  const req = list.find((a) => a.id === ploy.id).resetRequest;
  assert.ok(req?.at && req.n === 3, `request noted, counted up to the limit: ${JSON.stringify(req)}`);
  assert.ok(!list.some((a) => a.email === 'nobody@nist.ac.th'));
  assert.equal((await S.call('GET', '/api/auth/me', null, { cookie: ploy.cookie })).json.user.kind, 'student', 'asking signs nobody out');
  assert.equal((await S.call('POST', `/api/admin/accounts/${ploy.id}/dismiss`, null, { cookie: ploy.cookie })).status, 403, 'only an admin dismisses');
  const reset = await S.call('POST', `/api/admin/accounts/${ploy.id}/reset`, null, { cookie: S.admin });
  assert.equal(reset.json.emailed, false);
  assert.equal(reset.json.accounts.find((a) => a.id === ploy.id).resetRequest, undefined, 'a new link answers the request');
  await S.call('POST', '/api/auth/forgot', { email: 'ploy@nist.ac.th' });
  const d = await S.call('POST', `/api/admin/accounts/${ploy.id}/dismiss`, null, { cookie: S.admin });
  assert.ok(d.status === 200 && !d.json.accounts.find((a) => a.id === ploy.id).resetRequest, 'dismiss clears it');
});

test('sessions: count, password change ends the others, sign out everywhere', async () => {
  const S = await start();
  const login = async () => (await S.call('POST', '/api/auth/login', { email: 'admin@nist.ac.th', password: 'admin-pass-123' })).cookie;
  const [c1, c2] = [await login(), await login()];
  assert.equal((await S.call('GET', '/api/auth/sessions', null, { cookie: c1 })).json.devices, 3);
  assert.equal((await S.call('POST', '/api/auth/password', { current: 'admin-pass-123', password: 'admin-pass-456' }, { cookie: c1 })).status, 200);
  assert.equal((await S.call('GET', '/api/auth/me', null, { cookie: c2 })).json.user, null, 'other device signed out');
  assert.equal((await S.call('GET', '/api/auth/sessions', null, { cookie: c1 })).json.devices, 1);
  const c3 = (await S.call('POST', '/api/auth/login', { email: 'admin@nist.ac.th', password: 'admin-pass-456' })).cookie;
  const out = await S.call('POST', '/api/auth/logout-everywhere', null, { cookie: c1 });
  assert.match(out.setCookie, /Max-Age=0/);
  for (const c of [c1, c3]) assert.equal((await S.call('GET', '/api/auth/me', null, { cookie: c })).json.user, null);
  assert.equal((await S.call('GET', '/api/auth/sessions')).status, 401);
});

test('an advisor makes a new sign-in link only for students in their own advisory', async () => {
  const S = await start();
  const adv = await S.account({ email: 'whitfield@nist.ac.th', name: 'James Whitfield', kind: 'advisor', teacherId: 't-07' }, 'adv-pass-1234');
  const other = await S.account({ email: 'other@nist.ac.th', name: 'Other Teacher', kind: 'teacher', teacherId: 't-11' }, 'oth-pass-1234');
  const st1 = await S.account({ email: 'maya@nist.ac.th', name: 'Maya', kind: 'student', studentId: 'st-01' }, 'maya-pass-123');
  await S.account({ email: 'pim@nist.ac.th', name: 'Pim', kind: 'student', studentId: 'st-09' }, 'pim-pass-1234');
  await S.call('POST', '/api/auth/forgot', { email: 'maya@nist.ac.th' }); await new Promise((r) => setTimeout(r, 100));
  const g = await S.call('GET', '/api/advisor/students/st-01/account', null, { cookie: adv.cookie });
  assert.equal(g.status, 200); assert.ok(g.json.account.resetRequest, 'the advisor sees the request');
  assert.equal(Object.keys(g.json.account).sort().join(), 'email,hasPassword,id,name,resetRequest');
  assert.equal((await S.call('POST', '/api/advisor/students/st-09/reset', null, { cookie: adv.cookie })).status, 403, 'not their advisee');
  assert.equal((await S.call('POST', '/api/advisor/students/st-01/reset', null, { cookie: other.cookie })).status, 403, 'not their advisor');
  assert.equal((await S.call('POST', '/api/advisor/students/st-01/reset', null, { cookie: st1.cookie })).status, 403, 'not a student');
  assert.equal((await S.call('POST', '/api/advisor/students/st-02/reset', null, { cookie: adv.cookie })).status, 404, 'advisee without an account');
  const r = await S.call('POST', '/api/advisor/students/st-01/reset', null, { cookie: adv.cookie });
  assert.equal(r.status, 200); assert.match(r.json.setupUrl, /#\/setup\//);
  assert.equal(r.json.account.resetRequest, null);
  assert.equal((await S.call('GET', '/api/auth/me', null, { cookie: st1.cookie })).json.user, null, 'the old sessions end');
  assert.equal((await S.call('POST', '/api/auth/setup', { token: S.tokenOf(r.json.setupUrl), password: 'maya-new-1234' })).status, 200);
});

// ── A fake SMTP server: STARTTLS (with a throwaway certificate), AUTH PLAIN or LOGIN ──
function fakeSmtp({ key, cert, auth = 'PLAIN LOGIN' }) {
  const got = [];
  const srv = net.createServer((raw) => {
    const m = { lines: [], tls: false }; got.push(m);
    let sock = raw, buf = '', data = null;
    const say = (s) => sock.write(`${s}\r\n`);
    const on = (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data !== null) { if (l === '.') { m.data = data; data = null; say('250 queued'); } else data += `${l}\r\n`; continue; }
        m.lines.push(l);
        const v = l.toUpperCase();
        if (v.startsWith('EHLO')) say(['250-fake', ...(key && !m.tls ? ['250-STARTTLS'] : []), ...(m.tls || !key ? [`250-AUTH ${auth}`] : []), '250 8BITMIME'].join('\r\n'));
        else if (v === 'STARTTLS') {
          say('220 go'); sock.removeListener('data', on);
          sock = new tls.TLSSocket(raw, { isServer: true, key, cert }); m.tls = true; sock.setEncoding('latin1'); sock.on('data', on); sock.on('error', () => {});
        } else if (v.startsWith('AUTH PLAIN ')) { m.auth = Buffer.from(l.slice(11), 'base64').toString(); say('235 ok'); }
        else if (v === 'AUTH LOGIN') { m.login = []; say('334 VXNlcm5hbWU6'); }
        else if (m.login && m.login.length < 2 && !/^[A-Z]+ /.test(l)) { m.login.push(Buffer.from(l, 'base64').toString()); say(m.login.length === 1 ? '334 UGFzc3dvcmQ6' : '235 ok'); }
        else if (v.startsWith('MAIL FROM') || v.startsWith('RCPT TO')) say('250 ok');
        else if (v === 'DATA') { data = ''; say('354 go'); }
        else if (v === 'QUIT') { say('221 bye'); sock.end(); }
        else say('500 what');
      }
    };
    raw.setEncoding('latin1'); raw.on('data', on); raw.on('error', () => {});
    say('220 fake ESMTP');
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, got, close: () => srv.close() })));
}
const decode = (data) => { const [head, body] = data.split('\r\n\r\n'); return { head, text: Buffer.from(body.replace(/\s/g, ''), 'base64').toString() }; };
let pem = null;
try {
  const dir = tmp('tp-cert-');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`], { stdio: 'ignore' });
  pem = { key: fs.readFileSync(`${dir}/k.pem`), cert: fs.readFileSync(`${dir}/c.pem`) };
} catch { /* no openssl: the STARTTLS test is skipped */ }

test('SMTP: STARTTLS, then AUTH PLAIN, headers and a base64 body', { skip: !pem && 'openssl not found' }, async () => {
  const f = await fakeSmtp(pem);
  await sendMail({ to: 'Ploy <ploy@nist.ac.th>', subject: 'Ihr Link für Transit', text: 'Hello\n.\nhttps://x/#/setup/abc\n' },
    { url: `smtp://me%40nist.ac.th:p%40ss%3Aword@localhost:${f.port}`, from: 'Transit Portfolio <noreply@nist.ac.th>', tlsOptions: { ca: pem.cert } });
  const m = f.got[0];
  assert.ok(m.tls, 'upgraded to TLS'); assert.equal(m.auth, '\0me@nist.ac.th\0p@ss:word');
  assert.ok(!m.lines.slice(0, m.lines.indexOf('STARTTLS') + 1).some((l) => /^AUTH/i.test(l)), 'no AUTH before TLS');
  assert.ok(m.lines.includes('MAIL FROM:<noreply@nist.ac.th>') && m.lines.includes('RCPT TO:<ploy@nist.ac.th>'));
  const { head, text } = decode(m.data);
  assert.match(head, /^Subject: =\?UTF-8\?B\?/m); assert.match(head, /^From: Transit Portfolio <noreply@nist.ac.th>/m);
  assert.equal(text, 'Hello\r\n.\r\nhttps://x/#/setup/abc\r\n');
  f.close();
});

test('SMTP: refuses a bad certificate, header injection and an unknown scheme', { skip: !pem && 'openssl not found' }, async () => {
  const f = await fakeSmtp(pem);
  await assert.rejects(sendMail({ to: 'a@b.c', subject: 's', text: 't' }, { url: `smtp://u:p@localhost:${f.port}`, from: 'n@b.c' }), /self.signed|certificate/i);
  await assert.rejects(sendMail({ to: 'a@b.c', subject: 's\r\nBcc: x@y.z', text: 't' }, { url: `smtp://u:p@localhost:${f.port}`, from: 'n@b.c', tlsOptions: { ca: pem.cert } }), /Line break/);
  await assert.rejects(sendMail({ to: 'a@b.c', subject: 's', text: 't' }, { url: 'http://x', from: 'n@b.c' }), /smtp:\/\//);
  f.close();
});

test('with SMTP set up, forgot emails a link, the old password works until it is used, and nothing is logged', async () => {
  const f = await fakeSmtp({ auth: 'LOGIN' }); // plain on localhost, AUTH LOGIN
  const S = await start({ SMTP_URL: `smtp://mailer:secret-pass@localhost:${f.port}`, MAIL_FROM: 'Transit <noreply@nist.ac.th>' });
  const c = await S.call('POST', '/api/admin/accounts', { email: 'ploy@nist.ac.th', name: 'Ploy Srisuk', kind: 'student', studentId: 'st-01' }, { cookie: S.admin });
  assert.equal(c.json.emailed, true, 'the setup link was emailed');
  assert.ok(decode(f.got.at(-1).data).text.includes(c.json.setupUrl));
  assert.deepEqual(f.got.at(-1).login, ['mailer', 'secret-pass']);
  await S.call('POST', '/api/auth/setup', { token: S.tokenOf(c.json.setupUrl), password: 'ploy-pass-123' });
  const n = f.got.length;
  const r = await S.call('POST', '/api/auth/forgot', { email: 'ploy@nist.ac.th' });
  assert.deepEqual(r.json, { ok: true, emailed: true });
  assert.deepEqual(await S.call('POST', '/api/auth/forgot', { email: 'nobody@nist.ac.th' }), r);
  for (let i = 0; i < 50 && f.got.length === n; i++) await new Promise((res) => setTimeout(res, 50));
  await new Promise((res) => setTimeout(res, 100));
  assert.equal(f.got.length, n + 1, 'one email, only for the real account');
  const { head, text } = decode(f.got.at(-1).data);
  assert.match(head, /^To: ploy@nist.ac.th/m);
  const url = text.match(/https?:\S+#\/setup\/\S+/)[0];
  assert.equal((await S.call('POST', '/api/auth/login', { email: 'ploy@nist.ac.th', password: 'ploy-pass-123' })).status, 200, 'old password still works');
  assert.equal((await S.call('POST', '/api/auth/setup', { token: S.tokenOf(url), password: 'ploy-new-1234' })).status, 200);
  assert.equal((await S.call('POST', '/api/auth/login', { email: 'ploy@nist.ac.th', password: 'ploy-pass-123' })).status, 401, 'then it ends');
  const accounts = (await S.call('GET', '/api/admin/accounts', null, { cookie: S.admin })).json.accounts;
  assert.ok(!accounts.find((a) => a.email === 'ploy@nist.ac.th').resetRequest, 'emailed, so no request for the admin');
  assert.ok(!S.log().includes(S.tokenOf(url)) && !S.log().includes('secret-pass'), 'no token or mail password in the log');
  f.close();
});
