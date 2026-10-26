import { useEffect, useState } from 'react';

// Evidence documents are only needed once someone opens a station, so they load on demand.
let cache = null;
let pending = null;
const load = () => (pending ||= import('./index.js').then((m) => (cache = m.DOCS)));
export function useEvidenceDocs() {
  const [docs, setDocs] = useState(cache);
  useEffect(() => { if (!cache) load().then(setDocs); }, []);
  return docs;
}
// A document can be written for one station, or (under '*') for any station with that caption.
// Functions are filled in for the student and station they are opened from.
export function docFor(docs, event, ev, student) {
  const d = docs?.[event.id]?.[ev.caption] || docs?.['*']?.[ev.caption] || null;
  return typeof d === 'function' ? d(student || {}, event) : d;
}
