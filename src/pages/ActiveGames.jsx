import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAllActiveGames, joinGame, leaveGame } from '../hooks/useCourts';
import { SPORT_META } from '../data/courtsMeta';
import Loading from '../components/Loading';
import './ActiveGames.css';

export default function ActiveGames() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gamesList, loading } = useAllActiveGames();
  const [activeSport, setActiveSport] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading) return <Loading />;

  // Filter games based on sport tab and search query
  const filteredGames = gamesList.filter((game) => {
    const matchesSport = activeSport === 'all' || game.sport === activeSport;
    const matchesSearch =
      searchQuery === '' ||
      game.courtName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSport && matchesSearch;
  });

  // Extract all sports that currently have scheduled games, for helpful indicators
  const sportsWithGames = new Set(gamesList.map((g) => g.sport));

  async function handleGameAction(game) {
    if (!user) {
      navigate('/login');
      return;
    }

    const isJoined = game.currentPlayers?.includes(user.uid);
    try {
      setActionError('');
      if (isJoined) {
        await leaveGame(game.id, user.uid);
      } else {
        await joinGame(game.id, user.uid);
      }
    } catch (err) {
      setActionError(err.message || 'Action failed. Please try again.');
    }
  }

  return (
    <div className="active-games-page">
      {/* Header */}
      <header className="ag-header">
        <button className="ag-back-btn" onClick={() => navigate('/')} aria-label="Back to map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Active Pickups</h1>
      </header>

      {/* Search Bar */}
      <div className="ag-search-container">
        <div className="ag-search-bar">
          <svg className="ag-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="ag-search-input"
            type="text"
            placeholder="Search by court or rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button className="ag-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      {/* Sport Category Filter Slider */}
      <div className="ag-sport-filter">
        {['all', 'basketball', 'soccer', 'tennis', 'pickleball', 'volleyball', 'baseball', 'disc-golf', 'petanque'].map((sport) => {
          const meta = SPORT_META[sport];
          const hasGames = sport === 'all' || sportsWithGames.has(sport);
          return (
            <button
              key={sport}
              className={`ag-sport-tab ${activeSport === sport ? 'active' : ''} ${!hasGames ? 'empty' : ''}`}
              onClick={() => setActiveSport(sport)}
              id={`ag-tab-${sport}`}
            >
              <span className="ag-tab-emoji">{sport === 'all' ? '🗺️' : meta?.emoji}</span>
              <span className="ag-tab-label">{sport === 'all' ? 'All' : meta?.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error alert */}
      {actionError && <div className="ag-action-error">{actionError}</div>}

      {/* Games List */}
      <div className="ag-list">
        {filteredGames.length === 0 ? (
          <div className="ag-empty">
            <span>🏟️</span>
            <h2>No pickups scheduled</h2>
            <p>No active matches match your criteria.</p>
            <button className="ag-create-cta" onClick={() => navigate('/')}>
              Find a court to schedule
            </button>
          </div>
        ) : (
          filteredGames.map((game) => {
            const meta = SPORT_META[game.sport];
            const isJoined = game.currentPlayers?.includes(user?.uid);
            const spotsLeft = (game.maxPlayers || 10) - (game.currentPlayers?.length || 0);
            const scheduledDate = game.scheduledTime?.toDate?.();
            const timeStr = scheduledDate
              ? scheduledDate.toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Time TBD';

            return (
              <div key={game.id} className={`ag-card ${isJoined ? 'joined' : ''}`}>
                <div className="ag-card-header">
                  <span className="ag-card-badge" style={{ '--badge-color': meta?.color }}>
                    {meta?.emoji} {meta?.label}
                  </span>
                  <span className={`ag-card-spots ${spotsLeft <= 2 && spotsLeft > 0 ? 'few' : ''} ${spotsLeft === 0 ? 'full' : ''}`}>
                    {spotsLeft === 0 ? 'FULL' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                  </span>
                </div>

                <div className="ag-card-body">
                  <button
                    className="ag-court-name-btn"
                    onClick={() => navigate(`/court/${game.courtId}`)}
                  >
                    <h3>{game.courtName}</h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <p className="ag-time">📅 {timeStr}</p>
                  <p className="ag-skill">⭐ Level: {game.skillLevel || 'Casual'}</p>
                  {game.notes && <p className="ag-notes">“ {game.notes} ”</p>}
                </div>

                <div className="ag-card-actions">
                  <button
                    className={`ag-join-btn ${isJoined ? 'leave' : ''}`}
                    disabled={spotsLeft === 0 && !isJoined}
                    onClick={() => handleGameAction(game)}
                    id={`ag-join-${game.id}`}
                  >
                    {isJoined ? 'LEAVE GAME' : spotsLeft === 0 ? 'FULL' : 'I GOT NEXT'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Copyright footer */}
      <footer className="ag-footer-llc">
        © 2026 Swami Software, LLC · All rights reserved.
      </footer>
    </div>
  );
}
