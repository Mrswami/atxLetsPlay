import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourt, useCourtGames, joinGame, leaveGame } from '../hooks/useCourts';
import NoShowPanel from '../components/NoShowPanel';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, getCartoonImageUrl } from '../data/courtsMeta';
import Loading from '../components/Loading';
import './CourtDetail.css';

export default function CourtDetail() {
  const { courtId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { court, loading, error } = useCourt(courtId);
  const { games, loading: gamesLoading } = useCourtGames(courtId);
  const [viewMode, setViewMode] = useState('info'); // 'info' | '3d' | 'games'
  const [actionError, setActionError] = useState('');
  const [showSubCourts, setShowSubCourts] = useState(false);
  const [showPermitInfo, setShowPermitInfo] = useState(false);

  function handleBack() {
    if (location.state?.fromCreate || window.history.length <= 1) {
      navigate('/');
    } else {
      navigate(-1);
    }
  }

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

  if (loading) return <Loading />;
  if (error || !court) {
    return (
      <div className="court-detail-error">
        <span>🏟️</span>
        <h2>Court not found</h2>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const primarySport = court.sport?.[0];
  
  const districtName = court.district?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="court-detail-page">
      {/* ── Hero Section ── */}
      <div
        className="court-hero"
        style={{
          backgroundImage: `url(${court.thumbnailUrl || getCartoonImageUrl(court.id)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Back button */}
        <button
          className="cd-back-btn"
          onClick={handleBack}
          aria-label="Back to previous screen"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* ── Court Title ── */}
      <div className="cd-title-section">
        <div className="cd-sports">
          {(court.sport || []).map((s) => {
            const sm = SPORT_META[s];
            return (
              <span key={s} className="cd-sport-tag" style={{ '--tag-color': sm?.color }}>
                {sm?.emoji} {sm?.label}
              </span>
            );
          })}
        </div>
        <h1 className="cd-court-name">{court.name}</h1>
        <p className="cd-district">{districtName} · {court.address}</p>
        
        {/* Permit Warning */}
        <div className="cd-permit-warning" style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.4)', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <button onClick={() => setShowPermitInfo(!showPermitInfo)} style={{ background: 'none', border: 'none', color: 'inherit', display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
            <span>⚠️ City Parks Permit Notice</span>
            <span style={{ marginLeft: 'auto' }}>{showPermitInfo ? '▲' : '▼'}</span>
          </button>
          {showPermitInfo && (
            <div style={{ marginTop: '0.5rem', lineHeight: '1.4' }}>
              Official reservations may be required for exclusive use, leagues, or large groups at PARD courts. <br/>
              Contact Austin Parks & Rec Athletics: <br/>
              Email: <a href="mailto:reservations@austintexas.gov" style={{color: 'var(--accent-primary)'}}>reservations@austintexas.gov</a> | Phone: <strong>3-1-1</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="cd-tabs">
        {['info', 'games'].map((tab) => (
          <button
            key={tab}
            className={`cd-tab ${viewMode === tab ? 'active' : ''}`}
            onClick={() => setViewMode(tab)}
            id={`cd-tab-${tab}`}
          >
            {tab === 'info' && '📋 Info'}
            {tab === 'games' && `🎮 Games${games.length > 0 ? ` (${games.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="cd-content">

        {/* INFO TAB */}
        {viewMode === 'info' && (
          <div className="cd-info-tab">
            {court.description && (
              <p className="cd-description">{court.description}</p>
            )}
            <div className="cd-info-grid">
              <InfoItem icon="🏔️" label="Surface" value={court.surface} />
              <InfoItem icon="💡" label="Lights" value={court.lights ? 'Yes' : 'No'} />
              <InfoItem icon="🏢" label="Indoor" value={court.indoor ? 'Yes' : 'Outdoor'} />
              <InfoItem icon="♿" label="Accessible" value={court.accessibility ? 'Yes' : 'Not confirmed'} />
              {court.courtCount > 1 && (
                <div 
                  onClick={() => setShowSubCourts(!showSubCourts)} 
                  style={{cursor: 'pointer', background: showSubCourts ? 'rgba(255,255,255,0.05)' : 'transparent', borderRadius: '12px'}}
                >
                  <InfoItem icon="🔢" label="Courts" value={`${court.courtCount} courts (Tap to view)`} />
                  {showSubCourts && (
                    <div className="cd-subcourts-dropdown" style={{padding: '0 16px 16px 48px', color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
                      <div style={{marginBottom: '8px', opacity: 0.7, fontSize: '0.85rem'}}>
                        {court.sport.map(s => SPORT_META[s]?.label || s).join(' / ')}
                      </div>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                        {Array.from({length: court.courtCount}).map((_, i) => (
                          <div key={i} style={{background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px'}}>
                            Court {i+1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {court.amenities?.length > 0 && (
              <div className="cd-amenities">
                <h3 className="cd-section-title">Amenities</h3>
                <div className="cd-amenity-chips">
                  {court.amenities.map((a) => (
                    <span key={a} className="cd-amenity-chip">✓ {a}</span>
                  ))}
                </div>
              </div>
            )}

            {court.googleMapsUrl && (
              <a
                href={court.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cd-maps-link"
                id="court-maps-link"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                Get Directions in Google Maps
              </a>
            )}

            <a
              href={`mailto:jacobflutterdev@gmail.com?subject=Suggestion%20for%20${encodeURIComponent(court.name)}`}
              className="cd-maps-link"
              style={{ marginTop: '0.75rem', borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Suggest an Edit or Feature
            </a>
          </div>
        )}

        {/* GAMES TAB */}
        {viewMode === 'games' && (
          <div className="cd-games-tab">
            {/* CTA Buttons */}
            <div className="cd-game-actions">
              <button
                className="cd-action-btn cd-action-btn--call"
                onClick={() =>
                  user
                    ? navigate(`/create-game/${courtId}`)
                    : navigate(`/login?redirectTo=${encodeURIComponent(`/create-game/${courtId}`)}`, {
                        state: { redirectTo: `/create-game/${courtId}` },
                      })
                }
                id="call-next-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                CALL NEXT
              </button>
              <p className="cd-action-hint">
                {user ? 'Post a game at this court' : 'Sign in to post a game'}
              </p>
            </div>

            {/* Active Games */}
            {gamesLoading ? (
              <p className="cd-games-loading">Loading games...</p>
            ) : (
              <div className="cd-games-list">
                {actionError && <div className="cd-action-error">{actionError}</div>}
                
                {Array.from({length: court.courtCount || 1}).map((_, i) => {
                  const subCourtName = court.courtCount > 1 ? `Court ${i+1}` : court.name;
                  // Filter games for this subcourt. Fallback old games (no subCourt) to Court 1 if there are multiple.
                  const courtGames = games.filter(g => 
                    (court.courtCount > 1 && g.subCourt === `Court ${i+1}`) || 
                    (court.courtCount === 1) ||
                    (court.courtCount > 1 && !g.subCourt && i === 0)
                  );
                  
                  return (
                    <div key={i} className="cd-subcourt-section" style={{marginBottom: '24px'}}>
                      <h3 className="cd-section-title" style={{marginTop: i > 0 ? '16px' : '0'}}>{subCourtName}</h3>
                      {courtGames.length === 0 ? (
                        <div className="cd-no-games" style={{padding: '16px', minHeight: 'auto'}}>
                          <p style={{margin: 0}}>No active games right now. Call Next!</p>
                        </div>
                      ) : (
                        courtGames.map((game) => (
                          <GameCard
                            key={game.id}
                            game={game}
                            userId={user?.uid}
                            onAction={() => handleGameAction(game)}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, userId, onAction }) {
  const meta = SPORT_META[game.sport];
  const scheduledDate = game.scheduledTime?.toDate?.();
  const timeStr = scheduledDate
    ? scheduledDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Time TBD';

  const spotsLeft = (game.maxPlayers || 10) - (game.currentPlayers?.length || 0);
  const isJoined = game.currentPlayers?.includes(userId);

  return (
    <div className={`game-card ${isJoined ? 'joined' : ''}`}>
      <div className="game-card-header">
        <span className="game-sport-emoji">{meta?.emoji}</span>
        <div className="game-card-info">
          <span className="game-time">{timeStr}</span>
          <span className="game-skill">{game.skillLevel || 'All levels'}</span>
        </div>
        <span className={`game-spots ${spotsLeft <= 2 && spotsLeft > 0 ? 'few' : ''} ${spotsLeft === 0 ? 'full' : ''}`}>
          {spotsLeft === 0 ? 'FULL' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
        </span>
      </div>
      {game.notes && <p className="game-notes">{game.notes}</p>}
      <button
        className={`game-join-btn ${isJoined ? 'leave' : ''}`}
        disabled={spotsLeft === 0 && !isJoined}
        onClick={onAction}
        id={`join-game-${game.id}`}
      >
        {isJoined ? 'LEAVE GAME' : spotsLeft === 0 ? 'FULL' : 'I GOT NEXT'}
      </button>
      {game.createdBy === userId && scheduledDate && scheduledDate.getTime() <= Date.now() && (
        <NoShowPanel game={game} hostId={userId} />
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="info-item">
      <span className="info-icon">{icon}</span>
      <div className="info-text">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
    </div>
  );
}
