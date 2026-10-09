import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

  const [matchHistory, setMatchHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!subjectUid || String(subjectUid).startsWith('guest-')) {
      setLoadingHistory(false);
      return;
    }
    const q1 = query(collection(db, 'games'), where('createdBy', '==', subjectUid));
    const q2 = query(collection(db, 'games'), where('currentPlayers', 'array-contains', subjectUid));
    
    Promise.all([getDocs(q1), getDocs(q2)]).then(([snap1, snap2]) => {
      const allGames = new Map();
      snap1.docs.forEach(d => allGames.set(d.id, { id: d.id, ...d.data() }));
      snap2.docs.forEach(d => allGames.set(d.id, { id: d.id, ...d.data() }));
      
      const games = Array.from(allGames.values())
        .sort((a, b) => {
          const tA = a.scheduledTime?.toMillis ? a.scheduledTime.toMillis() : 0;
          const tB = b.scheduledTime?.toMillis ? b.scheduledTime.toMillis() : 0;
          return tB - tA; 
        });
      setMatchHistory(games);
      setLoadingHistory(false);
    }).catch(err => {
      console.warn('Error fetching match history', err);
      setLoadingHistory(false);
    });
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
  const prefSports = Array.isArray(profile?.sport_preferences) ? profile.sport_preferences : (profile?.sport_preferences ? [profile.sport_preferences] : ['basketball', 'soccer']);

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <button 
            className="action-btn" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            onClick={() => navigate('/', { state: { viewMode: 'dashboard' } })}
          >
            <span>📊</span> Go to Live Dashboard
          </button>
        </div>

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
          {profile?.username && <div className="profile-username" style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)', fontWeight: '600', marginBottom: '0.2rem' }}>@{profile.username}</div>}
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

        {/* Match History */}
        <div className="profile-section">
          <h3>Match History</h3>
          <div className="profile-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingHistory ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Loading games...</div>
            ) : matchHistory.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', background: 'var(--surface-elevated)', borderRadius: '12px' }}>No games played yet.</div>
            ) : (
              matchHistory.map(game => {
                const durationMs = (game.duration || 2) * 60 * 60 * 1000;
                const schedTime = game.scheduledTime?.toMillis ? game.scheduledTime.toMillis() : Date.now();
                const isOver = Date.now() >= schedTime + durationMs || game.status === 'cancelled' || game.status === 'completed';
                
                return (
                  <div key={game.id} className="profile-history-card" style={{ 
                    background: isOver ? 'transparent' : 'var(--surface-elevated)', 
                    border: isOver ? '1px dashed var(--glass-border)' : '1px solid var(--glass-border)', 
                    opacity: isOver ? 0.5 : 1, 
                    borderRadius: '12px', 
                    padding: '12px 16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer', 
                    filter: isOver ? 'grayscale(1)' : 'none' 
                  }} onClick={() => navigate(`/live-game/${game.id}`)}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {SPORT_META[game.sport]?.emoji} {AUSTIN_COURTS_DATA.find(c => c.id === game.courtId)?.name || 'Austin Court'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {game.scheduledTime?.toMillis ? new Date(game.scheduledTime.toMillis()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown Time'} • {isOver ? 'Played' : (game.status === 'open' ? 'Active' : 'Completed')}
                      </div>
                    </div>
                    <div style={{ color: game.createdBy === subjectUid ? (isOver ? 'var(--text-secondary)' : 'var(--accent-primary)') : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {game.createdBy === subjectUid ? 'Hosted' : 'Joined'}
                    </div>
                  </div>
                );
              })
            )}
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
