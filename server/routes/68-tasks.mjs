// Class tasks (api.setTask, handInTask): the day-before reminder. Pilot only: a look shortly after start and then every
// TASK_TICK_MS (default 10 minutes); api.remindDueTasks notifies each student once per due date, so a look is cheap and
// repeating it changes nothing. It runs through act(), so undo history replays it like any other change.
import { api, changed } from '../store.mjs';
import { MODE } from '../auth.mjs';
import { beat } from '../health.mjs';
import { forgetDirect } from '../history.mjs';

const MS = Math.max(1000, Number(process.env.TASK_TICK_MS) || 10 * 60_000);

export function tick() {
  try { const n = api.remindDueTasks(); if (n) changed({ fn: 'remindDueTasks', by: 'server' }); else forgetDirect('remindDueTasks'); beat('class-tasks', { every: MS }); return n; } catch (e) { console.error('Task reminders:', e); beat('class-tasks', { every: MS, error: e }); return 0; }
}

export default () => {
  if (MODE !== 'pilot') return;
  setTimeout(tick, 2000).unref();
  setInterval(tick, MS).unref();
};
