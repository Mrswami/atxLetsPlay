import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { getActiveRecurringPartnerGames } from '../data/partnerOrganizers';
import { assertCanParticipate, assertReliable } from '../services/safety';
import { useBlocked } from './useBlocked';

export function isUserAllowedToSeeGame(game, uid) {
  const isInviteOnly = Boolean(game?.isInviteOnly || game?.privacyMode === 'invite_only');
  if (!isInviteOnly) return true;
  if (!uid) return false;
  return (
    game.createdBy === uid ||
    game.hostId === uid ||
    (game.currentPlayers || []).includes(uid) ||
    (game.invitedPlayers || []).includes(uid)
  );
}

function useCurrentUid() {
  const [uid, setUid] = useState(() => auth?.currentUser?.uid || null);
  useEffect(() => {
    if (!auth?.onAuthStateChanged) return;
    const unsub = auth.onAuthStateChanged((u) => setUid(u?.uid || null));
    return () => unsub();
  }, []);
  return uid;
}

// Helper map for canonical court array ordering
const canonicalOrderMap = new Map();
AUSTIN_COURTS_DATA.forEach((c, idx) => {
  canonicalOrderMap.set(c.id, idx);
  if (c.id === 'mueller-hangar-browning') {
    canonicalOrderMap.set('mueller-paggi-square', idx);
    canonicalOrderMap.set('mueller-petanque', idx);
  }
});

const sortCourtsByCanonicalOrder = (courtList) => {
  return [...courtList].sort((a, b) => {
    const idxA = canonicalOrderMap.has(a.id) ? canonicalOrderMap.get(a.id) : 9999;
    const idxB = canonicalOrderMap.has(b.id) ? canonicalOrderMap.get(b.id) : 9999;
    return idxA - idxB;
  });
};

// ─── Fetch all courts for a specific district ─────────────────────────────────
export function useDistrictCourts(districtId) {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!districtId) return;
    const q = query(
      collection(db, 'courts'),
      where('district', '==', districtId),
      where('status', '==', 'active')
    );
    getDocs(q)
      .then((snap) => {
        if (!snap.empty) {
          const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const rawIds = new Set(raw.map((c) => c.id));
          const localOnly = AUSTIN_COURTS_DATA.filter((c) => c.district === districtId && !rawIds.has(c.id));
          setCourts(sortCourtsByCanonicalOrder([...raw, ...localOnly]));
        } else {
          const fallback = AUSTIN_COURTS_DATA.filter((c) => c.district === districtId);
          setCourts(sortCourtsByCanonicalOrder(fallback));
        }
        setLoading(false);
      })
      .catch((err) => {
        const fallback = AUSTIN_COURTS_DATA.filter((c) => c.district === districtId);
        if (fallback.length > 0) {
          setCourts(sortCourtsByCanonicalOrder(fallback));
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [districtId]);

  return { courts, loading, error };
}

// ─── Fetch a single court by ID ───────────────────────────────────────────────
export function useCourt(courtId) {
  const [court, setCourt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courtId) return;
    getDoc(doc(db, 'courts', courtId))
      .then((snap) => {
        if (snap.exists()) {
          setCourt({ id: snap.id, ...snap.data() });
        } else {
          const fallback = AUSTIN_COURTS_DATA.find((c) => c.id === courtId || (['mueller-paggi-square', 'mueller-petanque'].includes(courtId) && c.id === 'mueller-hangar-browning'));
          if (fallback) {
            setCourt(fallback);
          } else {
            setError('Court not found');
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        const fallback = AUSTIN_COURTS_DATA.find((c) => c.id === courtId || (['mueller-paggi-square', 'mueller-petanque'].includes(courtId) && c.id === 'mueller-hangar-browning'));
        if (fallback) {
          setCourt(fallback);
        } else {
          setError(err.message);
        }
        setLoading(false);
      });
  }, [courtId]);

  return { court, loading, error };
}

// ─── Fetch active games for a court (Real-time) ───────────────────────────────
export function useCourtGames(courtId) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courtId) return;
    const q = query(
      collection(db, 'games'),
      where('courtId', '==', courtId),
      where('status', 'in', ['open', 'full']),
      orderBy('scheduledTime', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching court games:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courtId]);

  const blocked = useBlocked();
  const currentUid = useCurrentUid();
  const visible = useMemo(() => {
    const partnerGames = getActiveRecurringPartnerGames().filter(g => g.courtId === courtId);
    // Don't duplicate if a game with the same ID is already in Firestore
    const firestoreIds = new Set(games.map(g => g.id));
    const combined = [...games, ...partnerGames.filter(pg => !firestoreIds.has(pg.id))];
    return combined.filter((g) => !blocked.has(g.createdBy) && isUserAllowedToSeeGame(g, currentUid));
  }, [games, courtId, blocked, currentUid]);
  return { games: visible, loading };
}

