import './notification-settings.css';
import { getNotifications, notifyKeys } from '../api.js';
import { atInWeek, dayIn } from '../week.js';
import { weekOnly } from '../notify-kinds.js';
import { getNotifyPrefs } from '../notify-prefs.js';
import { fmtDate } from '../format.js';

// This week: the notifications a staff member chose to keep out of the bell ("Only in This week"), dated in the week.
export function WeekNotes({ persona, week, go }) {
  const list = weekOnly(getNotifications(notifyKeys(persona)), getNotifyPrefs(persona), 'staff').filter((n) => atInWeek(n.ts, week));
  if (!list.length) return null;
  const body = (n) => <span><strong>{n.text}</strong><small>{fmtDate(dayIn(n.ts))}</small></span>;
  return (
    <section className="tw-sec tw-notes" aria-labelledby="tw-notes">
      <h2 id="tw-notes">Kept for This week</h2>
      <p className="fineprint">Notifications you chose to see here instead of in the bell.</p>
      <ul className="tw-wait">{list.map((n) => (
        <li key={n.id}>{n.go?.screen
          ? <a href={`#/${persona.id}/${n.go.screen}${n.go.param ? `/${n.go.param}` : ''}`} onClick={(e) => { e.preventDefault(); go(persona.id, n.go.screen, n.go.param); }}>{body(n)}<i aria-hidden="true">›</i></a>
          : <div>{body(n)}</div>}</li>
      ))}</ul>
    </section>
  );
}
