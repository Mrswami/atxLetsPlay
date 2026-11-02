import { db } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  query, 
  where, 
  updateDoc, 
  arrayUnion,
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';

/**
 * Resolves a list of @usernames into unique target UIDs.
 */
export async function resolveUsernamesToUids(rawUsernames = [], excludeUid = null) {
  const cleaned = Array.from(
    new Set(
      rawUsernames
        .map((u) => String(u || '').trim().replace(/^@/, '').toLowerCase())
        .filter(Boolean)
    )
  );
  const uids = [];
  for (const username of cleaned) {
    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;
        if (uid && uid !== excludeUid) {
          uids.push(uid);
        }
      }
    } catch (err) {
      console.warn('Error resolving @' + username, err);
    }
  }
  return Array.from(new Set(uids));
}

/**
 * Sends direct court invite documents to a list of target UIDs and adds them to game.invitedPlayers.
 */
export async function sendDirectGameInvites(targetUids = [], senderUser, game) {
  const gId = game?.id || game?.gameId;
  if (!targetUids.length || !senderUser?.uid || !gId) return;

  for (const targetUid of targetUids) {
    if (!targetUid || targetUid === senderUser.uid) continue;
    try {
      await addDoc(collection(db, 'invites'), {
        targetUid,
        senderUid: senderUser.uid,
        senderName: senderUser.displayName || 'Player',
        senderUsername: senderUser.username || '',
        senderAvatar: senderUser.avatarUrl || '',
        gameId: gId,
        courtName: game.courtName || 'Austin Court',
        courtId: game.courtId || '',
        sport: game.sport || 'pickup',
        type: 'direct_invite',
        status: 'pending',
        text: `Invited you to join ${game.sport || 'pickup'} at ${game.courtName || 'Austin Court'}`,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error sending direct invite:', err);
    }
  }

  try {
    await updateDoc(doc(db, 'games', gId), {
      invitedPlayers: arrayUnion(...targetUids),
    });
  } catch (err) {
    console.warn('Could not update game invitedPlayers:', err);
  }
}

/**
 * Parses text for `@username` mentions, resolves user IDs, and sends court invites/notifications.
 */
export async function processChatMentions(text, senderUser, game) {
  if (!text || !text.includes('@')) return;

  const mentionMatches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!mentionMatches || mentionMatches.length === 0) return;

  const usernames = Array.from(new Set(mentionMatches.map(m => m.slice(1).toLowerCase())));
  const gId = game.id || game.gameId;

  for (const username of usernames) {
    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      if (!usernameDoc.exists()) continue;

      const targetUid = usernameDoc.data().uid;
      if (targetUid === senderUser.uid) continue; // Don't invite self

      if (gId) {
        await updateDoc(doc(db, 'games', gId), {
          invitedPlayers: arrayUnion(targetUid),
        }).catch(() => {});
      }

      await addDoc(collection(db, 'invites'), {
        targetUid,
        senderUid: senderUser.uid,
        senderName: senderUser.displayName || 'Player',
        senderUsername: senderUser.username || '',
        senderAvatar: senderUser.avatarUrl || '',
        gameId: gId,
        courtName: game.courtName || 'Austin Court',
        courtId: game.courtId || '',
        sport: game.sport || 'pickup',
        type: 'chat_mention',
        status: 'pending',
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error processing mention for @' + username, err);
    }
  }
}

/**
 * Subscribes to real-time pending invites for a target user.
 */
export function subscribeToUserInvites(uid, callback) {
  if (!uid || uid.startsWith('guest-')) return () => {};
  const q = query(
    collection(db, 'invites'),
    where('targetUid', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(invites);
  }, (err) => {
    console.warn('Invites subscription notice:', err);
    callback([]);
  });
}

/**
 * Responds to a court invite (accept or decline).
 */
export async function respondToInvite(inviteId, accept = true) {
  const inviteRef = doc(db, 'invites', inviteId);
  await updateDoc(inviteRef, {
    status: accept ? 'accepted' : 'declined',
    updatedAt: serverTimestamp(),
  });
}
