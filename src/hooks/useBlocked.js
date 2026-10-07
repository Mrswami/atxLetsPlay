import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { watchBlocked } from '../services/safety';

const EMPTY = new Set();

// Live set of uids the signed-in user has blocked.
export function useBlocked() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(EMPTY);
  const uid = user?.uid;
  useEffect(() => watchBlocked(uid, setBlocked), [uid]);
  return blocked;
}
