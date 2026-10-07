import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Shown when the user can't join/host yet (guest or unverified email).
export default function VerifyEmailBanner() {
  const { user, isGuest, emailVerified, resendVerification, checkEmailVerified } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || emailVerified) return null;

  const box = {
    margin: '0 0 1rem', padding: '0.9rem 1rem', borderRadius: 12,
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24',
    fontSize: '0.9rem', lineHeight: 1.4,
  };
  const btn = {
    marginRight: 8, marginTop: 8, padding: '0.45rem 0.8rem', borderRadius: 8, border: 'none',
    background: '#f59e0b', color: '#111', fontWeight: 700, cursor: 'pointer',
  };

  async function run(fn, ok) {
    setBusy(true);
    setMsg('');
    try { setMsg(await fn() ?? ok); } catch (e) { setMsg(e.message || 'Something went wrong.'); }
    setBusy(false);
  }

  if (isGuest) {
    return (
      <div style={box} id="verify-banner" role="alert">
        🔒 Guests can browse, but joining or hosting games needs a verified account.
        <div><button style={btn} onClick={() => navigate('/settings')}>Create account</button></div>
      </div>
    );
  }

  return (
    <div style={box} id="verify-banner" role="alert">
      ✉️ Verify your email to join or host games. We sent a link to <b>{user.email}</b>.
      <div>
        <button style={btn} disabled={busy} onClick={() => run(async () => { await resendVerification(); }, 'Verification email sent.')}>
          Resend email
        </button>
        <button style={btn} disabled={busy} onClick={() => run(async () => ((await checkEmailVerified()) ? 'Verified! You are good to go.' : 'Not verified yet. Click the link in your email first.'))}>
          I verified
        </button>
      </div>
      {msg && <div style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
