// Conference booking (src/api.js, src/components/ConferenceBooking.jsx): no routes of its own, everything goes through
// /api/action. Here the server tells api.js who is whose brother or sister (the family accounts' children, so a booking
// that clashes with a sibling's is refused whoever books it), and sends the day-before reminders in-app: a look every
// CONF_REMIND_MS (default 10 minutes) and shortly after start. No email.
import { api, changed } from '../store.mjs';
import { allAccounts } from '../auth.mjs';

const F = api.PERSONA_OF_FAMILY;
api.setSiblingsOf((sid) => {
  const out = new Set(F[sid] ? Object.keys(F).filter((x) => F[x] === F[sid]) : []);
  for (const a of allAccounts()) if (a.kind === 'parent' && a.children?.includes(sid)) for (const c of a.children) out.add(c);
  out.delete(sid);
  return [...out];
});

export function remindConferences() {
  if (!api.confRemindersDue(api.TODAY).length) return 0;
  const n = api.sendConferenceReminders(api.TODAY);
  changed({ fn: 'sendConferenceReminders', by: 'admin' });
  return n;
}

export default () => {
  const t = () => { try { remindConferences(); } catch (e) { console.error('Conference reminders:', e.message); } };
  setTimeout(t, 2000).unref();
  setInterval(t, Number(process.env.CONF_REMIND_MS) || 600_000).unref();
};
