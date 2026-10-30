// Leaver portfolio share links (#/l/<token>), for universities, scholarships and employers. No sign-in.
// The answer is api.leaverView: only the items the student picked, checked again (never private, never hidden).
import { send } from '../lib.mjs';
import { api } from '../store.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
const GONE = 'This link does not exist or has been withdrawn. Ask the student for a new link.';

export function findLeaverLink(token) {
  for (const [sid, p] of Object.entries(api.getStore().leaver || {})) {
    const link = (p.links || []).find((l) => l.token === token);
    if (!link) continue;
    if (link.revoked) break;
    if (link.expiresAt < api.TODAY) throw fail(410, 'This link has expired. Ask the student for a new link.');
    return { sid, link };
  }
  throw fail(404, GONE);
}

export function leaverPublic(token) {
  const { sid, link } = findLeaverLink(token);
  const view = api.leaverView(sid);
  if (!view) throw fail(404, GONE);
  return { portfolio: view, expiresAt: link.expiresAt };
}

// Files an open leaver link shows (server/files.mjs lets anyone open them while the link is open).
export function leaverPublicFiles() {
  const out = [];
  for (const p of Object.values(api.getStore().leaver || {})) for (const l of p.links || []) {
    if (!api.leaverLinkOpen(l)) continue;
    try { out.push(JSON.stringify(leaverPublic(l.token).portfolio)); } catch { /* no longer opens */ }
  }
  return out;
}

export default (app) => {
  app.get('/api/public/leaver/:token', (req, res, { token }) => send(res, 200, leaverPublic(token)));
};
