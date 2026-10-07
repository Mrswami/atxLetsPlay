import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import './Friends.css';

export default function Friends() {
  const { user, userProfile, isGuest } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'search' | 'requests'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');

  // Fallback if accessed by guest directly somehow
  if (!user || isGuest) {
    return (
      <div className="friends-page">
        <header className="friends-header">
          <button className="back-btn" onClick={() => navigate('/')}>
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
      // Fallback
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
      // Look up username registry
      const usernameDoc = await getDoc(doc(db, 'usernames', query));
      if (!usernameDoc.exists()) {
        setSearchError('Player not found.');
        setSearching(false);
        return;
      }

      // Found the UID, now get the user profile
      const targetUid = usernameDoc.data().uid;
      const profileDoc = await getDoc(doc(db, 'users', targetUid));
      
      if (profileDoc.exists()) {
        setSearchResult({ id: targetUid, ...profileDoc.data() });
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

  return (
    <div className="friends-page">
      {toast && <div className="friends-toast anim-fade-in">{toast}</div>}

      <header className="friends-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Friends Hub</h1>
      </header>

      <div className="friends-tabs">
        <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>My Squad</button>
        <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Add Friend</button>
        <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
      </div>

      <div className="friends-content anim-fade-in">
        {activeTab === 'list' && (
          <div className="friends-list-tab">
            <div className="connect-contacts-card">
              <div className="cc-icon">📱</div>
              <div className="cc-text">
                <h3>Build Your Squad</h3>
                <p>Invite friends to easily see when they're hitting the courts.</p>
              </div>
              <button className="primary-btn" onClick={handleShareInvite}>Invite Friends</button>
            </div>
            
            <div className="friends-empty-state">
              <p>You haven't added any friends yet.</p>
              <button className="secondary-btn" onClick={() => setActiveTab('search')}>Find Players</button>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
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
              <div className="search-result-card anim-scale-in">
                <div className="sr-avatar">
                  {searchResult.avatarUrl ? (
                    <img src={searchResult.avatarUrl} alt="Avatar" />
                  ) : (
                    <div className="sr-avatar-placeholder">
                      {searchResult.displayName?.substring(0,2).toUpperCase() || 'ATX'}
                    </div>
                  )}
                </div>
                <div className="sr-info">
                  <h3>{searchResult.displayName}</h3>
                  <span className="sr-username">@{searchResult.username}</span>
                  <p className="sr-district">{searchResult.district}</p>
                </div>
                <button 
                  className="primary-btn sr-add-btn" 
                  onClick={() => triggerToast('Friend requests coming soon!')}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="friends-empty-state">
            <p>No pending friend requests.</p>
          </div>
        )}
      </div>
    </div>
  );
}
