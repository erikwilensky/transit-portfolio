// School weeks for the "This week" summary: Monday to Sunday, in Bangkok. Pure, so the server tests can load it.
export const WEEK_TZ = 'Asia/Bangkok';
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
// The calendar day an instant falls on in Bangkok ('2026-10-26T18:30:00Z' → '2026-10-27').
export const dayIn = (at, tz = WEEK_TZ) => (at ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at)) : null);
// 0 = Monday … 6 = Sunday, for a 'YYYY-MM-DD' day.
export const weekday = (day) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
export const isMonday = (day) => weekday(day) === 0;
// The week holding `today`, or `back` weeks before it: { from: Monday, to: Sunday, upto }. upto = the last day that
// has happened (today in the current week, Sunday in a past one).
export function weekOf(today, back = 0) {
  const t = Date.parse(`${today}T00:00:00Z`);
  const mon = t - (weekday(today) + 7 * back) * DAY;
  const to = iso(mon + 6 * DAY);
  return { from: iso(mon), to, upto: back ? to : today };
}
export const inWeek = (day, w) => !!day && day >= w.from && day <= w.upto;
// An instant (ISO time) in the week, by its Bangkok day.
export const atInWeek = (at, w, tz = WEEK_TZ) => inWeek(dayIn(at, tz), w);
const fmt = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
// "26 Oct to 1 Nov"
export const weekLabel = (w) => `${fmt(w.from)} to ${fmt(w.to)}`;
