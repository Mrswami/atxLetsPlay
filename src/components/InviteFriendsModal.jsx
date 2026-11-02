import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getUserFriendships } from '../services/friends';
import { sendDirectGameInvites, resolveUsernamesToUids } from '../services/invites';
import { generateDefaultUsername } from '../utils/usernameGenerator';
import Avatar from './Avatar';
import './InviteFriendsModal.css';

export default function InviteFriendsModal({
  game,
  user,
  userProfile,
  availableUsernames = [],
  onClose,
  onInviteSent,
}) {
  const [squadList, setSquadList] = useState([]);
  const [loadingSquad, setLoadingSquad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitingUids, setInvitingUids] = useState({});
  const [localInvitedUids, setLocalInvitedUids] = useState(new Set(game?.invitedPlayers || []));
  const [invitingAll, setInvitingAll] = useState(false);
  const [lookupStatus, setLookupStatus] = useState('');

  useEffect(() => {
    setLocalInvitedUids(new Set(game?.invitedPlayers || []));
  }, [game?.invitedPlayers]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    async function loadSquad() {
      setLoadingSquad(true);
      try {
        const friendships = await getUserFriendships(user.uid);
        const acceptedFriendUids = friendships
          .filter((f) => f.status === 'accepted')
          .map((f) => (f.user1 === user.uid ? f.user2 : f.user1))
          .filter(Boolean);

        const profiles = await Promise.all(
          acceptedFriendUids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                const data = snap.data();
                return {
                  uid,
                  displayName: data.displayName || 'Player',
                  username: data.username || generateDefaultUsername(data.displayName || 'Player', uid),
                  avatarUrl: data.avatarUrl || data.photoURL || '',
                  skillLevel: data.skill_level || '',
                };
              }
            } catch (e) {
              console.warn('Failed to fetch friend profile:', uid, e);
            }
            return {
              uid,
              displayName: 'Squad Player',
              username: generateDefaultUsername('Player', uid),
              avatarUrl: '',
              skillLevel: '',
            };
          })
        );

        if (!cancelled) {
          setSquadList(profiles);
        }
      } catch (err) {
        console.error('Error loading squad list:', err);
      } finally {
        if (!cancelled) setLoadingSquad(false);
      }
    }

    loadSquad();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const senderUser = useMemo(
    () => ({
      uid: user?.uid,
      displayName: userProfile?.displayName || user?.displayName || 'Host',
      username:
        userProfile?.username ||
        generateDefaultUsername(userProfile?.displayName || user?.displayName || 'Host', user?.uid),
    }),
    [user, userProfile]
  );

  const joinedSet = useMemo(() => new Set(game?.currentPlayers || []), [game?.currentPlayers]);

  const filteredSquad = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return squadList;
    return squadList.filter(
      (f) =>
        f.displayName?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q)
    );
  }, [squadList, searchQuery]);

  // Additional matching directory players not in Squad when searching
  const otherDirectoryMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q || q.length < 2) return [];
    const squadUidSet = new Set(squadList.map((s) => s.uid));
    return availableUsernames
      .filter(
        (u) =>
          u.uid &&
          u.uid !== user?.uid &&
          !squadUidSet.has(u.uid) &&
          (u.username?.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [availableUsernames, squadList, searchQuery, user?.uid]);

  const uninvitedSquadMembers = useMemo(
    () =>
      squadList.filter(
        (f) => !joinedSet.has(f.uid) && !localInvitedUids.has(f.uid)
      ),
    [squadList, joinedSet, localInvitedUids]
  );

  const handleInviteFriend = async (friend) => {
    if (!friend?.uid || !game?.id || invitingUids[friend.uid]) return;
    setInvitingUids((prev) => ({ ...prev, [friend.uid]: true }));
    setLookupStatus('');

    try {
      await sendDirectGameInvites([friend.uid], senderUser, {
        id: game.id,
        courtId: game.courtId,
        courtName: game.courtName,
        sport: game.sport,
      });
      setLocalInvitedUids((prev) => {
        const next = new Set(prev);
        next.add(friend.uid);
        return next;
      });
      onInviteSent?.(`🎯 Invited @${friend.username || friend.displayName} to the match!`);
    } catch (err) {
      console.error('Failed to send invite:', err);
      setLookupStatus('Failed to send invite. Please try again.');
    } finally {
      setInvitingUids((prev) => ({ ...prev, [friend.uid]: false }));
    }
  };

  const handleInviteAllSquad = async () => {
    if (uninvitedSquadMembers.length === 0 || invitingAll) return;
    setInvitingAll(true);
    setLookupStatus('');

    try {
      const targetUids = uninvitedSquadMembers.map((f) => f.uid);
      await sendDirectGameInvites(targetUids, senderUser, {
        id: game.id,
        courtId: game.courtId,
        courtName: game.courtName,
        sport: game.sport,
      });
      setLocalInvitedUids((prev) => {
        const next = new Set(prev);
        targetUids.forEach((uid) => next.add(uid));
        return next;
      });
      onInviteSent?.(`🎯 Sent match invites to ${targetUids.length} Squad friend${targetUids.length > 1 ? 's' : ''}!`);
    } catch (err) {
      console.error('Failed to invite squad:', err);
      setLookupStatus('Failed to invite squad.');
    } finally {
      setInvitingAll(false);
    }
  };

  const handleDirectUsernameSubmit = async (e) => {
    e.preventDefault();
    const handle = searchQuery.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;
    setLookupStatus('Searching...');
    try {
      const uids = await resolveUsernamesToUids([handle], user?.uid);
      if (uids.length === 0) {
        setLookupStatus(`No player found with @${handle}`);
        return;
      }
      await handleInviteFriend({ uid: uids[0], username: handle, displayName: handle });
      setSearchQuery('');
      setLookupStatus(`✓ Invited @${handle}!`);
    } catch (err) {
      setLookupStatus('Could not invite player.');
    }
  };

  return (
    <div className="ifm-overlay" onClick={onClose}>
      <div className="ifm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ifm-header">
          <div>
            <h3>🎯 Invite Friends & Squad</h3>
            <p className="ifm-subtitle">1-tap court invites — no typing needed</p>
          </div>
          <button className="ifm-close-btn" onClick={onClose} aria-label="Close invite modal">
            ✕
          </button>
        </div>

        <div className="ifm-body">
          {/* Search / Quick @username bar */}
          <form onSubmit={handleDirectUsernameSubmit} className="ifm-search-row">
            <input
              type="text"
              className="ifm-search-input"
              placeholder="Filter Squad or type any @username..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setLookupStatus('');
              }}
            />
            {searchQuery.trim() && (
              <button type="submit" className="ifm-search-invite-btn">
                Invite @{searchQuery.trim().replace(/^@/, '')}
              </button>
            )}
          </form>

          {lookupStatus && <div className="ifm-status-msg">{lookupStatus}</div>}

          {/* 1-Tap Invite All Squad Banner */}
          {!loadingSquad && uninvitedSquadMembers.length > 1 && (
            <button
              type="button"
              className="ifm-invite-all-btn"
              onClick={handleInviteAllSquad}
              disabled={invitingAll}
            >
              {invitingAll
                ? '⏳ Sending Squad Invites...'
                : `⚡ Invite Entire Squad (${uninvitedSquadMembers.length} Friends)`}
            </button>
          )}

          {/* Squad List */}
          <div className="ifm-section-label">
            <span>🤝 Your ATX Squad ({squadList.length})</span>
          </div>

          {loadingSquad ? (
            <div className="ifm-empty">Loading your Squad...</div>
          ) : filteredSquad.length === 0 ? (
            <div className="ifm-empty">
              {squadList.length === 0
                ? 'You haven’t added any Squad friends yet. Search by @username above to invite anyone directly!'
                : 'No Squad friends match that filter.'}
            </div>
          ) : (
            <div className="ifm-list">
              {filteredSquad.map((friend) => {
                const isJoined = joinedSet.has(friend.uid);
                const isInvited = localInvitedUids.has(friend.uid);
                const isSending = Boolean(invitingUids[friend.uid]);

                return (
                  <div key={friend.uid} className="ifm-friend-card">
                    <Avatar
                      avatarUrl={friend.avatarUrl}
                      name={friend.displayName}
                      size={40}
                    />
                    <div className="ifm-friend-info">
                      <span className="ifm-friend-name">{friend.displayName}</span>
                      <span className="ifm-friend-handle">@{friend.username}</span>
                    </div>

                    {isJoined ? (
                      <span className="ifm-badge ifm-badge--joined">✓ In Roster</span>
                    ) : isInvited ? (
                      <span className="ifm-badge ifm-badge--invited">✓ Invited</span>
                    ) : (
                      <button
                        type="button"
                        className="ifm-tap-invite-btn"
                        disabled={isSending}
                        onClick={() => handleInviteFriend(friend)}
                      >
                        {isSending ? '...' : '⚡ Invite'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Other directory matches when searching */}
          {otherDirectoryMatches.length > 0 && (
            <>
              <div className="ifm-section-label" style={{ marginTop: '14px' }}>
                <span>🔎 Other ATX Players</span>
              </div>
              <div className="ifm-list">
                {otherDirectoryMatches.map((player) => {
                  const isJoined = joinedSet.has(player.uid);
                  const isInvited = localInvitedUids.has(player.uid);
                  const isSending = Boolean(invitingUids[player.uid]);

                  return (
                    <div key={player.uid} className="ifm-friend-card">
                      <Avatar
                        avatarUrl={player.avatarUrl}
                        name={player.displayName || player.username}
                        size={38}
                      />
                      <div className="ifm-friend-info">
                        <span className="ifm-friend-name">
                          {player.displayName || `@${player.username}`}
                        </span>
                        <span className="ifm-friend-handle">@{player.username}</span>
                      </div>

                      {isJoined ? (
                        <span className="ifm-badge ifm-badge--joined">✓ In Roster</span>
                      ) : isInvited ? (
                        <span className="ifm-badge ifm-badge--invited">✓ Invited</span>
                      ) : (
                        <button
                          type="button"
                          className="ifm-tap-invite-btn"
                          disabled={isSending}
                          onClick={() => handleInviteFriend(player)}
                        >
                          {isSending ? '...' : '⚡ Invite'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

