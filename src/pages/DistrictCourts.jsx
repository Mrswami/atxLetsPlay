import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDistrictCourts } from '../hooks/useCourts';
import { SPORT_META, DISTRICT_META } from '../data/courtsMeta';
import Loading from '../components/Loading';
import './DistrictCourts.css';

export default function DistrictCourts() {
  const { districtId } = useParams();
  const navigate = useNavigate();
  const { courts, loading, error } = useDistrictCourts(districtId);
  const [activeSport, setActiveSport] = useState('all');

  const district = DISTRICT_META[districtId] || { label: districtId, color: 'var(--accent-primary)' };

  // Derive available sports from courts in this district
  const availableSports = ['all', ...new Set(courts.flatMap((c) => c.sport || []))];

  const filtered = activeSport === 'all'
    ? courts
    : courts.filter((c) => c.sport?.includes(activeSport));

  if (loading) return <Loading />;

  return (
    <div className="district-courts-page">
      {/* ── Header ── */}
      <header className="dc-header">
        <button className="dc-back-btn" onClick={() => navigate('/')} aria-label="Back to map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="dc-title-wrap">
          <span className="dc-district-dot" style={{ background: district.color }} />
          <h1 className="dc-title">{district.label}</h1>
        </div>
        <span className="dc-count">{courts.length} court{courts.length !== 1 ? 's' : ''}</span>
      </header>

      {/* ── Sport Filter Tabs ── */}
      {availableSports.length > 1 && (
        <div className="dc-sport-tabs">
          {availableSports.map((sport) => {
            const meta = SPORT_META[sport];
            return (
              <button
                key={sport}
                className={`sport-tab ${activeSport === sport ? 'active' : ''}`}
                onClick={() => setActiveSport(sport)}
                id={`sport-tab-${sport}`}
              >
                {sport === 'all' ? '🗺️ All' : `${meta?.emoji || ''} ${meta?.label || sport}`}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Court Cards ── */}
      <div className="dc-courts-list">
        {error && (
          <div className="dc-empty">
            <span>⚠️</span>
            <p>Couldn't load courts. Check connection.</p>
          </div>
        )}

        {!error && filtered.length === 0 && (
          <div className="dc-empty">
            <span>🏗️</span>
            <p>No {activeSport !== 'all' ? SPORT_META[activeSport]?.label : ''} courts found in this district yet.</p>
            <p className="dc-empty-sub">Courts are being mapped — check back soon!</p>
          </div>
        )}

        {filtered.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            onClick={() => navigate(`/court/${court.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function CourtCard({ court, onClick }) {
  const primarySport = court.sport?.[0];
  const meta = SPORT_META[primarySport];

  return (
    <button className="court-card" onClick={onClick} id={`court-card-${court.id}`}>
      {/* Thumbnail or placeholder */}
      <div
        className="court-card-thumb"
        style={
          court.thumbnailUrl
            ? { backgroundImage: `url(${court.thumbnailUrl})` }
            : { background: `linear-gradient(135deg, ${meta?.color || 'var(--accent-primary)'}22, ${meta?.color || 'var(--accent-primary)'}44)` }
        }
      >
        {!court.thumbnailUrl && (
          <span className="court-card-emoji">{meta?.emoji || '🏟️'}</span>
        )}
      </div>

      {/* Info */}
      <div className="court-card-info">
        <div className="court-card-header">
          <h2 className="court-card-name">{court.name}</h2>
          <span className="court-card-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>

        {/* Sports tags */}
        <div className="court-card-sports">
          {(court.sport || []).map((s) => {
            const sm = SPORT_META[s];
            return (
              <span key={s} className="sport-tag" style={{ '--tag-color': sm?.color || 'var(--accent-primary)' }}>
                {sm?.emoji} {sm?.label || s}
              </span>
            );
          })}
        </div>

        {/* Meta row */}
        <div className="court-card-meta">
          {court.lights && <span className="court-meta-chip">💡 Lit</span>}
          {court.indoor && <span className="court-meta-chip">🏢 Indoor</span>}
          {court.accessibility && <span className="court-meta-chip">♿ Accessible</span>}
          {court.courtCount > 1 && (
            <span className="court-meta-chip">×{court.courtCount} courts</span>
          )}
        </div>
      </div>
    </button>
  );
}
