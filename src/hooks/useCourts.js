import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── Fetch all courts for a specific district ─────────────────────────────────
export function useDistrictCourts(districtId) {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!districtId) return;
    setLoading(true);
    const q = query(
      collection(db, 'courts'),
      where('district', '==', districtId),
      where('status', '==', 'active')
    );
    getDocs(q)
      .then((snap) => {
        setCourts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
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
    setLoading(true);
    getDoc(doc(db, 'courts', courtId))
      .then((snap) => {
        if (snap.exists()) {
          setCourt({ id: snap.id, ...snap.data() });
        } else {
          setError('Court not found');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [courtId]);

  return { court, loading, error };
}

// ─── Fetch active games for a court ──────────────────────────────────────────
export function useCourtGames(courtId) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courtId) return;
    setLoading(true);
    const q = query(
      collection(db, 'games'),
      where('courtId', '==', courtId),
      where('status', '==', 'open'),
      orderBy('scheduledTime', 'asc')
    );
    getDocs(q)
      .then((snap) => {
        setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [courtId]);

  return { games, loading };
}
