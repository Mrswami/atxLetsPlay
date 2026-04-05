import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import AustinMap3D from '../components/AustinMap3D';
import CreateGameModal from '../components/CreateGameModal';
import './Home.css';

export default function Home() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 = dashboard, 1 = full map
  const [mapLocked, setMapLocked] = useState(false);

  const displayName = userProfile?.displayName || user?.displayName || 'Player';
  const xp = userProfile?.xp || 0;
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL || '';

  const activeGames = {
    mueller: 3,
    downtown: 1,
    'hyde-park': 2,
    'south-congress': 1,
  };

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
    setActiveDistrict(district);
    setShowCreateModal(true);
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
        <div className="home-avatar">
          <Avatar url={avatarUrl} name={displayName} size="large" xp={0} />
        </div>

        {/* Settings Cog (large, prominent) */}
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

        {/* Quick Actions */}
        <div className="home-actions">
          <button className="action-btn action-btn--create" id="create-game-button" onClick={() => setShowCreateModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            CALL NEXT
          </button>
          <button className="action-btn action-btn--join" id="join-game-button" onClick={() => navigate('/feed')}>
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
        <AustinMap3D
          onDistrictClick={handleDistrictClick}
          activeGames={activeGames}
          scrollProgress={scrollProgress}
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

      {/* Scroll spacer — creates the scroll distance for the zoom effect */}
      {!mapLocked && <div className="scroll-spacer" />}

      {showCreateModal && (
        <CreateGameModal
          district={activeDistrict}
          onClose={() => { setShowCreateModal(false); setActiveDistrict(null); }}
          onSuccess={() => console.log('Game created!')}
        />
      )}
    </div>
  );
}
