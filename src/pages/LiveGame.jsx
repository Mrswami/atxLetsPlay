import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getCartoonImageUrl } from '../data/courtsMeta';
import { generateDefaultUsername } from '../utils/usernameGenerator';
import { processChatMentions } from '../services/invites';
import Avatar from '../components/Avatar';
import './LiveGame.css';

const USER_COLORS = ['#38bdf8', '#22d366', '#a78bfa', '#f59e0b', '#ec4899', '#f97316', '#06b6d4'];
function getUserColor(handle = '') {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) hash += handle.charCodeAt(i);
  return USER_COLORS[hash % USER_COLORS.length];
}

export default function LiveGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [game, setGame] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hearts, setHearts] = useState([]);
  const [userProfilesMap, setUserProfilesMap] = useState({});
  const [availableUsernames, setAvailableUsernames] = useState([]);
  const [usernameToUidMap, setUsernameToUidMap] = useState({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsList, setParticipantsList] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Prefetch usernames from database for autocomplete & mention profile resolution
    getDocs(query(collection(db, 'usernames'), limit(100))).then(snap => {
      const list = [];
      const map = {};
      snap.docs.forEach(d => {
        const uid = d.data().uid;
        list.push({ username: d.id, uid });
        map[d.id.toLowerCase()] = uid;
      });

      // Merge userProfilesMap entries
      Object.values(userProfilesMap).forEach(p => {
        if (p.username) {
          map[p.username.toLowerCase()] = p.uid;
          if (!list.some(item => item.username.toLowerCase() === p.username.toLowerCase())) {
            list.push({ username: p.username, uid: p.uid, displayName: p.displayName });
          }
        }
      });

      setAvailableUsernames(list);
      setUsernameToUidMap(map);
    }).catch(() => {});
  }, [userProfilesMap]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [gameId]);

  // Load participant profiles when game updates
  useEffect(() => {
    if (!game) return;
    const playerUids = Array.from(new Set([game.createdBy, ...(game.currentPlayers || [])].filter(Boolean)));
    if (playerUids.length === 0) return;

    setLoadingParticipants(true);
    Promise.all(playerUids.map(async (uid) => {
      if (uid.startsWith('guest-')) {
        return {
          uid,
          displayName: game.creatorName || 'Guest Player',
          username: 'guest',
          avatarUrl: '',
          isHost: uid === game.createdBy,
        };
      }
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          return { uid, ...snap.data(), isHost: uid === game.createdBy };
        }
      } catch (err) {
        console.warn('Error fetching participant:', err);
      }
      return {
        uid,
        displayName: 'Player',
        username: generateDefaultUsername('Player', uid),
        avatarUrl: '',
        isHost: uid === game.createdBy,
      };
    })).then((results) => {
      setParticipantsList(results);
      setLoadingParticipants(false);
    });
  }, [game]);

  useEffect(() => {
    const q = query(
      collection(db, 'games', gameId, 'chat'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [gameId]);

  // Real-time listener for chat participant profiles to ensure usernames update dynamically
  useEffect(() => {
    const senderIds = Array.from(new Set(chatMessages.map(m => m.senderId).filter(id => id && !id.startsWith('guest-'))));
    const unsubs = senderIds.map(id => {
      return onSnapshot(doc(db, 'users', id), (snap) => {
        if (snap.exists()) {
          setUserProfilesMap(prev => ({ ...prev, [id]: snap.data() }));
        }
      });
    });
    return () => unsubs.forEach(unsub => unsub());
  }, [chatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const renderMessageText = (text) => {
    if (!text) return '';
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const rawHandle = part.slice(1);
        const lowerHandle = rawHandle.toLowerCase();
        const targetUid = usernameToUidMap[lowerHandle];
        const color = getUserColor(lowerHandle);
        return (
          <span
            key={i}
            className="lg-mention-chip"
            style={{
              backgroundColor: `${color}22`,
              color: color,
              borderColor: `${color}66`
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (targetUid) {
                navigate(`/profile/${targetUid}`);
              } else {
                const found = Object.values(userProfilesMap).find(p => p.username?.toLowerCase() === lowerHandle);
                if (found?.uid) {
                  navigate(`/profile/${found.uid}`);
                }
              }
            }}
            title={`View @${rawHandle}'s profile`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    const lastWord = val.split(/\s+/).pop();
    if (lastWord && lastWord.startsWith('@')) {
      setSuggestionFilter(lastWord.slice(1).toLowerCase());
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (username) => {
    const words = newMessage.split(/\s+/);
    words.pop();
    const updated = [...words.filter(Boolean), `@${username}`].join(' ') + ' ';
    setNewMessage(updated);
    setShowSuggestions(false);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!user || user.isAnonymous) {
      if (window.confirm("You need to sign in to send messages. Go to Login?")) {
        navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`, {
          state: { redirectTo: location.pathname }
        });
      }
      return;
    }
    
    const activeUsername = userProfile?.username || generateDefaultUsername(userProfile?.displayName || user.displayName, user.uid);
    const textToSend = newMessage.trim();
    setNewMessage('');
    setShowSuggestions(false);

    await addDoc(collection(db, 'games', gameId, 'chat'), {
      text: textToSend,
      senderId: user.uid,
      senderName: userProfile?.displayName || user.displayName || 'Guest Player',
      senderUsername: activeUsername,
      createdAt: serverTimestamp()
    });

    // Process mentions to create court invite notifications
    processChatMentions(textToSend, {
      uid: user.uid,
      displayName: userProfile?.displayName || user.displayName,
      username: activeUsername,
      avatarUrl: userProfile?.avatarUrl || user.photoURL,
    }, game);
  };

  const handleSendHeart = () => {
    const newHeart = {
      id: Date.now() + Math.random(),
      left: Math.random() * 30 + 70 // 70-100% (right side)
    };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
  };

  const handleUpdateScore = async (home, away) => {
    if (user?.uid !== game.createdBy && user?.uid !== game.creatorId) return;
    try {
      await updateDoc(doc(db, 'games', gameId), {
        score: { home, away }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelGame = async () => {
    if (window.confirm("Are you sure you want to cancel this game? Players won't be able to join.")) {
      try {
        await updateDoc(doc(db, 'games', gameId), { status: 'cancelled' });
      } catch (e) {
        console.error("Failed to cancel", e);
      }
    }
  };

  if (!game) return <div className="live-game-loading">Loading live stream...</div>;

  const scheduledDate = game.scheduledTime ? game.scheduledTime.toDate() : new Date();
  const isOver = scheduledDate.getTime() <= Date.now() - (2 * 60 * 60 * 1000);
  const isCancelled = game.status === 'cancelled';
  const homeScore = game.score?.home || 0;
  const awayScore = game.score?.away || 0;
  const isHost = Boolean(user?.uid) && (user.uid === game.createdBy || user.uid === game.creatorId);
  const handleBack = () => {
    if (window.history.length <= 2) {
      navigate(game?.courtId ? `/court/${game.courtId}` : '/');
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="live-game-page">
      <header className="live-game-header">
        <button className="lg-back-btn" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="lg-header-info">
          <h2>{game.courtName}</h2>
          {isCancelled ? (
            <span className="lg-live-badge" style={{ color: 'var(--accent-danger)', animation: 'none' }}>CANCELLED</span>
          ) : isOver ? (
            <span className="lg-live-badge" style={{ color: 'var(--text-secondary)', animation: 'none' }}>ENDED</span>
          ) : (
            <span className="lg-live-badge">● LIVE</span>
          )}
        </div>
      </header>

      <div 
        className="lg-video-placeholder"
        style={{
          backgroundImage: `url(${getCartoonImageUrl(game.courtId)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="lg-video-overlay" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <p className="lg-host-name">{game.creatorName || game.hostName || (game.createdBy?.startsWith('guest-') ? 'A Guest Player' : 'A Player')} {isOver ? 'hosted' : 'is hosting'} {game.sport}</p>
          <div 
            className="lg-participants" 
            onClick={() => setShowParticipantsModal(true)}
            style={{ cursor: 'pointer' }}
            title="Click to view all joined participants"
          >
            <span className="lg-player-count">👥 {game.currentPlayers?.length || 1} participant(s)</span>
          </div>
          
          <div className="lg-score-tracker">
            <div className="lg-score-team">
              <span>Home</span>
              <span className="lg-score-num">{homeScore}</span>
              {isHost && !isOver && (
                <button onClick={() => handleUpdateScore(homeScore + 1, awayScore)}>+</button>
              )}
            </div>
            <div className="lg-score-divider">-</div>
            <div className="lg-score-team">
              <span>Away</span>
              <span className="lg-score-num">{awayScore}</span>
              {isHost && !isOver && (
                <button onClick={() => handleUpdateScore(homeScore, awayScore + 1)}>+</button>
              )}
            </div>
          </div>
        </div>
        
        {/* Floating Hearts Container */}
        <div className="lg-hearts-container">
          {hearts.map(h => (
            <div key={h.id} className="lg-floating-heart" style={{ left: `${h.left}%` }}>
              ❤️
            </div>
          ))}
        </div>
      </div>

      <div className="lg-chat-section">
        <div className="lg-chat-messages">
          {chatMessages.map(msg => {
            const currentProf = userProfilesMap[msg.senderId];
            const displayUsername = currentProf?.username || msg.senderUsername || (msg.senderId && !msg.senderId.startsWith('guest-') ? generateDefaultUsername(msg.senderName, msg.senderId) : '');
            const senderColor = getUserColor(displayUsername || msg.senderName);

            return (
              <div key={msg.id} className="lg-chat-message">
                <span className="lg-chat-time">
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                </span>
                <span 
                  className="lg-chat-sender-wrapper"
                  onClick={() => {
                    if (msg.senderId && !msg.senderId.startsWith('guest-')) {
                      navigate(`/profile/${msg.senderId}`);
                    }
                  }}
                  style={{ cursor: msg.senderId && !msg.senderId.startsWith('guest-') ? 'pointer' : 'default' }}
                >
                  <span className="lg-chat-sender-name" style={{ color: senderColor }}>{msg.senderName}</span>
                  {displayUsername && (
                    <span className="lg-sender-handle">
                      @{displayUsername}
                    </span>
                  )}:
                </span>
                <span className="lg-chat-text">{renderMessageText(msg.text)}</span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
        
        {!isOver && !isCancelled && (
          <div className="lg-chat-actions" style={{ position: 'relative' }}>
            {showSuggestions && (
              <div className="lg-suggestions-popup">
                {availableUsernames
                  .filter(p => p.username && p.username.toLowerCase().includes(suggestionFilter))
                  .slice(0, 6)
                  .map(p => {
                    const color = getUserColor(p.username);
                    return (
                      <div 
                        key={p.uid || p.username} 
                        className="lg-suggestion-item" 
                        onClick={() => handleSelectSuggestion(p.username)}
                      >
                        <div className="lsi-info">
                          <span className="lsi-handle" style={{ color }}>@{p.username}</span>
                          {p.displayName && <span className="lsi-name">{p.displayName}</span>}
                        </div>
                        <span className="lsi-badge">Invite</span>
                      </div>
                    );
                  })}
              </div>
            )}
            <form onSubmit={handleSendChat} className="lg-chat-form">
              <input 
                type="text" 
                placeholder="Chat or type @username to tag..." 
                value={newMessage}
                onChange={handleChatInputChange}
                className="lg-chat-input"
              />
              <button type="submit" className="lg-chat-send" disabled={!newMessage.trim()}>
                 Send
              </button>
            </form>
            <button type="button" className="lg-heart-btn" onClick={handleSendHeart}>
               ❤️
            </button>
          </div>
        )}
        {isHost && !isOver && !isCancelled && (
          <div style={{ padding: '10px 16px', background: 'var(--surface-base)' }}>
            <button 
              onClick={handleCancelGame} 
              style={{ width: '100%', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontWeight: 'bold' }}>
              Cancel Game
            </button>
          </div>
        )}
      </div>

      {/* Participants Roster Modal */}
      {showParticipantsModal && (
        <div className="participants-modal-overlay" onClick={() => setShowParticipantsModal(false)}>
          <div className="participants-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pm-header">
              <h3>👥 Joined Participants ({participantsList.length})</h3>
              <button className="pm-close-btn" onClick={() => setShowParticipantsModal(false)}>✕</button>
            </div>
            <div className="pm-body">
              {loadingParticipants ? (
                <div className="pm-loading">Loading roster...</div>
              ) : participantsList.length === 0 ? (
                <div className="pm-empty">No joined players yet</div>
              ) : (
                <div className="pm-list">
                  {participantsList.map((p) => {
                    const color = getUserColor(p.username || p.displayName);
                    const isGuest = p.uid?.startsWith('guest-');
                    return (
                      <div 
                        key={p.uid} 
                        className="pm-player-card"
                        onClick={() => {
                          if (!isGuest && p.uid) {
                            setShowParticipantsModal(false);
                            navigate(`/profile/${p.uid}`);
                          }
                        }}
                        style={{ cursor: !isGuest ? 'pointer' : 'default' }}
                      >
                        <div className="pm-avatar-wrap">
                          <Avatar 
                            avatarUrl={p.avatarUrl} 
                            name={p.displayName || 'Player'} 
                            size={44} 
                          />
                        </div>
                        <div className="pm-player-info">
                          <div className="pm-player-top">
                            <span className="pm-player-name">{p.displayName || 'Player'}</span>
                            {p.isHost && <span className="pm-host-badge">HOST</span>}
                          </div>
                          <span className="pm-player-handle" style={{ color }}>
                            @{p.username || generateDefaultUsername(p.displayName, p.uid)}
                          </span>
                        </div>
                        {!isGuest && (
                          <div className="pm-arrow">→</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
