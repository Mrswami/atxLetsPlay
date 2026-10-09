import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getUserFriendships, sendFriendRequest, acceptFriendRequest, removeFriendOrRequest } from '../services/friends';
import { subscribeToUserInvites, respondToInvite } from '../services/invites';
import { joinGame } from '../hooks/useCourts';
import { generateDefaultUsername } from '../utils/usernameGenerator';
import Avatar from '../components/Avatar';
import './Friends.css';

export default function Friends() {
  const { user, userProfile, isGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const targetUid = location.state?.targetUid || (user ? user.uid : null);
  const isOwnView = targetUid === user?.uid;

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'search' | 'requests'
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

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const unsub = subscribeToUserInvites(user.uid, (invs) => {
      setCourtInvites(invs);
    });
    return unsub;
  }, [user]);

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
            Requests {(pendingRequests.length + courtInvites.length) > 0 && <span className="req-badge">{pendingRequests.length + courtInvites.length}</span>}
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
                            <button className="fc-remove" onClick={(e) => { e.stopPropagation(); onRejectOrRemove(f.id, otherId, 'removed'); }}>
                              Remove
                            </button>
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
    </div>
  );
}
