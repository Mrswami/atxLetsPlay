import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import { assertCanParticipate, assertReliable } from '../services/safety';
import { useBlocked } from './useBlocked';

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
          setCourts(sortCourtsByCanonicalOrder(raw));
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
  const visible = useMemo(() => games.filter((g) => !blocked.has(g.createdBy)), [games, blocked]);
  return { games: visible, loading };
}

// ─── Fetch all active/open games across Austin (Real-time) ───────────────────
export function useAllActiveGames() {
  const [activeGames, setActiveGames] = useState({});
  const [gamesList, setGamesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'games'),
      where('status', 'in', ['open', 'full']),
      orderBy('scheduledTime', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGamesList(list);

      // Group by district to count active open games
      const counts = {};
      list.forEach((game) => {
        if (game.district && game.status === 'open') {
          counts[game.district] = (counts[game.district] || 0) + 1;
        }
      });
      setActiveGames(counts);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching all active games:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const blocked = useBlocked();
  const visibleList = useMemo(() => gamesList.filter((g) => !blocked.has(g.createdBy)), [gamesList, blocked]);
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
    const max = data.maxPlayers || 10;
    if (current.length >= max) {
      throw new Error('Game is full');
    }

    const updatedPlayers = [...current, userId];
    const newStatus = updatedPlayers.length >= max ? 'full' : 'open';

    transaction.update(gameRef, {
      currentPlayers: updatedPlayers,
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

