// Class tasks (api.setTask, handInTask): the day-before reminder. Pilot only: a look shortly after start and then every
// TASK_TICK_MS (default 10 minutes); api.remindDueTasks notifies each student once per due date, so a look is cheap and
// repeating it changes nothing. It runs through act(), so undo history replays it like any other change.
import { api, changed } from '../store.mjs';
import { MODE } from '../auth.mjs';

export function tick() {
  try { const n = api.remindDueTasks(); if (n) changed({ fn: 'remindDueTasks', by: 'server' }); return n; } catch (e) { console.error('Task reminders:', e); return 0; }
}

export default () => {
  if (MODE !== 'pilot') return;
  const ms = Math.max(1000, Number(process.env.TASK_TICK_MS) || 10 * 60_000);
  setTimeout(tick, 2000).unref();
  setInterval(tick, ms).unref();
};
