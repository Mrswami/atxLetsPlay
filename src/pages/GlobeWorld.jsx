/**
 * GlobeWorld.jsx — Fully standalone 3D world page. Zero auth dependencies.
 * This is the first screen every user sees. No loading gates, no sign-in walls.
 */
import { useNavigate } from 'react-router-dom';
import WorldGlobe from '../components/WorldGlobe';
import './GlobeWorld.css';

export default function GlobeWorld() {
  const navigate = useNavigate();

  function handleCourtSelect(court) {
    navigate('/court/' + court.id);
  }

  return (
    <div className="globe-world-page">
      <WorldGlobe onCourtSelect={handleCourtSelect} activeGames={{}} />

      <div className="gw-hud-top">
        <div className="gw-brand">
          <span className="gw-brand-atx">ATX</span>
          <span className="gw-brand-text">LET'S PLAY</span>
        </div>
        <div className="gw-top-actions">
          <a
            href="/ATX_LetsPlay_v4_NonOverlapping_Courts.apk"
            download="ATX_LetsPlay_v4_NonOverlapping_Courts.apk"
            className="gw-download-btn"
            id="gw-download-btn"
            title="Download Android APK directly"
          >
            📲 Download APK
          </a>
          <button
            className="gw-signin-btn"
            onClick={() => navigate('/login')}
            id="gw-signin-btn"
            aria-label="Sign in or create account"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
