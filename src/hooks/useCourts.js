import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AUSTIN_COURTS_DATA } from '../data/courtsMeta';

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
          setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else {
          const fallback = AUSTIN_COURTS_DATA.filter((c) => c.district === districtId);
          setCourts(fallback);
        }
        setLoading(false);
      })
      .catch((err) => {
        const fallback = AUSTIN_COURTS_DATA.filter((c) => c.district === districtId);
        if (fallback.length > 0) {
          setCourts(fallback);
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
          const fallback = AUSTIN_COURTS_DATA.find((c) => c.id === courtId);
          if (fallback) {
            setCourt(fallback);
          } else {
            setError('Court not found');
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        const fallback = AUSTIN_COURTS_DATA.find((c) => c.id === courtId);
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

  return { games, loading };
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

  return { activeGames, gamesList, loading };
}

// ─── Join Game Transaction ──────────────────────────────────────────────────
export async function joinGame(gameId, userId) {
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

    transaction.update(gameRef, {
      currentPlayers: updatedPlayers,
      status: 'open', // Always opens up since it has one less player
    });
  });
}

