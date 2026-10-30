// Public pages for readers outside the school: share links (#/s/<token>) and verify codes (#/v, #/v/<code>).
// They never load or sync the full record: the server sends only what the link or code shares.
// Used by main.jsx (skip full sync) and App.jsx (render from the server's pruned copy).
export const PUBLIC_KINDS = ['s', 'v', 'l']; // l: a leaver portfolio link (src/components/Leaver.jsx)
export const publicKindOf = (hash = globalThis.location?.hash || '') => {
  const k = hash.replace(/^#\/?/, '').split('/')[0];
  return PUBLIC_KINDS.includes(k) ? k : null;
};
export const isPublicRoute = (hash) => publicKindOf(hash) !== null;
