import { useEffect, useState } from 'react';
import { getSyncStatus, onSyncStatus, waitingCount } from '../sync.js';
import { getIntensity, getLang } from '../api.js';
import { getAuth } from '../auth.js';
import { waitingText } from '../outbox.js';
import './offline-capture.css';

// Offline capture (src/outbox.js): changes made with no connection wait on this device. Calm words, at the foot of
// the screen (the phone app's header is short), in plain words at Simple level.
export const useWaiting = () => {
  const [v, setV] = useState(() => ({ s: getSyncStatus(), n: waitingCount() }));
  useEffect(() => onSyncStatus((s) => setV({ s, n: waitingCount() })), []);
  return v;
};
export const simpleNow = () => { const id = getAuth().user?.studentId; try { return !!id && getIntensity(id) === 'simple'; } catch { return false; } };
const TH = (n, simple, offline) => (offline ? `${simple ? '' : `${n} รายการรอส่ง `}บันทึกไว้ในเครื่องนี้แล้ว จะส่งเมื่อกลับมาออนไลน์` : 'กำลังส่งสิ่งที่บันทึกไว้ในเครื่องนี้…');
export const waitingWords = (n, offline) => (getLang() === 'th' ? TH(n, simpleNow(), offline) : waitingText(n, { simple: simpleNow(), offline }));

export function OfflineBar() {
  const { s, n } = useWaiting();
  if (!n) return null;
  return <div className={`ob-bar${s === 'offline' ? ' off' : ''}`} role="status"><i aria-hidden="true" />{waitingWords(n, s === 'offline')}</div>;
}
