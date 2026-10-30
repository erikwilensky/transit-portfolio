import { useState } from 'react';
import { getLang, isModerator } from '../api.js';
import { CHOICES, GROUPS, audienceOf } from '../notify-kinds.js';
import { getNotifyPrefs, setNotifyPrefs } from '../notify-prefs.js';
import './notification-settings.css';

// Notification settings and quiet hours, from the account menu (pilot) or the bell (demo too). See src/notify-kinds.js.
const TH = {
  Notifications: 'การแจ้งเตือน', 'Notification settings': 'ตั้งค่าการแจ้งเตือน', On: 'เปิด', Off: 'ปิด',
  'Weekly digest': 'สรุปรายสัปดาห์',
  'Your child’s milestones': 'ความสำเร็จของบุตรหลาน', 'Quiet hours': 'ช่วงเวลาเงียบ', From: 'ตั้งแต่', To: 'ถึง',
  Save: 'บันทึก', Cancel: 'ยกเลิก', Close: 'ปิด', 'Saving…': 'กำลังบันทึก…',
  'Choose what reaches your bell. Nothing is deleted.': 'เลือกสิ่งที่จะแสดงที่กระดิ่ง ไม่มีสิ่งใดถูกลบ',
  'Always on: safeguarding notices (when a teacher hides something to look at it, or shows it again) and account security. These can’t be turned off.': 'เปิดเสมอ: การแจ้งเตือนด้านความปลอดภัยของนักเรียน (เมื่อครูซ่อนบางอย่างเพื่อตรวจสอบ หรือแสดงอีกครั้ง) และความปลอดภัยของบัญชี ปิดไม่ได้',
  'Bangkok time. Notifications still arrive in the bell, but the number on the bell waits until quiet hours end. The app makes no sounds, vibration or phone banners.': 'เวลากรุงเทพฯ การแจ้งเตือนยังเข้ามาที่กระดิ่ง แต่ตัวเลขบนกระดิ่งจะรอจนหมดช่วงเวลาเงียบ แอปไม่มีเสียง การสั่น หรือแบนเนอร์บนโทรศัพท์',
  'Notification settings saved': 'บันทึกการตั้งค่าการแจ้งเตือนแล้ว',
  'Mark all as read': 'อ่านทั้งหมดแล้ว', 'Clear read': 'ล้างที่อ่านแล้ว',
  'Quiet hours: the number waits until': 'ช่วงเวลาเงียบ: ตัวเลขจะรอจนถึง',
  'not shown: cleared, or turned off in your settings': 'รายการไม่แสดง: ล้างแล้ว หรือปิดไว้ในการตั้งค่า',
};
export const nsT = (lang) => (s) => (lang === 'th' && TH[s]) || s;
const LABEL = { on: 'On', off: 'Off', week: 'Only in This week' };

export default function NotificationSettings({ persona, onClose, toast }) {
  const lang = getLang();
  const t = nsT(lang);
  const aud = audienceOf(persona.kind);
  const [p, setP] = useState(() => getNotifyPrefs(persona));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const groups = GROUPS[aud].filter(([, , , o]) => !o?.moderators || isModerator(persona));
  const val = (k, o) => { const v = p.kinds[k] || 'on'; return o?.noOff && v === 'off' ? 'week' : v; };
  const pick = (k, v) => setP({ ...p, kinds: { ...p.kinds, [k]: v } });
  const quiet = (q) => setP({ ...p, quiet: { ...p.quiet, ...q } });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const why = await setNotifyPrefs(persona, { ...p, kinds: Object.fromEntries(Object.entries(p.kinds).filter(([, v]) => v !== 'on')) });
    setBusy(false);
    if (why) return setErr(why);
    toast?.(t('Notification settings saved')); onClose();
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal ns-modal" lang={lang} onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="ns-h">
        <button type="button" className="panel-close" onClick={onClose} aria-label={t('Close')}>×</button>
        <h2 id="ns-h">{t('Notifications')}</h2>
        <p className="ns-lead">{t('Choose what reaches your bell. Nothing is deleted.')}{aud === 'staff' && ' “Only in This week” keeps it out of the bell and lists it on This week instead.'}</p>
        <div className="ns-list">
          {groups.map(([k, label, , o]) => (
            <fieldset key={k} className="ns-row" data-kind={k}>
              <legend>{t(label)}</legend>
              <div className="ns-seg">
                {CHOICES[aud].filter((c) => !(o?.noOff && c === 'off')).map((c) => (
                  <label key={c} className={val(k, o) === c ? 'on' : ''}>
                    <input type="radio" name={`ns-${k}`} value={c} checked={val(k, o) === c} onChange={() => pick(k, c)} />{t(LABEL[c])}
                  </label>
                ))}
              </div>
              {o?.noOff && <small className="ns-note">New reports can wait for This week, but can’t be turned off.</small>}
            </fieldset>
          ))}
        </div>
        <p className="ns-always">{t('Always on: safeguarding notices (when a teacher hides something to look at it, or shows it again) and account security. These can’t be turned off.')}</p>
        <fieldset className="ns-quiet">
          <legend>{t('Quiet hours')}</legend>
          <label className="ns-check"><input type="checkbox" checked={p.quiet.on} onChange={(e) => quiet({ on: e.target.checked })} />{t('Quiet hours')}</label>
          <div className="ns-times">
            <label>{t('From')}<input type="time" value={p.quiet.from} disabled={!p.quiet.on} onChange={(e) => e.target.value && quiet({ from: e.target.value })} /></label>
            <label>{t('To')}<input type="time" value={p.quiet.to} disabled={!p.quiet.on} onChange={(e) => e.target.value && quiet({ to: e.target.value })} /></label>
          </div>
          <small className="ns-note">{t('Bangkok time. Notifications still arrive in the bell, but the number on the bell waits until quiet hours end. The app makes no sounds, vibration or phone banners.')}</small>
        </fieldset>
        {err && <p className="auth-err" role="alert">{err}</p>}
        <div className="ns-foot"><button className="primary" type="submit" disabled={busy}>{busy ? t('Saving…') : t('Save')}</button><button type="button" className="ghost" onClick={onClose}>{t('Cancel')}</button></div>
      </form>
    </div>
  );
}
