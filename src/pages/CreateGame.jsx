import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCourt } from '../hooks/useCourts';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { SPORT_META } from '../data/courtsMeta';
import Loading from '../components/Loading';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import { assertCanParticipate, assertReliable } from '../services/safety';
import './CreateGame.css';

export default function CreateGame() {
  const { courtId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, emailVerified } = useAuth();
  const { court, loading: courtLoading, error: courtError } = useCourt(courtId);

  const [sport, setSport] = useState('');
  const formatForInput = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  const [scheduledTime, setScheduledTime] = useState(formatForInput(new Date()));
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [skillLevel, setSkillLevel] = useState('casual');
  const [subCourt, setSubCourt] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [gamesMadeCount, setGamesMadeCount] = useState(1);

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
      assertCanParticipate();
      await assertReliable(user.uid);

      const parsedMax = parseInt(maxPlayers, 10);
      if (isNaN(parsedMax) || parsedMax <= 1) {
        throw new Error('Please enter a valid number of players (minimum 2).');
      }

      const dateObj = new Date(scheduledTime);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Please enter a valid scheduled date and time.');
      }

      if (dateObj.getTime() < Date.now() - 10 * 60000) {
        throw new Error('Scheduled time cannot be in the past.');
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let newCount = 1;
      
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const lastDate = uData.lastGameCreatedAt?.toDate();
        const today = new Date();
        const isSameDay = lastDate && 
                          lastDate.getDate() === today.getDate() && 
                          lastDate.getMonth() === today.getMonth() && 
                          lastDate.getFullYear() === today.getFullYear();
                          
        if (isSameDay) {
          if (uData.gamesCreatedToday >= 5) {
            throw new Error('You have reached the limit of 5 games created per day.');
          }
          newCount = uData.gamesCreatedToday + 1;
        }
      }

      const gameData = {
        courtId,
        courtName: court.name,
        subCourt: court.courtCount > 1 ? subCourt : '',
        district: court.district,
        sport,
        createdBy: user.uid,
        creatorName: userProfile?.displayName || user?.displayName || 'Player',
        status: 'open',
        scheduledTime: Timestamp.fromDate(dateObj),
        maxPlayers: parsedMax,
        currentPlayers: [user.uid],
        skillLevel,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'games'), gameData);
      
      await updateDoc(userRef, {
        gamesCreatedToday: newCount,
        lastGameCreatedAt: serverTimestamp()
      });

      setGamesMadeCount(newCount);
      setShowSuccessPopup(true);
      setTimeout(() => {
        navigate(`/court/${courtId}`, { state: { fromCreate: true } });
      }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to create game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="create-game-page">
      {showSuccessPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', textAlign: 'center', color: '#fff', border: '2px solid #10b981', boxShadow: '0 0 20px rgba(16,185,129,0.3)', maxWidth: '90%', animation: 'popIn 0.3s ease-out' }}>
             <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎉 Success!</h2>
             <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Game posted!</p>
             <div style={{ marginTop: '1rem', background: 'rgba(16,185,129,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', color: '#10b981', fontWeight: 'bold' }}>
               Game made/joined ({gamesMadeCount}/5)
             </div>
          </div>
        </div>
      )}
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
          <VerifyEmailBanner />

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
              min={formatForInput(new Date())}
              max={formatForInput(new Date(new Date().setMonth(new Date().getMonth() + 3)))}
              onChange={(e) => setScheduledTime(e.target.value)}
              onClick={(e) => { if (e.target.showPicker) e.target.showPicker(); }}
              required
            />
          </div>

          {/* Sub-Court Selection */}
          {court.courtCount > 1 && (
            <div className="form-group">
              <label htmlFor="cg-subcourt">Which Court? *</label>
              <select
                id="cg-subcourt"
                value={subCourt}
                onChange={(e) => setSubCourt(e.target.value)}
                required
              >
                <option value="">Select a specific court</option>
                {Array.from({length: court.courtCount}).map((_, i) => (
                  <option key={i} value={`Court ${i+1}`}>
                    Court {i+1}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            disabled={submitting || !emailVerified}
            id="cg-submit-button"
          >
            {submitting ? 'Creating...' : 'POST pickup game'}
          </button>
        </form>
      </div>
    </div>
  );
}
