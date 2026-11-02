// Downloads the stock photos used by the example students' evidence (public/evidence/photos)
// and records who took each one (public/evidence/photos/credits.json).
//
// Every photo comes from Unsplash under the Unsplash Licence (free to use, including in
// software, no permission needed). Unsplash+ (paid) photos are skipped. Credits are shown
// in the app anyway, because it is the decent thing to do.
//
// Run on a machine that can reach unsplash.com:   node scripts/fetch-photos.mjs
//   --only=name1,name2   re-fetch just these
//   --pick=name:3        use the 4th search result for that photo instead of the 1st
//   --query=name:"new search words"  try different words for that photo
// The script prints each photo's own description so a person can check it fits.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

// name (matches the old illustration's file name) → search words
export const PHOTOS = {
  'aq-sensor': 'air quality monitor sensor',
  'beach-cleanup': 'beach cleanup volunteers litter',
  'bowl': 'handmade ceramic bowl',
  'climb': 'indoor bouldering wall climber',
  'compost-bin': 'compost garden raised beds',
  'ev-001': 'swimming pool lanes training',
  'ev-003': 'beach plastic waste collected',
  'ev-008': 'tropical rainforest field research',
  'ev-011': 'swimmer outdoor pool',
  'ev-012': 'journal writing notebook desk',
  'ev-013': 'weekly planner notebook pen',
  'ev-014': 'arduino breadboard sensor',
  'ev-015': 'students studying library table',
  'ev-017': 'electricity meter',
  'ev-018': 'swimming race competition',
  'ev-031': 'laptop data analysis code',
  'ev-034': 'open journal handwriting',
  'ev-101': 'product design sketches pencil',
  'ev-105': 'jazz band keyboard rehearsal',
  'ev-111': 'music production laptop midi keyboard',
  'ev-112': 'home recording studio',
  'ev-113': 'game controller prototype',
  'ev-118': 'jazz band stage performance',
  'ev-121': 'theatre sound mixing desk',
  'ev-201': 'pottery wheel clay hands',
  'ev-204': 'notebook handwriting language study',
  'ev-205': 'two students talking campus',
  'ev-209': 'open notebook pen coffee',
  'ev-210': 'ceramics pottery display table',
  'ev-211': 'japanese flashcards study',
  'ev-213': 'japanese hiragana writing practice',
  'ev-300': 'children reading books library',
  'ev-302': 'dog walking leash park',
  'ev-303': 'chemistry titration burette',
  'ev-304': 'river stream water sampling net',
  'ev-306': 'pendulum physics experiment',
  'ev-309': 'microphone stage spotlight',
  'ev-313': 'linocut printmaking ink roller',
  'ev-315': 'children homework classroom',
  'ev-319': 'art workshop paint table',
  'ev-320': 'studio microphone vocal recording',
  'ev-324': 'choir concert',
  'ev-340': 'charity fun run start line',
  'ev-344': 'scuba diver underwater coral',
  'football': 'girls football match',
  'hackathon': 'hackathon team laptops',
  'hackathon-1st': 'team laptops coding night',
  'lamp': 'woven pendant lamp',
  'mangroves': 'mangrove seedlings',
  'mural': 'community mural painting wall',
  'pcb': 'printed circuit board',
  'phone-stands': '3d printer printing',
  'piano-stage': 'grand piano concert stage',
  'sketchbook': 'sketchbook drawings',
  'stem-club': 'students robotics workshop',
  'welcome-pack': 'printed booklet brochure',
  'arcade': 'arcade cabinet',
  'sci-fair-poster': 'science fair poster presentation',
};

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const only = args.only ? new Set(args.only.split(',')) : null;
const picks = Object.fromEntries((args.pick || '').split(',').filter(Boolean).map((p) => p.split(':')).map(([n, i]) => [n, +i]));
if (args.query) { const [n, ...q] = args.query.split(':'); PHOTOS[n] = q.join(':').replace(/^"|"$/g, ''); }

const dir = new URL('../public/evidence/photos/', import.meta.url);
mkdirSync(dir, { recursive: true });
const creditsFile = new URL('credits.json', dir);
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : {};
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', accept: 'application/json' };

for (const [name, query] of Object.entries(PHOTOS)) {
  if (only && !only.has(name)) continue;
  const r = await fetch(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=landscape`, { headers: UA });
  if (!r.ok) { console.log(`FAIL ${name}: search ${r.status}`); continue; }
  const free = (await r.json()).results.filter((p) => !p.premium && !p.plus && p.urls?.raw);
  const p = free[picks[name] || 0];
  if (!p) { console.log(`FAIL ${name}: no free result for "${query}"`); continue; }
  const img = await fetch(`${p.urls.raw}&w=1200&h=800&fit=crop&crop=entropy&q=70&fm=jpg`);
  if (!img.ok) { console.log(`FAIL ${name}: download ${img.status}`); continue; }
  writeFileSync(new URL(`${name}.jpg`, dir), Buffer.from(await img.arrayBuffer()));
  credits[name] = { photographer: p.user?.name, profile: p.user?.links?.html, photo: p.links?.html, licence: 'Unsplash Licence', description: p.alt_description || p.description || '' };
  console.log(`OK   ${name.padEnd(16)} ${p.user?.name} · ${credits[name].description}`);
  await new Promise((res) => setTimeout(res, 400));
}
writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
