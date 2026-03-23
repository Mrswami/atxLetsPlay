import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import './CreateGameModal.css';

const SPORTS = ['🏀 Basketball', '🏐 Volleyball', '⚽ Soccer', '🎾 Tennis', '🏓 Ping Pong', '🏸 Badminton'];

export default function CreateGameModal({ district, onClose, onSuccess }) {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState(1); // 3-step flow
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sport, setSport] = useState('');
  const [courtName, setCourtName] = useState('');
  const [spots, setSpots] = useState(4);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [vibeNote, setVibeNote] = useState('');

  async function handleSubmit() {
    if (!sport || !courtName || !date || !time) {
      setError('Fill in all the required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await addDoc(collection(db, 'games'), {
        sport,
        courtName,
        spots,
        spotsLeft: spots,
        date,
        time,
        vibeNote,
        district: district?.id || 'downtown',
        districtName: district?.name || 'Downtown',
        creatorId: user.uid,
        creatorName: userProfile?.displayName || 'Player',
        players: [user.uid],
        createdAt: serverTimestamp(),
        status: 'open',
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError('Something went wrong. Try again.');
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-pill" />
          <div className="modal-title-row">
            <h2 className="modal-title">CALL NEXT</h2>
            {district && <span className="modal-district">{district.name}</span>}
          </div>
          {/* Step indicators */}
          <div className="modal-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* ── Step 1: Sport + Court ── */}
        {step === 1 && (
          <div className="modal-body">
            <p className="modal-label">WHAT ARE WE PLAYING?</p>
            <div className="sport-grid">
              {SPORTS.map(s => (
                <button
                  key={s}
                  className={`sport-chip ${sport === s ? 'selected' : ''}`}
                  onClick={() => setSport(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <p className="modal-label" style={{ marginTop: '1.5rem' }}>WHERE AT?</p>
            <input
              className="modal-input"
              type="text"
              placeholder="Court or park name..."
              value={courtName}
              onChange={e => setCourtName(e.target.value)}
            />
          </div>
        )}

        {/* ── Step 2: Time + Spots ── */}
        {step === 2 && (
          <div className="modal-body">
            <p className="modal-label">WHEN?</p>
            <div className="date-time-row">
              <input
                className="modal-input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              <input
                className="modal-input"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>

            <p className="modal-label" style={{ marginTop: '1.5rem' }}>HOW MANY SPOTS OPEN?</p>
            <div className="spots-row">
              <button className="spots-btn" onClick={() => setSpots(Math.max(1, spots - 1))}>−</button>
              <span className="spots-value">{spots}</span>
              <button className="spots-btn" onClick={() => setSpots(Math.min(20, spots + 1))}>+</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Vibe Note + Confirm ── */}
        {step === 3 && (
          <div className="modal-body">
            <p className="modal-label">SET THE VIBE (OPTIONAL)</p>
            <textarea
              className="modal-input modal-textarea"
              placeholder="'Bring cleats. Beginner friendly. First to 21 wins.' ..."
              value={vibeNote}
              onChange={e => setVibeNote(e.target.value)}
              rows={3}
            />

            {/* Confirmation card */}
            <div className="confirm-card">
              <div className="confirm-row">
                <span className="confirm-label">Sport</span>
                <span className="confirm-val">{sport}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">Court</span>
                <span className="confirm-val">{courtName}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">When</span>
                <span className="confirm-val">{date} @ {time}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">Spots</span>
                <span className="confirm-val">{spots} open</span>
              </div>
            </div>

            {error && <p className="modal-error">{error}</p>}
          </div>
        )}

        {/* Footer Nav */}
        <div className="modal-footer">
          {step > 1 && (
            <button className="modal-btn modal-btn--back" onClick={() => setStep(step - 1)}>
              ← BACK
            </button>
          )}
          {step < 3 ? (
            <button
              className="modal-btn modal-btn--next"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!sport || !courtName)}
            >
              NEXT →
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--confirm"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'POSTING...' : 'DROP IT 🔥'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
