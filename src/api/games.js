import {
  collection,
  addDoc,
  updateDoc,
  doc,
  arrayUnion,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── CREATE GAME ───
export async function createGame({ sport, courtName, spots, date, time, vibeNote, district, districtName, user, userProfile }) {
  return addDoc(collection(db, 'games'), {
    sport,
    courtName,
    spots,
    spotsLeft: spots,
    date,
    time,
    vibeNote,
    district,
    districtName,
    creatorId: user.uid,
    creatorName: userProfile?.displayName || 'Player',
    creatorHandle: userProfile?.handle || '',
    players: [user.uid],
    createdAt: serverTimestamp(),
    status: 'open',
  });
}

// ─── JOIN GAME ───
export async function joinGame(gameId, userId) {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    players: arrayUnion(userId),
    spotsLeft: -1, // Firestore increment handled server-side via FieldValue ideally, but simple decrement for now
  });
}

// ─── GET ALL OPEN GAMES ───
export async function getOpenGames(districtFilter = null) {
  const constraints = [
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  ];
  if (districtFilter) {
    constraints.unshift(where('district', '==', districtFilter));
  }
  const q = query(collection(db, 'games'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── CLOSE / DELETE GAME ───
export async function closeGame(gameId) {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { status: 'closed' });
}
