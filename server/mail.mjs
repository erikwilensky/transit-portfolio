// Optional email: a minimal SMTP client (no dependencies) for setup and "forgot password" links.
// On when SMTP_URL and MAIL_FROM are set:
//   SMTP_URL=smtp://user:pass@smtp.example.org:587   STARTTLS, required before AUTH (except on localhost)
//   SMTP_URL=smtps://user:pass@smtp.example.org:465  TLS from the start
//   MAIL_FROM="Transit Portfolio <noreply@example.org>"
// User and password are URL-encoded in SMTP_URL (@ → %40). AUTH PLAIN, else AUTH LOGIN.
// Never logs the password, the message or the link in it; errors carry only the server's reply code.
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';

export const mailReady = () => !!(process.env.SMTP_URL && process.env.MAIL_FROM);
const clean = (s) => { if (/[\r\n]/.test(String(s))) throw new Error('Line break in a mail header'); return String(s); };
const addr = (s) => clean(String(s).match(/<([^<>]+)>/)?.[1] || s).trim();
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);
const b64lines = (s) => Buffer.from(s).toString('base64').replace(/.{1,76}/g, '$&\r\n');

// Reads SMTP replies ("250-..." lines continue, "250 ..." ends one) from whichever socket is current.
function replies() {
  let buf = '', lines = [], queue = [], wait = null, fail = null;
  const push = (r) => { if (wait) { const w = wait; wait = null; w(r); } else queue.push(r); };
  const api = {
    data(d) {
      buf += d.toString('latin1');
      if (buf.length > 64 * 1024) return api.error(new Error('SMTP reply too long'));
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); lines.push(l);
        if (!/^\d{3}-/.test(l)) { push({ code: Number(l.slice(0, 3)) || 0, lines: lines.map((x) => x.slice(4)) }); lines = []; }
      }
    },
    error(e) { fail = fail || e; if (wait) { const w = wait; wait = null; w(null); } },
    next: () => (queue.length ? Promise.resolve(queue.shift()) : fail ? Promise.resolve(null) : new Promise((r) => { wait = r; })),
    get fail() { return fail; },
  };
  return api;
}

export async function sendMail({ to, subject, text }, { url = process.env.SMTP_URL, from = process.env.MAIL_FROM, tlsOptions = {}, timeout = 20000 } = {}) {
  const u = new URL(url);
  const secure = u.protocol === 'smtps:';
  if (!secure && u.protocol !== 'smtp:') throw new Error('SMTP_URL must start with smtp:// or smtps://');
  const host = u.hostname.replace(/^\[|\]$/g, ''), port = Number(u.port) || (secure ? 465 : 587);
  const user = decodeURIComponent(u.username), pass = decodeURIComponent(u.password);
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const rcpt = addr(to), sender = addr(from);
  const r = replies();
  let sock = secure ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, ...tlsOptions }) : net.connect({ host, port });
  const attach = (s) => { s.on('data', r.data); s.on('error', r.error); s.on('close', () => r.error(new Error('SMTP connection closed'))); s.setTimeout(timeout, () => { r.error(new Error('SMTP timed out')); s.destroy(); }); };
  attach(sock);
  const expect = async (ok, what) => {
    const rep = await r.next();
    if (!rep) throw new Error(`SMTP ${what}: ${r.fail?.message || 'no reply'}`);
    if (!ok.includes(rep.code)) throw new Error(`SMTP ${what} refused (${rep.code})`);
    return rep;
  };
  const cmd = (line, ok, what) => { sock.write(`${line}\r\n`); return expect(ok, what); };
  const me = clean(os.hostname().replace(/[^\w.-]/g, '') || 'localhost');
  try {
    await expect([220], 'greeting');
    let ehlo = await cmd(`EHLO ${me}`, [250], 'EHLO');
    const has = (re) => ehlo.lines.some((l) => re.test(l));
    if (!secure) {
      if (has(/^STARTTLS\b/i)) {
        await cmd('STARTTLS', [220], 'STARTTLS');
        sock.removeAllListeners('data'); sock.removeAllListeners('error'); sock.removeAllListeners('close'); sock.setTimeout(0);
        const plain = sock;
        sock = tls.connect({ socket: plain, servername: net.isIP(host) ? undefined : host, ...tlsOptions });
        attach(sock);
        await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
        ehlo = await cmd(`EHLO ${me}`, [250], 'EHLO');
      } else if (user && !local) throw new Error('SMTP server offers no STARTTLS; refusing to send the password unencrypted');
    }
    if (user) {
      const auth = ehlo.lines.find((l) => /^AUTH\b/i.test(l)) || '';
      if (/\bPLAIN\b/i.test(auth)) await cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, [235], 'AUTH');
      else if (/\bLOGIN\b/i.test(auth)) {
        await cmd('AUTH LOGIN', [334], 'AUTH');
        await cmd(Buffer.from(user).toString('base64'), [334], 'AUTH');
        await cmd(Buffer.from(pass).toString('base64'), [235], 'AUTH');
      } else throw new Error('SMTP server offers neither AUTH PLAIN nor AUTH LOGIN');
    }
    await cmd(`MAIL FROM:<${sender}>`, [250], 'MAIL FROM');
    await cmd(`RCPT TO:<${rcpt}>`, [250, 251], 'RCPT TO');
    await cmd('DATA', [354], 'DATA');
    const headers = [`From: ${clean(from)}`, `To: ${rcpt}`, `Subject: ${word(clean(subject))}`, `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${sender.split('@')[1] || me}>`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64'];
    // Base64 lines never start with a dot, so no dot-stuffing is needed.
    sock.write(`${headers.join('\r\n')}\r\n\r\n${b64lines(String(text).replace(/\r?\n/g, '\r\n'))}.\r\n`);
    await expect([250], 'message');
    sock.write('QUIT\r\n');
  } finally {
    setTimeout(() => sock.destroy(), 200).unref();
  }
}

// The setup or reset link, by email. kind: 'new' (account made), 'reset' (an admin or advisor made a new
// link: the old password has ended) or 'forgot' (asked for from the sign-in page: the old password still
// works until the link is used). Resolves true when sent; false (and one log line, no link) when not.
export async function mailLink({ to, name, url, kind = 'new' }) {
  if (!mailReady()) return false;
  const first = String(name || '').split(' ')[0] || 'there';
  const intro = { new: 'Your Transit Portfolio account is ready. Open this link to choose your password.', reset: 'Here is a new sign-in link for Transit Portfolio. Open it to choose a new password. Your old password no longer works.', forgot: 'Someone (we hope you) asked for a new Transit Portfolio sign-in link. Open it to choose a new password.' }[kind];
  const after = kind === 'forgot' ? ' If you did not ask for it, ignore this email: your password stays as it is.' : '';
  const text = `Hello ${first},\n\n${intro}\n\n${url}\n\nIt works once and expires in 7 days.${after}\n`;
  try { await sendMail({ to, subject: kind === 'new' ? 'Set up your Transit Portfolio account' : 'Your new Transit Portfolio sign-in link', text }); return true; }
  catch (e) { console.error(`Mail not sent: ${e.message}`); return false; }
}
