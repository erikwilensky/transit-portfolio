// The example students' pictures. Where a licensed stock photo stands in for an illustration
// (scripts/fetch-photos.mjs), evidence/<name>.svg is shown as evidence/photos/<name>.jpg,
// and photoCredit() gives the creator, licence and source to credit under it.
import credits from '../public/evidence/photos/credits.json';

const NAME = /^evidence\/([\w-]+)\.svg$/;
export const photoUrl = (url) => {
  const m = typeof url === 'string' && url.match(NAME);
  return m && credits[m[1]] ? `evidence/photos/${m[1]}.jpg` : url;
};
export const photoCredit = (url) => {
  const m = typeof url === 'string' && url.match(/^evidence\/photos\/([\w-]+)\.jpg$/);
  return m ? credits[m[1]] || null : null;
};
// Every image reference in a record (seeded or saved before the photos arrived) moves to its photo.
export function usePhotos(store) {
  const fix = (ev) => { for (const x of ev?.evidence || []) if (x.kind === 'image') x.url = photoUrl(x.url); };
  for (const k of ['events', 'inbox']) for (const e of store[k] || []) fix(e);
  for (const p of store.pending || []) fix(p.event);
  return store;
}
