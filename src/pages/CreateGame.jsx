import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCourt } from '../hooks/useCourts';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { SPORT_META } from '../data/courtsMeta';
import Loading from '../components/Loading';
import './CreateGame.css';

export default function CreateGame() {
  const { courtId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { court, loading: courtLoading, error: courtError } = useCourt(courtId);

  const [sport, setSport] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [skillLevel, setSkillLevel] = useState('casual');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set default sport when court loads
  useEffect(() => {
    if (court && court.sport?.length > 0) {
      setSport(court.sport[0]);
    }
  }, [court]);

  if (courtLoading) return <Loading />;
  if (courtError || !court) {
    return (
      <div className="create-game-error">
        <span>🏟️</span>
        <h2>Court not found</h2>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sport || !scheduledTime || !maxPlayers) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const parsedMax = parseInt(maxPlayers, 10);
      if (isNaN(parsedMax) || parsedMax <= 1) {
        throw new Error('Please enter a valid number of players (minimum 2).');
      }

      const dateObj = new Date(scheduledTime);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Please enter a valid scheduled date and time.');
      }

      if (dateObj.getTime() < Date.now()) {
        throw new Error('Scheduled time cannot be in the past.');
      }

      const gameData = {
        courtId,
        courtName: court.name,
        district: court.district,
        sport,
        createdBy: user.uid,
        creatorName: userProfile?.displayName || user?.displayName || 'Player',
        status: 'open',
        scheduledTime: Timestamp.fromDate(dateObj),
        maxPlayers: parsedMax,
        currentPlayers: [user.uid], // Creator is automatically added to game
        skillLevel,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'games'), gameData);
      navigate(`/court/${courtId}`, { state: { fromCreate: true } });
    } catch (err) {
      setError(err.message || 'Failed to create game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="create-game-page">
      <header className="cg-header">
        <button className="cg-back-btn" onClick={() => navigate(-1)} aria-label="Cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>CALL NEXT</h1>
      </header>

      <div className="cg-container">
        <div className="cg-court-card">
          <span className="cg-court-emoji">{SPORT_META[court.sport?.[0]]?.emoji || '🏟️'}</span>
          <div className="cg-court-info">
            <h2>{court.name}</h2>
            <p>{court.address}</p>
          </div>
        </div>

        <form className="cg-form" onSubmit={handleSubmit}>
          {error && <div className="cg-form-error">{error}</div>}

          {/* Sport Selection */}
          <div className="form-group">
            <label htmlFor="cg-sport">Sport *</label>
            <select
              id="cg-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              required
            >
              {court.sport?.map((s) => (
                <option key={s} value={s}>
                  {SPORT_META[s]?.emoji} {SPORT_META[s]?.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Date/Time */}
          <div className="form-group">
            <label htmlFor="cg-time">Date & Time *</label>
            <input
              id="cg-time"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>

          {/* Max Players */}
          <div className="form-group">
            <label htmlFor="cg-max">Max Players *</label>
            <input
              id="cg-max"
              type="number"
              min="2"
              max="100"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              required
            />
          </div>

          {/* Skill Level */}
          <div className="form-group">
            <label htmlFor="cg-skill">Skill Level</label>
            <select
              id="cg-skill"
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
            >
              <option value="casual">Casual (Fun first, relaxed)</option>
              <option value="intermediate">Intermediate (Competitive but friendly)</option>
              <option value="competitive">Competitive (Experienced players only)</option>
            </select>
          </div>

          {/* Optional Notes */}
          <div className="form-group">
            <label htmlFor="cg-notes">Notes / Special Rules</label>
            <textarea
              id="cg-notes"
              placeholder="e.g. 5v5 full court. Bring a black and a white shirt. Text when you arrive!"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength="300"
              rows="4"
            />
          </div>

          {/* Copyright LLC */}
          <div className="cg-llc-footer">
            © 2026 Swami Software, LLC. All rights reserved.
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="cg-submit-btn"
            disabled={submitting}
            id="cg-submit-button"
          >
            {submitting ? 'Creating...' : 'POST pickup game'}
          </button>
        </form>
      </div>
    </div>
  );
}
