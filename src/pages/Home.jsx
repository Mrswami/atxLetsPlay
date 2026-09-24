import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import WorldGlobe from '../components/WorldGlobe';
import { useAllActiveGames } from '../hooks/useCourts';
import { SPORT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './Home.css';

export default function Home() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  // Default to 3D stylized world immediately so users can explore courts instantly without sign-up
  const [worldMode, setWorldMode] = useState(true);
  const [courts, setCourts] = useState(AUSTIN_COURTS_DATA || []);
  const [showCourtSelect, setShowCourtSelect] = useState(false);
  const [globeExitAnim, setGlobeExitAnim] = useState(false);

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

  const openWorld = useCallback(() => {
    setGlobeExitAnim(false);
    setWorldMode(true);
  }, []);

  const closeWorld = useCallback(() => {
    setGlobeExitAnim(true);
    setTimeout(() => {
      setWorldMode(false);
      setGlobeExitAnim(false);
    }, 380);
  }, []);

  const handleCourtSelect = useCallback((court) => {
    navigate(`/court/${court.id}`);
  }, [navigate]);

  return (
    <div
      className={`home-page ${searchFocused ? 'search-active' : ''}`}
      ref={containerRef}
    >
      {/* Search overlay backdrop */}
      {searchFocused && (
        <div
          className="search-overlay-backdrop"
          onClick={() => setSearchFocused(false)}
        />
      )}

      {/* ── WORLD GLOBE FULLSCREEN MODE ── */}
      {worldMode && (
        <div className={`world-fullscreen ${globeExitAnim ? 'exiting' : 'entering'}`}>
          <WorldGlobe
            onCourtSelect={handleCourtSelect}
            activeGames={gamesCountPerCourt}
            activeGamesList={gamesByCourt}
            userProfile={userProfile}
            onCallNext={(courtId) => {
              user
                ? navigate(`/create-game/${courtId}`)
                : navigate(`/login?redirectTo=${encodeURIComponent(`/create-game/${courtId}`)}`, {
                    state: { redirectTo: `/create-game/${courtId}` },
                  });
            }}
            onJoinGame={(game) => {
              navigate(`/court/${game.courtId}`);
            }}
          />
          {/* Back button */}
          <button
            className="world-back-btn"
            onClick={closeWorld}
            id="world-back-btn"
            aria-label="Back to dashboard"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </button>
        </div>
      )}

      {/* ── DASHBOARD LAYER ── */}
      <div
        className={`dashboard-layer ${worldMode ? 'hidden' : 'visible'}`}
      >
        {/* Header */}
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
            onClick={() => user ? setShowCourtSelect(true) : navigate('/login')}
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
        </div>

        {/* ── Globe World Preview (teaser card) ── */}
        <div className="globe-preview-card" onClick={openWorld} id="globe-world-btn">
          <div className="gpc-glow" />
          <div className="gpc-content">
            <div className="gpc-icon">🌐</div>
            <div className="gpc-text">
              <span className="gpc-title">Explore ATX World</span>
              <span className="gpc-sub">Spin the globe · Tap courts</span>
            </div>
            <div className="gpc-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
          <div className="gpc-mini-globe">
            <div className="gpc-orb" />
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

      {/* Floating 3D World toggle button when in dashboard mode */}
      {!worldMode && (
        <button
          className="floating-world-toggle"
          onClick={openWorld}
          id="floating-world-btn"
          aria-label="Enter 3D World"
        >
          <span>🌍</span>
          <span>Explore 3D World</span>
        </button>
      )}
    </div>
  );
}
