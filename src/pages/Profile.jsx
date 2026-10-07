import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { getNoShowStats, reportUser, blockUser, unblockUser, REPORT_REASONS } from '../services/safety';
import { useBlocked } from '../hooks/useBlocked';
import './Profile.css';

export default function Profile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  // If viewing own profile or another player's profile
  const isOwnProfile = !uid || uid === user?.uid;
  const [targetProfile, setTargetProfile] = useState(null);

  useEffect(() => {
    if (!isOwnProfile && uid) {
      getDoc(doc(db, 'users', uid))
        .then((snap) => {
          if (snap.exists()) {
            setTargetProfile(snap.data());
          } else {
            setTargetProfile({
              displayName: 'Austin Baller',
              district: 'mueller',
              xp: 1450,
              gamesPlayed: 12,
              gamesHosted: 4,
              rep: 4.9,
              sport_preferences: ['basketball', 'soccer'],
              badges: ['pioneer', 'good-sport'],
            });
          }
        })
        .catch((err) => {
          console.warn('Error fetching target user profile:', err);
        });
    }
  }, [uid, isOwnProfile]);

  const profile = isOwnProfile ? userProfile : targetProfile;

  // Reliability + report/block
  const subjectUid = isOwnProfile ? user?.uid : uid;
  const blocked = useBlocked();
  const isBlocked = !!uid && blocked.has(uid);
  const [stats, setStats] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyMsg, setSafetyMsg] = useState('');

  useEffect(() => {
    if (!subjectUid || String(subjectUid).startsWith('guest-')) return;
    getNoShowStats(subjectUid).then(setStats).catch(() => setStats(null));
  }, [subjectUid]);

  async function submitReport() {
    try {
      await reportUser(uid, reportReason, reportDetails);
      setShowReport(false);
      setReportDetails('');
      setSafetyMsg('Report sent. Our team will review it.');
    } catch (e) { setSafetyMsg(e.message); }
  }

  async function toggleBlock() {
    try {
      if (isBlocked) { await unblockUser(uid); setSafetyMsg('User unblocked.'); }
      else { await blockUser(uid); setSafetyMsg('User blocked. You will no longer see their games.'); }
    } catch (e) { setSafetyMsg(e.message); }
  }


  const displayName = profile?.displayName || user?.displayName || 'Player';
  const districtName = (profile?.district || 'Austin').replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const xp = profile?.xp || 0;
  const bio = profile?.bio || '';
  const skillLevel = profile?.skillLevel || 'intermediate';
  const playStyle = profile?.playStyle || 'chill';
  const homeCourtId = profile?.homeCourtId || '';
  const homeCourt = AUSTIN_COURTS_DATA.find((c) => c.id === homeCourtId);
  
  // XP level calculation: 1000 XP per level
  const currentLevel = Math.floor(xp / 1000) + 1;
  const currentLevelXp = xp % 1000;
  const xpProgressPercent = (currentLevelXp / 1000) * 100;

  // Available badges reference
  const ALL_BADGES = {
    pioneer: { label: 'Pioneer', icon: '📍', desc: 'Filmed first court walkthrough' },
    champion: { label: 'Champion', icon: '🏆', desc: 'Hosted 5+ active pickups' },
    'good-sport': { label: 'Good Sport', icon: '🤝', desc: 'Earned 4.8+ rating score' },
    regular: { label: 'Mueller Crew', icon: '🥌', desc: 'Played 3+ games in Mueller' },
  };

  const earnedBadges = profile?.badges || ['pioneer', 'good-sport'];
  const prefSports = profile?.sport_preferences || ['basketball', 'soccer'];

  return (
    <div className="profile-page">
      {/* Header Navigation */}
      <header className="profile-header">
        <button className="profile-back-btn" onClick={() => navigate('/')} aria-label="Go home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Player Profile</h1>
        {isOwnProfile && (
          <button
            className="profile-edit-btn"
            onClick={() => navigate('/settings')}
            aria-label="Edit Profile & Settings"
          >
            <span>⚙️</span> Edit
          </button>
        )}
      </header>

      <div className="profile-container">
        {/* User Card */}
        <div className="profile-card">
          <div className="profile-avatar-wrapper">
            {profile?.avatarUrl || user?.photoURL ? (
              <img src={profile?.avatarUrl || user?.photoURL} alt={displayName} className="profile-img" />
            ) : (
              <div className="profile-avatar-fallback">
                {displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <span className="profile-level-badge">Lv. {currentLevel}</span>
          </div>

          <h2 className="profile-name">{displayName}</h2>
          <p className="profile-district">📍 {districtName} District</p>

          {homeCourt && (
            <button
              className="profile-home-court-chip"
              onClick={() => navigate(`/court/${homeCourt.id}`)}
            >
              🏟️ Home Court: {homeCourt.shortName || homeCourt.name} →
            </button>
          )}

          {bio && <p className="profile-bio">"{bio}"</p>}

          <div className="profile-tags-row">
            <span className="profile-meta-chip">
              {playStyle === 'chill' ? '😌 Chill' : playStyle === 'athletic' ? '🏃‍♂️ Athletic' : playStyle === 'competitive' ? '🏆 Competitive' : '🤔 Curious'}
            </span>
            <span className="profile-meta-chip">
              {skillLevel === 'casual' ? '🌱 Casual' : skillLevel === 'intermediate' ? '⚡ Intermediate' : skillLevel === 'advanced' ? '🔥 Advanced' : '👑 Elite'}
            </span>
          </div>

          {/* XP Progress Bar */}
          <div className="profile-xp-section">
            <div className="xp-labels">
              <span>XP Level progress</span>
              <span>{currentLevelXp} / 1,000 XP</span>
            </div>
            <div className="xp-progress-track">
              <div className="xp-progress-bar" style={{ width: `${xpProgressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
          <div className="stat-card">
            <span className="stat-num">{profile?.gamesPlayed || 0}</span>
            <span className="stat-label">Played</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{profile?.gamesHosted || 0}</span>
            <span className="stat-label">Hosted</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{profile?.rep ? `${profile.rep.toFixed(1)}★` : '5.0★'}</span>
            <span className="stat-label">Rep Rating</span>
          </div>
          <div className="stat-card" id="reliability-stat">
            <span className="stat-num">{stats?.reliability != null ? `${stats.reliability}%` : 'New'}</span>
            <span className="stat-label">Reliability</span>
          </div>
        </div>

        {!isOwnProfile && user && !user.isAnonymous && (
          <div className="profile-actions-row" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
            <button className="action-btn action-btn--join" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span>🤝</span> Add Friend
            </button>
            <button className="action-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--surface-elevated)' }} onClick={() => navigate('/friends')}>
              <span>💬</span> Message
            </button>
          </div>
        )}

        {!isOwnProfile && user && !user.isAnonymous && (
          <div className="profile-section" id="safety-actions">
            <h3>Safety</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="profile-edit-btn" onClick={toggleBlock}>{isBlocked ? 'Unblock' : '🚫 Block'}</button>
              <button className="profile-edit-btn" onClick={() => setShowReport((v) => !v)}>🚩 Report</button>
            </div>
            {showReport && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  {REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <textarea rows="3" maxLength="500" placeholder="What happened? (optional)" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} />
                <button className="profile-edit-btn" onClick={submitReport}>Submit report</button>
              </div>
            )}
            {safetyMsg && <p style={{ marginTop: 8 }}>{safetyMsg}</p>}
          </div>
        )}
        <div className="profile-section">
          <h3>Sport Preferences</h3>
          <div className="profile-sports-tags">
            {prefSports.map((sport) => {
              const meta = SPORT_META[sport];
              return (
                <span key={sport} className="profile-sport-tag" style={{ '--tag-color': meta?.color }}>
                  {meta?.emoji} {meta?.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Badges Earned */}
        <div className="profile-section">
          <h3>Unlocked Badges</h3>
          <div className="profile-badges-grid">
            {Object.keys(ALL_BADGES).map((key) => {
              const badge = ALL_BADGES[key];
              const isEarned = earnedBadges.includes(key);
              return (
                <div key={key} className={`profile-badge-card ${isEarned ? 'earned' : 'locked'}`}>
                  <span className="badge-icon">{badge.icon}</span>
                  <h4>{badge.label}</h4>
                  <p>{badge.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copyright branding */}
        <div className="profile-footer-llc">
          © 2026 Swami Software, LLC. Powered by Swami Cloud.
        </div>
      </div>
    </div>
  );
}
