// Teacher comment bank (api.addPhrase … in src/api.js): every change to the school bank gets its own activity-log line,
// `school-phrase` with detail.op (add, edit, delete, move) and the phrase's kind, never its text. Personal banks and use
// counts are logged only as the usual `change` line. Changes run one at a time, so the owners known before a change tell
// a deleted phrase's bank.
import { api, onChange } from '../store.mjs';
import * as A from '../auth.mjs';
import * as L from '../audit.mjs';

const OPS = { addPhrase: 'add', editPhrase: 'edit', deletePhrase: 'delete', movePhrase: 'move' };
const known = () => new Map((api.getStore().phrases || []).map((p) => [p.id, { owner: p.owner, kind: p.kind }]));
let before = known();
onChange((info) => {
  const was = before; before = known();
  const op = OPS[info.fn];
  if (!op || info.error || !Array.isArray(info.args)) return;
  const [first] = info.args;
  const id = op === 'add' ? [...before.keys()].find((k) => !was.has(k) && before.get(k).owner === 'school') : first;
  const p = before.get(id) || was.get(id);
  if (!p || p.owner !== 'school' || (op === 'add' && first !== 'school')) return;
  L.log(null, { action: 'school-phrase', fn: info.fn, actor: L.actorOf(A.accountById(info.by)), target: { id, label: (api.PHRASE_KINDS.find(([k]) => k === p.kind) || [])[1] || 'Phrase' }, detail: { op, kind: p.kind } });
});

export default () => {};
