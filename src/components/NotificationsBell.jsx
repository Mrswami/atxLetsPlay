import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { subscribeToUserInvites } from '../services/invites';

export default function NotificationsBell({ className = '', style = {}, hideWhenEmpty = false }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [courtInvitesCount, setCourtInvitesCount] = useState(0);
  const [hostJoinRequestsCount, setHostJoinRequestsCount] = useState(0);

  useEffect(() => {
    if (!user || isGuest || user.isAnonymous) return;

    // 1. Incoming Friend Requests
    const q1 = query(
      collection(db, 'friendships'),
      where('user1', '==', user.uid),
      where('status', '==', 'pending')
    );
    const q2 = query(
      collection(db, 'friendships'),
      where('user2', '==', user.uid),
      where('status', '==', 'pending')
    );

    let docs1 = [];
    let docs2 = [];

    function handleFriendSnap(snap, source) {
      if (source === 'q1') docs1 = snap.docs.map((d) => d.data());
      if (source === 'q2') docs2 = snap.docs.map((d) => d.data());

      const allPending = [...docs1, ...docs2];
      const incoming = allPending.filter((f) => f.actionUser !== user.uid);
      setFriendRequestsCount(incoming.length);
    }

    const unsubscribe1 = onSnapshot(
      q1,
      (snap) => handleFriendSnap(snap, 'q1'),
      () => {}
    );
    const unsubscribe2 = onSnapshot(
      q2,
      (snap) => handleFriendSnap(snap, 'q2'),
      () => {}
    );

    // 2. Pending Court Invites & Mentions
    const unsubscribeInvites = subscribeToUserInvites(user.uid, (invites) => {
      setCourtInvitesCount(invites.length);
    });

    // 3. Pending Join Requests on Games Hosted by Current User
    const hostGamesQuery = query(
      collection(db, 'games'),
      where('createdBy', '==', user.uid)
    );
    const unsubscribeHostGames = onSnapshot(
      hostGamesQuery,
      (snap) => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        let totalReqs = 0;
        snap.docs.forEach((docSnap) => {
          const g = docSnap.data();
          if (g.status === 'cancelled') return;
          const schedMs = g.scheduledTime?.toMillis
            ? g.scheduledTime.toMillis()
            : g.scheduledTime
            ? new Date(g.scheduledTime).getTime()
            : Date.now();
          if (schedMs < twoHoursAgo) return;
          if (Array.isArray(g.joinRequests) && g.joinRequests.length > 0) {
            totalReqs += g.joinRequests.length;
          }
        });
        setHostJoinRequestsCount(totalReqs);
      },
      () => {
        setHostJoinRequestsCount(0);
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribeInvites();
      unsubscribeHostGames();
    };
  }, [user, isGuest]);

  const pendingCount = friendRequestsCount + courtInvitesCount + hostJoinRequestsCount;

  if (!user || isGuest) return null;
  if (hideWhenEmpty && pendingCount === 0) return null;

  const tooltipParts = [];
  if (courtInvitesCount > 0) tooltipParts.push(`${courtInvitesCount} court invite${courtInvitesCount > 1 ? 's' : ''}`);
  if (hostJoinRequestsCount > 0) tooltipParts.push(`${hostJoinRequestsCount} match join request${hostJoinRequestsCount > 1 ? 's' : ''}`);
  if (friendRequestsCount > 0) tooltipParts.push(`${friendRequestsCount} friend request${friendRequestsCount > 1 ? 's' : ''}`);
  const titleText = tooltipParts.length > 0 ? tooltipParts.join(' · ') : 'Notifications';

  return (
    <button
      className={`notifications-bell-btn ${className}`}
      style={{
        position: 'relative',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'white',
        fontSize: '1.2rem',
        ...style,
      }}
      onClick={() => navigate('/friends', { state: { initialTab: 'requests' } })}
      aria-label={titleText}
      title={titleText}
    >
      🔔
      {pendingCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#ef4444',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #0f172a',
          }}
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </button>
  );
}
