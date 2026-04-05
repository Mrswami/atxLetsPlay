import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getOpenGames, joinGame } from '../api/games';
import './GameFeed.css';

const DISTRICT_FILTERS = [
  { id: null, label: '🌆 All' },
  { id: 'mueller', label: '🛸 Mueller' },
  { id: 'hyde-park', label: '🏡 Hyde Park' },
  { id: 'downtown', label: '🌆 Downtown' },
  { id: 'south-congress', label: '🛍️ SoCo' },
];

function GameCard({ game, currentUserId, onJoin }) {
  const isCreator = game.creatorId === currentUserId;
  const hasJoined = game.players?.includes(currentUserId);
  const isFull = game.spotsLeft <= 0;
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    if (hasJoined || isFull || isCreator) return;
    setJoining(true);
    await onJoin(game.id);
    setJoining(false);
  }

  const spotsLeft = Math.max(0, game.spotsLeft ?? game.spots);

  return (
    <div className={`game-card ${hasJoined ? 'joined' : ''} ${isFull ? 'full' : ''}`}>
      {/* Sport + District badge */}
      <div className="game-card-header">
        <span className="game-sport">{game.sport}</span>
        <span className="game-district-badge">{game.districtName}</span>
      </div>

      {/* Court name */}
      <h3 className="game-court">{game.courtName}</h3>

      {/* When */}
      <div className="game-meta">
        <span className="game-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          {game.date}
        </span>
        <span className="game-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          {game.time}
        </span>
      </div>

      {/* Vibe note */}
      {game.vibeNote && (
        <p className="game-vibe">"{game.vibeNote}"</p>
      )}

      {/* Footer: creator + spots + join */}
      <div className="game-card-footer">
        <div className="game-creator">
          <span className="creator-handle">{game.creatorHandle || game.creatorName}</span>
          <div className="spots-bar">
            {Array.from({ length: game.spots }).map((_, i) => (
              <div key={i} className={`spot-dot ${i < (game.spots - spotsLeft) ? 'filled' : ''}`} />
            ))}
          </div>
          <span className="spots-text">{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
        </div>

        <button
          className={`join-btn ${hasJoined ? 'join-btn--in' : ''} ${isCreator ? 'join-btn--creator' : ''} ${isFull && !hasJoined ? 'join-btn--full' : ''}`}
          onClick={handleJoin}
          disabled={joining || isCreator || isFull && !hasJoined}
        >
          {joining ? '...' : isCreator ? '👑 YOURS' : hasJoined ? '✓ IN' : isFull ? 'FULL' : 'I GOT NEXT'}
        </button>
      </div>
    </div>
  );
}

export default function GameFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null);
  const [error, setError] = useState('');

  async function loadGames(districtId) {
    setLoading(true);
    setError('');
    try {
      const data = await getOpenGames(districtId);
      setGames(data);
    } catch (err) {
      console.error(err);
      setError('Could not load games. Check your connection.');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGames(activeFilter);
  }, [activeFilter]);

  async function handleJoin(gameId) {
    if (!user) return;
    try {
      await joinGame(gameId, user.uid);
      // Refresh the list
      await loadGames(activeFilter);
    } catch (err) {
      console.error('Join error:', err);
    }
  }

  return (
    <div className="feed-page">
      {/* Header */}
      <header className="feed-header">
        <button className="feed-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className="feed-title">
          <span className="feed-title-accent">I GOT</span> NEXT
        </h1>
        <button className="feed-refresh" onClick={() => loadGames(activeFilter)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
        </button>
      </header>

      {/* District filter chips */}
      <div className="feed-filters">
        {DISTRICT_FILTERS.map(f => (
          <button
            key={String(f.id)}
            className={`filter-chip ${activeFilter === f.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="feed-content">
        {loading && (
          <div className="feed-loading">
            {[1, 2, 3].map(i => <div key={i} className="card-skeleton" />)}
          </div>
        )}

        {!loading && error && (
          <div className="feed-empty">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="feed-empty">
            <span className="feed-empty-icon">🏀</span>
            <p className="feed-empty-text">No games running right now.</p>
            <p className="feed-empty-sub">Be the first to <strong>CALL NEXT</strong> in this district!</p>
            <button className="feed-call-next" onClick={() => navigate('/')}>
              GO CALL NEXT →
            </button>
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="game-list">
            {games.map(game => (
              <GameCard
                key={game.id}
                game={game}
                currentUserId={user?.uid}
                onJoin={handleJoin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
