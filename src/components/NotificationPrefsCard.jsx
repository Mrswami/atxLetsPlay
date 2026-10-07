import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mergePrefs, normalizePhone, enablePush, disablePush, pushSupported } from '../services/notifications';

const EVENTS = [
  { key: 'gameReminders', label: 'Game reminders', sub: 'About an hour before a game you joined or host' },
  { key: 'courtInvites', label: 'Court invitations', sub: 'When someone invites you to a court or game' },
  { key: 'friendInvites', label: 'Friend invitations', sub: 'When someone sends you a friend request' },
  { key: 'friendAdds', label: 'Friend adds', sub: 'When someone accepts or adds you' },
];

function Toggle({ checked, onChange, id, disabled }) {
  return (
    <label className="toggle-switch">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

// Every change persists immediately (no Save button), through updateUserProfile.
export default function NotificationPrefsCard({ onToast }) {
  const { user, userProfile, isGuest, updateUserProfile } = useAuth();
  const prefs = mergePrefs(userProfile?.notificationPrefs);
  const [phone, setPhone] = useState(prefs.phone);
  const [busy, setBusy] = useState(false);
  const toast = (m, t = 'success') => onToast && onToast(m, t);

  if (isGuest) {
    return (
      <section className="settings-card">
        <div className="card-header"><h2 className="card-title">Reminders & Invites</h2></div>
        <p className="toggle-sub">Create an account to get game reminders and invites by push, email or text.</p>
      </section>
    );
  }

  const save = (next) => updateUserProfile({ notificationPrefs: next });

  async function setChannel(ch, on) {
    setBusy(true);
    try {
      if (ch === 'push') {
        if (on) await enablePush(user.uid); else await disablePush(user.uid);
      }
      if (ch === 'sms' && on && !normalizePhone(prefs.phone || phone)) {
        toast('Add a valid mobile number first.', 'error');
        return;
      }
      await save({ ...prefs, channels: { ...prefs.channels, [ch]: on } });
    } catch (e) {
      toast(e.message || 'Could not update notifications.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    const e164 = phone.trim() ? normalizePhone(phone) : '';
    if (phone.trim() && !e164) { toast('Enter a valid mobile number, e.g. (512) 555-0123.', 'error'); return; }
    setPhone(e164);
    await save({ ...prefs, phone: e164, channels: { ...prefs.channels, sms: e164 ? prefs.channels.sms : false } });
    toast(e164 ? 'Number saved.' : 'Number removed.');
  }

  async function setEvent(key, on) {
    await save({ ...prefs, events: { ...prefs.events, [key]: on } });
  }

  const anyChannel = Object.values(prefs.channels).some(Boolean);

  return (
    <>
      <section className="settings-card" id="notif-channels">
        <div className="card-header">
          <h2 className="card-title">How we reach you</h2>
          <span className="card-badge">Delivery</span>
        </div>

        <div className="setting-toggle-row">
          <div className="toggle-text">
            <span className="toggle-label">Push notifications</span>
            <span className="toggle-sub">{pushSupported() ? 'Instant alerts on this device' : 'Not supported on this browser'}</span>
          </div>
          <Toggle id="ch-push" checked={prefs.channels.push} disabled={busy || !pushSupported()} onChange={(v) => setChannel('push', v)} />
        </div>

        <div className="setting-toggle-row">
          <div className="toggle-text">
            <span className="toggle-label">Email</span>
            <span className="toggle-sub">{user?.email || 'Add an email to your account'}</span>
          </div>
          <Toggle id="ch-email" checked={prefs.channels.email} disabled={busy || !user?.email} onChange={(v) => setChannel('email', v)} />
        </div>

        <div className="setting-toggle-row">
          <div className="toggle-text">
            <span className="toggle-label">Text message (SMS)</span>
            <span className="toggle-sub">Reminders only. Msg &amp; data rates may apply. Turn off any time.</span>
          </div>
          <Toggle id="ch-sms" checked={prefs.channels.sms} disabled={busy} onChange={(v) => setChannel('sms', v)} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            id="sms-phone"
            type="tel"
            inputMode="tel"
            placeholder="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={savePhone}
            style={{ flex: 1 }}
          />
        </div>
      </section>

      <section className="settings-card" id="notif-events">
        <div className="card-header">
          <h2 className="card-title">What to notify me about</h2>
          <span className="card-badge">Events</span>
        </div>
        {!anyChannel && <p className="toggle-sub">Turn on at least one delivery method above.</p>}
        {EVENTS.map((ev) => (
          <div className="setting-toggle-row" key={ev.key}>
            <div className="toggle-text">
              <span className="toggle-label">{ev.label}</span>
              <span className="toggle-sub">{ev.sub}</span>
            </div>
            <Toggle id={`ev-${ev.key}`} checked={prefs.events[ev.key]} onChange={(v) => setEvent(ev.key, v)} />
          </div>
        ))}
      </section>
    </>
  );
}
