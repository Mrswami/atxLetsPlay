import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

export async function getFriendshipStatus(uid1, uid2) {
  if (!uid1 || !uid2) return null;
  const id = [uid1, uid2].sort().join('_');
  const docRef = doc(db, 'friendships', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function sendFriendRequest(senderId, receiverId) {
  const id = [senderId, receiverId].sort().join('_');
  await setDoc(doc(db, 'friendships', id), {
    user1: [senderId, receiverId].sort()[0],
    user2: [senderId, receiverId].sort()[1],
    status: 'pending',
    actionUser: senderId,
    updatedAt: serverTimestamp()
  });
}

export async function acceptFriendRequest(uid1, uid2) {
  const id = [uid1, uid2].sort().join('_');
  await updateDoc(doc(db, 'friendships', id), {
    status: 'accepted',
    updatedAt: serverTimestamp()
  });
}

export async function removeFriendOrRequest(uid1, uid2) {
  const id = [uid1, uid2].sort().join('_');
  await deleteDoc(doc(db, 'friendships', id));
}

export async function getUserFriendships(uid) {
  const q1 = query(collection(db, 'friendships'), where('user1', '==', uid));
  const q2 = query(collection(db, 'friendships'), where('user2', '==', uid));
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const all = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }));
  
  // Deduplicate just in case
  const unique = [];
  const seen = new Set();
  for (const f of all) {
    if (!seen.has(f.id)) {
      seen.add(f.id);
      unique.push(f);
    }
  }
  return unique;
}
