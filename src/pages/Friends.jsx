import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUserFriendships, sendFriendRequest, acceptFriendRequest, removeFriendOrRequest } from '../services/friends';
import { subscribeToUserInvites, respondToInvite } from '../services/invites';
import { joinGame, approveJoinRequest, denyJoinRequest } from '../hooks/useCourts';
import { generateDefaultUsername } from '../utils/usernameGenerator';
import Avatar from '../components/Avatar';
import './Friends.css';

export default function Friends() {
  const { user, userProfile, isGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const targetUid = location.state?.targetUid || (user ? user.uid : null);
  const isOwnView = targetUid === user?.uid;

  const [activeTab, setActiveTab] = useState(location.state?.initialTab || 'list'); // 'list' | 'search' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');

  const [friendships, setFriendships] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  // Fallback if accessed by guest directly somehow
  if (!user || isGuest) {
    return (
      <div className="friends-page">
        <header className="friends-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>Friends</h1>
        </header>
        <div className="friends-empty-state">
          <h2>Sign In Required</h2>
          <p>Create an account or log in to add friends and build your ATX squad.</p>
          <button className="primary-btn" onClick={() => navigate('/login?redirectTo=/friends')}>Sign In</button>
        </div>
      </div>
    );
  }

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [courtInvites, setCourtInvites] = useState([]);
  const [hostJoinRequests, setHostJoinRequests] = useState([]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const unsub = subscribeToUserInvites(user.uid, (invs) => {
      setCourtInvites(invs);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const hostQ = query(collection(db, 'games'), where('createdBy', '==', user.uid));
    const unsubHost = onSnapshot(hostQ, async (snap) => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const items = [];
      for (const d of snap.docs) {
        const g = d.data();
        if (g.status === 'cancelled') continue;
        const schedMs = g.scheduledTime?.toMillis
          ? g.scheduledTime.toMillis()
          : g.scheduledTime
          ? new Date(g.scheduledTime).getTime()
          : Date.now();
        if (schedMs < twoHoursAgo) continue;
        const reqUids = Array.isArray(g.joinRequests) ? g.joinRequests : [];
        for (const reqUid of reqUids) {
          let reqProf = profiles[reqUid];
          if (!reqProf) {
            try {
              const pSnap = await getDoc(doc(db, 'users', reqUid));
              if (pSnap.exists()) reqProf = pSnap.data();
            } catch (e) {}
          }
          items.push({
            key: `${d.id}_${reqUid}`,
            gameId: d.id,
            courtName: g.courtName || 'Austin Court',
            sport: g.sport || 'pickup',
            requesterUid: reqUid,
            requesterName: reqProf?.displayName || 'Player',
            requesterUsername: reqProf?.username || generateDefaultUsername(reqProf?.displayName || 'Player', reqUid),
            requesterAvatar: reqProf?.avatarUrl || '',
          });
        }
      }
      setHostJoinRequests(items);
    }, () => {});
    return unsubHost;
  }, [user]);

  const handleApproveHostRequest = async (reqItem) => {
    try {
      await approveJoinRequest(reqItem.gameId, reqItem.requesterUid, user.uid);
      triggerToast(`Approved @${reqItem.requesterUsername} for ${reqItem.courtName}!`);
    } catch (e) {
      triggerToast(e.message || 'Could not approve request.');
    }
  };

  const handleDenyHostRequest = async (reqItem) => {
    try {
      await denyJoinRequest(reqItem.gameId, reqItem.requesterUid, user.uid);
      triggerToast('Join request declined.');
    } catch (e) {
      triggerToast(e.message || 'Could not decline request.');
    }
  };

  const handleAcceptCourtInvite = async (invite) => {
    try {
      await joinGame(invite.gameId, user.uid);
      await respondToInvite(invite.id, true);
      triggerToast('Joined court match!');
      navigate(`/live-game/${invite.gameId}`);
    } catch (e) {
      await respondToInvite(invite.id, true).catch(() => {});
      navigate(`/live-game/${invite.gameId}`);
    }
  };

  const handleDeclineCourtInvite = async (inviteId) => {
    await respondToInvite(inviteId, false);
    setCourtInvites(prev => prev.filter(i => i.id !== inviteId));
    triggerToast('Invite declined.');
  };

  useEffect(() => {
    if (!targetUid) return;
    
    setLoading(true);
    getUserFriendships(targetUid).then(async (data) => {
      setFriendships(data);
      
      // Fetch profiles for all friends/requests
      const uidsToFetch = new Set();
      data.forEach(f => {
        const otherId = f.user1 === targetUid ? f.user2 : f.user1;
        uidsToFetch.add(otherId);
      });

      const profs = { ...profiles };
      for (const uid of uidsToFetch) {
        if (!profs[uid]) {
          const docSnap = await getDoc(doc(db, 'users', uid));
          if (docSnap.exists()) {
            profs[uid] = docSnap.data();
          }
        }
      }
      setProfiles(profs);
      setLoading(false);
    });
  }, [targetUid]);

  const handleShareInvite = async () => {
    const username = userProfile?.username;
    const inviteUrl = `https://atxletsplay.web.app/invite?u=${username || user.uid}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ATX Let's Play",
          text: `Join my squad on ATX Let's Play! Add me @${username || 'Player'} to run some games.`,
          url: inviteUrl,
        });
      } catch (err) {
        console.warn('Share failed or was canceled', err);
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      triggerToast('Invite link copied to clipboard!');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase().replace('@', '');
    if (!query) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', query));
      if (!usernameDoc.exists()) {
        setSearchError('Player not found.');
        setSearching(false);
        return;
      }

      const foundUid = usernameDoc.data().uid;
      const profileDoc = await getDoc(doc(db, 'users', foundUid));
      
      if (profileDoc.exists()) {
        setSearchResult({ id: foundUid, ...profileDoc.data() });
      } else {
        setSearchError('Player profile is missing.');
      }
    } catch (err) {
      console.error(err);
      setSearchError('Error searching for player.');
    } finally {
      setSearching(false);
    }
  };

  const onAddFriendFromSearch = async () => {
    if (!searchResult) return;
    if (searchResult.id === user.uid) {
      triggerToast("You can't add yourself!");
      return;
    }
    
    try {
      await sendFriendRequest(user.uid, searchResult.id);
      triggerToast('Friend request sent! You can undo or cancel at any time.');
      setSearchResult(null);
      setSearchQuery('');
    } catch(e) {
      triggerToast('Failed to send request.');
    }
  };

  const onAccept = async (friendshipId, otherUid) => {
    await acceptFriendRequest(user.uid, otherUid);
    setFriendships(prev => prev.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f));
    triggerToast('Friend added! 🎉');
  };

  const onRejectOrRemove = async (friendshipId, otherUid, actionLabel = 'cancelled') => {
    await removeFriendOrRequest(user.uid, otherUid);
    setFriendships(prev => prev.filter(f => f.id !== friendshipId));
    triggerToast(`Friend request ${actionLabel}.`);
  };

  const [friendToRemove, setFriendToRemove] = useState(null);

  const confirmRemove = (fId, otherId, name) => {
    setFriendToRemove({ fId, otherId, name });
  };

  const executeRemove = async () => {
    if (!friendToRemove) return;
    await onRejectOrRemove(friendToRemove.fId, friendToRemove.otherId, 'removed');
    setFriendToRemove(null);
  };

  const acceptedFriends = friendships.filter(f => f.status === 'accepted');
  const pendingRequests = friendships.filter(f => f.status === 'pending' && f.actionUser !== user.uid); // Received
  const sentRequests = friendships.filter(f => f.status === 'pending' && f.actionUser === user.uid); // Sent

  return (
    <div className="friends-page">
      {toast && <div className="friends-toast anim-fade-in">{toast}</div>}

      <header className="friends-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>{isOwnView ? 'Friends Hub' : 'Friends'}</h1>
      </header>

      {isOwnView && (
        <div className="friends-tabs">
          <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>My Squad</button>
          <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Add Friend</button>
          <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
            Requests {(pendingRequests.length + courtInvites.length + hostJoinRequests.length) > 0 && <span className="req-badge">{pendingRequests.length + courtInvites.length + hostJoinRequests.length}</span>}
          </button>
        </div>
      )}

      <div className="friends-content anim-fade-in">
        {loading ? (
          <div className="friends-loading">Loading squad...</div>
        ) : (
          <>
            {activeTab === 'list' && (
              <div className="friends-list-tab">
                {isOwnView && (
                  <div className="connect-contacts-card">
                    <div className="cc-icon">📱</div>
                    <div className="cc-text">
                      <h3>Build Your Squad</h3>
                      <p>Invite friends to easily see when they're hitting the courts.</p>
                    </div>
                    <button className="primary-btn" onClick={handleShareInvite}>Invite Friends</button>
                  </div>
                )}
                
                {acceptedFriends.length === 0 ? (
                  <div className="friends-empty-state">
                    <p>{isOwnView ? "You haven't added any friends yet." : "This player hasn't added any friends yet."}</p>
                    {isOwnView && <button className="secondary-btn" onClick={() => setActiveTab('search')}>Find Players</button>}
                  </div>
                ) : (
                  <div className="friends-grid">
                    {acceptedFriends.map(f => {
                      const otherId = f.user1 === targetUid ? f.user2 : f.user1;
                      const prof = profiles[otherId] || {};
                      const handle = prof.username || generateDefaultUsername(prof.displayName, otherId);
                      return (
                        <div key={f.id} className="friend-card" onClick={() => navigate(`/profile/${otherId}`)}>
                          <Avatar url={prof.avatarUrl} name={prof.displayName || 'Player'} size="medium" />
                          <div className="fc-info">
                            <h4>{prof.displayName || 'Player'}</h4>
                            <span>@{handle}</span>
                          </div>
                          {isOwnView && (
                            <div className="fc-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button className="fc-msg-btn" style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--accent-primary)', background: 'transparent', color: 'var(--text-primary)' }} onClick={(e) => { e.stopPropagation(); navigate(`/chat/${otherId}`); }}>
                                💬 Message
                              </button>
                              <button className="fc-remove" style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)' }} onClick={(e) => { e.stopPropagation(); confirmRemove(f.id, otherId, prof.displayName || 'Player'); }}>
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'search' && isOwnView && (
              <div className="friends-search-tab">
                <form className="friends-search-form" onSubmit={handleSearch}>
                  <div className="search-input-wrapper">
                    <span className="search-at">@</span>
                    <input 
                      type="text" 
                      placeholder="username" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={searching || !searchQuery.trim()} className="primary-btn search-submit-btn">
                    {searching ? '...' : 'Search'}
                  </button>
                </form>

                {searchError && <p className="search-error">{searchError}</p>}

                {searchResult && (
                  <div className="search-result-card anim-scale-in" onClick={() => navigate(`/profile/${searchResult.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="sr-avatar">
                      <Avatar url={searchResult.avatarUrl} name={searchResult.displayName} size="large" />
                    </div>
                    <div className="sr-info">
                      <h3>{searchResult.displayName}</h3>
                      <span className="sr-username">@{searchResult.username || generateDefaultUsername(searchResult.displayName, searchResult.id)}</span>
                      <p className="sr-district">{searchResult.district}</p>
                    </div>
                    <button 
                      className="primary-btn sr-add-btn" 
                      onClick={(e) => { e.stopPropagation(); onAddFriendFromSearch(); }}
                    >
                      Send Request
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'requests' && isOwnView && (
              <div className="friends-requests-tab">
                {hostJoinRequests.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: '#f59e0b' }}>🔒 Match Join Requests (Host Approval)</h3>
                    <div className="friends-grid">
                      {hostJoinRequests.map((reqItem) => (
                        <div
                          key={reqItem.key}
                          className="friend-card req-card"
                          style={{ border: '1px solid rgba(245, 158, 11, 0.45)', background: 'linear-gradient(145deg, #1e293b, #0f172a)' }}
                          onClick={() => navigate(`/live-game/${reqItem.gameId}`)}
                        >
                          <Avatar url={reqItem.requesterAvatar} name={reqItem.requesterName} size="medium" />
                          <div className="fc-info">
                            <h4>{reqItem.requesterName} (@{reqItem.requesterUsername})</h4>
                            <span style={{ color: '#fbbf24', fontWeight: '600' }}>
                              Wants to join {reqItem.sport} @ {reqItem.courtName}
                            </span>
                          </div>
                          <div className="fc-actions">
                            <button className="fc-accept" onClick={(e) => { e.stopPropagation(); handleApproveHostRequest(reqItem); }}>Approve</button>
                            <button className="fc-decline" onClick={(e) => { e.stopPropagation(); handleDenyHostRequest(reqItem); }}>Deny</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {courtInvites.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: 'var(--accent-primary)' }}>🏟️ Court Invites & Mentions</h3>
                    <div className="friends-grid">
                      {courtInvites.map(inv => (
                        <div key={inv.id} className="friend-card req-card" style={{ border: '1px solid var(--accent-primary)', background: 'linear-gradient(145deg, #1e293b, #0f172a)' }}>
                          <Avatar url={inv.senderAvatar} name={inv.senderName} size="medium" />
                          <div className="fc-info">
                            <h4>{inv.courtName}</h4>
                            <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>@{inv.senderUsername || inv.senderName} • {inv.sport}</span>
                          </div>
                          <div className="fc-actions">
                            <button className="fc-accept" onClick={(e) => { e.stopPropagation(); handleAcceptCourtInvite(inv); }}>Join Match</button>
                            <button className="fc-decline" onClick={(e) => { e.stopPropagation(); handleDeclineCourtInvite(inv.id); }}>Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3>Friend Requests Inbox</h3>
                {pendingRequests.length === 0 ? (
                  <div className="friends-empty-state">
                    <p>{courtInvites.length > 0 ? "No pending friend requests." : "No pending friend requests or court invites."}</p>
                  </div>
                ) : (
                  <div className="friends-grid">
                    {pendingRequests.map(f => {
                      const otherId = f.actionUser;
                      const prof = profiles[otherId] || {};
                      const handle = prof.username || generateDefaultUsername(prof.displayName, otherId);
                      return (
                        <div key={f.id} className="friend-card req-card" onClick={() => navigate(`/profile/${otherId}`)}>
                          <Avatar url={prof.avatarUrl} name={prof.displayName || 'Player'} size="medium" />
                          <div className="fc-info">
                            <h4>{prof.displayName || 'Player'}</h4>
                            <span>@{handle}</span>
                          </div>
                          <div className="fc-actions">
                            <button className="fc-accept" onClick={(e) => { e.stopPropagation(); onAccept(f.id, otherId); }}>Accept</button>
                            <button className="fc-decline" onClick={(e) => { e.stopPropagation(); onRejectOrRemove(f.id, otherId, 'declined'); }}>Decline</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sentRequests.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '2rem' }}>Sent Requests</h3>
                    <div className="friends-grid">
                      {sentRequests.map(f => {
                        const otherId = f.user1 === user.uid ? f.user2 : f.user1;
                        const prof = profiles[otherId] || {};
                        const handle = prof.username || generateDefaultUsername(prof.displayName, otherId);
                        return (
                          <div key={f.id} className="friend-card" onClick={() => navigate(`/profile/${otherId}`)}>
                            <Avatar url={prof.avatarUrl} name={prof.displayName || 'Player'} size="medium" />
                            <div className="fc-info">
                              <h4>{prof.displayName || 'Player'}</h4>
                              <span>@{handle}</span>
                            </div>
                            <div className="fc-actions">
                              <button className="fc-decline" onClick={(e) => { e.stopPropagation(); onRejectOrRemove(f.id, otherId, 'cancelled'); }}>Cancel</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {friendToRemove && (
        <div className="friend-modal-overlay" onClick={() => setFriendToRemove(null)}>
          <div className="friend-modal-content anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="friend-modal-icon warning">💔</div>
            <h3>Remove Friend?</h3>
            <p>
              Are you sure you want to remove <strong>{friendToRemove.name}</strong> from your squad?
            </p>
            <div className="friend-modal-actions">
              <button className="secondary-btn danger" onClick={executeRemove}>
                Yes, Remove
              </button>
              <button className="primary-btn" onClick={() => setFriendToRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
