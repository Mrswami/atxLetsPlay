// Trust & safety service: verification gate, reliability (no-shows), report & block.
import { auth, db } from '../firebase/config';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';

export const NO_SHOW_WINDOW_DAYS = 30;
export const NO_SHOW_LIMIT = 3; // strikes inside the window before joining is paused
export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'no-show', label: 'Repeated no-shows' },
  { id: 'unsafe', label: 'Unsafe behavior' },
  { id: 'fake', label: 'Fake or impersonating profile' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Other' },
];

// ─── Email verification gate ────────────────────────────────────────────────
export function isVerifiedUser(u = auth.currentUser) {
  return !!u && !u.isAnonymous && !!u.emailVerified;
}

export function assertCanParticipate() {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) {
    throw new Error('Create an account and verify your email to join or host games.');
  }
  if (!u.emailVerified) {
    throw new Error('Please verify your email to join or host games. Check your inbox (and spam).');
  }
}

export async function sendVerification() {
  if (!auth.currentUser) throw new Error('Not signed in.');
  await sendEmailVerification(auth.currentUser, { url: window.location.origin });
}

// Reload the user and refresh the ID token so Firestore rules see email_verified = true.
export async function refreshVerification() {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return !!auth.currentUser.emailVerified;
}

// ─── Reliability / no-shows ─────────────────────────────────────────────────
// A host marks no-shows on their own game doc (games.noShows[]). Reliability is derived, so no
// client ever writes to another user's profile.
export async function getNoShowStats(uid) {
  const [noShowSnap, playedSnap] = await Promise.all([
    getDocs(query(collection(db, 'games'), where('noShows', 'array-contains', uid))),
    getDocs(query(collection(db, 'games'), where('currentPlayers', 'array-contains', uid))),
  ]);
  const cutoff = Date.now() - NO_SHOW_WINDOW_DAYS * 86400000;
  const recent = noShowSnap.docs.filter((d) => {
    const t = d.data().scheduledTime?.toMillis?.() ?? 0;
    return t >= cutoff;
  }).length;
  const now = Date.now();
  const attended = playedSnap.docs.filter((d) => {
    const g = d.data();
    return (g.scheduledTime?.toMillis?.() ?? now + 1) < now && !(g.noShows || []).includes(uid);
  }).length;
  const total = noShowSnap.size;
  const denom = attended + total;
  return {
    totalNoShows: total,
    recentNoShows: recent,
    attended,
    reliability: denom === 0 ? null : Math.round((attended / denom) * 100),
  };
}

export async function assertReliable(uid) {
  const { recentNoShows } = await getNoShowStats(uid);
  if (recentNoShows >= NO_SHOW_LIMIT) {
    throw new Error(
      `Joining is paused: ${recentNoShows} no-shows in the last ${NO_SHOW_WINDOW_DAYS} days. It resets automatically as they age out.`
    );
  }
}

export async function setNoShow(gameId, currentNoShows, uid, isNoShow) {
  const next = isNoShow
    ? Array.from(new Set([...(currentNoShows || []), uid]))
    : (currentNoShows || []).filter((id) => id !== uid);
  await updateDoc(doc(db, 'games', gameId), { noShows: next });
  return next;
}

// ─── Report & block ─────────────────────────────────────────────────────────
export async function reportUser(targetUid, reason, details = '', gameId = null) {
  const me = auth.currentUser;
  if (!me || me.isAnonymous) throw new Error('Sign in to report a user.');
  if (me.uid === targetUid) throw new Error('You cannot report yourself.');
  await addDoc(collection(db, 'reports'), {
    reporterId: me.uid,
    targetId: targetUid,
    reason,
    details: String(details).slice(0, 500),
    gameId,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function blockUser(targetUid) {
  const me = auth.currentUser;
  if (!me || me.isAnonymous) throw new Error('Sign in to block a user.');
  if (me.uid === targetUid) throw new Error('You cannot block yourself.');
  await setDoc(doc(db, 'users', me.uid, 'blocks', targetUid), { createdAt: serverTimestamp() });
}

export async function unblockUser(targetUid) {
  const me = auth.currentUser;
  if (!me) return;
  await deleteDoc(doc(db, 'users', me.uid, 'blocks', targetUid));
}

// Live set of uids the current user has blocked. Returns an unsubscribe fn.
export function watchBlocked(uid, cb) {
  if (!uid || String(uid).startsWith('guest-')) {
    cb(new Set());
    return () => {};
  }
  return onSnapshot(
    collection(db, 'users', uid, 'blocks'),
    (snap) => cb(new Set(snap.docs.map((d) => d.id))),
    () => cb(new Set())
  );
}
