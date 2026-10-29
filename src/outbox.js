// Offline capture (docs/pilot-server.md, "Offline capture"): the changes and photos this browser has not sent yet,
// kept in IndexedDB per signed-in account so they survive closing or reloading the app. Each row: { k, uid, url, body }
// for a change, or { k, uid, upload: { key, name, type }, blob } for a photo taken offline. Rows go in order (k).
// No IndexedDB (a private window, blocked storage, Node): the same calls work in memory for this page only.
const DB = 'tp-outbox', STORE = 'items';
let dbp = null, memK = 0;
const mem = [];

function open() {
  dbp ||= new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') return ok(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'k', autoIncrement: true }).createIndex('uid', 'uid');
      r.onsuccess = () => ok(r.result);
      r.onerror = r.onblocked = () => ok(null);
    } catch { ok(null); }
  });
  return dbp;
}
// One request in its own transaction; null on any failure (the caller then falls back to memory).
async function req(mode, fn) {
  const db = await open();
  if (!db) return undefined;
  try {
    return await new Promise((ok, no) => {
      const tx = db.transaction(STORE, mode); const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => ok(r?.result); tx.onerror = tx.onabort = () => no(tx.error);
    });
  } catch { return undefined; }
}

// → the row's key
export async function add(uid, row) {
  const k = await req('readwrite', (s) => s.add({ ...row, uid }));
  if (k !== undefined) return k;
  mem.push({ ...row, uid, k: `m${++memK}` });
  return `m${memK}`;
}
export async function remove(k) {
  if (typeof k === 'string' && k.startsWith('m')) { const i = mem.findIndex((r) => r.k === k); if (i >= 0) mem.splice(i, 1); return; }
  await req('readwrite', (s) => s.delete(k));
}
export async function update(k, patch) {
  const m = mem.find((r) => r.k === k);
  if (m) return Object.assign(m, patch);
  const db = await open(); if (!db) return;
  try {
    await new Promise((ok, no) => {
      const tx = db.transaction(STORE, 'readwrite'); const s = tx.objectStore(STORE); const g = s.get(k);
      g.onsuccess = () => g.result && s.put({ ...g.result, ...patch });
      tx.oncomplete = ok; tx.onerror = tx.onabort = () => no(tx.error);
    });
  } catch { /* the page still has it in memory */ }
}
// This account's rows, oldest first.
export async function list(uid) {
  const rows = (await req('readonly', (s) => s.index('uid').getAll(uid))) || [];
  return [...rows.sort((a, b) => a.k - b.k), ...mem.filter((r) => r.uid === uid)];
}
// Signing out: this account's rows only. Another account's stay, for when they sign in again.
export async function clear(uid) {
  for (let i = mem.length - 1; i >= 0; i--) if (mem[i].uid === uid) mem.splice(i, 1);
  const rows = (await req('readonly', (s) => s.index('uid').getAllKeys(uid))) || [];
  if (rows.length) await req('readwrite', (s) => { rows.forEach((k) => s.delete(k)); return null; });
}
// Changes waiting (photos are part of the change that uses them, so they do not count on their own).
export const waiting = (rows) => rows.filter((r) => !r.upload).length;

// A photo taken offline is shown from a placeholder, blob:<object url>#tpq-<key>; once it is uploaded every change that
// names it is rewritten to the real address (api/files/<id>.<ext>). A key with no address yet is left as it is.
export const PLACEHOLDER = /blob:[^"#\s\\]+#tpq-([\w-]+)/g;
export const swapUrls = (text, urls) => text.replace(PLACEHOLDER, (m, key) => (Object.hasOwn(urls, key) ? urls[key] : m));
export const isPlaceholder = (url) => /^blob:[^#]+#tpq-[\w-]+$/.test(url || '');

// The words for it. simple: a younger student's plain words.
export function waitingText(n, { simple = false, offline = true } = {}) {
  if (!n) return '';
  if (simple) return offline ? 'Saved on this phone. It will send when you are back online.' : 'Sending what you saved on this phone…';
  const c = `${n} change${n === 1 ? '' : 's'}`;
  return offline ? `${c} waiting. Saved on this phone. ${n === 1 ? 'It' : 'They'} will send when you are back online.` : `Sending ${c} saved on this phone…`;
}
export const signOutWarning = (n) => `${n} change${n === 1 ? ' is' : 's are'} not sent yet. Sign out anyway?`;