// ─── Fetch all active/open games across Austin (Real-time) ───────────────────
export function useAllActiveGames() {
  const [activeGames, setActiveGames] = useState({});
  const [gamesList, setGamesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUid = useCurrentUid();

  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('status', 'in', ['open', 'full']),
      orderBy('scheduledTime', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGamesList(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching all active games:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const blocked = useBlocked();
  const visibleList = useMemo(() => {
    const partnerGames = getActiveRecurringPartnerGames();
    const firestoreIds = new Set(gamesList.map(g => g.id));
    const combined = [...gamesList, ...partnerGames.filter(pg => !firestoreIds.has(pg.id))];
    return combined.filter((g) => !blocked.has(g.createdBy) && isUserAllowedToSeeGame(g, currentUid));
  }, [gamesList, blocked, currentUid]);

  useEffect(() => {
    const counts = {};
    visibleList.forEach((game) => {
      if (game.district && game.status === 'open') {
        counts[game.district] = (counts[game.district] || 0) + 1;
      }
    });
    setActiveGames(counts);
  }, [visibleList]);

  return { activeGames, gamesList: visibleList, loading };
}

// ─── Join Game Transaction ──────────────────────────────────────────────────
export async function joinGame(gameId, userId) {
  // Trust & safety gates: verified email + not paused for repeated no-shows
  assertCanParticipate();
  await assertReliable(userId);
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) {
      throw new Error('Game does not exist');
    }
    const data = gameDoc.data();
    if (data.status !== 'open') {
      throw new Error('Game is not open');
    }
    const current = data.currentPlayers || [];
    if (current.includes(userId)) {
      return; // Already joined
    }

    const isHost = data.createdBy === userId || data.hostId === userId;
    const isInvited = (data.invitedPlayers || []).includes(userId);
    const isInviteOnly = Boolean(data.isInviteOnly || data.privacyMode === 'invite_only');

    if (isInviteOnly && !isHost && !isInvited) {
      throw new Error('This match is Invite-Only. You must be invited by the host to join.');
    }
    if (data.isPrivate && !isHost && !isInvited) {
      throw new Error('This game requires host approval. Tap "Request to Join" instead.');
    }

    const max = data.maxPlayers || 10;
    if (current.length >= max) {
      throw new Error('Game is full');
    }

    const updatedPlayers = [...current, userId];
    const updatedRequests = (data.joinRequests || []).filter((id) => id !== userId);
    const newStatus = updatedPlayers.length >= max ? 'full' : 'open';

    transaction.update(gameRef, {
      currentPlayers: updatedPlayers,
      joinRequests: updatedRequests,
      status: newStatus,
    });
  });
}

// ─── Leave Game Transaction ─────────────────────────────────────────────────
export async function leaveGame(gameId, userId) {
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) {
      throw new Error('Game does not exist');
    }
    const data = gameDoc.data();
    const current = data.currentPlayers || [];
    if (!current.includes(userId)) {
      return; // Not joined
    }

    const updatedPlayers = current.filter((id) => id !== userId);

    if (updatedPlayers.length === 0) {
      transaction.delete(gameRef);
    } else {
      transaction.update(gameRef, {
        currentPlayers: updatedPlayers,
        status: 'open', // Always opens up since it has one less player
      });
    }
  });
}

// ─── Private Game Join Requests ───────────────────────────────────────────────
export async function requestJoinGame(gameId, userId) {
  assertCanParticipate();
  await assertReliable(userId);
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) throw new Error('Game does not exist');
    const data = gameDoc.data();
    if (!data.isPrivate) throw new Error('Game is not private, you can join directly');
    const requests = data.joinRequests || [];
    if (requests.includes(userId)) return; // Already requested
    if ((data.currentPlayers || []).includes(userId)) return; // Already joined
    transaction.update(gameRef, {
      joinRequests: [...requests, userId]
    });
  });
}

export async function cancelJoinRequest(gameId, userId) {
  assertCanParticipate();
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) throw new Error('Game does not exist');
    const data = gameDoc.data();
    const requests = data.joinRequests || [];
    if (!requests.includes(userId)) return;
    transaction.update(gameRef, {
      joinRequests: requests.filter((id) => id !== userId)
    });
  });
}

export async function approveJoinRequest(gameId, targetUserId, hostId) {
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) throw new Error('Game does not exist');
    const data = gameDoc.data();
    if (data.createdBy !== hostId) throw new Error('Only the host can approve');
    
    let requests = data.joinRequests || [];
    let current = data.currentPlayers || [];
    const max = data.maxPlayers || 10;
    
    if (current.length >= max) throw new Error('Game is full');
    
    requests = requests.filter(id => id !== targetUserId);
    if (!current.includes(targetUserId)) {
      current.push(targetUserId);
    }
    
    const newStatus = current.length >= max ? 'full' : 'open';
    
    transaction.update(gameRef, {
      joinRequests: requests,
      currentPlayers: current,
      status: newStatus
    });
  });
}

export async function denyJoinRequest(gameId, targetUserId, hostId) {
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) throw new Error('Game does not exist');
    const data = gameDoc.data();
    if (data.createdBy !== hostId) throw new Error('Only the host can deny');
    
    let requests = data.joinRequests || [];
    requests = requests.filter(id => id !== targetUserId);
    
    transaction.update(gameRef, {
      joinRequests: requests
    });
  });
}

// ─── Kick Player ─────────────────────────────────────────────────────────────
export async function kickPlayer(gameId, targetUserId, hostId) {
  const gameRef = doc(db, 'games', gameId);
  return runTransaction(db, async (transaction) => {
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists()) throw new Error('Game does not exist');
    const data = gameDoc.data();
    if (data.createdBy !== hostId) throw new Error('Only the host can kick players');
    if (targetUserId === hostId) throw new Error('Cannot kick yourself');
    
    const current = data.currentPlayers || [];
    if (!current.includes(targetUserId)) return;
    
    const updatedPlayers = current.filter(id => id !== targetUserId);
    
    transaction.update(gameRef, {
      currentPlayers: updatedPlayers,
      status: 'open'
    });
  });
}
