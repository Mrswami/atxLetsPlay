import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import './LiveGame.css';

export default function LiveGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [game, setGame] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hearts, setHearts] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [gameId]);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    
    await addDoc(collection(db, 'games', gameId, 'chat'), {
      text: newMessage.trim(),
      senderId: user.uid,
      senderName: userProfile?.displayName || user.displayName || 'Guest Player',
      createdAt: serverTimestamp()
    });
    setNewMessage('');
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

  if (!game) return <div className="live-game-loading">Loading live stream...</div>;

  const scheduledDate = game.scheduledTime ? game.scheduledTime.toDate() : new Date();
  const isOver = scheduledDate.getTime() <= Date.now() - (2 * 60 * 60 * 1000);
  const homeScore = game.score?.home || 0;
  const awayScore = game.score?.away || 0;
  const isHost = user?.uid === game.createdBy || user?.uid === game.creatorId;

  return (
    <div className="live-game-page">
      <header className="live-game-header">
        <button className="lg-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="lg-header-info">
          <h2>{game.courtName}</h2>
          {isOver ? (
            <span className="lg-live-badge" style={{ color: 'var(--text-secondary)', animation: 'none' }}>ENDED</span>
          ) : (
            <span className="lg-live-badge">● LIVE</span>
          )}
        </div>
      </header>

      <div className="lg-video-placeholder">
        <div className="lg-video-overlay">
          <Avatar url={game.hostAvatarUrl} name={game.creatorName || game.hostName} size="large" />
          <p className="lg-host-name">{game.creatorName || game.hostName || (game.createdBy?.startsWith('guest-') ? 'A Guest Player' : 'A Player')} {isOver ? 'hosted' : 'is hosting'} {game.sport}</p>
          <div className="lg-participants">
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
          {chatMessages.map(msg => (
            <div key={msg.id} className="lg-chat-message">
              <span className="lg-chat-time">
                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
              </span>
              <span className="lg-chat-sender">{msg.senderName}:</span>
              <span className="lg-chat-text">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        
        {!isOver && (
          <div className="lg-chat-actions">
            <form onSubmit={handleSendChat} className="lg-chat-form">
              <input 
                type="text" 
                placeholder="Chat..." 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="lg-chat-input"
              />
              <button type="submit" className="lg-chat-send" disabled={!newMessage.trim() || !user}>
                 Send
              </button>
            </form>
            <button type="button" className="lg-heart-btn" onClick={handleSendHeart}>
               ❤️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
