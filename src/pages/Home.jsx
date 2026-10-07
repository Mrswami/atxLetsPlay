import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import AustinStreetMap from '../components/AustinStreetMap';
import { useAllActiveGames } from '../hooks/useCourts';
import { SPORT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './Home.css';

export default function Home() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  // Default to real street/terrain map view matching user's reference map
  const [viewMode, setViewMode] = useState('street'); // 'street' | 'dashboard'
  const [courts, setCourts] = useState(AUSTIN_COURTS_DATA || []);
  const [showCourtSelect, setShowCourtSelect] = useState(false);
  const [toast, setToast] = useState(null);

  const handleCallNext = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const userHostedGames = gamesList.filter(g => g.hostId === user.uid && g.status === 'open');
    if (userHostedGames.length >= 5) {
      setToast({ type: 'error', message: 'You have reached the daily limit of 5 hosted games.' });
      return;
    }
    setShowCourtSelect(true);
  };
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestForm, setSuggestForm] = useState({ name: '', location: '', sport: 'Basketball', notes: '' });

  const displayName = userProfile?.displayName || user?.displayName || 'Player';
  const xp = userProfile?.xp || 0;
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL || '';

  const { gamesList } = useAllActiveGames();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Group games count per courtId
  const gamesCountPerCourt = {};
  const gamesByCourt = {};
  if (gamesList) {
    gamesList.forEach((game) => {
      if (game.status === 'open') {
        gamesCountPerCourt[game.courtId] = (gamesCountPerCourt[game.courtId] || 0) + 1;
        if (!gamesByCourt[game.courtId]) gamesByCourt[game.courtId] = [];
        gamesByCourt[game.courtId].push(game);
      }
    });
  }

  const getPersonalizedHint = useCallback((court) => {
    const userDistrict = userProfile?.district || '';
    const userSports = userProfile?.sport_preferences || [];
    const userPlayStyle = userProfile?.playStyle || 'chill';
    const inDistrict = court.district === userDistrict;
    const matchesSport = (court.sport || []).some((s) => userSports.includes(s));
    let styleLabel = '';
    if (userPlayStyle === 'chill') styleLabel = '😌 Chill vibes match';
    else if (userPlayStyle === 'competitive') styleLabel = '🏆 Competitive pickup';
    else if (userPlayStyle === 'athletic') styleLabel = '🏃‍♂️ Athletic challenge';
    else if (userPlayStyle === 'curious') styleLabel = '🤔 Try something new';
    if (inDistrict && matchesSport) return `🔥 Best Match · ${styleLabel}`;
    else if (matchesSport) return `✨ Matches your sports · ${styleLabel}`;
    else if (inDistrict) return `🏠 In your district · ${styleLabel}`;
    return styleLabel;
  }, [userProfile]);

  const getRecommendedCourts = useCallback(() => {
    const userDistrict = userProfile?.district || '';
    const userSports = userProfile?.sport_preferences || [];
    let list = courts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = courts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        (c.sport || []).some((s) => s.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let aScore = 0, bScore = 0;
      if (a.district === userDistrict && (a.sport || []).some(s => userSports.includes(s))) aScore += 10;
      else if ((a.sport || []).some(s => userSports.includes(s))) aScore += 5;
      else if (a.district === userDistrict) aScore += 2;
      if (b.district === userDistrict && (b.sport || []).some(s => userSports.includes(s))) bScore += 10;
      else if ((b.sport || []).some(s => userSports.includes(s))) bScore += 5;
      else if (b.district === userDistrict) bScore += 2;
      aScore += (gamesCountPerCourt[a.id] || 0) * 3;
      bScore += (gamesCountPerCourt[b.id] || 0) * 3;
      return bScore - aScore;
    }).slice(0, 5);
  }, [courts, searchQuery, userProfile, gamesCountPerCourt]);

  const recommendations = getRecommendedCourts();

  useEffect(() => {
    getDocs(collection(db, 'courts'))
      .then((snap) => {
        if (!snap.empty) {
          setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      })
      .catch((err) => {
        console.warn('Firestore fetch failed, using built-in Austin courts:', err);
      });
  }, []);

  const closeDashboard = useCallback(() => {
    setViewMode('street');
  }, []);

  const handleCourtSelect = useCallback((courtId) => {
    navigate(`/court/${courtId}`);
  }, [navigate]);

  const handleSuggestSubmit = (e) => {
    e.preventDefault();
    const { name, location, sport, notes } = suggestForm;
    const subject = encodeURIComponent(`New Court Suggestion: ${name}`);
    const body = encodeURIComponent(
      `Court Name: ${name}\nLocation: ${location}\nSport: ${sport}\n\nNotes:\n${notes}`
    );
    window.location.href = `mailto:jacobflutterdev@gmail.com?subject=${subject}&body=${body}`;
    setShowSuggestModal(false);
    setSuggestForm({ name: '', location: '', sport: 'Basketball', notes: '' });
  };

  return (
    <div
      className={`home-page ${searchFocused ? 'search-active' : ''}`}
      ref={containerRef}
    >
      {/* Floating Top Mode Selector */}
      <div className="view-mode-floating-bar">
        <button
          className={`vmf-btn ${viewMode === 'street' ? 'active' : ''}`}
          onClick={() => setViewMode('street')}
        >
          🗺️ Overworld Map
        </button>
        <button
          className={`vmf-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => setViewMode('dashboard')}
        >
          📊 Dashboard
        </button>
      </div>

      {viewMode === 'street' && (
        user ? (
          <button 
            className="overworld-avatar-btn" 
            onClick={() => navigate(`/profile/${user.uid}`)}
            aria-label="View Profile"
          >
            <Avatar url={avatarUrl} name={displayName} size="medium" xp={0} />
          </button>
        ) : (
          <button 
            className="overworld-login-btn" 
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        )
      )}

      {/* ── 1. REAL STREET & TERRAIN MAP (MATCHING REFERENCE IMAGE) ── */}
      {viewMode === 'street' && (
        <div className="street-map-fullscreen">
          <AustinStreetMap
            onPlaceSelect={(place) => {
              if (place.category === 'court') {
                navigate(`/court/${place.id}`);
              }
            }}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`settings-toast toast-${toast.type} anim-fade-in`} style={{ zIndex: 9999 }}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
          </span>
          <span className="toast-msg">{toast.message}</span>
        </div>
      )}

      {/* ── 2. DASHBOARD LAYER ── */}
      <div className={`dashboard-layer ${viewMode === 'dashboard' ? 'visible' : 'hidden'}`}>
        {/* Search overlay backdrop */}
        {searchFocused && (
          <div
            className="search-overlay-backdrop"
            onClick={() => setSearchFocused(false)}
          />
        )}
        <header className="home-header">
          <span className="header-brand">
            <span className="hb-atx">ATX</span>
            <span className="hb-lp">LET'S PLAY</span>
          </span>
          <div className="header-xp">
            <span className="xp-bolt">⚡</span>
            <span className="xp-num">{xp.toLocaleString()} XP</span>
          </div>
        </header>

        {/* Search */}
        <div className="home-search">
          <SearchBar
            query={searchQuery}
            setQuery={setSearchQuery}
            focused={searchFocused}
            setFocused={setSearchFocused}
            onSearch={() => {}}
          />
          {searchFocused && (
            <div className="search-recommendations-dropdown">
              <div className="srd-header"><span>💡 Recommended Courts</span></div>
              <div className="srd-list">
                {recommendations.length === 0 ? (
                  <div className="srd-empty">No courts found.</div>
                ) : (
                  recommendations.map((court) => {
                    const activeCount = gamesCountPerCourt[court.id] || 0;
                    const primarySport = court.sport?.[0];
                    const sm = SPORT_META[primarySport];
                    const inDistrict = court.district === userProfile?.district;
                    return (
                      <button
                        key={court.id}
                        className="srd-item"
                        onClick={() => navigate(`/court/${court.id}`)}
                        id={`recommendation-${court.id}`}
                      >
                        <span className="srd-item-emoji">{sm?.emoji || '🏟️'}</span>
                        <div className="srd-item-info">
                          <span className="srd-item-name">
                            {court.name}
                            {inDistrict && <span className="srd-badge-district">Home</span>}
                          </span>
                          <span className="srd-item-meta">
                            {court.district?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            {court.sport?.map((s) => ` · ${SPORT_META[s]?.label || s}`)}
                          </span>
                          <span className="srd-item-personal">{getPersonalizedHint(court)}</span>
                        </div>
                        <div className="srd-item-action">
                          {activeCount > 0 ? (
                            <span className="srd-game-badge pulsing">{activeCount} Game{activeCount !== 1 ? 's' : ''}</span>
                          ) : (
                            <span className="srd-arrow">→</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          className="home-avatar-btn"
          onClick={() => user ? navigate(`/profile/${user.uid}`) : navigate('/login')}
          aria-label="View profile"
        >
          <Avatar url={avatarUrl} name={displayName} size="large" xp={0} />
        </button>

        {/* Utility row */}
        <div className="home-utility-row">
          <button
            className="settings-cog"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            id="settings-cog"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
          <button
            className="leaderboard-btn"
            onClick={() => navigate('/leaderboard')}
            aria-label="Leaderboard"
            id="leaderboard-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
              <path d="M12 2a5 5 0 0 0-5 5v3c0 2.21 1.79 4 4 4h2c2.21 0 4-1.79 4-4V7a5 5 0 0 0-5-5z" />
            </svg>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="home-actions">
          <button
            className="action-btn action-btn--create"
            id="create-game-button"
            onClick={handleCallNext}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            CALL NEXT
          </button>
          <button
            className="action-btn action-btn--join"
            id="join-game-button"
            onClick={() => navigate('/active-games')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            I GOT NEXT
          </button>
          <button
            onClick={() => setShowSuggestModal(true)}
            className="action-btn"
            style={{ 
              marginTop: '0.2rem', 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid var(--glass-border)', 
              color: 'var(--text-secondary)',
              padding: '0.75rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              borderRadius: '16px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '0.9rem'
            }}
          >
            💡 Suggest a New Court
          </button>
        </div>

        {/* Venmo-style Social Activity Feed */}
        <div className="home-activity-feed">
          <div className="haf-header">
            <h3>🌐 ATX Live Feed</h3>
          </div>
          <div className="haf-list">
            {gamesList.length === 0 ? (
              <div className="haf-empty">No active games right now. Call Next to start one!</div>
            ) : (
              gamesList.slice(0, 10).map((game) => {
                const court = AUSTIN_COURTS_DATA.find((c) => c.id === game.courtId);
                const sm = SPORT_META[game.sport] || SPORT_META['basketball'];
                const scheduledDate = game.scheduledTime ? new Date(game.scheduledTime) : new Date();
                
                return (
                  <div key={game.id} className="haf-item" onClick={() => navigate(`/court/${game.courtId}`)}>
                    <Avatar url={game.hostAvatarUrl} name={game.hostName} size="small" />
                    <div className="haf-content">
                      <p>
                        <strong>{game.hostName || 'A player'}</strong> is hosting a {sm.emoji} <strong>{sm.label}</strong> pickup game at <strong>{court?.name || 'a court'}</strong>.
                      </p>
                      <span className="haf-time">
                        {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {game.players && game.players.length > 1 && ` · ${game.players.length} players joined`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Court Selection Drawer */}
      {showCourtSelect && (
        <div className="court-select-overlay" onClick={() => setShowCourtSelect(false)}>
          <div className="court-select-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cs-header">
              <h2>Select a Court</h2>
              <button className="cs-close" onClick={() => setShowCourtSelect(false)}>×</button>
            </div>
            <div className="cs-body">
              {courts.length === 0 ? (
                <p className="cs-loading">Loading courts...</p>
              ) : (
                <div className="cs-list">
                  {courts.map((court) => (
                    <button
                      key={court.id}
                      className="cs-item"
                      onClick={() => {
                        setShowCourtSelect(false);
                        navigate(`/create-game/${court.id}`);
                      }}
                      id={`select-court-${court.id}`}
                    >
                      <span className="cs-item-emoji">🏟️</span>
                      <div className="cs-item-info">
                        <span className="cs-item-name">{court.name}</span>
                        <span className="cs-item-district">
                          {court.district?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </div>
                      <span className="cs-item-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Modal Drawer */}
      {showSuggestModal && (
        <div className="court-select-overlay" onClick={() => setShowSuggestModal(false)}>
          <div className="court-select-drawer suggest-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cs-header">
              <h2>Suggest a Court</h2>
              <button className="cs-close" onClick={() => setShowSuggestModal(false)}>×</button>
            </div>
            <div className="cs-body" style={{ padding: '1.25rem' }}>
              <form onSubmit={handleSuggestSubmit} className="suggest-form">
                <div className="form-group">
                  <label>Court/Park Name</label>
                  <input 
                    required 
                    value={suggestForm.name} 
                    onChange={e => setSuggestForm({...suggestForm, name: e.target.value})} 
                    placeholder="e.g. Barton Hills Elementary" 
                  />
                </div>
                <div className="form-group">
                  <label>Location/Address</label>
                  <input 
                    required 
                    value={suggestForm.location} 
                    onChange={e => setSuggestForm({...suggestForm, location: e.target.value})} 
                    placeholder="e.g. 2108 Barton Haven Rd" 
                  />
                </div>
                <div className="form-group">
                  <label>Primary Sport</label>
                  <select 
                    value={suggestForm.sport} 
                    onChange={e => setSuggestForm({...suggestForm, sport: e.target.value})}
                  >
                    <option value="Basketball">Basketball 🏀</option>
                    <option value="Tennis">Tennis 🎾</option>
                    <option value="Pickleball">Pickleball 🏓</option>
                    <option value="Volleyball">Volleyball 🏐</option>
                    <option value="Soccer">Soccer ⚽</option>
                    <option value="Disc Golf">Disc Golf 🥏</option>
                    <option value="Other">Other / Not Listed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Additional Notes</label>
                  <textarea 
                    value={suggestForm.notes} 
                    onChange={e => setSuggestForm({...suggestForm, notes: e.target.value})} 
                    placeholder="Lights? Indoor/Outdoor? Smoothness?" 
                    rows="3"
                  />
                </div>
                <button type="submit" className="action-btn action-btn--create" style={{ marginTop: '1rem', width: '100%' }}>
                  SEND SUGGESTION
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
