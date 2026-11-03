import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { filterProfanity } from '../utils/profanityFilter';
import { SPORT_META, DISTRICT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { useAllActiveGames } from '../hooks/useCourts';
import Avatar from './Avatar';
import './LFGFeed.css';

export default function LFGFeed() {
  const { user, userProfile, isGuest } = useAuth();
  const navigate = useNavigate();
  const { gamesList = [] } = useAllActiveGames();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');

  // Feed filters
  const [filterSport, setFilterSport] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'lfgFeed'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setMessages(msgs.reverse());
        setLoading(false);
      },
      (err) => {
        console.error('LFG Feed error:', err);
        setError('Could not load LFG feed');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Sort active games so user's hosted/joined games appear first in the "Link a Match" selector
  const attachableGames = useMemo(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return [...gamesList]
      .filter((g) => {
        if (g.status === 'cancelled') return false;
        const d = g.scheduledTime?.toDate
          ? g.scheduledTime.toDate()
          : g.scheduledTime
          ? new Date(g.scheduledTime)
          : new Date();
        return d.getTime() > twoHoursAgo;
      })
      .sort((a, b) => {
        const aMine =
          user?.uid &&
          (a.createdBy === user.uid || (a.currentPlayers || []).includes(user.uid));
        const bMine =
          user?.uid &&
          (b.createdBy === user.uid || (b.currentPlayers || []).includes(user.uid));
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return 0;
      });
  }, [gamesList, user?.uid]);

  const handleSelectGameToAttach = (gameId) => {
    setSelectedGameId(gameId);
    if (!gameId) return;
    const found = attachableGames.find((g) => g.id === gameId);
    if (found) {
      if (found.sport) setSelectedSport(found.sport);
      const court = AUSTIN_COURTS_DATA.find((c) => c.id === found.courtId);
      if (court?.district) setSelectedDistrict(court.district);
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (filterSport !== 'all' && msg.sport !== filterSport) return false;
      if (filterDistrict !== 'all' && msg.district !== filterDistrict) return false;
      return true;
    });
  }, [messages, filterSport, filterDistrict]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || isGuest) {
      setError('You must be signed in to post.');
      return;
    }
    if (!newMessage.trim() && !selectedGameId) return;

    const rawText =
      newMessage.trim() ||
      `Looking for players to join our ${SPORT_META[selectedSport]?.label || 'pickup'} match!`;
    const filteredText = filterProfanity(rawText);

    const linkedGame = selectedGameId
      ? attachableGames.find((g) => g.id === selectedGameId)
      : null;
    const linkedCourt = linkedGame
      ? AUSTIN_COURTS_DATA.find((c) => c.id === linkedGame.courtId)
      : null;

    const payload = {
      text: filteredText,
      authorId: user.uid,
      authorName: userProfile?.displayName || user.displayName || 'Player',
      authorAvatar: userProfile?.avatarUrl || user.photoURL || '',
      sport: selectedSport || linkedGame?.sport || null,
      district: selectedDistrict || linkedCourt?.district || null,
      gameId: linkedGame?.id || null,
      courtId: linkedGame?.courtId || null,
      courtName: linkedCourt?.name || linkedGame?.courtName || null,
      skillLevel: linkedGame?.skillLevel || null,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'lfgFeed'), payload);
      setNewMessage('');
      setSelectedGameId('');
      setError('');
    } catch (err) {
      console.error('Failed to post LFG message:', err);
      setError('Failed to post your message.');
    }
  };

  return (
    <div className="lfg-feed-container">
      {/* Top Filter Bar for Sport & District */}
      <div className="lfg-filter-bar">
        <select
          className="lfg-filter-select"
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          aria-label="Filter LFG by sport"
        >
          <option value="all">🏅 All Sports</option>
          {Object.entries(SPORT_META).map(([key, sm]) => (
            <option key={key} value={key}>
              {sm.emoji} {sm.label}
            </option>
          ))}
        </select>

        <select
          className="lfg-filter-select"
          value={filterDistrict}
          onChange={(e) => setFilterDistrict(e.target.value)}
          aria-label="Filter LFG by district"
        >
          <option value="all">📍 All Districts</option>
          {Object.entries(DISTRICT_META).map(([key, dm]) => (
            <option key={key} value={key}>
              📍 {dm.label}
            </option>
          ))}
        </select>

        {(filterSport !== 'all' || filterDistrict !== 'all') && (
          <button
            type="button"
            className="lfg-filter-reset"
            onClick={() => {
              setFilterSport('all');
              setFilterDistrict('all');
            }}
          >
            Reset
          </button>
        )}
      </div>

      <div className="lfg-messages-wrapper">
        {loading ? (
          <div className="lfg-loading">Loading LFG feed...</div>
        ) : filteredMessages.length === 0 ? (
          <div className="lfg-empty">
            {messages.length === 0
              ? 'No one is looking for a group right now. Post an LFG with a sport or match link below!'
              : 'No LFG posts match that sport/district filter.'}
          </div>
        ) : (
          <div className="lfg-messages-list">
            {filteredMessages.map((msg) => {
              const sportMeta = msg.sport ? SPORT_META[msg.sport] : null;
              const districtMeta = msg.district ? DISTRICT_META[msg.district] : null;

              return (
                <div
                  key={msg.id}
                  className={`lfg-message-card ${msg.authorId === user?.uid ? 'own-message' : ''}`}
                  onClick={() => msg.authorId && navigate(`/profile/${msg.authorId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Avatar
                    src={msg.authorAvatar}
                    alt={msg.authorName}
                    fallbackInitials={msg.authorName?.substring(0, 2).toUpperCase() || 'P'}
                    size={40}
                    className="lfg-avatar"
                  />
                  <div className="lfg-message-content">
                    <div className="lfg-message-header">
                      <span className="lfg-author-name">{msg.authorName}</span>
                      <span className="lfg-timestamp">
                        {msg.createdAt?.toDate
                          ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true })
                          : 'just now'}
                      </span>
                    </div>

                    {/* Actionable Sport & District Tag Pills */}
                    {(sportMeta || districtMeta) && (
                      <div className="lfg-tags-row">
                        {sportMeta && (
                          <button
                            type="button"
                            className="lfg-tag-pill lfg-tag-pill--sport"
                            style={{ '--pill-color': sportMeta.color }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterSport(msg.sport === filterSport ? 'all' : msg.sport);
                            }}
                            title={`Filter LFG by ${sportMeta.label}`}
                          >
                            {sportMeta.emoji} {sportMeta.label}
                          </button>
                        )}
                        {districtMeta && (
                          <button
                            type="button"
                            className="lfg-tag-pill lfg-tag-pill--district"
                            style={{ '--pill-color': districtMeta.color }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/district/${msg.district}`);
                            }}
                            title={`Explore courts in ${districtMeta.label}`}
                          >
                            📍 {districtMeta.label} →
                          </button>
                        )}
                      </div>
                    )}

                    <p className="lfg-message-text">{msg.text}</p>

                    {/* Attached Actionable Game Card */}
                    {(msg.gameId || msg.courtId) && (
                      <div
                        className="lfg-attached-game-card"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (msg.gameId) {
                            navigate(`/live-game/${msg.gameId}`);
                          } else if (msg.courtId) {
                            navigate(`/court/${msg.courtId}`);
                          }
                        }}
                      >
                        <div className="lfg-ag-info">
                          <span className="lfg-ag-title">
                            {sportMeta?.emoji || '🏟️'} {msg.courtName || 'Austin Pickup Match'}
                          </span>
                          {msg.skillLevel && (
                            <span className="lfg-ag-meta">Level: {msg.skillLevel}</span>
                          )}
                        </div>
                        <span className="lfg-ag-cta">⚡ Join Match →</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endOfMessagesRef} />
          </div>
        )}
      </div>

      {/* Composer with Sport, District & Game Attachment Selectors */}
      <div className="lfg-input-area">
        {error && <div className="lfg-error">{error}</div>}

        {!isGuest && user && (
          <div className="lfg-composer-attachments">
            <select
              className="lfg-attach-select"
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              aria-label="Tag a sport"
            >
              <option value="">+ 🏅 Sport Tag</option>
              {Object.entries(SPORT_META).map(([key, sm]) => (
                <option key={key} value={key}>
                  {sm.emoji} {sm.label}
                </option>
              ))}
            </select>

            <select
              className="lfg-attach-select"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              aria-label="Tag a district"
            >
              <option value="">+ 📍 District Tag</option>
              {Object.entries(DISTRICT_META).map(([key, dm]) => (
                <option key={key} value={key}>
                  📍 {dm.label}
                </option>
              ))}
            </select>

            <select
              className="lfg-attach-select lfg-attach-select--game"
              value={selectedGameId}
              onChange={(e) => handleSelectGameToAttach(e.target.value)}
              aria-label="Link an active game"
            >
              <option value="">+ 🎮 Link a Game ({attachableGames.length})</option>
              {attachableGames.map((g) => {
                const sm = SPORT_META[g.sport];
                const court = AUSTIN_COURTS_DATA.find((c) => c.id === g.courtId);
                const d = g.scheduledTime?.toDate
                  ? g.scheduledTime.toDate()
                  : g.scheduledTime
                  ? new Date(g.scheduledTime)
                  : null;
                const tStr = d
                  ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : '';
                const isMine =
                  user?.uid &&
                  (g.createdBy === user.uid || (g.currentPlayers || []).includes(user.uid));
                return (
                  <option key={g.id} value={g.id}>
                    {isMine ? '★ ' : ''}
                    {sm?.emoji || '🏟️'} {court?.shortName || court?.name || g.courtName || 'Court'}
                    {tStr ? ` · ${tStr}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className="lfg-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              isGuest
                ? 'Sign in to post...'
                : 'Need +1 for doubles or 5v5? Tag a sport, district, or match...'
            }
            disabled={!user || isGuest}
            maxLength={180}
          />
          <button
            type="submit"
            disabled={!user || isGuest || (!newMessage.trim() && !selectedGameId)}
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
