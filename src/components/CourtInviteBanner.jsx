import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToUserInvites, respondToInvite } from '../services/invites';
import { joinGame } from '../hooks/useCourts';
import './CourtInviteBanner.css';

export default function CourtInviteBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [activeInvite, setActiveInvite] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const unsub = subscribeToUserInvites(user.uid, (fetched) => {
      setInvites(fetched);
      if (fetched.length > 0) {
        setActiveInvite(fetched[0]);
      } else {
        setActiveInvite(null);
      }
    });
    return unsub;
  }, [user]);

  if (!activeInvite) return null;

  const handleAccept = async () => {
    setProcessing(true);
    try {
      await joinGame(activeInvite.gameId, user.uid);
      await respondToInvite(activeInvite.id, true);
      const targetGameId = activeInvite.gameId;
      setActiveInvite(null);
      navigate(`/live-game/${targetGameId}`);
    } catch (err) {
      console.warn('Accept game invite notice:', err);
      await respondToInvite(activeInvite.id, true).catch(() => {});
      const targetGameId = activeInvite.gameId;
      setActiveInvite(null);
      navigate(`/live-game/${targetGameId}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      await respondToInvite(activeInvite.id, false);
    } catch (e) {
      console.error(e);
    } finally {
      setActiveInvite(null);
      setProcessing(false);
    }
  };

  return (
    <div className="court-invite-banner anim-slide-down">
      <div className="cib-content">
        <div className="cib-icon">🏟️</div>
        <div className="cib-info">
          <h4>Court Invitation!</h4>
          <p>
            <strong>@{activeInvite.senderUsername || activeInvite.senderName}</strong> tagged you for {activeInvite.sport} at <strong>{activeInvite.courtName}</strong>
          </p>
        </div>
      </div>
      <div className="cib-actions">
        <button className="cib-accept-btn" onClick={handleAccept} disabled={processing}>
          {processing ? '...' : '🎮 Accept & Join'}
        </button>
        <button className="cib-decline-btn" onClick={handleDecline} disabled={processing}>
          Decline
        </button>
      </div>
    </div>
  );
}
