import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { DISTRICT_META } from '../data/courtsMeta';
import './Leaderboard.css';

// Fallback mockup leaderboard dataset if offline or empty
const FALLBACK_LEADERBOARD = [
  { id: 'mock-1', name: 'Austin Baller', district: 'downtown', xp: 1450, avatarInitials: 'AB' },
  { id: 'mock-2', name: 'Pickle Queen', district: 'hyde-park', xp: 1200, avatarInitials: 'PQ' },
  { id: 'mock-3', name: 'GoalGetter', district: 'east', xp: 950, avatarInitials: 'GG' },
  { id: 'mock-4', name: 'Swami Software', district: 'mueller', xp: 850, avatarInitials: 'SS' },
  { id: 'mock-5', name: 'CourtHunter', district: 'norwood', xp: 600, avatarInitials: 'CH' },
  { id: 'mock-6', name: 'PetanqueKing', district: 'mueller', xp: 450, avatarInitials: 'PK' },
  { id: 'mock-7', name: 'SpikeMaster', district: 'south-congress', xp: 300, avatarInitials: 'SM' },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('xp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const usersList = snap.docs.map((d) => {
          const data = d.data();
          const name = data.displayName || 'Player';
          const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'ATX';
          return {
            id: d.id,
            name,
            district: data.district || 'downtown',
            xp: data.xp || 0,
            avatarInitials: initials,
            avatarUrl: data.avatarUrl || '',
            isCurrentUser: d.id === user?.uid,
          };
        });
        setLeaderboardData(usersList);
      } else {
        setLeaderboardData(FALLBACK_LEADERBOARD);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Leaderboard fetch fallback:', err);
      setLeaderboardData(FALLBACK_LEADERBOARD);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter leaderboard based on district filter
  const filteredData = selectedDistrict === 'all'
    ? leaderboardData
    : leaderboardData.filter((p) => p.district === selectedDistrict);

  // Recalculate display ranks when filtered
  const displayedData = filteredData.map((player, idx) => ({
    ...player,
    displayRank: idx + 1,
    isCurrentUser: player.id === user?.uid,
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
          {loading ? (
            <div className="lb-empty">
              <span>⚡</span>
              <p>Loading leaderboard rankings...</p>
            </div>
          ) : displayedData.length === 0 ? (
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
                  key={player.id || player.name}
                  className={`lb-item ${player.isCurrentUser ? 'current-user' : ''} ${isTop3 ? `top-${player.displayRank}` : ''}`}
                  onClick={() => player.id && !player.id.startsWith('mock-') && navigate(`/profile/${player.id}`)}
                  style={{ cursor: player.id && !player.id.startsWith('mock-') ? 'pointer' : 'default' }}
                >
                  {/* Rank / Medal */}
                  <div className="lb-rank-wrapper">
                    {isTop3 ? (
                      <span className="lb-medal">{medalEmoji}</span>
                    ) : (
                      <span className="lb-rank">{player.displayRank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="lb-avatar">
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt={player.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      player.avatarInitials
                    )}
                  </div>

                  {/* Player details */}
                  <div className="lb-info">
                    <span className="lb-name">{player.name} {player.isCurrentUser ? '(You)' : ''}</span>
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

