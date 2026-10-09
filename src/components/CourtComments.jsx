import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp 
} from 'firebase/firestore';
import Avatar from './Avatar';
import './CourtComments.css';

export default function CourtComments({ courtId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!courtId) return;
    
    // Support aliases for courtId (e.g. mueller-hangar-browning, mueller-paggi-square, mueller-petanque)
    const targetCourtIds = Array.from(new Set([
      courtId,
      ...(courtId.includes('mueller') ? ['mueller-hangar-browning', 'mueller-paggi-square', 'mueller-petanque'] : [])
    ]));

    const q = query(
      collection(db, 'court_comments'),
      where('courtId', 'in', targetCourtIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setComments(fetched);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching comments:', err);
      // Fallback query if 'in' fails
      const fallbackQuery = query(collection(db, 'court_comments'), where('courtId', '==', courtId));
      onSnapshot(fallbackQuery, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setComments(items);
        setLoading(false);
      }, () => setLoading(false));
    });

    return () => unsubscribe();
  }, [courtId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user || user.isAnonymous) {
      if (window.confirm("You need to sign in to post comments. Go to Login?")) {
        navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`, {
          state: { redirectTo: location.pathname }
        });
      }
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'court_comments'), {
        courtId,
        text: newComment.trim(),
        authorId: user.uid,
        authorName: userProfile?.displayName || user.displayName || 'Player',
        authorAvatar: userProfile?.avatarUrl || user.photoURL || '',
        createdAt: serverTimestamp(),
        likes: []
      });
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (comment) => {
    if (!user || user.isAnonymous) {
      if (window.confirm("You need to sign in to like comments. Go to Login?")) {
        navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`, {
          state: { redirectTo: location.pathname }
        });
      }
      return;
    }
    
    const commentRef = doc(db, 'court_comments', comment.id);
    const hasLiked = comment.likes?.includes(user.uid);
    
    try {
      if (hasLiked) {
        await updateDoc(commentRef, {
          likes: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(commentRef, {
          likes: arrayUnion(user.uid)
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleDelete = async (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteDoc(doc(db, 'court_comments', commentId));
      } catch (err) {
        console.error('Error deleting comment:', err);
      }
    }
  };

  return (
    <div className="court-comments-section">
      <form onSubmit={handleSubmit} className="cc-form">
        <textarea
          className="cc-input"
          placeholder={"Add a comment, tip, or review..."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={submitting}
          rows="3"
        />
        <div className="cc-form-actions">
          <button 
            type="submit" 
            className="cc-submit-btn" 
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      <div className="cc-list">
        {loading ? (
          <div className="cc-loading">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="cc-empty">
            <span className="cc-empty-icon">💬</span>
            <p>No comments yet. Be the first to start the discussion!</p>
          </div>
        ) : (
          comments.map((comment) => {
            const hasLiked = comment.likes?.includes(user?.uid);
            const likeCount = comment.likes?.length || 0;
            const isAuthor = user?.uid === comment.authorId;
            const timeStr = comment.createdAt?.toDate 
              ? comment.createdAt.toDate().toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })
              : 'Just now';

            return (
              <div key={comment.id} className="cc-item">
                <div className="cc-avatar">
                  <Avatar url={comment.authorAvatar} name={comment.authorName} size="small" xp={0} />
                </div>
                <div className="cc-content-wrap">
                  <div className="cc-header">
                    <span className="cc-author">{comment.authorName}</span>
                    <span className="cc-time">{timeStr}</span>
                  </div>
                  <div className="cc-text">{comment.text}</div>
                  <div className="cc-actions">
                    <button 
                      type="button"
                      className={`cc-action-btn ${hasLiked ? 'liked' : ''}`}
                      onClick={() => handleToggleLike(comment)}
                    >
                      {hasLiked ? '❤️' : '🤍'} <span className="cc-action-count">{likeCount}</span>
                    </button>
                    {isAuthor && (
                      <button type="button" className="cc-action-btn delete" onClick={() => handleDelete(comment.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
