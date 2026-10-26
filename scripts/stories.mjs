// Applies scripts/stories-data.mjs to data/*.json in place (safe to re-run).
// Run `node scripts/illustrations.mjs` afterwards to draw the images.
import { readFileSync, writeFileSync } from 'node:fs';
import { STORIES } from './stories-data.mjs';

const path = (f) => new URL(`../data/${f}`, import.meta.url);
const read = (f) => JSON.parse(readFileSync(path(f), 'utf8'));
const write = (f, d) => writeFileSync(path(f), JSON.stringify(d, null, 2) + '\n');
const events = read('events.json'), reflections = read('reflections.json'), endorsements = read('endorsements.json'), students = read('students.json');
const ev = (kind, caption, url) => ({ kind, url: url ?? (kind === 'grade' ? null : '#'), caption });

let rc = Math.max(...reflections.map((r) => +r.id.slice(3))) + 1, ec = Math.max(...endorsements.map((n) => +n.id.slice(3))) + 1;
for (const [id, x] of Object.entries(STORIES)) {
  const e = events.find((v) => v.id === id);
  if (!e) throw new Error(`no event ${id}`);
  for (const k of ['title', 'summary', 'about', 'type']) if (x[k]) e[k] = x[k];
  if (x.lines) e.lineIds = x.lines;
  if (x.sys) e.source = { system: x.sys[0], ref: x.sys[1] };
  if (x.verif) e.verification = x.verif;
  const add = (x.add || []).map(([k, cap, url]) => ev(k, cap, url));
  if (x.img || !x.title) {
    const im = x.img ? [{ kind: 'image', url: `evidence/${x.img[0].startsWith('@') ? x.img[0].slice(1) : id}.svg`, caption: x.img[1] }] : [];
    e.evidence = x.title ? [...im, ...add] : [...e.evidence.filter((v) => !add.some((a) => a.caption === v.caption)), ...add];
  } else e.evidence = add;
  if (x.refl) {
    const r = reflections.find((v) => v.eventId === id);
    if (r) Object.assign(r, { prompt: x.refl[0], text: x.refl[1], visibility: 'advisor' });
    else reflections.push({ id: `rf-${String(rc++).padStart(3, '0')}`, eventId: id, text: x.refl[1], date: e.date, prompt: x.refl[0], visibility: 'advisor' });
  }
  if (x.end && !endorsements.some((n) => n.eventId === id)) {
    endorsements.push({ id: `en-${String(ec++).padStart(3, '0')}`, eventId: id, teacherId: x.end[0], note: x.end[1], date: e.date });
    e.verification = 'teacher-endorsed';
  }
  const s = students.find((v) => v.id === e.studentId);
  for (const lid of e.lineIds) if (!s.laneOrder.includes(lid) && !lid.includes('-')) s.laneOrder.push(lid);
}

// Wording slips from the move to British Years (graded music exams keep their own grades).
for (const e of events) for (const k of ['title', 'summary', 'about']) if (e[k]) e[k] = e[k]
  .replace('passed Year 7 piano', 'passed Grade 6 piano').replace(/Year 9 piano/g, 'Grade 8 piano').replace('End-of-Grade-9 reflection', 'End-of-Year-10 reflection');

write('events.json', events); write('reflections.json', reflections); write('endorsements.json', endorsements); write('students.json', students);
console.log(Object.keys(STORIES).length, 'stations updated');
