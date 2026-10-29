// Three talking points for a conference sheet, from what the sheet shows (src/conference.js). Pure, so
// server/test/conference-points.test.mjs can run it. lines: [{ name, count (this term), ever (moments ever) }];
// goals: [{ title, days (until its date, negative when past) }]; moments, reflections, endorsements: this term's counts.
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function talkingPoints({ first = 'they', lines = [], goals = [], moments = 0, reflections = 0, endorsements = 0 } = {}) {
  const out = [];
  const busiest = [...lines].filter((l) => l.count).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];
  if (busiest) out.push(`Busiest line: ${busiest.name}, with ${plural(busiest.count, 'moment')} this term. What made it go well?`);
  const quiet = lines.filter((l) => !l.count).sort((a, b) => (b.ever || 0) - (a.ever || 0) || a.name.localeCompare(b.name))[0];
  if (quiet) out.push(`Nothing on ${quiet.name} this term. Is it still a line ${first} wants to follow, or one to pause?`);
  const due = goals.filter((g) => g.days >= 0).sort((a, b) => a.days - b.days)[0];
  const late = goals.filter((g) => g.days < 0).sort((a, b) => b.days - a.days)[0];
  if (due) out.push(`Goal “${due.title}” is due ${due.days === 0 ? 'today' : due.days < 14 ? `in ${plural(due.days, 'day')}` : `in ${plural(Math.round(due.days / 7), 'week')}`}. What is the next step?`);
  else if (late) out.push(`Goal “${late.title}” has passed its date. Done, changed, or still going?`);
  if (moments && !reflections) out.push(`No reflections this term yet. Which moment would be worth writing about?`);
  if (endorsements) out.push(`${plural(endorsements, 'endorsement')} from teachers this term. What did ${first} do that they noticed?`);
  if (!moments) out.push(`Nothing added this term yet. What is one thing from this term worth adding?`);
  if (!goals.length) out.push(`No goals planned yet. What would ${first} like to aim for next term?`);
  for (const q of ['Which line are you most proud of?', 'What would you like help with next term?', 'Is there a line you want to start?']) out.push(q);
  return [...new Set(out)].slice(0, 3);
}
