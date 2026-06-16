import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import AustinMap from '../components/AustinMap';
import { useAllActiveGames } from '../hooks/useCourts';
import { SPORT_META } from '../data/courtsMeta';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './Home.css';

export default function Home() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 = dashboard, 1 = full map
  const [mapLocked, setMapLocked] = useState(false);
  const [courts, setCourts] = useState([]);
  const [showCourtSelect, setShowCourtSelect] = useState(false);

  const displayName = userProfile?.displayName || user?.displayName || 'Player';
  const xp = userProfile?.xp || 0;
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL || '';

  const { activeGames, gamesList } = useAllActiveGames();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

  const scrollToMap = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: maxScroll, behavior: 'smooth' });
    }
  }, []);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 40) {
      if (!mapLocked) {
        scrollToMap();
      } else if (mapLocked && deltaY > 40) {
        handleBack();
      }
    }
  }, [mapLocked, scrollToMap, handleBack]);

  const getPersonalizedHint = useCallback((court) => {
    const userDistrict = userProfile?.district || '';
    const userSports = userProfile?.sport_preferences || [];
    const userPlayStyle = userProfile?.playStyle || 'chill';

    const inDistrict = court.district === userDistrict;
    const matchesSport = (court.sport || []).some((s) => userSports.includes(s));

    let styleLabel = '';
    if (userPlayStyle === 'chill') {
      styleLabel = '😌 Chill vibes match';
    } else if (userPlayStyle === 'competitive') {
      styleLabel = '🏆 Competitive pickup';
    } else if (userPlayStyle === 'athletic') {
      styleLabel = '🏃‍♂️ Athletic challenge';
    } else if (userPlayStyle === 'curious') {
      styleLabel = '🤔 Try something new';
    }

    if (inDistrict && matchesSport) {
      return `🔥 Best Match · ${styleLabel}`;
    } else if (matchesSport) {
      return `✨ Matches your sports · ${styleLabel}`;
    } else if (inDistrict) {
      return `🏠 In your district · ${styleLabel}`;
    }
    return styleLabel;
  }, [userProfile]);

  // Group games count per courtId for recommendation overlays
  const gamesCountPerCourt = {};
  if (gamesList) {
    gamesList.forEach((game) => {
      if (game.status === 'open') {
        gamesCountPerCourt[game.courtId] = (gamesCountPerCourt[game.courtId] || 0) + 1;
      }
    });
  }

  // Recommendation sorting scoring algorithm
  const getRecommendedCourts = () => {
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

    return [...list]
      .sort((a, b) => {
        const aInDistrict = a.district === userDistrict;
        const bInDistrict = b.district === userDistrict;
        const aMatchesSport = (a.sport || []).some((s) => userSports.includes(s));
        const bMatchesSport = (b.sport || []).some((s) => userSports.includes(s));

        let aScore = 0;
        let bScore = 0;

        if (aInDistrict && aMatchesSport) aScore += 10;
        else if (aMatchesSport) aScore += 5;
        else if (aInDistrict) aScore += 2;

        if (bInDistrict && bMatchesSport) bScore += 10;
        else if (bMatchesSport) bScore += 5;
        else if (bInDistrict) bScore += 2;

        // Boost courts with active matches
        aScore += (gamesCountPerCourt[a.id] || 0) * 3;
        bScore += (gamesCountPerCourt[b.id] || 0) * 3;

        return bScore - aScore;
      })
      .slice(0, 5); // Return top 5 recommendations
  };

  const recommendations = getRecommendedCourts();

  // Fetch all courts for quick selector
  useEffect(() => {
    getDocs(collection(db, 'courts'))
      .then((snap) => {
        setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(console.error);
  }, []);

  // Redirect to onboarding if profile is not completed
  useEffect(() => {
    if (userProfile && !userProfile.hasCompletedOnboarding) {
      navigate('/onboarding');
    }
  }, [userProfile, navigate]);

  // Scroll-driven zoom: track scroll progress 0→1
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapLocked) return;

    function onScroll() {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;
      const progress = Math.min(1, el.scrollTop / maxScroll);
      setScrollProgress(progress);

      // Lock when fully scrolled
      if (progress >= 0.98) {
        setMapLocked(true);
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [mapLocked]);

  // When locked, prevent scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (mapLocked) {
      el.style.overflow = 'hidden';
    } else {
      el.style.overflow = 'auto';
    }
  }, [mapLocked]);

  const handleBack = useCallback(() => {
    setMapLocked(false);
    setScrollProgress(0);
    const el = containerRef.current;
    if (el) {
      el.style.overflow = 'auto';
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  function handleSearch(query) {
    console.log('Search:', query);
  }

  function handleDistrictClick(district) {
    navigate(`/district/${district.id}`);
  }

  // Derived values from scroll progress
  const dashOpacity = Math.max(0, 1 - scrollProgress * 2.5); // fades by 40% scroll
  const mapScale = 0.45 + scrollProgress * 0.55; // 0.45 → 1.0
  const mapTranslateY = (1 - scrollProgress) * 10; // slides up as you scroll

  return (
    <div
      className={`home-page ${searchFocused ? 'search-active' : ''}`}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sleek Glassmorphic Search Overlay Backdrop */}
      {searchFocused && (
        <div
          className="search-overlay-backdrop"
          onClick={() => setSearchFocused(false)}
        />
      )}

      {/* ── Dashboard Layer (fades out on scroll) ── */}
      <div
        className="dashboard-layer"
        style={{
          opacity: dashOpacity,
          pointerEvents: dashOpacity < 0.1 ? 'none' : 'auto',
        }}
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
            onSearch={handleSearch}
          />

          {/* Search Dropdown Recommendations Overlay */}
          {searchFocused && (
            <div className="search-recommendations-dropdown">
              <div className="srd-header">
                <span>💡 Recommended Courts</span>
              </div>
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
                          <span className="srd-item-personal">
                            {getPersonalizedHint(court)}
                          </span>
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

        {/* Utility buttons row */}
        <div className="home-utility-row">
          {/* Settings Cog */}
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

          {/* Leaderboard Trophy */}
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
      </div>

      {/* ── Swipe Down Hint (fades out on scroll) ── */}
      <div
        className="map-swipe-hint"
        onClick={scrollToMap}
        style={{
          opacity: dashOpacity,
          pointerEvents: dashOpacity < 0.1 ? 'none' : 'auto',
        }}
      >
        <span className="swipe-chevron">▼</span>
        <span className="swipe-text">Swipe down to explore map</span>
      </div>

      {/* ── Map Layer (always visible, scales up on scroll) ── */}
      <div
        className={`map-layer ${mapLocked ? 'locked' : ''}`}
        style={{
          transform: `scale(${mapScale}) translateY(${mapTranslateY}vh)`,
        }}
      >
        <AustinMap
          onDistrictClick={handleDistrictClick}
          activeGames={activeGames}
        />
      </div>

      {/* ── Back Button (only visible when map is locked/full) ── */}
      <button
        className={`back-to-dash ${mapLocked ? 'visible' : ''}`}
        onClick={handleBack}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        THE COURT
      </button>

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

      {/* Scroll spacer — creates the scroll distance for the zoom effect */}
      {!mapLocked && <div className="scroll-spacer" />}
    </div>
  );
}

