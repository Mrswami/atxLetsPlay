import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { getNoShowStats, reportUser, blockUser, unblockUser, REPORT_REASONS } from '../services/safety';
import { useBlocked } from '../hooks/useBlocked';
import { getFriendshipStatus, sendFriendRequest, acceptFriendRequest, removeFriendOrRequest, getUserFriendships } from '../services/friends';
import { generateDefaultUsername } from '../utils/usernameGenerator';
import './Profile.css';

export default function Profile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [resolvedUid, setResolvedUid] = useState(null);
  const [targetProfile, setTargetProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Determine if viewing own profile
  const isDirectOwnProfile = !uid || (user && uid === user.uid);
  const isOwnProfile = isDirectOwnProfile || (user && resolvedUid === user.uid);

  useEffect(() => {
    if (!uid) {
      // Default to logged-in user
      setResolvedUid(user?.uid || null);
      setLoadingProfile(false);
      return;
    }

    if (user && uid === user.uid) {
      setResolvedUid(user.uid);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    const cleanParam = uid.replace(/^@/, '').trim();

    // 1. Try fetching directly as a user UID
    getDoc(doc(db, 'users', cleanParam))
      .then(async (snap) => {
        if (snap.exists()) {
          setResolvedUid(cleanParam);
          setTargetProfile(snap.data());
          setLoadingProfile(false);
        } else {
          // 2. Try looking up as a username in the 'usernames' index
          const usernameSnap = await getDoc(doc(db, 'usernames', cleanParam.toLowerCase()));
          if (usernameSnap.exists() && usernameSnap.data()?.uid) {
            const realUid = usernameSnap.data().uid;
            setResolvedUid(realUid);
            const realUserSnap = await getDoc(doc(db, 'users', realUid));
            if (realUserSnap.exists()) {
              setTargetProfile(realUserSnap.data());
            } else {
              setTargetProfile({
                displayName: cleanParam,
                username: cleanParam,
                district: 'mueller',
                xp: 1000,
                rep: 5.0,
                sport_preferences: ['basketball', 'petanque'],
                badges: ['pioneer']
              });
            }
          } else {
            // 3. Fallback search by username query
            const q = query(collection(db, 'users'), where('username', '==', cleanParam.toLowerCase()));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const d = qSnap.docs[0];
              setResolvedUid(d.id);
              setTargetProfile(d.data());
            } else {
              // Generic fallback player profile
              setResolvedUid(cleanParam);
              setTargetProfile({
                displayName: cleanParam,
                username: cleanParam,
                district: 'mueller',
                xp: 1200,
                rep: 5.0,
                sport_preferences: ['basketball', 'petanque'],
                badges: ['pioneer']
              });
            }
          }
          setLoadingProfile(false);
        }
      })
      .catch((err) => {
        console.warn('Error fetching user profile:', err);
        setLoadingProfile(false);
      });
  }, [uid, user]);

  const profile = isOwnProfile ? (userProfile || targetProfile) : targetProfile;
  const subjectUid = isOwnProfile ? user?.uid : resolvedUid;
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

  // Friends Logic
  const [friendshipStatus, setFriendshipStatus] = useState(null); // 'pending', 'accepted', null
  const [actionUser, setActionUser] = useState(null);
  const [friendCount, setFriendCount] = useState(0);
  const [friendDialog, setFriendDialog] = useState(null); // null | 'sent' | 'confirm_undo' | 'confirm_remove'
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  useEffect(() => {
    if (!subjectUid || String(subjectUid).startsWith('guest-')) return;
    
    // Fetch Friend Count
    getUserFriendships(subjectUid).then(friendships => {
      setFriendCount(friendships.filter(f => f.status === 'accepted').length);
    });

    if (!isOwnProfile && user && !user.isAnonymous) {
      getFriendshipStatus(user.uid, subjectUid).then(statusData => {
        if (statusData) {
          setFriendshipStatus(statusData.status);
          setActionUser(statusData.actionUser);
        } else {
          setFriendshipStatus(null);
        }
      });
    }
  }, [subjectUid, isOwnProfile, user]);

  const handleFriendAction = async () => {
    if (!user || user.isAnonymous) {
      triggerToast("Sign in to add friends!");
      return;
    }
    
    try {
      if (!friendshipStatus) {
        await sendFriendRequest(user.uid, subjectUid);
        setFriendshipStatus('pending');
        setActionUser(user.uid);
        setFriendDialog('sent');
      } else if (friendshipStatus === 'pending') {
        if (actionUser === user.uid) {
          // Open safety confirmation dialog to undo request
          setFriendDialog('confirm_undo');
        } else {
          // Accept request
          await acceptFriendRequest(user.uid, subjectUid);
          setFriendshipStatus('accepted');
          setFriendCount(prev => prev + 1);
          triggerToast(`You and ${displayName} are now friends! 🎉`);
        }
      } else if (friendshipStatus === 'accepted') {
        setFriendDialog('confirm_remove');
      }
    } catch (e) {
      console.error(e);
      triggerToast('Error updating friendship.');
    }
  };

  const handleConfirmUndo = async () => {
    setFriendDialog(null);
    try {
      await removeFriendOrRequest(user.uid, subjectUid);
      setFriendshipStatus(null);
      setActionUser(null);
      triggerToast('Friend request cancelled.');
    } catch (e) {
      console.error(e);
      triggerToast('Error cancelling request.');
    }
  };

  const handleConfirmRemove = async () => {
    setFriendDialog(null);
    try {
      await removeFriendOrRequest(user.uid, subjectUid);
      setFriendshipStatus(null);
      setActionUser(null);
      setFriendCount(prev => Math.max(0, prev - 1));
      triggerToast('Friend removed.');
    } catch (e) {
      console.error(e);
      triggerToast('Error removing friend.');
    }
  };


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

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="profile-page">
      {/* Header Navigation */}
      <header className="profile-header">
        <button className="profile-back-btn" onClick={handleBack} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>{isOwnProfile ? 'My Profile' : `${displayName}'s Profile`}</h1>
        {isOwnProfile ? (
          <button
            className="profile-edit-btn"
            onClick={() => navigate('/settings')}
            aria-label="Edit Profile & Settings"
          >
            <span>⚙️</span> Edit
          </button>
        ) : (
          <button 
            className="profile-edit-btn" 
            onClick={() => navigate('/friends')}
            title="Friends Hub"
          >
            <span>👥</span> Squad
          </button>
        )}
      </header>

      <div className="profile-container">
        {isOwnProfile ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button 
              className="action-btn" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
              onClick={() => navigate('/', { state: { viewMode: 'dashboard' } })}
            >
              <span>📊</span> Go to Live Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', padding: '8px 14px', background: 'rgba(34, 211, 102, 0.08)', border: '1px solid rgba(34, 211, 102, 0.25)', borderRadius: '12px', fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
            <span>👀 Viewing Player Card</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Austin Community</span>
          </div>
        )}

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
          <div className="profile-username" style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)', fontWeight: '600', marginBottom: '0.2rem' }}>
            @{profile?.username || generateDefaultUsername(displayName, subjectUid)}
          </div>
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
          <div className="stat-card" onClick={() => navigate('/friends', { state: { targetUid: subjectUid } })} style={{ cursor: 'pointer' }}>
            <span className="stat-num">{friendCount}</span>
            <span className="stat-label" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Friends</span>
          </div>
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

        {!isOwnProfile && user && !user.isAnonymous && (
          <div className="profile-actions-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className={`action-btn ${friendshipStatus === 'accepted' ? '' : 'action-btn--join'}`} 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'center', 
                  gap: '8px',
                  background: friendshipStatus === 'pending' && actionUser === user.uid ? 'rgba(234, 179, 8, 0.15)' : undefined,
                  border: friendshipStatus === 'pending' && actionUser === user.uid ? '1px solid rgba(234, 179, 8, 0.4)' : undefined,
                  color: friendshipStatus === 'pending' && actionUser === user.uid ? '#fde047' : undefined
                }}
                onClick={handleFriendAction}
                title={friendshipStatus === 'pending' && actionUser === user.uid ? 'Click to cancel friend request' : undefined}
              >
                <span>{friendshipStatus === 'accepted' ? '✔️' : (friendshipStatus === 'pending' && actionUser === user.uid ? '📩' : '🤝')}</span> 
                {friendshipStatus === 'accepted' ? 'Friends' : friendshipStatus === 'pending' ? (actionUser === user.uid ? 'Request Sent' : 'Accept Request') : 'Add Friend'}
              </button>
              <button className="action-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--surface-elevated)' }} onClick={() => navigate('/friends')}>
                <span>💬</span> Message
              </button>
            </div>
            {friendshipStatus === 'pending' && actionUser === user.uid && (
              <div style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                💡 Request pending. Tap button above to undo or cancel.
              </div>
            )}
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

      {/* Friend Action & Safety Confirmation Dialogs */}
      {friendDialog && (
        <div className="friend-modal-overlay" onClick={() => setFriendDialog(null)}>
          <div className="friend-modal-content anim-scale-in" onClick={(e) => e.stopPropagation()}>
            {friendDialog === 'sent' && (
              <>
                <div className="friend-modal-icon">🤝</div>
                <h3>Friend Request Sent!</h3>
                <p>
                  Your friend request has been delivered to <strong>{displayName}</strong>. They can accept it from their Friends hub.
                </p>
                <div className="friend-modal-notice">
                  <span>🛡️</span>
                  <span><strong>Accidentally clicked?</strong> You can undo or cancel your request at any time.</span>
                </div>
                <div className="friend-modal-actions">
                  <button className="secondary-btn" onClick={handleConfirmUndo}>
                    Undo Request
                  </button>
                  <button className="primary-btn" onClick={() => setFriendDialog(null)}>
                    Got It
                  </button>
                </div>
              </>
            )}

            {friendDialog === 'confirm_undo' && (
              <>
                <div className="friend-modal-icon warning">⚠️</div>
                <h3>Undo Friend Request?</h3>
                <p>
                  Are you sure you want to cancel your pending friend request to <strong>{displayName}</strong>?
                </p>
                <div className="friend-modal-actions">
                  <button className="secondary-btn danger" onClick={handleConfirmUndo}>
                    Yes, Undo Request
                  </button>
                  <button className="primary-btn" onClick={() => setFriendDialog(null)}>
                    Keep Request
                  </button>
                </div>
              </>
            )}

            {friendDialog === 'confirm_remove' && (
              <>
                <div className="friend-modal-icon warning">💔</div>
                <h3>Remove Friend?</h3>
                <p>
                  Are you sure you want to remove <strong>{displayName}</strong> from your squad?
                </p>
                <div className="friend-modal-actions">
                  <button className="secondary-btn danger" onClick={handleConfirmRemove}>
                    Yes, Remove Friend
                  </button>
                  <button className="primary-btn" onClick={() => setFriendDialog(null)}>
                    Keep Friend
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMsg && <div className="profile-toast">{toastMsg}</div>}
    </div>
  );
}

