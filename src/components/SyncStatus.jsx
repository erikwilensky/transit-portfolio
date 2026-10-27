import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus } from '../sync.js';

// A quiet note in the header on where the record is saved. Nothing shows without the pilot server.
const LABEL = { saving: 'Saving…', saved: 'Saved', offline: 'Offline, saving here' };
const TITLE = { saving: 'Sending your change to the school server', saved: 'Saved on the school server. Every device sees it.', offline: 'Cannot reach the server. Changes are kept in this browser and sent when it is back.' };
export default function SyncStatus() {
  const [s, setS] = useState(getSyncStatus);
  useEffect(() => onSyncStatus(setS), []);
  if (!LABEL[s]) return null;
  return <span className={`sync-state st-${s}`} role="status" title={TITLE[s]}><i aria-hidden="true" /><span>{LABEL[s]}</span></span>;
}
