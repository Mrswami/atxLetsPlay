import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
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
        <button className="profile-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
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
        </div>

        {/* Sport Preferences */}
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
