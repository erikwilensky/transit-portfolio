import { getLang } from '../api.js';
import { simpleNow, useWaiting, waitingWords } from './OfflineBar.jsx';

// A quiet note in the header on where the record is saved. Nothing shows without the pilot server.
const LABEL = { saving: 'Saving…', saved: 'Saved', offline: 'Offline, saving here' };
const TITLE = { saving: 'Sending your change to the school server', saved: 'Saved on the school server. Every device sees it.', offline: 'Cannot reach the server. Changes are kept in this browser and sent when it is back.' };
const LABEL_TH = { saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', offline: 'ออฟไลน์ บันทึกไว้ในเครื่องนี้' };
const TITLE_TH = { saving: 'กำลังส่งการเปลี่ยนแปลงไปยังเซิร์ฟเวอร์ของโรงเรียน', saved: 'บันทึกบนเซิร์ฟเวอร์ของโรงเรียนแล้ว ทุกอุปกรณ์เห็นเหมือนกัน', offline: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ การเปลี่ยนแปลงเก็บไว้ในเบราว์เซอร์นี้ และจะส่งเมื่อเชื่อมต่อได้อีกครั้ง' };
export default function SyncStatus() {
  const { s, n } = useWaiting();
  if (!LABEL[s]) return null;
  const th = getLang() === 'th';
  // Changes made offline, waiting on this device (src/outbox.js): "Saved on this phone" / "3 changes waiting".
  const label = n && s === 'offline' ? (th ? `${n} รายการรอส่ง` : simpleNow() ? 'Saved on this phone' : `${n} change${n === 1 ? '' : 's'} waiting`) : (th ? LABEL_TH : LABEL)[s];
  return <span className={`sync-state st-${s}`} role="status" title={n ? waitingWords(n, s === 'offline') : (th ? TITLE_TH : TITLE)[s]}><i aria-hidden="true" /><span>{label}</span></span>;
}
