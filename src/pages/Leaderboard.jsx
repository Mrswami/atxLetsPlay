import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DISTRICT_META } from '../data/courtsMeta';
import './Leaderboard.css';

// Static mockup leaderboard dataset
const LEADERBOARD_DATA = [
  { rank: 1, name: 'JD (You)', district: 'mueller', xp: 1800, avatarInitials: 'JD', isCurrentUser: true },
  { rank: 2, name: 'Austin Baller', district: 'downtown', xp: 1450, avatarInitials: 'AB' },
  { rank: 3, name: 'Pickle Queen', district: 'hyde-park', xp: 1200, avatarInitials: 'PQ' },
  { rank: 4, name: 'GoalGetter', district: 'east', xp: 950, avatarInitials: 'GG' },
  { rank: 5, name: 'Swami Software', district: 'mueller', xp: 850, avatarInitials: 'SS' },
  { rank: 6, name: 'CourtHunter', district: 'norwood', xp: 600, avatarInitials: 'CH' },
  { rank: 7, name: 'PetanqueKing', district: 'mueller', xp: 450, avatarInitials: 'PK' },
  { rank: 8, name: 'SpikeMaster', district: 'south-congress', xp: 300, avatarInitials: 'SM' },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState('all');

  // Filter leaderboard based on district filter
  const filteredData = selectedDistrict === 'all'
    ? LEADERBOARD_DATA
    : LEADERBOARD_DATA.filter((p) => p.district === selectedDistrict);

  // Recalculate display ranks when filtered
  const displayedData = filteredData.map((player, idx) => ({
    ...player,
    displayRank: idx + 1,
  }));

  return (
    <div className="leaderboard-page">
      {/* Header */}
      <header className="lb-header">
        <button className="lb-back-btn" onClick={() => navigate('/')} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Leaderboard</h1>
      </header>

      {/* District Select Filter */}
      <div className="lb-filter-container">
        <label htmlFor="lb-district-select">Filter District</label>
        <select
          id="lb-district-select"
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
        >
          <option value="all">🗺️ All Austin</option>
          {Object.keys(DISTRICT_META).map((key) => (
            <option key={key} value={key}>
              📍 {DISTRICT_META[key].label}
            </option>
          ))}
        </select>
      </div>

      {/* Rankings List */}
      <div className="lb-container">
        <div className="lb-list">
          {displayedData.length === 0 ? (
            <div className="lb-empty">
              <span>🏜️</span>
              <p>No players ranked in this district yet.</p>
            </div>
          ) : (
            displayedData.map((player) => {
              const districtLabel = DISTRICT_META[player.district]?.label || player.district;
              const isTop3 = player.displayRank <= 3;
              let medalEmoji = '';
              if (player.displayRank === 1) medalEmoji = '🥇';
              else if (player.displayRank === 2) medalEmoji = '🥈';
              else if (player.displayRank === 3) medalEmoji = '🥉';

              return (
                <div
                  key={player.name}
                  className={`lb-item ${player.isCurrentUser ? 'current-user' : ''} ${isTop3 ? `top-${player.displayRank}` : ''}`}
                >
                  {/* Rank / Medal */}
                  <div className="lb-rank-wrapper">
                    {isTop3 ? (
                      <span className="lb-medal">{medalEmoji}</span>
                    ) : (
                      <span className="lb-rank">{player.displayRank}</span>
                    )}
                  </div>

                  {/* Avatar fallback */}
                  <div className="lb-avatar">
                    {player.avatarInitials}
                  </div>

                  {/* Player details */}
                  <div className="lb-info">
                    <span className="lb-name">{player.name}</span>
                    <span className="lb-district">{districtLabel}</span>
                  </div>

                  {/* XP */}
                  <div className="lb-xp">
                    <span className="lb-xp-num">{player.xp.toLocaleString()}</span>
                    <span className="lb-xp-label">XP</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <footer className="lb-footer-llc">
        © 2026 Swami Software, LLC · Austin, TX
      </footer>
    </div>
  );
}
