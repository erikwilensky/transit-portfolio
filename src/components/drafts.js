import { fmtTerm } from '../format.js';

// N10: a first narrative for one line, in the student's voice, written from its stations and reflections.
// It is prepared here from the record, with no outside calls; the student then edits it.
const TAIL = {
  university: 'It is the line I most want to keep going at university.',
  specific: 'It is the clearest reason I chose this course.',
  employer: 'It shows I can take something from an idea to a result other people use.',
  scholarship: 'What matters most to me is who it reaches.',
};
export function draftNarrative(map, lens, lineId, audience) {
  const l = map.lines.find((x) => x.id === lineId);
  const s = map.student;
  const evs = map.events.filter((e) => e.lineIds.includes(lineId) && lens.visible.has(e.id) && e.type !== 'goal').sort((a, b) => a.date.localeCompare(b.date));
  if (!evs.length) return '';
  const year = (e) => fmtTerm(e.date, s.g9StartYear, s.startGrade).replace(/, Term.*/, '');
  const name = l.name.split(' · ').at(-1);
  const [start] = evs;
  const latest = evs.at(-1);
  const middle = evs.slice(1, -1).filter((e) => e.type !== 'reflection');
  const out = [`My ${name} line began in ${year(start)} with “${start.title}”.`];
  if (middle.length) out.push(`It grew through ${middle.slice(-2).map((e) => `“${e.title}”`).join(' and ')}${middle.length > 2 ? `, and ${middle.length - 2} more along the way` : ''}.`);
  if (latest !== start) out.push(`${l.status === 'ended' ? 'It ended' : 'Most recently it reached'} “${latest.title}” in ${year(latest)}.`);
  const ix = evs.find((e) => e.lineIds.length > 1);
  if (ix) {
    const others = ix.lineIds.filter((id) => id !== lineId).map((id) => map.lines.find((x) => x.id === id)?.name.split(' · ').at(-1)).filter(Boolean);
    if (others.length) out.push(`It meets ${others.join(' and ')} at “${ix.title}”, which is where my interests started to connect.`);
  }
  const said = evs.flatMap((e) => [...(e.reflections || []).map((r) => r.text), e.type === 'reflection' ? e.summary : null]).filter(Boolean)
    .map((t) => t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).find((x) => x.length >= 30 && x.length <= 160 && /[.!?]$/.test(x))).find(Boolean);
  if (said) out.push(`Looking back: ${said}`);
  if (l.status === 'ended') out.push('I stopped it, and I know what it gave me.');
  else if (TAIL[audience]) out.push(TAIL[audience]);
  return out.join(' ');
}
