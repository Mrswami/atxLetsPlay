import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { SPORT_META, DISTRICT_META } from '../data/courtsMeta';
import './Onboarding.css';

const PLAY_STYLES = [
  { id: 'chill', label: 'Chill', emoji: '😌', desc: 'Enjoys casual pickups, social plays, and pétanque/disc golf.' },
  { id: 'athletic', label: 'Athletic', emoji: '🏃‍♂️', desc: 'Focuses on conditioning, active running, and all-around play.' },
  { id: 'competitive', label: 'Competitive', emoji: '🏆', desc: 'Plays to win, matches stats, and coordinates serious games.' },
  { id: 'curious', label: 'Curious', emoji: '🤔', desc: 'Open to trying new sports, learning rules, and training.' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [playStyle, setPlayStyle] = useState('chill');
  const [avatarPhoto, setAvatarPhoto] = useState(null); // base64 string
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  
  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(false);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Control camera based on step & capture status
  useEffect(() => {
    if (step === 1 && cameraActive && !avatarPhoto) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [step, cameraActive, avatarPhoto]);

  async function startCamera() {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(true);
      setCameraActive(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function handleCapture() {
    if (!videoRef.current) return;
    
    // Play flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Draw mirrored video frame for natural photo feel
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, 300, 300);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setAvatarPhoto(dataUrl);
    stopCamera();
  }

  function handleRetake() {
    setAvatarPhoto(null);
    setCameraActive(true);
  }

  function handleSportToggle(sport) {
    if (selectedSports.includes(sport)) {
      setSelectedSports(selectedSports.filter((s) => s !== sport));
    } else {
      if (selectedSports.length >= 3) {
        // Enforce max 3 sports preference limit
        return;
      }
      setSelectedSports([...selectedSports, sport]);
    }
  }

  async function handleSave() {
    if (!selectedDistrict) {
      setError('Please select your home district.');
      return;
    }
    if (selectedSports.length === 0) {
      setError('Please select at least 1 sport preference.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let finalAvatarUrl = '';

      // Try uploading avatar to Firebase Storage
      if (avatarPhoto) {
        try {
          const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
          await uploadString(storageRef, avatarPhoto, 'data_url');
          finalAvatarUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn('Storage upload failed, falling back to base64 data URL:', storageErr);
          finalAvatarUrl = avatarPhoto; // Save as base64 in Firestore directly
        }
      }

      const profileData = {
        displayName: user.displayName || userProfile?.displayName || 'Player',
        district: selectedDistrict,
        sport_preferences: selectedSports,
        playStyle,
        avatarUrl: finalAvatarUrl,
        xp: 100, // Onboarding start reward
        gamesPlayed: 0,
        gamesHosted: 0,
        rep: 5.0,
        badges: ['pioneer'],
        hasCompletedOnboarding: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="ob-wizard">
        {/* Step Indicator & Skip */}
        <div className="ob-top-bar">
          <div className="ob-steps">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`ob-step-dot ${step === s ? 'active' : ''} ${step > s ? 'complete' : ''}`}
              >
                {s}
              </div>
            ))}
          </div>
          <button type="button" className="ob-skip-btn" onClick={() => navigate('/')}>
            Skip to 3D World 🌍 →
          </button>
        </div>

        {error && <div className="ob-error">{error}</div>}

        {/* STEP 1: CHARACTER SELECT & AVATAR */}
        {step === 1 && (
          <div className="ob-slide anim-fade-in">
            <h2 className="ob-title">Choose Your Play Style</h2>
            <p className="ob-subtitle">Select the archetype that best matches your vibe.</p>

            <div className="ob-playstyles-grid">
              {PLAY_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className={`playstyle-card ${playStyle === style.id ? 'active' : ''}`}
                  onClick={() => setPlayStyle(style.id)}
                >
                  <span className="ps-emoji">{style.emoji}</span>
                  <h3>{style.label}</h3>
                  <p>{style.desc}</p>
                </button>
              ))}
            </div>

            <h3 className="ob-section-title">Player Photo</h3>
            <div className="ob-photo-container">
              {flash && <div className="ob-camera-flash" />}

              {avatarPhoto ? (
                <div className="ob-photo-preview-wrapper">
                  <img src={avatarPhoto} alt="Avatar Preview" className="ob-photo-preview" />
                  <button type="button" className="ob-retake-btn" onClick={handleRetake}>
                    Retake Photo
                  </button>
                </div>
              ) : cameraActive ? (
                <div className="ob-camera-viewfinder">
                  <video ref={videoRef} autoPlay playsInline muted className="ob-camera-video" />
                  <button type="button" className="ob-capture-btn" onClick={handleCapture} aria-label="Capture photo">
                    <div className="ob-capture-btn-inner" />
                  </button>
                </div>
              ) : (
                <div className="ob-photo-placeholder" onClick={() => setCameraActive(true)}>
                  <span>📷</span>
                  <p>{cameraError ? 'Webcam not available.' : 'Tap to take profile photo'}</p>
                  {cameraError && <p className="ob-camera-error-sub">We will use a generic avatar letter fallback.</p>}
                </div>
              )}
            </div>

            <div className="ob-actions-row">
              <button
                type="button"
                className="ob-next-btn"
                onClick={() => setStep(2)}
              >
                Next Step: Choose Sports
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SPORTS SELECTION */}
        {step === 2 && (
          <div className="ob-slide anim-fade-in">
            <h2 className="ob-title">Your Top Sports</h2>
            <p className="ob-subtitle">Choose up to 3 sports you want to play in Austin (selected: {selectedSports.length}/3).</p>

            <div className="ob-sports-grid">
              {Object.keys(SPORT_META).map((key) => {
                const sport = SPORT_META[key];
                const isSelected = selectedSports.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`ob-sport-card ${isSelected ? 'active' : ''} ${selectedSports.length >= 3 && !isSelected ? 'disabled' : ''}`}
                    onClick={() => handleSportToggle(key)}
                  >
                    <span className="ob-sport-emoji">{sport.emoji}</span>
                    <span className="ob-sport-label">{sport.label}</span>
                    {isSelected && <span className="ob-sport-badge">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="ob-actions-row">
              <button type="button" className="ob-back-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="ob-next-btn"
                disabled={selectedSports.length === 0}
                onClick={() => setStep(3)}
              >
                Next Step: Home District
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: HOME DISTRICT SELECT */}
        {step === 3 && (
          <div className="ob-slide anim-fade-in">
            <h2 className="ob-title">Select Home District</h2>
            <p className="ob-subtitle">Choose your neighborhood to prioritize nearby pickups.</p>

            <div className="ob-districts-grid">
              {Object.keys(DISTRICT_META).map((key) => {
                const dist = DISTRICT_META[key];
                const isSelected = selectedDistrict === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`ob-district-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedDistrict(key)}
                    style={{ '--dist-color': dist.color }}
                  >
                    <span className="ob-district-dot" />
                    <span>{dist.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="ob-actions-row">
              <button type="button" className="ob-back-btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="ob-save-btn"
                disabled={submitting || !selectedDistrict}
                onClick={handleSave}
              >
                {submitting ? 'Setting up...' : 'COMPLETE PROFILE'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
