// Downloads the stock photos used by the example students' evidence (public/evidence/photos)
// and records who took each one (public/evidence/photos/credits.json).
//
// Photos come from Openverse (api.openverse.org), the open-licence image search run by
// WordPress, limited to licences that allow reuse in software with a credit: CC0, public
// domain mark and CC BY. Every photo's creator, licence and source are shown in the app.
//
// Run on a machine that can reach api.openverse.org:   node scripts/fetch-photos.mjs
//   --only=name1,name2   re-fetch just these
//   --pick=name:3        use the 4th search result for that photo instead of the 1st
//   --query=name:"new search words"  try different words for that photo
// The script prints each photo's title so a person can check it fits. On a Mac it shrinks
// each photo to 1400px with sips.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
const UA = { 'user-agent': 'transit-portfolio-demo/1.0 (school portfolio demo; example photos)', accept: 'application/json' };
const pause = () => new Promise((res) => setTimeout(res, 3500)); // anonymous Openverse allows about 20 searches a minute
const LICENCE = { cc0: 'CC0', pdm: 'Public domain', by: 'CC BY' };

// Openverse can be slow and throttles anonymous use, so searches get a long timeout, a few
// tries, and are remembered between runs (re-picking a photo costs no new search).
const cacheDir = join(tmpdir(), 'openverse-search-cache');
mkdirSync(cacheDir, { recursive: true });
async function search(query) {
  const cached = join(cacheDir, `${encodeURIComponent(query)}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  const q = new URLSearchParams({ q: query, license: 'cc0,pdm,by', aspect_ratio: 'wide', mature: 'false', page_size: '20' });
  let why = '';
  for (let tryNo = 0; tryNo < 3; tryNo += 1) {
    const r = await fetch(`https://api.openverse.org/v1/images/?${q}`, { headers: UA, signal: AbortSignal.timeout(90000) }).catch((e) => ({ ok: false, status: e.name }));
    await pause();
    if (r.status === 403 || r.status === 429) return `${r.status}`;
    if (!r.ok) { why = `${r.status}`; continue; }
    const { results } = await r.json();
    if (results.length) { writeFileSync(cached, JSON.stringify(results)); return results; }
    why = 'empty';
  }
  return why;
}

for (const [name, query] of Object.entries(PHOTOS)) {
  if (only && !only.has(name)) continue;
  const results = await search(query);
  if (typeof results === 'string') { console.log(`FAIL ${name}: search ${results}`); continue; }
  const found = results.filter((p) => p.url && (p.width || 0) >= 1000);
  const p = found[picks[name] || 0];
  if (!p) { console.log(`FAIL ${name}: no result for "${query}"`); continue; }
  const body = await fetch(p.url, { headers: { 'user-agent': UA['user-agent'] }, signal: AbortSignal.timeout(45000) }).then(async (img) => (img.ok ? Buffer.from(await img.arrayBuffer()) : `${img.status}`)).catch((e) => e.name);
  if (typeof body === 'string') { console.log(`FAIL ${name}: download ${body} (try --pick=${name}:${(picks[name] || 0) + 1})`); continue; }
  const file = fileURLToPath(new URL(`${name}.jpg`, dir));
  writeFileSync(file, body);
  try { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', '1400', file, '--out', file], { stdio: 'ignore' }); } catch { /* not a Mac: keep the original */ }
  credits[name] = {
    title: p.title || '', creator: p.creator || 'Unknown', creatorUrl: p.creator_url || null,
    licence: `${LICENCE[p.license] || p.license.toUpperCase()}${p.license === 'by' ? ` ${p.license_version}` : ''}`, licenceUrl: p.license_url || null,
    source: p.foreign_landing_url || p.url, provider: p.source || p.provider,
  };
  console.log(`OK   ${name.padEnd(16)} ${credits[name].licence.padEnd(10)} ${credits[name].creator} · ${credits[name].title}`);
}
writeFileSync(creditsFile, `${JSON.stringify(credits, null, 2)}\n`);
