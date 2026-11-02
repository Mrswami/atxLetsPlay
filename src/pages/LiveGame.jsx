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
import { filterProfanity } from '../utils/profanityFilter';
import { approveJoinRequest, denyJoinRequest, kickPlayer, joinGame, requestJoinGame } from '../hooks/useCourts';
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
  const { user, userProfile, isGuest: contextIsGuest } = useAuth();
  
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
  const [requestsList, setRequestsList] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [shareToast, setShareToast] = useState('');
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
    async function fetchProfiles() {
      const results = await Promise.all(playerUids.map(async (uid) => {
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
      }));

      const requestUids = Array.from(new Set(game.joinRequests || []));
      const reqResults = await Promise.all(requestUids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            return { uid, ...snap.data() };
          }
        } catch (err) {
          console.warn('Error fetching request:', err);
        }
        return { uid, displayName: 'Player', username: generateDefaultUsername('Player', uid), avatarUrl: '' };
      }));

      setParticipantsList(results);
      setRequestsList(reqResults);
      setLoadingParticipants(false);
    }
    
    fetchProfiles();
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
            role="button"
            tabIndex={0}
            className="lg-mention-chip"
            style={{
              backgroundColor: `${color}22`,
              color: color,
              borderColor: `${color}66`
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (targetUid) {
                navigate(`/profile/${targetUid}`);
              } else {
                const found = Object.values(userProfilesMap).find(p => p.username?.toLowerCase() === lowerHandle);
                if (found?.uid) {
                  navigate(`/profile/${found.uid}`);
                } else {
                  navigate(`/profile/${rawHandle}`);
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
    const textToSend = filterProfanity(newMessage.trim());
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

  const handleKick = async (targetUid) => {
    if (window.confirm("Are you sure you want to kick this player from the game?")) {
      try {
        await kickPlayer(game.id, targetUid, user.uid);
      } catch (e) {
        console.error("Failed to kick player", e);
      }
    }
  };

  const handleApprove = async (targetUid) => {
    try {
      await approveJoinRequest(game.id, targetUid, user.uid);
    } catch (e) {
      console.error("Failed to approve", e);
    }
  };

  const handleDeny = async (targetUid) => {
    try {
      await denyJoinRequest(game.id, targetUid, user.uid);
    } catch (e) {
      console.error("Failed to deny", e);
    }
  };

  const handleTogglePrivate = async () => {
    try {
      const currentMode = game?.isInviteOnly || game?.privacyMode === 'invite_only'
        ? 'invite_only'
        : game?.isPrivate
        ? 'request'
        : 'public';
      const nextMode = currentMode === 'public' ? 'request' : currentMode === 'request' ? 'invite_only' : 'public';
      await updateDoc(doc(db, 'games', gameId), {
        privacyMode: nextMode,
        isPrivate: nextMode !== 'public',
        isInviteOnly: nextMode === 'invite_only',
      });
      setShareToast(
        nextMode === 'invite_only'
          ? '🔒 Match is now Invite-Only (Hidden from public feeds)'
          : nextMode === 'request'
          ? '🛡️ Match is now Gatekept (Request to Join)'
          : '🔓 Match is now Public (Anyone can join)'
      );
      setTimeout(() => setShareToast(''), 3500);
    } catch (e) {
      console.error("Failed to toggle privacy", e);
      alert("Failed to update privacy settings: " + e.message);
    }
  };

  const handleShareGame = async () => {
    const origin = window.location.origin.includes('localhost')
      ? 'https://atxletsplay.web.app'
      : window.location.origin;
    const shareUrl = `${origin}/live-game/${gameId}`;
    const sportName = (game?.sport || 'Pickup').toUpperCase();
    const courtName = game?.courtName || 'Austin Court';

    let timeStr = '';
    if (game?.scheduledTime?.toMillis) {
      timeStr = new Date(game.scheduledTime.toMillis()).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    const shareTitle = `ATX Let's Play: ${sportName} @ ${courtName}`;
    const shareText = `🏀 Join my ${sportName} game at ${courtName}${timeStr ? ` on ${timeStr}` : ''} on ATX Let's Play!\n\nTap here to jump in: ${shareUrl}\n(Sign in super fast with Google or Email - Google is fastest! ⚡)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setShareToast('🎉 Match invite shared successfully!');
        setTimeout(() => setShareToast(''), 3500);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Native share dialog closed or unsupported, falling back to clipboard', err);
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareToast('📋 Invite copied to clipboard! Paste it into a text message or group chat.');
      setTimeout(() => setShareToast(''), 4500);
    } catch (err) {
      window.prompt('Copy match invite link & text:', shareText);
    }
  };

  const handleJoinGame = async () => {
    if (!user || user.isAnonymous) {
      navigate('/login');
      return;
    }
    try {
      await joinGame(game.id, user.uid);
      setShareToast('🎉 You joined the match!');
      setTimeout(() => setShareToast(''), 3500);
    } catch (e) {
      console.error('Failed to join game', e);
      alert(e.message || 'Failed to join game');
    }
  };

  const handleRequestJoinGame = async () => {
    if (!user || user.isAnonymous) {
      navigate('/login');
      return;
    }
    try {
      await requestJoinGame(game.id, user.uid);
      setShareToast('📩 Request sent to the game host!');
      setTimeout(() => setShareToast(''), 4000);
    } catch (e) {
      console.error('Failed to request join', e);
      alert(e.message || 'Failed to request join');
    }
  };

  if (!game) return <div className="live-game-loading">Loading live stream...</div>;

  const scheduledDate = game.scheduledTime ? game.scheduledTime.toDate() : new Date();
  const isOver = scheduledDate.getTime() <= Date.now() - (2 * 60 * 60 * 1000);
  const isCancelled = game.status === 'cancelled';
  const homeScore = game.score?.home || 0;
  const awayScore = game.score?.away || 0;
  const isHost = Boolean(user?.uid) && (user.uid === game.createdBy || user.uid === game.creatorId);
  const isParticipant = Boolean(user?.uid) && (isHost || (game.currentPlayers || []).includes(user.uid));
  const isGuest = contextIsGuest || !user || user.isAnonymous;
  const shouldBlurChat = isGuest || !isParticipant;
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

      {shareToast && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '30px',
          fontWeight: '700',
          fontSize: '0.85rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          zIndex: 9999,
          textAlign: 'center',
          maxWidth: '90%',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {shareToast}
        </div>
      )}

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
                <span className="lg-chat-text" style={shouldBlurChat ? { filter: 'blur(4px)', opacity: 0.6, userSelect: 'none', pointerEvents: 'none' } : {}}>
                  {shouldBlurChat ? msg.text.replace(/[^\s]/g, '█') : renderMessageText(msg.text)}
                </span>
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
        {/* Host Controls Panel (Always available to Game Creator for active & past hosted games) */}
        {isHost ? (
          <div style={{ padding: '12px 16px', background: 'var(--surface-base)', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                👑 Host Tools {isOver ? '(Past Hosted Game)' : isCancelled ? '(Cancelled)' : ''}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: (game?.isInviteOnly || game?.privacyMode === 'invite_only') ? 'rgba(139, 92, 246, 0.2)' : game?.isPrivate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: (game?.isInviteOnly || game?.privacyMode === 'invite_only') ? '#c4b5fd' : game?.isPrivate ? '#f59e0b' : '#22c55e', border: `1px solid ${(game?.isInviteOnly || game?.privacyMode === 'invite_only') ? 'rgba(139, 92, 246, 0.45)' : game?.isPrivate ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}` }}>
                {(game?.isInviteOnly || game?.privacyMode === 'invite_only') ? '🔒 Invite-Only (Hidden)' : game?.isPrivate ? '🔒 Gatekept (Request to Join)' : '🌐 Public Match'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleShareGame} 
                className="primary-btn"
                style={{ flex: 1.2, padding: '11px 12px', fontSize: '0.86rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                Share Match Invite
              </button>
              <button 
                onClick={handleTogglePrivate} 
                style={{ flex: 1, padding: '11px 10px', background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem' }}>
                {(game?.isInviteOnly || game?.privacyMode === 'invite_only') ? '🔓 Switch to Public' : game?.isPrivate ? '🔒 Switch to Invite-Only' : '🛡️ Make Gatekept'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowParticipantsModal(true)} 
                style={{ flex: 1, padding: '11px 12px', background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                👥 Manage Roster & Kick {game?.isPrivate && requestsList.length > 0 && <span style={{ background: 'var(--accent-secondary)', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>{requestsList.length} req</span>}
              </button>
              {!isCancelled && !isOver && (
                <button 
                  onClick={handleCancelGame} 
                  style={{ padding: '11px 14px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Non-host viewers (Participants or prospective joiners) */
          <div style={{ padding: '10px 16px', background: 'var(--surface-base)', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleShareGame} 
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                🔗 Share Match Invite
              </button>
              <button 
                onClick={() => setShowParticipantsModal(true)} 
                style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem' }}>
                👥 View Roster ({participantsList.length})
              </button>
            </div>

            {/* If user is not yet a participant and game is active */}
            {!isParticipant && !isOver && !isCancelled && (
              isGuest ? (
                <button 
                  onClick={() => navigate('/login')} 
                  className="primary-btn"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '800', fontSize: '0.9rem' }}>
                  ⚡ Sign In with Google / Email to Join
                </button>
              ) : (game?.invitedPlayers || []).includes(user?.uid) ? (
                <button 
                  onClick={handleJoinGame} 
                  className="primary-btn" 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '800' }}>
                  ⚡ Accept Invite & Join Match Now
                </button>
              ) : (game?.isInviteOnly || game?.privacyMode === 'invite_only') ? (
                <button disabled className="secondary-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px' }}>
                  🔒 Invite-Only Match (Host Invitation Required)
                </button>
              ) : game?.isPrivate ? (
                game?.joinRequests?.includes(user?.uid) ? (
                  <button disabled className="secondary-btn" style={{ width: '100%', padding: '12px', borderRadius: '10px' }}>
                    ⏳ Join Request Sent (Awaiting Host)
                  </button>
                ) : (
                  <button 
                    onClick={handleRequestJoinGame} 
                    className="primary-btn" 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '800' }}>
                    🔒 Request to Join Private Match
                  </button>
                )
              ) : (
                <button 
                  onClick={handleJoinGame} 
                  className="primary-btn" 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: '800' }}>
                  ⚡ Join Match Now
                </button>
              )
            )}
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
                        <div className="pm-player-info" style={{ flex: 1 }}>
                          <div className="pm-player-top">
                            <span className="pm-player-name">{p.displayName || 'Player'}</span>
                            {p.isHost && <span className="pm-host-badge">HOST</span>}
                          </div>
                          <span className="pm-player-handle" style={{ color }}>
                            @{p.username || generateDefaultUsername(p.displayName, p.uid)}
                          </span>
                        </div>
                        {isHost && !p.isHost && (
                          <button 
                            className="secondary-btn danger" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}
                            onClick={(e) => { e.stopPropagation(); handleKick(p.uid); }}
                          >
                            Kick
                          </button>
                        )}
                        {!isGuest && (
                          <div className="pm-arrow">→</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Requests Section for Host */}
              {isHost && game?.isPrivate && requestsList.length > 0 && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--accent-secondary)' }}>Pending Requests ({requestsList.length})</h3>
                  <div className="pm-list">
                    {requestsList.map((p) => {
                      const color = getUserColor(p.username || p.displayName);
                      return (
                        <div 
                          key={p.uid} 
                          className="pm-player-card"
                          onClick={() => navigate(`/profile/${p.uid}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="pm-avatar-wrap">
                            <Avatar avatarUrl={p.avatarUrl} name={p.displayName || 'Player'} size={44} />
                          </div>
                          <div className="pm-player-info" style={{ flex: 1 }}>
                            <span className="pm-player-name">{p.displayName || 'Player'}</span>
                            <span className="pm-player-handle" style={{ color }}>
                              @{p.username || generateDefaultUsername(p.displayName, p.uid)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 'bold' }}
                              onClick={(e) => { e.stopPropagation(); handleApprove(p.uid); }}
                            >
                              Approve
                            </button>
                            <button 
                              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.4rem 0.6rem', borderRadius: '8px' }}
                              onClick={(e) => { e.stopPropagation(); handleDeny(p.uid); }}
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
