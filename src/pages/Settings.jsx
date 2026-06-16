import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Settings.css';

export default function Settings() {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Settings</h1>
      </header>

      <section className="settings-section">
        <h2 className="section-title">Account</h2>
        <div className="setting-item">
          <span className="setting-label">Email</span>
          <span className="setting-value">{user?.email || '—'}</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Player Name</span>
          <span className="setting-value">{userProfile?.displayName || user?.displayName || '—'}</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">District</span>
          <span className="setting-value">{userProfile?.district || 'Not set'}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Stats</h2>
        <div className="setting-item">
          <span className="setting-label">XP</span>
          <span className="setting-value accent">{(userProfile?.xp || 0).toLocaleString()}</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Games Played</span>
          <span className="setting-value">{userProfile?.gamesPlayed || 0}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">App</h2>
        <div className="setting-item">
          <span className="setting-label">Version</span>
          <span className="setting-value">0.1.0-alpha</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Copyright</span>
          <span className="setting-value">© 2026 Swami Software, LLC</span>
        </div>
      </section>

      <button className="logout-btn" onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  );
}
