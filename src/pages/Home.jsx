import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import AustinMap from '../components/AustinMap';
import { useAllActiveGames } from '../hooks/useCourts';
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

  const { activeGames } = useAllActiveGames();

  // Fetch all courts for quick selector
  useEffect(() => {
    getDocs(collection(db, 'courts'))
      .then((snap) => {
        setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(console.error);
  }, []);

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
    <div className="home-page" ref={containerRef}>
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
          <SearchBar onSearch={handleSearch} />
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

