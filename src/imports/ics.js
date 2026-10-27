// iCalendar (.ics) files: fixtures from the sports calendar, club meetings, trips, concerts.
// Each event goes to the students listed as its attendees (school-verified), or, when the calendar
// names nobody (most fixture calendars), to the students the importer picks (teacher-endorsed).
import { parseDate, studentMatcher, makeCandidate, rowResult, slug, guessType, safeUrl } from './common.js';

// Unfolds continuation lines and splits each line into name, parameters and value (RFC 5545).
export function parseIcsLines(text) {
  const raw = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  return raw.filter(Boolean).map((line) => {
    let i = 0, q = false;
    for (; i < line.length; i++) { const ch = line[i]; if (ch === '"') q = !q; else if (ch === ':' && !q) break; }
    const [name, ...ps] = line.slice(0, i).split(';');
    const params = Object.fromEntries(ps.map((p) => { const j = p.indexOf('='); return [p.slice(0, j).toUpperCase(), p.slice(j + 1).replace(/^"|"$/g, '')]; }));
    return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
  });
}
const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

export function parseIcsEvents(text) {
  const events = []; let cur = null; let depth = 0;
  for (const l of parseIcsLines(text)) {
    if (l.name === 'BEGIN' && l.value === 'VEVENT') { cur = { attendees: [] }; depth = 0; continue; }
    if (!cur) continue;
    if (l.name === 'BEGIN') { depth++; continue; } // VALARM inside an event
    if (l.name === 'END' && depth) { depth--; continue; }
    if (l.name === 'END' && l.value === 'VEVENT') { events.push(cur); cur = null; continue; }
    if (depth) continue;
    if (l.name === 'SUMMARY') cur.summary = unescape(l.value).trim();
    else if (l.name === 'DESCRIPTION') cur.description = unescape(l.value).trim();
    else if (l.name === 'LOCATION') cur.location = unescape(l.value).trim();
    else if (l.name === 'UID') cur.uid = l.value.trim();
    else if (l.name === 'URL') cur.url = l.value.trim();
    else if (l.name === 'STATUS') cur.status = l.value.trim().toUpperCase();
    else if (l.name === 'CATEGORIES') cur.categories = unescape(l.value);
    else if (l.name === 'RECURRENCE-ID') cur.recurrence = l.value;
    else if (l.name === 'DTSTART') cur.start = icsDate(l.value, l.params);
    else if (l.name === 'DTEND') cur.end = icsDate(l.value, l.params);
    else if (l.name === 'ATTENDEE') cur.attendees.push({ email: l.value.replace(/^mailto:/i, '').trim(), name: l.params.CN || '' });
  }
  return events;
}
// A floating or zoned time keeps its own calendar day; a UTC time is moved to Bangkok (UTC+7).
function icsDate(v, params) {
  const s = v.trim();
  if (/^\d{8}T\d{6}Z$/.test(s)) { const t = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)) + 7 * 3600000; return new Date(t).toISOString().slice(0, 10); }
  return parseDate(s.slice(0, 8)) || (params.VALUE === 'DATE' ? null : parseDate(s));
}

const SPORT = /fixture|match|vs\.?|versus|gala|tournament|meet|race|game|training/i;
// ctx.forStudentIds: who took part, when the calendar names nobody. ctx.selfId: a student's own calendar.
export function parseIcs(text, { students, lines, today, forStudentIds = [], selfId, by, file = 'calendar.ics' }) {
  if (!/BEGIN:VCALENDAR/i.test(text)) return { items: [], problems: ['This is not a calendar file (.ics).'] };
  const events = parseIcsEvents(text);
  if (!events.length) return { items: [], problems: ['The calendar has no events.'] };
  const match = studentMatcher(students);
  const self = selfId && students.find((s) => s.id === selfId);
  const picked = forStudentIds.map((id) => students.find((s) => s.id === id)).filter(Boolean);
  const items = [];
  events.forEach((ev, n) => {
    const title = ev.summary || '(untitled event)';
    if (ev.status === 'CANCELLED') return items.push(rowResult(n + 1, title, null, null, 'Cancelled in the calendar'));
    if (!ev.start) return items.push(rowResult(n + 1, title, null, null, 'No date on this event'));
    const text = `${title} ${ev.description || ''} ${ev.categories || ''}`;
    const type = SPORT.test(text) && !/concert|recital/i.test(text) ? 'sport' : guessType(text, 'club');
    const summary = [ev.location && `At ${ev.location}`, ev.end && ev.end > ev.start ? `until ${ev.end}` : '', ev.description].filter(Boolean).join('. ').slice(0, 400);
    const link = safeUrl(ev.url);
    // Who is it for?
    let who;
    if (self) who = [{ student: self, by: 'your calendar' }];
    else if (ev.attendees.length) {
      who = ev.attendees.map((a) => match({ email: a.email, name: a.name }));
      who.filter((m) => !m.student).forEach((m) => items.push(rowResult(n + 1, title, m, null, m.problem)));
      who = who.filter((m) => m.student);
      if (!who.length) return;
    } else if (picked.length) who = picked.map((s) => ({ student: s, by: 'chosen by you' }));
    else return items.push(rowResult(n + 1, title, null, null, 'The calendar does not say who took part: choose students above'));
    const ref = `ics:${slug(ev.uid || title)}:${ev.recurrence ? slug(ev.recurrence) : ev.start}`;
    for (const m of who) {
      const cand = makeCandidate({ student: m.student, lines, title, date: ev.start, type, summary, evidence: link ? [{ kind: 'link', url: link, caption: 'Calendar entry' }] : [],
        // Named in the calendar: school-verified. Picked by a teacher: that teacher vouches for it.
        verification: self ? 'student-added' : m.by === 'chosen by you' ? 'teacher-endorsed' : 'school-verified', system: self ? 'Your calendar' : 'School calendar', ref, sourceId: self ? 'mine' : 'calendar',
        extra: !self && m.by === 'chosen by you' && by?.teacherId ? { classEndorsement: { teacherId: by.teacherId, note: `Took part, according to ${by.name}.`, date: today } } : {} });
      items.push(rowResult(n + 1, title, m, cand, null, ev.start > today ? ['Takes place after today'] : []));
    }
  });
  return { items, problems: [], file };
}
