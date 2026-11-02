import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourt, useCourtGames, joinGame, leaveGame, requestJoinGame } from '../hooks/useCourts';
import NoShowPanel from '../components/NoShowPanel';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, getCartoonImageUrl } from '../data/courtsMeta';
import Loading from '../components/Loading';
import CourtComments from '../components/CourtComments';
import PartnerEventModal from '../components/PartnerEventModal';
import GameSlotsRow from '../components/GameSlotsRow';
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
  const [selectedPartnerEvent, setSelectedPartnerEvent] = useState(null);

  function handleBack() {
    if (location.state?.fromCreate || window.history.length <= 1) {
      navigate('/');
    } else {
      navigate(-1);
    }
  }

  async function handleGameAction(game) {
    if (game.isPartnerEvent) {
      setSelectedPartnerEvent(game);
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }
    const isJoined = game.currentPlayers?.includes(user.uid);
    const hasRequested = game.joinRequests?.includes(user.uid);
    
    try {
      setActionError('');
      if (isJoined) {
        await leaveGame(game.id, user.uid);
      } else if (hasRequested) {
        // Option to cancel request could be added here, but for now we do nothing
        return;
      } else if (game.isPrivate && !Boolean(game.isInviteOnly || game.privacyMode === 'invite_only') && game.createdBy !== user.uid && game.hostId !== user.uid && !(game.invitedPlayers || []).includes(user.uid)) {
        await requestJoinGame(game.id, user.uid);
        setActionError('Request to join sent!');
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
            <span>⚠️ General Notice</span>
            <span style={{ marginLeft: 'auto' }}>{showPermitInfo ? '▲' : '▼'}</span>
          </button>
          {showPermitInfo && (
            <div style={{ marginTop: '0.5rem', lineHeight: '1.4' }}>
              Some courts have entities associated with them that require membership and a fee. We are a service to locate and schedule matches with Austinites, we are not affiliated with these entities (for instance, YMCA or Austin High tennis courts) and cannot guarantee court access.<br/><br/>
              Additionally, official reservations may be required for exclusive use, leagues, or large groups at PARD courts. <br/>
              Contact Austin Parks & Rec Athletics: <br/>
              Email: <a href="mailto:reservations@austintexas.gov" style={{color: 'var(--accent-primary)'}}>reservations@austintexas.gov</a> | Phone: <strong>3-1-1</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="cd-tabs">
        {['info', 'games', 'community'].map((tab) => (
          <button
            key={tab}
            className={`cd-tab ${viewMode === tab ? 'active' : ''}`}
            onClick={() => setViewMode(tab)}
            id={`cd-tab-${tab}`}
          >
            {tab === 'info' && '📋 Info'}
            {tab === 'games' && `🎮 Games${games.length > 0 ? ` (${games.length})` : ''}`}
            {tab === 'community' && '💬 Community'}
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

        {/* COMMUNITY TAB */}
        {viewMode === 'community' && (
          <div className="cd-community-tab" style={{ padding: '0.5rem 0' }}>
            <CourtComments courtId={courtId} />
          </div>
        )}
      </div>

      {/* Partner Event Modal */}
      {selectedPartnerEvent && (
        <PartnerEventModal
          event={selectedPartnerEvent}
          onClose={() => setSelectedPartnerEvent(null)}
        />
      )}
    </div>
  );
}

function GameCard({ game, userId, onAction }) {
  const navigate = useNavigate();
  const meta = SPORT_META[game.sport];
  const scheduledDate = game.scheduledTime?.toDate?.();
  const timeStr = scheduledDate
    ? scheduledDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Time TBD';

  const isPartner = !!game.isPartnerEvent;
  const spotsLeft = (game.maxPlayers || 10) - (game.currentPlayers?.length || 0);
  const isJoined = game.currentPlayers?.includes(userId);
  const hasRequested = game.joinRequests?.includes(userId);
  const isInviteOnly = Boolean(game.isInviteOnly || game.privacyMode === 'invite_only');
  const isHostOrInvited = Boolean(userId && (game.createdBy === userId || game.hostId === userId || (game.invitedPlayers || []).includes(userId)));

  const durationMs = (game.duration || 2) * 60 * 60 * 1000;
  const isLive = scheduledDate && 
                 Date.now() >= (scheduledDate.getTime() - (15 * 60 * 1000)) && 
                 Date.now() < scheduledDate.getTime() + durationMs;

  return (
    <div className={`game-card ${isJoined ? 'joined' : ''} ${isPartner ? 'game-card--partner' : ''}`}>
      <div className="game-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="game-sport-emoji">{meta?.emoji}</span>
          {(game.isPrivate || isInviteOnly) && (
            <span className={`game-privacy-badge ${isInviteOnly ? 'game-privacy-badge--invite' : ''}`}>
              🔒 {isInviteOnly ? 'Invite-Only' : 'Gatekept'}
            </span>
          )}
          {isPartner && (
            <span className="ag-partner-badge" style={{ fontSize: '0.62rem', padding: '0.2rem 0.45rem' }}>
              ★ Partner
            </span>
          )}
          {game.isTicketed && (
            <span className="ag-ticket-badge" style={{ fontSize: '0.62rem', padding: '0.2rem 0.45rem' }}>
              🎟️ {game.ticketPrice || 'Ticketed'}
            </span>
          )}
        </div>
        <div className="game-card-info">
          <span className="game-time">{timeStr}</span>
          <span className="game-skill">{game.skillLevel || 'All levels'}</span>
        </div>
        <span className={`game-spots ${spotsLeft <= 2 && spotsLeft > 0 ? 'few' : ''} ${spotsLeft === 0 ? 'full' : ''}`}>
          {spotsLeft === 0 ? 'FULL' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
        </span>
      </div>

      {isPartner && game.organizer && (
        <div className="ag-organizer-row" style={{ padding: '0 0.25rem', marginBottom: '0.25rem' }}>
          <span className="ag-organizer-avatar">🏐</span>
          <span className="ag-organizer-name">
            Hosted by <strong>{game.organizer.displayName}</strong>
            <span className="ag-check-circle">✓</span>
          </span>
        </div>
      )}

      {game.notes && <p className="game-notes">{game.notes}</p>}
      <GameSlotsRow game={game} />
      
      {isJoined && isLive && (
        <button
          className="game-join-btn"
          style={{ marginBottom: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none' }}
          onClick={() => navigate(`/live-game/${game.id}`)}
        >
          JOIN LIVE MATCH ROOM
        </button>
      )}
      
      <button
        className={`game-join-btn ${isJoined ? 'leave' : ''} ${hasRequested ? 'requested' : ''} ${isPartner ? 'partner-btn' : ''}`}
        disabled={(spotsLeft === 0 && !isJoined && !isPartner) || hasRequested}
        onClick={onAction}
        id={`join-game-${game.id}`}
        style={hasRequested ? { background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)' } : {}}
      >
        {isPartner
          ? '🎟️ RSVP & GET TICKETS'
          : isJoined
          ? 'LEAVE GAME'
          : hasRequested
          ? '⏳ REQUEST SENT'
          : game.isPrivate && !isInviteOnly && !isHostOrInvited
          ? '🔒 REQUEST TO JOIN'
          : spotsLeft === 0
          ? 'FULL'
          : 'I GOT NEXT'}
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
